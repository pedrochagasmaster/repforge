import {copySnapshot} from './session.js';
import {effortForRir,canonicalDraftField,canonicalNumberText,parseDecimalInput,POUNDS_PER_KG} from '../training/metrics.js';
import {workoutDayIdForSnapshot,workoutProgramFingerprint,workoutParseContextForSnapshot,readRevision} from '../persistence/snapshot.js';
import {createWorkoutRules} from '../training/workout.js';
import {movementToken} from './workout-model.js';
import {compareChronology} from '../training/progress.js';
import {isPlainStateObject} from '../training/model.js';
/** @typedef {import('./workout-model.js').Exercise} Exercise
 * @typedef {{snapshot:ContextSnapshot,query:import('./workout-model.js').WorkoutCapture,rows:Exercise[],currentCycle:number|null,calendarDate:string,library:import('./workout-model.js').LibraryEntry[],language:string}} DraftContextFacts
 * @typedef {{now:string,draftId:string,writer:import('../training/workout-contracts.js').Writer}} DraftCreationIdentity
 * @typedef {import('./workout-model.js').WorkoutSnapshot & {programMeta?:import('../training/model.js').ProgramMeta & {id?:string,blockId?:unknown},settings:{unit?:string,rirMode?:string,minJump?:number,weightMatch?:boolean,expandRepRange?:boolean}}} ContextSnapshot
 */
/** A new workout freezes the program's current cycle and loading identity.
 * This owner assembles actual model/query facts; it neither invents a training
 * rule nor reads a clock or storage. Catalog indexing shares its page lifetime.
 * @param {{model:ReturnType<typeof import('../training/model.js').createProgramModel>,catalog:Parameters<typeof import('./workout-model.js').createWorkoutReadModel>[0]['catalog'],editorRules:Pick<ReturnType<typeof import('../training/authoring.js').createInstalledEditorRules>,'editorSuggestLoadsPolicy'>,workout?:ReturnType<typeof createWorkoutRules>}} options */
export function createWorkoutContext({model,catalog,editorRules,workout=createWorkoutRules(catalog)}){
  const rawById=new Map(catalog.exercises.map(exercise=>[exercise.id,exercise]));
  /** @param {unknown} id */const raw=id=>rawById.get(String(id??''))||null;
  /** @param {{snapshot:ContextSnapshot,query:import('./workout-model.js').WorkoutCapture,label:string,currentCycle:number|null,calendarDate:string}} facts */
  function program({snapshot,query,label,currentCycle,calendarDate}){
    const definition=snapshot.programMeta?.programDefinition,cycleNumber=currentCycle||1;
    const projected=definition&&currentCycle!=null?model.flatProgramFromDefinition(definition,snapshot.customExercises||[],currentCycle):null;
    /** @type {Exercise[]} */
    const rows=(projected||snapshot.program).filter(ex=>ex.day===label).sort((a,b)=>Number(a.order)-Number(b.order)||a.name.localeCompare(b.name));
    const canonicalDays=new Map((definition?.days||[]).map(day=>[day.name,day]));
    const context={programId:String(snapshot.programMeta?.id||'local-program'),programFingerprint:workoutProgramFingerprint(snapshot),
      durableRevision:readRevision(snapshot),dayId:workoutDayIdForSnapshot(snapshot,label),dayLabel:label,scheduleDate:calendarDate,
      unit:snapshot.settings.unit==='lb'?'lb':'kg',rirMode:snapshot.settings.rirMode==='effort'?'effort':'numeric',
      exercises:rows.map((ex,index)=>{
        const rec=query.recommendation(ex),previous=query.last(ex),canonicalDay=canonicalDays.get(ex.day);
        const slot=canonicalDay?.slots.find(item=>item.id===(ex.slotId||ex.id)),cycle=slot?.prescriptionsByCycle?.find(item=>item.cycleIndex===cycleNumber);
        const metricDefinitions=slot?.metricDefinitions||model.rawMetricDefinitions(ex.libraryId||'')||null;
        const metricOrigin=slot?.metricOrigin||(raw(ex.libraryId)?'source_catalog':'user_defined');
        const {loadingModel,loadingConvention,loadingContext}=query.metricLoading(metricDefinitions,raw(ex.libraryId),slot?.loadingModel);
        const projection=slot?query.slotLoadingProjection(slot):null;
        if(projection)loadingContext.externalLoadMultiplier=projection.externalLoadMultiplier;
        if(projection?.executionMode&&editorRules.editorSuggestLoadsPolicy.executionModeQuestion(slot))loadingContext.executionMode=projection.executionMode;
        const programmedSets=cycle?cycle.sets.map((prescription,ordinal)=>{
          const old=previous.find(row=>row.set===ordinal+1),target=prescription.targets?.reps??prescription.targets?.repsPerSide;
          const min=typeof target==='object'&&target!==null?target.min:target,max=typeof target==='object'&&target!==null?target.max:target;
          return{suggestedLoad:null,suggestedReps:min??null,targetRir:prescription.rir,suggestedEffort:prescription.rir==null?null:effortForRir(prescription.rir),
            minReps:min??ex.min,maxReps:max??ex.max,metricDefinitions,targets:copySnapshot(prescription.targets||{}),restSeconds:prescription.restSeconds,
            role:prescription.status==='configuration_required'?'configuration_required':'working',previousMetrics:old?.metricValues||old?.metrics||[]};
        }):Array.from({length:ex.sets},(_,ordinal)=>{
          const n=ordinal+1,old=previous.find(row=>row.set===n),suggestion=query.setSuggestion(ex,n,rec);
          return{suggestedLoad:suggestion.load??null,suggestedReps:suggestion.reps??ex.min,targetRir:old?.rir??1,suggestedEffort:effortForRir(old?.rir??1),
            minReps:ex.min,maxReps:ex.max,metricDefinitions,targets:{}};
        });
        return{legacyExerciseId:ex.id,exerciseInstanceId:ex.id,sourceExerciseId:String(ex.slotId||ex.libraryId||ex.movementId||ex.id),libraryId:ex.libraryId,movementId:ex.movementId,
          displayName:ex.name,sets:ex.sets,setIds:Array.from({length:ex.sets},(_,ordinal)=>`set-${ordinal+1}`),minReps:ex.min,maxReps:ex.max,targetRir:1,
          notes:ex.notes||'',primary:ex.primary||'',secondary:ex.secondary||'',progressionStrategy:query.progressionForExercise(ex)?.strategy?.id||'range',movementPattern:ex.loadingMode||null,
          metricDefinitions,metricOrigin,loadingModel,loadingConvention,loadingContext,sourceFingerprint:workoutProgramFingerprint({programMeta:{id:ex.id},program:[ex]}),programmedSets,index};
      })};
    return Object.prototype.hasOwnProperty.call(snapshot.programMeta||{},'blockId')?{...context,blockId:snapshot.programMeta?.blockId}:context;
  }
  /** Invalid bodyweight remains the original display text for correction.
   * @param {unknown} value @param {string} unit */
  function bodyweight(value,unit){
    const raw=String(value??'');if(!raw.trim())return '';
    const parsed=parseDecimalInput(raw);if(!Number.isFinite(parsed)||parsed<=0)return raw;
    return canonicalNumberText(unit==='lb'?parsed/POUNDS_PER_KG:parsed);
  }
  /** Captured facts, not host policy callbacks. Each operation gets one program,
   * history and movement vocabulary while the storage lock owns final CAS.
   * @param {DraftContextFacts} facts */
  function draftInputs(facts){
    const {snapshot,rows,library}=copySnapshot({snapshot:facts.snapshot,rows:facts.rows,library:facts.library});
    const {query,currentCycle,calendarDate,language}=facts;
    const customs=snapshot.customExercises||[],pickable=customs.filter(entry=>!entry.archived).concat(library);
    const libraryById=new Map(library.map(entry=>[entry.id,entry]));
    /** @param {import('./workout-model.js').LibraryEntry} entry */
    const name=entry=>language==='pt'&&entry.namePt||entry.name;
    /** @param {Exercise} exercise */
    function note(exercise){
      const matching=query.matchLift(exercise),notes=snapshot.log.filter(row=>matching(row)&&String(row.exNote||'').trim());
      const latest=notes.sort(compareChronology).at(-1);return latest?String(latest.exNote).trim():'';
    }
    /** @param {string} label */
    function previous(label){return Object.fromEntries(rows.filter(ex=>ex.day===label).map(ex=>[ex.id,{exerciseInstanceId:ex.id,setupNotes:note(ex),sets:query.last(ex)}]));}
    /** @param {string} label */
    const parse=label=>workoutParseContextForSnapshot(snapshot,label);
    /** @param {import('../training/workout-contracts.js').Draft} draft */
    function disposable(draft){
      try{
        if(!workout.isPristine(draft))return false;
        if(String(draft.program.scheduleDate||'')!==String(draft.session.startedAt||'').slice(0,10))return false;
        if(!draft.exerciseOrder.every((id,index)=>draft.exercises[id]?.programmed?.order===index))return false;
        const seeds=previous(draft.program.dayLabel);
        return draft.exerciseOrder.every(id=>String(draft.exercises[id]?.setupNotes??'')===String(seeds[id]?.setupNotes??''));
      }catch{return false;}
    }
    /** @param {string} label @param {Record<string,unknown>} options @param {DraftCreationIdentity} identity */
    function creation(label,options,identity){
      const programContext=program({snapshot,query,label,currentCycle,calendarDate});
      const seeds=previous(label);
      return{programContext,sessionSelection:{draftId:identity.draftId,writer:identity.writer,startedAt:identity.now,updatedAt:identity.now,
        scheduleDate:calendarDate,selectedExerciseId:programContext.exercises[0]?.exerciseInstanceId??null,bodyweight:null,notes:'',contextTouched:options.contextTouched},
        previousSessionFacts:Object.fromEntries(programContext.exercises.map(source=>[source.exerciseInstanceId,seeds[source.exerciseInstanceId]||{exerciseInstanceId:source.exerciseInstanceId,setupNotes:'',sets:[]}]))};
    }
    /** @param {unknown} value @param {string} label @param {DraftCreationIdentity} identity */
    function migration(value,label,identity){
      const legacy=isPlainStateObject(value)?value:{},seed=creation(label,{},identity);
      /** @type {Record<string,string>} */const values={};
      for(const key of Object.keys(legacy)){
        if(/_load$/.test(key))values[key]=canonicalDraftField('load',legacy[key],snapshot.settings.unit);
        else if(/_reps$/.test(key))values[key]=canonicalDraftField('reps',legacy[key],snapshot.settings.unit);
        else if(/_rir$/.test(key))values[key]=canonicalDraftField('rir',legacy[key],snapshot.settings.unit);
        else if(/_effort$/.test(key))values[key]=String(legacy[key]??'');
        else if(key==='__bodyweight')values[key]=bodyweight(legacy[key],snapshot.settings.unit||'kg');
      }
      /** @type {Map<string,import('./workout-model.js').LibraryEntry|null>} */const byName=new Map();
      for(const entry of pickable)for(const label of [entry.name,entry.namePt,name(entry)]){
        const token=movementToken(label);if(!token)continue;
        if(!byName.has(token))byName.set(token,entry);else if(byName.get(token)?.id!==entry.id)byName.set(token,null);
      }
      const substitutions=isPlainStateObject(legacy.__substituted)?legacy.__substituted:{},refs=isPlainStateObject(legacy.__substitutedRef)?legacy.__substitutedRef:{};
      const resolved=Object.fromEntries(Object.entries(substitutions).map(([id,rawName])=>{
        const label=String(rawName||'').trim(),ref=refs[id]??null;
        const entry=ref?(String(ref).startsWith('custom:')?customs.find(entry=>entry.id===String(ref)):libraryById.get(String(ref))):byName.get(movementToken(label));
        const replacement=entry?{exerciseInstanceId:`replacement:${entry.id}`,sourceExerciseId:entry.id,libraryId:entry.id,
          displayName:label||name(entry),primary:model.libraryMuscleAttribution(entry,'primary'),secondary:model.libraryMuscleAttribution(entry,'secondary')}
          :{exerciseInstanceId:`replacement:${id}`,sourceExerciseId:`adhoc:${movementToken(label)}`,movementId:`adhoc:${movementToken(label)}`,displayName:label,primary:'',secondary:''};
        return[id,{legacyName:rawName,legacyRef:ref,replacement,selectedAt:identity.now}];
      }));
      return{...seed,valueResolutions:values,substitutionResolutions:resolved,migratedAt:identity.now,completedAt:identity.now};
    }
    return Object.freeze({parse,disposable,creation,migration});
  }
  return Object.freeze({program,draftInputs,bodyweight});
}
