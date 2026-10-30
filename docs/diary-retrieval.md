# Diary Retrieval

## Boundary and Callers

`apps/api/src/services/diaryRetrieval.js` is the read-only foundation used by
Intelligence overview, Insights generation and Memory Chat. It uses the
existing Diary schema: `user`, `title`, `text`, `mood.type`, `mood.intensity`,
`location.placeName`, `visibility`, `createdAt`, `updatedAt`.

The route's existing JWT middleware verifies `sub`, loads the current user,
and passes `req.user._id`. Every service operation validates and normalizes
that ID to a MongoDB ObjectId. Aggregation starts with an owner match;
detail reads include both owner and IDs. Client/model user IDs, roles,
visibility claims and conversation text cannot change this boundary.

All of an owner's private, friends-only and public records are included.
Other accounts' records are excluded even when public or mutually visible.
The ordinary diary viewer's broader sharing permissions are not reused as
personal-memory authorization. Missing and foreign detail IDs both fail
closed with `UNAUTHORIZED`; mixed authorized/foreign batches return nothing.

## Service Functions

| Function | Input | Result |
| --- | --- | --- |
| `searchUserDiaries` | Model, authenticated owner, validated filters, limit/cursor/order | Full authorized records, next cursor, fixed `asOf` |
| `getAuthorizedDiaryDetails` | Model, owner, 1–50 real ObjectIds | Full title/text and verified source metadata, in requested order |
| `getDiaryTimeline` | Same filters and page options | Ascending, owner-scoped keyset pages; no model-generated timeline facts |
| `getEmotionStatistics` | Same filters; optional representative samples | Exact total/distribution/intensity/month/place facts and evidence status |
| `validateDiaryCitations` | Owner, cited IDs and server-retrieved source DTOs | Fresh, owned sources, or a closed failure |

The model is injected for isolated tests; production callers use the existing
Mongoose Diary model. No database connection, migration, provider selection,
write tool or new HTTP endpoint is introduced here.

## Filters and Dates

Supported constraints: `range`, up to two `ranges`, `place`, `placeMode`,
`mood`, up to eight literal `terms`, and `asOf`. Literal terms are ORed across
title, text and place name; regex characters are escaped once at query creation.
`placeMode: location` matches the stored place; `mentioned` searches only
title/text. Taiwan spelling aliases are normalized, not geocoded. Arbitrary
place-name strings do not constitute verified city or travel-date metadata.

Dates are interpreted in Asia/Taipei. Pure `YYYY-MM-DD` boundaries mean local
midnight, not UTC midnight. Timestamps must include `Z` or an explicit offset.
Calendar date/month/year queries use `[start, next boundary)`; a custom filter's
end is also exclusive unless `endInclusive: true`. Natural-language inclusive
day ranges are converted to the following local midnight. Rolling weeks/days
preserve the clock; rolling months/years preserve local time and clamp to the
target month's last valid day. Current periods end at server `asOf`.

Supported phrases include the past week/month/three months/half-year/year,
previous month, this/previous year, explicit calendar dates and custom ranges.
Two-year comparisons query both ranges and retain separate totals; excluded
months between non-adjacent ranges are not labelled as zero-data months.
Malformed dates, reversed ranges, excessive spans (over 3,660 days per range)
and query operators supplied instead of scalar values are rejected with 400.
This is a bounded deterministic parser, not general natural-language planning.

The schema's `createdAt` is recording time. It cannot establish when a
historical event described in a newly written diary actually happened.

## Pagination and Statistics

Search pages accept 1–50 entries (default 20), ordered by `createdAt` and `_id`.
The existing keyset cursor handles equal timestamps. Ascending and descending
queries both retain ownership and filters. Reuse the returned `asOf` and the
same filters/order on subsequent pages to exclude later inserts. This is not a
multi-request database snapshot: deleting/backdating/editing data can change
subsequent results. Cursors are positions, not authorization credentials.

Statistics use one owner-first MongoDB facet with a five-second query deadline:

- Account total and filtered total; all visibilities contribute equally.
- Mood counts and intensity means weighted by valid numeric values in 1–5.
  Missing, string and out-of-range intensities are excluded, not coerced.
- Monthly mood counts, intensity counts/means and explicit evidence status.
  At most the latest 24 calendar months are returned (`monthlyLimited`).
- Daily counts/intensities, capped at 3,660 returned days (`dailyLimited`).
- Full distinct place count and top ten place/mood associations; overview
  returns its existing top-five shape. Taiwanese spelling aliases merge.
- Each comparison period retains its own exact total and mood distribution.

Empty months have `count: 0`, `averageIntensity: null`, `NO_RECORDS`; fewer
than three records is `INSUFFICIENT_EVIDENCE`. Neither proves a mood change or
a lack of emotions. All-time totals remain exact when monthly/daily output is
capped. Excerpts are representative samples, never substitutes for totals.

`GET /ai/overview` retains its 7/30/90-day response shape. Insights retains its
minimum-three threshold and latest-40, 250-character sample policy, now with
source IDs/spans and exact all-owned statistics. The legacy numeric
`moodTrend.averageIntensity` is overwritten with the server mean, not the
model's number. For legacy clients only, 0 remains the unavailable sentinel
when no valid intensity exists; authoritative `statistics.averageIntensity`
is null in that case. Do not display that sentinel as an observed mood score.
Generated prose can still misinterpret facts and is not a statistical API.

## Evidence Contract

Every authorized record carries:

```text
id: the real Diary ObjectId as a string
title, content: full stored title and text (details/search)
mood: stored type, valid numeric intensity or null
createdAt, updatedAt, place, visibility
contentTruncated: explicit for model excerpts
source: { type: "diary", revision, field: "text", start, end }
```

`revision` is a SHA-256 hash of the selected source fields, including complete
content and timestamps. `start/end` are JavaScript string offsets into the
original text; they describe a backend-selected excerpt, not a model assertion.
Coordinates, account data, photos and credentials are not included.

Memory Chat uses at most sixteen excerpts, representative months and moods for
life/trend/comparison reviews, and a 24,000-character complete data payload cap.
The full text remains available through authorized details. This character
limit is not a token budget or a validated local-model context window.

Cited IDs must be in the retrieved source set. Before returning an answer,
the service re-reads every cited document with its owner and compares revisions.
Unknown IDs fail as `invalid_citation`; deletion, ownership changes or edits
invalidate stale evidence with 409. Retrieval failures remain 503. This validates
existence, ownership and source freshness, not whether every free-text claim
is entailed by a cited passage; claim-level grounding remains separate work.

## State and Compatibility

- `NO_DIARIES`: the owner has no diary records.
- `NO_MATCHES`: the account has records but these filters match none.
- `INSUFFICIENT_EVIDENCE`: some records exist, but the view needs more evidence
  for a longer-term claim. A single diary can still support a limited Chat reply.
- `RETRIEVAL_ERROR`: a database operation failed; never reported as an empty result.
- `UNAUTHORIZED`: missing identity or requested source outside the owner's data.

Existing JSON envelopes and endpoints remain intact. Chat optionally accepts
and returns `queryContext` with bounded intent/topic/filters/depth. This client-held
context is validated on every request; it grants no authority and is never
evidence. Older clients can omit it and continue using the bounded question
history. Errors preserve filters for a later retry/follow-up. Insights/Chat
retain separate loading, errors, request guards and quota behavior.

## Verification

Use local isolated MongoDB databases only; fixtures validate loopback hostnames
and database prefixes before creating or dropping any data. A local replica
set is needed for the existing social transaction suites. Example variables:

```bash
DIARY_RETRIEVAL_TEST_MONGO_URI=mongodb://127.0.0.1:27149/adrift_retrieval_test_phase1
MEMORY_TEST_MONGO_URI=mongodb://127.0.0.1:27149/adrift_memory_test_phase1
INTELLIGENCE_TEST_MONGO_URI=mongodb://127.0.0.1:27149/adrift_intelligence_test_phase1
SOCIAL_TEST_MONGO_URI=mongodb://127.0.0.1:27149/adrift_social_test_phase1
NOTIFICATIONS_TEST_MONGO_URI=mongodb://127.0.0.1:27149/adrift_notifications_test_phase1
```

Export those variables, then run `node --test apps/api/tests/*.test.js`.
The dedicated retrieval suite includes actual aggregation/find/JWT queries,
multiple accounts and visibilities, 50/500/5,000 records, 51 equal-timestamp
records, local date boundaries, invalid intensity values, live edit/delete
citation invalidation and a real MongoDB rejected query. Provider calls remain
mocked. Missing database variables cause integration tests to skip; a skipped
run is not retrieval acceptance.

Future Agent acceptance is independent of these deterministic tests:
permissions/dates/statistics/references 100%; multi-turn success at least 95%;
at least 11/12 original full flows; at least 90% on 100 or more held-out cases.
Freeze held-out questions, fixture data, rubric and model settings before
evaluation. Once used for tuning, those cases are not unseen evaluation data.
No Phase 1 test count establishes model quality, GPU capacity or gateway safety.
