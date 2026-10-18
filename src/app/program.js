import {copySnapshot} from './session.js';
import {canonicalize, draftProgramFingerprint, snapshotBlockId, readRevision} from '../persistence/snapshot.js';

/** @typedef {import('./session.js').Snapshot} Snapshot
 * @typedef {import('./session.js').ProgramRow} ProgramRow
 * @typedef {import('./session.js').ProgramMeta} ProgramMeta
 * @typedef {import('./session.js').ProgramHistory} ProgramHistory
 * @typedef {import('./session.js').CustomExercise} CustomExercise
 * @typedef {import('./session.js').DraftEffect} DraftEffect
 * @typedef {import('./session.js').Commit} Commit
 * @typedef {import('./session.js').CommitResult} CommitResult
 * @typedef {{programId:string|null,blockId:string|null,[key:string]:unknown}} EditorToken
 * @typedef {Pick<Snapshot,'program'|'programMeta'|'customExercises'> & Record<string,unknown>} EditorDocument
 * @typedef {{kind:string,before?:unknown,after?:unknown,[key:string]:unknown}} EditorIntent
 * @typedef {{active:boolean,incompatible:boolean,effect?:DraftEffect|null,[key:string]:unknown}} EditorImpact
 * @typedef {{token:(snapshot:Snapshot)=>EditorToken,tokenEqual:(a:EditorToken|undefined,b:EditorToken)=>boolean,rebaseDocument:(session:{edits:EditorIntent[]},head:Snapshot)=>({conflict:true,code?:string}|{conflict?:false,document:EditorDocument}),confirmOptIn:(document:EditorDocument)=>({ok:true,document:EditorDocument}|{ok:false,issues:unknown[]}),impact:(document:EditorDocument,head:Snapshot,edits:EditorIntent[])=>EditorImpact,snapshotFromDocument:(document:EditorDocument,head:Snapshot)=>Snapshot}} Authoring
 * @typedef {{readRaw:()=>string|null,clearEffect:(raw:string|null)=>DraftEffect|null,dayReplacementEffect:(before:string,after:string,proposal:Snapshot)=>DraftEffect|null}} ProgramDrafts
 * @typedef {{oldProgramId?:string,oldBlockId?:string|null,oldProgram?:ProgramRow[],oldMeta?:ProgramMeta|null,storageRevision?:number,programFingerprint?:string,review?:unknown,transitionOut?:unknown,archiveId?:string}} ReplacementCapture
 * @typedef {import('./session.js').CommitOptions & {capture?:ReplacementCapture|null,replace?:boolean,expectedFirstRunEmpty?:boolean,expectedSetupDraftRaw?:string|null,expectedProgramId?:string|null,expectedProgramFingerprint?:string,expectedBlockId?:string|null,expectedStorageRevision?:number,io?:unknown}} ReplacementOptions
 */

/** Installed editor Apply owns refreshing, lock-held canonical intent rebase,
 * pending Suggest loads confirmation and exact draft impact. The authoring owner
 * supplies canonical algorithms; the view supplies already-captured speculative
 * document/intents, including any focused name field. No rendering or telemetry.
 *
 * read/refreshHead/commit are the root's durable owner capabilities. authoring:
 * token, tokenEqual, rebaseDocument, confirmOptIn, impact, snapshotFromDocument.
 * drafts: readRaw, clearEffect, dayReplacementEffect.
 * @param {{read:()=>Snapshot,refreshHead:()=>Promise<{conflict?:boolean,head?:Snapshot}>,commit:Commit,authoring:Authoring,drafts:ProgramDrafts}} options */
export function createProgramCommands({read, refreshHead, commit, authoring, drafts}) {
  /** @param {{expectedToken?:EditorToken,nextDocument:EditorDocument,edits?:EditorIntent[],discardWorkout?:boolean}} request */
  async function applyEdits({expectedToken, nextDocument, edits = [], discardWorkout = false}) {
    const capturedEdits = copySnapshot(edits), capturedToken = copySnapshot(expectedToken);
    const capturedDocument = copySnapshot(nextDocument);
    const refreshed = await refreshHead();
    if (refreshed.conflict) return {ok: false, conflict: true, editorConflict: true};
    const head = refreshed.head || read(), headToken = authoring.token(head);
    if (capturedToken?.blockId !== headToken.blockId) return staleBlock();
    let document = capturedDocument;
    if (!authoring.tokenEqual(capturedToken, headToken)) {
      const rebased = authoring.rebaseDocument({edits: capturedEdits}, head);
      if (rebased.conflict) return editorConflict(rebased.code);
      document = rebased.document;
    }
    const optIn = authoring.confirmOptIn(document);
    if (!optIn.ok) return invalidOptIn(optIn);
    document = optIn.document;
    const impact = authoring.impact(document, head, capturedEdits);
    if (impact.active && impact.incompatible && !discardWorkout) return {ok: false, workoutConflict: true, impact};
    const proposal = authoring.snapshotFromDocument(document, head);
    const rename = capturedEdits.find(edit => edit?.kind === 'day_name' && edit.before !== undefined && edit.after !== undefined);
    const renameEffect = rename ? drafts.dayReplacementEffect(String(rename.before), String(rename.after), proposal) : null;
    const raw = drafts.readRaw();
    const effect = impact.active && impact.incompatible || discardWorkout && raw != null
      ? drafts.clearEffect(raw) : impact.effect || renameEffect;
    const dayRenames = capturedEdits.filter(edit => edit?.kind === 'day_name' && edit.before !== undefined && edit.after !== undefined)
      .map(edit => ({from: String(edit.before), to: String(edit.after)}));
    const result = await commit(proposal, {effect, dayRenames,
      expectedProgramId: headToken.programId, expectedBlockId: headToken.blockId,
      preflight: ({head: lockedHead}) => {
        const lockedToken = authoring.token(lockedHead);
        if (headToken.blockId !== lockedToken.blockId) return {reject: true, result: staleBlock()};
        if (!authoring.tokenEqual(headToken, lockedToken)) {
          const rebased = authoring.rebaseDocument({edits: capturedEdits}, lockedHead);
          if (rebased.conflict) return {reject: true, result: editorConflict(rebased.code)};
          const lockedOptIn = authoring.confirmOptIn(rebased.document);
          if (!lockedOptIn.ok) return {reject: true, result: invalidOptIn(lockedOptIn)};
          document = lockedOptIn.document;
        }
        const lockedImpact = authoring.impact(document, lockedHead, capturedEdits);
        if (lockedImpact.active && lockedImpact.incompatible && !discardWorkout)
          return {reject: true, result: {ok: false, workoutConflict: true, impact: lockedImpact}};
        // A draft created while waiting cannot be consumed by a rename that had
        // no captured draft receipt. Retain the production abort-same-day guard.
        if (!discardWorkout && abortsSameDay(lockedImpact.effect) && !abortsSameDay(effect))
          return {reject: true, result: {ok: false, draftConflict: true, impact: lockedImpact}};
        return {proposal: authoring.snapshotFromDocument(document, lockedHead)};
      }});
    if (result.committed === true && result.settled === true)
      return {...result, ok: true, document, token: authoring.token(read()),
        discardedWorkout: effect?.status === 'valid' && effect.effect?.kind === 'clear-draft'};
    return {...result, ok: false, conflict: !!(result.conflict || result.staleRevision)};
  }
  return Object.freeze({applyEdits});
}
function staleBlock() { return {ok: false, conflict: true, editorConflict: true, staleBlock: true}; }
/** @param {string|undefined} code */
function editorConflict(code) { return {ok: false, conflict: true, editorConflict: true, code}; }
/** @param {{issues?:unknown[]}} result */
function invalidOptIn(result) { return {ok: false, invalid: true, suggestLoads: result.issues?.[0] || null}; }
/** @param {DraftEffect|null|undefined} effect */
function abortsSameDay(effect) { return effect?.status === 'valid' && effect.effect?.precondition === 'abort-same-day'; }

/** Custom-definition CAS and archive policy. The canonical model instance owns
 * normalization/identity; this application owner owns lock-held mutation intent.
 * Policy methods also serve explicit Undo/retry commands during extraction.
 * @param {{read:()=>Snapshot,commit:Commit,model:{normalizeCustomExercises:(entries:unknown[])=>CustomExercise[],isCustomLibraryId:(id:unknown)=>boolean,definitionMovementIds:(definition:unknown)=>string[]},normalizeMuscleAttribution:(value:unknown)=>{ok:boolean,value?:unknown},now:()=>string,newId:()=>string,invalidMuscleCommit:()=>CommitResult}} options */
export function createCustomExerciseCommands({read, commit, model, normalizeMuscleAttribution,
  now, newId, invalidMuscleCommit}) {
  const {normalizeCustomExercises, isCustomLibraryId, definitionMovementIds} = model;
  /** @param {Snapshot} snapshot */
  const entries = snapshot => Array.isArray(snapshot?.customExercises) ? snapshot.customExercises : [];
  /** @param {CustomExercise|null|undefined} a @param {CustomExercise|null|undefined} b */
  function stateEqual(a, b) {
    /** @param {CustomExercise|null|undefined} entry */
    const comparable = entry => {
      const normalized = normalizeCustomExercises([entry])[0];
      if (!normalized) return null;
      const value = copySnapshot(normalized);
      // Synthesized legacy creation timestamps are immutable provenance, not CAS.
      delete value.created;
      return value;
    };
    const left = comparable(a), right = comparable(b);
    return !!left && !!right && JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
  }
  /** @param {Snapshot} snapshot @param {CustomExercise} entry */
  function upsert(snapshot, entry) {
    const next = copySnapshot(snapshot), list = entries(next);
    next.customExercises = normalizeCustomExercises(list.some(value => value.id === entry.id)
      ? list.map(value => value.id === entry.id ? entry : value) : list.concat(entry));
    return next;
  }
  /** @param {Snapshot} snapshot @param {string} id @param {string} operation */
  function removeOrArchive(snapshot, id, operation) {
    const next = copySnapshot(snapshot), list = entries(next);
    next.customExercises = operation === 'archive'
      ? list.map(value => value.id === id ? {...copySnapshot(value), archived: true} : value)
      : list.filter(value => value.id !== id);
    return next;
  }
  /** @param {string} id @param {Snapshot} [snapshot] */
  function inUse(id, snapshot = read()) {
    if ((snapshot?.program || []).some(entry => entry.libraryId === id)) return true;
    if (definitionMovementIds(snapshot?.programMeta?.programDefinition).includes(id)) return true;
    if ((snapshot?.log || []).some(row => row.performedLibraryId === id || row.performedMovementId === `library:${id}`)) return true;
    return (snapshot?.programHistory || []).some(entry => (entry?.program || []).some(row => row.libraryId === id));
  }
  /** @param {Record<string,unknown>} draft @param {{expectedEntry?:CustomExercise|null,io?:unknown}} [options] */
  async function save(draft, {expectedEntry = null, io} = {}) {
    const name = String(draft?.name ?? '').trim();
    if (!name) return {result: null, entry: null};
    const id = isCustomLibraryId(draft?.id) ? String(draft.id) : newId();
    const primary = normalizeMuscleAttribution(draft?.primary ?? ''), secondary = normalizeMuscleAttribution(draft?.secondary ?? '');
    if (!primary?.ok || !secondary?.ok) return {result: invalidMuscleCommit(), entry: null};
    const snapshot = read(), existing = entries(snapshot).find(entry => entry.id === id);
    const configuration = Array.isArray(draft?.metricIds) ? draft : Array.isArray(existing?.metricIds) ? existing : null;
    const entry = normalizeCustomExercises([{id, name, namePt: name,
      equipment: Array.isArray(draft.equipment) && draft.equipment.length ? draft.equipment : ['machine'],
      primary: primary.value, secondary: secondary.value, notes: String(draft.notes ?? '').trim(),
      ...(configuration ? {metricIds: copySnapshot(configuration.metricIds),
        ...(Array.isArray(configuration.metricDefinitions) ? {metricDefinitions: copySnapshot(configuration.metricDefinitions)} : {})} : {}),
      created: existing?.created || now()}])[0];
    if (!entry) return {result: {invalid: true, code: 'invalid-custom-exercise'}, entry: null};
    const source = existing ? copySnapshot(expectedEntry || existing) : null;
    /** @param {{head:Snapshot}} context @returns {import('./session.js').PreflightResult} */
    const preflight = ({head}) => {
      const current = entries(head).find(value => value.id === id) || null;
      if (source && !stateEqual(current, source)) return {reject: true, result: {conflict: true, stale: true, code: 'custom-exercise-changed'}};
      if (!source && current) return {reject: true, result: {conflict: true, duplicate: true, code: 'custom-id-collision'}};
      return {proposal: upsert(head, entry)};
    };
    return {result: await commit(upsert(snapshot, entry), {preflight}, io), entry};
  }
  /** @param {string} id @param {{action?:string|null,expectedEntry?:CustomExercise|null,io?:unknown}} [options] */
  async function remove(id, {action = null, expectedEntry = null, io} = {}) {
    if (!isCustomLibraryId(id)) return null;
    const snapshot = read(), existing = entries(snapshot).find(entry => entry.id === id) || null;
    if (!existing) return null;
    const source = copySnapshot(expectedEntry || existing), operation = action || (inUse(id, snapshot) ? 'archive' : 'delete');
    if (operation !== 'delete' && operation !== 'archive') return null;
    /** @param {{head:Snapshot}} context @returns {import('./session.js').PreflightResult} */
    const preflight = ({head}) => {
      const current = entries(head).find(value => value.id === id) || null;
      if (!stateEqual(current, source)) return {reject: true, result: {conflict: true, stale: true, code: 'custom-exercise-changed'}};
      if (operation === 'delete' && inUse(id, head)) return {reject: true, result: {conflict: true, code: 'custom-exercise-became-used'}};
      return {proposal: removeOrArchive(head, id, operation)};
    };
    const result = await commit(removeOrArchive(snapshot, id, operation), {preflight,
      customMutationIntent: operation === 'delete' ? {version: 1, operation: 'delete', id, entry: source} : null}, io);
    return result ? {...result, archived: operation === 'archive', operation} : result;
  }
  return Object.freeze({save, remove, inUse, stateEqual, upsert, removeOrArchive});
}

/** Program activation/replacement commit. The reviewed setup/transition owner
 * supplies a validated proposal and exact capture. This owner archives the
 * captured predecessor once and preserves all lock/draft/setup preconditions.
 * @param {{read:()=>Snapshot,commit:Commit,capture:(snapshot:Snapshot)=>ReplacementCapture|null,allocateBlockId:()=>string,now:()=>string}} options */
export function createProgramReplacementCommands({read, commit, capture, allocateBlockId, now}) {
  /** @param {Snapshot} proposal @param {ReplacementCapture|null} captured */
  function archiveCapturedProgram(proposal, captured) {
    if (!captured?.oldProgramId) return proposal;
    if (!captured.oldMeta || typeof captured.oldMeta !== 'object' || Array.isArray(captured.oldMeta) || !Array.isArray(captured.oldProgram))
      throw new TypeError('program replacement capture must be materialized before archive');
    const history = Array.isArray(proposal.programHistory) ? proposal.programHistory : [];
    if (history.some(entry => entry.id === captured.oldProgramId)) { proposal.programHistory = history; return proposal; }
    /** @type {ProgramHistory} */
    const entry = {id: captured.oldProgramId, meta: copySnapshot(captured.oldMeta), program: copySnapshot(captured.oldProgram),
      completedAt: now(), review: copySnapshot(captured.review)};
    if (captured.transitionOut) entry.transitionOut = copySnapshot(captured.transitionOut);
    if (captured.archiveId) entry.archiveId = captured.archiveId;
    history.push(entry); proposal.programHistory = history;
    return proposal;
  }
  /** @param {Snapshot} proposal @param {ReplacementOptions} [options] */
  async function replace(proposal, options = {}) {
    const snapshot = read(), captured = options.capture === undefined ? capture(snapshot) : options.capture;
    const {effect = null, expectedSetupDraftRaw, replace = false, expectedFirstRunEmpty = false, preflight = null,
      expectedProgramId, expectedProgramFingerprint, expectedBlockId, expectedStorageRevision, io} = options;
    const next = copySnapshot(proposal), predecessorId = captured?.oldProgramId ?? snapshot?.programMeta?.id;
    if (next?.programMeta && next.programMeta.id !== predecessorId && !Object.prototype.hasOwnProperty.call(next.programMeta, 'blockId'))
      next.programMeta.blockId = allocateBlockId();
    if (captured) archiveCapturedProgram(next, captured);
    const transition = replace && expectedFirstRunEmpty
      ? {expectedProgramId: snapshot?.programMeta?.id || null, expectedProgramFingerprint: draftProgramFingerprint(snapshot), expectedBlockId: snapshotBlockId(snapshot)}
      : captured
        ? {expectedProgramId: captured.oldProgramId, expectedProgramFingerprint: captured.programFingerprint,
          expectedBlockId: captured.oldBlockId, expectedStorageRevision: captured.storageRevision}
        : {expectedProgramId: expectedProgramId !== undefined ? expectedProgramId : snapshot?.programMeta?.id || null,
          expectedProgramFingerprint: expectedProgramFingerprint !== undefined ? expectedProgramFingerprint : draftProgramFingerprint(snapshot),
          expectedBlockId: expectedBlockId !== undefined ? expectedBlockId : snapshotBlockId(snapshot),
          expectedStorageRevision: expectedStorageRevision !== undefined ? expectedStorageRevision : readRevision(snapshot)};
    return commit(next, {...transition, effect, expectedSetupDraftRaw, replace, expectedFirstRunEmpty, preflight}, io);
  }
  return Object.freeze({commit: replace, archiveCapturedProgram});
}
