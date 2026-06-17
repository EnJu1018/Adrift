import SwiftUI

struct MoodChip: View {
    let mood: MoodKind
    let isSelected: Bool

    var body: some View {
        GlassChip(isSelected: isSelected) {
            Label(mood.label, systemImage: mood.symbol)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(isSelected ? AdriftColors.mood(mood) : .primary)
        }
    }
}
