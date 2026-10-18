import {parseDecimalInput as parseDec,canonicalNumberText} from '../training/metrics.js';
import {interpretProfile} from './profile.js';
import {copySnapshot} from './session.js';
/** @typedef {import('./session.js').CommitResult} CommitResult
 * @typedef {Record<string,unknown> & {jumpPct:number,minJump:number,rirHigh:number,hardRir:number,restSec:number,unit:string,lang:string,rirMode:string,voiceInputEnabled:boolean,lastExport?:string,notify?:Record<string,boolean>}} Settings
 * @typedef {import('./session.js').Snapshot & {settings:Settings,profile?:unknown}} SettingsSnapshot
 * @typedef {{settings:Settings,hasProfileRecord:boolean,profile:import('./profile.js').Profile}} SettingsReadModel
 * @typedef {{values:Record<string,unknown>,rirMode:string}} SaveSettings
 * @typedef {{result:CommitResult,before:Settings,after:Settings,rirLocked?:boolean}} SettingsSaveResult
 */
const TELEMETRY=Object.freeze([['lang','language'],['unit','unit'],['rirMode','rir_mode'],['restSec','rest_timer'],
  ['voiceInputEnabled','voice'],['notify','notifications'],['jumpPct','progression'],['minJump','progression'],['rirHigh','progression'],['hardRir','progression']]);
/** Settings commands own proposal construction and privacy-safe event names.
 * Rendering, prompts and input parsing stay in the Settings view. Appearance
 * belongs to device preferences, and never enters these proposals.
 * @param {{read:()=>SettingsSnapshot,commit:(proposal:SettingsSnapshot,options?:{effect:unknown})=>Promise<CommitResult>,policy:{normalizeSettings:(value:unknown)=>Settings,normalizeProfile:(input:unknown)=>{ok:boolean,value?:import('./profile.js').Profile}},draft:{readRaw:()=>string|null,hasProgress:()=>boolean,unitEffect:(raw:string|null,oldUnit:string,newUnit:string)=>unknown},report:(event:string,properties:{setting:string})=>void,revision:(snapshot:SettingsSnapshot)=>number}} options */
export function createSettingsCommands({read,commit,policy,draft,report,revision}) {
  /** @returns {SettingsReadModel} */
  function model(){const snapshot=read();return {settings:copySnapshot(snapshot.settings),
    hasProfileRecord:Object.prototype.hasOwnProperty.call(snapshot,'profile'),profile:interpretProfile(snapshot.profile,policy)}}
  /** @param {string} mode */
  function canChangeRirMode(mode){return (read().settings.rirMode==='effort'?'effort':'numeric')===mode||!draft.hasProgress()}
  /** @param {SaveSettings} input @returns {Promise<SettingsSaveResult>} */
  async function save({values,rirMode}) {
    const base=read(),before=copySnapshot(base.settings);
    if(!canChangeRirMode(rirMode))return {before,after:before,rirLocked:true,
      result:{revision:revision(base),localOk:false,idbOk:false,cancelled:true}};
    const proposal=copySnapshot(base);
    proposal.settings=policy.normalizeSettings({...values,lastExport:before.lastExport});
    const effect=draft.unitEffect(before.unit===proposal.settings.unit?null:draft.readRaw(),before.unit,proposal.settings.unit);
    const result=await commit(proposal,{effect});
    const after=copySnapshot(read().settings);
    if(result.localOk||result.idbOk){
      const changed=new Set(TELEMETRY.filter(([key])=>JSON.stringify(before[key])!==JSON.stringify(after[key])).map(([,name])=>name));
      for(const setting of changed)report('settings_changed',{setting})}
    return {result,before,after};
  }
  async function clearProfile(){
    const base=read();
    if(!Object.prototype.hasOwnProperty.call(base,'profile'))return null;
    const proposal=copySnapshot(base);delete proposal.profile;
    return commit(proposal);
  }
  /** @param {boolean} enabled */
  function setNotificationsEnabled(enabled){const proposal=copySnapshot(read());
    const previous=proposal.settings.notify||{};
    proposal.settings.notify={enabled:!!enabled,timer:previous.timer!==false,session:previous.session!==false,
      unfinished:previous.unfinished!==false,missed:previous.missed!==false};
    return commit(proposal)}
  return Object.freeze({model,save,clearProfile,setNotificationsEnabled,canChangeRirMode});
}

/** Unit changes coordinate an exact DraftV2 replacement receipt; their writer
 * identity and clock are command inputs. Legacy flat loads keep the released
 * display-number conversion while V2 canonical metrics remain unchanged.
 * @typedef {Record<string,unknown> & {program:Record<string,unknown>,session:Record<string,unknown>,revision:number,writer?:unknown}} SettingsDraft
 * @param {{workout:{parse:(value:unknown)=>{kind:'valid',draft:SettingsDraft}|{kind:'invalid'|'absent'|'unsupported'},serialize:(draft:SettingsDraft)=>unknown},outcome:(value:unknown)=>unknown,writer:(id:string)=>unknown,operationId:()=>string,now:()=>string}} dependencies */
export function createSettingsDraftEffects({workout,outcome,writer,operationId,now}){
/** @param {unknown} kg @param {string} unit */
const toDisplayUnit=(kg,unit)=>unit==="lb"?(Number(kg)||0)*2.2046226218:(Number(kg)||0);
/** @param {unknown} value @param {string} unit */
const fromDisplayUnit=(value,unit)=>{const n=parseDec(value),x=Number.isFinite(n)?n:0;return unit==="lb"?x/2.2046226218:x};
/** @param {string|null} raw @param {string} oldUnit @param {string} newUnit */
function convertDraftUnitsRaw(raw,oldUnit,newUnit){
  if(raw==null||oldUnit===newUnit)return raw;
  /** @type {Record<string,unknown>|unknown[]|null} */
  let d;
  try{d=JSON.parse(raw)}
  catch{return raw}
  if(!d||typeof d!=="object")return raw;
  let changed=false;
  /** @param {unknown} v */
  const conv=v=>canonicalNumberText(toDisplayUnit(fromDisplayUnit(v,oldUnit),newUnit));
  for(const k of Object.keys(d)){
    if(k.startsWith("__")||!k.endsWith("_load"))continue;
    const v=/** @type {Record<string,unknown>} */(d)[k];if(v===""||v==null)continue;
    const n=parseDec(v);if(!Number.isFinite(n))continue;
    /** @type {Record<string,unknown>} */(d)[k]=conv(n);changed=true}
  if(Object.prototype.hasOwnProperty.call(d,"__bodyweight")){
    const bw=/** @type {Record<string,unknown>} */(d).__bodyweight;
    if(bw!==""&&bw!=null){
      const n=parseDec(bw);
      if(Number.isFinite(n)){/** @type {Record<string,unknown>} */(d).__bodyweight=conv(n);changed=true}}}
  return changed?JSON.stringify(d):raw}
/** @param {string|null} expectedRaw @param {string} oldUnit @param {string} newUnit */
function draftUnitConversionEffect(expectedRaw,oldUnit,newUnit){
  if(oldUnit===newUnit)return null;
  if(expectedRaw==null)return outcome({required:true,kind:"clear-draft",expectedRaw:null,precondition:"abort-changed"});
  const parsed=workout?.parse(expectedRaw);
  if(parsed?.kind==="valid"){
    const draft=/** @type {SettingsDraft} */(JSON.parse(/** @type {string} */(expectedRaw))),id=`unit-${operationId()}`;
    draft.program.unit=newUnit;draft.revision+=1;draft.session.updatedAt=now();draft.writer=writer(id);
    const checked=workout.parse(draft);
    if(checked.kind!=="valid")return{status:"invalid",effect:null,reason:"v2-unit-replacement"};
    return outcome({required:true,kind:"replace-draft",expectedRaw,
      replacementRaw:JSON.stringify(workout.serialize(checked.draft)),
      precondition:"abort-changed"})}
  return outcome({required:true,kind:"replace-draft",expectedRaw,
    replacementRaw:convertDraftUnitsRaw(expectedRaw,oldUnit,newUnit),
    precondition:"abort-changed"})}
return Object.freeze({unitEffect:draftUnitConversionEffect});
}
