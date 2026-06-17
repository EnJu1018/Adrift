import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case delete = "DELETE"
}

enum APIError: LocalizedError {
    case invalidURL
    case missingData
    case server(message: String, statusCode: Int)
    case decoding
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "API URL 設定不正確"
        case .missingData:
            return "伺服器沒有回傳資料"
        case .server(let message, _):
            return message
        case .decoding:
            return "資料格式暫時無法讀取"
        case .transport:
            return "網路連線失敗，請稍後再試"
        }
    }
}

final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let tokenStore: TokenStore
    private let decoder: JSONDecoder

    init(session: URLSession = .shared, tokenStore: TokenStore = .shared) {
        self.session = session
        self.tokenStore = tokenStore
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            let isoFormatter = ISO8601DateFormatter()
            isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = isoFormatter.date(from: value) {
                return date
            }
            isoFormatter.formatOptions = [.withInternetDateTime]
            if let date = isoFormatter.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO date")
        }
    }

    func request<T: Decodable>(
        _ path: String,
        method: HTTPMethod = .get,
        queryItems: [URLQueryItem] = [],
        body: Encodable? = nil,
        authorized: Bool = true
    ) async throws -> APIResponse<T> {
        var components = URLComponents(url: APIConfig.baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))), resolvingAgainstBaseURL: false)
        components?.queryItems = queryItems.isEmpty ? nil : queryItems

        guard let url = components?.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if authorized, let token = tokenStore.read() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONEncoder().encode(AnyEncodable(body))
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        return try await perform(request)
    }

    func multipart<T: Decodable>(
        _ path: String,
        fields: [String: String],
        files: [MultipartFile] = [],
        method: HTTPMethod = .post,
        authorized: Bool = true
    ) async throws -> APIResponse<T> {
        let url = APIConfig.baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if authorized, let token = tokenStore.read() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = makeMultipartBody(fields: fields, files: files, boundary: boundary)

        return try await perform(request)
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> APIResponse<T> {
        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.server(message: "伺服器回應不正確", statusCode: 0)
        }

        do {
            let decoded = try decoder.decode(APIResponse<T>.self, from: data)
            if !(200..<300).contains(httpResponse.statusCode) || decoded.success == false {
                throw APIError.server(message: decoded.message, statusCode: httpResponse.statusCode)
            }
            return decoded
        } catch let apiError as APIError {
            throw apiError
        } catch {
            if let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = payload["message"] as? String {
                throw APIError.server(message: message, statusCode: httpResponse.statusCode)
            }
            throw APIError.decoding
        }
    }

    private func makeMultipartBody(fields: [String: String], files: [MultipartFile], boundary: String) -> Data {
        var data = Data()
        for (key, value) in fields {
            data.append("--\(boundary)\r\n")
            data.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n")
            data.append("\(value)\r\n")
        }
        for file in files {
            data.append("--\(boundary)\r\n")
            data.append("Content-Disposition: form-data; name=\"\(file.fieldName)\"; filename=\"\(file.fileName)\"\r\n")
            data.append("Content-Type: \(file.mimeType)\r\n\r\n")
            data.append(file.data)
            data.append("\r\n")
        }
        data.append("--\(boundary)--\r\n")
        return data
    }
}

struct MultipartFile {
    let fieldName: String
    let fileName: String
    let mimeType: String
    let data: Data
}

private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        encodeClosure = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}

private extension Data {
    mutating func append(_ string: String) {
        append(Data(string.utf8))
    }
}
