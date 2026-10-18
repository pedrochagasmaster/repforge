import assert from 'node:assert/strict';
import * as policy from '../src/persistence/snapshot.js';

const base={program:[{id:'slot-a',sets:3}],log:[{session:'session-a',load:40}],settings:{unit:'kg'},_storageRevision:4};
const proposal=structuredClone(base); proposal.program[0].sets=4;
const target=structuredClone(base); target.log.push({session:'session-b',load:50}); target.settings.unit='lb';
const before=JSON.stringify([base,proposal,target]);
const rebased=policy.rebaseStateChange(base,proposal,target);
assert.equal(rebased.program[0].sets,4);
assert.deepEqual(rebased.log,target.log);
assert.equal(rebased.settings.unit,'lb');
assert.equal(JSON.stringify([base,proposal,target]),before,'rebase cannot mutate any actor');
const conflicting=structuredClone(target);conflicting.program[0].sets=6;
assert.equal(policy.rebaseStateChange(base,proposal,conflicting,{preferProposal:false}).program[0].sets,6);
assert.equal(policy.rebaseStateChange(base,proposal,conflicting).program[0].sets,4);
const receipt={version:1,programId:'program-a',raw:'raw-setup'};
const a={...base,_storageSetupActivation:receipt,_storageFollowUp:{pending:true}};
assert.equal(policy.snapshotsEqual(base,a),false,'equal-revision arbitration must see activation receipts');
assert.equal(policy.canonicalPayload(base),policy.canonicalPayload(a),'export omits receipt and sidecars');
assert.equal(policy.storageSnapshotsEqual(base,{...base,_storageRevision:5}),false);
const fingerprint=policy.draftProgramFingerprint(base);
assert.equal(policy.draftProgramFingerprint({...base,program:[{...base.program[0],prescriptionsByCycle:[{cycle:1}]}]}),fingerprint);
assert.notEqual(policy.draftProgramFingerprint({...base,programMeta:{blockId:'next-block'}}),fingerprint);
assert.equal(policy.classifyRecoveryCarrier({schemaVersion:99,records:[],quarantine:[]}).kind,'unknown');
assert.equal(policy.classifyRecoveryCarrier({schemaVersion:1,records:[],quarantine:[]}).kind,'known');
assert.equal(policy.classifyRecoveryCarrier(undefined).kind,'absent');
assert.equal(policy.draftEffectOutcome({kind:'clear-draft',expectedRaw:null,precondition:'abort-same-day'}).status,'invalid');
assert.equal(policy.draftEffectOutcome({kind:'clear-draft',expectedRaw:null,precondition:'abort-same-day',conflictDay:'Day 1'}).status,'valid');
assert.equal(policy.isCoherentV1TransitionOut({schemaVersion:1,transitionId:'t',proposalHash:'h',successorProgramId:'p'}),true);
console.log('persistence snapshot identity, receipts, rebase and refusal contract passed');

// Production validators share the actual muscle/metric/draft domains. An absent
// catalog is explicit and cannot turn a source-metric row into a valid record.
const {default:entry}=await import('../program-entry.js');
const {default:metrics}=await import('../exercise-metrics.js');
const {default:workout}=await import('../workout-draft.js');
const bound=policy.createSnapshotPolicy({entry,metrics,workout,model:{}});
assert.equal(bound.isValidStateShape({program:[],log:[]}),true);
assert.equal(bound.isValidStateShape({program:[{primary:'invented muscle'}],log:[]}),false);
assert.equal(bound.isValidStateShape({program:[],log:[{session:'s',setIndex:-1}]}),false);
assert.equal(bound.isValidStateShape({program:[],log:[],_storageSetupActivation:{version:1,programId:'p',raw:'setup'}}),true);
assert.equal(bound.isValidStateShape({program:[],log:[],_storageSetupActivation:{version:1,programId:'p',raw:''}}),false);
assert.equal(bound.isValidStateShape({program:[],log:[],recoveryTransitions:{schemaVersion:9,records:[],quarantine:[]}}),false);
assert.equal(bound.carrierReadStatus({program:[],log:[],recoveryTransitions:{schemaVersion:9,records:[],quarantine:[]}},'raw'),null);
const invalid=Object.create({program:[],log:[]});
assert.equal(bound.isValidStateShape(invalid),false,'unknown prototypes cannot enter storage');
console.log('production snapshot shape and unknown-carrier refusal contract passed');
