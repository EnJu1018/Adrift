import Foundation

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct RegisterRequest: Encodable {
    let name: String
    let email: String
    let password: String
    let userCode: String
}

final class AuthService {
    private let client: APIClient
    private let tokenStore: TokenStore

    init(client: APIClient = .shared, tokenStore: TokenStore = .shared) {
        self.client = client
        self.tokenStore = tokenStore
    }

    func login(email: String, password: String) async throws -> AuthResponse {
        let response: APIResponse<AuthResponse> = try await client.request(
            "/auth/login",
            method: .post,
            body: LoginRequest(email: email, password: password),
            authorized: false
        )

        let auth = response.data ?? {
            if let token = response.token, let user = response.user {
                return AuthResponse(token: token, user: user)
            }
            return nil
        }()

        guard let auth else { throw APIError.missingData }
        try tokenStore.save(auth.token)
        return auth
    }

    func register(name: String, email: String, password: String, userCode: String) async throws -> AuthResponse {
        let _: APIResponse<RegisterResponse> = try await client.request(
            "/auth/register",
            method: .post,
            body: RegisterRequest(name: name, email: email, password: password, userCode: userCode),
            authorized: false
        )
        return try await login(email: email, password: password)
    }

    func fetchCurrentUser() async throws -> User {
        let response: APIResponse<User> = try await client.request("/users/me")
        guard let user = response.data else { throw APIError.missingData }
        return user
    }

    func logout() {
        tokenStore.clear()
    }
}
