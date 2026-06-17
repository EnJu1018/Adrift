import SwiftUI

struct PrimaryAuthButton: View {
    let title: String
    let isLoading: Bool
    var isCompact = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                        .controlSize(.small)
                }

                Text(title)
                    .font(.headline.weight(.semibold))
                    .contentTransition(.opacity)

                if !isLoading {
                    Image(systemName: "arrow.right")
                        .font(.subheadline.weight(.bold))
                }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: isCompact ? 50 : 56)
            .background(
                LinearGradient(
                    colors: [AdriftColors.ocean, AdriftColors.indigo, AdriftColors.cyan],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 18, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(.white.opacity(0.18), lineWidth: 1)
            }
            .shadow(color: AdriftColors.ocean.opacity(0.22), radius: 12, y: 7)
            .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(AuthPressButtonStyle())
        .animation(.smooth(duration: 0.2), value: isLoading)
    }
}

private struct AuthPressButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.975 : 1)
            .opacity(configuration.isPressed ? 0.90 : 1)
            .animation(.smooth(duration: 0.18), value: configuration.isPressed)
    }
}
