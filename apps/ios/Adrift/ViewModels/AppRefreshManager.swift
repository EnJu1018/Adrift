import Foundation

enum AppRefreshScope: Hashable {
    case user
    case diaries
    case friends
}

@MainActor
final class AppRefreshManager: ObservableObject {
    @Published private(set) var isRefreshing = false

    private var handlers: [AppRefreshScope: (_ isInitialLoad: Bool) async -> Void] = [:]
    private var lastRefreshDates: [AppRefreshScope: Date] = [:]

    func configure(
        authViewModel: AuthViewModel,
        mapViewModel: MapDiaryViewModel,
        friendsViewModel: FriendsViewModel
    ) {
        handlers[.user] = { [weak authViewModel] _ in
            await authViewModel?.refreshCurrentUser(silently: true)
        }
        handlers[.diaries] = { [weak mapViewModel] isInitialLoad in
            await mapViewModel?.loadDiaries(silently: !isInitialLoad)
        }
        handlers[.friends] = { [weak friendsViewModel] isInitialLoad in
            await friendsViewModel?.load(silently: !isInitialLoad)
        }

        if authViewModel.currentUser != nil, lastRefreshDates[.user] == nil {
            lastRefreshDates[.user] = Date()
        }
    }

    func refreshIfNeeded(
        scopes: Set<AppRefreshScope> = [.user, .diaries, .friends],
        force: Bool = false,
        minimumInterval: TimeInterval = 30
    ) async {
        guard !isRefreshing else { return }

        let now = Date()
        let eligibleScopes = scopes.filter { scope in
            guard !force, let lastRefreshDate = lastRefreshDates[scope] else {
                return true
            }
            return now.timeIntervalSince(lastRefreshDate) >= minimumInterval
        }

        guard !eligibleScopes.isEmpty else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        for scope in orderedScopes.filter(eligibleScopes.contains) {
            guard let handler = handlers[scope] else { continue }
            await handler(lastRefreshDates[scope] == nil)
            lastRefreshDates[scope] = Date()
        }
    }

    private let orderedScopes: [AppRefreshScope] = [.user, .diaries, .friends]
}
