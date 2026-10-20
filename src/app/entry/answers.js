/** @typedef {ReturnType<ReturnType<typeof import('../../training/authoring.js').createEntryRules>['createState']>} EntryDraft
 * @typedef {EntryDraft['answers']} Answers
 * @typedef {{muscles:readonly string[],competencies:readonly string[],equipmentGroups:readonly string[],avoidReasons:readonly string[],maxPriority:number,maxMuscles:number}} Vocabulary
 */
/** Entry form commands use one explicit answer target: the live draft or an
 * inline editor's private copy. They never swap the active application draft.
 * Validation and durable writes stay with that target's application owner.
 * @param {{read:()=>EntryDraft|null,apply:(patch:Partial<Answers>)=>void,vocabulary:Vocabulary,presetEquipmentGroups:(kind:string)=>readonly string[]}} bindings */
export function createEntryAnswerCommands({read,apply,vocabulary:v,presetEquipmentGroups}){
 /** @param {Partial<Answers>} patch */ function patch(patch){if(!read())return false;apply(patch);return true}
 /** @param {string} key @param {string} muscle @param {Answers} answers */
 function blocked(key,muscle,answers){
  const primary=new Set(answers.primaryMuscles||[]),deemphasized=new Set(answers.deEmphasizedMuscles||[]),ignored=new Set(answers.ignoredMuscles||[]);
  return key==='primaryMuscles'?(deemphasized.has(muscle)||ignored.has(muscle)):key==='deEmphasizedMuscles'?(primary.has(muscle)||ignored.has(muscle)):key==='ignoredMuscles'?(primary.has(muscle)||deemphasized.has(muscle)):false;
 }
 /** @param {string} group @param {Answers} answers */
 function equipment(group,answers){const env=answers.environment;if(!env?.kind||!v.equipmentGroups.includes(group))return false;
  const preset=presetEquipmentGroups(env.kind).includes(group),add=new Set(env.adjust?.add||[]),remove=new Set(env.adjust?.remove||[]),on=add.has(group)||(preset&&!remove.has(group));
  add.delete(group);remove.delete(group);if(!on&&!preset)add.add(group);if(on&&preset)remove.add(group);
  return patch({environment:{kind:env.kind,adjust:{add:[...add],remove:[...remove]}}});
 }
 /** @param {{key:string,raw:string,multi?:boolean}} choice @returns {'accepted'|'ignored'|'priority-limit'} */
 function choose({key,raw,multi=false}){
  const draft=read();if(!draft)return 'ignored';const a=draft.answers;
  if(key==='environment')return patch({environment:{kind:raw}})?'accepted':'ignored';
  if(key==='musclePriority'||key==='musclePriorityB'){
   const [muscle,status]=raw.split('|'),isB=key==='musclePriorityB';
   if(!v.muscles.includes(muscle)||!(isB?['normal','prioritize','reduce']:['normal','prioritize','deemphasize','ignore']).includes(status))return 'ignored';
   const primary=(a.primaryMuscles||[]).filter(item=>item!==muscle),deemphasized=(a.deEmphasizedMuscles||[]).filter(item=>item!==muscle),ignored=(a.ignoredMuscles||[]).filter(item=>item!==muscle);
   if(status==='prioritize'){if(!isB&&primary.length>=v.maxPriority)return 'ignored';primary.push(muscle)}
   else if(status==='deemphasize'||status==='reduce')deemphasized.push(muscle);else if(status==='ignore')ignored.push(muscle);
   if(isB&&(primary.length>v.maxPriority||deemphasized.length>v.maxPriority))return 'priority-limit';
   patch(isB?{primaryMuscles:primary,deEmphasizedMuscles:deemphasized}:{primaryMuscles:primary,deEmphasizedMuscles:deemphasized,ignoredMuscles:ignored});return 'accepted';
  }
  if(key==='competencyAnswer'){
   const [competency,choice]=raw.split('|');if(!v.competencies.includes(competency)||!['yes','no','unsure'].includes(choice))return 'ignored';
   const current={...(a.competencyAnswers||{})};current[competency]=choice==='yes'?true:choice==='no'?false:null;
   if(competency==='pullups10'&&current.pullups10===true)current.pullups5=true;
   if(competency==='pullups5'&&current.pullups5!==true&&current.pullups10===true)current.pullups10=current.pullups5;
   patch({competencyAnswers:current});return 'accepted';
  }
  if(key==='avoidReason'){
   const [exerciseId,reason]=raw.split('|');if(!exerciseId||!v.avoidReasons.includes(reason))return 'ignored';
   const constraints=[...(a.exerciseConstraints||[])],index=constraints.findIndex(item=>item.exerciseId===exerciseId);
   if(index>=0)constraints[index]={exerciseId,reason};else constraints.push({exerciseId,reason});patch({exerciseConstraints:constraints});return 'accepted';
  }
  if(key==='preferredRestSeconds'){patch({preferredRestSeconds:raw==='auto'?null:+raw});return 'accepted'}
  if(key==='daysPerWeek'||key==='sessionMinutes'){patch({[key]:+raw});return 'accepted'}
  const basicKey={basicsSex:'sex',basicsCardio:'cardioExperience',basicsHeightUnit:'heightUnit',basicsWeightUnit:'weightUnit'}[key];
  if(basicKey){patch({basics:{...(a.basics||{}),[basicKey]:raw}});return 'accepted'}
  if(key==='equipmentGroup')return equipment(raw,a)?'accepted':'ignored';
  if(multi&&['primaryMuscles','priorityMovements','deEmphasizedMuscles','ignoredMuscles'].includes(key)){
   const value=a[key],current=Array.isArray(value)?[...value]:[],index=current.indexOf(raw);
   if(index>=0)current.splice(index,1);
   else if(key==='primaryMuscles'||key==='priorityMovements'){if(current.length<(key==='primaryMuscles'?v.maxPriority:2)&&!blocked(key,raw,a))current.push(raw)}
   else if(current.length<v.maxMuscles&&!blocked(key,raw,a))current.push(raw);
   patch({[key]:current});return 'accepted';
  }
  if(['desiredResult','structuredExperience','recentConsistency','splitPreference'].includes(key)){patch({[key]:raw});return 'accepted'}
  return 'ignored';
 }
 /** @param {string} id */
 function canAvoid(id){const a=read()?.answers;if(!a)return false;return !(a.mustHaveExercises||[]).includes(id)&&!(a.exerciseConstraints||[]).some(item=>item.exerciseId===id)&&(a.exerciseConstraints||[]).length<32}
 /** @param {string} id */
 function includeExercise(id){const a=read()?.answers;if(!a||(a.mustHaveExercises||[]).includes(id)||(a.exerciseConstraints||[]).some(item=>item.exerciseId===id)||(a.mustHaveExercises||[]).length>=32)return false;return patch({mustHaveExercises:[...(a.mustHaveExercises||[]),id]})}
 /** @param {string} id */
 function removeExercise(id){const a=read()?.answers;if(!a)return false;return patch({mustHaveExercises:(a.mustHaveExercises||[]).filter(item=>item!==id),exerciseConstraints:(a.exerciseConstraints||[]).filter(item=>item.exerciseId!==id)})}
 /** @param {string} id */
 function removeAvoidance(id){const a=read()?.answers;return a?patch({exerciseConstraints:(a.exerciseConstraints||[]).filter(item=>item.exerciseId!==id)}):false}
 function resetEquipment(){const env=read()?.answers.environment;return env?.kind?patch({environment:{kind:env.kind}}):false}
 /** @param {boolean} enabled */ const setDeload=enabled=>patch({deload:enabled});
 return Object.freeze({choose,canAvoid,includeExercise,removeExercise,removeAvoidance,resetEquipment,setDeload,clearPriorities:()=>patch({primaryMuscles:[]})});
}
