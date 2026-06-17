import Foundation

final class FriendService {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    func fetchFriends() async throws -> [Friend] {
        let response: APIResponse<[Friend]> = try await client.request("/friends")
        return response.data ?? []
    }

    func fetchRequests() async throws -> [FriendRequest] {
        let response: APIResponse<[FriendRequest]> = try await client.request("/friends/requests")
        return response.data ?? []
    }

    func fetchSentRequests() async throws -> [FriendRequest] {
        let response: APIResponse<[FriendRequest]> = try await client.request("/friends/requests/sent")
        return response.data ?? []
    }

    func searchUser(userCode: String) async throws -> SearchUserResult {
        let response: APIResponse<SearchUserResult> = try await client.request(
            "/users/search",
            queryItems: [URLQueryItem(name: "userCode", value: userCode)]
        )
        guard let user = response.data else { throw APIError.missingData }
        return user
    }

    func sendFriendRequest(targetUserId: String) async throws {
        let _: APIResponse<EmptyResponse> = try await client.request(
            "/friends/request",
            method: .post,
            body: ["targetUserId": targetUserId]
        )
    }

    func acceptRequest(id: String) async throws {
        let _: APIResponse<EmptyResponse> = try await client.request("/friends/requests/\(id)/accept", method: .post)
    }

    func rejectRequest(id: String) async throws {
        let _: APIResponse<EmptyResponse> = try await client.request("/friends/requests/\(id)/reject", method: .post)
    }
}

struct EmptyResponse: Decodable {}
