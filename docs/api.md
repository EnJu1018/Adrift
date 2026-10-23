# Adrift API

The API app lives in `apps/api`.

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

All protected routes require:

```txt
Authorization: Bearer <JWT>
```
