import Foundation

final class UserService {
    private let authService: AuthService
    private let client: APIClient

    init(authService: AuthService = AuthService(), client: APIClient = .shared) {
        self.authService = authService
        self.client = client
    }

    func fetchCurrentUser() async throws -> User {
        try await authService.fetchCurrentUser()
    }

    func uploadAvatar(data: Data, mimeType: String) async throws -> User {
        let file = MultipartFile(
            fieldName: "avatar",
            fileName: "avatar.\(mimeType.fileExtension)",
            mimeType: mimeType,
            data: data
        )
        let response: APIResponse<UserUpdateData> = try await client.multipart(
            "/users/me/avatar",
            fields: [:],
            files: [file],
            method: .patch
        )
        guard let user = response.data?.user else { throw APIError.missingData }
        return user
    }
}

struct UserUpdateData: Decodable {
    let user: User
}

private extension String {
    var fileExtension: String {
        switch self {
        case "image/png":
            return "png"
        case "image/webp":
            return "webp"
        default:
            return "jpg"
        }
    }
}
