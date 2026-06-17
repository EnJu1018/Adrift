import SwiftUI

@main
struct AdriftApp: App {
    @StateObject private var authViewModel = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environmentObject(authViewModel)
        }
    }
}
