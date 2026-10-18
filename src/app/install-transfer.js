import {cloneSnapshot,isPlainStateObject,readRevision,exportableState,canonicalize} from '../persistence/snapshot.js';
import {TRANSFER_KEYS} from '../platform/install-transfer.js';
/** @import {Options,ImportMarker,InvalidMarker,Previous,ImportOptions,ProgressKind} from './install-transfer-contracts.js' */
/** @typedef {import('../persistence/snapshot.js').RawSnapshot} RawSnapshot
 * @typedef {Record<string,unknown>} RawRecord
 * @typedef {import('../interchange/transfer-contract.js').Envelope} Envelope
 * @typedef {import('../platform/install-transfer-contracts.js').LogicalSnapshot} LogicalSnapshot
 */
/** Install-transfer local commit, recovery and service-client orchestration.
 * Construction performs no writes, transport or identity allocation.
 */
/** @param {unknown} error */
function errorMessage(error){return error&&typeof error==="object"&&"message" in error?String(error.message):undefined}
/** @param {Options} options */
export function createInstallTransferCommands({device,durable,snapshotPolicy,programModel,workoutRules,entryRules,
 setupDraftStore,trainingSession,entrySession,workoutSession,transfer,contract,telemetry,telemetryTransport,
 guideDefinitions,commit,onProgress,onDeviceChanged,fault=()=>{}}){
const {import:INSTALL_IMPORT_KEY,outbound:INSTALL_OUTBOUND_KEY,
 ui:UIKEY,consent:TELEMETRY_ENABLED_KEY,identity:TELEMETRY_IDENTITY_KEY}=TRANSFER_KEYS;
const INSTALL_TRANSFER_INSTANT_RE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const {isValidStateShape,normalizeLoaded,normalizeSettings}=snapshotPolicy;
const {structureDayLabels}=programModel;
const {readLocalStatus,readIdbStatus,chooseSnapshot,pendingDraftTransaction}=durable;
const idbGet=durable.readAuxiliaryIdbValue,idbSet=durable.writeAuxiliaryIdbValue,idbDel=durable.deleteAuxiliaryIdbValue;
const DraftStore=durable.DraftStore,WorkoutDraft=workoutRules,ProgramEntry=entryRules,EntryDraft=setupDraftStore,GuideRegistry={GUIDE_DEFINITIONS:guideDefinitions};
const installTransferReadRaw=device.readRaw,installTransferReadJson=device.readJson,installTransferWriteRaw=device.writeRaw;
const installTransferOutboundMarker=device.outboundMarker,
 installTransferReadInboundMarker=device.inboundMarker,
 installTransferOutboundStore=device.outboundStore,installTransferInboundStore=device.inboundStore,
 withInstallTransferLock=device.withFrozenLock,installTransferFault=fault;
const installTransferInitialDevice=device.initialDevice();
/** @param {Previous} previous @param {Parameters<Options["durable"]["restoreTransferSnapshot"]>[1]} current */
function installTransferRestoreDurable(previous,current){return durable.restoreTransferSnapshot(previous,current)}
/** @param {ProgressKind} kind @param {object} [detail] */
function progress(kind,detail){onProgress({kind,detail:/** @type {RawRecord|undefined} */(cloneSnapshot(detail))})}
/** @param {string|null} uiRaw @param {RawRecord|null} ui */
function installTransferUiMeaningful(uiRaw,ui){
  if(uiRaw===null)return false;
  if(!ui)return true;
  const remaining={...ui};
  if(remaining.entryLandingSeen===true)delete remaining.entryLandingSeen;
  for(const[key,value]of Object.entries({installLastOfferedMilestone:null,installLastOfferedAt:null,
    installDismissedMilestone:null,installDismissedAt:null})){
    if(remaining[key]===value)delete remaining[key]}
  if(remaining.guideState&&typeof remaining.guideState==="object"&&!Array.isArray(remaining.guideState)){
    const guides=Object.entries(remaining.guideState).filter(([id,record])=>{
      if(!record||typeof record!=="object"||Array.isArray(record))return true;
      const keys=Object.keys(record);
      const definition=GuideRegistry?.GUIDE_DEFINITIONS?.find(guide=>guide.id===id);
      const currentRecord=definition&&record.version===definition.version&&keys.length===3&&
        keys.every(key=>["version","status","lastTransitionAt"].includes(key));
      const defaultRecord=currentRecord&&record.status==="unseen"&&record.lastTransitionAt===null;
      // "install" (iOS Safari's always-present card) and "privacy" (the
      // landing's always-present Privacy link) can self-show from the
      // ordinary automatic landing flow, which now repeats on every boot
      // until the device is onboarded. "entry" anchors at the chooser, one
      // tap from that landing, without anything having been set up. None
      // of the three should make an otherwise-fresh destination read as
      // meaningful merely because one of them appeared.
      const automaticLandingGuide=currentRecord&&(id==="entry"||id==="install"||id==="privacy")&&ui.entryLandingSeen===true&&
        record.status==="shown"&&Number.isSafeInteger(record.lastTransitionAt)&&record.lastTransitionAt>=0;
      return !defaultRecord&&!automaticLandingGuide});
    if(guides.length)remaining.guideState=Object.fromEntries(guides);
    else delete remaining.guideState}
  return Object.keys(remaining).length>0}
function installTransferDeviceMeaningful(){
  const uiRaw=installTransferReadRaw(UIKEY),ui=installTransferReadJson(UIKEY);
  if(installTransferUiMeaningful(uiRaw,ui))return true;
  const consent=installTransferReadRaw(TELEMETRY_ENABLED_KEY);
  if(installTransferInitialDevice.consent!==null||
    consent!==null&&consent!==device.bootDevice()?.consent)return true;
  const identity=installTransferReadRaw(TELEMETRY_IDENTITY_KEY);
  return installTransferInitialDevice.identity!==null||
    identity!==null&&identity!==device.bootDevice()?.identity}
function installTransferDraftSource(){
  return{
    flush:()=>workoutSession.flush(),
    current:()=>workoutSession.current(),
    checkpoint:()=>DraftStore.readV2Checkpoint(),
    read:()=>DraftStore.readCanonicalStatus(),
    logicalCloneSection:/** @param {unknown} draft */ draft=>WorkoutDraft.logicalCloneSection(draft),
  }}
function installTransferStoredDraftSource(){
  const read=DraftStore.readCanonicalStatus();
  let current=null;
  if(read.status==="ok"&&read.raw!==null){
    const parsed=WorkoutDraft.parse(read.raw);
    if(parsed?.kind==="valid")current=parsed.draft}
  return{
    flush:()=>Promise.resolve(),
    current:()=>current,
    checkpoint:()=>DraftStore.readV2Checkpoint(),
    read:()=>DraftStore.readCanonicalStatus(),
    logicalCloneSection:/** @param {unknown} draft */ draft=>WorkoutDraft.logicalCloneSection(draft),
  }}
function installTransferSections(durableSnapshot=trainingSession.read(),{storedDraft=false}={}){
  return{
    durableState:()=>exportableState(durableSnapshot),
    workoutDraft:storedDraft?installTransferStoredDraftSource():installTransferDraftSource(),
    programEntryDraft:()=>{
      const record=setupDraftStore.readRecord();
      if(!record.ok)throw new Error("program-entry-draft-unavailable");
      return record.envelope?.state||null},
    uiPreferences:()=>installTransferReadJson(UIKEY)||{},
    analytics:()=>({enabled:telemetry?.isEnabled?.()!==false&&
      device.readRaw(TELEMETRY_ENABLED_KEY)!=="false"}),
    telemetryIdentity:()=>installTransferReadJson(TELEMETRY_IDENTITY_KEY),
  }}
function installTransferRecoveryIdentityPlaceholder(){
  return{schemaVersion:1,installationId:device.nextId(),createdAt:device.isoNow()}}
/** @returns {Promise<{ok:true,value:Omit<Previous,"devicePresence"|"candidateRaw">}|{ok:false,code:string}>} */
async function installTransferCaptureLogicalSnapshot(durableSnapshot=trainingSession.read(),{storedDraft=false}={}){
  const identityRaw=installTransferReadRaw(TELEMETRY_IDENTITY_KEY);
  const sections=installTransferSections(durableSnapshot,{storedDraft});
  if(identityRaw===null)sections.telemetryIdentity=()=>installTransferRecoveryIdentityPlaceholder();

  let captured;
  try{captured=await transfer.captureLogicalSnapshot(sections)}
  catch(error){return{ok:false,code:errorMessage(error)||"logical-snapshot-failed"}}
  if(!captured?.ok)return{ok:false,code:captured?.code||"logical-snapshot-failed"};
  const logical=/** @type {Omit<Previous,"devicePresence"|"candidateRaw">} */(captured.value);
  if(identityRaw===null)logical.telemetryIdentity=null;
  return{ok:true,value:logical}}
/** @param {unknown} left @param {unknown} right */
function installTransferLogicalEqual(left,right){
  return JSON.stringify(canonicalize(left))===JSON.stringify(canonicalize(right))}
/** @param {unknown} raw @returns {RawRecord} */
function installTransferParseMarker(raw){
  if(typeof raw!=="string")return{invalid:true,raw};
  try{
    const marker=JSON.parse(raw);
    return marker&&typeof marker==="object"&&!Array.isArray(marker)?marker:{invalid:true,raw}}
  catch(error){return{invalid:true,raw,error:String(errorMessage(error)||"invalid-marker")}}}
/** @param {unknown} marker @returns {marker is ImportMarker} */
function installTransferMarkerShape(marker){
  const keys=["version","transactionId","claimIdDigest","phase","previous","incoming","createdAt","expectedLocalRevision"];
  if(!isPlainStateObject(marker)||Object.keys(marker).length!==keys.length||!keys.every(key=>Object.hasOwn(marker,key)))return false;
  if(marker.version!==1||typeof marker.transactionId!=="string"||marker.transactionId.length===0||marker.transactionId.length>256||
    !/^[0-9a-f]{64}$/.test(/** @type {string} */(marker.claimIdDigest))||!INSTALL_TRANSFER_INSTANT_RE.test(/** @type {string} */(marker.createdAt))||
    !Number.isSafeInteger(marker.expectedLocalRevision)||/** @type {number} */(marker.expectedLocalRevision)<0||
    !["importing","rolling-back","local-committed"].includes(/** @type {string} */(marker.phase)))return false;
  const previous=marker.previous;
  const previousKeys=["durableState","workoutDraft","programEntryDraft","uiPreferences","analytics","telemetryIdentity","devicePresence","candidateRaw"];
  if(!isPlainStateObject(previous)||Object.keys(previous).length!==previousKeys.length||!previousKeys.every(key=>Object.hasOwn(previous,key))||
    !isValidStateShape(previous.durableState)||
    (previous.workoutDraft!==null&&(!isPlainStateObject(previous.workoutDraft)||Array.isArray(previous.workoutDraft)))||
    (previous.programEntryDraft!==null&&(!isPlainStateObject(previous.programEntryDraft)||Array.isArray(previous.programEntryDraft)))||
    !isPlainStateObject(previous.uiPreferences)||!isPlainStateObject(previous.analytics)||typeof previous.analytics.enabled!=="boolean"||
    (previous.telemetryIdentity!==null&&(!isPlainStateObject(previous.telemetryIdentity)||Array.isArray(previous.telemetryIdentity)))||
    !isPlainStateObject(previous.devicePresence)||typeof previous.devicePresence.ui!=="boolean"||
    typeof previous.devicePresence.consent!=="boolean"||typeof previous.devicePresence.identity!=="boolean"||
    (previous.candidateRaw!==null&&typeof previous.candidateRaw!=="string"))return false;
  return isPlainStateObject(marker.incoming)&&!Array.isArray(marker.incoming);
}
/** @param {unknown} marker @returns {Promise<{ok:true,marker:ImportMarker}|{ok:false,code:string}>} */
async function installTransferValidateMarker(marker){
  if(!installTransferMarkerShape(marker))return{ok:false,code:"install-import-marker-invalid"};
  try{

    const checked=await contract.validateEnvelopeIntegrity(cloneSnapshot(marker.incoming));
    return checked?.ok?{ok:true,marker}:{ok:false,code:checked?.code||"install-import-marker-envelope-invalid"};
  }catch{return{ok:false,code:"install-import-marker-envelope-invalid"}}}
/** @returns {Promise<ImportMarker|InvalidMarker|null>} */
async function installTransferReadMarker(){
  let localRaw=null,idbMarker=null;
  const localRead=device.readStatus(INSTALL_IMPORT_KEY);
  if(!localRead.ok)return{invalid:true,code:"install-import-marker-read-failed"};
  localRaw=localRead.raw;
  try{idbMarker=await idbGet(INSTALL_IMPORT_KEY);if(idbMarker===undefined)idbMarker=null}
  catch{return{invalid:true,code:"install-import-marker-read-failed"}}
  if(localRaw===null&&idbMarker===null)return null;
  const localMarker=localRaw===null?null:installTransferParseMarker(localRaw);
  if(localMarker===null||idbMarker===null||localMarker?.invalid||!installTransferLogicalEqual(localMarker,idbMarker))
    return{invalid:true,code:"install-import-marker-divergent",marker:localMarker,idbMarker};
  const checked=await installTransferValidateMarker(localMarker);
  return checked.ok?checked.marker:{invalid:true,code:checked.code,marker:localMarker,idbMarker};
}
/** @param {unknown} marker */
async function installTransferWriteMarker(marker){
  const checked=await installTransferValidateMarker(marker);
  if(!checked.ok)return false;
  try{
    if(!device.writeRaw(INSTALL_IMPORT_KEY,JSON.stringify(marker)))return false;
    await idbSet(INSTALL_IMPORT_KEY,cloneSnapshot(marker));
    return true;
  }catch{return false}}
async function installTransferClearMarker(){
  let localRaw,idbMarker;
  const localRead=device.readStatus(INSTALL_IMPORT_KEY);if(!localRead.ok)return false;localRaw=localRead.raw;
  try{idbMarker=await idbGet(INSTALL_IMPORT_KEY);if(idbMarker===undefined)idbMarker=null}
  catch{return false}
  let localCleared=false,idbCleared=false;
  localCleared=device.writeRaw(INSTALL_IMPORT_KEY,null);
  try{await idbDel(INSTALL_IMPORT_KEY);idbCleared=true}catch{}
  if(localCleared&&idbCleared)return true;
  if(localCleared&&localRaw!==null)device.writeRaw(INSTALL_IMPORT_KEY,localRaw);
  if(idbCleared&&idbMarker!==null){try{await idbSet(INSTALL_IMPORT_KEY,cloneSnapshot(idbMarker))}catch{}}
  return false}
async function installTransferBrowserClient(){

  const outbound=installTransferOutboundStore();
  const credentials=transfer.createCredentialVault();
  const operationLock=device.operationLock;
  const transport=transfer.createFetchTransport();
  const client=transfer.createClient({contract,transport,context:"browser",
    storage:{outbound,credentials,operationLock}});
  return{client,contract,transfer,outbound,credentials};
}
let installTransferPollingActive=false,installTransferPollingDelay=5000;
/** @type {number|null} */let installTransferPollingTimer=null;
const INSTALL_TRANSFER_POLL_MARGIN_MS=10*60*1000;
function installTransferStopPolling(){
  if(installTransferPollingTimer!==null)device.cancel(installTransferPollingTimer);
  installTransferPollingTimer=null;installTransferPollingDelay=5000;
}
/** @param {unknown} [code] */
async function installTransferPersistUnknown(code){
  const write=()=>{
    const marker=installTransferOutboundMarker();
    if(!marker||!["creating","awaiting-claim","unknown-outcome"].includes(/** @type {string} */(marker.phase)))return false;
    try{
      return device.writeRaw(INSTALL_OUTBOUND_KEY,JSON.stringify({...marker,phase:"unknown-outcome",outcomeCode:code||"status-unavailable"}));
    }catch{return false}
  };
  return device.withStatusLock(write);
}
function installTransferSchedulePoll(){
  if(installTransferPollingTimer!==null)return;
  const delay=installTransferPollingDelay;
  installTransferPollingDelay=Math.min(60000,Math.max(5000,delay*2));
  installTransferPollingTimer=device.schedule(()=>{
    installTransferPollingTimer=null;
    installTransferPollOutboundStatus();
  },delay);
}
async function installTransferPollOutboundStatus(){
  if(installTransferPollingActive)return;
  installTransferPollingActive=true;
  try{
    const browserClient=await installTransferBrowserClient();
    const res=/** @type {RawRecord & {ok?:boolean,state?:string,code?:string,remoteState?:string,expiresAt?:string}} */(await browserClient.client.status({
      source:{sourceRevision:readRevision(trainingSession.read())}
    }));
    if(res?.ok&&res.state==="confirmed"){
      installTransferStopPolling();
      progress('outbound-confirmed',res);
      return;
    }
    if(res?.ok&&res.state==="idle"&&res.remoteState==="expired"){
      installTransferStopPolling();
      progress('outbound-expired');
      return;
    }
    if(res?.code==="transfer-pending"){
      const marker=installTransferOutboundMarker();
      const expiresAt=Date.parse(/** @type {string} */(res.expiresAt||marker?.expiresAt||""));
      if(Number.isFinite(expiresAt)&&device.now()>=expiresAt+INSTALL_TRANSFER_POLL_MARGIN_MS){
        await installTransferPersistUnknown("poll-exhausted");
        installTransferStopPolling();
        progress('outbound-unknown',res);
        return;
      }
      progress('outbound-pending');
      installTransferSchedulePoll();
      return;
    }
    await installTransferPersistUnknown(res?.code);
    installTransferStopPolling();
    progress('outbound-unknown',res);
  }catch{
    await installTransferPersistUnknown("status-unavailable");
    installTransferStopPolling();
    progress('outbound-unknown')}
  finally{
    installTransferPollingActive=false;
  }
}
async function installTransferCreateFromSafari(){
  progress('outbound-create');
  try{
    const browserClient=await installTransferBrowserClient();
    const identity=installTransferReadJson(TELEMETRY_IDENTITY_KEY);
    const sourceRevision=readRevision(trainingSession.read());
    const result=await browserClient.client.create({
      sections:installTransferSections(trainingSession.read()),
      source:{context:"browser",logicalInstallationId:/** @type {string} */(identity?.installationId||"local-installation"),sourceRevision},
      consent:{enabled:true},
      sourceAfter:()=>installTransferSections(trainingSession.read()),
      hasMeaningfulData:installTransferMeaningful(trainingSession.read()),
    });
    if(result?.ok&&result.state==="ready"){
      progress('outbound-ready',result);
      installTransferStopPolling();
      installTransferSchedulePoll();
      return result;
    }
    if(result?.state==="terminalUnavailable"){
      progress('outbound-retryable',result);
      return result;
    }
    await installTransferPersistUnknown(result?.code);
    progress('outbound-create-failed',result);
    return result;
  }catch(error){
    await installTransferPersistUnknown(errorMessage(error)||"create-unknown-outcome");
    const result={ok:false,state:"unknown-outcome",code:errorMessage(error)||"create-unknown-outcome"};
    progress('outbound-create-failed',result);
    return result;
  }
}
async function installTransferConfirmDivergence(){
  installTransferStopPolling();
  try{
    const browserClient=await installTransferBrowserClient();
    await browserClient.client.confirmDivergence();
  }catch{
    const marker=installTransferOutboundMarker();
    if(marker&&marker.phase!=="invalid"){
      device.writeRaw(INSTALL_OUTBOUND_KEY,JSON.stringify({...marker,phase:"resumedDiverged",divergedAt:device.isoNow()}));
    }
  }
  progress('resumed-diverged');
}
async function installTransferCheckOutboundOnBoot(){
  const marker=installTransferOutboundMarker();
  if(!marker||marker.phase==="resumedDiverged")return;
  progress('outbound-pending');
  if(marker.phase==="creating")installTransferCreateFromSafari();
  else if(marker.phase==="awaiting-claim")installTransferPollOutboundStatus();
}
async function installTransferStandaloneClient({preserveCleanupMarker=false}={}){

  const inbound=installTransferInboundStore({preserveCleanupMarker});
  const credentials=transfer.createCredentialVault();
  const operationLock=device.operationLock;
  const transport=transfer.createFetchTransport();
  const client=transfer.createClient({contract,transport,context:"standalone",
    storage:{inbound,credentials,operationLock}});
  return{client,contract,transfer,inbound,credentials}}
async function installTransferPrepareStandaloneBoot(){
  try{

    const inboundBefore=installTransferReadInboundMarker();
    // The transfer cookie is scoped to the app, so Safari's own page sees the
    // cookie it wrote; only the installed app claims it.
    const cookie=transfer.contextFrom()==="standalone"?transfer.readTransferCookie():null;
    if(!cookie&&!inboundBefore)return{ok:true,absent:true};
    progress('receiver-claim');
    if(inboundBefore?.phase==="local-committed"||inboundBefore?.phase==="cleanup-pending"){
      const standalone=await installTransferStandaloneClient();
      const cleanup=await standalone.client.commit();
      if(cleanup?.ok===true&&!await installTransferClearMarker())
        return{ok:false,code:"marker-clear-failed",blocked:true,state:"localCommitted",cleanup};
      return{ok:true,state:"localCommitted",cleanup};
    }
    const destination=await installTransferDestination();
    if(destination.blocked)return{ok:false,code:destination.code,blocked:true};
    if(installTransferMeaningful(destination.snapshot))return{ok:false,code:"destination-meaningful"};
    const standalone=await installTransferStandaloneClient({preserveCleanupMarker:true});
    const claimed=await standalone.client.claim();
    if(!claimed?.ok||claimed.state!=="validating")return{ok:false,code:claimed?.code||"claim-failed",state:claimed?.state};
    progress('receiver-import',{expiresAt:claimed.expiresAt});
    const claimedMarker=await standalone.inbound.read();
    if(!claimedMarker?.sealedCredentials)return{ok:false,code:"claim-marker-missing"};
    let pair;
    try{pair=await standalone.credentials.unseal("standalone-inbound",claimedMarker.sealedCredentials)}
    catch{return{ok:false,code:"claim-credential-unavailable"}}
    const digest=await installTransferClaimDigest(standalone.contract,{claimId:pair?.claimId,
      credentials:standalone.credentials});
    if(!digest.ok)return{ok:false,code:digest.code||"claim-digest-failed"};
    return{ok:true,pending:{standalone,envelope:claimed.envelope,claimId:pair.claimId,claimIdDigest:digest.value}};
  }catch(error){return{ok:false,code:errorMessage(error)||"standalone-transfer-failed"}}
}
/** @param {Awaited<ReturnType<typeof installTransferPrepareStandaloneBoot>>} prepared */
async function installTransferCompleteStandaloneBoot(prepared){
  if(!prepared?.pending)return prepared||{ok:true,absent:true};
  const {standalone,envelope,claimId,claimIdDigest}=prepared.pending;
  try{
    const imported=await importInstallTransfer(envelope,{claimId,claimIdDigest,credentials:standalone.credentials});
    if(!imported?.ok)return imported;
    const latest=await standalone.inbound.read();
    if(!latest?.sealedCredentials)return{ok:false,code:"claim-marker-lost",localOk:true,idbOk:true};
    await standalone.inbound.write({...latest,phase:"local-committed",claimIdDigest});
    const cleanup=await standalone.client.commit();
    if(cleanup?.ok===true&&!await installTransferClearMarker())
      return{ok:false,code:"marker-clear-failed",blocked:true,localOk:true,idbOk:true,cleanup};
    return{...imported,cleanup,cleanupRetry:cleanup?.ok!==true};
  }catch(error){return{ok:false,code:errorMessage(error)||"standalone-transfer-failed"}}
}
/** @param {Options["contract"]} contract @param {ImportOptions} [options] */
async function installTransferClaimDigest(contract,{claimId=null,claimIdDigest=null,credentials=null}={}){
  if(claimId===null||claimId===undefined)return{ok:false,code:"claim-id-required"};
  if(!contract?.validateClaimId?.(claimId)?.ok)return{ok:false,code:"claim-id-invalid"};
  if(typeof credentials?.unseal!=="function")return{ok:false,code:"claim-credentials-required"};
  const inbound=installTransferReadInboundMarker();
  if(!inbound?.sealedCredentials||!["staged","claiming","claimed"].includes(/** @type {string} */(inbound.phase)))
    return{ok:false,code:"claim-credentials-unavailable"};
  let pair;
  try{pair=await credentials.unseal("standalone-inbound",inbound.sealedCredentials)}
  catch{return{ok:false,code:"claim-credentials-unavailable"}}
  if(pair?.claimId!==claimId)return{ok:false,code:"claim-id-unbound"};
  const digest=await device.digest(/** @type {string} */(claimId));
  if(claimIdDigest!==null&&claimIdDigest!==undefined&&claimIdDigest!==digest)
    return{ok:false,code:"claim-id-digest-mismatch"};
  return{ok:true,value:digest}}
/** @param {RawSnapshot|null} snapshot */
function installTransferStateMeaningful(snapshot){
  if(!snapshot||typeof snapshot!=="object")return true;
  if(Object.prototype.hasOwnProperty.call(snapshot,"profile"))return true;
  const defaultSettings=normalizeSettings(null);
  const destinationSettings=normalizeSettings(snapshot.settings);
  if(!installTransferLogicalEqual(destinationSettings,defaultSettings))return true;
  if(snapshot.programMeta?.onboarded===true||Array.isArray(snapshot.program)&&snapshot.program.length||
    structureDayLabels(snapshot.programMeta)||Array.isArray(snapshot.log)&&snapshot.log.length||
    Array.isArray(snapshot.programHistory)&&snapshot.programHistory.length||
    Array.isArray(snapshot.customExercises)&&snapshot.customExercises.length)return true;
  const carrier=/** @type {RawRecord|null|undefined} */(snapshot.recoveryTransitions);
  if(Array.isArray(carrier?.records)&&carrier.records.length||Array.isArray(carrier?.quarantine)&&carrier.quarantine.length)return true;
  const draft=workoutSession.readAcknowledged(snapshot);
  if(draft.status==="live"||draft.status==="unavailable")return true;
  const candidate=setupDraftStore.readRecord();
  return !candidate.ok||!!candidate.envelope}
/** @param {RawSnapshot|null} snapshot */
function installTransferMeaningful(snapshot){
  return installTransferStateMeaningful(snapshot)||installTransferDeviceMeaningful()}
/** @returns {Promise<{blocked?:false,snapshot:RawSnapshot,revision:number,local:ReturnType<typeof readLocalStatus>,idb:Awaited<ReturnType<typeof readIdbStatus>>,decision:ReturnType<typeof chooseSnapshot>}|{blocked:true,code:string,local:ReturnType<typeof readLocalStatus>,idb:Awaited<ReturnType<typeof readIdbStatus>>,decision:ReturnType<typeof chooseSnapshot>}>} */
async function installTransferDestination(){
  const local=readLocalStatus(),idb=await readIdbStatus(),decision=chooseSnapshot(local,idb);
  if(decision.kind==="first-run")return{local,idb,decision,snapshot:normalizeLoaded(null),revision:0};
  if(decision.kind!=="chosen"||pendingDraftTransaction(decision.snapshot))
    return{local,idb,decision,blocked:true,code:pendingDraftTransaction("snapshot" in decision?decision.snapshot:undefined)?"destination-transaction-pending":"destination-storage-unresolved"};
  return{local,idb,decision,snapshot:cloneSnapshot(decision.snapshot),revision:readRevision(decision.snapshot)}}
/** @param {Envelope} envelope @param {RawSnapshot|null} durableSnapshot @param {{storedDraft?:boolean}} [options] */
async function installTransferReadback(envelope,durableSnapshot,{storedDraft=false}={}){

  const local=readLocalStatus(),idb=await readIdbStatus();
  const durableExpected=envelope.durableState;
  const localOk=local.status==="valid"&&installTransferLogicalEqual(exportableState(local.parsed),durableExpected);
  const idbOk=idb.status==="valid"&&installTransferLogicalEqual(exportableState(idb.parsed),durableExpected);
  let logical=null,logicalError=null;
  try{
    const captured=await transfer.captureLogicalSnapshot(installTransferSections(durableSnapshot,{storedDraft}));
    if(!captured?.ok)logicalError=captured?.code||"logical-readback-failed";
    else logical=captured.value;
  }catch(error){logicalError=errorMessage(error)||"logical-readback-failed"}
  if(logicalError)return{ok:false,localOk,idbOk,code:logicalError,local,idb};
  const expectedLogical={durableState:envelope.durableState,workoutDraft:envelope.workoutDraft,
    programEntryDraft:envelope.programEntryDraft,uiPreferences:envelope.uiPreferences,
    analytics:envelope.analytics,telemetryIdentity:envelope.telemetryIdentity};
  const exactSections=installTransferLogicalEqual(logical,expectedLogical);
  const candidateEnvelope={...cloneSnapshot(envelope),...cloneSnapshot(logical)};
  let integrity;
  try{integrity=await contract.validateEnvelopeIntegrity(candidateEnvelope)}
  catch{integrity={ok:false,code:"integrity-validation-failed"}}
  const ok=localOk&&idbOk&&exactSections&&integrity?.ok===true;
  return{ok,localOk,idbOk,exactSections,integrityOk:integrity?.ok===true,local,idb,logical,
    code:ok?null:("code" in integrity?integrity.code:null)||(!exactSections?"logical-readback-mismatch":"replica-readback-mismatch")}}
/** @returns {Promise<({ok:true,decision:ReturnType<typeof chooseSnapshot>,snapshot:RawSnapshot,logical:Omit<Previous,"devicePresence"|"candidateRaw">,local:ReturnType<typeof readLocalStatus>,idb:Awaited<ReturnType<typeof readIdbStatus>>})|{ok:false,code:string,local:ReturnType<typeof readLocalStatus>,idb:Awaited<ReturnType<typeof readIdbStatus>>,decision:ReturnType<typeof chooseSnapshot>}>} */
async function installTransferStoredLogicalSnapshot(){
  const local=readLocalStatus(),idb=await readIdbStatus(),decision=chooseSnapshot(local,idb);
  if(decision.kind!=="chosen"&&decision.kind!=="first-run")
    return{ok:false,local,idb,decision,code:"destination-storage-unresolved"};
  const snapshot=decision.kind==="first-run"?normalizeLoaded(null):decision.snapshot;
  const captured=await installTransferCaptureLogicalSnapshot(snapshot,{storedDraft:true});
  if(!captured.ok)return{ok:false,local,idb,decision,code:captured.code||"logical-read-failed"};
  return{ok:true,local,idb,decision,snapshot,logical:captured.value}}
/** @param {Partial<Omit<LogicalSnapshot,"telemetryIdentity">> & {telemetryIdentity?:RawRecord|null}|null} envelope */
function installTransferLogicalProjection(envelope){
  return{durableState:envelope?.durableState||null,workoutDraft:envelope?.workoutDraft??null,
    programEntryDraft:envelope?.programEntryDraft??null,uiPreferences:envelope?.uiPreferences||{},
    analytics:envelope?.analytics||null,telemetryIdentity:envelope?.telemetryIdentity??null}}
function installTransferDevicePresence(){
  return{ui:installTransferReadRaw(UIKEY)!==null,
    consent:installTransferReadRaw(TELEMETRY_ENABLED_KEY)!==null,
    identity:installTransferReadRaw(TELEMETRY_IDENTITY_KEY)!==null}}
/** @param {string|null} raw */
function installTransferCandidateLogical(raw){
  if(raw===null)return null;
  try{
    const parsed=ProgramEntry?.normalizeSetupDraftEnvelope?.(raw);
    return parsed?.ok?parsed.value.envelope.state:null}
  catch{return null}}
/** @param {{candidateRaw:string|null}} extra @param {Omit<Previous,"candidateRaw"|"devicePresence">} logical */
function installTransferPreviousMarker(extra,logical){
  return{...logical,devicePresence:installTransferDevicePresence(),candidateRaw:extra.candidateRaw}}
/** @param {RawRecord|null} logical @param {number} durableRevision */
async function installTransferWriteDraft(logical,durableRevision){
  const current=DraftStore.readCanonicalStatus();
  if(current.status!=="ok")return{ok:false,code:"draft-read-failed"};
  if(logical===null){
    if(current.raw===null)return{ok:true,absent:true};
    const parsed=WorkoutDraft.parse(current.raw);
    if(parsed?.kind!=="valid")return{ok:false,code:"draft-untrusted"};
    const removed=await DraftStore.removeV2({expectedDraftId:parsed.draft.draftId,
      expectedRevision:parsed.draft.revision,operationId:`install-import-remove-${device.nextId()}`});
    return{ok:removed.status==="applied"||removed.status==="missing",status:removed.status,
      code:removed.status==="applied"?null:"draft-remove-failed"}}
  const next=/** @type {RawRecord & {program:RawRecord}} */(cloneSnapshot(logical)),operationId=`install-import-${device.nextId()}`;
  next.revision=0;next.writer=workoutSession.writer(operationId);
  next.program={...next.program,durableRevision};
  const checked=WorkoutDraft.parse(next);
  if(checked?.kind!=="valid")return{ok:false,code:"draft-rehydrate-invalid"};
  const nextRaw=JSON.stringify(WorkoutDraft.serialize(checked.draft));
  const written=await DraftStore.compareAndSwapV2({expectedRaw:current.raw,nextRaw,operationId});
  if(written.status==="applied"){
    // compareAndSwapV2 applied establishes the validated draft and exact written bytes.
    const applied=/** @type {{draft:import("../training/workout-contracts.js").Draft,raw:string}} */(written);
    workoutSession.adopt(applied.draft,applied.raw);
    return{ok:true,status:written.status,raw:/** @type {{raw:string}} */(written).raw}}
  return{ok:false,status:written.status,code:"draft-write-failed"}}
/** @param {RawRecord|null} logical */
function installTransferWriteCandidate(logical){
  const observedRaw=setupDraftStore.readRaw();
  if(logical===null){
    if(observedRaw===null)return Promise.resolve({ok:true,absent:true});
    return EntryDraft.transaction(()=>{
      if(setupDraftStore.readRaw()!==observedRaw)return{ok:false,conflict:true};
      const removed=setupDraftStore.removeObserved({raw:observedRaw,envelope:null});
      return{ok:removed.ok,conflict:!!("conflict" in removed&&removed.conflict)}})}
  if(!ProgramEntry)return Promise.resolve({ok:false,code:"program-entry-unavailable"});
  const normalized=ProgramEntry.normalizeSetupDraft(logical);
  if(!normalized.ok)return Promise.resolve({ok:false,code:"program-entry-invalid"});
  let envelope;
  try{
    envelope=EntryDraft.importedEnvelope(normalized.value)}
  catch{return Promise.resolve({ok:false,code:"program-entry-envelope-invalid"})}
  const raw=JSON.stringify(envelope);
  return EntryDraft.transaction(()=>{
    if(setupDraftStore.readRaw()!==observedRaw)return{ok:false,conflict:true};
    const written=EntryDraft.writeObserved({raw:observedRaw},raw);if(!written.ok)return written;
    entrySession.publish(cloneSnapshot(normalized.value));EntryDraft.adopt({raw,envelope},entrySession.read());
    return{ok:true,envelope}})}
/** @param {Envelope} envelope */
function installTransferWriteDeviceSections(envelope){
  try{
    const prefs=cloneSnapshot(envelope.uiPreferences);
    delete prefs.repforge_freeform_session_v1;delete prefs.repforge_import_source_v1;
    if(!device.writeRaw(UIKEY,JSON.stringify(prefs)))return{ok:false,code:"device-section-write-failed"};onDeviceChanged();
    const consentRaw=String(envelope.analytics.enabled===true);
    if(telemetry?.setEnabled)telemetry.setEnabled(envelope.analytics.enabled===true);
    if(!installTransferWriteRaw(TELEMETRY_ENABLED_KEY,consentRaw))return{ok:false,code:"device-consent-write-failed"};
    if(!installTransferWriteRaw(TELEMETRY_IDENTITY_KEY,JSON.stringify(envelope.telemetryIdentity)))
      return{ok:false,code:"device-identity-write-failed"};
    telemetryTransport.restartIfStarted();
    return{ok:true}
  }catch{return{ok:false,code:"device-section-write-failed"}}}
/** @param {Previous} previous @param {Partial<Previous["devicePresence"]>} [presence] */
function installTransferRestoreDeviceSections(previous,presence={}){
  try{
    const prefs=cloneSnapshot(previous.uiPreferences||{});
    if(presence.ui===false){
      if(!installTransferWriteRaw(UIKEY,null))return{ok:false,code:"device-prefs-rollback-failed"};
    }else if(!installTransferWriteRaw(UIKEY,JSON.stringify(prefs)))
      return{ok:false,code:"device-prefs-rollback-failed"};
    if(telemetry?.setEnabled)
      telemetry.setEnabled(previous.analytics?.enabled===true);
    if(presence.consent===false){
      if(!installTransferWriteRaw(TELEMETRY_ENABLED_KEY,null))return{ok:false,code:"device-consent-rollback-failed"};
    }else if(!installTransferWriteRaw(TELEMETRY_ENABLED_KEY,String(previous.analytics?.enabled===true)))
      return{ok:false,code:"device-consent-rollback-failed"};
    if(presence.identity===false){
      if(!installTransferWriteRaw(TELEMETRY_IDENTITY_KEY,null))return{ok:false,code:"device-identity-rollback-failed"};
    }else if(!installTransferWriteRaw(TELEMETRY_IDENTITY_KEY,JSON.stringify(previous.telemetryIdentity)))
      return{ok:false,code:"device-identity-rollback-failed"};
    telemetryTransport.restartIfStarted();
    onDeviceChanged();
    return{ok:true}
  }catch{return{ok:false,code:"device-rollback-failed"}}}
/** @param {string|null|undefined} previousRaw @param {(RawRecord|null)[]} [allowedLogicals] */
function installTransferRestoreCandidate(previousRaw,allowedLogicals=[]){
  const observedRaw=setupDraftStore.readRaw();
  if(previousRaw===undefined)return Promise.resolve({ok:false,code:"candidate-rollback-metadata-missing"});
  return EntryDraft.transaction(()=>{
    const current=setupDraftStore.readRaw();
    const previousLogical=installTransferCandidateLogical(previousRaw);
    const currentLogical=installTransferCandidateLogical(current);
    if(current!==observedRaw)return{ok:false,conflict:true};
    const allowed=[previousLogical,...allowedLogicals]
      .filter(value=>value!==undefined)
      .some(value=>installTransferLogicalEqual(currentLogical,value));
    if(!allowed)return{ok:false,conflict:true};
    if(previousRaw===null){
      const removed=setupDraftStore.removeObserved({raw:/** @type {string} */(current),envelope:null});
      if(!removed.ok)return{...removed};
      entrySession.publish(null);EntryDraft.adopt(null,null);
      return{ok:true}}
    if(!previousLogical)return{ok:false,code:"candidate-rollback-invalid"};
    if(!EntryDraft.writeObserved({raw:current},previousRaw).ok)return{ok:false,code:"candidate-rollback-write-failed"};
    const envelope=JSON.parse(previousRaw);
    entrySession.publish(cloneSnapshot(previousLogical));EntryDraft.adopt({raw:previousRaw,envelope},entrySession.read());
    return{ok:true}})}
/** @param {ImportMarker} marker @param {Awaited<ReturnType<typeof installTransferStoredLogicalSnapshot>>} current @param {Partial<Omit<LogicalSnapshot,"telemetryIdentity">> & {telemetryIdentity?:RawRecord|null}} expected */
function installTransferStoredLogicalMatches(marker,current,expected){
  return !!(current?.ok&&current.logical&&installTransferLogicalEqual(
    current.logical,installTransferLogicalProjection(expected))) }
/** @param {ImportMarker} marker @param {Awaited<ReturnType<typeof installTransferStoredLogicalSnapshot>>} current */
async function installTransferRollback(marker,current){
  const previous=marker.previous;
  if(!previous||typeof previous!=="object")return{ok:false,code:"rollback-previous-missing"};
  if(!current?.ok)return{ok:false,code:current?.code||"rollback-read-failed"};
  // An importing marker owns every local boundary until the local proof is
  // promoted. A read-back mismatch is therefore an interrupted transaction,
  // not a reason to leave a mixed clone waiting for a later boot.
  const incoming=marker.incoming;
  const currentCandidateRaw=setupDraftStore.readRaw();
  const currentCandidate=installTransferCandidateLogical(currentCandidateRaw);
  const incomingCandidate=incoming?.programEntryDraft??null;
  const previousCandidate=previous.programEntryDraft??null;
  const candidateMatchesIncoming=installTransferLogicalEqual(currentCandidate,incomingCandidate);
  const candidateMatchesPrevious=installTransferLogicalEqual(currentCandidate,previousCandidate);
  if(!candidateMatchesIncoming&&!candidateMatchesPrevious&&currentCandidateRaw!==null)
    return{ok:false,code:"candidate-rollback-conflict"};
  if(currentCandidateRaw===null&&!candidateMatchesIncoming&&!candidateMatchesPrevious&&
    (incomingCandidate!==null||previousCandidate!==null))return{ok:false,code:"candidate-rollback-conflict"};
  const durable=await installTransferRestoreDurable(previous,current);
  if(!durable.ok)return{ok:false,code:durable.code,durable};
  installTransferFault("after-rollback-durable");
  const draft=await installTransferWriteDraft(previous.workoutDraft,
    Number.isSafeInteger(marker.expectedLocalRevision)?marker.expectedLocalRevision:0);
  if(!draft.ok)return{ok:false,code:draft.code||"draft-rollback-failed",durable};
  installTransferFault("after-rollback-draft");
  const candidate=await installTransferRestoreCandidate(previous.candidateRaw??null,
    [incomingCandidate]);
  if(!candidate.ok)return{ok:false,code:candidate.code||"candidate-rollback-failed",durable,draft};
  installTransferFault("after-rollback-candidate");
  const deviceResult=installTransferRestoreDeviceSections(previous,previous.devicePresence||{});
  if(!deviceResult.ok)return{ok:false,code:deviceResult.code||"device-rollback-failed",durable,draft,candidate};
  installTransferFault("after-rollback-device");
  const verified=await installTransferStoredLogicalSnapshot();
  if(!verified.ok||!installTransferStoredLogicalMatches(marker,verified,previous))
    return{ok:false,code:"rollback-readback-mismatch",durable,draft,candidate,device:deviceResult,verified};
  return{ok:true,state:"rolledBack",durable,draft,candidate,device:deviceResult,verified}}
/** @param {ImportMarker|InvalidMarker|null} input */
async function installTransferResumeMarker(input){
  const marker=/** @type {ImportMarker|null} */(input);
  if(marker&&"invalid" in marker&&marker.invalid)return{ok:false,code:"install-import-marker-invalid",blocked:true};
  if(!marker||marker.version!==1||!marker.previous||!marker.incoming||
    !["importing","rolling-back","local-committed"].includes(/** @type {string} */(marker.phase)))
    return{ok:false,code:"install-import-marker-invalid",blocked:true};
  const current=await installTransferStoredLogicalSnapshot();
  if(!current.ok)return{ok:false,code:current.code||"install-import-read-failed",blocked:true};
  const incomingMatch=installTransferStoredLogicalMatches(marker,current,marker.incoming);
  if(marker.phase==="local-committed")
    return{ok:true,state:"localCommitted",deferredRemoteCommit:true,diverged:!incomingMatch};
  if(marker.phase==="importing"&&incomingMatch){
    const committed={...marker,phase:"local-committed"};
    if(!await installTransferWriteMarker(committed))return{ok:false,code:"marker-commit-failed",blocked:true};
    return{ok:true,state:"localCommitted",resumed:true,deferredRemoteCommit:true}}
  if(marker.phase==="importing"||marker.phase==="rolling-back"){
    let rollingBack=marker;
    if(marker.phase==="importing"){
      rollingBack={...marker,phase:"rolling-back"};
      if(!await installTransferWriteMarker(rollingBack))return{ok:false,code:"marker-rollback-phase-failed",blocked:true};
    }
    const rollback=await installTransferRollback(rollingBack,current);
    if(!rollback.ok)return{...rollback,blocked:true};
    if(!await installTransferClearMarker())return{ok:false,code:"marker-clear-failed",blocked:true,rollback};
    return{ok:true,state:"rolledBack",rollback}
  }
  return{ok:false,code:"install-import-diverged",blocked:true}
}
/** @param {unknown} envelope @param {ImportOptions} [options] */
async function importInstallTransferUnlocked(envelope,{claimId=null,claimIdDigest=null,transactionId=null,credentials=null}={}){
  let marker=null;
  try{

    const checked=await contract.validateEnvelopeIntegrity(cloneSnapshot(envelope));
    if(!checked?.ok)return{ok:false,localOk:false,idbOk:false,code:checked?.code||"invalid-envelope"};
    const incoming=checked.value;
    const destination=await installTransferDestination();
    if(destination.blocked)return{ok:false,localOk:false,idbOk:false,code:destination.code};
    if(installTransferMeaningful(destination.snapshot))
      return{ok:false,localOk:false,idbOk:false,code:"destination-meaningful"};

    const previousCapture=await installTransferCaptureLogicalSnapshot(destination.snapshot);
    if(!previousCapture?.ok)return{ok:false,localOk:false,idbOk:false,code:previousCapture?.code||"previous-snapshot-failed"};
    if(!transactionId)transactionId=device.nextId();
    const claim=await installTransferClaimDigest(contract,{claimId,claimIdDigest,credentials});
    if(!claim.ok)return{ok:false,localOk:false,idbOk:false,code:claim.code};
    marker={version:1,transactionId,claimIdDigest:claim.value,phase:"importing",
      previous:installTransferPreviousMarker({candidateRaw:setupDraftStore.readRaw()},previousCapture.value),
      incoming:cloneSnapshot(incoming),createdAt:device.isoNow(),expectedLocalRevision:destination.revision};
    if(!await installTransferWriteMarker(marker))return{ok:false,localOk:false,idbOk:false,code:"marker-write-failed"};
    installTransferFault("after-marker");
    const durable=await commit(/** @type {RawSnapshot} */(cloneSnapshot(incoming.durableState)),{replace:true,
      expectedStorageRevision:destination.revision,recoveryTransaction:true,
      preflight:async({head})=>installTransferMeaningful(head)
        ?{reject:true,result:{ok:false,localOk:false,idbOk:false,conflict:true,code:"destination-meaningful"}}:null});
    if(!(durable?.localOk&&durable?.idbOk))return{ok:false,localOk:!!durable?.localOk,idbOk:!!durable?.idbOk,
      code:durable?.code||"durable-write-incomplete",phase:marker.phase};
    installTransferFault("after-durable");
    const draft=await installTransferWriteDraft(incoming.workoutDraft,/** @type {number} */(durable.revision));
    if(!draft.ok)return{ok:false,localOk:true,idbOk:true,code:draft.code||"draft-write-failed",phase:marker.phase};
    installTransferFault("after-draft");
    const candidate=await installTransferWriteCandidate(incoming.programEntryDraft);
    if(!candidate.ok)return{ok:false,localOk:true,idbOk:true,code:("code" in candidate?candidate.code:null)||"candidate-write-failed",phase:marker.phase};
    installTransferFault("after-candidate");
    const deviceResult=installTransferWriteDeviceSections(incoming);
    if(!deviceResult.ok)return{ok:false,localOk:true,idbOk:true,code:deviceResult.code,phase:marker.phase};
    installTransferFault("after-device");
    installTransferFault("before-readback");
    const readback=await installTransferReadback(incoming,trainingSession.read());
    if(!readback.ok)return{...readback,phase:marker.phase};
    marker={...marker,phase:"local-committed"};
    if(!await installTransferWriteMarker(marker))return{ok:false,localOk:true,idbOk:true,code:"marker-commit-failed",phase:"importing"};
    installTransferFault("after-local-committed");
    return{ok:true,state:"localCommitted",phase:marker.phase,localOk:true,idbOk:true,transactionId:marker.transactionId,
      marker:cloneSnapshot(marker)}
  }catch(error){
    return{ok:false,localOk:false,idbOk:false,code:errorMessage(error)||"install-import-failed",phase:marker?.phase||"none",
      transactionId:marker?.transactionId||transactionId||null}}
}
/** @param {unknown} envelope @param {ImportOptions} [options] */
async function importInstallTransfer(envelope,options={}){
  return withInstallTransferLock(()=>importInstallTransferUnlocked(envelope,options));
}
/** @param {unknown} request */
async function runPreBootRequest(request){
  if(request===undefined)return{ok:true,absent:true};
  try{
    if(!request||typeof request!=="object"||Array.isArray(request)||!("envelope" in request)||!request.envelope)
      return{ok:false,code:"preboot-request-invalid"};
    return await importInstallTransfer(request.envelope,/** @type {ImportOptions} */("options" in request?request.options||{}:{}));
  }catch(error){return{ok:false,code:errorMessage(error)||"preboot-import-failed"}}
}
/** @param {boolean} hasRequest */
async function bootNeedsLock(hasRequest){
  // A crashed realm releases its Web Lock without running finally. Reacquire
  // that same lock before replacing a surviving signal; never infer an expiry.
  if(device.freezeSignal()!==null)return true;
  if(await installTransferReadMarker()!==null)return true;
  if(installTransferReadInboundMarker()!==null||hasRequest)return true;
  try{return transfer.contextFrom()==="standalone"&&!!transfer.readTransferCookie()}catch{return false}
}
/** @template T @param {{loadTraining:()=>Promise<T>,takePreBootRequest:()=>unknown,hasPreBootRequest:boolean}} options */
async function boot({loadTraining,takePreBootRequest,hasPreBootRequest}){
  const work=async()=>{
    const marker=await installTransferReadMarker();
    if(marker&&"invalid" in marker&&marker.invalid)return{ok:false,code:marker.code||"install-import-marker-invalid"};
    const resumed=marker?await installTransferResumeMarker(marker):{ok:true,absent:true};
    if(resumed?.ok!==true)return resumed||{ok:false,code:"install-import-recovery-failed"};
    const decision=await loadTraining();
    const preBootTransfer=await runPreBootRequest(takePreBootRequest());
    if(preBootTransfer?.ok!==true)return{...(preBootTransfer||{ok:false,code:"preboot-import-failed"}),decision};
    const prepared=await installTransferPrepareStandaloneBoot();
    if(prepared?.ok!==true)return{...(prepared||{ok:false,code:"standalone-transfer-failed"}),decision,productRecovery:true};
    const completed=await installTransferCompleteStandaloneBoot(prepared);
    if(completed?.ok!==true)return{...(completed||{ok:false,code:"standalone-transfer-failed"}),decision,productRecovery:true};
    return{ok:true,decision,preBootTransfer,transferResult:completed};
  };
  return await bootNeedsLock(hasPreBootRequest)?withInstallTransferLock(work):work();
}
function abandonUnsealed(){
  const marker=installTransferOutboundMarker();
  if(marker?.phase==="creating"&&!marker.sealedCredentials)device.writeRaw(INSTALL_OUTBOUND_KEY,null);
}
return Object.freeze({boot,readMarker:installTransferReadMarker,importEnvelope:importInstallTransfer,
 createOutbound:installTransferCreateFromSafari,confirmDivergence:installTransferConfirmDivergence,
 checkOutboundOnBoot:installTransferCheckOutboundOnBoot,outboundMarker:installTransferOutboundMarker,
 abandonUnsealed,deviceMeaningful:installTransferDeviceMeaningful,stateMeaningful:installTransferStateMeaningful});
}
