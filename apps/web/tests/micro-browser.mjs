import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
const performance = await page.context().newCDPSession(page);
await performance.send('Performance.enable');
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
    const { AnimatePresence } = await import(source.match(/from "([^"]*framer-motion[^"]*)"/)[1]);
    const Number = (await import('/src/components/ui/AnimatedNumber.jsx')).default;
    const Feedback = (await import('/src/components/ui/ButtonFeedback.jsx')).default;
    const Content = (await import('/src/components/ui/ContentTransition.jsx')).default;
    const Photo = (await import('/src/components/DiaryImage.jsx')).default;
    const Avatar = (await import('/src/components/UserAvatar.jsx')).default;
    const h = React.createElement;
    function Harness() {
      const [value, setValue] = React.useState(128);
      const [busy, setBusy] = React.useState(false);
      const [src, setSrc] = React.useState(location.origin + '/adrift-icon.png');
      const [items, setItems] = React.useState(['one', 'two']);
      window.micro = { setValue, setBusy, setSrc, setItems };
      return h('main', { style: { padding: 24, width: 390 } },
        h('div', { id: 'counter', style: { fontSize: 24 } }, h(Number, { value, digits: 8, variant: 'reaction' }), h('span', { id: 'neighbor' }, '篇')),
        h('button', { id: 'save', className: 'primary-button', disabled: busy }, h(Feedback, { busy, label: '儲存', busyLabel: '儲存中...' })),
        h(Photo, { src, alt: '記憶照片', className: 'feed-card-image' }),
        h(Avatar, { src, name: 'River' }),
        h('div', { id: 'rows' }, h(AnimatePresence, { initial: false }, items.map(id => h(Content, { collapse: true, key: id }, h('button', { style: { height: 60 }, 'data-id': id }, id))))));
    }
    createRoot(document.getElementById('root')).render(h(React.StrictMode, null, h(Harness)));
  });
  await page.locator('#save').waitFor();
  assert.equal(await page.locator('.motion-number').textContent(), '128');
  assert.equal(await page.locator('.motion-number-value').getAttribute('style'), null, 'mount is static');
  const initial = await page.locator('#neighbor').boundingBox();
  for (const value of [1, 2, 3, 4, 9, 10, 99, 100, 999, '1,000', '9,999', '10,000', '9%', '10%', 1.4, 1.5, -12.5, '$1,000']) {
    await page.evaluate(value => window.micro.setValue(value), value);
    await page.waitForTimeout(32);
    assert.equal((await page.locator('#neighbor').boundingBox()).x, initial.x);
    assert.equal(await page.locator('.motion-number').textContent(), String(value));
    assert.equal(await page.locator('.motion-number > *').count(), 1, 'only one current value exists');
    const centered = await page.locator('.motion-number').evaluate(el => {
      const a = el.getBoundingClientRect(), b = el.firstElementChild.getBoundingClientRect();
      return Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < 0.5;
    });
    assert.equal(centered, true, 'no leading blank digit cells');
  }
  await page.waitForTimeout(350);
  await page.evaluate(() => window.micro.setValue(128));
  await page.waitForTimeout(350);
  const beforeMotion = (await performance.send('Performance.getMetrics')).metrics.find(m => m.name === 'LayoutCount').value;
  await page.evaluate(() => window.micro.setValue(129));
  await page.waitForTimeout(32);
  const changed = await page.locator('.motion-number-value').evaluateAll(nodes => nodes.map(n => n.style.transform).filter(Boolean));
  assert.equal(changed.length, 1, 'only the current value layer should move');
  await page.waitForTimeout(280);
  const afterMotion = (await performance.send('Performance.getMetrics')).metrics.find(m => m.name === 'LayoutCount').value;
  assert.ok(afterMotion - beforeMotion <= 2, 'digit animation must not trigger layout every frame');
  assert.equal(await page.locator('.motion-number-value').evaluate(n => !n.style.transform && !n.style.opacity), true, 'resting styles are clean');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.micro.setValue(999));
  await page.waitForTimeout(50);
  assert.equal(await page.locator('.motion-number-value').evaluateAll(nodes => nodes.every(n => !n.style.transform && !n.style.opacity)), true);

  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    const before = await page.locator('#save').boundingBox();
    await page.evaluate(() => window.micro.setBusy(true));
    await page.waitForTimeout(180);
    const during = await page.locator('#save').boundingBox();
    assert.equal(before.width, during.width);
    assert.equal(before.height, during.height);
    assert.equal(await page.getByRole('button', { name: '儲存中...' }).count(), 1);
    await page.evaluate(() => window.micro.setBusy(false));
    await page.waitForTimeout(180);
    await page.screenshot({ path: `/tmp/adrift-micro-${theme}.png` });
  }
  await page.locator('.diary-image-frame[data-state="ready"]').waitFor();
  const photo = await page.locator('.diary-image-frame').boundingBox();
  const avatar = await page.locator('.user-avatar').boundingBox();
  await page.route('**/missing-photo.png', route => route.fulfill({ status: 404, body: '' }));
  await page.evaluate(() => window.micro.setSrc(location.origin + '/missing-photo.png'));
  await page.locator('.diary-image-frame[data-state="error"]').waitFor();
  const failed = await page.locator('.diary-image-frame').boundingBox();
  assert.equal(photo.width, failed.width);
  assert.equal(photo.height, failed.height);
  assert.equal(await page.locator('.user-avatar img').count(), 0);
  assert.equal(await page.locator('.user-avatar > span').textContent(), 'R');
  assert.equal((await page.locator('.user-avatar').boundingBox()).width, avatar.width);
  await page.evaluate(() => window.micro.setSrc(location.origin + '/adrift-icon.png'));
  await page.locator('.diary-image-frame[data-state="ready"]').waitFor();
  await page.locator('.user-avatar[data-ready="true"]').waitFor();

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const height = (await page.locator('#rows').boundingBox()).height;
  await page.evaluate(() => window.micro.setItems(['two']));
  await page.waitForFunction(() => document.querySelector('.motion-collapse[inert]'));
  await page.waitForTimeout(50);
  const mid = (await page.locator('#rows').boundingBox()).height;
  assert.ok(mid > 60 && mid < height, 'row must collapse before removal');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('[data-id="one"]').count(), 0);
  assert.equal(await page.locator('#rows').evaluate(n => n.scrollHeight), 60);
  assert.deepEqual(errors, []);
  console.log('PASS: single-layer formatted counters, stable centered geometry, rapid cancellation/clean resting state, reduced motion, photos, rows, themes and StrictMode.');
} finally { await browser.close(); }
