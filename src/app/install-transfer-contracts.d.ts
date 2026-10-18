import type {RawSnapshot,RawRecord} from '../persistence/snapshot.js';
import type {Draft,Writer} from '../training/workout-contracts.js';
import type {Envelope} from '../interchange/transfer-contract.js';
import type {LogicalSnapshot,CredentialVault} from '../platform/install-transfer-contracts.js';
export type SetupDraft=ReturnType<ReturnType<typeof import('../training/authoring.js').createEntryRules>['createState']>;
export type Previous=Omit<LogicalSnapshot,'durableState'|'telemetryIdentity'> & {durableState:RawSnapshot;telemetryIdentity:RawRecord|null;devicePresence:{ui:boolean;consent:boolean;identity:boolean};candidateRaw:string|null};
export interface ImportMarker extends RawRecord {version:1;transactionId:string;claimIdDigest:string;phase:'importing'|'rolling-back'|'local-committed';previous:Previous;incoming:Envelope;createdAt:string;expectedLocalRevision:number}
export interface InvalidMarker extends RawRecord {invalid:true;code?:string}
export interface ImportOptions {claimId?:unknown;claimIdDigest?:unknown;transactionId?:string|null;credentials?:CredentialVault|null}
export type ProgressKind='outbound-confirmed'|'outbound-expired'|'outbound-pending'|'outbound-unknown'|'outbound-create'|'outbound-ready'|'outbound-retryable'|'outbound-create-failed'|'resumed-diverged'|'receiver-claim'|'receiver-import';
export interface Progress {kind:ProgressKind;detail?:RawRecord}
export interface Options {
 device:ReturnType<typeof import('../platform/install-transfer.js').createTransferDevice>;
 durable:Pick<ReturnType<typeof import('../persistence/durable.js').createDurableStore>,'readLocalStatus'|'readIdbStatus'|'chooseSnapshot'|'pendingDraftTransaction'|'readAuxiliaryIdbValue'|'writeAuxiliaryIdbValue'|'deleteAuxiliaryIdbValue'|'DraftStore'|'restoreTransferSnapshot'>;
 snapshotPolicy:Pick<ReturnType<typeof import('../persistence/snapshot.js').createSnapshotPolicy>,'isValidStateShape'|'normalizeLoaded'|'normalizeSettings'>;
 programModel:Pick<ReturnType<typeof import('../training/model.js').createProgramModel>,'structureDayLabels'>;
 workoutRules:Pick<ReturnType<typeof import('../training/workout.js').createWorkoutRules>,'parse'|'serialize'|'logicalCloneSection'>;
 entryRules:Pick<ReturnType<typeof import('../training/authoring.js').createEntryRules>,'normalizeSetupDraft'|'normalizeSetupDraftEnvelope'>;
 setupDraftStore:Pick<ReturnType<typeof import('../persistence/setup-draft.js').createSetupDraftStore>,'readRecord'|'readRaw'|'transaction'|'importedEnvelope'|'removeObserved'|'adopt'|'writeObserved'>;
 trainingSession:{read():RawSnapshot|null};entrySession:{read():SetupDraft|null;publish(value:SetupDraft|null):unknown};
 workoutSession:{current():Draft|null;flush():Promise<unknown>;writer(operationId:string):Writer;adopt(draft:Draft,raw:string):void;readAcknowledged(snapshot:RawSnapshot):{status:string}};
 transfer:ReturnType<typeof import('../platform/install-transfer.js').createInstallTransfer>;
 contract:ReturnType<typeof import('../interchange/transfer-contract.js').createTransferContract>;
 telemetry:{isEnabled():boolean;setEnabled(value:boolean):unknown};telemetryTransport:{restartIfStarted():unknown};
 guideDefinitions:readonly {id:string;version:number}[];
 commit:(proposal:RawSnapshot,options:import('../persistence/contracts.js').CommitOptions)=>Promise<import('../persistence/contracts.js').OutcomeInput>;
 onProgress:(change:Progress)=>void;onDeviceChanged:()=>void;fault?:(point:string)=>unknown;
}
