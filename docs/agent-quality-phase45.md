# Agent Quality Qualification — Phase 4.5

## Historical Baselines And Recovery

Phase 4 engineering baselines remain historical: 219 backend tests, 19 Web tests,
100/100 development cases and 100/100 alternate-wording cases. These were narrow
statistical/extractive checks, not semantic accuracy.

Original material was recovered read-only from
`/home/enju1018/.local/share/ollama-model-eval/` on the Ubuntu host. The Mac Desktop
and Downloads search found no separate delivery copy; broader home search met
macOS privacy denials and cannot establish absence. The original Ubuntu directory
was not changed. Its complete delivery zip was retained outside the repository:

`/Users/chenenju/.codex/visualizations/2026/05/15/019e2af1-be54-7783-9686-944972ab798b/adrift-original-model-evaluation.zip`

The extracted copy is `/tmp/adrift-phase45-archive/ollama-formal-evaluation`.
All 372 entries in MANIFEST.json and all four rubric-freeze hashes matched.
Recovered: twelve questions, gold tools/arguments, synthetic diaries, canonical
requests, rubric, evaluator, freeze time, tools.csv, source audit and all records.

Frozen SHA-256:

| File | Hash |
| --- | --- |
| fixtures.json | 5aac2113ea27b6058eb2b76a3233ca51b1ca8d5933f1e7f2f3a78dc59e76512f |
| RUBRIC.md | 01c8ee4de099079ef583fa99877c35b50ce0d3ad1ef40f6bb1aa442e8641c7e1 |
| evaluate.py | bbf3b43166511fe6f09866171603265d40db9103adcffd1aacfcb00655017f45 |
| canonical.json | 51aab45dc9d2a19ba94f09cf9ecd5a1bd45155c417266d7c9655a813530a65d0 |

Qwen historical recorded v1 score is selection 12/12, exact arguments 12/12,
strict 3/12. This was reconstructed from verified original records, not a new v1
inference run. Inspection confirms strict statistics equality also applied to
non-statistical tools (which expected an empty object). Do not silently change
that rule, or explain away genuine failures such as T03/T06 grounding/truncation.

## v2 Compatibility Contract

`qualifyMemoryAgent.mjs` runs the original questions against isolated real MongoDB
and the actual Orchestrator; it does not force the gold tool selection. Adaptations:
short Dxx IDs become deterministic ObjectIds (question wording otherwise unchanged),
legacy emotions map to the supported enum, and missing intensity is explicitly
synthetic 3. Tired/angry map to `other`, so emotion-label scores are not directly
comparable to v1. The fixed reference clock is 2026-10-30 Taipei end-of-day.

The first v2 rule required all expected source IDs, exact spans, required keyword
groups, absence of forbidden phrases and the right terminal state. This gave
7/12 original tasks and 5/20 original semantic cases, both with and without GPU.
It had a false-positive hole: T09/T11 could clarify without querying and still
pass as empty results. v2.1 adds **actual successful/empty tool completion** and
an independent count check for statistical tasks. Offline regrading the retained
trace lowers the twelve-task result to **5/12**. This is a stricter functional
score, not an apples-to-apples improvement over historical 3/12.

The original raw runs are retained unchanged outside Git in
`adrift-phase45-baseline-4k.jsonl` and `adrift-phase45-acceptance-8k.jsonl` alongside
the original archive. Their summary field uses the initial permissive rule;
the 5/12 execution-required result is an explicitly separate regrade. Future
script runs emit `rubricVersion: 2.1-execution-required`.

## Representative Semantic Checks

The original twenty Adrift cases exercise single entries, time trends, half-year
review, location, missing information and evidence coverage. The additional frozen
eight-case acceptance fixture adds negation, contradictory corrections, long-tail
content, duplicate event references, uncertain emotion, unsupported causality,
prompt injection and missing dates. Its first real 8K run gave **7/8 rule passes**.
The long-text case H03 failed because its important ending lies beyond the
100-character model/excerpt window. No tuning was applied to that acceptance set.

These scores are not a semantic-understanding estimate. The evaluator explicitly
leaves independent review pending. Exact quotations can contain an answer without
the Agent actually integrating it. For example, H04 quotes the same event twice
but does not explicitly compute unique events; treat it as partial understanding
in human review, despite the keyword/source rule pass. H02 retrieves contradictory
entries but does not synthesize a resolution. Correct source IDs are not entailment.

Claim labels are exposed by `agentQuality.js`: SUPPORTED_FACT, SUPPORTED_INFERENCE,
INSUFFICIENT_EVIDENCE, CONTRADICTED_CLAIM, UNSUPPORTED_CLAIM. Automatic verification
only grants SUPPORTED_FACT for exact extractive spans. Aggregate claims require
an independent numerical oracle, and free inference is not automatically approved.
Contradiction and supported inference require independent semantic adjudication;
the presence of an enum is not a claim that this capability has been solved.

## Multi-turn Findings

Two groups contain nine explicitly scored turns. Before the location fix: 6/9
turns; neither full dialogue passed. After the fix: 8/9 turns and one of two whole
dialogues passed. **No 95% reliability claim is justified.**

The remaining failed turn, “那去年同期呢？”, has an underspecified gold: it expects
both current and prior counts, but a reasonable answer could give only the prior
period. The actual planner also switches to the entire prior calendar year, rather
than the same interval. These are separate issues. Preserve the initial score,
clarify the comparison-vs-replacement expectation and add date-boundary assertions
before treating it as a reliable acceptance case. Zero rows in both ranges must
not hide wrong date selection. Likewise, zero-result turns cannot prove that a
city filter was applied; direct filter assertions are retained in unit tests.

Fixed engineering defects:

- `只看臺中` previously overwrote the parsed city with the old city.
- Elliptical non-city location follow-ups such as `那書店呢` lost the location.
  The fix supports bounded literal place follow-ups, not a special gold-only route.
- Scope clarification previously omitted terminal task events and duration metrics.
- Model completion events now include measured model wall duration, provider
  duration when available and a nullable queue-wait field. Null is not zero.

Still exposed: explicit-ID intent routing, explicit timeline-tool phrasing being
treated as out of scope, missing middle-event coverage, unresolved contradictions,
event deduplication and source-quote selection instead of genuine semantic answers.

## Performance And Context Limits

Real 4K run: 19 cases had an execution duration, mean 2313.42 ms, P95 5741 ms.
Real 8K case run: 27 cases had an execution duration, mean 2337.52 ms, P95 3324 ms.
These subsets exclude scope clarifications whose old result contract had no usage
field. They include tool retrieval, local verification, SSH test transport and
model wait; they **exclude browser/network UI and Express JWT lookup**. They are
not a full production latency SLO. The first 8K case took 7106 ms with context
loading. Multi-turn calls in that harness defaulted back to 4K; do not call the
entire run 8K. Long output generation is not exercised: the current model only
selects IDs under a 128-token cap; the backend renders the answer.

At sampling time Ubuntu RAM used 959 MiB, available 10386 MiB, swap 0 MiB, and
GPU used 14 MiB before model loading. These are point samples, not peak resource
measurements. End health reported one 4K model using 3,140,495,604 VRAM bytes,
zero active/queued work, closed circuit and no timeouts. Dedicated queue-wait,
steady-state RAM/VRAM peaks, controlled cold unload, long-output stress, and real
offline/cancellation stress were **not newly verified**. Existing mock safety
coverage is not substituted for those real tests. The 38-second deadline remains.

The installed Ollama `/api/tokenize` probe returned 404 using synthetic text.
Retain the safe byte upper guard and actual post-inference token counters;
no exact model/template-matched preflight tokenizer was installed or claimed.
Official usage metrics: https://github.com/ollama/ollama/blob/main/docs/api/usage.mdx

## Readiness

Preserve the existing Orchestrator. Phase 4 engineering work still needs explicit
ID/timeline routing, unambiguous same-period semantics and stronger benchmark
assertions. Phase 5 should address bounded event extraction, cross-entry event
identity, contradiction/negation handling, long-text/hierarchical memory selection
and structured claim-to-evidence verification. Phase 7 risks include process-local
conversations, exact capacity/queue telemetry, cold/stress/SLO measurement and
preflight tokenization. None requires replacing the current architecture.

Proceed to Phase 5 only as explicitly scoped semantic development after approval,
not because product quality passed. Phase 4.5 is not full launch readiness.

No migration, dependency, production provider switch, deployment, commit/push,
firewall change, iOS/NAVI operation or production data mutation was performed.
