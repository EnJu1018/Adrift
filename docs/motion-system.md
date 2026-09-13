# Motion System

## Foundation

`apps/web/src/lib/motion/tokens.js` owns the shared duration, distance,
scale and easing values. Vite's existing PostCSS pipeline expands
`@motion-tokens` in `styles.css` into static CSS custom properties.
There is no runtime style injection or additional dependency.

| Intent | Duration | Use |
| --- | --- | --- |
| Stagger | 40ms, capped at 240ms | First reveal; no exit delay |
| Intent delay | 80ms | Brief intentional pauses |
| Micro feedback / close | 150ms | Press, dismiss, small state changes |
| UI / open | 250ms | Page content and modal entry |
| Surface | 350-400ms | Toasts and panels |
| Content reveal | 500ms | Infrequent first-view reveal |
| Brand | 1650ms drawing; 22-32s paths | Existing presentation SVG |

Use smooth-out `(0.22, 1, 0.36, 1)` for entry, accelerated exit
`(0.4, 0, 1, 1)` for dismissal and linear timing for paths. The existing
`constants/animations.js` exports remain the interface for current consumers.
Modal and dropdown exits override entry timing. List exits never inherit stagger.

CSS utilities are limited to those currently used:

- `motion-fade-in`: opacity entry.
- `motion-fade-up`: opacity and 12px content entry.
- `motion-soft-press`: independent 0.99 scale; disabled controls excluded;
  visible keyboard outline.
- `motion-card-hover`: restrained border feedback on fine pointers.

Passive information does not lift on hover. Individual control placement,
surface styling and progressive disclosure are reviewed during the page phases.
Do not apply entry utilities to Mapbox anchors, page layout roots or slide roots.
Use the existing Framer presence presets for mounted surfaces rather than a
second CSS lifecycle on the same element.

## Runtime Ownership

`animeMotion.js` is the only direct Anime.js importer. It controls the existing
presentation SVG descendants: line drawing, dash flow and moving dots.
Native scopes restore styles and remove media listeners on cleanup, including
StrictMode's setup/cleanup/setup cycle. The scope refreshes when reduced motion
changes; the reduced branch creates no animations. Stationary map nodes remain
visible. The decorative root itself is not animated.

Framer's application-level `MotionConfig` follows the OS preference. Shared
list/reveal factories also remove stagger and initial entry under reduced
motion. The existing application performance hook causes consumers to update
when the preference changes. Global CSS removes delay, repeated animation and
smooth scrolling. Existing marker-specific reduced-motion rules remain intact.

## Audit: Phase 1-2

Baseline: 22 CSS keyframe definitions, 48 transition declarations in the main
stylesheet, 21 Framer import sites, one Anime.js import site. Twenty-six JS/JSX
files contain motion, timer or frame-related code; these are source counts,
not counts of simultaneously running animations.

Removed 11 keyframes:
`adriftMotionScaleSoft`, `adriftMotionSlidePanel`, `adriftMotionTooltipIn`,
`adriftMotionToastIn`, `adriftMotionShimmer`, `adriftMotionLineDraw`,
`successGlow`, `gradientDrift`, `authFloat`, `lifeMapBreath`, `presentationStars`.
The first six belonged to unused alternate CSS utilities. The local breathing
variant now uses the shared pulse; positioning-specific presentation breathing
remains separate. Eleven referenced keyframes remain.

Also removed the global canvas particle component and its frame/resize loop,
unused utility aliases, background drift/star motion, animated success shadows,
the unused `.mapbox-marker` rule and app-layout entrance from both CSS and React.
All removed source remains recoverable through Git.

| Finding | Resolution / next phase |
| --- | --- |
| CSS and JS independently maintained timing | One token source, emitted CSS verified in browser |
| List exit inherited up to 480ms entry delay | Entry capped at 240ms; immediate exit scheduling |
| CSS hover transform competed with Framer content transform | Shared hover now changes border; press uses independent scale |
| Global layout animated around map/panels | Static layout root; geographic anchors remain untouched |
| Presentation `SlideSection` used an unimported `pageFadeUp` | Static slide section fixes runtime failure and root motion |
| Anime only checked reduced motion on mount | Native scope handles live preference changes and cleanup |
| Settings section and each data row share hover/card treatment | Phase 3/6: distinguish editable actions from passive values |
| Settings sidebar and sections use glass; Auth uses modal motion on a page | Page phases: reduce competing surfaces and use context-appropriate entry |
| Diary/avatar/delete surfaces lack dialog semantics and focus management | Phase 3: shared native modal semantics, background inertness, Escape and focus return |
| Presentation SVG initializes while slide 6 is offscreen | Phase 7: start/pause by active slide; preserve index-driven track |
| Open SVG paths loop back to their starts; longest dot takes 32s | Phase 7: continuous closed route or endpoint fade, target 18-30s |
| Some page-specific hover, repainting skeleton and progress-width transitions remain | Later page phases: migrate after checking consumers and hit areas |

This is the foundation pass, not a claim that the full UI/accessibility or
all-page motion redesign is complete. Map fallback controls remain separate
from Mapbox anchors and must be reviewed as a distinct interaction.

## Shared Surfaces: Phase 3

`components/ui/Modal.jsx` keeps native `dialog.showModal()` semantics while
Framer manages presence. Close runs during layout cleanup, before React removes
the element, so the browser can restore focus to the opener. The background is
inert; Escape respects pending operations. Backdrop clicks do not discard forms.
The backdrop only fades; the content scales from 0.98 over 250ms, then exits in
150ms. Exiting content becomes inert. Reduced motion removes scale and duration.

Consumers: diary create/edit, avatar crop, account deletion, friend deletion,
admin user deletion and admin diary details. Form payloads and upload/crop logic
are unchanged. Failed destructive operations remain visible as contextual alerts
inside the dialog instead of relying on a toast below the native top layer.

The shared Select opens in 250ms and closes in 150ms. Its portal stays inside
the containing dialog when present. Opening focuses the selected enabled option;
arrows, Home/End, Enter, Escape and Tab preserve keyboard access. Escape closes
the list before the containing modal. Exiting menus are inert, and options have
44px targets. No custom focus-trap library or overlay manager was added.

`components/ui/Tooltip.jsx` provides a single CSS opacity/scale tooltip with an
80ms intent delay, keyboard focus and Escape dismissal. It is absolutely
positioned, associated through `aria-describedby`, and replaces native titles
on diary reaction controls. Marker tooltips remain separate and unchanged.
Toast exits use 250ms and the dismiss target is 44px. Basic UI uses CSS/shared
Framer presets, not Anime.js; Anime remains limited to brand SVG motion.

Remaining page-specific menus, hover treatment and information hierarchy belong
to the later page passes. These shared changes do not claim full avatar, admin
or backend end-to-end coverage.

## Landing and Auth: Phase 4

Landing no longer animates its page root or combines section and child entrances
on the same cards. Hero copy uses a single 500ms CSS reveal, 40ms offsets capped
at 200ms; keyboard interaction cancels that reveal immediately. Passive callouts
do not lift on hover. Section shells are unframed, with detail framing reserved
for repeated items. Product copy, public links and SEO metadata are unchanged.

`createMapVisualMotion` is the shared SVG entry point; the presentation export
remains an alias for existing consumers. Landing contours draw over 1650ms;
two dots follow a fixed closed route over 22/28s, with a 12s dashed path cycle.
The closed route avoids end-to-start teleporting. The component reverts its
scope offscreen, on document hiding and on unmount; reduced motion leaves the
four static memory nodes visible. Removed `landingPathFlow`, `landingNodeBreath`
and the inactive Auth light elements/styles. Ordinary UI still uses CSS/Framer.

Auth retains the email-first API flow and at most two fields per step. The
header, selected email, fields and actions now move as one step: 8px directional
entry over 250ms, exit over 150ms, no scale/blur or page-root motion. Presence
disables outgoing fields. Card origin stays stable without reserving a large
blank form area. Back retains data; changing email clears passwords as before.

First validation happens on submit, then updates while editing. This prevents
initial blur errors from shifting the submit button during its pointer click.
Invalid fields receive focus and linked error descriptions. Request guards
block duplicate submits; non-field failures remain inline alerts. Password
visibility controls have 44px targets, theme-aware contrast and pressed state.
No authentication endpoint, JWT/session persistence or iOS code changed.

## Map experience: Phase 5

Map and detail surfaces remain static; only detail content fades between records
(250ms in, 150ms out). Outgoing detail controls become inert immediately so a
stale edit, delete or reaction cannot be triggered during selection changes.
The existing diary modal, photo and speech workflows retain their shared modal
transition and submission behavior.

Geographic groups, marker registry instances and Mapbox positioning are unchanged.
Marker feedback is limited to inner visuals: 1.04 hover, 1.08 selection, a static
focus ring and no default perpetual animation. Tooltips share one active owner,
wait 80ms for pointer intent, appear immediately on keyboard focus and dismiss
on Escape, selection or camera movement. Touch pointer entry does not summon
a tooltip. Exiting tooltips cannot overlap the next tooltip.

Stack arcs retain screen-space offsets and use 350ms entry, 40ms stagger and
250ms exit; reduced motion renders the final layout without travel. The bounded
arc/list strategy, true coordinates and keyboard selection are preserved.
List containment offsets update on camera frames as well as layout changes;
only its opacity/scale animate, so it does not slide outside its safe viewport.
Arcs keep fixed offsets during the gesture; a list never becomes an arc mid-gesture.
Map controls have 44px targets and focus outlines. Loading is a compact status
surface instead of a map-sized blurred skeleton. Camera focus uses 500ms;
reduced motion stops an in-flight camera animation and skips subsequent travel.
Focus synchronizes the map's dimensions before calculating camera offsets.

Fallback-map anchors no longer mix a Framer transform with CSS centering. They
stay fixed while only inner visuals respond to selection/hover. Shared coordinate
normalization skips invalid records. Removed perpetual grid travel, duplicate
halo waves and the now-unused `mapCurrent` / `markerHalo` keyframes. The fallback
is still a schematic map, not a replacement for the Mapbox grouping experience.
No Anime.js integration is needed for these ordinary UI transitions.

## Product workspaces: Phase 6

Friends, Feed, settings and administration no longer animate their page roots.
Search results, invitation tabs, admin tabs and diary detail content share an
opacity-only content transition: 250ms entry, 150ms exit, inert outgoing controls.
Feed and friend discovery retain bounded item reveals without another entrance
on their parent surface. Feed keyboard activation prevents Space from scrolling;
filter changes keep surviving keyed cards mounted.

Settings retain inline editing, focus the current input and return focus to its
edit action after save/cancel. Sections use a short fade rather than a moving
container; passive rows no longer lift. Busy saves prevent cancellation. Avatar
upload, crop and account operations retain the existing shared modal and APIs.

Admin role editing reuses the shared Select keyboard, positioning and exit
behavior. A busy Select preserves focus while blocking interaction. The actual
disabled state is still native. Normalized user IDs fix an older self-account
comparison that treated absent legacy IDs as equal. Tabs expose selection and
44px targets; bright-mode text fill no longer overrides their readable ink.
Removed the replaced role menu styles.

Intelligence uses one finite Anime.js reveal over four result groups, with
400ms duration, 40ms stagger and 6px travel. Scope cleanup restores inline styles
on unmount and live reduced-motion changes. Removed the orbit/glow decoration,
passive card hover effects, nested result entrances and simulated rotating
progress text. Loading reports only the actual request state. Duplicate request
protection covers the outgoing result's transition. Hero sizing no longer clips
its actions; its title overrides the unrelated global 250px heading constraint.

## Presentation: Phase 7

Slides keep index-driven navigation and fixed viewport-sized sections. Only the
active slide's inner content fades in; slide roots and brand marks do not animate.
Inactive slides are inert, hidden from accessibility navigation and pause their
CSS animations. Moving away from a focused slide returns focus to the deck.
Progress animates scale rather than width. Wheel input normalizes line/page units,
uses a non-passive listener and allows overflowing slide content to scroll first.
Touch scrolling remains native for overflowing slides.

The sixth slide's scoped SVG motion only runs while that slide and the document
are visible. Closed paths prevent loop-end position jumps; dots take 22, 28 and
30 seconds, with 12/14-second path flow. Leaving the slide, reduced motion and
unmount all revert the scope. Removed simultaneous per-card entrances, passive
goal-card hover lift, logo breathing and the unused skeletonSweep keyframe.
Print resets the translated track and disables content animation.

Mobile QA also corrected late desktop grid rules overriding the cover and
Intelligence layouts, and a long architecture label overflowing its column.

## Verification

- Production build passes; existing large-bundle warning remains.
- Ten marker unit tests pass.
- `tests/marker-browser.mjs` covers stable anchors, projection, grouping,
  expansion, keyboard, CRUD, list/detail/camera sync, themes and mobile layout.
  Additional regressions cover tooltip Escape, inert exiting choices/detail,
  44px controls, live reduced-motion camera interruption, mobile list containment
  and fallback-map centering through hover and selection.
- `tests/motion-browser.mjs` covers CSS/JS token agreement, both themes,
  presentation first/last boundaries, path movement, initial/live reduced
  motion, cleanup/remount and bounded stagger. It visits all 20 slides at
  1366/1440/1920/390px, checks active positioning, fixed height, horizontal
  containment and scroll origin, inactive-slide isolation, closed paths,
  off-slide cleanup, both Demo URLs and the print track reset.
- `tests/surface-browser.mjs` mounts production components in StrictMode with
  local data. It checks native modal/background focus isolation and focus return,
  busy Escape, Select keyboard/portal behavior, real diary form payloads,
  modal errors, toast dismissal, non-layout tooltip entry, dark/bright,
  390px mobile overflow and reduced motion. No production data is written.
- `tests/entry-browser.mjs` verifies landing animation lifecycle (including a
  synthetic visibility event), path/reduced-motion behavior and the real Auth
  CTA route. Isolated Auth components cover both flows, duplicate checks,
  validation/focus, back/data retention and 320/390px layouts. Email responses
  and final authentication are mocked; no account is created or signed in.
- Browser checks run in local macOS Chrome. Windows, Edge, Safari and real
  mobile hardware have not been directly tested.
- `tests/workspace-browser.mjs` covers Feed keyboard/filter identity, settings
  save/cancel focus, inert invitation exits, owner/self role restrictions and
  Select keyboard/busy focus, Intelligence request deduplication, finite reveal
  and initial/live reduced motion. API responses are local stubs; no production
  account is changed. It also captures dark/bright 1440px and 390px layouts and
  checks scroll containment, content height and unclipped Intelligence actions.
- No lint script/configuration exists in the web package; build is not a
  substitute for lint. The presentation runtime failure was found by browser QA.

Run browser checks against the Vite server with `PLAYWRIGHT_MODULE` set to an
installed Playwright module when it is not installed in the project.

## Final regression: Phase 8

The five browser checks and ten marker unit checks pass together with the web
production build and diff whitespace check. Presentation also tests line-mode
wheel input, pinch-zoom exclusion and native scrolling of overflowing content.
At 500 fixture markers, grouping measured 4.4ms median and frame intervals were
16.7ms median / 18.6ms P95 in local Chrome; this is not a real-device FPS guarantee.
Existing bundle-size warnings and the missing lint configuration remain visible
limitations. No API, iOS, authentication contract or SEO metadata changes are
required for this motion release.
