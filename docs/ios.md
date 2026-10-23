# Adrift iOS

The native app is maintained in the independent private repository
[EnJu1018/Adrift-iOS](https://github.com/EnJu1018/Adrift-iOS).
Repository access is required to clone it.

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
open Adrift.xcodeproj
```

Run this from the iOS repository, then select the shared `Adrift` scheme in Xcode.
Its README documents build, contract tests, signing and releases. Existing
sources, assets, bundle identifier and Keychain service are preserved.

## API Base URL

The API base URL is configured in:

```txt
Adrift/Config/APIConfig.swift
```

This path is relative to the iOS repository. The production default is
`https://adrifttw.com/api`, including the existing Nginx prefix. Both clients use
the same backend and MongoDB Atlas; iOS contains neither backend source nor
database/Gemini secrets.

## Independent Development

Commit, push, build and release iOS from its own repository. Web/API commits
and VPS deployments happen here. There are no submodules or local package
links between repositories. Coordinate compatible API changes against the iOS
repository's `docs/API_CONTRACT.md` and `Tests/run-contract-checks.sh`.
