export const agentNow = new Date('2026-10-30T04:00:00Z');
export function agentDiaryFixtures(owner, other, paging) {
  const base = user => ({ user, title: '合成城市記憶', text: '這是隔離測試日記，不是真實使用者資料。',
    mood: { type: 'calm', intensity: 2 }, location: { type: 'Point', coordinates: [121, 25], placeName: '臺北' },
    visibility: 'private', updatedAt: agentNow });
  const rows = [
    ['2025-12-31T15:59:59.999Z', 'sad', 1, '臺北河岸'],
    ['2025-12-31T16:00:00Z', 'joy', 3, '台北車站'],
    ['2026-01-01T15:59:59.999Z', 'joy', 5, 'Taipei Daan'],
    ['2026-01-01T16:00:00Z', 'calm', 2, '臺中學校'],
    ['2026-03-10T04:00:00Z', 'calm', null, '臺中公園'],
    ['2026-06-15T04:00:00Z', 'joy', 4, '臺北咖啡店'],
    ['2026-09-01T04:00:00Z', 'confused', 2, 'Taipei Riverside'],
    ['2026-10-01T04:00:00Z', 'anxious', 5, '臺中學校'],
    ['2026-10-30T04:00:00Z', 'calm', 1, '臺北河岸']
  ].map(([date, type, intensity, placeName], index) => ({ ...base(owner), createdAt: new Date(date), title: `合成事件 ${index}`,
    text: index === 5 ? '和同學在咖啡店完成作品。'.padEnd(2000, '記') : `合成生活紀錄 ${index}。`,
    mood: { type, intensity }, location: { ...base(owner).location, placeName }, visibility: ['private', 'friends', 'public'][index % 3] }));
  return { owned: rows, foreign: ['private', 'friends', 'public'].map(visibility => ({ ...base(other), createdAt: agentNow, visibility,
    text: 'FOREIGN ACCOUNT PRIVATE DATA', location: { ...base(other).location, placeName: 'New Taipei' } })),
  paging: Array.from({ length: 23 }, (_, index) => ({ ...base(paging), title: `分頁 ${index}`, createdAt: agentNow })) };
}
