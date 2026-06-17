import SwiftUI

enum AppLaunchState: Equatable {
    case launching
    case unauthenticated
    case authenticated
}

@MainActor
final class RootViewModel: ObservableObject {
    @Published private(set) var launchState: AppLaunchState = .launching

    private var hasLaunched = false

    func launch(using authViewModel: AuthViewModel) async {
        guard !hasLaunched else { return }
        hasLaunched = true

        async let authenticationCheck: Void = authViewModel.bootstrap()
        async let minimumDisplayTime: Void = waitForMinimumSplashDuration()
        _ = await (authenticationCheck, minimumDisplayTime)

        let destination: AppLaunchState = authViewModel.sessionState == .authenticated
            ? .authenticated
            : .unauthenticated

        withAnimation(.easeInOut(duration: 0.35)) {
            launchState = destination
        }
    }

    func synchronize(with sessionState: SessionState) {
        guard launchState != .launching else { return }

        let destination: AppLaunchState = sessionState == .authenticated
            ? .authenticated
            : .unauthenticated

        guard launchState != destination else { return }
        withAnimation(.easeInOut(duration: 0.3)) {
            launchState = destination
        }
    }

    private func waitForMinimumSplashDuration() async {
        try? await Task.sleep(for: .milliseconds(900))
    }
}
