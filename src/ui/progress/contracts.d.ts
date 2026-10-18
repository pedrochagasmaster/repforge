import type {ReviewFlow,PreviewFlow,ReviewPreview,ProgramDefinition,ProgramSlot,CarryReport} from '../../app/review-contracts.js';
export type {ReviewFlow,PreviewFlow,ReviewPreview,ProgramDefinition,ProgramSlot,CarryReport};
export type Translate=(key:string,values?:Record<string,unknown>)=>string;
export interface Copy {t:Translate}
export interface Format {load:(value:number)=>string;number:(value:number|null)=>string;unit:()=>string;displayLoad:(value:number)=>number}
export interface Comparison {label?:string;status?:string;absolute?:number|null;percentage:number|null}
export interface StrengthSeries {presentation:string;evidenceCount:number;points:readonly {value:number}[];scope:string;comparisonConvention?:string|null;perSideLoad?:boolean;perSideReps?:boolean;outcome?:string|null;reason?:string|null;comparison?:Comparison|null}
export interface StrengthSession {session:string;top:number;topReps:number;rir:number|null}
export interface StrengthHistorySession extends StrengthSession {shortDate:string;longDate:string;e1rmDisplay:number}
export interface StrengthRow {key:string;name:string;series:StrengthSeries;latest?:StrengthSession;comparison?:{label:string;status:string}|null;slotId?:string;dateLabel?:string|null;sessions:readonly StrengthHistorySession[]}
export interface AttentionRow {id:string;name:string;destinationId:string;group:string;move:string;target?:number|null;last?:number|null;exerciseId?:string;label?:string;reason?:string;lead?:string;series?:StrengthSeries}
export interface WeekModel {status:string;week?:number|null;totalWeeks:number;baselineCount:number;completedSessions:number;plannedSessions:number;completedWorkingSets:number;plannedWorkingSets:number}
export interface VolumeModel {scope:string;periodLabel:string;rows:readonly {muscle:string,label:string,planned:number,done:number,inProgress:boolean|string|null,details:readonly {dateLabel:string,name:string,sets:number}[]}[]}
export interface PrModel {filter:string;events:readonly {kind:string,name:string,date?:string,dateLabel:string,load:number,reps:number,deltaLoad?:number|null,deltaReps?:number|null,deltaE1rm?:number|null}[]}
export type ReviewModel={started:false}|{started:true;checkpoint:{structuralActions:readonly string[],lifecycle:string,hasSufficientEvidence:boolean};life:{isComplete:boolean,isFinalWeek:boolean,current:number|null,total:number};volume:{plannedWorkingSets:number,completedWorkingSets:number,completedSessions:number,plannedSessions:number,period:{plannedSessions?:number}};periodStart:string;periodEnd:string;outcomes:readonly {name:string,outcome:string}[]}
export interface ReviewOptions {document:Document;copy:Copy;queries:{preview:(flow:PreviewFlow)=>Readonly<ReviewPreview>};commands:ReturnType<typeof import('../../app/review.js').createReviewCommands>;onChange:()=>void;onNotice:(message:string)=>void}
export interface OverviewOptions {document:Document;copy:Copy;format:Format;onOpenExercise:(key:string)=>void;onGoToday:()=>void}
export type Overview=ReturnType<typeof import('./overview.js').createProgressOverview>;
export interface EvidenceOptions {document:Document;copy:Copy;format:Format;presentation:Overview;onStrengthScope:(scope:string)=>void;onVolumeScope:(scope:string)=>void;onPrFilter:(filter:string)=>void}
export interface ControllerOptions extends OverviewOptions {motion?:Pick<ReturnType<typeof import('../../platform/motion.js').createMotion>,'available'|'reducedMotion'|'animateIndicator'>|null;queries:{overview:()=>ReturnType<ReturnType<typeof import("../../app/progress-read-models.js").createProgressReadModels>["overview"]>;strength:(scope:string)=>Readonly<{scope:string,rows:readonly StrengthRow[]}>;volume:(scope:string)=>Readonly<VolumeModel>;prs:(filter:string)=>Readonly<PrModel>;review:()=>Readonly<ReviewModel>};review:Pick<ReturnType<typeof import('./review.js').createReviewController>,'render'|'dispose'>;onReviewViewed:()=>void;onSelected:(segment:string)=>void}
