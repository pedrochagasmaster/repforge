import {createMetricDisplay} from '../metrics.js';
import {createFocusFormat} from './format.js';
import {createFocusValues} from './values.js';
import {createEffortPresentation} from './effort.js';
import {createRestPresentation} from './rest-view.js';
import {createCuePresentation} from './cue.js';
import {createLedgerPresentation} from './ledger.js';
import {createShelfPresentation} from './shelf.js';
import {createPrescriptionPresentation} from './prescription.js';
/** Feature composition: concrete Focus owners share one display context, one
 * pending-input state and the existing rest clock. No global registration or IO.
 * @param {{window:Window,focus:ReturnType<typeof import('./state.js').createFocusState>,clock:ReturnType<typeof import('./rest.js').createRestClock>,training:Parameters<typeof createFocusValues>[0]['training'],readSettings:()=>{unit?:string,minJump?:unknown},readDefaultRest:()=>number,copy:{t:(key:string,values?:Record<string,unknown>)=>string,plural:(count:number,word:string)=>string,language:()=>string,term:(name:string)=>string},motion:Parameters<typeof createEffortPresentation>[0]['motion']}} options */
export function createFocusPresentation({window,focus,clock,training,readSettings,readDefaultRest,copy,motion}){
  const format=createFocusFormat({readSettings,copy});
  const metrics=createMetricDisplay({readSettings,copy});
  const values=createFocusValues({focus,training,format,copy});
  const effort=createEffortPresentation({window,focus,copy,motion});
  const rest=createRestPresentation({window,clock,readDefaultSeconds:readDefaultRest,copy});
  const cue=createCuePresentation({copy,format,rest});
  const ledger=createLedgerPresentation({copy,format});
  const prescription=createPrescriptionPresentation({metrics,copy,format});
  const shelf=createShelfPresentation({focus,metrics,effort,rest,copy,format});
  return {format,metrics,values,effort,rest,cue,ledger,prescription,shelf,dispose:effort.dispose};
}
