import type {MetricDefinition} from '../../training/metrics.js';
import type {HistoryRow,HistorySession,HistoryQueries,HistoryOutcome,HistoryResult,HistoryIndexView} from '../../app/history-contracts.js';
export type {HistoryRow,HistorySession,HistoryQueries,HistoryOutcome,HistoryResult,HistoryIndexView as HistoryIndex};
export type Translate=(key:string,values?:Record<string,unknown>)=>string;
export type MetricRecord={definition:MetricDefinition,value:number,unit?:string};
export interface HistoryFormat {date:(iso:string)=>string;load:(value:unknown)=>string;loadPlain:(value:unknown)=>string;compact:(value:unknown)=>string;number:(value:unknown)=>string;displayLoad:(value:number)=>number;unit:()=>string;muscle:(value:string)=>string;metricLabel?:(metric:MetricDefinition)=>string;metricText?:(value:number,metric:MetricDefinition)=>string;metricUnit?:(metric:MetricDefinition)=>string}
export type FieldParse<T>={field?:never,key?:never,value:T}|{field:"load"|"reps"|"rir"|"metric"|"date",key:string,value?:never};
export type InputEdit={valid:false,key?:string,value?:never}|{valid:true,value:number|null,key?:never};
export interface HistorySelection {mode:string;sessionId:string|null;originalFingerprint:string;desiredFingerprint:string|null;workingCopy:HistoryRow[]|null;baselineRows?:HistoryRow[]|null;removedRowIndices:number[];dirty:boolean;validation:unknown;operation:'edit'|'delete'|null;operationId:string|null;inputEdits?:Record<string,InputEdit>}
export interface HistoryInputs {date:(value:unknown)=>FieldParse<string>;load:(value:unknown)=>FieldParse<number>;reps:(value:unknown)=>FieldParse<number>;rir:(value:unknown)=>FieldParse<number>;metric?:(metric:MetricDefinition,value:unknown)=>FieldParse<number>}
export interface HistoryOptions {window:Window & typeof globalThis;queries:HistoryQueries;commands:ReturnType<typeof import('../../app/history.js').createHistoryCommands>;copy:{t:Translate};format:HistoryFormat;inputs:HistoryInputs;shell:{openModal:(sheet:HTMLElement,options:{onEscape:()=>unknown,scrim:HTMLElement|null,returnFocus:Element|null,initialFocus?:HTMLElement|null,delayHide:number})=>boolean|void;closeModal:(sheet:HTMLElement)=>Promise<boolean>;reducedMotion:()=>boolean;canTakeFocus:(node:Element)=>boolean};onChanged:()=>void;onNotice:(message:string)=>void;onOutcome:(payload:{action:string,status:string})=>void}
export interface ReadingGroup {key:string;rows:readonly HistoryRow[];name:string;previous:readonly HistoryRow[];outcome:HistoryOutcome|null;record:boolean}
export interface EditorGroup {key:string;name:string;rows:{r:HistoryRow,i:number}[]}
export interface MarkupOptions {copy:{t:Translate};format:HistoryFormat & {locale:()=>string}}
export interface ReadingModel {record:HistorySession;groups:ReadingGroup[];setCount:number;volumeDisplay:number;hasStrengthProjection:boolean;prCount:number}
export interface EditorModel {record:HistorySession;sets:readonly HistoryRow[];selection:HistorySelection;groups:EditorGroup[]}
