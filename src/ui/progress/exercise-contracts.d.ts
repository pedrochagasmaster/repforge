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
export interface ExerciseSlot {id:string;name?:string}
export interface ExerciseSelection {key:string;openKey:string;from:string;exercise:Readonly<ExerciseSlot>|null}
export type ExerciseDetail=Readonly<ReturnType<typeof import('../../app/read-models.js').buildExerciseReadModel>&{key:string;name:string;slotId:string|null;muscle:string;prescription:{day:string;text:string;hasRepTarget:boolean;rirHigh:number}|null;art:{src:string;bg?:string|null}|null;recommendation:{status:string;cue:string;text:string}|null}>;
export interface ExerciseOptions extends Omit<ChartOptions,'queries'|'focus'> {queries:ChartOptions['queries']&{open:(key:string)=>Readonly<{key:string;exercise:Readonly<ExerciseSlot>|null}>;detail:(key:string,exercise:Readonly<ExerciseSlot>|null)=>ExerciseDetail};shell:Pick<ReturnType<typeof import('../shell.js').createShell>,'routePushBegin'|'routeViewEl'|'routeHeading'|'focusRoute'>;onChartPresentation?:(kind:string)=>void;onRender:()=>void;onSettings:()=>void;onSeePrs:()=>void;onGlossary:(term:string,anchor:HTMLElement)=>void;onWhy:(slotId:string,anchor:HTMLElement)=>void}
