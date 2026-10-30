import { getEmotionStatistics } from './diaryRetrieval.js';
export { diaryIntensity } from './diaryRetrieval.js';

export async function getIntelligenceOverview(Diary, userId, days = '30', now = new Date()) {
  if (typeof days !== 'string' || !['7', '30', '90'].includes(days)) throw Object.assign(new Error('請選擇 7、30 或 90 天'), { status: 400 });
  const end = now, start = new Date(now.getTime() - Number(days) * 86400000);
  const result = await getEmotionStatistics(Diary, userId, { range: { start, end, endInclusive: true }, asOf: now });
  return { days: Number(days), start, end, count: result.total,
    moods: result.moods.map(item => ({ type: item._id, count: item.count })), daily: result.daily,
    placeCount: result.placeCount, places: result.places.slice(0, 5).map(item => ({ name: item._id, count: item.count, diaryId: item.latest?.diaryId, mood: item.latest?.mood, latestAt: item.latest?.latestAt })) };
}
