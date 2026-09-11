export const OVERLAP_DISTANCE_METERS = 20;

function coordinate(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeDiaryCoordinate(diary) {
  const candidates = [
    diary?.location?.coordinates,
    diary?.geo?.coordinates,
    diary?.coordinates,
    [diary?.location?.lng ?? diary?.location?.longitude, diary?.location?.lat ?? diary?.location?.latitude],
    [diary?.lng ?? diary?.longitude, diary?.lat ?? diary?.latitude]
  ];

  for (const pair of candidates) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lng = coordinate(pair[0]);
    const lat = coordinate(pair[1]);
    if (lng !== null && lat !== null && Math.abs(lng) <= 180 && Math.abs(lat) <= 90) {
      return { lng, lat };
    }
  }
  return null;
}

export function distanceMeters(a, b) {
  const radians = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * radians / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians)
    * Math.sin((b.lng - a.lng) * radians / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}

// Connected components keep adjacent memories together, including A-B-C chains.
// The previous representative is retained while it remains in the collection.
export function groupDiaryMarkers(diaries, previousGroups = []) {
  const entries = new Map();
  for (const diary of diaries) {
    const center = normalizeDiaryCoordinate(diary);
    const id = diary?._id == null ? '' : String(diary._id);
    if (id && center && !entries.has(id)) entries.set(id, { id, diary, center });
  }
  const nodes = [...entries.values()].sort((a, b) => a.id.localeCompare(b.id));
  const parents = nodes.map((_, index) => index);
  function find(index) {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  }
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (distanceMeters(nodes[i].center, nodes[j].center) <= OVERLAP_DISTANCE_METERS) {
        parents[find(j)] = find(i);
      }
    }
  }
  const components = new Map();
  nodes.forEach((node, index) => {
    const root = find(index);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(node);
  });

  return [...components.values()].map((members) => {
    const ids = new Set(members.map((node) => node.id));
    const previous = previousGroups
      .filter((group) => ids.has(group.anchorId))
      .sort((a, b) => a.groupKey.localeCompare(b.groupKey))[0];
    const anchor = members.find((node) => node.id === previous?.anchorId) || members[0];
    const ordered = [...members].sort((a, b) => {
      const aTime = Date.parse(a.diary.createdAt) || 0;
      const bTime = Date.parse(b.diary.createdAt) || 0;
      return bTime - aTime || a.id.localeCompare(b.id);
    });
    return {
      groupKey: previous?.groupKey || `memory-${anchor.id}`,
      anchorId: anchor.id,
      center: { ...anchor.center },
      diaries: ordered.map((node) => node.diary),
      count: members.length,
      isStack: members.length > 1
    };
  });
}
