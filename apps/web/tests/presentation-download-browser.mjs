import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5178';
const browser = process.env.BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
let downloadCount = 0;
page.on('download', () => { downloadCount++; });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  const revisions = [];
  for (const theme of ['bright', 'dark']) {
    await page.goto(base + '/pd');
    await page.getByRole('heading', { name: '下載口試簡報' }).waitFor();
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    assert.equal(downloadCount, revisions.length * 2, 'Opening the page must not auto-download.');
    assert.equal(await page.locator('a[download]').count(), 2);
    for (const ext of ['pdf', 'pptx']) {
      const link = page.getByRole('link', { name: ext.toUpperCase(), exact: true });
      const href = await link.getAttribute('href');
      if (ext === 'pdf') revisions.push(href);
      assert.ok(new URL(href, page.url()).searchParams.has('download'));
      await link.focus();
      const [file] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
      assert.equal(file.suggestedFilename(), 'Adrift-presentation.' + ext);
      assert.ok((await readFile(await file.path())).equals(await readFile(new URL('../public/Adrift-presentation.' + ext, import.meta.url))));
    }
    const output = process.env.PRESENTATION_QA_DIR || '/tmp/adrift-download-qa';
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: output + '/download-' + theme + '.png' });
  }
  assert.notEqual(...revisions);
  await page.getByRole('link', { name: '線上瀏覽簡報' }).click();
  await page.locator('.presentation-section[data-active="true"]').waitFor();
  assert.ok(page.url().endsWith('/p'));
  assert.deepEqual(errors, []);
  console.log('PASS PDF/PPTX choice: no automatic download, both themes, keyboard downloads match current files, fresh URLs, preview navigation.');
} finally {
  await browser.close();
}
