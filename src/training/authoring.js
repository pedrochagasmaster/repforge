/** Pure setup-draft rules and recommendation edits; mounting belongs to UI. */
export { createEntryRules } from "./authoring/internal/entry.js";
export { default as review } from "./authoring/internal/review.js";
export * from "./authoring/internal/review.js";
export { createInstalledEditorRules } from "./authoring/internal/installed.js";
export { default as suggestion } from "./authoring/internal/suggestion.js";

export { createEntryAdapter } from "./authoring/internal/adapter.js";

export {createEditorDocumentRules,PROGRAM_EDITOR_INTENTS} from './authoring/internal/editor-document.js';

/** Public values consumed across owner boundaries; runtime validators remain authoritative.
 * @typedef {import('./authoring/internal/editor-contracts.js').EditorDocument} EditorDocument
 * @typedef {import('./authoring/internal/editor-contracts.js').EditorDraft} EditorDraft
 * @typedef {import('./authoring/internal/editor-contracts.js').EditorMeta} EditorMeta
 * @typedef {import('./authoring/internal/editor-contracts.js').EditorRow} EditorRow
 * @typedef {import('./authoring/internal/editor-contracts.js').EditorSnapshot} EditorSnapshot
 * @typedef {import('./authoring/internal/editor-contracts.js').InstalledIntent} InstalledIntent
 * @typedef {import('./authoring/internal/editor-contracts.js').MetricDefinition} MetricDefinition
 * @typedef {import('./authoring/internal/review-contracts.js').ProgramDay} ProgramDay
 * @typedef {import('./authoring/internal/review-contracts.js').ProgramDefinition} ProgramDefinition
 * @typedef {import('./authoring/internal/review-contracts.js').ProgramSet} ProgramSet
 * @typedef {import('./authoring/internal/review-contracts.js').ProgramSlot} ProgramSlot
 * @typedef {import('./authoring/internal/review-contracts.js').ReviewContext} ReviewContext
 * @typedef {import('./authoring/internal/editor-contracts.js').SuggestionPolicy} SuggestionPolicy
 * @typedef {import('./authoring/internal/editor-contracts.js').Target} Target
 * @typedef {import('./authoring/internal/editor-contracts.js').TargetEdit} TargetEdit
 */
