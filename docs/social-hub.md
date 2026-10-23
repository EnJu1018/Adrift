# Social Hub

The website's `/friends` page groups existing friends, invitations and discovery
into three tabs. Profiles link visible memories back to the map. The mobile
profile is a bottom sheet; desktop uses a side panel. Existing avatar, dialog,
button feedback, number and motion components are shared with the rest of the
website. Discovery reveals at most six rows with a 40ms stagger and respects
reduced motion. No dependency or iOS source changes are required.

## API

All paths below use the `/api` prefix, require a JWT and return `Cache-Control:
no-store`. Mutations return `{ success, message, data }`; relationship data uses
`self`, `friend`, `received_request`, `sent_request` or `none` and, when relevant,
`requestId`.

- `GET /friends`: existing friends with public identity fields.
- `GET /friends/requests`: deduplicated pending incoming invitations.
- `GET /friends/requests/sent`: pending outgoing invitations.
- `POST /friends/request`: send an invitation using `targetUserId`.
- `POST /friends/requests/:requestId/accept`: recipient accepts.
- `POST /friends/requests/:requestId/reject`: recipient rejects.
- `DELETE /friends/requests/:requestId/cancel`: sender withdraws.
- `DELETE /friends/:friendId`: remove the relationship on both sides.
- `GET /friends/search?q=`: normalized name/ID search, 2–40 characters, 20 results.
- `GET /friends/recommendations?limit=`: real mutual-friend counts only, no model
  dependency or location-based inference. At most 200 candidates are considered.
- `GET /friends/:friendId/profile`: safe identity, relationship and visible counts.
- `GET /friends/:friendId/memories?cursor=`: 12 visible memories per page,
  chronological cursor, 240-character previews.
- `GET /friends/:friendId/places`: shared recorded places for mutual friends.

The legacy `GET /users/search?userCode=` exact lookup and invitation/list response
shapes remain available to existing clients. Profiles and search never return
email, password hashes, role, token or raw relationship arrays.

## Integrity and Deployment

Friendship mutations require a MongoDB replica set or a transaction-capable
sharded cluster. Standalone deployments fail closed with 503. Both sides are
updated in one transaction; every operation on a pair first writes the same
canonical user document to serialize competing invitations, withdrawals,
acceptance and removal. A failed second write rolls back the entire operation.
No destructive migration or relationship backfill is performed.

Additive schema changes: a private `socialVersion` counter on User; indexes on
pending invitation sender/status, invitation ID and friends; an author/visibility/
date/ID diary index. Check index creation permissions before deploying to a new
database.

Per authenticated user and process, limits are 30 search/recommendation requests,
20 mutations and 90 social reads per minute, with `Retry-After: 60` on 429.
These in-memory limits and SSE fan-out suit the current single-process service;
use shared rate-limit storage and cross-worker event delivery before horizontal
scaling.

## Privacy and Refresh

Private diaries never enter another person's profile or shared-place comparison.
Friend-only records require a current mutual friendship. Every profile/page/
place request rechecks the relationship; opening a diary uses the normal diary
detail endpoint for another authorization check.

Shared places compare each person's latest 100 public/friend diaries. Matching
requires the same normalized place name and coordinates within 100m. Results are
limited to 12 places with at most eight friend diary references each. This is not
a complete travel history or evidence that the two people visited together.
Missing/invalid coordinates and private diaries are excluded.

Successful mutations notify both connected users via `social:changed`. The web
client immediately invalidates cached friend-only content and reloads social and
map/feed sources, including on returning to the friend page or regaining focus.
Failed reloads do not restore revoked cached diaries. Diary SSE delivery reads
fresh viewer permissions in a batched query for every event, and expired tokens
or unavailable permission checks close the stream rather than sending data.

## Checks

Run backend tests only against a disposable loopback replica set. The integration
suite refuses a remote URI or database name without the `adrift_social_test_`
prefix, and drops that test database before and after the run:

```sh
SOCIAL_TEST_MONGO_URI='mongodb://127.0.0.1:27129/adrift_social_test_hub?replicaSet=social-test' node --test apps/api/tests/*.test.js
node --test apps/web/src/components/markers/*.test.js
node apps/web/tests/social-browser.mjs
BROWSER=webkit node apps/web/tests/social-browser.mjs
node apps/web/tests/app-stability-browser.mjs
```

Browser checks use isolated fixtures with the actual React components and CSS;
they do not create production users or diaries. Set `PLAYWRIGHT_MODULE` if
Playwright is installed outside the workspace. The website dev server defaults
to `http://127.0.0.1:5178` for these checks. The package currently has no configured
lint script; production build and regression tests are separate checks.
