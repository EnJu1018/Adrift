import Foundation

struct Friend: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let userCode: String
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case mongoId = "_id"
        case name
        case userCode
        case avatar
        case avatarUrl
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeFlexibleString(forKeys: [.id, .mongoId])
        name = (try? container.decode(String.self, forKey: .name)) ?? "Adrift User"
        userCode = (try? container.decode(String.self, forKey: .userCode)) ?? ""
        avatarUrl = (try? container.decodeIfPresent(String.self, forKey: .avatarUrl))
            ?? (try? container.decodeIfPresent(String.self, forKey: .avatar))
    }
}

struct FriendRequest: Decodable, Identifiable, Equatable {
    let id: String
    let from: Friend?
    let to: Friend?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case requestId
        case from
        case to
        case createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeFlexibleString(forKeys: [.id, .requestId])
        from = try? container.decodeIfPresent(Friend.self, forKey: .from)
        to = try? container.decodeIfPresent(Friend.self, forKey: .to)
        createdAt = try? container.decodeIfPresent(Date.self, forKey: .createdAt)
    }
}

struct SearchUserResult: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let userCode: String
    let avatarUrl: String?
    let friendshipStatus: String

    enum CodingKeys: String, CodingKey {
        case id
        case mongoId = "_id"
        case name
        case userCode
        case avatar
        case avatarUrl
        case friendshipStatus
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeFlexibleString(forKeys: [.id, .mongoId])
        name = (try? container.decode(String.self, forKey: .name)) ?? "Adrift User"
        userCode = (try? container.decode(String.self, forKey: .userCode)) ?? ""
        avatarUrl = (try? container.decodeIfPresent(String.self, forKey: .avatarUrl))
            ?? (try? container.decodeIfPresent(String.self, forKey: .avatar))
        friendshipStatus = (try? container.decode(String.self, forKey: .friendshipStatus)) ?? "none"
    }
}
