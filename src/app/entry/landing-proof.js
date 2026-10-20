import {progression,evidence} from '../../training/progress.js';
/** @typedef {ReturnType<typeof import('../../training/model.js').createProgramModel>} Model
 * @typedef {Parameters<typeof import('../../training/model.js').createProgramModel>[0]['catalog']} Catalog
 * @typedef {{ex:string,sets:number,repMin:number,repMax:number,logged:readonly (readonly number[])[]}} Example
 */
const LANDING_UNIT="kg";
const LANDING_CASES=/** @type {const} */({
	add:{ex:"19f5c6f170d8808bb424e98de4472a7e",sets:3,repMin:8,repMax:10,logged:[[60,10,2],[60,10,2],[60,10,2]]},
	hold:{ex:"1a25c6f170d8803d8231d083fdd65458",sets:3,repMin:5,repMax:8,logged:[[100,7,1],[100,6,0],[100,6,0]]},
	reduce:{ex:"19f5c6f170d8808bb424e98de4472a7e",sets:3,repMin:8,repMax:10,logged:[[70,7,0],[70,6,0],[70,6,0]]}});
/** The squat history behind the chart image: four sessions, one rung up each week. */
const LANDING_CHART=/** @type {const} */({exerciseId:"ex-squat",libraryId:"1a25c6f170d8803d8231d083fdd65458",started:"2026-08-03",
  dates:["2026-08-03","2026-08-10","2026-08-17","2026-08-24"],
  ladder:[92.5,95,97.5,100],reps:[6,7,7,8],rir:[2,2,1,1],sets:3,min:5,
  /* the capture size per language (the Portuguese figure captions wrap, so it is taller), from tools/capture-landing-proof.mjs */
  dims:{en:[584,728],pt:[584,766]}});
/** @param {unknown} value */
function freezeInput(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freezeInput);Object.freeze(value)}}
/** Live landing figures use the same production progression/evidence as a
 * workout. Authored examples are isolated from the lifter's saved training.
 * @param {{model:Model,catalog:Catalog,minJump:number,defaultWeeks?:number}} options */
export function buildLandingProof({model,catalog,minJump,defaultWeeks=6}){
freezeInput(LANDING_CASES);freezeInput(LANDING_CHART);
function landingChartRows(){
  const c=LANDING_CHART;
  /** @type {NonNullable<Parameters<typeof evidence.buildStrengthEvidence>[2]>} */const rows=[];
  c.dates.forEach((date,week)=>{
    for(let set=1;set<=c.sets;set++)rows.push({session:`${date}_landing`,date,exerciseId:c.exerciseId,set,
      load:c.ladder[week],reps:Math.max(c.min,c.reps[week]-(set-1)),
      rir:Math.max(0,c.rir[week]-(set-1)),created:`${date}T18:${10+set}:00.000Z`})});
  return rows}
/** @param {Example} c */
function landingEvaluate(c){
  const engine=progression;
  const exercise=catalog.exercises.find(exercise=>exercise.id===c.ex),definitions=model.rawMetricDefinitions(c.ex);
  if(!engine?.recommendSets||!exercise||!definitions?.length)return null;
  const loadMetric=definitions.find(definition=>definition.semantic==="loadKg");
  const repsMetric=definitions.find(definition=>definition.semantic==="reps");
  if(!loadMetric||!repsMetric)return null;
  const slotId=`landing:${c.ex}`,equipmentId="landing-demo-barbell";
  const prescription={id:`${slotId}:cycle-1:set-1`,slotId,exerciseId:c.ex,setIndex:1,
    metricType:"source_metrics@1",metricIds:[...(exercise.exerciseMetrics||[])],metricDefinitions:definitions,
    targets:{reps:{min:c.repMin,max:c.repMax}},rir:1,status:"ready",loadingModel:{bodyweightCoefficient:0}};
  const sets=c.logged.map(([load,reps,rir],setIndex)=>({exerciseId:c.ex,completed:true,setIndex,rir,equipmentId,
    loadingConvention:"external",metricIds:[...(exercise.exerciseMetrics||[])],
    metricValues:definitions.map(definition=>({metricId:definition.id,
      value:definition.semantic==="loadKg"?load:definition.semantic==="reps"?reps:null,unit:definition.unit})),
    loadingContext:{loadingConvention:"external",bodyweightContributionEnabled:false,bodyweightKg:null,
      bodyweightCoefficient:0,externalLoadMultiplier:1}}));
  const increment=Number.isFinite(+minJump)&&+minJump>0?+minJump:2.5;
  const maxLoad=Math.max(...c.logged.map(([load])=>load))+increment*12;
  const availableLoadsKg=Array.from({length:Math.ceil(maxLoad/increment)+1},(_,index)=>index*increment);
  const result=engine.recommendSets([prescription],[{sessionId:`${slotId}:history`,completed:true,sets}],[],
    {bySlotId:{[slotId]:{equipmentId,availableLoadsKg,loadingConvention:"external",
      bodyweightContributionEnabled:false,bodyweightKg:null,externalLoadMultiplier:1}}},
    {weightMatch:false,expandRepRange:true})[0];
  if(result?.status!=="recommended")return null;
  return{status:result.status,load:result.targets.loadKg,reps:result.targets.reps}}
/** Strength-trend figures for the chart, from the Progress model. */
function landingChartFigures(){
  const Model=evidence;
  const series=Model.buildStrengthEvidence("all-history",LANDING_CHART.exerciseId,landingChartRows(),{started:LANDING_CHART.started});
  if(!series?.points?.length)return null;
  const last=series.points.at(-1);if(!last)return null;
  return{from:series.points[0].value,to:last.value,sessions:series.evidenceCount}}

 const recommendations=Object.fromEntries(Object.entries(LANDING_CASES).map(([id,input])=>[id,landingEvaluate(input)]));
 const lookup=model.snapshotLookup([]),ids=new Set([...Object.values(LANDING_CASES).map(input=>input.ex),LANDING_CHART.libraryId]);
 const names=Object.fromEntries([...ids].map(id=>{const value=lookup(id);return[id,{en:value?.name||'',pt:value?.namePt||value?.name||''}]}));
 return{defaultWeeks,unit:LANDING_UNIT,cases:LANDING_CASES,chartInput:LANDING_CHART,recommendations,chart:landingChartFigures(),names};
}
