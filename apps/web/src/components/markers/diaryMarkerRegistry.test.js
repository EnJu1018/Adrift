import test from 'node:test';
import assert from 'node:assert/strict';
import { clearDiaryMarkers, reconcileDiaryMarkers } from './diaryMarkerRegistry.js';
import { markerTitle, markerMood, markerTime } from './markerText.js';

test('marker registry retains instances across data, theme, selection and zoom visibility changes', () => {
  const calls = { created: 0, removed: 0, positioned: 0 };
  class Marker {
    constructor(options) { this.options = options; calls.created += 1; }
    setLngLat(value) { this.coordinates = value; calls.positioned += 1; return this; }
    addTo() { return this; }
    remove() { calls.removed += 1; }
  }
  const entries = new Map();
  const options = { Marker, map: {}, createElement: () => ({}), visible: true };
  const diary = { _id: 'a', title: 'Before', location: { coordinates: [120, 24] } };
  const first = reconcileDiaryMarkers(entries, [diary], options)[0];
  assert.equal(first.marker.options.anchor, 'center');
  assert.equal(first.marker.options.pitchAlignment, 'viewport');
  assert.equal(first.marker.options.rotationAlignment, 'viewport');
  assert.equal(reconcileDiaryMarkers(entries, [{ ...diary, title: 'After' }], options)[0], first);
  reconcileDiaryMarkers(entries, [diary], { ...options, visible: false });
  assert.equal(first.element.hidden, true);
  reconcileDiaryMarkers(entries, [diary], options);
  assert.equal(first.element.hidden, false);
  assert.deepEqual(calls, { created: 1, removed: 0, positioned: 1 });
  reconcileDiaryMarkers(entries, [{ ...diary, location: { lng: 121, lat: 25 } }], options);
  assert.deepEqual(first.marker.coordinates, [121, 25]);
  assert.equal(calls.positioned, 2);
  reconcileDiaryMarkers(entries, [], options);
  assert.equal(calls.removed, 1);
  assert.equal(entries.size, 0);
  clearDiaryMarkers(entries);
  assert.equal(calls.removed, 1);
});

test('hidden new records are lazy; invalid coordinates never create markers', () => {
  const entries = new Map();
  const options = { visible: false, Marker: class { constructor() { throw Error('unexpected marker'); } } };
  reconcileDiaryMarkers(entries, [{ _id: 'a', coordinates: [120, 24] }], options);
  reconcileDiaryMarkers(entries, [{ _id: 'b', coordinates: ['', ''] }], { ...options, visible: true });
  assert.equal(entries.size, 0);
});

test('tooltip text shares mood aliases, valid timestamps and content fallback', () => {
  assert.equal(markerTitle({ content: 'Today' }), 'Today');
  assert.equal(markerMood('confused'), '疑惑');
  assert.equal(markerMood('happy'), '開心');
  assert.equal(markerTime('bad-date'), '時間未提供');
  assert.equal(markerTime(null), '時間未提供');
});
