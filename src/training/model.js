export {foldExerciseName} from './model/internal/names.js';
/** Program and exercise canonicalization, immutable identity and receipt policy. */
export { createProgramModel } from "./model/internal/program.js";
export { cloneSnapshot,isPlainStateObject,isBoundedProgressionValue,canonicalize,PROGRESSION_VALUE_LIMITS } from "./model/internal/values.js";

/** Public values consumed across owner boundaries; runtime validators remain authoritative.
 * @typedef {import('./model/internal/contracts.js').ExerciseInput} ExerciseInput
 * @typedef {import('./model/internal/contracts.js').ExerciseRow} ExerciseRow
 * @typedef {import('./model/internal/contracts.js').LibraryEntry} LibraryEntry
 * @typedef {import('./model/internal/contracts.js').ModelSnapshot} ModelSnapshot
 * @typedef {import('./model/internal/contracts.js').ProgramMeta} ProgramMeta
 * @typedef {import('./model/internal/contracts.js').RecoveryRecord} RecoveryRecord
 * @typedef {import('./model/internal/contracts.js').StructureDay} StructureDay
 */
