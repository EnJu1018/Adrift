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

The Gemini service reads `GEMINI_API_KEY`, `GEMINI_MODEL` and optional
`GEMINI_FALLBACK_MODEL` on the server, using the supported `v1beta`
generateContent endpoint. Configure a fallback only after verifying model
access and free-tier availability for the Google project. No model is
silently selected from a hardcoded list, and billing is never enabled by
the application. Model availability and remaining quota are not guaranteed.

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
- Forty-second total generation deadline and caller cancellation. At most
  two provider requests per operation, separated by an 800ms backoff.
  Without a configured fallback, only explicit upstream 500/502/503 errors
  get a retry. With a fallback, the primary has fifteen seconds, and a
  timeout, missing model or upstream 5xx may use the fallback once within
  the same overall deadline. No retry for bad credentials, quota, input or
  invalid output. Two provider calls may use one reserved generation attempt.
- One in-flight operation per user per feature in each API worker. Chat
  and Insights have separate guards and failure states; statistics do not
  consume model quota.
- Gemini 3 uses `low` thinking rather than unsupported `minimal`; Gemini
  2.5 Flash uses its supported thinking budget. The 4,096-token output cap
  includes reasoning tokens. Empty, truncated, blocked or invalid JSON is
  rejected, not replaced with fabricated analysis. Both features use
  structured output and server-side response validation.
- Retrieval/usage operations have five-second query deadlines. Shared API
  requests retain a thirty-second client deadline, while AI generation
  requests have sixty-five seconds for authentication, retrieval, usage
  reservation and generation. Nginx must allow that complete request budget.
- Error responses preserve `success` and `message` and add a safe `code`
  and `requestId`; `X-Request-ID` links server logs. Quota returns 429,
  timeout 504, invalid provider output/configuration 502, and temporary
  unavailability 503. Provider authentication errors never return a
  logout-inducing 401. Local JWT failures retain the existing 401 behavior.
- HTTP access logs omit query strings, including event-stream credentials.
  Provider logs contain request ID, feature, model, category, HTTP status,
  duration and retry count, never upstream error text, diary content or keys.

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
