import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('public/Adrift-presentation.pdf', root);
const stamp = new URL('presentation-pdf.json', import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = ['PresentationPage.jsx', 'presentationSlides.js', 'presentation.css']
  .map(file => 'src/components/' + file);
inputs.push('public/adrift-icon.png', ...(
  await readdir(new URL('public/presentation/', root))
).filter(file => file.endsWith('.png')).sort().map(file => 'public/presentation/' + file));
const source = sha256((await Promise.all(inputs.map(async file => file + ':' + sha256(await readFile(new URL(file, root)))))).join('\n'));

if (process.argv.includes('--check')) {
  try {
    assert.deepEqual(JSON.parse(await readFile(stamp, 'utf8')), { source, pdf: sha256(await readFile(output)) });
  } catch {
    console.error('Presentation PDF is stale. Run npm run presentation:pdf before building.');
    process.exit(1);
  }
  process.exit(0);
}

const { chromium } = await import('playwright');
const { createServer } = await import('vite');

const width = 1536;
const height = 864;
const server = await createServer({
  root: fileURLToPath(root),
  server: { host: '127.0.0.1', port: 0 },
  clearScreen: false
});
let browser;
try {
  await server.listen();
  const origin = new URL(server.resolvedUrls.local[0]).origin;
  browser = await chromium.launch(existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.emulateMedia({ media: 'print' });
  await page.goto(origin + '/presentation?print=1');
  const deck = page.locator('.presentation-print');
  await deck.locator('.presentation-section').first().waitFor();
  await deck.evaluate(async element => {
    await document.fonts.ready;
    await Promise.all([...element.querySelectorAll('img')].map(image => image.decode()));
  });
  const layout = await deck.evaluate(element => {
    const track = element.querySelector('.presentation-slide-track');
    const incompatibleEffects = [element, ...element.querySelectorAll('*')].some(node =>
      [null, '::before', '::after'].some(pseudo => {
        const style = getComputedStyle(node, pseudo);
        if (pseudo && (style.content === 'none' || style.content === 'normal')) return false;
        return [style.boxShadow, style.textShadow, style.filter, style.backdropFilter]
          .some(value => value !== 'none');
      }));
    return {
      incompatibleEffects,
      transform: getComputedStyle(track).transform,
      slides: [...track.children].map(slide => {
        const rect = slide.getBoundingClientRect();
        const inner = slide.querySelector('.presentation-section-inner').getBoundingClientRect();
        return { id: slide.id, index: +slide.dataset.slideIndex, height: rect.height,
          top: rect.top, bottom: inner.bottom - rect.bottom, width: rect.width, clipped: slide.scrollWidth > slide.clientWidth + 1 };
      })
    };
  });
  assert.equal(layout.incompatibleEffects, false, 'Print styles must not emit soft shadow masks.');
  assert.equal(layout.transform, 'none');
  assert.ok(layout.slides.length > 0 && new Set(layout.slides.map(slide => slide.id)).size === layout.slides.length);
  for (const [index, slide] of layout.slides.entries()) {
    assert.ok(slide.index === index && slide.width === width && slide.height === height &&
      Math.abs(slide.top - index * height) < 2 && slide.bottom <= 1 && !slide.clipped, JSON.stringify(slide));
  }
  assert.deepEqual(errors, []);
  assert.equal(await deck.locator('iframe, .presentation-nav, .presentation-controls, [inert]').count(), 0);
  const pdf = await page.pdf({ width: '16in', height: '9in', preferCSSPageSize: true, printBackground: true });
  await writeFile(output, pdf);
  await writeFile(stamp, JSON.stringify({ source, pdf: sha256(pdf) }, null, 2) + '\n');
  console.log('Exported ' + layout.slides.length + ' slides to ' + fileURLToPath(output));
} finally {
  try { await browser?.close(); } finally { await server.close(); }
}
