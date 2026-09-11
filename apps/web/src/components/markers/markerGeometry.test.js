import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDiaryCoordinate, groupDiaryMarkers, distanceMeters } from './markerGeometry.js';

const diary = (id, meters = 0) => ({ _id: id, createdAt: '2026-01-01', location: { coordinates: [120, 24 + meters / 111195] } });

test('coordinates accept supported pairs without mixing fields or guessing coordinate order', () => {
  for (const value of [
    { location: { lng: '120', lat: '24' } }, { location: { longitude: 120, latitude: 24 } },
    { geo: { coordinates: [120, 24] } }, { coordinates: ['120', '24'] }, { longitude: 120, latitude: 24 }
  ]) assert.deepEqual(normalizeDiaryCoordinate(value), { lng: 120, lat: 24 });
  for (const coordinates of [['', ''], [null, null], [true, false], [200, 100], [24, 120], ['NaN', 24]]) {
    assert.equal(normalizeDiaryCoordinate({ coordinates }), null);
  }
  assert.equal(normalizeDiaryCoordinate({ location: { lng: 120 }, lat: 24 }), null);
  assert.deepEqual(normalizeDiaryCoordinate({ coordinates: [0, 0] }), { lng: 0, lat: 0 });
});

test('20m connected groups include chains, preserve input and ignore duplicates / invalid records', () => {
  const input = [diary('a'), diary('b', 15), diary('c', 30), diary('d', 1000)];
  const before = structuredClone(input);
  const groups = groupDiaryMarkers([...input, input[0], { _id: 'invalid' }]);
  assert.deepEqual(groups.map((g) => g.count), [3, 1]);
  assert.deepEqual(groupDiaryMarkers([...input].reverse()), groups);
  assert.deepEqual(input, before);
  assert.equal(groupDiaryMarkers([diary('a'), diary('b')])[0].count, 2);
  assert.equal(groupDiaryMarkers([diary('a'), diary('b', 21)]).length, 2);
  assert.deepEqual(groupDiaryMarkers([]), []);
});

test('existing anchor survives insertion; deletion and movement produce truthful centers and counts', () => {
  const groups = groupDiaryMarkers([diary('b'), diary('c', 10)]);
  const inserted = groupDiaryMarkers([diary('a', 5), diary('b'), diary('c', 10)], groups);
  assert.equal(inserted[0].groupKey, groups[0].groupKey);
  assert.deepEqual(inserted[0].center, groups[0].center);
  const deleted = groupDiaryMarkers([diary('c', 10)], groups);
  assert.equal(deleted[0].isStack, false);
  assert.deepEqual(deleted[0].center, normalizeDiaryCoordinate(diary('c', 10)));
  const moved = groupDiaryMarkers([diary('b', 500), diary('c', 10)], groups);
  assert.equal(moved.length, 2);
  assert.equal(new Set(moved.map((g) => g.groupKey)).size, 2);
  assert.ok(distanceMeters({ lng: 179.99999, lat: 0 }, { lng: -179.99999, lat: 0 }) < 20);
});
