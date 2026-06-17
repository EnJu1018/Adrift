import Foundation

struct APIResponse<T: Decodable>: Decodable {
    let success: Bool
    let message: String
    let data: T?
    let token: String?
    let user: User?
}

extension KeyedDecodingContainer {
    func decodeFlexibleString(forKeys keys: [Key]) throws -> String {
        for key in keys {
            if let value = try? decode(String.self, forKey: key), !value.isEmpty {
                return value
            }

            if let value = try? decode(ObjectIDValue.self, forKey: key), !value.oid.isEmpty {
                return value.oid
            }
        }

        throw DecodingError.keyNotFound(
            keys.first!,
            DecodingError.Context(codingPath: codingPath, debugDescription: "Expected string or Mongo ObjectId")
        )
    }
}

private struct ObjectIDValue: Decodable {
    let oid: String

    enum CodingKeys: String, CodingKey {
        case oid = "$oid"
    }
}
