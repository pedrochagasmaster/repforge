import {formatNumberPlain,formatNumber} from '../format.js';
import {parseDecimalInput,canonicalMetricInput as metricInput,metricKgFromDisplay,parseMetricValue,POUNDS_PER_KG} from '../../training/metrics.js';

/** @typedef {import('../../training/metrics.js').MetricDefinition} MetricDefinition
 * @typedef {number|{min:number,max:number}|null|undefined} Target
 */
/** Metric presentation shared by the Focus shelf and existing History forms.
 * Canonical parsing is always the training metric owner's operation. This
 * owner only chooses display units, labels and field-validation copy.
 * @param {{readSettings:()=>{unit?:string},copy:{t:(key:string)=>string,language:()=>string}}} options */
export function createMetricDisplay({readSettings,copy}) {
  const unit=()=>readSettings().unit==='lb'?'lb':'kg';
  const toDisplay=(/** @type {number} */ value)=>unit()==='lb'?(+value||0)*POUNDS_PER_KG:(+value||0);
  const fmt=(/** @type {unknown} */ value)=>formatNumber(value,copy.language());
  /** @param {unknown} raw @param {MetricDefinition} metric */
  function text(raw,metric){
    if(raw==null||raw==='')return'';
    const value=parseDecimalInput(raw);
    if(!Number.isFinite(value))return String(raw);
    return ['loadKg','assistanceKg','loadPerSideKg','persistentLoadPerSideKg'].includes(metric.semantic)
      ?formatNumberPlain(toDisplay(value)):formatNumberPlain(value);
  }
  /** @param {MetricDefinition} metric @param {unknown} raw */
  function canonicalInput(metric,raw){return metricInput(metric,raw,unit());}
  /** @param {number} value */
  const kgFromDisplay=value=>metricKgFromDisplay(value,unit());
  /** @param {Target} target */
  function targetText(target){
    if(target==null)return'';
    if(typeof target==='number')return fmt(target);
    if(Number.isFinite(target.min)&&Number.isFinite(target.max))return target.min===target.max?fmt(target.min):`${fmt(target.min)}–${fmt(target.max)}`;
    return'';
  }
  /** @param {MetricDefinition} metric */
  function label(metric){
    /** @type {Record<string,string>} */
    const keys={loadKg:'focus.metric.load_kg',assistanceKg:'focus.metric.assistance_kg',reps:'focus.metric.reps',
      durationSeconds:'focus.metric.duration_seconds',distanceShortMeters:'focus.metric.distance_short_meters',
      distanceLongMeters:'focus.metric.distance_long_meters',loadPerSideKg:'focus.metric.load_per_side_kg',
      repsPerSide:'focus.metric.reps_per_side',durationPerSideSeconds:'focus.metric.duration_per_side_seconds',
      persistentLoadPerSideKg:'focus.metric.persistent_load_per_side_kg',distanceShortPerSideMeters:'focus.metric.distance_short_per_side_meters'};
    return keys[metric.semantic]?copy.t(keys[metric.semantic]):metric.sourceName;
  }
  /** @param {MetricDefinition} metric */
  function displayUnit(metric){
    if(metric?.unit==='kg')return unit();
    if(metric?.unit==='metres')return'm';
    if(metric?.unit==='seconds')return's';
    return'';
  }
  /** @param {MetricDefinition} metric @param {Target} target */
  function canonicalTargetText(metric,target){
    if(target==null)return'';
    const show=(/** @type {number} */ value)=>fmt(metric?.unit==='kg'?toDisplay(value):value);
    const suffix=displayUnit(metric);
    let value='';
    if(typeof target==='number')value=show(target);
    else if(Number.isFinite(target.min)&&Number.isFinite(target.max))value=target.min===target.max?show(target.min):`${show(target.min)}–${show(target.max)}`;
    return value?`${label(metric)} ${value}${suffix?` ${suffix}`:''}`:'';
  }
  /** @param {MetricDefinition} metric @param {unknown} raw */
  function parseHistoryInput(metric,raw){
    /** @type {Record<string,string>} */
    const keys={reps:'validation.reps',repsPerSide:'validation.reps',loadKg:'validation.load_metric',assistanceKg:'validation.load_metric',
      loadPerSideKg:'validation.load_metric',persistentLoadPerSideKg:'validation.load_metric'};
    const key=keys[metric?.semantic]||'validation.metric';
    const displayed=parseDecimalInput(raw);
    if(!Number.isFinite(displayed))return{field:'metric',key};
    const value=metric?.unit==='kg'?kgFromDisplay(displayed):displayed;
    const checked=parseMetricValue(metric,value);
    return checked.ok?{value:checked.value}:{field:'metric',key};
  }
  return Object.freeze({text,canonicalInput,kgFromDisplay,targetText,canonicalTargetText,label,displayUnit,parseHistoryInput});
}
