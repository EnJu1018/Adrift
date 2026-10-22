# Adrift Memory Chat

## API and Data Boundary

`POST /api/ai/chat` accepts `{ message, history }` behind the existing JWT
middleware. The API app itself mounts `/ai/chat`; Nginx provides `/api`.
Each request queries only `Diary.user === req.user._id`. Body user IDs and
client-provided assistant answers never determine ownership or evidence.
Opening a related diary uses the existing authorized diary detail endpoint.

The response follows `{ success, data }`. Data includes `answer`, `scope`,
`status`, and server-validated `relatedDiaries`. Empty results and clearly
unrelated requests never invoke Gemini or consume daily generation quota.
Unclear requests ask for a diary, place, or mood perspective.

## Retrieval

- Taipei calendar dates: explicit day/month/year, previous month/year,
  current/previous week, today/yesterday, and recent-day windows.
- Follow-up questions inherit the latest explicit time/place from at most
  four prior user questions. Every turn re-queries authorized data.
- Location names, mood, and escaped title/content search narrow the query.
- A single bounded aggregation returns matching totals, mood statistics,
  top ten places, and at most forty candidates. The user ownership match
  runs before every aggregation branch.
- Up to eight diary excerpts enter the model, at most 1,200 characters each
  and 11,000 serialized characters combined. Statistics cover all matches;
  excerpts are samples, not the person's complete life history.
- No coordinates, account documents, emails, credentials, or images enter
  the model. Dates, place names and diary excerpts still contain personal
  information; the composer discloses third-party processing before sending.

This is lightweight retrieval, not a universal natural-language date/place
parser. Ambiguous language may require a more specific question. Broad
queries sample recent records; historical reviews should specify a period.

## Generation and Safety

The existing Gemini SDK reads only `GEMINI_API_KEY` and `GEMINI_MODEL` on
the server. No guessed model fallback is used. Model availability and quota
depend on the configured Google project; a free tier is not guaranteed.

System instructions are separate from untrusted questions and diary data.
The model has no database tools or write capability. Responses must conform
to a JSON schema and cite IDs from the retrieved evidence. Unknown IDs or
invalid citation numbers fail closed. Citation numbers are normalized to the
displayed reference list. Plain React text rendering avoids model HTML.

These controls prevent cross-account queries and fabricated reference IDs,
not every possible inaccurate interpretation. Answers remain review aids,
not psychological diagnoses. Users should check the original cited diaries.

## Limits and Failure Recovery

- Message: 1,000 characters. History: twelve bounded entries maximum;
  only the last four user questions influence retrieval.
- Six AI requests per user per minute, shared with Insights. This window
  is process-local; daily caps below remain shared across workers/restarts.
- Default daily caps: twenty generation attempts per user and two hundred
  across the application, using Taipei dates. Configure `AI_DAILY_LIMIT`
  and `AI_GLOBAL_DAILY_LIMIT` (hard maximums 100 and 2,000).
- Atomic MongoDB counters live in the additive `aiusages` collection and
  expire after two days. No existing diary/user document is migrated.
- Failed generations count. The global counter is reserved first, so a
  rejected per-user reservation can conservatively consume global capacity.
- Twenty-second generation deadline, caller cancellation, at most one
  retry for 500/502/503, and no automatic retry for 429. The deadline covers
  both attempts; two provider calls may use one reserved generation attempt.
- Retrieval/usage operations have five-second query deadlines. Shared API
  requests have a thirty-second client connection deadline.
- HTTP 429 includes Retry-After; unavailable providers return 503 with a
  retry action. Database failures during authentication return 503, not 401.
- HTTP access logs omit query strings, including event-stream credentials.
  Provider errors log only status/type metadata, not request content or keys.

## Interface

Insights remains available alongside the new Memory Chat tab. Session-only
messages survive tab/route changes while signed in, but logout clears them.
The interface supports IME-safe Enter, Shift+Enter, retry, new conversation,
citations, suggestion questions, keyboard tabs, and a first-diary action.
The transcript scrolls independently without moving the composer. Compact
visual-viewport handling reserves input space when a mobile keyboard opens.
Motion uses existing tokens and reduced-motion rules; Mapbox roots and
presentation navigation are unchanged.

## Verification

```bash
node --test apps/api/tests/*.test.js
node --test apps/web/src/components/markers/*.test.js
npm run build --workspace apps/web
```

Browser checks are in `apps/web/tests/memory-chat-browser.mjs` and
`api-session-browser.mjs`, alongside existing regression scripts. Point
`PREVIEW_URL` at a Vite dev server; set `PLAYWRIGHT_MODULE` to an installed
Playwright module when it is not locally resolvable. `BROWSER=webkit` checks
WebKit in addition to the default installed Chrome. Fixtures isolate the
database and model: tests never edit production user/diary records.
