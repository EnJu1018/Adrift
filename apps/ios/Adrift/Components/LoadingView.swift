import SwiftUI

struct LoadingView: View {
    let message: String

    var body: some View {
        ZStack {
            AdriftBackground()

            GlassPanel {
                VStack(spacing: 14) {
                    Image(systemName: "point.3.connected.trianglepath.dotted")
                        .font(.system(size: 34, weight: .medium))
                        .foregroundStyle(AdriftColors.cyan, AdriftColors.mint)

                    ProgressView()
                        .controlSize(.large)

                    Text(message)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: 260)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
