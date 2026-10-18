import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEntryRules} from '../../src/training/authoring.js';
import {createSetupDraftStore} from '../../src/persistence/setup-draft.js';

const rules=createEntryRules(JSON.parse(readFileSync(new URL('../../assets/exercise-catalog.json',import.meta.url),'utf8')));
const key='repforge_program_setup_draft_v1';
const initial=rules.createState({draftId:'architecture-entry-draft',activeProgramRevisionAtStart:0,
 now:'2026-10-18T12:00:00.000Z',versions:{compiler:'1',family:'1',blueprint:'1',catalogue:'1',rules:'1',context:'1',progression:'range-1',recentConsistency:'1',simpleStart:'1'}});
const first=rules.setAnswers(rules.selectRoute(initial,'build'),{programName:'Monday',daysPerWeek:3});
const second=rules.setAnswers(first,{programName:'Tuesday',daysPerWeek:4});
assert.equal(rules.normalizeSetupDraft(first).ok,true,'real producer must yield an accepted setup draft');
assert.equal(rules.normalizeSetupDraft(second).ok,true);
let raw=null,lockDepth=0,locks=0,writes=0;
const failures=[];
const storage={getItem(name){assert.equal(name,key);return raw},setItem(name,value){assert.equal(name,key);assert.equal(lockDepth,1,'actual write must own the supplied lock');raw=value;writes++},removeItem(name){assert.equal(name,key);assert.equal(lockDepth,1);raw=null}};
const lock=async operation=>{locks++;lockDepth++;try{return await operation()}finally{lockDepth--}};
const store=createSetupDraftStore({rules,storage,lock,ownerId:'local-owner',onFailure:kind=>failures.push(kind),onSaved:()=>{}});

// Two writes stage before either takes the lock. The second must observe the
// first acknowledged envelope, while each baseline belongs to its own call.
let releaseFirst;
const blocked=new Promise(resolve=>{releaseFirst=resolve});
const pendingFirst=store.write(first,first,{async writeSetupDraft(value){await blocked;storage.setItem(key,value)}});
const pendingSecond=store.write(second,second);
await Promise.resolve();
assert.equal(raw,null);
releaseFirst();
assert.equal((await pendingFirst).ok,true);
assert.equal((await pendingSecond).ok,true);
let stored=JSON.parse(raw);
assert.equal(stored.revision,2);
assert.equal(stored.ownerId,'local-owner');
assert.equal(stored.state.answers.programName,'Tuesday');
assert.equal(stored.state.answers.daysPerWeek,4);
assert.equal(store.baseline().answers.programName,'Tuesday');
assert.equal(writes,2);

// Read models and retained caller objects cannot change accepted ownership.
const accepted=store.baseline(),handle=store.handle();
accepted.answers.programName='Mutable escaped value';handle.envelope.revision=900;
assert.equal(store.baseline().answers.programName,'Tuesday');
assert.equal(store.handle().envelope.revision,2);

// A different tab's exact bytes stop this writer permanently until adoption.
const foreign=JSON.stringify({...stored,ownerId:'other-owner',revision:3});
raw=foreign;
assert.deepEqual(await store.write(first,first),{ok:false,conflict:true});
assert.equal(raw,foreign);
assert.equal(writes,2);
raw=store.handle().raw; // Even restored old bytes cannot clear sticky conflict.
assert.deepEqual(await store.write(first,first),{ok:false,conflict:true});
assert.equal(writes,2);
assert.deepEqual(failures,['save_conflict','save_conflict']);
store.adopt({raw:foreign,envelope:JSON.parse(foreign)},second);raw=foreign;
assert.equal((await store.write(first,first)).ok,true);
stored=JSON.parse(raw);
assert.equal(stored.revision,4);
assert.equal(stored.state.answers.programName,'Monday');

// clear resolves ownership after an earlier queued write advances revision.
const next=store.write(second,second),cleared=store.clear();
assert.equal((await next).ok,true);
assert.equal((await cleared).ok,true);
assert.equal(raw,null);assert.equal(store.handle(),null);assert.equal(store.baseline(),null);

// A captured cleanup receipt cannot delete a newer foreign candidate.
raw=foreign;
assert.deepEqual(await store.remove({raw:'older exact bytes',envelope:null}),{ok:false,conflict:true});
assert.equal(raw,foreign);
assert.ok(locks>=6,'writes/removals must reach the supplied lock');
console.log('Entry draft ownership: queue, literal revisions, foreign writer, sticky conflict, adopted baseline, cleanup and escaped aliases passed');
