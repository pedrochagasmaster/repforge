/** Serialized model contracts. These describe accepted training DTOs; external
 * backup values still enter the runtime validators as unknown. No UI or storage
 * dependency is carried by a model instance. */
/** @typedef {import('../../metrics.js').MetricDefinition} MetricDefinition */
/** @typedef {{id:string,name:string,type?:string}} CatalogObject */
/** @typedef {CatalogObject & {exerciseMetrics?:string[],primaryFeatureMuscle?:string[],secondaryFeatureMuscle?:string[],movementPattern?:string[],exerciseType?:string,bodyweight?:number}} CatalogExercise */
/** @typedef {{exercises:CatalogExercise[],uuidIndex:Record<string,CatalogObject>}} Catalog */
/** @typedef {{id:string,name:string,namePt?:string,primary?:string,secondary?:string,notes?:string,equipment?:string[],metricIds?:string[],metricDefinitions?:MetricDefinition[],exerciseTypeId?:string}} LibraryEntry */
/** @typedef {LibraryEntry & {namePt:string,archived:boolean,equipment:string[],primary:string,secondary:string,notes:string,patterns:string[],beginnerFriendly:boolean,custom:boolean,created:string}} CustomExercise */
/** @typedef {(id:string)=>LibraryEntry|null} LibraryLookup */
/** @typedef {{version:number,kind:string,source:string,reason:string,value:unknown}} ProgressionIncompatibility */
/** @typedef {{id:string,day:string,order:number,name:string,sets:number,primary?:string,secondary?:string,notes:string,alternates:string[],hasRepTarget?:boolean,min?:number,max?:number,slotId?:string,dayId?:string,libraryId?:string,movementId?:string,displayName?:string|null,progressionType?:string,targetRirStart?:number,targetRirEnd?:number,minSets?:number,maxSets?:number,priority?:string,loadingMode?:string,loadIncrement?:number,progression?:unknown,progressionIncompatibility?:unknown,exerciseId?:string}} ExerciseRow */
/** @typedef {Partial<Omit<ExerciseRow,'alternates'>> & {alternates?:string|string[]}} ExerciseInput */
/** @typedef {{slotId:string,sets:number,primary?:string,secondary?:string}} ReceiptSlot */
/** @typedef {{dayId:string,slots:ReceiptSlot[]}} ReceiptDay */
/** @typedef {{week:number,phase?:string,days:ReceiptDay[]}} Receipt */
/** @typedef {{dayId:string,label:string,order?:number,displayNameKey?:string,nameOverride?:string}} StructureDay */
/** @typedef {{fromWeek:number,program:ExerciseInput[]}} ProgramVersion */
/** @typedef {{days?:StructureDay[],weekPrescriptions?:Receipt[],programVersions?:ProgramVersion[],provenance?:{source?:string}}} ProgramStructure */
/** @typedef {{schemaVersion:number,throughWeek:number,plannedSessions:number,plannedWorkingSets:number,muscles:{direct:Record<string,number>,secondary:Record<string,number>}}} PlannedVolumeHistory */
/** @typedef {{started?:string,mesocycleLengthWeeks?:number,mesocycleStatus?:string,programStructure?:ProgramStructure,programDefinition?:ProgramDefinition,plannedVolumeHistory?:PlannedVolumeHistory}} ProgramMeta */
/** @typedef {{diff?:{recoveryWeek?:{entries?:{slot:string,effectiveWorkingSets:number}[]}}}} RecoveryRecord */
/** @typedef {{plannedSessions:number,plannedWorkingSets:number,musclesByName:Record<string,{d:number,p:number}>}} PrescriptionSummary */
/** @typedef {{id:string,cycleIndex?:number,setIndex?:number,targets?:Record<string,number|{min:number,max:number}>,rir?:number|null,restSeconds?:number|null,status?:string,metricType?:string,provenance?:{source:string,policyVersion:string}}} DefinitionSet */
/** @typedef {{id:string,exerciseId:string,alternates?:string[],displayName?:string,order?:number,setupNotes?:string,manualAttribution?:{primary?:string,secondary?:string},prescriptionsByCycle?:{cycleIndex:number,sets:DefinitionSet[]}[]}} DefinitionSlot */
/** @typedef {{id:string,name:string,kind:string,order?:number,slots:DefinitionSlot[]}} DefinitionDay */
/** @typedef {{schemaVersion:number,generatorVersion:string,days:DefinitionDay[],cycles:number,deloadCycles?:number[],request?:unknown,provenance?:unknown}} ProgramDefinition */
/** @typedef {{customExercises?:LibraryEntry[],program?:ExerciseInput[],programMeta?:ProgramMeta}} ModelSnapshot */
/** @typedef {{preserveInvalid?:boolean,incompatibilities?:ProgressionIncompatibility[],source?:string}} CompatibilityOptions */
/** @typedef {{pastProgram?:ExerciseInput[]|null,previousMeta?:ProgramMeta|null,force?:boolean,recoveryRecord?:RecoveryRecord|null,freezeHistory?:boolean}} CompactionOptions */
export {};
