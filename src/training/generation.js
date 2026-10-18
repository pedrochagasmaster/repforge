/** Deterministic generation plus one explicit app/worker authority lifetime. */
import { createCompiler } from "./generation/internal/compiler.js";
import { createTransitionRules } from "./generation/internal/transition.js";
import { createIdentityRules } from "./identity.js";
const compiler=createCompiler();
export { compiler, createTransitionRules };
export function createGenerationRules() {
  const identity=createIdentityRules();
  const compiler=createCompiler(identity);
  const transition=createTransitionRules(compiler);
  return Object.freeze({identity,compiler,transition});
}
export const {GENERATOR_VERSION,PROGRAM_SCHEMA_VERSION,MAX_SLOT_ALTERNATES,ROLES,SPLITS,GOALS,EXPERIENCES,TIME_CEILINGS,PERIODIZATIONS,PRECONDITION_COMPETENCIES,METRIC_SEMANTICS,METRIC_SOURCE_IDS,generateProgram,canonicalizeRequest,generationIdentity,availableSplits,generatedDayNameKey,findSubstitutions,validateProgramDefinition,canonicalizeProgramDefinition,validateCustomExerciseDefinitions,prescriptionsForCycle,estimateDaySeconds,metricDefinitionForName}=compiler;
