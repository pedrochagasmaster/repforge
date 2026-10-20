import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {create} from '../src/platform/program-executor.js';
const compiler={generateProgram:request=>({answer:request.answer})},transition={deriveSuccessor:input=>({change:input.change})};
const base={compiler,transition,catalog:()=>({}),worker:null};
const signal=new AbortController();
const main=create(base);
for(let n=0;n<20;n++){
 assert.deepEqual(await main.generate({answer:n},{signal:signal.signal}),{answer:n});
 assert.equal(getEventListeners(signal.signal,'abort').length,0,'a completed real request retains no signal listener');
}
main.dispose();assert.equal(getEventListeners(signal.signal,'abort').length,0);
const failing=create({...base,compiler:{generateProgram(){throw Error('compiler refusal')}}});
await assert.rejects(failing.generate({},{signal:signal.signal}),/compiler refusal/);
assert.equal(getEventListeners(signal.signal,'abort').length,0,'a computation error removes its listener');failing.dispose();
// A controlled worker leaves real executor jobs queued/active. Observations are
// independent AbortSignal listeners and literal protocol replies, not engine math.
let worker;
class ControlledWorker{
 constructor(){worker=this}
 postMessage(message){this.messages??=[];this.messages.push(message)}
 terminate(){this.terminated=true}
 reply(message){this.onmessage({data:message})}
}
const activeController=new AbortController(),queuedController=new AbortController();
const controlled=create({...base,WorkerConstructor:ControlledWorker,worker:{url:'fixture-worker',catalogSha256:'a'.repeat(64)}});
const active=controlled.generate({answer:7},{signal:activeController.signal});
const queued=controlled.generate({answer:8},{signal:queuedController.signal});
assert.equal(getEventListeners(activeController.signal,'abort').length,1);
assert.equal(getEventListeners(queuedController.signal,'abort').length,1);
worker.reply({type:'ready'});
assert.equal(worker.messages.filter(message=>message.type==='generate').length,1,'one active job preserves queue ordering');
queuedController.abort();await assert.rejects(queued,{name:'AbortError'});
assert.equal(getEventListeners(queuedController.signal,'abort').length,0);
worker.reply({id:worker.messages.find(message=>message.type==='generate').id,ok:true,value:{answer:7}});
assert.deepEqual(await active,{answer:7});
assert.equal(getEventListeners(activeController.signal,'abort').length,0);
const pendingController=new AbortController();
const pending=controlled.generate({answer:9},{signal:pendingController.signal});
assert.equal(getEventListeners(pendingController.signal,'abort').length,1);
controlled.dispose();await assert.rejects(pending,{name:'AbortError'});
assert.equal(getEventListeners(pendingController.signal,'abort').length,0,'dispose detaches an active job signal');
assert.equal(worker.terminated,true);
const preAborted=new AbortController();preAborted.abort();
await assert.rejects(create(base).generate({},{signal:preAborted.signal}),{name:'AbortError'});
assert.equal(getEventListeners(preAborted.signal,'abort').length,0);
console.log('PASS real AbortSignal lifecycle: completion, error, queued abort, active disposal and prior abort');
