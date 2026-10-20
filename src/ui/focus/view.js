/** @typedef {{count:number,open:boolean,fresh:boolean,peek:boolean,exerciseId:string,labelTemplate:string,setsWord:string}} LedgerToggle */
/** @typedef {{ordinal:number,indexHtml:string,done:boolean,open:boolean,editing:boolean,fresh:boolean,load:string,reps:string,rir:string,previousLine:string,editLabel:string,softLoad:boolean,softReps:boolean,softRir:boolean}} LedgerRow */
/** @typedef {{key:string,id:string,metricId?:string,selected:boolean,editing:boolean,soft:boolean,label:string,ariaLabel:string,shown:string,raw:unknown,placeholder?:string,effort?:boolean,effortValue?:string,effortPopupHtml?:string,inputMode?:string}} FieldModel */
/** @typedef {{action?:string,className?:string,ariaLabel?:string,text:string,attributes?:string,direction?:number,disabled?:boolean}} PadModel */
/** @typedef {{title:string,subtitle:string,rise:boolean,finish:boolean,actionLabel:string}} CompletionModel */
/** @typedef {{peek?:boolean,completion?:CompletionModel,key?:string,label?:string,editing?:boolean,fields?:readonly FieldModel[],rest?:boolean,restLabel?:string,pads?:readonly PadModel[]}} ShelfModel */
import { escapeHtml as esc } from "../format.js";
const dead=()=>` tabindex="-1"`;
/** @param {FieldModel} field @param {boolean} peek */
function fieldHtml(field,peek) {
  const {key,id,metricId,selected,editing,soft,label,ariaLabel,shown,raw,placeholder,effort,effortValue,effortPopupHtml="",inputMode="decimal"}=field;
  const live=selected&&editing&&!effort&&!peek;
  const cls=`shelf__field${selected?" is-sel":""}${soft?" is-untouched":""}${live?" is-editing":""}`;
  const face=`<span class="shelf__lab">${esc(label)}</span><span class="shelf__val">${esc(shown||"—")}</span>`;
  if(metricId) {
    const fieldId=`metric_${metricId}`,inputKey=`${key}_${fieldId}`;
    if(peek)return `<div class="${cls}" data-field="metric" data-metric="${esc(metricId)}"><span class="shelf__fieldbtn">${face}</span></div>`;
    const button=`<button type="button" class="shelf__fieldbtn" data-shelf-field="${esc(fieldId)}" data-set="${esc(key)}" aria-pressed="${selected?"true":"false"}">${face}</button>`;
    const input=`<input class="shelf__input" data-k="${esc(inputKey)}" data-metric-id="${esc(metricId)}" type="text" inputmode="${inputMode}" `+
      `enterkeyhint="next" aria-label="${esc(ariaLabel)}" autocomplete="off" value="${esc(raw)}" placeholder="${esc(placeholder)}"`+
      `${live?"":' tabindex="-1" aria-hidden="true"'}>`;
    const caption=live?`<span class="shelf__lab shelf__lab--edit" aria-hidden="true">${esc(label)}</span>`:"";
    return `<div class="${cls}" data-field="metric" data-metric="${esc(metricId)}" data-set="${esc(key)}"><span data-lv="${esc(fieldId)}"></span>${button}${input}${caption}</div>`;
  }
  if(peek)return `<div class="${cls}"><span class="shelf__fieldbtn">${face}</span></div>`;
  const hooks=effort?` data-effspin="${esc(key)}" data-e="${esc(effortValue)}" aria-describedby="effpop_${esc(key)}"`:"";
  const button=`<button type="button" class="shelf__fieldbtn" data-shelf-field="${id}" data-set="${esc(key)}" aria-pressed="${selected?"true":"false"}"${hooks}>${face}</button>`;
  const input=effort?"":`<input class="shelf__input" data-k="${esc(key)}_${id}" type="text" inputmode="${inputMode}" `+
    `enterkeyhint="${id==="rir"?"done":"next"}" aria-label="${esc(ariaLabel)}" autocomplete="off" value="${esc(String(raw??""))}"`+
    `${live?"":' tabindex="-1" aria-hidden="true"'}>`;
  const caption=live?`<span class="shelf__lab shelf__lab--edit" aria-hidden="true">${esc(label)}</span>`:"";
  return `<div class="${cls}" data-field="${id}" data-set="${esc(key)}">${button}${input}${caption}${effort?effortPopupHtml:""}</div>`;
}
/** @param {ShelfModel} model */
export function renderFocusPadsInner(model) {
  const {peek,rest,pads,restLabel}=model;
  const html=(pads||[]).map(pad=>{
    if(rest)return `<button type="button" class="restpad ${pad.className}"${peek?dead():` data-rest-act="${pad.action}"`}${pad.ariaLabel?` aria-label="${esc(pad.ariaLabel)}"`:""}>${esc(pad.text)}</button>`;
    return `<button type="button" class="stepbtn shelf__pad"${peek?dead():`${pad.attributes} data-dir="${pad.direction}"${pad.disabled?" disabled":""}`}>${esc(pad.text)}</button>`;
  }).join("");
  return html;
}
/** Complete shelf markup from readonly presentation facts; no state/commands/IO. */
/** @param {ShelfModel} model */
export function renderFocusShelf(model) {
  const {peek=false,completion,key,label,editing,fields}=model;
  if(completion) {
    const {title,subtitle,rise,finish,actionLabel}=completion;
    const motion=rise?" motion-rise":"";
    const cta=finish
      ?`<button type="button" class="btn btn--cta btn--noarrow${motion}"${peek?dead():" data-ffinish"}>${esc(actionLabel)}</button>`
      :`<button type="button" class="btn btn--cta${motion}"${peek?dead():" data-fnext"}>${esc(actionLabel)}</button>`;
    return `<div class="focus-shelf workshelf is-done" role="region" aria-label="${esc(title)}">`+
      `<div class="focus-done${motion}"><p class="focus-done__title">${esc(title)}</p><p class="focus-done__sub">${esc(subtitle)}</p></div>`+cta+`</div>`;
  }
  return `<div class="focus-shelf workshelf${editing?" is-editing":""}" role="region" aria-label="${esc(label)}">`+
    `<div class="shelf__fields">${(fields||[]).map(field=>fieldHtml(field,peek)).join("")}</div>`+
    renderFocusPads(model)+
    `<button type="button" class="btn btn--cta btn--noarrow saveset"${peek?dead():` data-save="${esc(key)}"`}>${esc(label)}</button></div>`;
}

/** @param {LedgerToggle|null} model */
export function renderFocusLedgerToggle(model) {
  if(!model)return "";
  const {count,open,fresh,peek,exerciseId,labelTemplate,setsWord}=model;
  return `<button type="button" class="ledger__more${fresh?" is-fresh":""}"${peek?dead():` data-ledgermore`} aria-expanded="${open?"true":"false"}" aria-controls="ledger_${esc(exerciseId)}">`+
    `<span>${esc(labelTemplate).replace("\u0000",`<span>${count}</span>`).replace("\u0001",`<span>${esc(setsWord)}</span>`)}</span>`+
    `<span class="icon-mask icon-mask--sm icon-mask--chev-down ledger__chev" aria-hidden="true"></span></button>`;
}
/** @param {{rows:readonly LedgerRow[],peek:boolean,exerciseId:string}} model */
export function renderFocusLedgerRows({rows,peek,exerciseId}) {
  return rows.map(row=>{
    /** @param {"softLoad"|"softReps"|"softRir"} field */
    const soft=field=>row[field]?" is-soft":"";
    const cells=`<span class="ledgerline__idx">${row.indexHtml}</span>`+
      `<span class="ledgerline__vals"><span class="fx-col${soft("softLoad")}" data-lv="load">${esc(row.load||"—")}</span>`+
      `<span class="fx-col${soft("softReps")}" data-lv="reps">${esc(row.reps)}</span>`+
      `<span class="fx-col${soft("softRir")}" data-lv="rir">${esc(row.rir)}</span></span>`+
      (row.previousLine?`<small class="ledgerline__prev">${esc(row.previousLine)}</small>`:"");
    const cls=`ledgerline${row.previousLine?" ledgerline--two":""}${row.open?" ledgerline--open":""}${row.fresh?" is-fresh":""}`;
    if(row.done)return `<button type="button" class="${cls}"${peek?dead():` data-editex="${esc(exerciseId)}" data-editn="${row.ordinal}" aria-label="${esc(row.editLabel)}"`}>${cells}</button>`;
    return `<div class="${cls}"${row.editing?' aria-current="true"':""} data-lrow="${row.ordinal}">${cells}</div>`;
  }).join("");
}
/** @param {{exerciseId:string,headers:{set:string,load:string,reps:string,effortHtml:string},toggleHtml:string,rowsHtml:string}} model */
export function renderFocusLedger({exerciseId,headers,toggleHtml,rowsHtml}) {
  return `<div class="ledgerline__head"><span>${esc(headers.set)}</span><span class="ledgerline__vals">`+
    `<span class="fx-col">${esc(headers.load)}</span><span class="fx-col">${esc(headers.reps)}</span>`+
    `<span class="fx-col">${headers.effortHtml}</span></span></div>`+toggleHtml+
    `<div class="ledger__rows" id="ledger_${esc(exerciseId)}">${rowsHtml}</div>`;
}
/** @param {{exerciseId:string,status:string,peek:boolean,name:string,meta:string,note:string,slotHtml:string,ledgerHtml:string,shelfHtml:string,nextName:string,nextTemplate:string}} model */
export function renderFocusCard(model) {
  const {exerciseId,status,peek,name,meta,note,slotHtml,ledgerHtml,shelfHtml,nextName,nextTemplate}=model;
  const noteHtml=note?`<p class="fx-note"><span class="icon-mask icon-mask--sm icon-mask--note" aria-hidden="true"></span><span>${esc(note)}</span></p>`:"";
  const nextRow=nextName?`<button type="button" class="fx-next"${peek?dead():" data-fnextrow"}><span>${esc(nextTemplate).replace("\u0000",`<b>${esc(nextName)}</b>`)}</span>`+
    `<span class="icon-mask icon-mask--sm icon-mask--chev-down fx-next__chev" aria-hidden="true"></span></button>`:"";
  return `<article class="exercise exercise--focus is-${status}${peek?" is-peek":" is-current"}"`+
    (peek?` aria-hidden="true" inert data-peek="${esc(exerciseId)}"`:` data-ex="${esc(exerciseId)}"`)+`>`+
    `<div class="fcard__context" role="region" aria-label="${esc(name)}" tabindex="${peek?-1:0}">`+
    `<div class="fx-head"><p class="focus-ex__meta">${esc(meta)}</p></div>`+slotHtml+noteHtml+
    `<div class="fcard__ledger">${ledgerHtml}</div>`+nextRow+`</div>`+shelfHtml+`</article>`;
}
/** @param {{label:string,previousHtml:string,currentHtml:string,nextHtml:string}} model */
export function renderFocusDeck({label,previousHtml,currentHtml,nextHtml}) {
  /** @param {string} inner @param {string} [side] */
  const slot=(inner,side)=>`<div class="deck__slot${side?` deck__slot--${side}`:""}"${side?' aria-hidden="true"':""}>${inner}</div>`;
  return `<div class="deck" id="focusDeck" role="group" aria-roledescription="carousel" aria-label="${esc(label)}"><div class="deck__track" id="focusTrack">`+
    (previousHtml?slot(previousHtml,"prev"):"")+slot(currentHtml)+(nextHtml?slot(nextHtml,"next"):"")+`</div></div>`;
}

/** @param {ShelfModel} model */
export function renderFocusPads(model) {
  const {rest,restLabel}=model;
  return `<div class="shelf__pads${rest?" shelf__pads--rest":""}" data-pads="${rest?"rest":"field"}"${rest?` role="group" aria-label="${esc(restLabel)}"`:""}>${renderFocusPadsInner(model)}</div>`;
}
