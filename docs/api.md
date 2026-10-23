# Adrift API

The API app lives in `apps/api`.

Production clients use `https://adrifttw.com/api`; Nginx strips the `/api`
prefix before forwarding to Express. The website and independent
[Adrift-iOS](https://github.com/EnJu1018/Adrift-iOS) app share this backend.
Preserve existing paths, response envelopes, JWT and visibility rules for
installed mobile clients. Prefer additive changes and coordinate breaking
changes with the iOS repository's `docs/API_CONTRACT.md` and contract checks.
Gemini and database credentials remain server-side.

## Local Development

```bash
cd apps/api
npm install
npm run dev
```

## Environment

Use `apps/api/.env.example` as the reference.

Important variables:

- `PORT`
- `CLIENT_ORIGIN`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## Main Routes

- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
- `GET /diaries`
- `POST /diaries`
- `GET /friends`
- `GET /friends/requests`
- `GET /users/search?userCode=...`
- `GET /ai/life-map`
- `POST /ai/chat`

Memory Chat authorization, retrieval limits, quotas, and tests are documented
in [memory-chat.md](memory-chat.md).

Social Hub endpoints, transaction requirements, visibility rules and integration
tests are documented in [social-hub.md](social-hub.md).

The read-only `GET /ai/overview?days=30` statistics and Intelligence interface
boundaries are documented in [intelligence.md](intelligence.md).

All protected routes require:

```txt
Authorization: Bearer <JWT>
```
