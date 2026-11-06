import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:5178';
assert.equal(new URL(origin).hostname, '127.0.0.1', 'Capture only against the local preview');
const output = fileURLToPath(new URL('../public/presentation/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce',
  geolocation: { latitude: 24.2264, longitude: 120.5787, accuracy: 12 }, permissions: ['geolocation'] });
const page = await context.newPage();
const user = { id: 'a'.repeat(24), name: '林予安', userCode: 'memory-demo', email: 'memory-demo@example.test', role: 'owner' };
const friends = ['周以晴', '許柏舟', '林若溪'].map((name, i) => ({ _id: String(i + 1).repeat(24), name, userCode: ['clear-day', 'river-walk', 'evening-note'][i], friendshipStatus: 'friend', createdAt: '2026-09-18T08:00:00Z' }));
const photos = ['https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=920&auto=format&fit=crop&q=85', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=920&auto=format&fit=crop&q=85'];
const entries = [
  ['午後的樹影', '下課後沿著校園小路走了一圈。原本很急，看到陽光穿過樹梢才慢下來。', '靜宜大學', 'calm', 3],
  ['一杯咖啡的時間', '和朋友約在校門附近，一邊喝咖啡，一邊把卡住的報告重新拆成三個小問題。', '沙鹿咖啡店', 'joy', 4],
  ['把報告說完', '第一次完整練習報告，前半段有點緊張。結束後記下老師的建議。', '靜宜大學', 'anxious', 4],
  ['晚一點回家', '繞去操場坐了一會。今天沒有特別的事，想把這個傍晚留下來。', '校園操場', 'calm', 2]
].map(([title, text, placeName, type, intensity], i) => ({ _id: String(i + 4).repeat(24), title, text,
  mood: { type, intensity }, visibility: i === 3 ? 'friends' : 'public', imageUrl: photos[i] || '',
  user: { _id: user.id, ...user }, author: i < 2 ? friends[i] : { _id: user.id, name: user.name, userCode: user.userCode },
  location: { type: 'Point', coordinates: i === 2 ? [120.5787, 24.2264] : [120.5787 - i * .002, 24.2264 + i * .0012], placeName },
  createdAt: new Date(Date.now() - (i === 2 ? 300000 : (i + 1) * 86400000)).toISOString(), canEdit: i === 2, reactionCounts: { understand: i + 1 }, editCount: 0 }));
const notices = ['friend_request', 'friend_accepted', 'diary_reaction'].map((type, i) => ({ _id: `notice-${i}`, type, actor: friends[i], targetId: entries[0]._id, readAt: null, createdAt: entries[i].createdAt }));
const overview = { days: 30, count: 4, placeCount: 3, start: new Date(Date.now() - 30 * 86400000).toISOString(), end: new Date().toISOString(),
  moods: ['calm', 'joy', 'anxious'].map((type, i) => ({ type, count: i === 0 ? 2 : 1 })),
  daily: entries.slice().reverse().map(row => ({ date: row.createdAt.slice(0, 10), count: 1, averageIntensity: row.mood.intensity, intensityCount: 1 })),
  places: entries.slice(0, 2).map(row => ({ name: row.location.placeName, count: row === entries[0] ? 2 : 1, mood: row.mood.type, diaryId: row._id })) };
await context.addInitScript(user => {
  localStorage.setItem('adrift_user', JSON.stringify(user)); localStorage.setItem('adrift_token', 'local-capture-fixture'); localStorage.setItem('adrift-theme', 'bright');
}, user);
await context.route(url => url.origin === 'http://localhost:5000' ||
  (url.pathname.startsWith('/api/') && (url.origin === origin || /(^|\.)adrifttw\.com$/.test(url.hostname))), async route => {
  const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
  if (path === '/diaries/events') return route.fulfill({ contentType: 'text/event-stream', body: ': capture\n\n' });
  const fixtures = {
    '/users/me': user, '/friends': friends, '/friends/requests': [], '/friends/requests/sent': [], '/friends/recommendations': [],
    '/diaries': { diaries: entries }, '/diaries/explore': { diaries: entries }, '/diaries/memories': { diaries: [] },
    '/diaries/feed': { diaries: entries, nextCursor: null }, '/notifications': { items: notices, unreadCount: 3, nextCursor: null },
    '/location/ip': { lat: 24.2264, lng: 120.5787, placeName: '靜宜大學' },
    '/ai/overview': overview,
    '/ai/chat': { status: 'success', scope: 'memory', answer: '這段期間，你在靜宜大學記下了兩種不同的感受：散步時比較平靜，練習報告時一度緊張。[1][2] 這是已記錄的片段，不能代表你每天的心情。',
      relatedDiaries: [entries[0], entries[2]].map(row => ({ id: row._id, title: row.title, place: row.location.placeName, mood: row.mood, createdAt: row.createdAt })) },
    '/admin/stats': { totalUsers: 4, totalDiaries: 4, publicDiaries: 3, friendsDiaries: 1, privateDiaries: 0, todayDiaries: 0, recentUsers: friends, recentDiaries: entries },
    '/admin/status': { database: { status: 'connected' }, checkedAt: new Date().toISOString() }
  };
  const diary = entries.find(row => path === `/diaries/${row._id}`);
  if (!Object.hasOwn(fixtures, path) && !diary) console.log('Unmatched local API fixture:', path);
  return route.fulfill({ json: { success: true, data: diary ? { diary } : fixtures[path] ?? [] }, headers: { 'Access-Control-Allow-Origin': '*' } });
});
async function visit(path, selector) { await page.goto(origin + path); await page.locator(selector).first().waitFor(); }
async function capture(name, selector) {
  await page.evaluate(() => document.fonts.ready);
  const target = page.locator(selector).first();
  await target.screenshot({ path: `${output}${name}.png`, animations: 'disabled' });
  console.log('Captured', name);
}
try {
  await visit('/feed', '.mf-card');
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.mf-photo img')).slice(0, 2).every(img => img.naturalWidth > 0), { timeout: 15000 }).catch(() => {});
  await page.addStyleTag({ content: '.mf-card:nth-of-type(n+3) { display: none; }' });
  await capture('feed', '.mf-list');
  await page.getByRole('button', { name: /通知.*未讀/ }).click();
  await page.locator('.notice-item').first().waitFor();
  await capture('notifications', '.notifications-dropdown');
  await visit('/friends', '.hub-directory'); await capture('friends', '.hub-directory');
  await visit('/settings', '.settings-row-list'); await capture('settings', '.settings-row-list');
  await visit('/admin', '.admin-overview-card');
  await page.addStyleTag({ content: '.admin-recent-grid { display: none; }' });
  await capture('admin', '.admin-overview-card');
  await visit('/ai/life-map', '.intel-mood-row'); await capture('insights', '.intel-chart-grid');
  await capture('insight-metrics', '.intel-metrics');
  await page.getByRole('tab', { name: /Memory Chat|記憶對話/ }).click();
  const input = page.locator('#intelligence-chat textarea'); await input.fill('在靜宜大學的日記裡，我記下了哪些心情？'); await input.press('Enter');
  await page.getByText(/散步時比較平靜/).waitFor();
  await page.addStyleTag({ content: '.memory-chat-transcript { flex: none; min-height: 0; height: auto; max-height: none; }' });
  await capture('chat', '.memory-chat-transcript');
  await page.setViewportSize({ width: 1840, height: 900 });
  await visit('/', '.mapboxgl-canvas');
  await page.getByRole('button', { name: '定位目前位置', exact: true }).click();
  await page.locator('.diary-node-anchor').first().waitFor();
  await page.waitForTimeout(1200);
  await capture('map', '.mapboxgl-map');
  const map = await page.locator('.mapboxgl-canvas').boundingBox();
  await page.mouse.move(map.x + map.width * .55, map.y + map.height * .5);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(map.x + map.width * .55 + 40, map.y + map.height * .5 - 135, { steps: 12 });
  await page.mouse.up({ button: 'right' });
  await page.getByRole('button', { name: '返回 2D 地圖' }).waitFor();
  const stack = page.getByRole('button', { name: '2 篇日記', exact: true }).first();
  await stack.click();
  await capture('map-detail', '.mapboxgl-map');
  await page.getByRole('button', { name: /把報告說完/ }).first().click();
  await page.locator('.diary-side-panel.has-diary').getByRole('button', { name: /編輯/ }).click();
  await page.getByRole('dialog', { name: '編輯日記' }).waitFor();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await capture('edit', '.edit-authenticity-box');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'bright'; });
  await page.getByRole('dialog', { name: '編輯日記' }).getByRole('button', { name: 'Close' }).click();
  await page.setViewportSize({ width: 1440, height: 1300 });
  await page.getByRole('button', { name: /新增日記|留下記憶/ }).first().click();
  await page.getByRole('dialog', { name: '新增日記' }).waitFor();
  await page.locator('.diary-modal input[maxlength="50"]').fill(entries[0].title);
  await page.locator('#diary-content').fill(entries[0].text);
  // Remove the scroll cap for the slide capture; the production modal is unchanged.
  await page.addStyleTag({ content: '.diary-modal { max-height: none !important; }' });
  await capture('compose', '.diary-modal');
  await capture('privacy', '.visibility-privacy-note');
} finally { await browser.close(); }
