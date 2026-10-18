/** Pure setup-draft rules and recommendation edits; mounting belongs to UI. */
export { createEntryRules } from "./authoring/internal/entry.js";
export { default as review } from "./authoring/internal/review.js";
export * from "./authoring/internal/review.js";
export { createInstalledEditorRules } from "./authoring/internal/installed.js";
export { default as suggestion } from "./authoring/internal/suggestion.js";

export { createEntryAdapter } from "./authoring/internal/adapter.js";

export {createEditorDocumentRules,PROGRAM_EDITOR_INTENTS} from './authoring/internal/editor-document.js';
