# Marker System

## Visual direction

Layered Memory Node is the single production visual: a small, asymmetric rounded
memory tile, a neutral surface, a restrained mood accent and a distinct stack.
There are no continuously animated markers. Keyboard focus and a single
title/mood/time tooltip are part of the visual component. The three-way
comparison prototype, its stylesheet and its development route were removed.

## Phases 3-4: unified diary markers and stacks

All zoom levels now use Layered Memory Node. `DiaryMarkerLayer` renders React
portals into stable, 48px Mapbox-owned anchors keyed by geographic group. The
registry only creates missing keys, updates real coordinate changes and removes
absent groups. Projected groups merge below 56px spacing, after camera movement
ends. Absorbed anchors remain hidden, so zooming back in restores the same nodes.
Geographic grouping runs only when diary data changes, never on hover or theme.

The old GeoJSON diary layers, DOM factories, innerHTML stack renderer and Mapbox
popups are removed. Current-location layers remain independent and unchanged.
One tooltip component provides title, mood and time; a shared active tooltip ID
prevents keyboard focus and pointer hover from showing two previews at once.
Approximate diary locations retain a dashed outline, without implying precision.

One expanded group is active at a time. Repeated trigger clicks, map background
clicks and Escape close it; Escape restores focus. Keyboard opening focuses the
selected entry or first entry, with arrow/Home/End navigation. External selection
opens its group once per selection ID/token, without reopening a dismissed group
on theme updates. Deleted/filtered groups close; a remaining singleton becomes
an ordinary marker. React keys preserve list scroll and child identity.

2-6 diaries expand in a 120-180 degree arc with at least 60px between centers.
7+ use a bounded scrolling list. Both avoid actual panel/control bounds where
room exists. A small viewport falls back to a list rather than cramped targets.
The list prefers not to cover its trigger and shortens to available space above
mobile detail sheets. Its close control remains accessible when space is too
small to avoid the trigger. The overlay is a body portal anchored
using map.project(), with screen offsets only, never edited diary coordinates.
Open transitions use the existing 220ms token and 40ms per-item stagger (420ms
maximum for six items); close is 140ms with no stagger. Exiting items are inert.
Both the OS reduced-motion setting and the application preference are honored.

## Phases 5-6: selection, camera and themes

App feeds the same filtered collection to the map and right diary list. Selected
details refresh from that collection; deleting/filtering the selected record
clears it. Coordinate parsing is shared by markers, list focus and details.
The right list scrolls its own container to the selected row, without scrolling
the page or stealing keyboard focus. Sorting uses creation time with ID ties.

List selection uses easeTo with the geographic group's retained center. It keeps
the current zoom above level 12, rather than flying to level 15 on every click.
The camera offset uses the largest unobstructed area after excluding actual
panel/control rectangles. Clicking a visible marker or expanded child updates
selection without moving the camera. Camera controls respect reduced motion.
External selection tracks the selected geographic member through screen-cluster
splits, rather than the old cluster representative. A dismissed stack stays
dismissed until another explicit selection. Fan offsets remain fixed during
camera gestures, then are recalculated after movement/resize.

Mobile details are a bounded bottom sheet. Empty details and unnecessary empty
photo frames no longer cover the map. Map controls move above an open sheet;
the map creates its own stacking context so controls cannot cover its close
button. Expansion lists scroll within the remaining map space.

Bright uses Mapbox light-v11, white glass, teal edges and a contrasting focus
ring. Dark uses dark-v11, restrained cool edges and a dark glass surface. Mood
is only a small accent, not a full-color pin. POI icons are reduced to 35%
opacity; POI text is 58%/65% for bright/dark. Roads, place names, transit and
airports remain visible. These styles are versioned Mapbox styles, not a CSS
filter applied over map tiles.

Theme changes call setStyle with diff disabled: style.load reliably restores
current-location sources/layers with the latest location data. Mapbox's default
incremental style diff could remove those custom layers without that load event.
The map instance, DOM marker instances, selection and expanded stack survive.

## Ownership

- `markerGeometry`: validate coordinate pairs and form geographic groups.
- `DiaryMarkerVisual`: inner visuals and interaction callbacks only.
- `DiaryMarkerTooltip`: one shared text format, outside normal layout.
- `DiaryMarkerLayer` / `diaryMarkerRegistry`: retain geographic anchors by key
  and resolve current diary data by ID. Only Mapbox writes anchor transforms.
- `markerLayout` / `DiaryStackExpansion`: one expanded key, screen-space collision groups,
  bounded arc/list placement, close behavior and keyboard focus restoration.
- App integration: shared selection ID, current diary lookup, list
  scrolling and a camera target computed with actual panel bounds.

## Geographic groups

`{ groupKey, anchorId, center: { lng, lat }, diaries, count, isStack }`

Normalize entire coordinate pairs, never combine fields from unrelated formats.
Reject empty, nonnumeric and out-of-range coordinates; do not guess reversed
coordinates. Legacy reversed records require a separate verified migration.
Original diary data is never changed.

20m adjacency forms connected components: if A-B and B-C are within 20m,
all three belong together even when A-C exceeds 20m. Long chains can therefore
produce geographically wide groups; this is an intentional adjacency rule.
The initial representative is the lowest stable diary ID. Subsequent calls
can receive previous groups to retain that representative during insertions.
Deleting the representative chooses a real remaining location; never preserve
a deleted location merely to prevent visible movement. Items sort by time,
with ID as the tie-breaker.

Pairwise grouping is quadratic and runs only when the collection changes.
The measured 500-record case does not justify another index or hybrid renderer.
Revisit indexing and offscreen virtualization for materially larger collections.
Hover and theme changes must not invoke geographic grouping.

## Renderer boundaries

The Mapbox anchor has fixed dimensions and no application-owned transform,
animation or position offsets. Hit targets live inside it. Expansion uses a
separate, projected screen-space portal; its transforms never reach the anchor.
Changes to selected/hovered/theme state update existing children, not innerHTML.
Geographic groups and projected collision groups are separate: do not persist
screen offsets in diary coordinates or recompute geography on camera movement.

Phase 4 uses a 120-180 degree arc for 2-6 entries and a scrollable list for 7+.
Position both against the usable map rectangle, excluding panels and controls.
Retain child keys, scroll position and focus during selection and theme updates.

## Verification

`node --test apps/web/src/components/markers/*.test.js`

With the Vite dev server and Playwright available:

`node apps/web/tests/marker-browser.mjs`

Optional environment variables: `PREVIEW_URL`, `BROWSER_CHANNEL`, and
`PLAYWRIGHT_MODULE` (module specifier or absolute path to an installed Playwright).
The browser test mounts the real marker layer with a real Mapbox map and a local
empty style. It requires no account, production records or remote basemap tiles.
It checks anchor identity and projected centers during hover, selection, data
editing, pan/zoom/pitch/rotation, theme switching, mobile resize and cleanup.
It also covers 5-item arcs, all 12 list choices, external selection, CRUD counts,
zoom collision merge/split, keyboard focus restoration and list scroll retention.
A second fixture mounts MapView, MemoryPanel and DiarySidePanel together. It
checks bidirectional selection, current details, scoped list scrolling,
camera stability on child selection, mobile sheet avoidance, and restoration
of custom location layers after style changes. Fixtures live only in the test
runner; there is no application test route. REAL_MAP_STYLE=1 additionally loads
live light-v11/dark-v11 tiles using the local development Mapbox configuration.

## Phase 7 measurements

Chrome headless, Apple M2, 1920x1080, development React StrictMode, local blank
Mapbox style; 12 grouping samples and 45 animation frames per data size.
Records are separated across the viewport so each renders an individual marker.
The camera pans, zooms and rotates while collecting requestAnimationFrame deltas.

| Records | Group median | Render to frame | Frame median | Frame P95 |
| --- | --- | --- | --- | --- |
| 50 | 0.1ms | 36.8ms | 16.7ms | 17.4ms |
| 100 | 0.3ms | 93.0ms | 16.7ms | 16.8ms |
| 300 | 1.9ms | 132.3ms | 16.7ms | 18.5ms |
| 500 | 3.9ms | 165.7ms | 16.7ms | 18.0ms |

These are local observations, not mobile GPU or remote-tile performance
guarantees. Live basemap screenshots verify both themes separately. Browser
checks cover touch-sized layout and reduced motion, but actual mobile hardware,
Windows and Safari runs remain unverified. API authentication/permissions are
not mocked into claims of end-to-end server coverage.

Build and the marker test suite pass. There is no configured web lint script;
git diff --check is also run. The pre-existing large-bundle build warning remains.
No iOS, backend or dependency changes are required for this marker integration.
