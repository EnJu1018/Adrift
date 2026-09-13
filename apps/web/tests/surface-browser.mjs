import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  // Mount production components with local data, without publishing a test route.
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
    const { AnimatePresence, MotionConfig } = await import(source.match(/from "([^"]*framer-motion[^"]*)"/)[1]);
    const { default: DiaryModal } = await import('/src/components/DiaryModal.jsx');
    const { default: Modal } = await import('/src/components/ui/Modal.jsx');
    const { default: Select } = await import('/src/components/ui/Select.jsx');
    const { default: Tooltip } = await import('/src/components/ui/Tooltip.jsx');
    const { default: ToastViewport } = await import('/src/components/ToastViewport.jsx');
    const h = React.createElement;
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const [busy, setBusy] = React.useState(false);
      const [value, setValue] = React.useState('b');
      const [toast, setToast] = React.useState(null);
      const [failure, setFailure] = React.useState(false);
      window.surfaceTest = { setBusy, setOpen, setFailure };
      return h(MotionConfig, { reducedMotion: 'user' },
        h('main', { style: { padding: '80px', maxWidth: '500px' } },
          h('button', { id: 'open-diary', onClick: () => setOpen(true) }, 'Open diary'),
          h('button', { id: 'background', onClick: () => { window.backgroundClicked = true; } }, 'Background'),
          h(Select, { label: 'Test selection', value, onChange: setValue, options: [
            { value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' },
            { value: 'c', label: 'Disabled', disabled: true }, { value: 'd', label: 'Delta' }
          ] }),
          h(Tooltip, { label: 'Reaction' }, h('button', { id: 'reaction' }, 'React'))),
        h(AnimatePresence, null, open && h(DiaryModal, {
          location: { lat: 24, lng: 120, source: 'ip' }, loading: busy,
          onClose: () => setOpen(false),
          onSubmit: data => { window.submitted = Object.fromEntries(data); setOpen(false); setToast({ message: 'Saved', type: 'success' }); }
        })),
        h(AnimatePresence, null, failure && h(Modal, {
          label: 'Failed action', error: 'Please try again', className: 'confirm-modal', onClose: () => setFailure(false)
        }, h('button', { onClick: () => setFailure(false) }, 'Cancel'))),
        h(ToastViewport, { toast, onDismiss: () => setToast(null) }));
    }
    createRoot(document.getElementById('root')).render(h(React.StrictMode, null, h(Harness)));
  });

  const open = page.locator('#open-diary');
  const dialog = page.getByRole('dialog', { name: '新增日記' });
  const select = page.getByRole('button', { name: 'Test selection', exact: true });
  await select.click();
  assert.equal(await page.getByRole('option', { name: 'Beta' }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.getByRole('option', { name: 'Delta' }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  assert.match(await select.innerText(), /Alpha/);
  assert.equal(await select.evaluate(el => el === document.activeElement), true);
  await page.waitForTimeout(250);

  await open.click();
  await dialog.waitFor();
  await page.waitForTimeout(350);
  assert.equal(await dialog.evaluate(el => el.matches(':modal') && el.contains(document.activeElement)), true);
  await page.locator('#background').evaluate(el => el.focus());
  assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, 'background cannot take focus');
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab');
    // Native dialogs allow browser chrome focus, but never background controls.
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement) || document.activeElement === document.body), true);
  }

  const mood = page.getByRole('button', { name: '心情', exact: true });
  await mood.click();
  assert.equal(await page.getByRole('listbox').evaluate(el => Boolean(el.closest('dialog'))), true);
  await page.keyboard.press('Escape');
  await page.getByRole('listbox').waitFor({ state: 'hidden' });
  assert.equal(await dialog.count(), 1, 'Escape closes menu, not its modal');
  assert.equal(await mood.evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await open.evaluate(el => el === document.activeElement), true, 'focus returns to opener');

  await open.click();
  await dialog.waitFor();
  await page.evaluate(() => window.surfaceTest.setBusy(true));
  await page.waitForFunction(() => document.querySelector('dialog')?.getAttribute('aria-busy') === 'true');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  assert.equal(await dialog.count(), 1, 'busy modal cannot be cancelled by Escape');
  await page.evaluate(() => window.surfaceTest.setBusy(false));
  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    await page.waitForTimeout(650);
    await page.screenshot({ path: `/tmp/adrift-surface-${theme}.png` });
    assert.equal(await dialog.evaluate(el => el.getBoundingClientRect().width), 1440);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: '/tmp/adrift-surface-mobile.png' });
  assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true, 'mobile modal does not overflow horizontally');
  await page.getByPlaceholder('今天在海邊').fill('Memory');
  await page.locator('#diary-content').fill('A quiet afternoon.');
  await page.getByRole('button', { name: '可見性', exact: true }).click();
  await page.getByRole('option', { name: /私人/ }).click();
  await page.locator('.diary-modal button[type="submit"]').click();
  await dialog.waitFor({ state: 'detached' });
  const submitted = await page.evaluate(() => window.submitted);
  assert.equal(submitted.title, 'Memory');
  assert.equal(submitted.text, 'A quiet afternoon.');
  assert.equal(submitted.visibility, 'private');
  assert.equal(submitted.lng, '120');
  await page.getByRole('status').waitFor();
  await page.waitForTimeout(450);
  const dismiss = page.getByRole('button', { name: '關閉提示' });
  assert.ok((await dismiss.boundingBox()).width >= 44);
  await dismiss.click();
  await page.getByRole('status').waitFor({ state: 'detached' });

  await page.setViewportSize({ width: 1440, height: 900 });
  const reaction = page.locator('#reaction');
  const before = await reaction.boundingBox();
  await reaction.focus();
  await page.getByRole('tooltip').waitFor({ state: 'visible' });
  assert.deepEqual(await reaction.boundingBox(), before, 'tooltip does not affect layout');
  assert.equal(await reaction.getAttribute('title'), null);
  await page.keyboard.press('Escape');
  await page.getByRole('tooltip').waitFor({ state: 'hidden' });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open.click();
  await dialog.waitFor();
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.diary-modal').evaluate(el => el.style.transform), 'none');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.evaluate(() => window.surfaceTest.setFailure(true));
  const failedDialog = page.getByRole('dialog', { name: 'Failed action' });
  await failedDialog.getByRole('alert').waitFor({ state: 'visible' });
  assert.equal(await failedDialog.getByRole('alert').innerText(), 'Please try again');
  await failedDialog.getByRole('button', { name: 'Cancel' }).click();
  await failedDialog.waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  console.log('PASS: native modal focus/inert/Escape/return, busy guard, select keyboard and portal, diary submit, themes/mobile, tooltip, toast, reduced motion.');
} finally {
  await browser.close();
}
