import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5178';

try {
  await page.goto(base);
  await page.locator('.landing-map-visual [data-drift-dot]').first().waitFor({ state: 'attached' });
  await page.waitForTimeout(900);
  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    await page.waitForTimeout(650);
    await page.screenshot({ path: `/tmp/adrift-entry-home-${theme}.png` });
  }
  const moving = await page.evaluate(async () => {
    const dot = document.querySelector('.landing-drift-dot');
    const before = dot.style.transform;
    await new Promise(resolve => setTimeout(resolve, 120));
    return before !== dot.style.transform;
  });
  assert.equal(moving, true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.locator('.landing-drift-dot').first().evaluate(el => el.style.transform), '');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.locator('.landing-page').evaluate(el => el.style.transform), '');
  assert.match(await page.locator('#landing-memory-route').getAttribute('d'), /Z$/);
  await page.locator('.landing-about-teaser').scrollIntoViewIfNeeded();
  await page.waitForTimeout(650);
  assert.equal(await page.locator('.landing-drift-dot').first().evaluate(el => el.style.transform), '', 'offscreen scope cleaned up');
  await page.locator('.landing-hero').scrollIntoViewIfNeeded();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.landing-drift-dot').first().evaluate(el => el.style.transform), '');
  assert.equal(await page.locator('.landing-memory-node').count(), 4);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const width of [320, 390, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator('.landing-page').evaluate(el => el.scrollWidth <= el.clientWidth), true, `landing overflow at ${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '開始漂流', exact: true }).click();
  await page.locator('.auth-page input[type="email"]').waitFor();
  assert.match(page.url(), /\/auth$/);

  // Exercise production auth components without creating real accounts.
  await page.route('**/src/main.jsx', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.slice(0, source.indexOf('createRoot(document')) });
  });
  const checks = [];
  await page.route('**/auth/check-email', async route => {
    const { email } = route.request().postDataJSON();
    checks.push(email);
    await new Promise(resolve => setTimeout(resolve, 180));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ exists: email === 'member@example.com' }) });
  });
  await page.reload();
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/AuthPanel.jsx')).text();
    const main = await (await fetch('/src/main.jsx')).text();
    const React = (await import(source.match(/from "([^"]*deps\/react\.js[^"]*)"/)[1])).default;
    const { createRoot } = (await import(main.match(/from "([^"]*react-dom_client[^"]*)"/)[1])).default;
    const { MotionConfig } = await import(source.match(/from "([^"]*framer-motion[^"]*)"/)[1]);
    const { default: Auth } = await import('/src/components/AuthPanel.jsx');
    function Harness() {
      const [loading, setLoading] = React.useState(false);
      return React.createElement(MotionConfig, { reducedMotion: 'user' }, React.createElement(Auth, {
        loading, onAuth: async (mode, payload) => {
          setLoading(true);
          try {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (payload.password === 'wrong') throw Error('Email 或密碼不正確，請再試一次。');
            window.authSubmission = { mode, payload };
          } finally { setLoading(false); }
        }
      }));
    }
    createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode, null, React.createElement(Harness)));
  });
  const next = () => page.locator('.auth-step:not([inert]) .auth-submit');
  const field = name => page.locator(`.auth-step:not([inert]) input[name="${name}"]`);
  const back = () => page.locator('.auth-step:not([inert]) .auth-back-button');
  await next().click();
  assert.equal(await field('email').getAttribute('aria-invalid'), 'true');
  const focus = await field('email').evaluate(el => ({ focused: document.activeElement === el, active: document.activeElement.outerHTML.slice(0, 160), names: [...el.form.elements].map(n => n.name) }));
  assert.equal(focus.focused, true, JSON.stringify(focus));
  await field('email').fill('not-an-email');
  await next().click();
  assert.equal(checks.length, 0);
  await field('email').fill('Member@Example.com');
  await next().click();
  await page.keyboard.press('Enter');
  await field('password').waitFor();
  assert.deepEqual(checks, ['member@example.com']);
  assert.equal(await page.locator('.auth-step:not([inert]) input').count(), 1);
  await field('password').fill('wrong');
  await next().click();
  await page.getByRole('alert').waitFor();
  await field('password').fill('valid-password');
  await next().click();
  await page.waitForFunction(() => window.authSubmission?.mode === 'login');
  await back().click();
  await field('email').fill('new@example.com');
  await next().click();
  await field('name').fill('Test Member');
  await field('userCode').fill('test_member');
  const cardTop = (await page.locator('.auth-card').boundingBox()).y;
  await next().click();
  await field('confirmPassword').waitFor();
  assert.equal(await field('password').inputValue(), '', 'changed email clears password');
  assert.equal(await page.locator('.auth-step:not([inert]) input').count(), 2);
  assert.equal((await page.locator('.auth-card').boundingBox()).y, cardTop, 'step change keeps card origin');
  await field('password').fill('new-password');
  await field('confirmPassword').fill('different');
  await next().click();
  assert.equal(await field('confirmPassword').getAttribute('aria-invalid'), 'true');
  await back().click();
  assert.equal(await field('name').inputValue(), 'Test Member');
  await next().click();
  assert.equal(await field('password').inputValue(), 'new-password');
  await field('confirmPassword').fill('new-password');
  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    await page.waitForTimeout(650);
    await page.screenshot({ path: `/tmp/adrift-entry-auth-${theme}.png` });
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.auth-page').evaluate(el => el.scrollWidth <= el.clientWidth), true, `auth overflow at ${width}`);
    await page.screenshot({ path: `/tmp/adrift-entry-auth-${width}.png` });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await back().click();
  await field('name').waitFor();
  await page.waitForTimeout(60);
  assert.equal(await page.locator('.auth-step').evaluate(el => el.style.transform), 'none');
  await next().click();
  await field('confirmPassword').waitFor();
  await next().click();
  await page.waitForFunction(() => window.authSubmission?.mode === 'register');
  assert.equal(await page.evaluate(() => window.authSubmission.payload.userCode), 'test_member');
  assert.deepEqual(errors, []);
  console.log('PASS: landing lifecycle/reduced motion/CTA, auth login/register/back/data retention/duplicate submit/errors, themes and mobile.');
} finally {
  await browser.close();
}
