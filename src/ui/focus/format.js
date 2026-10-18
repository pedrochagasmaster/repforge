import {formatNumberPlain,formatNumber} from '../format.js';
import {parseDecimalInput,POUNDS_PER_KG} from '../../training/metrics.js';
/** One display context for Focus. These conversions never enter storage.
 * @param {{readSettings:()=>{unit?:string,minJump?:unknown},copy:{language:()=>string}}} options */
export function createFocusFormat({readSettings,copy}){
  const unit=()=>readSettings().unit==='lb'?'lb':'kg';
  const number=(/** @type {unknown} */ value)=>formatNumber(value,copy.language());
  const display=(/** @type {unknown} */ kg)=>unit()==='lb'?(Number(kg)||0)*POUNDS_PER_KG:(Number(kg)||0);
  const toKg=(/** @type {unknown} */ raw)=>{const parsed=parseDecimalInput(raw),value=Number.isFinite(parsed)?parsed:0;return unit()==='lb'?value/POUNDS_PER_KG:value};
  const load=(/** @type {unknown} */ kg)=>number(display(kg));
  const plainLoad=(/** @type {unknown} */ kg)=>formatNumberPlain(display(kg));
  const loadStep=()=>number(Math.round(display(parseDecimalInput(readSettings().minJump)||2.5)*10)/10);
  return {unit,number,plain:formatNumberPlain,display,toKg,load,plainLoad,loadStep};
}
