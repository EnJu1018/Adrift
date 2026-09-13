import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5178';

try {
  await page.goto(`${base}/p`);
  await page.locator('.presentation-next').waitFor();
  assert.equal(await page.locator('.presentation-prev').isDisabled(), true);
  await page.locator('.presentation-next').click();
  await page.waitForTimeout(550);
  await page.locator('.presentation-prev').click();
  await page.waitForTimeout(550);
  assert.equal(await page.locator('.presentation-prev').isDisabled(), true);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('End');
  await page.waitForTimeout(550);
  assert.equal(await page.locator('.presentation-next').isDisabled(), true);
  await page.locator('.presentation-prev').click();
  await page.waitForTimeout(550);
  await page.locator('.presentation-next').click();
  await page.waitForTimeout(550);
  assert.equal(await page.locator('.presentation-next').isDisabled(), true);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Home');
  for (let index = 0; index < 5; index++) {
    await page.waitForTimeout(550);
    await page.keyboard.press('ArrowRight');
  }
  await page.waitForTimeout(650);

  for (const theme of ['bright', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    await page.waitForTimeout(650);
    await page.screenshot({ path: `/tmp/adrift-motion-${theme}.png` });
    const result = await page.evaluate(async () => {
      const { motionMs } = await import('/src/lib/motion/tokens.js');
      const style = getComputedStyle(document.documentElement);
      const root = document.querySelector('.presentation-map-visual');
      const dot = root.querySelector('[data-drift-dot]');
      const before = dot.style.transform;
      await new Promise(resolve => setTimeout(resolve, 120));
      return { cssFast: style.getPropertyValue('--duration-fast').trim(), jsFast: motionMs.fast,
        moving: before !== dot.style.transform, rootTransform: root.style.transform,
        appAnimations: document.querySelector('.app-layout').getAnimations().length };
    });
    assert.equal(result.cssFast, `${result.jsFast}ms`);
    assert.equal(result.moving, true);
    assert.equal(result.rootTransform, '');
    assert.equal(result.appAnimations, 0);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(150);
  const reduced = await page.evaluate(async () => {
    const { listItemMotion, staggeredRevealMotion } = await import('/src/constants/animations.js');
    const root = document.querySelector('.presentation-map-visual');
    const dot = root.querySelector('[data-drift-dot]');
    const before = dot.style.transform;
    await new Promise(resolve => setTimeout(resolve, 150));
    return { stable: before === dot.style.transform, transform: dot.style.transform,
      list: listItemMotion(100), reveal: staggeredRevealMotion(100),
      visibleNodes: [...root.querySelectorAll('.map-memory-node-core')].every(n => Number(getComputedStyle(n).opacity) > 0) };
  });
  assert.equal(reduced.stable, true);
  assert.equal(reduced.transform, '');
  assert.equal(reduced.list.initial, false);
  assert.equal(reduced.list.transition.delay, 0);
  assert.equal(reduced.reveal.transition.delay, 0);
  assert.equal(reduced.visibleNodes, true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(150);

  const cleanup = await page.evaluate(async () => {
    const { createPresentationMapMotion } = await import('/src/lib/motion/animeMotion.js');
    const { listItemMotion } = await import('/src/constants/animations.js');
    const root = document.createElement('div');
    root.innerHTML = '<svg><path data-memory-path d="M0 0L100 100" /></svg>';
    document.body.append(root);
    const dispose = createPresentationMapMotion(root);
    dispose();
    const remount = createPresentationMapMotion(root);
    await new Promise(resolve => setTimeout(resolve, 100));
    remount();
    const before = root.innerHTML;
    await new Promise(resolve => setTimeout(resolve, 100));
    const stable = before === root.innerHTML;
    root.remove();
    return { stable, style: root.querySelector('path').getAttribute('style'),
      delay: listItemMotion(100).transition.delay, exitDelay: listItemMotion(100).exit.transition.delay };
  });
  assert.equal(cleanup.stable, true);
  assert.ok(!cleanup.style);
  assert.ok(cleanup.delay <= 0.3);
  assert.equal(cleanup.exitDelay, 0);

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(450);
  assert.equal(await page.locator('[data-drift-dot]').first().evaluate(n => n.style.transform), '', 'leaving the map stops and reverts its scope');
  assert.equal(await page.locator('.presentation-section:not([inert])').count(), 1);
  assert.equal(await page.locator('[data-memory-path]').evaluateAll(nodes => nodes.length === 2 && nodes.every(n => /z$/i.test(n.getAttribute('d').trim()))), true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const total = await page.locator('.presentation-slide-track > section').count();
  for (const width of [1366, 1440, 1920, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.keyboard.press('Home');
    for (let index = 0; index < total; index++) {
      await page.waitForTimeout(25);
      const geometry = await page.locator('.presentation-section[data-active="true"]').evaluate(n => {
        const rect = n.getBoundingClientRect();
        return { top: rect.top, height: rect.height, width: n.clientWidth, scrollWidth: n.scrollWidth,
          transform: getComputedStyle(n).transform, innerTop: n.querySelector('.presentation-section-inner').getBoundingClientRect().top };
      });
      assert.ok(Math.abs(geometry.top) < 1, `slide ${index + 1} at ${width}: incorrect active position`);
      assert.equal(geometry.height, 900);
      assert.ok(geometry.scrollWidth <= geometry.width + 1, `slide ${index + 1} at ${width}: horizontal overflow`);
      assert.equal(geometry.transform, 'none');
      assert.ok(geometry.innerTop >= -1, `slide ${index + 1} at ${width}: content above scroll origin`);
      await page.keyboard.press('ArrowRight');
    }
    assert.equal(await page.locator('.presentation-next').isDisabled(), true);
  }
  await page.keyboard.press('ArrowLeft');
  const links = await page.locator('.demo-link-button').evaluateAll(nodes => nodes.map(n => ({ href: n.href, target: n.target })));
  assert.deepEqual(links, [
    { href: 'https://youtu.be/rLQL5o97gPw', target: '_blank' },
    { href: 'https://youtu.be/-F5u8ZKhs8A', target: '_blank' }
  ]);
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.presentation-slide-track').evaluate(n => getComputedStyle(n).transform), 'none');
  await page.emulateMedia({ media: 'screen' });

  await page.setViewportSize({ width: 1920, height: 900 });
  await page.keyboard.press('End');
  await page.locator('.presentation-section[data-active="true"]').dispatchEvent('wheel', { deltaY: -4, deltaMode: 1 });
  await page.waitForTimeout(450);
  assert.equal(await page.locator('.presentation-section[data-active="true"]').getAttribute('id'), 'demo');
  await page.locator('.presentation-section[data-active="true"]').dispatchEvent('wheel', { deltaY: 120, ctrlKey: true });
  assert.equal(await page.locator('.presentation-section[data-active="true"]').getAttribute('id'), 'demo', 'pinch zoom must not change slides');
  await page.locator('.presentation-section[data-active="true"]').dispatchEvent('wheel', { deltaY: 120 });
  await page.waitForTimeout(450);
  assert.equal(await page.locator('.presentation-next').isDisabled(), true);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.keyboard.press('Home');
  await page.waitForTimeout(50);
  await page.mouse.move(190, 300);
  await page.mouse.wheel(0, 160);
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.presentation-section[data-active="true"]').getAttribute('id'), 'cover');
  assert.ok(await page.locator('#cover').evaluate(n => n.scrollTop > 0), 'overflowing content must scroll before navigation');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('.presentation-next').waitFor();
  assert.equal(await page.locator('[data-drift-dot]').first().evaluate(n => n.style.transform), '');
  assert.deepEqual(errors, []);
  console.log('PASS: shared tokens, dark/bright, presentation boundaries, Anime path motion, live/initial reduced motion, cleanup/remount, bounded stagger.');
} finally {
  await browser.close();
}
