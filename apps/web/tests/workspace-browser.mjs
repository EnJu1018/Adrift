import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.route('**/src/main.jsx', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.slice(0, source.indexOf('createRoot(document')) });
  });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5178');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/ui/Modal.jsx')).text();
    const main = await (await fetch('/src/main.jsx')).text();
    const React = (await import(source.match(/from "([^"]*deps\/react\.js[^"]*)"/)[1])).default;
    const { createRoot } = (await import(main.match(/from "([^"]*react-dom_client[^"]*)"/)[1])).default;
    const { MotionConfig } = await import(source.match(/from "([^"]*framer-motion[^"]*)"/)[1]);
    const { api } = await import('/src/api/client.js');
    const modules = {};
    for (const name of ['FeedPage', 'FriendsPage', 'AccountSettings', 'AdminDashboard', 'LifeMapAI']) {
      modules[name] = (await import('/src/components/' + name + '.jsx')).default;
    }
    const h = React.createElement;
    const owner = { _id: 'owner', name: 'Memory Keeper', email: 'owner@example.test', userCode: 'keeper', role: 'owner' };
    const friend = { _id: 'friend', name: 'River', userCode: 'river', email: 'river@example.test', role: 'user' };
    const diaries = ['public', 'friends', 'private'].map((visibility, index) => ({
      _id: visibility, title: visibility + ' memory', text: 'A quiet afternoon by the river.',
      visibility, user: friend, createdAt: '2026-09-01T10:00:00Z', mood: { type: 'calm', intensity: 3 }
    }));
    window.opened = [];
    window.insightCalls = 0;
    api.getAdminStats = async () => ({ data: { totalUsers: 2 } });
    api.getAdminUsers = async () => ({ data: { items: [owner, friend] } });
    api.getAdminDiaries = async () => ({ data: { items: [] } });
    api.updateAdminUserRole = async (id, role) => { window.roleChange = { id, role }; return { data: { role } }; };
    api.getLifeMapInsight = () => {
      window.insightCalls++;
      return new Promise(resolve => { window.finishInsight = resolve; });
    };
    function Harness() {
      const [view, setView] = React.useState('FeedPage');
      const [user, setUser] = React.useState(owner);
      const [state, setState] = React.useState({ status: 'idle' });
      window.workspace = { setView, setState };
      const shared = { user, diaries, onBack() {}, onOpenDiary: diary => window.opened.push(diary._id) };
      const props = {
        FeedPage: shared,
        AccountSettings: { ...shared, onUpdateName: async name => setUser(current => ({ ...current, name })) },
        FriendsPage: { ...shared, friends: [friend],
          friendRequests: [{ requestId: 'received', from: friend }],
          sentFriendRequests: [{ requestId: 'sent', to: friend }] },
        AdminDashboard: shared,
        LifeMapAI: { state, onStateChange: setState, onBack() {} }
      };
      const mode = { FeedPage: 'feed', FriendsPage: 'friends', LifeMapAI: 'ai', AccountSettings: 'settings', AdminDashboard: 'admin' }[view];
      return h(MotionConfig, { reducedMotion: 'user' },
        h('main', { className: 'app-frame' },
          h('div', { className: 'app-layout authenticated ' + mode + '-mode' },
            view !== 'AdminDashboard' && h('header', { className: 'topbar', style: { gridColumn: '1 / -1' } }, 'Adrift'),
            h(modules[view], { ...props[view], key: view }))));
    }
    createRoot(document.getElementById('root')).render(h(React.StrictMode, null, h(Harness)));
  });

  async function view(name, selector) {
    await page.evaluate(name => window.workspace.setView(name), name);
    await page.locator(selector).waitFor();
    await page.waitForTimeout(700);
  }
  assert.equal(await page.locator('.feed-card').count(), 2);
  const first = page.locator('.feed-card').first();
  await first.focus();
  const scroll = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Space');
  assert.deepEqual(await page.evaluate(() => window.opened), ['public']);
  assert.equal(await page.evaluate(() => window.scrollY), scroll);
  await first.evaluate(el => { window.retainedCard = el; });
  await page.locator('.feed-filter').getByRole('button', { name: '公開', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.feed-card').length === 1);
  assert.equal(await page.locator('.feed-card').count(), 1);
  assert.equal(await first.evaluate(el => el === window.retainedCard), true);
  assert.equal(await page.locator('.feed-filter button.active').getAttribute('aria-pressed'), 'true');

  await view('AccountSettings', '.settings-page');
  const row = page.locator('.settings-row').filter({ has: page.locator('.settings-row-label', { hasText: '使用者名稱' }) });
  await row.getByRole('button', { name: '編輯' }).click();
  assert.equal(await row.locator('input').evaluate(el => el === document.activeElement), true);
  await row.getByRole('button', { name: '取消' }).click();
  assert.equal(await row.getByRole('button', { name: '編輯' }).evaluate(el => el === document.activeElement), true);
  await row.getByRole('button', { name: '編輯' }).click();
  await row.locator('input').fill('Updated Keeper');
  await row.getByRole('button', { name: '儲存', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.settings-row-value strong')?.textContent === 'Updated Keeper');
  assert.equal(await row.getByRole('button', { name: '編輯' }).evaluate(el => el === document.activeElement), true);
  await page.locator('.settings-sidebar').getByRole('button', { name: '帳號安全' }).click();
  assert.equal(await row.isVisible(), false);
  await page.locator('.settings-sidebar').getByRole('button', { name: '個人檔案' }).click();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async value => { window.copiedUserCode = value; } }
  }));
  const copyAction = page.locator('.settings-row-action[data-state]');
  await copyAction.click();
  await page.waitForFunction(() => window.copiedUserCode === 'keeper');
  await page.waitForTimeout(180);
  assert.equal(await copyAction.getAttribute('data-state'), 'copied');
  assert.equal(await copyAction.getAttribute('aria-label'), '已複製使用者 ID');
  assert.equal(await copyAction.locator('.lucide-copy').evaluate(el => getComputedStyle(el).opacity), '0');
  assert.equal(await copyAction.locator('.lucide-check').evaluate(el => getComputedStyle(el).opacity), '1');

  await view('FriendsPage', '.friends-hub');
  const userSearch = page.getByPlaceholder('輸入 userCode，例如 arren1088');
  const emptySearchBox = await userSearch.boundingBox();
  await userSearch.fill('river');
  assert.deepEqual(await userSearch.boundingBox(), emptySearchBox, 'clear control must not resize the search input');
  await page.getByRole('button', { name: '清除使用者搜尋' }).click();
  assert.equal(await userSearch.inputValue(), '');
  const friendSearch = page.getByPlaceholder('搜尋好友名稱或 ID');
  await friendSearch.fill('river');
  await page.getByRole('button', { name: '清除好友篩選' }).click();
  assert.equal(await friendSearch.inputValue(), '');
  await page.getByRole('button', { name: /已送出/ }).evaluate(el => el.click());
  await page.waitForFunction(() => document.querySelector('.social-invite-list')?.inert);
  await page.getByRole('button', { name: '收回', exact: true }).waitFor();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.social-invite-list').count(), 1);
  assert.equal(await page.getByRole('button', { name: /已送出/ }).getAttribute('aria-pressed'), 'true');

  await view('AdminDashboard', '.admin-page');
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  const role = page.getByRole('button', { name: '角色：River', exact: true });
  await role.waitFor();
  assert.equal(await page.locator('.role-pill.self').count(), 1, '_id-only users must not all be treated as self');
  await role.click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.roleChange);
  assert.deepEqual(await page.evaluate(() => window.roleChange), { id: 'friend', role: 'admin' });
  assert.equal(await role.evaluate(el => el === document.activeElement), true);
  await page.waitForTimeout(300);
  await role.click();
  await page.keyboard.press('Escape');
  await page.getByRole('listbox').waitFor({ state: 'detached' });
  assert.equal(await role.evaluate(el => el === document.activeElement), true);

  await page.evaluate(async () => {
    const { api } = await import('/src/api/client.js');
    window.pendingUsers = [];
    window.retainedUserRow = document.querySelector('.users-table .admin-table-row:not(.header)');
    api.getAdminUsers = () => new Promise(resolve => window.pendingUsers.push(resolve));
  });
  await page.getByRole('button', { name: '重新整理', exact: true }).click();
  await page.waitForFunction(() => window.pendingUsers.length === 1);
  assert.equal(await page.locator('.users-table').evaluate(n => n.inert && n.contains(window.retainedUserRow)), true, 'refresh must retain rows while blocking stale actions');
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  await page.waitForFunction(() => window.pendingUsers.length === 2);
  await page.evaluate(() => window.pendingUsers[1]({ data: { items: [{ _id: 'latest', name: 'Latest result', role: 'user' }] } }));
  await page.getByText('Latest result', { exact: true }).waitFor();
  await page.evaluate(() => window.pendingUsers[0]({ data: { items: [{ _id: 'old', name: 'Outdated result', role: 'user' }] } }));
  await page.waitForTimeout(80);
  assert.equal(await page.getByText('Outdated result', { exact: true }).count(), 0);
  await page.evaluate(async () => {
    const { api } = await import('/src/api/client.js');
    api.getAdminUsers = async () => ({ data: { items: [] } });
  });

  await view('LifeMapAI', '.life-map-panel');
  await page.locator('.life-map-hero .life-map-cta').evaluate(el => { el.click(); el.click(); });
  await page.locator('.life-map-loading-state').waitFor();
  assert.equal(await page.evaluate(() => window.insightCalls), 1);
  await page.evaluate(() => window.finishInsight({ data: { summary: 'Your city memories', moodTrend: { description: 'A calm week', dominantMood: '平靜', averageIntensity: 3 }, locationInsights: [], behaviorPatterns: ['Afternoon walks'], suggestions: ['Keep recording'] } }));
  await page.locator('.life-map-dashboard').waitFor();
  assert.equal(await page.locator('[data-insight-reveal]').count(), 4);
  await page.waitForTimeout(750);
  assert.equal(await page.locator('[data-insight-reveal]').evaluateAll(els => els.every(el => getComputedStyle(el).opacity === '1')), true);
  await page.locator('.life-map-dashboard .life-map-secondary-action').evaluate(el => el.click());
  await page.waitForFunction(() => document.querySelector('.life-map-dashboard')?.inert);
  await page.locator('.life-map-loading-state').waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.finishInsight({ data: { summary: 'Reduced motion result' } }));
  await page.locator('.life-map-dashboard').waitFor();
  assert.equal(await page.locator('[data-insight-reveal]').evaluateAll(els => els.every(el => !el.style.transform && !el.style.opacity)), true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(80);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(150);
  assert.equal(await page.locator('[data-insight-reveal]').evaluateAll(els => els.every(el => !el.style.transform && !el.style.opacity)), true, 'live reduced motion restores styles');

  for (const [name, selector] of [['FeedPage', '.feed-page'], ['FriendsPage', '.friends-hub'], ['AccountSettings', '.settings-page'], ['LifeMapAI', '.life-map-panel'], ['AdminDashboard', '.admin-page']]) {
    await view(name, selector);
    for (const theme of ['bright', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(100);
        await page.locator(selector).evaluate(el => { el.scrollTop = 0; });
        assert.ok((await page.locator(selector).boundingBox()).height > 500, 'content occupies main row, not navbar row');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name + ' does not overflow at ' + width);
        assert.equal(await page.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth), true, name + ' content does not overflow at ' + width);
        if (name === 'LifeMapAI') {
          assert.equal(await page.locator('.life-map-hero').evaluate(el => {
            const hero = el.getBoundingClientRect();
            return [...el.querySelectorAll('button')].every(button => {
              const rect = button.getBoundingClientRect();
              return rect.top >= hero.top && rect.bottom <= hero.bottom;
            });
          }), true, 'hero never clips actions');
        }
        if (name === 'AdminDashboard') {
          assert.equal(await page.locator('.admin-tabs button.active').evaluate(el => {
            const style = getComputedStyle(el);
            return style.webkitTextFillColor === style.color && el.getBoundingClientRect().height >= 44;
          }), true, 'active admin tab uses its theme text color and a touch-sized target');
        }
        await page.screenshot({ path: '/tmp/adrift-workspace-' + name + '-' + theme + '-' + width + '.png', fullPage: true });
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: Feed identity/keyboard, Settings focus/save, Friends inert exits, Admin roles/keyboard, Intelligence lifecycle/reduced motion, dark/bright desktop/mobile.');
} finally {
  await browser.close();
}
