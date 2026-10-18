export interface ChartPoint {date:string;top:number;reps:number;e1rm:number;perSideLoad:boolean;perSideReps:boolean;sessionKey:string;block:boolean}
export interface ChartSession {liftKey:string;date:string;top:number;topReps:number;e1rm:number;perSideLoad?:boolean;perSideReps?:boolean;sessionKey:string}
export interface Projection {sessions:readonly ChartSession[];series:ReadonlyMap<string,{points:readonly {sessionKey:string}[]}>}
export interface ChartModel {pts:ChartPoint[];vals:number[];sel:number;metric:string;scope:string;value:(point:ChartPoint)=>number}
export interface Geometry {lo:number;hi:number;step:number;x:(index:number)=>number;y:(value:number)=>number}
export interface ChartItem {i:number|null;key:string;x:number;y:number;tick:boolean;old:boolean;sel:boolean;alpha:number}
export interface ChartLive {key:string;view:object;model:ChartModel;scope:string;metric:string;geo:Geometry;items:ChartItem[];keys:string[];drawn:Map<string,number[]>}
export type Intent={kind:'open'|'metric'|'scope'}|{kind:'extend';from:number};
export interface ChartInput {key:string;name:string;identity:object}
export interface ChartOptions {window:Window & typeof globalThis;copy:{t:(key:string,values?:Record<string,unknown>)=>string};format:{number:(value:number)=>string;load:(value:number)=>string;displayLoad:(value:number)=>number;unit:()=>string;date:(value:string)=>string};queries:{projection:(scope:string)=>Projection};motion?:Pick<ReturnType<typeof import('../../platform/motion.js').createMotion>,'available'|'reducedMotion'|'animateCoordinates'|'animateIndicator'>|null;focus:(element:Element)=>void}
