/** @param {string|undefined} status @param {boolean} [initialization] */
export function draftRecoveryMessageKind(status,initialization=false){
  // A legacy flat draft that cannot migrate against the current program
  // (metric composition, identity, or any other structural mismatch the
  // migrator refuses to guess at) reads the same "earlier program" notice as
  // a stale V2 draft: the lifter's program moved on, and the typed values
  // stay in recovery until they choose export or clear.
  // unmapped-legacy-metric is migrateLegacy's explicit refusal to guess a
  // legacy load/reps value onto an ambiguous metric-backed composition (a
  // per-side or assistance load, a per-side rep count, or a missing metric;
  // see workout-draft.js, issue #332). It is the same "cannot migrate against
  // the current program" situation invalid-migrated-draft already covers.
  if(status==="invalid-migrated-draft"||status==="unmapped-legacy-metric")return"program";
  if(status==="stale")return initialization?"program":"stale";
  if(status==="lock-unavailable"||status==="read-failed"||status==="checkpoint-unreadable"||
    status==="checkpoint-missing"||status==="checkpoint-conflict")return"unavailable";
  if(initialization||status==="invalid"||status==="migration-error"||status==="legacy"||
    String(status||"").includes("recovery"))return"invalid";
  return"persist"}

/** Contextual recovery may describe a checkpoint candidate rather than the
 * canonical bytes displayed to the lifter. Only the same structurally valid
 * identity, revision and program binding can offer the program discard action.
 * Generic reconciliation refusals remain non-destructive.
 * @param {{status?:string,error?:{kind?:string,code?:string,reason?:string,draft?:import('../../training/workout-contracts.js').Draft}}|null} result
 * @param {import('../../training/workout-contracts.js').ParsedDraft|undefined} parsed
 */
export function initializationRecoveryKind(result,parsed){
  const error=result?.error,candidate=error?.draft;
  if(result?.status==='stale-recovery'&&error?.kind==='stale'&&candidate&&
    ['programId','programFingerprint','dayId','blockId'].includes(error.reason||'')&&parsed?.kind==='valid'){
    const displayed=parsed.draft;
    if(candidate.draftId===displayed.draftId&&candidate.revision===displayed.revision&&
      candidate.program.programId===displayed.program.programId&&
      candidate.program.programFingerprint===displayed.program.programFingerprint&&
      candidate.program.dayId===displayed.program.dayId&&candidate.program.blockId===displayed.program.blockId&&
      candidate.program.durableRevision===displayed.program.durableRevision)return 'program';
  }
  const reason=result?.status==='migration-error'?error?.code:result?.status;
  return draftRecoveryMessageKind(reason,true);
}
