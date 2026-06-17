import SwiftUI

struct MemoryMarkerView: View {
    let mood: MoodKind
    let isSelected: Bool

    var body: some View {
        ZStack {
            Circle()
                .fill(AdriftColors.mood(mood).opacity(isSelected ? 0.24 : 0.16))
                .frame(width: isSelected ? 42 : 32, height: isSelected ? 42 : 32)
                .blur(radius: 1)

            Circle()
                .fill(AdriftColors.mood(mood).gradient)
                .frame(width: isSelected ? 24 : 17, height: isSelected ? 24 : 17)
                .overlay {
                    Circle()
                        .stroke(.white.opacity(0.88), lineWidth: 2)
                }
                .shadow(color: AdriftColors.mood(mood).opacity(0.38), radius: isSelected ? 12 : 7, y: 3)

            if isSelected {
                Image(systemName: mood.symbol)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .scaleEffect(isSelected ? 1.12 : 1)
        .animation(AdriftMotion.gentle, value: isSelected)
        .accessibilityLabel("\(mood.label)日記")
    }
}
