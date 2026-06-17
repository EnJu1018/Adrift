import Foundation

@MainActor
final class FriendsViewModel: ObservableObject {
    @Published var friends: [Friend] = []
    @Published var requests: [FriendRequest] = []
    @Published var sentRequests: [FriendRequest] = []
    @Published var searchResult: SearchUserResult?
    @Published var isLoading = false
    @Published var isSearching = false
    @Published var errorMessage: String?
    @Published var searchMessage: String?

    private let service: FriendService
    private var isRefreshing = false

    init(service: FriendService = FriendService()) {
        self.service = service
    }

    func load(silently: Bool = false) async {
        guard !isRefreshing else { return }
        isRefreshing = true
        let showsInitialLoading = friends.isEmpty && requests.isEmpty && sentRequests.isEmpty && !silently
        if showsInitialLoading {
            isLoading = true
            errorMessage = nil
        }

        defer {
            isRefreshing = false
            if showsInitialLoading {
                isLoading = false
            }
        }

        do {
            async let nextFriends = service.fetchFriends()
            async let nextRequests = service.fetchRequests()
            async let nextSentRequests = service.fetchSentRequests()
            friends = try await nextFriends
            requests = try await nextRequests
            sentRequests = try await nextSentRequests
            errorMessage = nil
        } catch {
            if !silently || (friends.isEmpty && requests.isEmpty && sentRequests.isEmpty) {
                errorMessage = error.localizedDescription
            }
        }
    }

    func search(userCode: String) async {
        let trimmed = userCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        isSearching = true
        searchMessage = nil
        do {
            searchResult = try await service.searchUser(userCode: trimmed)
        } catch {
            searchMessage = error.localizedDescription
        }
        isSearching = false
    }

    func sendRequest() async {
        guard let searchResult else { return }
        do {
            try await service.sendFriendRequest(targetUserId: searchResult.id)
            searchMessage = "好友邀請已送出"
            await load(silently: true)
        } catch {
            searchMessage = error.localizedDescription
        }
    }

    func accept(_ request: FriendRequest) async {
        do {
            try await service.acceptRequest(id: request.id)
            await load(silently: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func reject(_ request: FriendRequest) async {
        do {
            try await service.rejectRequest(id: request.id)
            await load(silently: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
