import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import mongoose from 'mongoose';
import Diary from '../src/models/Diary.js';
import { createMemoryAgent } from '../src/services/memoryAgent.js';
import { assessAgentAnswer } from '../src/services/agentQuality.js';
import { semanticAcceptance } from '../tests/fixtures/semanticAcceptance.js';

const root = process.env.ORIGINAL_BENCHMARK_DIR;
const read = name => JSON.parse(readFileSync(join(root, name), 'utf8'));
const sha = file => createHash('sha256').update(readFileSync(join(root, file))).digest('hex');
const frozen = read('rubric-freeze.json'), manifest = read('MANIFEST.json');
for (const [name, hash] of Object.entries({ ...manifest, ...frozen })) assert.equal(sha(name), hash, `Original integrity: ${name}`);
const fixture = read('fixtures.json'), historical = fixture.tools.map(item => read(`M2-tool-${item.id}-summary.json`));
assert.equal(fixture.tools.length, 12);
console.log(JSON.stringify({ stage: 'original_verified', files: Object.keys(manifest).length, frozen, historical: {
  selection: historical.filter(row => row.grading.tool_selection_ok).length, arguments: historical.filter(row => row.grading.arguments_ok).length,
  strict: historical.filter(row => row.grading.pass).length, total: 12 }, method: 'verified original recorded grades; not a fresh v1 inference run' }));
const uri = new URL(process.env.AGENT_QUALITY_MONGO_URI);
assert.ok(uri.hostname === '127.0.0.1' && /^\/adrift_agent_quality_test_[a-z\d_-]+$/.test(uri.pathname));
const gpu = process.argv.includes('--gpu'), host = process.env.AGENT_SMOKE_SSH_HOST;
if (gpu) assert.match(host || '', /^[a-z\d_.@-]+$/i);
async function remote(kind, input) {
  const program = `import{readFileSync}from'node:fs';import{createOllamaProvider}from'/root/adrift-phase2-check/apps/api/src/services/ollama.js';let text='';for await(const c of process.stdin)text+=c;const v=JSON.parse(text);const p=createOllamaProvider({token:JSON.parse(readFileSync('/etc/adrift-ai/clients.json','utf8')).find(c=>c.project==='adrift').token,allow8k:true,logger:{info(){},warn(){}}});try{console.log(JSON.stringify({ok:true,result:await(v.kind==='health'?p.healthCheck():p.chat({...v.input,feature:'smoke',subject:'synthetic-quality'}))}));}catch(e){console.log(JSON.stringify({ok:false,category:e.category}));}`;
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, `node --input-type=module -e '${program.replaceAll("'", "'\\''")}'`]);
    let output = ''; const timer = setTimeout(() => child.kill('SIGTERM'), 42000);
    child.stdout.on('data', c => { output += c; if (output.length > 131072) child.kill('SIGTERM'); }); child.stderr.resume();
    child.on('error', reject); child.on('close', code => { clearTimeout(timer); try { const value = JSON.parse(output); if (code || !value.ok) throw Object.assign(new Error('Acceptance provider failure'), { category: value.category }); resolve(value.result); } catch (error) { reject(error); } });
    child.stdin.end(JSON.stringify({ kind, input: input ? { ...input, signal: undefined } : undefined }));
  });
}
const provider = gpu ? { chat: input => remote('chat', input) } : undefined;
const now = new Date('2026-10-30T15:59:59.999Z');
const owner = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId();
const idFor = id => createHash('sha256').update(`quality-v2:${id}`).digest('hex').slice(0, 24);
const mood = { 焦慮: 'anxious', 喜悅: 'joy', 平靜: 'calm', 失落: 'sad', 疲憊: 'other', 生氣: 'other' };
const toDoc = row => ({ _id: new mongoose.Types.ObjectId(idFor(row.id)), user: owner, title: row.id, text: row.content,
  createdAt: new Date(`${row.date}T04:00:00Z`), updatedAt: now, mood: { type: mood[row.emotion] || 'other', intensity: 3 }, visibility: 'private',
  location: { type: 'Point', coordinates: [121, 25], placeName: row.location } });
const emit = value => console.log(JSON.stringify(value));
const records = [];
try {
  if (gpu) { const health = await remote('health'); assert.equal(health.capacity.active, 0); assert.equal(health.capacity.queued, 0); emit({ stage: 'health', health }); }
  await mongoose.connect(uri.href); await mongoose.connection.dropDatabase();
  const service = createMemoryAgent({ Diary, provider, now: () => now });
  const run = async (item, diaries, gold) => {
    await Diary.deleteMany({}); await Diary.collection.insertMany([...diaries.map(toDoc), { ...toDoc({ ...fixture.diaries[0], id: 'FOREIGN' }), user: other, text: 'FOREIGN PRIVATE DATA' }]);
    const question = item.question.replace(/\bD\d+\b/g, idFor);
    const answer = await service.run({ user: { _id: owner } }, { question, allow8k: process.argv.includes('--8k') });
    const mapped = diaries.map(row => ({ id: idFor(row.id), content: row.content }));
    const score = assessAgentAnswer(answer, { diaries: mapped, requiredIds: gold.ids.map(idFor), concepts: gold.concepts || [], forbidden: gold.forbidden || [], empty: gold.empty });
    const executionProven = answer.trace.some(event => event.type === 'tool_completed' && ['SUCCESS', 'NO_RESULTS'].includes(event.status));
    const canonical = historical.find(row => row.case.id === item.id)?.returned;
    const numericVerified = item.expected_tool !== 'get_emotion_statistics' || answer.claims.some(claim => claim.kind === 'statistics' && claim.total === canonical.count);
    const row = { id: item.id, ...score, executionProven, numericVerified, strictFunctionalPass: score.functionalPass && executionProven && numericVerified,
      state: answer.state, usage: answer.usage, answer: answer.answer, trace: answer.trace };
    records.push(row); emit(row);
  };
  emit({ stage: 'v2_frozen', datasetSha256: frozen['fixtures.json'], sourceHash: createHash('sha256').update(readFileSync(new URL('../src/services/memoryAgent.js', import.meta.url))).digest('hex'), rubric: 'all original expected source IDs, exact source spans, concepts, forbidden phrases, terminal state; semantic review separate', adaptations: ['Dxx to deterministic ObjectId, wording unchanged', 'legacy emotions mapped to current enum; tired/angry to other, intensity synthetic 3', 'same fixed reference date; no forced gold tool routing'], gpu });
  for (const item of fixture.tools) {
    const gold = historical.find(row => row.case.id === item.id).returned;
    await run(item, fixture.diaries, { ids: gold.diaries.map(row => row.id), empty: item.expect_empty });
  }
  for (const item of fixture.adrift) await run(item, item.diaries, { ids: item.expected.source_ids, concepts: item.expected.keyword_groups, forbidden: item.expected.forbidden, empty: item.expected.insufficient });
  emit({ stage: 'acceptance_frozen', hash: createHash('sha256').update(JSON.stringify(semanticAcceptance)).digest('hex'), cases: semanticAcceptance.length });
  if (process.argv.includes('--acceptance')) for (const item of semanticAcceptance) await run(item, item.diaries, { ids: item.expected.source_ids, concepts: item.expected.keyword_groups, forbidden: item.expected.forbidden, empty: item.expected.insufficient });
  const multi = [
    { questions: ['最近半年的心情如何？', '那去年同期呢？', '只看臺中。', '有哪些日記可以證明？', '可以再深入分析嗎？'], totals: [[16], [16, 0], [0], [0], [0]] },
    { questions: ['分析最近一個月心情', '改成半年', '那書店呢？', '只看快樂的回憶'], totals: [[6], [16], [3], [2]] }
  ];
  for (const [index, group] of multi.entries()) {
    await Diary.deleteMany({}); await Diary.collection.insertMany(fixture.diaries.map(toDoc));
    let conversationId;
    for (const [turn, question] of group.questions.entries()) {
      const answer = await service.run({ user: { _id: owner } }, { question, conversationId }); conversationId = answer.conversationId;
      const actual = answer.claims.filter(claim => claim.kind === 'statistics').map(claim => claim.total);
      emit({ stage: 'multi', group: index, turn, question, expected: group.totals[turn], actual, passed: JSON.stringify(actual) === JSON.stringify(group.totals[turn]), state: answer.state });
    }
  }
  emit({ stage: 'summary', rubricVersion: '2.1-execution-required', v2Original12: { passed: records.slice(0, 12).filter(row => row.strictFunctionalPass).length, total: 12 }, semantic20: { passed: records.slice(12, 32).filter(row => row.strictFunctionalPass).length, total: 20 }, acceptance: { passed: records.slice(32).filter(row => row.strictFunctionalPass).length, total: records.slice(32).length }, semanticReview: 'PENDING_INDEPENDENT_REVIEW', gpu });
  if (gpu) emit({ stage: 'health_after', health: await remote('health') });
} finally { if (mongoose.connection.readyState === 1) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } }
