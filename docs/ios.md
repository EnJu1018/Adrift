# Adrift iOS

The native iOS app lives in `apps/ios`.

## Stack

- SwiftUI
- iOS 18.0 minimum deployment target
- MapKit
- CoreLocation
- URLSession
- Keychain
- PhotosPicker

## Liquid Glass

- iOS 26 or later: uses native Liquid Glass APIs where available.
- iOS 18-25: falls back to SwiftUI Material effects.

## Build

```bash
open apps/ios/Adrift.xcodeproj
```

Then run the `Adrift` scheme in Xcode.

## API Base URL

The API base URL is configured in:

```txt
apps/ios/Adrift/Config/APIConfig.swift
```
