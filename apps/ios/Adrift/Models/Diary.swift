import CoreLocation
import Foundation

enum MoodKind: String, Codable, CaseIterable, Identifiable {
    case happy
    case calm
    case sad
    case anxious
    case angry
    case excited
    case confused

    var id: String { rawValue }

    var label: String {
        switch self {
        case .happy: "開心"
        case .calm: "平靜"
        case .sad: "難過"
        case .anxious: "焦慮"
        case .angry: "生氣"
        case .excited: "興奮"
        case .confused: "疑惑"
        }
    }

    var symbol: String {
        switch self {
        case .happy: "face.smiling"
        case .calm: "leaf"
        case .sad: "cloud.rain"
        case .anxious: "circle.dotted"
        case .angry: "flame"
        case .excited: "sparkles"
        case .confused: "questionmark.circle"
        }
    }

    var apiValue: String {
        switch self {
        case .happy:
            return "joy"
        case .calm:
            return "calm"
        case .sad:
            return "sad"
        case .anxious:
            return "anxious"
        case .angry:
            // TODO: Send "angry" directly after the backend enum supports it.
            return "anxious"
        case .excited:
            return "wonder"
        case .confused:
            return "confused"
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let value = (try? container.decode(String.self)) ?? ""
        self = MoodKind.fromAPI(value)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }

    static func fromAPI(_ value: String) -> MoodKind {
        switch value {
        case "happy", "joy":
            return .happy
        case "calm", "nostalgic":
            return .calm
        case "sad":
            return .sad
        case "anxious":
            return .anxious
        case "angry":
            return .angry
        case "excited", "wonder":
            return .excited
        case "confused":
            return .confused
        default:
            return .confused
        }
    }
}

enum DiaryVisibility: String, Codable, CaseIterable, Identifiable {
    case `public`
    case friends
    case `private`

    var id: String { rawValue }

    var label: String {
        switch self {
        case .public: "公開"
        case .friends: "好友"
        case .private: "私人"
        }
    }

    var symbol: String {
        switch self {
        case .public: "globe.asia.australia"
        case .friends: "person.2"
        case .private: "lock"
        }
    }
}

struct Mood: Decodable, Equatable {
    let type: MoodKind
    let intensity: Int
}

struct DiaryLocation: Decodable, Equatable {
    let type: String?
    let coordinates: [Double]?
    let lat: Double?
    let lng: Double?
    let placeName: String?

    var coordinate: CLLocationCoordinate2D? {
        if let lat, let lng {
            return CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }

        guard let coordinates, coordinates.count == 2 else { return nil }
        return CLLocationCoordinate2D(latitude: coordinates[1], longitude: coordinates[0])
    }
}

struct Diary: Decodable, Identifiable, Equatable {
    let id: String
    let title: String
    let text: String
    let mood: Mood
    let location: DiaryLocation
    let locationAccuracy: String?
    let visibility: DiaryVisibility
    let author: PublicUser?
    let imageUrl: String?
    let images: [String]
    let createdAt: Date?

    var coordinate: CLLocationCoordinate2D? { location.coordinate }
    var summary: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    var imageURLs: [URL] {
        var values = images
        if let imageUrl, !imageUrl.isEmpty, !values.contains(imageUrl) {
            values.insert(imageUrl, at: 0)
        }
        return values.compactMap { APIConfig.assetURL(from: $0) }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case mongoId = "_id"
        case title
        case text
        case content
        case mood
        case location
        case locationAccuracy
        case visibility
        case user
        case author
        case owner
        case createdBy
        case userName
        case username
        case displayName
        case authorName
        case avatar
        case avatarUrl
        case profileImage
        case userCode
        case imageUrl
        case imagePath
        case images
        case photos
        case createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeFlexibleString(forKeys: [.id, .mongoId])
        title = (try? container.decode(String.self, forKey: .title)) ?? "（未命名日記）"
        text = (try? container.decode(String.self, forKey: .text))
            ?? (try? container.decode(String.self, forKey: .content))
            ?? ""
        mood = (try? container.decode(Mood.self, forKey: .mood)) ?? Mood(type: .calm, intensity: 3)
        location = (try? container.decode(DiaryLocation.self, forKey: .location))
            ?? DiaryLocation(type: "Point", coordinates: nil, lat: nil, lng: nil, placeName: nil)
        locationAccuracy = try? container.decodeIfPresent(String.self, forKey: .locationAccuracy)
        visibility = (try? container.decode(DiaryVisibility.self, forKey: .visibility)) ?? .private
        let nestedAuthor = (try? container.decodeIfPresent(PublicUser.self, forKey: .author))
            ?? (try? container.decodeIfPresent(PublicUser.self, forKey: .user))
            ?? (try? container.decodeIfPresent(PublicUser.self, forKey: .owner))
            ?? (try? container.decodeIfPresent(PublicUser.self, forKey: .createdBy))
        author = nestedAuthor ?? Self.decodeFlatAuthor(from: container)
        imageUrl = (try? container.decodeIfPresent(String.self, forKey: .imageUrl))
            ?? (try? container.decodeIfPresent(String.self, forKey: .imagePath))
        images = (try? container.decodeIfPresent([String].self, forKey: .images))
            ?? (try? container.decodeIfPresent([String].self, forKey: .photos))
            ?? []
        createdAt = try? container.decodeIfPresent(Date.self, forKey: .createdAt)
    }

    private static func decodeFlatAuthor(from container: KeyedDecodingContainer<CodingKeys>) -> PublicUser? {
        let name = (try? container.decodeIfPresent(String.self, forKey: .authorName))
            ?? (try? container.decodeIfPresent(String.self, forKey: .userName))
            ?? (try? container.decodeIfPresent(String.self, forKey: .displayName))
            ?? (try? container.decodeIfPresent(String.self, forKey: .username))
        let userCode = (try? container.decodeIfPresent(String.self, forKey: .userCode)) ?? ""
        let avatar = (try? container.decodeIfPresent(String.self, forKey: .avatarUrl))
            ?? (try? container.decodeIfPresent(String.self, forKey: .avatar))
            ?? (try? container.decodeIfPresent(String.self, forKey: .profileImage))
        let id = (try? container.decodeFlexibleString(forKeys: [.owner, .createdBy, .author, .user]))
            ?? (!userCode.isEmpty ? userCode : nil)

        guard let name, !name.isEmpty else { return nil }
        return PublicUser(
            id: id ?? "unknown-author",
            name: name,
            userCode: userCode,
            avatarUrl: avatar
        )
    }
}

struct DiaryListData: Decodable {
    let diaries: [Diary]
}

struct CreateDiaryRequest {
    let title: String
    let text: String
    let mood: MoodKind
    let intensity: Int
    let visibility: DiaryVisibility
    let latitude: Double
    let longitude: Double
    let placeName: String
    let imageData: Data?
    let imageMimeType: String?
}
