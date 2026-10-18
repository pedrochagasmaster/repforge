import type {MetricDefinition} from '../training/metrics.js';
import type {CommitResult} from './session.js';
/** Acknowledged log fields understood by History; unrelated historical fields survive. */
export interface HistoryRow extends Record<string,unknown> {
 session?:string|number;date?:string;day?:string;created?:string|null;set?:number|string;
 load?:number|string|null;reps?:number|string|null;rir?:number|string|null;warmup?:boolean;rirMeasured?:boolean;
 exerciseId?:string;performedLibraryId?:string;performedMovementId?:string;primary?:string;
 metricType?:string;metricIds?:string[];metricDefinitions?:MetricDefinition[];
 metricValues?:{metricId:string,value:number,unit?:string}[];
}
export interface HistoryReading {load:number|string|null;reps:number|string|null;tonnage?:number|null;strengthComparable?:boolean;strengthConvention?:string|null}
export interface HistoryRowFacts {reading:HistoryReading;storedName:string;name:string;currentName?:string;liftKey:string}
export interface SessionCounts {improved:number;flat:number;regressed:number;new:number}
export interface HistorySession {session?:string|number;date?:string;day?:string;created?:string|null;rows:readonly HistoryRow[];delta?:SessionCounts;searchText?:string;dayLabel?:string}
export type SessionPair={session?:string|number,liftKey:string,first:true}|{session?:string|number,liftKey:string,first?:false,previous:HistoryReading[],current:HistoryReading[]};
export interface HistoryGrouped {rows:HistoryRow[];sessions:HistorySession[];liftPred:Map<string,HistoryRow[]>;pairs:SessionPair[]}
export interface HistoryMonth {sessions:Set<string|number|undefined>;sets:number;byDay:Map<number,{sets:number,pr:boolean}>}
export interface PrEvent {session?:string|number;date?:string;liftKey:string;deltaLoad?:number|null;deltaReps?:number|null;deltaE1rm?:number|null}
export interface HistoryIndex {rows:HistoryRow[];sessions:HistorySession[];months:Map<string,HistoryMonth>;prEvents:PrEvent[];tableRows:HistoryRow[];liftPred:Map<string,HistoryRow[]>;rowFacts:ReadonlyMap<HistoryRow,HistoryRowFacts>}
export interface HistoryBlock {key:string;kind:string;name?:string;start:string;end?:string|null;planned:number}
export interface HistoryBlockContext {started?:string|null;weeks:number;planned:number;today:string;name?:string;archived?:{id:string,name?:string,start:string,end?:string|null,planned:number}[]}
export interface HistoryContext {block:HistoryBlockContext;locale:string;today:string;weekdayLetters:readonly string[];dayLabels:Readonly<Record<string,string>>;revision:number}
export interface HistoryOutcome {status:string;label:string}
export interface HistoryQueries {
 rows:()=>readonly Readonly<HistoryRow>[];
 row:(row:HistoryRow)=>Readonly<HistoryRowFacts>;
 index:(rows:readonly HistoryRow[])=>HistoryIndexView;
 buildIndex:(rows:readonly HistoryRow[])=>HistoryIndexView;
 search:(index:HistoryIndexView,query:string)=>readonly Readonly<HistorySession>[];
 context:()=>Readonly<HistoryContext>;
 outcome:(rows:readonly HistoryRow[])=>Readonly<HistoryOutcome>|null;
 diagnostics:{enabled?:boolean,builds?:number,sourceRowVisits?:number,last?:unknown,onBuilt?:(index:HistoryIndex)=>void};
}
export type HistoryResult=CommitResult & {ok?:boolean,code?:string,failed?:boolean,invalid?:boolean,stale?:boolean,duplicate?:boolean};

/** Query surfaces expose immutable collection APIs; builders keep their local maps. */
export type HistoryIndexView=Readonly<{
 rows:readonly Readonly<HistoryRow>[];
 sessions:readonly Readonly<HistorySession>[];
 months:ReadonlyMap<string,Readonly<{sessions:ReadonlySet<string|number|undefined>,sets:number,byDay:ReadonlyMap<number,Readonly<{sets:number,pr:boolean}>>}>>;
 prEvents:readonly Readonly<PrEvent>[];
 tableRows:readonly Readonly<HistoryRow>[];
 liftPred:ReadonlyMap<string,readonly Readonly<HistoryRow>[]>;
 rowFacts:ReadonlyMap<HistoryRow,Readonly<HistoryRowFacts>>;
}>;
