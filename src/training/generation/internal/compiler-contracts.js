/** Compiler contracts: external bytes stay unknown until their validator has
 * succeeded. These DTOs describe accepted, deterministic domain values. */
/** @typedef {import('../../metrics.js').MetricDefinition} MetricDefinition */
/** @typedef {import('./candidate-contracts.js').CandidateSource & {laterality?:string[]}} SourceExercise */
/** @typedef {{exercises:SourceExercise[],uuidIndex:Record<string,import('./candidate-contracts.js').CatalogEntity>}} SourceCatalog */
/** @typedef {import('./layout-contracts.js').LayoutRequest & {emphasisMuscleIds:string[],deprioritizedMuscleIds:string[],excludedExerciseIds:string[],excludedMuscleIds:string[],preferredExerciseIds:string[],competencyAnswers:Record<string,boolean|null>,movementConfirmations:Record<string,string[]>,executionContexts:Record<string,string>}} CanonicalRequest */
/** @typedef {{gymProfile?:CanonicalRequest['gymProfile'],equipmentIds?:string[],competencyAnswers?:Record<string,boolean|null>,movementConfirmations?:Record<string,string[]>,executionContexts?:Record<string,string>,excludedExerciseIds?:string[],excludedMuscleIds?:string[],preferredExerciseIds?:string[]}} SelectionContext */
/** @typedef {{purposeId?:string,patternIds:string[],muscleIds:string[],exerciseTypeId:string,issues?:string[]}} Job */
/** @typedef {{groupId:string|null,equipmentIds:string[]}} EquipmentGroup */
/** @typedef {{resistanceGroupId:string|null,supportGroupId:string|null,equipmentIds:string[]}} EquipmentContext */
/** @typedef {{exerciseId:string,roleTier:number|null,_preferred:boolean}} RankedIdentity */
/** @typedef {RankedIdentity & {eligibleEquipmentContexts:EquipmentContext[],reasons:string[],_exercise:SourceExercise,_job:Job & {issues:string[]}}} JobCandidate */
/** @typedef {{verdicts:{exercise:SourceExercise,failure:string|null}[],candidates:JobCandidate[],policyIssues:string[]}} JobPool */
/** @typedef {{excludedIds?:Set<string>,usedIds?:Set<string>,usedGroups?:Set<string>}} CandidateOptions */
/** @typedef {{min:number,max:number}} RepRange */
/** @typedef {{source:string,policyVersion:string,periodization?:string,deload?:boolean,approximation?:boolean}} SetProvenance */
/** @typedef {{id:string,cycleIndex:number,setIndex:number,metricType:string,metricIds?:string[],metricDefinitions?:MetricDefinition[],targets:Record<string,number|RepRange>,rir:number|null,restSeconds:number|null,status:string,provenance:SetProvenance}} ProgramSet */
/** @typedef {{id:string,purposeId:string,exerciseId:string,sourceExerciseIds:string[],role:string,musclePurposeIds:string[],movementPatternIds:string[],exerciseTypeId?:string,metricIds:string[],metricDefinitions:MetricDefinition[],metricOrigin:string,lateralityIds?:string[],executionMode?:string|null,loadingModel:{bodyweightCoefficient:number|null,assistanceDirection?:string|null},order:number,prescriptionsByCycle:{cycleIndex:number,sets:ProgramSet[]}[],displayName?:string,setupNotes?:string,manualAttribution?:{primary?:string,secondary?:string},alternates?:string[],_setCount?:number,_executionMode?:string}} ProgramSlot */
/** @typedef {{id:string,name:string,kind:string,order:number,slots:ProgramSlot[]}} ProgramDay */
/** @typedef {{schemaVersion:number,generatorVersion:string,seed?:string,request:unknown,days:ProgramDay[],cycles:number,deloadCycles:number[],provenance:{source:string,policyVersion:string,goal?:string,split?:string,selection?:string,approximations?:string[],generationBudgetMinutes?:number,estimatedSessionSeconds?:Record<string,number>,focusNotApplied?:{muscleId:string,reason:string}[]}}} ProgramDefinition */
/** @typedef {{field?:string,code:string,message?:string,issues?:unknown}} Conflict */
/** @typedef {{field:string,code:string,message:string}} FieldIssue */
/** @typedef {{ok:true,value:CanonicalRequest}|{ok:false,issues:FieldIssue[]}} RequestResult */
/** @typedef {{lineage:string,origin:string,purposeId:string,slotId:string,exerciseId:string,repClass:string,initialWeekIndex?:number,initialDayId?:string|null,finalDayId:string,baseSetCount:number,afterExperienceSetCount:number,finalSetCount:number,retained:boolean}} SlotDiagnostic */
/** @typedef {{kind:string,schemaVersion:number,version:string,terminalStage:string,slots:SlotDiagnostic[],allocation?:{requestedMinutes:number,budgetMinutes:number|null,selected:import('./layout-contracts.js').Allocation|null,estimatedSecondsByDay:Record<string,number>}}} GenerationDiagnostics */
/** @typedef {{enginePolicy?:unknown,diagnostics?:string}} GenerationOptions */
/** @typedef {{namespace:string,allocate:(value:string)=>string}} GenerationNamespace */
/** @typedef {{ok:false,value:null,conflicts:Conflict[],explanations:[]}|{ok:true,value:ProgramDefinition,conflicts:[],explanations:{code:string,generationBudgetMinutes:number}[],confirmationOffers:{dayId:string,slotId:string,currentExerciseId:string,offeredExerciseId:string,prerequisiteIds:string[]}[]}} GenerationResult */
export {};
