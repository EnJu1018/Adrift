import { AiServiceError } from './gemini.js';

const failure = (category, status = 503) => new AiServiceError(category, status);

// One instance belongs on the GPU host, not one instance per Express worker/project.
export function createAiCapacity({ maxQueue = 2, maxPerProject = 2, waitMs = 15000, totalMs = 40000, cooldownMs = 30000, now = Date.now } = {}) {
  if (![maxQueue, maxPerProject, waitMs, totalMs, cooldownMs].every(Number.isInteger) || maxQueue < 0 || maxQueue > 8
    || maxPerProject < 1 || maxPerProject > 3 || waitMs < 1 || totalMs <= waitMs || totalMs > 60000 || cooldownMs < 1) throw failure('configuration');
  const waiting = [], jobs = new Map(), counts = {};
  let active = null, failures = 0, openUntil = 0, recoveryRequired = false, closed = false;
  const metrics = { submitted: 0, succeeded: 0, cancelled: 0, timeoutCount: 0, lastDurationMs: null };

  const state = () => ({ active: active ? 1 : 0, queued: waiting.length, draining: Boolean(active?.cancelled),
    maxQueue, concurrency: 1, circuit: recoveryRequired ? 'recovery_required' : openUntil > now() ? 'open' : failures >= 3 ? 'half_open' : 'closed',
    recoveryRequired, retryAfterMs: Math.max(0, openUntil - now()), ...metrics, errors: { ...counts } });
  function settle(job, error, value) {
    if (job.settled) return;
    job.settled = true;
    if (error) job.reject(error); else job.resolve(value);
  }
  function cancel(job) {
    if (!job || job.cancelled || job.settled) return false;
    job.cancelled = true; metrics.cancelled++;
    settle(job, job.signal?.reason || new DOMException('Cancelled', 'AbortError'));
    if (job !== active) {
      waiting.splice(waiting.indexOf(job), 1); cleanup(job);
    }
    // A disconnected HTTP caller is not proof that GPU work stopped. Drain the
    // current generation instead of releasing its capacity for a second project.
    return true;
  }
  function cleanup(job) {
    clearTimeout(job.waitTimer); job.signal?.removeEventListener('abort', job.cancel);
    jobs.delete(job.id);
  }
  function open(error) {
    const category = error.category || 'unavailable';
    counts[category] = (counts[category] || 0) + 1;
    if (category === 'timeout') metrics.timeoutCount++;
    if (['timeout', 'ollama_offline', 'provider_unavailable', 'gpu_oom', 'invalid_response'].includes(category)) failures++;
    if (category === 'gpu_oom') failures = Math.max(3, failures);
    if (category === 'timeout' || category === 'ollama_offline' && !error.notStarted) recoveryRequired = true;
    if (failures >= 3 || category === 'gpu_oom') openUntil = now() + cooldownMs;
  }
  async function start(job) {
    clearTimeout(job.waitTimer); active = job;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(failure('timeout', 504)), Math.max(1, totalMs - (now() - job.createdAt)));
    let abort;
    const aborted = new Promise((_, reject) => { abort = () => reject(controller.signal.reason); controller.signal.addEventListener('abort', abort, { once: true }); });
    try {
      const result = await Promise.race([Promise.resolve().then(() => job.run(controller.signal)), aborted]);
      failures = 0; openUntil = 0; if (!job.cancelled) metrics.succeeded++;
      settle(job, null, result);
    } catch (cause) {
      const error = cause instanceof AiServiceError ? cause : failure('provider_unavailable');
      open(error); settle(job, error);
    } finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', abort);
      metrics.lastDurationMs = now() - job.createdAt; cleanup(job); active = null;
      while (waiting.length) {
        const next = waiting.shift();
        if (recoveryRequired || openUntil > now() || closed) { settle(next, failure(recoveryRequired ? 'recovery_required' : 'circuit_open')); cleanup(next); }
        else { start(next); break; }
      }
    }
  }
  return {
    state,
    submit({ id, project, subject, signal, run }) {
      signal?.throwIfAborted();
      if (closed || recoveryRequired || openUntil > now() || failures >= 3 && active) throw failure(recoveryRequired ? 'recovery_required' : 'circuit_open');
      if (jobs.has(id) || [...jobs.values()].some(job => job.project === project && job.subject === subject)) throw failure('busy', 409);
      if ([...jobs.values()].filter(job => job.project === project).length >= maxPerProject || active && waiting.length >= maxQueue) throw failure('queue_full', 429);
      metrics.submitted++;
      return new Promise((resolve, reject) => {
        const job = { id, project, subject, signal, run, resolve, reject, createdAt: now() };
        job.cancel = () => cancel(job); jobs.set(id, job);
        signal?.addEventListener('abort', job.cancel, { once: true });
        if (active) {
          waiting.push(job);
          job.waitTimer = setTimeout(() => {
            waiting.splice(waiting.indexOf(job), 1); settle(job, failure('queue_timeout', 503));
            counts.queue_timeout = (counts.queue_timeout || 0) + 1; cleanup(job);
          }, waitMs);
        } else start(job);
      });
    },
    cancel(id, project, subject) {
      const job = jobs.get(id);
      return job?.project === project && job?.subject === subject ? cancel(job) : false;
    },
    recover(health, { confirmedIdle = false } = {}) {
      if (confirmedIdle && !active && health?.reachable && health.available && health.loadedModelCount === 0) { recoveryRequired = false; failures = 0; openUntil = 0; return true; }
      return false;
    },
    close() {
      closed = true;
      for (const job of [...waiting]) cancel(job);
      if (active) cancel(active);
    }
  };
}
