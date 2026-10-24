import assert from 'node:assert/strict';
import { mkdir, readdir, writeFile } from 'node:fs/promises';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await (process.env.BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const directory = process.env.SCREENSHOTS || '/tmp/adrift-design-after';
const baseline = process.env.BASELINE === '1';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir(directory, { recursive: true });

try {
  await page.route('**/src/main.jsx', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.slice(0, source.indexOf('createRoot(document')) + '\nimport "/src/DesktopApp.jsx";' });
  });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5178');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/markers/DiaryMarkerLayer.jsx')).text();
    const main = await (await fetch('/src/main.jsx')).text();
    const React = (await import(source.match(/from "([^"]*deps\/react\.js[^"]*)"/)[1])).default;
    const { createRoot } = (await import(main.match(/from "([^"]*react-dom_client[^"]*)"/)[1])).default;
    const mapbox = (await import(source.match(/from "([^"]*mapbox-gl[^\"]*)"/)[1])).default;
    const OriginalMap = mapbox.Map;
    // Local map style keeps screenshot QA independent of production tile services.
    const mapStyle = theme => ({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': theme === 'dark' ? '#172b35' : '#e6f0ef' } }] });
    mapbox.Map = class extends OriginalMap {
      constructor(options) { super({ ...options, center: [120.57, 24.225], style: mapStyle(document.documentElement.dataset.theme) }); window.designMap = this; }
      setStyle(value, options) { return super.setStyle(typeof value === 'string' ? mapStyle(value.includes('dark') ? 'dark' : 'bright') : value, options); }
    };
    const { api, saveAuth, clearStoredAuth } = await import('/src/api/client.js');
    const owner = { id: 'keeper', _id: 'keeper', name: '陳恩儒', email: 'keeper@example.test', userCode: 'memorykeeper', role: 'owner', createdAt: '2026-09-01' };
    const friends = ['林沐晴', '張以安', '曾語晨'].map((name, i) => ({ _id: 'friend-' + i, name, userCode: ['sunny', 'river', 'morning'][i], role: 'user', createdAt: '2026-09-12' }));
    const diaries = ['咖啡店裡，慢慢整理今天的自己', '海邊的風，和終於說出口的話', '一段很長的城市散步與日常記憶，留下那些還沒說完的故事', '雨停以後的校園'].map((title, i) => ({
      _id: 'memory-' + i, title,
      text: i === 1 ? '和朋友在海邊坐了一會，什麼也沒做，卻記得很清楚。' : '原本只是想坐一下，卻在這裡整理了很多想法。和朋友聊起最近的生活，才發現有些重要的事情，總是在最平常的午後發生。\n' + '把這段生活留在發生的地方，下一次回來，還能重新遇見今天的自己。'.repeat(8),
      user: friends[i % 3], author: friends[i % 3], visibility: i % 2 ? 'friends' : 'public',
      location: { coordinates: [120.57 + (i > 1 ? .012 : 0), 24.225 + (i > 1 ? .005 : 0)], placeName: ['靜宜大學附近的咖啡店', '高美濕地', '臺中市沙鹿區，回家的路上', '靜宜大學'][i] },
      mood: { type: i === 2 ? 'confused' : 'calm', intensity: 3 },
      createdAt: '2026-10-23T08:30:00Z', imageUrl: i % 2 === 0 ? `${location.origin}/adrift-icon.png` : null,
      reactions: { understand: i ? 100 : 9, hug: 2, same_feeling: 999 }, userReaction: null
    }));
    window.EventSource = class extends EventTarget { close() {} };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: success => success({ coords: { latitude: 24.225, longitude: 120.57, accuracy: 20 }, timestamp: Date.now() }) } });
    api.getMe = async () => ({ data: owner });
    api.getDiaries = async () => ({ data: { diaries } });
    api.getExploreDiaries = async () => ({ data: diaries });
    api.getDiary = async id => ({ data: { diary: diaries.find(d => d._id === id) } });
    window.feedMode = 'ready';
    api.getFeed = async (filter, cursor) => {
      if (window.feedMode === 'error') throw Error('連線中斷，請稍後再試。');
      if (window.feedMode === 'loading') return new Promise(resolve => { window.finishFeed = resolve; });
      if (window.feedMode === 'paginated') return { data: { diaries: cursor ? diaries.slice(2) : diaries.slice(0, 2), nextCursor: cursor ? null : 'next-page' } };
      return { data: { diaries: window.feedMode === 'empty' ? [] : diaries.filter(d => filter === 'all' || d.visibility === filter), nextCursor: null } };
    };
    api.reactToDiary = async (id, type) => ({ data: { reactions: { understand: 10, hug: 3, same_feeling: 1000 }, userReaction: type } });
    api.getFriends = async () => ({ data: friends });
    api.getFriendRequests = async () => ({ data: [{ requestId: 'request', from: friends[1] }] });
    api.getSentFriendRequests = async () => ({ data: [] });
    api.getFriendRecommendations = async () => ({ data: [] });
    api.getFriendProfile = async () => ({ data: { user: friends[0], diaries: diaries.slice(0, 2), stats: { diaryCount: 2 }, friendship: 'friends' } });
    api.getNotifications = async () => ({ data: { items: [{ _id: 'notice', type: 'friend_request', actor: friends[1], createdAt: '2026-10-23T09:00:00Z', readAt: null }, { _id: 'reaction', type: 'diary_reaction', actor: friends[0], targetId: diaries[0]._id, createdAt: '2026-10-22T10:00:00Z', readAt: '2026-10-23' }], unreadCount: 1, nextCursor: null } });
    api.getIntelligenceOverview = async days => ({ data: { days, count: 12, start: '2026-09-24', end: '2026-10-24', moods: [{ type: 'calm', count: 8 }, { type: 'confused', count: 4 }], daily: [{ date: '2026-10-20', count: 3, averageIntensity: 3 }, { date: '2026-10-21', count: 5, averageIntensity: 4 }], placeCount: 3, places: [{ placeName: '靜宜大學', count: 6, diaryId: diaries[0]._id }] } });
    api.getAdminStats = async () => ({ data: { totalUsers: 24, totalDiaries: 128, recentUsers: friends, recentDiaries: diaries, publicDiaries: 72, privateDiaries: 32, friendsDiaries: 24 } });
    api.getAdminUsers = async () => ({ data: { items: [owner, ...friends], pagination: { page: 1, total: 4, totalPages: 1 } } });
    api.getAdminDiaries = async () => ({ data: { items: diaries } });
    localStorage.setItem('adrift-map-onboarding-seen', 'true');
    const { default: App } = await import('/src/App.jsx');
    const root = createRoot(document.getElementById('root'));
    let version = 0;
    window.design = { goto(path, authenticated = true) {
      authenticated ? saveAuth('local-visual-fixture', owner) : clearStoredAuth();
      history.replaceState(null, '', path);
      root.render(React.createElement(App, { key: ++version }));
    } };
  });

  async function visit(path, selector, authenticated = true) {
    await page.evaluate(({ path, authenticated }) => window.design.goto(path, authenticated), { path, authenticated });
    await page.locator(selector).first().waitFor();
    await page.waitForTimeout(650);
  }
  const pages = [
    ['home', '/', '.landing-page', false], ['about', '/about', '.public-info-page', false],
    ['features', '/features/map-diary', '.public-info-page', false], ['features-emotion', '/features/emotion', '.public-info-page', false],
    ['features-memories', '/features/memories', '.public-info-page', false], ['privacy', '/privacy', '.public-info-page', false],
    ['auth', '/auth', '.auth-page', false], ['map', '/', '.map-stage', true], ['feed', '/feed', '.memory-feed', true],
    ['friends', '/friends', '.friends-hub', true], ['intelligence', '/ai/life-map', '.intelligence-page', true],
    ['settings', '/settings/account', '.settings-page', true], ['admin', '/admin/dashboard', '.admin-page', true],
    ['notifications', '/feed', '.memory-feed', true]
  ];
  const measurements = [];
  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => localStorage.setItem('adrift-theme', theme), theme);
    for (const [name, path, selector, authenticated] of pages) {
      await visit(path, selector, authenticated);
      if (name.startsWith('features')) assert.ok(await page.locator('.public-info-page').evaluate(el => Math.abs(el.getBoundingClientRect().width - innerWidth) < 1), 'feature page must use the full public layout, not a map grid column');
      if (name === 'notifications') {
        await page.getByRole('button', { name: /通知，1 則未讀/ }).click();
        await page.waitForTimeout(300);
      }
      await page.screenshot({ path: `${directory}/${name}-${theme}.png`, fullPage: true });
      measurements.push(await page.evaluate(({ name, theme }) => {
        const title = document.querySelector('h1');
        const control = document.querySelector('.mf-header .primary-button, .hub-button, .intel-button, .settings-row-action, .admin-console-action');
        const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
        const luminance = color => color.slice(0, 3).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126,.7152,.0722][i], 0);
        const contrast = [];
        for (const el of document.querySelectorAll('h1,h2,h3,p,span,small,strong,time,button,a,label,dt,dd')) {
          if (!Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim()) || el.closest('[disabled], [inert], [aria-hidden="true"]')) continue;
          const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
          if (!rect.width || !rect.height || rect.top >= innerHeight || rect.bottom < 0 || style.visibility !== 'visible' || Number(style.opacity) < 1) continue;
          const foreground = rgb(style.webkitTextFillColor || style.color);
          if (foreground[3] === 0 || foreground.length < 3) continue;
          let background = [0,0,0,0];
          for (let node = el; node && background[3] < .999; node = node.parentElement) {
            const color = rgb(getComputedStyle(node).backgroundColor), a = color[3] ?? 1, visible = (1 - background[3]) * a;
            background = [0,1,2].map(i => background[i] + color[i] * visible).concat(background[3] + visible);
          }
          const fallback = theme === 'bright' ? [255,255,255] : [8,15,24];
          background = background.slice(0,3).map((c,i) => c + fallback[i] * (1 - background[3]));
          const [low, high] = [luminance(foreground), luminance(background)].sort((a,b) => a-b);
          const ratio = (high+.05)/(low+.05);
          const minimum = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
          if (ratio < minimum) contrast.push({ selector: el.className, text: el.textContent.trim().slice(0,45), ratio: +ratio.toFixed(2), minimum, color: style.color, background });
        }
        return { name, theme, title: title && getComputedStyle(title).fontSize, controlHeight: control?.getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > innerWidth, contrast };
      }, { name, theme }));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}/${theme} horizontal overflow`);
      for (const [width, height] of [[1920,1080], [1600,900], [1366,768], [1280,800], [1024,768]]) {
        await page.setViewportSize({ width, height });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}/${theme}/${width} page overflow`);
        if (authenticated && name !== 'map') assert.equal(await page.locator(selector).first().evaluate(el => el.scrollWidth <= el.clientWidth), true, `${name}/${width} content overflow`);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    }
  }

  if (!baseline) {
    for (const theme of ['bright', 'dark']) {
      await page.evaluate(theme => localStorage.setItem('adrift-theme', theme), theme);
      await visit('/feed', '.mf-card');
      for (const [width, height] of [[1920,1080], [1600,900], [1440,900], [1366,768], [1280,800], [1024,768]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const geometry = await page.locator('.mf-card').evaluateAll(cards => cards.map(card => {
          const r = card.getBoundingClientRect();
          const f = card.querySelector('footer').getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, bottom: f.bottom, overflow: card.scrollWidth > card.clientWidth };
        }));
        assert.equal(geometry.length, 4);
        assert.equal(geometry[0].y, geometry[1].y, 'two cards per row');
        assert.ok(geometry[2].y > geometry[0].y, 'never three columns');
        assert.ok(geometry.every(card => !card.overflow && card.width >= 400));
        assert.ok(geometry.every(card => card.bottom > card.y), 'every card keeps its action row inside the card');
        await page.screenshot({ path: `${directory}/feed-${theme}-${width}.png` });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const card = page.locator('.mf-card').first();
    assert.ok(await card.locator('.mf-story p').evaluate(el => el.textContent.length > 280), 'preview does not discard full diary text');
    await card.evaluate(el => { window.retainedFeedCard = el; });
    const beforeReaction = await card.boundingBox();
    await card.getByRole('button', { name: '我懂', exact: true }).click();
    await page.waitForTimeout(350);
    assert.equal(await card.getByRole('button', { name: '我懂', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await card.boundingBox(), beforeReaction, 'reaction counter does not resize the card');
    await page.locator('.mf-tabs').getByRole('button', { name: '公開', exact: true }).click();
    await page.waitForTimeout(350);
    assert.equal(await card.evaluate(el => el === window.retainedFeedCard), true, 'filter retains matching card DOM');
    const photo = card.locator('.mf-photo');
    await photo.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: '日記照片' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await photo.evaluate(el => el === document.activeElement), true, 'photo focus restored');
    const frame = photo.locator('.diary-image-frame');
    const beforeImageError = await frame.boundingBox();
    await page.route('**/qa-image-unavailable', route => route.fulfill({ status: 404, body: '' }));
    await photo.locator('img').evaluate(el => { el.src = '/qa-image-unavailable'; });
    await photo.locator('.diary-image-fallback').waitFor();
    assert.deepEqual(await frame.boundingBox(), beforeImageError, 'image fallback preserves reserved geometry');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.ok(await page.locator('.mf-tabs > span').evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) <= .00001));
    await page.evaluate(() => { window.feedMode = 'paginated'; });
    await visit('/feed', '.mf-more');
    await page.locator('.mf-card').first().evaluate(el => { window.firstPageCard = el; });
    await page.getByRole('button', { name: '載入更多記憶' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.mf-card').length === 4);
    assert.equal(await page.locator('.mf-more').count(), 0);
    assert.equal(await page.locator('.mf-card').first().evaluate(el => el === window.firstPageCard), true, 'pagination retains the first page');
    for (const mode of ['empty', 'error', 'loading']) {
      await page.evaluate(mode => { window.feedMode = mode; }, mode);
      await visit('/feed', mode === 'empty' ? '.mf-empty' : mode === 'error' ? '.mf-error' : '.mf-skeleton');
      await page.screenshot({ path: `${directory}/feed-${mode}.png` });
    }
  }
  await writeFile(`${directory}/measurements.json`, JSON.stringify({ measurements, errors }, null, 2));
  const screenshots = (await readdir(directory)).filter(name => name.endsWith('.png')).sort();
  await writeFile(`${directory}/index.html`, `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>Adrift Design QA</title><style>body{margin:32px;font:15px system-ui;background:#101923;color:#edf8ff}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0}img{width:100%;height:auto}figcaption{padding:12px 0}a{color:#83caff}</style><h1>Adrift Design QA</h1><p>Local fixtures · Chrome / WebKit · Dark / Bright</p><p><a href="measurements.json">Layout and contrast measurements</a></p><main>${screenshots.map(name => `<figure><a href="${name}"><img src="${name}" loading="lazy" alt="${name}"></a><figcaption>${name}</figcaption></figure>`).join('')}</main></html>`);
  assert.deepEqual(errors, []);
  if (!baseline) assert.deepEqual(measurements.filter(p => p.contrast.length).map(p => ({ name: p.name, theme: p.theme, contrast: p.contrast })), [], 'visible text contrast on resolved surfaces');
  console.log(`PASS: rendered public/authenticated pages in both themes${baseline ? '' : ', Feed six-width grid, retained cards, reaction, photo dialog/focus and empty/error/loading states'}. Screenshots: ${directory}`);
} finally {
  await browser.close();
}
