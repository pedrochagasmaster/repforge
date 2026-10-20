/** DraftV2 values after workout.validate. Raw persisted/imported values remain
 * unknown; these records are the released aggregate consumed by reducers. */
export type JsonRecord=Record<string,unknown>;
export type MetricDefinition=import('./metrics.js').MetricDefinition;
export interface DomainError extends JsonRecord {kind:'domain-error';code:string}
export interface MigrationError extends JsonRecord {kind:'migration-error';code:string}
export type Validation={ok:true;issues?:never}|{ok:false;issues:string[]};
export interface Writer extends JsonRecord {installationId:string;tabId:string;operationId:string}
export interface Movement extends JsonRecord {exerciseInstanceId:string;sourceExerciseId:string;displayName:string;primary:string;secondary:string;libraryId?:string|null;movementId?:string|null}
export interface LoadingModel extends JsonRecord {bodyweightCoefficient?:number|null;assistanceDirection?:'subtract'|null}
export interface LoadingContext extends JsonRecord {bodyweightKg?:number|null;bodyweightContributionEnabled?:boolean|null;externalLoadMultiplier?:number|null;bodyweightCoefficient?:number|null;availableLoadsKg?:number[];loadingConvention?:string;executionMode?:string}
export interface ProgrammedSet extends JsonRecord {
  suggestedLoad?:number|null;minReps?:number|null;maxReps?:number|null;targetRir?:number|null;
  metricType?:string;metricIds?:string[];metrics?:MetricDefinition[];targets?:Record<string,unknown>;restSeconds?:number|null;
  sourceLibraryId?:string;metricOrigin?:string;loadingModel?:LoadingModel;loadingConvention?:string;loadingContext?:LoadingContext;equipmentId?:string|null;
}
export interface Edited extends Record<string,unknown> {load?:string|null;reps?:string|null;rir?:string|null;effort?:string|null;metrics?:Record<string,string|null>}
export interface Touched extends Record<string,unknown> {load:boolean;reps:boolean;effort:boolean;metrics?:Record<string,boolean>}
export interface DraftSet extends JsonRecord {setId:string;ordinal:number;role:string;programmed:ProgrammedSet;edited:Edited;touched:Touched;completion:'pending'|{completedAt:string};performed?:Movement}
export interface ProgrammedExercise extends ProgrammedSet {order:number;sets:number;notes:string;primary:string;secondary:string;sourceFingerprint:string;libraryId?:string|null;movementId?:string|null;progressionStrategy?:string|null;movementPattern?:string|null}
export interface Substitution {original:Movement;replacement:Movement;selectedAt:string;originalPendingSets?:Record<string,DraftSet>}
export interface DraftExercise extends JsonRecord {exerciseInstanceId:string;sourceExerciseId:string;libraryId?:string|null;displayName:string;programmed:ProgrammedExercise;substitution:Substitution|null;status:string;setupNotes:string;setOrder:string[];sets:Record<string,DraftSet>}
export interface DraftProgram extends JsonRecord {programId:string;programFingerprint:string;durableRevision:number;dayId:string;dayLabel:string;scheduleDate:string;unit:string;rirMode:string;blockId?:string}
export interface ContextTouched extends Record<string,boolean> {day:boolean;date:boolean;sessionNotes:boolean;bodyweight:boolean}
export interface DraftSession extends JsonRecord {startedAt:string;updatedAt:string;bodyweight:string|null;notes:string;selectedExerciseId:string|null;status:string;contextTouched:ContextTouched}
export interface Draft extends JsonRecord {schemaVersion:number;draftId:string;revision:number;writer:Writer;program:DraftProgram;session:DraftSession;exerciseOrder:string[];exercises:Record<string,DraftExercise>}
export interface SaveIssue extends JsonRecord {code:string;field?:string;exerciseInstanceId?:string;setId?:string;metric?:string;issues?:string[]}
export interface CommandBase extends JsonRecord {type:string;operationId:string;expectedRevision:number;updatedAt:string}
export interface ReplacementSpec extends JsonRecord {suggestedLoad:number|null;suggestedReps:number|null;targetRir:number|null;minReps:number|null;maxReps:number|null;restSeconds:number|null;metricDefinitions:MetricDefinition[];targets:Record<string,unknown>;previousMetrics:{metricId:string,value:unknown}[]}
export interface ReplacementProgram extends JsonRecord {sourceLibraryId:string;metricOrigin:string;metricIds:string[];metricDefinitions:MetricDefinition[];loadingModel:LoadingModel;loadingConvention:string;loadingContext:LoadingContext;equipmentId:string|null;programmedSets:ReplacementSpec[]}
export type ParsedDraft={kind:'absent'}|{kind:'legacy';raw:unknown}|{kind:'invalid';code:string;issues?:string[]}|
  {kind:'stale';reason:string;draft:Draft}|{kind:'valid';draft:Draft};
