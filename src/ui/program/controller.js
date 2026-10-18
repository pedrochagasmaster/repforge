import {escapeHtml as esc} from "../format.js";

/** @typedef {Readonly<import('../../training/model.js').ExerciseRow> & {readonly [key:string]:unknown}} ExerciseView
 * @typedef {import('../../training/model.js').LibraryEntry} LibraryEntry
 * @typedef {{exercises:readonly ExerciseView[],days:()=>string[],forDay:(day:string)=>readonly ExerciseView[],find:(id:string)=>ExerciseView|undefined,volume:()=>ReadonlyMap<string,{d:number,p:number}>,toJSON:()=>ExerciseView[]}} ProgramView
 * @typedef {{name:string,started?:string|null,goal?:string,onboarded?:boolean,programDefinition?:unknown}} MetaView
 * @typedef {{programMeta:MetaView,log:import('../../app/session.js').HistoryRow[]}} SnapshotView
 * @typedef {{current:number|null,total:number,isComplete:boolean,isFinalWeek:boolean}} CycleView
 * @typedef {{logged:number,total:number,ratio:number}} AdherenceView
 * @typedef {{result?:{preview?:{programStructure?:{days?:{dayId:string,label?:string}[]}}}}} EntryView
 * @typedef {(key:string,values?:Record<string,unknown>)=>string} Text
 * @typedef {{title:string,subtitle:string,quick?:boolean,day?:string,exclude:(string|undefined)[],onPick:(entry:LibraryEntry)=>Promise<void>}} PickRequest
 * @typedef {{
 *   snapshot:()=>SnapshotView,
 *   day:()=>string,
 *   program:()=>ProgramView,
 *   hasProgramContent:()=>boolean,
 *   hasActiveProgram:()=>boolean,
 *   programEditorProgram:()=>ProgramView,
 *   programEditorSnapshot:()=>{programMeta:MetaView},
 *   defaultProgramMeta:(log:import('../../app/session.js').HistoryRow[])=>MetaView,
 *   mesocycleWeek:()=>CycleView,
 *   programAdherence:()=>AdherenceView,
 *   programProgressionHealth:()=>unknown,
 *   programVolumeCompliance:()=>{ratio:number}|null,
 *   programStatusLabel:(adherence:AdherenceView,health:unknown)=>string,
 *   dayMuscles:(day:string)=>string[],
 *   strategyIdFor:(exercise:ExerciseView)=>string,
 *   libraryEntry:(id:string)=>LibraryEntry|null,
 *   recommendation:(exercise:ExerciseView)=>{status:string,load?:number|null},
 * }} ProgramQueries
 * @typedef {{
 *   form:ReturnType<typeof import('../../app/program-form.js').createProgramFormCommands>,
 *   program:Pick<ReturnType<typeof import('../../app/program.js').createProgramCommands>,'updateMetadata'>,
 * }} ProgramCommands
 * @typedef {{
 *   setupOpen:()=>boolean,
 *   installedEditing:()=>boolean,
 *   installedMounted:()=>boolean,
 *   mountInstalled:()=>unknown,
 *   editInstalled:()=>void,
 *   armInstalledHistory:()=>unknown,
 *   focusEntryEditorStatus:()=>unknown,
 *   notice:()=>string|null,
 *   entryState:()=>EntryView|null,
 *   activationIssues:()=>string[],
 *   saveDraft:()=>Promise<{ok?:boolean}>,
 *   activate:()=>unknown,
 *   endBlock:()=>unknown,
 * }} ProgramEditor
 * @typedef {{
 *   read:()=>Record<string,unknown>,
 *   set:(key:string,value:unknown)=>unknown,
 * }} ProgramPreferences
 * @typedef {{
 *   t:Text,
 *   tOne:(key:string,count:number)=>string,
 * }} ProgramCopy
 * @typedef {{
 *   exerciseDisplayName:(exercise:ExerciseView)=>string,
 *   libraryName:(entry:LibraryEntry)=>string,
 *   dayLabel:(day:string)=>string,
 *   muscleLabel:(muscle:string)=>string,
 *   countText:(kind:string,count:number)=>string,
 *   fmtLoad:(load:number)=>string,
 *   unitLabel:()=>string,
 *   mesocycleWeekCopy:(cycle:CycleView,key?:string)=>string,
 *   programPrescriptionSummary:(exercise:ExerciseView)=>string,
 *   fmt:(value:number)=>string,
 * }} ProgramFormat
 * @typedef {{
 *   openExerciseView:(id:string,from?:string)=>unknown,
 *   openProgramTextSheet:()=>unknown,
 *   openShareSetupSheet:()=>unknown,
 * }} ProgramActions
 * @typedef {{
 *   window:Window & typeof globalThis,
 *   queries:ProgramQueries,
 *   commands:ProgramCommands,
 *   library:{openExercisePicker:(request:PickRequest)=>unknown},
 *   editor:ProgramEditor,
 *   preferences:ProgramPreferences,
 *   copy:ProgramCopy,
 *   format:ProgramFormat,
 *   onChanged:()=>void,
 *   onNotice:(message:string,options?:{assertive?:boolean})=>void,
 *   onDayChanged:(day:string)=>void,
 *   onDraftRemoved:()=>void,
 *   onSetupRequested:(origin:string|null,options?:{userInitiated?:boolean})=>void,
 *   onWorkoutChanged:()=>void,
 *   actions:ProgramActions,
 * }} ProgramOptions
 */

/** Program renders acknowledged facts and holds only raw JSON scratch text.
 * Field/row proposals and captured draft effects belong to application commands;
 * installed and setup editor lifetimes remain with their explicit editor owner.
 * @param {ProgramOptions} options
 */
export function createProgramController({window,queries,commands,library,editor,preferences,copy,format,onChanged,onNotice,onDayChanged,onDraftRemoved,onSetupRequested,onWorkoutChanged,actions}){
const document=window.document,CSS=window.CSS,confirm=window.confirm.bind(window);
/** @param {string} selector @returns {HTMLElement|null} */
const $=selector=>document.querySelector(selector);
/** @param {string} selector @returns {HTMLElement[]} */
const $$=selector=>[...document.querySelectorAll(selector)].filter((node)=>node instanceof window.HTMLElement);
/** These selectors address controls in Program's own templates.
 * @param {string} selector @returns {HTMLInputElement|null} */
const input=selector=>{const node=$(selector);return node instanceof window.HTMLInputElement?node:null};
/** @param {string} selector @returns {HTMLInputElement[]} */
const inputs=selector=>$$(selector).filter(node=>node instanceof window.HTMLInputElement);
const {t,tOne}=copy;
const {exerciseDisplayName,libraryName,dayLabel,muscleLabel,countText,fmtLoad,unitLabel,mesocycleWeekCopy,programPrescriptionSummary,fmt}=format;
const {hasProgramContent,hasActiveProgram,programEditorProgram,programEditorSnapshot,defaultProgramMeta,mesocycleWeek,programAdherence,programProgressionHealth,programVolumeCompliance,programStatusLabel,dayMuscles,strategyIdFor,libraryEntry}=queries;
const {focusEntryEditorStatus}=editor;
const {openExerciseView,openProgramTextSheet,openShareSetupSheet}=actions;
const recommendation=queries.recommendation;
const startOnboarding=onSetupRequested;
const promptEndBlock=editor.endBlock;
/** @param {number[]} values */
const sum=values=>values.reduce((total,value)=>total+Number(value||0),0);
let disposed=false;
const render=()=>{if(!disposed)onChanged()},toast=(/** @type {string} */message,/** @type {{assertive?:boolean}} */options={})=>{if(!disposed)onNotice(message,options)};
/** @param {boolean} hidden @param {{inert?:boolean}} [options] */
function setProgramMetadataHidden(hidden,{inert=false}={}){
  const meta=$("#programMeta");if(!meta)return;
  const trulyHidden=hidden&&inert;
  meta.hidden=trulyHidden;
  meta.setAttribute("aria-hidden",trulyHidden?"true":"false");
  meta.classList.toggle("visually-hidden",hidden);
  if(trulyHidden)meta.innerHTML="";
}
function renderProgram(){if(disposed)return;
  // Nothing to show: the tab is the same invitation Today carries, not a
  // summary of a program that does not exist. A lifter who emptied their own
  // program keeps the editor and its Add day — they have not been sent back to
  // the start — so onboarding is asked about too, not just content.
  const noProgram=!hasProgramContent()&&queries.snapshot()?.programMeta?.onboarded!==true,blank=$("#programNoProgram"),nav=document.querySelector("nav");
  if(nav)nav.dataset.elevation="floating";
  if(blank)blank.classList.toggle("hidden",!noProgram);
  if(noProgram){
    $("#program")?.classList.remove("program-ledger");
    setProgramMetadataHidden(true,{inert:true});
    for(const sel of["#programOverview","#programMeta","#programBlockBanner","#programEditorWrap","#programEditToggle"]){
      const el=$(sel);if(el)el.classList.add("hidden")}
    const cta=$("#programSetupProgram");
    if(cta)cta.onclick=()=>{if(disposed)return;return startOnboarding(null,{userInitiated:true})};
    return}
  for(const sel of["#programOverview","#programMeta","#programEditToggle"]){
    const el=$(sel);if(el)el.classList.remove("hidden")}
  $("#programEditorWrap")?.classList.remove("hidden");
  renderProgramOverview();
  const view=$("#program"),ov=$("#programOverview"),ed=$("#programEditorWrap"),tog=$("#programEditToggle");
  view?.classList.toggle("program-editor-installed",editor.installedEditing());
  view?.classList.toggle("program-ledger",!editor.installedEditing());
  if(ov)ov.classList.toggle("is-hidden",editor.installedEditing());
  if(ed)ed.classList.toggle("is-hidden",!editor.installedEditing());
  // The installed editor keeps the existing metadata DOM for its production edit
  // seam, but leaves it out of the visual layout like the prior editor did.
  setProgramMetadataHidden(editor.installedEditing());
  if(tog){tog.textContent=editor.installedEditing()?t("program.done_editing"):t("program.edit");tog.dataset.actionRole="expansion";tog.setAttribute("aria-expanded",editor.installedEditing()?"true":"false")}
  const end=$("#endBlock"),lede=ed?.querySelector(":scope > .program-editor-lede"),addDay=$("#addDay");
  // Advanced remains part of the installed editor. It is inside the editor
  // host, so hiding the disclosure here would strand the raw import/export
  // controls whenever the visual editor is open.
  [end,lede,addDay].forEach(el=>el?.classList.toggle("hidden",editor.installedEditing()));
  if(editor.installedEditing()){if(nav)nav.dataset.elevation="persistent-action";editor.armInstalledHistory();if(!editor.installedMounted())editor.mountInstalled();return}
  renderProgramHeader();renderProgramEditor();
  // Candidate edits can invalidate a paired relation while the exercise picker
  // is closing. Focus after the editor DOM has been rebuilt, rather than racing
  // the picker animation's one-shot focus attempt.
  if(editor.setupOpen())focusEntryEditorStatus()}
/** The strategy that sets an exercise's next load, as the lifter names it. */
/** @param {ExerciseView} ex */
function programStrategyName(ex){
  const id=strategyIdFor(ex);
  /** @type {Record<string,string>} */
  const names={range:t("program.progression.strategy.range"),rep_goal:t("program.progression.strategy.rep_goal"),
    effort_target:t("program.progression.strategy.effort_target"),anchor_backoff:t("program.progression.strategy.anchor_backoff"),
    manual:t("program.progression.strategy.manual")};
  return names[id]||t("program.progression.strategy.unsupported")}
/** Names as a spoken list: each name keeps its own element and the separators are decoration. */
/** @param {string[]} items */
function programNameList(items){
  return items.map((value,i)=>(i?`<span aria-hidden="true"> · </span>`:"")+`<span>${esc(value)}</span>`).join("")}
/** One ledger row of the Program overview: the exercise and its strategy, sets x range, and the load
 *  `recommendation()` says comes next with the verdict mark. A manual row, or one with no history, has no
 *  load to show: the program carries no authored load yet. */
/** @param {ExerciseView} e */
function programRowHtml(e){
  const rec=recommendation(e),move=rec.status==="add"||rec.status==="add2"?"up":rec.status==="reduce"?"down":"",
    showLoad=rec.status!=="manual"&&rec.load!=null&&Number.isFinite(+rec.load);
  const mark=move?`<span class="rxrow__mark" aria-hidden="true"><span class="verdictmark verdictmark--${move}"><span class="verdictmark__glyph"></span></span></span>`:"";
  const word=move==="up"?t("rec.add.label"):move==="down"?t("rec.reduce.label"):"";
  return `<button type="button" class="rxrow" data-exopen="${esc(e.id)}" data-action-role="navigation">`+
    `<span class="rxrow__name">${esc(exerciseDisplayName(e))}<span class="rxrow__sub">${esc(programStrategyName(e))}</span></span>`+
    `<span class="rxrow__target">${esc(e.hasRepTarget===false?programPrescriptionSummary(e):`${e.sets} × ${e.min}–${e.max}`)}</span>`+
    `<span class="rxrow__load"${showLoad?` data-parity-target="${esc(e.id)}"`:""}>${showLoad?mark+(word?`<span class="visually-hidden">${esc(word)} </span>`:"")+esc(fmtLoad(rec.load??0)):""}</span></button>`}
function renderProgramOverview(){const el=$("#programOverview");if(!el)return;
  const meta=queries.snapshot().programMeta||defaultProgramMeta(queries.snapshot().log),mc=mesocycleWeek(),ad=programAdherence(),health=programProgressionHealth();
  const ds=queries.program().days(),goal=meta.goal?t("onb.goal."+meta.goal+".label")||meta.goal:"";
  const segs=mc.total||6,cur=mc.current||0;
  const plainWeek=!mc.isComplete&&!mc.isFinalWeek&&mc.current!=null;
  const lede=goal&&plainWeek?t("program.overview.lede",{goal,days:ds.length,n:mc.current,total:mc.total})
    :[goal,tOne("program.days_per_week",ds.length)].filter(Boolean).join(" · ");
  let daysHtml="";
  ds.forEach((d,i)=>{const exs=queries.program().forDay(d),sets=sum(exs.map(e=>e.sets)),mus=dayMuscles(d).map(muscleLabel);
    daysHtml+=`<section class="prog-day" aria-labelledby="progDay${i}"><div class="prog-day__head"><h4 class="prog-day__title" id="progDay${i}">${esc(dayLabel(d))}</h4>`+
      `<p class="prog-day__meta">${mus.length?programNameList(mus)+`<span aria-hidden="true"> · </span>`:""}<span>${esc(sets===1?t("history.sets.one",{n:sets}):t("entry.catalogue.sets_exact",{n:sets}))}</span></p></div>`+
      `<div class="prog-cols" aria-hidden="true"><span>${esc(t("stats.exercise"))}</span><span>${esc(t("ledger.col.sets_range"))}</span><span>${esc(t("ledger.col.next",{unit:unitLabel()}))}</span></div>`+
      (i===0?`<p class="prog-legend">${esc(t("program.overview.legend"))}</p>`:"")+
      exs.map(programRowHtml).join("")+`</section>`});
  const planned=queries.program().volume();let plannedTotal=0;for(const[,v] of planned)plannedTotal+=v.d+v.p;
  el.innerHTML=`<h3 class="prog-overview__name">${esc(meta.name||t("untitled_program"))}</h3>`+
    `<p class="prog-overview__meta">${esc(lede)}</p>`+
    (!(goal&&plainWeek)&&(mc.current!=null||mc.isComplete)?`<p class="prog-overview__week">${esc(mesocycleWeekCopy(mc))}</p>`:"")+
    (mc.current!=null||mc.isComplete?`<div class="segbar" aria-hidden="true" data-progress-dimension="block" data-progress-scope="active-program-week">${Array.from({length:segs},(_,i)=>`<span class="segbar__seg${i+1<Math.min(cur,segs)||mc.isComplete?" is-done":i+1===cur?" is-current":""}"></span>`).join("")}</div>`:"")+
    `<p class="prog-overview__status">${esc(t("program.overview.status",{status:programStatusLabel(ad,health),n:ad.logged,m:ad.total}))}</p>`+
    daysHtml+
    `<p class="section-label">${esc(t("program.planned_volume_label"))}</p>`+
    `<button type="button" class="listrow" id="seeVolumeAudit" data-action-role="navigation"><div class="listrow__main"><div class="listrow__title">${esc(t("program.effective_sets",{n:fmt(plannedTotal)}))}</div></div>`+
    `<span class="listrow__meta">${esc(t("program.see_audit"))}<span class="chevron" aria-hidden="true"></span></span></button>`+
    // Nothing to read out when the program has no days left, so the row waits for one.
    (ds.length?`<button type="button" class="listrow" id="exportProgramText" data-action-role="navigation"><div class="listrow__main"><div class="listrow__title">${esc(t("program.export_text"))}</div>`+
      `<div class="listrow__sub">${esc(t("program.export_text.sub"))}</div></div><span class="chevron" aria-hidden="true"></span></button>`:"")+
    (ds.length?`<button type="button" class="listrow" id="shareProgramSetup" data-action-role="navigation"><div class="listrow__main"><div class="listrow__title">${esc(t("program.share_setup"))}</div>`+
      `<div class="listrow__sub">${esc(t("program.share_setup_sub"))}</div></div><span class="chevron" aria-hidden="true"></span></button>`:"")+
    `<button type="button" class="listrow" id="reviewBlockLink" data-action-role="navigation" style="border-bottom:0"><div class="listrow__main"><div class="listrow__title">${esc(t("program.review_block"))}</div></div><span class="chevron" aria-hidden="true"></span></button>`;
  $$("#programOverview [data-exopen]").forEach(b=>b.onclick=()=>{if(disposed)return;if(b.dataset.exopen)openExerciseView(b.dataset.exopen,"program")});
  const audit=$("#seeVolumeAudit");if(audit)audit.onclick=()=>{if(disposed)return;editor.editInstalled();renderProgram()};
  const asText=$("#exportProgramText");if(asText)asText.onclick=()=>{if(!disposed)openProgramTextSheet()};
  const shareSetup=$("#shareProgramSetup");if(shareSetup)shareSetup.onclick=()=>{if(!disposed)openShareSetupSheet()};
  const rev=$("#reviewBlockLink");if(rev)rev.onclick=()=>{if(!disposed)promptEndBlock()}}

function renderProgramChips(){
  const top=$("#pmetaChipsTop"),bottom=$("#pmetaChipsBottom");if(!top||!bottom)return;
  const ad=programAdherence(),mc=mesocycleWeek(),health=programProgressionHealth(),vol=programVolumeCompliance();
  const status=programStatusLabel(ad,health);
  const weekChip=(mc.current!=null||mc.isComplete)?`<span class="pmeta__chip">${esc(mesocycleWeekCopy(mc,"program.week_chip"))}</span>`:"";
  const volChip=vol?`<span class="pmeta__chip">${esc(t("program.volume_chip",{pct:Math.round(vol.ratio*100)}))}</span>`:"";
  top.innerHTML=`${weekChip}<span class="pmeta__chip pmeta__chip--status">${esc(status)}</span>`;
  bottom.innerHTML=`<span class="pmeta__chip">${esc(t("program.days_last_7",{done:ad.logged,planned:ad.total}))}</span>${volChip}`;
}

function renderProgramHeader(){
  const el=$("#programMeta");if(!el)return;
  setProgramMetadataHidden(false);
  if(!editor.setupOpen()&&document.activeElement?.closest("#programMeta"))return;
  if(editor.setupOpen()){
    const snapshot=programEditorSnapshot(),meta=snapshot.programMeta;
    const issues=editor.activationIssues();
    const saveError=editor.notice()==="save_conflict"?t("entry.save_conflict.body"):
      editor.notice()==="save_failed"?t("entry.save_failed.body"):null;
    const progressionError=issues.some(issue=>issue.startsWith("progression_incompatible:"));
    const emptyDays=issues.filter(issue=>issue.startsWith("day_empty:"))
      .map(issue=>dayLabel(editor.entryState()?.result?.preview?.programStructure?.days
        ?.find(item=>item.dayId===issue.slice("day_empty:".length))?.label||issue.slice("day_empty:".length)));
    const issueStatus=issues.some(issue=>issue.startsWith("progression_incompatible:"))
      ?t("entry.editor.progression_invalid")
      :issues.some(issue=>issue.startsWith("exercise_invalid:"))
        ?t("entry.editor.exercise_invalid")
        :emptyDays.length?t("entry.editor.empty_days",{days:emptyDays.join(", ")})
          :issues.length?t("entry.editor.incomplete",{n:issues.length}):t("entry.editor.ready");
    const status=saveError||issueStatus;
    const activateLabel=hasActiveProgram()?t("entry.preview.activate_replace"):t("entry.preview.activate_first");
    el.innerHTML=`<p class="pmeta__draft"><span class="pmeta__draft-mark" aria-hidden="true"></span>${esc(t("entry.preview.lede"))}</p>`+
      `<label class="pmeta__name">${esc(t("program.name"))}<input id="programName" type="text" value="${esc(meta.name)}" maxlength="80"></label>`+
      `<p class="entry__active" id="entryEditorStatus" role="${saveError||progressionError?"alert":"status"}" aria-live="${saveError||progressionError?"assertive":"polite"}" tabindex="-1">${esc(status)}</p>`+
      `<div class="btnrow btnrow--primary-first">`+
      `<button type="button" class="btn btn--cta" id="entryEditorActivate"${issues.length||saveError?" disabled aria-describedby=\"entryEditorStatus\"":""}>${esc(activateLabel)}</button>`+
      `<button type="button" class="btn btn--steel" id="entryEditorSave">${esc(t("entry.editor.save"))}</button></div>`;
    const name=input("#programName");if(name)name.onchange=async()=>{if(disposed)return;
      const result=await commands.form.updateEditorName(name.value);if(disposed)return;if(result.localOk||result.idbOk)renderProgram()};
    const save=$("#entryEditorSave");if(save)save.onclick=async()=>{if(disposed)return;
      const result=await editor.saveDraft();if(disposed)return;
      if(result?.ok){renderProgram();toast(t("entry.editor.saved"))}
      else $("#entryEditorStatus")?.focus?.()};
    const activate=$("#entryEditorActivate");if(activate)activate.onclick=()=>{if(disposed)return;return editor.activate()};
    return}
  const meta=queries.snapshot().programMeta||defaultProgramMeta(queries.snapshot().log);
  el.innerHTML=
    `<div class="pmeta__row">`+
      `<label class="pmeta__name">${esc(t("program.name"))}<input id="programName" type="text" value="${esc(meta.name)}" placeholder="${esc(t("program.name.placeholder"))}" aria-label="${esc(t("program.name_aria"))}"></label>`+
      `<div id="pmetaChipsTop" class="pmeta__chips"></div>`+
    `</div>`+
    `<div class="pmeta__row">`+
      `<label class="pmeta__started">${esc(t("program.started"))}<input id="programStarted" type="date" value="${esc(meta.started||"")}" aria-label="${esc(t("program.started_aria"))}"></label>`+
      `<div id="pmetaChipsBottom" class="pmeta__chips"></div>`+
    `</div>`;
  renderProgramChips();
  const nameInp=input("#programName"),startInp=input("#programStarted");if(!nameInp||!startInp)return;
  nameInp.oninput=async()=>{if(disposed)return;const captured=nameInp.value,result=await commands.program.updateMetadata({name:captured});if(disposed)return;
    if(!(result.localOk||result.idbOk)&&nameInp.value===captured)nameInp.value=queries.snapshot().programMeta?.name||""};
  startInp.onchange=async()=>{if(disposed)return;const captured=startInp.value,result=await commands.program.updateMetadata({started:captured||null});if(disposed)return;
    if(result.localOk||result.idbOk)renderProgramChips();
    else if(startInp.value===captured)startInp.value=queries.snapshot().programMeta?.started||""};
}

// Collapsed program days live in UI prefs so the state survives reloads without touching training data.
function collapsedProgramDays(){const v=preferences.read().collapsedProgramDays;return Array.isArray(v)?v.filter(x=>typeof x==="string"):[]}
/** @param {string} d @param {boolean} on */
function setDayCollapsed(d,on){if(disposed)return;const cur=new Set(collapsedProgramDays());
  on?cur.add(d):cur.delete(d);
  preferences.set("collapsedProgramDays",[...cur].filter(x=>programEditorProgram().days().includes(x)))}
/** @param {string} oldName @param {string} newName */
function renameCollapsedDay(oldName,newName){const cur=collapsedProgramDays();
  if(!cur.includes(oldName))return;
  preferences.set("collapsedProgramDays",cur.map(x=>x===oldName?newName:x))}

/* The raw JSON box is the one field a lifter types a whole document into, so a
   render() firing mid-edit used to throw the draft away — every route into
   render() (collapsing a day, a rest tick, a cross-tab write) reset the
   textarea. Hold unsaved text while the program itself is unchanged; a real
   program change is the newer edit and wins. force is for the two flows that
   just consumed the box (Save JSON, import) and want the normalised result. */
/** @type {string|null} */
let programJsonSynced=null;
/** @param {{force?:boolean}} [options] */
function syncProgramJson({force=false}={}){
  const box=$("#programJson");if(!(box instanceof window.HTMLTextAreaElement))return;
  // The raw editor edits the canonical definition, the program's one authority.
  const definition=programEditorSnapshot().programMeta?.programDefinition;
  const next=JSON.stringify(definition||programEditorProgram().toJSON(),null,2);
  if(!force){
    if(document.activeElement===box)return;
    if(next===programJsonSynced&&box.value!==programJsonSynced)return}
  programJsonSynced=next;box.value=next}

function renderProgramEditor(){
  const ds=programEditorProgram().days();
  const host=$("#programEditor");if(!host)return;
  host.innerHTML=ds.length
    ?ds.map(dayCard).join("")
    :`<div class="table"><div class="empty">${esc(t("program.empty.days"))}</div></div>`;
  syncProgramJson();
  bindEditor();
}

/** @param {string} d */
function dayCard(d){
  const exs=programEditorProgram().forDay(d),sets=sum(exs.map(e=>e.sets));
  const isCollapsed=collapsedProgramDays().includes(d);
  const body=exs.length
    ?exs.map((e,i)=>exCard(e,i,exs.length)).join("")
    :`<p class="pday__empty">${esc(t("program.empty.exercises"))}</p>`;
  return `<div class="pday${isCollapsed?" is-collapsed":""}" data-day="${esc(d)}">`+
    `<div class="pday__head">`+
      `<input class="pday__name" data-act="renameDay" data-day="${esc(d)}" value="${esc(dayLabel(d))}" aria-label="${esc(t("program.day.name_aria"))}">`+
      `<span class="pday__count">${esc(t("program.day.count",{n:exs.length,sets:countText("sets",sets)}))}</span>`+
      `<button class="iconbtn iconbtn--del" type="button" data-act="delDay" data-day="${esc(d)}" title="${esc(t("program.day.delete_title"))}" aria-label="${esc(t("program.day.delete_aria",{day:dayLabel(d)}))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`+
      `<button class="iconbtn pday__caret" type="button" data-act="toggleDay" data-day="${esc(d)}" aria-expanded="${isCollapsed?"false":"true"}" title="${esc(t(isCollapsed?"program.day.expand":"program.day.collapse",{day:dayLabel(d)}))}" aria-label="${esc(t(isCollapsed?"program.day.expand":"program.day.collapse",{day:dayLabel(d)}))}"><span class="icon-mask icon-mask--sm icon-mask--chev-down" aria-hidden="true"></span></button>`+
    `</div>`+
    `<div class="pexlist">${body}</div>`+
    `<button class="btn btn--steel pday__add" type="button" data-act="addEx" data-day="${esc(d)}">${esc(t("program.day.add_exercise"))}</button>`+
  `</div>`;
}

/** @param {ExerciseView} e @param {number} i @param {number} n */
function exCard(e,i,n){
  const progression=e.progression;
  const strategy=progression&&typeof progression==='object'&&'strategy' in progression?progression.strategy:null;
  const strategyId=strategy&&typeof strategy==='object'&&'id' in strategy?strategy.id:null;
  const progressionOwnsShape=typeof strategyId==='string'&&["range","rep_goal","effort_target","anchor_backoff"].includes(strategyId);
  /** @param {string} f @param {string} label */
  const num=(f,label)=>`<label class="pex__num">${label}<input type="number" inputmode="numeric" min="1" step="1" data-id="${e.id}" data-field="${f}" value="${esc(e[f])}"${progressionOwnsShape?" disabled":""}></label>`;
  // The name stays an editable field — a slot can be renamed to what the plate
  // on the machine says — with the library one tap away beside it.
  const linked=e.libraryId?libraryEntry(e.libraryId):null;
  return `<div class="pex" data-id="${esc(e.id)}">`+
    `<div class="pex__head">`+
      `<input class="pex__name" data-id="${esc(e.id)}" data-field="name" value="${esc(e.name)}" placeholder="${esc(t("program.exercise.name_placeholder"))}" aria-label="${esc(t(linked?"program.exercise.alias_aria":"program.exercise.name_aria"))}">`+
      `<button class="iconbtn pex__swap${linked?"":" is-unlinked"}" type="button" data-act="changeEx" data-id="${esc(e.id)}" title="${esc(t("program.exercise.change_title"))}" aria-label="${esc(t("program.exercise.change_aria",{name:exerciseDisplayName(e)}))}"><span class="icon-mask icon-mask--sm icon-mask--search" aria-hidden="true"></span></button>`+
      `<div class="pex__move">`+
        `<button class="iconbtn" type="button" data-act="up" data-id="${esc(e.id)}"${i===0?" disabled":""} aria-label="${esc(t("program.exercise.move_up"))}">▲</button>`+
        `<button class="iconbtn" type="button" data-act="down" data-id="${esc(e.id)}"${i===n-1?" disabled":""} aria-label="${esc(t("program.exercise.move_down"))}">▼</button>`+
        `<button class="iconbtn iconbtn--del" type="button" data-act="delEx" data-id="${esc(e.id)}" aria-label="${esc(t("program.exercise.delete_aria"))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`+
      `</div>`+
    `</div>`+
    `<div class="pex__nums">${num("sets",esc(t("program.exercise.sets")))}${num("min",esc(t("program.exercise.min_reps")))}${num("max",esc(t("program.exercise.max_reps")))}</div>`+
    // Muscles belong to the definition while a slot is linked. Showing them
    // read-only with a way out beats letting an edit silently contradict the id.
    `<label class="pex__mus">${esc(t("program.exercise.primary"))}<input data-id="${esc(e.id)}" data-field="primary" value="${esc(e.primary)}" placeholder="${esc(t("program.exercise.primary_placeholder"))}"${linked?" readonly":""}></label>`+
    `<label class="pex__mus">${esc(t("program.exercise.secondary"))}<input data-id="${esc(e.id)}" data-field="secondary" value="${esc(e.secondary)}" placeholder="${esc(t("program.exercise.secondary_placeholder"))}"${linked?" readonly":""}></label>`+
    (linked?`<p class="pex__linked">${esc(t("program.exercise.linked",{name:libraryName(linked)}))} `+
      `<button type="button" class="pex__detach" data-act="detachEx" data-id="${esc(e.id)}">${esc(t("program.exercise.detach"))}</button></p>`:"")+
    `<label class="pex__mus">${esc(t("program.exercise.setup_notes"))}<input data-id="${esc(e.id)}" data-field="notes" value="${esc(e.notes)}" placeholder="${esc(t("program.exercise.setup_notes_placeholder"))}"></label>`+
  `</div>`;
}

/* Free-text editor fields. Their model values are normalised on the way in
   (trimmed, split on commas), so the stored string routinely differs from what
   is legitimately half-typed in the box — mirroring the model back mid-edit
   would eat trailing spaces and re-fill a field the lifter is still clearing.
   These echo on blur instead; see bindEditor. */
const EDITOR_TEXT_FIELDS=new Set(["name","primary","secondary","notes"]);
/** @param {ExerciseView} e @param {string} field */
const editorFieldText=(e,field)=>String(e[field]??"");
function bindEditor(){
  inputs("#programEditor [data-field]").forEach(inp=>{
    const field=inp.dataset.field||"",isText=EDITOR_TEXT_FIELDS.has(field);
    inp.oninput=async()=>{if(disposed)return;const e=programEditorProgram().find((inp.dataset.id||""));if(!e)return;
      const captured=inp.value,priorValue=String(e[field]??"");
      // A blank name is a stage of typing, not a rename: hold the committed name
      // until something non-blank arrives, so the Exercise fallback never lands
      // in the box under the cursor. Blur puts a name back if none does.
      if(field==="name"&&!captured.trim())return;
      const result=await commands.form.editField({id:(inp.dataset.id||""),field,value:captured});if(disposed)return;
      if(result.code==="set-count-locked"){inp.value=String(e.sets);toast(t("toast.set_count_locked_draft"));return}
      if(!(result.localOk||result.idbOk)){
        const cur=programEditorProgram().find((inp.dataset.id||""));
        if(inp.value===captured)inp.value=cur?String(isText?editorFieldText(cur,field):cur[field]):captured;
        return}
      if(!isText&&(inp.value===captured||inp.value===priorValue))
        inp.value=String(programEditorProgram().find((inp.dataset.id||""))?.[field]??captured);
      onWorkoutChanged()};
    if(inp.type==="number"){
      inp.onfocus=()=>{if(disposed)return;return inp.select()};
      inp.onchange=()=>{if(disposed)return;const e=programEditorProgram().find((inp.dataset.id||""));if(!e)return;const card=inp.closest(".pex");
        (card?[...card.querySelectorAll('input[type="number"][data-field]')].filter(node=>node instanceof window.HTMLInputElement):[inp]).forEach(x=>x.value=String(e[x.dataset.field||""]??""))};
    }
    else if(isText){
      // Every keystroke commits, so by the time a name box is empty the model holds
      // whatever single letter survived the backspacing. Remember what was in the
      // box on focus and put that back — clearing a name and walking away is an
      // abandoned edit, not a rename to a fragment.
      /** @type {string|null} */
      let onFocusText=null;
      inp.onfocus=()=>{if(disposed)return;const e=programEditorProgram().find((inp.dataset.id||""));onFocusText=e?editorFieldText(e,field):null};
      // Blur is where the box catches up with the model: stray whitespace goes.
      inp.onchange=async()=>{if(disposed)return;
        if(field==="name"&&!inp.value.trim()&&onFocusText){
          // Backspacing leaves a keystroke commit per character still in flight, and
          // a proposal built on a state they have not landed in yet diffs to nothing.
          // Let the queue drain so the restore is a real change against the model.
          await commands.form.flush();if(disposed)return;
          if(programEditorProgram().find((inp.dataset.id||""))?.name!==onFocusText)
            await commands.form.editField({id:(inp.dataset.id||""),field,value:onFocusText});if(disposed)return;}
        const e=programEditorProgram().find((inp.dataset.id||""));if(!e)return;
        const shown=editorFieldText(e,field);
        if(inp.value!==shown)inp.value=shown;
        onFocusText=null;
        onWorkoutChanged()};
    }
  });
  inputs('#programEditor [data-act="renameDay"]').forEach(inp=>{
    inp.onchange=async()=>{if(disposed)return;const old=inp.dataset.day||"",next=inp.value.trim();
      const result=await commands.form.renameDay({oldName:old,nextName:next});if(disposed)return;
      if(result.invalid){inp.value=dayLabel(old);toast(t(result.code==="day-exists"?"toast.day_name_exists":"toast.day_rename_failed"));return}
      if(!(result.localOk||result.idbOk)){inp.value=dayLabel(old);return}
      renameCollapsedDay(old,next);
      if(!editor.setupOpen()&&queries.day()===old)onDayChanged(next);
      render();toast(t("toast.day_renamed"))};
  });
  $$("#programEditor button[data-act]").forEach(b=>b.onclick=()=>{if(disposed)return;return editorAction(b.dataset.act||"",{id:b.dataset.id||"",day:b.dataset.day||""})});
}

/** @param {string} act @param {{id:string,day:string}} ds */
async function editorAction(act,ds){if(disposed)return;
  if(act==="toggleDay"){const card=$(`#programEditor .pday[data-day="${CSS.escape(ds.day)}"]`);if(!card)return;
    const now=!card.classList.contains("is-collapsed");
    card.classList.toggle("is-collapsed",now);setDayCollapsed(ds.day,now);
    const btn=card.querySelector(".pday__caret");
    if(btn instanceof window.HTMLElement){btn.setAttribute("aria-expanded",now?"false":"true");
      const label=t(now?"program.day.expand":"program.day.collapse",{day:dayLabel(ds.day)});btn.setAttribute("aria-label",label);btn.title=label}}
  else if(act==="addEx"){
    // The fast path: what this day is short of, what you train often, and your
    // own movements — with the whole library one tap further on. Everything
    // already on the day is excluded; the same movement twice is always a slip.
    library.openExercisePicker({quick:true,day:ds.day,title:t("picker.add_to",{day:dayLabel(ds.day)}),subtitle:"",
      exclude:programEditorProgram().forDay(ds.day).map(e=>e.libraryId).filter(Boolean),
      onPick:async entry=>{if(disposed)return;
        const result=await commands.form.addExercise({day:ds.day,entry});if(disposed)return;
        if(result.localOk||result.idbOk){setDayCollapsed(ds.day,false);render();toast(t("toast.exercise_added"))}}})}
  else if(act==="changeEx"){
    const ex=programEditorProgram().find(ds.id);if(!ex)return;
    library.openExercisePicker({title:t("picker.title_change"),subtitle:exerciseDisplayName(ex),
      exclude:programEditorProgram().forDay(ex.day).filter(e=>e.id!==ex.id).map(e=>e.libraryId).filter(Boolean),
      onPick:async entry=>{if(disposed)return;
        const result=await commands.form.replaceExercise({id:ds.id,entry});if(disposed)return;
        if(result.localOk||result.idbOk){render();toast(t("toast.exercise_changed"))}}})}
  else if(act==="detachEx"){
    const ex=programEditorProgram().find(ds.id);if(!ex)return;
    if(!confirm(t("confirm.detach_exercise",{name:exerciseDisplayName(ex)})))return;
    const result=await commands.form.detachExercise({id:ds.id});if(disposed)return;
    if(result.localOk||result.idbOk){render();toast(t("toast.exercise_detached"))}}
  else if(act==="delEx"){const {active:draftActive,raw:discardDraftRaw}=commands.form.captureRemoval();
    const key=draftActive?"confirm.remove_exercise_discard_draft":"confirm.remove_exercise";
    if(confirm(t(key))){
    const result=await commands.form.removeExercise({id:ds.id,discardDraftRaw});if(disposed)return;
    if(result.localOk||result.idbOk){if(result.resetDraftPresentation)onDraftRemoved();render();toast(t("toast.exercise_removed"))}}}
  else if(act==="up"||act==="down"){
    const result=await commands.form.moveExercise({id:ds.id,direction:act==="up"?-1:1});if(disposed)return;
    if(result.localOk||result.idbOk)render()}
  else if(act==="delDay"){const {active:draftActive,raw:discardDraftRaw}=commands.form.captureRemoval();
    const key=draftActive?"confirm.delete_day_discard_draft":"confirm.delete_day";
    if(confirm(t(key,{day:dayLabel(ds.day)}))){
    const result=await commands.form.removeDay({day:ds.day,discardDraftRaw});if(disposed)return;
    if(result.localOk||result.idbOk){if(result.resetDraftPresentation)onDraftRemoved();setDayCollapsed(ds.day,false);render();toast(t("toast.day_deleted"))}}}
}


async function saveProgram(){if(disposed)return;try{const rawBox=$("#programJson");if(!(rawBox instanceof window.HTMLTextAreaElement))return;const parsed=JSON.parse(rawBox.value);
  if(!commands.form.validDefinition(parsed)){toast(t("toast.program_invalid"),{assertive:true});return}
  const {active:draftActive,raw:discardDraftRaw}=commands.form.captureRemoval();
  if(draftActive&&!confirm(t("confirm.replace_program_discard_draft")))return;
  const result=await commands.form.replaceDefinition({value:parsed,discardDraftRaw});if(disposed)return;
  if(!(result.localOk||result.idbOk))return result;
  if(result.resetDraftPresentation)onDraftRemoved();
  // Land on an exercise-bearing day. Structure order can put a renamed first
  // slot (e.g. Push Day) ahead of Day 2; sorted exercise days match the pre-
  // structure default and avoid a day-switch discard wiping a just-set date.
  const exerciseDays=[...new Set((programEditorProgram().exercises||[]).map(x=>x.day))]
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  if(!editor.setupOpen())onDayChanged(exerciseDays.includes(queries.day())?queries.day():(exerciseDays[0]||queries.program().days()[0]||"Day 1"));
  render();
  // The save consumed the box, so show the normalised result over the draft.
  syncProgramJson({force:true});
  toast(t("toast.program_saved"));
  return result}
  catch{toast(t("toast.program_json_invalid"))}}


/** @type {AbortController|null} */
let listenerLifetime=null;
let bound=false;
function bind(){if(bound||disposed)return;bound=true;listenerLifetime=new window.AbortController();
  const saveButton=$("#saveProgram");if(saveButton)saveButton.onclick=saveProgram;
  // Unsaved JSON now outlives a render, so collapsing Advanced is the way to
  // throw a scratch edit away — including one too broken to save.
  const advanced=document.querySelector("details.advanced");
  if(advanced instanceof window.HTMLDetailsElement)advanced.addEventListener("toggle",()=>{if(!advanced.open)syncProgramJson({force:true})},{signal:listenerLifetime.signal});
  const addButton=$("#addDay");if(addButton)addButton.onclick=async()=>{if(disposed)return;
    const result=await commands.form.addDay(),nextDay=result.day;if(disposed)return;
    if(result.localOk||result.idbOk){if(!editor.setupOpen())onDayChanged(nextDay);render();toast(t("toast.day_added"))}};

}
function dispose(){disposed=true;listenerLifetime?.abort();listenerLifetime=null;bound=false;
  for(const root of $$('#program'))for(const element of [root,...root.querySelectorAll('*')])if(element instanceof window.HTMLElement){element.onclick=null;element.oninput=null;element.onchange=null;element.onfocus=null;}
  const save=$('#saveProgram'),add=$('#addDay');if(save)save.onclick=null;if(add)add.onclick=null;
}
return Object.freeze({bind,dispose,renderProgram,setDayCollapsed});
}
