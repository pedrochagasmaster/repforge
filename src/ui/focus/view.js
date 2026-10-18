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
function padsHtml(model) {
  const {peek,rest,pads,restLabel}=model;
  const html=(pads||[]).map(pad=>{
    if(rest)return `<button type="button" class="restpad ${pad.className}"${peek?dead():` data-rest-act="${pad.action}"`}${pad.ariaLabel?` aria-label="${esc(pad.ariaLabel)}"`:""}>${esc(pad.text)}</button>`;
    return `<button type="button" class="stepbtn shelf__pad"${peek?dead():`${pad.attributes} data-dir="${pad.direction}"${pad.disabled?" disabled":""}`}>${esc(pad.text)}</button>`;
  }).join("");
  return `<div class="shelf__pads${rest?" shelf__pads--rest":""}" data-pads="${rest?"rest":"field"}"${rest?` role="group" aria-label="${esc(restLabel)}"`:""}>${html}</div>`;
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
    padsHtml(model)+
    `<button type="button" class="btn btn--cta btn--noarrow saveset"${peek?dead():` data-save="${esc(key)}"`}>${esc(label)}</button></div>`;
}
