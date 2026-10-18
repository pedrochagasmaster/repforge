import {escapeHtml as esc} from '../format.js';
/** Install surfaces share one capability reading and one single-use prompt.
 * Transfer protocol commands remain with the transfer owner. This view owns
 * banner/sheet state and the Privacy modal's focus handoff, with no storage IO. */
/** @param {import('./contracts.js').InstallOptions} options */
export function createInstallView({window,t,language,policy:InstallPolicy,read,preferences,transfer,shell,guides,report,toast,onChanged,onLandingOffer}){
const document=window.document,navigator=window.navigator,location=window.location;
const requestAnimationFrame=window.requestAnimationFrame.bind(window);
/** @param {string} selector */
const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
/** @type {import('./contracts.js').PromptEvent|null} */
let installPrompt=null;
const isStandalone=()=>window.matchMedia?.("(display-mode: standalone)")?.matches===true||/** @type {Navigator & {standalone?:boolean}} */(window.navigator).standalone===true;
const isIOS=()=>{const ua=navigator.userAgent||"";return /iphone|ipad|ipod/i.test(ua)||(navigator.platform==="MacIntel"&&(navigator.maxTouchPoints||0)>1)};
/* iOS ships one installer — Safari's Share sheet — and every other iOS browser
   is that same engine without it. Those browsers name themselves in the UA, and
   so do the in-app webviews; nothing else on iOS can be told apart. */
const IOS_NON_SAFARI=/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|OPR\/|YaBrowser|DuckDuckGo|Brave|FBAN|FBAV|FBIOS|Instagram|Line\/|Twitter|MicroMessenger|GSA\//i;
const isIOSSafari=()=>isIOS()&&!IOS_NON_SAFARI.test(navigator.userAgent||"");
const isChromium=()=>!/iphone|ipad|ipod/i.test(navigator.userAgent||"")&&
  /Chrome|Chromium|CriOS|EdgA|EdgiOS|OPR\//i.test(navigator.userAgent||"");
/** The single decision about which install interface a browser gets. It reads
 *  capabilities and display mode — never screen size — in this order:
 *    "none"   already installed, or nothing worth offering
 *    "native" a deferred beforeinstallprompt is in hand (Chromium anywhere)
 *    "ios"    iOS/iPadOS Safari, which installs by hand from the Share sheet
 *    "safari" another browser on iOS/iPadOS, which cannot install at all
 *  Chrome's own install prompt is never drawn by Taurifer: "native" only means
 *  we hold the event that asks Chrome to show it. */
function installMode(){
  if(isStandalone())return "none";
  if(installPrompt)return "native";
  if(isIOS())return isIOSSafari()?"ios":"safari";
  return "none";
}
/* Chrome can fire this before init() binds its own listener, and an event nobody
   caught is an install offer the lifter never gets. Capturing it here, at parse
   time, means boot always reads the true answer; the listener in init() is the
   one that redraws once there is something to redraw. */

const IOS_SHARE_SVG='<svg class="ios-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v13"/><path d="M8 7l4-4 4 4"/><path d="M6 12H4v8h16v-8h-2"/></svg>';
/** @param {string} source @returns {import('./contracts.js').InstallDecision} */
function installPolicyDecision(source="automatic"){
  if(!InstallPolicy?.evaluateInstallPolicy)return{state:"unsupported",eligible:false,milestone:null,reason:"policy-unavailable"};
  const facts=read();
  return InstallPolicy.evaluateInstallPolicy({
    platform:isIOS()?"ios":isChromium()?"chromium":"other",
    isIOSSafari:isIOSSafari(),hasInstallCapability:!!installPrompt,standalone:isStandalone(),
    hasMeaningfulData:facts.hasMeaningfulData,savedWorkoutsCount:facts.savedWorkoutsCount,
    uiPrefs:preferences.read(),nowMs:Date.now(),source,transferAvailable:facts.transferAvailable})}
/** @param {import('./contracts.js').InstallDecision|null} decision */
function recordInstallPolicyOffer(decision){
  if(!decision||!Number.isInteger(decision.milestone))return;
  preferences.replace({...InstallPolicy.recordInstallOffer(preferences.read(),{milestone:decision.milestone,nowMs:Date.now()})})}
/** @param {import('./contracts.js').InstallDecision|null} decision */
function recordInstallPolicyDismissal(decision){
  if(!decision||!Number.isInteger(decision.milestone))return;
  preferences.replace({...InstallPolicy.recordInstallDismissal(preferences.read(),{milestone:decision.milestone,nowMs:Date.now()})})}
/** @type {import('./contracts.js').InstallDecision|null} */
let installPresentedDecision=null;
function installInstructions(){
  if(isIOS())return t("install.ios_instructions",{icon:IOS_SHARE_SVG});
  if(installPrompt)return t("install.prompt_instructions");
  return t("install.browser_instructions");
}
/** Every surface that offers an install, refreshed from one reading of what the
 *  browser can do. Called whenever that reading can have changed. */
function renderInstallSurfaces(){
  const mode=installMode(),automatic=installPolicyDecision(),manual=installPolicyDecision("manual-settings");
  $("#installBtn")?.classList.toggle("hidden",mode!=="native"||!automatic.eligible);
  $("#installApp")?.classList.toggle("hidden",!manual.eligible&&mode!=="safari");
  renderFirstRunInstall();
}
/* Which install offer was acted on (Plan 071 §5.1). Buttons bind
   triggerInstall directly, so the click names the surface. */
/** @param {unknown} source */
function installSurface(source){
  if(source==="manual-settings")return"settings";
  const event=/** @type {{currentTarget?:HTMLElement|null,target?:Element|null}|null|undefined} */(source);
  const id=event?.currentTarget?.id||event?.target?.closest?.("button")?.id||"";
  if(id==="installBtn")return"header";
  if(id==="installBannerAction")return"banner";
  if(id.startsWith("firstRunInstall"))return"landing";
  return read().firstRunActive?"landing":"banner"}
/** @param {string} surface @param {string} mode @param {string} outcome */
function reportInstall(surface,mode,outcome){report("install_prompt_outcome",{surface,mode,outcome})}
/** @param {string} action */
function reportLandingAction(action){report("landing_action",{action})}
/** @param {unknown} source */
async function triggerInstall(source="automatic"){
  const surface=installSurface(source);
  const requestSource=source==="manual-settings"?"manual-settings":"automatic";
  const decision=requestSource==="manual-settings"
    ?installPolicyDecision("manual-settings")
    :installPresentedDecision||installPolicyDecision();
  const mode=installMode();
  if(mode==="native"){
    // The event is single-use. Clearing it before the await is what makes a
    // second tap a no-op rather than a second prompt() on a spent event, and it
    // is also step 3 of the flow: consume it whatever the lifter chooses.
    const evt=/** @type {import('./contracts.js').PromptEvent} */(installPrompt);installPrompt=null;
    let outcome="";
    try{evt.prompt();reportInstall(surface,"native","prompted");const choice=await evt.userChoice;outcome=choice?.outcome||""}catch{}
    if(outcome==="accepted"||outcome==="dismissed")reportInstall(surface,"native",outcome);
    // Nothing is claimed that Chrome has not confirmed: only "accepted" reports
    // an install, and a dismissal simply leaves the section gone until Chrome
    // offers the event again.
    if(outcome==="accepted"){hideInstallBanner(false);closeFirstRunInstall();toast(t("toast.installing"))}
    else{
      if(outcome==="dismissed"&&requestSource==="automatic")recordInstallPolicyDismissal(decision);
      hideInstallBanner(false);closeFirstRunInstall()}
    onChanged();renderInstallSurfaces();return}
  if(mode==="ios"){
    const marker=transfer.marker();
    const recoveryState=marker?.phase==="awaiting-claim"?"ready"
      :marker?.phase==="creating"?"creating"
      :marker?.phase==="confirmed"?"success"
      :marker?.phase==="unknown-outcome"?(marker.outcomeCode==="claimed-expired"?"claimed-expired":"unknown")
      :null;
    if(!recoveryState&&!decision.eligible)return;
    const withTransfer=decision.reason==="ios-transfer";
    openIosInstallSheet(recoveryState||(withTransfer?"eligible":"manual"));
    reportInstall(surface,"ios","instructions_shown");return}
  if(mode==="safari"){showInstallBanner(true);reportInstall(surface,"manual","instructions_shown");return}
}
function installBannerEligible(){
  const decision=installPolicyDecision();
  if(!decision.eligible||!["eligible-milestone","ios-transfer"].includes(decision.state))return false;
  const facts=read();
  if(facts.onboardingEdit)return false;
  if(facts.firstRunActive||facts.onboardingOpen)return false;
  return true;
}
/** @param {boolean} force */
function showInstallBanner(force){
  const b=$("#installBanner");if(!b)return;
  const outboundMarker=transfer.marker();
  if(outboundMarker&&outboundMarker.phase!=="resumedDiverged"){
    const title=$(".installbanner__title");
    const body=$("#installBannerBody");
    const act=$("#installBannerAction");
    if(outboundMarker.phase==="confirmed"){
      if(title)title.textContent=t("install.transfer.confirmed_title")||"Workout Data Transferred";
      const isStale=outboundMarker.recoverySnapshot?.mutatedAfterCreation===true;
      if(body)body.textContent=isStale
        ?(t("install.transfer.stale_body")||"Your workout data was transferred to the installed app, but was modified here afterward. The installed app may not have recent changes.")
        :(t("install.transfer.confirmed_body")||"Your workout data was transferred to the installed app.");
    }else if(outboundMarker.phase==="awaiting-claim"||outboundMarker.phase==="creating"){
      if(title)title.textContent=t("install.transfer.pending_title")||"Transfer in Progress";
      if(body)body.textContent=t("install.transfer.pending_body")||"Open Taurifer from your Home Screen to complete the transfer.";
    }else{
      const claimedExpired=outboundMarker.outcomeCode==="claimed-expired";
      if(title)title.textContent=t(claimedExpired?"install.transfer.claimed_expired_title":"install.transfer.unknown_title");
      if(body)body.textContent=t(claimedExpired?"install.transfer.claimed_expired_body":"install.transfer.unknown_body");
    }
    if(act){
      act.classList.remove("hidden");
      const pending=["awaiting-claim","creating"].includes(outboundMarker.phase||"");
      act.textContent=t(pending?"install.card.ios_action":"install.transfer.resume_action")||"Resume in browser";
      act.onclick=installMode()==="ios"?triggerInstall:()=>showInstallTransferDivergenceDialog(transfer.confirmDivergence);
    }
    b.classList.remove("hidden");
    return;
  }
  const mode=installMode();
  if(mode==="none")return;
  if(!force&&!installBannerEligible())return;
  const decision=force?installPolicyDecision("manual-settings"):installPolicyDecision();
  /** @type {HTMLElement} */($("#installBannerBody")).innerHTML=mode==="safari"?esc(t("install.card.safari_only_body")):installInstructions();
  const act=/** @type {HTMLElement} */($("#installBannerAction"));
  if(mode==="native"){act.classList.remove("hidden");act.textContent=t("install.action");act.onclick=triggerInstall;}
  else if(mode==="ios"){act.classList.remove("hidden");act.textContent=t("install.card.ios_action");act.onclick=triggerInstall;}
  else act.classList.add("hidden");
  installPresentedDecision=decision;
  if(!force)recordInstallPolicyOffer(decision);
  b.classList.remove("hidden");
  queueMicrotask(()=>guides.maybeShow(["install"]));
}
/** @param {()=>unknown} onConfirm */
function showInstallTransferDivergenceDialog(onConfirm){
  let dialog=$("#installTransferDivergenceModal");
  if(!dialog){
    dialog=document.createElement("div");
    dialog.id="installTransferDivergenceModal";
    dialog.className="sheet sheet--divergence";
    dialog.setAttribute("role","dialog");
    dialog.setAttribute("aria-modal","true");
    dialog.setAttribute("aria-labelledby","divergenceTitle");
    dialog.innerHTML=`
      <div class="sheetband">
        <span class="sheetband__handle" aria-hidden="true"></span>
        <h2 class="sheetband__title" id="divergenceTitle">${esc(t("install.transfer.divergence_title")||"Permanent Divergence Warning")}</h2>
      </div>
      <div style="padding:16px;">
        <p id="divergenceBody">${esc(t("install.transfer.divergence_body")||"If you resume in browser, future changes here and in the installed app will not merge and will develop separate workout histories.")}</p>
        <div style="display:flex;gap:12px;margin-top:16px;">
          <button type="button" class="btn btn--secondary" id="divergenceDismiss">${esc(t("dialog.cancel")||"Dismiss")}</button>
          <button type="button" class="btn btn--cta" id="divergenceConfirm">${esc(t("install.transfer.confirm_resume")||"Confirm and Resume")}</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
  }
  const scrim=$("#iosInstallScrim");
  shell.openModal(dialog,{
    scrim,
    initialFocus:$("#divergenceDismiss"),
    onEscape:()=>shell.closeModal(dialog)
  });
  requestAnimationFrame(()=>{dialog.classList.add("is-open");scrim?.classList.add("is-open")});
  /** @type {HTMLElement} */($("#divergenceDismiss")).onclick=()=>{
    shell.closeModal(dialog);
  };
  /** @type {HTMLElement} */($("#divergenceConfirm")).onclick=async()=>{
    shell.closeModal(dialog);
    if(typeof onConfirm==="function")await onConfirm();
  };
}
/** @param {boolean} remember */
function hideInstallBanner(remember){
  $("#installBanner")?.classList.add("hidden");
  if(remember)recordInstallPolicyDismissal(installPresentedDecision);
  installPresentedDecision=null}
function maybeShowInstallBanner(){if(installBannerEligible())showInstallBanner(false)}

const INSTALL_TRAY_SVG='<svg class="installcard__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
  '<path d="M12 3v11"/><path d="M7.5 9.5 12 14l4.5-4.5"/><path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>';
const INSTALL_SHARE_SVG='<svg class="installcard__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
  '<path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H4v9h16v-9h-2"/></svg>';
function renderFirstRunInstall(){
  const sec=$("#firstRunInstall"),card=$("#firstRunInstallCard"),link=$("#firstRunInstallLink");
  if(!sec||!card)return;
  const mode=installMode(),decision=installPolicyDecision();
  const explanatory=mode==="safari"&&decision.state==="unsupported";
  const shown=decision.eligible||explanatory;
  link?.classList.toggle("hidden",!shown);
  if(!shown){sec.classList.add("hidden");card.innerHTML="";return}
  const body=mode==="native"?t("install.card.browser_body")
    :mode==="ios"?t("install.card.ios_body"):t("install.card.safari_only_body");
  const action=mode==="native"?t("install.card.browser_action"):mode==="ios"?t("install.card.ios_action"):"";
  card.innerHTML=(mode==="native"?INSTALL_TRAY_SVG:INSTALL_SHARE_SVG)+
    `<div class="installcard__text"><p class="installcard__title">${esc(t("install.card.title"))}</p>`+
    `<p class="installcard__body">${esc(body)}</p></div>`+
    (action?`<button type="button" class="btn btn--cta installcard__action" id="firstRunInstallAction">${esc(action)}</button>`:"");
  const act=$("#firstRunInstallAction");if(act)act.onclick=event=>{reportLandingAction("install");return triggerInstall(event)};
  installPresentedDecision=decision;
  sec.classList.remove("hidden");
}
function closeFirstRunInstall(){
  const sec=$("#firstRunInstall");if(sec)sec.classList.add("hidden");
  const card=$("#firstRunInstallCard");if(card)card.innerHTML="";
  installPresentedDecision=null;
  onLandingOffer(false);
}
let installTransferVisibleState="manual",privacyReturnsToTransfer=false;
/** @type {Element|null|undefined} */
let privacyTransferOpener=null;
/** Where focus starts in each install-sheet state: the Done button of the
 *  instructions, the explanation's primary action, or the heading of every state
 *  that has nothing to choose yet. */
/** @param {string} stateName */
function installSheetInitialControl(stateName){
  return stateName==="eligible"?$("#installTransferStart"):stateName==="manual"?$("#iosInstallDone"):$("#iosInstallTitle")}
/** A state change hides the control that held focus (Start becomes a transfer in
 *  progress, "Install without transferring" becomes the instructions). Focus does
 *  not follow a hidden control, it drops to the page behind the dialog, so the
 *  sheet hands it to the new state's own starting point. */
/** @param {HTMLElement} sheet @param {string} stateName */
function installSheetKeepFocus(sheet,stateName){
  if(shell.activeModal?.el!==sheet)return;
  const held=document.activeElement;
  if(held&&sheet.contains(held)&&shell.canTakeFocus(held))return;
  const target=installSheetInitialControl(stateName);
  try{target?.focus({preventScroll:true})}catch{}}
/** @param {unknown} expiresAt */
function installTransferTime(expiresAt){
  const date=new Date(/** @type {string|number} */(expiresAt));
  if(Number.isNaN(date.valueOf()))return"";
  try{return new Intl.DateTimeFormat(language()==="pt"?"pt-BR":"en",{
    dateStyle:"medium",timeStyle:"short"}).format(date)}catch{return date.toLocaleString()}}
function installTransferContinueWithoutTransfer(){transfer.abandonUnsealed();installTransferRenderState("manual")}
/** @param {string} stateName @param {{expiresAt?:unknown}} detail */
function installTransferRenderState(stateName,detail={}){
  const sheet=$("#iosInstallSheet");if(!sheet)return false;
  /** @type {Record<string,string[]>} */
  const definitions={
    manual:["install.ios.title","install.ios.sub",""],
    eligible:["install.transfer.eligible_title","install.transfer.eligible_sub","install.transfer.eligible_body"],
    creating:["install.transfer.creating_title","install.transfer.creating_sub","install.transfer.creating_status"],
    ready:["install.transfer.ready_title","install.transfer.ready_sub","install.transfer.ready_status"],
    retryable:["install.transfer.retryable_title","install.transfer.retryable_sub","install.transfer.retryable_status"],
    claiming:["install.transfer.claiming_title","install.transfer.claiming_sub","install.transfer.claiming_status"],
    importing:["install.transfer.importing_title","install.transfer.importing_sub","install.transfer.importing_status"],
    success:["install.transfer.success_title","install.transfer.success_sub","install.transfer.success_status"],
    cleanup:["install.transfer.cleanup_title","install.transfer.cleanup_sub","install.transfer.cleanup_status"],
    terminal:["install.transfer.terminal_title","install.transfer.terminal_sub","install.transfer.terminal_status"],
    destination:["install.transfer.destination_title","install.transfer.terminal_sub","install.transfer.destination_status"],
    interrupted:["install.transfer.interrupted_title","install.transfer.terminal_sub","install.transfer.interrupted_status"],
    unknown:["install.transfer.unknown_title","install.transfer.terminal_sub","install.transfer.unknown_body"],
    "claimed-expired":["install.transfer.claimed_expired_title","install.transfer.terminal_sub","install.transfer.claimed_expired_body"],
  };
  const def=definitions[stateName]||definitions.interrupted;
  installTransferVisibleState=stateName;
  sheet.dataset.transferState=stateName;
  const title=$("#iosInstallTitle"),sub=sheet.querySelector(".sheetband__sub"),body=$("#installTransferBody"),status=$("#installTransferStatus");
  if(title){title.textContent=t(def[0]);title.tabIndex=-1}
  if(sub)sub.textContent=t(def[1]);
  if(body)body.textContent=stateName==="eligible"&&def[2]?t(def[2]):"";
  if(status)status.textContent=!['manual','eligible'].includes(stateName)&&def[2]?t(def[2]):"";
  $("#installTransferIntro")?.classList.toggle("hidden",!["eligible","retryable"].includes(stateName));
  $("#iosInstallInstructions")?.classList.toggle("hidden",!["manual","ready"].includes(stateName));
  const expiry=$("#installTransferExpiry"),formatted=installTransferTime(detail.expiresAt);
  if(expiry){expiry.textContent=formatted?t("install.transfer.expires",{time:formatted}):"";expiry.classList.toggle("hidden",!formatted)}
  const actions=$("#installTransferActions"),start=$("#installTransferStart"),retry=$("#installTransferRetry"),cont=$("#installTransferContinue"),done=$("#iosInstallDone"),close=$("#iosInstallClose");
  actions?.classList.toggle("hidden",!["eligible","retryable","success","cleanup","terminal","destination","interrupted","unknown","claimed-expired"].includes(stateName));
  start?.classList.toggle("hidden",stateName!=="eligible");
  retry?.classList.toggle("hidden",!["retryable","cleanup","interrupted"].includes(stateName));
  const canContinue=["eligible","retryable","success","cleanup","terminal","destination","unknown","claimed-expired"].includes(stateName);
  cont?.classList.toggle("hidden",!canContinue);
  if(cont)cont.textContent=t(["eligible","retryable"].includes(stateName)?"install.transfer.without"
    :["unknown","claimed-expired"].includes(stateName)?"install.transfer.resume_action":"install.transfer.continue");
  done?.classList.toggle("hidden",!["manual","ready"].includes(stateName));
  const busy=["creating","claiming","importing"].includes(stateName);
  sheet.setAttribute("aria-busy",busy?"true":"false");
  close?.classList.toggle("hidden",busy||["interrupted","unknown","claimed-expired"].includes(stateName));
  if(shell.activeModal?.el===sheet)
    shell.activeModal.onEscape=busy||["interrupted","unknown","claimed-expired"].includes(stateName)?undefined:closeIosInstallSheet;
  if(retry)retry.onclick=()=>isStandalone()?location.reload():transfer.create();
  if(cont)cont.onclick=()=>["eligible","retryable"].includes(stateName)?installTransferContinueWithoutTransfer()
    :["unknown","claimed-expired"].includes(stateName)?installTransferRequestDivergence()
    :closeIosInstallSheet();
  installSheetKeepFocus(sheet,stateName);
  if(["ready","retryable","success","cleanup","terminal","destination","interrupted","unknown","claimed-expired"].includes(stateName))
    queueMicrotask(()=>{try{title?.focus({preventScroll:true})}catch{}});
  return true}
/** @param {string|null|undefined} stateName @param {{returnFocus?:Element|null}} options */
function openIosInstallSheet(stateName,{returnFocus}={}){
  const sheet=$("#iosInstallSheet"),scrim=$("#iosInstallScrim");
  if(!sheet)return;
  const selected=stateName||((!isStandalone()&&read().transferMeaningful)?"eligible":"manual");
  installTransferRenderState(selected);
  const host=$("#iosInstallHost");
  if(host)host.textContent=location.hostname||"";
  document.body.classList.add("is-sheet-open");
  const initial=installSheetInitialControl(selected);
  const dismissable=!["creating","claiming","importing","interrupted","unknown","claimed-expired"].includes(selected);
  shell.openModal(sheet,{initialFocus:initial,onEscape:dismissable?closeIosInstallSheet:undefined,scrim,returnFocus,
    delayHide:shell.reducedMotion()?0:280});
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}
function closeIosInstallSheet(){
  const sheet=$("#iosInstallSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(shell.activeModal&&shell.activeModal.el===sheet))return Promise.resolve(false);
  return shell.closeModal(sheet)}
function openPrivacySheet({fromTransfer=false}={}){
  const sheet=$("#privacySheet"),scrim=$("#privacyScrim");if(!sheet)return;
  privacyReturnsToTransfer=fromTransfer;
  // The transfer sheet is hidden while Privacy is up; whoever opened it is still
  // owed focus when it closes, and Privacy's own opener is only a hop in between.
  privacyTransferOpener=fromTransfer&&shell.activeModal?.el===$("#iosInstallSheet")?shell.activeModal.returnFocus:null;
  shell.openModal(sheet,{scrim,handoff:fromTransfer,initialFocus:$("#privacyClose"),onEscape:closePrivacySheet,
    returnFocus:fromTransfer?$("#installTransferPrivacy"):document.activeElement,delayHide:shell.reducedMotion()?0:280});
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}
async function closePrivacySheet(){
  const returns=privacyReturnsToTransfer,opener=privacyTransferOpener;
  privacyReturnsToTransfer=false;privacyTransferOpener=null;
  await shell.closeModal($("#privacySheet"));
  if(returns){
    openIosInstallSheet(installTransferVisibleState,{returnFocus:opener});
    queueMicrotask(()=>$("#installTransferPrivacy")?.focus({preventScroll:true}));
  }}
async function installTransferRequestDivergence(){
  await closeIosInstallSheet();
  showInstallBanner(true);
  showInstallTransferDivergenceDialog(transfer.confirmDivergence)}


/** @param {import('./contracts.js').PromptEvent} event */
function capturePrompt(event){event.preventDefault();installPrompt=event}
function installed(){installPrompt=null;hideInstallBanner(false);report("app_installed",{});closeFirstRunInstall();onChanged();renderInstallSurfaces()}
return Object.freeze({mode:installMode,isStandalone,isIOS,isIOSSafari,isChromium,
  decision:installPolicyDecision,capturePrompt,installed,trigger:triggerInstall,
  render:renderInstallSurfaces,renderLanding:renderFirstRunInstall,closeLanding:closeFirstRunInstall,
  showBanner:showInstallBanner,hideBanner:hideInstallBanner,maybeShowBanner:maybeShowInstallBanner,
  dismissPresented:()=>recordInstallPolicyDismissal(installPresentedDecision),resetPresented:()=>{installPresentedDecision=null},
  openSheet:openIosInstallSheet,closeSheet:closeIosInstallSheet,renderTransfer:installTransferRenderState,
  openPrivacy:openPrivacySheet,closePrivacy:closePrivacySheet,
  divergence:showInstallTransferDivergenceDialog});
}
