# Adrift Architecture

This repository contains the website and shared backend:

- `apps/web`: React / Vite website.
- `apps/api`: Node.js / Express API.

The native SwiftUI app is maintained independently in
[Adrift-iOS](https://github.com/EnJu1018/Adrift-iOS) (private repository).

## Boundaries

- Web code stays in `apps/web`.
- API code stays in `apps/api`.
- iOS Swift / Xcode code stays in the separate iOS repository.
- Shared documentation stays in `docs`.
- Future shared JavaScript utilities or types can live in `packages/shared`.

## Data Flow

```txt
Web / iOS clients
        |
        v
Adrift API
        |
        v
MongoDB Atlas
```

The iOS app consumes the same API as the website. It does not own a separate backend or database.

The two repositories have independent Git histories, build and release processes.
There are no submodules, local package links or cross-repository filesystem paths.
Preserve the public API contract for already-installed mobile clients; see
[api.md](api.md) and the iOS repository's `docs/API_CONTRACT.md`.
