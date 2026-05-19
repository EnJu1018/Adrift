const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const placeCache = new Map();

export function formatCoordinates(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '未知位置';
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

export async function resolvePlaceName(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '未知位置';

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (placeCache.has(cacheKey)) return placeCache.get(cacheKey);

  if (!MAPBOX_TOKEN) {
    const fallback = formatCoordinates(lat, lng);
    placeCache.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const query = new URLSearchParams({
      types: 'place,locality,district,region',
      language: 'zh-Hant,zh',
      access_token: MAPBOX_TOKEN
    });
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${query.toString()}`
    );

    if (!response.ok) throw new Error('Reverse geocoding failed');

    const payload = await response.json().catch(() => null);
    const features = Array.isArray(payload?.features) ? payload.features : [];
    const feature =
      features.find((item) => item.place_type?.includes('place')) ||
      features.find((item) => item.place_type?.includes('locality')) ||
      features.find((item) => item.place_type?.includes('district')) ||
      features[0];
    const placeName = feature?.text_zh_Hant || feature?.text_zh || feature?.text || formatCoordinates(lat, lng);

    placeCache.set(cacheKey, placeName);
    return placeName;
  } catch {
    const fallback = formatCoordinates(lat, lng);
    placeCache.set(cacheKey, fallback);
    return fallback;
  }
}
