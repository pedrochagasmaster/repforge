import {escapeHtml as esc,formatNumber,formatClock} from '../format.js';
import {parseDecimalInput as parseDec} from '../../training/metrics.js';
/** Settings owns its form revision and rendering; clients expose named commands,
 * presentation records and actual platform capabilities, never mutable state. */
/** @param {import('./contracts.js').SettingsViewOptions} options */
export function createSettingsView({window,settings,i18n,appearance,
  notifications,install,guides,telemetry,storage,shell,toast,onSaved}){
const document=window.document,navigator=window.navigator;
const t=i18n.t,language=i18n.getLang,normalizeLanguage=i18n.normalizeLang;
/** @param {string} selector */
const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
/** @param {string} selector */
const input=selector=>/** @type {HTMLInputElement|null} */(document.querySelector(selector));
/** @param {string} selector */
const select=selector=>/** @type {HTMLSelectElement|null} */(document.querySelector(selector));
/** @param {string} selector */
const $$=selector=>[...document.querySelectorAll(selector)].map(el=>/** @type {HTMLInputElement} */(el));
/** @param {unknown} value */
const fmt=value=>formatNumber(value,language());
let storageNoteGen=0;
/** @param {string} backupLine */
function paintStorageNote(backupLine){
  const sn=$("#storageNote");if(!sn)return;
  sn.textContent=backupLine;
  const gen=++storageNoteGen;
  (async()=>{let kept=false;try{kept=(await navigator.storage?.persisted?.())===true}catch{}
    if(gen!==storageNoteGen)return;
    sn.textContent=`${backupLine} ${t(kept?"settings.storage.persisted":"settings.storage.not_persisted")}`})()}

/** @param {import('../../app/profile.js').Profile} profile */
function profileRows(profile){
  const rows=[];
  const understood=profile;
  if(understood.sex)rows.push([t("entry.section_understood.sex"),t(`entry.sex.${understood.sex}`)]);
  if(understood.birthDate){
    const [y,m,d]=understood.birthDate.split("-").map(Number);
    rows.push([t("entry.section_profile.birth_date"),new Date(Date.UTC(y,m-1,d)).toLocaleDateString(language()==="pt"?"pt-BR":"en",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric"})])}
  if(understood.heightCm){
    const total=Math.round(understood.heightCm/2.54);
    rows.push([t("entry.section_profile.height"),understood.heightUnit==="ftin"?`${Math.floor(total/12)}′ ${total%12}″`:`${Math.round(understood.heightCm)} cm`])}
  if(understood.weightKg)rows.push([t("entry.section_profile.weight"),`${fmt((Number(understood.weightKg)*(settings.model().settings.unit==="lb"?2.2046226218:1)))} ${settings.model().settings.unit}`]);
  if(understood.cardioExperience)rows.push([t("entry.section_profile.cardio"),[t(`entry.cardio.${understood.cardioExperience}`),(understood.cardioExperience==="none"?"":t(`entry.cardio.${understood.cardioExperience}.sub`))].filter(Boolean).join(" · ")]);
  return rows}
function renderProfileSettings(){
  const row=$("#profileRow"),panel=$("#profilePanel"),list=$("#profileList");
  if(!row||!panel||!list)return;
  const model=settings.model(),profile=model.profile||{};
  const rows=profileRows(profile);
  const hasProfileRecord=model.hasProfileRecord;
  row.hidden=!rows.length&&!hasProfileRecord;
  if(!rows.length)shell.setDisclosure(row,panel,false);
  list.innerHTML=rows.map(([label,value])=>`<div class="settings-profile__row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}
async function clearProfile(){
  if(!settings.model().hasProfileRecord||!window.confirm(t("settings.profile.clear_confirm")))return;
  const result=await settings.clearProfile();
  if(result?.localOk||result?.idbOk){renderProfileSettings();toast(t("settings.profile.cleared"))}}
function render(){
  const {settings:values}=settings.model();
  renderProfileSettings();
  guides.renderReplayList();
  const jp=input("#jumpPct"),mj=input("#minJump"),rh=input("#rirHigh"),hr=input("#hardRir"),rs=input("#restSec"),un=input("#unit");
  if(jp)jp.value=String(values.jumpPct);if(mj)mj.value=String(values.minJump);if(rh)rh.value=String(values.rirHigh);if(hr)hr.value=String(values.hardRir);
  if(rs)rs.value=String(values.restSec);if(un)un.value=values.unit;
  const langSel=select("#lang");if(langSel){langSel.value=values.lang;[...langSel.options].forEach(o=>{o.textContent=t("settings.lang."+o.value)})}
  const themeSel=select("#theme");if(themeSel){themeSel.value=appearance.current();[...themeSel.options].forEach(o=>{o.textContent=t("settings.appearance."+o.value)})}
  $$('input[name="rirMode"]').forEach(r=>{r.checked=r.value===values.rirMode});
  const vi=input("#voiceInputEnabled");if(vi)vi.checked=!!values.voiceInputEnabled;
  const vt=$("#voiceToggle");if(vt){vt.classList.toggle("is-on",!!values.voiceInputEnabled);vt.setAttribute("aria-pressed",values.voiceInputEnabled?"true":"false")}
  const telemetryEnabled=telemetry.isEnabled?.()!==false;
  const tt=$("#telemetryToggle");if(tt){tt.classList.toggle("is-on",telemetryEnabled);tt.setAttribute("aria-pressed",telemetryEnabled?"true":"false")}
  notifications.reconcile();
  notifications.paint();
  // Rule 5: the row is there only when tapping it leads somewhere — Chrome's
  // prompt, the Safari sheet, or the explanation another iOS browser needs.
  const manualInstall=install.decision("manual-settings");
  const ia=$("#installApp");if(ia)ia.classList.toggle("hidden",!manualInstall.eligible&&install.mode()!=="safari");
  const sec=Math.max(0,Math.round(Number(values.restSec)||0)),disp=$("#restSecDisplay");
  if(disp)disp.textContent=sec?formatClock(sec):t("settings.rest_off");
  const rirDisp=$("#rirModeDisplay");if(rirDisp)rirDisp.textContent=values.rirMode==="effort"?t("settings.rir_effort"):t("settings.rir_numbers");
  const le=values.lastExport,ago=le?t("settings.storage.last_backup",{lastBackup:le.slice(0,10)}):t("settings.storage.last_backup_never");
  paintStorageNote(ago);
  const deg=$("#storageDegraded");
  if(deg){const on=!!storage.health().degraded;deg.textContent=on?t("settings.storage.degraded"):"";deg.classList.toggle("hidden",!on);deg.hidden=!on}
  const sz=$("#storageSize");if(sz){try{const bytes=new Blob([storage.raw()||""]).size;sz.textContent=bytes>1048576?`${fmt(+(bytes/1048576).toFixed(1))} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`}catch{sz.textContent="—"}}
}

let editRevision=0;
function readForm(){
  const before=settings.model().settings;
  /** @param {string} sel @param {number} def @param {number} min */
  const num=(sel,def,min)=>{const n=parseDec(input(sel)?.value);return Number.isFinite(n)&&n>=min?n:def};
  const oldUnit=before.unit,newUnit=input("#unit")?.value==="lb"?"lb":"kg",newLang=normalizeLanguage(select("#lang")?.value)||before.lang;
  const rirMode=input('input[name="rirMode"]:checked')?.value==="effort"?"effort":"numeric";
  if(!settings.canChangeRirMode(rirMode))
    return {rirMode,values:{}};
  const rsEl=input("#restSec"),restN=parseDec(rsEl?.value);let restSec;
  if(Number.isFinite(restN)&&restN>=0&&!Number.isInteger(restN)){
    if(rsEl){rsEl.value=String(before.restSec);rsEl.setAttribute("aria-invalid","true");try{rsEl.focus()}catch{}}
    toast(t("validation.rest_frac"));restSec=before.restSec;
  }else{rsEl?.removeAttribute("aria-invalid");restSec=rsEl?num("#restSec",120,0):before.restSec}
  return {rirMode,values:{jumpPct:num("#jumpPct",2.5,0),minJump:(()=>{const n=parseDec(input("#minJump")?.value);return Number.isFinite(n)&&n>0?n:2.5})(),rirHigh:num("#rirHigh",2,0),hardRir:num("#hardRir",4,0),restSec,unit:newUnit,lang:newLang,rirMode,voiceInputEnabled:!!input("#voiceInputEnabled")?.checked,notify:{enabled:!!before.notify?.enabled,timer:!!input("#notifyTimer")?.checked,session:!!input("#notifySession")?.checked,unfinished:!!input("#notifyUnfinished")?.checked,missed:!!input("#notifyMissed")?.checked}}};
}
/** @param {boolean} silent */
async function save(silent){
  const revision=editRevision,{result,before,after,rirLocked}=await settings.save(readForm());
  if(rirLocked){$$('input[name="rirMode"]').forEach(r=>{r.checked=before.rirMode==="effort"?r.value==="effort":r.value!=="effort"});toast(t("toast.rir_locked_draft"));return result}
  if(!(result.localOk||result.idbOk)){if(revision===editRevision)render();return result}
  onSaved({before,after,current:revision===editRevision});
  if(!silent)toast(t("toast.settings_saved"));return result;
}
function touch(){editRevision++}
return Object.freeze({render,renderProfile:renderProfileSettings,clearProfile,save,touch});
}
