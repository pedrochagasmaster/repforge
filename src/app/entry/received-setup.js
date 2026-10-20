import {cloneSnapshot} from '../../training/model.js';
/** @typedef {ReturnType<typeof import('../../interchange/setup-link.js').createSetupLinkCodec>} Codec
 * @typedef {import('../../interchange/setup-link.js').Options} CodecOptions
 * @typedef {import('../../interchange/setup-link.js').Payload} Payload
 * @typedef {ReturnType<typeof import('../../training/model.js').createProgramModel>} Model
 * @typedef {ReturnType<typeof import('../../training/authoring.js').createEntryRules>} Rules
 * @typedef {ReturnType<Rules['createState']>} Draft
 * @typedef {{source:'fragment'|'cookie',encoded:string}} Candidate
 * @typedef {{status:'none'|'loading'|'ready'|'invalid'|'unsupported'|'existing',source:'fragment'|'cookie'|null,encoded:string|null,payload:Payload|null,error:string|null,errorVersion?:number|null,previousLang:string|null}} Received
 */
/** One received proposal lifetime. Decoding never creates a training proposal
 * or saves a setup draft. Consent asks review() for the common private preview;
 * only ordinary Entry activation can install it.
 * @param {{codec:Codec,model:Model,rules:Rules,options:()=>CodecOptions,decodeOptions:(signal:AbortSignal)=>CodecOptions,
 * eligible:()=>boolean,language:{read:()=>string,write:(language:string)=>void},
 * navigation:{pathname:()=>string,replace:(url:string)=>void},fingerprint:(value:unknown)=>string}} bindings */
export function createReceivedSetup({codec,model,rules,options,decodeOptions,eligible,language,navigation,fingerprint}){
 /** @type {Received} */let current={status:'none',source:null,encoded:null,payload:null,error:null,previousLang:null};
 let epoch=0;
 /** @type {AbortController|null} */let controller=null;
 /** @param {unknown} value */
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}}
 /** @param {Received} next */
 function publish(next){current=cloneSnapshot(next);freeze(current)}
 function read(){return current}
 function cancel(){epoch++;controller?.abort();controller=null}
 /** @param {{allowCookie?:boolean}} [request] @returns {Candidate|null} */
 function capture({allowCookie=true}={}){
  try{
   const fragment=codec.readSetupFragment();
   if(fragment!==null){publish({status:'loading',source:'fragment',encoded:null,payload:null,error:null,previousLang:null});return{source:'fragment',encoded:fragment}}
   if(!allowCookie)return null;
   const cookie=codec.readHandoffCookie();
   if(cookie){publish({status:'loading',source:'cookie',encoded:null,payload:null,error:null,previousLang:null});return{source:'cookie',encoded:cookie}}
   return null;
  }catch{publish({status:'invalid',source:null,encoded:null,payload:null,error:'invalid-schema',previousLang:null});return null}
 }
 /** @param {string} encoded */
 function clearMatchingCookie(encoded){try{if(codec.readHandoffCookie()===encoded)codec.clearHandoffCookie()}catch{}}
 /** @param {Candidate|null} candidate */
 async function prepare(candidate){
  if(!candidate)return false;
  controller?.abort();const request=++epoch,active=new AbortController();controller=active;
  const isCurrent=()=>request===epoch&&!active.signal.aborted;
  const {source,encoded}=candidate;let staged=false,matchingCookie=false;
  try{matchingCookie=codec.readHandoffCookie()===encoded}catch{}
  if(source==='fragment'&&encoded.length<=codec.MAX_ENCODED_CHARS){
   try{staged=codec.writeHandoffCookie(encoded)===true;if(staged&&navigation.pathname()===codec.handoffCookiePath())staged=codec.readHandoffCookie()===encoded}catch{staged=false}
  }
  let decoded;
  try{decoded=await codec.decode(encoded,decodeOptions(active.signal))}
  catch(error){if((error instanceof Error&&error.name==='AbortError')||!isCurrent())return false;decoded={ok:false,code:'invalid-schema'}}
  if(!isCurrent())return false;
  if(!decoded.ok||!('value' in decoded)||!decoded.value){
   if(source==='cookie'||staged||matchingCookie)clearMatchingCookie(encoded);
   publish({status:decoded.code==='unsupported-version'||decoded.code==='decompression-unavailable'?'unsupported':'invalid',source,encoded:null,payload:null,error:typeof decoded.code==='string'?decoded.code:'invalid-schema',errorVersion:'version' in decoded&&typeof decoded.version==='number'?decoded.version:null,previousLang:null});return true;
  }
  if(source==='fragment'&&staged){if(codec.readSetupFragment()!==encoded)return false;navigation.replace(codec.removeSetupFragment())}
  if(!eligible()){
   if(source==='cookie'||staged||matchingCookie)clearMatchingCookie(encoded);
   publish({status:source==='fragment'?'existing':'none',source,encoded:null,payload:null,error:source==='fragment'?'existing':null,previousLang:null});return true;
  }
  publish({status:'ready',source,encoded,payload:decoded.value,error:null,previousLang:language.read()});
  language.write(decoded.value.settings.lang);return true;
 }
 function discard(){
  cancel();try{codec.clearHandoffCookie()}catch{}
  try{if(codec.readSetupFragment()!==null)navigation.replace(codec.removeSetupFragment())}catch{}
  publish({status:'none',source:null,encoded:null,payload:null,error:null,previousLang:null});
 }
 /** Revalidate at consent before opening or clearing any local draft. */
 function validate(){
  if(current.status!=='ready'||!current.payload)return{ok:/** @type {false} */(false),code:'not-ready'};
  if(!eligible())return{ok:/** @type {false} */(false),code:'ineligible'};
  return codec.validate(current.payload,options());
 }
 /** Construct the common Entry preview from the codec's accepted DTO. The
  * consent caller passes that exact value synchronously after validate().
  * @param {Draft} draft @param {Payload} payload */
 function review(draft,payload){
  const shared=payload.program,customs=model.normalizeCustomExercises(shared.customExercises||[]);
  const definition=model.canonicalProgramDefinition(shared.definition,customs);
  if(!definition)return{ok:/** @type {false} */(false),code:'invalid'};
  const program=model.flatProgramFromDefinition(definition,customs,1);
  const days=definition.days.filter(day=>day.kind==='training').map((day,index)=>({dayId:day.id,label:day.name,order:index+1,exercises:program.filter(row=>row.dayId===day.id).map(row=>cloneSnapshot(row))}));
  const preview={source:'shared',frequency:days.length,program,programDefinition:definition,
   programStructure:{schemaVersion:1,days:days.map(({dayId,label,order})=>({dayId,label,order})),provenance:{source:'shared'}},days,customExercises:customs,primaryMuscles:[],
   sharedMeta:{name:shared.name,daysPerWeek:days.length,mesocycleLengthWeeks:definition.cycles},sharedSettings:cloneSnapshot(payload.settings)};
  /** @type {Draft} */let next=rules.selectRoute(draft,'shared',{});next=rules.setAnswers(next,{sharedReady:true});
  next=rules.setResult(next,{fingerprint:fingerprint({route:'shared',name:shared.name,preview})||'shared',selected:{id:'shared',source:'shared'},name:shared.name,preview,telemetry:{family:'shared_v1'}});
  return{ok:/** @type {true} */(true),value:{...next,step:'preview'}};
 }
 publish(current);
 return Object.freeze({read,capture,prepare,cancel,discard,validate,review});
}
