import type {Proposal,CarryReport,Change} from '../training/generation.js';
import type {ProgramDefinition,ProgramSlot} from '../training/generation.js';
import type {CommitResult} from './session.js';
export type {Proposal,CarryReport,Change,ProgramDefinition,ProgramSlot};
export type ReviewAction='repeat'|'schedule-repair'|'reduce-volume'|'recovery-week'|'guided-edit';
export type Diagnosis={kind:'fewer_days'|'sessions_too_long',answers:{availableDays:number}|{sessionMinutes:number}};
export type PreviewFlow={stage:'preview',action:ReviewAction,proposal:Proposal,carry?:CarryReport|null};
export type ReviewFlow=PreviewFlow|{stage:'diagnosis',action:ReviewAction,kind:'fewer_days'|'sessions_too_long',target:string,error?:string|null}
 |{stage:'volume-question',action:'reduce-volume'}|{stage:'recovery-question',action:'recovery-week',answer:string|null,message?:string}
 |{stage:'staged'}|{stage:'error',action?:ReviewAction,code?:string,stale?:boolean}|{stage:'done',doneKey?:string};
export interface ReviewPreview {before?:ProgramDefinition;after?:ProgramDefinition;beforeDayLabels:Readonly<Record<string,string>>;afterDayLabels:Readonly<Record<string,string>>;movementLabels:Readonly<Record<string,string>>}
export type ReviewResult=CommitResult & {ok?:boolean,code?:string,duplicate?:boolean,stale?:boolean,doneKey?:string};
export interface ReviewCommandOptions {
 transition:{confirmTransition:(input:{proposal:Proposal,proposalHash:string,transitionId:string,successorProgramId:string,confirmedAt:string,acknowledgedDraftRaw:string|null})=>Promise<ReviewResult>;
 proposeChange:(input:{change:Change})=>Promise<{ok:true,proposal:Proposal,carry?:CarryReport}|{ok:false,code?:string}>;
 stageGuidedManualRepair:(input:{diagnosis:Diagnosis,openEditor:false})=>Promise<ReviewResult>};
 readDraft:()=>string|null;clearStaging:()=>Promise<ReviewResult>;openStagedEditor:()=>unknown;repeat:()=>unknown;
 onCommitted:(result:ReviewResult)=>void;onChoice:(action:string)=>void;now?:()=>string;
}
