import test from 'node:test';
import assert from 'node:assert/strict';
import { groupDiaryMarkers } from './markerGeometry.js';
import { groupProjectedMarkers, getStackLayout, getMapFocusOffset } from './markerLayout.js';

test('screen collisions merge neighboring geographic groups, retain representative and split on zoom', () => {
  const diaries = [0, 1, 2].map((n) => ({ _id: String(n), location: { coordinates: [120 + n * 0.001, 24] } }));
  const groups = groupDiaryMarkers(diaries);
  const project = (center) => ({ x: (center.lng - 120) * 40000, y: 200 });
  const clustered = groupProjectedMarkers(groups, project);
  assert.equal(clustered.length, 1);
  assert.equal(clustered[0].count, 3);
  assert.equal(clustered[0].memberKeys.length, 3);
  assert.deepEqual(clustered[0].center, groups[0].center);
  assert.equal(groupProjectedMarkers([...groups].reverse(), project, clustered)[0].groupKey, clustered[0].groupKey);
  const split = groupProjectedMarkers(groups, (center) => ({ x: (center.lng - 120) * 200000, y: 200 }), clustered);
  assert.equal(split.length, 3);
  assert.equal(new Set(split.flatMap((group) => group.diaries.map((diary) => diary._id))).size, 3);
});

test('2-6 items fit a bounded arc with 60px spacing; larger groups use a bounded list', () => {
  const bounds = { left: 0, top: 0, right: 1000, bottom: 700 };
  for (const count of [2, 3, 4, 5, 6]) {
    for (const center of [{ x: 500, y: 350 }, { x: 40, y: 350 }, { x: 960, y: 350 }]) {
      const layout = getStackLayout(count, center, bounds);
      assert.equal(layout.kind, 'arc');
      layout.items.forEach((point, index) => {
        assert.ok(point.x + center.x >= 38 && point.x + center.x <= 962);
        assert.ok(point.y + center.y >= 38 && point.y + center.y <= 662);
        for (const other of layout.items.slice(index + 1)) assert.ok(Math.hypot(point.x - other.x, point.y - other.y) >= 59.99);
      });
    }
  }
  for (const count of [7, 8, 12, 100]) {
    const layout = getStackLayout(count, { x: 380, y: 30 }, { left: 0, top: 0, right: 390, bottom: 640 });
    assert.equal(layout.kind, 'list');
    assert.ok(layout.x + 380 >= 12 && layout.x + 380 + layout.width <= 378);
    assert.ok(layout.y + 30 >= 12 && layout.y + 30 + layout.height <= 628);
  }
});

test('crowded viewports fall back to a list and avoid panel obstacles where space exists', () => {
  const viewport = { left: 0, top: 0, right: 800, bottom: 600 };
  const obstacle = { left: 0, top: 0, right: 350, bottom: 600 };
  const layout = getStackLayout(12, { x: 400, y: 300 }, viewport, [obstacle]);
  assert.equal(layout.kind, 'list');
  assert.ok(layout.x + 400 >= obstacle.right);
  assert.equal(getStackLayout(6, { x: 130, y: 70 }, { left: 0, top: 0, right: 260, bottom: 140 }).kind, 'list');
  const mobile = getStackLayout(12, { x: 195, y: 422 }, { left: 0, top: 0, right: 390, bottom: 844 });
  assert.ok(mobile.y + mobile.height < -26, 'prefer space above the stack over covering its trigger');
  const sheet = { left: 10, top: 270, right: 380, bottom: 640 };
  const aboveSheet = getStackLayout(30, { x: 195, y: 140 }, { left: 0, top: 0, right: 390, bottom: 640 }, [sheet]);
  assert.ok(140 + aboveSheet.y + aboveSheet.height <= sheet.top, 'shorten the list rather than cover the detail sheet');
});

test('camera targets actual unobstructed space, ignoring panels outside the map', () => {
  const viewport = { left: 100, top: 80, right: 1100, bottom: 780 };
  assert.deepEqual(getMapFocusOffset(viewport), [0, 0]);
  assert.deepEqual(getMapFocusOffset(viewport, [{ left: 1150, right: 1450, top: 0, bottom: 900 }]), [0, 0]);
  const [x, y] = getMapFocusOffset(viewport, [{ left: 100, right: 440, top: 80, bottom: 780 }]);
  assert.ok(x + 600 > 472);
  assert.equal(y, 0);
  const [, mobileY] = getMapFocusOffset({ left: 0, top: 0, right: 390, bottom: 640 }, [{ left: 10, top: 330, right: 380, bottom: 630 }]);
  assert.ok(mobileY + 320 < 300);
});
