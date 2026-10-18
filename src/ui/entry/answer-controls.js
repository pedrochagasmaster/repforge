/** @typedef {ReturnType<typeof import('../../app/entry.js').createEntryAnswerCommands>} AnswerCommands */
/** Owns search/pending-avoid/limit presentation state. Each mounted group is
 * bound to its explicit application answer target, including the inline
 * editor's private copy. A handler never substitutes the active draft.
 * @param {{document:Document,onRender:()=>void}} options */
export function createAnswerControls({document,onRender}){
 let avoidQuery='',exerciseQuery='',priorityLimitShown=false;
 /** @type {string|null} */ let pendingAvoid=null;
 const read=()=>Object.freeze({avoidQuery,exerciseQuery,pendingAvoid,priorityLimitShown});
 function reset(){avoidQuery='';exerciseQuery='';pendingAvoid=null;priorityLimitShown=false}
 /** @param {ParentNode} root @param {AnswerCommands} commands */
 function bind(root,commands){
  /** @param {string} selector @param {(button:HTMLElement,event:MouseEvent)=>unknown} action */
  function clicks(selector,action){root.querySelectorAll(selector).forEach(node=>{const button=/** @type {HTMLElement} */(node);button.onclick=event=>{action(button,event)}})}
  clicks('[data-entry-pick]',button=>{
   const key=button.dataset.entryPick||'',raw=button.dataset.entryVal||'',oldPending=pendingAvoid;
   if(key==='avoidReason')pendingAvoid=null;
   priorityLimitShown=false;
   const result=commands.choose({key,raw,multi:button.dataset.entryMulti==='1'});
   if(result==='priority-limit'){priorityLimitShown=true;onRender()}
   if(result==='ignored'&&key==='avoidReason')pendingAvoid=oldPending;
  });
  clicks('#entryEquipmentReset',()=>commands.resetEquipment());
  clicks('#entryDeloadSwitch',button=>commands.setDeload(button.getAttribute('aria-checked')!=='true'));
  clicks('[data-entry-action="clear-priorities"]',()=>commands.clearPriorities());
  /** @param {string} selector @param {'avoid'|'exercise'} field */
  function search(selector,field){const input=/** @type {HTMLInputElement|null} */(root.querySelector(selector));if(!input)return;
   input.oninput=()=>{if(field==='avoid')avoidQuery=input.value;else exerciseQuery=input.value;onRender();
    const current=/** @type {HTMLInputElement|null} */(document.querySelector(selector));if(current){current.focus();current.setSelectionRange?.(input.value.length,input.value.length)}};
  }
  search('#entryAvoidSearch','avoid');search('#entryExerciseSearch','exercise');
  clicks('[data-entry-exercise-add]',button=>{
   const id=button.dataset.entryExerciseAdd||'',status=button.dataset.entryExerciseStatus;
   if(status==='include'){const before=exerciseQuery;exerciseQuery='';if(!commands.includeExercise(id))exerciseQuery=before}
   else if(status==='avoid'&&commands.canAvoid(id)){pendingAvoid=id;exerciseQuery='';onRender()}
  });
  clicks('[data-entry-exercise-remove]',button=>commands.removeExercise(button.dataset.entryExerciseRemove||''));
  clicks('[data-entry-avoid-add]',button=>{const id=button.dataset.entryAvoidAdd||'';if(!commands.canAvoid(id))return;pendingAvoid=id;avoidQuery='';onRender()});
  clicks('[data-entry-avoid-remove]',button=>commands.removeAvoidance(button.dataset.entryAvoidRemove||''));
 }
 return Object.freeze({read,reset,bind,clearPriorityLimit:()=>{priorityLimitShown=false},clearExerciseSearch:()=>{exerciseQuery=''}});
}
