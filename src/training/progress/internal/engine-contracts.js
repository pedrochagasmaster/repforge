/** Contracts between validated source prescriptions, comparable completed
 * exposures and the deterministic recommendation algorithm. */
/** @typedef {import('../../metrics.js').MetricDefinition} MetricDefinition */
/** @typedef {{min:number,max:number}} RepRange */
/** @typedef {{id:string,slotId:string,exerciseId:string,setIndex:number,metricType:string,metricIds:string[],metricDefinitions:MetricDefinition[],targets:Record<string,number|RepRange>,rir:number,loadingModel:{bodyweightCoefficient:number},status:string}} Prescription */
/** @typedef {{ok:false,reasons:string[]}|{ok:true,supported:false,reasons:string[],kind?:string|null,semantics?:string[],repSemantic?:string|null,range?:RepRange}|SupportedShape} ShapeResult */
/** @typedef {{ok:true,supported:true,composition:string,kind:string,semantics:string[],repSemantic:string,requiresExecutionMode:boolean,range:RepRange,coefficient:number,reasons:string[]}} SupportedShape */
/** @typedef {{expandRepRange:boolean,weightMatch:boolean}} ProgressionSettings */
/** @typedef {{ok:true,context:Record<string,unknown>,convention:string,multiplier:number,displayLoadSemantic:string|null,loads:number[],bodyweightContributionEnabled:boolean,bodyweightKg:number|null,bodyweightContributionKg:number}} CurrentConfiguration */
/** @typedef {{ok:false,status:string,reasons:string[]}|CurrentConfiguration} ConfigurationResult */
/** @typedef {{ok:false,reason:string}} IncomparableSet */
/** @typedef {{ok:true,effectiveLoadKg:number,displayLoadKg:number|null,bodyweightContributionKg:number,multiplier:number,reps:number}} ComparableLoad */
/** @typedef {ComparableLoad & {capacityKg:number,sessionId:string|null,equipmentId:unknown,loadingConvention:string,setIndex:number,rir:number}} ComparableSet */
/** @typedef {{sessionId:string|null,sets:ComparableSet[],reasons:string[]}} ComparableSession */
/** @typedef {{adjacentDrops:{fromSetIndex:number,toSetIndex:number,drop:number}[],sampleSessionIds:(string|null)[]}} Fatigue */
/** @typedef {{source:string,sessionId:string|null,sessionIds:(string|null)[],setIndex:number,effectiveLoadKg:number,capacityKg:number,displayLoadKg:number|null,loadingConvention:string,equipmentId:unknown}} HistoryAnchor */
/** @typedef {{displayLoadKg:number|null,effectiveLoadKg:number,reps:number,predictedRir:number}} Candidate */
/** @typedef {{equipmentId:unknown,loadingConvention:string,availableLoadsKg:number[],bodyweightContributionEnabled:boolean,bodyweightKg:number|null,bodyweightContributionKg:number,externalLoadMultiplier:number,assistanceDirection:string|null}} LoadingAssumptions */
/** @typedef {{prescriptionId:string|null,slotId:string|null,exerciseId:string|null,setIndex:number|null,status:string,targets:Record<string,number>,reasonCodes:string[],reasons:string[],formulaVersion:string,historyAnchor:HistoryAnchor|null,fatigue:Fatigue & {projectedCapacityKg:number|null},loadingAssumptions:LoadingAssumptions|null,expandedRepRange?:RepRange,targetEffectiveLoadKg?:number,predictedRir?:number,repRange?:RepRange,displayLoadSemantic?:string|null}} Recommendation */
export {};
