import { MOOD_LABELS } from '../../constants/app.js';
import { normalizeTaiwanPlaceName } from '../../utils/locationFormatter.js';

export const moodColors = { calm: '#158e91', joy: '#c18822', sad: '#568bc9', wonder: '#9276b7', anxious: '#b36c86', confused: '#7c83bf', nostalgic: '#889466', other: '#7c909c' };
export const moodLabel = value => (MOOD_LABELS[value] || value || '未分類').replace(/^[^\p{L}\p{N}]+/u, '').trim();
export const shortDate = value => new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Taipei' }).format(new Date(value));
export function trendBins(overview) {
  if (!overview?.start || !overview?.end) return [];
  const start = new Date(overview.start).getTime(), end = new Date(overview.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const startDay = Math.floor((start + 8 * 3600000) / 86400000);
  const endDay = Math.floor((end + 8 * 3600000) / 86400000), size = Math.ceil((endDay - startDay + 1) / 5);
  const bins = Array.from({ length: Math.ceil((endDay - startDay + 1) / size) }, (_, index) => ({
    start: new Date((startDay + index * size) * 86400000 - 8 * 3600000),
    end: new Date((Math.min(endDay, startDay + (index + 1) * size - 1)) * 86400000 - 8 * 3600000), count: 0, weight: 0, total: 0
  }));
  for (const day of overview.daily || []) {
    const dayNumber = Math.floor(Date.parse(`${day.date}T00:00:00+08:00`) / 86400000 + 8 / 24);
    const bin = bins[Math.floor((dayNumber - startDay) / size)];
    if (!bin) continue;
    bin.count += day.count;
    if (Number.isFinite(day.averageIntensity) && day.intensityCount > 0) { bin.total += day.averageIntensity * day.intensityCount; bin.weight += day.intensityCount; }
  }
  return bins.map(({ total, weight, ...bin }) => ({ ...bin, average: weight ? total / weight : null }));
}

export function normalizeInsight(value) {
  const mood = value?.moodTrend || {};
  const text = value => typeof value === 'string' ? normalizeTaiwanPlaceName(value) : '';
  const list = value => Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).map(text) : [];
  return { summary: text(value?.summary), moodTrend: { description: text(mood.description), dominantMood: moodLabel(text(mood.dominantMood)), averageIntensity: Number.isFinite(Number(mood.averageIntensity)) ? Number(mood.averageIntensity) : 0 },
    locationInsights: Array.isArray(value?.locationInsights) ? value.locationInsights.filter(item => item && typeof item === 'object').map(item => ({ place: text(item.place), insight: text(item.insight), dominantMood: moodLabel(text(item.dominantMood)) })) : [],
    behaviorPatterns: list(value?.behaviorPatterns), suggestions: list(value?.suggestions) };
}
