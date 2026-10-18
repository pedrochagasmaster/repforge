import {createAnswerFields} from './answer-fields.js';
import {createEntryQuestions,renderEntryWheel} from './questions.js';
import {createEntryViews,FREEFORM_APPS,FREEFORM_URL_MAX} from './view.js';
/** @typedef {ReturnType<typeof import('../../app/entry.js').createEntryImportSession>} ImportSession
 * @typedef {{review:()=>unknown,submitGaps:()=>unknown,changeDoor:(mode:string)=>unknown,writeOwn:()=>unknown}} ImportCommands
 * @typedef {{mode:()=>string,reviewOpen:()=>boolean}} ImportQueries
 */
/** Owns freeform handoff controls and browser transport lifetimes. App commands
 * own the private tab session; views receive its readonly snapshot. Clipboard
 * reads preserve the user gesture and never parse through a second path. */
/** @param {{document:Document,navigator:Navigator,session:ImportSession,copy:import('./view.js').Copy,commands:ImportCommands,queries:ImportQueries,
 * copyText:(text:string,successKey:string,errorKey:string)=>Promise<boolean>,onRender:()=>void,onNotice:(key:string)=>void,
 * onHandoff:(event:{method:string,outcome:string,long_prompt:boolean})=>void,confirm:(key:string)=>boolean,scrollBehavior:()=>ScrollBehavior}} options */
export function createEntryController({document,navigator,session,copy,commands,queries,copyText,onRender,onNotice,onHandoff,confirm,scrollBehavior}){
 const view=createEntryViews(copy),questions=createEntryQuestions(copy),answerFields=createAnswerFields(copy),{t}=copy,win=document.defaultView;
 let busy=false,sequence=0,mounted=false,disposed=false;
 /** @type {string|null} */ let note=null;
 /** @type {string|null} */ let hubChoice=null;
 /** @type {ReturnType<typeof setTimeout>|null} */ let returnTimer=null;
 /** @template {Element} T @param {string} selector @returns {T|null} */
 const q=selector=>document.querySelector(selector);
 const model=()=>({...session.read(),activeProgram:false,clipboardNote:note});
 const prompt=()=>t('entry.freeform.prompt',{program:session.read().source.trim()});
 /** @param {string|null} kind */
 function setNote(kind){note=kind;const el=q('#entryFreeformClipNote');if(!el)return;el.textContent=view.noteText(kind);/** @type {HTMLElement} */(el).hidden=!kind;el.setAttribute('role',kind==='empty'?'status':'alert')}
 function paintBusy(){const button=/** @type {HTMLButtonElement|null} */(q('#entryFreeformClipboard'));if(!button)return;button.disabled=busy;button.setAttribute('aria-busy',busy?'true':'false');button.textContent=t(busy?'entry.freeform.clipboard_busy':'entry.freeform.clipboard_import')}
 function refresh(){
  const current=model(),program=current.source.trim(),count=q('#entryFreeformCount'),needs=/** @type {HTMLElement|null} */(q('#entryFreeformNeeds'));
  if(count)count.textContent=view.countLabel(current);if(needs)needs.hidden=!!program;
  const cont=/** @type {HTMLButtonElement|null} */(q('#entryFreeformContinue'));if(cont)cont.disabled=!program;
  const apps=q('.entry__freeform-apps');if(apps){apps.innerHTML=view.renderApps(current);bindProviders()}
  const button=/** @type {HTMLButtonElement|null} */(q('#entryFreeformCopy'));if(button)button.disabled=!program;
  session.save();
 }
 async function copyPrompt(){if(!session.read().source.trim()){onNotice('entry.freeform.needs_input');return false}return copyText(prompt(),'toast.freeform_prompt_copied','toast.freeform_copy_failed')}
 /** @param {string} provider @param {Event} event */
 function openProvider(provider,event){if(!FREEFORM_APPS[provider]||!session.read().source.trim()){event.preventDefault();onNotice('entry.freeform.needs_input');return false}
  onHandoff({method:provider,outcome:'opened',long_prompt:prompt().length>FREEFORM_URL_MAX});session.markOpened(provider);win?.setTimeout(()=>{if(!disposed)onRender()},0);return true}
 function bindProviders(){document.querySelectorAll('[data-freeform-app]').forEach(node=>{
  const el=/** @type {HTMLElement} */(node),provider=el.dataset.freeformApp||'';
  el.onclick=el.tagName==='BUTTON'?async event=>{event.preventDefault();const before=session.read(),ok=await copyPrompt();onHandoff({method:provider,outcome:ok?'copied':'copy_failed',long_prompt:true});if(ok&&!disposed&&before.epoch===session.read().epoch&&before.source===session.read().source){session.markCopied(provider);refresh()}}:event=>{openProvider(provider,event)};
 })}
 async function importClipboard(){
  if(busy||disposed)return false;
  if(typeof navigator.clipboard?.readText!=='function'){setNote('unavailable');return false}
  let pending;try{pending=navigator.clipboard.readText()}catch{setNote('failed');return false}
  const token={...session.read(),sequence:++sequence,mode:queries.mode()};busy=true;setNote(null);paintBusy();
  let text=null,failed=false;try{text=await pending}catch{failed=true}busy=false;paintBusy();
  const current=session.read();
  if(disposed||token.sequence!==sequence||token.epoch!==current.epoch||token.mode!==queries.mode()||token.stage!==current.stage||token.source!==current.source||token.reply!==current.reply||queries.reviewOpen())return false;
  if(failed){setNote('failed');return false}if(!String(text||'').trim()){setNote('empty');return false}
  session.setReply(String(text));setNote(null);commands.review();return true;
 }
 /** @param {string} selector @param {(event:MouseEvent)=>unknown} action */
 function click(selector,action){const node=/** @type {HTMLElement|null} */(q(selector));if(node)node.onclick=action}
 /** @type {Record<string,string>} */ const repairKeys={invalid_rows:'entry.freeform.repair_invalid_rows',assemble_failed:'entry.freeform.repair_assemble_failed'};
 function bind(){
  click('#entryFreeformSwitch',()=>commands.changeDoor('freeform'));click('#entryFreeformFile',()=>commands.changeDoor('file'));
  click('#entryWriteOwn',()=>commands.writeOwn());
  const input=/** @type {HTMLTextAreaElement|null} */(q('#entryFreeformIn'));if(input)input.oninput=()=>{session.setSource(input.value);refresh()};
  const output=/** @type {HTMLTextAreaElement|null} */(q('#entryFreeformOut'));if(output)output.oninput=()=>{session.setReply(output.value);if(note)setNote(null)};
  click('#entryFreeformContinue',()=>{if(session.continueSource())onRender()});
  click('#entryFreeformEditSource',()=>{if(session.editSource())onNotice('entry.freeform.edit_source_warning');onRender()});
  bindProviders();
  click('#entryFreeformCopy',async()=>{const before=session.read(),ok=await copyPrompt();onHandoff({method:'copy',outcome:ok?'copied':'copy_failed',long_prompt:prompt().length>FREEFORM_URL_MAX});if(ok&&!disposed&&before.epoch===session.read().epoch&&before.source===session.read().source){session.copyCompleted();onRender()}});
  click('#entryFreeformTryAnother',()=>{session.tryAnother();onRender()});
  click('#entryFreeformStartOver',()=>{const current=session.read();if((current.source.trim().length>10||current.reply.trim().length>10)&&!confirm('entry.freeform.confirm_start_over'))return;reset();onRender()});
  click('#entryFreeformCopyRepair',()=>copyText(t(repairKeys[session.read().failReason||'']||'entry.freeform.repair_no_json'),'entry.freeform.toast_repair_copied','toast.freeform_copy_failed'));
  click('#entryFreeformClipboard',importClipboard);click('#entryFreeformReview',()=>commands.review());click('#entryFreeformSubmitGaps',()=>commands.submitGaps());
  click('#entryFreeformBackToReply',()=>{session.clearGaps();onRender()});
  document.querySelectorAll('[data-gap-key]').forEach(node=>{const input=/** @type {HTMLInputElement} */(node);input.oninput=()=>session.setGapAnswer(input.dataset.gapKey||'',input.value)});
  paintBusy();
 }
 function onVisible(){if(document.visibilityState==='visible'&&session.read().stage===3){const out=/** @type {HTMLElement|null} */(q('#entryFreeformOut'));if(out){out.scrollIntoView?.({behavior:scrollBehavior(),block:'nearest'});out.classList.add('is-returned');if(returnTimer!==null)clearTimeout(returnTimer);returnTimer=setTimeout(()=>{out.classList.remove('is-returned');returnTimer=null},2000)}}}
 /** @param {boolean} blocked */
 function bindHub(blocked){document.querySelectorAll('[data-entry-hub]').forEach(node=>{
  const button=/** @type {HTMLButtonElement} */(node);button.onclick=()=>{
   const choice=button.dataset.entryHub;if(blocked||!choice||!['recommend','build','import'].includes(choice))return;
   hubChoice=choice;onRender();
  };
 })}
 function mount(){if(mounted||disposed)return;mounted=true;win?.addEventListener('visibilitychange',onVisible)}
 function resetTransport(){note=null;sequence++}
 function reset(){session.reset();resetTransport()}
 function dispose(){disposed=true;sequence++;win?.removeEventListener('visibilitychange',onVisible);if(returnTimer!==null)clearTimeout(returnTimer);returnTimer=null}
 return Object.freeze({mount,bind,bindHub,dispose,reset,resetTransport,importClipboard,hubChoice:()=>hubChoice,clearHubChoice:()=>{hubChoice=null},renderHub:view.renderHub,renderQuestion:questions.render,renderAnswerPart:answerFields.renderPart,renderAnswerScreen:answerFields.renderScreen,renderWheel:renderEntryWheel,renderSource:({activeProgram}=/** @type {{activeProgram:boolean}} */({activeProgram:false}))=>view.renderSource({...model(),activeProgram})});
}
