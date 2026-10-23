import assert from 'node:assert/strict';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await (process.env.BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (/Warning:|Each child in a list|Invalid hook call|not recognize.*prop/i.test(message.text())) errors.push(message.text()); });
try {
  await page.route('**/src/main.jsx', async route => {
    const response = await route.fetch(), source = await response.text();
    await route.fulfill({ response, body: source.slice(0, source.indexOf('createRoot(document')) });
  });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5178');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/FriendsPage.jsx')).text();
    const main = await (await fetch('/src/main.jsx')).text();
    const React = (await import(source.match(/from "([^"]*deps\/react\.js[^"]*)"/)[1])).default;
    const { createRoot } = (await import(main.match(/from "([^"]*react-dom_client[^"]*)"/)[1])).default;
    const { MotionConfig } = await import(source.match(/from "([^"]*framer-motion[^"]*)"/)[1]);
    const { api } = await import(source.match(/from "([^"]*\/api\/client\.js[^"]*)"/)[1]);
    const { default: Friends } = await import('/src/components/FriendsPage.jsx');
    const river = { _id: 'river', name: 'River', userCode: 'river', createdAt: '2026-01-01' };
    const harbor = { _id: 'harbor', name: 'Harbor', userCode: 'harbor' };
    const meadow = { _id: 'meadow', name: 'Meadow', userCode: 'meadow' };
    window.socialRequests = []; window.socialActions = []; window.socialSearches = [];
    api.searchPeople = (q, signal) => new Promise((resolve, reject) => {
      const repeatMeadow = q === 'meadow' && window.socialSearches.some(item => item.q === q);
      window.socialSearches.push({ q, signal, resolve, reject });
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      if (repeatMeadow) resolve({ data: [{ _id: 'meadow', name: 'Meadow', userCode: 'meadow' }] });
    });
    api.getFriendRecommendations = async () => ({ data: [{ ...meadow, reasons: ['有 1 位共同好友'], mutualFriendsCount: 1 }] });
    api.getFriendProfile = async id => ({ data: { ...river, _id: id, friendshipStatus: 'friend', diaryStats: { publicCount: 1, friendsCount: 1 }, canViewSharedPlaces: true } });
    api.getFriendMemories = async () => ({ data: { diaries: [{ _id: 'visible-memory', title: '河邊的風', text: '晴天散步', mood: { type: 'calm' }, createdAt: '2026-10-01', location: { placeName: '河岸' }, visibility: 'friends' }] } });
    api.getSharedPlaces = async () => ({ data: { description: '只比對已分享地點，不代表一起到訪。', places: [{ place: '河岸', mine: { _id: 'own-memory', title: '我的河岸' }, theirs: [{ _id: 'visible-memory', title: '河邊的風' }] }] } });
    const h = React.createElement;
    function Harness() {
      const [friends, setFriends] = React.useState([river]), [incoming, setIncoming] = React.useState([{ requestId: 'received', from: harbor }]), [sent, setSent] = React.useState([]), [revision, setRevision] = React.useState(0);
      window.socialHarness = { setFriends, setIncoming, setSent, setRevision };
      const action = async (kind, id) => {
        window.socialActions.push({ kind, id });
        if (kind === 'send') await new Promise(resolve => { window.finishSocialAction = resolve; });
        if (kind === 'send') setSent(current => [...current, { requestId: 'outgoing', to: meadow }]);
        if (kind === 'cancel') setSent([]);
        if (kind === 'accept') { setIncoming([]); setFriends(current => [...current, harbor]); }
        if (kind === 'reject') setIncoming([]);
        if (kind === 'remove') setFriends(current => current.filter(person => person._id !== id));
        setRevision(value => value + 1);
        return { success: true, data: { friendshipStatus: kind === 'send' ? 'sent_request' : kind === 'accept' ? 'friend' : 'none', requestId: kind === 'send' ? 'outgoing' : undefined }, message: '操作已完成' };
      };
      return h(MotionConfig, { reducedMotion: 'user' }, h('div', { className: 'app-frame' }, h('div', { className: 'app-layout authenticated friends-mode' }, h('header', { className: 'topbar' }, 'Adrift'), h(Friends, {
        user: { _id: 'self', name: 'Keeper', userCode: 'keeper' }, friends, friendRequests: incoming, sentFriendRequests: sent, socialRefreshToken: revision,
        onSendFriendRequest: id => action('send', id), onCancelFriendRequest: id => action('cancel', id), onAcceptFriendRequest: id => action('accept', id), onRejectFriendRequest: id => action('reject', id), onDeleteFriend: id => action('remove', id),
        onRefresh: async () => {}, onOpenMap() {}, onOpenDiary: async (id, signal) => {
          window.openedSocialDiary = id;
          if (window.deferSocialOpen) await new Promise((resolve, reject) => { window.pendingSocialOpen = { signal, resolve, reject }; });
        }
      }))));
    }
    createRoot(document.getElementById('root')).render(h(React.StrictMode, null, h(Harness)));
  });
  await page.getByRole('tab', { name: '我的好友' }).waitFor();
  await page.getByRole('button', { name: '查看 River 的個人資料' }).click();
  await page.getByRole('button', { name: /河邊的風/ }).click();
  assert.equal(await page.evaluate(() => window.openedSocialDiary), 'visible-memory');
  await page.getByRole('button', { name: '共同地點', exact: true }).click();
  await page.getByRole('heading', { name: '你們都留下過記憶的地方' }).waitFor();
  await page.getByRole('button', { name: /你的記憶.*我的河岸/ }).click();
  assert.equal(await page.evaluate(() => window.openedSocialDiary), 'own-memory');
  await page.getByRole('button', { name: '可見記憶', exact: true }).click();
  await page.evaluate(() => { window.deferSocialOpen = true; });
  await page.getByRole('button', { name: /河邊的風/ }).click();
  await page.waitForFunction(() => window.pendingSocialOpen);
  await page.evaluate(() => window.socialHarness.setRevision(value => value + 1));
  await page.waitForFunction(() => window.pendingSocialOpen.signal.aborted);
  await page.evaluate(() => { window.deferSocialOpen = false; window.pendingSocialOpen.reject(new Error('Stale profile request')); });
  await page.waitForFunction(() => [...document.querySelectorAll('.hub-memory')].some(button => !button.disabled));
  assert.equal(await page.getByText('Stale profile request', { exact: true }).count(), 0, 'an aborted profile request must not overwrite its replacement');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '管理好友 River' }).click();
  await page.keyboard.press('End');
  assert.equal(await page.getByRole('menuitem', { name: '移除好友' }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: '管理好友 River' }).evaluate(el => el === document.activeElement), true);
  await page.getByRole('tab', { name: '好友邀請' }).click();
  await page.getByRole('button', { name: '接受', exact: true }).click();
  await page.getByText('目前沒有新的好友邀請。', { exact: true }).waitFor();
  await page.getByRole('tab', { name: '探索使用者' }).click();
  const search = page.getByRole('textbox', { name: '搜尋使用者' });
  await search.fill('x'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.socialSearches.length), 0);
  await search.fill('old'); await page.waitForFunction(() => window.socialSearches.length === 1);
  await search.fill('meadow'); await page.waitForFunction(() => window.socialSearches.length === 2);
  assert.equal(await page.evaluate(() => window.socialSearches[0].signal.aborted), true);
  await page.evaluate(() => window.socialSearches[1].resolve({ data: [{ _id: 'meadow', name: 'Meadow', userCode: 'meadow' }] }));
  await page.locator('.hub-results .hub-person-row').waitFor();
  const invite = page.locator('.hub-results').getByRole('button', { name: '加入好友' });
  await invite.evaluate(button => { button.click(); button.click(); });
  assert.equal(await page.evaluate(() => window.socialActions.filter(item => item.kind === 'send').length), 1);
  await page.evaluate(() => window.finishSocialAction());
  await page.locator('.hub-results').getByRole('button', { name: '撤回邀請' }).waitFor();
  await page.locator('.hub-results').getByRole('button', { name: '撤回邀請' }).click();
  assert.equal(await page.evaluate(() => window.socialActions.at(-1).kind), 'cancel');
  await search.fill('not-found'); await page.waitForFunction(() => window.socialSearches.at(-1).q === 'not-found');
  await page.evaluate(() => window.socialSearches.at(-1).resolve({ data: [] }));
  await page.getByText('找不到符合條件的使用者。', { exact: true }).waitFor();
  await search.fill('failure'); await page.waitForFunction(() => window.socialSearches.at(-1).q === 'failure');
  await page.evaluate(() => window.socialSearches.at(-1).reject(new Error('搜尋暫時無法使用')));
  await page.getByRole('button', { name: '重新搜尋' }).click();
  await page.waitForFunction(() => window.socialSearches.filter(item => item.q === 'failure').length === 2);
  await page.evaluate(() => window.socialSearches.at(-1).resolve({ data: [] }));
  await page.getByRole('tab', { name: '我的好友' }).click();
  await page.evaluate(() => window.socialHarness.setFriends(Array.from({ length: 125 }, (_, index) => ({ _id: `friend-${index}`, name: `好友 ${String(index).padStart(3, '0')}`, userCode: `friend-${index}` }))));
  await page.waitForFunction(() => document.querySelectorAll('.hub-directory .hub-person-row').length === 24);
  await page.getByRole('button', { name: '載入更多好友' }).click();
  assert.equal(await page.locator('.hub-directory .hub-person-row').count(), 48);
  await page.waitForTimeout(2800);
  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const width of [320, 375, 390, 430, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${theme} ${width}: no horizontal overflow`);
      assert.equal(await page.locator('.hub-page').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await page.screenshot({ path: `/tmp/adrift-hub-${theme}-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '查看 好友 000 的個人資料' }).click();
  await page.getByRole('dialog').waitFor();
  const sheet = await page.locator('.hub-profile-sheet').boundingBox();
  assert.ok(sheet.x >= 0 && sheet.width <= 390);
  await page.screenshot({ path: '/tmp/adrift-hub-profile-mobile.png' });
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '管理好友 好友 000' }).click();
  await page.getByRole('menuitem', { name: '移除好友' }).click();
  await page.getByRole('button', { name: '移除好友', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.socialActions.at(-1).kind), 'remove');
  assert.deepEqual(errors, []);
  console.log('PASS: social navigation, profile/memories/shared places, keyboard menus, invite lifecycle, debounce/cancellation/retry, duplicate guard, 125-friend pagination, themes, 320–1440px, mobile sheet and reduced motion.');
} catch (error) {
  await page.screenshot({ path: '/tmp/adrift-hub-failure.png', fullPage: true });
  console.log({ errors, state: await page.evaluate(() => ({ focus: document.activeElement?.outerHTML.slice(0, 500), row: document.querySelector('.hub-person-row')?.getBoundingClientRect().toJSON(), wrapper: document.querySelector('.hub-directory')?.outerHTML.slice(0, 1200) })) }); throw error;
} finally { await browser.close(); }
