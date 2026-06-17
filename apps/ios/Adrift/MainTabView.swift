import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var authViewModel: AuthViewModel
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var mapViewModel = MapDiaryViewModel()
    @StateObject private var friendsViewModel = FriendsViewModel()
    @StateObject private var refreshManager = AppRefreshManager()

    var body: some View {
        TabView {
            MapDiaryView(viewModel: mapViewModel)
                .tabItem {
                    Label("地圖", systemImage: "map")
                }

            FriendsView(viewModel: friendsViewModel)
                .tabItem {
                    Label("好友", systemImage: "person.2")
                }

            IntelligenceView()
                .tabItem {
                    Label("洞察", systemImage: "sparkles")
                }

            SettingsView()
                .tabItem {
                    Label("設定", systemImage: "gearshape")
                }
        }
        .environmentObject(refreshManager)
        .toolbarBackground(.visible, for: .tabBar)
        .toolbarBackground(.regularMaterial, for: .tabBar)
        .task {
            mapViewModel.prepareLocation()
            refreshManager.configure(
                authViewModel: authViewModel,
                mapViewModel: mapViewModel,
                friendsViewModel: friendsViewModel
            )
            await refreshManager.refreshIfNeeded(scopes: [.diaries, .friends], force: true)

            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(120))
                guard scenePhase == .active else { continue }
                await refreshManager.refreshIfNeeded(minimumInterval: 120)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task {
                await refreshManager.refreshIfNeeded(minimumInterval: 60)
            }
        }
    }
}
