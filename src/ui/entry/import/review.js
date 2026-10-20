import {escapeHtml as esc} from '../../format.js';
import {exerciseThumb,emptyThumb} from '../../exercise-media.js';
import {FREEFORM_NOT_IMPORTED_KEYS} from '../view.js';
/** @typedef {import('../../../app/entry.js').ProgramImportReview} Review
 * @typedef {import('../../../app/entry.js').ProgramImportRow} Row
 * @typedef {Pick<ReturnType<typeof import('../../../app/entry.js').createProgramImport>,'read'|'counts'|'expand'|'pick'|'link'|'select'|'custom'>} ReviewCommands
 * @typedef {Pick<ReturnType<typeof import('../../library/controller.js').createLibraryController>,'openExercisePicker'|'openCustomExerciseSheet'>} Library
 */
/** Mounted program-file/freeform review. Domain draft changes go through named
 * commands bound to the exact read model; late picker results are inert.
 * @param {{window:Window & typeof globalThis,review:ReviewCommands,library:Library,
 * copy:{t:(key:string,vars?:Record<string,unknown>)=>string,tp:(n:number,key:string)=>string,language:()=>string},
 * shell:Pick<ReturnType<typeof import('../../shell.js').createShell>,'resolveReturnFocus'>,
 * commands:{commit:()=>Promise<unknown>,back:()=>void,cancel:()=>void,landing:()=>void,entry:()=>void,program:()=>void},
 * report:(event:string,properties:Record<string,string>)=>void}} options */
export function createImportReview({window,review,library,copy,shell,commands,report}){
 const document=window.document,{t,tp}=copy;
 /** @param {string} selector */const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
 /** @param {string} selector */const $$=selector=>[...document.querySelectorAll(/** @type {string} */(selector))].filter((node)=>node instanceof window.HTMLElement);
 /** @param {NonNullable<Row['match']>} entry */const movementName=entry=>copy.language()==='pt'&&entry.namePt?entry.namePt:entry.name;
 /** @type {HTMLElement|null} */let returnTarget=null;
 /** @type {AbortController|null} */let listeners=null;
/** @type {Record<string,string>} */
const importStatusKey={exact:"import.status.exact",alias:"import.status.alias",probable:"import.status.probable",unmatched:"import.status.unmatched"};

function render(){
  const importDraft=review.read();if(!importDraft)return;
  const counts=review.counts(importDraft);
  const file=$("#importFile");
  if(file)file.textContent=t("import.file",{name:importDraft.fileName||t("import.file_fallback"),n:counts.total,exercise:tp(counts.total,"lift")});
  const notImportedEl=$("#importNotImported");
  if(notImportedEl){
    if(importDraft?.notImported?.length){
      const items=importDraft.notImported.map(cat=>t(FREEFORM_NOT_IMPORTED_KEYS[cat]||"entry.freeform.not_imported.other_notes")).join(", ");
      notImportedEl.innerHTML=`<p class="entry__notice entry__notice--info" role="status">${esc(t("entry.freeform.not_imported_notice",{items}))}</p>`;
      notImportedEl.hidden=false;
    }else{
      notImportedEl.innerHTML="";
      notImportedEl.hidden=true;
    }
  }
  const originalEl=$("#importOriginalText");
  if(originalEl){
    if(importDraft?.originalText){
      originalEl.innerHTML=`<details class="entry__original-text"><summary>${esc(t("entry.freeform.view_original"))}</summary><pre class="entry__pre">${esc(importDraft.originalText)}</pre></details>`;
      originalEl.hidden=false;
    }else{
      originalEl.innerHTML="";
      originalEl.hidden=true;
    }
  }
  const countsEl=$("#importCounts");
  if(countsEl)countsEl.innerHTML=
    `<span class="impcount"><b>${counts.linked}</b>${esc(t("import.count_linked"))}</span>`+
    `<span class="impcount"><b>${counts.review}</b>${esc(t("import.count_review"))}</span>`+
    `<span class="impcount"><b>${counts.custom}</b>${esc(t("import.count_custom"))}</span>`;
  const rows=$("#importRows");
  if(rows){
    // Rows still needing a decision come first: they are the only reason this
    // screen exists, and a twelve-exercise split should not hide them.
    const ordered=[...importDraft.rows].sort((a,b)=>(a.reviewed?1:0)-(b.reviewed?1:0));
    rows.innerHTML=ordered.map(importRowHtml).join("");
    $$("#importRows [data-imp-act]").forEach(b=>
      b.onclick=()=>rowAction(importDraft,b.dataset.impAct||'',b.dataset.impKey||'',Number(b.dataset.impIdx)));
  }
  /* The one primary lives in the pinned region. While rows still need a
     decision it is disabled, drops its arrow, and the count says why directly
     above it, the same way every route's pinned action does. */
  const commit=/** @type {HTMLButtonElement|null} */($("#importCommit")),reason=$("#importCommitReason");
  if(commit){
    const blocked=counts.review>0;
    commit.disabled=blocked;
    commit.textContent=t("entry.preview.review");
    commit.classList.toggle("btn--noarrow",blocked);
    if(blocked)commit.setAttribute("aria-describedby","importCommitReason");
    else commit.removeAttribute("aria-describedby");
    if(reason){
      reason.hidden=!blocked;
      reason.textContent=blocked?t("import.commit_blocked",{n:counts.review}):""}}
}

/** @param {Row} row */
function importRowHtml(row){
  // An unreviewed row shows what is being proposed, not the standing default:
  // "keep as imported" beside a Likely badge hides the very thing being asked
  // about. Once decided, the target is the decision.
  const proposed=!row.reviewed&&row.match?row.match:null;
  const shown=row.decision==="link"&&row.match?row.match:proposed;
  const target=shown?movementName(shown)
    :row.decision==="custom"?t("import.target_custom")
    :t("import.target_raw");
  const badge=row.reviewed
    ?`<span class="impbadge is-done">${esc(t("import.status.confirmed"))}</span>`
    :`<span class="impbadge is-open">${esc(t(importStatusKey[row.status]||"import.status.unmatched"))}</span>`;
  const art=shown?exerciseThumb(shown,{size:"sm"}):emptyThumb({size:"sm"});
  // A settled row keeps its name, its target, its art and its badge, and trades
  // its three remaining alternatives for one quiet way back in. Most settled
  // rows were matched by the importer rather than chosen by the lifter, so the
  // alternatives are noise on the screen you read before replacing a program.
  const folded=row.reviewed&&!row.expanded;
  // Scoring puts the right movement in the shortlist far more reliably than it
  // puts it first, and a line like "Hack squat" never says whether the barbell
  // or the machine is meant. So an undecided row offers its candidates instead
  // of a verdict, and the escape hatches move behind a disclosure rather than
  // wrapping four buttons onto three lines of a phone.
  const shortlist=(row.shortlist||[]).filter(Boolean);
  const chips=!folded&&shortlist.length
    ?shortlist.map((entry,i)=>
      `<button type="button" class="improw__btn improw__btn--pick" data-imp-act="pick" data-imp-idx="${i}" data-imp-key="${esc(row.key)}">${esc(t("import.action_link",{name:movementName(entry)}))}</button>`).join("")
    :(!folded&&row.match&&row.decision!=="link"
      ?`<button type="button" class="improw__btn" data-imp-act="link" data-imp-key="${esc(row.key)}">${esc(t("import.action_link",{name:movementName(row.match)}))}</button>`:"");
  const escapes=
    // Every slot of a program names a movement, so an unmatched row is settled
    // by choosing one or creating it; there is no unlinked "keep as typed".
    `<button type="button" class="improw__btn" data-imp-act="choose" data-imp-key="${esc(row.key)}">${esc(t("import.action_choose"))}</button>`+
    (row.decision!=="custom"
      ?`<button type="button" class="improw__btn" data-imp-act="custom" data-imp-key="${esc(row.key)}">${esc(t("import.action_custom"))}</button>`:"");
  const acts=folded
    ?`<button type="button" class="improw__btn improw__btn--change" data-imp-act="expand" data-imp-key="${esc(row.key)}">${esc(t("import.action_change"))}</button>`
    :chips+(chips
      ?`<details class="improw__more"><summary>${esc(t("import.more_options"))}</summary><div class="improw__acts">${escapes}</div></details>`
      :escapes);
  return `<div class="improw${row.reviewed?"":" is-open"}${folded?" is-folded":""}" data-imp-row="${esc(row.key)}">`+
    `<p class="improw__from">${esc(row.raw.name||"")}</p>`+
    `<span class="improw__arrow" aria-hidden="true">→</span>`+
    art+
    `<div class="improw__to"><p class="improw__name">${esc(target)}</p>${badge}</div>`+
    `<div class="improw__acts">${acts}</div>`+
  `</div>`}

 /** @param {ReturnType<ReviewCommands['pick']>} result @param {string} method */
 function settled(result,method){
  if(!result)return;
  if(result.firstResolution)report('program_import_row_resolved',{method,source:result.source});
  render();
 }
 /** @param {Readonly<Review>} expected @param {string} action @param {string} key @param {number} index */
 function rowAction(expected,action,key,index){
  if(review.read()!==expected)return;
  const row=expected.rows.find(item=>item.key===key);if(!row)return;
  if(action==='expand'){
   if(!review.expand(expected,key))return;render();
   $(`#importRows [data-imp-row="${esc(key)}"] [data-imp-act]`)?.focus({preventScroll:true});return;
  }
  if(action==='pick'){settled(review.pick(expected,key,index),index===0?'top_candidate':'alternate');return}
  if(action==='link'){settled(review.link(expected,key),'top_candidate');return}
  if(action==='choose'){
   library.openExercisePicker({title:t('import.pick_title'),subtitle:row.raw.name||'',
    onPick:(/** @type {import('../../library/controller.js').LibraryEntry} */entry)=>settled(review.select(expected,key,entry),'picker')});return;
  }
  if(action==='custom')library.openCustomExerciseSheet({entry:{name:row.raw.name||'',primary:row.raw.primary||'',secondary:row.raw.secondary||''},stageOnly:true,
   onSave:entry=>{if('id' in entry&&typeof entry.id==='string'&&'name' in entry&&typeof entry.name==='string')settled(review.custom(expected,key,{...entry,id:entry.id,name:entry.name}),'custom')}});
 }
 function open(){
  const draft=review.read();if(!draft)return;
  listeners?.abort();listeners=new window.AbortController();
  returnTarget=document.activeElement instanceof window.HTMLElement?document.activeElement:null;
  document.body.classList.add('is-import');
  $$('.view').forEach(view=>view.classList.toggle('active',view.id==='importReview'));
  window.scrollTo({top:0});const root=$('#importReview');if(root)root.scrollTop=0;
  render();
  const target=review.counts(draft).review?$('#importRows .improw.is-open [data-imp-act]'):$('#importCommit');
  (target||$('#importBack'))?.focus({preventScroll:true});
  const signal=listeners.signal;
  $('#importBack')?.addEventListener('click',commands.back,{signal});
  $('#importReviewCancel')?.addEventListener('click',commands.cancel,{signal});
  $('#importCommit')?.addEventListener('click',()=>{void commands.commit()},{signal});
 }
 /** @param {{toProgram?:boolean,firstRun?:boolean,onboarding?:boolean}} [options] */
 function close({toProgram=true,firstRun=false,onboarding=false}={}){
  listeners?.abort();listeners=null;document.body.classList.remove('is-import');
  const back=shell.resolveReturnFocus(returnTarget);returnTarget=null;
  if(firstRun&&toProgram){commands.landing();return}
  if(onboarding&&toProgram){commands.entry();return}
  if(toProgram)commands.program();
  if(back&&'focus' in back&&typeof back.focus==='function')try{back.focus({preventScroll:true})}catch{}
 }
 return Object.freeze({open,close,render});
}
