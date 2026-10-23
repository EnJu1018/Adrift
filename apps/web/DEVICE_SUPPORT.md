# Desktop Web Support

The web entry point checks device signals before importing `DesktopApp.jsx`.
Phones and tablets render `MobileGate.jsx` on every SPA route, without starting
authentication, location, API polling, Mapbox or the main application. Desktop
window resizing never changes the selected application. Existing JWT and theme
storage are not cleared or rewritten by the gate.

## Detection and Limits

`src/lib/deviceSupport.js` checks phone/tablet UA markers, low-entropy Client
Hints and iPadOS Macintosh plus multi-touch. When available, it requests platform
and form-factor hints, bounded to 250 ms. ARM Linux devices have a conservative
touch/coarse-pointer/physical-screen fallback; a touch screen or narrow viewport
alone never blocks a desktop laptop. The result stays fixed for the document,
including orientation changes. Reloading reevaluates device signals.

This is a web product-support policy, not authentication or a security boundary.
Android Desktop Site mode is detected when Android/platform/form-factor evidence
survives. If a browser deliberately reports only desktop signals, especially
Linux x86_64 with Desktop form factor, it cannot reliably be distinguished from a
real desktop without false positives. No implementation can guarantee otherwise.
No browser fingerprint is stored or sent to the server. There is no bot exception.

This is a Vite client-rendered application using `createRoot`, not SSR/hydration.
Both the initial device check and desktop chunk loading show only a neutral
loading message; they never mount the main App behind a CSS overlay.

## Search Visibility

Public routes retain shared titles, descriptions, canonical URLs, Open Graph,
Twitter metadata and JSON-LD through `src/lib/publicSeo.js`. Sitemap, robots and
the static HTML product fallback remain unchanged; no global noindex is added.
On `/`, `/about`, `/privacy` and the three public feature routes, the gate includes
visible, read-only product or privacy information and functional informational
links below the support notice. This content is available to everyone, including
mobile crawlers, without user interaction or special bot detection. It does not
expose authenticated functionality or private data.

Google uses mobile content for indexing. Replacing the mobile product entirely
with a development notice would lose indexable information; metadata alone is
not sufficient. The readable information preserves core product meaning, but
restricting the mobile experience can still affect rankings or conversion.
After release, inspect rendered public URLs with Search Console's smartphone
URL Inspection and monitor indexing and performance; ranking parity is not
guaranteed.

References:
- https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent
- https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/getHighEntropyValues

## Verification

```sh
node --test apps/web/src/lib/deviceSupport.test.js
npm run build
npm --workspace apps/web run preview -- --port 5181
PREVIEW_URL=http://127.0.0.1:5181 node apps/web/tests/device-support-browser.mjs
```

The browser suite targets the production build and checks resource isolation,
deep links, history, refresh, orientation, themes, reduced motion and console
errors with emulated device signals. Set `BROWSER=webkit` for WebKit and
`PLAYWRIGHT_MODULE` when using an external Playwright installation. Emulation is
not physical iPhone, Android, iPad, native Safari or Windows acceptance testing.
The project currently has no configured lint script.

Only web files change. Backend routes, JWT verification, iOS clients and MongoDB
are unaffected; no API device restrictions or database migrations are required.
