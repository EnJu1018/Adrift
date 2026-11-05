export const CLAIM_LABELS = ['SUPPORTED_FACT', 'SUPPORTED_INFERENCE', 'INSUFFICIENT_EVIDENCE', 'CONTRADICTED_CLAIM', 'UNSUPPORTED_CLAIM'];

// Extractive verification is not semantic entailment. Unknown free prose requires review.
export function assessAgentAnswer(result, { diaries, requiredIds = [], concepts = [], forbidden = [], empty = false }) {
  const byId = new Map(diaries.map(row => [row.id, row]));
  const sources = result.sources || [];
  const sourceValidity = sources.every(source => {
    const diary = byId.get(source.id);
    return diary && Number.isInteger(source.start) && Number.isInteger(source.end) && source.end > source.start
      && source.quote === diary.content.slice(source.start, source.end);
  });
  const ids = new Set(sources.map(row => row.id));
  const coverage = requiredIds.every(id => ids.has(id));
  const answer = result.answer || '';
  const conceptCoverage = concepts.every(group => group.some(word => answer.includes(word)));
  const contradicted = forbidden.filter(phrase => answer.includes(phrase));
  const claims = (result.claims || []).map(claim => ({ kind: claim.kind, label: claim.kind === 'diary_quote'
    ? sourceValidity && sources.some(source => source.id === claim.id && source.quote === claim.quote) ? 'SUPPORTED_FACT' : 'UNSUPPORTED_CLAIM'
    : claim.kind === 'statistics' ? 'INSUFFICIENT_EVIDENCE' : 'UNSUPPORTED_CLAIM',
    reason: claim.kind === 'statistics' ? 'Requires independent numeric oracle; source IDs alone do not prove aggregates.' : 'Exact source span check only; not general semantic entailment.' }));
  return { sourceValidity, coverage, conceptCoverage, contradicted, claims,
    functionalPass: sourceValidity && coverage && conceptCoverage && !contradicted.length && (empty ? result.state === 'INSUFFICIENT_EVIDENCE' : result.state === 'COMPLETED'),
    semanticReview: 'PENDING_INDEPENDENT_REVIEW' };
}
