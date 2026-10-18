import {escapeHtml as esc} from '../format.js';
/** @typedef {ReturnType<ReturnType<typeof import('../../training/authoring.js').createEntryRules>['createState']>['answers']} Answers
 * @typedef {{answers:Readonly<Answers>,basics:Readonly<Record<string,unknown>>,birth:{y:number,m:number,d:number},birthYears:readonly number[],monthNames:readonly string[],heightUnit:string,heightCm:number,weightUnit:string,weightKg:number,environments:readonly string[],muscles:readonly string[],equipmentGroups:readonly string[],presetEquipmentGroups:readonly string[],competencies:readonly string[],sectionNames:readonly string[],priorityLimitShown:boolean,recommend:boolean}} QuestionModel
 */
/** Pure Entry question rendering. Every screen, including motion's previous
 * page, receives explicit facts; drawing never swaps or persists the live draft.
 * @param {import('./view.js').Copy} copy */
/** @param {string} id @param {string} label @param {readonly string[]} items @param {number} index */
export function renderEntryWheel(id,label,items,index){
  const safe=Math.max(0,Math.min(items.length-1,index));
  return `<div class="entry-wheel" id="${id}" role="spinbutton" tabindex="0" aria-label="${esc(label)}" aria-haspopup="dialog" aria-valuemin="0" aria-valuemax="${items.length-1}" aria-valuenow="${safe}" aria-valuetext="${esc(items[safe])}" data-index="${safe}">`+
    `<div class="entry-wheel__pad" aria-hidden="true"></div>${items.map((text,i)=>`<div class="entry-wheel__item" data-i="${i}" aria-hidden="true">${esc(text)}</div>`).join("")}<div class="entry-wheel__pad" aria-hidden="true"></div></div>`}

/** @param {import('./view.js').Copy} copy */
export function createEntryQuestions({t,locale}){
 /** @param {string} step @param {QuestionModel} model */
 function render(step,model){
 /** @type {Record<string,string>} */ const ENTRY_DESIRED_ICONS={muscle_growth:'flex',balanced:'scale',strength:'dumbbell'};
 /** @type {Record<string,string>} */ const ENTRY_ENV_ICONS={everything:'building',commercial_gym:'building',warehouse_gym:'rack',basic_gym:'house',limited_home:'kettlebell',full_home:'rack',other:'dumbbell'};
 const ENTRY_ABILITY_CHOICES=['yes','no','unsure'],KG_PER_LB=0.45359237;
 /** @param {string} title */ const entryHeading=title=>`<h2 class="onb__q" id="entryHeading" tabindex="-1">${esc(title)}</h2>`;
 /** @param {number} month @param {number} year */ const entryDaysIn=(month,year)=>new Date(Date.UTC(year,month,0)).getUTCDate();
 /** @param {number} value @param {number} digits */ const entryDecimal=(value,digits)=>locale().startsWith('pt')?Number(value).toFixed(digits).replace('.',','):Number(value).toFixed(digits);
 /** @param {number} value @param {string} unit */ const entryWeightText=(value,unit)=>`${entryDecimal(value,1)} ${unit}`;
 /** @param {string} unit */ const entryWeightRange=unit=>unit==='lb'?{min:66,max:440,step:0.2}:{min:30,max:200,step:0.1};
/** @param {boolean} [weight] */
function entryBNote(weight=false){
  return `<p class="entry-b__note"><span class="icon-mask icon-mask--shield icon-mask--sm" aria-hidden="true"></span><span>${esc(t(weight?"entry.basics.weight_note":"entry.basics.note"))}</span></p>`}
/** @param {string} key @param {string|number} value @param {string} label @param {string} sub @param {boolean} selected @param {{icon?:string}} [options] */
function entryBChoice(key,value,label,sub,selected,{icon=""}={}){
  return `<button type="button" class="radio-card${selected?" is-selected":""}" role="radio" aria-checked="${selected?"true":"false"}" data-entry-pick="${esc(key)}" data-entry-val="${esc(String(value))}">`+
    (icon?`<span class="radio-card__icon icon-mask icon-mask--${esc(icon)}" aria-hidden="true"></span>`:"")+
    `<span class="radio-card__body"><span class="radio-card__title">${esc(label)}</span>${sub?`<span class="radio-card__cap">${esc(sub)}</span>`:""}</span>`+
    `<span class="radio-card__mark" aria-hidden="true"></span></button>`}
/** @param {string} inner @param {{compact?:boolean}} [options] */
function entryBGroup(inner,{compact=false}={}){
  return `<div class="onb__opts${compact?" onb__num entry-b__compact":""}" role="radiogroup" aria-labelledby="entryHeading">${inner}</div>`}
function renderIntroStep(){
  const steps=model.sectionNames.map((name,index)=>
    `<li class="entry-b__section${index===0?" is-current":""}"><span class="entry-b__section-n" aria-hidden="true">${index+1}</span>`+
    `<span><strong>${esc(t(`entry.section.${name}`))}</strong><span>${esc(t(`entry.intro.${name}`))}</span></span></li>`).join("");
  return entryHeading(t("entry.intro.title"))+`<p class="onb__explain">${esc(t("entry.intro.lede"))}</p><ol class="entry-b__sections">${steps}</ol>`}
function renderSexStep(){
  const current=model.basics.sex;
  return entryHeading(t("entry.sex.title"))+entryBGroup(["female","male","undisclosed"].map(value=>
    entryBChoice("basicsSex",value,t(`entry.sex.${value}`),"",current===value)).join(""))+entryBNote()}
function renderLiftingStep(){
  const current=model.answers.structuredExperience;
  return entryHeading(t("entry.lifting.title"))+entryBGroup(["first","under_6m","6_to_24m","over_24m"].map(value=>
    entryBChoice("structuredExperience",value,t(`entry.lifting.${value}`),t(`entry.lifting.${value}.sub`),current===value)).join(""))}
function renderCardioStep(){
  const current=model.basics.cardioExperience;
  return entryHeading(t("entry.cardio_experience.title"))+entryBGroup(["none","under_1y","1_to_4y","over_4y"].map(value=>
    entryBChoice("basicsCardio",value,t(`entry.cardio.${value}`),entryCardioSub(value),current===value)).join(""))+entryBNote()}
/** @param {string} value */
function entryCardioSub(value){return value==="none"?"":t(`entry.cardio.${value}.sub`)}
function renderGymStep(){
  const current=model.answers.environment?.kind;
  return entryHeading(t("entry.gym.title"))+`<p class="onb__explain">${esc(t("entry.gym.lede"))}</p>`+
    entryBGroup(model.environments.map(value=>entryBChoice("environment",value,t(`entry.gym.${value}`),t(`entry.gym.${value}.sub`),
      current===value,{icon:ENTRY_ENV_ICONS[value]||"dumbbell"})).join(""))}
function renderGoalStep(){
  const current=model.answers.desiredResult;
  return entryHeading(t("entry.goal.title"))+entryBGroup(["muscle_growth","strength","balanced"].map(value=>
    entryBChoice("desiredResult",value,t(`entry.goal.${value}`),t(`entry.goal.${value}.sub`),current===value,{icon:ENTRY_DESIRED_ICONS[value]})).join(""))}
function renderDaysStep(){
  const current=model.answers.daysPerWeek;
  return entryHeading(t("entry.days_per_week.title"))+entryBGroup([2,3,4,5,6].map(n=>
    entryBChoice("daysPerWeek",n,t("entry.days_per_week.value",{n}),"",current===n)).join(""),{compact:true})+
    `<p class="entry-b__fact" aria-live="polite">${current?esc(t(`entry.days_per_week.split.${current}`)):""}</p>`}
function renderSessionLengthStep(){
  const current=model.answers.sessionMinutes??60;
  return entryHeading(t("entry.session_length.title"))+`<p class="onb__explain">${esc(t("entry.session_length.lede"))}</p>`+
    entryBGroup([20,40,60,90,120,150].map(n=>entryBChoice("sessionMinutes",n,t("entry.session_length.value",{n}),"",current===n)).join(""),{compact:true})}
function renderEquipmentStep(){
  const kind=model.answers.environment?.kind;
  const adjust=model.answers.environment?.adjust||{add:[],remove:[]};
  const preset=new Set(model.presetEquipmentGroups);
  const rows=(model.equipmentGroups||[]).map(group=>{
    const on=adjust.add?.includes(group)||(preset.has(group)&&!adjust.remove?.includes(group));
    return `<button type="button" class="radio-card entry-b__equip${on?" is-selected":""}" role="checkbox" aria-checked="${on?"true":"false"}" data-entry-pick="equipmentGroup" data-entry-val="${esc(group)}">`+
      `<span class="radio-card__body"><span class="radio-card__title">${esc(t(`entry.equipment.group.${group}`))}</span></span><span class="radio-card__mark" aria-hidden="true"></span></button>`}).join("");
  const changed=(adjust.add?.length||0)+(adjust.remove?.length||0)>0;
  return entryHeading(t("entry.equipment.title"))+
    `<p class="onb__explain">${esc(t("entry.equipment.lede",{place:kind?t(`entry.gym.${kind}`):""}))}</p>`+
    `<div class="onb__opts entry-b__equipment" role="group" aria-labelledby="entryHeading">${rows}</div>`+
    `<button type="button" class="btn btn--ghost entry-b__reset" id="entryEquipmentReset"${changed?"":" disabled"}>${esc(t("entry.equipment.reset"))}</button>`}
function renderMusclePrioritiesStep(){
  const a=model.answers;
  const primary=new Set(a.primaryMuscles||[]),reduced=new Set(a.deEmphasizedMuscles||[]);
  const rows=model.muscles.map(muscle=>{
    const state=primary.has(muscle)?"prioritize":reduced.has(muscle)?"reduce":"normal";
    const labelId=`entryPriority-${muscle}`;
    const options=["reduce","normal","prioritize"].map(value=>
      `<button type="button" class="entry-seg__option${state===value?" is-selected":""}" role="radio" aria-checked="${state===value?"true":"false"}" data-entry-pick="musclePriorityB" data-entry-val="${muscle}|${value}">${esc(t(`entry.muscle_priorities.${value}`))}</button>`).join("");
    return `<div class="entry-b__priority"><span id="${labelId}">${esc(t(`entry.muscle.${muscle}`))}</span><div class="entry-seg entry-seg--mini" role="radiogroup" aria-labelledby="${labelId}">${options}</div></div>`}).join("");
  return entryHeading(t("entry.muscle_priorities.title"))+`<p class="onb__explain">${esc(t("entry.muscle_priorities.lede"))}</p>`+
    `<div class="entry-b__priorities">${rows}</div>`+
    `<p class="entry__hint entry__limit" id="entryPriorityLimit" role="status"${model.priorityLimitShown?"":" hidden"}>${esc(t("entry.muscle_priorities.limit"))}</p>`}
function renderDeloadStep(){
  const on=model.answers.deload!==false;
  return entryHeading(t("entry.deload.title"))+
    `<div class="entry-b__deload"><div class="entry-b__deload-head"><strong id="entryDeloadLabel">${esc(t("entry.deload.card"))}</strong>`+
    `<button type="button" class="toggle" id="entryDeloadSwitch" role="switch" aria-checked="${on?"true":"false"}" aria-labelledby="entryDeloadLabel" aria-describedby="entryDeloadBody"></button></div>`+
    `<p id="entryDeloadBody">${esc(t("entry.deload.body"))}</p><span class="entry-b__tag">${esc(t("entry.deload.recommended"))}</span></div>`}
function renderBirthDateStep(){
  const b=model.birth;
  const days=Array.from({length:entryDaysIn(b.m,b.y)},(_,i)=>String(i+1));
  return entryHeading(t("entry.birth_date.title"))+
    `<div class="entry-wheels" data-picker="birth">${renderEntryWheel("entryWheelDay",t("entry.birth_date.day"),days,b.d-1)}`+
    `${renderEntryWheel("entryWheelMonth",t("entry.birth_date.month"),model.monthNames,b.m-1)}`+
    `${renderEntryWheel("entryWheelYear",t("entry.birth_date.year"),model.birthYears.map(String),model.birthYears.indexOf(b.y))}<div class="entry-wheels__band" aria-hidden="true"></div></div>`+entryBNote()}
/** @param {string} key @param {string[][]} options @param {string} current @param {string} label */
function entryUnitSeg(key,options,current,label){
  return `<div class="entry-seg entry-seg--unit" role="radiogroup" aria-label="${esc(label)}">`+options.map(([value,text])=>
    `<button type="button" class="entry-seg__option${current===value?" is-selected":""}" role="radio" aria-checked="${current===value?"true":"false"}" data-entry-pick="${key}" data-entry-val="${value}">${esc(text)}</button>`).join("")+`</div>`}
function renderHeightStep(){
  const unit=model.heightUnit,cm=Math.round(model.heightCm);
  let wheels;
  if(unit==="cm"){
    const values=Array.from({length:101},(_,i)=>120+i);
    wheels=renderEntryWheel("entryWheelCm",t("entry.height.title"),values.map(n=>t("entry.height.value_cm",{n})),cm-120)}
  else{
    const total=Math.round(cm/2.54),ft=Math.floor(total/12),inch=total%12;
    wheels=renderEntryWheel("entryWheelFt",t("entry.height.feet"),[3,4,5,6,7].map(n=>t("entry.height.value_ft",{n})),ft-3)+
      renderEntryWheel("entryWheelIn",t("entry.height.inches"),Array.from({length:12},(_,i)=>t("entry.height.value_in",{n:i})),inch)}
  return entryHeading(t("entry.height.title"))+
    entryUnitSeg("basicsHeightUnit",[["cm",t("entry.height.cm")],["ftin",t("entry.height.ftin")]],unit,t("entry.height.unit_label"))+
    `<div class="entry-wheels" data-picker="height">${wheels}<div class="entry-wheels__band" aria-hidden="true"></div></div>`+entryBNote()}
function renderWeightStep(){
  const unit=model.weightUnit,range=entryWeightRange(unit);
  const shown=unit==="lb"?Math.round(model.weightKg/KG_PER_LB/range.step)*range.step:Math.round(model.weightKg*10)/10;
  const value=Math.max(range.min,Math.min(range.max,shown));
  const steps=Math.round((range.max-range.min)/range.step);
  const labels=[];
  for(let i=0;i<=steps;i+=10)labels.push(`<em style="left:${i*8}px">${Math.round(range.min+i*range.step)}</em>`);
  const text=entryWeightText(value,unit);
  return entryHeading(t("entry.weight.title"))+
    entryUnitSeg("basicsWeightUnit",[["kg",t("entry.weight.kg")],["lb",t("entry.weight.lb")]],unit,t("entry.weight.unit_label"))+
    `<div class="entry-ruler" data-picker="weight"><p class="entry-ruler__value"><button type="button" class="entry-ruler__type" id="entryWeightType" aria-label="${esc(t("entry.weight.ruler",{unit}))}" aria-haspopup="dialog"><b>${esc(entryDecimal(value,1))}</b> ${unit}</button></p>`+
    `<div class="entry-ruler__scroll" id="entryWeightRuler" role="slider" tabindex="0" aria-orientation="horizontal" aria-label="${esc(t("entry.weight.ruler",{unit}))}" `+
    `aria-valuemin="${range.min}" aria-valuemax="${range.max}" aria-valuenow="${Number(value).toFixed(1)}" aria-valuetext="${esc(text)}" data-min="${range.min}" data-step="${range.step}" data-steps="${steps}" data-unit="${unit}">`+
    `<div class="entry-ruler__track" style="width:${steps*8}px">${labels.join("")}</div></div><span class="entry-ruler__needle" aria-hidden="true"></span></div>`+entryBNote(true)}
/** @param {string} key */
function entryAbilityAnswer(key){
  const value=model.answers?.competencyAnswers?.[key];
  if(value===true)return"yes";
  if(value===false)return"no";
  return"unsure"}
/** @param {string} key @param {string} choice */
function entryAbilityOption(key,choice){
  const current=entryAbilityAnswer(key);
  const selected=current===choice;
  const label=t(`entry.abilities.choice.${choice}`);
  return `<button type="button" class="radio-card${selected?" is-selected":""}" data-entry-pick="competencyAnswer" data-entry-val="${esc(`${key}|${choice}`)}" role="radio" aria-checked="${selected?"true":"false"}">`+
    `<span class="radio-card__body"><span class="radio-card__title">${esc(label)}</span></span><span class="radio-card__mark" aria-hidden="true"></span></button>`}
/** @param {string} key */
function entryAbilityRow(key){
  const labelId=`entryAbility-${esc(key)}`;
  return `<div class="entry__ability-row">`+
    `<p class="entry__group-lab" id="${labelId}">${esc(t(`entry.abilities.question.${key}`))}</p>`+
    `<div class="onb__opts onb__opts--reasons" role="radiogroup" aria-labelledby="${labelId}">`+
    ENTRY_ABILITY_CHOICES.map(choice=>entryAbilityOption(key,choice)).join("")+`</div></div>`}
function entryAbilitiesBody(){
  return `<div class="entry__ability-list">`+model.competencies.map(entryAbilityRow).join("")+`</div>`}
/** @param {{b?:boolean}} [options] */
function renderAbilitiesStep({b=false}={}){
  // B's skip is the pinned Skip under Continue; Custom keeps its inline one.
  if(b)return entryHeading(t("entry.abilities.title"))+`<p class="onb__explain">${esc(t("entry.abilities.lede"))}</p>`+entryAbilitiesBody();
  const skip=`<button type="button" class="btn btn--steel entry__skip" id="entryAbilitiesSkip">${esc(t("entry.skip_optional"))}</button>`;
  return entryHeading(t("entry.abilities.title"))+`<p class="entry__optional">${esc(t("entry.optional"))}</p>`+
    `<p class="onb__explain">${esc(t("entry.abilities.lede"))}</p>`+skip+entryAbilitiesBody()}
function renderBuildingStep(){
  const minutes=model.answers.sessionMinutes||60;
  const deload=model.answers.deload!==false;
  const lines=[t("entry.building.equipment"),t("entry.building.minutes",{m:minutes}),t("entry.building.reps"),
    t(deload?"entry.building.deload":"entry.building.block")];
  return `<div class="entry-building" id="entryBuilding">`+
    `<img class="entry-building__mark" src="assets/brand/mark.png" alt="" width="56" height="56">`+
    entryHeading(t("entry.building.title"))+
    `<ul class="entry-building__steps" aria-hidden="true">${lines.map(text=>`<li><span class="entry-building__tick icon-mask icon-mask--check icon-mask--sm" aria-hidden="true"></span><span>${esc(text)}</span></li>`).join("")}</ul>`+
    `<div class="entry-building__bar" aria-hidden="true"><i></i></div>`+
    `<p class="entry-building__wait motion-hairline" id="entryBuildingWait" role="status" hidden><span class="motion-hairline__label">${esc(t("entry.building.pending"))}</span></p>`+
    `<button type="button" class="btn btn--ghost entry-building__skip" id="entryBuildingSkip">${esc(t("entry.building.skip"))}</button>`+
  `</div>`}
 /** @type {Record<string,()=>string>} */ const renderers={intro:renderIntroStep,sex:renderSexStep,birth_date:renderBirthDateStep,height:renderHeightStep,weight:renderWeightStep,background:renderLiftingStep,cardio_experience:renderCardioStep,environment:renderGymStep,equipment:renderEquipmentStep,desired_result:renderGoalStep,days_per_week:renderDaysStep,session_length:renderSessionLengthStep,muscle_priorities:renderMusclePrioritiesStep,deload:renderDeloadStep,abilities:()=>renderAbilitiesStep({b:model.recommend}),building:renderBuildingStep};
 return renderers[step]?.()||'';
 }
 return Object.freeze({render});
}
