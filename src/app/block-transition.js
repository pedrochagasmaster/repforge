import {copySnapshot} from './session.js';
import {readRevision} from '../persistence/snapshot.js';
import {isPlainStateObject} from '../training/model.js';
/** @typedef {import('./session.js').Snapshot} Snapshot
 * @typedef {ReturnType<typeof import('../training/generation.js').createGenerationRules>['transition']} Transition
 * @typedef {ReturnType<typeof import('../training/model.js').createProgramModel>} Model
 * @typedef {ReturnType<typeof import('./program.js').createProgramReplacementCommands>} Replacement
 * @typedef {import('./program.js').ReplacementCapture} ReplacementCapture
 * @typedef {import('./session.js').DraftEffect} DraftEffect
 * @typedef {Transition['deriveSuccessor']|((input:unknown)=>Promise<ReturnType<Transition['deriveSuccessor']>>)} Derive
 * @typedef {{change?:unknown,transitionId?:string,createdAt?:string,successorProgramId?:string}} ProposeInput
 * @typedef {{proposal?:unknown,proposalHash?:unknown,transitionId?:unknown,successorProgramId?:unknown,confirmedAt?:unknown,acknowledgedDraftRaw?:unknown}} ConfirmInput
 */
/** @param {unknown} value @returns {Record<string,unknown>} */
const record=value=>isPlainStateObject(value)?value:{};
/** Exact persisted transition-in/archive agreement; partial records never count
 * as committed. @param {Snapshot} snapshot @param {Record<string,unknown>} proposal @param {unknown} archiveId @returns {'match'|'absent'|'conflict'} */
export function classifyCommittedTransition(snapshot, proposal, archiveId) {
  const successor=record(proposal.successor),predecessor=record(proposal.predecessor);
  const succId = successor.programId;
  const predId = predecessor.programId;
  const transId = proposal?.transitionId;
  const propHash = proposal?.proposalHash;
  if (typeof succId !== "string" || !succId.trim() ||
      typeof predId !== "string" || !predId.trim() ||
      typeof transId !== "string" || !transId.trim() ||
      typeof propHash !== "string" || !propHash.trim() ||
      typeof archiveId !== "string" || !archiveId.trim() ||
      archiveId !== predId) {
    return "conflict";
  }

  const activeId = snapshot?.programMeta?.id;
  const history = Array.isArray(snapshot?.programHistory) ? snapshot.programHistory : [];
  const occupants = history.filter(h => h && (h.id === archiveId || h.archiveId === archiveId));

  if (activeId === succId) {
    const tin = snapshot?.programMeta?.transitionIn;
    if (!isPlainStateObject(tin)) return "conflict";
    const agree =
      tin.status === "committed" &&
      tin.transitionId === transId &&
      tin.proposalHash === propHash &&
      tin.archiveId === archiveId &&
      record(tin.successor).programId === succId &&
      record(tin.predecessor).programId === predId;
    if (!agree) return "conflict";
    if (occupants.length !== 1) return "conflict";
    const link = occupants[0];
    const exact =
      link.id === archiveId &&
      link.archiveId === archiveId &&
      record(link.transitionOut).transitionId === transId &&
      record(link.transitionOut).proposalHash === propHash &&
      record(link.transitionOut).successorProgramId === succId;
    return exact ? "match" : "conflict";
  }

  if (activeId === predId) {
    if (record(snapshot?.programMeta?.transitionIn).transitionId === transId) return "conflict";
    if (history.some(h => record(h?.transitionOut).transitionId === transId)) return "conflict";
    return occupants.length === 0 ? "absent" : "conflict";
  }

  return "conflict";
}
/** Review proposal and lock-held confirmation policy. The same native
 * transition lifetime issues and validates the capability. Replacement owns
 * archive/journal/CAS; this command supplies its exact proposal and preflight.
 * @param {{read:()=>Snapshot,transition:Transition|null,catalog:()=>unknown,derive:Derive,
 * replacement:Pick<Replacement,'commit'> & {capture:(snapshot:Snapshot)=>ReplacementCapture|null},
 * model:Model,drafts:{readRaw:()=>string|null,preserve:(raw:string|null)=>DraftEffect,hasProgressInRemovedSets:(exerciseId:string|undefined,next:number,before:number,draft:Record<string,unknown>)=>boolean},
 * identity:{nextId:()=>string,now:()=>string,allocateBlockId:()=>string}}} options */
export function createBlockTransitionCommands({read,transition,catalog,derive,replacement,model,drafts,identity}){
  /** @param {Snapshot} snapshot */
  function transitionPredecessor(snapshot){
    const meta=snapshot?.programMeta;
    if(!meta?.id||!meta.programDefinition)return null;
    return{programId:meta.id,durableRevision:readRevision(snapshot),programDefinition:copySnapshot(meta.programDefinition),
      customExerciseDefinitions:model.compilerCustomDefinitions(snapshot.customExercises)}}
  /** @param {Record<string,unknown>} proposal @param {Snapshot} snapshot */
  function reducedSetCounts(proposal,snapshot){
    const meta=record(snapshot.programMeta);
    const cycle=model.mesocycleLifecycle({started:typeof meta.started==='string'?meta.started:undefined,mesocycleLengthWeeks:typeof meta.mesocycleLengthWeeks==='number'?meta.mesocycleLengthWeeks:undefined,mesocycleStatus:typeof meta.mesocycleStatus==='string'?meta.mesocycleStatus:undefined}).current||1;
    /** @param {unknown} definition @returns {Map<string,number>} */
    const counts=definition=>{const days=record(definition).days;return new Map((Array.isArray(days)?days:[])
      .flatMap((/** @type {unknown} */ day)=>{const slots=record(day).slots;return Array.isArray(slots)?slots:[]})
      .map((/** @type {unknown} */ slot)=>{const row=record(slot),cycles=Array.isArray(row.prescriptionsByCycle)?row.prescriptionsByCycle:[];
        const prescription=record(cycles.find(item=>record(item).cycleIndex===cycle));
        return /** @type {[string,number]} */([String(row.id),Array.isArray(prescription.sets)?prescription.sets.length:0])}));};
    const before=counts(snapshot?.programMeta?.programDefinition),after=counts(record(proposal.successor).programDefinition);
    return[...before].filter(([slotId,sets])=>(after.get(slotId)??0)<sets)
      .map(([slotId,sets])=>({slotId,beforeSets:sets,afterSets:after.get(slotId)??0}))}
  /** @param {ProposeInput} [input] */
  async function proposeChange(input = {}) {
    const Transition = transition;
    if (!Transition?.deriveSuccessor) return { ok: false, status: "unavailable", code: "transition_domain_unavailable", unavailable: true };
    const catalogSnapshot = catalog();
    if (!catalogSnapshot) return { ok: false, status: "unavailable", code: "catalog_unavailable", unavailable: true };
    const predecessor = transitionPredecessor(read());
    if (!predecessor) return { ok: false, status: "unavailable", code: "program_definition_unavailable", unavailable: true };

    const derived = await derive({
      change: input.change, programDefinition: predecessor.programDefinition,
      customExerciseDefinitions: predecessor.customExerciseDefinitions, catalogSnapshot,
    });
    if (!derived.ok) return { ...derived, unavailable: derived.status === "unavailable" };
    // The carry report is a pure function of the hash-pinned predecessor and
    // change, so the preview reads it beside the proposal, not inside it.
    const created = await Transition.createReplacementProposal({
      transitionId: input.transitionId || identity.nextId(),
      createdAt: input.createdAt || identity.now(),
      predecessor,
      successor: {
        programId: input.successorProgramId || identity.nextId(),
        programDefinition: derived.value.programDefinition,
        customExerciseDefinitions: derived.value.customExerciseDefinitions,
      },
      change: derived.value.change,
      catalogSnapshot,
    }, { deriveSuccessor: derive });
    return created?.ok && derived.value.carry ? { ...created, carry: derived.value.carry } : created;
  }

  /** @param {ConfirmInput} [params] */
  async function confirmTransition(params = {}) {
    const Transition = transition;
    if (!Transition) {
      return { ok: false, status: "unavailable", code: "transition_domain_unavailable", committed: false, localOk: false, idbOk: false };
    }
    const { proposal, proposalHash, transitionId, successorProgramId, confirmedAt } = params;
    const hasAck = Object.prototype.hasOwnProperty.call(params, "acknowledgedDraftRaw");
    const acknowledgedDraftRaw = params.acknowledgedDraftRaw;
    /** @param {string} code */
    const invalid = (code) => ({
      ok: false, committed: false, invalid: true, code,
      localOk: false, idbOk: false, revision: readRevision(read()),
    });
    // The proposal is the authority. Every supplied identity must equal the
    // proposal field before idempotency or any transaction; its archive
    // identity is the predecessor program id.
    if (!isPlainStateObject(proposal)) return invalid("proposal_missing");
    if (proposal.kind !== Transition.KIND) return invalid("unsupported_transition_kind");
    if (proposal.status !== "preview") return invalid("proposal_not_preview");
    if (typeof proposal.proposalHash !== "string" || !proposal.proposalHash) return invalid("proposal_hash_absent");
    if (typeof proposalHash !== "string" || proposalHash !== proposal.proposalHash) return invalid("proposal_hash_mismatch");
    if (typeof transitionId !== "string" || transitionId !== proposal.transitionId) return invalid("transition_id_mismatch");
    if (typeof successorProgramId !== "string" || successorProgramId !== record(proposal.successor).programId) return invalid("successor_id_mismatch");
    if (typeof confirmedAt !== "string" || !confirmedAt) return invalid("confirmed_at_missing");
    if (!hasAck || !(acknowledgedDraftRaw === null || typeof acknowledgedDraftRaw === "string")) return invalid("acknowledged_draft_missing");
    const predecessor=record(proposal.predecessor),successor=record(proposal.successor);
    const predecessorProgramId = predecessor.programId;
    if (typeof predecessorProgramId !== "string" || !predecessorProgramId) return invalid("predecessor_id_absent");
    if (typeof predecessor.durableRevision!=="number" || !Number.isInteger(predecessor.durableRevision)) return invalid("predecessor_revision_absent");
    const archiveId = predecessorProgramId;

    const preIdem = classifyCommittedTransition(read(), proposal, archiveId);
    if (preIdem === "match") {
      return { ok: true, committed: true, alreadyCommitted: true, revision: readRevision(read()), localOk: true, idbOk: true, kind: "committed" };
    }
    if (preIdem === "conflict") return invalid("conflicting_transition_record");
    if (acknowledgedDraftRaw !== drafts.readRaw()) {
      return { ok: false, committed: false, draftConflict: true, conflict: true, code: "draft_mismatch", localOk: false, idbOk: false, revision: readRevision(read()) };
    }
    // Permanent volume reduction cannot strand completed or edited sets the
    // successor removes. Check before the replacement journal is armed, so an
    // unsafe proposal has zero durable side effects.
    if (record(proposal.change).kind === "reduce_volume") {
      /** @type {Record<string,unknown>} */
      let draft = {};
      try {
        const parsed = JSON.parse(acknowledgedDraftRaw || "{}");
        if (isPlainStateObject(parsed)) draft = parsed;
      } catch {}
      const rows = new Map((read().program || []).map((row) => [row.slotId || row.id, row]));
      if (reducedSetCounts(proposal, read()).some(({ slotId, beforeSets, afterSets }) => {
        const row = rows.get(slotId);
        return row && drafts.hasProgressInRemovedSets(typeof row.id==='string'?row.id:typeof row.slotId==='string'?row.slotId:undefined, afterSets, beforeSets, draft);
      })) {
        return { ok: false, committed: false, draftConflict: true, conflict: true,
          code: "draft_conflict", localOk: false, idbOk: false, revision: readRevision(read()) };
      }
    }

    const capture = replacement.capture(read());
    if (!capture || capture.oldProgramId !== predecessorProgramId) return invalid("predecessor_unavailable");
    // Pin the capture to the proposal's revision so an intervening durable
    // commit fails the lock-held precondition and the archive stays non-durable.
    capture.storageRevision = predecessor.durableRevision;
    capture.archiveId = archiveId;
    capture.transitionOut = {
      schemaVersion: 1,
      transitionId: proposal.transitionId,
      proposalHash: proposal.proposalHash,
      successorProgramId: successor.programId,
    };
    const effect = drafts.preserve(acknowledgedDraftRaw);
    const baseProposal = copySnapshot(read());

    /** @param {{head:Snapshot,proposal:Snapshot}} context @returns {Promise<import('./session.js').PreflightResult>} */
    const preflight = async ({ head, proposal: draftProposal }) => {
      const lockedIdem = classifyCommittedTransition(head, proposal, archiveId);
      if (lockedIdem === "match") {
        return { reject: true, result: { ok: true, committed: true, alreadyCommitted: true, revision: readRevision(head), localOk: true, idbOk: true, kind: "committed" } };
      }
      if (lockedIdem === "conflict") {
        return { reject: true, result: { invalid: true, code: "conflicting_transition_record", localOk: false, idbOk: false } };
      }
      if (head.programMeta?.id !== predecessorProgramId) {
        return { reject: true, result: { stale: true, code: "predecessor_changed", localOk: false, idbOk: false } };
      }
      if (readRevision(head) !== predecessor.durableRevision) {
        return { reject: true, result: { stale: true, staleRevision: true, code: "stale_proposal", localOk: false, idbOk: false } };
      }
      const current = transitionPredecessor(head);
      if (!current) return { reject: true, result: { invalid: true, code: "program_definition_unavailable", localOk: false, idbOk: false } };
      // Semantic validation runs lock-held: hash, predecessor fingerprint, and
      // that the successor is exactly the derivation of the hashed change.
      const validation = await Transition.validateProposal(proposal, { predecessor: current, catalogSnapshot: catalog() },
        { deriveSuccessor: derive });
      if (!validation.ok) {
        const typed = validation.status === "stale" ? { stale: true } : { invalid: true };
        return { reject: true, result: { ...typed, code: validation.code || "invalid_proposal", localOk: false, idbOk: false } };
      }
      const committedRecord = Transition.commitRecord(validation.proposal, { confirmedAt, archiveId });
      const definition = copySnapshot(validation.proposal.successor.programDefinition);
      /** @type {import('./session.js').ProgramMeta & NonNullable<Parameters<Model['durableProgramRows']>[2]>} */
      const successorMeta = {
        ...copySnapshot(head.programMeta),
        id: validation.proposal.successor.programId,
        blockId: identity.allocateBlockId(),
        started: confirmedAt.slice(0, 10),
        mesocycleStatus: "active",
        daysPerWeek: definition.days.filter((day) => day.kind === "training").length,
        mesocycleLengthWeeks: definition.cycles,
        programDefinition: definition,
        transitionIn: committedRecord,
        updated: confirmedAt,
      };
      // A new block's volume aggregate begins with its own observed weeks.
      delete successorMeta.plannedVolumeHistory;
      if (Object.prototype.hasOwnProperty.call(successorMeta, "programStructure"))
        Object.assign(successorMeta,{programStructure:model.successorProgramStructure(successorMeta.programStructure, definition)});
      draftProposal.programMeta = successorMeta;
      draftProposal.program = model.durableProgramRows(definition, model.compilerCustomDefinitions(draftProposal.customExercises), successorMeta);
      return { proposal: draftProposal };
    };

    const res = await replacement.commit(baseProposal, { capture, effect, preflight });
    if (res.localOk || res.idbOk) return { ok: true, committed: true, ...res };
    return { ok: false, committed: false, ...res };
  }
  return Object.freeze({proposeChange,confirmTransition});
}
