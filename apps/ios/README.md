# Adrift iOS

這是 Adrift 的原生 iOS App，使用 SwiftUI 開發，資料來源共用 Adrift 後端 API。這不是 WebView wrapper，也不建立第二套後端或資料庫。

## Stack

- SwiftUI
- iOS 18+
- Apple Human Interface Guidelines
- Native `NavigationStack`, `TabView`, `List`, `Form`, `Section`, `Sheet`, `Toolbar`
- Conditional iOS 26 Liquid Glass (`glassEffect`, `.buttonStyle(.glass)`, `.buttonStyle(.glassProminent)`)
- MVVM
- URLSession
- Keychain JWT storage
- MapKit
- CoreLocation
- PhotosPicker
- AsyncImage
- SF Symbols

Minimum iOS Version: iOS 18.0.

Recommended: iOS 26 or later for Liquid Glass effects.

Liquid Glass:

- iOS 26 or later: uses native Liquid Glass APIs.
- iOS 18-25: falls back to SwiftUI Material effects.

## App Icon and Launch

- The production icon is stored in `Adrift/Assets.xcassets/AppIcon.appiconset`.
- The icon catalog provides Any, Dark, and Tinted appearances for iOS 18 and later.
- The native launch screen uses an adaptive asset color and the centered `AdriftLaunchLogo`.
- Launch and Splash backgrounds automatically follow the system Light or Dark appearance.
- `SplashView` remains visible for at least 0.9 seconds while the existing Keychain JWT and current-user bootstrap finishes.
- The root launch state prevents the login or main screen from appearing before authentication has been resolved.

## Automatic Refresh

- Global refresh buttons are removed from Map, Friends, and Settings.
- Map, friends, and current-user data refresh automatically on first load, page entry, foreground activation, and a lightweight 120-second foreground interval.
- Refreshes are throttled and deduplicated by `AppRefreshManager`.
- Friends keeps native pull-to-refresh for an explicit page-level refresh.
- Subsequent refreshes preserve existing content without showing full-screen loading states.

Shared Liquid Glass helpers live in:

`Adrift/Components/GlassComponents.swift`

They include `GlassCard`, `GlassPanel`, `GlassFloatingButton`, `GlassToolbarButton`, `GlassProminentButton`, and `GlassChip`. All iOS 26-only Liquid Glass APIs are wrapped inside these components with iOS 18-25 material fallbacks.

## Design System

The shared Adrift iOS design layer lives in:

- `Adrift/Design/AdriftColors.swift`
- `Adrift/Design/AdriftTypography.swift`
- `Adrift/Design/AdriftSpacing.swift`
- `Adrift/Design/AdriftMotion.swift`
- `Adrift/Design/AdriftBackground.swift`

It provides brand colors, mood colors, typography, spacing, motion presets, and the animated Adrift background with abstract map lines and memory lights.

## Backend

The app uses the existing Adrift API. It does not create a new backend, database, or WebView wrapper.

Default API base URL:

```swift
// Adrift/Config/APIConfig.swift
static let baseURL = URL(string: "https://adrifttw.com/api")!
```

For local backend development, temporarily replace it with `http://localhost:5000` when running in Simulator.

## Implemented Endpoints

- `POST /auth/login`
- `POST /auth/register`
- `GET /users/me`
- `GET /diaries`
- `POST /diaries`
- `GET /friends`
- `GET /friends/requests`
- `GET /friends/requests/sent`
- `GET /users/search?userCode=...`
- `POST /friends/request`
- `POST /friends/requests/:requestId/accept`
- `POST /friends/requests/:requestId/reject`
- `GET /ai/life-map`
- `PATCH /users/me/avatar`

## Build

```sh
xcodebuild -project apps/ios/Adrift.xcodeproj \
  -scheme Adrift \
  -destination 'generic/platform=iOS Simulator' \
  build
```

Or open `apps/ios/Adrift.xcodeproj` in Xcode and run the `Adrift` scheme.

## TODO

- Add avatar crop, zoom, and positioning controls after the first PhotosPicker upload flow.
- Add friend request cancellation and friend deletion.
- Add richer diary detail/edit flows.
- Replace MapKit with Mapbox iOS SDK if product parity requires it.
- Add UI tests after backend test fixtures are available.
