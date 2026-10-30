import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createAiCapacity } from '../src/services/aiCapacity.js';
import { AiServiceError } from '../src/services/gemini.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const job = (id, run, extra = {}) => ({ id, project: 'adrift', subject: id, run, ...extra });

test('projects share one generation slot and a bounded FIFO queue, with reserved capacity for another project', async () => {
  const capacity = createAiCapacity(), release = deferred(), started = [];
  const first = capacity.submit(job('one', async () => { started.push(1); await release.promise; return 1; }));
  const second = capacity.submit(job('two', async () => { started.push(2); return 2; }));
  assert.throws(() => capacity.submit(job('three', async () => 3)), error => error.category === 'queue_full');
  const third = capacity.submit(job('three', async () => { started.push(3); return 3; }, { project: 'navi' }));
  assert.throws(() => capacity.submit(job('four', async () => 4, { project: 'navi' })), error => error.category === 'queue_full');
  await delay(0); assert.deepEqual(started, [1]); assert.equal(capacity.state().queued, 2);
  release.resolve(); assert.deepEqual(await Promise.all([first, second, third]), [1, 2, 3]);
  assert.deepEqual(started, [1, 2, 3]); assert.equal(capacity.state().active, 0); capacity.close();
});
test('duplicate subject jobs are rejected and cancellation is scoped to project and subject', async () => {
  const capacity = createAiCapacity(), release = deferred();
  const first = capacity.submit(job('one', () => release.promise));
  assert.throws(() => capacity.submit(job('two', async () => 2, { subject: 'one' })), error => error.category === 'busy');
  assert.equal(capacity.cancel('one', 'navi', 'one'), false); assert.equal(capacity.cancel('one', 'adrift', 'other'), false);
  release.resolve(); await first; capacity.close();
});
test('queue timeout never starts inference or opens a provider circuit', async () => {
  const capacity = createAiCapacity({ waitMs: 10, totalMs: 200 }), release = deferred(); let calls = 0;
  const first = capacity.submit(job('one', () => release.promise));
  await assert.rejects(capacity.submit(job('two', async () => { calls++; })), error => error.category === 'queue_timeout');
  assert.equal(calls, 0); assert.equal(capacity.state().circuit, 'closed'); release.resolve(); await first; capacity.close();
});
test('queued Abort removes the job; active Abort drains before admitting a second GPU task', async () => {
  const capacity = createAiCapacity(), release = deferred(), active = new AbortController(), waiting = new AbortController(); let calls = 0;
  const first = capacity.submit(job('one', async () => { await release.promise; return 1; }, { signal: active.signal }));
  const second = capacity.submit(job('two', async () => { calls++; }, { signal: waiting.signal }));
  waiting.abort(); await assert.rejects(second, error => error.name === 'AbortError');
  active.abort(); await assert.rejects(first, error => error.name === 'AbortError');
  assert.equal(capacity.state().active, 1); assert.equal(capacity.state().draining, true);
  const third = capacity.submit(job('three', async () => { calls++; return 3; }, { project: 'navi' }));
  await delay(5); assert.equal(calls, 0); release.resolve(); assert.equal(await third, 3); assert.equal(calls, 1); capacity.close();
});
test('hard timeout aborts inference and quarantines uncertain GPU work; health alone cannot falsely recover it', async () => {
  const capacity = createAiCapacity({ waitMs: 5, totalMs: 20 }); let signal;
  await assert.rejects(capacity.submit(job('one', async value => { signal = value; return new Promise(() => {}); })), error => error.category === 'timeout');
  assert.equal(signal.aborted, true); assert.equal(capacity.state().timeoutCount, 1);
  assert.throws(() => capacity.submit(job('two', async () => 2)), error => error.category === 'recovery_required');
  const healthy = { reachable: true, available: true, loadedModelCount: 0 };
  assert.equal(capacity.recover(healthy), false);
  assert.equal(capacity.recover(healthy, { confirmedIdle: true }), true);
  assert.equal(await capacity.submit(job('two', async () => 2)), 2); capacity.close();
});
test('three availability failures open a circuit; after cooldown exactly one probe is allowed', async () => {
  let now = 0;
  const capacity = createAiCapacity({ now: () => now, cooldownMs: 50 });
  for (let index = 0; index < 3; index++) await assert.rejects(capacity.submit(job(`failed${index}`, async () => { throw new AiServiceError('provider_unavailable', 503); })));
  assert.equal(capacity.state().circuit, 'open');
  assert.throws(() => capacity.submit(job('blocked', async () => 1)), error => error.category === 'circuit_open');
  now = 51; const release = deferred();
  const probe = capacity.submit(job('probe', () => release.promise));
  assert.throws(() => capacity.submit(job('extra', async () => 2)), error => error.category === 'circuit_open');
  release.resolve('recovered'); assert.equal(await probe, 'recovered'); assert.equal(capacity.state().circuit, 'closed'); capacity.close();
});
test('OOM fails safely, opens cooldown without changing models and can recover after a successful probe', async () => {
  let now = 0; const capacity = createAiCapacity({ now: () => now, cooldownMs: 20 });
  await assert.rejects(capacity.submit(job('oom', async () => { throw new AiServiceError('gpu_oom', 503); })), error => error.category === 'gpu_oom');
  assert.equal(capacity.state().circuit, 'open'); now = 21;
  assert.equal(await capacity.submit(job('recovered', async () => 'same-model')), 'same-model'); capacity.close();
});
test('gateway shutdown rejects pending clients and drains the current bounded task', async () => {
  const capacity = createAiCapacity(), release = deferred();
  const first = capacity.submit(job('one', () => release.promise));
  const second = capacity.submit(job('two', async () => 2)); capacity.close();
  await assert.rejects(first, error => error.name === 'AbortError'); await assert.rejects(second, error => error.name === 'AbortError');
  assert.equal(capacity.state().draining, true); release.resolve(); await delay(0);
  assert.throws(() => capacity.submit(job('three', async () => 3)), error => error.category === 'circuit_open');
});
