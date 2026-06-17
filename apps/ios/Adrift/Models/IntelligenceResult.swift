import Foundation

struct IntelligenceResult: Decodable, Equatable {
    let summary: String
    let moodTrend: MoodTrend
    let locationInsights: [LocationInsight]
    let behaviorPatterns: [String]
    let suggestions: [String]
    let notEnoughData: Bool?
    let required: Int?
    let current: Int?

    enum CodingKeys: String, CodingKey {
        case summary
        case moodTrend
        case locationInsights
        case behaviorPatterns
        case suggestions
        case notEnoughData
        case required
        case current
    }

    init(
        summary: String,
        moodTrend: MoodTrend,
        locationInsights: [LocationInsight],
        behaviorPatterns: [String],
        suggestions: [String],
        notEnoughData: Bool?,
        required: Int?,
        current: Int?
    ) {
        self.summary = summary
        self.moodTrend = moodTrend
        self.locationInsights = locationInsights
        self.behaviorPatterns = behaviorPatterns
        self.suggestions = suggestions
        self.notEnoughData = notEnoughData
        self.required = required
        self.current = current
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        summary = (try? container.decode(String.self, forKey: .summary)) ?? ""
        moodTrend = (try? container.decode(MoodTrend.self, forKey: .moodTrend))
            ?? MoodTrend(description: "", dominantMood: "", averageIntensity: 0)
        locationInsights = (try? container.decode([LocationInsight].self, forKey: .locationInsights)) ?? []
        behaviorPatterns = (try? container.decode([String].self, forKey: .behaviorPatterns)) ?? []
        suggestions = (try? container.decode([String].self, forKey: .suggestions)) ?? []
        notEnoughData = try? container.decodeIfPresent(Bool.self, forKey: .notEnoughData)
        required = try? container.decodeIfPresent(Int.self, forKey: .required)
        current = try? container.decodeIfPresent(Int.self, forKey: .current)
    }

    static let empty = IntelligenceResult(
        summary: "",
        moodTrend: MoodTrend(description: "", dominantMood: "", averageIntensity: 0),
        locationInsights: [],
        behaviorPatterns: [],
        suggestions: [],
        notEnoughData: nil,
        required: nil,
        current: nil
    )
}

struct MoodTrend: Decodable, Equatable {
    let description: String
    let dominantMood: String
    let averageIntensity: Double
}

struct LocationInsight: Decodable, Identifiable, Equatable {
    var id: String { "\(place)-\(dominantMood)-\(insight)" }

    let place: String
    let insight: String
    let dominantMood: String
}
