import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createServer } from 'vite';
import { chromium, webkit } from 'playwright';
import User from '../../api/src/models/User.js';
import Diary from '../../api/src/models/Diary.js';
import { createAiRouter } from '../../api/src/routes/ai.js';
import { AiServiceError } from '../../api/src/services/gemini.js';
import { createOllamaProvider } from '../../api/src/services/ollama.js';

const uri = process.env.AI_REQUEST_TEST_MONGO_URI;
if (!uri || new URL(uri).hostname !== '127.0.0.1' || !/^\/adrift_ai_request_test_[\w-]+$/.test(new URL(uri).pathname)) throw new Error('An isolated loopback test database is required.');
const secret = 'isolated-ai-request-test-not-production';
const previousSecret = process.env.JWT_SECRET, previousUrl = process.env.VITE_API_URL;
process.env.JWT_SECRET = secret;
let mode = 'success', calls = 0, release, cancelled = 0, bodyCancelled = 0, browser, web, server;
const result = input => input.feature === 'insights'
  ? { summary: '合成日記記錄了完成報告與散步的片段。', moodTrend: { description: '僅反映已記錄的心情。', dominantMood: 'calm' }, locationInsights: [], behaviorPatterns: [], suggestions: [] }
  : { paragraphs: [{ text: '日記記錄了完成報告與散步的片段。', citations: [input.data.diaries.at(-1).id] }] };

// This opt-in transport only receives this suite's synthetic, isolated diaries.
async function realGeneration(input) {
  assert.ok(input.data.diaries.every(diary => diary.title.startsWith('合成測試')));
  const host = process.env.AI_SMOKE_SSH_TARGET;
  assert.match(host, /^[\w@.-]+$/);
  const program = `import dotenv from 'dotenv'; dotenv.config({quiet:true});
    if (process.env.AI_PROVIDER && process.env.AI_PROVIDER !== 'gemini') throw new Error('Provider changed; smoke test stopped');
    const {generateGeminiJson}=await import('./src/services/gemini.js');
    let data=''; for await (const chunk of process.stdin) data+=chunk;
    console.info=()=>{}; console.warn=()=>{};
    try { process.stdout.write(JSON.stringify(await generateGeminiJson(JSON.parse(data)))); }
    catch(error) { process.stdout.write(JSON.stringify({testError:{category:error.category,status:error.status}})); }`;
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', host,
      "cd /var/www/Adrift/apps/api && node --input-type=module -e '" + program.replaceAll("'", "'\\''") + "'"], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.resume();
    child.once('error', reject);
    child.once('close', code => {
      try {
        if (code) throw new Error('Synthetic provider smoke transport failed');
        const data = JSON.parse(stdout);
        if (data.testError) throw new AiServiceError(data.testError.category, data.testError.status);
        resolve(data);
      } catch (error) { reject(error); }
    });
    const { signal, ...body } = input;
    child.stdin.end(JSON.stringify(body));
  });
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  const accounts = await User.create(Array.from({ length: 12 }, (_, index) => ({ name: '合成測試使用者', email: `ai-request-${index}@example.test`, userCode: `ai_request_${index}`, passwordHash: 'synthetic-not-a-login-password' })));
  await Diary.create(accounts.slice(0, -1).flatMap(account => ['private', 'friends', 'public'].map((visibility, index) => ({
    user: account._id, title: '合成測試：' + index, text: index ? '完成報告後和同學散步，覺得開心。' : '在咖啡店讀書和整理報告，覺得平靜。',
    mood: { type: index ? 'joy' : 'calm', intensity: index ? 4 : 2 }, visibility,
    location: { type: 'Point', coordinates: [120.6, 24.1], placeName: '臺中學校' }, createdAt: new Date(Date.now() - (index + 1) * 3600000)
  }))));
  const app = express(); app.use(cors({ exposedHeaders: ['X-Request-ID', 'Retry-After'] })); app.use(express.json());
  app.use('/ai/chat', (_req, res, next) => {
    if (mode === 'html') return res.status(502).type('html').send('<html>Bad Gateway: internal-host secret</html>');
    if (mode === 'empty') return res.status(200).type('json').send('');
    if (mode === 'disconnect') return res.destroy();
    if (mode === 'slow-body') {
      res.status(200).type('json').set('X-Request-ID', 'f63cf2a4-981c-44d6-af3e-b6bb22b5c101');
      res.write('{"success":');
      res.on('close', () => { bodyCancelled++; });
      return;
    }
    next();
  });
  app.use('/ai', createAiRouter({ reserve: async () => {}, generate: async input => {
    calls++;
    const selected = mode;
    if (selected === 'live') return realGeneration(input);
    if (selected === 'offline') return createOllamaProvider({ target: 'ollama', baseUrl: 'http://127.0.0.1:1', timeoutMs: 100 }).chat({ messages: [{ role: 'user', content: 'synthetic' }] });
    if (selected === 'gateway') return createOllamaProvider({ baseUrl: 'http://127.0.0.1:1', token: 'x'.repeat(40), timeoutMs: 100 }).chat({ messages: [{ role: 'user', content: 'synthetic' }] });
    if (selected === 'queue') throw new AiServiceError('queue_full', 429);
    if (selected === 'invalid') return { paragraphs: [{ text: '不能使用的來源。', citations: ['ffffffffffffffffffffffff'] }] };
    if (selected === 'hold') await new Promise((resolve, reject) => {
      release = resolve;
      input.signal.addEventListener('abort', () => { cancelled++; reject(new DOMException('Cancelled', 'AbortError')); }, { once: true });
    });
    return result(input);
  } }));
  app.get('/health', (_req, res) => res.json({ success: true }));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  process.env.VITE_API_URL = `http://127.0.0.1:${server.address().port}`;
  web = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  await web.listen();
  browser = process.env.BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/src/main.jsx', async route => {
    const response = await route.fetch(), source = await response.text();
    await route.fulfill({ response, body: source.slice(0, source.indexOf('createRoot(document')) + '\nimport "/src/DesktopApp.jsx";' });
  });
  await page.goto(web.resolvedUrls.local[0]);
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/LifeMapAI.jsx')).text(), main = await (await fetch('/src/main.jsx')).text();
    const React = (await import(source.match(/from "([^"]*deps\/react\.js[^"]*)"/)[1])).default;
    const { createRoot } = (await import(main.match(/from "([^"]*react-dom_client[^"]*)"/)[1])).default;
    const { default: Intelligence } = await import('/src/components/LifeMapAI.jsx');
    window.testApi = (await import(source.match(/from "([^"]*\/api\/client\.js[^"]*)"/)[1])).api;
    function Harness() {
      const [state, setState] = React.useState({ status: 'idle' }); window.resetAi = setState;
      return React.createElement('main', { className: 'app-frame' }, React.createElement(Intelligence, { state, onStateChange: setState, onBack() {} }));
    }
    createRoot(document.getElementById('root')).render(React.createElement(Harness));
  });
  async function account(index) {
    const token = jwt.sign({ sub: String(accounts[index]._id) }, secret);
    await page.evaluate(token => { localStorage.setItem('adrift_token', token); window.resetAi({ status: 'idle', tab: 'chat', chat: { messages: [], draft: '' } }); }, token);
    await page.getByRole('textbox', { name: '詢問你的記憶' }).waitFor();
  }
  const input = page.getByRole('textbox', { name: '詢問你的記憶' });
  async function send() { await input.fill('回顧我的日記'); await page.getByRole('button', { name: '送出記憶問題' }).click(); }

  await account(0); mode = process.env.AI_SMOKE_SSH_TARGET ? 'live' : 'success';
  await send(); await page.locator('.memory-chat-citations').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('.memory-chat-error').count(), 0);
  await page.getByRole('tab', { name: '智慧洞察' }).click();
  await page.getByRole('heading', { name: '情緒分布', exact: true }).waitFor();
  await page.getByRole('button', { name: '產生智慧洞察' }).click();
  await page.locator('.intel-review-result').waitFor({ timeout: 60000 });
  console.log('PASS normal Chat + Insights: actual JWT/MongoDB/HTTP/browser' + (process.env.AI_SMOKE_SSH_TARGET ? ' and real Gemini synthetic generation.' : ' with synthetic model output.'));

  for (const [index, failure] of ['html', 'empty', 'offline', 'queue', 'invalid', 'disconnect', 'gateway'].entries()) {
    await account(index + 1); mode = failure; await send();
    await page.locator('.memory-chat-error [role="alert"]').waitFor();
    assert.doesNotMatch(await page.locator('.memory-chat-error').innerText(), /Request failed|internal-host|secret|Bad Gateway/);
    assert.equal(await input.inputValue(), '回顧我的日記');
    mode = 'success'; await page.getByRole('button', { name: '重試', exact: true }).click();
    await page.locator('.memory-chat-citations').waitFor();
    assert.equal(await page.locator('.memory-chat-message.user').count(), 1);
    console.log('PASS ' + failure + ': safe error, draft retained, retry recovered without duplicate user messages.');
  }
  await account(7); mode = 'hold'; release = undefined;
  const before = calls; await send();
  while (!release) await new Promise(resolve => setTimeout(resolve, 5));
  const duplicate = await page.evaluate(async () => { try { await window.testApi.chatMemory('回顧我的日記', []); } catch (error) { return { status: error.status, code: error.code, requestId: error.requestId }; } });
  assert.equal(duplicate.status, 409); assert.equal(duplicate.code, 'in_progress'); assert.ok(duplicate.requestId); assert.equal(calls, before + 1);
  release(); await page.locator('.memory-chat-citations').waitFor();
  console.log('PASS actual concurrent duplicate blocked before model generation.');

  await account(8); mode = 'hold'; release = undefined;
  await page.evaluate(() => { window.savedTimer = window.setTimeout; window.setTimeout = (fn, delay, ...args) => window.savedTimer(fn, delay === 65000 ? 50 : delay, ...args); });
  await send(); await page.locator('.memory-chat-error [role="alert"]').waitFor();
  assert.match(await page.locator('.memory-chat-error').innerText(), /較長時間/);
  await page.evaluate(() => { window.setTimeout = window.savedTimer; });
  const cancelDeadline = Date.now() + 5000;
  while (!cancelled && Date.now() < cancelDeadline) await new Promise(resolve => setTimeout(resolve, 5));
  mode = 'success'; await page.getByRole('button', { name: '重試', exact: true }).click(); await page.locator('.memory-chat-citations').waitFor();
  assert.ok(cancelled > 0); console.log('PASS deadline aborts actual HTTP request, server cancels, retry releases in-flight guard.');

  await account(9); mode = 'slow-body';
  await page.evaluate(() => { window.setTimeout = (fn, delay, ...args) => window.savedTimer(fn, delay === 65000 ? 50 : delay, ...args); });
  await send(); await page.locator('.memory-chat-error [role="alert"]').waitFor();
  assert.match(await page.locator('.memory-chat-error').innerText(), /較長時間/);
  assert.match(await page.locator('.memory-chat-error').innerText(), /f63cf2a4-981c-44d6-af3e-b6bb22b5c101/);
  await page.evaluate(() => { window.setTimeout = window.savedTimer; });
  const bodyDeadline = Date.now() + 5000;
  while (!bodyCancelled && Date.now() < bodyDeadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(bodyCancelled > 0);
  mode = 'success'; await page.getByRole('button', { name: '重試', exact: true }).click(); await page.locator('.memory-chat-citations').waitFor();
  console.log('PASS deadline also covers stalled JSON body after headers, preserves request ID and cancels the stream.');

  await account(11); mode = 'success'; const count = calls;
  await send(); await page.getByRole('button', { name: '新增第一篇日記' }).waitFor(); assert.equal(calls, count);
  const expired = jwt.sign({ sub: String(accounts[0]._id) }, secret, { expiresIn: -1 });
  const auth = await page.evaluate(async token => { localStorage.setItem('adrift_token', token); try { await window.testApi.getIntelligenceOverview(); } catch (error) { return { status: error.status, message: error.message, token: localStorage.getItem('adrift_token') }; } }, expired);
  assert.equal(auth.status, 401); assert.equal(auth.token, null); assert.doesNotMatch(auth.message, /Request failed/);
  assert.deepEqual(errors, []);
  console.log('PASS empty account skips generation; expired JWT logs out safely.');
} finally {
  await browser?.close(); await web?.close();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (mongoose.connection.readyState === 1) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
  if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  if (previousUrl === undefined) delete process.env.VITE_API_URL; else process.env.VITE_API_URL = previousUrl;
}
