import Foundation

final class DiaryService {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    func fetchDiaries() async throws -> [Diary] {
        let response: APIResponse<DiaryListData> = try await client.request("/diaries")
        return response.data?.diaries ?? []
    }

    func createDiary(_ request: CreateDiaryRequest) async throws -> Diary {
        let fields: [String: String] = [
            "title": request.title,
            "text": request.text,
            "moodType": request.mood.apiValue,
            "moodIntensity": "\(request.intensity)",
            "visibility": request.visibility.rawValue,
            "lat": "\(request.latitude)",
            "lng": "\(request.longitude)",
            "placeName": request.placeName,
            "locationAccuracy": "precise"
        ]
        var files: [MultipartFile] = []
        if let imageData = request.imageData {
            files.append(
                MultipartFile(
                    fieldName: "image",
                    fileName: "adrift-diary-\(UUID().uuidString).jpg",
                    mimeType: request.imageMimeType ?? "image/jpeg",
                    data: imageData
                )
            )
        }

        let response: APIResponse<DiaryDetailData> = try await client.multipart("/diaries", fields: fields, files: files)
        guard let diary = response.data?.diary else { throw APIError.missingData }
        return diary
    }
}

struct DiaryDetailData: Decodable {
    let diary: Diary
}
