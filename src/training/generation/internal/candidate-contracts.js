/** Source-catalog and controlled-profile contracts used by selection. The
 * compiler validates request/catalog identity before creating a selector. */
/** @typedef {`${'strength'|'hypertrophy'}${'Accessory'|'PrimaryCompound'|'SecondaryCompound'}RecommendationLevel`} TierField */
/** @typedef {import('../../model/internal/contracts.js').CatalogExercise & Partial<Record<TierField,number>> & {regionTrained?:string,primaryJointAction?:string[],exclusionGroupings?:string[],preconditions?:string[],resistanceEquipmentGroupIds?:string[],supportEquipmentGroupIds?:string[],exerciseClassificationStrength?:string[],exerciseClassificationHypertrophy?:string[],emphasizedAgonist?:string[],deemphasizedAgonist?:string[]}} CandidateSource */
/** @typedef {{id:string,name:string,type?:string,category?:string,equipment?:string[],pluralOf?:string}} CatalogEntity */
/** @typedef {{exercises:CandidateSource[],uuidIndex:Record<string,CatalogEntity>}} CandidateCatalog */
/** @typedef {{goal:string,experience:string,gymProfile:{equipmentIds:string[],equipmentConfigById?:Record<string,unknown>,useBumperPlatesInPlateCalculator?:boolean,equipmentLoadsKg?:Record<string,number[]>},history?:unknown,emphasisMuscleIds?:string[],deprioritizedMuscleIds?:string[],competencyAnswers?:Record<string,boolean|null>,movementConfirmations?:Record<string,string[]>,preferredExerciseIds?:string[]}} CandidateRequest */
/** @typedef {{id:string,raw:CandidateSource,patterns:string[],patternMuscles:readonly (string|null)[],region:string|null,effectiveRegion:string|null,exerciseType:string|null,primaryJointActions:string[],exclusionGroupings:string[]}} DescribedExercise */
/** @typedef {{type:string,accessoryMuscle?:string|null,exercise:DescribedExercise}} SelectedTemplate */
/** @typedef {{type:string,muscle?:string,pattern?:string,isFirstOfType?:boolean}} TemplateSpec */
export {};
