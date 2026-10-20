/** Shared engine policy. A complete policy snapshot is validated as bounded
 * enumerable data before any generation algorithm consumes it. */
/** @typedef {{kind:string,schemaVersion:number,volume:{setsByType:Record<string,number>,beginnerSetReduction:number},allocation:{budgetMinutesByCeiling:Record<number,number>,compoundFraction:{strength:number,other:number}},prescription:{staticRepCenters:Record<string,Record<string,number>>,periodizedRepCenters:Record<string,Record<string,number[]>>,baseRirByClass:Record<string,number>,rirAdjustmentsBySetCount:Record<number,number[]>,beginnerRirBonus:number,restSeconds:{compound:number|null,accessory:number|null}},periodization:{indices:Record<string,number[]>},deload:{setRetention:number,repRetention:number,rirBonus:number},timeModel:{perExerciseOverheadSeconds:number,isolationFixedSeconds:number,compoundFixedSeconds:number,secondsPerSet:number,coreRestSeconds:number,isolationRestSeconds:number,upperRestSeconds:number,lowerRestSeconds:number}}} EnginePolicy */
/** @typedef {{min:number,max:number,integer:boolean,unit:string,dependency?:string,nullable?:boolean}} FieldRule */
/** @typedef {FieldRule & {path:string,label:string,default:unknown}} PolicyField */
/** @typedef {{path:string,code:string,message:string}} PolicyIssue */
/** @typedef {{ok:true,value:EnginePolicy,isDefault:boolean}|{ok:false,issues:PolicyIssue[]}} PolicyResult */
export {};
