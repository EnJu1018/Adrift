import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeInsight, trendBins } from './insightData.js';

test('trend bins use Taipei calendar dates, weighted intensities and genuine gaps', () => {
  const bins = trendBins({ start: '2026-10-01T16:30:00Z', end: '2026-10-08T16:30:00Z', daily: [
    { date: '2026-10-02', count: 1, averageIntensity: 5, intensityCount: 1 },
    { date: '2026-10-03', count: 3, averageIntensity: 1, intensityCount: 3 },
    { date: '2026-10-09', count: 1, averageIntensity: 3, intensityCount: 1 }
  ] });
  assert.equal(bins.length, 4);
  assert.equal(bins[0].count, 4);
  assert.equal(bins[0].average, 2);
  assert.equal(bins[1].average, null);
  assert.equal(bins[3].average, 3);
  assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), 5);
});
test('invalid data has no invented trend; insight normalization tolerates missing fields', () => {
  assert.deepEqual(trendBins({ start: 'invalid', end: 'invalid' }), []);
  const insight = normalizeInsight({ summary: '實際摘要', suggestions: [null, '', '留下生活片段'], moodTrend: { dominantMood: 'confused' } });
  assert.equal(insight.moodTrend.dominantMood, '疑惑');
  assert.deepEqual(insight.suggestions, ['留下生活片段']);
  assert.deepEqual(insight.locationInsights, []);
});
