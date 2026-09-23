import assert from 'node:assert/strict';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await (process.env.BROWSER === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'chrome', headless: true }));
const page = await browser.newPage();
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5178';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let checks = 0;
await page.route('**/auth/check-email', async route => {
  checks++;
  const { email } = route.request().postDataJSON();
  await new Promise(resolve => setTimeout(resolve, email.startsWith('slow') ? 700 : 80));
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ exists: email.startsWith('member') || email.startsWith('slow') }) });
});
await page.route('**/auth/login', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Email 或密碼不正確，請再試一次。' }) }));
await page.route('**/auth/register', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: '暫時無法建立帳號，請稍後再試。' }) }));
const field = name => page.locator(`.auth-step:not([inert]) input[name="${name}"]`);
const submit = () => page.locator('.auth-step:not([inert]) .auth-submit');
const back = () => page.locator('.auth-step:not([inert]) .auth-back-button');
async function settled(name) {
  await field(name).waitFor();
  await page.waitForFunction(() => {
    const steps = document.querySelectorAll('.auth-step');
    return steps.length === 1 && !steps[0].inert && getComputedStyle(steps[0]).opacity === '1' && getComputedStyle(steps[0]).transform === 'none';
  });
}
async function geometry() {
  return page.evaluate(() => {
    const bounds = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    const scroll = document.querySelector('.auth-page').scrollTop;
    const card = bounds('.auth-card'), field = bounds('.auth-input input');
    // Compare content anchors; native scrolling to a focused field is intentional.
    card.y += scroll;
    field.y += scroll;
    return { card, field, button: bounds('.auth-submit'),
      scroll, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      pageOverflow: document.querySelector('.auth-page').scrollWidth > document.querySelector('.auth-page').clientWidth };
  });
}
function stable(a, b, label, sameStep = true) {
  for (const key of sameStep ? ['x', 'y', 'width', 'height'] : ['x', 'y', 'width']) assert.ok(Math.abs(a.card[key] - b.card[key]) < 1, `${label}: card ${key} ${a.card[key]} -> ${b.card[key]}`);
  if (sameStep) assert.ok(Math.abs(a.field.y - b.field.y) < 1, `${label}: field origin moved`);
  assert.equal(b.overflow || b.pageOverflow, false, `${label}: horizontal overflow`);
}
try {
  for (const [width, height] of [[1920,1080], [1440,900], [1366,768], [1280,800], [1024,768], [768,1024], [430,932], [390,844], [375,667]]) {
    await page.setViewportSize({ width, height });
    for (const theme of ['bright', 'dark']) {
      await page.goto(`${base}/auth`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await settled('email');
      const initial = await geometry();
      if (width > 920) {
        assert.ok(Math.abs(initial.card.y + initial.card.height / 2 - height / 2) < 2, 'desktop auth card must be vertically centered');
      }
      assert.ok(initial.card.height < 400, 'email form must not reserve a second field');
      assert.ok(initial.button.y + initial.scroll - initial.field.y - initial.field.height <= 60, 'submit stays close to the input');
      await submit().click();
      stable(initial, await geometry(), 'email validation');
      await field('email').fill('new@example.com');
      await field('email').press('Enter');
      await settled('name');
      const profile = await geometry();
      stable(initial, profile, 'registration step', false);
      await submit().click();
      stable(profile, await geometry(), 'two validation messages');
      await field('name').fill('Memory Keeper');
      await field('userCode').fill('keeper');
      await field('userCode').press('Enter');
      await settled('confirmPassword');
      const password = await geometry();
      stable(initial, password, 'password step', false);
      await submit().click();
      stable(password, await geometry(), 'password validation');
      await field('password').fill('valid-password');
      await field('confirmPassword').fill('valid-password');
      const beforeEye = await field('password').boundingBox();
      await page.getByRole('button', { name: '顯示密碼', exact: true }).first().click();
      assert.deepEqual(await field('password').boundingBox(), beforeEye);
      assert.ok((await page.getByRole('button', { name: '隱藏密碼', exact: true }).boundingBox()).height >= 44);
      await submit().click();
      await page.getByRole('alert').waitFor();
      stable(password, await geometry(), 'server error');
      await back().click();
      await settled('name');
      stable(profile, await geometry(), 'back');
      await back().click();
      await settled('email');
      await field('email').fill('member@example.com');
      await submit().click();
      await settled('password');
      const login = await geometry();
      stable(initial, login, 'login', false);
      assert.equal(await field('password').getAttribute('type'), 'password', 'new email resets password visibility');
      assert.equal(await field('password').evaluate(el => document.activeElement === el), true);
      await field('password').fill('wrong');
      await field('password').press('Enter');
      await page.getByRole('alert').waitFor();
      stable(login, await geometry(), 'login error');
      await page.waitForTimeout(300);
      assert.ok(await field('password').evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16), 'mobile-safe input size');
      await page.screenshot({ path: `/tmp/adrift-auth-stable-${width}-${theme}.png` });
      console.log(`PASS ${width}x${height} ${theme}: real App shell, steps, errors, Enter, focus, password eye`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/auth`);
  await settled('email');
  const before = await geometry();
  await field('email').fill('slow@example.com');
  const start = checks;
  await submit().click();
  await page.locator('form').evaluate(form => form.requestSubmit());
  await page.waitForTimeout(50);
  assert.equal(checks, start + 1, 'duplicate submits are rejected immediately');
  const busy = await geometry();
  stable(before, busy, 'loading');
  assert.equal(before.button.width, busy.button.width);
  await field('email').fill('newer@example.com');
  await submit().click();
  await settled('name');
  await page.waitForTimeout(800);
  assert.equal(await field('name').count(), 1, 'stale email response cannot choose login');
  assert.equal(await page.locator('.auth-selected-email').innerText(), 'newer@example.com');
  const callsBeforeComposition = checks;
  await back().click();
  await settled('email');
  await field('email').dispatchEvent('compositionstart');
  await field('email').press('Enter');
  await field('email').dispatchEvent('compositionend');
  assert.equal(checks, callsBeforeComposition, 'IME confirmation must not submit');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await submit().click();
  await settled('name');
  stable(before, await geometry(), 'reduced motion', false);
  await page.setViewportSize({ width: 390, height: 420 });
  await field('userCode').focus();
  await page.locator('.auth-submit').scrollIntoViewIfNeeded();
  const button = await submit().boundingBox();
  assert.ok(button.y >= 0 && button.y + button.height <= 420, 'short viewport can scroll to submit');
  assert.equal((await geometry()).overflow, false);
  assert.deepEqual(errors, []);
  console.log('PASS race cancellation, double-submit, IME, reduced motion, short-viewport scrolling. Real mobile keyboard/autofill require device QA.');
} finally { await browser.close(); }
