import SwiftUI

enum AdriftColors {
    static let ocean = Color(red: 0.10, green: 0.45, blue: 0.70)
    static let cyan = Color(red: 0.15, green: 0.75, blue: 0.85)
    static let mint = Color(red: 0.35, green: 0.85, blue: 0.70)
    static let indigo = Color(red: 0.35, green: 0.42, blue: 0.90)
    static let ink = Color(red: 0.08, green: 0.12, blue: 0.18)

    static let happy = Color(red: 0.96, green: 0.70, blue: 0.22)
    static let calm = Color(red: 0.32, green: 0.74, blue: 0.58)
    static let sad = Color(red: 0.42, green: 0.62, blue: 0.82)
    static let anxious = Color(red: 0.62, green: 0.54, blue: 0.86)
    static let angry = Color(red: 0.88, green: 0.38, blue: 0.40)
    static let excited = Color(red: 0.92, green: 0.45, blue: 0.70)
    static let confused = Color(red: 0.54, green: 0.60, blue: 0.84)

    static func mood(_ mood: MoodKind) -> Color {
        switch mood {
        case .happy: happy
        case .calm: calm
        case .sad: sad
        case .anxious: anxious
        case .angry: angry
        case .excited: excited
        case .confused: confused
        }
    }
}
