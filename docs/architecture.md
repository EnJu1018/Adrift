# Adrift Architecture

Adrift is organized as a monorepo with three product surfaces:

- `apps/web`: React / Vite website.
- `apps/api`: Node.js / Express API.
- `apps/ios`: Native SwiftUI iOS app.

## Boundaries

- Web code stays in `apps/web`.
- API code stays in `apps/api`.
- iOS Swift / Xcode code stays in `apps/ios`.
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
