# Diary Tools

Four server-only, read-only capabilities reuse the authorized queries in
`apps/api/src/services/diaryRetrieval.js`. There is no production RPC endpoint,
agent loop, UI change, provider switch, or cloud fallback.

## Entry Points

- `diaryTools.js`: registry, input/output contracts, session, handlers, evidence.
- `diaryToolCalling.js`: exactly one model selection and at most one tool execution;
  bounded serialization for a later explicit model request.
- `aiProvider.js`: `chatTools()` is local-only, requires explicit `AI_PROVIDER=ollama`
  and `OLLAMA_GATEWAY_VERIFIED=1`. Existing Gemini generation stays unchanged.
- `ollama.js`: unchanged Phase 2 transport and independent schema checks.

Create a session **after** `requireAuth` has populated `req.user`; never construct
its identity from a body, query, tool argument, or conversation message. A future
HTTP integration must authenticate each request and keep sessions scoped to the
authenticated account. Do not expose the registry as a general client RPC.

```js
const session = createDiaryToolSession(req, { Diary });
try {
  const turn = await runDiaryToolTurn({
    session,
    provider: { chat: input => aiProvider.chatTools(input) },
    question,
    contextLength: 8192,
    allow8k: true
  });
  // turn.result is the validated server result; turn.context is a bounded excerpt.
} finally {
  session.close();
}
```

This is a server integration example, not an enabled production route. The caller
must forward its cancellation signal. No subsequent model request runs automatically.
The smoke test separately requests a single interpretation as ordinary untrusted
JSON data. It is not a multi-turn `role:tool` protocol or an orchestrator.

## Input Contracts

`diaryToolDefinitions()` returns independent Ollama-compatible definitions.
`diaryToolContracts()` also returns each output schema and authorization rule.
All object schemas reject additional properties and disable type coercion.

| Tool | Required | Optional | Execution |
| --- | --- | --- | --- |
| `search_diaries` | `timeRange` | `city`, `place`, `mood`, `keywords`, `limit`, `cursor`, `sort`, custom dates | Shared owner-scoped keyset search, 180-character excerpts |
| `get_diary_details` | `diaryIds` | None | Reauthorize 1–2 IDs; return full original text, up to 2,000 characters each |
| `get_emotion_statistics` | `timeRange`, `groupBy` | City/place/mood/keywords, custom dates | Shared Mongo aggregation over **all matching records**, not samples |
| `summarize_diary_timeline` | `timeRange`, `groupBy` | City/place/mood/keywords, custom dates, limit/cursor | Shared ascending search and exact period aggregation |

`timeRange` is one of `all_time`, `last_week`, `last_month`, `last_3_months`,
`last_6_months`, `last_year`, `previous_month`, `this_year`, `previous_year`, `custom`.
`last_*` is rolling; `previous_*` is a calendar interval. Custom dates require both
`startDate` and `endDate` in `YYYY-MM-DD`, inclusive through the end date.
Other time ranges reject custom dates. Timezone is fixed to Asia/Taipei. Models
cannot supply `asOf`, an owner, UTC query operators, projection, or collection.
The trusted clock is pinned when the session is created.

`groupBy` is `week` (Monday start) or `month`. Mood values are the actual schema
enum: `calm`, `joy`, `sad`, `wonder`, `anxious`, `confused`, `nostalgic`, `other`;
`joy`, not `happy`, represents happy memories. Search defaults to five records,
maximum ten, with `sort: asc|desc`. Keywords are at most four literal strings of
60 characters; city/place at most 120 characters. A city and place intersect.

City aliases extend the existing Taipei/Taichung/Tainan/Kaohsiung mapping and
Taiwanese 台/臺 spelling normalization. They match **stored place names**; this
is not a geocoder, inferred GPS city, or a search of diary text. Explicit keywords
can search title/text/place. English `New Taipei` is not treated as Taipei.

## Output Contract

Each tool validates its own schema before returning:

```json
{
  "tool": "search_diaries",
  "status": "NO_RESULTS",
  "data": { "diaries": [], "nextCursor": null },
  "count": 0,
  "sources": [],
  "metadata": {
    "requestId": "server-generated-uuid",
    "durationMs": 1,
    "asOf": "2026-10-30T04:00:00.000Z",
    "timezone": "Asia/Taipei",
    "evidenceState": "NO_MATCHES",
    "range": null
  }
}
```

Empty queries return `NO_RESULTS`. Common statuses: `SUCCESS`, `NO_RESULTS`,
`INVALID_ARGUMENTS`, `UNAUTHORIZED`, `NOT_FOUND`, `RETRIEVAL_ERROR`, `TIMEOUT`.
Unknown tools return `NOT_FOUND`. Missing and foreign diary IDs deliberately
share `UNAUTHORIZED` to avoid revealing existence. Errors contain no raw driver
error, connection string, diary text, credential, or topology.

`metadata.evidenceState` preserves `NO_DIARIES`, `NO_MATCHES`, and
`INSUFFICIENT_EVIDENCE` from shared retrieval. A query outage is never an empty
account. Search `count` is the page size; statistics `count` is the exact total;
timeline `count` is the page size and `data.total` is the exact query total.

Records contain `id`, full title, content/excerpt, mood, created/updated dates,
stored place, visibility, and `contentTruncated`. Sources contain real ID,
revision SHA-256, text field, served UTF-16 character offsets, date, and place.
No user documents, precise coordinates, photos, or authentication data are sent.

Statistics contain total, mood distribution, valid-intensity count and weighted
mean, weekly/monthly periods, missing-period starts, coverage, top-ten place
counts, and at most five metadata-only sample IDs. These samples do not authorize
text quotes; request details before quoting. Zero-record intervals have null
intensity and `NO_RECORDS`, not an assertion about the user's emotional state.
Period breakdown is capped at 120 and explicitly reports `periodsLimited` and
covered counts. Overall totals remain exact even when old periods are omitted.

Timeline periods have exact counts and **page-local** related diary IDs. Its
chronological page is not a complete list of every event or an importance ranking.
There is no generated event summarizer.

## Evidence And Budgets

- Every read remains owner-scoped, including private/friends/public diaries.
  Public diaries from other users are never included.
- A session stores at most 64 evidence records, 32 validated calls and their
  cursors, expires after ten minutes, and allows only one pending tool operation.
  Call `close()` when its authorized request/conversation ends.
- Cursors are opaque session tokens bound to filters/order/limit and a pinned
  `asOf`. This is keyset paging, **not a database snapshot**: concurrent edits
  can change membership; citations always recheck current records.
- `validateCitations([{id,start,end,quote}])` requires a record retrieved in this
  session, exact quote inside served text, current ownership/existence, and an
  unchanged revision. A full-details fetch can expand served text coverage.
  Unknown, edited, removed or reassigned evidence is rejected.
- Quote validity is not claim entailment or semantic factuality. That remains a
  Phase 4 prerequisite, along with evidence mapping for aggregate claims.
- DB queries have `maxTimeMS:5000`; tools have a 6.5-second deadline. Cancellation
  ends the caller wait; late DB work cannot register evidence and remains subject
  to the driver deadline. It is not immediate server-side query cancellation.
- Server results are capped at 48 KiB. Model payload defaults to 2,400 UTF-8
  bytes; callers may explicitly request 600–6,000 bytes. It shortens excerpts to
  120 characters and reports omitted records/periods. It does not silently
  change the original page/total count or claim a complete context.
- Model-facing ISO dates use explicit `+08:00`. Authoritative server DTOs keep UTC.
- The four complete definitions occupy about 3,980 bytes. Phase 2's conservative
  byte budget therefore rejects all four together at 4K. Use an explicit allowed
  `toolNames` subset for 4K, or explicitly permit 8K. Nothing auto-escalates context.
  Token-aware selection/packing is required before production enablement.
- Existing gateway limits remain one generation, two queued, 15-second wait,
  40-second task deadline; generation retry/fallback behavior is unchanged.

## Verification

Automated tests use a loopback-only isolated MongoDB database with a required
`adrift_agent_tools_test_` name prefix. Fixtures include two owners, all
visibilities, a legacy absent intensity, Taipei/UTC year boundaries, long text,
and equal-timestamp paging. No production configuration is loaded.

```sh
AGENT_TOOLS_TEST_MONGO_URI=mongodb://127.0.0.1:27149/adrift_agent_tools_test_phase3 \
  node --test apps/api/tests/diary-tools*.test.js
```

`apps/api/scripts/verifyDiaryTools.mjs` is a manual acceptance harness, not a
production entry point. It requires a separate `adrift_agent_tools_test_smoke_`
database and explicit `AGENT_SMOKE_SSH_HOST`. It creates synthetic fixtures,
authenticates a local Express route with JWT, sends model requests by SSH to the
existing private acceptance adapter, and executes tools only against local test
MongoDB. Credentials never leave the remote host. It makes four selections and
four separately requested interpretations, sequentially, with no retry loop.
It removes only its own isolated database afterward and does not deploy code.

On 2026-10-30: 37 unit/mock tests and 29 real MongoDB integration tests passed;
the complete backend suite passed 195 tests (129 existing plus 66 new), and the
existing 19 Web tests passed. Web build passed with its pre-existing large-chunk
warning. No lint command/config exists; use syntax and whitespace checks without
calling them a lint pass.
The existing literal Taipei-regex assertion was upgraded to assert actual alias
matching and exclusion of New Taipei; its authorization/escaping checks remain.

Real Qwen3.5 4B smoke, four development cases, all four tools available at 8K:
selection 4/4, semantic arguments 4/4, backend execution 4/4, and structured
interpretation checks (count, supplied IDs, Chinese response) 4/4. First manual
review found a UTC/local-date error in one timeline summary; dates were made
explicitly +08:00 and the same cases were rerun. The corrected timeline said
January–October 2026. This is a development regression run, **not held-out model
accuracy** and not a general claim-correctness benchmark.

The final warm run used about 1.25–2.72 seconds per generation, 43–121 output
tokens, and one loaded 8K model. Reported model VRAM was 3,364,911,840 bytes;
`nvidia-smi` sampled 3,986 MiB total used. Queue returned to zero with no timeout
or recovery lock. No new concurrency/OOM stress was run in this phase.

No migration, new runtime environment variable, frontend change, production
provider switch, deployment, commit, or push is required/performed in this phase.
The two new environment variables above belong only to isolated test scripts.
