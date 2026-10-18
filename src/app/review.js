/** Review's user-confirmed application actions. Proposal identity and the exact
 * current draft are captured here; UI never supplies storage bytes or allocates
 * transition/archive/workout identities. The transition owner validates pins
 * and performs the existing durable replacement protocol.
 */
export function createReviewCommands({transition,readDraft,clearStaging,openStagedEditor,repeat,onCommitted,onChoice,now=()=>new Date().toISOString()}){
  async function confirm(flow){
    const proposal=flow.proposal;
    const result=await transition.confirmTransition({proposal,proposalHash:proposal.proposalHash,
      transitionId:proposal.transitionId,successorProgramId:proposal.successor?.programId,
      confirmedAt:now(),acknowledgedDraftRaw:readDraft()});
    if(!result?.committed)return result;
    const action={"schedule-repair":"schedule_repair","reduce-volume":"reduce_volume","recovery-week":"recovery_week","guided-edit":"guided_edit"}[flow.action];
    if(action)onChoice(action);
    onCommitted(result);
    const doneKey=proposal.change?.kind==="recovery_week"?"review.recovery.committed":proposal.change?.kind==="reduce_volume"?"review.volume.committed":"review.done.committed";
    return {...result,doneKey};
  }
  return Object.freeze({
    propose:change=>transition.proposeChange({change}),
    stage:diagnosis=>transition.stageGuidedManualRepair({diagnosis,openEditor:false}),
    confirm,discardStaging:clearStaging,openStagedEditor,repeat,
  });
}
