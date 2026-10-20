/** Notification permission intent belongs to this control owner, separate from
 * permission capability and durable settings. A late permission response cannot
 * re-enable a switch the user has since turned off. */
/** @param {import('./contracts.js').NotificationOptions} options */
export function createNotificationControls({window,settings,capability,t}){
const document=window.document;
/** @param {string} selector */
const $=selector=>/** @type {HTMLInputElement|null} */(document.querySelector(selector));
/** @param {string} selector */
const $$=selector=>[...document.querySelectorAll(selector)].map(el=>/** @type {HTMLInputElement} */(el));
let notifyIntentGen=0,notifyWanted=false,notifyPending=false;
/** @type {Promise<string>|null} */
let notifyRequestInFlight=null;
function notifyPermission(){return capability.permission()}
function notifyEffective(){return!!settings.model().settings.notify?.enabled&&notifyPermission()==="granted"}
/** @param {boolean} enabled */
function persistNotifyEnabled(enabled){return settings.setNotificationsEnabled(enabled)}
function notifyStatusText(){
  const perm=notifyPermission();
  if(notifyPending)return t("settings.notifications.status.pending");
  if(perm==="unsupported")return t("settings.notifications.next.unsupported");
  if(perm==="denied")return t("settings.notifications.next.denied");
  if(perm==="default")return t("settings.notifications.next.prompt");
  if(perm==="granted")return t("settings.notifications.permission",{status:t("settings.notifications.status.granted")});
  return t("settings.notifications.permission",{status:perm})}
function paintNotifyControls(){
  const n=settings.model().settings.notify||{};
  const effective=notifyEffective();
  const ne=$("#notifyEnabled");if(ne)ne.checked=effective||notifyPending;
  const ntog=$("#notifyToggle");
  if(ntog){
    ntog.classList.toggle("is-on",effective||notifyPending);
    ntog.setAttribute("aria-pressed",effective?"true":"false");
    ntog.setAttribute("aria-busy",notifyPending?"true":"false");
    const name=t("settings.notifications.toggle_aria");
    if(name)ntog.setAttribute("aria-label",name)}
  const nt=$("#notifyTimer");if(nt)nt.checked=n.timer!==false;
  const ns=$("#notifySession");if(ns)ns.checked=n.session!==false;
  const nu=$("#notifyUnfinished");if(nu)nu.checked=n.unfinished!==false;
  const nm=$("#notifyMissed");if(nm)nm.checked=n.missed!==false;
  $$("#notifyTypes input").forEach(i=>{i.disabled=!effective});
  const ps=$("#notifyPermStatus");if(ps)ps.textContent=notifyStatusText()}
function reconcileNotifyPermission(){
  const perm=notifyPermission();
  if(perm==="granted"){
    if(settings.model().settings.notify?.enabled)notifyWanted=true;
    return}
  const wasEnabled=!!settings.model().settings.notify?.enabled;
  if(wasEnabled){
    notifyIntentGen++;
    notifyWanted=false;
    notifyPending=false;
    void persistNotifyEnabled(false);
    return}
  if(notifyPending&&(perm==="denied"||perm==="unsupported")){
    notifyIntentGen++;
    notifyWanted=false;
    notifyPending=false}}
/** @param {boolean} wanted */
async function setNotificationsEnabled(wanted){
  wanted=!!wanted;
  notifyWanted=wanted;
  if(!wanted){
    notifyIntentGen++;
    notifyPending=false;
    await persistNotifyEnabled(false);
    paintNotifyControls();
    return}
  if(notifyPending&&notifyRequestInFlight)return notifyRequestInFlight;
  const gen=notifyIntentGen;
  notifyPending=true;
  paintNotifyControls();
  const request=notifyRequestInFlight||(async()=>{
    let result="unsupported";
    try{result=await capability.request()}
    catch{result=notifyPermission()}
    return result})();
  notifyRequestInFlight=request;
  try{
    const result=await request;
    if(gen!==notifyIntentGen||!notifyWanted)return;
    const perm=notifyPermission();
    const granted=result==="granted"&&perm==="granted";
    notifyPending=false;
    await persistNotifyEnabled(granted);
    if(!granted)notifyWanted=false;
    paintNotifyControls()}
  finally{if(notifyRequestInFlight===request)notifyRequestInFlight=null}}

return Object.freeze({effective:notifyEffective,pending:()=>notifyPending,
  reconcile:reconcileNotifyPermission,paint:paintNotifyControls,setEnabled:setNotificationsEnabled});
}
