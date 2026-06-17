import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var authViewModel: AuthViewModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var mode: AuthMode = .login
    @State private var name = ""
    @State private var userCode = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var localError: String?
    @State private var appeared = false
    @State private var layoutSize: CGSize = .zero
    @State private var focusScrollTask: Task<Void, Never>?
    @FocusState private var focusedField: AuthField?

    private var visibleError: String? {
        localizedError(localError ?? authViewModel.errorMessage)
    }

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                let stableSize = layoutSize == .zero ? proxy.size : layoutSize

                ZStack {
                    AuthBackgroundView()
                        .ignoresSafeArea()
                        .onTapGesture {
                            focusedField = nil
                        }

                    authLayout(size: stableSize)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
                .contentShape(Rectangle())
                .onAppear {
                    guard layoutSize == .zero else { return }
                    layoutSize = proxy.size
                }
                .onChange(of: proxy.size) { _, newSize in
                    guard focusedField == nil else { return }
                    layoutSize = newSize
                }
            }
            .navigationBarHidden(true)
            .onAppear {
                withAnimation(.smooth(duration: 0.42)) {
                    appeared = true
                }
            }
            .onChange(of: mode) { _, _ in
                localError = nil
                authViewModel.errorMessage = nil
            }
            .onChange(of: email) { _, _ in clearInlineError() }
            .onChange(of: password) { _, _ in clearInlineError() }
            .onChange(of: confirmPassword) { _, _ in clearInlineError() }
            .onChange(of: name) { _, _ in clearInlineError() }
            .onChange(of: userCode) { _, _ in clearInlineError() }
            .onDisappear {
                focusScrollTask?.cancel()
            }
        }
    }

    @ViewBuilder
    private func authLayout(size: CGSize) -> some View {
        if usesWideLayout(size) {
            wideLayout(size: size)
        } else {
            phoneLayout(size: size)
        }
    }

    private func wideLayout(size: CGSize) -> some View {
        HStack(spacing: 44) {
            AuthBrandPanel(mode: mode, compact: false, isLeading: true, isVisible: appeared)
                .frame(maxWidth: 380, alignment: .leading)

            authCard(compact: false)
                .frame(width: 448)
        }
        .padding(.horizontal, max(42, size.width * 0.08))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .transition(.opacity.combined(with: .scale(scale: 0.985)))
    }

    private func phoneLayout(size: CGSize) -> some View {
        let compact = shouldCompact(size)
        let allowsRestingScroll = size.height < 880 && mode == .register

        return ZStack(alignment: .top) {
            AuthBrandPanel(mode: mode, compact: compact, isLeading: false, isVisible: appeared)
                .frame(maxWidth: .infinity)
                .padding(.top, brandTopPadding(size: size, compact: compact))
                .allowsHitTesting(false)

            ScrollViewReader { scrollProxy in
                ScrollView(.vertical, showsIndicators: false) {
                    authCard(compact: compact)
                        .id(AuthScrollTarget.top)
                        .frame(maxWidth: 440)
                        .padding(.top, cardTopPadding(size: size, compact: compact))
                        .padding(.bottom, focusedField == nil ? 8 : 28)
                }
                .scrollDisabled(focusedField == nil && !allowsRestingScroll)
                .scrollBounceBehavior(.basedOnSize)
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: focusedField) { _, field in
                    scheduleFocusScroll(to: field, using: scrollProxy)
                }
            }
        }
        .padding(.horizontal, compact ? 16 : 22)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func authCard(compact: Bool) -> some View {
        AuthCardView(isCompact: compact) {
            VStack(spacing: compact ? 16 : 23) {
                titleBlock(compact: compact)

                authFields(compact: compact)

                PrimaryAuthButton(
                    title: mode == .login ? "登入" : "註冊",
                    isLoading: authViewModel.isLoading,
                    isCompact: compact
                ) {
                    Task { await submit() }
                }
                .id(AuthScrollTarget.primaryAction)
                .disabled(authViewModel.isLoading)

                Button {
                    switchMode()
                } label: {
                    Text(mode == .login ? "還沒有帳號？建立帳號" : "已經有帳號？登入")
                        .font((compact ? Font.caption : Font.footnote).weight(.medium))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.top, compact ? 0 : 2)
                .id(AuthScrollTarget.bottom)
            }
        }
        .scaleEffect(appeared ? 1 : 0.985)
        .opacity(appeared ? 1 : 0)
        .animation(.smooth(duration: 0.38), value: appeared)
        .animation(AdriftMotion.gentle, value: mode)
        .animation(AdriftMotion.gentle, value: visibleError)
    }

    private func titleBlock(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 5 : 8) {
            Text(mode == .login ? "登入" : "註冊")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            Text(mode == .login ? "歡迎回來" : "建立帳號")
                .font(.system(size: compact ? 23 : 27, weight: .semibold, design: .rounded))
                .foregroundStyle(.primary)
                .contentTransition(.opacity)

            if mode == .register {
                Text("開始記錄你的漂流")
                    .font((compact ? Font.caption : Font.subheadline).weight(.medium))
                    .foregroundStyle(.secondary.opacity(0.78))
                    .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, compact ? 2 : 4)
    }

    private func authFields(compact: Bool) -> some View {
        VStack(spacing: compact ? 12 : 17) {
            if mode == .register {
                AuthTextField(
                    title: "暱稱",
                    placeholder: "你的名字",
                    text: $name,
                    systemImage: "person",
                    contentType: .name,
                    focusedField: $focusedField,
                    field: .name,
                    submitLabel: .next,
                    isCompact: compact,
                    onSubmit: { focusedField = .userCode }
                )
                .id(AuthField.name)
                .transition(.opacity.combined(with: .move(edge: .top)))

                VStack(alignment: .leading, spacing: compact ? 4 : 6) {
                    AuthTextField(
                        title: "使用者代碼",
                        placeholder: "arren_123",
                        text: $userCode,
                        systemImage: "at",
                        contentType: .username,
                        autocapitalization: .never,
                        focusedField: $focusedField,
                        field: .userCode,
                        submitLabel: .next,
                        isCompact: compact,
                        onSubmit: { focusedField = .email }
                    )

                    if !compact {
                        Text("這是你的公開好友搜尋 ID。")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(.secondary)
                            .padding(.leading, 2)
                            .transition(.opacity)
                    }
                }
                .id(AuthField.userCode)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            AuthTextField(
                title: "電子郵件",
                placeholder: "you@example.com",
                text: $email,
                systemImage: "envelope",
                keyboardType: .emailAddress,
                contentType: .emailAddress,
                autocapitalization: .never,
                focusedField: $focusedField,
                field: .email,
                submitLabel: .next,
                isCompact: compact,
                onSubmit: { focusedField = .password }
            )
            .id(AuthField.email)

            AuthTextField(
                title: "密碼",
                placeholder: mode == .login ? "請輸入密碼" : "至少 6 個字元",
                text: $password,
                systemImage: "lock",
                isSecure: true,
                contentType: mode == .login ? .password : .newPassword,
                focusedField: $focusedField,
                field: .password,
                submitLabel: mode == .login ? .done : .next,
                isCompact: compact,
                onSubmit: {
                    if mode == .login {
                        Task { await submit() }
                    } else {
                        focusedField = .confirmPassword
                    }
                }
            )
            .id(AuthField.password)

            if mode == .register {
                AuthTextField(
                    title: "確認密碼",
                    placeholder: "再次輸入密碼",
                    text: $confirmPassword,
                    systemImage: "checkmark.shield",
                    isSecure: true,
                    contentType: .newPassword,
                    focusedField: $focusedField,
                    field: .confirmPassword,
                    submitLabel: .done,
                    isCompact: compact,
                    onSubmit: { Task { await submit() } }
                )
                .id(AuthField.confirmPassword)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            if let visibleError {
                AuthErrorView(message: visibleError, isCompact: compact)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private func usesWideLayout(_ size: CGSize) -> Bool {
        size.width >= 760
    }

    private func shouldCompact(_ size: CGSize) -> Bool {
        size.height < 720 || mode == .register
    }

    private func brandTopPadding(size: CGSize, compact: Bool) -> CGFloat {
        max(size.height * (compact ? 0.070 : 0.090), 46)
    }

    private func cardTopPadding(size: CGSize, compact: Bool) -> CGFloat {
        compact ? max(size.height * 0.190, 142) : max(size.height * 0.270, 196)
    }

    private func scheduleFocusScroll(to field: AuthField?, using proxy: ScrollViewProxy) {
        focusScrollTask?.cancel()
        focusScrollTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(90))
            guard !Task.isCancelled else { return }

            let animation: Animation? = reduceMotion ? nil : .easeOut(duration: 0.26)
            withAnimation(animation) {
                guard let field else {
                    proxy.scrollTo(AuthScrollTarget.top, anchor: .top)
                    return
                }

                switch field {
                case .password, .confirmPassword:
                    proxy.scrollTo(AuthScrollTarget.primaryAction, anchor: .bottom)
                case .name, .userCode, .email:
                    proxy.scrollTo(field, anchor: .center)
                }
            }
        }
    }

    private func switchMode() {
        focusedField = nil
        password = ""
        confirmPassword = ""
        localError = nil
        authViewModel.errorMessage = nil
        withAnimation(.smooth(duration: 0.28)) {
            mode = mode == .login ? .register : .login
        }
    }

    private func clearInlineError() {
        localError = nil
        authViewModel.errorMessage = nil
    }

    private func submit() async {
        focusedField = nil
        localError = validationError
        guard localError == nil else { return }

        switch mode {
        case .login:
            await authViewModel.login(email: email, password: password)
        case .register:
            await authViewModel.register(
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                email: email,
                password: password,
                userCode: userCode.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        }
    }

    private var validationError: String? {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if mode == .register && name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "請輸入暱稱"
        }
        if mode == .register && userCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "請輸入使用者代碼"
        }
        if normalizedEmail.isEmpty {
            return "請輸入電子郵件"
        }
        if !normalizedEmail.contains("@") {
            return "電子郵件格式不正確"
        }
        if password.isEmpty {
            return "請輸入密碼"
        }
        if mode == .register && password.count < 6 {
            return "密碼長度不足"
        }
        if mode == .register && confirmPassword.isEmpty {
            return "請再次輸入密碼"
        }
        if mode == .register && password != confirmPassword {
            return "兩次輸入的密碼不一致"
        }
        return nil
    }

    private func localizedError(_ message: String?) -> String? {
        guard let message else { return nil }
        let lowercased = message.lowercased()
        if lowercased.contains("invalid") || lowercased.contains("credential") || lowercased.contains("unauthorized") {
            return "登入失敗，請確認帳號或密碼"
        }
        if lowercased.contains("network") || lowercased.contains("transport") || lowercased.contains("連線") {
            return "網路連線失敗，請稍後再試"
        }
        if lowercased.contains("email") && (lowercased.contains("exist") || lowercased.contains("taken")) {
            return "這個電子郵件已經被使用"
        }
        if lowercased.contains("usercode") && (lowercased.contains("exist") || lowercased.contains("taken")) {
            return "這個使用者代碼已經被使用"
        }
        return message
    }
}

enum AuthMode: Equatable {
    case login
    case register
}

enum AuthField: Hashable {
    case name
    case userCode
    case email
    case password
    case confirmPassword
}

private enum AuthScrollTarget: Hashable {
    case top
    case primaryAction
    case bottom
}

private struct AuthBrandPanel: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var breathes = false
    let mode: AuthMode
    let compact: Bool
    let isLeading: Bool
    let isVisible: Bool

    private var horizontalAlignment: HorizontalAlignment {
        isLeading ? .leading : .center
    }

    var body: some View {
        VStack(alignment: horizontalAlignment, spacing: compact ? 8 : 12) {
            VStack(alignment: horizontalAlignment, spacing: compact ? 6 : 10) {
                Text(mode == .login ? "Adrift" : "開始漂流")
                    .font(.system(size: compact ? 31 : 54, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.76)
                    .foregroundStyle(
                        LinearGradient(
                            colors: brandGradientColors,
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .multilineTextAlignment(isLeading ? .leading : .center)
                    .contentTransition(.opacity)
                    .scaleEffect(breathes ? 1.006 : 1.0)
                    .animation(.easeInOut(duration: 4.6).repeatForever(autoreverses: true), value: breathes)

                if mode == .register || !compact {
                    Text(mode == .login ? "一個在旅途中留下回憶的安靜角落。" : "留下你的第一個座標")
                        .font(.system(size: 15, weight: .medium, design: .rounded))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(isLeading ? .leading : .center)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 8)
        }
        .frame(maxWidth: .infinity, alignment: isLeading ? .leading : .center)
        .animation(.smooth(duration: 0.42), value: isVisible)
        .animation(.smooth(duration: 0.28), value: compact)
        .animation(.smooth(duration: 0.32), value: mode)
        .onAppear {
            breathes = true
        }
    }

    private var brandGradientColors: [Color] {
        if colorScheme == .dark {
            return [Color.white.opacity(0.94), AdriftColors.cyan, AdriftColors.mint]
        }
        return [AdriftColors.ink, AdriftColors.ocean, AdriftColors.cyan]
    }
}
