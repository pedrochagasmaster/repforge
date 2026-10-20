import {escapeHtml as esc} from '../format.js';
/** @typedef {import('./questions.js').Answers} Answers
 * @typedef {{id:string,name:string}} NamedExercise
 * @typedef {{id:string,frequency:number,days?:readonly {estimateMinutes?:number}[],default?:boolean}} SplitChoice
 * @typedef {{answers:Readonly<Answers>,route:string|null,goalOpen:boolean,activeProgram:boolean,hasLegacyHints:boolean,pendingAvoid:string|null,avoidQuery:string,exerciseQuery:string,avoidMatches:readonly NamedExercise[],exerciseMatches:readonly NamedExercise[],exerciseNames:Readonly<Record<string,string>>,environments:readonly string[],muscles:readonly string[],movements:readonly string[],avoidReasons:readonly string[],maxPriority:number,maxMuscles:number,prioritiesEmpty:boolean,splits:{choices:readonly SplitChoice[]}}} AnswerFieldsModel
 */
/** Shared Custom/Browse questions and the inline answer editor. This is one
 * readonly rendering path for a committed answer set or the editor's private copy.
 * @param {import('./view.js').Copy} copy */
export function createAnswerFields({t}){
 /** @param {string} part @param {AnswerFieldsModel} model @param {boolean} [screen] */
 function render(part,model,screen=false){
 /** @type {Record<string,string>} */ const ENTRY_DESIRED_ICONS={muscle_growth:'flex',balanced:'scale',strength:'dumbbell'};
 /** @type {Record<string,string>} */ const ENTRY_ENV_ICONS={everything:'building',commercial_gym:'building',warehouse_gym:'rack',basic_gym:'house',limited_home:'kettlebell',full_home:'rack',other:'dumbbell'};
 const ENTRY_MUSCLE_STATES=['normal','prioritize','deemphasize','ignore'];
 /** @param {string} id */ const libraryEntry=id=>Object.hasOwn(model.exerciseNames,id)?{id,name:model.exerciseNames[id]}:null;
 /** @param {NamedExercise} entry */ const libraryName=entry=>entry.name;
 /** @param {string} _query */ const entryAvoidMatches=_query=>model.avoidMatches;
 /** @param {string} _query */ const entryExerciseMatches=_query=>model.exerciseMatches;
 const entryPrioritiesEmpty=()=>model.prioritiesEmpty;
/** @param {string} key @param {string|number} val @param {string} label @param {string} sub @param {{multi?:boolean,selected?:boolean|null,disabled?:boolean,role?:string,icon?:string}} [options] */
function entryOpt(key,val,label,sub,{multi=false,selected=null,disabled=false,role="radio",icon=""}={}){
  const current=model.answers||{};
  const isSelected=selected!=null?selected:multi?(Array.isArray(current[key])&&current[key].includes(val)):current[key]===val;
  const checked=isSelected?"true":"false";
  const disabledCopy=disabled?` aria-label="${esc(`${label}. ${t("entry.choice.disabled")}`)}" aria-describedby="entryChoiceDisabledNote"`:
    "";
  return `<button type="button" class="radio-card${isSelected?" is-selected":""}${disabled?" is-disabled":""}" data-entry-pick="${esc(key)}" data-entry-val="${esc(String(val))}" data-entry-multi="${multi?"1":"0"}"${disabled?" disabled aria-disabled=\"true\"":""}${disabledCopy} role="${esc(role)}" aria-checked="${checked}">`+
    (icon?`<span class="radio-card__icon icon-mask icon-mask--${esc(icon)}" aria-hidden="true"></span>`:"")+
    `<span class="radio-card__body"><span class="radio-card__title">${esc(label)}</span>${sub?`<span class="radio-card__cap">${esc(sub)}</span>`:""}</span>`+
    `<span class="radio-card__mark" aria-hidden="true"></span></button>`}
/** @param {string} text @param {string} _icon @param {string} [attrs] */
function entryGroupLab(text,_icon,attrs=""){
  return `<p class="entry__group-lab entry__question"${attrs}><span>${esc(text)}</span></p>`}
/** @param {string} title */
function entryHeading(title){
  return `<h2 class="onb__q" id="entryHeading" tabindex="-1">${esc(title)}</h2>`}
function entryLegacyBanner(){
  if(!model.hasLegacyHints||!model.hasLegacyHints)return"";
  return `<p class="entry__legacy" role="note">${esc(t("entry.legacy.hint"))}</p>`}
function entryGoalGroup(){
  return `<div class="onb__opts" role="radiogroup" aria-label="${esc(t("entry.goal.title"))}">`+
    ["muscle_growth","strength","balanced"].map(v=>entryOpt("desiredResult",v,t(`entry.goal.${v}`),t(`entry.goal.${v}.sub`),{icon:ENTRY_DESIRED_ICONS[v]})).join("")+`</div>`}
function renderDesiredResultStep(){
  return entryHeading(t("entry.goal.title"))+`<p class="onb__explain">${esc(t("entry.desired_result.lede"))}</p>${entryLegacyBanner()}`+entryGoalGroup()}
function entryBackgroundGroups(){
  return entryGroupLab(t("entry.lifting.title"),"clock",` id="entryExpLab"`)+`<div class="onb__opts onb__list" role="radiogroup" aria-labelledby="entryExpLab">`+
    ["first","under_6m","6_to_24m","over_24m"].map(v=>entryOpt("structuredExperience",v,t(`entry.lifting.${v}`),t(`entry.lifting.${v}.sub`))).join("")+`</div>`}
function entryAboutGoal(){
  const goal=model.answers.desiredResult;
  if(goal&&!model.goalOpen)
    return `<div class="entry__carried"><div class="entry__carried-text"><span class="entry__carried-k">${esc(t("entry.about.goal"))}</span>`+
      `<span class="entry__carried-v">${esc(t(`entry.goal.${goal}`))}</span></div>`+
      `<button type="button" class="btn btn--steel entry__carried-change" id="entryGoalChange" aria-label="${esc(t("entry.about.goal_change"))}">${esc(t("entry.about.change"))}</button></div>`;
  return entryGroupLab(t("entry.goal.title"),"",` id="entryGoalLab"`)+entryGoalGroup()}
function renderBackgroundStep(){
  return entryHeading(t("entry.background.title"))+`<p class="onb__explain">${esc(t("entry.background.lede"))}</p>${entryLegacyBanner()}`+
    entryAboutGoal()+entryBackgroundGroups()}
/** @param {{browse?:boolean}} [options] */
function entryScheduleGroups({browse=false}={}){
  return entryGroupLab(t("entry.schedule.days.label"),"cal",` id="entryDaysLab"`)+`<div class="onb__opts onb__num" role="radiogroup" aria-labelledby="entryDaysLab">`+
    [2,3,4,5,6].map(n=>entryOpt("daysPerWeek",n,String(n),t("entry.schedule.days.sub"))).join("")+`</div>`+
    entryGroupLab(t("entry.schedule.minutes.label"),"clock",` id="entryMinLab"`)+`<div class="onb__opts onb__num" role="radiogroup" aria-labelledby="entryMinLab">`+
    [20,40,60,90,120,150].map(n=>entryOpt("sessionMinutes",n,String(n),t("entry.schedule.minutes.at_most"))).join("")+`</div>`}
function renderScheduleStep(){
  return entryHeading(t("entry.schedule.title"))+`<p class="onb__explain">${esc(t("entry.schedule.lede"))}</p>${entryLegacyBanner()}`+
    entryScheduleGroups({browse:model.route==="browse"})}
function entryEnvironmentBody(){
  return `<div class="onb__opts onb__list" role="radiogroup" aria-label="${esc(t("entry.environment.title"))}">`+
    model.environments.map(v=>entryOpt("environment",v,t(`entry.gym.${v}`),t(`entry.gym.${v}.sub`),{selected:model.answers.environment?.kind===v,icon:ENTRY_ENV_ICONS[v]||"dumbbell"})).join("")+`</div>`}
function renderEnvironmentStep(){
  return entryHeading(t("entry.environment.title"))+`<p class="onb__explain">${esc(t("entry.environment.lede"))}</p>${entryLegacyBanner()}`+entryEnvironmentBody()}
/** @param {string} key @param {string} muscle */
function entryMuscleBlocked(key,muscle){
  const a=model.answers||{};
  const primary=new Set(a.primaryMuscles||[]);
  const deemph=new Set(a.deEmphasizedMuscles||[]);
  const ignored=new Set(a.ignoredMuscles||[]);
  if(key==="primaryMuscles")return deemph.has(muscle)||ignored.has(muscle);
  if(key==="deEmphasizedMuscles")return primary.has(muscle)||ignored.has(muscle);
  if(key==="ignoredMuscles")return primary.has(muscle)||deemph.has(muscle);
  return false}
/** @param {string} status */
function entryMuscleStateLabel(status){
  switch(status){
    case "prioritize":return t("entry.priorities.state.prioritize");
    case "deemphasize":return t("entry.priorities.state.deemphasize");
    case "ignore":return t("entry.priorities.state.ignore");
    default:return t("entry.priorities.state.normal")}}
/** @param {string} muscle */
function entryMuscleStatus(muscle){
  const a=model.answers||{};
  if((a.primaryMuscles||[]).includes(muscle))return"prioritize";
  if((a.deEmphasizedMuscles||[]).includes(muscle))return"deemphasize";
  if((a.ignoredMuscles||[]).includes(muscle))return"ignore";
  return"normal"}
/** @param {string} muscle @param {string} status */
function entryMuscleStatusDisabled(muscle,status){
  if(status==="prioritize"){
    const primary=model.answers?.primaryMuscles||[];
    return primary.length>=model.maxPriority&&!primary.includes(muscle)}
  if(status==="deemphasize"){
    const selected=model.answers?.deEmphasizedMuscles||[];
    return selected.length>=(model.maxMuscles||22)&&!selected.includes(muscle)}
  if(status==="ignore"){
    const selected=model.answers?.ignoredMuscles||[];
    return selected.length>=(model.maxMuscles||22)&&!selected.includes(muscle)}
  return false}
/** @param {string} muscle @param {string} status */
function entryMuscleStatusOption(muscle,status){
  const selected=entryMuscleStatus(muscle)===status;
  const disabled=entryMuscleStatusDisabled(muscle,status);
  const label=entryMuscleStateLabel(status);
  const muscleLabel=t(`entry.muscle.${muscle}`)||muscle;
  return `<button type="button" class="entry__muscle-state${selected?" is-selected":""}${disabled?" is-disabled":""}" data-entry-pick="musclePriority" data-entry-val="${esc(`${muscle}|${status}`)}"${disabled?` disabled aria-disabled="true" aria-label="${esc(`${muscleLabel}: ${label}. ${t("entry.choice.disabled")}`)}"`:` aria-label="${esc(`${muscleLabel}: ${label}`)}"`} role="radio" aria-checked="${selected?"true":"false"}"><span>${esc(label)}</span></button>`}
function renderCustomMusclePriorities(){
  return `<p class="entry__group-lab" id="entryMuscleStatesLab">${esc(t("entry.priorities.states"))}</p>`+
    `<p class="entry__hint entry__muscle-state-hint">${esc(t("entry.priorities.state_hint"))}</p>`+
    `<div class="entry__muscle-list" role="group" aria-labelledby="entryMuscleStatesLab">`+
    model.muscles.map(muscle=>{
      const label=t(`entry.muscle.${muscle}`)||muscle;
      const current=entryMuscleStateLabel(entryMuscleStatus(muscle));
      return `<div class="entry__muscle-row"><div class="entry__muscle-name" id="entryMuscleLabel-${esc(muscle)}"><span>${esc(label)}</span><span class="entry__muscle-current">${esc(current)}</span></div>`+
        `<div class="entry__muscle-states" role="radiogroup" aria-labelledby="entryMuscleLabel-${esc(muscle)}">`+
        ENTRY_MUSCLE_STATES.map(status=>entryMuscleStatusOption(muscle,status)).join("")+`</div></div>`}).join("")+`</div>`}
function renderAvoidanceSection(){
  const constraints=model.answers?.exerciseConstraints||[];
  const hasPain=constraints.some(item=>item.reason==="pain");
  const matches=entryAvoidMatches(model.avoidQuery);
  return `<p class="entry__group-lab">${esc(t("entry.priorities.avoid"))}</p>`+
    `<label class="entry__field entry__field--search"><span>${esc(t("entry.priorities.avoid_search"))}</span>`+
    `<span class="entry__field-ico icon-mask icon-mask--search" aria-hidden="true"></span>`+
    `<input id="entryAvoidSearch" type="search" autocomplete="off" value="${esc(model.avoidQuery)}" placeholder="${esc(t("entry.search_placeholder"))}"></label>`+
    `<div class="entry__avoid-results" role="listbox" aria-label="${esc(t("entry.priorities.avoid_search"))}">`+
    matches.map(entry=>`<button type="button" class="entry-card entry-card--compact" data-entry-avoid-add="${esc(entry.id)}" role="option"><span class="entry-card__title">${esc(libraryName(entry))}</span></button>`).join("")+
    `</div>`+
    (model.pendingAvoid?(()=>{const entry=libraryEntry(model.pendingAvoid);
      const exercise=entry?libraryName(entry):model.pendingAvoid;
      const reasonLab=t("entry.priorities.avoid_reason",{exercise});
      return `<div class="entry__avoid-item entry__avoid-pending" role="group" aria-label="${esc(reasonLab)}"><strong>${esc(exercise)}</strong>`+
      `<p class="entry__group-lab">${esc(reasonLab)}</p><div class="onb__opts onb__opts--reasons" role="radiogroup">`+
      model.avoidReasons.map(reason=>entryOpt("avoidReason",`${model.pendingAvoid}|${reason}`,t(`entry.priorities.reason.${reason}`),"",{selected:false})).join("")+`</div><p class="entry__hint" id="model.pendingAvoidNote">${esc(t("entry.priorities.reason_required"))}</p></div>`})():"")+
    (constraints.length?`<ul class="entry__avoid-list">`+constraints.map(item=>{
      const entry=libraryEntry(item.exerciseId);
      return `<li class="entry__avoid-item"><div class="entry__avoid-head"><strong>${esc(entry?libraryName(entry):item.exerciseId)}</strong>`+
        `<button type="button" class="entry__remove" data-entry-avoid-remove="${esc(item.exerciseId)}">${esc(t("entry.priorities.avoid_remove"))}</button></div>`+
        `<p class="entry__group-lab">${esc(t("entry.priorities.avoid_reason",{exercise:entry?libraryName(entry):item.exerciseId}))}</p><div class="onb__opts onb__opts--reasons" role="radiogroup">`+
        model.avoidReasons.map(reason=>entryOpt("avoidReason",`${item.exerciseId}|${reason}`,t(`entry.priorities.reason.${reason}`),"",{selected:item.reason===reason})).join("")+
        `</div></li>`}).join("")+`</ul>`:"")+
    (hasPain?`<p class="entry__pain" role="note"><span class="entry__pain-ico icon-mask icon-mask--shield" aria-hidden="true"></span><span>${esc(t("entry.priorities.pain_note"))}</span></p>`:"")}
function entryExercisePreferencesBody(){
  const included=model.answers?.mustHaveExercises||[];
  const constraints=model.answers?.exerciseConstraints||[];
  const matches=entryExerciseMatches(model.exerciseQuery);
  const resultRows=matches.map(entry=>{const exercise=libraryName(entry);
    const includeLabel=`${t("entry.exercise_preferences.include")} ${exercise}`;
    const avoidLabel=`${t("entry.exercise_preferences.avoid")} ${exercise}`;
    return `<div class="entry__exercise-result" role="listitem"><span class="entry__exercise-name">${esc(exercise)}</span><span class="entry__exercise-actions">`+
    `<button type="button" class="entry__exercise-action" aria-label="${esc(includeLabel)}" data-entry-exercise-add="${esc(entry.id)}" data-entry-exercise-status="include">${esc(t("entry.exercise_preferences.include"))}</button>`+
    `<button type="button" class="entry__exercise-action" aria-label="${esc(avoidLabel)}" data-entry-exercise-add="${esc(entry.id)}" data-entry-exercise-status="avoid">${esc(t("entry.exercise_preferences.avoid"))}</button></span></div>`}).join("");
  const pending=model.pendingAvoid?(()=>{
    const entry=libraryEntry(model.pendingAvoid),exercise=entry?libraryName(entry):model.pendingAvoid;
    const reasonLab=t("entry.exercise_preferences.avoid_reason",{exercise});
    return `<div class="entry__avoid-item entry__avoid-pending" role="group" aria-label="${esc(reasonLab)}"><strong>${esc(exercise)}</strong>`+
      `<p class="entry__group-lab">${esc(reasonLab)}</p><div class="onb__opts onb__opts--reasons" role="radiogroup">`+
      model.avoidReasons.map(reason=>entryOpt("avoidReason",`${model.pendingAvoid}|${reason}`,t(`entry.priorities.reason.${reason}`),"",{selected:false})).join("")+`</div>`+
      `<p class="entry__hint" id="model.pendingAvoidNote">${esc(t("entry.exercise_preferences.reason_required"))}</p></div>`})():"";
  const includeList=included.length?`<ul class="entry__exercise-selected-list">`+included.map(exerciseId=>{
    const entry=libraryEntry(exerciseId);
    return `<li class="entry__exercise-selected"><span>${esc(entry?libraryName(entry):exerciseId)}</span><button type="button" class="entry__remove" data-entry-exercise-remove="${esc(exerciseId)}">${esc(t("entry.exercise_preferences.remove"))}</button></li>`}).join("")+`</ul>`:
    `<p class="entry__hint entry__exercise-empty">${esc(t("entry.exercise_preferences.include_none"))}</p>`;
  const avoidList=constraints.length?`<ul class="entry__avoid-list">`+constraints.map(item=>{
    const entry=libraryEntry(item.exerciseId),exercise=entry?libraryName(entry):item.exerciseId;
    return `<li class="entry__avoid-item"><div class="entry__avoid-head"><strong>${esc(exercise)}</strong>`+
      `<button type="button" class="entry__remove" data-entry-exercise-remove="${esc(item.exerciseId)}">${esc(t("entry.exercise_preferences.remove"))}</button></div>`+
      `<p class="entry__group-lab">${esc(t("entry.exercise_preferences.avoid_reason",{exercise}))}</p><div class="onb__opts onb__opts--reasons" role="radiogroup">`+
      model.avoidReasons.map(reason=>entryOpt("avoidReason",`${item.exerciseId}|${reason}`,t(`entry.priorities.reason.${reason}`),"",{selected:item.reason===reason})).join("")+`</div></li>`}).join("")+`</ul>`:
    `<p class="entry__hint entry__exercise-empty">${esc(t("entry.exercise_preferences.avoid_none"))}</p>`;
  const hasPain=constraints.some(item=>item.reason==="pain");
  return `<label class="entry__field entry__field--search"><span>${esc(t("entry.exercise_preferences.search"))}</span>`+
    `<span class="entry__field-ico icon-mask icon-mask--search" aria-hidden="true"></span>`+
    `<input id="entryExerciseSearch" type="search" autocomplete="off" value="${esc(model.exerciseQuery)}" placeholder="${esc(t("entry.exercise_preferences.search"))}"></label>`+
    `<div class="entry__exercise-results" role="list" aria-label="${esc(t("entry.exercise_preferences.results"))}">${resultRows}</div>`+
    `<section class="entry__exercise-selected-group" aria-labelledby="entryIncludeListLabel"><p class="entry__group-lab" id="entryIncludeListLabel">${esc(t("entry.exercise_preferences.include_list"))}</p>${includeList}</section>`+
    `<section class="entry__exercise-selected-group" aria-labelledby="entryAvoidListLabel"><p class="entry__group-lab" id="entryAvoidListLabel">${esc(t("entry.exercise_preferences.avoid_list"))}</p>${pending}${avoidList}</section>`+
    (hasPain?`<p class="entry__pain" role="note"><span class="entry__pain-ico icon-mask icon-mask--shield" aria-hidden="true"></span><span>${esc(t("entry.priorities.pain_note"))}</span></p>`:"")}
function renderExercisePreferencesStep(){
  return entryHeading(t("entry.exercise_preferences.title"))+`<p class="entry__optional">${esc(t("entry.optional"))}</p>`+
    `<p class="onb__explain">${esc(t("entry.exercise_preferences.lede"))}</p>`+entryExercisePreferencesBody()}
function entryPrioritiesBody(){
  const a=model.answers||{},custom=model.route==="custom";
  if(custom){
    return renderCustomMusclePriorities()+
      `<p class="entry__group-lab">${esc(t("entry.priorities.movements"))}</p><div class="onb__opts onb__grid onb__grid--balanced" role="group">`+
      model.movements.map(m=>entryOpt("priorityMovements",m,t(`entry.movement.${m}`)||m,"",{multi:true,role:"checkbox"})).join("")+`</div>`}
  const primary=a.primaryMuscles||[];
  return `<div class="onb__opts entry__none" role="radiogroup" aria-label="${esc(t("entry.priorities.primary"))}"><button type="button" class="radio-card${primary.length===0?" is-selected":""}" data-entry-action="clear-priorities" role="radio" aria-checked="${primary.length===0?"true":"false"}"><span class="radio-card__body"><span class="radio-card__title">${esc(t("entry.priorities.none"))}</span></span><span class="radio-card__mark" aria-hidden="true"></span></button></div>`+
    `<p class="entry__group-lab">${esc(t("entry.priorities.primary"))}</p><div class="onb__opts onb__grid onb__grid--balanced" role="group">`+
    model.muscles.map(m=>entryOpt("primaryMuscles",m,t(`entry.muscle.${m}`)||m,"",{multi:true,disabled:entryMuscleBlocked("primaryMuscles",m),role:"checkbox"})).join("")+`</div>`+
    (primary.length>=model.maxPriority?`<p class="entry__hint entry__limit" id="entryPrimaryLimit">${esc(t("entry.priorities.limit"))}</p>`:"")+
    `<p class="entry__group-lab">${esc(t("entry.priorities.movements"))}</p><div class="onb__opts onb__grid onb__grid--balanced" role="group">`+
    model.movements.map(m=>entryOpt("priorityMovements",m,t(`entry.movement.${m}`)||m,"",{multi:true,role:"checkbox"})).join("")+`</div>`+
    renderAvoidanceSection()}
function renderPrioritiesStep(){
  const custom=model.route==="custom";
  /* Recommend's optional section can be skipped while it is empty, so Skip never
     discards a constraint the lifter chose. */
  const skip=!custom&&entryPrioritiesEmpty()?`<button type="button" class="btn btn--steel entry__skip" id="entrySkip">${esc(t("entry.priorities.skip"))}</button>`:"";
  return entryHeading(t(custom?"entry.priorities.custom_title":"entry.priorities.title"))+`<p class="entry__optional">${esc(t("entry.optional"))}</p>`+
    `<p class="onb__explain">${esc(t(custom?"entry.priorities.custom_lede":"entry.priorities.lede_optional"))}</p>`+skip+entryPrioritiesBody()}
/** @param {SplitChoice} choice */
function splitDisplayName(choice){
  const key=`split.${choice?.id}`,text=t(key);
  return text===key?String(choice?.id||"").replace(/_/g," "):text}
/** @param {{choices:readonly SplitChoice[]}} splits */
function entryCustomShapeBody(splits){
  const sole=splits.choices.length===1;
  return `<p class="entry__group-lab">${esc(t(sole?"entry.custom_shape.split_sole":"entry.custom_shape.split"))}</p><div class="onb__opts" role="radiogroup">`+
    splits.choices.map(choice=>{
      const label=t("entry.custom_shape.choice",{name:splitDisplayName(choice),days:choice.frequency});
      const estimates=(choice.days||[]).map(day=>day.estimateMinutes).filter((value)=>typeof value==="number").filter(Number.isFinite);
      const summary=estimates.length?t("entry.custom_shape.summary",{
        days:choice.frequency,min:Math.min(...estimates),max:Math.max(...estimates)}):"";
      const reason=choice.default?t("entry.custom_shape.default_reason"):t("entry.custom_shape.compatible_reason");
      return entryOpt("splitPreference",choice.id,label,`${reason}${summary?` ${summary}`:""}`)}).join("")+`</div>`}
function renderCustomShapeStep(){
  const splits=model.splits;
  if(!splits.choices.length)return entryHeading(t("entry.custom_shape.title"))+`<div class="entry__notice" role="alert"><strong>${esc(t("entry.custom_shape.none_title"))}</strong><p>${esc(t("entry.custom_shape.none_body"))}</p>`+
    `<button type="button" class="btn btn--cta" data-entry-action="change-schedule">${esc(t("entry.custom_shape.change_schedule"))}</button></div>`;
  const sole=splits.choices.length===1;
  return entryHeading(t(sole?"entry.custom_shape.title_sole":"entry.custom_shape.title"))+
    `<p class="onb__explain">${esc(t(sole?"entry.custom_shape.lede_sole":"entry.custom_shape.lede"))}</p>`+entryCustomShapeBody(splits)}
function renderBuildSetupStep(){
  const name=model.answers.programName||"";
  return entryHeading(t("entry.build_setup.title"))+`<p class="onb__explain">${esc(t("entry.build_setup.lede"))}</p>`+
    (model.activeProgram?`<p class="entry__active" role="status">${esc(t("entry.active_notice"))}</p>`:"")+
    `<label class="entry__field"><span>${esc(t("entry.build_setup.name"))}</span>`+
    `<input id="entryProgramName" type="text" maxlength="80" value="${esc(name)}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"></label>`+
    entryGroupLab(t("entry.build_setup.days"),"cal",` id="entryBuildDaysLab"`)+`<div class="onb__opts onb__num" role="radiogroup" aria-labelledby="entryBuildDaysLab">`+
    [2,3,4,5,6].map(n=>entryOpt("daysPerWeek",n,String(n),t("entry.schedule.days.sub"))).join("")+`</div>`}
 /** @type {Record<string,()=>string>} */ const parts={desired_result:entryGoalGroup,background:entryBackgroundGroups,schedule:entryScheduleGroups,environment:entryEnvironmentBody,priorities:entryPrioritiesBody,exercise_preferences:entryExercisePreferencesBody,custom_shape:()=>model.splits.choices.length?entryCustomShapeBody(model.splits):`<p class="entry__hint">${esc(t('entry.custom_shape.none_body'))}</p>`};
 /** @type {Record<string,()=>string>} */ const screens={desired_result:renderDesiredResultStep,background:renderBackgroundStep,schedule:renderScheduleStep,environment:renderEnvironmentStep,priorities:renderPrioritiesStep,exercise_preferences:renderExercisePreferencesStep,custom_shape:renderCustomShapeStep,build_setup:renderBuildSetupStep};
 return(screen?screens:parts)[part]?.()||'';
 }
 return Object.freeze({renderPart:(/** @type {string} */ part,/** @type {AnswerFieldsModel} */ model)=>render(part,model),renderScreen:(/** @type {string} */ part,/** @type {AnswerFieldsModel} */ model)=>render(part,model,true)});
}
