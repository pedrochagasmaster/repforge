import test from 'node:test';
import assert from 'node:assert/strict';
import {create} from '../src/platform/program-executor.js';
const compiler={generateProgram:(request,catalog)=>({request,catalog})};
const transition={deriveSuccessor:input=>input};
test('executor fallback preserves asynchronous results and owns the catalog input',async()=> {
  const catalog={id:'verified'};
  const engine=create({compiler,transition,catalog:()=>catalog,worker:{url:'fixture',catalogSha256:'pin'},WorkerConstructor:class{constructor(){throw Error('blocked');}}});
  assert.equal(await engine.ready(),'main');
  assert.deepEqual(await engine.generate({seed:4}),{request:{seed:4},catalog});
  assert.deepEqual(await engine.derive({change:'next',catalogSnapshot:{id:'foreign'}}),{change:'next',catalogSnapshot:catalog});
  engine.dispose();await assert.rejects(engine.generate({seed:5}),{name:'AbortError'});
});
test('executor cancels queued and active work, drops late results and disposes its worker',async()=> {
  let transport;
  class Worker {
    onmessage=null;onerror=null;onmessageerror=null;messages=[];terminated=false;
    constructor(){transport=this;}
    postMessage(message){if(message.type==='init')queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));else this.messages.push(message);}
    terminate(){this.terminated=true;}
    answer(message){this.onmessage?.({data:{id:message.id,ok:true,value:{seed:message.request.seed}}});}
  }
  const engine=create({compiler,transition,catalog:()=>({}),worker:{url:'fixture',catalogSha256:'pin'},WorkerConstructor:Worker});
  assert.equal(await engine.ready(),'worker');
  const activeController=new AbortController(),queuedController=new AbortController();
  const first=engine.generate({seed:1},{signal:activeController.signal});
  const firstRejected=assert.rejects(first,{name:'AbortError'});
  const second=engine.generate({seed:2},{signal:queuedController.signal});
  const secondRejected=assert.rejects(second,{name:'AbortError'});
  assert.equal(transport.messages.length,1,'only one worker job runs at a time');
  queuedController.abort();activeController.abort();await Promise.all([firstRejected,secondRejected]);
  transport.answer(transport.messages[0]);
  const third=engine.generate({seed:3});transport.answer(transport.messages[1]);
  assert.deepEqual(await third,{seed:3});
  const pending=engine.generate({seed:4});const pendingRejected=assert.rejects(pending,{name:'AbortError'});
  engine.dispose();await pendingRejected;assert.equal(transport.terminated,true);
  assert.equal(engine.stats().mode,'disposed');
});
