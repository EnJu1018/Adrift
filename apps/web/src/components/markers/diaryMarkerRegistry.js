import { normalizeDiaryCoordinate } from './markerGeometry.js';

export function reconcileDiaryMarkers(entries, diaries, { map, Marker, createElement, visible }) {
  const keep = new Set();
  for (const diary of diaries) {
    const coordinates = normalizeDiaryCoordinate(diary);
    if (!coordinates || diary?._id == null) continue;
    const id = String(diary._id);
    keep.add(id);
    let entry = entries.get(id);
    if (!entry && visible) {
      const element = createElement();
      const marker = new Marker({ element, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport' })
        .setLngLat([coordinates.lng, coordinates.lat]).addTo(map);
      entry = { id, element, marker, coordinates };
      entries.set(id, entry);
    }
    if (!entry) continue;
    if (entry.coordinates.lng !== coordinates.lng || entry.coordinates.lat !== coordinates.lat) {
      entry.marker.setLngLat([coordinates.lng, coordinates.lat]);
      entry.coordinates = coordinates;
    }
    entry.element.hidden = !visible;
  }
  for (const [id, entry] of entries) {
    if (!keep.has(id)) {
      entry.marker.remove();
      entries.delete(id);
    }
  }
  return [...entries.values()];
}

export function clearDiaryMarkers(entries) {
  for (const entry of entries.values()) entry.marker.remove();
  entries.clear();
}
