import SwiftUI

struct AuthTextField: View {
    let title: String
    var placeholder: String? = nil
    @Binding var text: String
    let systemImage: String
    var isSecure = false
    var keyboardType: UIKeyboardType = .default
    var contentType: UITextContentType?
    var autocapitalization: TextInputAutocapitalization? = nil
    var focusedField: FocusState<AuthField?>.Binding
    let field: AuthField
    var submitLabel: SubmitLabel = .next
    var isCompact = false
    var onSubmit: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: isCompact ? 6 : 8) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(isFocused ? AdriftColors.cyan : .secondary)
                    .frame(width: 22)

                fieldContent
                    .font(.body)
                    .foregroundStyle(.primary)
            }
            .padding(.horizontal, 15)
            .padding(.vertical, isCompact ? 11 : 14)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(isFocused ? AdriftColors.cyan.opacity(0.72) : Color.white.opacity(0.16), lineWidth: isFocused ? 1.2 : 1)
            }
            .shadow(color: isFocused ? AdriftColors.cyan.opacity(0.10) : .clear, radius: 7, y: 4)
            .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .onTapGesture {
                focusedField.wrappedValue = field
            }
        }
        .animation(.smooth(duration: 0.18), value: isFocused)
    }

    @ViewBuilder
    private var fieldContent: some View {
        if isSecure {
            SecureField(placeholder ?? title, text: $text)
                .textContentType(contentType)
                .focused(focusedField, equals: field)
                .submitLabel(submitLabel)
                .onSubmit(onSubmit)
        } else {
            TextField(placeholder ?? title, text: $text)
                .keyboardType(keyboardType)
                .textContentType(contentType)
                .textInputAutocapitalization(autocapitalization)
                .autocorrectionDisabled()
                .focused(focusedField, equals: field)
                .submitLabel(submitLabel)
                .onSubmit(onSubmit)
        }
    }

    private var isFocused: Bool {
        focusedField.wrappedValue == field
    }
}
