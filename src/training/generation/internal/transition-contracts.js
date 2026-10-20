/** Replacement protocol DTOs. Weak capabilities stay private to one explicit
 * rules lifetime; serialized lookalikes never confer commit authority. */
/** @typedef {import('./compiler-contracts.js').ProgramDefinition} ProgramDefinition */
/** @typedef {import('./compiler-contracts.js').SourceCatalog} SourceCatalog */
/** @typedef {import('../../model/internal/contracts.js').LibraryEntry} CustomDefinition */
/** @typedef {{kind:'fewer_days',daysPerWeek:number}|{kind:'shorter_sessions',sessionMinutes:number}|{kind:'reduce_volume'}|{kind:'recovery_week'}} Change */
/** @typedef {{programDefinition:ProgramDefinition,customExerciseDefinitions:CustomDefinition[]}} DefinitionSnapshot */
/** @typedef {{programId:string,durableRevision:number,definitionFingerprint:string}} PredecessorIdentity */
/** @typedef {{programId:string,definitionFingerprint:string}} SuccessorIdentity */
/** @typedef {{schemaVersion:number,kind:string,status:string,transitionId:string,createdAt:string,predecessor:PredecessorIdentity,successor:SuccessorIdentity & DefinitionSnapshot,change?:Change,proposalHash:string}} Proposal */
/** @typedef {{schemaVersion:number,kind:string,status:string,transitionId:string,proposalHash:string,confirmedAt:string,archiveId:string,predecessor:PredecessorIdentity,successor:SuccessorIdentity}} CommittedRecord */
/** @typedef {{transitionId:string,createdAt:string,predecessor:DefinitionSnapshot & {programId:string,durableRevision:number},successor:DefinitionSnapshot & {programId:string}}} ReplacementInput */
/** @template T @typedef {{ok:true,value:T}|{ok:false,code:string}} Validation */
/** @typedef {{ok:false,status:'unavailable',code:string,conflicts?:import('./compiler-contracts.js').Conflict[]}} Unavailable */
/** @typedef {{cycleIndex:number,fields:(CarryField|"sets")[],changed:CarryField[][],generated:number}} CycleEdit */
/** @typedef {{exerciseId:string,predecessorSlotId:string,successorSlotId:string|null,outcome:string,reason:string|null,cycles:{cycleIndex:number,fields:string[],requestedSets:number,sets:number|null}[]}} CarryReportEntry */
/** @typedef {{identified:boolean,entries:CarryReportEntry[]}} CarryReport */
/** @typedef {{source:import('./compiler-contracts.js').ProgramSlot,target:import('./compiler-contracts.js').ProgramSlot|null|undefined,edits:CycleEdit[],fresh:import('./compiler-contracts.js').ProgramSlot|null|undefined,outcome:string,reason:string|null}} CarryState */
/** @typedef {'targets'|'rir'|'restSeconds'} CarryField */
/** @typedef {{ok:false,status:'invalid'|'stale',code:string}} InvalidResult */
/** @typedef {{ok:true,value:ProgramDefinition,carry?:CarryReport}|Unavailable} DefinitionDerivation */
/** @typedef {{ok:true,value:{programDefinition:ProgramDefinition,customExerciseDefinitions:CustomDefinition[],change:Change,carry?:CarryReport}}|Unavailable|InvalidResult} DeriveResult */
/** @typedef {Omit<Proposal,'proposalHash'> & {proposalHash?:string}} ProposalDraft */
export {};
