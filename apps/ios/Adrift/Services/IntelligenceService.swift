import Foundation

final class IntelligenceService {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    func generateInsight() async throws -> IntelligenceResult {
        let response: APIResponse<IntelligenceResult> = try await client.request("/ai/life-map")
        guard let result = response.data else { throw APIError.missingData }
        return result
    }
}
