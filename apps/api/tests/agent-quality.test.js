import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessAgentAnswer, CLAIM_LABELS } from '../src/services/agentQuality.js';
const diary = { id: 'a', content: '找到問題，還沒修好。' };
const source = { id: 'a', start: 0, end: diary.content.length, quote: diary.content };
test('a valid citation does not prove an unsupported semantic conclusion', () => {
  const result = assessAgentAnswer({ state: 'COMPLETED', answer: '已經修好', sources: [source], claims: [{ kind: 'inference' }] }, { diaries: [diary], requiredIds: ['a'], forbidden: ['已經修好'] });
  assert.equal(result.sourceValidity, true); assert.equal(result.functionalPass, false); assert.equal(result.claims[0].label, 'UNSUPPORTED_CLAIM');
});
test('exact negated quotes remain facts, with independent semantic review still pending', () => {
  const result = assessAgentAnswer({ state: 'COMPLETED', answer: diary.content, sources: [source], claims: [{ kind: 'diary_quote', ...source }] }, { diaries: [diary], requiredIds: ['a'], concepts: [['還沒']] });
  assert.equal(result.functionalPass, true); assert.equal(result.claims[0].label, 'SUPPORTED_FACT'); assert.match(result.semanticReview, /PENDING/);
});
test('missing events and forged spans fail even when some IDs are real', () => {
  assert.equal(assessAgentAnswer({ state: 'COMPLETED', answer: diary.content, sources: [source] }, { diaries: [diary], requiredIds: ['b'] }).functionalPass, false);
  assert.equal(assessAgentAnswer({ sources: [{ ...source, quote: '捏造' }] }, { diaries: [diary] }).sourceValidity, false);
});
test('statistics are not verified by citation validity or a model self-score', () => {
  const result = assessAgentAnswer({ claims: [{ kind: 'statistics', total: 999 }] }, { diaries: [] });
  assert.equal(result.claims[0].label, 'INSUFFICIENT_EVIDENCE'); assert.equal(CLAIM_LABELS.length, 5);
});
