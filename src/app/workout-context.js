import {copySnapshot} from './session.js';
import {effortForRir} from '../training/metrics.js';
import {workoutDayIdForSnapshot,workoutProgramFingerprint,readRevision} from '../persistence/snapshot.js';
/** @typedef {import('./workout-model.js').Exercise} Exercise
 * @typedef {import('./workout-model.js').WorkoutSnapshot & {programMeta?:import('../training/model.js').ProgramMeta & {id?:string,blockId?:unknown},settings:{unit?:string,rirMode?:string,minJump?:number,weightMatch?:boolean,expandRepRange?:boolean}}} ContextSnapshot
 */
/** A new workout freezes the program's current cycle and loading identity.
 * This owner assembles actual model/query facts; it neither invents a training
 * rule nor reads a clock or storage. Catalog indexing shares its page lifetime.
 * @param {{model:ReturnType<typeof import('../training/model.js').createProgramModel>,catalog:Parameters<typeof import('./workout-model.js').createWorkoutReadModel>[0]['catalog'],editorRules:Pick<ReturnType<typeof import('../training/authoring.js').createInstalledEditorRules>,'editorSuggestLoadsPolicy'>}} options */
export function createWorkoutContext({model,catalog,editorRules}){
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
  return {program};
}
