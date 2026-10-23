import assert from 'node:assert/strict';

const { chromium, webkit, devices } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chrome';
const browser = await (engine === 'webkit' ? webkit.launch() : chromium.launch({ channel: 'chrome' }));
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5181';
const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const linux = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36';
const routes = ['/', '/auth', '/login', '/register', '/map', '/profile', '/feed', '/friends', '/settings', '/settings/account', '/ai/life-map', '/admin', '/admin/dashboard', '/about', '/features/map-diary', '/features/emotion', '/features/memories', '/privacy', '/presentation', '/p', '/pd', '/future/deep/link'];
const mobileProfiles = [
  ['iphone-safari', { ...devices['iPhone 13'], defaultBrowserType: undefined }],
  ['iphone-chrome', { ...devices['iPhone 13'], defaultBrowserType: undefined, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/144.0.0.0 Mobile/15E148 Safari/604.1' }],
  ['android-phone', { ...devices['Pixel 7'], defaultBrowserType: undefined }],
  ['ipad-desktop-ua', { userAgent: mac, viewport: { width: 1024, height: 1366 }, hasTouch: true }],
  ['android-tablet', { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36', viewport: { width: 1280, height: 800 }, hasTouch: true }],
  ['android-desktop-site-hints', { userAgent: linux, viewport: { width: 980, height: 800 }, hasTouch: true }],
  ['mobile-crawler-same-content', { userAgent: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', viewport: { width: 390, height: 844 }, hasTouch: true }]
];
const errors = [];

try {
  for (const [name, options] of mobileProfiles) {
    const context = await browser.newContext(options);
    await context.addInitScript(({ name }) => {
      localStorage.setItem('adrift-theme', 'bright');
      localStorage.setItem('adrift-device-test', 'preserved');
      localStorage.setItem('adrift_token', 'local-gate-test-session');
      localStorage.setItem('adrift_user', JSON.stringify({ _id: 'gate-test', name: 'Local fixture' }));
      if (name === 'ipad-desktop-ua') {
        Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      }
      if (name === 'android-desktop-site-hints') {
        Object.defineProperty(navigator, 'userAgentData', { get: () => ({ mobile: false, platform: 'Linux', getHighEntropyValues: async () => ({ platform: 'Linux', formFactors: ['Tablet'] }) }) });
      }
    }, { name });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${name}: ${message.text()}`); });
    const requests = [];
    const sizes = [];
    page.on('request', request => requests.push(request.url()));
    page.on('response', response => {
      if (response.status() === 200 && response.request().resourceType() === 'script') sizes.push(response.body().then(body => body.length).catch(() => 0));
    });
    for (const path of routes) {
      await page.goto(base + path);
      await page.getByRole('heading', { name: 'App 開發中', exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, path, `${name}: preserve ${path}`);
      assert.equal(await page.locator('.auth-page, .landing-page, .mapboxgl-map, .admin-console, .memory-feed').count(), 0);
      assert.equal(await page.locator('form, button, a[href*="apps.apple.com"], a[href*="play.google.com"]').count(), 0);
      assert.ok(await page.locator('.mobile-gate').evaluate(el => el.scrollWidth <= el.clientWidth));
    }
    await page.goto(base + '/about');
    await page.locator('.mg-information').waitFor();
    assert.equal(await page.title(), '什麼是 Adrift 漂流足跡？｜地圖日記與城市記憶平台');
    assert.ok((await page.locator('.mg-information').innerText()).includes('Adrift Intelligence'));
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://adrifttw.com/about');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'index, follow');
    assert.equal(await page.locator('#adrift-route-schema').evaluate(el => JSON.parse(el.textContent)['@type']), 'AboutPage');
    await page.getByRole('link', { name: '隱私設計', exact: true }).click();
    await page.locator('.mg-information').waitFor();
    assert.match(page.url(), /\/privacy$/);
    assert.ok((await page.locator('.mg-information').innerText()).includes('只有你自己能看見'));
    await page.goBack(); await page.locator('.mg-information').waitFor(); assert.match(page.url(), /\/about$/);
    await page.goForward(); await page.locator('.mg-information').waitFor(); assert.match(page.url(), /\/privacy$/);
    await page.reload(); await page.locator('.mobile-gate').waitFor();
    for (const theme of ['dark', 'bright']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      assert.equal(await page.locator('.mobile-gate').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(7, 11, 18)');
    }
    for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1366, height: 1024 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.locator('.mobile-gate').count(), 1, name + ': orientation does not unlock app');
      assert.ok(await page.locator('.mobile-gate').evaluate(el => el.scrollWidth <= el.clientWidth));
    }
    await page.setViewportSize(options.viewport || { width: 390, height: 844 });
    await page.goto(base + '/auth');
    await page.locator('.mobile-gate').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    if (name === 'iphone-safari' || name === 'ipad-desktop-ua') await page.screenshot({ path: `/tmp/adrift-device-${engine}-${name}.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.ok(await page.locator('.mg-trail, .mg-halo').evaluateAll(items => items.every(el => getComputedStyle(el).animationName === 'none')));
    assert.equal(await page.evaluate(() => localStorage.getItem('adrift-theme')), 'bright');
    assert.equal(await page.evaluate(() => localStorage.getItem('adrift-device-test')), 'preserved');
    assert.equal(await page.evaluate(() => localStorage.getItem('adrift_token')), 'local-gate-test-session');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('adrift_user'))._id), 'gate-test');
    assert.ok(!requests.some(url => /mapbox|framer-motion|animejs|DesktopApp|\/src\/App\.jsx|localhost:5000|\/api\//i.test(url)), name + ': no desktop or API resources');
    const scriptSizes = await Promise.all(sizes);
    assert.ok(Math.max(...scriptSizes) < 350000, name + ': no monolithic app chunk downloaded');
    console.log('PASS emulated mobile gate:', name, routes.length, 'routes; largest JS', Math.max(...scriptSizes));
    await context.close();
  }

  for (const [name, userAgent, hasTouch] of [
    ['mac-safari', mac, false], ['mac-chrome', mac.replace('Version/18.0 Safari/605.1.15', 'Chrome/144.0.0.0 Safari/537.36'), false],
    ['windows-chrome-touch', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36', true],
    ['windows-edge', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0', false],
    ['linux-chrome', linux, false]
  ]) {
    const context = await browser.newContext({ userAgent, hasTouch, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${name}: ${message.text()}`); });
    await page.goto(base);
    await page.locator('.landing-page').waitFor();
    for (const width of [320, 390, 768, 1366, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.locator('.mobile-gate').count(), 0);
      assert.ok(await page.locator('.landing-page').evaluate(el => el.scrollWidth <= el.clientWidth));
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: '開始漂流', exact: true }).click();
    await page.locator('.auth-page input[type="email"]').waitFor();
    await page.reload(); await page.locator('.auth-page input[type="email"]').waitFor();
    await page.goto(base + '/about'); await page.locator('.public-info-page').waitFor();
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://adrifttw.com/about');
    await page.goto(base + '/p'); await page.locator('.presentation-page').waitFor();
    await page.keyboard.press('End');
    await page.waitForFunction(() => document.querySelector('#thank-you')?.getAttribute('aria-hidden') === 'false');
    await page.keyboard.press('Home');
    await page.waitForFunction(() => document.querySelector('#cover')?.getAttribute('aria-hidden') === 'false');
    assert.equal(await page.locator('.mobile-gate').count(), 0);
    console.log('PASS emulated desktop:', name, 'resize/auth/public metadata/presentation');
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
