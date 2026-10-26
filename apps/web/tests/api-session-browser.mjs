import assert from 'node:assert/strict';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await (process.env.BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
try {
  const page = await browser.newPage();
  await page.route('**/src/main.jsx', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5178');
  const result = await page.evaluate(async () => {
    const { api, saveAuth } = await import('/src/api/client.js');
    const pending = [], deadlines = [];
    const schedule = window.setTimeout;
    window.setTimeout = (callback, ms, ...args) => { deadlines.push(ms); return schedule(callback, ms, ...args); };
    window.fetch = (_url, options) => new Promise((resolve, reject) => {
      pending.push({ resolve, signal: options.signal });
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    let expired = 0;
    window.addEventListener('adrift:auth-expired', () => expired++);
    const outcomes = [];
    for (const status of [200, 401]) {
      saveAuth('old-account', { name: 'Old' });
      const response = api.getFriends().catch(error => error);
      saveAuth('new-account', { name: 'New' });
      pending.at(-1).resolve(new Response(JSON.stringify({ success: status === 200, data: ['old-private-data'] }), { status }));
      outcomes.push({ name: (await response).name, token: localStorage.getItem('adrift_token'), expired });
    }
    const failed = api.getMe().catch(error => error);
    pending.at(-1).resolve(new Response(JSON.stringify({ success: false, message: 'Temporarily unavailable' }), { status: 503 }));
    const failure = { status: (await failed).status, token: localStorage.getItem('adrift_token'), expired };
    const controller = new AbortController();
    const cancelled = api.chatMemory('我的日記', [], controller.signal).catch(error => error);
    controller.abort();
    const cancellation = { name: (await cancelled).name, aborted: pending.at(-1).signal.aborted };
    for (const invoke of [() => api.getLifeMapInsight(), () => api.chatMemory('我的日記', []), () => api.getIntelligenceOverview()]) {
      const response = invoke();
      pending.at(-1).resolve(new Response(JSON.stringify({ success: true, data: {} })));
      await response;
    }
    const aiDeadlines = deadlines.slice(-3);
    const invalid = api.getMe().catch(error => error);
    pending.at(-1).resolve(new Response(JSON.stringify({ success: false }), { status: 401 }));
    await invalid;
    return { outcomes, failure, cancellation, aiDeadlines, finalToken: localStorage.getItem('adrift_token'), expired };
  });
  assert.deepEqual(result.outcomes, Array.from({ length: 2 }, () => ({ name: 'AbortError', token: 'new-account', expired: 0 })));
  assert.deepEqual(result.failure, { status: 503, token: 'new-account', expired: 0 });
  assert.deepEqual(result.cancellation, { name: 'AbortError', aborted: true });
  assert.deepEqual(result.aiDeadlines, [65000, 65000, 30000], 'only AI generation extends the existing client deadline');
  assert.equal(result.finalToken, null);
  assert.equal(result.expired, 1);
  console.log('PASS: stale success/401 cannot cross sessions, 503 preserves login, caller cancellation, current-session 401 expires once.');
} finally { await browser.close(); }
