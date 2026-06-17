import SwiftUI

struct FriendsView: View {
    @ObservedObject var viewModel: FriendsViewModel
    @EnvironmentObject private var refreshManager: AppRefreshManager
    @State private var query = ""
    @State private var friendSearch = ""

    private var filteredFriends: [Friend] {
        let trimmed = friendSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return viewModel.friends }
        return viewModel.friends.filter {
            $0.name.lowercased().contains(trimmed) || $0.userCode.lowercased().contains(trimmed)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AdriftBackground()

                List {
                    searchSection
                    invitesSection
                    friendsSection
                    sentRequestsSection
                }
                .adriftListLayout()
            }
            .adriftPageNavigation("好友")
            .searchable(text: $friendSearch, prompt: "搜尋好友")
            .overlay {
                if viewModel.isLoading {
                    LoadingView(message: "讀取好友資料...")
                        .background(.ultraThinMaterial)
                }
            }
            .refreshable {
                await refreshManager.refreshIfNeeded(scopes: [.friends], force: true)
            }
            .task {
                await refreshManager.refreshIfNeeded(scopes: [.friends])
            }
            .alert("發生問題", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("好") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }

    private var searchSection: some View {
        Section {
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    Label("尋找好友", systemImage: "person.crop.circle.badge.plus")
                        .font(AdriftTypography.section)

                    HStack {
                        TextField("輸入 userCode", text: $query)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .textFieldStyle(.roundedBorder)

                        Button {
                            Task { await viewModel.search(userCode: query) }
                        } label: {
                            if viewModel.isSearching {
                                ProgressView()
                            } else {
                                Image(systemName: "magnifyingglass")
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(AdriftColors.ocean)
                        .disabled(viewModel.isSearching)
                    }

                    if let message = viewModel.searchMessage {
                        Label(message, systemImage: "info.circle")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 6, trailing: 0))
            .listRowBackground(Color.clear)

            if let result = viewModel.searchResult {
                searchResultCard(result)
                    .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 6, trailing: 0))
                    .listRowBackground(Color.clear)
            }
        }
    }

    private var invitesSection: some View {
        Section("好友邀請") {
            if viewModel.requests.isEmpty {
                Label("目前沒有好友邀請", systemImage: "bell")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(viewModel.requests) { request in
                    if let from = request.from {
                        HStack {
                            AvatarView(name: from.name, avatarUrl: from.avatarUrl)
                            VStack(alignment: .leading) {
                                Text(from.name)
                                Text("@\(from.userCode)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("接受") {
                                Task { await viewModel.accept(request) }
                            }
                            Button("拒絕") {
                                Task { await viewModel.reject(request) }
                            }
                            .foregroundStyle(.red)
                        }
                    }
                }
            }
        }
    }

    private var friendsSection: some View {
        Section("好友列表") {
            if viewModel.friends.isEmpty {
                GlassCard {
                    ContentUnavailableView(
                        "尚無好友",
                        systemImage: "person.2",
                        description: Text("搜尋 userCode，開始建立 Adrift 連結。")
                    )
                }
                .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                .listRowBackground(Color.clear)
            } else {
                ForEach(filteredFriends) { friend in
                    HStack {
                        AvatarView(name: friend.name, avatarUrl: friend.avatarUrl)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(friend.name)
                                .font(.headline)
                            Text("@\(friend.userCode)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    @ViewBuilder
    private var sentRequestsSection: some View {
        if !viewModel.sentRequests.isEmpty {
            Section("已送出邀請") {
                ForEach(viewModel.sentRequests) { request in
                    if let to = request.to {
                        HStack {
                            AvatarView(name: to.name, avatarUrl: to.avatarUrl, size: 36)
                            Text("@\(to.userCode)")
                            Spacer()
                            Text("等待回覆")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private func searchResultCard(_ result: SearchUserResult) -> some View {
        GlassCard {
            HStack(spacing: 12) {
                AvatarView(name: result.name, avatarUrl: result.avatarUrl)
                VStack(alignment: .leading, spacing: 3) {
                    Text(result.name)
                        .font(.headline)
                    Text("@\(result.userCode)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                searchAction(for: result)
            }
        }
    }

    @ViewBuilder
    private func searchAction(for result: SearchUserResult) -> some View {
        switch result.friendshipStatus {
        case "self":
            Text("這是你")
                .font(.caption)
                .foregroundStyle(.secondary)
        case "friend":
            Label("已是好友", systemImage: "checkmark.circle")
                .font(.caption)
                .foregroundStyle(AdriftColors.calm)
        case "sent_request":
            Text("已送出")
                .font(.caption)
                .foregroundStyle(.secondary)
        case "received_request":
            Text("待接受")
                .font(.caption)
                .foregroundStyle(.secondary)
        default:
            Button("加好友") {
                Task { await viewModel.sendRequest() }
            }
            .buttonStyle(.borderedProminent)
            .tint(AdriftColors.ocean)
        }
    }
}
