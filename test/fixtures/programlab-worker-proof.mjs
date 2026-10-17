import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
export default async function runProof() {
const require = createRequire(import.meta.url);
const Engine = require('../../program-engine.js');
const Policy = require("../../engine-policy.js");
const originalWorker = globalThis.Worker;
let mainCalls = 0;
const options = (allowMainThreadFallback) => ({
  allowMainThreadFallback,
  compiler: { generateProgram: () => { mainCalls++; return { ok: true }; } },
  catalog: () => ({}), worker: { url: 'fixture.js', scripts: [], catalogSha256: 'fixture' },
});
const rejected = async (promise) => assert.rejects(promise, (error) => error.code === 'worker_unavailable');
try {
  delete globalThis.Worker;
  const strict = Engine.create(options(false));
  await rejected(strict.generate({}));
  assert.equal(await strict.ready(), 'failed');
  assert.equal(mainCalls, 0, 'strict executor never runs synchronously without Worker');
  strict.dispose();
  const production = Engine.create(options(undefined));
  assert.deepEqual(await production.generate({}), { ok: true });
  assert.equal(await production.ready(), 'main');
  production.dispose();
  mainCalls = 0;
  for (const fault of ['constructor', 'init', 'runtime', 'decode', 'post']) {
    let worker;
    globalThis.Worker = class {
      constructor() { if (fault === 'constructor') throw new Error('fixture'); worker = this; this.terminated = 0; }
      postMessage(message) {
        if (fault === 'post') throw new Error('fixture');
        if (message.type === 'init') queueMicrotask(() => this.onmessage({ data: { type: fault === 'init' ? 'failed' : 'ready', message: 'fixture' } }));
      }
      terminate() { this.terminated++; }
    };
    const executor = Engine.create(options(false));
    const first = rejected(executor.generate({ first: true }));
    const second = rejected(executor.generate({ second: true }));
    if (['runtime', 'decode'].includes(fault)) {
      assert.equal(await executor.ready(), 'worker');
      if (fault === 'runtime') worker.onerror({ preventDefault() {} });
      else worker.onmessageerror();
    }
    await Promise.all([first, second]);
    assert.equal(executor.stats().mode, 'failed', fault);
    await rejected(executor.generate({ later: true }));
    worker?.onmessage?.({ data: { type: 'ready' } });
    assert.equal(executor.stats().mode, 'failed', 'late readiness cannot revive a failed executor');
    assert.equal(mainCalls, 0, fault);
    if (worker) assert.equal(worker.terminated, 1);
    executor.dispose();
  }
  delete globalThis.Worker;
  const draft = structuredClone(Policy.getDefaultEnginePolicy());
  draft.volume.setsByType.primary = 2;
  let forwarded;
  const main = Engine.create({ ...options(true), compiler: {
    generateProgram: (_request, _catalog, options) => { forwarded = options; return { ok: true }; },
  } });
  const outcome = main.generate({}, {enginePolicy: draft, diagnostics: "allocation-lineage@1"});
  draft.volume.setsByType.primary = 3;
  await outcome;
  assert.equal(forwarded.enginePolicy.volume.setsByType.primary, 2, "enqueue detaches the policy before main fallback runs");
  assert.equal(forwarded.diagnostics, "allocation-lineage@1");
  main.dispose();
  console.log('strict worker failure rejects active, queued and future jobs; default fallback preserved');
} finally {
  if (originalWorker === undefined) delete globalThis.Worker;
  else globalThis.Worker = originalWorker;
}

}
