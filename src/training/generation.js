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
export const generateProgram=(...args)=>createCompiler().generateProgram(...args);
export const canonicalizeRequest=(...args)=>createCompiler().canonicalizeRequest(...args);
export const generationIdentity=(...args)=>createCompiler().generationIdentity(...args);
export const availableSplits=(...args)=>createCompiler().availableSplits(...args);
export const generatedDayNameKey=(...args)=>createCompiler().generatedDayNameKey(...args);
export const findSubstitutions=(...args)=>createCompiler().findSubstitutions(...args);
export const validateProgramDefinition=(...args)=>createCompiler().validateProgramDefinition(...args);
export const canonicalizeProgramDefinition=(...args)=>createCompiler().canonicalizeProgramDefinition(...args);
export const validateCustomExerciseDefinitions=(...args)=>createCompiler().validateCustomExerciseDefinitions(...args);
export const prescriptionsForCycle=(...args)=>createCompiler().prescriptionsForCycle(...args);
export const estimateDaySeconds=(...args)=>createCompiler().estimateDaySeconds(...args);
export const metricDefinitionForName=(...args)=>createCompiler().metricDefinitionForName(...args);
export const compiler=Object.freeze({GENERATOR_VERSION,PROGRAM_SCHEMA_VERSION,MAX_SLOT_ALTERNATES,ROLES,SPLITS,GOALS,EXPERIENCES,TIME_CEILINGS,PERIODIZATIONS,PRECONDITION_COMPETENCIES,METRIC_SEMANTICS,METRIC_SOURCE_IDS,generateProgram,canonicalizeRequest,generationIdentity,availableSplits,generatedDayNameKey,findSubstitutions,validateProgramDefinition,canonicalizeProgramDefinition,validateCustomExerciseDefinitions,prescriptionsForCycle,estimateDaySeconds,metricDefinitionForName});
