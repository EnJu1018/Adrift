import assert from 'node:assert/strict';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await (process.env.BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (/Warning:|Each child in a list|Invalid hook call/i.test(message.text())) errors.push(message.text()); });
try {
  await page.route('**/src/main.jsx', async route => {
    const response = await route.fetch(), source = await response.text();
    await route.fulfill({ response, body: source.slice(0, source.indexOf('createRoot(document')) + '\nimport "/src/DesktopApp.jsx";' });
  });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5178');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/LifeMapAI.jsx')).text(), main = await (await fetch('/src/main.jsx')).text();
    const React = (await import(source.match(/from "([^"]*deps\/react\.js[^"]*)"/)[1])).default;
    const { createRoot } = (await import(main.match(/from "([^"]*react-dom_client[^"]*)"/)[1])).default;
    const { api } = await import(source.match(/from "([^"]*\/api\/client\.js[^"]*)"/)[1]);
    const { default: Intelligence } = await import('/src/components/LifeMapAI.jsx');
    window.overviewCalls = []; window.insightCalls = []; window.chatCalls = [];
    const deferred = (calls, signal, fields = {}) => new Promise((resolve, reject) => {
      calls.push({ ...fields, resolve, reject, signal }); signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    api.getIntelligenceOverview = (days, signal) => deferred(window.overviewCalls, signal, { days });
    api.getLifeMapInsight = signal => deferred(window.insightCalls, signal);
    api.chatMemory = (message, history, signal) => deferred(window.chatCalls, signal, { message, history });
    window.overviewFixture = days => ({ days, count: 8, placeCount: 2, start: new Date(Date.parse('2026-10-23T08:00:00Z') - days * 86400000).toISOString(), end: '2026-10-23T08:00:00Z',
      moods: [{ type: 'calm', count: 5 }, { type: 'joy', count: 2 }, { type: 'confused', count: 1 }],
      daily: [{ date: '2026-10-20', count: 2, averageIntensity: 2, intensityCount: 2 }, { date: '2026-10-21', count: 2, averageIntensity: 3, intensityCount: 2 }, { date: '2026-10-22', count: 4, averageIntensity: 4, intensityCount: 4 }],
      places: [{ name: '河岸公園', count: 5, mood: 'calm', diaryId: 'river-memory' }, { name: '學校', count: 3, mood: 'confused', diaryId: 'school-memory' }] });
    window.insightFixture = { summary: '你在熟悉的地方，慢慢整理生活的節奏。', moodTrend: { description: '平靜是記錄裡最常出現的心情。', dominantMood: 'calm', averageIntensity: 3 }, locationInsights: [{ place: '河岸公園', dominantMood: 'calm', insight: '散步時常留下平靜的記錄。' }], behaviorPatterns: ['傍晚記錄散步的片段。'], suggestions: ['留意下一次散步時的心情。'] };
    const h = React.createElement;
    function Harness() {
      const [state, setState] = React.useState({ status: 'idle' }), [mounted, setMounted] = React.useState(true);
      window.intelligenceHarness = { setState, setMounted };
      return h('main', { className: 'app-frame' }, h('div', { className: 'app-layout authenticated ai-mode' }, h('header', { className: 'topbar' }, 'Adrift'), mounted && h(Intelligence, { state, onStateChange: setState, onBack() {}, onNewDiary: () => { window.newDiaryOpened = true; },
        onOpenDiary: async id => { if (id === 'deleted') throw Object.assign(new Error('Not found'), { status: 404 }); window.openedDiary = id; }
      })));
    }
    window.intelligenceRoot = createRoot(document.getElementById('root'));
    window.intelligenceRoot.render(h(React.StrictMode, null, h(Harness)));
  });
  await page.waitForFunction(() => window.overviewCalls.length > 0);
  await page.evaluate(() => window.overviewCalls.at(-1).resolve({ data: window.overviewFixture(30) }));
  await page.getByRole('heading', { name: '情緒分布', exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Adrift Intelligence', exact: true }).count(), 1);
  assert.equal(await page.locator('#intelligence-chat').isVisible(), false);
  assert.equal(await page.locator('.intel-mood-row').count(), 3);
  await page.getByRole('button', { name: /河岸公園/ }).click();
  assert.equal(await page.evaluate(() => window.openedDiary), 'river-memory');
  await page.locator('.intel-trend-point').last().click();
  assert.equal(await page.locator('#intelligence-chat').isVisible(), false, 'inspecting a chart point must not unexpectedly open chat');
  await page.locator('.ui-tooltip-wrap[data-visible="true"]').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.intel-trend-point').last().evaluate(el => el.blur());
  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const width of [1920, 1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${theme} ${width}: page overflow`);
      assert.equal(await page.locator('.intelligence-page').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await page.locator('.intelligence-page').evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: `/tmp/adrift-intelligence-${theme}-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '產生智慧洞察' }).evaluate(button => { button.click(); button.click(); });
  assert.equal(await page.evaluate(() => window.insightCalls.length), 1);
  await page.evaluate(() => window.insightCalls[0].resolve({ data: window.insightFixture }));
  await page.getByText('你在熟悉的地方，慢慢整理生活的節奏。', { exact: true }).waitFor();
  const result = page.locator('.intel-review-result'), refresh = page.getByRole('button', { name: '更新 AI 回顧' });
  await result.evaluate(el => { window.retainedResult = el; });
  await refresh.click();
  assert.equal(await result.evaluate(el => el === window.retainedResult), true);
  await page.evaluate(() => window.insightCalls.at(-1).reject(new Error('智慧功能使用量已達限制，請稍後或明天再試。')));
  await page.getByRole('alert').filter({ hasText: '已保留上次的結果' }).waitFor();
  assert.equal(await result.isVisible(), true);
  await page.locator('.intelligence-page').evaluate(el => { el.scrollTop = 250; el.dispatchEvent(new Event('scroll')); window.insightReadingPosition = el.scrollTop; });
  await page.getByRole('tab', { name: '記憶對話' }).evaluate(el => el.click());
  await page.getByRole('tab', { name: '智慧洞察' }).evaluate(el => el.click());
  assert.equal(await page.locator('.intelligence-page').evaluate(el => el.scrollTop), await page.evaluate(() => window.insightReadingPosition), 'switching modes restores the Insights reading position');
  await page.getByRole('combobox', { name: '統計期間' }).selectOption('90');
  await page.waitForFunction(() => window.overviewCalls.at(-1).days === 90);
  await page.getByRole('combobox', { name: '統計期間' }).selectOption('7');
  await page.waitForFunction(() => window.overviewCalls.at(-1).days === 7);
  assert.equal(await page.evaluate(() => window.overviewCalls.find(call => call.days === 90).signal.aborted), true);
  await page.evaluate(() => window.overviewCalls.at(-1).resolve({ data: window.overviewFixture(7) }));
  await page.getByRole('button', { name: '深入詢問這段期間' }).click();
  const input = page.getByRole('textbox', { name: '詢問你的記憶' });
  assert.equal(await input.inputValue(), '幫我回顧最近 7 天的心情變化');
  await page.getByRole('button', { name: '新對話', exact: true }).click();
  await page.getByRole('heading', { name: '和你的記憶聊聊。' }).waitFor();
  await page.getByRole('button', { name: '回顧我最近的心情', exact: true }).click();
  await page.waitForFunction(() => window.chatCalls.length === 1);
  await page.getByRole('tab', { name: '智慧洞察' }).click();
  assert.equal(await result.isVisible(), true);
  await page.evaluate(() => window.chatCalls[0].resolve({ data: { status: 'success', answer: '## 熟悉的河岸\n\n**平靜**是這段記錄的主題。\n- 河岸散步\n- 整理想法\n\n<script>window.unsafeAnswer=true</script>', relatedDiaries: [{ id: 'deleted', title: '已刪除的記憶', createdAt: '2026-10-22', place: '河岸', mood: { type: 'calm' } }] } }));
  for (let index = 0; index < 4; index++) { await page.getByRole('tab', { name: '記憶對話' }).click(); await page.getByRole('tab', { name: '智慧洞察' }).click(); }
  await page.getByRole('tab', { name: '記憶對話' }).click();
  assert.equal(await page.locator('.memory-chat-message.user').count(), 1);
  assert.equal(await page.locator('.memory-chat-intro').count(), 0);
  assert.equal(await page.locator('.memory-chat-answer strong').innerText(), '平靜');
  assert.equal(await page.evaluate(() => window.unsafeAnswer), undefined);
  await page.getByRole('button', { name: /已刪除的記憶/ }).click();
  await page.locator('.memory-chat-unavailable').waitFor();
  assert.equal(await page.getByText('已刪除的記憶', { exact: true }).count(), 0);
  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const width of [1920, 1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const composer = await page.locator('.memory-chat-composer').boundingBox();
      assert.ok(composer.y >= 0 && composer.y + composer.height <= 1000, `visible composer ${theme} ${width}`);
      assert.equal(await page.locator('.memory-chat').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      assert.equal(await page.locator('.intelligence-page').evaluate(el => el.scrollHeight <= el.clientHeight + 1), true, 'chat uses only its transcript scroller');
      await page.screenshot({ path: `/tmp/adrift-intelligence-chat-${theme}-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 390, height: 420 });
  await page.waitForFunction(() => document.querySelector('.intelligence-page').dataset.compactViewport === 'true');
  const composer = await page.locator('.memory-chat-composer').boundingBox();
  assert.ok(composer.y + composer.height <= 420);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.intelligenceHarness.setState(current => ({ ...current, chat: { draft: '', messages: Array.from({ length: 20 }, (_, index) => ({ id: `entry-${index}`, role: index % 2 ? 'assistant' : 'user', status: 'complete', content: '這是值得回顧的生活記憶。'.repeat(20) })) } })));
  await page.locator('.memory-chat-transcript').evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); });
  await page.evaluate(() => window.intelligenceHarness.setState(current => ({ ...current, chat: { ...current.chat, messages: [...current.chat.messages, { id: 'latest', role: 'assistant', status: 'complete', content: '最新回覆' }] } })));
  await page.getByRole('button', { name: '查看最新回覆' }).waitFor();
  assert.equal(await page.locator('.memory-chat-transcript').evaluate(el => el.scrollTop), 0);
  await page.getByRole('button', { name: '查看最新回覆' }).click();
  assert.ok(await page.locator('.memory-chat-transcript').evaluate(el => el.scrollTop > 0));
  await page.getByRole('button', { name: '新對話', exact: true }).click();
  await page.getByRole('tab', { name: '智慧洞察' }).click();
  await page.getByRole('button', { name: '重新整理記錄統計' }).click();
  await page.evaluate(() => window.overviewCalls.at(-1).reject(new Error('連線中斷')));
  await page.getByRole('alert').filter({ hasText: '連線中斷' }).waitFor();
  assert.equal(await page.locator('.intel-metrics').count(), 1, 'failed refresh retains previous statistics');
  await page.getByRole('button', { name: '重新載入統計' }).click();
  await page.evaluate(() => window.overviewCalls.at(-1).resolve({ data: { ...window.overviewFixture(7), count: 0, daily: [], moods: [], places: [], placeCount: 0 } }));
  await page.getByRole('heading', { name: '這段日子，還沒有留下記錄' }).waitFor();
  await page.getByRole('button', { name: '留下新的記憶' }).click();
  assert.equal(await page.evaluate(() => window.newDiaryOpened), true);
  await page.getByRole('button', { name: '重新整理記錄統計' }).click();
  await page.evaluate(() => window.intelligenceHarness.setMounted(false));
  await page.waitForFunction(() => window.overviewCalls.at(-1).signal.aborted);
  await page.evaluate(() => window.intelligenceHarness.setMounted(true));
  await page.getByRole('heading', { name: '這段日子，還沒有留下記錄' }).waitFor();
  assert.equal(await page.getByRole('button', { name: '重新整理記錄統計' }).isDisabled(), false, 'an interrupted refresh cannot leave cached statistics stuck loading');
  await page.route('**/src/components/MapView.jsx', route => route.fulfill({ contentType: 'text/javascript', body: 'export default function MapView() { return null; }' }));
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/LifeMapAI.jsx')).text();
    const React = (await import(source.match(/from "([^"]*deps\/react\.js[^"]*)"/)[1])).default;
    const { api, saveAuth } = await import(source.match(/from "([^"]*\/api\/client\.js[^"]*)"/)[1]);
    const user = { id: 'keeper', _id: 'keeper', name: 'Keeper', userCode: 'keeper', role: 'user' };
    saveAuth('isolated-intelligence-app-session', user);
    window.EventSource = class extends EventTarget { close() {} };
    api.getMe = async () => ({ data: user });
    api.getDiaries = async () => ({ data: { diaries: [] } });
    api.getFriends = api.getFriendRequests = api.getSentFriendRequests = async () => ({ data: [] });
    api.getIntelligenceOverview = async days => ({ data: window.overviewFixture(days) });
    history.replaceState(null, '', '/ai/life-map');
    const { default: App } = await import('/src/App.jsx');
    window.intelligenceRoot.render(React.createElement(React.StrictMode, null, React.createElement(App)));
  });
  await page.getByRole('button', { name: '使用者選單', exact: true }).waitFor();
  await page.getByRole('heading', { name: '情緒分布', exact: true }).waitFor();
  await page.getByRole('tab', { name: '記憶對話' }).click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(80);
    const composer = await page.locator('.memory-chat-composer').boundingBox();
    assert.ok(composer.y + composer.height <= 900, `real App composer at ${width}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `/tmp/adrift-intelligence-app-${width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: real overview charts, scoped ranges/cancellation, AI refresh retention/errors, stable modes, Markdown safety, citation revocation, reader scroll, keyboard viewport, 320–1920px, themes and reduced motion.');
} catch (error) {
  await page.screenshot({ path: '/tmp/adrift-intelligence-failure.png', fullPage: true });
  console.error({ errors }); throw error;
} finally { await browser.close(); }
