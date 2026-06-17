import SwiftUI

struct AvatarView: View {
    let name: String
    let avatarUrl: String?
    var size: CGFloat = 44

    var body: some View {
        ZStack {
            Circle()
                .fill(.teal.gradient)

            if let url = resolvedURL {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image
                            .resizable()
                            .scaledToFill()
                    } else {
                        initials
                    }
                }
                .clipShape(Circle())
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityLabel(name)
    }

    private var initials: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(.white)
    }

    private var resolvedURL: URL? {
        APIConfig.assetURL(from: avatarUrl)
    }
}
