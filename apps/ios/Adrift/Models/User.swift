import Foundation

struct User: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let email: String?
    let userCode: String
    let role: String?
    let avatarUrl: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case mongoId = "_id"
        case name
        case email
        case userCode
        case role
        case avatar
        case avatarUrl
        case createdAt
    }

    init(
        id: String,
        name: String,
        email: String? = nil,
        userCode: String,
        role: String? = nil,
        avatarUrl: String? = nil,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.email = email
        self.userCode = userCode
        self.role = role
        self.avatarUrl = avatarUrl
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeFlexibleString(forKeys: [.id, .mongoId])
        name = (try? container.decode(String.self, forKey: .name)) ?? "Adrift User"
        email = try? container.decodeIfPresent(String.self, forKey: .email)
        userCode = (try? container.decode(String.self, forKey: .userCode)) ?? ""
        role = try? container.decodeIfPresent(String.self, forKey: .role)
        avatarUrl = (try? container.decodeIfPresent(String.self, forKey: .avatarUrl))
            ?? (try? container.decodeIfPresent(String.self, forKey: .avatar))
        createdAt = try? container.decodeIfPresent(Date.self, forKey: .createdAt)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encodeIfPresent(email, forKey: .email)
        try container.encode(userCode, forKey: .userCode)
        try container.encodeIfPresent(role, forKey: .role)
        try container.encodeIfPresent(avatarUrl, forKey: .avatarUrl)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
    }
}

struct PublicUser: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let userCode: String
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case mongoId = "_id"
        case name
        case username
        case displayName
        case userCode
        case avatar
        case avatarUrl
        case profileImage
        case imageUrl
    }

    init(id: String, name: String, userCode: String, avatarUrl: String? = nil) {
        self.id = id
        self.name = name
        self.userCode = userCode
        self.avatarUrl = avatarUrl
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeFlexibleString(forKeys: [.id, .mongoId])
        name = (try? container.decode(String.self, forKey: .name))
            ?? (try? container.decode(String.self, forKey: .displayName))
            ?? (try? container.decode(String.self, forKey: .username))
            ?? "Adrift User"
        userCode = (try? container.decode(String.self, forKey: .userCode)) ?? ""
        avatarUrl = (try? container.decodeIfPresent(String.self, forKey: .avatarUrl))
            ?? (try? container.decodeIfPresent(String.self, forKey: .avatar))
            ?? (try? container.decodeIfPresent(String.self, forKey: .profileImage))
            ?? (try? container.decodeIfPresent(String.self, forKey: .imageUrl))
    }
}

extension PublicUser {
    init(user: User) {
        self.init(id: user.id, name: user.name, userCode: user.userCode, avatarUrl: user.avatarUrl)
    }
}
