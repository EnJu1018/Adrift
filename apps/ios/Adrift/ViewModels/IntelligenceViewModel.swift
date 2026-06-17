import Foundation

@MainActor
final class IntelligenceViewModel: ObservableObject {
    @Published var result: IntelligenceResult?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let service: IntelligenceService

    init(service: IntelligenceService = IntelligenceService()) {
        self.service = service
    }

    func generate() async {
        isLoading = true
        errorMessage = nil
        do {
            result = try await service.generateInsight()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
