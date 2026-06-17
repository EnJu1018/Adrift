import Foundation

enum APIConfig {
    // Production API. Local development can temporarily switch this to http://localhost:5000.
    static let baseURL = URL(string: "https://adrifttw.com/api")!

    static func assetURL(from path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        if path.hasPrefix("http") || path.hasPrefix("data:") || path.hasPrefix("blob:") {
            return URL(string: path)
        }

        let trimmedBase = baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let trimmedPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !trimmedPath.isEmpty else { return nil }
        return URL(string: "\(trimmedBase)/\(trimmedPath)")
    }
}
