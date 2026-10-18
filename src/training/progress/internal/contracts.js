/** Pure progress input/output data contracts. History values can be released
 * numeric strings; the evidence algorithms retain their explicit Number
 * coercion. Outcomes are supplied by the authoritative engine. */
/** @typedef {{id?:string,date?:string,created?:string|null,session?:string,sessionKey?:string,set?:number|string,day?:string,exerciseId?:string,exercise?:string,name?:string,blockId?:string,work?:boolean,warmup?:boolean,load?:number|string|null,reps?:number|string|null,rir?:number|string|null,strengthComparable?:boolean,strengthConvention?:string|null}} HistoryRow */
/** @typedef {{id?:string,name?:string,day?:string,sets?:number,plannedWorkingSetsPerWeek?:number,slot?:string,pattern?:string}} ProgramRow */
/** @typedef {{exercises?:ProgramRow[],started?:string|null,mesocycleLengthWeeks?:number}} ProgramObject */
/** @typedef {ProgramRow[]|ProgramObject|null|undefined} ProgramInput */
/** @typedef {{exerciseId:string,scope:string|null,evidenceState:'insufficient'|'sufficient',evidenceCount:number,reason:string|null,outcome?:string,recommendation?:string,reasonCodes?:string[]}} EvidenceRecord */
/** @typedef {{week?:number,plannedSessions?:number,plannedWorkingSets?:number}} WeekPrescription */
/** @typedef {{started?:string|null,mesocycleLengthWeeks?:number,mesocycleStatus?:string,blockId?:string,evidenceScope?:string,evidenceRecords?:unknown,hardRir?:number,weekPrescriptions?:WeekPrescription[],plannedVolumeHistory?:unknown,recoveryEligible?:boolean}} EvidenceMeta */
/** @typedef {import('../../model/internal/contracts.js').PlannedVolumeHistory} PlannedVolumeHistory */
/** @typedef {{session:string,sessionKey:string,date:string,created:string|null,value:number,reps?:number,strengthConvention?:string|null}} EvidencePoint */
export {};
