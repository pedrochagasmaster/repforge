/** @typedef {ReturnType<ReturnType<typeof import('../editors.js').createProgramEditor>['mountProgramEditor']>} Mounted
 * @typedef {{openModal:(element:HTMLElement,options:{initialFocus:HTMLElement|null,onEscape:()=>unknown})=>unknown,closeModal:(element:HTMLElement|null)=>unknown}} Shell
 */
export const INSTALLED_EDITOR_HISTORY_STATE_KEY='tauriferProgramEditor';
/** Installed editing owns its mounted editor, leave decision, pending route and
 * browser Back sentinel. Only the application session can acknowledge Apply.
 * @param {{window:Window & typeof globalThis,session:Pick<ReturnType<typeof import('../../app/installed-editor.js').createInstalledEditor>,'reset'>,mountEditor:(host:HTMLElement)=>Mounted,shell:Shell,t:(key:string)=>string,onChanged:()=>void,onAccepted:()=>void,onEdit:()=>void,entry:{isOpen:()=>boolean,cancel:()=>void}}} options */
export function createInstalledEditorView({window,session,mountEditor,shell,t,onChanged,onAccepted,onEdit,entry}){
 const {document,history,location}=window;
 const $=(/** @type {string} */ selector)=>/** @type {HTMLElement|null} */(document.querySelector(selector));
 /** @type {Mounted|null} */ let mounted=null;
 /** @type {{workout:boolean}|null} */ let leave=null;
 /** @type {string|null} */ let pendingNavigation=null;
 /** @type {AbortController|null} */ let listeners=null;
 let editing=false,armed=false,releasing=false,generation=0;
 function historyState(){const current=history.state&&typeof history.state==='object'?history.state:{};return{...current,[INSTALLED_EDITOR_HISTORY_STATE_KEY]:{active:true}}}
 function arm(){
   if(armed)return;
   try{if(history.state?.[INSTALLED_EDITOR_HISTORY_STATE_KEY]?.active===true){armed=true;return}history.pushState(historyState(),'',location.href);armed=true}catch{}
 }
 /** @param {{historyAlreadyPopped?:boolean}} [options] */
 function disarm({historyAlreadyPopped=false}={}){
   if(!armed)return;armed=false;if(historyAlreadyPopped)return;
   releasing=true;try{history.back()}catch{releasing=false}
 }
 function closeLeave(){leave=null;pendingNavigation=null;shell.closeModal($('#programEditorLeave'))}
 /** @param {{workout?:boolean}} [options] */
 function openLeave({workout=false}={}){
   const dialog=$('#programEditorLeave');if(!dialog)return;
   leave={workout};
   const title=$('#programEditorLeaveTitle'),body=$('#programEditorLeaveBody'),apply=$('#programEditorApply'),discard=$('#programEditorDiscard'),keep=$('#programEditorKeep');
   if(title)title.textContent=t(workout?'program.editor.workout_conflict.title':'program.editor.leave.title');
   if(body)body.textContent=t(workout?'program.editor.workout_conflict.body':'program.editor.leave.body');
   if(apply){apply.textContent=t(workout?'program.editor.apply_discard_workout':'program.editor.apply_changes');apply.removeAttribute('disabled')}
   if(discard){discard.textContent=t('program.editor.discard_changes');discard.hidden=workout}
   if(keep)keep.textContent=t('program.editor.keep_editing');
   shell.openModal(dialog,{initialFocus:apply,onEscape:closeLeave});
 }
 function disposeEditor(){++generation;mounted?.dispose();mounted=null;session.reset()}
 /** @param {{discard?:boolean,historyAlreadyPopped?:boolean}} [options] */
 function finish({discard=false,historyAlreadyPopped=false}={}){
   const next=pendingNavigation;pendingNavigation=null;leave=null;shell.closeModal($('#programEditorLeave'));
   if(discard)mounted?.discard();disposeEditor();editing=false;disarm({historyAlreadyPopped});onChanged();
   if(next)$( `nav button[data-view="${window.CSS.escape(next)}"]`)?.click();
 }
 function conflict(){const status=$('#programEditor [data-role="editor-status"]');if(status){status.textContent=t('program.editor.conflict');status.hidden=false;status.classList.add('is-error')}}
 async function apply(){
   const editor=mounted;if(!editor)return;
   const token=generation,button=$('#programEditorApply');button?.setAttribute('disabled','');
   /** @type {import('../editors/contracts.js').EditorReceipt|undefined} */
   const result=await editor.commit({kind:leave?.workout?'apply_discard_workout':'apply'});
   if(token!==generation||editor!==mounted)return result;
   button?.removeAttribute('disabled');
   if(result?.workoutConflict){openLeave({workout:true});return result}
   if(result?.suggestLoads){if(leave)closeLeave();pendingNavigation=null;if(editor.checkSuggestLoads()?.ok!==false)conflict();return result}
   if(result?.conflict||result?.editorConflict||result?.staleRevision){conflict();closeLeave();return result}
   if(result?.committed===true&&result?.settled===true){finish();onAccepted()}
   return result;
 }
 async function done(){if(!editing||!mounted)return;if(!mounted.isDirty()){finish();return}leave={workout:false};await apply()}
 /** @param {string|undefined} view @returns {boolean} */
 function requestNavigation(view){if(editing&&mounted?.isDirty()){pendingNavigation=view||null;openLeave();return true}if(editing)finish();return false}
 function onPopState(){
   if(releasing){releasing=false;return true}if(!editing||!mounted)return false;
   armed=false;
   if(mounted.isDirty()){
     try{history.pushState(historyState(),'',location.href);armed=true}catch{}
     if(!/** @type {HTMLDialogElement|null} */($('#programEditorLeave'))?.open)openLeave();return true;
   }
   finish({historyAlreadyPopped:true});return true;
 }
 function mount(){const host=$('#programEditor');if(!host)return null;disposeEditor();mounted=mountEditor(host);return mounted}
 function bind(){
   if(listeners)return;listeners=new window.AbortController();const signal=listeners.signal;
   $('#programEditToggle')?.addEventListener('click',()=>{if(entry.isOpen()){entry.cancel();return}if(editing){void done();return}editing=true;onEdit()},{signal});
   $('#programEditorApply')?.addEventListener('click',()=>{void apply()},{signal});
   $('#programEditorDiscard')?.addEventListener('click',()=>finish({discard:true}),{signal});
   $('#programEditorKeep')?.addEventListener('click',closeLeave,{signal});
 }
 function dispose(){closeLeave();disarm();disposeEditor();listeners?.abort();listeners=null;leave=null;pendingNavigation=null;editing=false}
 return Object.freeze({mount,bind,dispose,disposeEditor,arm,done,apply,finish,closeLeave,openLeave,onPopState,requestNavigation,
   get editing(){return editing},get hasEditor(){return!!mounted},setEditing:(/** @type {boolean} */value)=>{editing=value}});
}
