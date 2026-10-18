import {escapeHtml as esc} from '../format.js';
import {FREEFORM_MAX_CHARS} from '../../app/entry.js';
/** @typedef {ReturnType<ReturnType<typeof import('../../app/entry.js').createEntryImportSession>['read']> & {activeProgram:boolean,clipboardNote:string|null}} FreeformModel */
/** @typedef {{t:(key:string,vars?:Record<string,unknown>)=>string,locale:()=>string}} Copy */
export const FREEFORM_URL_MAX=6000;
/** @type {Record<string,{base:string,param:string,label:string,copyLabel:string,copiedLabel:string}>} */
export const FREEFORM_APPS={
  chatgpt:{base:"https://chatgpt.com/",param:"q",label:"entry.freeform.open_chatgpt",copyLabel:"entry.freeform.copy_chatgpt",copiedLabel:"entry.freeform.open_chatgpt_copied"},
  claude:{base:"https://claude.ai/new",param:"q",label:"entry.freeform.open_claude",copyLabel:"entry.freeform.copy_claude",copiedLabel:"entry.freeform.open_claude_copied"},
};
/** @type {Record<string,string>} */
const FREEFORM_NOT_IMPORTED_KEYS = {
  rest_times: "entry.freeform.not_imported.rest_times",
  rir_rpe: "entry.freeform.not_imported.rir_rpe",
  tempo: "entry.freeform.not_imported.tempo",
  supersets: "entry.freeform.not_imported.supersets",
  warmups: "entry.freeform.not_imported.warmups",
  cardio: "entry.freeform.not_imported.cardio",
  progression_rules: "entry.freeform.not_imported.progression_rules",
  deload: "entry.freeform.not_imported.deload",
  other_notes: "entry.freeform.not_imported.other_notes",
};
/** @param {string} app @param {string} prompt */
export function freeformAppUrl(app,prompt){
  const spec=FREEFORM_APPS[app];if(!spec||!prompt)return null;
  const url=`${spec.base}?${spec.param}=${encodeURIComponent(prompt)}`;
  return url.length<=FREEFORM_URL_MAX?url:null;
}
/** The view consumes facts only; transport and mutations belong to controller/commands. */
/** @param {Copy} copy */
export function createFreeformViews({t,locale}){
/** @param {string} title */
const entryHeading=title=>`<h2 class="onb__q" id="entryHeading" tabindex="-1">${esc(title)}</h2>`;
/** @param {string} text @param {string} _icon */
const entryGroupLab=(text,_icon)=>`<p class="entry__group-lab entry__question"><span>${esc(text)}</span></p>`;
const entryWriteOwnLink=()=>`<button type="button" class="btn btn--ghost entry__write-own" id="entryWriteOwn">${esc(t("entry.import_source.write_own"))}</button>`;
/** @type {Record<string,string>} */ const NOTE_KEYS={empty:"entry.freeform.clipboard_empty",failed:"entry.freeform.clipboard_failed",unavailable:"entry.freeform.clipboard_unavailable"};
/** @param {string|null} kind */ const noteText=kind=>kind&&NOTE_KEYS[kind]?t(NOTE_KEYS[kind]):"";
/** @param {FreeformModel} model */
const countLabel=model=>t("entry.freeform.count",{n:model.source.length.toLocaleString(locale()),max:FREEFORM_MAX_CHARS.toLocaleString(locale())});
/** @param {FreeformModel} model */
function renderFreeformGapsStep(model){
  const gaps=model.gapResult?.gaps||[];
  const notImported=model.gapResult?.notImported||[];
  let notImportedHtml="";
  if(notImported.length){
    const items=notImported.map(cat=>t(FREEFORM_NOT_IMPORTED_KEYS[cat]||"entry.freeform.not_imported.other_notes")).join(", ");
    notImportedHtml=`<p class="entry__notice entry__notice--info" role="status">${esc(t("entry.freeform.not_imported_notice",{items}))}</p>`;
  }
  const gapRows=gaps.map(gap=>{
    const isSets=gap.field==="sets";
    const val=model.gapAnswers[gap.key]||"";
    const hasError=model.gapErrors.includes(gap.key);
    const label=isSets
      ?t("entry.freeform.gap_sets_label",{exercise:`${gap.day} · ${gap.name}`})
      :t("entry.freeform.gap_reps_label",{exercise:`${gap.day} · ${gap.name}`});
    const placeholder=isSets?t("entry.freeform.gap_sets_placeholder"):t("entry.freeform.gap_reps_placeholder");
    return `<label class="entry__field"><span>${esc(label)}</span>`+
      `<input type="text" class="entry__field-input${hasError?" is-invalid":""}"${hasError?' aria-invalid="true"':""} data-gap-key="${esc(gap.key)}" value="${esc(val)}" placeholder="${esc(placeholder)}"></label>`;
  }).join("");

  return entryHeading(t("entry.freeform.gaps_title"))+
    `<p class="onb__explain">${esc(t("entry.freeform.gaps_lede"))}</p>`+
    notImportedHtml+
    (model.gapErrors.length?`<p class="entry__notice entry__notice--warn" role="alert">${esc(t("entry.freeform.gap_error"))}</p>`:"")+
    `<div class="entry__gaps-list">${gapRows}</div>`+
    `<div class="btnrow btnrow--primary-first"><button type="button" class="btn btn--cta" id="entryFreeformSubmitGaps">${esc(t("entry.freeform.gaps_submit"))}</button>`+
    `<button type="button" class="btn btn--steel" id="entryFreeformBackToReply">${esc(t("entry.freeform.back_to_reply"))}</button></div>`;
}

/** @param {string} app @param {FreeformModel} model */
function freeformAppLink(app,model){
  const program=model.source.trim();
  const spec=FREEFORM_APPS[app];
  if(!spec)return"";
  if(!program){
    return `<a class="btn btn--steel entry__freeform-app is-disabled" data-freeform-app="${esc(app)}"`+
      ` href="${esc(spec.base)}" target="_blank" rel="noopener noreferrer"`+
      ` aria-disabled="true" aria-describedby="entryFreeformNeeds"`+
      `>${esc(t(spec.label))}</a>`}
  const prompt=t("entry.freeform.prompt",{program});
  const directUrl=freeformAppUrl(app,prompt);
  if(directUrl){
    return `<a class="btn btn--steel entry__freeform-app" data-freeform-app="${esc(app)}"`+
      ` href="${esc(directUrl)}" target="_blank" rel="noopener noreferrer"`+
      `>${esc(t(spec.label))}</a>`}
  if(model.copiedApps.includes(app)){
    return `<a class="btn btn--steel entry__freeform-app" data-freeform-app="${esc(app)}" data-freeform-copied="true"`+
      ` href="${esc(spec.base)}" target="_blank" rel="noopener noreferrer"`+
      `>${esc(t(spec.copiedLabel))}</a>`}
  return `<button type="button" class="btn btn--steel entry__freeform-app" data-freeform-app="${esc(app)}" data-freeform-long="true"`+
    `>${esc(t(spec.copyLabel))}</button>`}
/** @param {FreeformModel} model */
function renderFreeformSourceStep(model){
  if(model.gapResult)return renderFreeformGapsStep(model);
  const program=model.source.trim();
  const lineCount=model.source?model.source.split(/\r?\n/).filter(Boolean).length:0;

  const summaryHtml=model.stage>1
    ?`<div class="entry__freeform-summary"><span>${esc(t("entry.freeform.source_summary",{lines:lineCount}))}</span><button type="button" class="btn btn--steel btn--sm" id="entryFreeformEditSource">${esc(t("entry.freeform.edit_source"))}</button></div>`
    :"";

  let bodyHtml="";
  if(model.stage===1){
    bodyHtml=
      `<label class="entry__field entry__field--area"><span>${esc(t("entry.freeform.input_label"))}</span>`+
      `<textarea id="entryFreeformIn" rows="7" maxlength="${FREEFORM_MAX_CHARS}" spellcheck="false" autocapitalize="off" placeholder="${esc(t("entry.freeform.input_placeholder"))}">${esc(model.source)}</textarea></label>`+
      `<p class="entry__hint" id="entryFreeformCount">${esc(countLabel(model))}</p>`+
      `<p class="entry__hint" id="entryFreeformNeeds"${program?" hidden":""}>${esc(t("entry.freeform.needs_input"))}</p>`+
      `<p class="entry__explain" role="note">${esc(t("entry.freeform.privacy"))}</p>`+
      `<button type="button" class="btn btn--cta" id="entryFreeformContinue"${program?"":" disabled"}>${esc(t("entry.freeform.continue"))}</button>`;
  }else if(model.stage===2){
    bodyHtml=
      entryGroupLab(t("entry.freeform.stage2_title"),"wand")+
      `<p class="entry__hint">${esc(t("entry.freeform.stage2_hint"))}</p>`+
      `<div class="entry__freeform-apps">${freeformAppLink("chatgpt",model)}${freeformAppLink("claude",model)}</div>`+
      `<details class="entry__freeform-preview"><summary>${esc(t("entry.freeform.preview_prompt"))}</summary><pre class="entry__freeform-prompt-preview">${esc(t("entry.freeform.prompt",{program}))}</pre></details>`+
      `<p class="entry__switch"><button type="button" class="btn btn--ghost" id="entryFreeformCopy">${esc(t("entry.freeform.copy"))}</button></p>`;
  }else if(model.stage===3){
    let unreadableNotice="";
    if(model.status==="unreadable"){
      unreadableNotice=
        `<div class="entry__notice entry__notice--warn" role="alert"><strong>${esc(t("entry.freeform.unreadable_title"))}</strong>`+
        `<p>${esc(t("entry.freeform.unreadable_body"))}</p>`+
        `<div class="btnrow"><button type="button" class="btn btn--steel" id="entryFreeformCopyRepair">${esc(t("entry.freeform.copy_repair_prompt"))}</button>`+
        `<button type="button" class="btn btn--ghost" id="entryFreeformTryAnother">${esc(t("entry.freeform.try_another"))}</button></div></div>`;
    }
    const invalidatedNotice=model.invalidated
      ?`<p class="entry__notice entry__notice--info" role="status">${esc(t("entry.freeform.edit_source_warning"))}</p>`
      :"";
    bodyHtml=
      invalidatedNotice+
      unreadableNotice+
      entryGroupLab(t("entry.freeform.stage3_title"),"clipboard")+
      `<p class="entry__hint">${esc(t("entry.freeform.stage3_hint"))}</p>`+
      // The fastest way back from the assistant, and the first thing under the
      // heading. Manual paste stays exactly where it was, one divider below.
      `<button type="button" class="btn btn--cta" id="entryFreeformClipboard">${esc(t("entry.freeform.clipboard_import"))}</button>`+
      `<p class="entry__notice entry__notice--warn" id="entryFreeformClipNote" role="alert"${model.clipboardNote?"":" hidden"}>`+
        `${esc(noteText(model.clipboardNote))}</p>`+
      `<p class="entry__divider">${esc(t("entry.freeform.clipboard_or"))}</p>`+
      `<label class="entry__field entry__field--area"><span class="visually-hidden">${esc(t("entry.freeform.stage3_title"))}</span>`+
      `<textarea id="entryFreeformOut" rows="7" spellcheck="false" autocapitalize="off" placeholder="${esc(t("entry.freeform.output_placeholder"))}">${esc(model.reply)}</textarea></label>`+
      `<button type="button" class="btn btn--cta" id="entryFreeformReview">${esc(t("entry.freeform.review"))}</button>`+
      `<div class="btnrow"><button type="button" class="btn btn--steel" id="entryFreeformTryAnother">${esc(t("entry.freeform.try_another"))}</button>`+
      `<button type="button" class="btn btn--ghost btn--destructive" id="entryFreeformStartOver">${esc(t("entry.freeform.start_over"))}</button></div>`;
  }

  return entryHeading(t("entry.freeform.title"))+`<p class="onb__explain">${esc(t("entry.freeform.lede"))}</p>`+
    (model.activeProgram?`<p class="entry__active" role="status">${esc(t("entry.active_notice"))}</p>`:"")+
    summaryHtml+
    `<div class="entry__freeform ph-no-capture">${bodyHtml}</div>`+
    `<div class="entry__switch entry__switch--doors"><button type="button" class="btn btn--ghost" id="entryFreeformFile">${esc(t("entry.freeform.to_file"))}</button>`+
    entryWriteOwnLink()+`</div>`}
return Object.freeze({renderSource:renderFreeformSourceStep,renderApps:(/** @type {FreeformModel} */ model)=>Object.keys(FREEFORM_APPS).map(app=>freeformAppLink(app,model)).join(""),countLabel,noteText});
}
