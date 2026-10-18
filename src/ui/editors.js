/** Shared document editors: feature controllers consume this public UI surface. */
export {createProgramEditor} from "./editors/program.js";
export {createProgramReview} from './editors/review.js';

/** @typedef {import('./editors/contracts.js').EditorRow} EditorRow
 * @typedef {import('./editors/contracts.js').PickRequest} PickRequest
 * @typedef {import('./editors/contracts.js').EditorReceipt} EditorReceipt */
