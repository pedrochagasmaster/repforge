import {cloneSnapshot} from "../../training/model.js";
import {compareChronology as compareLogChronology} from "../../training/progress.js";
import {escapeHtml as esc} from "../format.js";
import {exerciseMedia,exerciseThumb,emptyThumb} from "../exercise-media.js";
import {foldSearch} from "./search.js";

/** @typedef {import('../../app/session.js').CustomExercise & {rank?:number,media?:string,mediaBg?:string,nameOnly?:boolean}} LibraryEntry
 * @typedef {import('../../app/session.js').Snapshot} Snapshot
 * @typedef {import('../../app/program.js').CustomMutation} CustomMutation
 * @typedef {{sets:number,min:number,max:number}} Configuration
 * @typedef {{entry:LibraryEntry,stagedCustomDefinition:LibraryEntry|null}} RepairChoice
 * @typedef {LibraryEntry|RepairChoice} CustomChoice
 * @typedef {(value:LibraryEntry|LibraryEntry[]|RepairChoice)=>unknown} PickHandler
 * @typedef {(value:CustomChoice)=>unknown} CustomHandler
 * @typedef {{title?:string|null,subtitle?:string,selected?:string[],exclude?:string[],extras?:LibraryEntry[],onCancel?:(()=>unknown)|null,repairSeed?:Partial<LibraryEntry>|null,quick?:boolean,day?:string|null,query?:string,muscle?:string|null,equipment?:string|null,tab?:string|null,leading?:{title?:string,ids?:string[]}|null,catalogOnly?:boolean,reasons?:string[]|null}} PickerBase
 * @typedef {PickerBase & ({mode?:'single',stageOnly?:false,onPick?:((entry:LibraryEntry)=>unknown)|null}|{mode:'multi',stageOnly?:false,onPick?:((entries:LibraryEntry[])=>unknown)|null}|{mode?:'single',stageOnly:true,onPick?:((choice:CustomChoice)=>unknown)|null})} PickerOptions
 * @typedef {{query:string,muscle:string|null,equipment:string|null,mode:'single'|'multi',onPick:PickHandler|null,onCancel:(()=>unknown)|null,stageOnly:boolean,repairSeed:Partial<LibraryEntry>|null,completed:boolean,choosing?:boolean,selected:Set<string>,exclude:Set<string>,extras:LibraryEntry[],leading:{title:string,ids:string[]},quick:boolean,day:string|null,tab:string|null,reasons:string[]|null,reason:string|null,reopen:PickerOptions}} PickerState
 * @typedef {{entry?:Partial<LibraryEntry>|null,onCancel?:(()=>unknown)|null,handoff?:boolean,repairHandoff?:boolean} & ({stageOnly?:false,onSave?:((entry:LibraryEntry)=>unknown)|null}|{stageOnly:true,onSave?:((choice:CustomChoice)=>unknown)|null}|{stageOnly:boolean,onSave?:((choice:CustomChoice)=>unknown)|null})} CustomOptions
 * @typedef {{id:string|null,sourceEntry:LibraryEntry|null,onSave:CustomHandler|null,onCancel:(()=>unknown)|null,stageOnly:boolean,repairHandoff:boolean,phase:string,duplicateAcknowledgedId:string|null,mutationId:string|null,mutationOperation:string|null,pendingMutation:CustomMutation|null,recoveryAttempt:boolean,recoveryNeedsAction:boolean,recoveryStatusKey:string|null,busyFocus:HTMLElement|null,deleteAction:string|null,deleteOperation:string|null,equipment:Set<string>,primary:Set<string>,secondary:Set<string>}} CustomState
 * @typedef {{day?:string,selected?:(string|[string,Configuration|null])[],step?:string,tab?:string,query?:string,muscle?:string|null,equipment?:string|null,editorScope?:boolean,returnTo?:HTMLElement|null}} LibraryOptions
 * @typedef {{day:string,tab:string,query:string,muscle:string|null,equipment:string|null,step:string,editorScope:boolean,selected:Map<string,Configuration|null>}} LibraryState
 * @typedef {{id:string,entry:LibraryEntry,cfg:Configuration}} ConfiguredRow
 * @typedef {(key:string,values?:Record<string,unknown>)=>string} Text
 * @typedef {{snapshot:()=>Snapshot,day:()=>string,libraryEntries:()=>LibraryEntry[],libraryEntry:(id:string)=>LibraryEntry|null,pickableExercises:()=>LibraryEntry[],customExercises:(snapshot?:Snapshot)=>LibraryEntry[],programEditorProgram:()=>{forDay:(day:string)=>import('../../training/model/internal/contracts.js').ExerciseRow[]}}} LibraryQueries
 * @typedef {{openModal:(sheet:HTMLElement,options:{initialFocus:HTMLElement|null,returnFocus:HTMLElement|null,onEscape:()=>unknown,scrim?:HTMLElement|null,delayHide?:number,handoff?:boolean})=>unknown,closeModal:(sheet:HTMLElement)=>Promise<boolean>,canTakeFocus:(element:Element|null)=>boolean,reducedMotion:()=>boolean,routePushBegin:(direction:string,options:{pushed:HTMLElement|null,under:HTMLElement|null})=>(()=>void)|null,routeViewEl:(view:string)=>HTMLElement|null,currentViewId:()=>string,resolveReturnFocus:(element:Element|null|undefined)=>HTMLElement|null,focusRoute:(selector:string|Element|null)=>unknown,routeHeading:(view:string)=>Element|string|null,returnToTab:(view:string)=>unknown,activeModal:()=>{el:HTMLElement}|null}} LibraryShell
 * @typedef {{setupOpen:()=>boolean,focusEntryEditorStatus:()=>unknown,showOnboardingView:()=>unknown,renderOnboarding:()=>unknown,setDayCollapsed:(day:string,on:boolean)=>unknown,synchronizeSetup:()=>unknown}} LibraryEditor
 * @typedef {{window:Window & typeof globalThis,queries:LibraryQueries,commands:{custom:ReturnType<typeof import('../../app/program.js').createCustomExerciseCommands>,program:ReturnType<typeof import('../../app/program.js').createProgramAdditionCommands>},model:ReturnType<typeof import('../../training/model.js').createProgramModel>,rules:{muscleTokens:readonly string[],equipment:readonly string[],customIdPrefix:string,normalizeMuscleAttribution:(value:unknown)=>{ok:boolean,tokens?:string[]}},copy:{t:Text,tOne:(key:string,count:number)=>string},format:{libraryName:(entry:LibraryEntry|null)=>string,muscleLabel:(name:string)=>string,dayLabel:(day:string)=>string,countText:(kind:string,count:number)=>string},shell:LibraryShell,editor:LibraryEditor,onChanged:()=>void,onNotice:(message:string)=>void,onCustomCreated:()=>void}} LibraryDependencies
 */

/** Picker, custom-definition form, library selection and preview own one UI
 * lifetime. All durable changes use named application commands; setup-editor
 * documents stay with their editor owner. No DOM work occurs on import.
 * @param {LibraryDependencies} options
 */
export function createLibraryController({window,queries,commands,model,rules,copy,format,shell,editor,onChanged,onNotice,onCustomCreated}){
const document=window.document,CSS=window.CSS,confirm=window.confirm.bind(window),location=window.location;
let disposed=false;
/** @type {Set<number>} */
const frames=new Set();
/** @type {Set<number>} */
const timers=new Set();
/** @param {()=>void} callback */
function requestAnimationFrame(callback){const handle=window.requestAnimationFrame(()=>{frames.delete(handle);if(!disposed)callback()});frames.add(handle);return handle}
/** @param {()=>void} callback @param {number} delay */
function setTimeout(callback,delay){const handle=window.setTimeout(()=>{timers.delete(handle);if(!disposed)callback()},delay);timers.add(handle);return handle}
/** @param {string} selector @returns {HTMLElement|null} */
const $=selector=>document.querySelector(selector);
/** @param {string} selector @returns {HTMLElement[]} */
const $$=selector=>[...document.querySelectorAll(selector)].filter(node=>node instanceof window.HTMLElement);
/** @param {string} selector @returns {HTMLInputElement|null} */
const input=selector=>{const node=$(selector);return node instanceof window.HTMLInputElement?node:null};
/** @param {string} selector @returns {HTMLInputElement[]} */
const inputs=selector=>$$(selector).filter(node=>node instanceof window.HTMLInputElement);
const {t,tOne}=copy;
const {libraryName,muscleLabel,dayLabel,countText}=format;
const {libraryEntry,pickableExercises,customExercises,programEditorProgram}=queries;
const {normalizeCustomExercises,isCustomLibraryId,libraryMuscleAttribution}=model;
const customExerciseInUse=commands.custom.inUse;
const {openModal,closeModal,canTakeFocus,reducedMotion,routePushBegin,routeViewEl,currentViewId,resolveReturnFocus,focusRoute,routeHeading,returnToTab}=shell;
const {focusEntryEditorStatus,showOnboardingView,renderOnboarding,setDayCollapsed}=editor;
/** @param {unknown} value */
const muscles=value=>rules.normalizeMuscleAttribution(value).tokens||[];
const uid=()=>window.crypto?.randomUUID?.()||`id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const CUSTOM_ID_PREFIX=rules.customIdPrefix;
const render=()=>onChanged(),toast=onNotice;
/** @param {CustomChoice} value @returns {value is RepairChoice} */
function isRepairChoice(value){return 'entry' in value&&typeof value.entry==='object'&&value.entry!==null&&'id' in value.entry}
const MUSCLE_TOKENS=rules.muscleTokens;
const PICKER_EQUIPMENT=rules.equipment;
/* Muscle filters lifters actually think in, each covering the tokens under it. */
/** @type {readonly (readonly [string,readonly string[]])[]} */
const PICKER_MUSCLE_GROUPS=Object.freeze([
  ["chest",["Chest"]],
  ["back",["Lats","Mid/upper back","Traps"]],
  ["shoulders",["Front delts","Side delts","Rear delts"]],
  ["arms",["Biceps","Triceps","Forearms"]],
  ["legs",["Quads","Hamstrings","Glutes","Adductors","Abductors","Calves"]],
  ["core",["Abs","Obliques","Spinal erectors"]],
]);

/** @type {PickerState|null} */
let pickerState=null;
/** @type {HTMLElement|null} */
let pickerReturn=null;
/** @type {CustomState|null} */
let customState=null;
/** @type {HTMLElement|null} */
let customReturn=null;

/** @param {LibraryEntry} e */
const exerciseSearchText=e=>foldSearch(`${e.name} ${e.namePt||""} ${e.primary||""} ${e.secondary||""}`);
/** @param {LibraryEntry} e @param {string} query @param {string|null} muscleGroup @param {string|null} equipment */
function exerciseMatches(e,query,muscleGroup,equipment){
  if(equipment&&!(e.equipment||[]).includes(equipment))return false;
  if(muscleGroup){
    const group=PICKER_MUSCLE_GROUPS.find(g=>g[0]===muscleGroup);
    const tokens=`${e.primary||""},${e.secondary||""}`.split(",");
    if(group&&!tokens.some(x=>group[1].includes(x)))return false}
  if(!query)return true;
  const hay=exerciseSearchText(e);
  return foldSearch(query).split(/\s+/).filter(Boolean).every(w=>hay.includes(w))}

/* Library ids already in the program, and names already logged. Both float to
   the top of the list: the movement somebody wants next is usually one they
   have met before. */
function programLibraryIds(){
  const ids=new Set();
  for(const e of queries.snapshot().program||[])if(e.libraryId)ids.add(String(e.libraryId));
  return ids}
/* What the lifter has actually trained, for promoting familiar movements in the
   picker. Library ids are the reliable half — names only match when the log was
   written in the language the picker is being read in. */
function loggedExerciseRefs(){
  const ids=new Set(),names=new Set();
  for(const r of queries.snapshot().log||[]){
    if(r?.performedLibraryId)ids.add(String(r.performedLibraryId));
    if(r?.performedName)names.add(foldSearch(r.performedName));
    if(r?.name)names.add(foldSearch(r.name))}
  for(const e of queries.snapshot().program||[])if(e.libraryId)ids.add(String(e.libraryId));
  return{ids,names}}

/* ---- Exercise artwork ----
   Twenty-four movements have licensed illustrations; every other built-in and
   every custom exercise renders a deliberately empty tile. The empty queries.snapshot() is
   an element with no src, not an <img> pointing at a file that is not there:
   a broken-image request is both a wasted fetch and a visible glyph. Both
   shapes are the same size so a mixed list stays aligned. */
/** @param {{libraryId?:string,media?:unknown,mediaBg?:unknown}|null|undefined} ref */
const exerciseRefEntry=ref=>ref?.libraryId!=null?libraryEntry(ref.libraryId):ref;
/** @param {LibraryEntry} e @param {{selected?:boolean,checkbox?:boolean}} [options] */
function pickerRow(e,{selected=false,checkbox=false}={}){
  const muscles=[e.primary,e.secondary].filter(Boolean).join(",").split(",").filter(Boolean);
  const shown=muscles.slice(0,3).map(muscleLabel);
  const eq=(e.equipment||[])[0]||null;
  return `<button type="button" class="pickrow${selected?" is-selected":""}" data-pick="${esc(e.id)}"`+
    (checkbox?` role="checkbox" aria-checked="${selected?"true":"false"}"`:"")+`>`+
    exerciseThumb(e,{size:"sm"})+
    `<span class="pickrow__main">`+
      `<span class="pickrow__name">${esc(libraryName(e))}</span>`+
      `<span class="pickrow__meta">${esc(shown.join(" · "))}</span>`+
    `</span>`+
    (eq?`<span class="pickrow__eq">${esc(t("picker.equipment."+eq))}</span>`:"")+
    `<span class="pickrow__tick" aria-hidden="true"></span>`+
  `</button>`}

/* The swap sheet's optional reason (Plan 071 §10): one tap, none by default,
   and picking an exercise never waits on it. The chips lead the scrolling list
   rather than the fixed tools, so enlarged text can never crowd the list out. */
const SUBSTITUTION_REASONS=Object.freeze(["equipment","preference","pain","crowded","other"]);
/** @type {Readonly<Record<string,string>>} */
const SUBSTITUTION_REASON_LABELS=Object.freeze({equipment:"picker.reason.equipment",preference:"picker.reason.preference",
  pain:"picker.reason.pain",crowded:"picker.reason.crowded",other:"picker.reason.other"});
function renderPickerReasons(){
  const view=pickerState;if(!view)return;
  const el=$("#exPickReasons");if(!el)return;
  const reasons=view?.reasons;
  if(!reasons){el.innerHTML="";return}
  el.innerHTML=`<p class="pick__reasons-label" id="exPickReasonsLabel">${esc(t("picker.reason_label"))}</p><div class="pick__reasons-chips">`+
    reasons.map(reason=>{const on=view.reason===reason;
      return `<button type="button" class="pchip${on?" is-active":""}" data-pick-reason="${reason}" aria-pressed="${on}">${esc(t(SUBSTITUTION_REASON_LABELS[reason]))}</button>`}).join("")+`</div>`;
  $$("#exPickReasons [data-pick-reason]").forEach(button=>button.onclick=()=>{if(pickerState!==view)return;
    const reason=button.dataset.pickReason||"";
    view.reason=view.reason===reason?null:reason;
    renderPickerReasons();
    $(`#exPickReasons [data-pick-reason="${reason}"]`)?.focus()})}
function renderPickerFilters(){
  const view=pickerState;if(!view)return;
  const el=$("#exPickFilters");if(!el||!view)return;
  /** @param {string} kind @param {string} val @param {string} label @param {boolean} active */
  const chip=(kind,val,label,active)=>
    `<button type="button" class="pchip${active?" is-active":""}" data-filter="${kind}" data-val="${esc(val)}" aria-pressed="${active?"true":"false"}">${esc(label)}</button>`;
  const parts=[chip("clear","",t("picker.filter_all"),!view.muscle&&!view.equipment)];
  for(const [key] of PICKER_MUSCLE_GROUPS)
    parts.push(chip("muscle",key,t("picker.group."+key),view.muscle===key));
  for(const eq of PICKER_EQUIPMENT)
    parts.push(chip("equipment",eq,t("picker.equipment."+eq),view.equipment===eq));
  el.innerHTML=parts.join("");
  $$("#exPickFilters .pchip").forEach(b=>b.onclick=()=>{if(pickerState!==view)return;
    const kind=b.dataset.filter;
    if(kind==="clear"){view.muscle=null;view.equipment=null}
    else if(kind==="muscle")view.muscle=view.muscle===b.dataset.val?null:(b.dataset.val||null);
    else view.equipment=view.equipment===b.dataset.val?null:(b.dataset.val||null);
    renderPickerFilters();renderPickerList()})}

const pickerCandidates=()=>(pickerState?.extras||[]).concat(pickableExercises());
/** @param {string} id */
const pickerEntry=id=>pickerCandidates().find(e=>e.id===id)||libraryEntry(id);

function renderPickerList(){
  const view=pickerState;if(!view)return;
  const el=$("#exPickList");if(!el||!view)return;
  const {query,muscle,equipment,mode,selected,exclude}=view;
  const multi=mode==="multi";
  // A quick-add tab narrows the source; typing in it searches everything,
  // because a lifter who types a name wants that name, not the tab.
  const source=view.quick&&!query?libTabList(view.tab):pickerCandidates();
  /** @param {LibraryEntry|null} e @returns {e is LibraryEntry} */
  const matches=e=>!!e&&!exclude.has(e.id)&&exerciseMatches(e,query,muscle,equipment);
  // A caller's leading group (the swapped slot's alternates) keeps its own
  // order and is not repeated in the groups below it.
  const leading=view.quick?[]:view.leading.ids.map(pickerEntry).filter(matches);
  const leadingIds=new Set(leading.map(e=>e.id));
  const all=source.filter(e=>!leadingIds.has(e.id)&&matches(e));
  const inProgram=programLibraryIds(),logged=loggedExerciseRefs();
  const custom=[],known=[],rest=[];
  /** @param {LibraryEntry} e */
  const familiar=e=>inProgram.has(e.id)||logged.ids.has(e.id)||
    logged.names.has(foldSearch(e.name))||logged.names.has(foldSearch(e.namePt||""));
  for(const e of all){
    if(isCustomLibraryId(e.id)||e.nameOnly)custom.push(e);
    else if(familiar(e))known.push(e);
    else rest.push(e)}
  // Rank before name. Alphabetical alone answers "row" with four barbell
  // variants before plain Barbell row, and opens the library on an assisted
  // kneeling dip — the staple for a movement should lead its own results.
  rest.sort((a,b)=>(a.rank??50)-(b.rank??50)||libraryName(a).localeCompare(libraryName(b)));
  /** @param {string} key @param {LibraryEntry[]} list */
  const section=(key,list)=>list.length
    ?`<p class="pick__section">${esc(t(key))}</p>`+list.map(e=>pickerRow(e,{selected:selected.has(e.id),checkbox:multi})).join("")
    :"";
  const html=view.quick&&!query
    ?(all.length?`<p class="pick__section">${esc(t("picker.tab_head."+view.tab))}</p>`+
      all.map(e=>pickerRow(e,{selected:selected.has(e.id),checkbox:multi})).join(""):"")
    :section(view.leading.title,leading)+
      section("picker.section_custom",custom)+
      section("picker.section_known",known)+
      section("picker.section_all",rest);
  el.innerHTML=(view?.reasons?`<div id="exPickReasons" class="pick__reasons" role="group" aria-labelledby="exPickReasonsLabel"></div>`:"")+
    (html||`<p class="pick__empty">${esc(t("picker.empty",{q:query}))}</p>`);
  renderPickerReasons();
  $$("#exPickList .pickrow").forEach(b=>b.onclick=()=>choosePicked(b.dataset.pick||""));
  const done=$("#exPickDone");
  if(done)done.textContent=multi&&selected.size?t("picker.done_count",{n:selected.size}):t("dialog.done")}

/** @param {string} id */
async function choosePicked(id){
  if(!pickerState||pickerState.choosing)return;
  const entry=pickerEntry(id);
  if(!entry)return;
  if(pickerState.mode==="multi"){
    if(pickerState.selected.has(id))pickerState.selected.delete(id);
    else pickerState.selected.add(id);
    renderPickerList();return}
  const active=pickerState,handler=active.onPick;
  active.choosing=true;
  active.completed=true;
  const sheet=$("#exPickSheet");if(sheet)sheet.setAttribute("aria-busy","true");
  try{if(handler)await handler(entry);await closeExercisePicker();focusEntryEditorStatus()}
  finally{if(pickerState===active)active.choosing=false;if(sheet)sheet.removeAttribute("aria-busy")}}

/* mode "single" fires onPick with one entry and closes; "multi" collects and
   fires once on Done with the entries in selection order. */
/** @param {PickerOptions} [options] */
function openExercisePicker(options={}){
  const {title=null,subtitle="",mode="single",selected=[],exclude=[],extras=[],onPick:providedPick=null,
  onCancel=null,stageOnly=false,repairSeed=null,quick=false,day:dayName=null,query="",muscle=null,equipment=null,tab=null,
  leading=null,catalogOnly=false,reasons=null}=options;
  /** @type {PickHandler|null} */
  const onPick=options.onPick?value=>{
    if(options.mode==='multi'){if(Array.isArray(value))return options.onPick?.(value);return;}
    if(options.stageOnly===true){if(!Array.isArray(value))return options.onPick?.(value);return;}
    if(!Array.isArray(value)&&!isRepairChoice(value))return options.onPick?.(value);
  }:null;
  const sheet=$("#exPickSheet"),scrim=$("#exPickScrim"),search=input("#exPickSearch");
  if(!sheet)return;
  pickerState={query:String(query||""),muscle,equipment,mode,onPick,onCancel,stageOnly,repairSeed,completed:false,
    selected:new Set(selected.filter(Boolean).map(String)),
    exclude:new Set(exclude.filter(Boolean).map(String)),
    extras:extras.filter(Boolean),
    leading:{title:leading?.title||"",ids:(leading?.ids||[]).filter(Boolean).map(String)},
    quick,day:dayName,tab:quick?(tab&&LIB_TABS.includes(tab)?tab:"suggested"):null,
    reasons:Array.isArray(reasons)?reasons:null,reason:null,
    // Kept so the custom-exercise detour can put this exact picker back, with
    // whatever was typed and filtered still in place.
    reopen:{...options,title,subtitle,exclude:[...exclude],extras:[...extras],onCancel,repairSeed,quick,day:dayName,leading,catalogOnly,reasons}};
  pickerReturn=document.activeElement instanceof window.HTMLElement?document.activeElement:null;
  const heading=$("#exPickTitle");if(heading)heading.textContent=title||t("picker.title");
  const sub=$("#exPickFor");if(sub)sub.textContent=subtitle||"";
  if(search)search.value=pickerState.query;
  const done=$("#exPickDone");
  if(done)done.classList.toggle("hidden",mode!=="multi");
  const tabs=$("#exPickTabs");if(tabs)tabs.classList.toggle("hidden",!quick);
  const full=$("#exPickFull");if(full)full.classList.toggle("hidden",!quick);
  const custom=$("#exPickCustom");if(custom)custom.classList.toggle("hidden",editor.setupOpen()||catalogOnly);
  if(quick)renderQuickTabs();
  renderPickerFilters();renderPickerList();
  document.body.classList.add("is-sheet-open");
  // The sheet takes focus, not the search box: focusing an input raises the
  // software keyboard, which covers half the phone before the lifter has asked
  // to type — and browsing the list is the common move, typing the rarer one.
  // The dialog element carries tabindex="-1" so it can hold focus without
  // joining the tab order, and Tab from it lands on the sheet's first control.
  openModal(sheet,{initialFocus:sheet,returnFocus:pickerReturn,onEscape:closeExercisePicker,scrim,
    delayHide:reducedMotion()?0:280});
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}

function closeExercisePicker(){
  const sheet=$("#exPickSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(shell.activeModal()?.el===sheet))return Promise.resolve(false);
  const active=pickerState,notifyCancel=!!active&&!active.choosing&&!active.completed&&typeof active.onCancel==="function";
  pickerReturn=null;
  return closeModal(sheet).then(result=>{if(notifyCancel)active?.onCancel?.();return result})}

async function confirmPickerSelection(){
  if(!pickerState||pickerState.mode!=="multi"||pickerState.choosing)return;
  const active=pickerState,handler=active.onPick;
  const picked=[...active.selected].map(pickerEntry).filter(entry=>entry!==null);
  active.choosing=true;
  active.completed=true;
  try{if(handler)await handler(picked);await closeExercisePicker()}
  finally{if(pickerState===active)active.choosing=false}}

function pickerResumeOptions(){
  if(!pickerState)return null;
  return Object.assign({},pickerState.reopen,{query:pickerState.query,muscle:pickerState.muscle,
    equipment:pickerState.equipment,tab:pickerState.tab,selected:[...pickerState.selected]})}

/* ---- custom exercise editor ---- */

/* Reachable editing, which the definition needs to be manageable at all: the
   sheet always supported an existing entry, but nothing ever passed one. */
/** @param {string} id */
function editCustomExercise(id){
  const entry=customExercises().find(e=>e.id===id);
  if(!entry)return;
  const reopen=libraryResumeOptions();
  openCustomExerciseSheet({entry,handoff:!!libFlow,
    onCancel:()=>{if(reopen)openLibrary(reopen)},
    onSave:()=>{if(reopen)openLibrary(reopen);else if(pickerState)renderPickerList()}})}

function renderCustomChips(){
  const view=customState;if(!view)return;
  if(!view)return;
  /** @param {string} val @param {string} label @param {boolean} active */
  const chip=(val,label,active)=>
    `<button type="button" class="pchip${active?" is-active":""}" data-val="${esc(val)}" aria-pressed="${active?"true":"false"}">${esc(label)}</button>`;
  const eq=$("#exCustomEquip");
  if(eq){
    eq.innerHTML=PICKER_EQUIPMENT.map(x=>chip(x,t("picker.equipment."+x),view.equipment.has(x))).join("");
    $$("#exCustomEquip .pchip").forEach(b=>b.onclick=()=>{if(customState!==view)return;
      const v=b.dataset.val||"";
      view.equipment.has(v)?view.equipment.delete(v):view.equipment.add(v);
      renderCustomChips()})}
  /** @type {[string,'primary'|'secondary'][]} */
  const muscleFields=[["#exCustomPrimary","primary"],["#exCustomSecondary","secondary"]];
  for(const [sel,key] of muscleFields){
    const box=$(sel);if(!box)continue;
    box.innerHTML=MUSCLE_TOKENS.map(m=>chip(m,muscleLabel(m),view[key].has(m))).join("");
    $$(`${sel} .pchip`).forEach(b=>b.onclick=()=>{if(customState!==view)return;
      const v=b.dataset.val||"";
      if(view[key].has(v))view[key].delete(v);
      else{view[key].add(v);
        // A muscle cannot be both; picking a side moves it.
        view[key==="primary"?"secondary":"primary"].delete(v)}
      renderCustomChips()})}}

/** @param {CustomState} active @param {string} phase */
function setCustomExercisePhase(active,phase){
  if(customState!==active)return false;
  const wasBusy=["saving","deleting","archiving","recovering","canceling"].includes(active.phase);
  const busy=["saving","deleting","archiving","recovering","canceling"].includes(phase);
  const sheet=$("#exCustomSheet");
  if(!wasBusy&&busy&&sheet?.contains(document.activeElement))active.busyFocus=document.activeElement instanceof window.HTMLElement?document.activeElement:null;
  active.phase=phase;
  if(sheet)sheet.dataset.phase=phase;
  if(busy)sheet?.setAttribute("aria-busy","true");
  else sheet?.removeAttribute("aria-busy");
  const form=$("#exCustomSheet .custom__form");if(form)form.inert=busy;
  const save=$("#exCustomSave");
  if(save){const key=phase==="saving"?"custom.saving":phase==="canceling"?"custom.closing":
    phase==="recovering"?active.mutationOperation==="archive"?"custom.finishing_archive":
      active.mutationOperation==="delete"?"custom.finishing_delete":"custom.finishing_save":"dialog.save";
    save.dataset.i18n=key;save.textContent=t(key)}
  for(const selector of ["#exCustomSave","#exCustomCancel","#exCustomDelete"]){
    const button=$(selector);if(button instanceof window.HTMLButtonElement)button.disabled=busy}
  const del=$("#exCustomDelete");
  if(del&&active.deleteAction){
    const pending=phase==="deleting"||phase==="archiving"||phase==="recovering";
    const key=pending&&active.mutationOperation==="archive"?"custom.archiving":
      pending&&active.mutationOperation==="delete"?"custom.deleting":active.deleteAction;
    del.dataset.i18n=key;del.textContent=t(key)}
  const recovery=$("#exCustomRecovery"),status=$("#exCustomRecoveryStatus");
  const recovering=phase==="recovering";
  if(recovery)recovery.hidden=!recovering;
  if(status){status.textContent=recovering?t(active.recoveryStatusKey||"custom.finishing_save"):"";
    status.setAttribute("aria-live","polite")}
  const retry=$("#exCustomRecoveryRetry");
  if(retry instanceof window.HTMLButtonElement){retry.hidden=!recovering||!active.recoveryNeedsAction;
    retry.disabled=!active.recoveryNeedsAction||active.recoveryAttempt}
  const reload=$("#exCustomRecoveryReload");if(reload)reload.hidden=!recovering||!active.recoveryNeedsAction;
  if(!busy&&phase==="editing"&&wasBusy&&active.busyFocus?.isConnected){
    try{active.busyFocus.focus({preventScroll:true})}catch{try{active.busyFocus.focus()}catch{}}
    active.busyFocus=null}
  return true}

/* stageOnly builds a definition without writing it. Import review consumes the
   raw entry; Share repair consumes the explicit provenance handoff below, but
   neither flow writes durable state before its final commit. */
/** @param {CustomOptions} [options] */
function openCustomExerciseSheet(options={}){
  const {entry=null,onSave:providedSave=null,onCancel=null,handoff=false,stageOnly=false,repairHandoff=false}=options;
  /** @type {CustomHandler|null} */
  const onSave=options.onSave?choice=>{
    if(options.stageOnly===true)return options.onSave?.(choice);
    if(!isRepairChoice(choice))return options.onSave?.(choice);
  }:null;
  const sheet=$("#exCustomSheet"),scrim=$("#exCustomScrim"),name=input("#exCustomName");
  if(!sheet)return;
  const inUse=entry?.id?customExerciseInUse(entry.id):false;
  customState={onCancel,id:entry?.id||null,sourceEntry:entry?.id&&typeof entry.name==='string'?{...cloneSnapshot(entry),id:entry.id,name:entry.name}:null,onSave,stageOnly,repairHandoff,
    phase:"editing",duplicateAcknowledgedId:null,mutationId:null,mutationOperation:null,
    pendingMutation:null,recoveryAttempt:false,recoveryNeedsAction:false,recoveryStatusKey:null,busyFocus:null,
    deleteAction:entry?(inUse?"custom.archive":"custom.delete"):null,
    deleteOperation:entry?(inUse?"archive":"delete"):null,
    // Empty for a new definition: defaulting every custom exercise to Machine
    // quietly mislabels dumbbell and cable work the wizard then filters on.
    equipment:new Set(entry?.equipment||[]),
    primary:new Set(String(entry?.primary||"").split(",").filter(Boolean)),
    secondary:new Set(String(entry?.secondary||"").split(",").filter(Boolean))};
  setCustomExercisePhase(customState,"editing");
  customReturn=document.activeElement instanceof window.HTMLElement?document.activeElement:null;
  if(name)name.value=entry?.name||"";
  setCustomNameError(null);
  const notes=input("#exCustomNotes");if(notes)notes.value=entry?.notes||"";
  const del=$("#exCustomDelete");
  if(del){const action=inUse?"custom.archive":"custom.delete";
    del.classList.toggle("hidden",!entry);del.dataset.i18n=action;del.textContent=t(action)}
  const used=$("#exCustomInUse");
  if(used)used.classList.toggle("hidden",!(entry&&inUse));
  customState.onCancel=onCancel;
  renderCustomChips();
  document.body.classList.add("is-sheet-open");
  // handoff lets this open over the picker: openModal stands the picker down
  // rather than refusing a second modal.
  openModal(sheet,{initialFocus:name,returnFocus:customReturn,onEscape:cancelCustomExerciseSheet,scrim,
    handoff,delayHide:reducedMotion()?0:280});
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}

function closeCustomExerciseSheet(){
  const sheet=$("#exCustomSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(shell.activeModal()?.el===sheet))return Promise.resolve(false);
  customReturn=null;
  return closeModal(sheet)}
/* Backing out of the custom form returns to the picker it came from, with the
   search and any multi-selection intact. Dropping the lifter back to the
   program instead would throw away a browse they never finished. */
async function cancelCustomExerciseSheet(){
  const active=customState;
  if(!active||active.phase!=="editing")return;
  const back=active.onCancel;
  setCustomExercisePhase(active,"canceling");
  await closeCustomExerciseSheet();
  if(customState!==active)return;
  setCustomExercisePhase(active,"finished");
  if(back)await back()}

/** @param {import('../../app/session.js').CommitResult|null} result */
function customExerciseMutationSucceeded(result){
  return result?.committed===true&&result?.settled===true}
/** @param {import('../../app/session.js').CommitResult|null} result */
function customExerciseMutationNeedsRecovery(result){
  return result?.status==="partial"||result?.status==="deferred"||
    result?.recoveryPending===true||result?.finalizationPending===true||
    result?.pendingJournalCleanup===true}
/** @param {CustomState} active @param {CustomMutation} mutation @param {Snapshot} snapshot @param {string} code */
function returnCustomDeleteToEditing(active,mutation,snapshot,code){
  const entry=customExercises(snapshot).find(value=>value.id===mutation.id);
  if(!entry)return false;
  const inUse=customExerciseInUse(mutation.id,snapshot);
  active.sourceEntry=cloneSnapshot(entry);
  active.equipment=new Set(entry.equipment||[]);
  active.primary=new Set(String(entry.primary||"").split(",").filter(Boolean));
  active.secondary=new Set(String(entry.secondary||"").split(",").filter(Boolean));
  active.deleteAction=inUse?"custom.archive":"custom.delete";
  active.deleteOperation=inUse?"archive":"delete";
  active.mutationOperation=null;
  active.mutationId=null;
  active.pendingMutation=null;
  active.recoveryAttempt=false;
  active.recoveryNeedsAction=false;
  active.recoveryStatusKey=null;
  const name=input("#exCustomName");if(name)name.value=entry.name||"";
  const notes=input("#exCustomNotes");if(notes)notes.value=entry.notes||"";
  renderCustomChips();
  $("#exCustomInUse")?.classList.toggle("hidden",!inUse);
  setCustomExercisePhase(active,"editing");
  if(inUse)toast(t("toast.custom_became_used"));
  else if(code==="custom_delete_changed_elsewhere")toast(t("toast.custom_changed"));
  return true}
/** @param {CustomState} active @param {CustomMutation} mutation */
async function recoverCustomExerciseMutation(active,mutation){
  if(customState!==active)return false;
  active.pendingMutation=mutation;
  active.recoveryAttempt=true;active.recoveryNeedsAction=false;
  active.recoveryStatusKey=mutation.operation==="archive"?"custom.finishing_archive":
    mutation.operation==="delete"?"custom.finishing_delete":"custom.finishing_save";
  setCustomExercisePhase(active,"recovering");
  let receipt=null;
  try{receipt=await commands.custom.recover(mutation)}catch{}
  if(customState!==active)return false;
  if(typeof receipt?.pendingJournalId==="string")mutation.pendingJournalId=receipt.pendingJournalId;
  if(customExerciseMutationSucceeded(receipt))return true;
  if(receipt?.semanticRecovery===true&&receipt.head&&
    (receipt.code==="custom_delete_became_used"||receipt.code==="custom_delete_changed_elsewhere")&&
    returnCustomDeleteToEditing(active,mutation,receipt.head,receipt.code))return false;
  active.recoveryAttempt=false;active.recoveryNeedsAction=true;
  active.recoveryStatusKey="custom.recovery.unresolved";
  setCustomExercisePhase(active,"recovering");
  $("#exCustomRecoveryRetry")?.focus();
  return false}
async function retryCustomExerciseRecovery(){
  const active=customState;
  if(!active||active.phase!=="recovering"||active.recoveryAttempt||!active.pendingMutation)return;
  const mutation=active.pendingMutation;
  const settled=await recoverCustomExerciseMutation(active,mutation);
  if(settled)await finishCustomExerciseMutation(active,{operation:mutation.operation,entry:mutation.entry})}
/** @param {CustomState} active @param {{operation:string,entry:LibraryEntry|null}} outcome */
async function finishCustomExerciseMutation(active,{operation,entry}){
  await closeCustomExerciseSheet();
  if(customState!==active)return;
  setCustomExercisePhase(active,"finished");
  const message=operation==="create"?"toast.custom_created":
    operation==="edit"?"toast.custom_saved":
    operation==="archive"?"toast.custom_archived":"toast.custom_deleted";
  toast(t(message));
  if(operation==="create")onCustomCreated();
  if(operation==="delete"||operation==="archive"){
    if(libFlow)renderLibrary();else if(pickerState)renderPickerList();
    return}
  if(active.onSave&&entry)await active.onSave(entry);
  else if(pickerState)renderPickerList()}

/** The name field carries its own error (R7 J-21): focus, aria-invalid and a note linked by aria-describedby, not a toast alone. */
const CUSTOM_NAME_ERROR_ID="exCustomNameError";
/** @param {string|null} message */
function setCustomNameError(message){
  const nameInput=input("#exCustomName");if(!nameInput)return;
  let note=document.getElementById(CUSTOM_NAME_ERROR_ID);
  if(!message){
    nameInput.removeAttribute("aria-invalid");
    if(nameInput.getAttribute("aria-describedby")===CUSTOM_NAME_ERROR_ID)nameInput.removeAttribute("aria-describedby");
    note?.remove();return}
  if(!note){
    note=document.createElement("p");note.id=CUSTOM_NAME_ERROR_ID;note.className="custom__error";note.setAttribute("role","alert");
    (nameInput.closest("label")||nameInput).after(note)}
  note.textContent=message;
  nameInput.setAttribute("aria-invalid","true");nameInput.setAttribute("aria-describedby",CUSTOM_NAME_ERROR_ID);
  try{nameInput.focus()}catch{}}
async function saveCustomExerciseSheet(){
  const active=customState;
  if(!active||active.phase!=="editing")return;
  const name=String(input("#exCustomName")?.value||"").trim();
  if(!name){setCustomNameError(t("toast.custom_needs_name"));return}
  if(!active.id){
    const twin=pickableExercises().find(e=>foldSearch(libraryName(e))===foldSearch(name)||foldSearch(e.name)===foldSearch(name));
    if(twin&&twin.id!==active.duplicateAcknowledgedId){
      // Offer what already exists before minting a near-identical second copy.
  if(confirm(t("confirm.custom_duplicate",{name:libraryName(twin)}))){
        const handler=active.onSave;
        setCustomExercisePhase(active,"saving");
        await closeCustomExerciseSheet();
        if(customState!==active)return;
        if(handler)await handler(active.repairHandoff
          ? {entry:twin,stagedCustomDefinition:null}
          : twin);
        setCustomExercisePhase(active,"finished");
        return}
      active.duplicateAcknowledgedId=twin.id}}
  // Equipment and a primary muscle are what make the definition usable: the
  // wizard filters on one and the volume audit groups by the other. Exact
  // duplicates above reuse their trusted definition instead of requiring the
  // custom form to restate those facts.
  if(!active.equipment.size){toast(t("toast.custom_needs_equipment"));return}
  if(!active.primary.size){toast(t("toast.custom_needs_primary"));return}
  const editing=!!active.id;
  const operation=editing?"edit":"create";
  const handler=active.onSave;
  if(!active.mutationId)active.mutationId=active.id||`${CUSTOM_ID_PREFIX}${uid()}`;
  active.mutationOperation=operation;
  setCustomExercisePhase(active,"saving");
  if(active.stageOnly){
    const staged=normalizeCustomExercises([{id:active.id||`${CUSTOM_ID_PREFIX}${uid()}`,name,
      equipment:[...active.equipment],
      primary:[...active.primary].join(","),
      secondary:[...active.secondary].join(","),
      notes:String(input("#exCustomNotes")?.value||"").trim()}])[0];
    await closeCustomExerciseSheet();
    if(customState!==active)return;
    if(handler&&staged){
      const choice=active.repairHandoff
        ? {entry:active.id?active.sourceEntry||staged:staged,
          stagedCustomDefinition:active.id?null:staged}
        : staged;
      await handler(choice);
    }
    setCustomExercisePhase(active,"finished");
    return}
  let saved;
  try{saved=await commands.custom.save({id:active.mutationId,name,
    equipment:[...active.equipment],
    primary:[...active.primary].join(","),
    secondary:[...active.secondary].join(","),
    notes:String(input("#exCustomNotes")?.value||"").trim()},
    {expectedEntry:editing?active.sourceEntry:null})}
  catch{setCustomExercisePhase(active,"editing");toast(t("toast.custom_save_failed"));return}
  if(customState!==active)return;
  const {result,entry}=saved;
  if(customExerciseMutationSucceeded(result)){
    await finishCustomExerciseMutation(active,{operation,entry});return}
  if(result&&entry&&active.mutationId&&customExerciseMutationNeedsRecovery(result)){
    const settled=await recoverCustomExerciseMutation(active,{operation,id:active.mutationId,entry,
      pendingJournalId:result.pendingJournalId||null});
    if(settled)await finishCustomExerciseMutation(active,{operation,entry});
    return}
  setCustomExercisePhase(active,"editing");
  toast(t(result?.code==="custom-exercise-changed"?"toast.custom_changed":"toast.custom_save_failed"))}

async function deleteCustomExerciseSheet(){
  const active=customState;
  if(!active?.id||!active.sourceEntry||active.phase!=="editing")return;
  const sourceEntry=active.sourceEntry;
  const operation=active.deleteOperation||"delete";
  active.mutationOperation=operation;
  setCustomExercisePhase(active,operation==="archive"?"archiving":"deleting");
  let result;
  try{result=await commands.custom.remove(active.id,
    {action:operation,expectedEntry:sourceEntry})}
  catch{setCustomExercisePhase(active,"editing");toast(t("toast.custom_save_failed"));return}
  if(customState!==active)return;
  if(!result){setCustomExercisePhase(active,"editing");toast(t("toast.custom_in_use"));return}
  if(customExerciseMutationSucceeded(result)){
    await finishCustomExerciseMutation(active,{operation,entry:sourceEntry});
    return}
  if(customExerciseMutationNeedsRecovery(result)){
    const settled=await recoverCustomExerciseMutation(active,{operation,id:active.id,
      entry:sourceEntry,pendingJournalId:result.pendingJournalId||null});
    if(settled)await finishCustomExerciseMutation(active,{operation,entry:sourceEntry});
    return}
  setCustomExercisePhase(active,"editing");
  if(result.code==="custom-exercise-became-used"){
    active.deleteOperation="archive";active.deleteAction="custom.archive";
    active.mutationOperation=null;
    const deleteButton=$("#exCustomDelete");
    if(deleteButton){deleteButton.dataset.i18n=active.deleteAction;deleteButton.textContent=t(active.deleteAction)}
    $("#exCustomInUse")?.classList.remove("hidden");
    toast(t("toast.custom_became_used"));return}
  toast(t(result?.code==="custom-exercise-changed"?"toast.custom_changed":"toast.custom_save_failed"))}


const LIB_TABS=["suggested","recent","yours"];
const LIB_PAGE_TABS=["search","browse","yours"];
/** @type {LibraryState|null} */
let libFlow=null;
/** @type {HTMLElement|null} */
let libReturn=null;
/** @type {{id:string,from:string,returnId:string}|null} */
let previewState=null;

/* What this day is short of. A day that already has two chest presses does not
   need a third suggested; one with no back work does. Ranked so the staple for
   an uncovered pattern leads. */
/** @param {string} dayName @param {number} [limit] */
function suggestedForDay(dayName,limit=6){
  const onDay=programEditorProgram().forDay(dayName);
  const have=new Set(onDay.map(e=>e.libraryId).filter(Boolean));
  const covered=new Set();
  for(const e of onDay)for(const m of muscles(e.primary))covered.add(m);
  const scored=[];
  for(const e of queries.libraryEntries()){
    if(have.has(e.id))continue;
    const prim=muscles(e.primary);
    const fresh=prim.some(m=>!covered.has(m));
    scored.push({e,score:(fresh?0:1)*100+(e.rank??50)})}
  scored.sort((a,b)=>a.score-b.score||libraryName(a.e).localeCompare(libraryName(b.e)));
  return scored.slice(0,limit).map(x=>x.e)}

/* Most recently trained first, so the movements a lifter keeps coming back to
   are the ones they see. Reads library ids, which survive a language change. */
/** @param {number} [limit] */
function recentExercises(limit=8){
  /** @type {LibraryEntry[]} */
  const seen=[];
  const ids=new Set();
  const log=[...(queries.snapshot().log||[])].sort((a,b)=>compareLogChronology(b,a));
  /** @param {string|undefined} id */
  const add=id=>{if(!id||ids.has(id))return;const entry=libraryEntry(id);if(!entry)return;ids.add(id);seen.push(entry)};
  for(const r of log){
    if(seen.length>=limit)break;
    if(r.performedLibraryId)add(String(r.performedLibraryId))}
  for(const e of queries.snapshot().program||[]){if(seen.length>=limit)break;add(e.libraryId)}
  return seen.slice(0,limit)}

const yourExercises=()=>customExercises().filter(e=>!e.archived);

/** @param {string|null} tab @param {{page?:boolean}} [options] */
function libTabList(tab,{page=false}={}){
  if(tab==="yours")return yourExercises();
  if(tab==="recent")return recentExercises();
  if(tab==="suggested")return suggestedForDay(libFlow?.day||queries.day());
  return pickableExercises()}

/* ---- quick add ---- */

function renderQuickTabs(){
  const view=pickerState;if(!view)return;
  const el=$("#exPickTabs");if(!el||!view?.quick)return;
  el.classList.remove("hidden");
  el.innerHTML=LIB_TABS.map(tab=>
    `<button type="button" role="tab" class="picktab${view.tab===tab?" is-active":""}" `+
    `aria-selected="${view.tab===tab?"true":"false"}" data-tab="${tab}">${esc(t("picker.tab."+tab))}</button>`).join("");
  $$("#exPickTabs .picktab").forEach(b=>b.onclick=()=>{if(pickerState!==view)return;view.tab=b.dataset.tab||"browse";renderQuickTabs();renderPickerList()})}

/* ---- full library page ---- */

/** @param {(string|[string,Configuration|null])[]} selected @returns {Map<string,Configuration|null>} */
function librarySelectionMap(selected){const out=new Map();
  for(const item of Array.isArray(selected)?selected:[]){
    const pair=Array.isArray(item)?item:[item,null],id=String(pair[0]||"");if(!id)continue;
    out.set(id,pair[1]?cloneSnapshot(pair[1]):null)}
  return out}
function libraryResumeOptions(){
  if(!libFlow)return null;
  return{day:libFlow.day,tab:libFlow.tab,query:libFlow.query,muscle:libFlow.muscle,
    equipment:libFlow.equipment,step:libFlow.step,editorScope:libFlow.editorScope,
    selected:[...libFlow.selected.entries()].map(cloneSnapshot)}}
/** @param {LibraryOptions} [options] */
function openLibrary({day:dayName=queries.day(),selected=[],step="browse",tab="browse",query="",muscle=null,equipment=null,editorScope=false,returnTo=null}={}){
  libFlow={day:dayName,tab:LIB_PAGE_TABS.includes(tab)?tab:"browse",query:String(query||""),muscle,equipment,step,
    editorScope:!!editorScope,selected:librarySelectionMap(selected)};
  // Reached through the picker, the control that was pressed is the picker's own and it is gone by now: the caller
  // names the control that opened the picker instead (R7 J-19).
  libReturn=returnTo||(document.activeElement instanceof window.HTMLElement?document.activeElement:null);
  const settle=routePushBegin("in",{pushed:$("#library"),under:routeViewEl(currentViewId())});
  document.body.classList.add("is-library");
  document.body.classList.remove("is-preview");
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="library"));
  window.scrollTo({top:0});
  const search=input("#libSearch");if(search)search.value=libFlow.query;
  renderLibrary();
  search?.focus({preventScroll:true});
  settle?.()}

/** @param {{toProgram?:boolean}} [options] */
function closeLibrary({toProgram=true}={}){
  const returnToOnboarding=!!libFlow?.editorScope&&editor.setupOpen();
  libFlow=null;
  const settle=toProgram?routePushBegin("out",{pushed:$("#library"),under:routeViewEl(returnToOnboarding?"onboarding":"program")}):null;
  document.body.classList.remove("is-library","is-preview");
  let back=resolveReturnFocus(libReturn);
  // The editor may have redrawn its Add control since: ask for its equivalent by day.
  if(!back&&libReturn instanceof Element&&libReturn.dataset?.role==="add-exercise")
    back=resolveReturnFocus($$(`[data-role="add-exercise"][data-day="${CSS.escape(libReturn.dataset.day||"")}"]`).find(canTakeFocus));
  if(back===document.body||back===document.documentElement)back=null;
  libReturn=null;
  if(toProgram){
    if(returnToOnboarding){showOnboardingView();renderOnboarding()}
    else returnToTab("program")}
  // Starting the push out first ends any push in still running, which keeps
  // the page beneath inert; a Back pressed mid-arrival would otherwise find
  // nothing it could focus and leave focus on the hidden library.
  settle?.();
  // Back lands on the control that opened the library, or else on the heading of the page it returns to.
  if(!(back&&focusRoute(back)))focusRoute(routeHeading(returnToOnboarding?"onboarding":"program"))}

/** @param {{through?:string|null}} [options] */
function renderLibrary({through=null}={}){
  const view=libFlow;if(!view)return;
  if(!view)return;
  const configuring=view.step==="configure";
  $("#libBrowse")?.classList.toggle("hidden",configuring);
  $("#libConfigure")?.classList.toggle("hidden",!configuring);
  const title=$("#libTitle");
  if(title)title.textContent=configuring?t("library.configure_title",{day:dayLabel(view.day)}):t("library.title");
  const step=$("#libStep");
  if(step){step.classList.remove("hidden");
    step.innerHTML=`<p class="libstep__lab">${esc(t("library.step",{n:configuring?2:1,total:2}))}</p>`+
      `<span class="libstep__bar${configuring?" is-done":""}" aria-hidden="true"></span>`+
      `<span class="libstep__bar${configuring?" is-done":""}" aria-hidden="true"></span>`}
  if(configuring)renderLibraryConfigure();else renderLibraryBrowse({through});
  $("#libCustom")?.classList.toggle("hidden",!!view.editorScope);
  renderLibraryBar()}

function renderLibraryTabs(){
  const view=libFlow;if(!view)return;
  const el=$("#libTabs");if(!el)return;
  el.innerHTML=LIB_PAGE_TABS.map(tab=>
    `<button type="button" role="tab" class="picktab${view.tab===tab?" is-active":""}" `+
    `aria-selected="${view.tab===tab?"true":"false"}" data-tab="${tab}">${esc(t("picker.tab."+tab))}</button>`).join("");
  $$("#libTabs .picktab").forEach(b=>b.onclick=()=>{if(libFlow!==view)return;view.tab=b.dataset.tab||"browse";renderLibrary()})}

function renderLibraryFilters(){
  const view=libFlow;if(!view)return;
  const el=$("#libFilters");if(!el)return;
  // Muscle and equipment are separate ideas, so they get separate rails here
  // rather than one undifferentiated row of chips.
  /** @param {string} kind @param {string} val @param {string} label @param {boolean} active */
  const chip=(kind,val,label,active)=>
    `<button type="button" class="pchip${active?" is-active":""}" data-lf="${kind}" data-val="${esc(val)}" aria-pressed="${active?"true":"false"}">${esc(label)}</button>`;
  const muscleRow=[chip("clear","",t("picker.filter_all"),!view.muscle&&!view.equipment)]
    .concat(PICKER_MUSCLE_GROUPS.map(([key])=>chip("muscle",key,t("picker.group."+key),view.muscle===key)));
  const equipRow=PICKER_EQUIPMENT.map(eq=>chip("equipment",eq,t("picker.equipment."+eq),view.equipment===eq));
  /** @param {string} id @param {string[]} items */
  const scroller=(id,items)=>`<div id="${id}" class="pick__filters pick__filters--row" `+
    `data-allow-horizontal-scroll="x" data-horizontal-scroll-cue="partial-last-chip" tabindex="0">${items.join("")}</div>`;
  el.innerHTML=scroller("libMuscleFilters",muscleRow)+scroller("libEquipmentFilters",equipRow);
  $$("#libFilters [data-allow-horizontal-scroll]").forEach(row=>row.onkeydown=(event)=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    const left=event.key==="Home"?-row.scrollWidth:event.key==="End"?row.scrollWidth:event.key==="ArrowLeft"?-80:80;
    row.scrollBy({left,behavior:"auto"});event.preventDefault();
  });
  $$("#libFilters .pchip").forEach(b=>b.onclick=()=>{if(libFlow!==view)return;
    const kind=b.dataset.lf;
    if(kind==="clear"){view.muscle=null;view.equipment=null}
    else if(kind==="muscle")view.muscle=view.muscle===b.dataset.val?null:(b.dataset.val||null);
    else view.equipment=view.equipment===b.dataset.val?null:(b.dataset.val||null);
    renderLibrary()})}

/** @param {{through?:string|null}} [options] */
function renderLibraryBrowse({through=null}={}){
  const view=libFlow;if(!view)return;
  renderLibraryTabs();renderLibraryFilters();
  const list=$("#libList");if(!list)return;
  const source=view.tab==="yours"?yourExercises():pickableExercises();
  const rows=source.filter(e=>exerciseMatches(e,view.query,view.muscle,view.equipment))
    .sort((a,b)=>(a.rank??50)-(b.rank??50)||libraryName(a).localeCompare(libraryName(b)));
  // The full catalog is over a thousand rows. The first screenfuls render now
  // and the rest follow a chunk per frame; a newer render abandons the old one.
  const render=++libraryRenderToken;
  // A row that focus must return to renders in the first pass.
  const needed=through?rows.findIndex(e=>e.id===through)+1:0;
  const first=Math.max(LIBRARY_FIRST_ROWS,needed);
  list.innerHTML=rows.length
    ?rows.slice(0,first).map(e=>libraryRowHtml(e)).join("")
    :`<p class="pick__empty">${esc(t("picker.empty",{q:view.query}))}</p>`;
  let next=first;
  const appendChunk=()=>{
    if(!view||render!==libraryRenderToken||!list.isConnected||next>=rows.length)return;
    list.insertAdjacentHTML("beforeend",rows.slice(next,next+LIBRARY_CHUNK_ROWS).map(e=>libraryRowHtml(e)).join(""));
    next+=LIBRARY_CHUNK_ROWS;requestAnimationFrame(appendChunk)};
  // The rest waits until the view's push has settled, so it never competes
  // with the transition for frames.
  if(next<rows.length)setTimeout(()=>requestAnimationFrame(appendChunk),LIBRARY_DEFER_MS);
  // One delegated handler serves every row, however many chunks arrive.
  list.onclick=event=>{
    if(!(event.target instanceof window.Element))return;
    const toggle=event.target.closest("[data-lib-toggle]");if(toggle)return toggleLibrarySelection(toggle instanceof window.HTMLElement?toggle.dataset.libToggle||"":"");
    const preview=event.target.closest("[data-lib-preview]");if(preview)return openExercisePreview(preview instanceof window.HTMLElement?preview.dataset.libPreview||"":"");
    const edit=event.target.closest("[data-lib-edit]");if(edit)return editCustomExercise(edit instanceof window.HTMLElement?edit.dataset.libEdit||"":"")}}
const LIBRARY_FIRST_ROWS=40,LIBRARY_CHUNK_ROWS=80,LIBRARY_DEFER_MS=450;
let libraryRenderToken=0;

/** @param {LibraryEntry} e */
function libraryRowHtml(e){
  const flow=libFlow;if(!flow)return "";
  const on=flow.selected.has(e.id);
  const mus=[libraryMuscleAttribution(e,"primary"),libraryMuscleAttribution(e,"secondary")].filter(Boolean).join(",").split(",").filter(Boolean).slice(0,2).map(muscleLabel);
  const eq=(e.equipment||[])[0];
  const meta=[mus.join(" · "),eq?t("picker.equipment."+eq):""].filter(Boolean).join(" · ");
  return `<div class="librow${on?" is-selected":""}" data-lib-row="${esc(e.id)}">`+
    `<button type="button" class="librow__preview" data-lib-preview="${esc(e.id)}" aria-label="${esc(t("library.preview_aria",{name:libraryName(e)}))}">`+
      exerciseThumb(e,{size:"md"})+
    `</button>`+
    `<div class="librow__text">`+
      `<p class="librow__name">${esc(libraryName(e))}</p>`+
      `<p class="librow__meta">${esc(meta)}</p>`+
      (isCustomLibraryId(e.id)&&!libFlow?.editorScope
        ?`<button type="button" class="librow__edit" data-lib-edit="${esc(e.id)}">${esc(t("library.edit"))}</button>`:"")+
    `</div>`+
    `<button type="button" class="librow__check${on?" is-on":""}" role="checkbox" aria-checked="${on?"true":"false"}" `+
      `data-lib-toggle="${esc(e.id)}" aria-label="${esc(t(on?"library.remove_aria":"library.add_aria",{name:libraryName(e)}))}"></button>`+
  `</div>`}

/** @param {string} id */
function toggleLibrarySelection(id){
  const view=libFlow;if(!view)return;
  if(!view)return;
  if(view.selected.has(id))view.selected.delete(id);
  else view.selected.set(id,null);
  // A toggle changes one row and the bar; rebuilding the whole catalog would
  // also drop the focus the lifter's tap just put on the checkbox.
  const row=$(`#libList [data-lib-row="${CSS.escape(id)}"]`);
  if(!row||view.step==="configure")return renderLibrary();
  const entry=libraryEntry(id),on=view.selected.has(id),check=row.querySelector("[data-lib-toggle]");
  row.classList.toggle("is-selected",on);
  if(check){check.classList.toggle("is-on",on);check.setAttribute("aria-checked",on?"true":"false");
    check.setAttribute("aria-label",t(on?"library.remove_aria":"library.add_aria",{name:libraryName(entry)}))}
  renderLibraryBar()}

function renderLibraryBar(){
  const view=libFlow;if(!view)return;
  const bar=$("#libBar"),count=$("#libBarCount"),primary=$("#libPrimary");
  if(!bar||!primary)return;
  const n=view.selected.size;
  bar.classList.toggle("is-hidden",n===0);
  if(count)count.textContent=n?t("library.selected",{n}):"";
  primary.textContent=view.step==="configure"
    ?t("library.save_day",{day:dayLabel(view.day)})
    :t("library.add_n",{n,day:dayLabel(view.day)});
  if(primary instanceof window.HTMLButtonElement)primary.disabled=n===0;
  syncLibraryBarClearance()}
function syncLibraryBarClearance(){
  const bar=$("#libBar"),wrap=$("#library .libwrap");if(!bar||!wrap)return;
  if(bar.classList.contains("is-hidden")){wrap.style.removeProperty("--libbar-clearance");return}
  wrap.style.setProperty("--libbar-clearance",`${Math.ceil(bar.getBoundingClientRect().height+16)}px`)}


/* ---- configure step ---- */

/** @returns {ConfiguredRow[]} */
function libraryConfigureRows(){
  if(!libFlow)return[];
  return [...libFlow.selected.entries()].flatMap(([id,cfg])=>{
    const entry=libraryEntry(id);
    return entry?[{id,entry,cfg:cfg||{sets:3,min:6,max:10}}]:[]});
}

function renderLibraryConfigure(){
  const view=libFlow;if(!view)return;
  const el=$("#libConfigureRows");if(!el)return;
  const rows=libraryConfigureRows();
  const count=$("#libConfigureCount");
  if(count)count.textContent=t("library.configure_count",
    {exercises:countText("exercises",rows.length),sets:countText("sets",rows.reduce((a,r)=>a+r.cfg.sets,0))});
  el.innerHTML=rows.map(r=>
    `<div class="libcfg" data-cfg="${esc(r.id)}">`+
      exerciseThumb(r.entry,{size:"md"})+
      `<div class="libcfg__body">`+
        `<p class="libcfg__name">${esc(libraryName(r.entry))}</p>`+
        `<div class="libcfg__fields">`+
          `<label class="libcfg__field"><span>${esc(t("program.exercise.sets"))}</span>`+
            `<input type="number" inputmode="numeric" min="1" step="1" data-cfg-id="${esc(r.id)}" data-cfg-field="sets" value="${r.cfg.sets}"></label>`+
          `<label class="libcfg__field"><span>${esc(t("program.exercise.min_reps"))}</span>`+
            `<input type="number" inputmode="numeric" min="1" step="1" data-cfg-id="${esc(r.id)}" data-cfg-field="min" value="${r.cfg.min}"></label>`+
          `<label class="libcfg__field"><span>${esc(t("program.exercise.max_reps"))}</span>`+
            `<input type="number" inputmode="numeric" min="1" step="1" data-cfg-id="${esc(r.id)}" data-cfg-field="max" value="${r.cfg.max}"></label>`+
        `</div>`+
      `</div>`+
      `<button type="button" class="libcfg__drop" data-cfg-drop="${esc(r.id)}" aria-label="${esc(t("library.remove_aria",{name:libraryName(r.entry)}))}">`+
        `<span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`+
    `</div>`).join("");
  inputs("#libConfigureRows [data-cfg-field]").forEach(inp=>{
    inp.onfocus=()=>inp.select();
    inp.oninput=()=>{
      const id=inp.dataset.cfgId||"",field=inp.dataset.cfgField;
      if(libFlow!==view||!field||!["sets","min","max"].includes(field))return;
      const cur=view.selected.get(id)||{sets:3,min:6,max:10};
      const next=Object.assign({},cur,{[field]:model.Exercise.posInt(inp.value,cur[field==='sets'?'sets':field==='min'?'min':'max'])});
      if(next.max<next.min)next.max=next.min;
      view.selected.set(id,next)}});
  $$("#libConfigureRows [data-cfg-drop]").forEach(b=>b.onclick=()=>{if(libFlow!==view)return;
    view.selected.delete(b.dataset.cfgDrop||"");
    if(!view.selected.size){view.step="browse"}
    renderLibrary()})}

async function commitLibrarySelection(){
  const flow=libFlow;if(!flow||!flow.selected.size)return null;
  if(flow.step!=="configure"){flow.step="configure";renderLibrary();window.scrollTo({top:0});return null}
  const rows=libraryConfigureRows();
  const editorScope=!!flow.editorScope;
  const result=await commands.program.addExercises({day:flow.day,rows,editorScope});
  if(libFlow!==flow)return result;
  const setupDraftAccepted=editorScope&&editor.setupOpen()&&result?.setupDraft===true&&
    result?.localOk===true&&result?.idbOk===true;
  if(!(result?.committed===true&&result?.settled===true)&&!setupDraftAccepted){
    toast(t("toast.program_save_failed"));return result}
  const n=rows.length,target=flow.day;
  setDayCollapsed(target,false);
  closeLibrary({toProgram:true});
  if(editorScope&&editor.setupOpen()){
    // The full-library detour commits through the shared program-editor
    // transaction, while the setup editor still owns its private document. Pull
    // the committed candidate back into that editor before the next action.
    // Every edit made before the detour was already staged in this same setup
    // draft, so discard here is a synchronization operation, not user-facing
    // data loss. A normal refresh would correctly report an external change as
    // a conflict because the editor's baseline is still the pre-detour copy.
    editor.synchronizeSetup();
  }else render();
  toast(tOne("toast.exercises_added",n));
  return result}

/* ---- exercise preview ---- */

/** @param {string} id */
function openExercisePreview(id){
  const entry=libraryEntry(id);if(!entry)return;
  previewState={id,from:libFlow?"library":"picker",returnId:id};
  const settle=routePushBegin("in",{pushed:$("#exercisePreview"),under:routeViewEl(currentViewId())});
  document.body.classList.add("is-preview");
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="exercisePreview"));
  window.scrollTo({top:0});
  renderExercisePreview();
  $("#previewBack")?.focus({preventScroll:true});
  settle?.()}

function closeExercisePreview(){
  const back=previewState?.from,returnId=previewState?.returnId;
  previewState=null;
  const settle=routePushBegin("out",{pushed:$("#exercisePreview"),under:routeViewEl(back==="library"&&libFlow?"library":"program")});
  document.body.classList.remove("is-preview");
  if(back==="library"&&libFlow){$$(".view").forEach(v=>v.classList.toggle("active",v.id==="library"));renderLibrary({through:returnId});
    requestAnimationFrame(()=>{const target=$(`[data-lib-preview="${CSS.escape(returnId||"")}"]`);if(target)target.focus({preventScroll:true})})}
  else{document.body.classList.remove("is-library");returnToTab("program")}
  settle?.()}

function renderExercisePreview(){
  const view=previewState;if(!view)return;
  const el=$("#previewBody");if(!el||!view)return;
  const e=libraryEntry(view.id);if(!e)return;
  const prim=muscles(libraryMuscleAttribution(e,"primary")).map(muscleLabel).join(" · ");
  const sec=muscles(libraryMuscleAttribution(e,"secondary")).map(muscleLabel).join(" · ");
  const eq=(e.equipment||[]).map(x=>t("picker.equipment."+x)).join(" · ");
  const inLibrary=!!libFlow;
  const selected=!!libFlow?.selected.has(e.id);
  el.innerHTML=
    `<p class="preview__eyebrow">${esc(prim)}</p>`+
    `<h2 class="preview__title">${esc(libraryName(e))}</h2>`+
    `<p class="preview__sub">${esc(eq)}</p>`+
    // A large illustration carries instructional content, so it is described
    // rather than hidden; the empty tile has nothing to describe.
    (exerciseMedia(e)
      ?`<img class="exthumb exthumb--lg" src="${esc(exerciseMedia(e))}" alt="${esc(t("preview.art_alt",{name:libraryName(e)}))}" decoding="async" width="768" height="768">`
      :`<span class="exthumb exthumb--lg exthumb--empty" aria-hidden="true"></span>`)+
    `<h3 class="preview__head">${esc(t("preview.muscles"))}</h3>`+
    `<dl class="preview__rows">`+
      `<div class="preview__row"><dt>${esc(t("program.exercise.primary"))}</dt><dd>${esc(prim||"—")}</dd></div>`+
      `<div class="preview__row"><dt>${esc(t("program.exercise.secondary"))}</dt><dd>${esc(sec||"—")}</dd></div>`+
    `</dl>`+
    (e.notes?`<h3 class="preview__head">${esc(t("program.exercise.setup_notes"))}</h3><p class="preview__notes">${esc(e.notes)}</p>`:"")+
    (inLibrary
      ?`<button type="button" class="btn btn--cta" id="previewAdd">${esc(t(selected?"preview.remove":"preview.add",{day:dayLabel(libFlow?.day||queries.day())}))}</button>`
      :"");
  const add=$("#previewAdd");
  if(add)add.onclick=()=>{if(previewState!==view)return;toggleLibrarySelection(e.id);closeExercisePreview()}}


/** @type {AbortController|null} */
let listenerLifetime=null;
let bound=false;
function bind(){
  if(bound||disposed)return;bound=true;listenerLifetime=new window.AbortController();
  const pkCancel=$("#exPickCancel");if(pkCancel)pkCancel.onclick=closeExercisePicker;
  const pkScrim=$("#exPickScrim");if(pkScrim)pkScrim.onclick=closeExercisePicker;
  const pkDone=$("#exPickDone");if(pkDone)pkDone.onclick=confirmPickerSelection;
  const pkSearch=input("#exPickSearch");
  if(pkSearch)pkSearch.oninput=()=>{if(pickerState){pickerState.query=pkSearch.value;renderPickerList()}};
  // Creating a custom exercise is the tail of a search that found nothing, so
  // the typed text becomes the new movement's name and the picker is handed
  // over rather than stacked under a second sheet.
  const pkCustom=$("#exPickCustom");
  if(pkCustom)pkCustom.onclick=()=>{
    const reopen=pickerResumeOptions();
    const selectedNow=reopen?.selected||[];
    const multi=pickerState?.mode==="multi";
    const stageOnly=pickerState?.stageOnly===true;
    const repairSeed=stageOnly&&pickerState?.repairSeed?pickerState.repairSeed:null;
    const onPick=pickerState?.onPick;
    const typed=String(input("#exPickSearch")?.value||"").trim();
    /** @param {string|null} extraId */
    const backToPicker=extraId=>{
      if(!reopen)return;
      openExercisePicker(Object.assign({},reopen,
        {selected:extraId?selectedNow.concat(extraId):selectedNow}))};
    const cancelRepair=stageOnly&&repairSeed?async()=>{
      const activePicker=pickerState;
      await closeCustomExerciseSheet();
      if(!activePicker||pickerState!==activePicker)return;
      activePicker.completed=true;
      if(typeof activePicker.onCancel==="function")activePicker.onCancel();
    }:null;
    const seed=repairSeed?{name:repairSeed.name||typed,equipment:repairSeed.equipment||[],primary:repairSeed.primary||"",secondary:repairSeed.secondary||""}:typed?{name:typed}:null;
    openCustomExerciseSheet({entry:seed,handoff:true,stageOnly,repairHandoff:stageOnly,
      onCancel:cancelRepair||(()=>backToPicker(null)),
      onSave:/** @param {CustomChoice} choice */ choice=>{
        // A multi-pick is still being assembled, so the picker comes back with
        // the new movement already ticked; a single pick is finished by it.
        const entry=isRepairChoice(choice)?choice.entry:choice;
        if(multi){backToPicker(entry.id);return}
        if(onPick)return onPick(stageOnly?choice:entry)}})};
  const cuCancel=$("#exCustomCancel");if(cuCancel)cuCancel.onclick=cancelCustomExerciseSheet;
  const cuScrim=$("#exCustomScrim");if(cuScrim)cuScrim.onclick=cancelCustomExerciseSheet;
  const cuSave=$("#exCustomSave");if(cuSave)cuSave.onclick=saveCustomExerciseSheet;
  const cuName=input("#exCustomName");if(cuName)cuName.addEventListener("input",()=>{if(cuName.getAttribute("aria-invalid")==="true")setCustomNameError(null)},{signal:listenerLifetime.signal});
  const cuDelete=$("#exCustomDelete");if(cuDelete)cuDelete.onclick=deleteCustomExerciseSheet;
  const cuRecoveryRetry=$("#exCustomRecoveryRetry");if(cuRecoveryRetry)cuRecoveryRetry.onclick=retryCustomExerciseRecovery;
  const cuRecoveryReload=$("#exCustomRecoveryReload");if(cuRecoveryReload)cuRecoveryReload.onclick=()=>location.reload();
  const libBack=$("#libBack");
  if(libBack)libBack.onclick=()=>{
    if(libFlow?.step==="configure"){libFlow.step="browse";renderLibrary();return}
    closeLibrary()};
  const libClose=$("#libClose");if(libClose)libClose.onclick=()=>closeLibrary();
  const libPrimary=$("#libPrimary");if(libPrimary)libPrimary.onclick=()=>commitLibrarySelection();
  const libSearch=input("#libSearch");
  if(libSearch)libSearch.oninput=()=>{if(libFlow){libFlow.query=libSearch.value;renderLibrary()}};
  const libCustom=$("#libCustom");
  if(libCustom)libCustom.onclick=()=>{
    const reopen=libraryResumeOptions();
    const typed=String(input("#libSearch")?.value||"").trim();
    openCustomExerciseSheet({entry:typed?{name:typed}:null,
      onCancel:()=>{if(reopen)openLibrary(reopen)},
      onSave:/** @param {LibraryEntry} entry */ entry=>{
        if(!reopen)return;
        // The definition the lifter just described is the one they were looking
        // for, so it comes back selected.
        const selected=librarySelectionMap(reopen.selected);selected.set(entry.id,null);
        openLibrary(Object.assign({},reopen,{selected:[...selected.entries()]}))}})};
  const previewBack=$("#previewBack");if(previewBack)previewBack.onclick=closeExercisePreview;
  const pkFull=$("#exPickFull");
  if(pkFull)pkFull.onclick=()=>{
    const resume=pickerResumeOptions(),target=pickerState?.day||queries.day(),opener=pickerReturn;
    closeExercisePicker().then(()=>openLibrary({day:target,query:resume?.query||"",muscle:resume?.muscle||null,
      equipment:resume?.equipment||null,editorScope:editor.setupOpen(),returnTo:opener}))};

  window.addEventListener('resize',syncLibraryBarClearance,{passive:true,signal:listenerLifetime.signal});
}
function dispose(){
  disposed=true;listenerLifetime?.abort();listenerLifetime=null;bound=false;libraryRenderToken++;
  for(const handle of frames)window.cancelAnimationFrame(handle);frames.clear();
  for(const handle of timers)window.clearTimeout(handle);timers.clear();
  for(const root of $$('#exPickSheet,#exPickScrim,#exCustomSheet,#exCustomScrim,#library,#exercisePreview')){
    for(const element of [root,...root.querySelectorAll('*')])if(element instanceof window.HTMLElement){element.onclick=null;element.oninput=null;element.onkeydown=null;}
  }
  pickerState=null;customState=null;libFlow=null;previewState=null;
}
return Object.freeze({bind,dispose,
choosePicked,openExercisePicker,closeExercisePicker,editCustomExercise,openCustomExerciseSheet,openLibrary,exerciseRefEntry,SUBSTITUTION_REASONS,
  pickerReason:()=>pickerState?.reason||null,
  pickerSelection:()=>pickerState?[...pickerState.selected]:null,
  readLibrary:()=>libFlow?{day:libFlow.day,tab:libFlow.tab,step:libFlow.step,query:libFlow.query,muscle:libFlow.muscle,equipment:libFlow.equipment,selected:[...libFlow.selected.keys()],selection:[...libFlow.selected.entries()].map(cloneSnapshot)}:null,
});
}
