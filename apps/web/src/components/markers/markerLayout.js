export const MARKER_COLLISION_PIXELS = 56;

export function groupProjectedMarkers(groups, project, previous = []) {
  const points = groups.map((group) => project(group.center));
  const parents = groups.map((_, index) => index);
  function root(index) {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  }
  const cells = new Map();
  points.forEach((point, index) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const x = Math.floor(point.x / MARKER_COLLISION_PIXELS);
    const y = Math.floor(point.y / MARKER_COLLISION_PIXELS);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const other of cells.get(`${x + dx}:${y + dy}`) || []) {
          if (Math.hypot(point.x - points[other].x, point.y - points[other].y) < MARKER_COLLISION_PIXELS) {
            parents[root(index)] = root(other);
          }
        }
      }
    }
    const key = `${x}:${y}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(index);
  });
  const components = new Map();
  groups.forEach((group, index) => {
    const key = root(index);
    if (!components.has(key)) components.set(key, []);
    components.get(key).push(group);
  });
  return [...components.values()].map((members) => {
    const memberKeys = members.map((group) => group.groupKey).sort();
    const retained = previous.filter((group) => memberKeys.includes(group.groupKey)).sort((a, b) => a.groupKey.localeCompare(b.groupKey))[0];
    const anchor = members.find((group) => group.groupKey === retained?.groupKey)
      || members.find((group) => group.groupKey === memberKeys[0]);
    const diaries = members.flatMap((group) => group.diaries).sort((a, b) =>
      (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || String(a._id).localeCompare(String(b._id)));
    return { ...anchor, memberKeys, diaries, count: diaries.length, isStack: diaries.length > 1 };
  });
}

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function freeSpaces(bounds, obstacles) {
  let spaces = [bounds];
  for (const obstacle of obstacles) {
    const blocked = { left: obstacle.left - 12, right: obstacle.right + 12, top: obstacle.top - 12, bottom: obstacle.bottom + 12 };
    spaces = spaces.flatMap((space) => !intersects(space, blocked) ? [space] : [
      { ...space, right: Math.min(space.right, blocked.left) },
      { ...space, left: Math.max(space.left, blocked.right) },
      { ...space, bottom: Math.min(space.bottom, blocked.top) },
      { ...space, top: Math.max(space.top, blocked.bottom) }
    ]).filter((space) => space.right > space.left && space.bottom > space.top);
  }
  const area = (space) => (space.right - space.left) * (space.bottom - space.top);
  return spaces.sort((a, b) => area(b) - area(a));
}

export function getMapFocusOffset(viewport, obstacles = []) {
  const bounds = { left: viewport.left + 32, right: viewport.right - 32, top: viewport.top + 32, bottom: viewport.bottom - 32 };
  const best = freeSpaces(bounds, obstacles)[0] || viewport;
  return [(best.left + best.right - viewport.left - viewport.right) / 2,
    (best.top + best.bottom - viewport.top - viewport.bottom) / 2];
}

function fits(rect, bounds, obstacles) {
  return rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom
    && !obstacles.some((obstacle) => intersects(rect, obstacle));
}

export function getStackLayout(count, center, viewport, obstacles = []) {
  const bounds = { left: viewport.left + 12, right: viewport.right - 12, top: viewport.top + 12, bottom: viewport.bottom - 12 };
  const angle = Math.atan2((bounds.top + bounds.bottom) / 2 - center.y, (bounds.left + bounds.right) / 2 - center.x);
  if (count >= 2 && count <= 6) {
    const span = count <= 3 ? Math.PI * 2 / 3 : Math.PI;
    const radius = Math.max(76, Math.ceil(60 / (2 * Math.sin(span / (count - 1) / 2))));
    const directions = [angle, 0, Math.PI, -Math.PI / 2, Math.PI / 2, -Math.PI / 4, Math.PI / 4, Math.PI * 3 / 4, -Math.PI * 3 / 4];
    for (const direction of directions) {
      const items = Array.from({ length: count }, (_, index) => {
        const theta = direction - span / 2 + index * span / (count - 1);
        return { x: Math.cos(theta) * radius, y: Math.sin(theta) * radius };
      });
      if (items.every(({ x, y }) => fits({ left: center.x + x - 26, right: center.x + x + 26, top: center.y + y - 26, bottom: center.y + y + 26 }, bounds, obstacles))) {
        return { kind: 'arc', items };
      }
    }
  }
  let width = Math.min(288, Math.max(0, bounds.right - bounds.left));
  let height = Math.min(348, 60 + count * 56, Math.max(0, bounds.bottom - bounds.top));
  const spaces = freeSpaces(bounds, obstacles);
  if (!spaces.some((space) => space.right - space.left >= width && space.bottom - space.top >= height)) {
    const available = spaces.find((space) => space.right - space.left >= Math.min(240, width) && space.bottom - space.top >= 116);
    if (available) {
      width = Math.min(width, available.right - available.left);
      height = Math.min(height, available.bottom - available.top);
    }
  }
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const candidates = [
    [center.x + 36, center.y - height / 2], [center.x - width - 36, center.y - height / 2],
    [center.x - width / 2, center.y - height - 36], [center.x - width / 2, center.y + 36],
    [bounds.right - width, bounds.top], [bounds.left, bounds.top],
    [bounds.left, bounds.bottom - height], [bounds.right - width, bounds.bottom - height]
  ].map(([x, y]) => ({ left: clamp(x, bounds.left, bounds.right - width), top: clamp(y, bounds.top, bounds.bottom - height) }));
  const avoid = [...obstacles, { left: center.x - 26, right: center.x + 26, top: center.y - 26, bottom: center.y + 26 }];
  const position = candidates.find(({ left, top }) => fits({ left, top, right: left + width, bottom: top + height }, bounds, avoid))
    || candidates.find(({ left, top }) => fits({ left, top, right: left + width, bottom: top + height }, bounds, obstacles)) || candidates[0];
  return { kind: 'list', x: position.left - center.x, y: position.top - center.y, width, height };
}

export function getMapObstacles(map) {
  const container = map.getContainer();
  const area = container.closest('.app-layout') || container.parentElement;
  return [...(area?.querySelectorAll('.diary-side-panel, .memory-panel, .map-controls, .map-memory-legend') || [])]
    .filter((element) => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
    .map((element) => element.getBoundingClientRect());
}

export function projectGroup(map, center) {
  const lng = center.lng + Math.round((map.getCenter().lng - center.lng) / 360) * 360;
  return map.project([lng, center.lat]);
}
