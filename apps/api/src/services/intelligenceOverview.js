import { normalizeTaiwanPlaceName } from '../utils/locationFormatter.js';

export async function getIntelligenceOverview(Diary, userId, days = '30', now = new Date()) {
  if (typeof days !== 'string' || !['7', '30', '90'].includes(days)) throw Object.assign(new Error('請選擇 7、30 或 90 天'), { status: 400 });
  const end = now, start = new Date(now.getTime() - Number(days) * 86400000);
  const intensity = { $cond: [{ $and: [{ $isNumber: '$mood.intensity' }, { $gte: ['$mood.intensity', 1] }, { $lte: ['$mood.intensity', 5] }] }, '$mood.intensity', null] };
  const [result] = await Diary.aggregate([
    { $match: { user: userId, createdAt: { $gte: start, $lte: end } } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $facet: {
      totals: [{ $count: 'count' }],
      moods: [{ $group: { _id: '$mood.type', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }],
      daily: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Taipei' } }, count: { $sum: 1 }, averageIntensity: { $avg: intensity }, intensityCount: { $sum: { $cond: [{ $ne: [intensity, null] }, 1, 0] } } } }, { $sort: { _id: 1 } }],
      places: [{ $match: { 'location.placeName': { $type: 'string', $ne: '' } } },
        { $group: { _id: '$location.placeName', count: { $sum: 1 }, diaryId: { $first: '$_id' }, mood: { $first: '$mood.type' }, latestAt: { $first: '$createdAt' } } },
        { $sort: { count: -1, _id: 1 } }]
    } }
  ]).option({ maxTimeMS: 5000 });
  const places = new Map();
  for (const item of result.places) {
    const name = normalizeTaiwanPlaceName(item._id).trim();
    if (!name) continue;
    const existing = places.get(name);
    if (existing) {
      existing.count += item.count;
      if (item.latestAt > existing.latestAt) { existing.diaryId = item.diaryId; existing.mood = item.mood; existing.latestAt = item.latestAt; }
    } else places.set(name, { name, count: item.count, diaryId: item.diaryId, mood: item.mood, latestAt: item.latestAt });
  }
  return { days: Number(days), start, end, count: result.totals[0]?.count || 0,
    moods: result.moods.map(item => ({ type: item._id, count: item.count })),
    daily: result.daily.map(({ _id, ...day }) => ({ date: _id, ...day })),
    placeCount: places.size, places: [...places.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5) };
}
