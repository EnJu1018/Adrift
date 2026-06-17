import SwiftUI

struct FloatingMapControls: View {
    let isLocating: Bool
    let onLocate: () -> Void
    let onAddDiary: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            FloatingMapButton(
                systemImage: "location.fill",
                title: "回到目前位置",
                isLoading: isLocating,
                action: onLocate
            )

            FloatingMapButton(
                systemImage: "square.and.pencil",
                title: "新增日記",
                isPrimary: true,
                action: onAddDiary
            )
        }
        .padding(8)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay {
            Capsule()
                .stroke(AdriftColors.cyan.opacity(0.24), lineWidth: 1)
        }
        .shadow(color: AdriftColors.ocean.opacity(0.18), radius: 18, y: 8)
    }
}

private struct FloatingMapButton: View {
    let systemImage: String
    let title: String
    var isPrimary = false
    var isLoading = false
    let action: () -> Void

    @GestureState private var isPressed = false
    @State private var breathes = false

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(background)
                    .overlay {
                        Circle()
                            .stroke(border, lineWidth: 1)
                    }

                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: systemImage)
                        .font(.system(size: isPrimary ? 21 : 19, weight: .semibold))
                        .foregroundStyle(isPrimary ? .white : AdriftColors.cyan)
                        .symbolEffect(.pulse, value: isLoading)
                }
            }
            .frame(width: isPrimary ? 52 : 46, height: isPrimary ? 52 : 46)
            .shadow(color: glow, radius: breathes ? 16 : 9, y: 5)
            .scaleEffect(isPressed ? 0.96 : (breathes && isPrimary ? 1.018 : 1.0))
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .updating($isPressed) { _, state, _ in
                    state = true
                }
        )
        .onAppear {
            withAnimation(AdriftMotion.breathe) {
                breathes = true
            }
        }
        .animation(.smooth(duration: 0.18), value: isPressed)
    }

    private var background: AnyShapeStyle {
        if isPrimary {
            return AnyShapeStyle(LinearGradient(colors: [AdriftColors.ocean, AdriftColors.cyan], startPoint: .topLeading, endPoint: .bottomTrailing))
        }
        return AnyShapeStyle(.regularMaterial)
    }

    private var border: Color {
        isPrimary ? .white.opacity(0.22) : AdriftColors.cyan.opacity(0.30)
    }

    private var glow: Color {
        isPrimary ? AdriftColors.cyan.opacity(0.30) : AdriftColors.ocean.opacity(0.14)
    }
}
