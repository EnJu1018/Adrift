import SwiftUI

enum AppPageLayout {
    static let topInset: CGFloat = 8
    static let horizontalInset: CGFloat = 16
    static let contentSpacing: CGFloat = 16
    static let bottomInset: CGFloat = 24
}

struct AppPageScrollContainer<Content: View>: View {
    private let showsIndicators: Bool
    private let content: Content

    init(
        showsIndicators: Bool = false,
        @ViewBuilder content: () -> Content
    ) {
        self.showsIndicators = showsIndicators
        self.content = content()
    }

    var body: some View {
        ZStack {
            AdriftBackground()

            ScrollView(.vertical, showsIndicators: showsIndicators) {
                content
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, AppPageLayout.horizontalInset)
                    .padding(.top, AppPageLayout.topInset)
                    .padding(.bottom, AppPageLayout.bottomInset)
            }
        }
    }
}

private struct AdriftPageNavigationModifier: ViewModifier {
    let title: String

    func body(content: Content) -> some View {
        content
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
    }
}

private struct AdriftListLayoutModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .scrollContentBackground(.hidden)
            .contentMargins(.top, AppPageLayout.topInset, for: .scrollContent)
            .contentMargins(.bottom, AppPageLayout.bottomInset, for: .scrollContent)
            .listSectionSpacing(.compact)
    }
}

extension View {
    func adriftPageNavigation(_ title: String) -> some View {
        modifier(AdriftPageNavigationModifier(title: title))
    }

    func adriftListLayout() -> some View {
        modifier(AdriftListLayoutModifier())
    }
}
