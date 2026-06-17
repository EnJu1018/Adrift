import SwiftUI

struct AuthModeToggle: View {
    @Binding var mode: AuthMode

    var body: some View {
        HStack(spacing: 4) {
            toggleButton("登入", mode: .login)
            toggleButton("註冊", mode: .register)
        }
        .padding(4)
        .background(.thinMaterial, in: Capsule())
        .overlay {
            Capsule()
                .stroke(.white.opacity(0.18), lineWidth: 1)
        }
    }

    private func toggleButton(_ title: String, mode targetMode: AuthMode) -> some View {
        Button {
            mode = targetMode
        } label: {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(mode == targetMode ? .primary : .secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .contentShape(Capsule())
                .background {
                    if mode == targetMode {
                        Capsule()
                            .fill(.regularMaterial)
                            .overlay {
                                Capsule()
                                    .stroke(AdriftColors.cyan.opacity(0.28), lineWidth: 1)
                            }
                            .shadow(color: AdriftColors.cyan.opacity(0.10), radius: 7, y: 4)
                            .transition(.opacity)
                    }
                }
        }
        .buttonStyle(.plain)
        .contentShape(Capsule())
        .animation(.smooth(duration: 0.22), value: mode)
    }
}
