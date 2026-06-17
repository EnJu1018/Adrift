import SwiftUI

struct AuthErrorView: View {
    let message: String
    var isCompact = false

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.red.opacity(0.82))

            Text(message)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineLimit(2)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, isCompact ? 8 : 10)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(.red.opacity(0.18), lineWidth: 1)
        }
    }
}
