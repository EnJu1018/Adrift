import assert from 'node:assert/strict';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await (process.env.BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.route('**/src/main.jsx', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.slice(0, source.indexOf('createRoot(document')) });
  });
  // Map geometry has its own regression suite; isolate application data/focus here.
  await page.route('**/src/components/MapView.jsx', route => route.fulfill({
    contentType: 'text/javascript', body: 'export default function MapView(props) { window.mapProps = props; return null; }'
  }));
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5178');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/AuthPanel.jsx')).text();
    const main = await (await fetch('/src/main.jsx')).text();
    const React = (await import(source.match(/from "([^"]*deps\/react\.js[^"]*)"/)[1])).default;
    const { createRoot } = (await import(main.match(/from "([^"]*react-dom_client[^"]*)"/)[1])).default;
    const { api, saveAuth } = await import('/src/api/client.js');
    saveAuth('local-test-session', { id: 'keeper', _id: 'keeper', name: 'Keeper', userCode: 'keeper', role: 'user' });
    window.EventSource = class extends EventTarget {
      constructor() { super(); window.socialStream = this; }
      close() {}
    };
    api.getMe = async () => ({ data: { id: 'keeper', _id: 'keeper', name: 'Keeper', userCode: 'keeper', role: 'user' } });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: success => { window.finishLocation = () => success({ coords: { latitude: 24, longitude: 120, accuracy: 10 }, timestamp: Date.now() }); }
    } });
    window.pendingDiaries = [];
    window.pendingExplore = [];
    api.getDiaries = () => new Promise((resolve, reject) => window.pendingDiaries.push({ resolve, reject }));
    api.getExploreDiaries = () => new Promise((resolve, reject) => window.pendingExplore.push({ resolve, reject }));
    api.getFriends = async () => ({ data: [] });
    api.getFriendRequests = async () => ({ data: [{ requestId: 'invite', from: { name: 'River', userCode: 'river' } }] });
    api.getSentFriendRequests = async () => ({ data: [] });
    api.getNotifications = async () => ({ data: { items: [{ _id: 'notice', type: 'friend_request', actor: { name: 'River', userCode: 'river' }, createdAt: '2026-09-01T12:00:00Z', readAt: null }], unreadCount: 1, nextCursor: null } });
    const { default: App } = await import('/src/App.jsx');
    createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode, null, React.createElement(App)));
  });
  await page.waitForFunction(() => window.pendingDiaries.length >= 2 && window.mapProps);
  const diary = title => ({ _id: title, title, visibility: 'public', location: { coordinates: [120, 24] }, createdAt: '2026-09-01T12:00:00Z' });
  await page.evaluate(item => window.pendingDiaries.at(-1).resolve({ data: { diaries: [item] } }), diary('Current memory'));
  await page.waitForFunction(() => window.mapProps.diaries[0]?.title === 'Current memory');
  await page.evaluate(item => window.pendingDiaries[0].resolve({ data: { diaries: [item] } }), diary('Outdated memory'));
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => window.mapProps.diaries[0].title), 'Current memory');

  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    const userMenu = page.getByRole('button', { name: '使用者選單', exact: true });
    const before = await userMenu.boundingBox();
    await userMenu.click();
    const menu = page.locator('#nav-user-menu');
    await page.waitForFunction(() => document.querySelector('#nav-user-menu')?.contains(document.activeElement));
    await page.keyboard.press('End');
    assert.equal(await menu.getByRole('button', { name: '登出', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Home');
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'detached' });
    assert.equal(await userMenu.evaluate(el => el === document.activeElement), true);
    assert.deepEqual(await userMenu.boundingBox(), before);
    const notifications = page.getByRole('button', { name: /通知，1 則未讀/ });
    await notifications.click();
    await page.waitForFunction(() => document.querySelector('#nav-notifications')?.contains(document.activeElement));
    await page.keyboard.press('Escape');
    assert.equal(await notifications.evaluate(el => el === document.activeElement), true);
  }

  for (const width of [390, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('.product-navbar').evaluate(el => el.scrollWidth <= el.clientWidth), true);
    for (const selector of ['.nav-avatar-button', '.nav-icon-button']) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, `${selector}: touch target at ${width}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole('button', { name: '附近動態', exact: true }).click();
  await page.waitForFunction(() => window.finishLocation);
  await page.getByRole('button', { name: '日記地圖', exact: true }).click();
  await page.waitForFunction(() => window.mapProps.mode === 'mine');
  await page.evaluate(() => window.finishLocation());
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.pendingExplore.length), 0, 'late geolocation cannot reactivate a cancelled mode');
  await page.getByRole('button', { name: '附近動態', exact: true }).click();
  await page.waitForFunction(() => window.pendingExplore.length > 0);
  const priorRequests = await page.evaluate(() => window.pendingExplore.length);
  await page.evaluate(() => window.mapProps.onViewportChange({ lat: 24.001, lng: 120.001 }));
  await page.waitForFunction(count => window.pendingExplore.length > count, priorRequests);
  await page.evaluate(item => window.pendingExplore.slice(0, -1).forEach(request => request.resolve({ data: [item] })), diary('Old viewport memory'));
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => window.mapProps.loading), true, 'stale completion must not clear a newer request loading state');
  await page.evaluate(item => window.pendingExplore.at(-1).resolve({ data: [item] }), diary('Nearby memory'));
  await page.waitForFunction(() => window.mapProps.diaries[0]?.title === 'Nearby memory');
  await page.getByRole('button', { name: '日記地圖', exact: true }).click();
  await page.waitForFunction(() => window.mapProps.mode === 'mine');
  await page.evaluate(item => window.pendingDiaries.at(-1).resolve({ data: { diaries: [item] } }), diary('Personal memory'));
  await page.waitForFunction(() => window.mapProps.diaries[0]?.title === 'Personal memory');
  await page.evaluate(item => window.pendingExplore.forEach(request => request.resolve({ data: [item] })), diary('Stale nearby memory'));
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.mapProps.diaries[0].title), 'Personal memory', 'old map mode must not overwrite the latest data');

  await page.evaluate(item => window.socialStream.dispatchEvent(new MessageEvent('diary:created', { data: JSON.stringify({ diary: item }) })), { ...diary('Friend-only memory'), visibility: 'friends', user: { _id: 'river', name: 'River' } });
  await page.waitForFunction(() => window.mapProps.diaries.some(item => item.title === 'Friend-only memory'));
  await page.evaluate(() => window.socialStream.dispatchEvent(new MessageEvent('social:changed', { data: '{}' })));
  await page.waitForFunction(() => !window.mapProps.diaries.some(item => item.visibility === 'friends'));
  await page.evaluate(() => window.pendingDiaries.at(-1).reject(new Error('Temporary network outage')));
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => window.mapProps.diaries.some(item => item.visibility === 'friends')), false, 'revoked cached records stay hidden even if refresh fails');
  assert.equal(await page.evaluate(() => window.mapProps.diaries[0].title), 'Personal memory');

  await page.getByRole('button', { name: '使用者選單', exact: true }).click();
  await page.locator('#nav-user-menu').getByRole('button', { name: '登出', exact: true }).click();
  await page.locator('.auth-page').waitFor();
  await page.evaluate(item => window.pendingDiaries.forEach(request => request.resolve({ data: { diaries: [item] } })), diary('Old session memory'));
  assert.equal(await page.locator('.auth-page input').count(), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('adrift_token')), null);
  assert.deepEqual(errors, []);
  console.log('PASS: real App request ordering, map source race, social permission/cache revocation, logout isolation, keyboard popovers, focus return and stable themes.');
} finally {
  await browser.close();
}
