import Foundation

enum SessionState: Equatable {
    case checking
    case authenticated
    case signedOut
}

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var sessionState: SessionState = .checking
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var isUploadingAvatar = false
    @Published var errorMessage: String?
    private var isRefreshingCurrentUser = false

    private let authService: AuthService
    private let userService: UserService
    private let tokenStore: TokenStore
    private let userCacheKey = "adrift_current_user"

    init(authService: AuthService = AuthService(), userService: UserService = UserService(), tokenStore: TokenStore = .shared) {
        self.authService = authService
        self.userService = userService
        self.tokenStore = tokenStore
        currentUser = Self.readCachedUser(key: userCacheKey)
    }

    func bootstrap() async {
        guard tokenStore.read() != nil else {
            sessionState = .signedOut
            return
        }

        do {
            currentUser = try await withTimeout(seconds: 8) {
                try await self.authService.fetchCurrentUser()
            }
            cacheCurrentUser()
            sessionState = .authenticated
        } catch {
            logout()
        }
    }

    func login(email: String, password: String) async {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalizedEmail.contains("@") else {
            errorMessage = "請輸入註冊電子郵件，不是使用者代碼。"
            return
        }

        await runAuthAction {
            let auth = try await authService.login(email: normalizedEmail, password: password)
            currentUser = auth.user
            cacheCurrentUser()
            sessionState = .authenticated
        }
    }

    func register(name: String, email: String, password: String, userCode: String) async {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        await runAuthAction {
            let auth = try await authService.register(name: name, email: normalizedEmail, password: password, userCode: userCode)
            currentUser = auth.user
            cacheCurrentUser()
            sessionState = .authenticated
        }
    }

    func refreshCurrentUser(silently: Bool = false) async {
        guard !isRefreshingCurrentUser else { return }
        isRefreshingCurrentUser = true
        defer { isRefreshingCurrentUser = false }

        do {
            currentUser = try await authService.fetchCurrentUser()
            cacheCurrentUser()
        } catch {
            if case APIError.server(_, let statusCode) = error, statusCode == 401 {
                logout()
                return
            }
            if !silently {
                errorMessage = error.localizedDescription
            }
        }
    }

    func logout() {
        authService.logout()
        currentUser = nil
        UserDefaults.standard.removeObject(forKey: userCacheKey)
        sessionState = .signedOut
    }

    func uploadAvatar(data: Data, mimeType: String) async {
        isUploadingAvatar = true
        errorMessage = nil
        do {
            currentUser = try await userService.uploadAvatar(data: data, mimeType: mimeType)
            cacheCurrentUser()
        } catch {
            errorMessage = error.localizedDescription
        }
        isUploadingAvatar = false
    }

    private func runAuthAction(_ action: () async throws -> Void) async {
        isLoading = true
        errorMessage = nil
        do {
            try await action()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func cacheCurrentUser() {
        guard let currentUser, let data = try? JSONEncoder().encode(currentUser) else { return }
        UserDefaults.standard.set(data, forKey: userCacheKey)
    }

    private static func readCachedUser(key: String) -> User? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(User.self, from: data)
    }

    private func withTimeout<T>(seconds: UInt64, operation: @escaping () async throws -> T) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                try await operation()
            }
            group.addTask {
                try await Task.sleep(nanoseconds: seconds * 1_000_000_000)
                throw APIError.transport(URLError(.timedOut))
            }

            guard let result = try await group.next() else {
                throw APIError.transport(URLError(.timedOut))
            }
            group.cancelAll()
            return result
        }
    }
}
