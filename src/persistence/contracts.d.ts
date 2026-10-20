/** Wire records used by the durable protocol. Extension values stay opaque so
 * an older release never invents semantics for fields it cannot understand. */
import type {DraftEffect, DraftEffectOutcome, RawSnapshot, RecoveryRecord, RecoveryQuarantine} from './snapshot.js';
/** Durable reads establish the raw released schema, not normalized domain data. */
export type StoredSnapshot=RawSnapshot;
export type ProgramRow=Record<string,unknown>;
export type LogRow=Record<string,unknown>;
export type ProgramMeta=Record<string,unknown>;
export type ProgramArchive=Record<string,unknown>;
export interface TransitionIn extends Record<string,unknown> {
  schemaVersion:1; status:'committed'; transitionId:string; proposalHash:string;
  archiveId:string; confirmedAt:string;
  predecessor:{programId:string}; successor:{programId:string};
}
export interface TransitionOut extends Record<string,unknown> {
  schemaVersion:1; transitionId:string; proposalHash:string; successorProgramId:string;
}
export interface CustomExercise extends Record<string,unknown> {id:string; name:string}
export interface SetupActivation {version:1;programId:string;raw:string;revision?:number}
export interface DraftTransaction {version:1;id:string;effect:DraftEffect;previous:StoredSnapshot}
export interface ReplicaWriteResult extends Record<string,unknown> {
  revision:number;localOk:boolean;idbOk:boolean;conflict?:boolean;
  transferFrozen?:boolean;stateInvalid?:boolean;code?:string;
}
export interface StorageIO {
  writeLocal(snapshot:StoredSnapshot):boolean|void|Promise<boolean|void>;
  writeIdb(snapshot:StoredSnapshot):boolean|void|Promise<boolean|void>;
}
export interface OutcomeInput extends Omit<Partial<ReplicaWriteResult>,'code'>,Record<string,unknown> {
  revision?:number;localOk?:boolean;idbOk?:boolean;conflict?:boolean;transferFrozen?:boolean;stateInvalid?:boolean;
  code?:unknown;duplicate?:boolean;ineligible?:boolean;setupDraftConflict?:boolean;stale?:boolean;
  staleRevision?:boolean;staleBlock?:boolean;draftConflict?:boolean;alreadyCommitted?:boolean;
  accepted?:boolean;deferred?:boolean;finalizationPending?:boolean;compensationPending?:boolean;
  pendingJournalCleanup?:boolean;journalFailed?:boolean;reason?:unknown;
}
/** The durable owner consumes these concrete pure policy operations. */
export type SnapshotPolicy=Pick<ReturnType<typeof import('./snapshot.js').createSnapshotPolicy>,
  'isValidStateShape'|'classifyRecoveryCarrier'|'carrierReadStatus'|'normalizeRecoveryCarrierSnapshot'>;
export interface ParseContext {programId:string;programFingerprint:string;dayId:string;blockId?:string}
export interface SessionCapabilities {
  getState():StoredSnapshot|null|undefined;
  blockStartGuard(snapshot:StoredSnapshot|null):null|{ok:false;code?:string;[key:string]:unknown};
  onDraftRecovery?(value:{raw:string|null;reason:string}):void;
}
export interface SetupCapabilities {
  readRaw():string|null;
  rebase(snapshot:StoredSnapshot,head:StoredSnapshot,seed:string|null):StoredSnapshot;
}
export interface MutationResolution {
  ok:boolean;snapshot:StoredSnapshot;
  verify(snapshot:StoredSnapshot):{ok:boolean;code?:string}|Promise<{ok:boolean;code?:string}>;
}
export type WorkoutRules=ReturnType<typeof import('../training/workout.js').createWorkoutRules>;
export interface DurablePlatform {
  localStorage:Pick<Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
  indexedDB?:IDBFactory;navigator?:{locks?:LockManager};
  __repforgeDraftFault?:string|null;
  __repforgeDurableStateTestHooks?:Record<string,(payload:unknown)=>unknown|Promise<unknown>>;
}
export interface DurableOptions {
  snapshotPolicy:SnapshotPolicy;workout:WorkoutRules;session:SessionCapabilities;setup:SetupCapabilities;
  resolveCustomMutationIntent?:((input:{head:StoredSnapshot;journal:unknown})=>MutationResolution|Promise<MutationResolution>)|null;
  onAccepted?:((base:StoredSnapshot,snapshot:StoredSnapshot)=>void)|null;
  mutationGate?:(()=>boolean)|null;platform?:DurablePlatform;
}
export type ValidatedDraftEffect=DraftEffect;
export type EffectInput=DraftEffect|DraftEffectOutcome|null|undefined;
export interface StorageHealth extends OutcomeInput {
  localOk:boolean;idbOk:boolean;degraded:boolean;revision:number;
  lastResult:OutcomeInput|null;localFailed:boolean;idbFailed:boolean;quotaFailed:boolean;lastError:unknown;
}
export interface DraftIdentity {
  draftId:string;revision:number;writer?:{operationId:string};program:{programFingerprint:string};
}
export interface V2Committed {
  version:1;kind:'committed';draftId:string;revision:number;operationId:string;
  programFingerprint:string;raw:string;
}
export type V2Checkpoint=V2Committed|
  (Omit<V2Committed,'kind'> & {kind:'pending';baseRaw:string|null;previous:V2Record|null})|
  (Omit<V2Committed,'kind'> & {kind:'pending-removal';baseRaw:string})|
  Omit<V2Committed,'raw'|'kind'> & {kind:'tombstone'};
export type CanonicalRead={status:'ok';raw:string|null}|{status:'read-failed';error:unknown};
export type CheckpointRead={status:'absent';raw:null;value?:never}|{status:'valid';raw:string;value:V2Checkpoint}|
  {status:'invalid';raw:string;value?:never}|{status:'read-failed';raw:null;error:unknown;value?:never};
export type CheckpointPreparation={ok:false;reason:string}|{ok:true;kind:'none'}|
  {ok:true;kind:'pending-removal';value:Extract<V2Checkpoint,{kind:'pending-removal'}>}|
  {ok:true;kind:'pending';value:Extract<V2Checkpoint,{kind:'pending'}>};
export interface JournalOrder {at:number;writer:string;seq:number}
export interface DayRename {from:string;to:string}
export interface CustomMutationRecovery {version:1;operation:'delete';id:string}
export interface CustomMutationIntent extends CustomMutationRecovery {entry:CustomExercise}
export interface Journal extends Record<string,unknown> {
  id:string;version?:2;order?:JournalOrder;base:StoredSnapshot;liveBase:StoredSnapshot;proposal:StoredSnapshot;
  effect:DraftEffect|null;effectOutcome:DraftEffectOutcome;replace?:boolean;expectedProgramId?:string|null;
  expectedProgramFingerprint:string|null;expectedBlockId?:string|null;expectedStorageRevision:number|null;
  expectedFirstRunEmpty?:boolean;reconcileSessionIds?:string[];dayRenames?:DayRename[];
  customMutationRecovery?:CustomMutationRecovery|null;customMutationIntent?:CustomMutationIntent|null;
  recoveryTransaction?:boolean;rollback?:StoredSnapshot|null;rollbackRevision?:number;preflightPending?:boolean;
}
export interface PendingJournal {key:string;raw:string;journal:Journal;legacy:boolean;order:JournalOrder|null}
export interface InvalidJournal {key:string;raw:string|null}
export interface V2Record {
  version:1;kind?:string;draftId:string;revision:number;operationId:string;programFingerprint:string;raw:string;
}
export interface DraftSidecar extends Record<string,unknown> {
  version:1;transactionId:string;writer:string;order:JournalOrder;programFingerprint:string;raw:string|null;
}
export interface PendingDraftSidecar {key:string;raw:string;value:DraftSidecar}
export interface ReplicaValid {
  status:'valid';raw:unknown;parsed:StoredSnapshot;
  recoveryCarrierClassification?:import('./snapshot.js').RecoveryClassification;
}
export type ReplicaRead=ReplicaValid|{status:'absent';raw:null;parsed:null;recoveryCarrierClassification?:never}|
  {status:'invalid';raw:unknown;parsed:unknown;recoveryCarrierClassification?:never}|{status:'failed';raw:null;parsed:null;error:unknown;recoveryCarrierClassification?:never};
export interface JournalOptions {
  replace?:boolean;expectedProgramId?:string|null;expectedProgramFingerprint?:string|null;
  expectedBlockId?:string|null;expectedStorageRevision?:number;expectedFirstRunEmpty?:boolean;
  reconcileSessionIds?:string[];dayRenames?:DayRename[];effectOutcome?:EffectInput;
  recoveryTransaction?:boolean;preflightPending?:boolean;
  customMutationRecovery?:CustomMutationRecovery|null;customMutationIntent?:CustomMutationIntent|null;
}
export interface CommitOptions extends JournalOptions {
  liveBase?:StoredSnapshot;expectedSetupDraftRaw?:string|null;effect?:EffectInput;
  preflight?:((context:{head:StoredSnapshot;proposal:StoredSnapshot})=>{
    reject?:boolean;result?:OutcomeInput;proposal?:StoredSnapshot}|null|Promise<{
      reject?:boolean;result?:OutcomeInput;proposal?:StoredSnapshot}|null>)|null;
  preflightJournalPending?:boolean;
}
export interface ExecuteOptions {
  record?:PendingJournal|null;transactionId?:string|null;effect?:EffectInput;
  prepared?:StoredSnapshot|null;snapshot?:StoredSnapshot|null;io?:StorageIO|null;
  writePrepared?:boolean;preparedResult?:ReplicaWriteResult|null;
  retainRecordOnWriteFailure?:boolean;retainRecordOnReplicaPartial?:boolean;
  discard?:boolean;forceFinalization?:boolean;
}
export interface SidecarSettlement {
  settled:boolean;hadWrites:boolean;conflict?:boolean;transferFrozen?:boolean;code?:string;
  closeFailed?:boolean;recordRetained?:boolean;
}
export interface SemanticCheck {ok:boolean;code?:string}
export interface SemanticRecovery {
  owned?:boolean;code?:string;
  snapshot:StoredSnapshot;journalMarker:CustomMutationRecovery;
  verify?:(snapshot:StoredSnapshot)=>SemanticCheck|Promise<SemanticCheck>;
}
export interface CustomSettlementOptions {
  verify?:(input:{snapshot:StoredSnapshot;journal:Journal|null})=>SemanticCheck|Promise<SemanticCheck>;
  recover?:((input:{snapshot:StoredSnapshot;journal:Journal|null;code:string;stage:string})=>SemanticRecovery|null|Promise<SemanticRecovery|null>)|null;
  pendingJournalId?:string|null;
}
export type SnapshotChoice={kind:'first-run';recoveryChanged?:never}|{kind:'unresolved';reason:string;local:ReplicaRead;idb:ReplicaRead}|
  {kind:'chosen';snapshot:StoredSnapshot;source:string;recoveryChanged?:boolean;heal?:'local'|'idb';migrate?:boolean};
export interface RawJournal extends JournalOptions {
  version:2;id:string;order:JournalOrder;base:StoredSnapshot;liveBase:StoredSnapshot;
  proposal:StoredSnapshot;replace:boolean;expectedProgramId:string|null;effect?:DraftEffect;
}
export type DraftSettlement={accepted:false;rejected:true;settled:boolean;snapshot:StoredSnapshot|null;result:ReplicaWriteResult;deferred?:never}|
  {accepted:true;rejected:false;deferred:true;settled:false;snapshot:StoredSnapshot;result:ReplicaWriteResult;finalizationResult:ReplicaWriteResult;applied:unknown}|
  {accepted:true;rejected:false;snapshot:StoredSnapshot;result:ReplicaWriteResult|null;deferred?:false;settled?:true};
export interface TransactionExecution extends OutcomeInput {
  kind:string;accepted:boolean;rejected:boolean;settled:boolean;
  snapshot?:StoredSnapshot|null;result?:ReplicaWriteResult|null;
  closed?:SidecarSettlement|null;restored?:SidecarSettlement;
}
export type RecoveryChoice=Extract<SnapshotChoice,{kind:'chosen'}> & {source:'local'|'idb'};
export type NormalizedRecovery=Awaited<ReturnType<SnapshotPolicy['normalizeRecoveryCarrierSnapshot']>>;
