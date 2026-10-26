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
    await route.fulfill({ response, body: text.slice(0, text.indexOf('createRoot(document')) + '\nimport "/src/DesktopApp.jsx";' });
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
    api.getIntelligenceOverview = async days => ({ data: { days, count: 3, start: '2026-09-01', end: '2026-10-01', moods: [{ type: 'calm', count: 3 }], daily: [], placeCount: 0, places: [] } });
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
        h('header', { className: 'topbar' }, 'Adrift'), mounted && h(Intelligence, { state, onStateChange: setState, onBack() { window.viewedDiaries = true; },
          onNewDiary: () => { window.newDiaryOpened = true; }, onOpenDiary: async id => { window.openedCitation = id; }
        }))));
    }
    createRoot(document.getElementById('root')).render(h(React.StrictMode, null, h(Harness)));
  });
  await page.getByText('Original insight', { exact: true }).waitFor();
  await page.getByRole('button', { name: '深入詢問這段期間' }).click();
  const input = page.getByRole('textbox', { name: '詢問你的記憶' });
  assert.equal(await input.inputValue(), '幫我回顧最近 30 天的心情變化');
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
  await page.evaluate(() => window.chatCalls[2].resolve({ data: { answer: '還沒有留下任何記憶，先建立第一篇日記吧。', status: 'empty', scope: 'memory', relatedDiaries: [], evidence: { status: 'NO_DIARIES', matchedCount: 0, totalCount: 0 } } }));
  const firstDiary = page.getByRole('button', { name: '新增第一篇日記' });
  assert.equal(await firstDiary.innerText(), '新增第一篇日記');
  assert.equal(await firstDiary.locator('svg').getAttribute('aria-hidden'), 'true');
  await firstDiary.click();
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
  await page.waitForFunction(() => document.querySelector('.intelligence-page').dataset.compactViewport === 'true');
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
  await page.getByRole('button', { name: '新對話', exact: true }).click();
  await input.fill('幫我深入回顧最近一個月的心情變化');
  await input.press('Enter');
  await page.waitForFunction(() => window.chatCalls.length === 6);
  await page.evaluate(() => window.chatCalls[5].resolve({ data: { answer: '這段期間沒有符合記錄，可以擴大時間。', scope: 'memory', status: 'empty', relatedDiaries: [],
    evidence: { status: 'NO_MATCHES', matchedCount: 0, totalCount: 50, sampledCount: 0 } } }));
  await page.getByRole('button', { name: '調整時間範圍' }).waitFor();
  assert.equal(await page.getByRole('button', { name: '新增第一篇日記' }).count(), 0, 'no-match is not a new-account empty state');
  await page.getByRole('button', { name: '查看我的日記' }).click();
  assert.equal(await page.evaluate(() => window.viewedDiaries), true);
  await page.getByRole('button', { name: '調整時間範圍' }).click();
  assert.equal(await input.inputValue(), '不限時間，延續剛才的問題');
  assert.equal(await page.evaluate(() => window.chatCalls.length), 6, 'adjusting a query does not automatically spend quota');
  await input.fill('半年來'); await input.press('Enter');
  await page.waitForFunction(() => window.chatCalls.length === 7);
  assert.deepEqual(await page.evaluate(() => window.chatCalls[6].history), [{ role: 'user', content: '幫我深入回顧最近一個月的心情變化' }]);
  await page.evaluate(() => window.chatCalls[6].reject(Object.assign(new Error('AI 分析目前請求較多，請稍後再試。'), {
    payload: { stage: 'AI_ERROR', data: { evidence: { status: 'AVAILABLE', totalCount: 50, matchedCount: 24, sampledCount: 16 } } }
  })));
  await page.getByRole('alert').filter({ hasText: 'AI 分析目前請求較多' }).waitFor();
  await page.getByText('本次找到 24 篇記錄 · 閱讀 16 篇內文片段', { exact: true }).waitFor();
  await page.getByRole('button', { name: '重試', exact: true }).click();
  await page.waitForFunction(() => window.chatCalls.length === 8);
  assert.deepEqual(await page.evaluate(() => window.chatCalls[7].history), await page.evaluate(() => window.chatCalls[6].history));
  await page.evaluate(() => window.chatCalls[7].resolve({ data: { answer: '現有兩篇記錄只能整理片段，無法代表完整半年。[1]', scope: 'memory', status: 'success', relatedDiaries: [],
    evidence: { status: 'INSUFFICIENT_EVIDENCE', totalCount: 50, matchedCount: 2, sampledCount: 2 } } }));
  await page.getByText('現有片段不足以判斷長期變化，仍可回顧有記錄的部分。', { exact: true }).waitFor();
  await page.getByRole('tab', { name: '智慧洞察' }).click();
  assert.equal(await page.getByText('Original insight', { exact: true }).isVisible(), true, 'chat failure never resets insights');
  await page.getByRole('tab', { name: '記憶對話' }).click();
  await page.evaluate(() => window.chatTest.setState(current => ({ ...current, chat: { draft: '', messages: Array.from({ length: 14 }, (_, index) => [
    { id: `u${index}`, role: 'user', content: `回顧日記 ${index}` }, { id: `a${index}`, role: 'assistant', status: 'complete', content: '先前的回覆。' }
  ]).flat() } })));
  await input.fill('那去年呢？'); await input.press('Enter');
  await page.waitForFunction(() => window.chatCalls.length === 9);
  const boundedHistory = await page.evaluate(() => window.chatCalls[8].history);
  assert.equal(boundedHistory.length, 12); assert.equal(boundedHistory[0].content, '回顧日記 2');
  assert.ok(boundedHistory.every(item => item.role === 'user'));
  await page.evaluate(() => window.chatCalls[8].resolve({ data: { answer: '去年的回顧。', status: 'success', scope: 'memory' } }));
  await page.getByText('去年的回顧。', { exact: true }).waitFor();
  await page.evaluate(() => window.chatTest.setState(current => ({ ...current, chat: { draft: '', messages: [
    { id: 'prior-question', role: 'user', content: '最近半年的心情變化？' },
    { id: 'prior-error', role: 'assistant', question: '最近半年的心情變化？', status: 'error', error: '先前失敗。' },
    { id: 'future-question', role: 'user', content: '改成去年。' },
    { id: 'future-answer', role: 'assistant', status: 'complete', content: '後來的回答。' }
  ] } })));
  await page.getByRole('button', { name: '重試', exact: true }).click();
  await page.waitForFunction(() => window.chatCalls.length === 10);
  assert.deepEqual(await page.evaluate(() => window.chatCalls[9].history), [], 'retry excludes its original question and later turns');
  assert.equal(await page.evaluate(() => window.chatCalls[9].message), '最近半年的心情變化？');
  await page.evaluate(() => window.chatCalls[9].resolve({ data: { answer: '半年的回顧已恢復。', status: 'success', scope: 'memory' } }));
  await page.getByText('半年的回顧已恢復。', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: Insights/chat isolation, IME, duplicate guard, 12-turn context, original-turn retry, citations, distinct empty states, preserved evidence, partial analysis, cancellation, themes/mobile and reduced motion.');
} catch (error) {
  await page.screenshot({ path: '/tmp/adrift-memory-chat-failure.png', fullPage: true });
  console.log({ errors, dom: await page.evaluate(() => document.querySelector('.memory-chat')?.outerHTML.slice(-3500) || document.body.innerText) });
  throw error;
} finally { await browser.close(); }
