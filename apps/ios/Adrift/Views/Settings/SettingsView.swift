import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct SettingsView: View {
    @EnvironmentObject private var authViewModel: AuthViewModel
    @EnvironmentObject private var refreshManager: AppRefreshManager
    @State private var copied = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var pendingAvatarData: Data?
    @State private var pendingAvatarMimeType = "image/jpeg"

    var body: some View {
        NavigationStack {
            ZStack {
                AdriftBackground()

                List {
                    if let user = authViewModel.currentUser {
                        Section {
                            GlassCard {
                                HStack(spacing: 18) {
                                    avatarPreview(for: user)
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(user.name)
                                            .font(AdriftTypography.title)
                                        if let email = user.email {
                                            Text(email)
                                                .font(.subheadline)
                                                .foregroundStyle(.secondary)
                                        }
                                        Label("@\(user.userCode)", systemImage: "at")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                }
                            }
                            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 6, trailing: 0))
                            .listRowBackground(Color.clear)
                        }

                        Section("個人資料") {
                            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                                Label("選擇頭貼", systemImage: "photo")
                            }

                            if pendingAvatarData != nil {
                                Button {
                                    Task { await saveAvatar() }
                                } label: {
                                    if authViewModel.isUploadingAvatar {
                                        ProgressView()
                                    } else {
                                        Label("儲存頭貼", systemImage: "square.and.arrow.up")
                                    }
                                }
                                .tint(AdriftColors.ocean)
                                .disabled(authViewModel.isUploadingAvatar)

                                Text("圓形預覽已啟用；縮放與位置調整會在後續版本補上。")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            LabeledContent("名稱", value: user.name)
                            if let email = user.email {
                                LabeledContent("Email", value: email)
                            }
                        }

                        Section("Adrift ID") {
                            LabeledContent("userCode") {
                                HStack {
                                    Text(user.userCode)
                                        .font(.body.monospaced())
                                    Button {
                                        UIPasteboard.general.string = user.userCode
                                        copied = true
                                    } label: {
                                        Image(systemName: copied ? "checkmark.circle.fill" : "doc.on.doc")
                                            .foregroundStyle(copied ? AdriftColors.calm : AdriftColors.ocean)
                                    }
                                    .buttonStyle(.borderless)
                                }
                            }
                            LabeledContent("Role", value: user.role ?? "user")
                        }

                        Section("帳號安全") {
                            Button {
                                // TODO: Add native password change sheet backed by PATCH /users/me/password.
                            } label: {
                                Label("修改密碼", systemImage: "lock.rotation")
                            }
                            .disabled(true)
                        }
                    }

                    Section("危險區域") {
                        Button(role: .destructive) {
                            authViewModel.logout()
                        } label: {
                            Label("登出", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    }
                }
                .adriftListLayout()
            }
            .adriftPageNavigation("帳號設定")
            .task {
                await refreshManager.refreshIfNeeded(scopes: [.user])
            }
            .onChange(of: selectedPhoto) { _, item in
                Task { await loadPhoto(item) }
            }
            .alert("發生問題", isPresented: .constant(authViewModel.errorMessage != nil)) {
                Button("好") { authViewModel.errorMessage = nil }
            } message: {
                Text(authViewModel.errorMessage ?? "")
            }
        }
    }

    @ViewBuilder
    private func avatarPreview(for user: User) -> some View {
        if let pendingAvatarData, let image = UIImage(data: pendingAvatarData) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: 72, height: 72)
                .clipShape(Circle())
                .overlay {
                    Circle().stroke(AdriftColors.cyan, lineWidth: 2)
                }
                .accessibilityLabel("新頭貼預覽")
        } else {
            AvatarView(name: user.name, avatarUrl: user.avatarUrl, size: 72)
        }
    }

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        pendingAvatarMimeType = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
        pendingAvatarData = try? await item.loadTransferable(type: Data.self)
    }

    private func saveAvatar() async {
        guard let pendingAvatarData else { return }
        await authViewModel.uploadAvatar(data: pendingAvatarData, mimeType: pendingAvatarMimeType)
        if authViewModel.errorMessage == nil {
            selectedPhoto = nil
            self.pendingAvatarData = nil
        }
    }
}
