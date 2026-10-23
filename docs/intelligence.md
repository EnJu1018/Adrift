# Adrift Intelligence Interface

The website keeps two independent modes under one page header:

- **Insights**: observed journal statistics, emotional intensity, recorded places
  and a separately requested life review.
- **Memory Chat**: a focused conversation with references to authorized diaries.

Both mode subtrees remain mounted while switching tabs. Their state stays in the
existing signed-in App state, not persistent browser storage. Logout clears it.
Only the active panel is visible and focusable. Editing a question, reading a
result or changing the statistical period does not automatically call Gemini.

## Observed Statistics

`GET /api/ai/overview?days=30` accepts only `7`, `30` or `90`. JWT identity is the
only ownership input. A single bounded-time MongoDB aggregation returns counts,
mood distribution, Taipei-calendar daily intensity aggregates and the top five
named places. This is read-only and neither calls Gemini nor reserves generation
quota. Missing or invalid intensity values are excluded from intensity averages.
The existing authenticated read limiter allows 60 statistics requests per user
per minute, independently of the six-request generation/chat window. Like the
other process-local read limits, it requires shared storage before multi-worker
scaling.

The date interval is a rolling period ending at the server's response time. All
matching owned diaries are counted, including private records; there is no
recent-record sampling cap for statistics. Daily series are grouped into at most
five readable chart bins. Intensity means strength of a feeling, not positivity
or wellbeing. Empty bins remain empty rather than becoming zero or interpolated
values. Bin averages are weighted by the number of valid recorded intensities.

Place names use the existing Taiwan-name normalizer. A place row opens the most
recent matching diary through the existing authorized detail endpoint; it does
not guess a location from generated text. API failures retain existing statistics,
and range changes abort stale requests. The displayed range always belongs to
the data, including when older statistics are retained during a refresh.

## Generated Review

The existing `GET /api/ai/life-map`, model integration, scope guard, rate limits
and daily quotas are unchanged. It reviews at most the latest forty diary
excerpts. This scope is explicitly separate from the statistical date filter.
Previous successful content remains available during refresh or failure.
Progressive sections present the conclusion, emotional/place observations and
optional next steps. They are not claims about unrecorded life or diagnoses.

## Conversation

The existing `POST /api/ai/chat` protocol and retrieval boundaries are unchanged.
Suggestions send a question; an Insights exploration link instead prepares an
editable question containing the selected period or place. Enter, Shift+Enter,
IME composition, retry, cancellation and source authorization are preserved.

User messages align right. Assistant responses use a reading column with safe
React-rendered paragraphs, headings, lists, bold and inline code. Model text never
becomes raw HTML. Related memories are a distinct compact list. A 403/404 while
opening a reference replaces its stale title and metadata with an unavailable
state. The composer discloses that relevant excerpts go to Gemini.

Desktop conversation width is capped at 820px. Only the transcript scrolls; the
composer remains in the page's flex layout. Visual-viewport resizing reserves
space for mobile keyboards, and compact viewports hide secondary headers.
Readers who scroll upward are not pulled to the bottom by new answers; a latest
reply action returns them there. A new conversation cancels outstanding requests.

## Motion and Verification

Tabs use the shared 250ms surface timing; messages and state changes use existing
fade tokens. The existing scoped Anime.js reveal runs only on the first review
result, with cleanup and reduced-motion support. Refresh does not recreate or
reanimate the result container. No Mapbox positioning or slide navigation changes
are involved.

```sh
INTELLIGENCE_TEST_MONGO_URI='mongodb://127.0.0.1:27129/adrift_intelligence_test_ui?replicaSet=social-test' node --test apps/api/tests/intelligence-overview.test.js
node --test apps/web/src/components/intelligence/insightData.test.js
node apps/web/tests/intelligence-browser.mjs
BROWSER=webkit node apps/web/tests/intelligence-browser.mjs
node apps/web/tests/memory-chat-browser.mjs
node apps/web/tests/workspace-browser.mjs
```

Database integration tests refuse non-loopback connections or names without the
`adrift_intelligence_test_` prefix, and drop only that disposable database.
Browser tests use isolated API fixtures with the actual UI. They cover 320, 390,
768, 1024, 1440 and 1920px, both themes, reduced motion, range races, failed refresh,
cancel/remount, references, safe Markdown and a keyboard-sized viewport. Physical
phone keyboards, VoiceOver and Windows hardware still require device QA.
