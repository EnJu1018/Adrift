# Memory Agent: Experimental Server Service

## Scope

`apps/api/src/services/memoryAgent.js` is an opt-in backend library. No production
route is mounted and the default Gemini provider is unchanged. Call it only after
the existing Express `requireAuth` middleware. There is no browser RPC to an
arbitrary tool, MongoDB operator, network request, or shell command.

The implementation deliberately uses deterministic routing for supported diary
intents rather than spending a GPU request on dates or arithmetic. The model
selects evidence from a bounded structured candidate set. The server renders the
answer from exact tool statistics and verified verbatim quotations. It does not
generate unrestricted narrative analysis, causal claims, diagnoses, or event
importance rankings. This conservative output is an initial grounding baseline,
not a completed semantic intelligence system.

## Execution

States: RECEIVED, UNDERSTANDING, PLANNING, EXECUTING_TOOLS, SYNTHESIZING,
VERIFYING, COMPLETED. Terminal alternatives are FAILED, CANCELLED, TIMED_OUT,
INSUFFICIENT_EVIDENCE. Trace entries record only actual state changes and calls.

- At most five tool calls, including additional evidence reads.
- At most one model inference; no recursive model-controlled loop.
- Whole-task deadline is 38 seconds, never greater than 40 seconds. Each provider
  request receives the remaining deadline and cancellation signal, not a fresh
  independent 40-second budget. The existing gateway queue is unchanged.
- Duplicate name/argument calls are reused, not rerun. Reaching a tool/token/time
  limit ends the task with an explicit terminal state and safe partial statistics.
- Input is at most 500 characters. Context defaults to 4K; 8K requires an explicit
  `allow8k`. No tools are supplied to the final model because routing is done by
  the server. The model cannot override the plan or call additional capabilities.

Mood analysis uses statistics, a filtered search and details. Detailed analysis
also retrieves an opposite chronological boundary, avoiding latest-only evidence.
Comparison uses two distinct statistic intervals, an evidence search for each,
and details, within five calls. A timeline task retrieves chronological candidates
and details; these are not asserted to be a complete list of important events.

Follow-ups reuse the shared Phase 1 structured query planner. Explicit time,
place and mood replacements preserve the previous intent. Evidence/impact
follow-ups retain the current scope but never claim a proven causal relationship.
Previous-year same-period comparison is calendar-day based through the tool's
custom-date contract, not a sub-day timestamp comparison.

City counts are computed from all aggregated stored location names, before
the ten-place output limit. Recognized explicit Taiwan city labels and four
existing English aliases are grouped; unknown locations remain unclassified.
This is not reverse geocoding or a claim to know the physical city from GPS.
No diary body text is used to infer cities.

## Conversations

The in-memory store has a ten-minute TTL and maximum 100 entries. IDs are random,
ownership is bound to the authenticated account, and overlapping turns in one
conversation are rejected. Successful turns update a version, structured intent,
range, location, mood, reference IDs, bounded answer summary and task state.
Raw diary bodies and full chat transcripts are not stored. Failed tasks do not
overwrite prior successful scope. A fresh authorized tool session is opened for
every turn; previous reference IDs never grant access or skip revalidation.

This store is process-local and is lost on restart. Multi-worker conversation
persistence and encryption-at-rest are not provided; do not enable across PM2
workers without an owner-scoped shared-store design. Clients cannot supply stored
state, owner IDs or version updates.

## Evidence And Answer Validation

`statistics` claims are copied from validated tool outputs. Period and mood
counts are rendered by backend code, not model arithmetic. `diary_quote` claims
contain an actual ID, Taipei date, exact character span and quote. Phase 3 checks
session membership, owner, revision, existence, and exact source text again after
inference. A source edited during inference fails verification.

Only these structured claims form the final answer. Unexpected response keys,
unknown IDs and invalid usage counters are rejected. Source text remains quoted
untrusted data, never executable instructions. This validates extractive claims;
it does not solve general free-text entailment or psychological interpretation.

Failure results preserve available numeric statistics but contain no unverified
final answer or citations. Errors and traces contain categories, task IDs, counts,
durations, states and usage, not diary text, secrets or hidden reasoning.

## Context Accounting

`agentContextBudget` separates system/user sections, tool definition size (zero
for synthesis), answer reserve and 1,024 framing reserve. It uses Phase 2's
conservative UTF-8 upper guard and checks real returned prompt/output token
counts against the selected context and total token cap. Only up to two
100-character evidence excerpts are offered to the model. Full-year diary text
is never packed into a prompt.

This is **not an exact preflight tokenizer**. The existing Ollama API supplies
actual token usage after inference; a model-matched tokenizer/template integration
is still required before claiming precise preflight counts or efficiently packing
larger contexts. The service rejects overflow rather than silently increasing
context. No paid/cloud fallback is used.

## Tests And Benchmark

`memory-agent.test.js` covers bounded execution, multi-turn replacements,
conversation ownership/TTL/concurrency, errors, cancellation, deadlines, invalid
model output, token bounds and safe partial results. The isolated Mongo suite
also verifies real owner queries, comparison counts, multi-turn data, stale
evidence and city counts. Existing Phase 1–3 suites remain required.

`benchmarkMemoryAgent.mjs` requires a dedicated loopback MongoDB database named
`adrift_agent_benchmark_test_*`; it never loads the production database environment.
`--gpu` uses the existing private VPS acceptance adapter via SSH. Credentials stay
remote. The synthetic corpus manifest/hash is printed before execution.

The 100 development cases combine time/location/mood requests. A second
`--holdout` corpus uses frozen alternate wording; run it only once before further
tuning. It shares the synthetic distribution and is **not** a broad semantic
benchmark. The rubric checks complete task state, exact fixture counts, source
membership, tool limit and deadline, not merely tool selection. The four-turn
regression expects counts `[2,4,1,0]`.

The original twelve full tasks and their scoring rules were not found locally;
they are explicitly reported as unavailable, not replaced with invented questions.
Therefore no original 11/12 or broad multi-turn 95% acceptance claim is warranted.
The scorer's small four-turn regression is not a multi-turn success-rate estimate.

Examples:

```sh
AGENT_ORCHESTRATOR_TEST_MONGO_URI=mongodb://127.0.0.1:27149/adrift_agent_orchestrator_test_phase4 \
  node --test apps/api/tests/memory-agent*.test.js

AGENT_BENCHMARK_MONGO_URI=mongodb://127.0.0.1:27149/adrift_agent_benchmark_test_phase4 \
AGENT_SMOKE_SSH_HOST=your-acceptance-host \
  node apps/api/scripts/benchmarkMemoryAgent.mjs --gpu --holdout
```

No migration or new production environment variables are required. All environment
variables above are for isolated tests. No production deployment, provider change,
commit, push, firewall change, iOS or NAVI operation belongs to this phase.

## 2026-10-31 Verification Record

- Original 195 tests plus 24 new tests: 219/219 backend passes, no skips.
  New tests comprise 19 unit/mock cases and five isolated real MongoDB cases.
- Existing Web tests: 19/19. Web build passed with the existing large-chunk warning.
  There is no lint configuration; syntax and whitespace checks passed, not a lint run.
- Development GPU corpus: 100/100, mean 1823.05 ms, P95 2613 ms.
  Manifest SHA-256: `19b8321bc13aef82922bd8621131225a36411d86f109791086b5caae48336af2`.
- Alternate-wording first-pass GPU corpus: 100/100, mean 1851.54 ms, P95 2596 ms.
  Manifest SHA-256: `4d079657dfbe46c83fe4e9b5f2ef7ad0021812c5890417d55bb9f748b70b8e37`.
  These are complete extractive/statistical flows, not unrestricted event-analysis
  or claim-entailment benchmarks. Both use the same narrow synthetic distribution.
- Four-turn GPU regression produced `[2,4,1,0]`. No broad multi-turn percentage
  or original twelve-question score is available.
- The first cold 4K smoke took 23.15 seconds; warm cases were around 2–3 seconds.
  Thus mean/P95 from warm corpus runs are not a cold-start service-level guarantee.
- At the end of the 4K runs the model reported 3,140,495,604 VRAM bytes;
  `nvidia-smi` sampled 3,778 MiB total used. Queue returned to zero, no timeout,
  circuit opening or recovery lock. No concurrent/OOM stress was added.

The initial GPU harness accidentally serialized AbortSignal into `{}`, causing
adapter-side rejections before inference (zero gateway submissions). This was
fixed in the SSH test transport. Those runs are not model-quality measurements.
The initial development-only routing check also revealed happy-memory filtering
being cleared by the legacy trend parser; it was fixed before the alternate corpus.
Independent code review then pinned the task clock to prevent milliseconds between
planner and filter evaluation from turning rolling ranges into calendar-day ranges;
that safety change has its own test. The corpus uses a fixed clock, so it does not
replace the advancing-clock test. Later source hardening is covered by final tests
and a separate latest-version smoke, not by claiming a rerun of held-out questions.

Remaining acceptance gaps: original twelve tasks/rubric, a broad independent
semantic dataset, broad multi-turn reliability, exact preflight tokenization, and
meaningful event/causal interpretation beyond selected verbatim excerpts. Do not
enable this experimental library in production or present these narrow scores as
full Agent acceptance. Phase 5 has not been started.

Latest-version 8K smoke: 4/4 plus the four-turn regression passed; seven real
inferences, mean 3207.5 ms and P95 6320 ms across the four cases (including context
reload). Final health confirmed 8192 context and 3,364,911,840 model VRAM bytes,
zero queue and no timeout/recovery lock. Source SHA-256:
`1b7b4f8ba616e7ff03bd45b25658fc3f161ef5af28247ccf1aad88c142578761`.
8K manifest: `3e5e329f7e47693f06fbd6918d3499a222a8e06634e0f0e00fb6e11a599c39f9`.
The harness now emits source hash and the actual selected context in its manifest.
