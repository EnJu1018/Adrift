import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import Diary from '../src/models/Diary.js';
import { createMemoryAgent, createAgentConversations } from '../src/services/memoryAgent.js';
import { agentDiaryFixtures, agentNow } from '../tests/fixtures/agentDiaries.js';

const uri = process.env.AGENT_BENCHMARK_MONGO_URI;
const url = new URL(uri);
assert.ok(url.hostname === '127.0.0.1' && /^\/adrift_agent_benchmark_test_[a-z\d_-]+$/.test(url.pathname));
const gpu = process.argv.includes('--gpu'), host = process.env.AGENT_SMOKE_SSH_HOST;
if (gpu) assert.match(host || '', /^[a-z\d_.@-]+$/i);
function remote(kind, input) {
  const program = `import{readFileSync}from'node:fs';import{createOllamaProvider}from'/root/adrift-phase2-check/apps/api/src/services/ollama.js';let text='';for await(const c of process.stdin)text+=c;const value=JSON.parse(text);const clients=JSON.parse(readFileSync('/etc/adrift-ai/clients.json','utf8'));const p=createOllamaProvider({token:clients.find(c=>c.project==='adrift').token,allow8k:true,logger:{info(){},warn(){}}});try{console.log(JSON.stringify({ok:true,result:await(value.kind==='health'?p.healthCheck():p.chat({...value.input,feature:'smoke',subject:'synthetic-agent-benchmark'}))}));}catch(e){console.log(JSON.stringify({ok:false,category:e.category}));}`;
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, `node --input-type=module -e '${program.replaceAll("'", "'\\''")}'`]);
    let output = ''; const timer = setTimeout(() => child.kill('SIGTERM'), 45000);
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 131072) child.kill('SIGTERM'); });
    child.stderr.resume(); child.on('error', reject);
    child.on('close', code => { clearTimeout(timer); try { const response = JSON.parse(output); if (code || !response.ok) throw new Error(response.category || 'transport'); resolve(response.result); } catch (error) { reject(error); } });
    child.stdin.end(JSON.stringify({ kind, input: input ? { ...input, signal: undefined } : undefined }));
  });
}
// Frozen v1 development corpus; generated combinatorially, not a substitute for the missing original twelve questions.
const periodCases = [['最近一週', 7], ['最近一個月', 30], ['最近三個月', 92], ['最近半年', 183], ['最近一年', 365]];
const heldOut = process.argv.includes('--holdout');
const styles = heldOut ? ['請替我回顧', '能幫我分析', '我想整理', '請協助統計', '想知道'] : ['幫我分析', '請回顧', '我想了解', '請整理', '幫我統計'];
const scenarios = ['心情變化', '在臺北的心情變化', '快樂的心情紀錄', '在臺中的心情變化'];
const corpus = periodCases.flatMap(([period, days]) => scenarios.flatMap((scenario, filter) => styles.map(style => ({ question: `${style}${period}${scenario}。`, days, filter }))));
const hash = createHash('sha256').update(JSON.stringify({ version: 1, now: agentNow, corpus, rubric: 'state,exact total,owner citations,tool cap,deadline; no semantic entailment score', model: 'qwen3.5:4b-q4_K_M', context: process.argv.includes('--8k') ? 8192 : 4096, output: 128 })).digest('hex');
const sourceHash = createHash('sha256').update(readFileSync(new URL('../src/services/memoryAgent.js', import.meta.url))).digest('hex');
console.log(JSON.stringify({ stage: 'frozen_manifest', hash, sourceHash, questions: corpus.length, gpu, heldOut }));
const [owner, other, paging] = Array.from({ length: 3 }, () => new mongoose.Types.ObjectId());
const fixture = agentDiaryFixtures(owner, other, paging), req = { user: { _id: owner } };
const durations = [], results = []; let modelRequests = 0;
const provider = gpu ? { chat: async input => { modelRequests++; return remote('chat', input); } } : undefined;
try {
  if (gpu) { const health = await remote('health'); assert.equal(health.capacity.active, 0); assert.equal(health.capacity.queued, 0); assert.equal(health.upstream.available, true); console.log(JSON.stringify({ stage: 'health', health })); }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 }); await mongoose.connection.dropDatabase();
  await Diary.collection.insertMany([...fixture.owned, ...fixture.foreign].map(row => ({ ...row, _id: new mongoose.Types.ObjectId() })));
  const agent = createMemoryAgent({ Diary, provider, conversations: createAgentConversations({ maxEntries: 120 }), now: () => agentNow });
  for (const [index, item] of corpus.slice(0, process.argv.includes('--smoke-only') ? 4 : 100).entries()) {
    const actual = await agent.run(req, { question: item.question, allow8k: process.argv.includes('--8k') }); durations.push(actual.usage?.durationMs || 0);
    // Independent fixture oracle; the chosen fixture dates are far from rolling month-end differences.
    const expected = fixture.owned.filter(row => +row.createdAt >= +agentNow - item.days * 86400000
      && (item.filter !== 1 || /臺北|台北|Taipei/.test(row.location.placeName))
      && (item.filter !== 2 || row.mood.type === 'joy') && (item.filter !== 3 || row.location.placeName.includes('臺中'))).length;
    const stats = actual.claims?.find(claim => claim.kind === 'statistics');
    const passed = stats?.total === expected && actual.state === (expected ? 'COMPLETED' : 'INSUFFICIENT_EVIDENCE')
      && actual.usage.toolCalls <= 5 && actual.usage.durationMs < 40000 && actual.sources.every(source => source.quote.length > 0);
    results.push({ index, passed, expected, actual: stats?.total, state: actual.state });
    console.log(JSON.stringify({ index, passed, expected, actual: stats?.total, state: actual.state, error: actual.trace.find(row => row.type === 'task_failed')?.category, durationMs: actual.usage?.durationMs }));
  }
  let conversationId; const turns = ['幫我分析最近一個月的心情', '改成半年', '那臺中呢？', '那去年呢？'];
  const multi = [];
  for (const question of turns) { const answer = await agent.run(req, { question, conversationId, allow8k: process.argv.includes('--8k') }); conversationId = answer.conversationId; multi.push(answer.claims?.find(claim => claim.kind === 'statistics')?.total); }
  const sorted = durations.slice().sort((a, b) => a - b);
  console.log(JSON.stringify({ stage: 'summary', hash, passed: results.filter(row => row.passed).length, total: results.length, modelRequests,
    multiTurnActual: multi, multiTurnExpected: [2, 4, 1, 0], multiTurnPass: JSON.stringify(multi) === JSON.stringify([2, 4, 1, 0]),
    averageMs: durations.reduce((a, b) => a + b, 0) / durations.length, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1],
    failures: results.filter(row => !row.passed), heldOut, original12: 'unavailable; not substituted' }));
  if (gpu) console.log(JSON.stringify({ stage: 'health_after', health: await remote('health') }));
} finally { if (mongoose.connection.readyState === 1) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } }
