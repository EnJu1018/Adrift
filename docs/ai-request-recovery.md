# Intelligence Request Recovery

## Incident Verification (2026-11-09)

- The affected surface is production Memory Chat, not a video fixture. Nginx
  recorded successful overview reads, repeated chat HTTP 502 responses and then
  HTTP 429 after repeated submissions.
- Matching request IDs in the backend logs show Gemini HTTP 200 followed by
  `invalid_citation` / HTTP 502 in Memory Chat. For example,
  `266b1e35-f8dc-4d7c-9a0e-cd9342236a06` completed provider generation but failed
  citation validation. Provider downtime was not the cause of that request.
- The old output contract separately requested free-text numeric references and
  an array of diary IDs. The backend interpreted numeric references against the
  full sampled diary order. Missing numbers or numbers relative to a selected
  subset fail validation even when the ID array contains authorized diaries.
- The literal `Request failed` came from the client's fallback after missing JSON
  messages and empty status text. The original browser response body was not
  retained; whether a proxy replaced that particular 502 body is unverified.
  The client now handles that failure class explicitly rather than hiding it.

## Repair

Memory Chat requests structured paragraphs with explicit diary-ID references.
The schema's ID enum is restricted to the current authorized context. The
backend validates each paragraph, rechecks ownership and source revisions, then
assigns a single consistent numbering scheme. It does not invent IDs, silently
remap ambiguous numeric references, or replace failures with fake answers. The
public `answer`, `relatedDiaries`, evidence and query-context contract is unchanged.

The tested Gemini model rejected nested array `maxItems` constraints with HTTP
400 (`too many states for serving`). Those constraints are enforced in backend
validation instead: at most eight paragraphs, 16 citations per paragraph and
5,000 text characters. The existing provider output cap remains in effect.

The API client validates response content types and JSON shape, safely classifies
HTTP/network/deadline failures, preserves request IDs and authorized recovery
context, and keeps deadlines active until the JSON body finishes. Cancellation
does not expire authentication. Only genuine API 401 responses clear the matching
session. Chat retains a failed question for editing/retry, rejects duplicate
submissions and ignores responses belonging to a discarded conversation.

## Deployment Boundary

Before deployment, read-only inspection found production configured for Gemini
`gemini-2.5-flash-lite`. `AI_PROVIDER` is unset (Gemini default), and local-provider
verification/token configuration is absent from the application's environment.
The existing AI routes call Memory Chat / Insights services, not the standalone
Agent Orchestrator. This repair does not change provider selection or attach the
Agent to production.

The VPS private tunnel is loopback-only and returns 401 without credentials.
Authenticated home-gateway health reports Qwen3.5 4B available but unloaded,
an empty queue and a closed circuit. No model was loaded, shared service restarted
or network configuration changed during those checks.

A fresh backend import on the VPS initially failed because its installed API dependencies
were missing `ajv`, although the dependency is already declared. The older running
process still responded. Do not restart it before installing dependencies and
running `npm --workspace apps/api run check:runtime`. See [deployment](deployment.md).
No production database changes or private-diary generation tests were performed.

## Reproduction And Verification

- Existing backend suite: 139 unit/logic/HTTP tests and 87 isolated MongoDB
  integration tests; 226 passed, no skips. Production Atlas is not loaded.
- Web unit tests: 23 passed, including 19 existing marker/device/chart tests.
- Existing `intelligence-browser.mjs` and `memory-chat-browser.mjs`: retention,
  cancellation, citations, context, themes and layout regression checks passed.
- `ai-request-browser.mjs`: real Express/JWT/MongoDB/browser tests for normal
  generation, HTML 502, empty JSON, connection loss, local-provider outage,
  gateway outage, queue rejection, invalid references, duplicate submissions,
  deadlines before headers and during body reads, recovery, empty accounts and
  expired JWT. Chrome and WebKit passed with deterministic provider fixtures.
- The same browser test also passed with real Gemini generation for Chat and
  Insights, using only the isolated synthetic diaries. The key remains on the
  VPS; no user diaries are retrieved or transmitted. Other outage scenarios stay
  deterministic and do not spend generation quota.

To run the full browser path against an isolated loopback database:

```sh
AI_REQUEST_TEST_MONGO_URI=mongodb://127.0.0.1:27149/adrift_ai_request_test_local \
  node apps/web/tests/ai-request-browser.mjs
```

For the explicit real-provider smoke test, additionally set
`AI_SMOKE_SSH_TARGET` to the authorized existing backend SSH host. This makes two
synthetic generation requests using its configured Gemini credentials; it refuses
to run if that host has selected a different provider. Do not use production
diaries as test fixtures.

Citation validity verifies source identity/version, not every free-text semantic
claim. Production authenticated end-user generation after deployment remains a
separate acceptance check; synthetic smoke tests do not authorize reading or
transmitting a user's private diaries.
