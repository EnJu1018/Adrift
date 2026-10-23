import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../../api/src/models/User.js';
import Diary from '../../api/src/models/Diary.js';
import Notification from '../../api/src/models/Notification.js';
import authRouter from '../../api/src/routes/auth.js';
import friendsRouter from '../../api/src/routes/friends.js';
import diaryRouter from '../../api/src/routes/diaries.js';
import notificationRouter from '../../api/src/routes/notifications.js';
import usersRouter from '../../api/src/routes/users.js';
import adminRouter from '../../api/src/routes/admin.js';
import { errorHandler } from '../../api/src/middleware/errorHandler.js';
import { fileURLToPath } from 'node:url';

const uri = process.env.NOTIFICATIONS_BROWSER_MONGO_URI;
if (!uri || !['localhost', '127.0.0.1'].includes(new URL(uri).hostname) || !new URL(uri).pathname.startsWith('/adrift_notifications_test_')) throw new Error('Browser E2E requires an isolated local database');
await mongoose.connect(uri); await mongoose.connection.dropDatabase();
await Promise.all([User.init(), Diary.init(), Notification.init()]);
const password = 'local-only-password';
const passwordHash = await bcrypt.hash(password, 4);
const [a, b] = await User.create(['river', 'harbor'].map(code => ({ name: code === 'river' ? 'River' : 'Harbor', email: `${code}@example.test`, userCode: code, passwordHash })));
const diary = await Diary.create({ user: a._id, title: '河岸的午後', text: '和朋友散步，整理今天的想法。', mood: { type: 'calm', intensity: 3 }, visibility: 'public', location: { type: 'Point', coordinates: [120.5, 24.2], placeName: '河岸公園' } });
process.env.JWT_SECRET = 'isolated-browser-notification-secret';
const app = express(); app.use(express.json());
let failReaction = false;
app.use('/api/uploads', express.static(fileURLToPath(new URL('../../api/src/uploads', import.meta.url))));
app.use((req, res, next) => { res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' }); if (req.method === 'OPTIONS') return res.sendStatus(204); next(); });
app.get('/api/location/ip', (_req, res) => res.json({ success: true, data: null }));
app.post('/api/diaries/:id/react', (_req, res, next) => { if (!failReaction) return next(); failReaction = false; res.status(503).json({ success: false, message: '測試中的暫時連線失敗' }); });
app.use('/api/auth', authRouter); app.use('/api/users', usersRouter); app.use('/api/friends', friendsRouter); app.use('/api/diaries', diaryRouter); app.use('/api/notifications', notificationRouter); app.use('/api/admin', adminRouter); app.use(errorHandler);
const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
const apiOrigin = `http://127.0.0.1:${server.address().port}`;
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await (process.env.BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
const errors = [];
const web = process.env.PREVIEW_URL || 'http://127.0.0.1:5178';
async function person(code) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(apiOrigin => {
    const Native = window.EventSource;
    window.EventSource = class extends Native { constructor(url, options) { const source = new URL(url); super(`${apiOrigin}/api/diaries/events${source.search}`, options); } };
    const nativeFetch = window.fetch;
    window.fetch = (input, options) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
      if (url.origin === 'http://localhost:5000' || url.pathname.startsWith('/api/')) return nativeFetch(`${apiOrigin}/api${url.pathname.replace(/^\/api/, '')}${url.search}`, options);
      return nativeFetch(input, options);
    };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(success) { success({ coords: { latitude: 24.2, longitude: 120.5, accuracy: 10 }, timestamp: Date.now() }); } } });
  }, apiOrigin);
  await context.route(url => url.pathname.startsWith('/uploads/') && url.origin === 'http://localhost:5000', async route => {
    const response = await context.request.get(`${apiOrigin}/api${new URL(route.request().url()).pathname}`);
    await route.fulfill({ response });
  });
  // Geometry is covered by marker-browser; keep this test focused on real data and navigation.
  await context.route('**/src/components/MapView.jsx*', route => route.fulfill({ contentType: 'text/javascript', body: 'export default function MapView(props) { window.notificationMap = props; return null; }' }));
  const login = await context.request.post(`${apiOrigin}/api/auth/login`, { data: { email: `${code}@example.test`, password } });
  assert.equal(login.status(), 200); const auth = (await login.json()).data;
  await context.addInitScript(auth => { localStorage.setItem('adrift_token', auth.token); localStorage.setItem('adrift_user', JSON.stringify(auth.user)); }, auth);
  await page.goto(web + '/friends');
  try { await page.locator('.friends-hub').waitFor(); }
  catch (error) { console.log('Browser state:', page.url(), await page.locator('body').innerText(), errors); throw error; }
  return { context, page, auth };
}
let first, second;
try {
  first = await person('river'); second = await person('harbor');
  const pa = first.page, pb = second.page;
  await pa.getByRole('tab', { name: '探索使用者' }).click();
  await pa.getByRole('textbox', { name: '搜尋使用者' }).fill('harbor');
  await pa.getByRole('button', { name: '加入好友', exact: true }).first().click();
  await pb.getByRole('button', { name: '通知，1 則未讀', exact: true }).waitFor();
  await pb.getByRole('button', { name: '通知，1 則未讀', exact: true }).click();
  await pb.locator('.notice-item').filter({ hasText: '想加你為好友' }).click();
  await pb.getByRole('button', { name: '接受', exact: true }).click();
  await pa.getByRole('button', { name: '通知，1 則未讀', exact: true }).waitFor();
  await pa.getByRole('button', { name: '通知，1 則未讀', exact: true }).click();
  await pa.locator('.notice-item').filter({ hasText: '接受了你的好友邀請' }).click();
  await pa.getByRole('dialog', { name: /的個人資料/ }).waitFor();
  await pa.keyboard.press('Escape');
  await pb.goto(web + '/feed'); await pb.locator('.mf-card').waitFor();
  await pb.getByRole('button', { name: '抱抱', exact: true }).click();
  await pa.getByRole('button', { name: '通知，1 則未讀', exact: true }).waitFor();
  await pa.getByRole('button', { name: '通知，1 則未讀', exact: true }).click();
  await pa.locator('.notice-item').filter({ hasText: '留下了共鳴' }).click();
  await pa.waitForFunction(id => window.notificationMap?.selectedDiary?._id === id, String(diary._id));
  await pa.reload(); await pa.getByRole('button', { name: '通知', exact: true }).waitFor();
  assert.equal(await pa.locator('.nav-badge').count(), 0, 'read state persists after refresh');
  await pb.getByRole('button', { name: '抱抱', exact: true }).click();
  await pb.getByRole('button', { name: '我懂', exact: true }).click();
  assert.equal(await Notification.countDocuments({ recipient: a._id, type: 'diary_reaction' }), 1);
  await pa.getByRole('button', { name: '通知', exact: true }).click();
  await Diary.deleteOne({ _id: diary._id });
  await pa.locator('.notice-item').filter({ hasText: '留下了共鳴' }).click();
  await pa.getByRole('alert').filter({ hasText: '已移除' }).waitFor();
  await pa.keyboard.press('Escape');
  const secondDiary = await Diary.create({ user: b._id, title: '朋友的咖啡日記', text: '一起聊聊最近的生活。', mood: { type: 'joy', intensity: 4 }, visibility: 'public', location: { type: 'Point', coordinates: [120.5, 24.2], placeName: '咖啡店' } });
  await pa.goto(web + '/feed');
  await pa.locator('.mf-card').filter({ hasText: secondDiary.title }).getByRole('button', { name: '我懂', exact: true }).click();
  await pb.getByRole('button', { name: '通知，1 則未讀', exact: true }).click();
  await pb.getByRole('button', { name: '全部標記已讀' }).click();
  await pb.keyboard.press('Escape'); await pb.reload();
  await pb.getByRole('button', { name: '通知', exact: true }).waitFor();
  assert.equal(await pb.locator('.nav-badge').count(), 0);
  await pa.goto(web + '/settings'); await pa.locator('.account-center').waitFor();
  const avatarInput = pa.locator('.settings-avatar-actions input[type=file]');
  await avatarInput.setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await pa.getByText('頭貼僅支援 JPG、PNG、WebP', { exact: true }).waitFor();
  await avatarInput.setInputFiles({ name: 'too-large.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await pa.getByText('頭貼檔案不可超過 10MB', { exact: true }).waitFor();
  const fixtureImage = await pa.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 512; const context = canvas.getContext('2d'); context.fillStyle = '#187f88'; context.fillRect(0,0,256,512); context.fillStyle = '#dbb760'; context.fillRect(30,100,150,150); return canvas.toDataURL('image/png').split(',')[1]; });
  await avatarInput.setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(fixtureImage, 'base64') });
  const crop = pa.getByRole('dialog', { name: '調整頭貼', exact: true }); await crop.waitFor();
  assert.equal(await crop.locator('.avatar-original-preview img').evaluate(el => el.naturalHeight), 512);
  await crop.getByRole('slider').fill('1.4');
  const cropBox = await crop.locator('.avatar-crop-frame').boundingBox();
  await pa.mouse.move(cropBox.x + 100, cropBox.y + 100); await pa.mouse.down(); await pa.mouse.move(cropBox.x + 115, cropBox.y + 110); await pa.mouse.up();
  await crop.getByRole('button', { name: '儲存頭貼', exact: true }).click();
  try { await crop.waitFor({ state: 'detached' }); }
  catch (error) { console.log('Crop error:', await crop.locator('.field-error').allTextContents()); throw error; }
  await pa.waitForFunction(() => document.querySelector('.nav-avatar-button .user-avatar img')?.getAttribute('src')?.includes('/uploads/avatars/'));
  assert.ok((await User.findById(a._id)).avatar);
  await pa.getByRole('button', { name: '移除頭貼', exact: true }).click();
  await pa.waitForFunction(() => !document.querySelector('.nav-avatar-button .user-avatar img'));
  assert.equal((await User.findById(a._id)).avatar, '');
  await pa.locator('.settings-sidebar').getByRole('button', { name: '外觀', exact: true }).click();
  await pa.locator('.account-theme').getByRole('button', { name: '深色', exact: true }).click();
  assert.equal(await pa.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await pa.locator('.account-theme').getByRole('button', { name: '明亮', exact: true }).click();
  assert.equal(await pa.evaluate(() => localStorage.getItem('adrift-theme')), 'bright');
  await Diary.updateOne({ _id: secondDiary._id }, { $set: { imageUrl: `data:image/png;base64,${fixtureImage}` } });
  await pa.goto(web + '/feed'); await pa.locator('.mf-card').waitFor();
  await pa.getByRole('button', { name: `放大照片：${secondDiary.title}`, exact: true }).click();
  await pa.getByRole('dialog', { name: '日記照片', exact: true }).waitFor();
  await pa.keyboard.press('Escape');
  await pa.locator('.mf-author').click(); await pa.getByRole('dialog', { name: /的個人資料/ }).waitFor(); await pa.keyboard.press('Escape');
  failReaction = true;
  await pa.getByRole('button', { name: '抱抱', exact: true }).click();
  await pa.locator('.mf-error').filter({ hasText: '暫時連線失敗' }).waitFor();
  assert.equal(await pa.getByRole('button', { name: '抱抱', exact: true }).getAttribute('aria-pressed'), 'false');
  assert.equal(await pa.getByRole('button', { name: '我懂', exact: true }).getAttribute('aria-pressed'), 'true');
  for (const [route, selector] of [['/feed', '.memory-feed'], ['/settings', '.account-center']]) {
    await pa.goto(web + route); await pa.locator(selector).waitFor();
    for (const theme of ['bright', 'dark']) {
      await pa.evaluate(theme => { document.documentElement.dataset.theme = theme; localStorage.setItem('adrift-theme', theme); }, theme);
      for (const [width, height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[375,667],[320,720]]) {
        await pa.setViewportSize({ width, height });
        assert.equal(await pa.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} horizontal overflow ${width}`);
        assert.equal(await pa.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth), true, `${route} internal overflow ${width}`);
        if (width <= 600) {
          const dock = await pa.locator('.mobile-bottom-nav').boundingBox();
          assert.ok(dock.y >= height - 110 && dock.y + dock.height <= height, 'mobile navigation stays at the viewport bottom, outside the glass navbar');
          if (route === '/feed') assert.equal(await pa.locator('.mf-header>.primary-button').evaluate(el => getComputedStyle(el).whiteSpace), 'nowrap');
          else assert.equal(await pa.locator('.settings-page-header>.chip-button').evaluate(el => getComputedStyle(el).whiteSpace), 'nowrap');
        }
        if ([1440,390,320].includes(width)) await pa.screenshot({ path: `/tmp/adrift-product-${route.slice(1)}-${theme}-${width}.png`, fullPage: true });
      }
    }
  }
  await User.updateOne({ _id: a._id }, { $set: { role: 'owner' } });
  await pa.goto(web + '/admin'); await pa.locator('.admin-console').waitFor();
  for (const tab of ['Overview', 'Users', 'Diaries', 'Roles & Permissions', 'System Status']) {
    await pa.getByRole('button', { name: tab, exact: true }).click();
    const panel = { Overview: '.admin-overview-card', Users: '.users-table', Diaries: '.diaries-table', 'Roles & Permissions': '.admin-access', 'System Status': '.admin-system dl' }[tab];
    await pa.locator(panel).waitFor();
    await pa.waitForFunction(selector => {
      const target = document.querySelector(selector);
      return target && target.getAttribute('aria-busy') !== 'true' && Number(getComputedStyle(target.closest('.admin-content-frame').firstElementChild).opacity) >= .99;
    }, panel);
    for (const theme of ['bright', 'dark']) {
      await pa.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await pa.waitForTimeout(300);
      for (const [width, height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[375,667],[320,720]]) {
        await pa.setViewportSize({ width, height });
        assert.equal(await pa.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${tab} overflow ${width}`);
        assert.equal(await pa.locator('.admin-console').evaluate(el => el.scrollWidth <= el.clientWidth), true, `${tab} internal overflow ${width}`);
        if ([1440,390].includes(width)) await pa.screenshot({ path: `/tmp/adrift-product-admin-${tab.split(' ')[0]}-${theme}-${width}.png`, fullPage: true });
      }
    }
  }
  await pa.setViewportSize({ width: 1440, height: 900 });
  await pa.getByRole('button', { name: 'Diaries', exact: true }).click();
  await pa.getByRole('button', { name: '刪除日記', exact: true }).click();
  const confirm = pa.getByRole('dialog', { name: '刪除日記確認', exact: true }); await confirm.waitFor();
  assert.equal(await confirm.getByRole('button', { name: '永久刪除', exact: true }).isDisabled(), true);
  await confirm.getByRole('textbox').fill('僅限本地測試的管理原因');
  await confirm.getByRole('button', { name: '永久刪除', exact: true }).click();
  await confirm.waitFor({ state: 'detached' });
  assert.equal(await Diary.countDocuments({ _id: secondDiary._id }), 0);
  await pa.emulateMedia({ reducedMotion: 'reduce' });
  await pa.goto(web + '/feed'); await pa.locator('.mf-tabs').waitFor();
  assert.ok(await pa.locator('.mf-tabs>span').evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) <= 0.00001));
  assert.deepEqual(errors, []);
  console.log('PASS: real JWT accounts A/B, invitation/acceptance SSE badges, invitations/profile/diary navigation, reaction de-duplication, persisted read state, deleted target fallback.');
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await mongoose.connection.dropDatabase(); await mongoose.disconnect();
}
