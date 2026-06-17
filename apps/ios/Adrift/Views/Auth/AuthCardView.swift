import SwiftUI

struct AuthCardView<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    private let content: Content
    private let isCompact: Bool

    init(isCompact: Bool = false, @ViewBuilder content: () -> Content) {
        self.isCompact = isCompact
        self.content = content()
    }

    var body: some View {
        if #available(iOS 26.0, *) {
            content
                .padding(.horizontal, isCompact ? 20 : 28)
                .padding(.vertical, isCompact ? 21 : 29)
                .glassEffect(.regular.tint(AdriftColors.cyan.opacity(0.07)), in: .rect(cornerRadius: isCompact ? 26 : 30))
                .overlay(cardStroke)
                .shadow(color: AdriftColors.cyan.opacity(colorScheme == .dark ? 0.12 : 0.08), radius: 18, y: 10)
        } else {
            content
                .padding(.horizontal, isCompact ? 20 : 28)
                .padding(.vertical, isCompact ? 21 : 29)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: isCompact ? 26 : 30, style: .continuous))
                .overlay(cardStroke)
                .shadow(color: AdriftColors.ocean.opacity(colorScheme == .dark ? 0.18 : 0.10), radius: 18, y: 10)
        }
    }

    private var cardStroke: some View {
        RoundedRectangle(cornerRadius: isCompact ? 26 : 30, style: .continuous)
            .stroke(.white.opacity(colorScheme == .dark ? 0.14 : 0.42), lineWidth: 1)
    }
}
