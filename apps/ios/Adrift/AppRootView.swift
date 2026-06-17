import SwiftUI

struct AppRootView: View {
    @EnvironmentObject private var authViewModel: AuthViewModel
    @StateObject private var rootViewModel = RootViewModel()

    var body: some View {
        ZStack {
            switch rootViewModel.launchState {
            case .launching:
                SplashView()
                    .transition(.opacity)
            case .authenticated:
                MainTabView()
                    .transition(.opacity)
            case .unauthenticated:
                AuthView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.35), value: rootViewModel.launchState)
        .task {
            await rootViewModel.launch(using: authViewModel)
        }
        .onChange(of: authViewModel.sessionState) { _, newValue in
            rootViewModel.synchronize(with: newValue)
        }
    }
}
