import assert from 'node:assert/strict';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await (process.env.BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/src/main.jsx', async route => {
    const response = await route.fetch();
    const text = await response.text();
    await route.fulfill({ response, body: text.slice(0, text.indexOf('createRoot(document')) });
  });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5178');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/AuthPanel.jsx')).text();
    const main = await (await fetch('/src/main.jsx')).text();
    const React = (await import(source.match(/from "([^"]*deps\/react\.js[^"]*)"/)[1])).default;
    const { createRoot } = (await import(main.match(/from "([^"]*react-dom_client[^"]*)"/)[1])).default;
    const { MotionConfig } = await import(source.match(/from "([^"]*framer-motion[^"]*)"/)[1]);
    const chatSource = await (await fetch('/src/components/MemoryChat.jsx')).text();
    const { api } = await import(chatSource.match(/from "([^"]*\/api\/client\.js[^"]*)"/)[1]);
    const { default: Intelligence } = await import('/src/components/LifeMapAI.jsx');
    window.chatCalls = [];
    api.chatMemory = (message, history, signal) => new Promise((resolve, reject) => {
      window.chatCalls.push({ message, history, resolve, reject, signal });
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    const h = React.createElement;
    function Harness() {
      const [state, setState] = React.useState({ status: 'success', insight: { summary: 'Original insight', moodTrend: { averageIntensity: 3 } } });
      const [mounted, setMounted] = React.useState(true);
      window.chatTest = { setState, setMounted };
      return h(MotionConfig, { reducedMotion: 'user' }, h('div', { className: 'app-frame' }, h('div', { className: 'app-layout authenticated ai-mode' },
        h('header', { className: 'topbar' }, 'Adrift'), mounted && h(Intelligence, { state, onStateChange: setState, onBack() {},
          onNewDiary: () => { window.newDiaryOpened = true; }, onOpenDiary: async id => { window.openedCitation = id; }
        }))));
    }
    createRoot(document.getElementById('root')).render(h(React.StrictMode, null, h(Harness)));
  });
  await page.getByText('Original insight', { exact: true }).waitFor();
  await page.getByRole('button', { name: '深入詢問這段期間' }).click();
  const input = page.getByRole('textbox', { name: '詢問你的記憶' });
  assert.equal(await input.inputValue(), '幫我深入回顧最近一個月的心情變化');
  await input.fill('我上個月的心情如何？');
  await input.dispatchEvent('compositionstart');
  await input.press('Enter');
  assert.equal(await page.evaluate(() => window.chatCalls.length), 0, 'IME composition does not submit');
  await input.dispatchEvent('compositionend');
  await input.press('Enter');
  await page.waitForFunction(() => window.chatCalls.length === 1);
  await page.getByRole('button', { name: '送出記憶問題' }).evaluate(el => el.click());
  assert.equal(await page.evaluate(() => window.chatCalls.length), 1);
  assert.equal(await page.getByRole('button', { name: '送出記憶問題' }).isDisabled(), true);
  await page.evaluate(() => window.chatCalls[0].resolve({ data: { answer: '你在臺北留下平靜的散步記憶。[1]', scope: 'memory', status: 'success', relatedDiaries: [
    { id: 'memory-one', title: '河邊的風', createdAt: '2026-09-15T04:00:00Z', place: '臺北', mood: { type: 'calm' } }
  ] } }));
  await page.getByText('你在臺北留下平靜的散步記憶。[1]', { exact: true }).waitFor();
  await page.getByRole('button', { name: /河邊的風/ }).click();
  assert.equal(await page.evaluate(() => window.openedCitation), 'memory-one');
  await page.getByRole('tab', { name: '智慧洞察' }).click();
  assert.equal(await page.getByText('Original insight', { exact: true }).isVisible(), true);
  await page.keyboard.press('ArrowRight');
  assert.equal(await input.isVisible(), true);
  await input.fill('那哪一天最開心？');
  await input.press('Enter');
  await page.waitForFunction(() => window.chatCalls.length === 2);
  assert.equal(await page.evaluate(() => window.chatCalls[1].history[0].content), '我上個月的心情如何？');
  await page.evaluate(() => window.chatCalls[1].reject(new Error('服務暫時忙碌')));
  await page.getByRole('alert').filter({ hasText: '服務暫時忙碌' }).waitFor();
  await page.getByRole('button', { name: '重試', exact: true }).click();
  await page.waitForFunction(() => window.chatCalls.length === 3);
  await page.evaluate(() => window.chatCalls[2].resolve({ data: { answer: '目前找不到足夠的日記紀錄來回答這個問題。', status: 'empty', scope: 'memory', relatedDiaries: [] } }));
  await page.getByRole('button', { name: '新增第一篇日記' }).click();
  assert.equal(await page.evaluate(() => window.newDiaryOpened), true);
  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const width of [390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator('.memory-chat').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const composer = await page.locator('.memory-chat-composer').boundingBox();
      assert.ok(composer.y + composer.height <= 1000, `composer visible at ${width}`);
      await page.screenshot({ path: `/tmp/adrift-memory-chat-${theme}-${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 420 });
  await page.waitForFunction(() => document.querySelector('.life-map-panel').dataset.compactViewport === 'true');
  const compactComposer = await page.locator('.memory-chat-composer').boundingBox();
  assert.ok(compactComposer.y + compactComposer.height <= 420, 'composer remains visible in a keyboard-sized viewport');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '新對話', exact: true }).click();
  assert.equal(await page.locator('.memory-chat-message').count(), 0);
  await page.getByRole('button', { name: '回顧我最近的心情', exact: true }).click();
  await page.waitForFunction(() => window.chatCalls.length === 4);
  await page.getByRole('button', { name: '新對話', exact: true }).click();
  assert.equal(await page.evaluate(() => window.chatCalls[3].signal.aborted), true);
  await page.waitForTimeout(30);
  assert.equal(await page.locator('.memory-chat-message').count(), 0, 'cancelled reply cannot repopulate a new conversation');
  await input.fill('最近有哪些回憶？');
  await input.press('Enter');
  await page.waitForFunction(() => window.chatCalls.length === 5);
  await page.evaluate(() => window.chatTest.setMounted(false));
  await page.waitForFunction(() => window.chatCalls[4].signal.aborted);
  await page.evaluate(() => window.chatTest.setMounted(true));
  await page.getByRole('button', { name: '重試', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: Insights/chat tabs, prefill, IME, duplicate guard, context, citations, retry, empty state, cancellation, themes/mobile and reduced motion.');
} catch (error) {
  await page.screenshot({ path: '/tmp/adrift-memory-chat-failure.png', fullPage: true });
  console.log({ errors, dom: await page.evaluate(() => document.querySelector('.memory-chat')?.outerHTML.slice(-3500) || document.body.innerText) });
  throw error;
} finally { await browser.close(); }
