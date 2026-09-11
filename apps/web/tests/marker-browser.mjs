import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  // Keep fixtures in the test runner, not in a shipping application route.
  await page.route('**/src/main.jsx', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.slice(0, source.indexOf('createRoot(document')) });
  });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5178');
  await page.locator('#root').waitFor({ state: 'attached' });
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/markers/DiaryMarkerLayer.jsx')).text();
    const main = await (await fetch('/src/main.jsx')).text();
    const React = (await import(source.match(/from "([^"]*deps\/react\.js[^"]*)"/)[1])).default;
    const { createRoot } = (await import(main.match(/from "([^"]*react-dom_client[^"]*)"/)[1])).default;
    const mapbox = (await import(source.match(/from "([^"]*mapbox-gl[^"]*)"/)[1])).default;
    const { default: Layer } = await import('/src/components/markers/DiaryMarkerLayer.jsx');
    document.getElementById('root').style.display = 'none';
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0';
    document.body.append(container);
    const mount = document.createElement('div');
    document.body.append(mount);
    const map = new mapbox.Map({
      container, center: [120, 24], zoom: 15, attributionControl: false,
      style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e7eeed' } }] }
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Map load timeout')), 15000);
      map.once('load', () => { clearTimeout(timer); resolve(); });
    });
    const root = createRoot(mount);
    const state = {
      map, visible: true, theme: 'bright', selectedId: null,
      diaries: [
        { _id: 'a', title: '海邊的風', mood: { type: 'calm' }, createdAt: '2026-05-10T08:30:00Z', location: { coordinates: [120, 24] } },
        { _id: 'b', title: '另一段記憶', mood: { type: 'confused' }, createdAt: '2026-05-11T08:30:00Z', location: { coordinates: [120.008, 24.004] } }
      ],
      onSelect: (diary) => { window.lastSelected = diary; }
    };
    window.markerTest = {
      map, root, state, React, createRoot, mapbox,
      render(updates = {}) {
        Object.assign(state, updates);
        document.documentElement.dataset.theme = state.theme;
        root.render(React.createElement(React.StrictMode, null, React.createElement(Layer, state)));
      }
    };
    window.markerTest.render();
  });
  await page.locator('.diary-node-anchor[data-diary-id="a"] .dn-hit').waitFor();
  await page.evaluate(() => { window.firstAnchor = document.querySelector('.diary-node-anchor[data-diary-id="a"]'); });

  async function checkCenters(label) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const offsets = await page.evaluate(() => {
      const { map, state } = window.markerTest;
      const container = map.getContainer().getBoundingClientRect();
      return state.diaries.map((diary) => {
        const el = document.querySelector(`.diary-node-anchor[data-diary-id="${diary._id}"]`);
        const rect = el.getBoundingClientRect();
        const point = map.project(diary.location.coordinates);
        return { id: diary._id, dx: rect.x + rect.width / 2 - container.left - point.x, dy: rect.y + rect.height / 2 - container.top - point.y, width: rect.width, height: rect.height, animation: getComputedStyle(el).animationName };
      });
    });
    for (const item of offsets) {
      assert.ok(Math.abs(item.dx) < 1.1 && Math.abs(item.dy) < 1.1, `${label}: projection offset ${JSON.stringify(item)}`);
      assert.equal(item.width, 48);
      assert.equal(item.height, 48);
      assert.equal(item.animation, 'none');
    }
    assert.equal(await page.evaluate(() => window.firstAnchor === document.querySelector('.diary-node-anchor[data-diary-id="a"]')), true, `${label}: anchor replaced`);
  }

  await checkCenters('initial');
  const marker = page.locator('.diary-node-anchor[data-diary-id="a"] .dn-hit');
  await marker.hover();
  await page.waitForTimeout(180);
  assert.equal(await page.locator('.dn-tooltip:visible').count(), 1);
  assert.equal(await page.locator('.diary-node-anchor [title]').count(), 0);
  await page.keyboard.press('Tab');
  await marker.focus();
  await page.locator('.diary-node-anchor[data-diary-id="b"] .dn-hit').hover();
  assert.equal(await page.locator('.dn-tooltip:visible').count(), 1, 'pointer tooltip replaces keyboard tooltip');
  await marker.hover();
  await checkCenters('hover');
  await marker.click();
  assert.equal(await page.evaluate(() => window.lastSelected._id), 'a');
  await page.evaluate(() => window.markerTest.render({ selectedId: 'a' }));
  await checkCenters('selected');

  for (const camera of [{ zoom: 16 }, { zoom: 14 }, { zoom: 15, center: [120.001, 24.0005] }, { bearing: 65 }, { pitch: 55 }, { bearing: 0, pitch: 0 }]) {
    await page.evaluate((value) => window.markerTest.map.jumpTo(value), camera);
    await checkCenters(JSON.stringify(camera));
  }
  await page.mouse.move(250, 500);
  await page.mouse.down();
  await page.mouse.move(300, 540, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await checkCenters('drag');

  await page.evaluate(() => window.markerTest.render({ visible: false }));
  await page.waitForFunction(() => window.firstAnchor.hidden);
  await page.evaluate(() => window.markerTest.render({ visible: true }));
  await marker.waitFor({ state: 'visible' });
  await checkCenters('zoom visibility round trip');

  await page.evaluate(() => {
    const { state, render } = window.markerTest;
    render({ diaries: state.diaries.map((diary) => diary._id === 'a' ? { ...diary, title: '更新後的日記', mood: { type: 'confused' } } : diary) });
  });
  await page.getByRole('button', { name: '查看日記：更新後的日記', exact: true }).waitFor();
  await marker.hover();
  assert.match(await page.locator('.diary-node-anchor[data-diary-id="a"] .dn-tooltip').innerText(), /更新後的日記[\s\S]*疑惑/);
  await marker.click();
  assert.equal(await page.evaluate(() => window.lastSelected.title), '更新後的日記');
  await marker.focus();
  await page.keyboard.press('Enter');
  await checkCenters('edited record and keyboard');

  for (const theme of ['dark', 'bright']) {
    await page.evaluate((value) => window.markerTest.render({ theme: value }), theme);
    await checkCenters(theme);
    await page.screenshot({ path: `/tmp/adrift-marker-layer-${theme}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.markerTest.map.resize(); window.markerTest.map.jumpTo({ center: [120, 24] }); });
  await checkCenters('mobile');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await checkCenters('reduced motion');
  await page.screenshot({ path: '/tmp/adrift-marker-layer-mobile.png' });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    const test = window.markerTest;
    test.map.resize(); test.map.jumpTo({ center: [120, 24], zoom: 15 });
    test.makeStack = (count) => Array.from({ length: count }, (_, index) => ({
      _id: 'stack-' + index, title: '記憶 ' + (index + 1), mood: { type: index % 2 ? 'confused' : 'calm' },
      createdAt: '2026-05-10T08:30:00Z', location: { coordinates: [120, 24] }
    }));
    test.render({ diaries: test.makeStack(5), selectedId: null });
  });
  const stack = page.locator('.diary-node-anchor:visible .dn-hit');
  await page.getByRole('button', { name: '5 篇日記', exact: true }).waitFor();
  await stack.click();
  await page.locator('.dn-arc-item .dn-hit').first().waitFor();
  assert.equal(await page.locator('.dn-arc-item').count(), 5);
  await page.evaluate(() => {
    window.stackAnchor = document.querySelector('.diary-node-anchor');
    window.stackChild = document.querySelector('[data-stack-choice="stack-2"]');
    window.stackCoordinates = JSON.stringify(window.markerTest.state.diaries);
  });
  for (let index = 0; index < 5; index += 1) {
    await page.locator('[data-stack-choice="stack-' + index + '"] .dn-hit').click();
    assert.equal(await page.evaluate(() => window.lastSelected._id), 'stack-' + index);
    await page.evaluate((id) => window.markerTest.render({ selectedId: id }), 'stack-' + index);
    await page.waitForFunction((id) => document.querySelector('[data-stack-choice="' + id + '"] .dn-hit')?.getAttribute('aria-pressed') === 'true', 'stack-' + index);
  }
  await page.evaluate(() => window.markerTest.render({ theme: 'dark' }));
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => window.stackChild === document.querySelector('[data-stack-choice="stack-2"]')), true);
  assert.equal(await page.evaluate(() => window.stackAnchor === document.querySelector('.diary-node-anchor')), true);
  assert.equal(await page.evaluate(() => window.stackCoordinates === JSON.stringify(window.markerTest.state.diaries)), true);
  await page.screenshot({ path: '/tmp/adrift-stack-5-dark.png' });
  await page.keyboard.press('Escape');
  await page.locator('.dn-stack-overlay').waitFor({ state: 'detached' });
  assert.equal(await stack.evaluate((el) => document.activeElement === el), true);
  await page.keyboard.press('Enter');
  await page.locator('.dn-arc-item .dn-hit').first().waitFor();
  await page.waitForFunction(() => document.activeElement.closest('[data-stack-choice]'));
  await page.keyboard.press('ArrowRight');
  assert.ok(await page.evaluate(() => document.activeElement.closest('[data-stack-choice]')));
  await page.keyboard.press('Escape');
  await page.locator('.dn-stack-overlay').waitFor({ state: 'detached' });
  await stack.click();
  await page.locator('.dn-arc-item .dn-hit').first().waitFor();
  await page.mouse.click(100, 100);
  await page.locator('.dn-stack-overlay').waitFor({ state: 'detached' });

  await page.evaluate(() => window.markerTest.render({ diaries: window.markerTest.makeStack(12), selectedId: 'stack-8', selectionToken: 1 }));
  await page.locator('.dn-stack-list').waitFor();
  assert.equal(await page.locator('.dn-stack-scroll > button').count(), 12);
  for (let index = 0; index < 12; index += 1) {
    await page.locator('button[data-stack-choice="stack-' + index + '"]').click();
    assert.equal(await page.evaluate(() => window.lastSelected._id), 'stack-' + index);
  }
  await page.evaluate(() => { window.listElement = document.querySelector('.dn-stack-scroll'); window.listElement.scrollTop = 180; });
  await page.evaluate(() => window.markerTest.render({ theme: 'bright' }));
  assert.equal(await page.evaluate(() => window.listElement === document.querySelector('.dn-stack-scroll')), true);
  assert.equal(await page.locator('.dn-stack-scroll').evaluate((el) => el.scrollTop), 180);
  await page.waitForTimeout(450);
  await page.screenshot({ path: '/tmp/adrift-stack-12-bright.png' });
  await page.evaluate(() => window.markerTest.map.jumpTo({ zoom: 14, bearing: 40, pitch: 35 }));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.dn-stack-scroll > button').count(), 12);
  await page.evaluate(() => window.markerTest.render({ diaries: window.markerTest.makeStack(11) }));
  await page.getByRole('button', { name: '11 篇日記', exact: true }).waitFor();
  assert.equal(await page.locator('.dn-stack-scroll > button').count(), 11);
  await page.evaluate(() => window.markerTest.render({ diaries: window.markerTest.makeStack(1), selectedId: null }));
  await page.locator('.dn-stack-overlay').waitFor({ state: 'detached' });
  assert.equal(await stack.getAttribute('aria-label'), '查看日記：記憶 1');

  await page.evaluate(() => {
    const test = window.markerTest;
    const records = test.makeStack(2);
    records[1] = { ...records[1], location: { coordinates: [120.001, 24] } };
    test.render({ diaries: records });
    test.map.jumpTo({ center: [120, 24], zoom: 16, bearing: 0, pitch: 0 });
  });
  await page.waitForFunction(() => document.querySelectorAll('.diary-node-anchor:not([hidden])').length === 2);
  await page.evaluate(() => { window.geoAnchors = [...document.querySelectorAll('.diary-node-anchor')]; window.markerTest.map.jumpTo({ zoom: 13 }); });
  await page.getByRole('button', { name: '2 篇日記', exact: true }).waitFor();
  await page.getByRole('button', { name: '2 篇日記', exact: true }).click();
  await page.locator('.dn-arc-item .dn-hit').first().waitFor();
  await page.evaluate(() => window.markerTest.map.jumpTo({ zoom: 16 }));
  await page.waitForFunction(() => document.querySelectorAll('.diary-node-anchor:not([hidden])').length === 2);
  assert.equal(await page.evaluate(() => window.geoAnchors.every((el) => el.isConnected)), true);
  await page.locator('.dn-stack-overlay').waitFor({ state: 'detached' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    window.markerTest.map.resize(); window.markerTest.map.jumpTo({ center: [120, 24], zoom: 15 });
    window.markerTest.render({ diaries: window.markerTest.makeStack(12), selectedId: 'stack-4', selectionToken: 2 });
  });
  await page.locator('.dn-stack-list').waitFor();
  await page.waitForTimeout(450);
  const listBounds = await page.locator('.dn-stack-list').boundingBox();
  assert.ok(listBounds.x >= 0 && listBounds.x + listBounds.width <= 390);
  assert.ok(listBounds.y >= 0 && listBounds.y + listBounds.height <= 844);
  await page.screenshot({ path: '/tmp/adrift-stack-12-mobile.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '收合記憶清單' }).click();
  await page.locator('.dn-stack-overlay').waitFor({ state: 'detached' });
  await stack.click();
  await page.locator('.dn-stack-list').waitFor();
  assert.ok(await page.locator('.dn-core').first().evaluate((el) => getComputedStyle(el).transitionDuration.split(',').every((value) => parseFloat(value) <= 0.00001)), 'reduced motion disables perceptible transitions');

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const performanceResults = [];
  for (const count of [50, 100, 300, 500]) {
    performanceResults.push(await page.evaluate(async (count) => {
      const test = window.markerTest;
      test.map.resize(); test.map.jumpTo({ center: [120, 24], zoom: 16, pitch: 0, bearing: 0 });
      const records = Array.from({ length: count }, (_, index) => {
        const point = test.map.unproject([40 + (index % 32) * 59, 50 + Math.floor(index / 32) * 64]);
        return { ...test.makeStack(1)[0], _id: `perf-${index}`, location: { coordinates: [point.lng, point.lat] } };
      });
      const { groupDiaryMarkers } = await import('/src/components/markers/markerGeometry.js');
      const times = Array.from({ length: 12 }, () => {
        const start = performance.now(); groupDiaryMarkers(records); return performance.now() - start;
      }).sort((a, b) => a - b);
      const started = performance.now();
      test.render({ diaries: records, selectedId: null });
      while (document.querySelectorAll('.diary-node-anchor:not([hidden]) .dn-hit').length !== count) {
        if (performance.now() - started > 10000) throw Error('Marker rendering timed out');
        await new Promise(requestAnimationFrame);
      }
      await new Promise(requestAnimationFrame);
      const renderMs = performance.now() - started;
      const anchors = [...document.querySelectorAll('.diary-node-anchor')];
      await new Promise((resolve) => setTimeout(resolve, 300));
      const frames = [];
      let previous = performance.now();
      test.map.easeTo({ center: [120.0002, 24.0001], zoom: 16.15, bearing: 5, duration: 650 });
      for (let index = 0; index < 45; index += 1) {
        const time = await new Promise(requestAnimationFrame);
        frames.push(time - previous); previous = time;
      }
      frames.sort((a, b) => a - b);
      if (!anchors.every((anchor) => anchor.isConnected)) throw Error('Camera rebuilt anchors');
      test.render({ selectedId: 'perf-0', theme: 'dark' });
      await new Promise(requestAnimationFrame);
      if (!anchors.every((anchor) => anchor.isConnected)) throw Error('Selection/theme rebuilt anchors');
      return { count, groupingMedianMs: +times[6].toFixed(2), renderMs: +renderMs.toFixed(1), frameMedianMs: +frames[22].toFixed(1), frameP95Ms: +frames[42].toFixed(1) };
    }, count));
  }
  console.log('PERFORMANCE', JSON.stringify(performanceResults));
  await page.evaluate(() => window.markerTest.root.unmount());
  assert.equal(await page.locator('.diary-node-anchor').count(), 0);
  await page.evaluate(() => window.markerTest.map.remove());

  // Exercise the actual map component as well as the isolated marker layer.
  await page.evaluate(async () => {
    const { React, createRoot, mapbox, makeStack } = window.markerTest;
    const OriginalMap = mapbox.Map;
    const style = (theme) => ({ version: 8, sources: { labels: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } }, layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': theme === 'dark' ? '#20272a' : '#edf1ef' } },
      ...['poi-label', 'road-label', 'settlement-label', 'airport-label'].map((id) => ({ id, type: 'symbol', source: 'labels', layout: {} }))
    ] });
    mapbox.Map = class extends OriginalMap {
      constructor(options) {
        super({ ...options, center: [120, 24], style: style('bright') });
        window.fullMap = this;
      }
      setStyle(value, options) { return super.setStyle(typeof value === 'string' ? style(value.includes('dark') ? 'dark' : 'bright') : value, options); }
    };
    const { default: MapView } = await import('/src/components/MapView.jsx');
    const { default: MemoryPanel } = await import('/src/components/MemoryPanel.jsx');
    const { default: DiarySidePanel } = await import('/src/components/DiarySidePanel.jsx');
    const mount = document.createElement('div');
    mount.style.cssText = 'position:fixed;inset:0';
    document.body.append(mount);
    const root = createRoot(mount);
    localStorage.setItem('adrift-map-onboarding-seen', 'true');
    const state = { diaries: makeStack(5).map((diary) => ({ ...diary, text: '這段記憶留在地圖上。', visibility: 'public', location: { ...diary.location, placeName: '海邊' } })), theme: 'bright', selectedDiary: null, focusLocation: null };
    function select(diary, options = {}) {
      window.lastSelected = diary;
      render({ selectedDiary: diary, focusLocation: { diaryId: diary._id, lat: 24, lng: 120, focusId: performance.now(), source: options.source || 'diary' } });
    }
    function render(updates = {}) {
      Object.assign(state, updates);
      document.documentElement.dataset.theme = state.theme;
      root.render(React.createElement('div', { className: 'app-layout', style: { height: '100vh', gridTemplateColumns: innerWidth < 700 ? '1fr' : 'minmax(0,1fr) 320px', padding: 12, opacity: 1, animation: 'none' } },
        React.createElement('div', { className: 'map-stage' },
          React.createElement(DiarySidePanel, { diary: state.selectedDiary, currentUser: { id: 'tester' }, onClose: () => render({ selectedDiary: null }) }),
          React.createElement(MapView, { ...state, currentLocation: { lng: 120, lat: 24, source: 'browser' }, onSelect: select })),
        innerWidth >= 700 && React.createElement(MemoryPanel, { user: { id: 'tester', userCode: 'tester' }, diaries: state.diaries, selectedDiaryId: state.selectedDiary?._id, onSelectDiary: select, lowPerformance: true })
      ));
    }
    window.fullMapTest = { root, state, render, select, restore: () => { mapbox.Map = OriginalMap; } };
    render();
  });
  await page.getByRole('button', { name: '5 篇日記', exact: true }).waitFor();
  await page.evaluate(() => { window.fullMap.jumpTo({ zoom: 12, bearing: 40, pitch: 35 }); });
  await page.getByRole('button', { name: '返回 2D 地圖' }).click();
  await page.getByRole('button', { name: '回到北方在上' }).click();
  await page.getByRole('button', { name: '縮小地圖' }).click();
  await page.getByRole('button', { name: '放大地圖' }).click();
  await page.getByRole('button', { name: '5 篇日記', exact: true }).click();
  await page.locator('.dn-arc-item .dn-hit, .dn-stack-scroll > button').first().waitFor();
  await page.waitForTimeout(450);
  await page.locator('[data-stack-choice="stack-4"] .dn-hit, button[data-stack-choice="stack-4"]').click();
  await page.locator('.memory-item.selected').waitFor();
  assert.match(await page.locator('.memory-item.selected').innerText(), /記憶 5/);
  await page.waitForTimeout(450);
  assert.match(await page.locator('.diary-side-content').innerText(), /記憶 5/);
  const cameraBefore = await page.evaluate(() => [window.fullMap.getCenter().lng, window.fullMap.getCenter().lat, window.fullMap.getZoom()]);
  await page.locator('[data-stack-choice="stack-2"] .dn-hit, button[data-stack-choice="stack-2"]').click();
  assert.deepEqual(await page.evaluate(() => [window.fullMap.getCenter().lng, window.fullMap.getCenter().lat, window.fullMap.getZoom()]), cameraBefore, 'expanded selection must not move the camera');
  await page.evaluate(() => {
    window.integratedAnchor = document.querySelector('.diary-node-anchor');
    window.fullMapTest.render({ theme: 'dark' });
  });
  await page.waitForFunction(() => window.fullMap.isStyleLoaded() && window.fullMap.getPaintProperty('bg', 'background-color') === '#20272a');
  assert.equal(await page.evaluate(() => window.integratedAnchor === document.querySelector('.diary-node-anchor')), true);
  assert.equal(await page.evaluate(() => Boolean(window.fullMap.getSource('current-location')) && Boolean(window.fullMap.getLayer('current-location-point'))), true);
  assert.equal(await page.evaluate(() => window.fullMap.getPaintProperty('poi-label', 'icon-opacity')), 0.35);
  assert.equal(await page.evaluate(() => window.fullMap.getPaintProperty('road-label', 'text-opacity')), 0.85);
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/adrift-integrated-dark.png' });
  await page.evaluate(() => {
    const test = window.fullMapTest;
    test.render({ theme: 'bright', diaries: window.markerTest.makeStack(30).map((diary) => ({ ...diary, text: '回顧城市記憶', location: { ...diary.location, placeName: '海邊' } })) });
  });
  await page.waitForFunction(() => window.fullMap.isStyleLoaded() && window.fullMap.getPaintProperty('bg', 'background-color') === '#edf1ef');
  await page.evaluate(() => window.fullMapTest.select(window.fullMapTest.state.diaries[29]));
  await page.waitForTimeout(500);
  const selectedBounds = await page.locator('.memory-item.selected').boundingBox();
  const scrollBounds = await page.locator('.diary-list-scroll-area').boundingBox();
  assert.ok(selectedBounds.y >= scrollBounds.y - 1 && selectedBounds.y + selectedBounds.height <= scrollBounds.y + scrollBounds.height + 1, 'selection scrolls only the right diary list');
  await page.locator('button[data-stack-choice="stack-29"][aria-pressed="true"]').waitFor();
  await page.screenshot({ path: '/tmp/adrift-integrated-bright.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.fullMapTest.render());
  await page.evaluate(() => window.fullMapTest.select(window.fullMapTest.state.diaries[15]));
  await page.waitForTimeout(550);
  const projected = await page.evaluate(() => {
    const map = window.fullMap;
    const bounds = map.getContainer().getBoundingClientRect();
    const point = map.project([120, 24]);
    const panel = document.querySelector('.diary-side-panel').getBoundingClientRect();
    return { x: bounds.left + point.x, y: bounds.top + point.y, panelTop: panel.top, mapTop: bounds.top };
  });
  assert.ok(projected.y > projected.mapTop && projected.y < projected.panelTop - 24, 'camera keeps selected memory above the mobile detail sheet');
  const mobileList = await page.locator('.dn-stack-list').boundingBox();
  assert.ok(mobileList.y + mobileList.height <= projected.panelTop, 'compact list must not obscure the detail sheet');
  const closeButton = page.getByRole('button', { name: 'Close diary', exact: true });
  await closeButton.click({ trial: true });
  await page.screenshot({ path: '/tmp/adrift-integrated-mobile.png' });
  if (process.env.REAL_MAP_STYLE === '1') {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const theme of ['bright', 'dark']) {
      await page.evaluate(async (theme) => {
        const test = window.fullMapTest;
        const diaries = test.state.diaries.slice(0, 5).map((diary) => ({ ...diary, user: { name: '測試使用者', userCode: 'tester' }, location: { coordinates: [121.5654, 25.033], placeName: '台北' } }));
        test.render({ theme, diaries, selectedDiary: diaries[2] });
        await new Promise((resolve) => setTimeout(resolve, 100));
        test.restore();
        window.markerTest.mapbox.Map.prototype.setStyle.call(window.fullMap, `mapbox://styles/mapbox/${theme === 'bright' ? 'light-v11' : 'dark-v11'}`, { diff: false });
        window.fullMap.jumpTo({ center: [121.5654, 25.033], zoom: 14, pitch: 0, bearing: 0 });
      }, theme);
      await page.waitForFunction(() => window.fullMap.isStyleLoaded() && window.fullMap.areTilesLoaded(), { timeout: 30000 });
      await page.waitForTimeout(900);
      await page.screenshot({ path: `/tmp/adrift-real-map-${theme}.png` });
    }
    console.log('PASS: live Mapbox light-v11 / dark-v11 tiles');
  }
  await page.evaluate(() => { window.fullMapTest.root.unmount(); window.fullMapTest.restore(); });
  assert.deepEqual(errors, []);
  console.log('PASS: projection, stable anchors, arcs/lists, keyboard, CRUD, screen collisions, list/detail/camera synchronization, theme/style reload, mobile sheet avoidance, reduced motion and cleanup');
} finally {
  await browser.close();
}
