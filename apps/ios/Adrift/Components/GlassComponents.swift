import SwiftUI

struct AdriftGlassCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        if #available(iOS 26.0, *) {
            content
                .padding()
                .glassEffect(.regular.tint(AdriftColors.cyan.opacity(0.06)), in: .rect(cornerRadius: AdriftSpacing.cardRadius))
                .shadow(color: AdriftColors.ocean.opacity(0.08), radius: 18, y: 8)
        } else {
            content
                .padding()
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: AdriftSpacing.cardRadius))
                .shadow(color: AdriftColors.ocean.opacity(0.08), radius: 18, y: 8)
        }
    }
}

struct AdriftInfoPanel<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        if #available(iOS 26.0, *) {
            content
                .padding()
                .glassEffect(.regular.tint(AdriftColors.mint.opacity(0.05)), in: .rect(cornerRadius: AdriftSpacing.panelRadius))
        } else {
            content
                .padding()
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: AdriftSpacing.panelRadius))
        }
    }
}

struct AdriftFloatingButton: View {
    let systemImage: String
    let title: String
    let action: () -> Void

    var body: some View {
        if #available(iOS 26.0, *) {
            Button(action: action) {
                Label(title, systemImage: systemImage)
                    .labelStyle(.iconOnly)
                    .font(.title2.weight(.semibold))
                    .frame(width: 56, height: 56)
            }
            .buttonStyle(.glassProminent)
            .tint(AdriftColors.ocean)
            .accessibilityLabel(title)
        } else {
            Button(action: action) {
                Label(title, systemImage: systemImage)
                    .labelStyle(.iconOnly)
                    .font(.title2.weight(.semibold))
                    .frame(width: 56, height: 56)
            }
            .buttonStyle(.borderedProminent)
            .tint(AdriftColors.ocean)
            .clipShape(Circle())
            .accessibilityLabel(title)
        }
    }
}

struct AdriftToolbarButton: View {
    let systemImage: String
    let title: String
    let action: () -> Void

    var body: some View {
        if #available(iOS 26.0, *) {
            Button(action: action) {
                Label(title, systemImage: systemImage)
                    .labelStyle(.iconOnly)
            }
            .buttonStyle(.glass)
            .tint(AdriftColors.ocean)
            .accessibilityLabel(title)
        } else {
            Button(action: action) {
                Label(title, systemImage: systemImage)
                    .labelStyle(.iconOnly)
            }
            .buttonStyle(.bordered)
            .tint(AdriftColors.ocean)
            .accessibilityLabel(title)
        }
    }
}

struct AdriftGlassButton<LabelContent: View>: View {
    let action: () -> Void
    let label: LabelContent

    init(_ action: @escaping () -> Void, @ViewBuilder label: () -> LabelContent) {
        self.action = action
        self.label = label()
    }

    var body: some View {
        if #available(iOS 26.0, *) {
            Button(action: action) {
                label
            }
            .buttonStyle(.glassProminent)
            .tint(AdriftColors.ocean)
        } else {
            Button(action: action) {
                label
            }
            .buttonStyle(.borderedProminent)
            .tint(AdriftColors.ocean)
        }
    }
}

struct AdriftGlassChip<Content: View>: View {
    let isSelected: Bool
    let content: Content

    init(isSelected: Bool, @ViewBuilder content: () -> Content) {
        self.isSelected = isSelected
        self.content = content()
    }

    var body: some View {
        if #available(iOS 26.0, *) {
            content
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .glassEffect(isSelected ? .regular.tint(AdriftColors.cyan.opacity(0.18)) : .regular, in: .capsule)
        } else {
            content
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(isSelected ? AdriftColors.cyan.opacity(0.18) : Color.secondary.opacity(0.12), in: Capsule())
        }
    }
}

typealias GlassCard = AdriftGlassCard
typealias GlassPanel = AdriftInfoPanel
typealias GlassFloatingButton = AdriftFloatingButton
typealias GlassToolbarButton = AdriftToolbarButton
typealias GlassProminentButton = AdriftGlassButton
typealias GlassChip = AdriftGlassChip
