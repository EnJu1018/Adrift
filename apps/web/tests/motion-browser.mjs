import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chrome';
const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5178';
const output = process.env.PRESENTATION_QA_DIR || '/tmp/adrift-defense-' + engine;
await mkdir(output, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1536, height: 864 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const active = page.locator('.presentation-section[data-active="true"]');
const track = page.locator('.presentation-slide-track');
const previous = page.getByRole('button', { name: '上一頁', exact: true });
const next = page.getByRole('button', { name: '下一頁', exact: true });

async function ready(index) {
  await active.and(page.locator('[data-slide-index="' + index + '"]')).waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('.presentation-section img')].map(image => image.decode()));
  });
}

try {
  await page.goto(base + '/presentation');
  await ready(0);
  const order = await page.locator('.presentation-section').evaluateAll(items => items.map(el => el.id));
  assert.deepEqual(order, [
    'cover', 'motivation', 'difference', 'problem', 'goal', 'overview', 'map-diary', 'friends', 'authenticity',
    'activity', 'user-flow', 'architecture', 'frontend-tech', 'backend-tech', 'ux', 'admin-role', 'life-map-ai',
    'insights-chat', 'retrieval', 'ollama', 'gateway', 'agent', 'verification', 'review', 'team', 'demo', 'demo-video'
  ]);
  assert.equal(await previous.isDisabled(), true);
  await next.click(); await ready(1);
  await next.click(); await ready(2);
  assert.equal(await active.getAttribute('id'), 'difference');
  await previous.click(); await ready(1);
  await previous.click(); await ready(0);
  await page.keyboard.press('End'); await ready(26);
  assert.equal(await next.isDisabled(), true);
  await page.keyboard.press('ArrowLeft'); await ready(25);
  await page.keyboard.press('ArrowLeft'); await ready(24);
  assert.equal(await active.getAttribute('id'), 'team');
  assert.equal(await active.locator('tbody tr').count(), 4);
  for (const name of ['張惠芯', '洪藝文', '王浩宇', '陳恩儒']) await active.getByRole('rowheader', { name }).waitFor();
  await page.reload(); await ready(24);
  await page.keyboard.press('ArrowLeft'); await ready(23);
  for (const theme of ['隱私與資料安全', '拍照、語音與便利性', '產品價值與實用性']) await active.getByRole('heading', { name: theme }).waitFor();
  await page.getByRole('button', { name: '成果展示', exact: true }).click(); await ready(23);

  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const [width, height] of [[1536, 864], [1366, 768]]) {
      await page.setViewportSize({ width, height });
      await page.locator('.presentation-page').evaluate(el => el.focus({ preventScroll: true }));
      await page.keyboard.press('Home');
      for (let index = 0; index < order.length; index++) {
        await ready(index);
        const layout = await active.evaluate(slide => {
          const inner = slide.querySelector('.presentation-section-inner');
          const rect = slide.getBoundingClientRect();
          const controls = Math.min(...[...document.querySelectorAll('.presentation-nav,.presentation-controls')].map(node => node.getBoundingClientRect().top));
          const title = slide.querySelector('.presentation-section-heading h2');
          const subtitle = slide.querySelector('.presentation-section-heading > span');
          return { x: slide.scrollWidth - slide.clientWidth, y: slide.scrollHeight - slide.clientHeight,
            ratio: title && subtitle ? parseFloat(getComputedStyle(title).fontSize) / parseFloat(getComputedStyle(subtitle).fontSize) : 2,
            bottom: inner.getBoundingClientRect().bottom - controls, top: rect.top };
        });
        assert.ok(layout.x <= 1 && layout.top >= -2 && layout.top <= 2, theme + ' slide ' + (index + 1) + ': ' + JSON.stringify(layout));
        assert.ok(layout.bottom <= 2 && layout.y <= 2, theme + ' ' + width + ' slide ' + (index + 1) + ': ' + JSON.stringify(layout));
        assert.equal(layout.ratio, 2, order[index]);
        assert.ok(await track.evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) < .001));
        if (width === 1536) await page.screenshot({ path: join(output, theme + '-' + String(index + 1).padStart(2, '0') + '.png'), animations: 'disabled' });
        await page.keyboard.press('ArrowRight');
      }
    }
  }

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.keyboard.press('Home');
  assert.ok(await track.evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) > 0));
  await page.keyboard.press('ArrowRight');
  await ready(1);
  await page.waitForFunction(() => Math.abs(document.querySelector('.presentation-section[data-active="true"]').getBoundingClientRect().top) < 2);
  assert.equal(await page.locator('.presentation-section:not([inert])').count(), 1);
  for (let i = 2; i <= 6; i++) { await page.keyboard.press('ArrowRight'); await ready(i); }
  const dot = active.locator('[data-drift-dot]').first();
  await page.waitForFunction(() => Boolean(document.querySelector('#map-diary [data-drift-dot]').style.transform));
  const start = await dot.evaluate(node => node.style.transform);
  await page.waitForFunction(start => document.querySelector('#map-diary [data-drift-dot]').style.transform !== start, start);
  await page.keyboard.press('ArrowRight'); await ready(7);
  assert.equal(await page.locator('#map-diary [data-drift-dot]').first().evaluate(node => node.style.transform), '');

  await page.setViewportSize({ width: 1536, height: 864 });
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
  await page.goto(base + '/presentation?print=1');
  await page.locator('.presentation-section').first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('.presentation-section img')].map(image => image.decode()));
  });
  assert.deepEqual(await page.locator('.presentation-section').evaluateAll(items => items.map(el => el.id)), order);
  assert.equal(await page.locator('.presentation-nav, .presentation-controls').count(), 0);
  assert.equal(await page.locator('.presentation-section[inert]').count(), 0);
  assert.equal(await page.locator('iframe').count(), 0);
  assert.equal(await track.evaluate(el => getComputedStyle(el).transform), 'none');
  assert.deepEqual(errors, []);
  console.log('PASS ' + engine + ': ' + order.length + ' slides, both themes at 1536x864 and 1366x768; keyboard, motion and print.');
} finally { await browser.close(); }
