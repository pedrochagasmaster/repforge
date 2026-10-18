import test from 'node:test';
import assert from 'node:assert/strict';
import {create} from '../src/platform/program-executor.js';
import {createGenerationRules} from '../src/training/generation.js';
const {compiler}=createGenerationRules();
const transition={deriveSuccessor:()=>{throw Error('unexpected derive')}};
const pin={url:'trusted-module.js',catalogSha256:'pin'};

test('strict Lab executor never computes on main after absent, construction or initialization failures',async()=>{
  for(const WorkerConstructor of [null,class {constructor(){throw Error('blocked')}},class {postMessage(){throw Error('clone failed')}terminate(){}}]) {
    let calls=0;
    const engine=create({compiler:{...compiler,generateProgram(){calls++;throw Error('must not compute')}},transition,catalog:()=>({}),allowMainThreadFallback:false,
      ...(WorkerConstructor===null?{}:{worker:pin,WorkerConstructor})});
    assert.equal(await engine.ready(),'failed');
    await assert.rejects(engine.generate({}),{name:'WorkerUnavailableError',code:'worker_unavailable'});
    assert.equal(calls,0);assert.equal(engine.stats().main,0);engine.dispose();
  }
});

test('queued policies detach/freeze and diagnostics propagate; invalid policies never enqueue',async()=>{
  let transport;
  class Worker {constructor(){transport=this;this.messages=[];}postMessage(message){if(message.type!=='init')this.messages.push(message)}terminate(){}}
  const engine=create({compiler,transition,catalog:()=>({}),worker:pin,WorkerConstructor:Worker,allowMainThreadFallback:false});
  const source=compiler.getDefaultEnginePolicy();const edited=structuredClone(source);edited.volume.setsByType.primary=2;
  const result=engine.generate({id:'first'},{enginePolicy:edited,diagnostics:'allocation-lineage@1'});
  edited.volume.setsByType.primary=6;
  transport.onmessage({data:{type:'ready'}});
  const sent=transport.messages[0];assert.equal(sent.generationOptions.enginePolicy.volume.setsByType.primary,2);
  assert(Object.isFrozen(sent.generationOptions.enginePolicy.volume));assert.equal(sent.generationOptions.diagnostics,'allocation-lineage@1');
  transport.onmessage({data:{id:sent.id,ok:true,value:{ok:true}}});assert.deepEqual(await result,{ok:true});
  const refused=await engine.generate({},{enginePolicy:null});assert.equal(refused.conflicts[0].code,'invalid_engine_policy');
  assert.equal((await engine.generate({},{diagnostics:'unknown'})).conflicts[0].code,'invalid_diagnostics');
  assert.equal(transport.messages.length,1,'invalid metadata cannot reach worker');engine.dispose();
});

test('strict active postMessage failure rejects queued work and ignores late ready',async()=>{
  let transport,calls=0;
  class Worker {constructor(){transport=this;}postMessage(message){if(message.type!=='init')throw Error('send failed')}terminate(){}}
  const engine=create({compiler:{...compiler,generateProgram(){calls++;return null}},transition,catalog:()=>({}),worker:pin,WorkerConstructor:Worker,allowMainThreadFallback:false});
  const ready=engine.ready();transport.onmessage({data:{type:'ready'}});assert.equal(await ready,'worker');
  await assert.rejects(engine.generate({}),{code:'worker_unavailable'});
  transport.onmessage({data:{type:'ready'}});assert.equal(engine.stats().mode,'failed');
  await assert.rejects(engine.generate({}),{code:'worker_unavailable'});assert.equal(calls,0);engine.dispose();
});
