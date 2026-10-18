import type {EvidenceMeta,EvidenceRecord} from '../training/progress/internal/contracts.js';
export type {EvidenceMeta,EvidenceRecord};
export interface StrengthRow {exerciseId:string;session?:string|number;sessionKey:string;date:string;created?:string|null;blockId?:string;name:string;day?:string;load:number;reps:number;rir:number|null;work:true;strengthComparable?:boolean;strengthConvention?:string|null;perSideLoad?:boolean;perSideReps?:boolean;tonnage:number|null;e1rm:number}
export interface ProgramLift {key:string;name:string;signal:string}
export interface ProgressFacts {scope:string;recordKeys:readonly string[];rows:StrengthRow[];meta:EvidenceMeta;program:readonly ProgramLift[]}
export interface PrEvent {liftKey:string;session?:string|number;date:string;blockId?:string|null}
export interface ProjectionFacts extends ProgressFacts {records:EvidenceRecord[];prEvents:readonly PrEvent[]}

export type StrengthSeries=ReturnType<typeof import("../training/progress.js").evidence.buildStrengthEvidence>&{perSideLoad:boolean;perSideReps:boolean};
export interface ProgressComparisonFacts {key:string;currentRows:readonly {key:string;session?:string|number}[]|null;reader:{scope:unknown;convention:unknown;session:unknown;rows:StrengthRow[]|null}|null;meta:EvidenceMeta}
