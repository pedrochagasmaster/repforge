/** Deterministic generation plus one explicit app/worker authority lifetime. */
import { createCompiler, GENERATOR_VERSION,PROGRAM_SCHEMA_VERSION,MAX_SLOT_ALTERNATES,ROLES,SPLITS,GOALS,EXPERIENCES,TIME_CEILINGS,PERIODIZATIONS,PRECONDITION_COMPETENCIES,METRIC_SEMANTICS,METRIC_SOURCE_IDS } from "./generation/internal/compiler.js";
import { createTransitionRules } from "./generation/internal/transition.js";
import { createIdentityRules } from "./identity.js";
export { createTransitionRules, GENERATOR_VERSION,PROGRAM_SCHEMA_VERSION,MAX_SLOT_ALTERNATES,ROLES,SPLITS,GOALS,EXPERIENCES,TIME_CEILINGS,PERIODIZATIONS,PRECONDITION_COMPETENCIES,METRIC_SEMANTICS,METRIC_SOURCE_IDS };
export function createGenerationRules() {
  const identity=createIdentityRules();
  const compiler=createCompiler(identity);
  const transition=createTransitionRules(compiler);
  return Object.freeze({identity,compiler,transition});
}
import { getDefaultEnginePolicy, normalizeEnginePolicy, getEnginePolicyMetadata } from "./generation/internal/policy.js";
export { getDefaultEnginePolicy, normalizeEnginePolicy, getEnginePolicyMetadata };
/** @type {ReturnType<typeof createCompiler>["validateProgramDefinitionStructure"]} */
export const validateProgramDefinitionStructure=(...args)=>createCompiler().validateProgramDefinitionStructure(...args);
/** @type {ReturnType<typeof createCompiler>["generateProgram"]} */
export const generateProgram=(...args)=>createCompiler().generateProgram(...args);
/** @type {ReturnType<typeof createCompiler>["canonicalizeRequest"]} */
export const canonicalizeRequest=(...args)=>createCompiler().canonicalizeRequest(...args);
/** @type {ReturnType<typeof createCompiler>["generationIdentity"]} */
export const generationIdentity=(...args)=>createCompiler().generationIdentity(...args);
/** @type {ReturnType<typeof createCompiler>["availableSplits"]} */
export const availableSplits=(...args)=>createCompiler().availableSplits(...args);
/** @type {ReturnType<typeof createCompiler>["generatedDayNameKey"]} */
export const generatedDayNameKey=(...args)=>createCompiler().generatedDayNameKey(...args);
/** @type {ReturnType<typeof createCompiler>["findSubstitutions"]} */
export const findSubstitutions=(...args)=>createCompiler().findSubstitutions(...args);
/** @type {ReturnType<typeof createCompiler>["validateProgramDefinition"]} */
export const validateProgramDefinition=(...args)=>createCompiler().validateProgramDefinition(...args);
/** @type {ReturnType<typeof createCompiler>["canonicalizeProgramDefinition"]} */
export const canonicalizeProgramDefinition=(...args)=>createCompiler().canonicalizeProgramDefinition(...args);
/** @type {ReturnType<typeof createCompiler>["validateCustomExerciseDefinitions"]} */
export const validateCustomExerciseDefinitions=(...args)=>createCompiler().validateCustomExerciseDefinitions(...args);
/** @type {ReturnType<typeof createCompiler>["prescriptionsForCycle"]} */
export const prescriptionsForCycle=(...args)=>createCompiler().prescriptionsForCycle(...args);
/** @type {ReturnType<typeof createCompiler>["estimateDaySeconds"]} */
export const estimateDaySeconds=(...args)=>createCompiler().estimateDaySeconds(...args);
/** @type {ReturnType<typeof createCompiler>["metricDefinitionForName"]} */
export const metricDefinitionForName=(...args)=>createCompiler().metricDefinitionForName(...args);
export const compiler=Object.freeze({GENERATOR_VERSION,PROGRAM_SCHEMA_VERSION,MAX_SLOT_ALTERNATES,ROLES,SPLITS,GOALS,EXPERIENCES,TIME_CEILINGS,PERIODIZATIONS,PRECONDITION_COMPETENCIES,METRIC_SEMANTICS,METRIC_SOURCE_IDS,generateProgram,canonicalizeRequest,generationIdentity,availableSplits,generatedDayNameKey,findSubstitutions,validateProgramDefinition,canonicalizeProgramDefinition,validateCustomExerciseDefinitions,prescriptionsForCycle,estimateDaySeconds,metricDefinitionForName,validateProgramDefinitionStructure,getDefaultEnginePolicy,normalizeEnginePolicy,getEnginePolicyMetadata});
