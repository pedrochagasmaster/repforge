import {createEntryImportSession,createEntryImportCommands,createEntryGeneration,createEntryAnswerCommands,createEntryQuestionFlow,createEntryReviewSession,createEntrySetup,createEntryActivation,buildLandingProof,FREEFORM_MAX_CHARS} from './src/app/entry.js';
import {LANDING_SCENES,LANDING_SPOTS,LANDING_READ} from './src/ui/entry/landing/artwork.js';
import {createLandingContent} from './src/ui/entry/landing/view.js';
import * as ExerciseSource from './exercises.js';
import {EXERCISE_LIBRARY,LEGACY_LIBRARY_IDS,EXERCISE_CATALOG_SHA256} from './exercises.js';
import {STRINGS} from './i18n.js';
import {createI18n} from './src/platform/i18n.js';
import {createInstallTransferCommands} from './src/app/install-transfer.js';
import {createBlockReview} from './src/app/block-review.js';
let blockReview;
import {scalarSessions,previousScalarSessionRows,mergeLogChronology,isStalled,blockCompletionBucket,programProgressionHealth as deriveProgramHealth,programVolumeCompliance as deriveVolumeCompliance,programStatusKey} from './src/training/progress.js';
let validateRecoveryProjectionRecord=async()=>null;
import {createCustomDefinitionImport} from './src/app/custom-import.js';
import {workoutDayIdForSnapshot,workoutParseContextForSnapshot} from './src/persistence/snapshot.js';
import {createExerciseLabels} from './src/ui/exercise-labels.js';
import {review as ReviewRules} from './src/training/authoring.js';
import {createProgramReview} from './src/ui/editors.js';
import {createStorageRecoveryView} from './src/ui/storage-recovery.js';
import {createStorageRecoveryCommands} from './src/app/storage-recovery.js';
import {createInstalledEditorView} from './src/ui/program/installed-editor.js';
let InstalledEditorView;
import {createInstalledEditor} from './src/app/installed-editor.js';
let InstalledEditor,BuildAuthoring,programCommands;
import {createProgramSharing} from './src/app/program-sharing.js';
import {createProgramSharingView} from './src/ui/program/sharing.js';
import {createFiles} from './src/platform/files.js';
import {PROGRAM_TEXT_DATA_MARKER} from './src/interchange/program-text.js';
let programSharing,programSharingView;
import {createTelemetry} from './src/platform/telemetry.js';
import {createPostHog} from './src/platform/posthog.js';
import {createBlockTransitionCommands} from './src/app/block-transition.js';
import {createWorkoutReadModel,movementToken,movementIdKey,loggedMovementName,liftKey,exerciseLiftKey} from './src/app/workout-model.js';
import {createShell,NATIVE_FOCUS_SELECTOR as ROUTE_NATIVE_FOCUS} from './src/ui/shell.js';
import {createNotifications} from './src/platform/notifications.js';
import {createSessionSheet} from './src/ui/workout/session-sheet.js';
import {createEntryController} from './src/ui/entry/controller.js';
import * as FreeformGrammar from './src/interchange/freeform.js';
import * as InstallPolicy from './src/platform/install.js';
import {createInstallView} from './src/ui/settings/install.js';
import {createSettingsCommands,createSettingsDraftEffects} from './src/app/settings.js';
import {interpretProfile} from './src/app/profile.js';
import {createSettingsView} from './src/ui/settings/view.js';
import {createAppearance} from './src/ui/settings/appearance.js';
import {createGuidesView} from './src/ui/settings/guides.js';
import GuideRegistry from './src/ui/settings/guide-registry.js';
import {createNotificationControls} from './src/ui/settings/notifications.js';
import {createEntryPickers,ENTRY_WHEEL_ROW} from './src/ui/entry/pickers.js';
import {createProgramController} from "./src/ui/program/controller.js";
let ProgramUi;
import {createProgramFormCommands} from "./src/app/program-form.js";
let programFormCommands;
import {createLibraryController} from "./src/ui/library/controller.js";
import {exerciseMedia,exerciseMediaBg,exerciseThumb,emptyThumb} from "./src/ui/exercise-media.js";
import {foldSearch} from "./src/ui/library/search.js";
let libraryUi;
import {createCatalog,CATALOG_URL} from './src/platform/catalog.js';
import {create as createProgramExecutor,url as programWorkerUrl} from './src/platform/program-executor.js';
import {createGenerationRules} from './src/training/generation.js';
import {createEntryAdapter} from './src/training/authoring.js';
import {estimateOneRepMax as e1rm} from './src/training/metrics.js';
import {derivePersonalRecords,workingRows,buildSessionDelta as deriveSessionDelta,compareProjectedSessionOutcome as deriveProjectedOutcome,noComparableSessionOutcome as deriveNoComparable} from './src/training/progress.js';
import {buildStrengthEvidenceRecords,buildStrengthProjection,strengthSessionKey,buildLiftSessionSummaries,createProgressReadModels,loggedMuscleAttribution,overviewBarPct,presentSessionOutcome,compareProgressStrengthSession as deriveProgressSessionOutcome} from './src/app/progress-read-models.js';
import {createProgressController,createExerciseController} from './src/ui/progress/controller.js';
import {createReviewController} from './src/ui/progress/review.js';
import {createReviewCommands} from './src/app/review.js';
import {evidence as NativeProgressModel,buildSessionSummary as deriveSessionSummary,sessionOutcomeGroups as deriveSessionOutcomeGroups} from './src/training/progress.js';
import {createHistoryController} from './src/ui/history/controller.js';
import {groupHistoryRows,completeHistoryIndex,searchHistoryIndex} from './src/app/history-read-models.js';
import {createTodayController} from './src/ui/today/controller.js';
import {createSessionSummary} from './src/ui/workout/summary.js';
import * as ReadModels from './src/app/read-models.js';
import {verdictMarkHtml as sharedVerdictMarkHtml,formatSetsLine,formatTable,formatProgramContext,formatCycleLabel,formatShortDate,sameLoad,recommendationVerdict,formatList} from './src/ui/format.js';
let TodayUi,SummaryUi,ProgressUi,ReviewUi,TrainingModel,ProgressReadModels;
import {createSession} from './src/app/session.js';
import {createWorkoutCommands,createFocusWorkoutCommands,createWorkoutSuggestionCommands} from './src/app/workout.js';
import {createCustomExerciseCommands,createProgramReplacementCommands,createProgramAdditionCommands} from './src/app/program.js';
import {createHistoryCommands} from './src/app/history.js';
import {createMotion} from './src/platform/motion.js';
import * as SnapshotPolicy from './src/persistence/snapshot.js';
import {createDurableStore} from './src/persistence/durable.js';
import {createPreferences} from './src/persistence/preferences.js';
import {createSetupDraftStore,SETUP_DRAFT_KEY} from './src/persistence/setup-draft.js';
import {createProgramModel,PROGRESSION_VALUE_LIMITS} from './src/training/model.js';
import {createEntryRules,createInstalledEditorRules,suggestion} from './src/training/authoring.js';
import {createProgramEditor} from './src/ui/editors.js';
import {createWorkoutRules} from './src/training/workout.js';
import PersistenceMetrics from './src/training/metrics.js';
import {progression as PersistenceProgression,schedule} from './src/training/progress.js';
const {cloneSnapshot,isPlainStateObject,isValidBlockId,isBoundedProgressionValue,isBoundedTransitionValue,classifyRecoveryCarrier,isValidRecoveryTransitions,readRevision,stripStorageMeta,exportableState,mirrorComparisonSnapshot,canonicalize,canonicalPayload,snapshotsEqual,storageSnapshotsEqual,rebaseStateChange,unversionedSnapshot,draftProgramFingerprint,workoutProgramFingerprint,draftContextFingerprint,snapshotBlockId}=SnapshotPolicy;
let normalizeMuscleAttribution,isValidMuscleDomainTree,isValidStoredMuscleField,isValidPlannedVolumeHistory,normalizeRecoveryCarrierSnapshot,isSafeProgressionFields,isSafeProgressionMeta,isSafeProgramHistoryEntry,isSafeLogRow,isSafeCustomExercise,isValidSetupActivationMarker,setupActivationMarker,setupActivationMatches,isValidStateShape,migrateLogSnapshot,defaultProgramMeta,normalizeProgramEntrySource,normalizeProgramMeta,normalizeLoadingConfiguration,withExplicitProgramStructure,normalizeProgramHistory,normalizeLoaded,normalizeNotify,normalizeSettings;
import {createSetupLinkCodec} from './src/interchange/setup-link.js';
import {createTransferContract} from './src/interchange/transfer-contract.js';
import {createInstallTransfer,createTransferDevice} from './src/platform/install-transfer.js';

import {createBackupCommands} from './src/app/interchange.js';
import {createBackupView} from './src/ui/settings/backup.js';
import {BACKUP_MAX_BYTES} from './src/interchange/backup.js';
import {parseCanonicalProgramFile as parseCanonicalFile,parseProgramImport,definitionMovementIds,boundedImportJson,importUtf8Bytes,PROGRAM_MAX_BYTES as IMPORT_MAX_BYTES,PROGRAM_FILE_KIND,PROGRAM_FILE_VERSION,unsupportedGrammar} from './src/interchange/program-file.js';
import * as Focus from "./src/ui/focus/controller.js";
let fallbackGestureController=null;


function cancelFallbackGestures(){
  focusGestureView().cancel();
  if(sheetDrag){sheetDragRelease(sheetDrag.rec);sheetDrag=null}}
let focusGestureController=null;
function focusGestureView(){
  if(!focusGestureController)focusGestureController=Focus.createFocusGestures({window,
    readModel:()=>{const list=focusList(),at=list.length?Math.min(focusUi.index,list.length-1):0;return {active:workoutActive,canPrevious:at>0,canNext:at+1<list.length}},
    commands:{go:focusGo,navigate:focusAnimateTo,swallowNextClick},motion:window.RepForgeMotion||null});
  return focusGestureController}
function mountFallbackGestures() {
  if(fallbackGestureController)return fallbackGestureController;
  document.addEventListener("pointerdown", sheetDragStart);
  window.addEventListener("pointermove", sheetDragMove, { passive: true });
  window.addEventListener("pointerup", sheetDragEnd);
  window.addEventListener("pointercancel", sheetDragEnd);
  const wk = $("#workout");
  if (wk) wk.addEventListener("pointerdown", focusDragStart);
  window.addEventListener("pointermove", focusDragMove, { passive: true });
  window.addEventListener("pointerup", focusDragEnd);
  window.addEventListener("pointercancel", focusDragEnd);
  let disposed = false;
  const onEscape=e=>{if(e.key==="Escape")cancelFallbackGestures()};
  document.addEventListener("keydown",onEscape,true);
  fallbackGestureController = {
    isFluid:false,
    navigate:dir=>!disposed && fallbackFocusAnimateTo(dir),
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelFallbackGestures();
      fallbackGestureController=null;
      document.removeEventListener("keydown",onEscape,true);
      document.removeEventListener("pointerdown", sheetDragStart);
      window.removeEventListener("pointermove", sheetDragMove);
      window.removeEventListener("pointerup", sheetDragEnd);
      window.removeEventListener("pointercancel", sheetDragEnd);
      if (wk) wk.removeEventListener("pointerdown", focusDragStart);
      window.removeEventListener("pointermove", focusDragMove);
      window.removeEventListener("pointerup", focusDragEnd);
      window.removeEventListener("pointercancel", focusDragEnd);
    }
  };
  return fallbackGestureController;
}
const KEY="repforge_v1",DRAFT="repforge_draft_v1",NOTIFY_META="repforge_notify_v1";
const generationRules=createGenerationRules();
const ProgramCompiler=generationRules.compiler;
let WorkoutDraft=createWorkoutRules(null),ProgramEntry=createEntryRules(null);
const ExerciseCatalog=createCatalog({identity:generationRules.identity,librarySource:ExerciseSource,
  fetcher:url=>window.fetch(url)});
const ExerciseMetrics=PersistenceMetrics;
let rawExerciseCatalog=null,exerciseCatalogError=null;
function rawCatalogObject(id){return ExerciseCatalog?.getObject?.(String(id??""))||null}
function rawExercise(id){return ExerciseCatalog?.getExercise?.(String(id??""))||null}
function rawMetricDefinitions(...args){return TrainingModel.rawMetricDefinitions(...args)}
async function loadExerciseCatalog(){
  if(!ExerciseCatalog?.load)return false;
  try{rawExerciseCatalog=await ExerciseCatalog.load();WorkoutDraft=createWorkoutRules(rawExerciseCatalog);ProgramEntry=createEntryRules(rawExerciseCatalog);exerciseCatalogError=null;return true}
  catch(error){exerciseCatalogError=error;return false}}
let exerciseCatalogRetryBusy=false;
function showExerciseCatalogUnavailable(){
  const dialog=$("#exerciseCatalogRecovery"),retry=$("#retryExerciseCatalog");
  const title=$("#exerciseCatalogRecoveryTitle"),body=$("#exerciseCatalogRecoveryBody"),status=$("#exerciseCatalogRecoveryStatus");
  if(!dialog||!retry||!title||!body||!status)return false;
  if(!dialog.dataset.guarded){dialog.addEventListener("cancel",event=>event.preventDefault());dialog.dataset.guarded="1"}
  window.__repforgeCatalogUnavailable=String(exerciseCatalogError?.message||"catalog-unavailable");
  title.textContent=t("catalog.unavailable.title");
  body.textContent=t("catalog.unavailable.body");
  status.textContent="";
  retry.textContent=t("catalog.unavailable.retry");
  retry.disabled=false;
  retry.onclick=async()=>{
    if(exerciseCatalogRetryBusy)return;
    exerciseCatalogRetryBusy=true;retry.disabled=true;status.textContent=t("catalog.unavailable.retrying");
    const loaded=await loadExerciseCatalog();
    if(!loaded){
      window.__repforgeCatalogUnavailable=String(exerciseCatalogError?.message||"catalog-unavailable");
      status.textContent=t("catalog.unavailable.retry_failed");retry.disabled=false;exerciseCatalogRetryBusy=false;return}
    window.__repforgeCatalogUnavailable=null;
    await closeModal(dialog);
    try{await boot()}finally{exerciseCatalogRetryBusy=false}
  };
  openModal(dialog,{initialFocus:retry,onEscape:null});
  retry.focus();
  return true}

const Notifications=createNotifications({Notification:window.Notification,navigator:window.navigator,console:window.console});
const DRAFT_PENDING_PREFIX=`${DRAFT}:pending:`,DRAFT_CLOSE_PREFIX=`${DRAFT}:closing:`;
const DRAFT_V2_CHECKPOINT=`${DRAFT}:v2-checkpoint`;
const DRAFT_WRITE_TRANSACTION="draft-write";
// The device owner captures pre-telemetry consent/identity before any boot writes.
const transferDevice=createTransferDevice({browser:window,nextId:()=>uid(),now:()=>Date.now()});
let TransferCommands=null;
let installTransferTelemetryBooted=false;
function installTransferMutationFrozen(){return transferDevice.mutationFrozen()}
function installTransferOutboundMarker(){return TransferCommands.outboundMarker()}
function installTransferRecordBootDevice(){return transferDevice.recordBootDevice()}
function loadNotifyMeta(){return preferenceStore.readNotify()}
function saveNotifyMeta(m){return preferenceStore.writeNotify(m)}
async function idbGet(key){return DurableState.readAuxiliaryIdbValue(key)}
async function idbSet(key,val){return DurableState.writeAuxiliaryIdbValue(key,val)}
async function idbDel(key){return DurableState.deleteAuxiliaryIdbValue(key)}
const STORAGE_REV="_storageRevision",STORAGE_FOLLOWUP="_storageFollowUp",STORAGE_DRAFT_TXN="_storageDraftTransaction",STORAGE_SETUP_TXN="_storageSetupActivation";
/* Transient, journal-only: what a shared proposal contributed as its own custom
   definitions, so a rebase against a refreshed head can tell payload data from
   recipient data. Stripped before any snapshot becomes durable. */
const SHARED_IMPORT="_sharedSetupImport";



const MuscleDomain=ProgramEntry;



function invalidMuscleDomainCommit(value=null){
  return{ok:false,committed:false,invalid:true,code:"invalid-muscle-domain",
    message:t("program.editor.invalid_muscles"),localOk:false,idbOk:false}}




















/* Carrier classification is deliberately narrower than normalization. The
   supported envelope is closed: an unknown key/version is storage recovery,
   while a known envelope whose semantic record is malformed can fall back to
   the canonical program and leave bounded evidence. */









async function recoverySha256(raw){
  if(typeof TextEncoder!=="function"||!globalThis.crypto?.subtle)throw new Error("SHA-256 unavailable");
  const bytes=new TextEncoder().encode(raw);
  const digest=await globalThis.crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}




/* An archived block's custom slots resolve against the install's custom
   definitions (archived, never deleted, while anything points at them) as well
   as any the archive itself carries. */










// Mirror arbitration must retain setup-activation receipts. They are omitted
// from exports, but dropping one while choosing between equal-revision local
// and IndexedDB copies can re-enable a second activation after a partial write.




function encodeRawExport(raw){if(raw==null)return"";if(typeof raw==="string")return raw;try{return JSON.stringify(raw,null,2)}catch{return String(raw)}}
function readLocalStatus(){return DurableState.readLocalStatus()}
async function readIdbStatus(){return DurableState.readIdbStatus()}
function chooseSnapshot(local,idb){return DurableState.chooseSnapshot(local,idb)}
let DurableState;
let storageIO;
const PENDING_EFFECT_MAX_RAW=1000000;
const DRAFT_PRECONDITION_MATCH_ONLY="match-only";
const DRAFT_PRECONDITION_ABORT_CHANGED="abort-changed";
const DRAFT_PRECONDITION_ABORT_SAME_DAY="abort-same-day";
const DRAFT_EFFECT_VALID="valid",DRAFT_EFFECT_INVALID="invalid",DRAFT_EFFECT_NONE="none";
let mutationBase=null;
let storageDegradedToast=false;


function enqueueWrite(op){return DurableState.enqueueWrite(op)}
function flushStorage(){
  const tail=DurableState.flushStorage();
  return Promise.all([tail,EntryDraft?.flush()||Promise.resolve()])}
async function writeSnapshot(snapshot,io){return DurableState.writeSnapshot(snapshot,io)}
function noteWriteHealth(result){
  const both=!!(result.localOk&&result.idbOk),none=!result.localOk&&!result.idbOk,degraded=!both&&!none;
  if(none){storageDegradedToast=false;toast(t("toast.storage_full"),{assertive:true})}
  else if(degraded){if(!storageDegradedToast){storageDegradedToast=true;toast(t("toast.storage_degraded"))}}
  else storageDegradedToast=false;
  const el=$("#storageDegraded");
  if(el){el.textContent=degraded?t("settings.storage.degraded"):"";el.classList.toggle("hidden",!degraded);el.hidden=!degraded}}
function requireAdapter(io,label){return DurableState.requireAdapter(io,label)}









function resetPersistenceBase(snapshot){
  mutationBase=cloneSnapshot(snapshot);
  DurableState.setPersistHead(snapshot)}
async function refreshPersistenceHead(){return DurableState.refreshPersistenceHead()}
function withStorageLock(io,op){return DurableState.withStorageLock(io,op)}
function applyAcceptedSnapshot(base,snapshot){
  const live=rebaseStateChange(base,snapshot,state,{preferProposal:false});
  live[STORAGE_REV]=readRevision(snapshot);
  publishTrainingSnapshot(live);
  const liveBlock=snapshotBlockId(state),sameCarrierRecord=activeRecoveryRecord&&
    recoveryCarrierRecords(state).some(record=>record.transitionId===activeRecoveryRecord.transitionId&&
      record.proposalHash===activeRecoveryRecord.proposalHash&&record.diff?.recoveryWeek?.blockId===liveBlock);
  if(sameCarrierRecord){activeRecoveryRecordBlockId=liveBlock}
  else{activeRecoveryRecord=null;activeRecoveryRecordBlockId=null}
  mutationBase=cloneSnapshot(snapshot);
  }

function draftEffectOutcome(effect){return DurableState.draftEffectOutcome(effect)}
function normalizeDraftEffectOutcome(value){return DurableState.normalizeDraftEffectOutcome(value)}
function pendingJournalEffect(effect){return DurableState.pendingJournalEffect(effect)}
function draftEffectRequiresCoordination(effect){return DurableState.draftEffectRequiresCoordination(effect)}
function pendingDraftTransaction(snapshot){return DurableState.pendingDraftTransaction(snapshot)}
function pendingJournalEffectState(effect){return DurableState.pendingJournalEffectState(effect)}
function applyPendingJournalEffect(effect){return DurableState.applyPendingJournalEffect(effect)}
function pendingDraftPostEffectAccepted(effect){return DurableState.pendingDraftPostEffectAccepted(effect)}
function pendingDraftRelatedState(effect,transactionId,contextFingerprint=null){return DurableState.pendingDraftRelatedState(effect,transactionId,contextFingerprint)}
function pendingDraftSettlementAccepted(effect,transactionId,contextFingerprint=null){return DurableState.pendingDraftSettlementAccepted(effect,transactionId,contextFingerprint)}
function pendingDraftEffectAccepted(effect,checked,transactionId,contextFingerprint=null){return DurableState.pendingDraftEffectAccepted(effect,checked,transactionId,contextFingerprint)}
function readDraftRaw(){
  return DraftStore.readRaw()}
function consumedDraftClearEffect(expectedRaw){
  return draftEffectOutcome({required:true,kind:"clear-draft",expectedRaw,
    precondition:DRAFT_PRECONDITION_MATCH_ONLY})}
function destructiveDraftClearEffect(expectedRaw){
  return draftEffectOutcome({required:true,kind:"clear-draft",expectedRaw,
    precondition:DRAFT_PRECONDITION_ABORT_CHANGED})}
function draftPreservationEffect(expectedRaw){
  if(expectedRaw==null)return destructiveDraftClearEffect(null);
  return draftEffectOutcome({required:true,kind:"replace-draft",expectedRaw,replacementRaw:expectedRaw,
    precondition:DRAFT_PRECONDITION_ABORT_CHANGED})}
function draftDayReplacementEffect(oldDay,newDay,nextProgramSnapshot=null){
  try{
    const expectedRaw=DraftStore.readRaw();
    if(expectedRaw==null)return draftEffectOutcome({required:true,kind:"clear-draft",expectedRaw:null,
      precondition:DRAFT_PRECONDITION_ABORT_SAME_DAY,conflictDay:oldDay});
    let replacementRaw=expectedRaw;
    try{
      const draft=JSON.parse(expectedRaw);
      if(draft&&typeof draft==="object"&&!Array.isArray(draft)){
        if(draft.schemaVersion===2&&draft.program?.dayLabel===oldDay&&nextProgramSnapshot){
          const operationId=`day-rename-${uid()}`;
          draft.program.dayLabel=newDay;
          draft.program.programFingerprint=workoutProgramFingerprint(nextProgramSnapshot);
          draft.revision+=1;draft.session.updatedAt=new Date().toISOString();draft.writer=draftWriter(operationId);
          const checked=WorkoutDraft?.parse(draft);
          if(checked?.kind!=="valid")return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"v2-day-replacement"};
          replacementRaw=JSON.stringify(WorkoutDraft.serialize(checked.draft))}
        else if(draft.__day===oldDay){draft.__day=newDay;replacementRaw=JSON.stringify(draft)}}}
    catch{}
    return draftEffectOutcome({required:true,kind:"replace-draft",expectedRaw,replacementRaw,
      precondition:DRAFT_PRECONDITION_ABORT_SAME_DAY,conflictDay:oldDay})}
  catch{return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"draft-read"}}}

/* DraftV2 bounds its stored fingerprint. Hash the complete canonical program
   instead of truncating it: length plus four independent FNV-1a passes make
   every source byte participate while keeping the adapter value fixed-size. */

function workoutDraftFault(point){
  if(window.__repforgeDraftFault!==point)return false;
  window.__repforgeDraftFault=null;return true}


function programTransitionPrecondition(snapshot=state){
  return{expectedProgramId:snapshot?.programMeta?.id||null,
    expectedProgramFingerprint:draftProgramFingerprint(snapshot),
    expectedBlockId:snapshotBlockId(snapshot),
    expectedStorageRevision:readRevision(snapshot)}}
let DraftStore;
function parsedAcknowledgedDraftV2(raw,source){
  const parsed=WorkoutDraft?.parse(raw);
  return parsed?.kind==="valid"?{status:"live",raw,draft:parsed.draft,source}:null}
/*
 * This is deliberately a read-only boundary. A block start may not trigger
 * boot reconciliation, checkpoint repair, recovery retention, or any other
 * draft mutation while deciding whether it is safe to cross the boundary.
 * The committed checkpoint is the acknowledged aggregate; a valid queued V2
 * sidecar is also live because it is the next ordered draft publication.
 */
function readLiveAcknowledgedDraftV2(snapshot=state){
  const canonical=DraftStore.readCanonicalStatus();
  if(canonical.status!=="ok")return{status:"unavailable",reason:"canonical-read"};
  const checkpoint=DraftStore.readV2Checkpoint();
  if(checkpoint.status==="invalid"||checkpoint.status==="read-failed")
    return{status:"unavailable",reason:"checkpoint-read"};
  const context=draftContextFingerprint(snapshot);
  const queued=DraftStore.pending().entries.filter(entry=>entry.value.programFingerprint===context).at(-1);
  const queuedDraft=queued?parsedAcknowledgedDraftV2(queued.value.raw,"pending"):null;
  if(queuedDraft)return queuedDraft;
  if(checkpoint.status==="valid"){
    const value=checkpoint.value;
    if(value.kind==="tombstone")return{status:"none"};
    if(value.kind==="committed"){
      const committed=parsedAcknowledgedDraftV2(value.raw,"checkpoint");
      return committed||{status:"unavailable",reason:"committed-draft"};
    }
    if(value.kind==="pending"){
      // Before canonical publication, retain the acknowledged predecessor when
      // present; with no predecessor the candidate itself is the in-flight
      // V2 value and must still block a destructive block start.
      const protectedRaw=canonical.raw===value.baseRaw&&value.previous?.raw||value.raw;
      const pendingDraft=parsedAcknowledgedDraftV2(protectedRaw,"checkpoint-pending");
      return pendingDraft||{status:"unavailable",reason:"pending-draft"};
    }
    if(value.kind==="pending-removal"){
      // The removal is not acknowledged until the tombstone is committed. If
      // canonical bytes have been overwritten in the meantime, the protected
      // V2 value remains the authoritative live draft until reconciliation.
      const pendingRemoval=parsedAcknowledgedDraftV2(value.raw,"checkpoint-pending-removal");
      return pendingRemoval||{status:"unavailable",reason:"pending-removal"};
    }
    return{status:"unavailable",reason:"checkpoint-kind"};
  }
  const canonicalDraft=parsedAcknowledgedDraftV2(canonical.raw,"canonical");
  return canonicalDraft||{status:"none"};
}
function blockStartDraftGuard(snapshot=state){
  const live=readLiveAcknowledgedDraftV2(snapshot);
  if(live.status==="live")return{draftConflict:true,code:"live_draft_blocks_next_block"};
  if(live.status==="unavailable")return{draftConflict:true,code:"draft_state_unavailable"};
  return null;
}
function v2CheckpointRecord(draft,raw,operationId=draft.writer.operationId){
  return DurableState.v2CheckpointRecord(draft,raw,operationId)}
function prepareV2CheckpointEffect(currentRaw,nextRaw,operationId,options={}){
  return DurableState.prepareV2CheckpointEffect(currentRaw,nextRaw,operationId,options)}
function commitV2CheckpointEffect(prepared,nextRaw){
  return DurableState.commitV2CheckpointEffect(prepared,nextRaw)}


function readPendingJournal(){return DurableState.readPendingJournal()}








function clearAllPendingJournal(){return DurableState.clearAllPendingJournal()}






/* Pre-c4 version-2 journals did not carry recoveryTransaction. Recovering
   that absence by looking for any carrier delta would claim unrelated import,
   setup, replacement, or generic work. Keep the old compatibility path a
   closed reconstruction of the two canonical recovery mutations instead. */

/* A pre-c4 journal with recovery-shaped state can still be unmarked. The
   compatibility classifier above recognizes only the two canonical mutations:
   one new block-start record, or one outcome-only reassessment. Any other
   valid recovery-carrier mutation is ambiguous and must not fall through to
   generic state replay. Metadata is not a positive signal here: missing or
   malformed preconditions must fail closed too. Keep this gate separate from
   isRecoveryJournalAttempt so the legacy single-reassessment replay contract
   remains unchanged. */


/* Bounded semantic/value equality for inherited transition values: absent on
   both sides is equal; anything present compares canonical parsed values, so
   a changed field is a difference even when every ID is retained. */






/* Correction 4: the one non-transition journal that replays is the exact
   existing program-replacement shape — a new valid active id, no proposal
   transitionIn, a transitionOut multiset identical to the base, every base
   history row retained value-identically keyed by primary id, and exactly one
   additional legacy archive for the old active id with no transitionOut, no
   conflicting archiveId, and the exact captured base program/meta including
   its transitionIn. Every other transitionIn removal stays a guarded attempt. */












function enqueueStateChange(base,proposal,io,options={}){return DurableState.enqueueStateChange(base,proposal,io,options)}
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const I18N=createI18n({strings:STRINGS,document,navigator});
export {I18N as language};
// Consume-only visual diagnostics observe this instance's actual missing keys.
window.__repforgeI18nMissingRequests=Object.freeze({consume:I18N.consumeMissingRequests});
const t=(k,v)=>I18N?I18N.t(k,v):k;
/** "1 session" / "2 sessions": the count catalog keeps a `_one` form for exactly 1 (R7 V-14). kind: sessions, sets, exercises. */
const countText=(kind,n)=>t(n===1?`count.${kind}_one`:`count.${kind}`,{n});
/** Words in the language font, figures in Plex Mono: a line of copy with its numbers (5, 11–12, 39.5) wrapped in `.num`, the
 *  rest escaped text. Mono is only for values (R7 V-18). */
const monoNums=text=>String(text).split(/(\d+(?:[.,]\d+)?(?:[–-]\d+(?:[.,]\d+)?)?)/).map((part,i)=>i%2?`<span class="num">${esc(part)}</span>`:esc(part)).join("");
/** A catalog key with a `_one` sibling: the sibling for exactly 1, the key otherwise. */
const tOne=(key,n,vars)=>t(n===1?`${key}_one`:key,{n,...vars});
const tp=(n,w)=>I18N?I18N.tp(n,w):(+n===1?w:w+"s");
// One native consent/identity owner. The per-instance facade is also the explicit
// test fault seam; application consumers keep this lexical instance.
const telemetryCore=createTelemetry();
const Telemetry={...telemetryCore,setEnabled(enabled){
  if(installTransferMutationFrozen())return telemetryCore.isEnabled();
  return telemetryCore.setEnabled(enabled)}};
window.__repforgeTelemetry=Telemetry;
let postHogTransport=null;
const captureEvent=(event,properties)=>{try{return Telemetry.capture(event,properties)===true}catch{return false}};
const coarseCountBucket=value=>{const n=Number(value);return!Number.isSafeInteger(n)||n<0?"0":n===0?"0":n===1?"1":n<=5?"2-5":"6+"};
const bootTelemetry=()=>{if(installTransferMutationFrozen())return null;try{
  postHogTransport??=createPostHog({browser:window,telemetry:Telemetry,config:window.__POSTHOG_CONFIG__||{}});
  const result=postHogTransport.start();
  if(result)installTransferTelemetryBooted=true;
  return result}catch{return null}};
const telemetryPlatformClass=()=>{if(isIOS())return"ios";const ua=navigator.userAgent||"";if(/android/i.test(ua))return"android";if(/windows|macintosh|linux|cros/i.test(ua))return"desktop";return"other"};
const applyI18n=()=>{if(!I18N)return;I18N.applyDom();
  const langSel=$("#lang");if(langSel){if(state?.settings?.lang)langSel.value=state.settings.lang;[...langSel.options].forEach(o=>{o.textContent=t("settings.lang."+o.value)})}
  $$("[data-term]").forEach(b=>{const key=b.dataset.term;b.textContent=t(`glossary.term.${key}`)||key;if(!b.onclick)b.onclick=e=>{e.stopPropagation();glossaryPopover(key,b)}});
};
/* An explicit choice wins; otherwise follow the browser. `setLang` falls back
   to English on anything it does not recognise, so the detected language has to
   be resolved here rather than handed a null and left to that fallback. */
const resolveLang=()=>state?.settings?.lang||I18N.detectLang();
function syncLang(){if(!I18N)return;I18N.setLang(resolveLang());applyI18n()}
function announce(msg,{assertive=false,placement=""}={}){
  const generation=announce._generation=(announce._generation||0)+1;
  const live=$("#toast");if(!live)return;
  // "top" keeps a notice clear of a sheet's pinned foot (the Session sheet's reorder announcement).
  live.classList.toggle("toast--top",placement==="top");
  live.setAttribute("role",assertive?"alert":"status");
  live.setAttribute("aria-live",assertive?"assertive":"polite");
  live.setAttribute("aria-atomic","true");
  live.classList.remove("hidden");
  clearTimeout(announce._t);
  const write=()=>{
    live.textContent=msg;
    clearTimeout(announce._t);announce._t=setTimeout(()=>live.classList.add("hidden"),2400)};
  if(live.textContent===msg){
    live.textContent="";
    requestAnimationFrame(()=>{
      if(generation!==announce._generation)return;
      requestAnimationFrame(()=>{
        if(generation!==announce._generation)return;
        write()})})}
  else write()}
const toast=(m,opts)=>announce(m,opts||{});
/* The Program editor announces a change it made (an exercise added, changed or removed). A custom exercise saved from
   the picker has just announced itself, and that is the one announcement for the change. */
let customCreatedToastAt=-Infinity;
function announceEditorChange(message,opts){
  if(opts?.change&&performance.now()-customCreatedToastAt<4000)return;
  toast(message)}
let browserPresentation=null;
/** Compose presentation before catalog/storage recovery can open a modal.
 * Construction installs no gesture listeners; init explicitly mounts Motion. */
function ensureBrowserPresentation(){
  if(browserPresentation)return browserPresentation;
  const motion=createMotion({window,
    focus:{track:focusTrack,card:focusCard,step:focusStep,canGo:focusCanGo,setTrack:focusSetTrack,
      go:focusGo,dragStart:focusDragStart,dragMove:focusDragMove,dragEnd:focusDragEnd},
    sheets:{dragStart:sheetDragStart,dragMove:sheetDragMove,dragEnd:sheetDragEnd},
    selection:{isNativeTextSelectionTarget,swallowNextClick},
    fallback:{mount:mountFallbackGestures,navigate:fallbackFocusAnimateTo}});
  const shell=createShell({window,motion,isBooted:()=>window.__repforgeBooted===true,
    isFocusActive:()=>document.body.classList.contains("is-focus-wo"),
    releaseSheetDrag:rec=>{const wasDragged=sheetDrag?.rec===rec;
      if(wasDragged)sheetDrag=null;
      if(wasDragged||rec.motion)sheetDragRelease(rec)},releaseSwallowedClick});
  browserPresentation={motion,shell};
  window.RepForgeMotion=motion;
  return browserPresentation;
}
function shellView(){return ensureBrowserPresentation().shell}
function afterModalSettles(callback){return shellView().afterModalSettles(callback)}
function canTakeFocus(element){return shellView().canTakeFocus(element)}
function resolveReturnFocus(target){return shellView().resolveReturnFocus(target)}
function routeHeading(view){return shellView().routeHeading(view)}
function focusRoute(target){return shellView().focusRoute(target)}
function routeInvokerControl(){return shellView().routeInvokerControl()}
function routePushBegin(direction,pages){return shellView().routePushBegin(direction,pages)}
function routeViewEl(id){return shellView().routeViewEl(id)}
function openModal(element,options){return shellView().openModal(element,options)}
function closeModal(element){return shellView().closeModal(element)}
function setDisclosure(button,panel,open){return shellView().setDisclosure(button,panel,open)}
const uid=()=>crypto?.randomUUID?.()||`id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
/* Block identity is allocated only at a real activation/block-start boundary.
   Normalisation, boot, replay, and staged proposals must preserve absence or
   the already-captured candidate instead of calling this allocator. */
const allocateBlockId=()=>`block_${uid()}`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmtPlain=v=>Number.isFinite(Number(v))?(Number.isInteger(Number(v))?String(Number(v)):Number(v).toFixed(2).replace(/\.?0+$/,"")):"";
// DraftV2 stores loads and bodyweight in kilograms. Display formatting is
// intentionally short for the UI, but a storage conversion must retain the
// number that was actually entered: 12.5 lb is 5.669904625125443 kg, not 5.67.
// Number#toString occasionally chooses exponent notation, which DraftV2's
// decimal grammar rejects, so expand only that representation at the boundary.
const canonicalNumberText=PersistenceMetrics.canonicalNumberText;
const uiLang=()=>state?.settings?.lang||(typeof I18N!=="undefined"&&I18N?.getLang?.())||"en";
const isPt=()=>uiLang()==="pt";
const locTag=()=>isPt()?"pt-BR":"en-US";
/** Locale-aware display number (PT decimal comma). Not for input values. */
const fmt=v=>{const s=fmtPlain(v);if(!s)return"";return isPt()?s.replace(".",","):s};
const kfmt=v=>{const n=Number(v)||0;
  if(n>=10000){const raw=(n/1000).toFixed(n>=100000?0:1).replace(/\.0$/,"");return (isPt()?raw.replace(".",","):raw)+"k"}
  try{return Math.round(n).toLocaleString(locTag())}catch{return String(Math.round(n))}};
const plural=(n,word)=>`${word}${+n===1?"":"s"}`;
const avg=a=>a.length?a.reduce((s,x)=>s+Number(x||0),0)/a.length:0;
const median=a=>{if(!a.length)return 0;const s=[...a].map(Number).sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const sum=a=>a.reduce((s,x)=>s+Number(x||0),0);
function shiftDate(date,n){const d=new Date(`${String(date).slice(0,10)}T12:00:00`);d.setDate(d.getDate()+n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const daysAgo=n=>shiftDate(today(),-n);
function weekStart(date){const d=new Date(`${String(date).slice(0,10)}T12:00:00`),dow=d.getDay(),diff=dow===0?6:dow-1;
  d.setDate(d.getDate()-diff);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function weekRange(date){const start=weekStart(date);return{start,end:shiftDate(start,6)}}
function sessionsInRange(start,end){const ids=new Set();for(const x of state.log){if(String(x.date)>=start&&String(x.date)<=end)ids.add(x.session)}return[...ids]}
window.__repforgeWeek={weekStart,weekRange,sessionsInRange};
const muscles=s=>MuscleDomain.normalizeMuscleAttribution(s).tokens;
const muscleLabel=name=>{const k="muscle."+name,s=t(k);return s===k?name:s};
/* Stored muscle tags are comma-joined English tokens ("Hamstrings,Glutes"); every
   place that shows them to the lifter goes through this. */
const muscleListLabel=s=>muscles(s).map(muscleLabel).join(", ");
// Capacity: what a set demonstrated the lifter COULD have done (ADR 0003).
// RIR credit is capped at hardRir — trustworthy near failure, fantasy far from it.
// TUNABLE: every constant the capacity engine reads lives here. Never inline them.
const CAPACITY={jumpMargin:1,bigJumpMargin:3,pushGap:2,dropClamp:.05,
  baselineSessions:3,temperFloor:.3,temperDamp:.5,temperClamp:.05,temperMinSets:3};
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
/** Trusted reps in reserve: negatives floor at 0, blanks keep the conservative 1. */
const capRir=rir=>{const r=rir===""||rir==null?NaN:+rir;
  return Math.min(Number.isFinite(r)?Math.max(r,0):1,+state.settings.hardRir||4)};
const capReps=(reps,rir)=>+reps+capRir(rir);
const capE1rm=(load,reps,rir)=>e1rm(load,capReps(reps,rir));
/** Inverse Epley: reps this capacity-e1RM predicts as performable at a load.
 *  Snapped to 6 decimals so the e1rm round-trip lands exactly on whole reps —
 *  every trigger below compares against integer rep thresholds, and raw float
 *  noise (11 arriving as 10.999999999999995) would silently miss them. */
const repsAtLoad=(cap,load)=>cap>0&&load>0?Math.round(30*(cap/load-1)*1e6)/1e6:0;
const shortDate=d=>formatShortDate(d,t,uiLang());
// Locale-aware long date for evidence headings and drill-ins (G-38).
const longDate=d=>{const p=String(d||"").split("-");if(p.length!==3)return String(d||"");
  try{return new Date(`${d}T12:00:00`).toLocaleDateString(locTag(),{day:"numeric",month:"long",year:"numeric"})}catch{return d}};
/* Rows and logs keep their stable grouping labels. Generated structure records
   carry a localized display-name key beside that internal label, while a name
   override is the exact text the lifter typed. A split-generated day keeps its
   English label in storage and reads in the app language while it still holds
   the generator's exact name (#316). Legacy Day N strings still get their
   ordinal translation, and arbitrary hand-authored labels remain exact. */
const DEFAULT_DAY_NAME=/^Day\s+(\d+)$/;
function dayStructureFor(value,meta){
  const s=String(value??"").trim();
  const days=meta?.programStructure?.days;
  if(!Array.isArray(days))return null;
  return days.find(entry=>{
    const label=String(entry?.label??"").trim(),dayId=String(entry?.dayId??"").trim();
    return s&&(label===s||dayId===s)})||null}
function localizedDayName(entry,fallback,definition){
  const override=typeof entry?.nameOverride==="string"&&entry.nameOverride.trim()
    ?entry.nameOverride:"";
  if(override)return override;
  const value=String(entry?.label??fallback??"");
  const dayId=definition?.days?.find?.(day=>day?.kind==="training"&&day.name===value.trim())?.id;
  const key=typeof entry?.displayNameKey==="string"?entry.displayNameKey
    :ProgramCompiler?.generatedDayNameKey?.(definition,dayId)||"";
  if(key){const translated=t(key);if(translated!==key)return translated}
  const match=DEFAULT_DAY_NAME.exec(value.trim());
  return match?t("program.default.day",{n:+match[1]}):value}
function previewDayLabel(day,index,preview){
  const entry=dayStructureFor(day?.dayId||day?.label,preview)||day;
  return localizedDayName(entry,day?.label||`Day ${index+1}`,preview?.programDefinition)}
const dayLabel=d=>{
  const s=String(d??"").trim();
  const meta=setupEditorOpen
    ?entryState?.result?.preview
    :state?.programMeta;
  return localizedDayName(dayStructureFor(s,meta),d,meta?.programDefinition);
};
const Files=createFiles({document,navigator,URL,Blob,File});
const {download,shareOrDownload}=Files;
const {EFFORT_STEPS,effortForRir}=Focus;
const EFFORT_RIR={easy:3,hard:1,max:0};
const isEffortMode=()=>state?.settings?.rirMode==="effort";
/** Bucket a logged RIR into the effort word closest to it. */
const effortLabel=e=>t("effort."+e);
/** The same word inside a sentence ("… at hard effort", "… esforço difícil"). */
const effortWord=e=>effortLabel(e).toLocaleLowerCase(locTag());
const EFFORT_TERM={easy:"Easy effort",hard:"Hard effort",max:"Max effort"};
/** The effort a working set is aimed at, read off the program's RIR ceiling. */
const targetEffort=()=>effortForRir(state?.settings?.rirHigh);
/** How a set reads once it is logged: the word in effort mode, else "@RIR". */
const effortOrRirLabel=rir=>isEffortMode()?effortLabel(effortForRir(rir)):`@${fmt(rir)}`;
/* ---- Focus motion (Plan 064 rule 11: owner picks T1, L2, L4 and M1) ----
   Everything animated here goes through `RepForgeMotion`: the travelling
   outlines through `animateIndicator`, the short beats through the classes in
   `motion-polish.css`. Nothing waits on any of it. The shelf action stays
   enabled and takes a tap on the first frame, a set logged during a travel
   commits at once, and under reduced motion (or without the runtime) the end
   state is drawn on the first frame with the same information. */
/** The layer when it can animate, else null: the travelling outlines need the runtime. */
let FocusEffects;
function focusEffects(){return FocusEffects||(FocusEffects=Focus.createFocusEffects({window,motion:ensureBrowserPresentation().motion}))}
const focusMotion=()=>focusEffects().enabled(),beatsOn=()=>focusEffects().beatsOn();
const playBeat=(...args)=>focusEffects().playBeat(...args),settleBeats=(...args)=>focusEffects().settleBeats(...args),
  travelOutline=(...args)=>focusEffects().travelOutline(...args);
/** M1, the shelf value on a pad tap, is conditional on a physical phone check
 *  at logging frequency (motion-rule-11-amendment.md section 5). This is the one
 *  switch: "directional" is the owner's pick (6px, 120ms, the way the value
 *  moved), "fade" is the 80ms crossfade it falls back to, "off" plays nothing. */

window.__repforgeShelfValueBeat=mode=>{if(mode==="directional"||mode==="fade"||mode==="off")focusUi.valueBeat=mode;return focusUi.valueBeat};
/** The pad's direction for the value it is about to change, read by that input's handler. */

/** Edits the lifter has made that DraftV2 has not yet acknowledged (a write waits for the cross-tab lock and the
 *  ordered queue). Keyed like the draft's own flat keys (`<exerciseId>_<set>_<field>`), holding the value as the
 *  lifter sees it. The shelf and the ledger read it through `setFieldVals`, so a rebuild while a write is in flight
 *  draws the value the lifter set, not the older acknowledged one; the entry is released the moment its write
 *  settles, whichever way it ends, and the draft is the only record of what is saved. */
const focusUi=Focus.createFocusState();
const pendingFields=focusUi.pending;
function holdPendingField(key,value){return focusUi.holdPendingField(key,value)}
function releasePendingField(key,token){focusUi.releasePendingField(key,token)}
const shelfValueMove=(...args)=>FocusEffort.valueMove(...args),setEffortPick=(...args)=>FocusEffort.pick(...args),
  effortPopHtml=(...args)=>FocusEffort.html(...args),openEffortPop=(...args)=>FocusEffort.open(...args),
  closeEffortPop=(...args)=>FocusEffort.close(...args),toggleEffortPop=(...args)=>FocusEffort.toggle(...args);
/* The glossary popover is a non-modal dialog opened from a term. By keyboard or screen reader it behaves as one:
   the term says it opens a dialog and whether it is open, focus moves into the popover (named and described by the
   definition it shows, so the text is read out), and Escape or the close button closes it and returns focus to the
   term. A tap elsewhere closes it without moving focus. (R7 J-15) */
let glossaryOpener=null;
function closeGlossary({restore=true}={}){
  const g=$("#glossary");if(!g||g.classList.contains("hidden"))return false;
  g.classList.add("hidden");
  const opener=glossaryOpener;glossaryOpener=null;
  if(opener){
    opener.setAttribute("aria-expanded","false");
    // A rebuild of the page may have replaced the term: ask for its equivalent.
    const term=opener.isConnected?opener:$$(`[data-term="${CSS.escape(opener.dataset.term||"")}"]`).find(el=>!el.closest(".is-peek")&&canTakeFocus(el));
    if(restore&&term)focusRoute(term)}
  return true}
function glossaryPopover(termKey,anchor){const g=$("#glossary");if(!g)return;
  if(glossaryOpener&&glossaryOpener!==anchor)glossaryOpener.setAttribute("aria-expanded","false");
  g.querySelector(".glossary__term").textContent=t(`glossary.term.${termKey}`)||termKey;
  g.querySelector(".glossary__body").textContent=t(`glossary.${termKey}`)||"";
  g.classList.remove("hidden");
  glossaryOpener=anchor;anchor.setAttribute("aria-haspopup","dialog");anchor.setAttribute("aria-expanded","true");
  anchor.setAttribute("aria-controls","glossary");
  try{g.focus({preventScroll:true})}catch{}
  const r=anchor.getBoundingClientRect(),viewportWidth=document.documentElement.clientWidth||window.innerWidth;
  const bounds=g.getBoundingClientRect(),left=Math.max(8,Math.min(r.left,viewportWidth-bounds.width-8));
  const viewportHeight=document.documentElement.clientHeight||window.innerHeight;
  const top=Math.max(8,Math.min(r.bottom+6,viewportHeight-bounds.height-8));
  g.style.top=`${window.scrollY+top}px`;g.style.left=`${window.scrollX+left}px`}
const DEFAULTS={jumpPct:2.5,minJump:2.5,rirHigh:2,hardRir:4,restSec:120,lastExport:"",unit:"kg",lang:null,rirMode:"numeric",voiceInputEnabled:false,notify:{enabled:false,timer:true,session:true,unfinished:true,missed:true}};
const normSetting=(v,def,min=0)=>Number.isFinite(+v)&&+v>=min?+v:def;
const normalizeRestSec=v=>{const n=+v;if(!Number.isFinite(n)||n<0)return DEFAULTS.restSec;return Math.round(n)};
const normBool=(v,def)=>typeof v==="boolean"?v:def;
/* A settings blob written by a newer build carries keys this one has no field
   for. Dropping them here does not merely hide them: boot normalization would
   leave live state without them while the mutation base still has them, so the
   next ordinary write offers them back as deletions. Unknown keys therefore ride
   along untouched, and the known fields always win. */
function withUnknownKeys(raw,known){
  if(!isPlainStateObject(raw))return known;
  const out={};
  for(const key of Object.keys(raw))
    if(!Object.prototype.hasOwnProperty.call(known,key))out[key]=cloneSnapshot(raw[key]);
  return Object.assign(out,known)}


const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const LB=2.2046226218;
/* Locale keyboards (pt-BR, de, fr, …) put a comma on the decimal pad. HTML
   type=number rejects it on iOS, and unary + / Number() treat "90,5" as NaN.
   parseDec mirrors normalizeCommandText: digit-comma-digit → period. */
const parseDec=PersistenceMetrics.parseDecimalInput;
// Strict F7 parsing (grammar + 1000 kg ceiling) wearing the field-error shape:
// value is canonical kg so the exact lb bound snaps instead of drifting 1 ulp over.
const parseLoadDisplay=raw=>{const p=parseLoadInput(raw);
  if(p.kind==="valid")return{value:p.kg};
  return{field:"load",key:p.kind==="empty"?"toast.enter_weight_before_save_set":"toast.invalid_weight"}};
const parseRepsValue=raw=>{const n=parseDec(raw);if(!Number.isFinite(n)||n<=0||!Number.isInteger(n))return{field:"reps",key:"validation.reps"};return{value:n}};
const parseRirValue=raw=>{const n=parseDec(raw);if(!Number.isFinite(n)||n<0)return{field:"rir",key:"validation.rir"};return{value:n}};
const parseEffortValue=raw=>{const v=String(raw||"");if(!Object.prototype.hasOwnProperty.call(EFFORT_RIR,v))return{field:"effort",key:"validation.effort"};return{value:v}};
const parseOptionalBodyweightDisplay=raw=>{if(raw==null||String(raw).trim()==="")return{value:0};const n=parseDec(raw);if(!Number.isFinite(n)||n<=0)return{field:"bodyweight",key:"validation.bodyweight"};return{value:n}};
const parseCalendarDate=raw=>{const s=String(raw??"").trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return{field:"date",key:"validation.date"};const y=+s.slice(0,4),m=+s.slice(5,7),d=+s.slice(8,10);const dt=new Date(y,m-1,d);if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d)return{field:"date",key:"validation.date"};return{value:s}};
const toDisplayUnit=(kg,unit)=>unit==="lb"?(+kg||0)*LB:(+kg||0);
const fromDisplayUnit=(v,unit)=>{const n=parseDec(v),x=Number.isFinite(n)?n:0;return unit==="lb"?x/LB:x};
const isLb=()=>state.settings.unit==="lb";
const toDisplay=kg=>toDisplayUnit(kg,state.settings.unit);
const fromDisplay=v=>fromDisplayUnit(v,state.settings.unit);
const unitLabel=()=>isLb()?"lb":"kg";
/* Typed loads reject exponent notation and anything over 1000 kg after
   one display-unit conversion — a 1e5 commit poisons every derived metric.
   1000 kg is inclusive. The lb display of that bound is 1000*LB; converting
   it back can land 1 ulp over, so only that exact display value snaps to 1000. */
const parseLoadInput=(raw,unit=state.settings.unit)=>ExerciseMetrics.parseLoadInput(raw,unit);
const loadInputToast=p=>t(p.kind==="empty"?"toast.enter_weight_before_save_set":"toast.invalid_weight");
const fmtLoad=kg=>fmt(toDisplay(kg));
const fmtLoadPlain=kg=>fmtPlain(toDisplay(kg));
const term=key=>`<button type="button" class="term" data-term="${esc(key)}">${esc(t(`glossary.term.${key}`)||key)}</button>`;
function resetWorkoutSessionIdentity(){
  clearUnfinishedWatch();
  lastCommitAt=0;sessionStartedAt=0;
  committed.clear();touched.clear();warmups.clear();skipped.clear();
  contextTouched={day:false,date:false,sessionNotes:false,bodyweight:false};
  activeWorkoutDraft=null;activeWorkoutDraftRaw=null;draftUiRecovery=null;
}
function resetDraftSessionPresentation(){
  const el=$("#unfinishedBanner");
  if(el){el.classList.add("hidden");el.hidden=true}
  delete document.body.dataset.unfinishedPrompt;
  renderDraftRecovery();
}
/* Ending a session by any route (discard, replace, clear) ends its rest clock with it: a
   running rest belongs to the session it was started in. */
function resetDraftSessionState(){resetWorkoutSessionIdentity();resetDraftSessionPresentation();stopRest()}
async function clearDraft(){
  if(draftUiRecovery?.attempt||draftUiRecovery?.status==="refresh-failed"){
    renderDraftRecovery();focusDraftRecovery();return false}
  if(activeWorkoutDraft){
    const removed=await DraftStore.removeV2({expectedDraftId:activeWorkoutDraft.draftId,
      expectedRevision:activeWorkoutDraft.revision,operationId:`clear-${uid()}`});
    if(removed.status!=="applied"){
      showDraftCommandRecovery(removed.status,null,{focus:draftFocusIdentity(),retryAction:clearDraft});
      return false}}
  else{
    const read=DraftStore.readCanonicalStatus();if(read.status!=="ok")return false;
    const parsed=WorkoutDraft?.parse(read.raw);
    if(parsed?.kind==="valid")return false;
    if(!DraftStore.remove())return false}
  resetDraftSessionState();return true}
const loadDraft=()=>{if(activeWorkoutDraft)return WorkoutSession.projection();
  try{return JSON.parse(DraftStore.readRaw()||"{}")}catch{return{}}};
const posNum=(v,f=0)=>{const n=parseDec(v);return Math.max(0,Number.isFinite(n)?n:f)};
const isWork=r=>!r.warmup;
/* Calendar days from the lifter's previous session to this one, from the
   saved log (Plan 071 §7); null when there is none. A backdated session
   compares only with sessions on or before its own date. */
function daysSinceLastSession(prevLog,date){
  const at=Date.parse(`${date}T00:00:00Z`);
  if(!Number.isFinite(at))return undefined;
  let previous=null;
  for(const row of prevLog||[]){
    if(!isWork(row)||typeof row.date!=="string"||row.date>date)continue;
    if(previous===null||row.date>previous)previous=row.date}
  if(previous===null)return null;
  const days=Math.round((at-Date.parse(`${previous}T00:00:00Z`))/86400000);
  return Number.isSafeInteger(days)&&days>=0?days:undefined}





const exerciseLabel=row=>String(row?.name||row?.performedName||"");
const displayName=row=>loggedMovementName(row);
const currentExerciseForLiftKey=key=>(state.program||[]).find(ex=>exerciseLiftKey(ex)===key)||null;
const PER_SIDE_LOAD_SEMANTICS=new Set(["loadPerSideKg","persistentLoadPerSideKg"]);



/** Read-time workout projection shared by History, Progress, exercise charts and CSV.
 *  It never mutates the saved row; null per-side context stays unknown instead
 *  of becoming an assumed multiplier. */
function readLogRow(...args){return workoutQueries().readLogRow(...args)}
function readLogRows(log=state.log){return workoutQueries().readLogRows(log)}
/* Search-only bridge from a logged row back to what the program calls that
   movement today. History itself never renames what was performed — the row
   keeps its immutable label — but a lifter who renamed a movement still looks
   for old sessions under the new name. Only movement identity crosses:
   `library:<id>`, or the `movement:` id a slot mints and gives up the moment
   the slot is repointed at something else. The structural slot id never does,
   so a replaced slot cannot pull the previous movement's history along. */
function currentMovementNames(){
  const byKey=new Map();
  for(const ex of state.program||[]){
    const key=exerciseLiftKey(ex);
    if(!key||key.startsWith("name:"))continue;
    const name=String(ex?.name||"").trim();
    if(name&&!byKey.has(key))byKey.set(key,name)}
  return byKey}
const currentNameForRow=(row,byKey)=>
  row?.performedLibraryId||row?.performedMovementId?byKey.get(liftKey(row))||"":"";
function exerciseIdentityFromRow(row){
  return{libraryId:row?.performedLibraryId||undefined,movementId:row?.performedMovementId||undefined,
    name:loggedMovementName(row),id:row?.exerciseId,day:row?.day}}
// Muscles for a log row: prefer the immutable performed snapshot. Old rows may
// fall back to their own template snapshot/name, never a reused live slot id.
const rowMuscles=row=>loggedMuscleAttribution(row,state.program);

/* There is no bundled starter program. A device that has never been through
   onboarding holds no program at all: the entry hub is the only thing that
   mints one, and until it does, Today says so rather than offering somebody
   else's training as if the lifter had chosen it. */

/* The single crossing from library entry to program template. Muscles and
   setup notes are copied rather than looked up through libraryId, so the audit
   and every other reader keep reading the template exactly as before — and the
   lifter stays free to edit any of it afterwards without detaching the slot. */
const SOURCE_FEATURE_TO_LEGACY_MUSCLE=Object.freeze({
  "chest":"Chest","lats":"Lats","upper back":"Mid/upper back","upper traps":"Traps",
  "front delts":"Front delts","side delts":"Side delts","rear delts":"Rear delts",
  "biceps":"Biceps","triceps":"Triceps","forearms":"Forearms","quads":"Quads",
  "hamstrings":"Hamstrings","glutes":"Glutes","adductors":"Adductors","abductors":"Abductors",
  "calves":"Calves","tibs":"Tibs","hip flexors":"Hip flexors","lower back":"Spinal erectors",
  "neck":"Neck","serratus":"Serratus","abs":"Abs","obliques":"Obliques",
});
function sourceFeatureAttribution(...args){return TrainingModel.sourceFeatureAttribution(...args)}
function libraryMuscleAttribution(...args){return TrainingModel.libraryMuscleAttribution(...args)}
function exerciseFieldsFromLibrary(...args){return TrainingModel.exerciseFieldsFromLibrary(...args)}

/* The compiler owns the custom-definition schema. Device state carries more
   (archive flag, patterns, timestamps), so project exactly its keys; a custom
   movement without a configured composition has an empty one. */
function compilerCustomDefinitions(...args){return TrainingModel.compilerCustomDefinitions(...args)}
function canonicalProgramDefinition(value,customDefinitions=customExercises()){return TrainingModel.canonicalProgramDefinition(value,customDefinitions)}
/* Every movement a canonical definition names: each slot's own and its
   alternates. A custom movement that is only an alternate is still part of the
   program, so it travels, stays in use and is never deleted out from under it. */
/* A movement outside the catalog carries the lifter's own muscle labels. An
   empty label is no attribution, not an invalid one. */
function manualAttributionFor(...args){return TrainingModel.manualAttributionFor(...args)}
function manualProgramDefinitionFromRows(rows,dayNames=[],customDefinitions=customExercises()){return TrainingModel.manualProgramDefinitionFromRows(rows,dayNames,customDefinitions)}
/* Durable program rows are stored exactly as an accepted snapshot normalizes
   them, so the lock-held program fingerprint of the stored head matches the
   in-memory state for the rest of the session. */
function durableProgramRows(...args){return TrainingModel.durableProgramRows(...args)}
function flatProgramFromDefinition(definition,customDefinitions=customExercises(),cycleNumber=1){return TrainingModel.flatProgramFromDefinition(definition,customDefinitions,cycleNumber)}

function normalizeProgressionEnvelope(...args){return TrainingModel.normalizeProgressionEnvelope(...args)}
function progressionIncompatibility(...args){return TrainingModel.progressionIncompatibility(...args)}
function normalizeProgressionRelations(...args){return TrainingModel.normalizeProgressionRelations(...args)}
function candidateProgressionData(...args){return TrainingModel.candidateProgressionData(...args)}
function normalizeProgressionModifiers(...args){return TrainingModel.normalizeProgressionModifiers(...args)}

/* =====================================================   Program model
   Exercise — one movement: day, sequence, rep range, muscles.
   Program — the whole split. Single source of truth for editing,
   ordering, day grouping, and the weekly volume audit. Persisted
   as plain objects (see toJSON) so backups stay forward-compatible.
   ============================================================ */




/* Family-slot vocabulary belonged to the retired family generator. Canonical
   ProgramDefinitions carry their own ordered slots; keep this empty value only
   for old display-only paths that still ask for a day type during migration. */
const DAY_TYPES=Object.freeze({});
/* Generated native exercise data is the single search/catalog identity source. */
const LIBRARY_BY_ID=new Map(EXERCISE_LIBRARY.map(e=>[e.id,e]));
const SHARED_BUILT_IN_IDS=new Set(EXERCISE_LIBRARY.map(e=>e.id));
const SharedSetup=createSetupLinkCodec({metrics:ExerciseMetrics,identity:generationRules.identity,
  capabilities:{TextEncoder,TextDecoder,CompressionStream:window.CompressionStream,DecompressionStream:window.DecompressionStream,
    Blob,atob,btoa,document,location:window.location}});
/* #353: generation and Review regeneration run in the program engine's worker,
   which loads exactly the compiler, transition and catalog scripts this page
   did; without a worker the engine runs the same code on this thread. Created
   on first use, so a lifter who never generates never starts a worker. */
let programEngineInstance=null;
function createProgramEngineInstance(){
  const pin=EXERCISE_CATALOG_SHA256;
  return createProgramExecutor({compiler:ProgramCompiler,transition:generationRules.transition,catalog:()=>rawExerciseCatalog,
    WorkerConstructor:window.Worker,worker:typeof pin==="string"?{url:programWorkerUrl,catalogUrl:CATALOG_URL,catalogSha256:pin}:null})}
function programEngine(){return programEngineInstance||(programEngineInstance=createProgramEngineInstance())}
if(typeof window!=="undefined")Object.defineProperty(window,"__repforgeProgramEngine",{configurable:true,get:programEngine});

/* Custom exercises a lifter created. They live in state so they survive across
   programs and show up in every picker beside the built-ins; the "custom:"
   prefix keeps their ids from ever colliding with a library id, including a
   library id added by a future regeneration. */
const CUSTOM_ID_PREFIX="custom:";
const isCustomLibraryId=id=>String(id||"").startsWith(CUSTOM_ID_PREFIX);
function customExercises(snapshot=state){
  const list=snapshot?.customExercises;
  return Array.isArray(list)?list:[]}
/* Ids merged into a single entry still sit in saved programs; resolve through
   the alias table before giving up on one. */
function libraryEntry(id,snapshot=state){
  if(id==null)return null;
  const key=String(id);
  if(isCustomLibraryId(key))return customExercises(snapshot).find(e=>e.id===key)||null;
  return LIBRARY_BY_ID.get(key)||null}
/* Everything a picker can offer: the lifter's own movements first, because a
   custom entry exists precisely because the library did not have it. */
function pickableExercises(snapshot=state){
  return customExercises(snapshot).filter(e=>!e.archived).concat(EXERCISE_LIBRARY)}
const libraryName=e=>!e?"":(isPt()&&e.namePt)||e.name;
/* Display-only localisation of a stored exercise name (RF-10). In Portuguese, a
   movement that resolves to a library entry through the id the app already keeps
   for it, and whose stored name is still exactly that entry's English name, reads
   as the entry's Portuguese name. That includes a custom entry that carries a
   namePt: Exercise.resolveIdentity already shows a linked custom slot under it,
   so every other surface must agree (R7 J-07). A renamed exercise, an unlinked
   one and every other language keep the stored text. Nothing here is
   ever written: storage, setup links, telemetry, lift keys, sort and match keys
   all keep the stored name. */
const MovementLabels=createExerciseLabels({builtIns:LIBRARY_BY_ID,readCustom:customExercises,language:uiLang});
const localizedMovementName=MovementLabels.movementName,exerciseDisplayName=MovementLabels.exercise,liftDisplayName=MovementLabels.lift;
function resolveSplit(daysPerWeek,splitType){
  const n=Math.max(1,Math.min(7,Math.round(+daysPerWeek)||3)),st=splitType||"full_body";
  if(st==="full_body"||st==="machine_only")return Array.from({length:n},()=>"full_body");
  if(st==="upper_lower")return Array.from({length:n},(_,i)=>i%2?"lower":"upper");
  if(st==="ppl"){const c=["push","pull","legs"];return Array.from({length:n},(_,i)=>c[i%3]);}
  if(st==="bro"){const c=n<=3?["push","pull","legs"]:n===4?["push","pull","legs","upper"]:["push","pull","legs","push","pull","legs"];
    return Array.from({length:n},(_,i)=>c[i%c.length]);}
  return Array.from({length:n},()=>"full_body")}
function exerciseSlotsForDay(dayType,answers){return[...(DAY_TYPES[dayType]||DAY_TYPES.full_body)]}
function catalogForSlot(slot,equipment,experience){
  const eq=new Set((equipment||[]).map(s=>String(s).toLowerCase()));
  let pool=EXERCISE_LIBRARY.filter(e=>e.patterns.includes(slot));
  if(eq.size)pool=pool.filter(e=>e.equipment.some(x=>eq.has(String(x).toLowerCase())));
  if(experience==="beginner"){const bf=pool.filter(e=>e.beginnerFriendly);if(bf.length)pool=bf}
  // Rank first, id second: the staple for a slot leads, and the rest stay in a
  // stable order so the same answers keep generating the same program.
  return pool.sort((a,b)=>(a.rank??50)-(b.rank??50)||a.id.localeCompare(b.id))}
function rotateCatalog(pool,occurrence){
  if(!pool.length)return pool;
  const n=pool.length,i=((occurrence%n)+n)%n;
  return i?pool.slice(i).concat(pool.slice(0,i)):pool}
function chooseExercise(slot,equipment,experience,usedIds,occurrence){
  // Rotate the equipment-filtered pool across repeated day types; never reuse a within-day id.
  const pool=rotateCatalog(catalogForSlot(slot,equipment,experience),occurrence||0).filter(e=>!usedIds.has(e.id));
  return pool[0]||null}
/* Whether a day type is worth generating on this equipment. One fillable slot
   used to be enough, which was fine when the catalogue was small: a slot with
   no candidates meant the equipment genuinely could not train that pattern. A
   267-movement library finds a candidate for almost anything — cables alone
   satisfy a lower day through pull-throughs and calf raises — so "any slot" now
   waves through days nobody would want to train. Require enough of the day to
   fill instead, and the wizard keeps steering people to equipment that can
   actually carry the split. */
function dayTypeHasPrimary(dayType,equipment,experience){
  const slots=exerciseSlotsForDay(dayType);
  if(!slots.length)return false;
  const fillable=slots.filter(slot=>catalogForSlot(slot,equipment,experience).length>0).length;
  return fillable*2>=slots.length}
function equipmentSupportsSplit(daysPerWeek,splitType,equipment,experience){
  return resolveSplit(daysPerWeek,splitType).every(dt=>dayTypeHasPrimary(dt,equipment,experience))}
function muscleHit(ex,muscle){const m=muscle.toLowerCase();
  return muscles(ex.primary).concat(muscles(ex.secondary)).some(x=>x.toLowerCase()===m||x.toLowerCase().includes(m))}
// `state` is a read-only alias to the exact owner-published snapshot. All
// candidates are local values until the durable owner accepts or boot reads them.
let state,prog,day,saving=false;
const applicationSession=createSession({
  initialSnapshot:/** @type {import('./src/app/session.js').Snapshot|null} */(null),
  onUpdate:snapshot=>{state=snapshot}});
function publishTrainingSnapshot(snapshot){
  const next=cloneSnapshot(snapshot);
  const projected=makeProgram(next.program,snapshotLookup(next.customExercises),next.programMeta);
  next.program=projected.toJSON();
  applicationSession.publish(next);
  prog=projected;
}
let activeRecoveryRecord=null,activeRecoveryRecordBlockId=null;
const focusRest=Focus.createRestClock({window});
const FocusPresentation=Focus.createFocusPresentation({window,focus:focusUi,clock:focusRest,
  training:{manualLoadCarry:WorkoutDraft.manualLoadCarry},readSettings:()=>state.settings,labels:MovementLabels,
  readDefaultRest:()=>normalizeRestSec(state?.settings?.restSec),copy:{t,plural:tp,language:uiLang,term},motion:{playBeat}});
const {format:FocusFormat,metrics:workoutMetricDisplay,values:FocusValues,effort:FocusEffort,
  rest:RestPresentation,prescription:FocusPrescription,shelf:FocusShelf}=FocusPresentation;
const WhyPresentation=Focus.createWhyPresentation({presentation:FocusPresentation,copy:{t,language:uiLang}});
// focusRest.paused holds the milliseconds left while the clock is held (null while it
// runs); focusRest.length is the length the current or next rest is armed at.

// A tap on a shelf field brings the field pads back for the rest of this rest;
// the next rest starts with the rest controls again. Transient, never stored.

// True from the set commit that starts a rest until the render that draws it: that render owns the swap
// into the cue slot, so the clock's own repaint leaves the slot's structure alone in between.
function announceRestDone(){
  if(focusRest.announced)return;
  focusRest.announced=true;
  const el=$("#restAnnounce");if(!el)return;
  el.textContent="";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{el.textContent=t("rest.complete")}))}
let unfinishedTimer=null;
let lastCommitAt=0;             // module-level; hydrated from draft at boot
// When the first set of the open session landed. Only ever used to tell the
// lifter how long the session ran, so a resumed draft keeps the original stamp
// and a session that spans a reload still reads as one stretch of work.
let sessionStartedAt=0;         // module-level; hydrated from draft at boot
const UNFINISHED_MS=15*60*1000;

function clearUnfinishedWatch(){
  if(unfinishedTimer){clearTimeout(unfinishedTimer); unfinishedTimer=null}
  if(Notifications) Notifications.closeTag("repforge-unfinished");
}

function armUnfinishedWatch(delayMs=UNFINISHED_MS){
  clearUnfinishedWatch();
  if(!Notifications.enabledFor(state.settings,"unfinished")) return;
  unfinishedTimer=setTimeout(onUnfinishedIdle, Math.max(0,delayMs));
}

// Single-reminder guarantee: remember which commit timestamp we already
// prompted for (in repforge_notify_v1), so reopening the app or receiving
// the OS notification does not produce repeat prompts for the same session.
function unfinishedAlreadyPrompted(){
  return loadNotifyMeta().unfinishedPromptedFor===lastCommitAt;
}
function markUnfinishedPrompted(){
  const m=loadNotifyMeta(); m.unfinishedPromptedFor=lastCommitAt; saveNotifyMeta(m);
}

function showUnfinishedPrompt(){
  markUnfinishedPrompted();
  document.body.dataset.unfinishedPrompt="1";
  const el=$("#unfinishedBanner");
  if(!el) return;
  el.classList.remove("hidden");
  el.hidden=false;
  const d=$("#unfinishedDismiss");
  if(d) d.onclick=()=>{ el.classList.add("hidden"); el.hidden=true; };
}

function onUnfinishedIdle(){
  unfinishedTimer=null;
  const draft=loadDraft();
  if(!(draft.__done||[]).length) return;
  if(!Notifications.enabledFor(state.settings,"unfinished")) return;
  if(unfinishedAlreadyPrompted()) return;
  if(document.visibilityState==="visible") showUnfinishedPrompt();
  else Notifications.fireOS({title:t("notify.title"),body:t("notify.unfinished.body"),tag:"repforge-unfinished",url:"./"}).then(ok=>{if(ok)markUnfinishedPrompted()});
}

function maybeUnfinishedOnOpen(){
  const draft=loadDraft();
  lastCommitAt=+draft.__lastCommitAt||0;   // hydrate module state from draft
  if(!Notifications.enabledFor(state.settings,"unfinished")) return;
  const done=(draft.__done||[]).length;
  if(!done||!lastCommitAt) return;
  if(unfinishedAlreadyPrompted()) return;  // single reminder per session
  const elapsed=Date.now()-lastCommitAt;
  if(elapsed>=UNFINISHED_MS) showUnfinishedPrompt();
  else armUnfinishedWatch(UNFINISHED_MS-elapsed);
}
const skipped=new Set();

/* Which library definition a swap pointed at, when it came from the picker.
   The name alone cannot say what was trained: swapping a hack squat slot to a
   lat pulldown has to move the volume too. Kept beside `substituted` rather
   than folded into it so old drafts (name-only) still hydrate. */

const committed=new Set();
const touched=new Set();
const warmups=new Set();
let contextTouched={day:false,date:false,sessionNotes:false,bodyweight:false};
const DRAFT_RECOVERY=`${DRAFT}:recovery`,draftTabId=uid();
let activeWorkoutDraft=null,activeWorkoutDraftRaw=null,workoutDraftRecovery=null;
let draftUiRecovery=null;
let draftWriteTail=Promise.resolve();
async function drainDraftWork(){
  for(;;){
    const writes=draftWriteTail;
    await writes;await workoutSuggestions.flush();
    if(writes===draftWriteTail)return;
  }}
function workoutDayId(label){return workoutDayIdForSnapshot(state,label)}
function metricLoading(...args){return workoutQueries().metricLoading(...args)}
function catalogExecutionMode(...args){return workoutQueries().catalogExecutionMode(...args)}
function executionModeForSlot(...args){return workoutQueries().executionModeForSlot(...args)}
/* Plan 069 S4: which editor slots may offer "Suggest loads", and which need
   the lifter's execution mode first. The engine's compositions decide support;
   custom movements stay manual (R1), unsupported compositions too (R2). */
function slotLoadingProjection(...args){return workoutQueries().slotLoadingProjection(...args)}
/* A mid-session swap reprograms the slot's pending sets with the
   replacement's own metric composition. Targets carry over only for metrics
   both movements share; the rest stay for the lifter to enter. A custom
   movement has no catalog row, so its composition comes from the movement's
   own metricIds/metricDefinitions (set by the "metric composition" editor
   intent) rather than from the static catalog. One created mid-session has
   no composition yet, so it records what the slot already records. Only when
   the slot records nothing either is there nothing to program: that case
   returns the "unconfigured" sentinel (null means "not a metric swap"). */
function substitutionProgram(id,libraryRef){
  const draftExercise=activeWorkoutDraft?.exercises?.[id];
  if(!draftExercise?.programmed?.metricOrigin||!libraryRef)return null;
  const custom=isCustomLibraryId(libraryRef)?libraryEntry(libraryRef):null;
  const source=custom||rawExercise(libraryRef);
  if(!source)return null;
  const slotMetrics=draftExercise.sets?.[draftExercise.setOrder?.[0]]?.programmed?.metrics;
  const metricDefinitions=!custom?rawMetricDefinitions(libraryRef)
    :Array.isArray(custom.metricDefinitions)&&custom.metricDefinitions.length?custom.metricDefinitions
    :Array.isArray(slotMetrics)?slotMetrics.map(cloneSnapshot):[];
  if(!metricDefinitions)return null;
  if(custom&&!metricDefinitions.length)return"unconfigured";
  const{loadingModel,loadingConvention,loadingContext}=metricLoading(metricDefinitions,source);
  const semantics=new Set(metricDefinitions.map(metric=>metric.semantic));
  const programmedSets=draftExercise.setOrder.map(setId=>{
    const programmed=draftExercise.sets[setId].programmed;
    const targets=Object.fromEntries(Object.entries(programmed.targets||{}).filter(([semantic])=>semantics.has(semantic)));
    const repTarget=targets.reps??targets.repsPerSide,reps=Number.isSafeInteger(repTarget?.min??repTarget);
    return{metricDefinitions,targets,restSeconds:programmed.restSeconds??null,targetRir:programmed.targetRir??null,
      minReps:reps?repTarget?.min??repTarget:null,maxReps:reps?repTarget?.max??repTarget:null,
      suggestedReps:reps?repTarget?.min??repTarget:null,previousMetrics:[]}});
  return{sourceLibraryId:libraryRef,metricOrigin:custom?"user_defined":"source_catalog",
    metricIds:metricDefinitions.map(metric=>metric.id),
    metricDefinitions,loadingModel,loadingConvention,loadingContext:{loadingConvention,bodyweightKg:null,...loadingContext},
    equipmentId:null,programmedSets}}
function workoutProgramContext(label=day){
  const slots=exercises(label),empty={};
  const definition=state.programMeta?.programDefinition,cycleNumber=mesocycleLifecycle(state.programMeta).current||1;
  const canonicalDays=new Map((definition?.days||[]).map(item=>[item.name,item]));
  const context={
    programId:String(state.programMeta?.id||"local-program"),
    programFingerprint:workoutProgramFingerprint(state),
    durableRevision:readRevision(state),
    dayId:workoutDayId(label),dayLabel:label,scheduleDate:today(),
    unit:state.settings.unit==="lb"?"lb":"kg",rirMode:isEffortMode()?"effort":"numeric",
    exercises:slots.map((ex,index)=>{const rec=recommendation(ex),prev=last(ex);
      const canonicalDay=canonicalDays.get(ex.day),canonicalSlot=canonicalDay?.slots?.find(slot=>slot.id===(ex.slotId||ex.id));
      const cycle=canonicalSlot?.prescriptionsByCycle?.find(item=>item.cycleIndex===cycleNumber);
      const metricDefinitions=canonicalSlot?.metricDefinitions||rawMetricDefinitions(ex.libraryId)||null;
      const metricOrigin=canonicalSlot?.metricOrigin||(rawExercise(ex.libraryId)?"source_catalog":"user_defined");
      const{loadingModel,loadingConvention,loadingContext}=metricLoading(metricDefinitions,rawExercise(ex.libraryId),canonicalSlot?.loadingModel);
      const slotProjection=canonicalSlot?slotLoadingProjection(canonicalSlot):null;
      if(slotProjection)loadingContext.externalLoadMultiplier=slotProjection.externalLoadMultiplier;
      // Each new row of an ambiguous per-side movement keeps the lifter's explicit mode (#382).
      if(slotProjection?.executionMode&&InstalledEditor.rules.editorSuggestLoadsPolicy.executionModeQuestion(canonicalSlot))
        loadingContext.executionMode=slotProjection.executionMode;
      const programmedSets=cycle?cycle.sets.map((prescription,i)=>{
        const old=prev.find(row=>row.set===i+1),repTarget=prescription.targets?.reps??prescription.targets?.repsPerSide;
        return{suggestedLoad:null,suggestedReps:repTarget?.min??repTarget??null,targetRir:prescription.rir,
          suggestedEffort:prescription.rir==null?null:effortForRir(prescription.rir),
          minReps:repTarget?.min??repTarget??ex.min,maxReps:repTarget?.max??repTarget??ex.max,
          metricDefinitions,targets:cloneSnapshot(prescription.targets||{}),restSeconds:prescription.restSeconds,
          role:prescription.status==="configuration_required"?"configuration_required":"working",
          previousMetrics:old?.metricValues||old?.metrics||[]}}):
        Array.from({length:ex.sets},(_,i)=>{const n=i+1,old=prev.find(row=>row.set===n),sg=setSuggestion(ex,n,rec,empty,old);
          return{suggestedLoad:sg.load??null,suggestedReps:sg.reps??ex.min,targetRir:old?.rir??1,
            suggestedEffort:effortForRir(old?.rir??1),minReps:ex.min,maxReps:ex.max,
            metricDefinitions,targets:{}}});
      return{legacyExerciseId:ex.id,exerciseInstanceId:ex.id,
        sourceExerciseId:String(ex.slotId||ex.libraryId||ex.movementId||ex.id),
        libraryId:ex.libraryId, movementId:ex.movementId,displayName:ex.name,sets:ex.sets,
        setIds:Array.from({length:ex.sets},(_,i)=>`set-${i+1}`),minReps:ex.min,maxReps:ex.max,
        targetRir:1,notes:ex.notes||"",primary:ex.primary||"",secondary:ex.secondary||"",
        progressionStrategy:strategyIdFor(ex),movementPattern:ex.loadingMode||null,
        metricDefinitions,metricOrigin,loadingModel,loadingConvention,loadingContext,
        sourceFingerprint:workoutProgramFingerprint({programMeta:{id:ex.id},program:[ex]}),programmedSets,index}})
  };
  if(Object.prototype.hasOwnProperty.call(state.programMeta||{},"blockId"))context.blockId=state.programMeta.blockId;
  return context
}
function workoutParseContext(label=day){return workoutParseContextForSnapshot(state,label)}
function displayDraftText(field,value){
  if(value==null)return value;
  if(field!=="load"&&field!=="bodyweight")return value;
  if(!/^\d+(?:\.\d+)?$/.test(String(value))||!(+value>0))return value;
  return fmtPlain(toDisplay(+value))}
/* A metric-backed set keeps its values under edited.metrics. The ledger,
   summaries and legacy readers see its load (any kg metric) and reps through
   the same projected fields a flat set uses. */
/* A DraftV2 set's programmed metric composition ({id, semantic, ...}). */
const draftSetMetrics=set=>Array.isArray(set?.programmed?.metrics)?set.programmed.metrics:[];
const METRIC_FIELD_SEMANTICS=Focus.FIELD_SEMANTICS;
function metricFieldValue(set,field){
  const semantics=METRIC_FIELD_SEMANTICS[field],definitions=draftSetMetrics(set);
  if(!semantics||!Array.isArray(definitions))return null;
  const metric=definitions.find(item=>semantics.includes(item?.semantic));
  const value=metric?set.edited?.metrics?.[metric.id]:null;
  return value==null||value===""?null:value}
function workoutDraftProjection(draft=activeWorkoutDraft){
  if(!draft)return{};
  const out={__day:draft.program.dayLabel,__date:draft.program.scheduleDate,
    __sessionNotes:draft.session.notes,__bodyweight:displayDraftText("bodyweight",draft.session.bodyweight),
    __done:[],__touched:[],__warm:[],__skipped:[],__substituted:{},__substitutedRef:{},__exnotes:{},
    __contextTouched:{day:!!draft.session.contextTouched?.day,date:!!draft.session.contextTouched?.date,
      sessionNotes:!!draft.session.contextTouched?.sessionNotes,bodyweight:!!draft.session.contextTouched?.bodyweight},
    __startedAt:Date.parse(draft.session.startedAt)||0,__selectedExerciseId:draft.session.selectedExerciseId};
  for(const exId of draft.exerciseOrder){const ex=draft.exercises[exId];
    if(ex.status==="skipped")out.__skipped.push(exId);
    if(ex.substitution){out.__substituted[exId]=ex.substitution.replacement.displayName;
      if(ex.substitution.replacement.libraryId)out.__substitutedRef[exId]=ex.substitution.replacement.libraryId}
    out.__exnotes[exId]=ex.setupNotes;
    for(const setId of ex.setOrder){const set=ex.sets[setId],key=`${exId}_${set.ordinal}`;
      // A metric-backed set's own metrics are its load and reps; a flat field
      // it still carries is a stale projection.
      for(const field of ["load","reps","rir","effort"]){const fromMetric=draftSetMetrics(set).length&&METRIC_FIELD_SEMANTICS[field];
        const value=fromMetric?metricFieldValue(set,field):set.edited[field];
        if(value!=null)out[`${key}_${field}`]=displayDraftText(field,value)}
      if(set.completion!=="pending"){out.__done.push(key);out.__lastCommitAt=Math.max(out.__lastCommitAt||0,Date.parse(set.completion.completedAt)||0)}
      if(draftSetTouched(set))out.__touched.push(key);
      if(set.role==="warmup")out.__warm.push(key)}}
  return out}
function draftTargetFromKey(key){return Focus.selectDraftTarget(activeWorkoutDraft,key)}
function canonicalDraftField(field,value){return PersistenceMetrics.canonicalDraftField(field,value,state.settings.unit)}
function canonicalDraftBodyweight(value){const raw=String(value??"");
  if(!raw.trim())return"";const parsed=parseOptionalBodyweightDisplay(raw);
  return parsed.field?raw:canonicalNumberText(fromDisplay(raw))}
function draftWriter(operationId){return{installationId:DurableState.getJournalWriterId(),tabId:draftTabId,operationId}}
function migrationSubstitutionResolutions(legacy,context,migratedAt){
  const out={},subs=isPlainStateObject(legacy.__substituted)?legacy.__substituted:{},refs=isPlainStateObject(legacy.__substitutedRef)?legacy.__substitutedRef:{};
  const byName=new Map();for(const entry of pickableExercises())for(const label of[entry.name,entry.namePt,libraryName(entry)]){
    const token=movementToken(label);if(!token)continue;if(!byName.has(token))byName.set(token,entry);else if(byName.get(token)?.id!==entry.id)byName.set(token,null)}
  for(const [exId,rawName]of Object.entries(subs)){const name=String(rawName||"").trim(),ref=refs[exId]??null;
    const entry=ref?libraryEntry(ref):byName.get(movementToken(name));
    const replacement=entry?{exerciseInstanceId:`replacement:${entry.id}`,sourceExerciseId:entry.id,libraryId:entry.id,
      displayName:name||libraryName(entry),primary:libraryMuscleAttribution(entry,"primary"),secondary:libraryMuscleAttribution(entry,"secondary")}
      :{exerciseInstanceId:`replacement:${exId}`,sourceExerciseId:`adhoc:${movementToken(name)}`,
        movementId:`adhoc:${movementToken(name)}`,displayName:name,primary:"",secondary:""};
    out[exId]={legacyName:rawName,legacyRef:ref,replacement,selectedAt:migratedAt}}
  return out}
function workoutMigrationSnapshot(legacy,label){
  const now=new Date().toISOString(),context=workoutProgramContext(label),values={};
  for(const key of Object.keys(legacy)){
    if(/_load$/.test(key))values[key]=canonicalDraftField("load",legacy[key]);
    else if(/_reps$/.test(key))values[key]=canonicalDraftField("reps",legacy[key]);
    else if(/_rir$/.test(key))values[key]=canonicalDraftField("rir",legacy[key]);
    else if(/_effort$/.test(key))values[key]=String(legacy[key]??"");
    else if(key==="__bodyweight")values[key]=canonicalDraftBodyweight(legacy[key])}
  return{programContext:context,sessionSelection:{draftId:`workout-${uid()}`,writer:draftWriter(`migrate-${uid()}`),
    startedAt:now,updatedAt:now,scheduleDate:today(),selectedExerciseId:context.exercises[0]?.exerciseInstanceId??null,
    bodyweight:null,notes:""},previousSessionFacts:Object.fromEntries(context.exercises.map(source=>{const ex=exercises(label).find(item=>item.id===source.exerciseInstanceId);
      return[source.exerciseInstanceId,{exerciseInstanceId:source.exerciseInstanceId,setupNotes:ex?lastExerciseNote(ex):"",sets:ex?last(ex):[]}]})),
    valueResolutions:values,substitutionResolutions:migrationSubstitutionResolutions(legacy,context,now),migratedAt:now,completedAt:now}}
function storeDraftRecovery(raw,reason){workoutDraftRecovery={raw,reason};
  try{localStorage.setItem(DRAFT_RECOVERY,JSON.stringify({version:1,reason,raw}))}catch{}}
async function reconcileV2Checkpoint(read,label){
  return DurableState.reconcileV2Checkpoint(read,label)}
async function initializeWorkoutDraft({restoreDay=false}={}){
  if(!WorkoutDraft)return{status:"module-unavailable"};
  let read=DraftStore.readCanonicalStatus();if(read.status!=="ok")return read;
  const initial=WorkoutDraft.parse(read.raw),checkpointLabel=initial.kind==="valid"?initial.draft.program.dayLabel:day;
  if(initial.kind==="valid"){
    // A pristine draft holds no lifter input, so a changed program replaces it
    // silently the way a day switch replaces an untouched draft. This runs
    // before checkpoint reconciliation because reconciling a stale program
    // binding already reports recovery; anything the lifter typed, or a lost
    // removal race, keeps the explicit recovery surface below.
    const early=WorkoutDraft.parse(read.raw,workoutParseContext(initial.draft.program.dayLabel));
    if(early.kind==="stale"&&isDisposableDraft(early.draft)){
      const dropped=await DraftStore.removeV2({expectedDraftId:early.draft.draftId,
        expectedRevision:early.draft.revision,operationId:`stale-pristine-${uid()}`});
      if(dropped.status==="applied"){activeWorkoutDraft=null;activeWorkoutDraftRaw=null;return{status:"absent"}}}}
  read=await reconcileV2Checkpoint(read,checkpointLabel);
  if(read.status!=="ok")return read;
  let parsed=WorkoutDraft.parse(read.raw);
  if(parsed.kind==="legacy"){
    const legacy=parsed.raw,label=restoreDay&&typeof legacy.__day==="string"&&days().includes(legacy.__day)?legacy.__day:day;
    if(restoreDay)day=label;
    const migrated=WorkoutDraft.migrateLegacy(legacy,workoutMigrationSnapshot(legacy,label));
    if(migrated?.kind==="migration-error"){storeDraftRecovery(read.raw,migrated.code);return{status:"migration-error",error:migrated,raw:read.raw}}
    const nextRaw=JSON.stringify(WorkoutDraft.serialize(migrated));
    const installed=await DraftStore.compareAndSwapV2({expectedRaw:read.raw,nextRaw,operationId:migrated.writer.operationId});
    if(installed.status!=="applied")return installed;
    parsed={kind:"valid",draft:installed.draft};activeWorkoutDraftRaw=installed.raw;read={status:"ok",raw:installed.raw}}
  if(parsed.kind==="valid"){
    const context=workoutParseContext(parsed.draft.program.dayLabel);
    let checked=WorkoutDraft.parse(read.raw,context);
    if(checked.kind==="stale"&&checked.reason==="durableRevision"){
      // Settings, history, and other non-program writes advance the aggregate
      // revision without changing the program that this draft belongs to.
      // Rebind that bookkeeping boundary in memory; the fingerprint and day
      // checks still reject a genuinely changed program.
      const programContext={...context};delete programContext.durableRevision;
      const rebound=WorkoutDraft.parse(read.raw,programContext);
      if(rebound.kind==="valid")checked=rebound}
    if(checked.kind==="stale"&&isDisposableDraft(checked.draft)){
      // A pristine draft holds no lifter input, so a changed program replaces
      // it silently the way a day switch replaces an untouched draft. Anything
      // the lifter typed keeps the explicit recovery surface below; a lost
      // removal race falls through to it as well.
      const dropped=await DraftStore.removeV2({expectedDraftId:checked.draft.draftId,
        expectedRevision:checked.draft.revision,operationId:`stale-pristine-${uid()}`});
      if(dropped.status==="applied"){activeWorkoutDraft=null;activeWorkoutDraftRaw=null;return{status:"absent"}}}
    if(checked.kind!=="valid"){storeDraftRecovery(read.raw,checked.kind==="stale"?`stale-${checked.reason}`:checked.code);return{status:checked.kind,error:checked,raw:read.raw}}
    activeWorkoutDraft=checked.draft;activeWorkoutDraftRaw=read.raw;
    if(restoreDay&&days().includes(activeWorkoutDraft.program.dayLabel))day=activeWorkoutDraft.program.dayLabel;
    return{status:"ready",draft:activeWorkoutDraft}}
  if(parsed.kind==="absent"){activeWorkoutDraft=null;activeWorkoutDraftRaw=null;return{status:"absent"}}
  storeDraftRecovery(read.raw,parsed.code||parsed.kind);return{status:parsed.kind,error:parsed,raw:read.raw}}
async function createWorkoutDraft(label=day,{contextTouched:selectionContextTouched}={}){
  const existing=await initializeWorkoutDraft();if(existing.status==="ready")return existing;
  if(existing.status!=="absent")return existing;
  const now=new Date().toISOString(),context=workoutProgramContext(label),operationId=`create-${uid()}`;
  const draft=WorkoutDraft.create(context,{draftId:`workout-${uid()}`,writer:draftWriter(operationId),startedAt:now,updatedAt:now,
    scheduleDate:today(),selectedExerciseId:context.exercises[0]?.exerciseInstanceId??null,bodyweight:null,notes:"",
    contextTouched:selectionContextTouched},
    Object.fromEntries(context.exercises.map(source=>{const ex=exercises(label).find(item=>item.id===source.exerciseInstanceId);
      return[source.exerciseInstanceId,{exerciseInstanceId:source.exerciseInstanceId,setupNotes:ex?lastExerciseNote(ex):"",sets:ex?last(ex):[]}]})));
  if(WorkoutDraft.isDomainError(draft))return{status:"create-error",error:draft};
  const nextRaw=JSON.stringify(WorkoutDraft.serialize(draft));
  const installed=await DraftStore.compareAndSwapV2({expectedRaw:null,nextRaw,operationId});
  if(installed.status==="applied"){activeWorkoutDraft=installed.draft;activeWorkoutDraftRaw=installed.raw;return{status:"ready",draft:installed.draft}}
  return installed}
function draftFocusIdentity(payload={}){
  const el=document.activeElement;
  if(el instanceof HTMLElement){
    const attribute=["k","effspin","exnote"].find(name=>el.dataset?.[name]!=null);
    if(attribute)return{attribute,value:el.dataset[attribute],start:el.selectionStart??null,end:el.selectionEnd??null};
    if(el.id)return{id:el.id,start:el.selectionStart??null,end:el.selectionEnd??null}}
  if(payload.exerciseInstanceId&&payload.setId&&payload.field){
    const exercise=activeWorkoutDraft?.exercises?.[payload.exerciseInstanceId],set=exercise?.sets?.[payload.setId];
    if(set)return{attribute:"k",value:`${payload.exerciseInstanceId}_${set.ordinal}_${payload.field}`}}
  return null}
function restoreDraftFocus(identity){
  if(!identity)return;
  requestAnimationFrame(()=>{let el=identity.id?document.getElementById(identity.id):null;
    if(!el&&identity.attribute)el=$$(`#workout [data-${identity.attribute}]`).find(item=>item.dataset?.[identity.attribute]===identity.value);
    if(!(el instanceof HTMLElement))return;
    // A shelf input stays out of the tab order and the accessibility tree until its field is open: land on the
    // control the lifter can actually use, not the dormant one (R7 C-01).
    if(el.matches(".shelf__input")&&!el.closest(".shelf__field.is-editing"))el=shelfReveal(el)||el;
    try{el.focus();if(identity.start!=null&&typeof el.setSelectionRange==="function")el.setSelectionRange(identity.start,identity.end??identity.start)}catch{}})}
function draftRecoveryMessageKind(status,initialization=false){
  // A legacy flat draft that cannot migrate against the current program
  // (metric composition, identity, or any other structural mismatch the
  // migrator refuses to guess at) reads the same "earlier program" notice as
  // a stale V2 draft: the lifter's program moved on, and the typed values
  // stay in recovery until they choose export or clear.
  // unmapped-legacy-metric is migrateLegacy's explicit refusal to guess a
  // legacy load/reps value onto an ambiguous metric-backed composition (a
  // per-side or assistance load, a per-side rep count, or a missing metric;
  // see workout-draft.js, issue #332). It is the same "cannot migrate against
  // the current program" situation invalid-migrated-draft already covers.
  if(status==="invalid-migrated-draft"||status==="unmapped-legacy-metric")return"program";
  if(status==="stale")return initialization?"program":"stale";
  if(status==="lock-unavailable"||status==="read-failed"||status==="checkpoint-unreadable"||
    status==="checkpoint-missing"||status==="checkpoint-conflict")return"unavailable";
  if(initialization||status==="invalid"||status==="migration-error"||status==="legacy"||
    String(status||"").includes("recovery"))return"invalid";
  return"persist"}
function renderDraftRecovery(){
  const root=$("#draftRecovery");if(!root)return;
  if(!draftUiRecovery){root.classList.add("hidden");return}
  const kind=draftUiRecovery.kind,title=$("#draftRecoveryTitle"),body=$("#draftRecoveryBody"),pending=$("#draftRecoveryPending");
  root.classList.remove("hidden");
  if(title)title.textContent=t(`draft.recovery.${kind}.title`);
  if(body)body.textContent=t(`draft.recovery.${kind}.body`);
  const pendingValue=draftUiRecovery.pendingValue;
  if(pending){pending.classList.toggle("hidden",pendingValue==null);pending.textContent=pendingValue==null?"":
    t("draft.recovery.pending",{value:pendingValue===""?'""':pendingValue})}
  const configure=(id,show,key,handler)=>{const button=$(id);if(!button)return;button.classList.toggle("hidden",!show);
    button.textContent=show?t(key):"";button.onclick=show?handler:null};
  configure("#draftRecoveryRetry",!!draftUiRecovery.retry,"draft.recovery.retry",retryDraftRecovery);
  configure("#draftRecoveryReload",kind==="stale","draft.recovery.reload",reloadLatestWorkoutDraft);
  configure("#draftRecoveryCopy",draftUiRecovery.copyValue!=null,
    draftUiRecovery.copyKind==="data"?"draft.recovery.copy_data":"draft.recovery.copy_value",copyDraftRecoveryValue);
  configure("#draftRecoveryDiscard",!!draftUiRecovery.discard,"draft.recovery.discard",discardRecoveredWorkoutDraft);
  paintDraftRetryPending()}
/* S1: while a retry's durable write is in flight the banner wears the
   indeterminate hairline (`.motion-hairline.is-pending`), and under reduced
   motion the same fact as a text label. This only reads the retry's own promise
   (`retryDraftRecovery`): no persistence or journal logic changes, no control is
   disabled, and the class comes off the moment that promise settles, whether the
   write was applied or failed. */
let draftRetryPending=0;
function paintDraftRetryPending(){
  const root=$("#draftRecovery");if(!root)return;
  const on=draftRetryPending>0&&!!draftUiRecovery;
  root.classList.toggle("motion-hairline",on);root.classList.toggle("is-pending",on);
  let label=root.querySelector(".motion-hairline__label");
  if(!on){label?.remove();return}
  if(!label){label=document.createElement("p");label.className="motion-hairline__label draft-recovery__saving";
    root.insertBefore(label,root.querySelector(".draft-recovery__actions"))}
  label.textContent=t("custom.saving")}
function focusDraftRecovery(){
  const root=$("#draftRecovery");if(!root)return;
  root.scrollIntoView({block:"start"});root.focus({preventScroll:true})}
function showDraftCommandRecovery(status,attempt,{pendingValue=null,focus=null,retryAction=null}={}){
  draftUiRecovery={kind:draftRecoveryMessageKind(status),status,attempt,pendingValue,
    copyValue:pendingValue,copyKind:"value",focus,retry:status!=="stale",retryAction,discard:false};
  renderDraftRecovery();focusDraftRecovery()}
function showDraftInitializationRecovery(result,{retryMode="initialize",label=day,contextTouched=null}={}){
  // migrateLegacy's specific reason (e.g. invalid-migrated-draft) is the
  // signal the copy map keys off; initializeWorkoutDraft only ever widens it
  // to the generic "migration-error" status, so recover the exact code here.
  const reason=result?.status==="migration-error"?result?.error?.code:result?.status;
  const kind=draftRecoveryMessageKind(reason,true),raw=result?.raw??workoutDraftRecovery?.raw??null,
    parsed=WorkoutDraft?.parse(raw),identity=parsed?.kind==="valid"?
      {draftId:parsed.draft.draftId,revision:parsed.draft.revision}:null;
  // A legacy flat raw has no V2 identity to CAS on; it can still be cleared by
  // its exact raw bytes through DraftStore.removeLegacy (never a fuzzy match,
  // never a guess at which program it belonged to).
  const discardRaw=!identity&&raw!=null&&parsed?.kind!=="valid"?raw:null;
  draftUiRecovery={kind,status:result?.status,attempt:null,pendingValue:null,copyValue:raw,copyKind:"data",
    focus:null,retry:true,retryMode,label,contextTouched,discardIdentity:identity,discardRaw,
    discard:kind==="program"&&(!!identity||!!discardRaw)};
  renderDraftRecovery();focusDraftRecovery()}
function clearDraftUiRecovery(){draftUiRecovery=null;renderDraftRecovery()}
async function copyDraftRecoveryValue(){const value=draftUiRecovery?.copyValue;if(value==null)return false;
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(String(value));toast(t("draft.recovery.copied"));return true}}catch{}
  try{const ta=document.createElement("textarea");ta.value=String(value);ta.setAttribute("readonly","");
    ta.style.cssText="position:fixed;top:0;left:0;opacity:0";document.body.append(ta);ta.select();
    const copied=document.execCommand("copy");ta.remove();if(copied){toast(t("draft.recovery.copied"));return true}}catch{}
  toast(t("draft.recovery.copy_failed"),{assertive:true});return false}
async function applyDraftRetryResult(result,recovery){
  if(result.status==="applied"){activeWorkoutDraft=result.draft;activeWorkoutDraftRaw=result.raw;
    hydrateDraftCollections(WorkoutSession.projection());clearDraftUiRecovery();renderWorkout();restoreDraftFocus(recovery.focus);return result}
  showDraftCommandRecovery(result.status,recovery.attempt,recovery);return result}
function retryDraftRecovery(){
  const recovery=draftUiRecovery;if(!recovery)return Promise.resolve({status:"missing"});
  // Re-reading a draft that could not be read is not a write; every other retry is one.
  if(!recovery.retryAction&&!recovery.attempt&&recovery.retryMode!=="create")return runDraftRetry(recovery);
  draftRetryPending++;paintDraftRetryPending();
  const settled=()=>{draftRetryPending--;paintDraftRetryPending()};
  let run;
  try{run=Promise.resolve(runDraftRetry(recovery))}catch(error){settled();throw error}
  run.then(settled,settled);return run}
function runDraftRetry(recovery){
  if(recovery.retryAction)return Promise.resolve(recovery.retryAction()).then(result=>{
    if(result?.status==="applied"){clearDraftUiRecovery();renderWorkout()}
    else showDraftCommandRecovery(result?.status,null,recovery);return result});
  if(!recovery.attempt){const operation=recovery.retryMode==="create"?WorkoutSession.start(recovery.label,{contextTouched:recovery.contextTouched}):
      initializeWorkoutDraft({restoreDay:true});return operation.then(result=>{
    if(result.status==="ready"){hydrateDraftCollections(WorkoutSession.projection(),{restoreSelection:true});clearDraftUiRecovery();
      if(!workoutActive)setWorkoutActive(true);
      document.body.classList.add("is-focus-wo");
      renderTabs();renderWorkout();renderToday();restoreDraftFocus(recovery.focus)}
    else showDraftInitializationRecovery(result,{retryMode:recovery.retryMode,label:recovery.label,contextTouched:recovery.contextTouched});return result})}
  const task=draftWriteTail.then(()=>DraftStore.compareAndSwapV2(recovery.attempt))
    .then(result=>applyDraftRetryResult(result,recovery));
  draftWriteTail=task.then(()=>undefined,()=>undefined);return task}
async function reloadLatestWorkoutDraft(){
  const recovery=draftUiRecovery,loaded=await initializeWorkoutDraft({restoreDay:true});
  if(loaded.status!=="ready"){showDraftInitializationRecovery(loaded);return loaded}
  hydrateDraftCollections(WorkoutSession.projection(),{restoreSelection:true});clearDraftUiRecovery();renderTabs();renderWorkout();renderToday();
  restoreDraftFocus(recovery?.focus);return loaded}
async function discardRecoveredWorkoutDraft(){
  const recovery=draftUiRecovery,identity=recovery?.discardIdentity,rawToClear=recovery?.discardRaw;
  if(!identity&&!rawToClear)return false;
  if(!confirm(t("confirm.discard_draft")))return false;
  const removed=identity
    ?await DraftStore.removeV2({expectedDraftId:identity.draftId,expectedRevision:identity.revision,
      operationId:`discard-${uid()}`})
    :await DraftStore.removeLegacy({expectedRaw:rawToClear,operationId:`discard-${uid()}`});
  if(removed.status!=="applied"){showDraftInitializationRecovery(removed);return false}
  resetDraftSessionState();clearDraftUiRecovery();renderToday();return true}
/* Alpha trust telemetry for the Workout lifecycle attaches to an applied DraftV2
   command, not to a control, so any logger UI that dispatches through
   WorkoutSession is measured the same way (Q616, Q618). */
/** Q616: a working set matches when its load is within half of the lifter's
 *  minJump of the suggestion. Loads only; draft loads and minJump are canonical kg. */
/* What the adaptive engine recommended for this set. A set's own result reads
   only the sets before it, so it is the same after the set is completed. */
function engineSuggestedLoad(set,exerciseInstanceId){
  const ex=prog?.find?.(exerciseInstanceId);if(!ex)return null;
  const rec=recommendation(ex),item=rec.targetSets?.find(entry=>entry.prescription?.setIndex===set.ordinal);
  if(item?.status!=="recommended")return null;
  const metric=(rec.metricDefinitions||[]).find(entry=>METRIC_FIELD_SEMANTICS.load.includes(entry.semantic));
  const value=metric?item.targets?.[metric.semantic]:null;
  return typeof value==="number"?value:null}
function setVsSuggestion(set,exerciseInstanceId){
  // A metric-backed set's typed load is its load metric, compared with the
  // engine's recommendation rather than the flat history fallback.
  const metricBacked=draftSetMetrics(set).length>0;
  const suggested=metricBacked?engineSuggestedLoad(set,exerciseInstanceId):set?.programmed?.suggestedLoad;
  const load=parseDec(metricBacked?metricFieldValue(set,"load"):set?.edited?.load);
  if(suggested==null||!Number.isFinite(+suggested)||!Number.isFinite(load))return"no_suggestion";
  const delta=load-+suggested,half=(+state.settings.minJump||2.5)/2;
  return Math.abs(delta)<half?"matched":delta>0?"raised":"lowered"}
/* Which working sets this device has already counted in the open draft. An edit
   uncommits a set and commits it again, which must not count twice; the draft
   still records the set as committed until that uncommit, so it is read there. */
let countedWorkingSets={draftId:null,keys:new Set()};
function noteCommittedWorkingSets(draft){
  if(!draft)return;
  if(countedWorkingSets.draftId!==draft.draftId)countedWorkingSets={draftId:draft.draftId,keys:new Set()};
  for(const [exerciseId,exercise] of Object.entries(draft.exercises||{}))
    for(const [setId,set] of Object.entries(exercise?.sets||{}))
      if(set.role!=="warmup"&&set.completion!=="pending")countedWorkingSets.keys.add(`${exerciseId}\u0000${setId}`)}
/* A workout in progress thrown away by the lifter's own choice (Plan 071
   §5.5). The stage says whether a working set had been committed. */
function reportWorkoutDiscarded(draft,cause){
  if(!draft)return;
  const working=Object.values(draft.exercises||{}).some(exercise=>Object.values(exercise?.sets||{})
    .some(set=>set.role!=="warmup"&&set.completion!=="pending"));
  captureEvent("workout_discarded",{stage:working?"working":"before_set",cause})}
function captureDraftCommandTelemetry(command,before,after,ui){
  try{
    noteCommittedWorkingSets(before);
    if(command.type==="completeSet"){
      const set=after?.exercises?.[command.exerciseInstanceId]?.sets?.[command.setId];
      if(set&&set.role!=="warmup"&&!countedWorkingSets.keys.has(`${command.exerciseInstanceId}\u0000${command.setId}`))
        captureEvent("set_saved",{vs_suggestion:setVsSuggestion(set,command.exerciseInstanceId)})}
    noteCommittedWorkingSets(after);
    // Q618: the lifter's own skips only; the bulk "skip flagged" offer opts out.
    if(command.type==="skipExercise"&&ui?.bulk!==true&&before?.exercises?.[command.exerciseInstanceId]?.status!=="skipped")captureEvent("exercise_skipped",{context:"planned_session"});
    // Plan 071 §5.5: where the replacement came from; no reason is asked, so none is sent.
    if(command.type==="substituteExercise"&&(ui?.substitutionSource==="alternate"||ui?.substitutionSource==="library"))
      captureEvent("substitution_used",libraryUi.SUBSTITUTION_REASONS.includes(ui.substitutionReason)
        ?{source:ui.substitutionSource,reason:ui.substitutionReason}:{source:ui.substitutionSource})}
  catch{}}
function enqueueDraftCommand(type,payload={},ui={}){
  const operationId=`draft-${uid()}`;
  const focus=draftFocusIdentity(payload),pendingValue=Object.prototype.hasOwnProperty.call(ui,"pendingValue")?
    String(ui.pendingValue??""):Object.prototype.hasOwnProperty.call(payload,"value")?String(payload.value??""):null;
  const task=draftWriteTail.then(async()=>{
    if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
    if(!activeWorkoutDraft)return{status:"missing"};
    if((draftUiRecovery?.attempt||draftUiRecovery?.status==="refresh-failed")&&!draftUiRecovery.allowRetry){
      renderWorkout();restoreDraftFocus(focus);return{status:"recovery-pending"}}
    if(type==="refreshUntouchedSuggestions"&&window.__repforgeDraftFault==="stale-suggestion-loop")
      return{status:"domain-error",error:{kind:"domain-error",code:"stale-suggestion"}};
    const now=new Date().toISOString(),command={type,...payload,operationId,expectedRevision:activeWorkoutDraft.revision,
      updatedAt:now,writer:draftWriter(operationId)};
    if(type==="completeSet"&&!command.completedAt)command.completedAt=now;
    const before=activeWorkoutDraft,next=WorkoutDraft.reduce(before,command);
    if(WorkoutDraft.isDomainError(next))return{status:"domain-error",error:next};
    if(type==="refreshUntouchedSuggestions"&&next===activeWorkoutDraft)
      return{status:"applied",draft:activeWorkoutDraft,raw:activeWorkoutDraftRaw,noOp:true};
    const nextRaw=JSON.stringify(WorkoutDraft.serialize(next));
    const attempt={expectedDraftId:activeWorkoutDraft.draftId,expectedRevision:activeWorkoutDraft.revision,nextRaw,operationId};
    if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
    if(window.__repforgeDraftFault==="persist-failure"){
      showDraftCommandRecovery("storage-error",attempt,{pendingValue,focus});
      return{status:"storage-error",code:"simulated-persist-failure"};
    }
    const written=await DraftStore.compareAndSwapV2(attempt);
    if(written.status==="applied"){activeWorkoutDraft=written.draft;activeWorkoutDraftRaw=written.raw;
      captureDraftCommandTelemetry(command,before,written.draft,ui);
      hydrateDraftCollections(WorkoutSession.projection());clearDraftUiRecovery()}
    else showDraftCommandRecovery(written.status,attempt,{pendingValue,focus});
    return written});
  const settled=task.then(()=>undefined,()=>undefined);
  draftWriteTail=settled;
  return task}
function knownExerciseIds(){return new Set((state.program||[]).map(e=>e.id))}
function setKeyExerciseId(k){return String(k).replace(/_\d+$/,"")}
function retainSetKeys(list,known){return (list||[]).filter(k=>known.has(setKeyExerciseId(k)))}
function contextFlagsFromDraft(d){
  const flags=d?.schemaVersion===2
    ?d.session?.contextTouched
    :d&&typeof d.__contextTouched==="object"&&d.__contextTouched?d.__contextTouched:{};
  const safe=flags&&typeof flags==="object"?flags:{};
  return {day:!!safe.day,date:!!safe.date,sessionNotes:!!safe.sessionNotes,bodyweight:!!safe.bodyweight}}
function hydrateDraftCollections(d,{restoreSelection=false}={}){
  const known=knownExerciseIds();
  sessionStartedAt=+d.__startedAt||0;
  committed.clear();retainSetKeys(d.__done,known).forEach(k=>committed.add(k));
  touched.clear();retainSetKeys(d.__touched,known).forEach(k=>touched.add(k));
  warmups.clear();retainSetKeys(d.__warm,known).forEach(k=>warmups.add(k));
  skipped.clear();(d.__skipped||[]).forEach(id=>{if(known.has(id))skipped.add(id)});
  if(restoreSelection){const selectedIndex=focusList().findIndex(ex=>ex.id===d.__selectedExerciseId);
    focusUi.index=selectedIndex>=0?selectedIndex:0}
}

function hydrateWorkoutDraft({restoreDay=false,restoreSelection=restoreDay}={}){
  const d=loadDraft();
  hydrateDraftCollections(d,{restoreSelection});
  contextTouched=contextFlagsFromDraft(d);
  if(restoreDay&&typeof d.__day==="string"&&days().includes(d.__day)) day=d.__day;
  return d}
function applyDraftContextToDom(){
  const d=loadDraft(),dateEl=$("#sessionDate"),bwEl=$("#sessionBodyweight"),notesEl=$("#sessionNotes");
  if(dateEl) dateEl.value=Object.prototype.hasOwnProperty.call(d,"__date")?d.__date:today();
  if(bwEl) bwEl.value=Object.prototype.hasOwnProperty.call(d,"__bodyweight")?d.__bodyweight:lastBodyweight();
  if(notesEl) notesEl.value=Object.prototype.hasOwnProperty.call(d,"__sessionNotes")?d.__sessionNotes:"";

}
function resetSessionContextFields(){
  contextTouched={day:false,date:false,sessionNotes:false,bodyweight:false};
  const notesEl=$("#sessionNotes"),dateEl=$("#sessionDate"),bwEl=$("#sessionBodyweight");
  if(notesEl)notesEl.value="";
  if(dateEl)dateEl.value=today();
  if(bwEl)bwEl.value=lastBodyweight();

}
function isDisposableDraft(draft){
  // A stale draft may skip the explicit recovery surface only when replacing
  // it provably loses no lifter input. The domain predicate covers
  // self-contained input; the schedule date, exercise order, and
  // per-exercise notes need current program and history seeds to judge, so
  // they are compared here against their creation values. Any doubt keeps
  // the recovery prompt.
  try{
    if(!WorkoutDraft?.isPristine(draft))return false;
    if(String(draft.program.scheduleDate||"")!==String(draft.session.startedAt||"").slice(0,10))return false;
    if(!draft.exerciseOrder.every((id,index)=>draft.exercises?.[id]?.programmed?.order===index))return false;
    const rows=exercises(draft.program.dayLabel);
    return draft.exerciseOrder.every(id=>{
      const current=rows.find(item=>item.id===id);
      const seed=current?lastExerciseNote(current):"";
      return String(draft.exercises[id]?.setupNotes??"")===String(seed??"")});
  }catch{return false}}
/* A lifter's typed value on a set, in either the flat or the metric shape. */
function draftSetTouched(set){
  return !!(set?.touched?.load||set?.touched?.reps||set?.touched?.effort||
    Object.values(set?.touched?.metrics||{}).some(Boolean))}
function draftHasSessionWork(d){
  d=d||loadDraft();
  if(d?.schemaVersion===2)return d.exerciseOrder.some(exerciseId=>{
    const exercise=d.exercises[exerciseId];
    return exercise.status==="skipped"||!!exercise.substitution||exercise.setupNotes!==exercise.programmed.notes||
      exercise.setOrder.some(setId=>{const set=exercise.sets[setId];return set.completion!=="pending"||set.role==="warmup"||
        draftSetTouched(set)})})||
      d.session.notes!==""||d.session.bodyweight!=null||d.program.scheduleDate!==today()||
      Object.values(contextFlagsFromDraft(d)).some(Boolean);
  if((d.__done||[]).length||(d.__touched||[]).length||(d.__warm||[]).length) return true;
  if((d.__skipped||[]).length) return true;
  if(d.__substituted&&typeof d.__substituted==="object"&&Object.keys(d.__substituted).length) return true;
  const flags=contextFlagsFromDraft(d);
  if(flags.date||flags.sessionNotes||flags.bodyweight) return true;
  if(Object.prototype.hasOwnProperty.call(d,"__sessionNotes")||Object.prototype.hasOwnProperty.call(d,"__bodyweight")||Object.prototype.hasOwnProperty.call(d,"__date")){
    if(flags.date||flags.sessionNotes||flags.bodyweight) return true}
  return Object.keys(d).some(k=>/_load$/.test(k)&&parseDec(d[k])>0)}
function draftHasProgressInRemovedSets(exerciseId,nextSets,currentSets,d){
  if(nextSets>=currentSets)return false;
  d=d||loadDraft();
  if(d?.schemaVersion===2){
    const exercise=d.exercises?.[exerciseId];
    if(!exercise)return false;
    return exercise.setOrder.some(setId=>{
      const set=exercise.sets[setId];
      return set.ordinal>nextSets&&(set.completion!=="pending"||set.role==="warmup"||
        set.touched.load||set.touched.reps||set.touched.effort||Object.values(set.touched.metrics||{}).some(Boolean))})}
  const marked=new Set(["__done","__touched","__warm"].flatMap(k=>Array.isArray(d[k])?d[k]:[]));
  for(let n=nextSets+1;n<=currentSets;n++){
    const key=`${exerciseId}_${n}`;
    if(marked.has(key)||parseDec(d[`${key}_load`])>0)return true}
  return false}
/* ---- The day-change question (OG-6 `today/draft-resume`) ----
   Changing the day with sets logged would replace the draft, so it asks first, in a sheet and not the native confirm:
   "Cancel" keeps the draft and is where focus starts; Escape, the scrim and a downward swipe all mean it. "Discard
   unfinished session" is the existing discard path, unchanged. Asked from the day picker, the question takes the
   picker's place and Keep gives it back on the day that was armed, so a declined change leaves the picker open as it
   always did. Built here, like the History discard question, so the shell markup stays as it was. */
let draftDiscardAsk=null;
function draftDiscardParts(){
  let sheet=$("#draftDiscardSheet"),scrim=$("#draftDiscardScrim");
  if(sheet&&scrim)return{sheet,scrim};
  scrim=document.createElement("div");scrim.id="draftDiscardScrim";scrim.className="sheet-scrim hidden";
  sheet=document.createElement("div");sheet.id="draftDiscardSheet";sheet.className="sheet sheet--discard hidden";
  sheet.setAttribute("role","dialog");sheet.setAttribute("aria-modal","true");
  sheet.setAttribute("aria-labelledby","draftDiscardTitle");sheet.setAttribute("aria-describedby","draftDiscardBody");sheet.hidden=true;
  sheet.innerHTML='<div class="sheetband"><span class="sheetband__handle" aria-hidden="true"></span><h2 class="sheetband__title" id="draftDiscardTitle"></h2></div>'+
    '<div class="sheetbody"><p class="draftdiscard__body" id="draftDiscardBody"></p></div>'+
    '<div class="sheetfoot"><button type="button" id="draftDiscardKeep"></button><button type="button" id="draftDiscardDrop"></button></div>';
  document.body.append(scrim,sheet);
  return{sheet,scrim}}
/** Resolves true to discard the unfinished session, false to keep it. One question at a time. */
function confirmDiscardDraft(){
  if(draftDiscardAsk)return draftDiscardAsk;
  const{sheet,scrim}=draftDiscardParts();
  $("#draftDiscardTitle").textContent=t("draft.recovery.discard");
  $("#draftDiscardBody").textContent=t("confirm.discard_draft");
  const keep=$("#draftDiscardKeep"),drop=$("#draftDiscardDrop");
  keep.textContent=t("dialog.cancel");drop.textContent=t("draft.recovery.discard");
  const fromPicker=shellView().activeModal?.el?.id==="dayPickSheet";
  draftDiscardAsk=new Promise(resolve=>{
    let settled=false;
    const finish=async discard=>{
      if(settled)return;settled=true;
      if(fromPicker&&!discard)openDayPickSheet({resume:true});
      else await closeModal(sheet);
      draftDiscardAsk=null;resolve(discard)};
    keep.onclick=()=>finish(false);drop.onclick=()=>finish(true);scrim.onclick=()=>finish(false);
    const opened=openModal(sheet,{onEscape:()=>finish(false),scrim,initialFocus:keep,handoff:fromPicker,delayHide:reducedMotion()?0:280});
    if(opened===false){settled=true;draftDiscardAsk=null;resolve(false);return}
    document.body.classList.add("is-sheet-open");
    requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim.classList.add("is-open")})});
  return draftDiscardAsk}
async function requestWorkoutDay(nextDay){
  if(!nextDay||nextDay===day) return true;
  const hasProgress=draftHasProgress();
  if(hasProgress){
    if(!await confirmDiscardDraft()){
      return false}
    if(!await clearDraft())return false;
    resetSessionContextFields()}
  else if(activeWorkoutDraft?.program?.dayLabel&&activeWorkoutDraft.program.dayLabel!==nextDay){
    // A pristine draft is still scoped to its day. Drop that empty context
    // before creating the requested day's DraftV2 record so initialization
    // cannot reuse a valid but different-day canonical draft.
    if(!await clearDraft())return false;
    resetSessionContextFields()}
  day=nextDay;
  contextTouched.day=true;
  const selectionContextTouched={day:true,date:false,sessionNotes:false,bodyweight:false};
  const created=await WorkoutSession.start(nextDay,{contextTouched:selectionContextTouched});
  if(created.status!=="ready"){
    showDraftInitializationRecovery(created,{retryMode:"create",label:nextDay,contextTouched:selectionContextTouched});
    return false;
  }
  return true}

async function applyShowAll(){if(!await focusWorkoutCommands.restoreExercises())return false;renderWorkout();return true}
function replacementSnapshot(id,name,libraryRef){
  const entry=libraryRef?libraryEntry(libraryRef):null,token=movementToken(name),original=activeWorkoutDraft?.exercises?.[id],slot=prog.find(id);
  if(entry)return{exerciseInstanceId:`replacement:${entry.id}`,sourceExerciseId:entry.id,libraryId:entry.id,
    displayName:name||libraryName(entry),primary:libraryMuscleAttribution(entry,"primary"),secondary:libraryMuscleAttribution(entry,"secondary")};
  return{exerciseInstanceId:`replacement:${id}`,sourceExerciseId:`adhoc:${token}`,movementId:`adhoc:${token}`,
    displayName:name,primary:original?.programmed?.primary||slot?.primary||"",
    secondary:original?.programmed?.secondary||slot?.secondary||""}}
async function applyPredefinedSub(id,name,libraryRef=null){
  const n=String(name||"").trim().slice(0,80);
  if(!activeWorkoutDraft)return false;
  const type=!n?"restoreOriginalExercise":"substituteExercise";
  const payload={exerciseInstanceId:id};if(n){payload.replacement=replacementSnapshot(id,n,libraryRef);payload.selectedAt=new Date().toISOString()}
  const result=await WorkoutSession.dispatch(type,payload);if(result.status!=="applied")return false;
  renderWorkout();return true}
async function applyCustomSub(id,raw,libraryRef=null,ui={}){
  const name=String(raw||"").trim().slice(0,80);
  const progName=prog.find(id)?.name;
  if(!activeWorkoutDraft)return false;
  const restore=!name||name===progName,type=restore?"restoreOriginalExercise":"substituteExercise";
  const payload={exerciseInstanceId:id};if(!restore){payload.replacement=replacementSnapshot(id,name,libraryRef);payload.selectedAt=new Date().toISOString();
    const program=substitutionProgram(id,libraryRef);
    // Neither the custom movement nor the slot records anything, so there is
    // no composition to program; applying would skip the touched-set check.
    if(program==="unconfigured"){toast(t("entry.preview.metrics_required"));return false}
    if(program)payload.replacementProgram=program}
  const result=await WorkoutSession.dispatch(type,payload,ui);
  if(result.status==="domain-error"&&result.error?.code==="substitution-touched-pending-set")toast(t("toast.substitute_started_sets"));
  if(result.status!=="applied")return false;
  renderWorkout();return true}
let workoutReadModel;
function workoutQueries(){return workoutReadModel.capture({snapshot:state,draft:activeWorkoutDraft,
  currentCycle:mesocycleLifecycle(state.programMeta).current||1,profileWeightKg:interpretedProfile(state.profile).weightKg})}
function sessionExercise(...args){return workoutQueries().sessionExercise(...args)}
/* Mid-session swap. The slot's own movement stays in the list, and picking it
   is how a lifter undoes a swap — the alternative was a "back to X" row that
   means nothing until you already know what X was. */
function openSubstitutePicker(id){
  const ex=prog.find(id);if(!ex)return;
  const byName=new Map(pickableExercises().map(e=>[foldSearch(libraryName(e)),e]));
  const self=(ex.libraryId&&libraryEntry(ex.libraryId))||byName.get(foldSearch(ex.name))||null;
  // The slot's alternates lead the list. Picking one is an ordinary swap, so the
  // substitution rules (shared metrics, typed sets protected) apply unchanged.
  const slotId=String(ex.slotId||ex.id);
  const slot=(state.programMeta?.programDefinition?.days||[]).flatMap(day=>day.slots||[]).find(item=>item?.id===slotId);
  libraryUi.openExercisePicker({title:t("picker.title_substitute"),subtitle:exerciseDisplayName(ex),
    leading:{title:"picker.section_alternates",ids:Array.isArray(slot?.alternates)?slot.alternates:[]},
    reasons:libraryUi.SUBSTITUTION_REASONS,
    onPick:entry=>{
      const reason=libraryUi.pickerReason();
      if(self&&entry.id===self.id)applyPredefinedSub(id,"");
      else applyCustomSub(id,libraryName(entry),entry.id,
        {substitutionSource:(slot?.alternates||[]).includes(entry.id)?"alternate":"library",substitutionReason:reason})}})}
function fatigueFlagged(){return exercises().filter(e=>{const r=recommendation(sessionExercise(e));return r.status==="reduce"||r.stalled})}
async function applyFatigueTrim(){
  const flagged=new Set(fatigueFlagged().map(e=>e.id));
  if(!activeWorkoutDraft)return;
  for(const id of [...skipped])if(!flagged.has(id)){const result=await WorkoutSession.dispatch("restoreExercise",{exerciseInstanceId:id});if(result.status!=="applied")return}
  for(const id of flagged)if(!skipped.has(id)){const result=await WorkoutSession.dispatch("skipExercise",{exerciseInstanceId:id},{bulk:true});if(result.status!=="applied")return}
  renderWorkout();toast(t("toast.trimmed_priority"))}

/** Focus mode — the set being re-opened for edit: {exId,n,snap}. `snap` is the
 *  set as it stood when editing began, so cancelling puts it back untouched. */

/** Focus mode — the set just committed: {exId,n}. Set on the commit that
 *  logs a set and consumed by the render it triggers, which is the only one
 *  that plays the landing animation. Every later render draws the same card
 *  still, so a re-render for an unrelated reason never replays it. */

/** True while the card being written is the one that just gained a set. */
const focusIsFresh=(ex,peek)=>focusUi.selectExercise(ex,committed,{peek}).fresh;
/** The Progress chart page: scope, metric and the selected point (null = the latest session). */
let ExerciseUi=null;
let workoutActive=false,workoutLeft=false,setupEditorOpen=false;
/* The editor module owns the draft document. Hosts retain only its lifecycle
   and adapter session so the installed editor can stay private until Done. */
let onboardingProgramEditor=null;

// Today's session lists its first few exercises; the rest sit behind a "+N" row.
// Two-level Progress navigation (Plan 056): Overview/Review are the primary
// tasks; Strength/Volume/PRs are a labelled Evidence group. Old one-level seg
// values keep working: evidence keys map onto the Evidence view and unknown
// values fall back to Overview.


function earliestLogDate(log){if(!log?.length)return null;return log.reduce((min,r)=>!min||String(r.date)<min?r.date:min,null)}


let EntryActivation=null;
function buildProgramMeta(input={}){return EntryActivation.metadata(input)}

/* Per-movement smallest load change in canonical kg; anything else is dropped. */



function isImportableState(s){return BackupCommands.isImportable(s)}
/* A backup from before the canonical program model carries flat rows with no
   ProgramDefinition. Restoring it would install a program the engine cannot
   read, so it is refused; its program can still come in through import review,
   which re-links each name to a catalog movement. */
function isLegacyBackup(s){return BackupCommands.isLegacy(s)}
/* A custom exercise is a library entry the lifter authored, so it is normalised
   into the same shape the built-ins have — the pickers and the copy-into-template
   path then cannot tell the two apart. */
/* Resolves a library id against a specific custom list plus the built-ins. */
function snapshotLookup(...args){return TrainingModel.snapshotLookup(...args)}
function canonicalizeLinkedMuscleRows(...args){return TrainingModel.canonicalizeLinkedMuscleRows(...args)}
function canonicalizeProgramStructureMuscles(...args){return TrainingModel.canonicalizeProgramStructureMuscles(...args)}
function canonicalizeDurableMuscleAttributions(...args){return TrainingModel.canonicalizeDurableMuscleAttributions(...args)}
function normalizeCustomExercises(...args){return TrainingModel.normalizeCustomExercises(...args)}


// Compatibility for retained adapters; native commands own restore/merge policy.
function replaceImportedState(incoming,io=storageIO,options={}){
  requireAdapter(io,"replaceImportedState");return BackupCommands.replace(incoming,{...options,io})}
function mergeImportedLog(incoming,io=storageIO){
  requireAdapter(io,"mergeImportedLog");return BackupCommands.merge(incoming,{io})}
/* Creates or edits one of the lifter's own movements. Returns the stored entry
   so a caller can drop it straight into a program slot — creating a custom
   exercise is almost always the first half of "put this in my program". */
const customExerciseCommands=createCustomExerciseCommands({
  read:applicationSession.read,commit:(proposal,opts,io=storageIO)=>commitProposedState(proposal,io,opts),
  model:{normalizeCustomExercises,isCustomLibraryId,definitionMovementIds},
  normalizeMuscleAttribution:value=>MuscleDomain.normalizeMuscleAttribution(value),
  now:()=>new Date().toISOString(),newId:()=>`${CUSTOM_ID_PREFIX}${uid()}`,
  invalidMuscleCommit:()=>invalidMuscleDomainCommit(),
  settleMutation:options=>DurableState.settleCustomExerciseMutation(options)});
const resolveCustomMutationIntent=customExerciseCommands.resolveIntent;
const customExerciseStateEqual=customExerciseCommands.stateEqual;
const customExerciseUpsert=customExerciseCommands.upsert;
const customExerciseRemoveOrArchive=customExerciseCommands.removeOrArchive;
const customExerciseInUse=customExerciseCommands.inUse;
function saveCustomExercise(draft,io=storageIO,opts={}){
  return customExerciseCommands.save(draft,{...opts,io})}
function deleteCustomExercise(id,io=storageIO,opts={}){
  return customExerciseCommands.remove(id,{...opts,io})}
function programAdherence(asOf=today()){const totalDays=prog.days().length;if(!totalDays)return{logged:0,total:0,ratio:0};
  // Inclusive rolling [asOf-6, asOf] — distinct planned days; future rows excluded.
  const end=asOf,start=shiftDate(end,-6),programDaySet=new Set(prog.days()),loggedDays=new Set();
  for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;if(programDaySet.has(x.day))loggedDays.add(x.day)}
  const logged=loggedDays.size;return{logged,total:totalDays,ratio:totalDays?logged/totalDays:0}}
window.__repforgeProgramAdherence=programAdherence;
function weeklySnapshot(date=today()){const{start,end}=weekRange(date),weekStart=start,weekEnd=end;
  const completedSessions=sessionsInRange(start,end).length,plannedDays=prog.days().length,programDaySet=new Set(prog.days()),loggedDays=new Set();
  for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;if(programDaySet.has(x.day))loggedDays.add(x.day)}
  const completedDays=loggedDays.size,adherence=plannedDays?completedDays/plannedDays:0,hr=+state.settings.hardRir;
  let totalWorkingSets=0,totalHardSets=0;for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;
    if(!isWork(x)||!(+x.load>0&&+x.reps>0))continue;totalWorkingSets++;if(+x.rir<=hr)totalHardSets++}
  const prs=detectPRs(state.log).filter(ev=>String(ev.date)>=start&&String(ev.date)<=end);
  const trained=new Map();for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;if(!isWork(x)||!(+x.load>0))continue;
    const k=liftKey(x),cur=trained.get(k);if(!cur||compareLogChronology(cur,x)<0)trained.set(k,{session:x.session,date:x.date,created:x.created})}
  let improvedLifts=0,flatLifts=0,regressedLifts=0,fatigueFlags=0;
  for(const[k,sess]of trained){
    const rows=state.log.filter(r=>r.session===sess.session&&liftKey(r)===k);if(!rows.length)continue;
    const current=currentExerciseForLiftKey(k),ex=current||exerciseIdentityFromRow(rows[0]),cmp=compareExerciseSession(ex,rows);
    if(cmp.status==="improved")improvedLifts++;else if(cmp.status==="flat")flatLifts++;else if(cmp.status==="regressed")regressedLifts++;
    if(current){const r=recommendation(current);if(r.status==="reduce"||r.stalled)fatigueFlags++}}
  let readyToAdd=0;for(const ex of prog.exercises){const st=recommendation(ex).status;if(st==="add"||st==="add2")readyToAdd++}
  let status;if(completedSessions===0)status=t("status.needs_more_data");
  else if(adherence>=.85&&improvedLifts>=flatLifts)status=t("status.on_track");
  else if(adherence>=.65&&prs.length>0)status=t("status.productive_week");
  else if(fatigueFlags>=2)status=t("status.high_fatigue");
  else if(adherence<.5)status=t("status.under_target");
  else status=t("status.rebuilding");
  return{weekStart,weekEnd,plannedDays,completedDays,completedSessions,totalWorkingSets,totalHardSets,prs,improvedLifts,flatLifts,regressedLifts,readyToAdd,status}}
window.__repforgeWeeklySnapshot=weeklySnapshot;
function mesocycleLifecycle(...args){return TrainingModel.mesocycleLifecycle(...args)}
/** Q617: extended past the planned length; complete in or after the final
 *  week; partial at least halfway; otherwise early. */

/** The lifter opening the block review. Navigation calls this; render does not. */
function captureBlockReviewViewed(){
  if(!state.programMeta?.started)return;
  captureEvent("block_review_viewed",{completion:blockCompletionBucket(mesocycleLifecycle(state.programMeta))})}
function programWeek(){return mesocycleLifecycle(state.programMeta).elapsedWeek}
function mesocycleWeek(){return mesocycleLifecycle(state.programMeta)}
function isProgramDeloadWeek(mc=mesocycleWeek()){
  const deloadCycles=state.programMeta?.programDefinition?.deloadCycles;
  return Number.isInteger(mc.current)&&Array.isArray(deloadCycles)&&deloadCycles.includes(mc.current)}
function renderFocusDeloadLine(el=$("#woDaySub")){
  if(!el)return;
  const mc=mesocycleWeek(),show=isProgramDeloadWeek(mc);
  el.textContent=formatCycleLabel(mc,show,t);
  el.classList.toggle("is-deload",show)}
function mesocycleWeekCopy(mc,ofKey="today.week_of"){
  if(mc.isComplete)return t("meso.complete");
  if(mc.current==null)return"";
  return mc.isFinalWeek?t("meso.week_ready",{n:mc.current,total:mc.total}):t(ofKey,{n:mc.current,total:mc.total})}
function programWeekContext(name,mc){return formatProgramContext(name,mc,t)}
function recoveryCarrierRecords(snapshot=state){
  const carrier=snapshot?.recoveryTransitions;
  return isValidRecoveryTransitions(carrier)?carrier.records:[];
}

function validatedRecoveryRecordForSnapshot(snapshot,record){return validateRecoveryProjectionRecord(snapshot,record)}
async function refreshRecoveryProjectionCache(snapshot=state){
  activeRecoveryRecord=null;activeRecoveryRecordBlockId=null;
  const blockId=snapshotBlockId(snapshot),records=recoveryCarrierRecords(snapshot);
  if(!isValidBlockId(blockId,snapshot?.programMeta?.id))return null;
  const matches=records.filter(record=>record?.diff?.recoveryWeek?.blockId===blockId);
  // Two valid records for one target are retained but neither applies. The
  // later quarantine/conflict policy must not be inferred in this slice.
  if(matches.length!==1)return null;
  const validated=await validatedRecoveryRecordForSnapshot(snapshot,matches[0]);
  if(!validated)return null;
  activeRecoveryRecord=validated;activeRecoveryRecordBlockId=blockId;
  return validated;
}
const rowMusclesPure=loggedMuscleAttribution;
const compareLogChronology=NativeProgressModel.compareChronology;

function volMapToObj(m){const o={};for(const[k,v]of m)o[k]={d:v.d,p:v.p};return o}
function sessionsForLog(ex,log){return scalarSessions((log||[]).filter(matchLift(ex)))}
function previousSessionRowsLog(ex,beforeSessionId,log){return previousScalarSessionRows((log||[]).filter(matchLift(ex)),beforeSessionId,log||[])}
function hardSetsInRange(log,program,started,ended,hardRir){return ProgressReadModels.hardSets(log||[],program||[],{start:started,end:ended,hardRir})}

function buildBlockReview(programMeta,program,log){return blockReview.build({...state,programMeta,program,log},{today:today(),now:new Date().toISOString(),hardRir:DEFAULTS.hardRir})}
function reviewReadModel(){return ProgressReadModels.review(progressReadFacts(),strengthEvidenceRecords("current-block"))}

function reviewPreviewModel(flow){
  const before=state.programMeta?.programDefinition,after=flow.proposal?.successor?.programDefinition;
  const labels=definition=>Object.fromEntries((definition?.days||[]).map(day=>[day.name,localizedDayName({label:day.name},day.name,definition)]));
  const movementLabels=Object.fromEntries([...(before?.days||[]),...(after?.days||[])].flatMap(day=>day.slots||[])
    .map(slot=>[slot.exerciseId,libraryName(libraryEntry(slot.exerciseId))||slot.exerciseId]));
  return{before,after,beforeDayLabels:labels(before),afterDayLabels:labels(after),movementLabels};
}
function renderReview(){ReviewUi.render(reviewReadModel())}
function startScheduleRepair(){ReviewUi.startScheduleRepair()}
function startGuidedEdit(){ReviewUi.startGuidedEdit()}
function startVolumeReduction(){ReviewUi.startVolumeReduction()}
function startRecoveryWeek(){ReviewUi.startRecoveryWeek()}
let pendingBlockTransition=null;
let onboardingOrigin=null;
let blockCommitInFlight=null;
function capturePendingBlock(strategy,review){
  // Deferred onboarding captures only intent/concurrency pins plus the review
  // snapshot. The predecessor is still live here, so archive-time history must
  // not be materialized until the durable successor activation boundary.
  const snapshot=review||buildBlockReview(state.programMeta,state.program,state.log);
  const intent=captureProgramReplacementIntent(state,snapshot);
  return intent?{...intent,strategy}:null}
function hasArchivableProgram(snapshot){
  const meta=snapshot?.programMeta;
  const hasDefinition=(Array.isArray(snapshot?.program)&&snapshot.program.length>0)||structureDayLabels(meta);
  return !!meta&&!!hasDefinition}
function captureProgramReplacementIntent(snapshot=state,review=null){
  const meta=snapshot?.programMeta;
  if(!hasArchivableProgram(snapshot))return null;
  return{oldProgramId:meta.id,oldBlockId:snapshotBlockId(snapshot),
    programFingerprint:draftProgramFingerprint(snapshot),storageRevision:readRevision(snapshot),
    review:review?cloneSnapshot(review):null}}
function materializeProgramReplacementCapture(intent,snapshot=state){
  if(!intent?.oldProgramId||!hasArchivableProgram(snapshot))return null;
  const meta=snapshot?.programMeta;
  const program=Array.isArray(snapshot?.program)?snapshot.program:[];
  if(meta?.id!==intent.oldProgramId)return null;
  // This is the archive-time boundary. Finalize the still-live predecessor
  // using the current clock/state, while preserving the deferred intent's
  // original identity/revision/fingerprint pins for the lock-held CAS.
  const finalized=withExplicitProgramStructure(program,meta);
  return{...cloneSnapshot(intent),oldMeta:cloneSnapshot(finalized.meta),oldProgram:cloneSnapshot(finalized.program)}}
function captureProgramReplacement(snapshot=state,review=null){
  const intent=captureProgramReplacementIntent(snapshot,review);
  return intent?materializeProgramReplacementCapture(intent,snapshot):null}
const programReplacementCommands=createProgramReplacementCommands({
  read:applicationSession.read,commit:(proposal,opts,io=storageIO)=>commitProposedState(proposal,io,opts),
  capture:captureProgramReplacement,allocateBlockId,now:()=>new Date().toISOString()});
function commitProgramReplacement(proposal,io=storageIO,opts={}){
  requireAdapter(io,"commitProgramReplacement");
  return programReplacementCommands.commit(proposal,{...opts,io})}
function blockTransitionResult(kind,result={}){
  const deferred=kind==="deferred"||result.deferred===true;
  const outcomeKind=deferred?"deferred":kind;
  const committed=outcomeKind==="committed";
  const revision=Number.isInteger(result.revision)&&result.revision>=0?result.revision:readRevision(state);
  return{...result,kind:outcomeKind,committed,deferred,duplicate:outcomeKind==="duplicate",
    revision,localOk:(committed||deferred)&&!!result.localOk,idbOk:(committed||deferred)&&!!result.idbOk}}
function blockTransitionDurableResult(result={}){
  const kind=result.committed===true?"committed":
    result.deferred===true||result.recoveryPending===true?"deferred":
    result.duplicate||result.staleRevision||result.stale?"duplicate":"failed";
  return blockTransitionResult(kind,result)}
function commitNextBlock(strategy,io=storageIO,expectedOldId=null){
  requireAdapter(io,"commitNextBlock");
  const liveId=state.programMeta?.id;
  const oldId=expectedOldId||liveId;
  if(!liveId||!oldId)return Promise.resolve(blockTransitionResult("failed"));
  // An acknowledged DraftV2 owns a captured prescription and block identity.
  // Refuse before capture, journaling, or any storage boundary so the exact
  // draft/checkpoint bytes remain untouched for the lifter to finish or clear.
  const draftGuard=blockStartDraftGuard();
  if(draftGuard)return Promise.resolve(blockTransitionResult("failed",draftGuard));
  if(blockCommitInFlight?.oldProgramId===oldId)return blockCommitInFlight.promise;
  if(liveId!==oldId)return Promise.resolve(blockTransitionResult("duplicate"));
  const pending=pendingBlockTransition&&pendingBlockTransition.oldProgramId===liveId
    ?pendingBlockTransition:null;
  if(strategy==="onboarding"){
    const intent=pending||capturePendingBlock(strategy);
    if(!intent||state.programMeta.id!==intent.oldProgramId)
      return Promise.resolve(blockTransitionResult("duplicate"));
    pendingBlockTransition=pendingBlockTransition||intent;
    startOnboarding("block");
    return Promise.resolve(blockTransitionResult("deferred"))}
  const cap=pending
    ?materializeProgramReplacementCapture(pending,state)
    :captureProgramReplacement(state,buildBlockReview(state.programMeta,state.program,state.log));
  if(!cap||state.programMeta.id!==cap.oldProgramId)return Promise.resolve(blockTransitionResult("duplicate"));
  const task=(async()=>{
    const compilerProvenance = classifyCompilerTransitionProvenance(cap.oldMeta);
    // Plan 056: the legacy program-altering strategies are gone. Structural
    // change goes through Plan 052 proposals; the only remaining direct path
    // is the literal repeat, which keeps the program and prescription intact.
    if(strategy!=="repeat")return blockTransitionResult("failed",{invalid:true,code:"unsupported_strategy"});
    const nextProgram=cloneSnapshot(cap.oldProgram);
    let effect=null;
    const proposal=cloneSnapshot(state);
    const nextMeta=buildProgramMeta({name:cap.oldMeta?.name,answers:cap.oldMeta||{}});
    const literalRepeat=true;
    {
      nextMeta.id=cap.oldMeta.id;
      // A literal repeat keeps the program identity and prescription model;
      // carry compiler/progression provenance into the fresh block while the
      // activation fields above still describe the new block boundary.
      for(const key of ["progressionRelations","progressionModifiers","progressionIncompatibilities",
        "programStructure","compilerContext","entrySource","programDefinition","loadingConfiguration"]){
        if(Object.prototype.hasOwnProperty.call(cap.oldMeta||{},key))
          nextMeta[key]=cloneSnapshot(cap.oldMeta[key]);
      }
    }
    nextMeta.blockId=allocateBlockId();
    proposal.programMeta=nextMeta;
    proposal.program=nextProgram;
    const persisted=await commitProgramReplacement(proposal,io,literalRepeat
      ?{capture:null,effect,expectedProgramId:cap.oldProgramId,
        expectedProgramFingerprint:cap.programFingerprint,expectedBlockId:cap.oldBlockId,
        expectedStorageRevision:cap.storageRevision}
      :{capture:cap,effect});
    const result=blockTransitionDurableResult(persisted);
    if(result.committed){
      captureEvent("block_transition_chosen",{action:"repeat"});
      pendingBlockTransition=null;day=days()[0]||"Day 1";toast(t("toast.new_block_volume_reduced"));render()}
    return result})();
  blockCommitInFlight={oldProgramId:oldId,promise:task};
  const clear=()=>{if(blockCommitInFlight?.promise===task)blockCommitInFlight=null};
  task.then(clear,clear);
  return task}
function finishBlockAndStart(strategy,expectedOldId){
  // Only the literal repeat and the onboarding handoff remain reachable.
  if(strategy!=="repeat"&&strategy!=="onboarding")return Promise.resolve(blockTransitionResult("failed",{invalid:true,code:"unsupported_strategy"}));
  return commitNextBlock(strategy,storageIO,expectedOldId)}
// Plan 056: Program's End block (and the Review-block row) route into the
// single Progress → Review lifecycle. There is no separate competing dialog.
function promptEndBlock(){
  navTo("stats");setStatsSeg("review");
  const seg=$('#statsSeg button[data-seg="review"]');if(seg)seg.focus()}
async function dismissBlockPrompt(){
  const proposal=cloneSnapshot(state);
  if(!proposal.programMeta)proposal.programMeta=defaultProgramMeta(proposal.log);
  proposal.programMeta.blockPromptDismissedId=proposal.programMeta.id;
  proposal.programMeta.updated=new Date().toISOString();
  const result=await commitProposedState(proposal);
  if(result.localOk||result.idbOk)renderBlockPrompt();
  return result}
function renderBlockPrompt(){const mc=mesocycleWeek();
  const id=state.programMeta?.id;
  const dismissed=!!(id&&state.programMeta?.blockPromptDismissedId===id);
  const show=(mc.isComplete||mc.isFinalWeek)&&!dismissed;
  const body=mc.isComplete?t("meso.complete"):t("meso.week_ready",{n:mc.current,total:mc.total});
  const html=show?`<p><b>${esc(t("review.block_ending"))}</b> ${esc(body)} <button type="button" class="blockprompt__act">${esc(t("review.block_ending.cta"))}</button></p>`+
    `<button type="button" class="blockprompt__dismiss" aria-label="${esc(t("review.block_ending.dismiss_aria"))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`:"";
  for(const sel of["#logBlockBanner","#programBlockBanner"]){const el=$(sel);if(!el)continue;
    el.classList.toggle("hidden",!show);if(show){el.innerHTML=html;
      const btn=el.querySelector(".blockprompt__act");if(btn)btn.onclick=promptEndBlock;
      const dismiss=el.querySelector(".blockprompt__dismiss");if(dismiss)dismiss.onclick=async e=>{e.stopPropagation();await dismissBlockPrompt()}}}}
function programProgressionHealth(){return deriveProgramHealth(prog.exercises.map(ex=>{const hasHistory=sessionsFor(ex).length>0;return{hasHistory,status:hasHistory?recommendation(ex).status:""}}))}
function programVolumeCompliance(){return deriveVolumeCompliance(prog.volume().values(),completedHardSets(7).values())}
function programStatusLabel(adherence,health){return t(programStatusKey(state.log.some(isWork),adherence.ratio,health?.ratio))}
/* Accepts v3, v2, a bare exercise array, and {program:[…]} — every shape
   Taurifer has ever written. customExercises only exists in v3. */
function validImportedCustomExercise(entry){
  if(!entry||typeof entry!=="object"||Array.isArray(entry))return false;
  for(const key of ["primary","secondary"]){
    if(!Object.prototype.hasOwnProperty.call(entry,key))continue;
    if(!MuscleDomain.normalizeMuscleAttribution(entry[key]).ok)return false;
  }
  return true}

/* Merges an import's custom definitions into the lifter's own library.

   An id can already be taken by a different definition — two devices both mint
   "custom:<uuid>", or the same program is imported twice after a local edit. An
   identical definition is reused, a colliding one is minted a fresh id, and the
   templates that referenced it are repointed. Nothing local is overwritten. */
// Random id minting is fine on the live import path but must not run inside a
// replayable reconstruction (a journal successor rebuilt from the same inputs
// has to be byte-identical). Callers on the shared-setup rebase path pass a
// deterministic allocator seeded from the persisted transaction id instead.
const deterministicCustomIdAllocator=seed=>{
  const base=String(seed||"shared");let n=0;
  return byId=>{let id;do{n++;id=`${CUSTOM_ID_PREFIX}${base}#${n}`}while(byId.has(id));return id}};
let customDefinitionImport=null;
function mergeImportedCustomExercises(incoming,exercises,snapshot,allocate){
  return customDefinitionImport.merge({incoming,exercises:exercises||[],existing:customExercises(snapshot),allocate})}
function sharedSettingsPatch(raw){
  return{jumpPct:normSetting(raw?.jumpPct,DEFAULTS.jumpPct,0),
    minJump:normSetting(raw?.minJump,DEFAULTS.minJump,0.01),
    rirHigh:normSetting(raw?.rirHigh,DEFAULTS.rirHigh,0),
    hardRir:normSetting(raw?.hardRir,DEFAULTS.hardRir,0),
    restSec:normalizeRestSec(raw?.restSec),
    unit:raw?.unit==="lb"?"lb":"kg",
    lang:I18N?.normalizeLang(raw?.lang)||"en",
    rirMode:raw?.rirMode==="effort"?"effort":"numeric"}}
// Only the definitions the replacement program actually references are payload-
// owned. Everything else in the stale proposal's customExercises is recipient
// state the refreshed head already owns (including deletions and edits), so it
// must never be re-imported.
function referencedCustomDefinitions(snapshot){
  const referenced=new Set([...(Array.isArray(snapshot?.program)?snapshot.program:[]).map(ex=>ex?.libraryId),
    ...definitionMovementIds(snapshot?.programMeta?.programDefinition)].filter(id=>isCustomLibraryId(id)));
  return customExercises(snapshot).filter(def=>referenced.has(def.id)).map(cloneSnapshot)}
// The head owns every device setting except the eight shared fields, including
// unknown top-level and nested notify keys the recipient may have gained after
// the gate opened; the payload contributes only the allowlisted eight.
function rebaseSharedSettings(head,proposalSettings){
  return{...normalizeSettings(head?.settings),...sharedSettingsPatch(proposalSettings)}}
/* Undoes the gate-time mapping so the payload's own definitions are what gets
   offered to the refreshed head. Without this, a recipient definition the
   proposal had reused (same movement under a different id) would be re-imported
   as payload data — resurrecting it even when the head has since deleted it. */
function sharedPayloadDefinitions(record,exercises,definition=null){
  const inverse=new Map(Object.entries(record.remap||{})
    .map(([payloadId,proposalId])=>[proposalId,payloadId]));
  if(inverse.size)
    for(const ex of exercises)
      if(ex&&inverse.has(ex.libraryId))ex.libraryId=inverse.get(ex.libraryId);
  const referenced=new Set([...exercises.map(ex=>ex?.libraryId),...definitionMovementIds(definition)]
    .map(id=>inverse.get(id)||id).filter(id=>isCustomLibraryId(id)));
  return normalizeCustomExercises(record.definitions).filter(def=>referenced.has(def.id))}
function rebaseSharedSetupSnapshot(snapshot,head,seed){
  if(!snapshot||!head)return snapshot;
  const record=isPlainStateObject(snapshot[SHARED_IMPORT])?snapshot[SHARED_IMPORT]:null;
  delete snapshot[SHARED_IMPORT];
  const exercises=Array.isArray(snapshot.program)?snapshot.program:[];
  snapshot.settings=rebaseSharedSettings(head,snapshot.settings);
  const incoming=record?sharedPayloadDefinitions(record,exercises,snapshot.programMeta?.programDefinition)
    :referencedCustomDefinitions(snapshot);
  snapshot.customExercises=mergeImportedCustomExercises(
    incoming,exercises,head,deterministicCustomIdAllocator(seed)).customExercises;
  return snapshot}
function persistBootNormalization(opts={}){

  const base=cloneSnapshot(mutationBase||state);
  const snapshot=cloneSnapshot(state);
  const structured=withExplicitProgramStructure(snapshot.program,snapshot.programMeta||defaultProgramMeta(snapshot.log));
  snapshot.program=structured.program;snapshot.programMeta=structured.meta;
  return enqueueStateChange(base,snapshot,storageIO,opts)}
// State-shape validation still reads legacy dangling references losslessly.
// At the lock-held write boundary, however, every newly introduced custom
// Program identity must resolve inside the candidate's own custom library.
function missingCustomProgramReference(head,candidate,{replace=false}={}){
  return DurableState.missingCustomProgramReference(head,candidate,{replace})}
async function commitProposedState(proposal,io=storageIO,opts={}){
  requireAdapter(io,"commitProposedState");
  const durableProposal=canonicalizeDurableMuscleAttributions(proposal);
  if(!isValidMuscleDomainTree(durableProposal))return invalidMuscleDomainCommit(proposal);
  const base=cloneSnapshot(mutationBase||state);
  const liveBase=cloneSnapshot(state);
  const snapshot=cloneSnapshot(durableProposal);
  const structured=withExplicitProgramStructure(snapshot.program,snapshot.programMeta||defaultProgramMeta(snapshot.log));
  snapshot.program=structured.program;snapshot.programMeta=structured.meta;
  // A lock-held preflight may replace the optimistic proposal with a compiler
  // successor. Normalize that returned successor at the same boundary as the
  // optimistic proposal so boot never has to perform a second, revisionful
  // migration of a valid committed state.
  const durableOpts=Object.assign({},opts,{liveBase});
  const callerPreflight=opts.preflight;
  durableOpts.preflightJournalPending=typeof callerPreflight==="function";
  durableOpts.preflight=async context=>{
    const checked=typeof callerPreflight==="function"?await callerPreflight(context):null;
    if(checked?.reject)return checked;
    let next=context.proposal;
    if(checked?.proposal){
      next=canonicalizeDurableMuscleAttributions(checked.proposal);
      const nextStructured=withExplicitProgramStructure(next.program,
        next.programMeta||defaultProgramMeta(next.log));
      next.program=nextStructured.program;next.programMeta=nextStructured.meta;
    }
    const candidateHead=durableOpts.replace?cloneSnapshot(context.head):
      rebaseStateChange(base,liveBase,context.head);
    const candidate=durableOpts.replace?cloneSnapshot(next):
      rebaseStateChange(liveBase,next,candidateHead);
    if(missingCustomProgramReference(context.head,candidate,{replace:!!durableOpts.replace}))
      return{reject:true,result:{conflict:true,stale:true,code:"missing_custom_definition"}};
    if(!checked?.proposal)return checked;
    return{...checked,proposal:next};
  };
  const result=await enqueueStateChange(base,snapshot,io,durableOpts);
  if(result.draftConflict&&!result.journalFailed)toast(t("toast.draft_conflict_retry"),{assertive:true});
  return result}
// Compatibility names are composition-only; all transfer policy lives in its owner.
const installTransferReadMarker=(...args)=>TransferCommands.readMarker(...args);
const importInstallTransfer=(...args)=>TransferCommands.importEnvelope(...args);
const installTransferCreateFromSafari=()=>TransferCommands.createOutbound();
const installTransferConfirmDivergence=()=>TransferCommands.confirmDivergence();
const installTransferCheckOutboundOnBoot=()=>TransferCommands.checkOutboundOnBoot();
const installTransferDeviceMeaningful=()=>TransferCommands.deviceMeaningful();
const installTransferStateMeaningful=snapshot=>TransferCommands.stateMeaningful(snapshot);
async function deleteTrainingLog(io=storageIO,{discardDraftRaw=readDraftRaw()}={}){
  const proposal=cloneSnapshot(state);
  proposal.log=[];
  const effect=destructiveDraftClearEffect(discardDraftRaw);
  const result=await commitProposedState(proposal,io,{effect});
  if(result.localOk||result.idbOk){
    resetDraftSessionState();render();toast(t("toast.log_deleted"))}
  return result}
window.__repforgeStorage={
  flush:flushStorage,
  chooseSnapshot:(local,idb)=>(DurableState?DurableState.chooseSnapshot(local,idb):chooseSnapshot(local,idb)),
  writeWithAdapter(snapshot,io){
    requireAdapter(io,"writeWithAdapter");
    return enqueueWrite(()=>writeSnapshot(cloneSnapshot(snapshot),io))},
  health(){return DurableState.getStorageHealth()},
  rebaseForTest(base,proposal,target,opts){return rebaseStateChange(base,proposal,target,opts)},
  replaceImport(incoming,io,opts){requireAdapter(io,"replaceImport");return replaceImportedState(incoming,io,opts)},
  mergeImport(incoming,io){requireAdapter(io,"mergeImport");return mergeImportedLog(incoming,io)}}
function days(){
  const fromEx=[...new Set((state.program||[]).map(x=>x.day))];
  const fromStruct=structureDayLabels(state.programMeta);
  if(!fromStruct)return fromEx.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const out=[],seen=new Set();
  for(const d of fromStruct){if(!d||seen.has(d))continue;seen.add(d);out.push(d)}
  for(const d of fromEx.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){
    if(seen.has(d))continue;seen.add(d);out.push(d)}
  return out}
function structureDayLabels(...args){return TrainingModel.structureDayLabels(...args)}
function makeProgram(list,lookup=null,meta=null){return TrainingModel.makeProgram(list,lookup||snapshotLookup(customExercises()),meta)}
// Progress needs the exact historical volume facts and a sparse schedule
// projection for any explicit future overrides. The aggregate below owns
// elapsed denominators; normal current/future weeks continue to come from the
// authored program, so a block's size no longer scales with rows × weeks.
function prescriptionProgramRows(...args){return TrainingModel.prescriptionProgramRows(...args)}
function existingPrescriptionSlots(...args){return TrainingModel.existingPrescriptionSlots(...args)}
function plannedPrescriptionForProgram(...args){return TrainingModel.plannedPrescriptionForProgram(...args)}
function preservePrescriptionReceipt(...args){return TrainingModel.preservePrescriptionReceipt(...args)}
function emptyPlannedVolumeHistory(...args){return TrainingModel.emptyPlannedVolumeHistory(...args)}
function addPlannedVolumeHistory(...args){return TrainingModel.addPlannedVolumeHistory(...args)}
function plannedVolumeHistoryTarget(...args){return TrainingModel.plannedVolumeHistoryTarget(...args)}
function prescriptionWeekNumber(...args){return TrainingModel.prescriptionWeekNumber(...args)}
function receiptHasMuscleAttribution(...args){return TrainingModel.receiptHasMuscleAttribution(...args)}
function isSparsePrescriptionOverride(...args){return TrainingModel.isSparsePrescriptionOverride(...args)}
function historicalPrescriptionForWeek(...args){return TrainingModel.historicalPrescriptionForWeek(...args)}
function compactProgramPrescriptionState(structure,program,meta,options={}){return TrainingModel.compactProgramPrescriptionState(structure,program,meta,{...options,recoveryRecord:options.recoveryRecord||(activeRecoveryRecord?.diff?.recoveryWeek?.blockId===meta?.blockId?activeRecoveryRecord:null)})}
/* A programStructure names its definition's training days, in order (#388).
   Entries that still match a training day keep their identity; any other day
   list is rebuilt from the definition, whose generated names localize. */
function programStructureForDefinition(...args){return TrainingModel.programStructureForDefinition(...args)}
/* A Review successor is a new block of a regenerated definition: it keeps the
   structure's provenance but none of the predecessor's days or receipts. */
function successorProgramStructure(...args){return TrainingModel.successorProgramStructure(...args)}
function syncProgramStructureFromProgram(proposal,program,previousProgram=null,previousMeta=null){return TrainingModel.syncProgramStructureFromProgram(proposal,program,previousProgram,previousMeta||state.programMeta,{recoveryRecord:activeRecoveryRecord?.diff?.recoveryWeek?.blockId===proposal.programMeta?.blockId?activeRecoveryRecord:null})}
function scheduledProgramRows(){
  const week=mesocycleLifecycle(state.programMeta).current;
  if(state.programMeta?.programDefinition&&week!=null){
    const projected=flatProgramFromDefinition(state.programMeta.programDefinition,
      Array.isArray(state.customExercises)?state.customExercises:[],week);
    if(projected)return projected}
  return state.program}
function exercises(d=day){return scheduledProgramRows().filter(x=>x.day===d).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name))}

function matchLift(...args){return workoutQueries().matchLift(...args)}
function last(...args){return workoutQueries().last(...args)}
// One entry per past session for this lift, oldest→newest, working sets only (load>0).
function sessionsFor(ex){return sessionsForLog(ex,state.log)}
// The lifter's own recent habitual RIR for this lift — a measurement, not a target.

// Memo key for the capacity helpers that walk the whole log: identity plus a cheap
// stamp of the log's shape. Accepted publication clears both memos when the log changes.

// Recent typical capacity for off-day detection. null until 2 sessions exist.
// Memoized: session freshness asks for every other lift on the day, on every
// keystroke in a committed row — Log-tab speed comes first.


/** The working sets a saved session performed, read through the History and
 *  Progress projection: a per-side row's load and reps live in its metric
 *  values, not in the scalar fields a plain Weight × Reps row fills. */
function performedWorkingRows(rows){return workingRows(readLogRows(rows||[]))}
/** The load a set of saved rows moved, as History totals it: each working
 *  row's projected tonnage, so a per-side row counts its physical load and a
 *  row whose multiplier is unknown adds nothing. */
function movedTonnage(rows){return sum(readLogRows(rows||[]).filter(row=>isWork(row)&&Number.isFinite(row.tonnage)).map(row=>row.tonnage))}

function previousSessionForExercise(ex,beforeSessionId){return previousSessionRowsLog(ex,beforeSessionId,state.log)}
// All readers use the one pure training policy; composition applies current copy.
function buildSessionDelta(previous,current){return presentSessionOutcome(deriveSessionDelta(previous,current),{t})}
function noComparableSessionOutcome(){return presentSessionOutcome(deriveNoComparable(),{t})}
function compareProjectedSessionOutcome(current,previous,convention=null){return presentSessionOutcome(deriveProjectedOutcome(current,previous,convention),{t})}

function compareExerciseSession(ex,currentRows,readerContext=null){
  if(readerContext?.reader==="progress-strength")return compareProgressStrengthSession(ex,currentRows,readerContext);
  const cur=workingRows(currentRows);
  if(!cur.length)return{status:"not_comparable",label:t("delta.not_comparable.label"),text:t("delta.not_comparable.text"),metrics:null};
  const prev=previousSessionForExercise(ex,cur[0]?.session);
  if(!prev.length)return{status:"new",label:t("delta.new.label"),text:t("delta.new.text"),metrics:null};
  return buildSessionDelta(prev,cur)}
// Stalled = 3+ recent sessions at the same working load with no gain in top-set reps.

// Recover = grinding near failure AND performance did not improve vs prior session (same/lower load).

function round(v){const raw=+state.settings.minJump;const inc=Number.isFinite(raw)&&raw>0?raw:2.5;return Math.round(v/inc)*inc}
function jump(load,mult){return Math.max(load*(+state.settings.jumpPct||0)*mult/100,+state.settings.minJump||2.5)}
function lastBodyweight(){const rows=state.log.filter(r=>+r.bodyweight>0);
  // Until a session logs one, the weight given in setup stands in (Plan 072).
  const profileWeight=interpretedProfile(state.profile).weightKg;
  if(!rows.length)return profileWeight>0?fmt(toDisplay(profileWeight)):"";const latest=rows.sort((a,b)=>compareLogChronology(b,a))[0];
  return fmt(toDisplay(latest.bodyweight))}
function updateBodyweightField(){const el=$("#sessionBodyweight");if(!el)return;
  el.placeholder=unitLabel();
  const lbl=$("#sessionBodyweightLabel")?.querySelector("span");
  if(lbl)lbl.textContent=t("log.bodyweight_unit",{unit:unitLabel()})}
function focusList(){
  if(activeWorkoutDraft&&Array.isArray(activeWorkoutDraft.exerciseOrder)){
    const byId=new Map(exercises().map(e=>[e.id,e]));
    const list=[];
    for(const id of activeWorkoutDraft.exerciseOrder){
      const e=byId.get(id);
      if(e&&!skipped.has(e.id))list.push(e);
    }
    return list;
  }
  const exs=exercises();
  return exs.filter(e=>!skipped.has(e.id))}
function closeWorkoutOverflow(){Focus.setWorkoutOverflow(document,false)}
async function goToLogExercise(exId){
  const ex=prog.find(exId);if(!ex)return;
  if(!await requestWorkoutDay(ex.day))return;
  {
    const fl=focusList(),idx=fl.findIndex(e=>e.id===exId);
    focusUi.index=idx>=0?idx:0;
  }
  const logBtn=$('nav button[data-view="log"]');
  if(logBtn){$$("nav button").forEach(x=>{const on=x===logBtn;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")})}
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="log"));
  document.body.classList.remove("is-settings","is-exercise","is-onboarding","is-library","is-preview","is-import");
  if(!await enterWorkout({}))return;
  const selected=await WorkoutSession.dispatch("selectExercise",{exerciseInstanceId:exId});
  if(selected.status!=="applied")return;
  hydrateDraftCollections(WorkoutSession.projection(),{restoreSelection:true});
  renderWorkout();
  const art=$(`#workout [data-ex="${exId}"]`);if(art){art.scrollIntoView({behavior:scrollBehavior(),block:"center"})}}
/* ---- N1: the dock lens travels (Plan 064 rule 11) ----
   The selected tab sits in one lens: a single `aria-hidden` element that JS puts inside `nav` and places on the
   active button. While it is mounted the active button stops painting its own lens (`nav[data-lens]`); until
   then, and wherever the dock is hidden, the button's own paint stands. Nothing here routes. The dock handler,
   `navTo`, `returnToTab` and `showSettings` keep setting `.active` and `aria-current`, and a MutationObserver
   on those two attributes is the only trigger. A tab change in a dock that was on screen travels the lens with
   `animateIndicator`; the button keeps its 1px ring at rest and sets it aside only while the lens carries one
   in the air (`data-lens="travel"`, as N3 does for the tab indicator). A change while the dock is hidden, a
   resize, a text-size change, or the editor bar swapping in re-snaps with no travel, so the lens is already
   in place when the dock is next seen. */
function mountDockLens(){
  const nav=document.querySelector("nav");
  if(!nav||nav.querySelector(".dock-lens")||typeof MutationObserver!=="function")return null;
  let lens=null,at=null,seenNav=null,shown=false,flight=0;
  const buttons=()=>[...nav.querySelectorAll(":scope > button")];
  const near=(a,b,keys)=>!!a&&!!b&&keys.every(k=>Math.abs(a[k]-b[k])<0.5);
  const BOX=["left","top","width","height"],SHAPE=["left","width","height"];
  const makeLens=()=>{
    const el=document.createElement("span");
    el.className="dock-lens";el.setAttribute("aria-hidden","true");
    nav.append(el);return el};
  /** The nav's border box, or null while the dock is hidden (display:none gives it no box). */
  const navRect=()=>{
    const r=nav.getBoundingClientRect();
    return r.width>0&&r.height>0?{left:r.left,top:r.top,width:r.width,height:r.height}:null};
  /** The button's border box in the nav's padding-box coordinates. A press scales the button about its
   *  centre, which is not where it rests, so the scale is divided back out. */
  const boxOf=(button,n)=>{
    const r=button.getBoundingClientRect(),m=new DOMMatrixReadOnly(getComputedStyle(button).transform);
    const w=r.width/(m.a||1),h=r.height/(m.d||1);
    return {left:r.left+r.width/2-w/2-n.left-nav.clientLeft,top:r.top+r.height/2-h/2-n.top-nav.clientTop,width:w,height:h}};
  const place=box=>{
    lens.style.setProperty("--lens-x",`${box.left}px`);lens.style.setProperty("--lens-y",`${box.top}px`);
    lens.style.setProperty("--lens-w",`${box.width}px`);lens.style.setProperty("--lens-h",`${box.height}px`)};
  function sync(travel){
    const n=navRect();
    if(!n){shown=false;return}
    const active=buttons().find(b=>b.classList.contains("active"));
    if(!active)return;
    const box=boxOf(active,n),calm=shown&&near(n,seenNav,SHAPE);
    if(!lens)lens=makeLens();
    if(at&&near(box,at,BOX)){seenNav=n;shown=true;return}
    if(travel&&calm&&at){
      const from=lens.getBoundingClientRect(),id=++flight;
      at=box;place(box);
      const run=window.RepForgeMotion?.animateIndicator?.(lens,{left:from.left,top:from.top,width:from.width,height:from.height});
      // The helper paints its first frame before it returns: a transform on the lens means it is in the air.
      if(lens.style.transform&&run&&typeof run.then==="function"){
        nav.dataset.lens="travel";
        const done=()=>{if(id===flight)nav.dataset.lens="on"};
        run.then(done,done)}
      else nav.dataset.lens="on";
    }else{
      // A re-snap is never a travel: a run still in the air is left behind with its element.
      if(nav.dataset.lens==="travel"){lens.remove();lens=makeLens()}
      flight++;at=box;place(box);nav.dataset.lens="on"}
    seenNav=n;shown=true}
  sync(false);
  new MutationObserver(()=>sync(true)).observe(nav,{attributes:true,attributeFilter:["class","aria-current"],subtree:true});
  if(typeof ResizeObserver==="function"){
    const resize=new ResizeObserver(()=>sync(false));
    resize.observe(nav);buttons().forEach(b=>resize.observe(b))}
  window.addEventListener("resize",()=>sync(false));
  return nav}
mountDockLens();
function setEvidenceView(view){return ProgressUi.selectEvidence(view)}
function wireStatsTabs(){ProgressUi.mount()}
function setStatsSeg(segment){return ProgressUi.selectSegment(segment)}
window.__repforgeStatsNav={setStatsSeg,setEvidenceView};
// Read-only evidence seam: suites assert the model-backed values the Evidence
// views render, without scraping DOM markup.
window.__repforgeProgressEvidence={
  strength:liftId=>{
    const Model=NativeProgressModel;if(!Model)return null;
    return strengthProjection(ProgressUi.state().strengthScope).series.get(liftId)||null},
  volume:scope=>{
    const Model=NativeProgressModel;if(!Model)return null;
    return Model.buildVolumeEvidence(scope==="block-to-date"?"block-to-date":"this-week",prog.toJSON(),
      progressEvidenceMeta(),readLogRows(),today())},
  records:scope=>strengthEvidenceRecords(scope||ProgressUi.state().strengthScope),
  chartPresentation:n=>n>=3?"trend":n===2?"comparison":"snapshot",
  keyForExerciseId:exId=>{const ex=prog.find(exId);return ex?exerciseLiftKey(ex):null}};
window.__repforgeProgressReview={
  scheduledProgram:()=>scheduledProgramRows(),
};

// Recommendation -> RIR-aware double progression, mapped to a temperature/status.
// Primary signal is the previous session; the block trend nudges it weakly.
/* ---- Progression adapter (Plan 046) ----
   The range arithmetic now lives in progression-engine.js, which was
   extracted from exactly this behavior and is locked by 19 parity fixtures.
   Everything below turns app state into that engine's evidence and turns its
   typed result back into the object the Log tab, the per-set suggestions and
   the "why this weight" sheet already read. No arithmetic here, and no second
   engine: the pure module knows nothing about the DOM, storage, i18n, a
   program family, or an entitlement, and nothing here teaches it.

   Unsupported imported markers are represented as typed manual results rather
   than silently falling back, so a proposed strategy cannot become live by
   accident. */
/** Raw rows for this lift, grouped and ordered exactly the way sessionsFor
 *  groups and orders them, so the engine's own summaries land on the same
 *  numbers the app used to compute inline. */
function progressionHistory(ex){
  const match=matchLift(ex),m=new Map();
  for(const x of state.log){if(!match(x)||!(+x.load>0)||!isWork(x))continue;
    if(!m.has(x.session))m.set(x.session,{sessionId:x.session,date:x.date,created:x.created,sets:[]});
    mergeLogChronology(m.get(x.session),x).sets.push({load:+x.load,reps:+x.reps,rir:x.rir==null?null:+x.rir})}
  return[...m.values()]
    .sort(compareLogChronology)
    .map(s=>({sessionId:s.sessionId,date:s.date,sets:s.sets}))}

/* Legacy progression markers are compatibility data, not a formula switch.
 * This is the complete alias table: the old double-progression marker is the
 * released range contract. Everything else remains recoverable but executes
 * as a manual envelope until an owner-approved rule exists. */


function progressionForExercise(...args){return workoutQueries().progressionForExercise(...args)}
const strategyIdFor=ex=>progressionForExercise(ex)?.strategy?.id||"range";
function canonicalPrescriptionSlot(...args){return workoutQueries().canonicalPrescriptionSlot(...args)}



/* The lifter's smallest load change for a movement owns its candidate loads:
   set per exercise in the program editor, else the global minimum jump. */



/* Keep the engine's current loading context on the program slot boundary.
   The numeric multiplier is also copied into each new log row by workoutProgramContext. */

function recommendation(ex){const value=workoutQueries().recommendation(ex);if(!('labelKey' in value))return value;const {labelKey,...rec}=value;return {...rec,label:labelKey?t(labelKey):''}}
// Re-entry after a load change: the reps this capacity predicts at the NEW load,
// minus the lifter's own habitual RIR, clamped into the range. Replaces the blind
// reset to ex.min — which survives only as the clamp on big percentage jumps.
const reentryReps=(ex,cap,load,typRir)=>clamp(Math.round(repsAtLoad(cap,load)-(+typRir||0)),ex.min,ex.max);
// Base reps target from the previous-session recommendation (no in-session data yet).
// rec.reenterReps is the policy: load-change and snapped-hold recs re-enter on
// capacity; exact-load holds chase one more rep. Hold · recover keeps the prior target.
function baseSetReps(ex,rec,old){
  if(rec.reenterReps)
    return rec.cap>0&&rec.load>0?reentryReps(ex,rec.cap,rec.load,rec.typRir):ex.min;
  const prev=old&&+old.reps>0?+old.reps:null;
  if(prev==null)return ex.min;
  if(!rec.pushReps)return clamp(prev,ex.min,ex.max);
  return clamp(prev+1,ex.min,ex.max)}
// Historical median consecutive-set capacity drop for this lift. Memoized: it walks
// the whole log and setSuggestion runs per set per render — Log-tab speed comes first.


// Expected capacity lost per set: observed today first (needs 2+ sets), else this
// lift's recent history, else zero. Clamped so one blow-up set can't run away with it.

/** Exact-token muscle overlap between two exercise templates — deliberately NOT the
 *  fuzzy includes() the muscle filter uses, so "arms" never matches "forearms".
 *  Primary↔primary full, primary↔secondary half, secondary↔secondary quarter. */

/** Session freshness: how the lifts already finished today are running against their own
 *  capacity baselines, weighted by muscle overlap over a systemic floor. Temper-only —
 *  it can ease a not-yet-started lift's first set, never boost it (decision 7). */

/** No sets of this lift logged yet today: previous-session recommendation, eased by
 *  session freshness. Freshness moves reps; it only touches load when the tempered
 *  target would otherwise fall out of the bottom of the range. */
function baseSuggestion(ex,rec,draft,old){return workoutQueries().setSuggestion(ex,1,rec)}
// Per-set load + reps suggestion, layering three signals:
//  1. previous session (rec.load / baseSetReps) — primary
//  2. current-session performance (completed sets this workout) — strong autoregulation
//  3. block trend (folded into rec) — weak
// In-session prediction is anticipatory: it reads every completed set so far and
// projects the NEXT one, rather than echoing the last set back at the lifter.
/* Working sets this lift has already completed earlier in THIS session, in
   order. Shared by every strategy's in-session path. */
function completedCurrentSets(ex,n,draft){
  const done=new Set(draft.__done||[]),warm=new Set(draft.__warm||[]),sets=[];
  const preserveMissingRir=strategyIdFor(ex)==="effort_target";
  for(let k=1;k<n;k++){const key=`${ex.id}_${k}`;
    if(!done.has(key)||warm.has(key))continue;
    const ld=fromDisplay(parseDec(draft[`${key}_load`])||0),rp=parseDec(draft[`${key}_reps`])||0;
    if(!(ld>0&&rp>0))continue;
    let rir;if(isEffortMode())rir=EFFORT_RIR[draft[`${key}_effort`]]??(preserveMissingRir?null:1);
    else{rir=parseDec(draft[`${key}_rir`]);if(!Number.isFinite(rir))rir=preserveMissingRir?null:1}
    sets.push({load:ld,reps:rp,rir,cap:capE1rm(ld,rp,rir)})}
  return sets}
/* A canonical program's per-set target is the adaptive engine's own result for
   that set: recommendation() already folds this session's completed sets in as
   live anchors, so nothing is re-derived here. The source names how the target
   moved from the last completed set this session. */

function setSuggestion(ex,n,rec,draft,old){return workoutQueries().setSuggestion(ex,n,rec)}
// One-line summary of how the current session is steering the next unlogged set.
function applyAcknowledgedSuggestions(ex,draft){
  for(let n=1;n<=ex.sets;n++){const key=`${ex.id}_${n}`;
    const stored=activeWorkoutDraft?.exercises?.[ex.id],setId=stored?.setOrder?.find(id=>stored.sets[id]?.ordinal===n),set=setId?stored.sets[setId]:null;
    if(committed.has(key)||warmups.has(key)||!set||set.completion!=="pending")continue;
    if(!set.touched.load&&Object.prototype.hasOwnProperty.call(draft,`${key}_load`)){const li=$(`[data-k="${key}_load"]`);if(li)li.value=draft[`${key}_load`]??""}
    if(!set.touched.reps&&Object.prototype.hasOwnProperty.call(draft,`${key}_reps`)){const ri=$(`[data-k="${key}_reps"]`);if(ri)ri.value=draft[`${key}_reps`]??""}}}
const hasCommittedSets=ex=>{for(let n=1;n<=ex.sets;n++)if(committed.has(`${ex.id}_${n}`))return true;return false};
/* Recommended metric values fill only pending sets the lifter has not touched. */
function metricSuggestionUpdates(stored,rec){
  const updates=[];
  for(const setId of stored.setOrder){
    const set=stored.sets[setId];
    if(!set||set.role==="warmup"||set.completion!=="pending")continue;
    const target=rec.targetSets?.find(item=>item.prescription.setIndex===set.ordinal);
    if(target?.status!=="recommended")continue;
    const metrics={};
    for(const metric of set.programmed.metrics||[]){
      const value=target.result.targets?.[metric.semantic];
      if(typeof value==="number"&&!set.touched.metrics?.[metric.id])metrics[metric.id]=canonicalNumberText(value)}
    if(Object.keys(metrics).length)updates.push({exerciseInstanceId:stored.exerciseInstanceId,setId,fields:{metrics}})}
  return updates}
function suggestionUpdatesFor(ex,draft){
  const stored=activeWorkoutDraft?.exercises?.[ex.id];
  if(!stored||stored.status==="skipped")return[];
  if(stored.setOrder.some(setId=>Array.isArray(stored.sets[setId]?.programmed?.metrics)))
    return metricSuggestionUpdates(stored,recommendation(ex));
  const rec=recommendation(ex),prev=last(ex),updates=[];
  for(let n=1;n<=ex.sets;n++){
    const key=`${ex.id}_${n}`,setId=stored.setOrder.find(id=>stored.sets[id]?.ordinal===n),set=setId?stored.sets[setId]:null;
    if(!set||set.role==="warmup"||set.completion!=="pending")continue;
    const sg=setSuggestion(ex,n,rec,draft,prev.find(x=>x.set===n)),fields={};
    if(sg.load!=null&&!set.touched.load)fields.load=canonicalNumberText(sg.load);
    if(sg.reps!=null&&!set.touched.reps)fields.reps=String(sg.reps);
    if(Object.keys(fields).length)updates.push({exerciseInstanceId:ex.id,setId,fields});
  }
  return updates}
function showSuggestionFailure(exId,result){
  if(result.status!=="refresh-failed")return result;
  const retryAction=async()=>{
    const prior=draftUiRecovery;
    if(prior)prior.allowRetry=true;
    try{
      const retry=await workoutSuggestions.refresh(exId);
      return retry.status==="unchanged"?{status:"applied",noOp:true}:retry}
    finally{if(draftUiRecovery===prior)draftUiRecovery.allowRetry=false}};
  draftUiRecovery={kind:"persist",status:"refresh-failed",attempt:null,pendingValue:null,
    copyValue:null,copyKind:"value",focus:draftFocusIdentity(),retry:true,retryAction,discard:false,allowRetry:false};
  renderDraftRecovery();focusDraftRecovery();
  return result}
// Suggestion commands acknowledge values before this presentation-only update.
async function refreshSuggestions(exId){
  const result=await workoutSuggestions.refresh(exId);
  if(result.status!=="applied"&&result.status!=="unchanged")return showSuggestionFailure(exId,result);
  const ex=prog.find(exId);if(!ex)return result;const draft=WorkoutSession.projection();
  applyAcknowledgedSuggestions(sessionExercise(ex),draft);
  for(const o of exercises(ex.day)){if(o.id===ex.id||hasCommittedSets(o))continue;
    applyAcknowledgedSuggestions(sessionExercise(o),draft)}
  return result}
function fmtClock(s){const sec=Math.max(0,Math.round(Number(s)||0));const m=Math.floor(sec/60);return `${m}:${String(sec%60).padStart(2,"0")}`}
/** Rest reads in two places: the floating bar outside the workout and the chip
 *  in the workout header, where it must never sit over a control.
 *  `over` is seconds elapsed past the bell: the clock then counts up as "+m:ss",
 *  in the same soft ink as the inline "Rest done" line, and is not a warning. */
function paintRest(text,done,over=0){
  paintRestSheet();
  restInlineSync();
  const b=$("#restBar");
  if(b){const el=b.querySelector(".restbar__time");if(el)el.textContent=text;
    b.classList.toggle("is-done",!!done);
    b.classList.toggle("is-over",over>0);
    b.classList.toggle("is-paused",focusRest.paused!=null)}
  const chip=$("#woRest");if(!chip)return;
  const el=chip.querySelector(".wo-rest__time");if(el)el.textContent=text;
  chip.classList.toggle("is-done",!!done);
  chip.classList.toggle("is-over",over>0);
  chip.classList.toggle("is-paused",focusRest.paused!=null);
  const running=chip.classList.contains("is-running");
  if(!running)chip.setAttribute("aria-label",t("focus.rest.start_aria"));
  else if(focusRest.paused!=null)chip.setAttribute("aria-label",t("focus.rest.paused_aria",{time:text}));
  else if(over>0)chip.setAttribute("aria-label",t("focus.rest.over_aria",{time:fmtClock(over)}));
  else chip.setAttribute("aria-label",t(done?"focus.rest.done_aria":"focus.rest.running_aria",{time:text}))}
/** Show or hide the header chip, and keep the floating bar out of Focus. */
function updateRestChrome(){RestPresentation.chrome(workoutActive,+state.settings.restSec>0)}
function stopRest(){focusRest.stop();
  $("#restBar")?.classList.add("hidden");paintRest("—",false);updateRestChrome();
  const ra=$("#restAnnounce");if(ra)ra.textContent="";
  if(Notifications)Notifications.closeTag("repforge-rest")}
const REST_OVERTIME_MAX=60*60;
/** Milliseconds left on the clock: frozen while held, and negative once the
 *  rest has run past the bell. Idle, it reads as the length the next rest
 *  would run for — which is what the sheet shows before anything is armed. */
function restLeftMs(){return focusRest.left(normalizeRestSec(state?.settings?.restSec))}
function restOvertimeSec(){return focusRest.end?Math.round(-restLeftMs()/1000):0}
/** Whole seconds left, as the clock reads them: zero or negative once the bell has gone. */
const restTimeLeftSec=()=>Math.round(restLeftMs()/1000);
/** One-shot side effects at zero: the live-region line, buzz, or OS notice. */
function ringRest(){
  announceRestDone();
  if(focusRest.notified)return;
  focusRest.notified=true;
  if(!Notifications||!Notifications.enabledFor(state.settings,"timer"))return;
  if(document.visibilityState==="visible")navigator.vibrate?.([200,100,200]);
  else Notifications.fireOS({title:t("notify.title"),body:t("notify.rest.body"),tag:"repforge-rest",url:"./"})}
function tickRest(){const left=Math.round(restLeftMs()/1000);
  if(left>0){paintRest(fmtClock(left),false);return}
  const over=Math.min(-left,REST_OVERTIME_MAX);
  paintRest(over>0?`+${fmtClock(over)}`:"0:00",true,over);
  if(over>=REST_OVERTIME_MAX)focusRest.disarm()
  ringRest()}
function armRestTick(){focusRest.arm(tickRest)}
function syncRest(){
  if(!focusRest.end){paintRest("—",false);updateRestChrome();return}
  const left=Math.round(restLeftMs()/1000);
  if(left>0)paintRest(fmtClock(left),false);
  else{const over=Math.min(-left,REST_OVERTIME_MAX);paintRest(over>0?`+${fmtClock(over)}`:"0:00",true,over)}
  updateRestChrome()}
function startRest(sec){const s=sec||restPlanSec();if(!focusRest.start(s))return;
  if(Notifications)Notifications.closeTag("repforge-rest");
  const ra=$("#restAnnounce");if(ra)ra.textContent="";
  $("#restBar")?.classList.remove("hidden");updateRestChrome();paintRest(fmtClock(s),false);
  announceRestStart(s);armRestTick()}
function announceRestStart(sec){
  const el=$("#restAnnounce");if(!el)return;
  el.textContent="";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(focusRest.end&&!focusRest.announced)el.textContent=t("rest.inline.started",{time:fmtClock(sec)})}))}
window.__repforgeRest={expire:over=>focusRest.expire(over),stop:stopRest,openSheet:openRestSheet};

/* ---- Rest presets sheet ---- */
/* The running clock lives inline in the Focus cue slot (see "Inline rest"
   below). The header timer opens this sheet instead: it keeps the lengths a
   lifter can pick, the 30s nudges, Pause or Resume, a restart and an explicit
   end. Every operation of the clock is reachable from here, because the inline
   pad row that also holds them gives way to the field pads once a field is
   tapped, while a set is corrected, and at large text. */
const REST_NUDGE=Focus.REST_NUDGE;
function restPlanSec(){return focusRest.plan(normalizeRestSec(state?.settings?.restSec))}
let RestSheet;
function restSheet(){return RestSheet||(RestSheet=Focus.createRestSheet({window,clock:focusRest,shell:shellView(),
  motion:ensureBrowserPresentation().motion,readDefaultSeconds:()=>normalizeRestSec(state?.settings?.restSec),copy:{t},
  commands:{start:startRest,length:setRestLength,nudge:nudgeRest,hold:toggleRestHold,reset:resetRest,stop:stopRest}}))}
function paintRestSheet(){return restSheet().paint()}
function openRestSheet(){return restSheet().open()}
function closeRestSheet(){return restSheet().close()}
/** Picking a length restarts the rest at it; idle, it only sets what the next
 *  one will run for. */
function setRestLength(sec){
  const s=focusRest.clamp(sec);
  focusRest.length=s;
  if(focusRest.end)startRest(s);
  else syncRest();
  paintRestSheet()}
/** ±30s moves the clock, not the plan — except when the nudge pushes past the
 *  length it was armed at, which becomes the new full length of the drain bar. */
function nudgeRest(delta){
  const result=focusRest.nudge(delta,normalizeRestSec(state?.settings?.restSec));
  if(result.rearmed){const ra=$("#restAnnounce");if(ra)ra.textContent="";
    if(Notifications)Notifications.closeTag("repforge-rest");
    if(result.needsTick)armRestTick()}
  syncRest();if(result.idle)paintRestSheet()}
function toggleRestHold(){const result=focusRest.toggleHold(normalizeRestSec(state?.settings?.restSec));
  if(result.idle){startRest(restPlanSec());return}
  if(result.needsTick)armRestTick();syncRest()}
function resetRest(){if(!focusRest.end)return;startRest(restPlanSec())}
/** Pular on the inline pad. It ends the rest the way the bell does: the clock
 *  stands at zero and its overrun counts up from there (owner decision on
 *  OG-4, proposal 5). The lifter ended it, so there is no buzz or OS notice;
 *  the live region still says it is over. */
function skipRest(){if(!focusRest.skip(normalizeRestSec(state?.settings?.restSec)))return;
  if(Notifications)Notifications.closeTag("repforge-rest");armRestTick();tickRest()}
function restAct(act){
  if(act==="minus")nudgeRest(-REST_NUDGE);
  else if(act==="plus")nudgeRest(REST_NUDGE);
  else if(act==="pause")toggleRestHold();
  else if(act==="skip")skipRest()}
const restInlineSync=()=>focusView().restSync();
/** Shared visibility handler — rest-timer catch-up + session banner. */
function onAppVisible(){
  if(document.visibilityState!=="visible")return;
  if(focusRest.end&&focusRest.paused==null&&Date.now()>=focusRest.end){
    // Background throttling freezes the tick; repaint from the clock, then let
    // the count-up carry on unless it has already run out its overtime.
    tickRest();
    if(!focusRest.ticking&&restOvertimeSec()<REST_OVERTIME_MAX)armRestTick();
  }
  reconcileNotifyPermission();
  paintNotifyControls();
  updateSessionBanner();
}

function updateSessionBanner(){
  const el=$("#sessionBanner"); if(!el) return;
  const n=state.settings.notify;
  const hide=()=>{el.className="sessionbanner hidden"; el.innerHTML=""; el.onclick=null};
  if(!n||!n.enabled) return hide();
  if(schedule.hasLoggedOn(state.log, today())) return hide();
  if(!state.log.length) return hide();

  const due=schedule.mostOverdueDay(state.log, days(), today());
  if(!due) return hide();

  const meta=loadNotifyMeta();
  const hour=new Date().getHours();
  const usual=schedule.usualHour(state.log);
  const missedOk=!!n.missed && usual!=null && hour>=usual;
  const sessionOk=!!n.session;

  if(!missedOk && !sessionOk) return hide();
  if(!missedOk && meta.sessionBannerDate===today() && meta.sessionBannerDismissed) return hide();
  if(missedOk && meta.missedBannerDate===today() && meta.missedBannerDismissed) return hide();

  const isMissed=missedOk;
  const title=isMissed?t("session_banner.missed.title",{hour:usual}):t("session_banner.today.title",{day:dayLabel(due.day)});
  const body=isMissed?t("session_banner.missed.body",{day:dayLabel(due.day)}):t("session_banner.today.body",{day:dayLabel(due.day)});

  function dismissForToday(){
    const m=loadNotifyMeta();
    if(isMissed){m.missedBannerDate=today(); m.missedBannerDismissed=true}
    else{m.sessionBannerDate=today(); m.sessionBannerDismissed=true}
    saveNotifyMeta(m);
    hide();
  }

  el.className=`sessionbanner${isMissed?" is-missed":""}`;
  el.innerHTML=`<button type="button" class="sessionbanner__act"><p class="sessionbanner__title">${esc(title)}</p><p class="sessionbanner__body">${esc(body)}</p></button>`+
    `<button type="button" class="sessionbanner__close" aria-label="${esc(t("session_banner.dismiss_aria"))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`;
  el.onclick=null;
  el.querySelector(".sessionbanner__close").onclick=e=>{e.stopPropagation();dismissForToday()};
  el.querySelector(".sessionbanner__act").onclick=async()=>{
    if(!await enterWorkout({day:due.day}))return;
    dismissForToday();
    toast(t("toast.day_ready",{day:dayLabel(due.day)}));
  };
}

function draftHasProgress(){try{const d=JSON.parse(DraftStore.readRaw()||"{}");
  return draftHasSessionWork(d)||!!contextFlagsFromDraft(d).day}catch{return false}}
function setWorkoutActive(on){const was=workoutActive;workoutActive=!!on;
  const dash=$("#todayDash"),shell=$("#workoutShell");
  // N5: Today to Focus is the same push as a drill-down, and Back from Focus is it
  // run the other way. Finishing a session clears the draft first, so the card has
  // nothing left to carry out and that exit stays instant.
  const settle=workoutActive!==was&&(workoutActive||activeWorkoutDraft)
    ?routePushBegin(workoutActive?"in":"out",{pushed:shell,under:dash}):null;
  document.body.classList.toggle("is-workout",workoutActive);
  if(dash)dash.classList.toggle("hidden",workoutActive);
  if(shell)shell.classList.toggle("hidden",!workoutActive);
  if(!workoutActive){document.body.classList.remove("is-focus-wo");closeWorkoutOverflow()}
  updateFocusChrome();
  if(workoutActive!==was){
    if(settle)settle();
    else playPanelAnimation(workoutActive?shell:dash,workoutActive?"wo-anim-enter":"wo-anim-leave");
    // Focus lands on the surface the lifter moved to, once the move has rendered:
    // Focus's day title going in, Today's leading control coming back. Not at boot,
    // where a resumed session is the page itself and not a hand-off.
    if(window.__repforgeBooted===true)queueMicrotask(()=>{
      if(workoutActive)focusRoute($("#woDayTitle"));
      else focusRoute(todayPrimaryControl())})}}
/** Replay a one-shot CSS animation on a panel that just became visible. */
function playPanelAnimation(el,cls){if(!el)return;
  el.classList.remove("wo-anim-enter","wo-anim-leave");
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener("animationend",()=>el.classList.remove(cls),{once:true})}
function updateFocusChrome(){document.body.classList.toggle("is-focus-wo",workoutActive);
  updateRestChrome()}

/* ---- Exercise note sheet ---- */
let exNoteFor=null,exNoteReturn=null;
function openExNoteSheet(exId){
  const ex=prog.find(exId);if(!ex||!activeWorkoutDraft)return;
  const sheet=$("#exNoteSheet"),scrim=$("#exNoteScrim"),ta=$("#exNoteText");
  if(!sheet||!ta)return;
  exNoteFor=exId;exNoteReturn=document.activeElement;
  $("#exNoteFor").textContent=exerciseDisplayName(sessionExercise(ex));
  ta.value=String(activeWorkoutDraft.exercises?.[exId]?.setupNotes??"");
  document.body.classList.add("is-sheet-open");
  openModal(sheet,{
    initialFocus:ta,
    returnFocus:exNoteReturn,
    onEscape:closeExNoteSheet,
    scrim,
    delayHide:reducedMotion()?0:280
  });
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open");
    if(ta===document.activeElement)ta.setSelectionRange(ta.value.length,ta.value.length)})}
function closeExNoteSheet(){
  const sheet=$("#exNoteSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(shellView().activeModal&&shellView().activeModal.el===sheet))return Promise.resolve(false);
  exNoteFor=null;exNoteReturn=null;
  return closeModal(sheet)}
async function saveExNoteSheet(){
  const id=exNoteFor,val=$("#exNoteText")?.value??"";
  if(id){const ta=$(`[data-exnote="${id}"]`);if(ta)ta.value=val;
    if(!activeWorkoutDraft)return;
    await WorkoutSession.dispatch("setExerciseNotes",{exerciseInstanceId:id,value:val})}
  await closeExNoteSheet();
  if(id)renderWorkout()}
/* ---- Day picker sheet ---- */
/* Today leads with one day, and a split is rarely trained in order: a machine is
 * taken, a session is swapped, a day is skipped. The picker is how the lifter
 * takes another one from Today, instead of starting the wrong day to reach the
 * day tabs inside the workout. */
/** The day the sheet is armed on: chosen, not yet started. */
let dayPickSelected=null;
/* A default-named day is already numbered by its badge, so "Day 3 / Day 3" is
 * two labels for nothing: the row leads with what that day trains instead. A day
 * the lifter named leads with the name, and keeps the muscles in the line under
 * it. */
function dayPickRowHtml(d,i){
  const named=!DEFAULT_DAY_NAME.test(String(d).trim()),label=dayLabel(d);
  const muscles=dayMuscles(d).map(muscleLabel).join(" · ");
  const count=tOne("today.exercise_count",exercises(d).length);
  const title=named?label:(muscles||label);
  const sub=named&&muscles?`${muscles} · ${count}`:count;
  const isToday=d===day,chip=t("today.choose_day_current");
  // The badge is a numeral, so the day it stands for is spelled out for anyone
  // who only hears the row.
  const aria=[label,title===label?"":title,sub,isToday?chip:""].filter(Boolean).join(" · ");
  return `<button type="button" class="daypick__row${d===dayPickSelected?" is-selected":""}" data-daypick="${esc(d)}"`+
    ` aria-pressed="${d===dayPickSelected?"true":"false"}" aria-label="${esc(aria)}">`+
    `<span class="daypick__n" aria-hidden="true">${esc(String(i+1))}</span>`+
    `<span class="daypick__main"><span class="daypick__line"><span class="daypick__title">${esc(title)}</span>`+
    (isToday?`<span class="daypick__chip">${esc(chip)}</span>`:"")+
    `</span><span class="daypick__sub">${esc(sub)}</span></span>`+
    `</button>`}
function renderDayPickList(){const list=$("#dayPickList");if(!list)return;
  list.innerHTML=days().map(dayPickRowHtml).join("");
  $$("#dayPickList [data-daypick]").forEach(b=>b.onclick=()=>armPickerDay(b.dataset.daypick))}
/** Arming repaints in place rather than rebuilding the list, so the row the
 *  keyboard is on is still there to keep the focus. */
function paintDayPickList(){
  $$("#dayPickList [data-daypick]").forEach(b=>{
    const on=b.dataset.daypick===dayPickSelected;
    b.classList.toggle("is-selected",on);
    b.setAttribute("aria-pressed",on?"true":"false")})}
function armPickerDay(d){
  if(!d||!days().includes(d))return;
  dayPickSelected=d;
  paintDayPickList()}
/** `resume` gives the picker back from the day-change question on the day that was armed, taking the question's place. */
function openDayPickSheet({resume=false}={}){
  const sheet=$("#dayPickSheet"),scrim=$("#dayPickScrim");
  if(!sheet)return;
  if(!resume)dayPickSelected=day;
  renderDayPickList();
  const bandClose=sheet.querySelector("[data-daypick-close]");if(bandClose)bandClose.onclick=()=>closeDayPickSheet();
  document.body.classList.add("is-sheet-open");
  openModal(sheet,{
    initialFocus:$("#dayPickList .daypick__row.is-selected")||$("#dayPickList .daypick__row"),
    onEscape:closeDayPickSheet,
    scrim,
    delayHide:reducedMotion()?0:280,
    handoff:resume
  });
  // A handoff hides the sheet it replaces, which also lowers the page-behind marker.
  document.body.classList.add("is-sheet-open");
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}
function closeDayPickSheet(){
  const sheet=$("#dayPickSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(shellView().activeModal&&shellView().activeModal.el===sheet))return Promise.resolve(false);
  return closeModal(sheet)}
/** Confirming starts the armed day, exactly as Up next and the session banner
 *  do. The discard prompt is answered while the sheet is still up, so declining
 *  it leaves the picker open on the day already loaded. */
async function confirmPickerDay(){
  const next=dayPickSelected;
  if(!next||!days().includes(next))return;
  if(!await requestWorkoutDay(next))return;
  await closeDayPickSheet();
  await enterWorkout({day:next});
  toast(t("toast.day_ready",{day:dayLabel(next)}))}
/** Keep the sheet above the software keyboard rather than behind it, and inside
 *  the band the keyboard leaves visible so its header stays on screen.
 *  The keyboard shrinks the visual viewport but not dvh, so a field in Focus's
 *  shelf (pinned to the bottom of a 100dvh screen) opened behind it, and the
 *  browser's own focus scroll left it half covered (#300). While a field is being
 *  edited with the keyboard up, `data-keyboard` lets Focus size itself to the
 *  visible band, and the field is brought fully into that band once the band is
 *  known; when the keyboard goes, Focus drops any scroll the browser left behind. */
function trackSheetViewport(){
  const vv=window.visualViewport;if(!vv)return;
  const root=document.documentElement;
  let settle=0;
  const editing=()=>{const el=document.activeElement;
    return el?.matches?.("input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),textarea,[contenteditable=true]")?el:null};
  const apply=()=>{
    // Pinching reduces CSS-pixel height without opening a keyboard. Normalize
    // that reduction; panning a zoomed view must not move the app's dock.
    const scale=vv.scale||1,zoomed=Math.abs(scale-1)>.01;
    const height=Math.min(window.innerHeight,vv.height*scale),top=zoomed?0:vv.offsetTop;
    const inset=Math.max(0,window.innerHeight-height-top);
    root.style.setProperty("--kb",`${Math.round(inset)}px`);
    root.style.setProperty("--vvh",`${Math.round(height)}px`);
    root.style.setProperty("--vv-top",`${Math.round(top)}px`);
    const field=editing(),up=!!field&&window.innerHeight-height>1,was=root.dataset.keyboard==="up";
    if(up)root.dataset.keyboard="up";else delete root.dataset.keyboard;
    cancelAnimationFrame(settle);
    if(!zoomed&&up&&field.closest(".focus-shelf"))settle=requestAnimationFrame(()=>{
      if(document.activeElement!==field)return;
      // Client coordinates are layout-viewport relative; the band on screen is [offsetTop, offsetTop + height].
      const r=field.getBoundingClientRect();
      if(r.top<vv.offsetTop||r.bottom>vv.offsetTop+vv.height)field.scrollIntoView({block:"nearest",inline:"nearest"})});
    else if(!zoomed&&was&&!up&&document.body.classList.contains("is-focus-wo")&&(window.scrollY||window.scrollX))window.scrollTo(0,0)};
  vv.addEventListener("resize",apply);vv.addEventListener("scroll",apply);
  document.addEventListener("focusin",apply);
  // Focus leaves before it lands anywhere else, so read where it went once it has.
  document.addEventListener("focusout",()=>setTimeout(apply,0));
  apply()}
/* ---- Swipe down to dismiss (every bottom sheet) ---- */
/* The grab handle promises a sheet that can be pushed back down, so the gesture
 * has to answer: the sheet follows the thumb, and past a real commitment it
 * keeps going and closes instead of springing back. A completed swipe runs the
 * sheet's own dismiss — the same one Escape and a tap on the scrim run — so it
 * can never save or copy something a tap wouldn't. */
let sheetDrag=null;
const SHEET_DRAG_LOCK=8;
/** True when the gesture belongs to a scroller inside the sheet: something the
 *  lifter has already scrolled down keeps the drag, and scrolls back up. */
function sheetScrollHeld(target,sheet){
  for(let n=target;n instanceof Element&&n!==sheet;n=n.parentElement){
    if(n.scrollHeight>n.clientHeight+1&&n.scrollTop>0)return true}
  return false}
/* user-select is inherited by WebKit/Chromium, but other engines can report
 * auto on a child of selectable prose. Stop at a control's explicit none. */
function isNativeTextSelectionTarget(target){
  for(let el=target;el;el=el.parentElement){
    const policy=getComputedStyle(el).userSelect;
    if(policy==="none")return false;
    if(policy==="text")return true}
  return false}
function sheetDragStart(e){
  if(sheetDrag)return;
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const rec=shellView().activeModal;
  if(!rec||rec.closing||typeof rec.onEscape!=="function")return;
  if(!rec.el?.classList.contains("sheet"))return;
  const target=e.target instanceof Element?e.target:null;
  if(!target||!rec.el.contains(target))return;
  // A mouse inside a text field is selecting, not swiping. A thumb in one has no
  // other use for a downward drag once the field is already at its top.
  if(e.pointerType==="mouse"&&(target.closest("input,select,textarea,[contenteditable]")||isNativeTextSelectionTarget(target)))return;
  if(sheetScrollHeld(target,rec.el))return;
  sheetDrag={id:e.pointerId,x:e.clientX,y:e.clientY,dy:0,live:false,rec,
    vy:0,lastY:e.clientY,lastT:e.timeStamp||performance.now()}}
function sheetDragMove(e){
  if(!sheetDrag||e.pointerId!==sheetDrag.id)return;
  const rec=sheetDrag.rec;
  if(shellView().activeModal!==rec||rec.closing){sheetDragEnd();return}
  const dy=e.clientY-sheetDrag.y,dx=e.clientX-sheetDrag.x;
  if(!sheetDrag.live){
    // Upwards or sideways is somebody else's gesture; only a downward push takes
    // the sheet, and only once it has cleared the slop a resting thumb wanders.
    if(dy<=-SHEET_DRAG_LOCK||(Math.abs(dx)>=SHEET_DRAG_LOCK&&Math.abs(dx)>Math.abs(dy))){sheetDrag=null;return}
    if(dy<SHEET_DRAG_LOCK)return;
    sheetDrag.live=true;
    rec.el.classList.add("is-dragging");
    rec.scrim?.classList.add("is-dragging");
    // A sheet grabbed again while it is still springing back has a spring
    // painting its transform. Stop that one first: two writers on the same
    // property means whichever finishes last wins, and the loser is the thumb.
    if(rec.motion){rec.motion.cancel();rec.motion=null}
    sheetDrag.motion=window.RepForgeMotion?.trackSheetGesture(rec.el,rec.scrim)||null;
    // The sheet can also be torn down mid-gesture — Escape, a save, a tour step
    // — and whatever cleans it up has to be able to stop the animation too.
    rec.motion=sheetDrag.motion;
    // Anchor where the drag was recognised, so the sheet doesn't jump by the slop.
    sheetDrag.y=e.clientY-SHEET_DRAG_LOCK}
  const now=e.timeStamp||performance.now(),dt=now-sheetDrag.lastT;
  if(dt>0){sheetDrag.vy=(e.clientY-sheetDrag.lastY)/dt;sheetDrag.lastY=e.clientY;sheetDrag.lastT=now}
  sheetDrag.dy=Math.max(0,e.clientY-sheetDrag.y);
  // Motion holds the sheet's position in a value it can spring from later, so
  // the release carries the thumb's velocity. Without the runtime the sheet is
  // placed the same way it always was and the stylesheet finishes the gesture.
  if(sheetDrag.motion)sheetDrag.motion.follow(sheetDrag.dy);
  else{
    rec.el.style.transform=`translate3d(0,${sheetDrag.dy}px,0)`;
    // The scrim thins as the sheet leaves, so the page behind is already coming back.
    if(rec.scrim)rec.scrim.style.opacity=String(Math.max(0,1-sheetDrag.dy/(rec.el.offsetHeight||1)))}}
/** Hand the sheet back to the stylesheet. Dropping the inline transform in the
 *  same tick as the class restores the transition from wherever the thumb left
 *  it, so the sheet either springs back or carries on down — never cuts. */
function sheetDragRelease(rec){
  rec.el.classList.remove("is-dragging");
  if(rec.motion){rec.motion.cancel();rec.motion=null}
  rec.el.style.transform="";
  rec.scrim?.classList.remove("is-dragging");
  if(rec.scrim)rec.scrim.style.opacity=""}
function sheetDragEnd(e){
  if(!sheetDrag||(e&&e.pointerId!=null&&e.pointerId!==sheetDrag.id))return;
  const{rec,dy,vy,live,motion}=sheetDrag;sheetDrag=null;
  if(!live)return;
  if(e?.type==="pointercancel"){sheetDragRelease(rec);return}
  // The drag ends over whatever the thumb started on, so a button under it must
  // not also fire.
  if(dy>SHEET_DRAG_LOCK)swallowNextClick();
  // A deliberate throw counts as much as a long push (0.5px/ms is a flick), and
  // anything short of either is the lifter changing their mind.
  const flick=vy>=.5&&dy>=32;
  const dismiss=flick||dy>=Math.min(160,Math.max(64,(rec.el.offsetHeight||0)*.32));
  const gone=shellView().activeModal!==rec||rec.closing;
  if(!motion){
    // No runtime: the stylesheet finishes the gesture exactly as it did before.
    sheetDragRelease(rec);
    if(!gone&&dismiss)rec.onEscape();
    return}
  rec.el.classList.remove("is-dragging");
  rec.scrim?.classList.remove("is-dragging");
  if(gone){sheetDragRelease(rec);return}
  // The sheet keeps the speed it was let go at: a flick carries it the rest of
  // the way out, a change of mind is caught and put back. Either way `onEscape`
  // is the sheet's own dismiss, so a swipe can never close something a tap
  // could not.
  if(dismiss){motion.dismiss({velocity:vy});rec.onEscape()}
  else motion.settle({velocity:vy}).finally(()=>{if(rec.motion===motion)rec.motion=null})}
let FocusNavigation;
function focusNavigation(){return FocusNavigation||(FocusNavigation=Focus.createFocusNavigation({focus:focusUi,
  read:()=>({hasDraft:!!activeWorkoutDraft,exercises:focusList()}),workout:WorkoutSession,motion:ensureBrowserPresentation().motion,
  onSelection:({scrollTop})=>{renderWorkout();if(scrollTop)window.scrollTo({top:0})}}))}
function focusGo(direction){return focusNavigation().go(direction)}
function focusJump(index){return focusNavigation().jump(index)}
function focusCanGo(direction){return focusNavigation().canGo(direction)}
function focusCard(){return focusGestureView().card()}
function focusTrack(){return focusGestureView().track()}
function focusStep(){return focusGestureView().step()}

const reducedMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
/** `behavior` for a programmatic scroll. The motion layer owns the reduced-motion decision (RepForgeMotion.reducedMotion),
 *  so a smooth scroll is only ever asked for when motion is welcome; reduced motion jumps. */
const scrollBehavior=()=>(window.RepForgeMotion?.reducedMotion?.()??!!reducedMotion())?"auto":"smooth";
/** Carry the deck one card over, animating the track exactly as a fling does,
 *  then re-render at the new index with the track back at rest. Chevrons, the
 *  Next exercise button, the arrow keys and a completed swipe all land here.
 *
 *  This stays a plain 210ms transition, deliberately. A spring was tried and
 *  taken back out: the card is delivered to a fixed slot, the deck is locked for
 *  the length of the slide so there is nothing to interrupt, and the spring's
 *  tail pushed the index change — which waits on the slide — from 210ms out past
 *  300ms. Motion earns its cost where a gesture is still live; here it only cost
 *  responsiveness. `focusSettle` below is the half of this that is a real catch,
 *  and that half does use a spring. */
function focusAnimateTo(dir){
  return ensureBrowserPresentation().motion.navigate(dir)}
function fallbackFocusAnimateTo(dir){return focusGestureView().navigate(dir)}

/** One place that writes the track's transform, so drag, fling and reset agree. */
function focusSetTrack(track,dx){return focusGestureView().setTrack(track,dx)}
function focusDragStart(e){return focusGestureView().dragStart(e)}

function focusDragMove(e){return focusGestureView().dragMove(e)}
const swallowedClickStops=new Set();
function swallowNextClick(){
  const stop=ev=>{ev.stopPropagation();ev.preventDefault()};
  swallowedClickStops.add(stop);
  document.addEventListener("click",stop,{capture:true,once:true});
  setTimeout(()=>{document.removeEventListener("click",stop,{capture:true});swallowedClickStops.delete(stop)},350)}
/** A drag that commits a route (the edge swipe) runs the visible control's own
 *  handler, which is a click; the swallow the drag, or one just before it, set for
 *  the browser's stray click would eat it. */
function releaseSwallowedClick(){
  for(const stop of swallowedClickStops)document.removeEventListener("click",stop,{capture:true});
  swallowedClickStops.clear()}

function focusDragEnd(e){return focusGestureView().dragEnd(e)}
async function enterWorkout(opts={}){if(opts.day&&!await requestWorkoutDay(opts.day))return false;
  if(opts.day)focusUi.index=0;
  const prepared=await WorkoutSession.start(day);
  if(prepared.status!=="ready"){
    showDraftInitializationRecovery(prepared,{retryMode:"create",label:day});return false}
  clearDraftUiRecovery();
  // Recommendations fill the day's untouched pending values before the first paint.
  const firstExercise=exercises(day)[0];
  if(firstExercise)await refreshSuggestions(firstExercise.id);
  workoutLeft=false;setWorkoutActive(true);
  hydrateDraftCollections(WorkoutSession.projection(),{restoreSelection:true});
  // Focus is the sole workout route.
  document.body.classList.add("is-focus-wo");
  renderTabs();renderWorkout();renderToday();window.scrollTo({top:0});return true}
async function leaveWorkout(){
  if(document.activeElement&&document.activeElement.tagName==="INPUT"){
    document.activeElement.blur();
  }
  if(!await WorkoutSession.leave()){
    toast(t("workout.leave_failed"));
    showDraftCommandRecovery("storage-error",draftUiRecovery?.attempt||{});
    return false;
  }
  workoutLeft=true;focusUi.edit=null;setWorkoutActive(false);document.body.classList.remove("is-focus-wo");renderToday();window.scrollTo({top:0});
  return true;
}
function dayMuscles(d){return ReadModels.programDayMuscles(scheduledProgramRows(),d||day)}
function formatLongDate(iso){const d=new Date(`${iso}T12:00:00`);if(Number.isNaN(+d))return iso;
  try{const s=d.toLocaleDateString(I18N?.speechLang?.()||state.settings.lang||"en",{weekday:"long",day:"numeric",month:"long"});
    return s?s.charAt(0).toUpperCase()+s.slice(1):s}
  catch{return iso}}
function weekdayLetters(){return isPt()?["S","T","Q","Q","S","S","D"]:["M","T","W","T","F","S","S"]}
/** Sessions saved today, in the order they were logged. */
function sessionsToday(){return ReadModels.sessionsOnDate(state.log,today())}
/** What today already holds, or null when nothing is logged yet. Today swaps its
 *  whole session block for this: a finished day is not one to start again. */
function todayRecap(week){const sessions=sessionsToday();if(!sessions.length)return null;
  const iso=today(),work=sessions.flatMap(s=>s.rows).filter(isWork);
  const doneDays=[...new Set(sessions.map(s=>s.day).filter(Boolean))];
  // A lift's first appearance sets its bests without beating anything, so only
  // events carrying a delta are records the lifter actually broke today.
  const prLifts=new Set((week?.prs||[])
    .filter(ev=>String(ev.date)===iso&&(ev.deltaLoad!=null||ev.deltaReps!=null||ev.deltaE1rm!=null))
    .map(ev=>ev.liftKey));
  return{sessions,days:doneDays,lastDay:sessions.at(-1).day||day,
    muscles:[...new Set(work.map(r=>String(rowMuscles(r).primary||"").split(",")[0].trim()).filter(Boolean))].slice(0,3),
    sets:work.length,volume:movedTonnage(work),prs:prLifts.size,
    lifts:new Set(work.map(liftKey)).size,rows:sessions.flatMap(s=>s.rows),session:sessions.at(-1).session}}
/** The program day that follows `from`, or null when the split has only one. */
function nextDayAfter(from){return ReadModels.nextProgramDay(days(),from)}
/** The program day that follows the last one trained today. */
function dayAfterTrainedToday(){const done=sessionsToday();
  return nextDayAfter(done.length?done.at(-1).day:day)}
/* Today's finished day (OG-6 `today/done`, Direction D 4.1): the day's name, its totals, the record line and the shipped
   note, then each lift's outcome word and the engine's next target. The words and targets come from the same lift groups the
   session summary reads (`sessionOutcomeGroups`), so Today can never disagree with the screen it sends you to. */
/** Whichever action Today is currently leading with — the start CTA, or the
 *  recap's review action once the day's session is saved. */
function todayPrimaryControl(){
  for(const sel of["#startWorkout","#reviewTodaySession"]){const el=$(sel);if(el&&canTakeFocus(el))return el}
  return $("#todayDash .page-title")}
/** Today's recap hands off to History, opened on the session it describes. */
function openTodaySessionInHistory(){const done=sessionsToday();if(!done.length)return;
  const sid=done.at(-1).session;HistoryUi.startReading(sid);
  navTo("history");HistoryUi.focusRead(sid)}
/* ---- Today prescription (Direction D, spec 4.1) ----
   The table reads recommendation(ex) for every exercise of the selected day.
   Nothing here decides a load or a reps target: the load is recommendation().load,
   the reps come from setSuggestion() or the authored strategy parameters, and the
   verdict glyph only names the status and reason the engine already attached. */
/** One word for a recommendation, from the status and reason the engine attached. */
function rxVerdict(rec){return recommendationVerdict(rec)}
/** The shared verdict mark. Up, down, hold ("=") and recover draw a glyph; stalled, new and manual stay word-only. */
function verdictMarkHtml(glyph){return sharedVerdictMarkHtml(glyph)}
function rxSetsLine(sets,withUnit){return formatSetsLine(sets,{load:fmtLoad,unit:unitLabel},withUnit)}
function rxTargetText(ex,rec){
  if(ex?.hasRepTarget===false)return programPrescriptionSummary(ex);
  if(rec.status==="manual")return t("today.target.manual",{sets:ex.sets,min:ex.min,max:ex.max});
  if(rec.status==="configuration_required")return t("today.target.setup",{sets:ex.sets,min:ex.min,max:ex.max});
  if(Array.isArray(rec.targetSets)){const first=setSuggestion(ex,1,rec,{},null);return `${ex.sets} × ${first.reps??ex.min}`}
  const strategy=strategyIdFor(ex),params=progressionForExercise(ex)?.strategy?.params||{};
  if(strategy==="rep_goal")return t("today.target.total",{n:params.repGoal});
  if(strategy==="anchor_backoff")return t("today.target.anchor",{n:params.backoffSets});
  if(strategy==="effort_target")return `${params.workingSets||ex.sets} × ${params.targetReps}`;
  const first=setSuggestion(ex,1,rec,{},last(ex).find(x=>+x.set===1));
  return `${ex.sets} × ${first.reps??ex.min}`}
/** Pure view model: one row per exercise of the day, built once per render. */
function todayRxModel(exs){
  return exs.map(ex=>{
    const rec=recommendation(ex),glyph=rxVerdict(rec),prev=last(ex);
    const sub=glyph==="stalled"?rec.label
      :prev.length?t("today.sub.before",{sets:rxSetsLine(prev)}):t("today.sub.first");
    return{ex,rec,glyph,sub,load:rec.status==="manual"||rec.load==null?null:rec.load,target:rxTargetText(ex,rec)}})}
function todayDashboardModel(){
  const date=today(),dateLabel=formatLongDate(date);
  if(!hasProgramContent())return ReadModels.buildTodayReadModel({dateLabel,hasProgram:false});
  const week=weeklySnapshot(),mc=mesocycleWeek(),name=state.programMeta?.name;
  const inProgress=draftHasProgress(),recap=inProgress?null:todayRecap(week);
  if(recap){
    const facts=sessionOutcomeGroups(recap.rows);
    Object.assign(recap,{showBaseline:facts.showBaseline,volumeDisplay:toDisplay(recap.volume),
      liftGroups:facts.liftGroups.map(lift=>({...lift,displayName:liftDisplayName(lift.name,lift.liftKey)}))});
  }
  const prescriptionRows=recap?[]:todayRxModel(exercises()).map(({ex,rec,...row})=>({...row,
    exerciseId:ex.id,name:exerciseDisplayName(ex),sets:ex.sets,verdictLabel:rec.label}));
  const programDays=days();
  let draft=activeWorkoutDraft;
  if(!draft){try{draft=JSON.parse(DraftStore.readRaw()||"null")}catch{draft=null}}
  const labels=Object.fromEntries([...programDays,day,draft?.program?.dayLabel].filter(Boolean).map(label=>[label,dayLabel(label)]));
  const resume=ReadModels.draftResumeLocation({draft,day,days:programDays,labels,
    exerciseIdsByDay:Object.fromEntries(programDays.map(label=>[label,exercises(label).map(ex=>ex.id)]))});
  const next=nextDayAfter(recap?recap.lastDay:day);
  return ReadModels.buildTodayReadModel({date,dateLabel,hasProgram:true,day,dayLabel:dayLabel(day),
    program:{name,visible:!!(name||mc.current!=null||mc.isComplete),total:mc.total,current:mc.current,
      weekCopy:mesocycleWeekCopy(mc),deload:isProgramDeloadWeek(mc)},
    prescriptionRows,canPickDay:programDays.length>1,recap,inProgress,workoutActive,resume,
    week,weekStart:weekRange(date).start,weekdayLetters:weekdayLetters(),log:state.log,
    next:next?{day:next,label:dayLabel(next),exercises:exercises(next).length}:null,
    logContext:name||mc.current!=null||mc.isComplete?programWeekContext(name,mc):t("log.context.today")});
}
function renderToday(){const model=todayDashboardModel();TodayUi.render(model);if(model.hasProgram)renderFocusDeloadLine()}
/* ---- Session sheet (Focus workout) ---- */
async function abandonWorkout(reason=null){
  await WorkoutSession.flush();
  const draft=activeWorkoutDraft;if(!draft)return false;
  const working=Object.values(draft.exercises||{}).some(exercise=>Object.values(exercise?.sets||{})
    .some(set=>set.role!=="warmup"&&set.completion!=="pending"));
  const closing=closeSessionSheet();if(closing&&typeof closing.then==="function")await closing;
  if(!await clearDraft())return false;
  captureEvent("session_abandoned",reason?{stage:working?"working":"before_set",reason}:{stage:working?"working":"before_set"});
  resetSessionContextFields();
  workoutLeft=true;focusUi.edit=null;setWorkoutActive(false);document.body.classList.remove("is-focus-wo");renderToday();window.scrollTo({top:0});
  toast(t("toast.session_abandoned"));
  return true}

let SessionSheetUi;
function renderSessionSheet(){return SessionSheetUi.render()}
function openSessionSheet(){return SessionSheetUi.open()}
function closeSessionSheet(){return SessionSheetUi.close()}
function initializeSessionSheet(){
  SessionSheetUi=createSessionSheet({window,shell:{openModal,closeModal,get activeModal(){return shellView().activeModal}},
    read:()=>({draft:activeWorkoutDraft,today:today(),bodyweight:displayDraftText("bodyweight",activeWorkoutDraft?.session?.bodyweight)||"",
      unit:unitLabel(),exerciseNames:Object.fromEntries((activeWorkoutDraft?.exerciseOrder||[]).map(id=>[id,exerciseDisplayName(activeWorkoutDraft.exercises[id])])),
      earlyRows:sessionSheetEarlyRows()}),copy:{t},motion:{reducedMotion},announce,toast,
    commands:{flush:()=>WorkoutSession.flush(),
      date:async value=>{contextTouched.date=true;if(activeWorkoutDraft)await WorkoutSession.dispatch("setSessionDate",{value},{pendingValue:value})},
      bodyweight:async value=>{contextTouched.bodyweight=true;if(activeWorkoutDraft)await WorkoutSession.dispatch("setBodyweight",{value:canonicalDraftBodyweight(value)},{pendingValue:value})},
      notes:async value=>{contextTouched.sessionNotes=true;if(activeWorkoutDraft)await WorkoutSession.dispatch("setSessionNotes",{value},{pendingValue:value})},
      reorder:async order=>{const result=await WorkoutSession.dispatch("reorderExercises",{exerciseOrder:order});
        if(result.status==="applied"){hydrateDraftCollections(WorkoutSession.projection(),{restoreSelection:true});renderWorkout()}return result},
      jump:id=>{if(activeWorkoutDraft?.exercises[id]?.status==="skipped"){openExActionsSheet(id);return}
        const index=focusList().findIndex(item=>item.id===id);if(index>=0)focusDirectTo(index)},
      finishEarly:async expectedDraft=>{const operation=saveWorkout(null,null,{expectedDraft,completion:EARLY_FINISH_CONFIRMATION});
        window.__repforgeLastWorkoutFinish=operation;await operation},
      abandon:async reason=>{const operation=abandonWorkout(reason);window.__repforgeLastAbandon=operation;await operation}}});
  SessionSheetUi.mount();
}
function sessionSheetEarlyRows(){const draft=activeWorkoutDraft;if(!draft)return null;
  const rows=WorkoutDraft.toHistoryRows({...draft,session:{...draft.session,status:"finishing"}},new Date().toISOString());
  return Array.isArray(rows)?rows:null}
window.__repforgeSessionSheet={open:openSessionSheet,close:closeSessionSheet,render:renderSessionSheet};

/* ---- Exercise actions sheet (Focus workout) ---- */
let activeExActionsId = null;

function renderExActionsSheet(exId) {
  const sheet = $("#exActionsSheet");
  if (!sheet || !activeWorkoutDraft) return;
  activeExActionsId = exId;
  const draftEx = activeWorkoutDraft.exercises[exId];
  const progEx = prog.find(exId);
  if (!draftEx) return;

  // A substituted exercise is named for what is being performed; the original rides in the line under it.
  const shownName = draftEx.substitution?.replacement
    ? exerciseDisplayName(draftEx.substitution.replacement)
    : draftEx.displayName ? exerciseDisplayName(draftEx)
      : progEx ? exerciseDisplayName(sessionExercise(progEx)) : exId;
  const nameEl = $("#exActionsName");
  if (nameEl) nameEl.textContent = shownName;

  // Under the name: what it stands in for when substituted, then the muscles and the set count.
  const subEl = $("#exActionsSub");
  if (subEl) {
    const primary = draftEx.programmed?.primary || progEx?.primary || "";
    const setsTotal = draftEx.setOrder.length;
    const lines = [];
    const original = draftEx.substitution?.original ? exerciseDisplayName(draftEx.substitution.original) : "";
    if (original) lines.push(t("log.substitute_for", { name: original }));
    lines.push((primary ? muscleListLabel(primary) + " · " : "") + `${setsTotal} ${tp(setsTotal, "set")}`);
    subEl.replaceChildren(...lines.map(line => {
      const row = document.createElement("span");
      row.className = "exactions__sub-line";
      row.textContent = line;
      return row;
    }));
  }

  // Setup notes
  const setupTextEl = $("#exActionsSetupText");
  const setupText = draftEx.programmed?.notes || progEx?.notes || "";
  if (setupTextEl) {
    setupTextEl.textContent = setupText || t("ex.actions.no_setup_notes");
  }

  // Repeat last session
  const repeatBtn = $("#exActionRepeatBtn");
  const repeatHint = $("#exActionRepeatHint");
  const prevSets = progEx ? last(sessionExercise(progEx)) : [];
  if (repeatBtn) {
    if (prevSets.length > 0) {
      repeatBtn.disabled = false;
      if (repeatHint) repeatHint.textContent = t("today.sub.before", { sets: previousSetsLine(prevSets) });
    } else {
      repeatBtn.disabled = true;
      if (repeatHint) repeatHint.textContent = t("ex.actions.no_history");
    }
  }

  // Substitution
  const substBtn = $("#exActionSubstBtn");
  const restoreOrigBtn = $("#exActionRestoreOrigBtn");
  const isSubstituted = !!draftEx.substitution;
  const substLabel = substBtn?.querySelector(".exactions__act-text > span");
  if (substLabel) substLabel.textContent = t(isSubstituted ? "ex.actions.change_substitution" : "ex.actions.substitute");
  if (restoreOrigBtn) restoreOrigBtn.classList.toggle("hidden", !isSubstituted);

  // Warmup sets list
  const warmupList = $("#exActionsWarmupList");
  if (warmupList) {
    const rows = draftEx.setOrder.map((sid, idx) => {
      const set = draftEx.sets[sid];
      if (!set) return "";
      const isWarmup = set.role === "warmup";
      const roleLabel = t(isWarmup ? "ex.actions.role_warmup" : "ex.actions.role_working");
      const btnLabel = t(isWarmup ? "ex.actions.mark_working" : "ex.actions.mark_warmup");
      return `<div class="exactions__warmup-row">` +
        `<div class="exactions__warmup-info">` +
        `<span class="exactions__warmup-num">${esc(t("log.set"))} ${idx + 1}</span>` +
        `<span class="exactions__warmup-role ${isWarmup ? "is-warmup" : ""}">${esc(roleLabel)}</span>` +
        `</div>` +
        `<button type="button" class="btn btn--steel exactions__warmup-btn" data-warm-toggle-set="${esc(sid)}">${esc(btnLabel)}</button>` +
        `</div>`;
    }).filter(Boolean);
    warmupList.innerHTML = rows.join("");
    $$("#exActionsWarmupList [data-warm-toggle-set]").forEach(btn => {
      btn.onclick = async () => {
        const sid = btn.dataset.warmToggleSet;
        const set = draftEx.sets[sid];
        if (!set) return;
        const type = set.role === "warmup" ? "markWorking" : "markWarmup";
        const res = await WorkoutSession.dispatch(type, { exerciseInstanceId: exId, setId: sid });
        if (res.status === "applied") {
          // The rerender replaces this button; carry keyboard focus to the same set's new control.
          const hadFocus = document.activeElement === btn && sheet.classList.contains("is-open");
          renderWorkout();
          renderExActionsSheet(exId);
          if (hadFocus && sheet.classList.contains("is-open")) {
            warmupList.querySelector(`[data-warm-toggle-set="${CSS.escape(sid)}"]`)?.focus({ preventScroll: true });
          }
        }
      };
    });
  }

  // Skip / restore exercise
  const skipLabel = $("#exActionSkipLabel");
  const isSkipped = draftEx.status === "skipped";
  if (skipLabel) skipLabel.textContent = t(isSkipped ? "ex.actions.restore" : "ex.actions.skip");
  // A skipped exercise says so in its status group, not only in the changed button label.
  $("#exActionsStatus")?.classList.toggle("hidden", !isSkipped);
}

/** "100 × 8, 8, 8" for one load across the sets, "100 × 8, 90 × 10" when the load moved. */
function previousSetsLine(sets) {
  const rows = sets.filter(x => +x.reps > 0);
  if (!rows.length) return "";
  if (rows.every(x => x.load == null)) return rows.map(x => x.reps).join(", ");
  const same = rows.every(x => sameLoad(+x.load, +rows[0].load));
  return same ? `${fmtLoad(rows[0].load)} × ${rows.map(x => x.reps).join(", ")}`
    : rows.map(x => `${fmtLoad(x.load)} × ${x.reps}`).join(", ");
}

function openExActionsSheet(exId) {
  if (!activeWorkoutDraft) return;
  renderExActionsSheet(exId);
  const sheet = $("#exActionsSheet"), scrim = $("#exActionsScrim");
  if (!sheet) return;
  document.body.classList.add("is-sheet-open");
  openModal(sheet, {
    initialFocus: $("#exActionsClose"),
    onEscape: closeExActionsSheet,
    scrim,
    delayHide: reducedMotion() ? 0 : 280
  });
  requestAnimationFrame(() => { sheet.classList.add("is-open"); scrim?.classList.add("is-open"); });
}

function closeExActionsSheet() {
  const sheet = $("#exActionsSheet");
  if (!sheet) return Promise.resolve(false);
  if (sheet.hidden && !(shellView().activeModal && shellView().activeModal.el === sheet)) return Promise.resolve(false);
  return closeModal(sheet);
}
window.__repforgeExActions = { open: openExActionsSheet, close: closeExActionsSheet, render: renderExActionsSheet };




function render(){applyI18n();
  // Auto-resume an in-progress session (page reload mid-workout), but never
  // override an explicit leave — otherwise every tab switch re-hides the nav.
  if(!workoutActive&&!workoutLeft&&draftHasProgress())workoutActive=true;
  setWorkoutActive(workoutActive);
  renderToday();renderTabs();renderWorkout();renderStats();HistoryUi.render();ProgramUi.renderProgram();renderSettings();renderBlockPrompt();
  updateSessionBanner();
  if(ExerciseUi?.active()&&$("#exercise")?.classList.contains("active"))renderExerciseView();
  queueMicrotask(()=>maybeShowContextualGuides())}

function renderTabs(){const ds=days();if(!ds.includes(day))day=ds[0]||"Day 1";
  $("#dayTabs").innerHTML=ds.map(d=>`<button type="button" aria-pressed="${d===day?"true":"false"}" class="${d===day?"active":""}" data-day="${esc(d)}">${esc(dayLabel(d))}</button>`).join("");
  $$("#dayTabs button").forEach(b=>b.onclick=async()=>{if(!await requestWorkoutDay(b.dataset.day))return;renderTabs();renderWorkout();renderToday()})}

function focusPresentationFacts(flat=WorkoutSession.projection()){
  return {draft:activeWorkoutDraft,flat,query:workoutQueries(),committed,log:state.log,
    list:focusList(),effortMode:isEffortMode(),rirHigh:state.settings.rirHigh,beats:beatsOn()}}
function focusPresentationView(flat=WorkoutSession.projection()){return FocusPresentation.capture(focusPresentationFacts(flat))}
function pendingFocusLoad(exId,ordinal){return FocusValues.pendingLoad(activeWorkoutDraft,exId,ordinal)}
function setFieldVals(ex,n,r,draft,prev){return FocusValues.fields({draft:activeWorkoutDraft,flat:draft,
  query:workoutQueries(),exercise:ex,ordinal:n,recommendation:r,previous:prev})}
/* =====================================================   Focus mode
   One full-height card per exercise: a scrolling ledger of what has been
   logged on top, and the shelf underneath that never moves — the set being
   worked on and the one action that commits it, under the cue that says what
   to do with it.
   ============================================================ */

/** What a control on a peek copy gets instead of its hooks: the same element,
 *  the same box, no action to fire and no place in the tab order. The peek card
 *  is `inert` as a whole, so this is belt and braces — but it also keeps the
 *  handlers in bindWorkout from ever seeing a neighbour's id. */
/** Set numbers already committed on this exercise, in order. */
/** The two lines above the ledger: what to do with this set, and why. Line one
 *  is the verb and the load, line two the reps to aim for. The load is the
 *  engine's: `setSuggestion` for this set, never a figure derived here. */
function focusCue(ex,n,r,draft,prev,editing){return focusPresentationView(draft).cue(ex,n,r,editing)}

/* ---- Inline rest (Direction D 4.2, owner gate OG-4 job 3) ----
   The rest clock reads the one timer (`focusRest.end`, `focusRest.paused`, `focusRest.length`):
   there is no second clock and nothing stored. While time remains it takes the
   cue slot, with the next set's cue under it and the rest controls in the
   shelf's pad row. At zero, or after Pular, it collapses to one line that counts
   the overrun up in soft ink and the cue returns. Logging never waits on it. */
/** What the timer is doing, said once for every consumer: no rest, time left, or past the bell. */

/** The rest controls in the shelf's pad row: -30s, Pausar or Retomar, +30s, Pular. They act on the timer
 *  the header chip and the presets sheet act on. */
function canonicalSlotFacts(...args){return workoutQueries().canonicalSlotFacts(...args)}

/** The line under the exercise name: sets and reps, the effort window, and the
 *  name of the strategy that sets the target. Read off the program's own
 *  envelope; a slot with none is the range it always was. */
/* ---- The shelf ----
   The shelf is a presentation over the DraftV2 commands. It holds nothing of its own that is saved: the three fields show
   the values of the active set, the pads nudge the selected one through the
   `.stepbtn` handler, a typed value goes through the same input handler as
   ever, and the one action is the `.saveset` handler. Which field is selected,
   and whether it is a live input, is this transient state alone. */

/* A metric-backed set opens on its first metric; a flat set on reps. */
function defaultShelfField(key){
  const at=String(key).lastIndexOf("_"),exId=String(key).slice(0,at),n=+String(key).slice(at+1);
  const metrics=at>0&&typeof focusMetricDefinitions==="function"?focusMetricDefinitions(exId,n):[];
  return metrics?.[0]?`metric_${metrics[0].id}`:"reps"}
const shelfFor=(key,firstField=defaultShelfField(key))=>focusUi.shelfFor(key,firstField);
const shelfSelect=(key,field,editing=false)=>focusUi.shelfSelect(key,field,editing);
/** A field's text as the lifter reads it: a number in their locale, anything else as typed. */
const shelfText=raw=>FocusShelf.text(raw);
/** The load step the pads move by, in the unit the lifter sees. */
function focusMetricDefinitions(exId,n){return FocusValues.definitions(activeWorkoutDraft,exId,n)}
const metricTextValue=workoutMetricDisplay.text,canonicalMetricInput=workoutMetricDisplay.canonicalInput,
  metricKgFromDisplay=workoutMetricDisplay.kgFromDisplay,metricTargetText=workoutMetricDisplay.targetText,
  canonicalMetricTargetText=workoutMetricDisplay.canonicalTargetText;
function prescriptionPresentationFacts(ex,cycleNumber){return workoutQueries().prescriptionFacts(ex,cycleNumber)}
function programPrescriptionSummary(ex,cycleNumber){return FocusPrescription.summary(prescriptionPresentationFacts(ex,cycleNumber))}
const metricLabel=workoutMetricDisplay.label,metricDisplayUnit=workoutMetricDisplay.displayUnit,
  parseHistoryMetricInput=workoutMetricDisplay.parseHistoryInput;

function refreshShelf(options){return focusView().refreshShelf(options)}

/* ---- Focus across a rebuild (Plan 064 rule 12, R7 J-03) ----
   The shelf and the card are rebuilt from markup, so the control the lifter pressed is
   a new node afterwards and focus would fall to <body>. `workoutFocusKey` names the
   focused control by the stable keys it carries (never by reference); `restoreWorkoutFocus`
   asks the new markup for the equivalent control. Where the control is gone (Log set
   moves the shelf to the next set, Edit turns a row into the open one) the handler names
   the next control with `focusWorkoutHandoff`. */
const workoutControlFocus=Focus.createControlFocus({window,shell:{canTakeFocus,resolveReturnFocus,nativeFocusSelector:ROUTE_NATIVE_FOCUS}});

const workoutFocusKey=workoutControlFocus.key,focusWorkoutControl=workoutControlFocus.control,
  restoreWorkoutFocus=workoutControlFocus.restore,focusWorkoutHandoff=workoutControlFocus.handoff,
  liveShelfInput=workoutControlFocus.input,liveEffortField=workoutControlFocus.effortField;

/** Keep the shelf and the open ledger row reading what a field now holds. */
function syncShelfField(input,padDir=0){
  const field=input.closest(".shelf__field");
  FocusShelf.syncInput(input,{definitions:field?focusMetricDefinitions(...setKeyParts(field.dataset.set)):[],direction:padDir})}
function setKeyParts(key){const text=String(key||""),at=text.lastIndexOf("_");return[text.slice(0,at),+text.slice(at+1)]}

/** A field the draft flags must be seen, not just focused: bring its input into the shelf. */
function shelfReveal(input){
  if(!input?.matches?.(".shelf__input"))return input;
  const field=input.closest(".shelf__field");
  if(!field||field.classList.contains("is-editing"))return input;
  // A metric field is selected by its metric-specific id, not its generic kind.
  const id=field.dataset.metric?`metric_${field.dataset.metric}`:field.dataset.field;
  shelfSelect(field.dataset.set,id,true);
  if(!refreshShelf())return input;
  return $(`#workout .shelf__input[data-k="${CSS.escape(input.dataset.k)}"]`)||input}

/** A whole focus card. `peek` renders the inert copy that rides in from the
 *  side during a swipe: the same card, down to every control and the space it
 *  takes, so nothing pops in or reflows when the copy becomes the live one.
 *  What a peek does not carry is behaviour — its controls hold no hooks and no
 *  tab stop — and no `data-k` field, which would duplicate the draft keys the
 *  live card owns. */
function focusViewFrame(){return workoutActive?{active:true,context:focusPresentationFacts(),hiddenCount:exercises().filter(ex=>skipped.has(ex.id)).length,restEnabled:+state.settings.restSec>0,
  programName:state.programMeta?.name,cycle:mesocycleWeek(),deload:isProgramDeloadWeek(),dayLabel:dayLabel(day)}:{active:false}}
let FocusView;
function focusView(){return FocusView||(FocusView=Focus.createFocusView({window,focus:focusUi,clock:focusRest,presentation:FocusPresentation,
  controls:workoutControlFocus,geometry:focusGeometry,effects:focusEffects(),motion:ensureBrowserPresentation().motion,
  navigation:focusNavigation(),commands:focusWorkoutCommands,guides:guidesView(),exercise:{open:openExerciseView},
  input:{read:()=>({draft:activeWorkoutDraft,unit:state.settings.unit,minJump:state.settings.minJump}),commands:focusWorkoutCommands,
    captureSet:()=>({draft:activeWorkoutDraft,flat:WorkoutSession.projection(),query:workoutQueries(),program:state.program,effortMode:isEffortMode()}),
    onAcknowledged:async field=>{updateSaveMeta();if(field)await refreshAfterCommittedEdit(field)}},
  readFrame:focusViewFrame,copy:{t},help:{term:glossaryPopover},restActions:{rest:restAct,why:openWhySheet},
  feedback:{suggestionFailure:showSuggestionFailure,draftIssues:applyDraftIssue},exerciseActions:{open:openExActionsSheet},
  onRendered:({active})=>{updateGauge();if(active){updateSaveMeta();renderFatigue();updateBodyweightField();}updateSessionBanner();}}))}
function renderWorkout(){return focusView().render()}
/** ⋯ is the current exercise's actions. Where the device offers voice input and
 *  the lifter has turned it on, the same button opens a short menu that holds
 *  both; the button says which it is. */
function syncWorkoutMore(){return Focus.syncWorkoutMore(document)}
/** After a render, bring every card in the deck to the row that matters — the
 *  peeks included, so a neighbour rides in already showing what it will show
 *  once it lands. The card's own height comes from the layout, so nothing is
 *  measured into a stale number. */
function sizeFocusDeck(){return focusGeometry.sizeDeck()}
const focusGeometry=Focus.createFocusGeometry({window});
function syncFocusFloor(){return focusGeometry.syncFloor()}
function sizeFocusCard(card){return focusGeometry.sizeCard(card)}
function wholeLineScroll(context,target,dir,limit=Infinity){return focusGeometry.wholeLineScroll(context,target,dir,limit)}
async function refreshAfterCommittedEdit(row){
  if(!row?.dataset.set||!committed.has(row.dataset.set))return{status:"unchanged"};
  const exId=row.closest(".exercise")?.dataset.ex;
  return exId?refreshSuggestions(exId):{status:"unchanged"}}

// Latest note the lifter left on this exercise, so machine setup carries into the next session.
function lastExerciseNote(ex){const match=matchLift(ex);
  const rows=state.log.filter(r=>match(r)&&String(r.exNote||"").trim());
  if(!rows.length)return"";
  const latest=rows.sort(compareLogChronology).at(-1);
  return String(latest.exNote).trim()}
function clearFieldInvalid(root){
  (root||document).querySelectorAll("[aria-invalid='true']").forEach(el=>el.removeAttribute("aria-invalid"))}
function applyFieldError(res){
  if(!res||res.ok)return false;
  const el=res.el;
  if(el){const live=shelfReveal(el)||el;live.setAttribute("aria-invalid","true");try{live.focus()}catch{}}
  toast(t(res.error?.key||"validation.load"));
  return true}
function applyDraftIssue(issues){
  const issue=(issues||[]).find(item=>item?.field||String(item?.code||"").startsWith("invalid-"));
  if(!issue)return false;
  const field=issue.field==="scheduleDate"?"date":issue.field;
  let el=field==="date"?$("#sessionDate"):field==="bodyweight"?$("#sessionBodyweight"):null;
  if(el)openSessionSheet();
  let loadErrorKey="validation.load";
  // A metric issue names the metric: its input carries the metric id, and the
  // message follows what the metric measures.
  if(issue.code==="invalid-metric"&&issue.exerciseInstanceId&&issue.setId){
    const set=activeWorkoutDraft?.exercises?.[issue.exerciseInstanceId]?.sets?.[issue.setId];
    const input=set?$(`#workout [data-k="${issue.exerciseInstanceId}_${set.ordinal}_metric_${issue.field}"]`):null;
    const metricKey=METRIC_FIELD_SEMANTICS.reps.includes(issue.metric)?"validation.reps":
      METRIC_FIELD_SEMANTICS.load.includes(issue.metric)?"validation.load_metric":"validation.metric";
    return applyFieldError({ok:false,error:{key:metricKey},el:input})}
  if(!el&&issue.exerciseInstanceId&&issue.setId){const exercise=activeWorkoutDraft?.exercises?.[issue.exerciseInstanceId],
      set=exercise?.sets?.[issue.setId],key=set?`${issue.exerciseInstanceId}_${set.ordinal}_${field}`:null;
    if(key)el=$(`#workout [data-k="${key}"]`)||$(`#workout [data-effspin="${issue.exerciseInstanceId}_${set.ordinal}"]`)}
  if(field==="load"&&issue.exerciseInstanceId&&issue.setId){
    const set=activeWorkoutDraft?.exercises?.[issue.exerciseInstanceId]?.sets?.[issue.setId];
    const raw=set?.edited?.load??set?.programmed?.suggestedLoad??"";
    loadErrorKey=parseLoadInput(raw).kind==="empty"?"toast.enter_weight_before_save_set":"toast.invalid_weight"}
  const key=field==="reps"?"validation.reps":field==="rir"?"validation.rir":field==="effort"?"validation.effort":
    field==="date"?"validation.date":field==="bodyweight"?"validation.bodyweight":loadErrorKey;
  return applyFieldError({ok:false,error:{key},el})}
function bindWorkout(){return focusView().bind()}

function updateGauge(){const exs=exercises();const hot=exs.filter(e=>{const s=recommendation(e).status;return s==="add"||s==="add2"}).length;
  const g=$("#heatGauge"),frac=exs.length?hot/exs.length:0;
  if(g){const fill=g.querySelector(".gauge__fill"),lab=g.querySelector(".gauge__label");
    if(fill)fill.style.width=`${Math.round(frac*100)}%`;
    if(lab)lab.textContent=hot?t("top.gauge.hot",{n:hot}):t("top.gauge.forge");
    g.classList.toggle("is-hot",hot>0);
    g.style.cursor=hot?"pointer":"default";
    g.onclick=hot?()=>{enterWorkout({});const first=$("#workout .exercise.is-add, #workout .exercise.is-add2");if(first){first.scrollIntoView({behavior:scrollBehavior(),block:"center"})}}:null}
}

function renderFatigue(){const el=$("#fatigue");if(!el)return;const exs=exercises();
  const flagged=fatigueFlagged(),actedOn=flagged.length>0&&flagged.every(e=>skipped.has(e.id));
  if(exs.length>=3&&flagged.length>=2&&!actedOn&&uiPrefs.fatigueDismissedOn!==today()){el.className="fatigue";el.innerHTML=`<b>${esc(t("log.fatigue.title"))}</b> ${esc(t("log.fatigue.body",{n:flagged.length}))} `+
    `<button type="button" class="fatigue__trim">${esc(t("log.fatigue.trim"))}</button>`+
    `<button type="button" class="fatigue__dismiss" aria-label="${esc(t("log.fatigue.dismiss_aria"))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`;
    $("#fatigue .fatigue__trim").onclick=()=>applyFatigueTrim();
    $("#fatigue .fatigue__dismiss").onclick=()=>{setUiPref("fatigueDismissedOn",today());renderFatigue()}}
  else el.className="fatigue hidden",el.innerHTML="";}

/* =====================================================   The end of a session
   The work is already in the log by the time any of this runs: nothing here
   computes a judgement, it only reads back what the session actually did.
   Every number is one the app already trusts elsewhere — the same PR rule as
   the ledger, the same hard-set rule as the volume audit, the same week as
   Today — so the summary can never disagree with the screen it sends you to.
   ============================================================ */

/** Capture History projection and immutable row attribution without changing
 * the scalar muscle-credit convention retained by released summaries. */
function summaryRowFacts(rows,includeMuscles=false){return rows.map(row=>{
  const projected=readLogRow(row),mus=includeMuscles?rowMuscles(row):null;
  return{liftKey:liftKey(projected),name:displayName(projected),
    load:+projected.load,reps:+projected.reps,e1rm:+projected.e1rm,tonnage:projected.tonnage,
    warmup:!!projected.warmup,strengthComparable:projected.strengthComparable,
    strengthConvention:projected.strengthConvention,set:+projected.set||0,
    date:projected.date,created:projected.created,session:projected.session,sessionKey:projected.sessionKey,id:projected.id,
    muscle:{load:+row.load,reps:+row.reps,rir:+row.rir,primary:mus?muscles(mus.primary):[],secondary:mus?muscles(mus.secondary):[]}}})}
/** Localized next-target presentation and live slot lookup are captured here;
 * the pure summary joins these facts to the canonical evidence records. */
function summaryOutcomeContext(rows){
  const lifts={};
  for(const key of new Set(performedWorkingRows(rows).map(liftKey))){
    const slot=currentExerciseForLiftKey(key);if(!slot)continue;
    const rec=recommendation(slot),line=rec&&rec.status!=="manual"?setsTargetLine(slot,rec):"";
    lifts[key]={exerciseId:slot.id,name:slot.name,next:line?{glyph:rxVerdict(rec),line}:null}}
  return{evidence:strengthEvidenceRecords("current-block"),lifts}}
function sessionOutcomeGroups(rows,prs=[]){
  return deriveSessionOutcomeGroups(summaryRowFacts(rows),summaryOutcomeContext(rows),prs)}
function buildSessionSummary({rows,prevLog,session,date,day:sessDay,startedAt}){
  // Post-commit fault injection belongs to application composition only.
  if(window.__repforgeSummaryFault==="canonical"){
    delete window.__repforgeSummaryFault;throw new Error("summary canonical derivation fault")}
  const meso=mesocycleWeek(),week=weeklySnapshot(date),ds=days();
  const idx=Math.max(0,ds.indexOf(sessDay)),next=ds.length>1?ds[(idx+1)%ds.length]:null;
  return deriveSessionSummary({rows:summaryRowFacts(rows,true),previousRows:summaryRowFacts(prevLog),session,date,day:sessDay,startedAt},
    {...summaryOutcomeContext(rows),now:Date.now(),hardRir:+state.settings.hardRir,
      week:{completedDays:week.completedDays,plannedDays:week.plannedDays},
      meso:{current:meso.current,total:meso.total,isComplete:meso.isComplete},
      next:next?{day:next,exercises:exercises(next).length}:null})}

function updateSaveMeta(){const exs=exercises(),planned=sum(exs.map(e=>e.sets));
  const done=[...committed].length;
  const entered=activeWorkoutDraft?activeWorkoutDraft.exerciseOrder.reduce((count,exId)=>{
    const exercise=activeWorkoutDraft.exercises[exId];return count+exercise.setOrder.filter(setId=>{
      const set=exercise.sets[setId],value=set.edited.load;
      return set.touched.load&&typeof value==="string"&&value.trim()!==""||
        Object.entries(set.touched.metrics||{}).some(([id,touched])=>touched&&String(set.edited.metrics?.[id]??"").trim()!=="")}).length},0):
    0;
  $("#saveMeta").textContent=done?t("log.save_meta.done",{day:dayLabel(day),done,planned}):(entered?t("log.save_meta.entered",{day:dayLabel(day),entered,planned}):t("log.save_meta.planned",{day:dayLabel(day),planned}));}

const EARLY_FINISH_CONFIRMATION=Symbol("confirmed early finish");
let WorkoutSession,workoutSuggestions,focusWorkoutCommands;
function initializeWorkoutCommands(){
WorkoutSession=createWorkoutCommands({
  session:applicationSession,training:WorkoutDraft,
  drafts:{flush:drainDraftWork,read:()=>({draft:activeWorkoutDraft,raw:activeWorkoutDraftRaw,recovery:draftUiRecovery}),
    start:createWorkoutDraft,dispatch:enqueueDraftCommand,projection:workoutDraftProjection,
    clearIdentity:resetWorkoutSessionIdentity,clearEffect:destructiveDraftClearEffect,
    canLeave:()=>!draftUiRecovery?.attempt&&!draftUiRecovery?.status&&window.__repforgeDraftFault!=="persist-failure"},
  commit:(proposal,opts,io=storageIO)=>commitProposedState(proposal,io,opts),
  now:()=>new Date().toISOString(),operationId:()=>`finish-${uid()}`,writer:draftWriter,
  earlyFinishConfirmation:EARLY_FINISH_CONFIRMATION,
  beforeCommit:async captured=>{if(typeof window.__repforgeDraftBeforeSaveCommit==="function")
    await window.__repforgeDraftBeforeSaveCommit(captured)}});

workoutSuggestions=createWorkoutSuggestionCommands({workout:WorkoutSession,
  readDraft:()=>activeWorkoutDraft,readSnapshot:applicationSession.read,
  planUpdates:({exerciseId,draft})=>{
    const ex=prog.find(exerciseId);if(!ex)return null;
    const projection=workoutDraftProjection(draft);
    const targets=[ex,...exercises(ex.day).filter(other=>other.id!==ex.id&&!hasCommittedSets(other))];
    return targets.flatMap(other=>suggestionUpdatesFor(sessionExercise(other),projection))},
  beforeRefresh:async exId=>{
    if(typeof window.__repforgeBeforeSuggestionRefresh==="function"){
      const hook=window.__repforgeBeforeSuggestionRefresh;delete window.__repforgeBeforeSuggestionRefresh;await hook({exId})}}});
focusWorkoutCommands=createFocusWorkoutCommands({workout:WorkoutSession,training:WorkoutDraft,
  readDraft:()=>activeWorkoutDraft,readUnit:()=>state.settings.unit,suggestions:workoutSuggestions,
  now:()=>new Date().toISOString(),
  onSetAcknowledged:({nowDone,exerciseInstanceId,ordinal,editing})=>{
    if(editing&&nowDone){focusUi.edit=null;focusUi.ledgerOpen=null;toast(t("toast.set_updated"))}
    if(nowDone&&!editing){lastCommitAt=Date.now();if(!sessionStartedAt)sessionStartedAt=lastCommitAt;
      focusUi.restRenderPending=true;startRest();armUnfinishedWatch();focusUi.logged={exId:exerciseInstanceId,n:ordinal}}}});

}

// Asked once, at the first completed session: a device with nothing logged has
// nothing to protect, and Firefox turns the request into a permission prompt.
// No preference is stored; persisted() is the source of truth.
async function requestPersistentStorage(){try{
  if(!navigator.storage?.persist||await navigator.storage.persisted?.())return;
  await navigator.storage.persist()}catch{}}

async function saveWorkoutV2(io,{expectedDraft=null,completion="normal"}={}){
  const {result,completed,capturedRaw}=await WorkoutSession.finish({expectedDraft,completion,io});
  if(!completed){
    if(result?.reason==="stale-confirmation")toast(t("session.sheet.stale_error"));
    if(result?.validation&&!applyDraftIssue(result.issues||[]))
      toast(t(result.issues?.some(issue=>issue.code==="incomplete-workout")?"toast.finish_incomplete":
        result.issues?.some(issue=>issue.code==="no-work")?"toast.enter_weight_before_save":"validation.load"));
    if(capturedRaw!=null){
      const stale=!!result.draftConflict;
      draftUiRecovery={kind:stale?"stale":"persist",status:stale?"stale":"save-failed",attempt:null,pendingValue:null,
        copyValue:capturedRaw,copyKind:"data",focus:draftFocusIdentity(),retry:!stale,
        retryAction:stale?null:()=>saveWorkoutV2(io,{expectedDraft,completion}),discard:false};
      renderDraftRecovery();focusDraftRecovery()}
    return result}
  resetDraftSessionPresentation();resetSessionContextFields();stopRest();
  const {rows,prevLog,session,date,day:savedDay,startedAt,draftId}=completed;
  if(typeof window.__repforgeDraftAfterSaveCommit==="function")
    await window.__repforgeDraftAfterSaveCommit({session,draftId});
  if(!prevLog.some(isWork)&&rows.some(isWork)){captureEvent("first_set_logged",{});requestPersistentStorage()}
  captureEvent("session_completed",{
    set_count:Telemetry?.bucketCount(rows.filter(isWork).length,"sets"),
    exercise_count:Telemetry?.bucketCount(new Set(rows.filter(isWork).map(row=>row.exerciseId)).size,"exercises"),
    duration:Telemetry?.bucketDuration(startedAt?Math.max(0,(Date.now()-startedAt)/60000):0),
    days_since_last:Telemetry?.bucketDaysSince?.(daysSinceLastSession(prevLog,date))||undefined});
  const btn=$(".btn--save");if(btn){btn.classList.remove("is-stamped");void btn.offsetWidth;btn.classList.add("is-stamped")}
  const savedFallback=()=>{
    render();
    clearSessionSummaryView();
    closeSessionSummary();
    toast(t("toast.workout_forged",{n:rows.length,sets:tp(rows.length,"set")}));
    maybeShowInstallBanner()};
  let summary;
  try{summary=buildSessionSummary({rows,prevLog,session,date,day:savedDay,startedAt})}
  catch{savedFallback();return result}
  render();
  try{if(!openSessionSummary(summary))savedFallback()}
  catch{savedFallback()}
  return result}

async function saveWorkout(e,io,options={}){if(e&&e.preventDefault)e.preventDefault();if(saving)return;
  const form=$("#logForm"),formWasInert=!!form?.inert,formBusy=form?.getAttribute("aria-busy")??null;
  if(!activeWorkoutDraft){showDraftInitializationRecovery({status:"invalid",raw:DraftStore.readRaw()});return{localOk:false,idbOk:false,reason:"missing-active-draft"}}
  saving=true;if(form){form.inert=true;form.setAttribute("aria-busy","true")}
  try{return await saveWorkoutV2(io,options)}finally{
    if(form){form.inert=formWasInert;if(formBusy==null)form.removeAttribute("aria-busy");else form.setAttribute("aria-busy",formBusy)}
    if(form&&!form.inert){const invalid=form.querySelector("[aria-invalid='true']");if(invalid){try{invalid.focus()}catch{}}}
    saving=false}}

/* ---- Completion application actions; presentation belongs to ui/workout/summary.js. ---- */
function summaryPresentationModel(summary){
  return ReadModels.buildSummaryReadModel({summary,dayLabel:dayLabel(summary.day),volumeDisplay:toDisplay(summary.volume),
    nextLabel:summary.next?dayLabel(summary.next.day):null,
    liftNames:Object.fromEntries(summary.liftGroups.map(lift=>[lift.liftKey,liftDisplayName(lift.name,lift.liftKey)])),
    muscleNames:Object.fromEntries(summary.muscles.map(muscle=>[muscle.name,muscleLabel(muscle.name)]))});
}
function clearSessionSummaryView(){SummaryUi.clear()}
function openSessionSummary(summary){
  const opened=SummaryUi.open(summaryPresentationModel(summary));
  if(opened)captureEvent("session_summary_viewed",{});
  return opened;
}
function closeSessionSummary(opts={}){
  SummaryUi.close();
  workoutLeft=true;focusUi.edit=null;setWorkoutActive(false);document.body.classList.remove("is-focus-wo");
  if(opts.nav)navTo(opts.nav);else render();
  if(!opts.nav){const next=resolveReturnFocus(todayPrimaryControl);if(next){try{next.focus({preventScroll:true})}catch{}}}
  maybeShowInstallBanner();
}
window.__repforgeSessionSummary={open:openSessionSummary,close:closeSessionSummary,
  build:buildSessionSummary,current:()=>SummaryUi.current()};
async function mountDashboardPresentation(){
  const copy={t:(...args)=>t(...args),tp:(...args)=>tp(...args),tOne:(...args)=>tOne(...args),countText:(...args)=>countText(...args)};
  const format={number:fmt,compact:kfmt,load:fmtLoad,unit:unitLabel,date:formatLongDate};
  const reviewCommands=createReviewCommands({transition:repforgeProgramTransitionAdapter,readDraft:readDraftRaw,
    clearStaging:clearSetupDraft,repeat:()=>finishBlockAndStart("repeat"),
    openStagedEditor:()=>{startOnboarding("settings",{userInitiated:true});if(entryState?.step==="editor"&&entryState?.result?.preview){entryUiNotice=null;openEntryDraftEditor()}},
    onCommitted:()=>{day=days()[0]||"Day 1"},onChoice:action=>captureEvent("block_transition_chosen",{action})});
  ReviewUi=createReviewController({document,copy,queries:{preview:reviewPreviewModel},commands:reviewCommands,onChange:()=>render(),onNotice:toast});
  ProgressUi=createProgressController({document,copy,format:{...format,displayLoad:toDisplay},motion:window.RepForgeMotion,
    review:ReviewUi,queries:{overview:progressOverviewReadModel,review:reviewReadModel,strength:strengthEvidenceReadModel,volume:volumeEvidenceReadModel,prs:prEvidenceReadModel},
    onOpenExercise:key=>openExerciseView(key,"stats"),onGoToday:()=>navTo("log"),onReviewViewed:captureBlockReviewViewed,
    onSelected:segment=>queueMicrotask(()=>maybeShowContextualGuides([segment==="review"?"block-transition":"progress"]))});
  ExerciseUi=createExerciseController({window,copy,format:{number:fmt,load:fmtLoad,displayLoad:toDisplay,unit:unitLabel,date:shortDate},
    queries:{projection:strengthProjection,detail:exerciseDetailReadModel,open:key=>{
      const slot=prog.find(key),movement=slot?(workoutActive?sessionExercise(slot):slot):null;
      return{key:movement?exerciseLiftKey(movement):key,exercise:movement?Object.assign({},movement):null}}},
    motion:window.RepForgeMotion,shell:shellView(),onChartPresentation:kind=>{window.__repforgeChartLastPresentation=kind},onRender:render,onSettings:showSettings,
    onSeePrs:()=>{navTo("stats");setStatsSeg("prs")},onGlossary:glossaryPopover,
    onWhy:(id,anchor)=>{const slot=prog.find(id);if(slot)openWhySheetFor(slot,anchor)}});
  window.__repforgeChartPalette=ExerciseUi.palette;
  window.__repforgeChartLabelDecimals=ExerciseUi.labelDecimals;
  TodayUi=createTodayController({document,copy,format,motion:window.RepForgeMotion,
    onCreateProgram:()=>startOnboarding(null,{userInitiated:true}),onOpenExercise:id=>openExerciseView(id,"log"),
    onStartDay:day=>enterWorkout({day}),onReviewProgram:()=>{navTo("stats");setStatsSeg("review")}});
  SummaryUi=createSessionSummary({window,copy,format,motion:window.RepForgeMotion,
    shell:{openModal,closeModal,get activeModal(){return shellView().activeModal}},
    onDone:()=>closeSessionSummary(),onSeeSession:session=>{HistoryUi.startReading(session);closeSessionSummary({nav:"history"})}});
}

function summaries(){return buildLiftSessionSummaries(readLogRows().map(row=>({...row,liftKey:liftKey(row),exerciseName:displayName(row)})))}

/* Test-only view of the recommendation surface. The parity gate calls exactly
   what the Log tab and the "why this weight" sheet call, so it can prove that
   routing the arithmetic through progression-engine.js leaves every displayed
   target and every displayed explanation byte-identical. Read-only. */
window.__repforgeProgression={
  recommendation,explainRecommendation,setSuggestion,baseSuggestion,baseSetReps,
  sessionsFor:ex=>sessionsFor(ex),
  programSlot:id=>{const slot=prog.find(id);return slot?sessionExercise(slot):null}};

/* ---- Progress: overview and Strength (Plan 064 R3i) ----
   Every figure and word below is a model output read back. The series and its
   points come from progress-model.js through strengthProjection(); an outcome
   word is the compareExerciseSession label the summary and History read; an
   attention target is recommendation(). Nothing is derived in this layer. */
function progressProgramFacts(){return prog.exercises.map(ex=>Object.freeze({id:ex.id,name:ex.name,key:exerciseLiftKey(ex)||`slot:${ex.id}`,displayName:exerciseDisplayName(ex)}))}
function progressReadFacts(){return Object.freeze({snapshot:state,programRows:prog.toJSON(),program:progressProgramFacts(),
  log:readLogRows().map(row=>Object.freeze({...row,liftKey:liftKey(row),displayName:exerciseDisplayName(row)})),today:today(),blockId:snapshotBlockId(state),
  recoveryRecord:activeRecoveryRecord&&activeRecoveryRecordBlockId===snapshotBlockId(state)?activeRecoveryRecord:null})}
function progressStrengthReadFacts(scope){return Object.freeze({scope,projection:strengthProjection(scope),program:progressProgramFacts(),rows:strengthEvidenceRows()})}
function strengthEvidenceReadModel(scope){return ProgressReadModels.strength(progressStrengthReadFacts(scope))}
function overviewVolumeProjection(){return ProgressReadModels.overviewVolume(progressReadFacts())}
function overviewVolumeSorted(){return overviewVolumeProjection()}
function progressOverviewReadModel(){
  const facts=progressReadFacts(),strengthFacts=progressStrengthReadFacts("current-block"),records=strengthEvidenceRecords("current-block"),groups=ProgressReadModels.attentionGroups(facts,records);
  const recommendations=new Map(groups.flatMap(group=>group.items).map(({item})=>{const slot=currentExerciseForLiftKey(item.destinationId);return[item.destinationId,slot?recommendation(slot):null]}).filter(([,rec])=>rec));
  return ProgressReadModels.overview({facts,strengthFacts,records,groups,recommendations})}
function renderStats(){ProgressUi.render()}

function detectPRs(log){return derivePersonalRecords((Array.isArray(log)?log:[]).map(row=>{
  const reading=readLogRow(row);
  return{liftKey:liftKey(row),date:row.date,created:row.created,session:row.session,blockId:row.blockId??null,
    load:reading.load,reps:reading.reps,rir:row.rir,warmup:row.warmup,strengthComparable:reading.strengthComparable,
    strengthConvention:reading.strengthConvention,exerciseName:displayName(row),exerciseId:row.exerciseId,
    loadMultiplier:reading.loadMultiplier,perSideLoad:reading.perSideLoad}}))}

function normalizeCommandText(text){return String(text??"").toLowerCase().replaceAll("×","x").replace(/@/g," rir ")
  .replace(/(\d),(\d)/g,"$1.$2").replace(/\breps\b/g,"").replace(/\s+/g," ").trim()}
const deaccent=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
/** Effort spoken or typed in either language: "hard", "difícil", "dificil". */
function matchEffortWord(text){
  const hay=` ${deaccent(text).toLowerCase()} `;
  for(const e of EFFORT_STEPS){
    const words=new Set([e,deaccent(effortLabel(e)).toLowerCase()]);
    for(const w of words)if(w&&new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(hay))return e}
  return null}
function parseSetCommand(text){
  const n=normalizeCommandText(text),warnings=[];
  let set=null,load,reps,rir=null,effort=null,unit=null,confidence="low",gotReps=false;
  const setM=n.match(/(?:set|s)\s*(\d+)/);if(setM)set=+setM[1];
  const primary=n.match(/(\d+(?:\.\d+)?)\s*(kg|lb)?\s*(?:x|for)\s*(\d+)/);
  if(primary){load=+primary[1];unit=primary[2]||null;reps=+primary[3];confidence="high";gotReps=true}
  else{const nums=(n.match(/\d+(?:\.\d+)?/g)||[]).map(Number);
    if(set!=null){const i=nums.indexOf(set);if(i>=0)nums.splice(i,1)}
    if(!nums.length)return {ok:false,error:t("command.error.could_not_read_set"),warnings};
    if(nums.length<2)return {ok:false,error:t("command.error.could_not_find_reps"),warnings};
    load=nums[0];reps=nums[1];gotReps=true;if(nums.length>=3)rir=nums[2]}
  if(!gotReps)return {ok:false,error:t("command.error.could_not_find_reps"),warnings};
  const rirM=n.match(/(?:rir|@)\s*(\d+(?:\.\d+)?)/);if(rirM)rir=+rirM[1];
  else{const tr=n.match(/\b(\d+(?:\.\d+)?)\s*rir\b/);if(tr)rir=+tr[1]}
  effort=matchEffortWord(n);
  if(!unit){const u=n.match(/\b(\d+(?:\.\d+)?)\s*(kg|lb)\b/);if(u)unit=u[2]}
  let exerciseName=null;const exSrc=setM?n.slice(setM.index+setM[0].length).trim():n;
  const lead=exSrc.match(/^([a-z][a-z\s]*?)(?=\d)/);if(lead){const ex=lead[1].trim();if(ex)exerciseName=ex}
  return {ok:true,exerciseName,set,load,reps,rir,effort,unit,confidence,warnings}}
window.detectPRs=detectPRs;
window.__repforgeCatalogForSlot=catalogForSlot;
window.__repforgeChooseExercise=chooseExercise;
window.__repforgeResolveSplit=resolveSplit;
window.__repforgeExerciseCatalog=EXERCISE_LIBRARY;
window.__repforgeExerciseLibrary=EXERCISE_LIBRARY;
window.__repforgeLibraryEntry=libraryEntry;
window.__repforgePickableExercises=()=>pickableExercises();
window.__repforgeLinkImported=linkImportedExercises;
window.__repforgeOpenPicker=opts=>libraryUi.openExercisePicker(opts);
window.__repforgeSaveCustomExercise=draft=>saveCustomExercise(draft);
window.__repforgeCustomExercises=()=>customExercises();
window.__repforgePickerSelection=()=>libraryUi.pickerSelection();
window.__repforgeDeleteCustomExercise=id=>deleteCustomExercise(id);
window.__repforgeRowMuscles=row=>rowMuscles(row);
window.__repforgeParseProgramSource=(text,name)=>parseProgramSource(text,name);
window.__repforgeMatchCandidates=name=>{
  const result=classifyImportRow({name},pickableExercises());
  return{status:result.status,matchId:result.match?.id||null,
    candidateIds:(result.candidates||[]).map(c=>c.entry.id)}};
window.__repforgeFreeformClipboard=()=>importFreeformFromClipboard();
window.__repforgeFreeform={
  parseReply:text=>FreeformGrammar.parseFreeformProgramReply(text,parseProgramSource),
  readGapEnvelope:candidate=>FreeformGrammar.readFreeformGapEnvelope(candidate),
  assembleDocument:(gapResult,gapAnswers)=>FreeformGrammar.assembleFreeformProgramDocument(gapResult,gapAnswers,t("entry.freeform.source_name"))};
window.__repforgeImportDraft=()=>importDraft&&{
  fileName:importDraft.fileName,format:importDraft.format,sourceType:importDraft.sourceType||null,
  counts:importCounts(importDraft),
  rows:importDraft.rows.map(r=>({name:r.raw.name,status:r.status,decision:r.decision,
    reviewed:r.reviewed,match:r.match?r.match.id:null}))};
window.__repforgeCommitImport=io=>commitImportReview(io||storageIO);
window.__repforgeReferencedCustom=list=>referencedCustomExercises(list);
window.__repforgeOpenLibrary=opts=>libraryUi.openLibrary(opts||{});
window.__repforgeLibraryFlow=()=>libraryUi.readLibrary();
window.__repforgeEditCustom=id=>libraryUi.editCustomExercise(id);
window.__repforgeCompletedVolume=(windowDays=7)=>volMapToObj(completedHardSets(windowDays));
window.__repforgeEquipmentSupportsSplit=equipmentSupportsSplit;
window.__repforgeTestDeltas=(prevRows,currentRows)=>buildSessionDelta(prevRows,currentRows);
window.__repforgeCompareExercise=(ex,currentRows,readerContext=null)=>compareExerciseSession(ex,currentRows,readerContext);
window.__repforgeMesocycleWeek=mesocycleWeek;
window.__repforgeBuildBlockReview=buildBlockReview;
window.__repforgeCommitNextBlock=commitNextBlock;
window.__repforgeFinalizeProgramSetup=(opts,io)=>finalizeProgramSetup(Object.assign({},opts,{io:io||opts?.io||storageIO}));
window.__repforgeCommitProposedState=proposal=>commitProposedState(proposal,storageIO);
window.__repforgeInstallTransferImport=(envelope,options)=>importInstallTransfer(envelope,options);
window.__repforgePersistSetupDraft=next=>persistSetupDraft(next);
window.__repforgeEntryState=()=>cloneSnapshot(entryState);
// The mounted Build editor's own client-side document (program-editor.js's
// local copy, which is what #onbProgramEditor actually renders from). It is
// kept separately from entryState and only adopts a commit's own canonical
// result once that commit's write settles, so a browser proof driving the
// editor faster than a commit resolves needs this to know when the editor,
// not just entryState, is caught up.
window.__repforgeOnboardingEditorDocument=()=>onboardingProgramEditor?.getDocument?.()||null;
window.__repforgeEntryPersistenceDiagnostic=()=>cloneSnapshot(entryPersistenceDiagnostic);
window.__repforgeActivateEntryPreview=opts=>activateEntryPreview(opts);
window.__repforgeCreateOnboardingProgramEditorAdapter=()=>createOnboardingProgramEditorAdapter();
window.__repforgeStageGuidedManualRepair=(params,io)=>repforgeProgramTransitionAdapter.stageGuidedManualRepair(params,io);
window.__repforgeOnboardingOrigin=()=>onboardingOrigin;
window.__repforgePendingBlock=()=>pendingBlockTransition;
// Durable program-entry routes whose compiler context can be re-derived and
// therefore support an in-place sibling transition. Build / Import / Shared and
// a missing route carry no reconstructable provenance and stay typed Unavailable.
const TRANSITION_SOURCE_ROUTES = ["recommend", "custom", "browse"];
// One route spelling conversion to the transition contract (Recommend/Custom/Browse).
function transitionContractSource(route) {
  return route.charAt(0).toUpperCase() + route.slice(1);
}
const COMPILER_PROVENANCE_FIELDS = [
  "familyId", "blueprintId", "blueprintVersion", "compilerVersion", "catalogueVersion",
  "rulesVersion", "contextVersion", "profileId", "recentConsistencyVersion",
];
/* Compiler context is not provenance. A context can be absent from a shared
   import even while its released programStructure still carries the complete
   compiler receipt; conversely, a stale context must not turn a historical
   program into a compiler-backed transition. The structure receipt is the
   independent discriminator for the two paths. */
function classifyCompilerTransitionProvenance(meta) {
  const provenance = meta?.programStructure?.provenance;
  if (provenance == null) return "absent";
  if (!isPlainStateObject(provenance)) return "invalid";
  if (provenance.source === "legacy_migration" || provenance.source === "manual_build") return "absent";
  const strings = ["familyId", "blueprintId", "profileId"];
  if (!strings.every(key => typeof provenance[key] === "string" && provenance[key].trim())) return "invalid";
  if (!COMPILER_PROVENANCE_FIELDS.every(key => Object.prototype.hasOwnProperty.call(provenance, key))) return "invalid";
  if (!["blueprintVersion", "compilerVersion", "catalogueVersion", "rulesVersion", "contextVersion", "recentConsistencyVersion"]
    .every(key => Number.isSafeInteger(provenance[key]) && provenance[key] >= 1)) return "invalid";
  return "present";
}
function canonicalTransitionProgram(program, customExercises) {
  const rows = new TrainingModel.Program(program, snapshotLookup(customExercises)).toJSON();
  return rows.map(row => {
    const canonical = cloneSnapshot(row);
    // Compiler pattern labels are derived display data. Linked durable rows
    // resolve those labels from the catalogue; identity and every authored
    // field (including notes, sets, progression, and slot placement) remain.
    delete canonical.primary;
    delete canonical.secondary;
    return canonical;
  });
}
function compilerProgramMatchesLive(...args){return TrainingModel.compilerProgramMatchesLive(...args)}
// The public adapter keeps the Entry-owned guided method and the actual
// block command owner together. Commands are bound after verified catalog/model
// initialization, before the Review UI is constructed.
const repforgeProgramTransitionAdapter={stageGuidedManualRepair};
function initializeBlockTransitionCommands(model){
  Object.assign(repforgeProgramTransitionAdapter,createBlockTransitionCommands({
    read:applicationSession.read,transition:generationRules.transition,catalog:()=>rawExerciseCatalog,
    derive:async input=>{const engine=programEngine();return engine?engine.derive(input):generationRules.transition.deriveSuccessor(input)},
    replacement:{...programReplacementCommands,capture:captureProgramReplacement},model,
    drafts:{readRaw:readDraftRaw,preserve:draftPreservationEffect,hasProgressInRemovedSets:draftHasProgressInRemovedSets},
    identity:{nextId:uid,now:()=>new Date().toISOString(),allocateBlockId}}));
}
async function stageGuidedManualRepair(params = {}, io = storageIO) {
    if (!ProgramEntry) return { ok: false, status: "unavailable", code: "program_entry_unavailable", unavailable: true };
    const diagnosis = params.diagnosis;
    const diagKind = diagnosis?.kind;
    if (diagKind !== "fewer_days" && diagKind !== "sessions_too_long") {
      return { ok: false, status: "unavailable", code: "diagnosis_invalid", unavailable: true, invalid: true };
    }
    const targetDays = diagnosis?.answers?.availableDays;
    const targetMins = diagnosis?.answers?.sessionMinutes;
    if (diagKind === "fewer_days" ? !Number.isInteger(targetDays) : !Number.isInteger(targetMins)) {
      return { ok: false, status: "unavailable", code: "invalid_diagnosis_target", unavailable: true, invalid: true };
    }
    const definition = state?.programMeta?.programDefinition;
    if (!definition) return { ok: false, status: "unavailable", code: "program_definition_unavailable", unavailable: true };
    const custom = cloneSnapshot(customExercises());
    const program = flatProgramFromDefinition(definition, custom, 1);
    const days = definition.days.filter((day) => day.kind === "training").map((day, index) => ({
      dayId: day.id, label: day.name, order: index + 1,
      exercises: program.filter((row) => row.dayId === day.id).map(cloneSnapshot),
    }));
    const preview = { source: "build", program: cloneSnapshot(program), programDefinition: cloneSnapshot(definition),
      days, customExercises: custom };
    const name = state?.programMeta?.name || "Taurifer program";
    const result = {
      schemaVersion: ProgramEntry.SCHEMA_VERSION,
      route: "build",
      fingerprint: entryCandidateFingerprint("build", name, preview),
      name,
      selected: { id: "manual_build", source: "manual_build" },
      diagnostics: diagKind === "fewer_days"
        ? { mainConstraint: diagKind, daysPerWeek: targetDays }
        : { mainConstraint: diagKind, sessionMinutes: targetMins },
      preview,
    };
    const answers = { programName: name, daysPerWeek: days.length };
    if (diagKind === "fewer_days" && targetDays >= 2 && targetDays <= 6) answers.daysPerWeek = targetDays;
    let draftState = ProgramEntry.createState({
      draftId: uid(),
      activeProgramRevisionAtStart: readRevision(state),
      now: entryNow(),
      versions: entryVersions(),
    });
    draftState = ProgramEntry.selectRoute(draftState, "build");
    draftState = ProgramEntry.setAnswers(draftState, answers);
    draftState = ProgramEntry.setResult(draftState, result);
    draftState = { ...draftState, step: "editor" };
    const saveResult = await persistSetupDraft(draftState, io || storageIO);
    if (!saveResult?.ok) {
      return {
        ok: false, staged: false,
        conflict: !!saveResult?.conflict, writeFailed: !!saveResult?.writeFailed, invalid: !!saveResult?.invalid,
        code: saveResult?.conflict ? "save_conflict" : (saveResult?.writeFailed ? "save_failed" : "draft_invalid"),
      };
    }
    if (params.openEditor !== false) openEntryDraftEditor();
    return { ok: true, staged: true, kind: "guided_manual_repair", envelope: saveResult.envelope, draftState: entryState };
}
if (typeof window !== "undefined") {
  window.__repforgeProgramTransition = repforgeProgramTransitionAdapter;
  window.__repforgeProgressReview={
    scheduledProgram:()=>cloneSnapshot(scheduledProgramRows()),
    flow:()=>cloneSnapshot(ReviewUi.flow()),
  };
}
window.__repforgeParseCommand=parseSetCommand;
window.__repforgeNormalizeCommand=normalizeCommandText;
window.__repforgeParseDec=parseDec;
window.__repforgeParseLoad=parseLoadInput;

function resolveExerciseFromCommand(parsed,currentExercises){
  if(parsed.exerciseName){
    const q=parsed.exerciseName.toLowerCase();
    const hit=currentExercises.filter(e=>{const n=e.name.toLowerCase();return n.startsWith(q)||n.includes(q)});
    return hit.length===1?hit[0]:null}
  {const fl=focusList();return fl[Math.min(focusUi.index,Math.max(0,fl.length-1))]||null}
}
async function applyParsedCommand(parsed,context){
  const d=context?.day??day,exs=exercises(d).filter(e=>!skipped.has(e.id)),ex=resolveExerciseFromCommand(parsed,exs);
  if(!ex)return;
  const pick=n=>{if(n<1||n>ex.sets)return null;const k=`${ex.id}_${n}`;return committed.has(k)?null:n};
  let setN=null;
  if(parsed.set!=null){for(let n=parsed.set;n<=ex.sets;n++){setN=pick(n);if(setN)break}}
  else{for(let n=1;n<=ex.sets;n++){setN=pick(n);if(setN)break}}
  if(!setN){toast(t("toast.all_sets_saved"));return}
  const key=`${ex.id}_${setN}`;
  let loadDisp=parsed.load;
  if(parsed.unit&&parsed.unit!==state.settings.unit)loadDisp=toDisplay(fromDisplayUnit(parsed.load,parsed.unit));
  if(!activeWorkoutDraft)return;
  const target=draftTargetFromKey(key);if(!target)return;
  const set=activeWorkoutDraft.exercises[target.exerciseInstanceId]?.sets?.[target.setId];
  const definitions=draftSetMetrics(set);
  const fields=[];
  if(definitions.length){
    // A metric-backed set takes the spoken load and reps as its own metrics; a
    // composition without them cannot take "load x reps".
    const loadMetric=definitions.find(metric=>METRIC_FIELD_SEMANTICS.load.includes(metric.semantic));
    const repsMetric=definitions.find(metric=>METRIC_FIELD_SEMANTICS.reps.includes(metric.semantic));
    if(!loadMetric||!repsMetric){toast(t("command.error.no_exercise_match"));return}
    for(const [metric,value] of [[loadMetric,canonicalNumberText(fromDisplay(loadDisp))],[repsMetric,String(parsed.reps)]]){
      const result=await WorkoutSession.dispatch("editMetricValue",{exerciseInstanceId:target.exerciseInstanceId,
        setId:target.setId,metricId:metric.id,value});if(result.status!=="applied")return}
  }else fields.push({field:"load",value:canonicalDraftField("load",canonicalNumberText(loadDisp))},
    {field:"reps",value:String(parsed.reps)});
  if(isEffortMode())fields.push({field:"effort",value:parsed.effort||(parsed.rir!=null?effortForRir(parsed.rir):"hard")});
  else fields.push({field:"rir",value:parsed.rir!=null?canonicalNumberText(parsed.rir):""});
  for(const field of fields){const result=await WorkoutSession.dispatch("editSetField",{exerciseInstanceId:target.exerciseInstanceId,
      setId:target.setId,field:field.field,value:field.value});if(result.status!=="applied")return}
  renderWorkout();return{ex,set:setN}}
/** Fill the next open set from a spoken set, e.g. "80 x 8 @1". Returns true when applied. */
async function applyCommandText(text){
  const v=String(text||"").trim();if(!v)return false;
  const parsed=parseSetCommand(v);
  if(!parsed.ok){toast(parsed.error);return false}
  const exs=exercises().filter(e=>!skipped.has(e.id)),ex=resolveExerciseFromCommand(parsed,exs);
  if(!ex){toast(t("command.error.no_exercise_match"));return false}
  const r=await applyParsedCommand(parsed,{day});
  if(!r)return false;
  const rirBit=parsed.rir!=null?` @${fmt(parsed.rir)}`:parsed.effort?` ${effortLabel(parsed.effort)}`:"";
  toast(t("toast.command_applied",{load:fmt(parsed.load),reps:parsed.reps,rir:rirBit}));
  return true}
window.__repforgeApplyCommandText=applyCommandText;
function updateVoiceBtn(){const b=$("#voiceBtn");if(!b)return;b.classList.toggle("hidden",!(SR&&state.settings.voiceInputEnabled));syncWorkoutMore()}
function startVoiceInput(){
  if(!SR)return;const rec=new SR();rec.lang=I18N?I18N.speechLang():"en-US";rec.interimResults=false;rec.maxAlternatives=1;
  rec.onresult=e=>{const said=e.results[0]?.[0]?.transcript;if(said)applyCommandText(said)};
  rec.onerror=()=>toast(t("toast.voice_failed"));
  try{rec.start()}catch{toast(t("toast.voice_failed"))}}

function prTimeline(filter){return ProgressReadModels.prTimeline(detectPRs(state.log),progressProgramFacts(),filter)}
window.__repforgePrTimeline=prTimeline;
function prEvidenceReadModel(filter){return ProgressReadModels.prs(detectPRs(state.log),progressProgramFacts(),filter)}
function attentionGroups(){return ProgressReadModels.attentionGroups(progressReadFacts(),strengthEvidenceRecords("current-block"))}


window.__repforgeRecommendation=recommendation;
window.__repforgeProgressionForExercise=progressionForExercise;
window.__repforgeValidateStateShape=isValidStateShape;

window.__repforgeAttention=attentionGroups;
function completedHardSets(windowDays){return ProgressReadModels.hardSets(readLogRows(),state.program,{start:daysAgo(windowDays-1),hardRir:+state.settings.hardRir})}
function volEff(map,name){const value=map.get(name);return value?value.d+value.p:0}
function volumeDashboard(){return ProgressReadModels.rollingVolume(progressReadFacts(),{planned:prog.volume(),cutoff7:daysAgo(6),cutoff28:daysAgo(27)})}

window.__repforgeVolumeDashboard=volumeDashboard;
window.__repforgeOverviewVolume={pct:overviewBarPct,sorted:overviewVolumeSorted,label:muscleLabel};
// Observed outcomes come from the authoritative paired-exposure comparison,
// never from presentation. flat reads as "maintained" in the evidence model.

function strengthEvidenceRows(log=state.log){return readLogRows(log).filter(isWork).map(r=>({exerciseId:liftKey(r),session:r.session,
  sessionKey:strengthSessionKey(r),date:r.date,created:r.created??null,blockId:r.blockId??null,
  name:displayName(r),day:r.day,primary:r.primary,secondary:r.secondary,
  load:+r.load,reps:+r.reps,rir:r.rirMeasured===false||r.rir==null||r.rir===""?null:+r.rir,work:true,
  strengthComparable:r.strengthComparable,strengthConvention:r.strengthConvention,perSideLoad:r.perSideLoad,perSideReps:r.perSideReps,
  loadPerSide:r.loadPerSide,repsPerSide:r.repsPerSide,tonnage:r.tonnage,repetitionsPerformed:r.repetitionsPerformed}))}
function compareProgressStrengthSession(ex,currentRows,readerContext){
  const context=readerContext||{};
  return deriveProgressSessionOutcome({key:exerciseLiftKey(ex)||`slot:${ex?.id||""}`,
    currentRows:Array.isArray(currentRows)?currentRows.map(row=>({key:liftKey(row),session:row.session})):null,
    reader:{scope:context.scope,convention:context.convention,session:context.session,
      rows:Array.isArray(context.log)?strengthEvidenceRows(context.log):null},
    meta:{started:state.programMeta?.started||null,mesocycleLengthWeeks:state.programMeta?.mesocycleLengthWeeks||6,blockId:snapshotBlockId(state)}},{t})}

function progressProjectionInputs(scope){const rows=strengthEvidenceRows();return{scope,recordKeys:rows.map(liftKey),meta:{started:state.programMeta?.started||null,
  mesocycleLengthWeeks:state.programMeta?.mesocycleLengthWeeks||6,blockId:snapshotBlockId(state)},
  rows:rows.map(row=>({...row,e1rm:e1rm(row.load,row.reps)})),
  program:prog.exercises.map(ex=>({key:exerciseLiftKey(ex)||`slot:${ex.id}`,name:ex.name,signal:"—"}))}}
function strengthEvidenceRecords(scope="current-block"){
  return buildStrengthEvidenceRecords(progressProjectionInputs(scope))}

function strengthFactsByLift(scope="current-block"){
  return Object.fromEntries(strengthEvidenceRecords(scope).filter(r=>r.outcome).map(r=>[r.exerciseId,r.outcome]))}
function strengthProjection(scope="current-block"){
  const facts=progressProjectionInputs(scope),records=buildStrengthEvidenceRecords(facts);
  const projection=buildStrengthProjection({...facts,records,prEvents:detectPRs(state.log)});
  return{...projection,dashboard:projection.dashboard.map(row=>{
    const ex=currentExerciseForLiftKey(row.key),rec=ex?recommendation(ex):{label:"—"};
    return{...row,latest:`${fmtLoad(row.latestLoad)}×${row.latestReps}`,signal:rec.label}})}}

// The test seam and the legacy fallback both read the same scoped projection
// as the primary Strength renderer. No caller gets an all-history latest value
// while the selected surface says current block.
window.__repforgeStrengthDashboard=()=>strengthProjection(ProgressUi.state().strengthScope).dashboard;
function volumeEvidenceReadModel(scope){return ProgressReadModels.volume(scope,progressReadFacts())}
function progressEvidenceMeta(){return ProgressReadModels.evidenceMeta(progressReadFacts())}

function redrawChart(){ExerciseUi?.redraw()}

function adoptHistoryDurableHead(head){
  if(!head)return;
  publishTrainingSnapshot(head);
  resetPersistenceBase(state);}
/** The block bounds History groups and counts by: where the running block started,
 *  how long it is, how many training days a week it plans, and the archived
 *  blocks before it. Read from the program, never stored for History. */
function historyBlockContext(){
  const meta=state.programMeta||{};
  return{started:meta.started||null,weeks:+meta.mesocycleLengthWeeks||6,planned:prog.days().length,
    today:today(),name:meta.name||"",
    archived:(state.programHistory||[]).map(entry=>({
      name:entry?.meta?.name||"",start:entry?.meta?.started||null,
      end:entry?.completedAt?String(entry.completedAt).slice(0,10):null,
      planned:new Set((entry?.program||[]).map(ex=>ex?.day).filter(Boolean)).size}))}}
/** History's per-session outcome uses the shared row projection and only compares
 *  strength evidence with the same logged convention (CONTEXT.md, Session outcome). */
function historySessionOutcome(rows){
  const source=Array.isArray(rows)?rows:[],first=source[0];
  const ex=currentExerciseForLiftKey(liftKey(first))||exerciseIdentityFromRow(first);
  const current=source.map(readLogRow).filter(row=>isWork(row)&&+row.load>0&&+row.reps>0);
  if(!current.length||current.some(row=>row.strengthComparable===false))return noComparableSessionOutcome();
  const conventions=new Set(current.map(row=>row.strengthConvention||"load"));
  if(conventions.size!==1)return noComparableSessionOutcome();
  const convention=conventions.values().next().value,session=String(current[0].session??"");
  if(current.some(row=>String(row.session??"")!==session))return noComparableSessionOutcome();
  const comparableLog=readLogRows(state.log).filter(row=>row.strengthComparable!==false&&
    (row.strengthConvention||"load")===convention);
  const previous=previousSessionRowsLog(ex,session,comparableLog);
  return compareProjectedSessionOutcome(current,previous,convention)}
const historyCommands=createHistoryCommands({read:applicationSession.read,
  commit:(proposal,opts)=>commitProposedState(proposal,storageIO,opts),readRevision,
  settleAlreadyCommitted:opts=>DurableState.settleHistoryAlreadyCommitted(opts),
  readDurable:()=>DurableState.readDurableState(),settlePending:()=>settlePendingJournal(),publish:adoptHistoryDurableHead});
const historyDiagnostics={enabled:false,builds:0,sourceRowVisits:0,last:null,onBuilt:null,
  reset(){this.enabled=true;this.builds=0;this.sourceRowVisits=0;this.last=null;this.onBuilt=null},
  disable(){this.enabled=false;this.last=null;this.onBuilt=null}};
const historyIndexCache=new WeakMap(),historyRowFactsCache=new WeakMap();
let historyContextCache=null;
function historyReadContext(){
  const language=locTag(),date=today();
  if(historyContextCache?.snapshot===state&&historyContextCache.language===language&&historyContextCache.date===date)return historyContextCache.value;
  const dayLabels=Object.fromEntries([...new Set([...(state.program||[]).map(ex=>ex.day),...(state.log||[]).map(row=>row.day)])].map(day=>[day,dayLabel(day)]));
  const value={block:historyBlockContext(),locale:language,today:date,weekdayLetters:weekdayLetters(),dayLabels,revision:readRevision(state)};
  historyContextCache={snapshot:state,language,date,value};return value;
}
function historyReadRow(row){
  const context=historyReadContext(),cached=historyRowFactsCache.get(row);
  if(cached?.context===context)return cached.value;
  const value={reading:readLogRow(row),name:exerciseDisplayName(row),storedName:displayName(row),liftKey:liftKey(row)};
  historyRowFactsCache.set(row,{context,value});return value;
}
function buildHistoryReadIndex(log){
  const source=(log||[]).map(raw=>raw&&typeof raw==="object"?raw:{}),currentNames=currentMovementNames();
  const rowFacts=new Map(source.map(row=>[row,{...historyReadRow(row),currentName:currentNameForRow(row,currentNames)}]));
  const grouped=groupHistoryRows({rows:source,rowFacts});
  const comparisons=new Map(grouped.pairs.filter(pair=>!pair.first).map(pair=>[`${pair.session}|${pair.liftKey}`,buildSessionDelta(pair.previous,pair.current)]));
  const dayLabels=Object.fromEntries([...new Set(source.map(row=>row.day))].map(day=>[day,dayLabel(day)]));
  const index=completeHistoryIndex(grouped,{rowFacts,comparisons,prEvents:detectPRs(source),dayLabels});
  if(historyDiagnostics.enabled){
    historyDiagnostics.builds++;historyDiagnostics.sourceRowVisits+=source.length;historyDiagnostics.last=index;
    if(typeof historyDiagnostics.onBuilt==="function")historyDiagnostics.onBuilt(index);
  }
  return index;
}
function historyReadIndex(source=state.log){
  const cached=historyIndexCache.get(source),context=historyReadContext();
  if(cached?.program===state.program&&cached.language===context.locale)return cached.index;
  const index=buildHistoryReadIndex(source);
  historyIndexCache.set(source,{program:state.program,language:context.locale,index});return index;
}
const HistoryUi=createHistoryController({window,
  queries:{rows:()=>state.log,index:historyReadIndex,buildIndex:buildHistoryReadIndex,search:searchHistoryIndex,
    row:historyReadRow,context:historyReadContext,outcome:historySessionOutcome,diagnostics:historyDiagnostics},
  commands:historyCommands,copy:{t},
  format:{date:formatLongDate,load:fmtLoad,loadPlain:fmtLoadPlain,compact:kfmt,number:fmt,displayLoad:toDisplay,unit:unitLabel,muscle:muscleLabel,
    metricLabel,metricText:metricTextValue,metricUnit:metricDisplayUnit},
  inputs:{date:parseCalendarDate,load:parseLoadDisplay,reps:parseRepsValue,rir:parseRirValue,metric:parseHistoryMetricInput},
  shell:{openModal,closeModal,reducedMotion,canTakeFocus},
  onChanged:()=>render(),onNotice:toast,onOutcome:payload=>captureEvent("history_session_outcome",payload)});
window.__repforgeHistory=HistoryUi;
window.__repforgeSaveSessionEdit=HistoryUi.saveSessionEdit;

// ---- Exercise detail: one lift's stats, session history and session notes ----
// Reached by tapping an exercise name on the Log tab; not part of the bottom nav.
function exerciseDetailReadModel(key,capturedExercise){
  const tmpl=currentExerciseForLiftKey(key)||capturedExercise||null,rows=state.log.filter(row=>liftKey(row)===key).map(row=>({...row,e1rm:e1rm(+row.load,+row.reps)}));
  const sessions=ReadModels.groupExerciseSessions(rows),latest=sessions.at(-1)?.rows.at(-1),name=latest?exerciseDisplayName(latest):((tmpl&&exerciseDisplayName(tmpl))||key);
  const exRef=tmpl||(latest?exerciseIdentityFromRow(latest):null),artEntry=libraryUi.exerciseRefEntry(exRef),artSrc=exerciseMedia(artEntry);
  const comparisons=new Map(exRef?sessions.map(session=>[session.session,compareExerciseSession(exRef,session.rows)]):[]);
  const stats=ReadModels.buildExerciseReadModel({rows,
    prs:detectPRs(state.log).filter(event=>event.liftKey===key).map(event=>({...event,e1rm:e1rm(event.load,event.reps)})),
    summaries:summaries().filter(row=>row.liftKey===key),comparisons});
  const rec=tmpl?recommendation(tmpl):null;
  return{key,name,slotId:tmpl?.id||null,muscle:muscleListLabel(tmpl?.primary||""),
    prescription:tmpl?{day:dayLabel(tmpl.day),text:tmpl.hasRepTarget===false?programPrescriptionSummary(tmpl):`${tmpl.sets} × ${tmpl.min}–${tmpl.max} ${t("log.reps")}`,
      hasRepTarget:tmpl.hasRepTarget!==false,rirHigh:state.settings.rirHigh}:null,
    art:artSrc?{src:artSrc,bg:exerciseMediaBg(artEntry)}:null,
    recommendation:rec?{status:rec.status,cue:rec.load!=null?recCueLoad(rec):rec.label,text:rec.text}:null,...stats};
}

function currentViewId(){return $$(".view").find(v=>v.classList.contains("active"))?.id||"log"}
function openExerciseView(key,from){return ExerciseUi.open(key,from)}
function closeExerciseView(){return ExerciseUi.close()}
function renderExerciseView(){return ExerciseUi.render()}
function openSettingsView(){showSettings()}

function editorAdapterTranslate(key,vars,fallback){
  const value=t(key,vars);return value===key?(fallback||key):value}
function editorMetricDefinitionList(id){
  const source=rawMetricDefinitions(id);
  if(source!==null)return source;
  const custom=(customExercises()||[]).find(entry=>entry.id===String(id??""));
  return Array.isArray(custom?.metricDefinitions)?custom.metricDefinitions.map(cloneSnapshot):[]}
function editorMetricTargetText(definition,target){
  const show=value=>metricTextValue(value,definition);
  if(typeof target==="number")return show(target);
  if(isPlainStateObject(target)&&Number.isFinite(target.min)&&Number.isFinite(target.max)){
    const low=show(target.min),high=show(target.max);
    return target.min===target.max?low:`${low}–${high}`}
  return""}
function editorMetricAdapter({cycleIndex}={}){
  return{
    metricLabel:definition=>metricLabel(definition),
    formatMetricValue:(definition,value)=>editorMetricTargetText(definition,value),
    metricDisplayUnit:definition=>metricDisplayUnit(definition),
    parseMetricInput:(definition,raw)=>parseHistoryMetricInput(definition,raw),
    metricDefinitionsForExercise:id=>editorMetricDefinitionList(id),
    metricOptions:()=>cloneSnapshot(ExerciseMetrics?.DEFINITIONS||[]),
    metricCompositions:()=>cloneSnapshot(ExerciseMetrics?.SOURCE_COMPOSITIONS||[]),
    cycleIndex:typeof cycleIndex==="function"?cycleIndex:()=>1,
  }}
function createInstalledProgramEditorAdapter(){
  return{
    read:InstalledEditor.read,
    commit:InstalledEditor.commit,
    chooseExercise:request=>libraryUi.chooseForEditor(request),
    t:editorAdapterTranslate,
    dayLabel:(day)=>dayLabel(day),
    dayCount:(n)=>editorAdapterTranslate("program.editor.day_count",{n,word:t(n===1?"program.editor.exercise_word":"program.editor.exercises_word")}),
    dayAddPlacement:()=>"outside",
    exerciseEntry:(id)=>libraryEntry(id),
    movementLabel:(id)=>libraryName(libraryEntry(id)),
    exerciseLabel:(exercise)=>exercise?.name,
    exerciseDisplayLabel:(exercise)=>exerciseDisplayName(exercise),
    formatNumber:(value)=>fmt(value),
    ...editorMetricAdapter({cycleIndex:()=>mesocycleLifecycle(state.programMeta).current||1}),
    defaultLoadStepKg:()=>{const global=+state.settings.minJump;return Number.isFinite(global)&&global>0?global:2.5},
    suggestLoads:InstalledEditor.rules.editorSuggestLoadsPolicy,
    context:()=>{const mc=mesocycleWeek();return mc.current!=null?mesocycleWeekCopy(mc):""},
    status:()=>"",
    confirm:({kind,day})=>kind==="day_remove"?confirm(t("confirm.delete_day",{day:dayLabel(day)})):true,
    reducedMotion:()=>reducedMotion(),
    announce:announceEditorChange,
    afterModal:afterModalSettles,
  }
}
window.__debugProgramEditor=async()=>{const local=readLocalStatus(),idb=await readIdbStatus();return{session:InstalledEditor.readSession(),state:cloneSnapshot(state),local,idb,decision:chooseSnapshot(local,idb),head:await refreshPersistenceHead()}};
function createOnboardingProgramEditorAdapter(){
  return{
    read(){return{document:BuildAuthoring.editorDocumentFromSnapshot(programEditorSnapshot()),token:{draftRevision:entryState?.revision||0}}},
    async commit({nextDocument,intent}){
      const baseline=BuildAuthoring.editorDocumentFromSnapshot(programEditorSnapshot()),document=cloneSnapshot(nextDocument);
      if(!(entryState?.route==="build"?BuildAuthoring:InstalledEditor.rules).syncEditorCanonicalIntent(document,baseline,intent,{cycleIndex:Number(intent?.cycleIndex)||1}))
        return{ok:false,invalid:true,code:"invalid_canonical_editor_intent"};
      const proposal=programEditorSnapshot();proposal.program=cloneSnapshot(nextDocument.program||[]);
      proposal.program=cloneSnapshot(document.program||[]);
      proposal.programMeta=cloneSnapshot(document.programMeta||proposal.programMeta);
      proposal.customExercises=cloneSnapshot(document.customExercises||proposal.customExercises||[]);
      syncProgramStructureFromProgram(proposal,makeProgram(proposal.program,snapshotLookup(proposal.customExercises),proposal.programMeta));
      const result=await commitProgramEditorProposal(proposal);
      updateOnboardingEditorActions();
      return{...result,ok:!!(result.localOk||result.idbOk),setupDraft:true,staged:true,
        document:BuildAuthoring.editorDocumentFromSnapshot(programEditorSnapshot()),token:{draftRevision:entryState?.revision||0}};
    },
    chooseExercise:request=>libraryUi.chooseForEditor(request),
    t:editorAdapterTranslate,
    dayLabel:(day)=>dayLabel(day),
    dayCount:(n)=>editorAdapterTranslate("program.editor.day_count",{n,word:t(n===1?"program.editor.exercise_word":"program.editor.exercises_word")}),
    exerciseEntry:(id)=>libraryEntry(id),
    movementLabel:(id)=>libraryName(libraryEntry(id)),
    exerciseLabel:(exercise)=>exercise?.name,
    exerciseDisplayLabel:(exercise)=>exerciseDisplayName(exercise),
    formatNumber:(value)=>fmt(value),
    ...editorMetricAdapter({cycleIndex:()=>1}),
    ...(entryState?.route==="build"?{defaultLoadStepKg:()=>{const global=+state.settings.minJump;return Number.isFinite(global)&&global>0?global:2.5},
      suggestLoads:InstalledEditor.rules.editorSuggestLoadsPolicy}:{}),
    context:()=>"",
    // A message already announced is rendered in place; a new one is left for
    // updateOnboardingEditorActions to write, which is what announces it.
    status:()=>{const message=onboardingEditorStatus().message;return message===onboardingEditorAnnounced?message:""},
    afterRender:()=>updateOnboardingEditorActions(),
    confirm:()=>true,
    reducedMotion:()=>reducedMotion(),
    announce:announceEditorChange,
    afterModal:afterModalSettles,
  }
}
/* What the Build editor's status line says: the first thing still blocking
   activation, or that the draft is saved. */
function onboardingEditorStatus(){
  const issues=entryState?ProgramEntry.candidateActivationIssues(entryState):[];
  const progression=issues.some(issue=>issue.startsWith("progression_incompatible:"));
  /* Named the way the day rows name them (dayLabel), never as the stored "Day N". */
  const emptyDays=issues.filter(issue=>issue.startsWith("day_empty:")).map(issue=>dayLabel(
    entryState.result?.preview?.programStructure?.days
      ?.find(day=>day.dayId===issue.slice("day_empty:".length))?.label
      ||issue.slice("day_empty:".length)));
  const message=progression?editorAdapterTranslate("entry.editor.progression_invalid",undefined,"This program has an unsupported progression pairing."):
    issues.some(issue=>issue.startsWith("exercise_invalid:"))?editorAdapterTranslate("entry.editor.exercise_invalid",undefined,"Complete each exercise before continuing."):
      emptyDays.length?editorAdapterTranslate("entry.editor.empty_days",{days:emptyDays.join(", ")},"Add an exercise to each training day."):
        issues.length?editorAdapterTranslate("entry.editor.incomplete",{n:issues.length},"Finish the program before continuing."):
          editorAdapterTranslate("entry.editor.draft_saved",undefined,"Draft saved");
  return{issues,message}}
function updateOnboardingEditorActions(){
  const button=$("#entryEditorActivate");if(!button||!entryState)return;
  const {issues,message}=onboardingEditorStatus();button.disabled=issues.length>0;
  if(issues.length)button.setAttribute("aria-describedby","entryEditorStatus");else button.removeAttribute("aria-describedby");
  const status=$("#onbProgramEditor [data-role=\"editor-status\"]");if(!status)return;
  status.id="entryEditorStatus";
  // Rewriting an unchanged live region announces it again.
  if(status.textContent!==message)status.textContent=message;
  onboardingEditorAnnounced=message;
  status.hidden=false;
  status.classList.toggle("is-error",issues.length>0);
  status.setAttribute("role",issues.length?"alert":"status");
  status.setAttribute("aria-live",issues.length?"assertive":"polite");
}
let onboardingEditorAnnounced=null;
let mountedProgramEditorInstance=null;
function mountedProgramEditor(){
  return mountedProgramEditorInstance||(mountedProgramEditorInstance=createProgramEditor({window,nextId:uid,
    motion:ensureBrowserPresentation().motion,
    sorting:{read:()=>window.DndKit||null,available:()=>window.RepForgeDndRuntime?.available()===true,
      load:()=>window.RepForgeDndRuntime?.load()||Promise.resolve(null)}}));
}
function mountOnboardingProgramEditor(){
  const host=$("#onbProgramEditor");if(!host)return null;
  onboardingEditorAnnounced=null;
  onboardingProgramEditor?.dispose?.();
  onboardingProgramEditor=mountedProgramEditor().mountProgramEditor(host,createOnboardingProgramEditorAdapter());
  const status=host.querySelector('[data-role="editor-status"]');if(status)status.id="entryEditorStatus";
  return onboardingProgramEditor;
}
function disposeProgramEditors(){
  onboardingProgramEditor?.dispose?.();onboardingProgramEditor=null;
  InstalledEditorView?.disposeEditor();
}
function programEditorSnapshot(){
  if(!setupEditorOpen)return cloneSnapshot(state);
  const preview=entryState?.result?.preview||{},snapshot=cloneSnapshot(state);
  const candidateProgram=cloneSnapshot(preview.program||[]);
  const merged=mergeImportedCustomExercises(preview.customExercises||[],candidateProgram,snapshot);
  snapshot.customExercises=merged.customExercises;
  snapshot.program=candidateProgram;
  const loadingConfiguration=entryState?.route==="build"
    ?normalizeLoadingConfiguration(preview.loadingConfiguration):null;
  const suggestLoadsPending=entryState?.route==="build"&&Array.isArray(preview.suggestLoadsPending)&&preview.suggestLoadsPending.length
    ?cloneSnapshot(preview.suggestLoadsPending):null;
  snapshot.programMeta={...defaultProgramMeta([]),name:entryResultName()||entryState?.answers?.programName||"",
    daysPerWeek:entryState?.answers?.daysPerWeek||preview.frequency||null,onboarded:false,
    ...(preview.programDefinition?{programDefinition:cloneSnapshot(preview.programDefinition)}:{}),
    ...(loadingConfiguration?{loadingConfiguration}:{}),
    ...(suggestLoadsPending?{suggestLoadsPending}:{}),
    programStructure:cloneSnapshot(preview.programStructure||null),
    progressionRelations:cloneSnapshot(preview.progressionRelations||[]),
    progressionModifiers:cloneSnapshot(preview.progressionModifiers||[]),
    progressionIncompatibilities:cloneSnapshot(preview.progressionIncompatibilities||[])};
  return snapshot}
function programEditorProgram(){
  if(!setupEditorOpen)return prog;
  const snapshot=programEditorSnapshot();
  return makeProgram(snapshot.program,null,snapshot.programMeta)}
async function commitProgramEditorProposal(proposal,io=storageIO,opts={}){
  if(!setupEditorOpen)return InstalledEditor.commitForm(proposal,opts,io);
  if(!entryState?.result?.preview){
    entryPersistenceDiagnostic={operation:"editor-commit",ok:false,code:"editor-preview-missing",issues:[]};
    return{localOk:false,idbOk:false,setupDraftInvalid:true,code:"editor-preview-missing"}}
  const definition=canonicalProgramDefinition(proposal.programMeta?.programDefinition,
    proposal.customExercises||[]);
  if(!definition){
    entryPersistenceDiagnostic={operation:"editor-commit",ok:false,code:"program_definition_required",issues:[]};
    return{localOk:false,idbOk:false,setupDraftInvalid:true,code:"program_definition_required"}}
  proposal.programMeta={...(proposal.programMeta||{}),programDefinition:definition};
  // ProgramDefinition owns slot identity and prescriptions. The legacy Program
  // model remains useful here for validating linked muscle attribution, but it
  // is not a publication format: serializing it would drop slot/day identity
  // and leak legacy-only fields back into the setup candidate.
  const program=flatProgramFromDefinition(definition,proposal.customExercises||[],1);
  const model=makeProgram(program,snapshotLookup(proposal.customExercises),proposal.programMeta);
  // Compiler previews intentionally use the compiler's internal lowercase
  // muscle ids while they are staged outside durable state. Resolve linked
  // built-ins/customs here before validating the editor result, so the setup
  // draft may retain its preview representation but every edited candidate
  // crossing toward activation already has the durable canonical domain.
  const canonicalProgram=model.toJSON();
  if(!Array.isArray(proposal.customExercises)||
    !proposal.customExercises.every(isSafeCustomExercise)||
    !isValidMuscleDomainTree({program:canonicalProgram,customExercises:proposal.customExercises})){
    entryPersistenceDiagnostic={operation:"editor-commit",ok:false,code:"invalid-muscle-domain",issues:[]};
    return invalidMuscleDomainCommit(proposal)}
  const structure=proposal.programMeta?.programStructure?cloneSnapshot(proposal.programMeta.programStructure):null;
  const structureDays=structure?.days||[];
  const rowsForDay=label=>program.filter(exercise=>exercise.day===label).map(cloneSnapshot);
  const previewDays=entryState.route==="shared"
    ?sharedPreviewDays(program,structure,entryState.result.preview.sharedSettings)
    :(structureDays.length?structureDays.map(item=>({dayId:item.dayId,label:item.label,
      ...(item.displayNameKey?{displayNameKey:item.displayNameKey}:{}),
      ...(item.nameOverride?{nameOverride:item.nameOverride}:{}),
      exercises:rowsForDay(item.label||item.dayId)})):
      [...new Set(program.map(exercise=>exercise.day))].map(label=>({dayId:label,label,exercises:rowsForDay(label)})));
  const progressionData=candidateProgressionData(proposal.programMeta?.progressionRelations,program,
    proposal.programMeta?.progressionIncompatibilities,"candidate-editor");
  const loadingConfiguration=entryState.route==="build"
    ?normalizeLoadingConfiguration(proposal.programMeta?.loadingConfiguration):null;
  const referencedCustomIds=new Set([...program.map(exercise=>exercise.libraryId),
    ...definitionMovementIds(proposal.programMeta?.programDefinition)].filter(isCustomLibraryId));
  const preview={...cloneSnapshot(entryState.result.preview),program,
    ...(proposal.programMeta?.programDefinition?{programDefinition:cloneSnapshot(proposal.programMeta.programDefinition)}:{}),
    programStructure:structure,
    progressionRelations:progressionData.relations,
    progressionIncompatibilities:progressionData.incompatibilities,
    ...(entryState.route==="build"?{loadingConfiguration}:{}),
    ...(entryState.route==="build"?{suggestLoadsPending:Array.isArray(proposal.programMeta?.suggestLoadsPending)
      ?cloneSnapshot(proposal.programMeta.suggestLoadsPending):[]}:{}),
    days:previewDays,
    customExercises:(entryState.result.preview?.customExercises||[])
      .filter(entry=>referencedCustomIds.has(entry.id)).map(cloneSnapshot)};
  if(!preview.suggestLoadsPending?.length)delete preview.suggestLoadsPending;
  const previousEntryState=entryState;
  const result={...cloneSnapshot(entryState.result),preview};
  const nextName=proposal.programMeta?.name||entryState.result.name;
  if(nextName){result.name=nextName;delete result.namePt}else delete result.name;
  result.fingerprint=entryCandidateFingerprint(entryState.route,result.name,preview);
  entryPinnedVersionsExecutable=false;
  publishEntryDraft(ProgramEntry.setResult(entryState,result));
  // persistSetupDraft advances the module-level entryState synchronously
  // (ahead of its own durable round trip), so a second commit started while
  // this write is still pending already sees — and builds on — this call's
  // result. Capture that synchronous outcome so a later failure can tell
  // whether anything has superseded it.
  const persisted=persistSetupDraft(entryState);
  const attemptedEntryState=entryState;
  const saved=await persisted;
  entryPersistenceDiagnostic={operation:"editor-commit",ok:!!saved?.ok,
    code:saved?.code||(saved?.conflict?"setup-draft-conflict":saved?.writeFailed?"setup-draft-write-failed":saved?.invalid?"setup-draft-invalid":null),
    issues:(saved?.issues||[]).slice(0,12).map(issue=>String(issue).slice(0,240))};
  if(!saved?.ok){
    if(saved?.conflict&&EntryDraft.baseline()){
      // A real conflict means persistSetupDraft's handle/raw check found
      // another writer's bytes under the setup-draft key: this candidate has
      // permanently diverged from what is durably saved (every future write
      // from this tab will see the same foreign raw and fail the same way),
      // exactly what entry.save_conflict.body already tells the lifter
      // ("reload to continue from the newer saved draft"). previousEntryState
      // is only one step back and, once several edits have queued behind a
      // failing write, can itself still carry other unpersisted changes —
      // rebasing those onto each other one failure at a time is how memory
      // ends up torn from storage. Rebase onto EntryDraft.baseline()
      // instead: the one candidate known to match what is actually on disk.
      publishEntryDraft(cloneSnapshot(EntryDraft.baseline()));
      // The editor's own document (program-editor.js's local copy, which is
      // what the DOM actually renders from) is not touched by a failing
      // commit's return value — stage() only adopts a returned document on
      // success. Force it back in sync with the rebased candidate now,
      // the same way the "Discard changes" control already does, rather
      // than leave it showing edits that just became durably impossible.
      onboardingProgramEditor?.discard?.();
    // Otherwise, only unwind this call's own change. If entryState still is
    // exactly what this call set it to, nothing landed afterward and a full
    // revert back to the pre-commit snapshot is safe (the historical
    // behavior). If a later commit has already advanced entryState past that
    // point, that state carries real work this call never owned; stomping it
    // back to previousEntryState would discard it. Leaving entryState alone
    // here is safe for the editor document too: a later commit always
    // resolves with a document rebuilt from whatever entryState currently
    // holds, so no commit ever renders this one's stale snapshot.
    }else if(entryState===attemptedEntryState)publishEntryDraft(previousEntryState);
  }
  if(saved?.ok&&progressionData.incompatibilities.length){
    entryEditorStatusFocusPending=true;
    setTimeout(()=>focusEntryEditorStatus(),reducedMotion()?0:320)}
  return saved?.ok?{revision:saved.envelope?.revision||0,localOk:true,idbOk:true,setupDraft:true}:
    {revision:0,localOk:false,idbOk:false,setupDraft:true,setupDraftConflict:!!saved?.conflict,
      code:saved?.code||null,issues:Array.isArray(saved?.issues)?saved.issues.slice(0,12):[]}}
function openEntryDraftEditor(){
  if(!entryState?.result?.preview)return;
  setupEditorOpen=true;InstalledEditorView.setEditing(false);
  showOnboardingView();armEntryHistory();renderOnboarding()}
function closeEntryDraftEditor(){
  setupEditorOpen=false;InstalledEditorView.setEditing(false);onboardingProgramEditor?.dispose?.();onboardingProgramEditor=null;
  onboardingOrigin=null;document.body.classList.remove("is-entry-editor");closeOnboarding()}
function focusEntryEditorStatus(){
  // A picker owns focus until its close transition has restored the editor.
  // Leave the pending request intact so the post-close call can focus the new
  // status node instead of immediately losing focus back to the picker trigger.
  if(!entryEditorStatusFocusPending)return false;
  const status=$("#onbProgramEditor [data-role=\"editor-status\"]")||$("#entryEditorStatus");
  if(shellView().activeModal||!status||status.offsetParent===null){
    if(!entryEditorStatusFocusTimer)entryEditorStatusFocusTimer=setTimeout(()=>{
      entryEditorStatusFocusTimer=null;focusEntryEditorStatus()},120);
    return false}
  entryEditorStatusFocusPending=false;
  try{status.focus({preventScroll:true})}catch{try{status.focus()}catch{return false}}
  return true}

function addVol(...args){return TrainingModel.addVol(...args)}

function notifyEffective(){return notificationControls().effective()}
function reconcileNotifyPermission(){return notificationControls().reconcile()}
function paintNotifyControls(){return notificationControls().paint()}
function setNotificationsEnabled(wanted){return notificationControls().setEnabled(wanted)}

/* Activation keeps the Basics on this device as the lifter's profile
   (OD-4): answered fields replace their old values, skipped ones leave them.
   The weight unit becomes the app's unit when no workout draft would need
   converting. Never part of a link, a state proposal's context or telemetry. */
function interpretedProfile(profile){return interpretProfile(profile,ProgramEntry)}
function renderProfileSettings(){return settingsView().renderProfile()}
function clearProfile(){return settingsView().clearProfile()}
function renderSettings(){settingsView().render();updateVoiceBtn()}
function commitSettings(silent){return settingsView().save(silent)}


function table(rows){return formatTable(rows,t("stats.table.no_data"))}

function exportCsv(){return BackupCommands.exportCsv()}
function exportJson(){return BackupCommands.exportJson()}
/* A program-only export carries its own custom definitions. Without them a
   template arriving on another device points at a "custom:…" id that device has
   never seen: the movement survives as copied strings but stops being a
   reusable exercise. Only definitions this program actually references travel;
   the rest of the lifter's library is not this file's business. */
function referencedCustomExercises(list){
  const wanted=new Set((list||[]).map(e=>e.libraryId).filter(id=>isCustomLibraryId(id)));
  return customExercises().filter(e=>wanted.has(e.id)).map(cloneSnapshot)}
/* The codec validates the canonical definition with the compiler and may carry
   an unedited generated program as its canonical generator request. */
function sharedSetupCodecOptions(){
  return{builtInIds:SHARED_BUILT_IN_IDS,catalogSnapshot:rawExerciseCatalog,
    validateProgramDefinition:ProgramCompiler?.validateProgramDefinition,
    generateProgram:ProgramCompiler?.generateProgram,generatorVersion:ProgramCompiler?.GENERATOR_VERSION}}
function sharedSetupDecodeCodecOptions(signal){
  return{...sharedSetupCodecOptions(),signal,generateProgramAsync:(request,catalogSnapshot,options={})=>{
    const engine=programEngine();
    return engine?engine.generate(request,{signal:options.signal}):ProgramCompiler?.generateProgram(request,catalogSnapshot)}}}
/* =====================================================   Exercise picker
   One sheet, three callers: the program editor's add and change
   paths, and the log-tab substitution.
   Callers hand it a mode and a callback and get library entries
   back — they never touch the library themselves, so a movement
   arrives in a program slot the same way from every surface.
   ============================================================ */

/* Search is accent- and case-blind, and reads both languages at once: a
   Portuguese lifter still types "bench press" for a machine whose plate says
   so, and an English one still finds "supino". */
/* An imported split arrives as names. Matching them to the library is what
   turns it from a list of strings into something the app can reason about:
   muscle tags for the volume audit, and a link the swap picker can work from.
   Names that find no match keep exactly what was imported — the program is the
   lifter's, not the library's — and their slots show an accented swap button
   in the editor so linking them by hand is one tap. */
function linkImportedExercises(list){
  const byName=new Map();
  for(const entry of pickableExercises()){
    for(const n of [entry.name,entry.namePt]){
      const key=foldSearch(n);
      if(key&&!byName.has(key))byName.set(key,entry)}}
  let linked=0;
  for(const ex of list){
    if(!ex||typeof ex!=="object")continue;
    // A Taurifer export already carries links; only repoint ids the library
    // has since merged, and never overwrite a link that still resolves.
    if(ex.libraryId){
      const known=libraryEntry(ex.libraryId);
      if(known){ex.libraryId=known.id;linked++;continue}
      delete ex.libraryId}
    const match=byName.get(foldSearch(ex.name));
    if(!match)continue;
    ex.libraryId=match.id;
    if(!String(ex.primary??"").trim())ex.primary=match.primary||"";
    if(!String(ex.secondary??"").trim())ex.secondary=match.secondary||"";
    if(!String(ex.notes??"").trim()&&match.notes)ex.notes=match.notes;
    linked++}
  return{linked,total:list.length}}

/* =====================================================   Program import — staged, reviewed, then written
   Parsing produces a transient model only. Nothing durable moves
   until the lifter presses Import, so a file that turns out to be
   wrong costs them nothing. Names are classified rather than
   guessed at: an exact hit links itself, a likely one has to be
   looked at, and anything else keeps exactly what was imported.
   ============================================================ */

const IMPORT_EXACT="exact",IMPORT_ALIAS="alias",IMPORT_PROBABLE="probable",IMPORT_UNMATCHED="unmatched";
let importDraft=null,importReturn=null;

/* Taurifer's own text export, read back. The grammar is the one programText()
   writes: a title line, then "DAY NAME: muscles", then "1. Exercise: 3× 6 to 10".
   Anything that does not look like that is rejected rather than guessed at —
   this parses one known format, it does not read prose. */
/* The text export shouts day names ("DAY 1", "TREINO A") for legibility, so a
   round-trip would otherwise bring the shouting back into the program. A label
   with no lowercase at all was uppercased on the way out; anything else is left
   exactly as written. */
function restoreExportCase(label){
  if(label!==label.toLocaleUpperCase(locTag())||!/[a-z]/i.test(label))return label;
  return label.toLocaleLowerCase(locTag()).replace(/(^|\s)(\p{L})/gu,(m,sp,ch)=>sp+ch.toLocaleUpperCase(locTag()))}
function stripProgramTextTitleMeta(label){
  return String(label||"").replace(/\s*(?:\(\s*|,\s*)\d+\s*(?:days?\s*\/\s*week|days?\s+per\s+week|dias?\s*\/\s*semana|dias?\s+por\s+semana)\s*\)?\s*$/iu,"").trim()}
function parseProgramTextExport(text){
  const lines=String(text||"").split(/\r?\n/);
  const dataIndex=lines.findIndex(line=>line.trim()===PROGRAM_TEXT_DATA_MARKER);
  let data=null;
  if(dataIndex>=0){try{const parsed=JSON.parse(lines[dataIndex+1]||"");if(parsed&&parsed.version===1)data=parsed}catch{}}
  const content=dataIndex<0?lines:lines.filter((_,index)=>index!==dataIndex&&index!==dataIndex+1);
  const days=[];let current=null,title="";
  const exRe=/^\s*(\d+)\.\s*(.+?)(?:\s*[—-]\s*|\s*:\s*)(\d+)\s*[×x]\s*(\d+)(?:\s*(?:[–-]|to|a)\s*(\d+))?\s*$/iu;
  for(const raw of content){
    const line=raw.trim();
    if(!line)continue;
    const ex=line.match(exRe);
    if(ex){
      if(!current){current={day:`Day ${days.length+1}`,rows:[]};days.push(current)}
      const min=+ex[4],max=ex[5]?+ex[5]:min;
      const legacy=ex[2].trim().match(/^(.*)\s+\[(range|manual|rep_goal|anchor_backoff)@(\d+)\]$/iu);
      const row={name:(legacy?.[1]||ex[2]).trim(),sets:+ex[3],min,max};
      // Read the pre-appendix range marker without exposing it in the new
      // export. Its parameters are the already-authored text targets; other
      // strategy markers remain structural and cannot invent executable data.
      if(legacy?.[2].toLowerCase()==="range"&&legacy[3]==="1")row.progression={
        schemaVersion:1,strategy:{id:"range",version:1,params:{workingSets:row.sets,repMin:row.min,repMax:row.max}},modifiers:[]};
      current.rows.push(row);
      continue}
    // A non-exercise line starts a day, except the first which is the title.
    if(!title&&!days.length){title=restoreExportCase(stripProgramTextTitleMeta(line));continue}
    const label=line.split(/\s*[—-]\s+|\s*:\s+/)[0].trim();
    if(!label)continue;
    current={day:restoreExportCase(label),rows:[]};days.push(current)}
  const exercises=[];
  for(const d of days)
    d.rows.forEach((r,i)=>{
      const carried=data?.exercises?.find(ex=>ex?.day===d.day&&ex?.order===i+1);
      exercises.push({day:d.day,order:i+1,name:r.name,sets:r.sets,min:r.min,max:r.max,
        ...(carried?.id?{id:carried.id}:{ }),...(carried?.movementId?{movementId:carried.movementId}:{ }),
        ...(carried?.progression?{progression:carried.progression}:r.progression?{progression:r.progression}:{}),
        ...(carried?.progressionIncompatibility?{progressionIncompatibility:carried.progressionIncompatibility}:{} )});
    });
  if(!exercises.length)return null;
  const metaOut=title?{name:title}:null;
  if(metaOut&&data){if(Array.isArray(data.relations))metaOut.progressionRelations=data.relations;if(Array.isArray(data.modifiers))metaOut.progressionModifiers=data.modifiers;if(Array.isArray(data.incompatibilities))metaOut.progressionIncompatibilities=data.incompatibilities}
  return{exercises,meta:metaOut,customExercises:[]}}

function importedMuscleValues(row,{canonical=false}={}){
  for(const key of ["primary","secondary"]){
    if(!Object.prototype.hasOwnProperty.call(row,key))continue;
    const result=MuscleDomain.normalizeMuscleAttribution(row[key]);
    if(!result.ok||canonical&&result.value!==row[key])return false;
  }
  return true}
function validImportedExerciseRow(row){
  if(!row||typeof row!=="object"||Array.isArray(row))return false;
  const text=v=>typeof v==="string"&&v.trim().length>0;
  return text(row.day)&&Number.isInteger(row.order)&&row.order>=1&&row.order<=1000&&
    text(row.name)&&Number.isInteger(row.sets)&&row.sets>=1&&row.sets<=100&&
    Number.isInteger(row.min)&&row.min>=1&&row.min<=1000&&
    Number.isInteger(row.max)&&row.max>=row.min&&row.max<=1000&&
    (row.libraryId===undefined||text(row.libraryId))&&importedMuscleValues(row,{canonical:true});}
function validRawImportedExerciseRow(row){
  if(!row||typeof row!=="object"||Array.isArray(row))return false;
  const text=v=>typeof v==="string"&&v.trim().length>0;
  // A legacy alias is accepted only when it is itself well-formed. Do not let
  // a valid repLow/repHigh silently mask a malformed canonical min/max field.
  if(Object.prototype.hasOwnProperty.call(row,"min")&&
    (!Number.isInteger(row.min)||row.min<1||row.min>1000))return false;
  if(Object.prototype.hasOwnProperty.call(row,"max")&&
    (!Number.isInteger(row.max)||row.max<1||row.max>1000))return false;
  if(Object.prototype.hasOwnProperty.call(row,"repLow")&&
    (!Number.isInteger(row.repLow)||row.repLow<1||row.repLow>1000))return false;
  if(Object.prototype.hasOwnProperty.call(row,"repHigh")&&
    (!Number.isInteger(row.repHigh)||row.repHigh<1||row.repHigh>1000))return false;
  const min=Number.isInteger(row.min)?row.min:row.repLow;
  const max=Number.isInteger(row.max)?row.max:row.repHigh;
  return text(row.day)&&text(row.name)&&Number.isInteger(row.sets)&&row.sets>=1&&row.sets<=100&&
    Number.isInteger(min)&&min>=1&&min<=1000&&Number.isInteger(max)&&max>=min&&max<=1000&&
    (row.order===undefined||(Number.isInteger(row.order)&&row.order>=1&&row.order<=1000))&&
    (row.libraryId===undefined||text(row.libraryId))&&importedMuscleValues(row);}
function normalizeImportedRows(rows){
  const orders=new Map();
  return rows.map(row=>{
    const out={...row};
    // Older program-only exports carried repLow/repHigh and omitted order.
    // These are lossless aliases: order is the row's position within its day,
    // and bounds are copied only when the source supplied valid integers.
    if(out.order===undefined&&typeof out.day==="string"){
      const next=(orders.get(out.day)||0)+1;orders.set(out.day,next);out.order=next}
    if(out.min===undefined&&Number.isInteger(out.repLow))out.min=out.repLow;
    if(out.max===undefined&&Number.isInteger(out.repHigh))out.max=out.repHigh;
    for(const key of ["primary","secondary"]){
      if(!Object.prototype.hasOwnProperty.call(out,key))continue;
      out[key]=MuscleDomain.normalizeMuscleAttribution(out[key]).value}
    return out})}
/* A Taurifer program file is imported as its exact definition: every row is
   already a catalog or carried custom identity, so nothing is matched by name. */
function parseCanonicalProgramFile(parsed){
  return parseCanonicalFile(parsed,{validImportedCustomExercise,normalizeCustomExercises,
    canonicalProgramDefinition,flatProgramFromDefinition})}
function parseProgramSource(text,fileName=""){
  const trimmed=String(text||"").trim();
  if(trimmed.startsWith("{")||trimmed.startsWith("[")){
    const parsed=boundedImportJson(trimmed);if(parsed===null)return null;
    if(parsed?.kind===PROGRAM_FILE_KIND)return parseCanonicalProgramFile(parsed);
    const imp=parseProgramImport(parsed);
    if(!imp?.exercises?.length||!imp.exercises.every(validRawImportedExerciseRow)||
      !imp.customExercises.every(validImportedCustomExercise))return null;
    imp.exercises=normalizeImportedRows(imp.exercises);
    if(!imp.exercises.every(validImportedExerciseRow))return null;
    return Object.assign({format:"json",legacy:parsed?.version===undefined},imp)}
  if(importUtf8Bytes(trimmed)>IMPORT_MAX_BYTES)return null;
  const text2=parseProgramTextExport(trimmed);
  return text2?Object.assign({format:"text"},text2):null}

/* Words that survive the length filter but carry no movement signal. The
   Portuguese "com" is the expensive one: it made every barbell movement share a
   token with "Hip thrust com barra", so thirty-six entries tied at 0.50 and
   array order picked the winner. */
const MATCH_STOPWORDS=new Set([
  "com","sem","para","por","dos","das","nos","nas","que","seu","sua","pes",
  "the","and","for","with","your","from","into"]);
/* Equipment still informs a match; it must never decide one alone. Scored at a
   fraction of a movement token, then used to break ties, where it is the
   difference between "Hip thrust na maquina" reaching the machine or the bar. */
const MATCH_EQUIPMENT=new Set([
  "barra","halteres","haltere","maquina","polia","cabo","smith","banco",
  "cadeira","mesa","corda","anilha","barbell","dumbbell","machine","cable",
  "bar","bench","rope","plate"]);
const MATCH_EQUIPMENT_TOKENS={
  barbell:["barra","barbell"],dumbbell:["halteres","haltere","dumbbell"],
  machine:["maquina","machine"],cable:["cabo","polia","cable"],
  smith:["smith"],bodyweight:["corpo","bodyweight"]};
const MATCH_EQUIPMENT_WEIGHT=0.25;
const matchTokens=s=>foldSearch(s).split(/[^a-z0-9]+/)
  .filter(w=>w.length>2&&!MATCH_STOPWORDS.has(w));
const matchWeight=w=>MATCH_EQUIPMENT.has(w)?MATCH_EQUIPMENT_WEIGHT:1;
const matchWeightSum=list=>list.reduce((sum,w)=>sum+matchWeight(w),0);

/* How close two movement names are, 0..1, on shared words. Deliberately dumb:
   it only has to be good enough to say "look at this one", never to decide.
   Movement words carry the weight; stopwords carry none and equipment a
   quarter, so "com barra" can no longer outvote "hip thrust". */
function nameAffinity(a,b){
  const wa=matchTokens(a);
  const wb=new Set(matchTokens(b));
  if(!wa.length||!wb.size)return 0;
  const hits=matchWeightSum(wa.filter(w=>wb.has(w)));
  const denom=Math.max(matchWeightSum(wa),matchWeightSum([...wb]));
  return denom?hits/denom:0}

/* A library name wholly present inside the lifter's line. "Leg press 45°, pés
   altos e afastados" is the library's "Leg press" plus the lifter's own setup
   notes, and diluting the score by those notes discarded an exact reading. */
function nameContainment(input,libraryName){
  const wb=matchTokens(libraryName);
  if(!wb.length)return false;
  const wa=new Set(matchTokens(input));
  return wb.every(w=>wa.has(w))}

/* Whether the lifter's line names the equipment this entry uses. */
function matchEquipmentAgrees(input,entry){
  const list=Array.isArray(entry?.equipment)?entry.equipment:[];
  if(!list.length)return false;
  const wa=new Set(matchTokens(input));
  return list.some(kind=>(MATCH_EQUIPMENT_TOKENS[kind]||[kind]).some(tok=>wa.has(tok)))}

/* The floor is a display filter and never a trust gate: buildImportDraft gives
   probable and unmatched rows the same decision and the same unreviewed state,
   so lowering it cannot let anything through unseen. Below it a row proposes
   nothing rather than a guess it cannot stand behind. */
const IMPORT_PROBABLE_MIN=0.35;
const IMPORT_CANDIDATE_LIMIT=3;

/* Classifies one imported row against the library plus the definitions that
   travelled with the file. */
function classifyImportRow(row,candidates){
  const name=String(row.name??"").trim();
  if(row.libraryId){
    const known=candidates.find(e=>e.id===row.libraryId)||libraryEntry(row.libraryId);
    if(known)return{status:IMPORT_EXACT,match:known}}
  const folded=foldSearch(name);
  if(!folded)return{status:IMPORT_UNMATCHED,match:null};
  const exact=candidates.find(e=>foldSearch(e.name)===folded);
  if(exact)return{status:IMPORT_EXACT,match:exact};
  // The same movement written in the other language is a match, but one the
  // lifter should still see, since the name in their file will change.
  const alias=candidates.find(e=>foldSearch(e.namePt||"")===folded);
  if(alias)return{status:IMPORT_ALIAS,match:alias};
  // A curated alias went through the same editorial gate as the entry it points
  // at, so "RDL means Romanian deadlift" is settled rather than guessed, and the
  // row arrives confirmed like any other alias hit. Aliases add ways to reach a
  // movement; they never change which movement an id means.
  const curated=candidates.find(e=>(e.aliases||[]).some(a=>foldSearch(a)===folded));
  if(curated)return{status:IMPORT_ALIAS,match:curated};
  const ranked=rankImportCandidates(name,candidates);
  if(!ranked.length)return{status:IMPORT_UNMATCHED,match:null,candidates:[]};
  return{status:IMPORT_PROBABLE,match:ranked[0].entry,score:ranked[0].score,candidates:ranked}}

/* The ranked shortlist behind a review row. Scoring moves the right entry into
   this list; it does not reliably move it to the front, because a line like
   "Hack squat" never says whether the barbell or the machine is meant. So the
   row offers the list rather than a verdict.

   Order: a contained library name first, then weighted overlap, then the entry
   whose equipment the lifter actually named, then the library's own rank, and
   last the array position, so a tie never rests on position alone. */
function rankImportCandidates(name,candidates,limit=IMPORT_CANDIDATE_LIMIT){
  const scored=[];
  for(let i=0;i<candidates.length;i++){
    const e=candidates[i];
    const names=[e.name,e.namePt||"",...(e.aliases||[])];
    const score=names.reduce((best,n)=>Math.max(best,nameAffinity(name,n)),0);
    const contained=names.some(n=>nameContainment(name,n));
    if(!contained&&score<IMPORT_PROBABLE_MIN)continue;
    scored.push({entry:e,score,contained,equipment:matchEquipmentAgrees(name,e),
      rank:Number.isFinite(e.rank)?e.rank:50,order:i})}
  scored.sort((a,b)=>
    (b.contained?1:0)-(a.contained?1:0)||
    b.score-a.score||
    (b.equipment?1:0)-(a.equipment?1:0)||
    a.rank-b.rank||
    a.order-b.order);
  return scored.slice(0,limit)}

/* Builds the review model. Exact and alias hits arrive decided; a probable one
   arrives undecided and blocks Import until it is looked at. */
function buildImportDraft(source,fileName){
  const candidates=source.customExercises?.length
    ? normalizeCustomExercises(source.customExercises).concat(pickableExercises())
    : pickableExercises();
  const rows=source.exercises.map((raw,i)=>{
    const {status,match,candidates:ranked}=classifyImportRow(raw,candidates);
    return{key:`imp${i}`,raw:cloneSnapshot(raw),status,match,
      shortlist:(ranked||[]).map(c=>c.entry),
      decision:status===IMPORT_EXACT||status===IMPORT_ALIAS?"link":"raw",
      reviewed:status===IMPORT_EXACT||status===IMPORT_ALIAS}});
  return{fileName:String(fileName||""),format:source.format||"json",
    legacy:source.legacy===true,
    meta:source.meta||null,customExercises:source.customExercises||[],rows,
    ...(source.definition?{definition:cloneSnapshot(source.definition)}:{})}}

const importCounts=draft=>{
  const linked=draft.rows.filter(r=>r.decision==="link").length;
  const review=draft.rows.filter(r=>!r.reviewed).length;
  const custom=draft.rows.filter(r=>r.decision==="custom").length;
  return{linked,review,custom,total:draft.rows.length}};

/* Turns reviewed rows into program templates. A linked row takes the
   definition's identity; a raw row keeps precisely what the file said. */
function importDraftExercises(draft){
  return draft.rows.map(r=>{
    const base=cloneSnapshot(r.raw);
    delete base.libraryId;delete base.displayName;
    if(r.decision==="link"&&r.match)
      return Object.assign(base,exerciseFieldsFromLibrary(r.match));
    if(r.decision==="custom"&&r.createdCustomId)
      return Object.assign(base,{libraryId:r.createdCustomId});
    return base})}

/* Definitions that have to exist before the templates can resolve: the ones
   that travelled in a v3 file, plus any created during review. */
function importDraftCustomDefinitions(draft){
  const out=[];
  for(const e of normalizeCustomExercises(draft.customExercises))out.push(e);
  for(const r of draft.rows)if(r.createdCustom)out.push(r.createdCustom);
  return out}

/* =====================================================   The library flow
   One controller behind three surfaces: the quick-add sheet on a
   training day, the full browse page it opens into, and the
   configuration step that follows a multi-selection. The picker
   sheet keeps serving the single-pick jobs (change, substitute)
   — this is the "add to my program" path, where
   choosing several at once and setting their sets afterwards is
   what a lifter actually does.
   ============================================================ */

/* ---- Import review screen ---- */

const importStatusKey={[IMPORT_EXACT]:"import.status.exact",[IMPORT_ALIAS]:"import.status.alias",
  [IMPORT_PROBABLE]:"import.status.probable",[IMPORT_UNMATCHED]:"import.status.unmatched"};

function renderImportReview(){
  if(!importDraft)return;
  const counts=importCounts(importDraft);
  const file=$("#importFile");
  if(file)file.textContent=t("import.file",{name:importDraft.fileName||t("import.file_fallback"),n:counts.total,exercise:tp(counts.total,"lift")});
  const notImportedEl=$("#importNotImported");
  if(notImportedEl){
    if(importDraft?.notImported?.length){
      const items=importDraft.notImported.map(cat=>t(FREEFORM_NOT_IMPORTED_KEYS[cat]||"entry.freeform.not_imported.other_notes")).join(", ");
      notImportedEl.innerHTML=`<p class="entry__notice entry__notice--info" role="status">${esc(t("entry.freeform.not_imported_notice",{items}))}</p>`;
      notImportedEl.hidden=false;
    }else{
      notImportedEl.innerHTML="";
      notImportedEl.hidden=true;
    }
  }
  const originalEl=$("#importOriginalText");
  if(originalEl){
    if(importDraft?.originalText){
      originalEl.innerHTML=`<details class="entry__original-text"><summary>${esc(t("entry.freeform.view_original"))}</summary><pre class="entry__pre">${esc(importDraft.originalText)}</pre></details>`;
      originalEl.hidden=false;
    }else{
      originalEl.innerHTML="";
      originalEl.hidden=true;
    }
  }
  const countsEl=$("#importCounts");
  if(countsEl)countsEl.innerHTML=
    `<span class="impcount"><b>${counts.linked}</b>${esc(t("import.count_linked"))}</span>`+
    `<span class="impcount"><b>${counts.review}</b>${esc(t("import.count_review"))}</span>`+
    `<span class="impcount"><b>${counts.custom}</b>${esc(t("import.count_custom"))}</span>`;
  const rows=$("#importRows");
  if(rows){
    // Rows still needing a decision come first: they are the only reason this
    // screen exists, and a twelve-exercise split should not hide them.
    const ordered=[...importDraft.rows].sort((a,b)=>(a.reviewed?1:0)-(b.reviewed?1:0));
    rows.innerHTML=ordered.map(importRowHtml).join("");
    $$("#importRows [data-imp-act]").forEach(b=>
      b.onclick=()=>importRowAction(b.dataset.impAct,b.dataset.impKey,b.dataset.impIdx));
  }
  /* The one primary lives in the pinned region. While rows still need a
     decision it is disabled, drops its arrow, and the count says why directly
     above it, the same way every route's pinned action does. */
  const commit=$("#importCommit"),reason=$("#importCommitReason");
  if(commit){
    const blocked=counts.review>0;
    commit.disabled=blocked;
    commit.textContent=t("entry.preview.review");
    commit.classList.toggle("btn--noarrow",blocked);
    if(blocked)commit.setAttribute("aria-describedby","importCommitReason");
    else commit.removeAttribute("aria-describedby");
    if(reason){
      reason.hidden=!blocked;
      reason.textContent=blocked?t("import.commit_blocked",{n:counts.review}):""}}
}

function importRowHtml(row){
  // An unreviewed row shows what is being proposed, not the standing default:
  // "keep as imported" beside a Likely badge hides the very thing being asked
  // about. Once decided, the target is the decision.
  const proposed=!row.reviewed&&row.match?row.match:null;
  const shown=row.decision==="link"&&row.match?row.match:proposed;
  const target=shown?libraryName(shown)
    :row.decision==="custom"?t("import.target_custom")
    :t("import.target_raw");
  const badge=row.reviewed
    ?`<span class="impbadge is-done">${esc(t("import.status.confirmed"))}</span>`
    :`<span class="impbadge is-open">${esc(t(importStatusKey[row.status]||"import.status.unmatched"))}</span>`;
  const art=shown?exerciseThumb(shown,{size:"sm"}):emptyThumb({size:"sm"});
  // A settled row keeps its name, its target, its art and its badge, and trades
  // its three remaining alternatives for one quiet way back in. Most settled
  // rows were matched by the importer rather than chosen by the lifter, so the
  // alternatives are noise on the screen you read before replacing a program.
  const folded=row.reviewed&&!row.expanded;
  // Scoring puts the right movement in the shortlist far more reliably than it
  // puts it first, and a line like "Hack squat" never says whether the barbell
  // or the machine is meant. So an undecided row offers its candidates instead
  // of a verdict, and the escape hatches move behind a disclosure rather than
  // wrapping four buttons onto three lines of a phone.
  const shortlist=(row.shortlist||[]).filter(Boolean);
  const chips=!folded&&shortlist.length
    ?shortlist.map((entry,i)=>
      `<button type="button" class="improw__btn improw__btn--pick" data-imp-act="pick" data-imp-idx="${i}" data-imp-key="${esc(row.key)}">${esc(t("import.action_link",{name:libraryName(entry)}))}</button>`).join("")
    :(!folded&&row.match&&row.decision!=="link"
      ?`<button type="button" class="improw__btn" data-imp-act="link" data-imp-key="${esc(row.key)}">${esc(t("import.action_link",{name:libraryName(row.match)}))}</button>`:"");
  const escapes=
    // Every slot of a program names a movement, so an unmatched row is settled
    // by choosing one or creating it; there is no unlinked "keep as typed".
    `<button type="button" class="improw__btn" data-imp-act="choose" data-imp-key="${esc(row.key)}">${esc(t("import.action_choose"))}</button>`+
    (row.decision!=="custom"
      ?`<button type="button" class="improw__btn" data-imp-act="custom" data-imp-key="${esc(row.key)}">${esc(t("import.action_custom"))}</button>`:"");
  const acts=folded
    ?`<button type="button" class="improw__btn improw__btn--change" data-imp-act="expand" data-imp-key="${esc(row.key)}">${esc(t("import.action_change"))}</button>`
    :chips+(chips
      ?`<details class="improw__more"><summary>${esc(t("import.more_options"))}</summary><div class="improw__acts">${escapes}</div></details>`
      :escapes);
  return `<div class="improw${row.reviewed?"":" is-open"}${folded?" is-folded":""}" data-imp-row="${esc(row.key)}">`+
    `<p class="improw__from">${esc(row.raw.name||"")}</p>`+
    `<span class="improw__arrow" aria-hidden="true">→</span>`+
    art+
    `<div class="improw__to"><p class="improw__name">${esc(target)}</p>${badge}</div>`+
    `<div class="improw__acts">${acts}</div>`+
  `</div>`}

function importRowAction(act,key,idx){
  const row=importDraft?.rows.find(r=>r.key===key);
  if(!row)return;
  // Change only reopens the row: the decision it already carries is untouched,
  // so a lifter who taps it and changes their mind still imports what they saw.
  // The render replaces the row's markup, so the caret is put back on the
  // controls the tap was asking for rather than dropped to the document.
  if(act==="expand"){row.expanded=true;renderImportReview();
    $(`#importRows [data-imp-row="${esc(row.key)}"] [data-imp-act]`)?.focus({preventScroll:true});return}
  if(act==="pick"){
    const entry=(row.shortlist||[])[Number(idx)];
    if(!entry)return;
    row.match=entry;row.decision="link";
    settleImportRow(row,Number(idx)===0?"top_candidate":"alternate");
    return}
  if(act==="link"&&row.match){row.decision="link";settleImportRow(row,"top_candidate");return}
  if(act==="choose"){
    libraryUi.openExercisePicker({title:t("import.pick_title"),subtitle:row.raw.name||"",
      onPick:entry=>{row.match=entry;row.decision="link";settleImportRow(row,"picker")}});
    return}
  if(act==="custom"){
    // Creating the definition here rather than at commit time means the lifter
    // sees exactly what will exist before anything is written.
    libraryUi.openCustomExerciseSheet({entry:{name:row.raw.name||"",primary:row.raw.primary||"",secondary:row.raw.secondary||""},
      stageOnly:true,
      onSave:entry=>{row.createdCustom=entry;row.createdCustomId=entry.id;
        row.decision="custom";settleImportRow(row,"custom")}})}}
/** A decided row folds back down: the alternatives have done their job.
 *  How it was decided is the only measure of whether matching improved for
 *  programs we have never seen. Categorical, and never the exercise name. */
function settleImportRow(row,method){
  if(method&&!row.reviewed)
    captureEvent("program_import_row_resolved",
      {method,source:importDraft?.sourceType==="freeform"?"freeform":"file"});
  row.reviewed=true;row.expanded=false;renderImportReview()}

function ensureImportEntryFlow(draft){
  if(entryState?.route==="import"&&entryState.step==="import_source")return;
  const origin=draft?.fromFirstRun?"first-run":hasActiveProgram()?"settings":"first-run";
  startOnboarding(origin,{userInitiated:true});
  if(entryState?.route!=="import"||entryState.step!=="import_source")entrySelectRoute("import")}

function openImportReview(draft){
  ensureImportEntryFlow(draft);
  draft.onboarding=true;
  importDraft=draft;
  captureEvent("program_import_review_reached",{source:draft?.sourceType==="freeform"?"freeform":"file"});
  importReturn=document.activeElement;
  // The review renders inside the app shell, so the first-run gate steps aside
  // for it rather than covering it.
  if(draft?.fromFirstRun)suspendFirstRun();
  document.body.classList.add("is-import");
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="importReview"));
  window.scrollTo({top:0});
  // The review is its own scroll container, like the route it belongs to.
  const reviewView=$("#importReview");if(reviewView)reviewView.scrollTop=0;
  renderImportReview();
  const counts=importCounts(draft),target=counts.review
    ?$("#importRows .improw.is-open [data-imp-act]")
    :$("#importCommit");
  (target||$("#importBack"))?.focus({preventScroll:true})}

function closeImportReview({toProgram=true}={}){
  const wasOnboarding=importDraft?.onboarding,wasFirstRun=importDraft?.fromFirstRun;
  importDraft=null;
  document.body.classList.remove("is-import");
  const back=resolveReturnFocus(importReturn);
  importReturn=null;
  // Backing out of an import started during onboarding returns to onboarding —
  // or to the setup gate it came from. Either way the lifter has no program yet,
  // so they cannot be dropped into the app.
  if(wasFirstRun&&toProgram){openFirstRun();return}
  if(wasOnboarding&&toProgram){showOnboardingView();renderOnboarding();return}
  if(toProgram)returnToTab("program");
  if(back)try{back.focus({preventScroll:true})}catch{}}

function importCandidate(draft){
  const exercises=importDraftExercises(draft);
  const proposal=cloneSnapshot(state);
  const merged=mergeImportedCustomExercises(importDraftCustomDefinitions(draft),exercises,proposal);
  const program=new TrainingModel.Program(exercises,snapshotLookup(merged.customExercises)).toJSON();
  const wantedCustomIds=new Set([...program.map(exercise=>exercise.libraryId),...definitionMovementIds(draft.definition)]
    .filter(isCustomLibraryId));
  const candidateCustomExercises=merged.customExercises
    .filter(entry=>wantedCustomIds.has(entry.id)).map(cloneSnapshot);
  const structure=draft.meta?.programStructure?cloneSnapshot(draft.meta.programStructure):null;
  const structureDays=Array.isArray(structure?.days)?structure.days:[];
  const labels=structureDays.length?structureDays.map(item=>item.label||item.dayId):
    [...new Set(program.map(exercise=>exercise.day))];
  const days=labels.filter(Boolean).map((label,index)=>({
    dayId:structureDays[index]?.dayId||label,label,
    exercises:program.filter(exercise=>exercise.day===label).map(cloneSnapshot),
  }));
  const progressionIncompatibilities=Array.isArray(draft.meta?.progressionIncompatibilities)
    ?cloneSnapshot(draft.meta.progressionIncompatibilities):[];
  const progressionData=candidateProgressionData(draft.meta?.progressionRelations,program,
    progressionIncompatibilities,"program-import");
  const progressionModifiers=normalizeProgressionModifiers(draft.meta?.progressionModifiers,{
    preserveInvalid:true,incompatibilities:progressionData.incompatibilities,source:"program-json"});
  // An imported program becomes a Build definition over the matched catalog
  // movements and custom definitions; the preview rows are its projection.
  const kept=draft.definition&&draft.rows.every(row=>row.decision==="link"&&row.match?.id===row.raw.libraryId);
  const programDefinition=kept?canonicalProgramDefinition(draft.definition,candidateCustomExercises)
    :manualProgramDefinitionFromRows(program,labels,candidateCustomExercises);
  const projected=programDefinition?flatProgramFromDefinition(programDefinition,candidateCustomExercises,1):program;
  const projectedDays=programDefinition?programDefinition.days.filter(day=>day.kind==="training").map((day,index)=>({
    dayId:day.id,label:day.name,order:index+1,exercises:projected.filter(row=>row.dayId===day.id).map(cloneSnapshot)})):days;
  return{
    program:projected,
    days:projectedDays,
    ...(programDefinition?{programDefinition}:{}),
    programStructure:programDefinition?{schemaVersion:1,days:projectedDays.map(({dayId,label,order})=>({dayId,label,order})),
      provenance:{source:"import"}}:structure,
    progressionRelations:progressionData.relations,
    progressionModifiers,
    progressionIncompatibilities:progressionData.incompatibilities,
    customExercises:candidateCustomExercises,
    source:"import",
    format:draft.format,
  }}

/* Review decisions become an owned setup candidate. Durable active state moves
   only through the common explicit activation transaction on the next screen. */
async function commitImportReview(){
  if(!importDraft)return null;
  const counts=importCounts(importDraft);
  if(counts.review>0){toast(t("toast.import_needs_review",{n:counts.review,exercise:tp(counts.review,"lift")}));return null}
  const draft=importDraft;
  setStagedImportSource(draft.sourceType);
  ensureImportEntryFlow(draft);
  const preview=importCandidate(draft);
  const name=typeof draft.meta?.name==="string"?draft.meta.name.trim():"";
  let next=ProgramEntry.setAnswers(entryState,{importReady:true});
  next={...next,versions:entryVersions()};
  next=ProgramEntry.setResult(next,{
    fingerprint:entryCandidateFingerprint("import",name,preview),
    selected:{id:"import",source:"import"},
    name,
    preview,
  });
  next=ProgramEntry.advance(next).state;
  // Keep the in-memory state in lockstep with the staged draft. Every import,
  // including an unversioned first-run program file, remains a candidate until
  // the common preview's explicit activation action is chosen.
  publishEntryDraft(next);
  const saved=await persistSetupDraft(next);
  if(!saved?.ok){toast(t("toast.program_import_failed"));return saved}
  closeImportReview({toProgram:false});
  entryUiNotice=null;
  showOnboardingView();renderOnboarding();
  // The original unversioned program-file door now converges with versioned
  // onboarding imports: both leave the active state untouched until the
  // preview's explicit activation transaction runs.
  return{localOk:false,idbOk:false,staged:true,setupDraft:true}}

/* A backup is not a program file. It carries the log, the settings and the meta
   as well as the program, so reading only its exercises drops the rest on the
   floor — silently, because the review screen has nothing to show for a key it
   never looked at. An empty log is no reason to demote one: the language, the
   rest timer, the RIR mode and the program's own name and block are still in
   there, and the lifter restoring onto a fresh install has nothing else left to
   read them out of. Recognised here so the program door can offer the restore
   instead of quietly discarding it. */
function parseBackupFile(text){return BackupCommands.parse(text)}

/* Reading a file no longer changes anything: it opens the review screen. The
   old path linked names and wrote the program behind one confirm(), which meant
   a wrong file had already replaced the program by the time you saw it. */
async function importProgramFile(e,io){const f=e.target.files?.[0];if(!f)return;
  try{
    if(Number.isFinite(f.size)&&f.size>BACKUP_MAX_BYTES)throw Error();
    const text=await f.text();
    const parsedBackup=parseBackupFile(text),legacyBackup=isLegacyBackup(parsedBackup);
    const backup=legacyBackup?null:parsedBackup;
    const source=parseProgramSource(text,f.name);
    if(legacyBackup&&!source?.exercises?.length){toast(t("toast.backup_legacy"));e.target.value="";return}
    // A backup whose program is empty is still a backup worth restoring, so the
    // exercise requirement only has to hold for a file that is nothing else.
    if(!backup&&!source?.exercises?.length)throw Error();
    pendingImportIo=io||null;
    let draft=null;
    if(source?.exercises?.length){
      draft=buildImportDraft(source,f.name);
      // An import during onboarding still finishes onboarding: it is how a lifter
      // brings their own split instead of generating one. The setup gate's Import
      // is the same first run by another door, so it commits the same way and
      // returns to the gate if it is abandoned. The review comes first either way.
      draft.fromFirstRun=firstRunOpen();
      draft.onboarding=draft.fromFirstRun||!!$("#onboarding")?.classList.contains("active")}
    if(backup)
      // The button said "program", so program-only stays on the table — but
      // what else the file is carrying is now named out loud and can be
      // restored instead.
      openImportChoice(Object.assign(importChoiceContext(backup,e.target,io),
        {bodyKey:"dialog.import.body_program",programOnly:draft?()=>openImportReview(draft):null}));
    else openImportReview(draft);
  }catch{toast(t("toast.program_import_invalid"))}
  e.target.value=""}
let pendingImportIo=null;
/* ---- Free-form program import ----
 * A program a lifter already owns often exists only as a coach's message, a
 * spreadsheet dump or a note to self. Retyping it into the editor is where
 * setup gets abandoned, and Taurifer has no model of its own to read it with.
 * So the conversion is handed to an assistant the lifter already has on their
 * phone, deliberately and by hand: Taurifer writes the prompt around what was
 * pasted, the lifter taps ChatGPT or Claude, and the reply comes back through
 * the same import review a file goes through.
 *
 * This is not an integration. There is no key, no account and no request from
 * this app: the only thing that leaves the device is the text the lifter chose
 * to send, in a link they tapped. The pasted text and the reply live in memory
 * for the length of the flow; only which of the two doors was last used is
 * remembered, as a device-only UI pref. Neither is persisted, exported or
 * logged. See docs/adr/0014-free-form-program-import-handoff.md.
 */
const EntryImport=createEntryImportSession({tabStorage:()=>sessionStorage});
const EntryImportCommands=createEntryImportCommands({session:EntryImport,parseSource:parseProgramSource,sourceName:()=>t("entry.freeform.source_name")});
const EntryUi=createEntryController({document,navigator,session:EntryImport,copy:{t,locale:locTag},
  commands:{review:startFreeformReview,submitGaps:submitFreeformGaps,changeDoor:mode=>{if(mode==="freeform")captureEvent("program_import_started",{source:"freeform"});setImportSourceMode(mode)},
    writeOwn:()=>{const current=EntryImport.read();if((current.source.trim().length>0||current.reply.trim().length>0)&&!confirm(t("entry.freeform.confirm_write_own")))return;resetFreeformImport();entrySelectRoute("build")}},
  queries:{mode:importSourceMode,reviewOpen:()=>!!importDraft},copyText:async(text,okKey,failKey)=>{const ok=await Files.copyText(text);toast(t(ok?okKey:failKey));return ok},onRender:renderOnboarding,onNotice:key=>toast(t(key)),
  onHandoff:event=>captureEvent("program_import_handoff",event),confirm:key=>confirm(t(key)),scrollBehavior});
EntryUi.mount();
const FREEFORM_NOT_IMPORTED_KEYS = {
  rest_times: "entry.freeform.not_imported.rest_times",
  rir_rpe: "entry.freeform.not_imported.rir_rpe",
  tempo: "entry.freeform.not_imported.tempo",
  supersets: "entry.freeform.not_imported.supersets",
  warmups: "entry.freeform.not_imported.warmups",
  cardio: "entry.freeform.not_imported.cardio",
  progression_rules: "entry.freeform.not_imported.progression_rules",
  deload: "entry.freeform.not_imported.deload",
  other_notes: "entry.freeform.not_imported.other_notes",
};
let entryImportMode=null;
function loadFreeformSession(){return EntryImport.load()}
function saveFreeformSession(){EntryImport.save()}
function clearFreeformSession(){EntryImport.clearStored()}
function resetFreeformImport(){EntryUi.reset()}
function setStagedImportSource(sourceType){EntryImport.stageImportSource(sourceType)}
function stagedImportSource(){return EntryImport.importSource()}
function clearStagedImportSource(){EntryImport.clearImportSource()}
/** Which import door this device used last. A preference about this screen, so
 *  it lives with the other device-only UI prefs and never touches state. */
function importSourceMode(){
  if(!entryImportMode)entryImportMode=uiPrefs.importSourceMode==="file"?"file":"freeform";
  return entryImportMode}
function setImportSourceMode(mode,{render=true}={}){
  const prev=importSourceMode();
  if(mode==="file"&&prev==="freeform"&&(EntryImport.read().source.trim().length>10||EntryImport.read().reply.trim().length>10)){
    if(!confirm(t("entry.freeform.confirm_discard")))return;
  }
  entryImportMode=mode==="freeform"?"freeform":"file";
  setUiPref("importSourceMode",entryImportMode);
  // Clearing only the stored copy left the text in memory, so a lifter who
  // confirmed the discard got it back by switching doors again.
  if(entryImportMode==="file")resetFreeformImport();
  else loadFreeformSession();
  if(render)renderOnboarding()}
function captureUnsupportedWorkoutConcepts(sidecar){
  const grammar=unsupportedGrammar;
  if(!grammar?.normalize)return;
  for(const category of grammar.normalize(sidecar))
    captureEvent("program_import_unsupported_concept",{category})}

function importFreeformFromClipboard(){return EntryUi.importClipboard()}
function loadFreeformProgram(source,originalText){
  pendingImportIo=null;captureUnsupportedWorkoutConcepts(source.notImported);
  const draft=buildImportDraft(source,t("entry.freeform.source_name"));
  draft.sourceType="freeform";draft.notImported=source.notImported||[];draft.originalText=originalText;
  draft.fromFirstRun=firstRunOpen();draft.onboarding=draft.fromFirstRun||!!$("#onboarding")?.classList.contains("active");
  EntryImportCommands.reviewOpened();EntryUi.resetTransport();openImportReview(draft);return draft;
}
function startFreeformReview(){
  const result=EntryImportCommands.review();
  if(result.kind==="empty"){toast(t("toast.freeform_empty"));return null}
  captureEvent("program_import_parsed",{source:"freeform",outcome:result.kind,gap_count:result.gapCount});
  if(result.kind==="complete")return loadFreeformProgram(result.source,result.originalText);
  renderOnboarding();if(result.kind==="unreadable")toast(t("toast.freeform_unreadable"));return null;
}
function submitFreeformGaps(){
  const result=EntryImportCommands.submitGaps();
  if(result.kind==="none")return;
  if(result.kind==="complete")return loadFreeformProgram(result.source,result.originalText);
  renderOnboarding();
  if(result.kind==="invalid")try{$(".entry__field-input.is-invalid")?.focus()}catch{}
  else if(result.kind==="unreadable")toast(t("toast.freeform_unreadable"));
}

/* What the restore choice needs to state the trade honestly: what this device
   holds, what the file holds, and how much of the file is actually new. */
function importChoiceContext(s,opener,io){return backupView().context(s,opener,io)}
function importJson(event){return backupView().importJson(event)}
/* Restoring answers the setup gate it may have arrived through: the lifter now
   has both a program and a history, so there is nothing left for the gate to
   ask. Idempotent, since the Settings door has no gate standing. */
function leaveSetupGates(){
  if(firstRunOpen())closeFirstRun();
  if($("#onboarding")?.classList.contains("active"))closeOnboarding()}
/* The body and the buttons describe the file that is actually in front of the
   lifter. A backup taken before the first workout carries no sessions at all,
   so the session arithmetic is noise and Merge has nothing to add: what the
   file still holds is the program and the settings, and the choice is restore
   it or leave this device alone. */
function openImportChoice(context){return backupView().open(context)}

const ProgramEntryAdapter=createEntryAdapter({compiler:ProgramCompiler});
const ENTRY_MUSCLES=ProgramEntry.ENTRY_MUSCLES;
const ENTRY_MOVEMENTS=ProgramEntry.ENTRY_MOVEMENTS;
const ENTRY_ENVIRONMENTS=ProgramEntry.ENTRY_ENVIRONMENTS;
const ENTRY_AVOID_REASONS=ProgramEntry.CONSTRAINT_REASONS;
function entryAnswerVocabulary(){return{muscles:ENTRY_MUSCLES,competencies:entryAbilityKeys(),equipmentGroups:ProgramEntry.EQUIPMENT_GROUPS||[],avoidReasons:ENTRY_AVOID_REASONS,maxPriority:ProgramEntry.MAX_PRIORITY_MUSCLES,maxMuscles:ProgramEntry.MAX_MUSCLE_CONTROLS||22}}
const EntryLiveAnswerCommands=createEntryAnswerCommands({read:()=>entryState,apply:entryPatchAnswers,vocabulary:entryAnswerVocabulary(),presetEquipmentGroups:entryPresetGroups});
let entryState=null,entryEngaged=false,entryUiNotice=null,entryCompileError=null,entryValidationNotice=false,entryEditorStatusFocusPending=false,entryEditorStatusFocusTimer=null,entryPinnedVersionsExecutable=false,entryDurableConflictNeedsReload=false,entryVisibleScreenKey=null;
// EntrySetup publishes the exact frozen live draft to this read-model alias.
let EntrySetup=null;
function publishEntryDraft(next){return EntrySetup.publish(next)}
let entryMotionRun=null,entryMotionCleanup=null,entryEdgeSwipe=null,entryEdgeUnder=null,entrySwipeCommitting=false;
let entryPersistenceDiagnostic=null;
/* Entry presentation state: the confirm dialog on screen ("restart", "replace";
   "cancel" is `entryUiNotice` because other flows already ask for it), and the
   route-help panel on the hub. None of it is part of the draft. */
let entryDialog=null,entryChange=null,entryGoalFromHub=false,entryPickerInput=null;
/* Review-time UI that is never part of the draft: whether the "about" screen's
   goal question is open, the answer editor open under its chip (with a private
   copy of the answers it edits), and the program the lifter just left, for the
   change statement when the same walk comes back to a result. */
let entryGoalOpen=false,entryEditor=null,entryLastPreview=null,entryReviewError=null;
const ENTRY_HISTORY_STATE_KEY="tauriferProgramEntry";
let EntryDraft=null;
function entryServices(){
  if(typeof window!=="undefined"&&window.__repforgeProgramEntryServicesOverride)return window.__repforgeProgramEntryServicesOverride;
  if(!ProgramEntryAdapter||!ProgramCompiler||!rawExerciseCatalog)return null;
  return ProgramEntryAdapter.createProductionServices({Compiler:ProgramCompiler,catalog:rawExerciseCatalog})}
function entryCandidateFingerprint(route,name,preview){
  const semanticPreview=cloneSnapshot(preview||{});
  if(Array.isArray(semanticPreview.customExercises)){
    semanticPreview.customExercises=semanticPreview.customExercises.map(entry=>{
      const normalized={...entry};delete normalized.created;return normalized})}
  return entryServices()?.fingerprint?.({route:route||null,name:name||"",preview:semanticPreview})||"candidate"}
function entryResultName(result=entryState?.result){
  if(!result)return"";
  return String(isPt()?(result.namePt||result.name||""):(result.name||result.namePt||"")).trim()}
function entryNow(){return new Date().toISOString()}
function entryVersions(){return entryServices()?.currentVersions?.()||{
  compiler:"1",family:"1",blueprint:"1",catalogue:"1",rules:"1",context:"1",progression:"range-1",
  recentConsistency:"1",simpleStart:"1"}}
function liveProgramRevision(){return readRevision(state)}
function hasActiveProgram(){return !!(state?.programMeta?.onboarded&&((state.program||[]).length||structureDayLabels(state.programMeta)))}
/* Is there a program to show at all? Deliberately blind to `onboarded`, which
   answers a different question: a restored backup or a migrated legacy snapshot
   can carry a real program with the flag unset, and hiding it behind "No program
   yet" would lose the lifter their training. `hasActiveProgram()` stays the test
   for whether the entry hub is replacing something. */
function hasProgramContent(){return !!((state?.program||[]).length||structureDayLabels(state?.programMeta))}
function readSetupDraftRaw(){return EntryDraft.readRaw()}
function readSetupDraftRecord(){return EntryDraft.readRecord()}
function reportSetupDraftWriteFailure(kind,error){
  entryUiNotice=kind;
  if(error)console.warn("setup draft save failed",error);
  if(setupEditorOpen)renderOnboarding();
  else if(document.body.classList.contains("is-onboarding"))renderOnboarding()}
function removeObservedSetupDraft(handle){return EntryDraft.removeObserved(handle)}
function removeSetupDraftIfCurrent(handle=EntryDraft.handle()){return EntryDraft.remove(handle)}
function clearSetupDraft(){clearEntryAdjust();return EntryDraft.clear()}
function setupActivationAlreadyCommittedToLive(raw){
  const marker=state?.[STORAGE_SETUP_TXN];
  return typeof raw==="string"&&isValidSetupActivationMarker(marker)&&
    marker.revision===readRevision(state)&&setupActivationMatches(marker,raw,state?.programMeta?.id);
}
async function finishAlreadyCommittedSetup(handle){
  const cleanup=await removeSetupDraftIfCurrent(handle);
  if(cleanup?.ok){
    publishEntryDraft(null);EntryDraft.adopt(null,null);onboardingOrigin=null;setupEditorOpen=false;
    InstalledEditorView.setEditing(false);document.body.classList.remove("is-entry-editor");closeOnboarding();
  }else{
    entryUiNotice=cleanup?.conflict?"save_conflict":"save_failed";
    renderOnboarding();
  }
  return{revision:readRevision(state),localOk:true,idbOk:true,alreadyCommitted:true,
    setupDraftCleanup:cleanup};
}
async function recoverCommittedSetupDraft(){
  const marker=state?.[STORAGE_SETUP_TXN];
  if(!isValidSetupActivationMarker(marker)||marker.revision!==readRevision(state)||
    marker.programId!==state?.programMeta?.id)return{ok:true,absent:true};
  const raw=readSetupDraftRaw();
  // A missing draft means the post-commit cleanup already won. A different
  // raw value belongs to a later owner/revision and must remain untouched.
  if(raw===null||raw!==marker.raw)return{ok:true,absent:raw===null,conflict:raw!==null};
  return withStorageLock(storageIO,()=>removeObservedSetupDraft({raw,envelope:null}));
}
function persistSetupDraft(next,io=storageIO){return EntrySetup.save(next,{io,production:io===storageIO})}
function createEntryState(extra={}){return EntrySetup.create(extra)}
function applyLegacyHints(stateIn){
  if(!ProgramEntry)return stateIn;
  const legacy=state?.programMeta;
  if(!legacy||legacy.onboarded!==true)return stateIn;
  const migrated=ProgramEntry.migrateLegacyAnswers({
    goal:legacy.goal,experience:legacy.experience,daysPerWeek:legacy.daysPerWeek,
    sessionLength:legacy.sessionLength,equipment:legacy.equipment,splitType:legacy.splitType,
    priorityMuscles:legacy.priorityMuscles},
    {route:stateIn.route,compatibleSplits:(entryServices()?.splitChoices(stateIn.answers||{})?.choices||[]).map(c=>c.id)});
  if(!migrated.ok)return stateIn;
  let next=ProgramEntry.setAnswers(stateIn,migrated.value.answers);
  next={...next,legacyHints:migrated.value.legacyHints};
  return next}
function showOnboardingView(){entryVisibleScreenKey=null;$("#onboarding").classList.remove("hidden");$("#onboarding").classList.add("active");document.body.classList.add("is-onboarding");
  $$(".view").forEach(v=>{if(v.id!=="onboarding")v.classList.remove("active")})}
function entryHistoryState(active=true){
  const current=history.state&&typeof history.state==="object"?history.state:{};
  return{...current,[ENTRY_HISTORY_STATE_KEY]:{
    active,draftId:entryState?.draftId||null}}}
function armEntryHistory(){
  try{
    const existing=history.state?.[ENTRY_HISTORY_STATE_KEY];
    const method=existing?"replaceState":"pushState";
    history[method](entryHistoryState(true),"",location.href)}catch{}}
function syncEntryHistory(){
  try{
    if(history.state?.[ENTRY_HISTORY_STATE_KEY]?.active)
      history.replaceState(entryHistoryState(true),"",location.href)}catch{}}
function disarmEntryHistory(){
  try{
    if(history.state?.[ENTRY_HISTORY_STATE_KEY])
      history.replaceState(entryHistoryState(false),"",location.href)}catch{}}
function closeOnboarding(){
  entryPickers.dispose();
  // The pasted program and the reply belong to the flow that asked for them.
  resetFreeformImport();
  cancelEntryGeneration();
  entryPickerInput=null;entryDialog=null;entryReplaceResolve?.(false);entryReplaceResolve=null;closeEntryDialog();
  onboardingProgramEditor?.dispose?.();onboardingProgramEditor=null;setupEditorOpen=false;
  $("#onboarding")?.classList.remove("program-editor-onboarding");
  $("#onboarding").classList.remove("active");$("#onboarding").classList.add("hidden");document.body.classList.remove("is-onboarding","is-entry-editor","is-settings");
  disarmEntryHistory();
  const log=$("#log");if(log&&!log.classList.contains("active")){
    $$("nav button").forEach(x=>{const on=x.dataset.view==="log";x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    log.classList.add("active")}
  render()}
/* The program-entry funnel (Plan 071 §4). renderOnboarding reports the
   screen it actually shows; telemetry.js turns two consecutive screens into
   viewed/completed/back by the route's own step order. An entry the app
   opened by itself stays quiet until the lifter picks a route. */
let entryFunnelView=null,entryFunnelArmed=false;
function observeEntryStep(route,step){
  const view={route,step,at:Date.now(),answers:entryState?.answers||{}};
  let events=[];
  try{events=Telemetry?.entryFunnelEvents?.(entryFunnelView,view,ProgramEntry?.ROUTE_STEPS)||[]}catch{}
  if(!events.length)return;
  entryFunnelView=view;
  if(entryFunnelArmed)for(const [name,properties] of events)captureEvent(name,properties)}
function reportEntryExit(action){
  const view=entryFunnelView;entryFunnelView=null;
  if(!view||!entryFunnelArmed)return;
  captureEvent("onboarding_exit",{action,route:view.step==="entry"?"none":view.route,step:view.step})}
function reportEntryStart(automatic){
  entryFunnelView=null;entryFunnelArmed=!automatic;
  if(automatic)return;
  const origin={"first-run":"first_run",settings:"settings",block:"block"}[onboardingOrigin];
  const offered={resume:"resumable",conflict:"activation_conflict",rules_changed:"rules_changed",corrupt:"corrupt"}[entryUiNotice];
  if(origin)captureEvent("onboarding_started",{origin,resumed:offered!==undefined&&offered!=="corrupt"});
  if(offered)captureEvent("onboarding_resume_offered",{status:offered})}
function reportEntryRoute(route){
  entryFunnelArmed=true;
  if(entryEngaged)return;
  entryEngaged=true;
  captureEvent("program_path_selected",{route});
  if(route==="recommend"||route==="custom")captureEvent("generator_started",{mode:"baseline"})}
/* Where an entry flow was started from, so cancelling it returns there and puts
   focus back on the control that opened it. The landing is the one start that
   cannot be returned to: it is the boot surface, closed for good once the lifter
   leaves it, so cancelling lands on Today's no-program state. Activation always
   ends on Today. */
let entryReturnTo=null;
function captureEntryReturn(){
  if($("#onboarding")?.classList.contains("active"))return;
  const view=currentViewId();
  entryReturnTo={view:["stats","history","program","settings"].includes(view)?view:"log",control:routeInvokerControl()}}
function returnFromEntry(back){
  const view=back?.view||"log";
  if(view==="settings")showSettings();
  else if(view!=="log")returnToTab(view);
  focusRoute(back?.control||routeHeading(view))}
function startOnboarding(origin,opts={}){
  if(!ProgramEntry){console.warn("program entry unavailable");return}
  captureEntryReturn();
  cancelEntryGeneration();
  entryPickerInput=null;
  onboardingOrigin=origin||(!state.programMeta?.onboarded&&!state.log.length?"first-run":"settings");
  entryEngaged=false;EntryUi.clearHubChoice();entryDialog=null;entryChange=null;entryGoalFromHub=false;entryReplaceResolve=null;entryCompileError=null;entryUiNotice=null;entryValidationNotice=false;EntryUi.resetAnswerFields();entryPinnedVersionsExecutable=false;entryDurableConflictNeedsReload=false;
  const started=EntrySetup.start(opts);entryUiNotice=started.notice;
  if(started.cleared)clearEntryAdjust();
  const resumedScreen=entryQuestionFlow().normalizeScreen(entryState);
  if(resumedScreen!==entryState){publishEntryDraft(resumedScreen);persistSetupDraft(entryState)}
  reportEntryStart(opts.userInitiated===false);
  showOnboardingView();armEntryHistory();renderOnboarding();
  if(opts.userInitiated===false)return;
  // Opening the hub is not choosing a route; telemetry waits for a route pick.
}
// A persisted setup draft is auto-resumed on boot only when it is a normalized
// guided manual-repair build/editor draft: route "build", step "editor", a
// non-empty preview program, and the exact diagnosis instruction
// stageGuidedManualRepair writes — an integer diagnostics.daysPerWeek in 1..7
// for fewer_days (createGuidedManualRepair's target range; the ordinary build
// answers.daysPerWeek editor seed keeps its own 2..6 constraint), or a positive
// integer diagnostics.sessionMinutes for sessions_too_long. A main-constraint
// token alone, or a missing / non-integer / out-of-range target, does not
// qualify: ordinary saved setup drafts on an onboarded device are left
// untouched, and first-run behavior is unchanged.
function isGuidedRepairSetupDraft(envelope){
  const st=envelope?.state;
  if(!st||st.route!=="build"||st.step!=="editor")return false;
  const result=st.result;
  if(!result||result.route!=="build")return false;
  const preview=result.preview;
  if(!preview||!Array.isArray(preview.program)||preview.program.length===0)return false;
  const diagnostics=result.diagnostics;
  const main=diagnostics?.mainConstraint;
  if(main==="fewer_days"){
    const days=diagnostics.daysPerWeek;
    return Number.isInteger(days)&&days>=1&&days<=7;
  }
  if(main==="sessions_too_long"){
    const minutes=diagnostics.sessionMinutes;
    return Number.isInteger(minutes)&&minutes>0;
  }
  return false;
}
/** The chooser never opens by itself before onboarding: the landing is the boot
 *  surface and leads to it. An onboarded device still resumes a guided repair
 *  draft straight into the editor. */
function maybeShowOnboarding(){
  if(!state.programMeta?.onboarded&&state.log.length===0)return;
  const record=readSetupDraftRecord();
  if(record.ok&&record.envelope&&isGuidedRepairSetupDraft(record.envelope)){
    startOnboarding("settings",{userInitiated:false});
    if(entryState?.step==="editor"&&entryState?.result?.preview)openEntryDraftEditor();
  }
}
function cancelOnboarding(){
  if(onboardingOrigin==="block")pendingBlockTransition=null;
  onboardingOrigin=null;
  const back=entryReturnTo;entryReturnTo=null;
  closeOnboarding();returnFromEntry(back)}
function requestEntryCancel(){
  if(!entryState)return cancelOnboarding();
  entryDialogOpener=entryOpenerToken();
  entryUiNotice="cancel";
  persistSetupDraft(entryState);
  renderOnboarding()}
async function keepEntryDraftAndCancel(){
  if(!await EntrySetup.keep())return renderOnboarding();
  reportEntryExit("keep_draft");
  cancelOnboarding()}
async function discardEntryDraftAndCancel(){
  clearEntryAdjust();
  const removed=await EntrySetup.discard();
  if(!removed.ok)return renderOnboarding();
  reportEntryExit("discard_draft");
  cancelOnboarding()}
function entrySetState(next,{persist=true}={}){
  next=entryQuestionFlow().normalizeScreen(next);
  // Anything that moves the flow on supersedes a program still generating for it.
  if(entryResultJob){entryResultJob.controller.abort();entryResultJob=null}
  const offerKey=entryOfferKey(next);
  if(entryOfferJob&&(next?.step!=="result"||offerKey!==entryOfferJob.key)){
    entryOfferJob.controller.abort();entryOfferJob=null}
  if(next?.step!=="result"||entryOfferState.key!==offerKey)entryOfferState={key:offerKey,offers:[]};
  const direction=entrySwipeCommitting?null:entryMotionDirection(entryState,next);
  clearEntryMotion();
  const outgoing=direction&&entryMotionAvailable()?cloneEntryMotionPage(entryMotionLivePage()):null;
  if(next?.step!==entryState?.step||next?.route!==entryState?.route){
    entryPickerDraft={};EntryUi.clearPriorityLimit();
    if(entryBuilding){entryBuilding.timers.forEach(clearTimeout);entryBuilding.release()}
    entryBuilding=null}
  publishEntryDraft(next);
  if(next?.step!=="background")entryGoalFromHub=false;
  entryValidationNotice=false;
  syncEntryHistory();
  if(persist)persistSetupDraft(entryState);
  renderOnboarding({pageTransition:outgoing?{direction,outgoing}:null})}
function entryCustomSplitChoices(answers=entryState?.answers||{}){
  try{return entryServices()?.splitChoices?.(answers)||{choices:[]}}catch(error){console.warn("custom split choices failed",error);return{choices:[]}}}
function entryCustomShapeRequired(answers=entryState?.answers||{}){
  return entryCustomSplitChoices(answers).choices.length>=2}
let EntryQuestionFlow=null;
function entryQuestionFlow(){return EntryQuestionFlow||(EntryQuestionFlow=createEntryQuestionFlow({rules:ProgramEntry,splitChoices:entryCustomSplitChoices}))}
function entrySelectRoute(route,{goal=null}={}){
  if(!ProgramEntry||!entryState)return;
  reportEntryRoute(route);
  entryPinnedVersionsExecutable=false;
  const next=ProgramEntry.selectRoute(entryState,route,{reusableContext:state?.programmingContext});
  const migrated=applyLegacyHints(next);
  let selected=migrated;
  if(route==="custom"){
    const splits=entryServices()?.splitChoices(selected.answers)||{choices:[]};
    if(splits.choices.length===1)selected=ProgramEntry.setAnswers(selected,{splitPreference:splits.choices[0].id});
  }
  /* The hub's featured block is Recommend's first question (Q627): one tap
     chooses the route, answers the goal and moves on. It is the same three
     commands the goal screen would have run, composed into one transition so
     the draft is written once, after the goal exists. */
  if(route==="recommend"&&goal){
    const answered=ProgramEntry.setAnswers(selected,{desiredResult:goal});
    const advanced=ProgramEntry.advance(answered);
    selected=advanced.ok?advanced.state:answered}
  entrySetState(selected);
  // Back from the first screen after a goal tap returns to the hub the goal was
  // asked on, not to a second goal screen.
  entryGoalFromHub=route==="recommend"&&!!goal&&selected.step==="background"}
function entryPatchAnswers(patch){
  if(!ProgramEntry||!entryState)return;
  entryPinnedVersionsExecutable=false;
  entrySetState(ProgramEntry.setAnswers(entryState,patch))}
/* The questionnaire's sections, as the lifter counts them. Goal and background
   share one section (Q627): the semantic steps stay separate, and a UI adapter
   may group closely related questions on one screen. Browse's list is the
   result of its two questions, not a third. */
function entrySections(route){
  const sections={
    recommend:ENTRY_B_SECTIONS.map(([,steps])=>steps),
    custom:[["desired_result","background"],["schedule"],["environment"],["abilities"],["priorities"],["exercise_preferences"],["custom_shape"]],
    browse:[["schedule"],["environment"]]}[route]||[];
  return route==="custom"&&!entryCustomShapeRequired()?sections.filter(group=>group[0]!=="custom_shape"):sections}
function entryProgressSections(route){
  if(!route)return{n:0,total:1,show:false};
  const sections=entrySections(route);
  const index=sections.findIndex(group=>group.includes(entryState.step));
  /* A meter is only informative while the user is moving through questions and
     there is more than one of them. On a review, a result or a single-question
     route it either lies (pinned full) or says nothing ("1 of 1"). */
  return{n:index>=0?index+1:sections.length,total:Math.max(sections.length,1),show:sections.length>1&&index>=0}}
function entryRouteLabel(route){
  const labels={recommend:t("entry.route.recommend"),custom:t("entry.route.custom"),browse:t("entry.route.browse"),
    build:t("entry.route.build"),import:t("entry.route.import"),shared:t("entry.route.shared")};
  return labels[route]||t("entry.eyebrow")}

/* A question, set as a sentence in ink. The glyph argument is kept so callers
   read the same, but a question is not a column head and carries no icon. */

function entryHeading(title){
  return `<h2 class="onb__q" id="entryHeading" tabindex="-1">${esc(title)}</h2>`}
function entryLegacyBanner(){
  if(!entryState?.legacyHints||!Object.keys(entryState.legacyHints).length)return"";
  return `<p class="entry__legacy" role="note">${esc(t("entry.legacy.hint"))}</p>`}
/* The resume card sits on the hub (Q633), above doors that stay inert until the
   lifter chooses Resume or Start over: any door tap would otherwise overwrite
   the saved draft on its next persist. */
function renderEntryHub({candidate=entryState,notice=entryUiNotice,choice=EntryUi.hubChoice()}={}){
  return EntryUi.renderHub({activeProgram:hasActiveProgram(),resuming:notice==="resume",choice,
    hasLegacyHints:!!candidate?.legacyHints&&Object.keys(candidate.legacyHints).length>0,
    resume:{updatedAt:candidate?.updatedAt||null,routeLabel:candidate?.route?entryRouteLabel(candidate.route):"",
      stepLabel:candidate?.step?t(`entry.${candidate.step}.title`):""}});
}
function entryChooseHubRoute(){
  const route=EntryUi.hubChoice();
  if(!route||entryUiNotice==="resume")return;
  EntryUi.clearHubChoice();
  if(route==="import"){
    setImportSourceMode("file",{render:false});
    captureEvent("program_import_started",{source:"file"})}
  entrySelectRoute(route)}
/* B's three sections, as the header counts them. The section map and the
   result sit outside them. */
const ENTRY_B_SECTIONS=Object.freeze([
  ["basics",["sex","birth_date","height","weight","background","cardio_experience"]],
  ["gym",["environment","equipment"]],
  ["program",["desired_result","days_per_week","session_length","muscle_priorities","deload","abilities"]]]);
function entryBSection(stepId){
  const index=ENTRY_B_SECTIONS.findIndex(([,steps])=>steps.includes(stepId));
  return index<0?null:{n:index+1,total:ENTRY_B_SECTIONS.length,name:ENTRY_B_SECTIONS[index][0]}}
const entryIsB=()=>entryState?.route==="recommend";
function entryBasics(source=entryState){return source?.answers?.basics||{}}
function entryPatchBasics(patch){
  const next={...entryBasics(),...patch};
  for(const key of Object.keys(next))if(next[key]==null)delete next[key];
  entryPatchAnswers({basics:next})}







/* "None" answers what the lifter does now, so it has no level. */








/* Which groups start ticked: any member in the preset (Plan 068 slice A). */
function entryPresetGroups(kind){
  try{return ProgramEntryAdapter?.presetEquipmentGroups?.(kind,rawExerciseCatalog)||[]}catch{return[]}}
const ENTRY_B_MUSCLES=ProgramEntry.ENTRY_MUSCLES;
/* Basics pickers. Continue accepts the value currently shown, including the
   neutral starting value. Skip is the separate path that leaves it unset. */
let entryPickerDraft={};
const entryPickers=createEntryPickers({window,format:{decimal:entryDecimal,weight:entryWeightText}});
const ENTRY_BIRTH_DEFAULT=Object.freeze({y:1993,m:5,d:14});
const ENTRY_HEIGHT_DEFAULT=174,ENTRY_WEIGHT_DEFAULT=80.5;
const KG_PER_LB=0.45359237;
function entryDaysIn(month,year){return new Date(Date.UTC(year,month,0)).getUTCDate()}
function entryMonthNames(){
  const locale=isPt()?"pt-BR":"en";
  return Array.from({length:12},(_,index)=>new Date(Date.UTC(2000,index,15)).toLocaleString(locale,{month:"long",timeZone:"UTC"}))}

function entryBirthValue(source=entryState){
  if(entryPickerDraft.birth)return entryPickerDraft.birth;
  const saved=entryBasics(source).birthDate;
  if(saved){const [y,m,d]=saved.split("-").map(Number);return{y,m,d}}
  return{...ENTRY_BIRTH_DEFAULT}}
const ENTRY_BIRTH_YEARS=(()=>{const last=new Date().getFullYear()-10;return Array.from({length:last-1920+1},(_,i)=>1920+i)})();


function entryHeightUnit(source=entryState){return entryBasics(source).heightUnit||(state?.settings?.unit==="lb"?"ftin":"cm")}
function entryWeightUnit(source=entryState){return entryBasics(source).weightUnit||(state?.settings?.unit==="lb"?"lb":"kg")}
function entryHeightValue(source=entryState){return entryPickerDraft.heightCm??entryBasics(source).heightCm??ENTRY_HEIGHT_DEFAULT}

function entryWeightRange(unit){return unit==="lb"?{min:66,max:440,step:0.2}:{min:30,max:200,step:0.1}}
function entryWeightValue(source=entryState){return entryPickerDraft.weightKg??entryBasics(source).weightKg??ENTRY_WEIGHT_DEFAULT}
function entryWeightDisplayedValue(unit=entryWeightUnit()){
  const range=entryWeightRange(unit);
  const raw=unit==="lb"?Math.round(entryWeightValue()/KG_PER_LB/range.step)*range.step:Math.round(entryWeightValue()*10)/10;
  const shown=Math.max(range.min,Math.min(range.max,raw));
  return unit==="lb"?Math.round(shown*KG_PER_LB*10)/10:shown}
function entryHeightDisplayedCm(unit=entryHeightUnit()){
  const cm=Math.round(entryHeightValue());
  if(unit==="cm")return Math.max(120,Math.min(220,cm));
  const total=Math.round(entryHeightValue()/2.54);
  const ft=Math.max(3,Math.min(7,Math.floor(total/12)));
  const inch=Math.max(0,Math.min(11,total%12));
  return Math.round((ft*12+inch)*2.54)}

function entryWeightText(value,unit){return `${entryDecimal(value,1)} ${unit}`}
function entryDecimal(value,digits){
  const text=Number(value).toFixed(digits);
  return isPt()?text.replace(".",","):text}
function entryStrictInteger(raw,min,max){
  const text=String(raw??"").trim();
  if(!/^\d+$/.test(text))return null;
  const value=Number(text);
  return Number.isSafeInteger(value)&&value>=min&&value<=max?value:null}
function entryOpenPickerInput({label,value,inputMode="numeric",errorKey,parse,apply}){
  entryDialogOpener=entryOpenerToken();
  entryPickerInput={label,value:String(value),inputMode,errorKey,parse,apply};
  entryDialog="picker";renderOnboarding()}
function entryCommitPickerInput(){
  const edit=entryPickerInput,input=$("#entryPickerInput");
  if(!edit||!input)return;
  const value=edit.parse(input.value);
  if(value===null||value===undefined){
    input.setAttribute("aria-invalid","true");input.classList.add("is-invalid");
    const error=$("#entryPickerError");if(error){error.textContent=t(edit.errorKey);error.hidden=false}
    input.focus();return}
  edit.apply(value);
  entryPickerInput=null;entryDialog=null;closeEntryDialog();renderOnboarding()}
/* A wheel is a spinbutton: arrows, Page keys, Home and End set it, a flick
   snaps it, and tapping its selected value opens the typed-value fallback. */
function mountEntryWheel(el,onChange,onType){return entryPickers.wheel(el,onChange,onType)}
function mountEntryRuler(el,onChange,onType){return entryPickers.ruler(el,onChange,onType)}
function mountEntryPickers(){
  const stepId=entryState?.step;
  if(stepId==="birth_date"){
    const draft=entryBirthValue();
    const sync=()=>{
      const max=entryDaysIn(draft.m,draft.y);
      if(draft.d>max){draft.d=max}
      entryPickerDraft={...entryPickerDraft,birth:{...draft},birthTouched:true};
      const day=$("#entryWheelDay");
      if(day&&day.querySelectorAll(".entry-wheel__item").length!==max){
        day.outerHTML=entryWheel("entryWheelDay",t("entry.birth_date.day"),Array.from({length:max},(_,i)=>String(i+1)),draft.d-1);
        mountEntryWheel($("#entryWheelDay"),i=>{draft.d=i+1;sync()},type=>entryOpenPickerInput({
          label:t("entry.birth_date.day"),value:String(type.index+1),errorKey:"validation.date",
          parse:raw=>entryStrictInteger(raw,1,entryDaysIn(draft.m,draft.y)),apply:value=>type.set(value-1)}))}};
    mountEntryWheel($("#entryWheelDay"),i=>{draft.d=i+1;sync()},type=>entryOpenPickerInput({
      label:t("entry.birth_date.day"),value:String(type.index+1),errorKey:"validation.date",
      parse:raw=>entryStrictInteger(raw,1,entryDaysIn(draft.m,draft.y)),apply:value=>type.set(value-1)}));
    mountEntryWheel($("#entryWheelMonth"),i=>{draft.m=i+1;sync()},type=>entryOpenPickerInput({
      label:t("entry.birth_date.month"),value:String(type.index+1),errorKey:"validation.date",
      parse:raw=>entryStrictInteger(raw,1,12),apply:value=>type.set(value-1)}));
    mountEntryWheel($("#entryWheelYear"),i=>{draft.y=ENTRY_BIRTH_YEARS[i];sync()},type=>entryOpenPickerInput({
      label:t("entry.birth_date.year"),value:String(ENTRY_BIRTH_YEARS[type.index]),errorKey:"validation.date",
      parse:raw=>entryStrictInteger(raw,ENTRY_BIRTH_YEARS[0],ENTRY_BIRTH_YEARS.at(-1)),
      apply:value=>type.set(ENTRY_BIRTH_YEARS.indexOf(value))}))}
  if(stepId==="height"){
    if(entryHeightUnit()==="cm")mountEntryWheel($("#entryWheelCm"),i=>{entryPickerDraft={...entryPickerDraft,heightCm:120+i,heightTouched:true}},type=>entryOpenPickerInput({
      label:t("entry.height.cm"),value:String(120+type.index),errorKey:"validation.metric",
      parse:raw=>entryStrictInteger(raw,120,220),apply:value=>type.set(value-120)}));
    else{
      const total=Math.round(entryHeightValue()/2.54),parts={ft:Math.floor(total/12),inch:total%12};
      const commit=()=>{entryPickerDraft={...entryPickerDraft,heightCm:Math.round((parts.ft*12+parts.inch)*2.54),heightTouched:true}};
      mountEntryWheel($("#entryWheelFt"),i=>{parts.ft=3+i;commit()},type=>entryOpenPickerInput({
        label:t("entry.height.feet"),value:String(3+type.index),errorKey:"validation.metric",
        parse:raw=>entryStrictInteger(raw,3,7),apply:value=>type.set(value-3)}));
      mountEntryWheel($("#entryWheelIn"),i=>{parts.inch=i;commit()},type=>entryOpenPickerInput({
        label:t("entry.height.inches"),value:String(type.index),errorKey:"validation.metric",
        parse:raw=>entryStrictInteger(raw,0,11),apply:value=>type.set(value)}))}}
  if(stepId==="weight"){
    const unit=entryWeightUnit();
    mountEntryRuler($("#entryWeightRuler"),value=>{
      const kg=unit==="lb"?value*KG_PER_LB:value;
      entryPickerDraft={...entryPickerDraft,weightKg:Math.round(kg*10)/10,weightTouched:true}},type=>{
      const range=entryWeightRange(unit),label=t("entry.weight.ruler",{unit});
      entryOpenPickerInput({label,value:entryDecimal(type.value,1),inputMode:"decimal",errorKey:"toast.invalid_weight",
        parse:raw=>{
          const value=parseDec(raw);
          if(!Number.isFinite(value)||value<range.min||value>range.max)return null;
          const index=(value-range.min)/range.step;
          return Math.abs(index-Math.round(index))<1e-7?Math.round(index):null},
        apply:index=>type.set(index)})})}}
/* What Continue stores from a picker step, and what Skip clears. */
function entryCommitPicker(stepId){
  if(stepId==="birth_date"){
    const b=entryBirthValue();
    publishEntryDraft(ProgramEntry.setAnswers(entryState,{basics:{...entryBasics(),
      birthDate:`${b.y}-${String(b.m).padStart(2,"0")}-${String(b.d).padStart(2,"0")}`}}))}
  if(stepId==="height")publishEntryDraft(ProgramEntry.setAnswers(entryState,{basics:{...entryBasics(),heightCm:entryHeightDisplayedCm(),heightUnit:entryHeightUnit()}}));
  if(stepId==="weight")publishEntryDraft(ProgramEntry.setAnswers(entryState,{basics:{...entryBasics(),weightKg:entryWeightDisplayedValue(),weightUnit:entryWeightUnit()}}));
  entryPickerDraft={}}
const ENTRY_SKIP_CLEARS=Object.freeze({sex:["sex"],birth_date:["birthDate"],height:["heightCm"],weight:["weightKg"],cardio_experience:["cardioExperience"]});
function entrySkippable(stepId){
  return entryIsB()&&(Object.prototype.hasOwnProperty.call(ENTRY_SKIP_CLEARS,stepId)||stepId==="muscle_priorities"||stepId==="abilities")}
function entrySkip(){
  const stepId=entryState?.step;
  if(!entrySkippable(stepId))return;
  entryPickerDraft={};EntryUi.clearPriorityLimit();
  if(ENTRY_SKIP_CLEARS[stepId]){
    const basics={...entryBasics()};
    for(const key of ENTRY_SKIP_CLEARS[stepId])delete basics[key];
    publishEntryDraft(ProgramEntry.setAnswers(entryState,{basics}))}
  if(stepId==="muscle_priorities")publishEntryDraft(ProgramEntry.setAnswers(entryState,{primaryMuscles:[],deEmphasizedMuscles:[]}));
  if(stepId==="abilities")publishEntryDraft(ProgramEntry.setAnswers(entryState,{competencyAnswers:{}}));
  const advanced=ProgramEntry.advance(entryState);
  if(!advanced.ok){renderOnboarding();return}
  if(advanced.state.step==="result"&&!advanced.state.result?.preview){startEntryResult(advanced.state);return}
  if(advanced.state.step==="building"){entrySetState(advanced.state);return}
  entrySetState(advanced.state)}
/* Continue is held until a choice exists on the Basics choice screens; Skip is
   the way past them without an answer. */
function entryNeedsChoice(stepId){
  if(entryHubMode())return !EntryUi.hubChoice();
  if(!entryIsB())return false;
  if(stepId==="sex")return !entryBasics().sex;
  if(stepId==="cardio_experience")return !entryBasics().cardioExperience;
  return false}
/* Steps whose screen shows a default the lifter may accept with Continue. */
function entryApplyShownDefaults(stepId){
  if(stepId==="session_length"&&entryState.answers.sessionMinutes==null)publishEntryDraft(ProgramEntry.setAnswers(entryState,{sessionMinutes:60}));
  if(stepId==="deload"&&entryState.answers.deload==null)publishEntryDraft(ProgramEntry.setAnswers(entryState,{deload:true}))}

/* Each question's controls are a body of their own, so the step screen and the
   review's answer editor draw the same thing from the same answers. */

function renderDesiredResultStep(){return EntryUi.renderAnswerScreen('desired_result',entryAnswerFieldsModel(entryState,'desired_result'))}

/* The "about" screen: the goal the hub already asked is carried as a band with
   a Change control; with no goal yet, or after Change, the question is open. */

function renderBackgroundStep(){return EntryUi.renderAnswerScreen('background',entryAnswerFieldsModel(entryState,'background'))}
/* Schedule values are numbers, so they are set as numbers: a Mono value over its
   unit, in a grid of equal cards with no radio mark. Nothing is preselected. */

function renderScheduleStep(){return EntryUi.renderAnswerScreen('schedule',entryAnswerFieldsModel(entryState,'schedule'))}

function renderEnvironmentStep(){return EntryUi.renderAnswerScreen('environment',entryAnswerFieldsModel(entryState,'environment'))}
/* Movement abilities: a yes/no/unsure row per competency the compiler checks
   before it leans on a gated exercise (PRECONDITION_COMPETENCIES). Unsure is
   the default (null), so skipping the whole step changes nothing (#323). */

function entryAbilityKeys(){return ProgramEntry?.COMPETENCY_ANSWERS||[]}




function renderAbilitiesStep(){return EntryUi.renderQuestion("abilities",entryQuestionModel())}







function entryAvoidMatches(query,source=entryState){
  const q=foldSearch(query||"");
  const taken=new Set((source?.answers?.exerciseConstraints||[]).map(item=>item.exerciseId));
  const mustHave=new Set(source?.answers?.mustHaveExercises||[]);
  const pool=pickableExercises().filter(entry=>!taken.has(entry.id)&&!mustHave.has(entry.id)&&entry.id!==EntryUi.answerUi().pendingAvoid);
  if(!q)return[];
  return pool.filter(entry=>foldSearch(libraryName(entry)).includes(q)||foldSearch(entry.id).includes(q)).slice(0,8)}
function entryExerciseMatches(query,source=entryState){
  const q=foldSearch(query||"");
  const included=new Set(source?.answers?.mustHaveExercises||[]);
  const avoided=new Set((source?.answers?.exerciseConstraints||[]).map(item=>item.exerciseId));
  const pool=pickableExercises().filter(entry=>!included.has(entry.id)&&!avoided.has(entry.id)&&entry.id!==EntryUi.answerUi().pendingAvoid);
  if(!q)return pool.slice(0,8);
  return pool.filter(entry=>foldSearch(libraryName(entry)).includes(q)||foldSearch(entry.id).includes(q)).slice(0,8)}

function renderExercisePreferencesStep(){return EntryUi.renderAnswerScreen('exercise_preferences',entryAnswerFieldsModel(entryState,'exercise_preferences'))}
/* The optional section is empty while nothing in it has been chosen: no muscle,
   no movement, no avoided exercise (and no half-made avoidance). */
function entryPrioritiesEmpty(source=entryState){
  const a=source?.answers||{};
  return !(a.primaryMuscles||[]).length&&!(a.priorityMovements||[]).length&&!(a.exerciseConstraints||[]).length&&!EntryUi.answerUi().pendingAvoid}

function renderPrioritiesStep(){return EntryUi.renderAnswerScreen('priorities',entryAnswerFieldsModel(entryState,'priorities'))}
/* The generator's authored splits are named by their id. */
function splitDisplayName(choice){
  const key=`split.${choice?.id}`,text=t(key);
  return text===key?String(choice?.id||"").replace(/_/g," "):text}

function renderCustomShapeStep(){return EntryUi.renderAnswerScreen('custom_shape',entryAnswerFieldsModel(entryState,'custom_shape'))}
/* Generate maps the answers to a canonical request, runs the one generator, and
   previews its ProgramDefinition through the same flat projection as Build. The
   canonical request identifies selection, so equal requests regenerate the same program. */
/* A generated candidate's preview is a pure projection of its definition, so
   the review editor rebuilds it the same way after every adjustment. */
let EntryGeneration=null;
function entryGeneration(){
  if(!EntryGeneration&&TrainingModel&&rawExerciseCatalog)EntryGeneration=createEntryGeneration({compiler:ProgramCompiler,adapter:ProgramEntryAdapter,
    catalog:rawExerciseCatalog,model:TrainingModel,candidateName:days=>t("entry.result.generated_name",{days}),onFailure:error=>console.warn("program generation failed",error),
    execute:async(request,{signal})=>{
      const override=window.__repforgeProgramEntryServicesOverride,services=entryServices(),engine=override?null:programEngine();
      const generated=override?await services.generateProgram({request}):engine?await engine.generate(request,{signal}):services.generateProgram({request});
      return{generated,cache:!override};
    }});
  return EntryGeneration;
}
function generatedPreview(definition,route){return entryGeneration().preview(definition,route)}
function entryGeneratorRequest(from){return entryGeneration()?.request(from)||{ok:false,failure:{code:"rules_changed"}}}
/* Generation timing (Plan 071 §5.3). A request is stamped when it leaves and
   reported when its answer arrives, so the same pair serves a synchronous
   compile and a Worker round trip (#353): begin before posting, settle in the
   reply or error handler. A request overtaken by a newer one settles nothing.
   Only generations the lifter asked for are timed; the comparisons and the
   editor's baseline rebuild are not. */
let generationRequest=0;
const generationClock=()=>typeof performance!=="undefined"&&performance.now?performance.now():Date.now();
function beginGeneration(route){return{id:++generationRequest,route,at:generationClock()}}
function settleGeneration(token,outcome){
  if(!token||token.id!==generationRequest||(token.route!=="recommend"&&token.route!=="custom"))return;
  let duration=null;
  try{duration=Telemetry?.bucketGeneration?.(generationClock()-token.at)}catch{}
  if(duration)captureEvent("generation_settled",{route:token.route,outcome,duration})}
/* Generation is deterministic in its canonical request, so the last few
   outputs are kept: the review's recommendation is then at hand on the render
   that follows its own generation. A test's services override is never cached. */
function entryGeneratedPeek(from){
  if(!from||window.__repforgeProgramEntryServicesOverride||!entryServices())return null;
  return entryGeneration()?.peek(from)||null;
}
let entryOfferJob=null,entryOfferState={key:"",offers:[]};
function entryOfferBaseline(state){
  const result=state?.result;
  const review=EntryReview.current(state);
  return review?.baseline?.fingerprint?review.baseline:result}
function entryOfferKey(state,result=entryOfferBaseline(state)){
  return state&&result?[state.draftId,state.route,result.answersFingerprint||"",result.fingerprint||""].join("|"):""}
function entryOfferSlotEligible(state,offer){
  const baseline=entryOfferBaseline(state),baselineSlots=baseline?.preview?.programDefinition?.days?.flatMap(day=>day.slots||[])||[];
  const currentSlots=state?.result?.preview?.programDefinition?.days?.flatMap(day=>day.slots||[])||[];
  const source=baselineSlots.find(slot=>slot.id===offer?.slotId),current=currentSlots.find(slot=>slot.id===offer?.slotId);
  return!!source&&!!current&&current.exerciseId===source.exerciseId&&
    (!offer.currentExerciseId||offer.currentExerciseId===source.exerciseId)&&current.exerciseId!==offer.offeredExerciseId&&
    !currentSlots.some(slot=>slot.id!==offer.slotId&&slot.exerciseId===offer.offeredExerciseId)}
function entryCurrentVerifiedOffers(state=entryState){
  const key=entryOfferKey(state,entryOfferBaseline(state));
  return key&&entryOfferState.key===key?entryOfferState.offers.filter(offer=>entryOfferSlotEligible(state,offer)):[]}
function startEntryOfferVerification(state,{confirmationOffers=[],request,definition,result=entryOfferBaseline(state)}={}){
  const key=entryOfferKey(state,result);
  if(!key||state?.step!=="result"||state?.route!=="recommend")return;
  // The generator override is a test harness for the foreground transaction,
  // not an independent executor for post-result verification.
  if(window.__repforgeProgramEntryServicesOverride)return;
  if(entryOfferJob?.key===key)return;
  entryOfferJob?.controller.abort();entryOfferJob=null;
  entryOfferState={key,offers:[]};
  if(!Array.isArray(confirmationOffers)||!confirmationOffers.length){
    entryOfferState={key,offers:[]};
    if(entryOfferKey(entryState,entryOfferBaseline(entryState))===key)entryAdjustMount?.refresh?.();
    return}
  const controller=new AbortController(),job={key,controller};
  entryOfferJob=job;
  const engine=window.__repforgeProgramEntryServicesOverride?null:createProgramEngineInstance();
  job.engine=engine;
  const generate=(nextRequest,{signal}={})=>engine
    ?engine.generate(nextRequest,{signal})
    :entryServices()?.generateProgram({request:nextRequest});
  ProgramEntryAdapter.verifyConfirmationOffers({
    generate,request,signal:controller.signal,
    result:{ok:true,value:definition,confirmationOffers},
  }).then(offers=>{
    if(entryOfferJob!==job||controller.signal.aborted||entryState?.step!=="result"||
      entryOfferKey(entryState,entryOfferBaseline(entryState))!==key)return;
    entryOfferJob=null;entryOfferState={key,offers};
    entryAdjustMount?.refresh?.();
  }).catch(error=>{
    if(entryOfferJob!==job)return;
    entryOfferJob=null;
    if(controller.signal.aborted||error?.name==="AbortError")return;
    if(entryState?.step!=="result"||entryOfferKey(entryState,entryOfferBaseline(entryState))!==key)return;
    entryOfferState={key,offers:[]};entryAdjustMount?.refresh?.();
  }).finally(()=>job.engine?.dispose?.())}
/* The one call site of Generate (#353). The canonical request goes to the
   program engine, which runs the generator in its worker (or
   on this thread when it cannot); the outcome is a candidate or the failure
   the result screen explains. Rejects only when `signal` aborts it, and an
   aborted request is never reported. `timed` marks a generation the lifter
   asked for (Plan 071's generation_settled). */
async function generateEntryCandidate(from=entryState,{signal,timed=false}={}){
  const services=entryServices();
  if(!services||!from||!ProgramEntryAdapter?.programRequestFromAnswers)return{ok:false,failure:null};
  const token=timed?beginGeneration(from.route):null;
  const outcome=await runEntryGeneration(from,services,signal);
  if(token&&(outcome.ok||outcome.failure?.code))settleGeneration(token,outcome.ok?"success":outcome.failure.code);
  return outcome}
async function runEntryGeneration(from,services,signal){return entryGeneration().generate(from,{signal})}
/** O3: the generation whose program has not been drawn yet. Only a compile
 *  arms it (a saved draft that is reopened, and every later render of a result
 *  that already exists, never do), and the first render of that result takes it,
 *  so the build plays once per generation. In memory only. */
let entryBuildArmed=null;
/* The generation that will produce the result screen's program: started by
   Continue on the last question, or by a result screen that has none (a
   resumed draft). Until it lands the lifter stays where they were, so the
   committed state never holds a result step without its program; anything
   that moves the flow on meanwhile supersedes it. */
let entryResultJob=null,entryAnswerJob=null;
function cancelEntryGeneration(){
  entryResultJob?.controller.abort();entryAnswerJob?.controller.abort();
  entryResultJob=null;entryAnswerJob=null;syncEntryBusy()}
function syncEntryBusy(){
  const next=$("#onbNext");
  if(next){if(entryResultJob)next.setAttribute("aria-busy","true");else next.removeAttribute("aria-busy")}
  const review=$("#entryCandidateReview");
  if(review){if(entryAnswerJob)review.setAttribute("aria-busy","true");else review.removeAttribute("aria-busy")}}
/* B's building moment (Plan 072): a four-line checklist and a thin bar while
   the program generates. The step moves to the result when the checklist has
   finished, or the lifter skipped it, and the program has landed; if the
   program is still generating then, a hairline says so. Reduced motion draws
   every line done. Nothing here is persisted: a reload on this step starts
   it again, and Back returns to the abilities with the job aborted. */
const ENTRY_BUILDING_LINE_MS=260;
let entryBuilding=null;

function mountEntryBuilding(){
  if(entryState?.step!=="building"||entryUiNotice)return;
  const root=$("#entryBuilding");if(!root)return;
  // One checklist per arrival on the step; a re-render keeps its progress.
  if(!entryBuilding){
    let release;const gate=new Promise(resolve=>{release=resolve});
    entryBuilding={gate,release,done:false,timers:[]};
    const target=ProgramEntry.advance(entryState);
    if(target.ok)startEntryResult(target.state,{gate})}
  const run=entryBuilding,items=[...root.querySelectorAll(".entry-building__steps li")];
  const finish=()=>{
    if(run.done)return;run.done=true;run.timers.forEach(clearTimeout);
    items.forEach(li=>{li.classList.remove("is-now");li.classList.add("is-done")});
    root.classList.add("is-done");run.release();
    entryBuildingPending(!!entryResultJob?.settled)};
  $("#entryBuildingSkip")?.addEventListener("click",finish);
  if(run.done||!beatsOn()){finish();return}
  if(run.timers.length)return;
  items.forEach((li,index)=>{
    run.timers.push(setTimeout(()=>li.classList.add("is-now"),index*ENTRY_BUILDING_LINE_MS));
    run.timers.push(setTimeout(()=>{li.classList.remove("is-now");li.classList.add("is-done")},(index+1)*ENTRY_BUILDING_LINE_MS))});
  root.classList.add("is-running");
  run.timers.push(setTimeout(finish,items.length*ENTRY_BUILDING_LINE_MS))}
/* The program has landed but the checklist is still showing, or the reverse:
   the hairline appears only while the checklist is done and the job is not. */
function entryBuildingPending(settled){
  const wait=$("#entryBuildingWait");if(!wait)return;
  const pending=!settled&&!!entryBuilding?.done;
  wait.hidden=!pending;
  wait.classList.toggle("is-pending",pending)}
async function startEntryResult(target,{gate=null}={}){
  entryResultJob?.controller.abort();
  const job={from:entryState,target,controller:new AbortController()};
  entryResultJob=job;entryCompileError=null;
  syncEntryBusy();
  let outcome,without=null;
  try{
    outcome=await generateEntryCandidate(target,{signal:job.controller.signal,timed:true});
    // Constraints that reshaped the program are stated against it without them.
    if(outcome.ok&&(target.answers.exerciseConstraints||[]).length){
      const bare=await generateEntryCandidate({...target,answers:{...target.answers,exerciseConstraints:[]}},{signal:job.controller.signal});
      without=bare.ok?bare.result:null}}
  catch{return}
  if(entryResultJob!==job)return;
  // B's building moment shows its checklist through, unless the lifter skips
  // it; a conflict is shown at once.
  if(gate&&outcome.ok){
    job.settled=true;entryBuildingPending(true);
    await gate;
    if(entryResultJob!==job)return}
  entryResultJob=null;
  if(entryState!==job.from){syncEntryBusy();return}
  if(!outcome.ok){
    entryCompileError=outcome.failure;
    entrySetState(target);
    return}
  // Back keeps its candidate on the draft; compiling the same request again
  // must not re-arm the reveal for that already shown result.
  const sameGeneratedResult=job.from.draftId===target.draftId&&job.from.route===target.route&&
    job.from.result?.fingerprint===outcome.result.fingerprint;
  publishEntryDraft(ProgramEntry.setResult(target,outcome.result));
  entryBuildArmed=sameGeneratedResult?null:{draftId:entryState.draftId,fingerprint:outcome.result.fingerprint};
  entryNoteFirstResult(outcome.result,without);
  // The program that just landed is the review's recommendation.
  if(entryAdjustRoute())adoptEntryAdjust(cloneSnapshot(outcome.result));
  entrySetState(entryState);
  startEntryOfferVerification(entryState,outcome)}
function reportGeneratorCompleted(result){
  if(!entryState||!result||!(entryState.route==="recommend"||entryState.route==="custom"))return;
  const telemetry=result.telemetry;
  if(!telemetry||telemetry.completed===true)return;
  const sent=captureEvent("generator_completed",{
    goal:telemetry.goal,frequency:telemetry.frequency,family:telemetry.family});
  // Persist the marker with the candidate so reload/resume and repeated renders
  // cannot create a second completion event for this setup flow. If analytics
  // is opted out, leave it unset so an explicit later opt-in can report it.
  if(sent){
    const marked={...result,telemetry:{...telemetry,completed:true}};
    publishEntryDraft(ProgramEntry.setResult(entryState,marked));
    persistSetupDraft(entryState)}
}
function entryPinnedPreviewCanActivate(){
  if(!entryState?.result?.preview)return false;
  try{return ProgramEntry.candidateActivationIssues(entryState).length===0}catch{return false}}
function persistEntryRulesState(next,previous=entryState){return EntrySetup.saveRules(next,previous)}
function browseResultFromCard(card){
  return{
    fingerprint:card.fingerprint,
    name:card.name,
    namePt:card.namePt,
    selected:{id:card.id,familyId:card.familyId,daysPerWeek:card.daysPerWeek,blueprintId:card.id},
    preview:card.preview,
    telemetry:{family:card.telemetryFamily}}
}
async function rebuildEntryForCurrentRules(){
  if(!ProgramEntry||!entryState)return{ok:false};
  const route=entryState.route;
  if(route==="import"||route==="shared"){
    // These routes carry a reviewed external snapshot. There is no generator
    // input from which the import/shared candidate could be reconstructed.
    // Activation is allowed only after this explicit user acknowledgement and
    // still runs the normal candidate/readiness checks.
    entryPinnedVersionsExecutable=true;
    entryUiNotice=null;
    renderOnboarding();
    return{ok:true,pinned:true}}
  if(route==="browse"){
    const services=entryServices();
    let cards=[];
    try{cards=services?.browseCatalogue?.(entryState.answers)||[]}catch(error){console.warn("browse catalogue rebuild failed",error)}
    const selectedId=entryState.answers.catalogueSelection||entryState.result?.selected?.id;
    const card=cards.find(item=>item.id===selectedId);
    if(!card){
      // A released card may disappear or change identity. Keep the old
      // preview intact and put the user back in the current catalogue instead
      // of compiling it as a recommendation.
      const previous=entryState;
      const next={...entryState,step:"catalogue"};
      const saved=await persistEntryRulesState(next,previous);
      if(!saved?.ok){
        if(!entryUiNotice)entryUiNotice="rules_changed";
        renderOnboarding();
        return saved}
      entryUiNotice=null;
      renderOnboarding();
      return saved}
    const previous=entryState;
    let next=ProgramEntry.setResult({...entryState,versions:entryVersions()},browseResultFromCard(card));
    if(next.step==="catalogue")next={...next,step:"preview"};
    const saved=await persistEntryRulesState(next,previous);
    if(!saved?.ok){
      if(!entryUiNotice)entryUiNotice="rules_changed";
      renderOnboarding();
      return saved}
    entryUiNotice=null;
    renderOnboarding();
    return saved}
  if(route==="build"){
    // Build has no compiler-generated candidate to rerun. Its current-version
    // path is an explicit handoff into the editable draft; the editor still
    // blocks incomplete/unsupported rows before activation.
    const previous=entryState;
    const next={...entryState,step:entryState.result?.preview?entryState.step:"build_setup",versions:entryVersions()};
    const saved=await persistEntryRulesState(next,previous);
    if(!saved?.ok){
      if(!entryUiNotice)entryUiNotice="rules_changed";
      renderOnboarding();
      return saved}
    entryPinnedVersionsExecutable=false;
    entryUiNotice=null;
    if(next.step==="editor"&&next.result?.preview)openEntryDraftEditor();
    else renderOnboarding();
    return saved}
  // Recommend and Custom are the only generator-owned routes. Compile into a
  // detached result first; the saved old preview is untouched if compilation
  // fails or the draft write cannot commit the replacement.
  if(route==="recommend"||route==="custom"){
    if(!entryState.result||!["result","preview"].includes(entryState.step)){
      const previous=entryState;
      const next={...entryState,versions:entryVersions()};
      const saved=await persistEntryRulesState(next,previous);
      if(!saved?.ok){
        if(!entryUiNotice)entryUiNotice="rules_changed";
        renderOnboarding();
        return saved}
      entryUiNotice=null;
      renderOnboarding();
      return saved}
    const previous=entryState;
    let outcome;
    try{outcome=await generateEntryCandidate(previous,{timed:true})}catch{return{ok:false,superseded:true}}
    if(entryState!==previous)return{ok:false,superseded:true};
    if(!outcome.ok){
      if(outcome.failure)entryCompileError=outcome.failure;
      entryUiNotice="rules_changed";
      renderOnboarding();
      return{ok:false,compileFailed:true}}
    const replacement=outcome.result;
    const next=ProgramEntry.setResult({...entryState,versions:entryVersions()},replacement);
    const saved=await persistEntryRulesState(next,previous);
    if(!saved?.ok){
      if(!entryUiNotice)entryUiNotice="rules_changed";
      renderOnboarding();
      return saved}
    entryCompileError=null;
    entryUiNotice=null;
    reportGeneratorCompleted(entryState.result);
    renderOnboarding();
    startEntryOfferVerification(entryState,outcome);
    return saved}
  entryUiNotice=null;
  renderOnboarding();
  return{ok:false,unsupportedRoute:true}}
/* Shared links carry working sets and the released rest setting, but not the
   compiler's exercise-class warmups or station transitions. Estimate only the
   time represented by those payload facts; the UI labels it "about" and leaves
   the value absent when the inputs cannot support even that bounded estimate.
   This keeps Import and older shared drafts on their existing paths. */
function sharedPreviewDayMinutes(exercises,settings){
  const rows=Array.isArray(exercises)?exercises:[],time=ProgramCompiler?.RULES?.time;
  const rest=Number(settings?.restSec),working=Number(time?.workingSetSeconds),minimum=Number(time?.bufferMinimumSeconds),percent=Number(time?.bufferPercent);
  if(!rows.length||!Number.isFinite(rest)||rest<0||![working,minimum,percent].every(Number.isFinite))return null;
  let subtotal=0;
  for(const exercise of rows){
    const sets=Number(exercise?.sets);
    if(!Number.isInteger(sets)||sets<1)return null;
    subtotal+=sets*working+Math.max(0,sets-1)*rest;
  }
  return Math.ceil((subtotal+Math.max(minimum,Math.ceil(subtotal*percent/100)))/60);
}
function sharedPreviewDays(program,structure,settings){
  const rows=Array.isArray(program)?program:[],sourceDays=Array.isArray(structure?.days)&&structure.days.length
    ?structure.days.map(item=>({dayId:item.dayId,label:item.label||item.dayId,
      ...(item.displayNameKey?{displayNameKey:item.displayNameKey}:{}),
      ...(item.nameOverride?{nameOverride:item.nameOverride}:{})}))
    :[...new Set(rows.map(exercise=>exercise?.day).filter(Boolean))].map(label=>({dayId:label,label}));
  return sourceDays.filter(day=>day.dayId||day.label).map(day=>{
    const exercises=rows.filter(exercise=>exercise?.dayId?exercise.dayId===day.dayId:exercise.day===day.label).map(cloneSnapshot);
    const estimateMinutes=sharedPreviewDayMinutes(exercises,settings);
    const out={dayId:day.dayId||day.label,label:day.label||day.dayId,
      ...(day.displayNameKey?{displayNameKey:day.displayNameKey}:{}),
      ...(day.nameOverride?{nameOverride:day.nameOverride}:{}),exercises};
    if(estimateMinutes!==null)out.estimateMinutes=estimateMinutes;
    return out;
  });
}
/* A canonical preview's day length is the generator's own estimate of that
   day's prescription; a flat preview may carry its own estimate instead. */
function previewDayMinutes(preview,day){
  if(+day?.estimateMinutes>0)return +day.estimateMinutes;
  const canonical=preview?.programDefinition?.days?.find?.(item=>item.id===day?.dayId||item.name===day?.label);
  if(!canonical||typeof ProgramCompiler?.estimateDaySeconds!=="function")return null;
  try{const seconds=ProgramCompiler.estimateDaySeconds(canonical,undefined,rawExerciseCatalog);return seconds>0?Math.ceil(seconds/60):null}
  catch{return null}}
function entryPreviewFacts(preview){
  const program=Array.isArray(preview?.program)?preview.program:[];
  const estimates=(preview?.days||[]).map(day=>previewDayMinutes(preview,day)||0).filter(Boolean);
  return{
    exercises:program.length,
    sets:sum(program.map(exercise=>+exercise.sets||0)),
    minMinutes:estimates.length?Math.min(...estimates):null,
    maxMinutes:estimates.length?Math.max(...estimates):null}}
function entryEnvironmentLabel(answers=entryState?.answers||{}){
  return entryEnvironmentKindLabel(answers.environment?.kind)}
function entryEnvironmentKindLabel(kind){
  if(!kind)return"";
  return ENTRY_ENVIRONMENTS.includes(kind)?t(`entry.gym.${kind}`):t(`entry.environment.${kind}`)}
function entryPreviewAnswers(preview){
  const answers=entryState?.answers||{},meta=preview?.sharedMeta;
  if(entryState?.route!=="shared"||!meta||typeof meta!=="object")return answers;
  const environment={...(answers.environment||{})};
  if(Array.isArray(meta.equipment))environment.equipment=meta.equipment.map(value=>{
    const raw=String(value).trim().toLowerCase();
    const match=Object.entries(ProgramEntryAdapter?.SHARED_EQUIPMENT||{}).find(([,shared])=>shared===raw);
    return match?.[0]||raw;
  }).filter(Boolean);
  const primaryMuscles=Array.isArray(meta.priorityMuscles)?meta.priorityMuscles.map(value=>{
    const raw=String(value).trim();
    const normalized=raw.toLowerCase().replace(/[^a-z]+/g,"_").replace(/^_+|_+$/g,"");
    return (ProgramEntryAdapter?.ENTRY_MUSCLES||[]).includes(normalized)?normalized:raw;
  }).filter(Boolean):answers.primaryMuscles;
  return{...answers,environment,primaryMuscles};
}
function entryPriorityLabel(answers=entryState?.answers||{}){
  const facts=[];
  const custom=entryState?.route==="custom";
  const muscles=answers.primaryMuscles||[];
  if(muscles.length)facts.push(muscles.map(muscle=>{
    const key=String(muscle).trim(),label=t(`entry.muscle.${key}`);
    return label===`entry.muscle.${key}`?key:label;
  }).join(", "));
  if(custom){
    for(const [key,stateKey] of [["deEmphasizedMuscles","deemphasize"],["ignoredMuscles","ignore"]]){
      const list=answers[key]||[];
      if(list.length)facts.push(`${entryMuscleStateLabel(stateKey)}: ${list.map(muscle=>{
        const label=t(`entry.muscle.${muscle}`);return label===`entry.muscle.${muscle}`?muscle:label;
      }).join(", ")}`)}}
  const movements=answers.priorityMovements||[];
  if(movements.length)facts.push(movements.map(movement=>t(`entry.movement.${movement}`)||movement).join(", "));
  if(!custom){
    const mustHave=(answers.mustHaveExercises||[]).map(exerciseId=>libraryEntry(exerciseId)).filter(Boolean);
    if(mustHave.length)facts.push(t("entry.preview.must_have",{exercises:mustHave.map(libraryName).join(", ")}))}
  return facts.join(" · ")||t("entry.preview.priorities_none")}
function entryExercisePreferenceLabel(answers=entryState?.answers||{}){
  const facts=[];
  const included=(answers.mustHaveExercises||[]).map(exerciseId=>libraryEntry(exerciseId)).filter(Boolean);
  const avoided=(answers.exerciseConstraints||[]).map(item=>libraryEntry(item.exerciseId)).filter(Boolean);
  if(included.length)facts.push(t("entry.preview.include",{exercises:included.map(libraryName).join(", ")}));
  if(avoided.length)facts.push(t("entry.preview.avoid",{exercises:avoided.map(libraryName).join(", ")}));
  return facts.join(" · ")||t("entry.preview.exercise_preferences_none")}
function entrySourceLabel(route=entryState?.route){
  const labels={
    recommend:t("entry.preview.source.recommend"),custom:t("entry.preview.source.custom"),
    browse:t("entry.preview.source.browse"),build:t("entry.preview.source.build"),
    import:t("entry.preview.source.import"),shared:t("entry.preview.source.shared")};
  return labels[route]||labels.import}
function entryDurationLabel(preview){
  const facts=entryPreviewFacts(preview);
  if(!facts.minMinutes)return"";
  if(facts.minMinutes===facts.maxMinutes)return t("entry.preview.minutes",{n:facts.minMinutes});
  return t("entry.result.duration",{min:facts.minMinutes,max:facts.maxMinutes})}
/* Collapse a min/max pair to the exact form when both ends agree. */
function entryRangeLabel(min,max,rangeKey,exactKey){
  return min===max?t(exactKey,{n:min}):t(rangeKey,{min,max})}
/* A canonical preview adapts where the generator wrote ready prescriptions;
   otherwise the lifter sets the numbers. */
function entryProgressionSentence(preview){
  const definition=preview?.programDefinition;
  if(definition&&Array.isArray(definition.days)){
    const statuses=definition.days.flatMap(day=>day.slots||[]).flatMap(slot=>(slot.prescriptionsByCycle?.[0]?.sets||[]).map(set=>set.status));
    return t(statuses.includes("ready")?"entry.result.why_progression_adaptive":"entry.result.why_progression_manual")}
  return t("entry.result.why_progression",{progression:entryProgressionLabel(preview)})}
function entryProgressionLabel(preview){
  const ids=[...new Set((preview?.program||[]).map(exercise=>exercise.progression?.strategy?.id).filter(Boolean))];
  const labels={range:t("program.progression.strategy.range"),rep_goal:t("program.progression.strategy.rep_goal"),
    effort_target:t("program.progression.strategy.effort_target"),anchor_backoff:t("program.progression.strategy.anchor_backoff")};
  return ids.map(id=>labels[id]||id).filter(Boolean).join(" · ")||t("entry.result.progression_default")}
function entryPreviewProgressionCopy(preview, progressionIssue){
  if(progressionIssue)return"entry.preview.progression_incompatible";
  const rows=Array.isArray(preview?.program)?preview.program:[];
  let manual=false,unsupported=false;
  for(const exercise of rows){
    const strategy=exercise?.progression?.strategy;
    if(strategy?.id==="manual"){
      manual=true;
      if(strategy.params?.unsupportedImport)unsupported=true;
      continue;
    }
    const legacy=typeof exercise?.progressionType==="string"?exercise.progressionType.trim():"";
    if(legacy&&legacy!=="double_progression")unsupported=true;
  }
  if(unsupported)return"entry.preview.progression_manual_unsupported";
  if(manual)return"entry.preview.progression_manual";
  return"entry.preview.progression_body"}
function entryExerciseCountLabel(n){return t("entry.preview.exercises",{n,exercise:tp(n,"exercise")})}
window.__repforgeEntryExerciseCountLabel=entryExerciseCountLabel;
/* Copy for every code the compiler, the entry model and the app can hand the
   interface. Each code maps to a catalog key; a code with no entry is a drift,
   never a raw string on screen: it logs loudly and shows the generic sentence.
   test/program-entry-browser.mjs reads the compiler and entry sources and fails
   when one of them emits a code this table does not know. */
const ENTRY_CODE_COPY=Object.freeze({
  limitation:Object.freeze({
    "home.pull_capability_unavailable":"entry.adjusted.limit.home_pull",
    conditional_slot_unresolved:"entry.adjusted.limit.conditional_slot_unresolved",
    optional_slot_unresolved:"entry.adjusted.limit.optional_slot_unresolved",
    deemphasized_optional_omitted:"entry.adjusted.limit.deemphasized_optional_omitted",
    ignored_direct_work_omitted:"entry.adjusted.limit.ignored_direct_work_omitted",
    "home.posterior_capability_unavailable":"entry.adjusted.limit.home_posterior",
    "capability.demanding_exercise_selected":"entry.adjusted.limit.demanding_exercise",
    "priority.no_room":"entry.adjusted.limit.priority_no_room",
    "priority.at_set_ceiling":"entry.adjusted.limit.priority_at_set_ceiling",
    "priority.no_eligible_slot":"entry.adjusted.limit.priority_no_eligible_slot"}),
  reduction:Object.freeze({
    remove_priority_bonus:"entry.adjusted.reduce.remove_priority_bonus",
    remove_optional:"entry.adjusted.reduce.remove_optional",
    efficient_two_set:"entry.adjusted.reduce.efficient_two_set",
    reselect_redundant:"entry.adjusted.reduce.reselect_redundant",
    omit_redundant:"entry.adjusted.reduce.omit_redundant",
    trim_reducible_assistance:"entry.adjusted.reduce.trim_reducible_assistance",
    omit_accessory:"entry.adjusted.reduce.omit_accessory",
    minimum_dose_single_set:"entry.adjusted.reduce.minimum_dose_single_set"}),
  failure:Object.freeze({
    family_unresolved:"entry.issue.compile",incomplete_answers:"entry.issue.compile",invalid_context:"entry.issue.compile",
    compiler_conflict:"entry.issue.compile",unsupported_blueprint:"entry.issue.compile",invalid_instance:"entry.issue.compile",
    invalid_customization:"entry.issue.compile",unknown_slot:"entry.issue.compile",substitution_unknown:"entry.issue.compile",
    substitution_incompatible:"entry.issue.compile",substitution_prescription_incompatible:"entry.issue.compile",
    rebuild_failed:"entry.issue.compile",build_failed:"entry.issue.compile",compile_threw:"entry.issue.compile",
    build_setup_incomplete:"entry.issue.program_name",
    time_ceiling_conflict:"entry.issue.time_ceiling",ignored_muscle_required:"entry.issue.ignored_required",
    required_slot_unresolved:"entry.issue.required_slot",
    exercise_preference_conflict:"entry.issue.include_avoid",must_have_avoided:"entry.issue.include_avoid",
    must_have_unavailable:"entry.result.must_unavailable_title",
    // Canonical generator conflicts and Generate's own answer mapping.
    time_ceiling_exceeded:"entry.issue.time_ceiling_generated",no_eligible_exercise:"entry.issue.required_slot",
    no_complete_program:"entry.issue.compile",generated_program_invalid:"entry.issue.compile",
    insufficient_candidates:"entry.issue.required_slot",
    policy_identity_unresolved:"entry.issue.compile",invalid_request:"entry.issue.compile",invalid_catalog:"entry.issue.compile",
    unsupported_generation_domain:"entry.issue.compile",
    generation_conflict:"entry.issue.compile",rules_changed:"entry.issue.generic",catalog_unavailable:"entry.issue.compile",
    goal_required:"entry.issue.generic",experience_required:"entry.issue.generic",days_unsupported:"entry.issue.generic",
    environment_required:"entry.issue.generic"}),
  readiness:Object.freeze({
    live_revision_required:"entry.issue.generic",active_program_changed:"entry.conflict.body",
    preview_not_ready:"entry.issue.review_first",candidate_incomplete:"entry.editor.incomplete",
    rules_changed_rebuild_required:"entry.rules_changed.body_rebuild",
    progression_incompatible:"entry.preview.activation_blocked",program_exercises_required:"entry.editor.incomplete",
    program_days_required:"entry.editor.incomplete",exercise_invalid:"entry.editor.exercise_invalid",day_empty:"entry.editor.incomplete"})});
function entryCodeKey(kind,code){
  const table=ENTRY_CODE_COPY[kind]||{},text=String(code??"");
  return table[text]||table[text.split(":")[0]]||null}
function entryCodeText(kind,code){
  const key=entryCodeKey(kind,code);
  if(!key){console.error(`program entry: no copy for ${kind} code "${code}"`);return t("entry.issue.generic")}
  return t(key)}
window.__repforgeEntryCodeCopy={table:ENTRY_CODE_COPY,key:entryCodeKey,text:entryCodeText};
/* A compile failure as sentences: each conflict the compiler named, else the
   failure's own code. Never the code itself. */
function entryFailureText(failure){
  const codes=[];
  const conflicts=Array.isArray(failure?.conflicts)?failure.conflicts:[];
  if(failure?.code==="must_have_unavailable"||failure?.code==="exercise_preference_conflict"||!conflicts.length)codes.push(failure?.code||failure);
  else for(const conflict of conflicts)codes.push(conflict?.code);
  return[...new Set(codes.map(code=>entryCodeText("failure",code)))].join(" ")}
/* What the last edit did, as the review states it. `labels` renames the
   Before / Now pair when the comparison is not before and after (for example
   the program without and with an avoided exercise). */
function entryChangeKey(state=entryState){
  const result=state?.result;
  return result?[state.draftId,state.route,result.answersFingerprint||"",result.fingerprint||""].join("|"):""}
function entryFactsText(preview){
  const facts=entryPreviewFacts(preview);
  return t("entry.change.facts",{ex:entryExerciseCountLabel(facts.exercises),sets:t("entry.preview.sets",{n:facts.sets})})}
/* The rows of `after` that `before` did not have, counted as a multiset so a
   duplicated movement is added only as often as it was added. Every changed row
   is marked, including when a correction replaces all of them (Q637, SPEC-04):
   the statement counts them as changed, so each carries the tag and accent edge. */
function entryAddedRowIds(before,after){
  const identity=ProgramEntryAdapter?.exerciseIdentity;
  if(!identity)return[];
  const left=new Map();
  for(const row of before?.program||[]){const key=identity(row);left.set(key,(left.get(key)||0)+1)}
  const added=[];
  for(const row of after?.program||[]){
    const key=identity(row);
    if(left.get(key)>0)left.set(key,left.get(key)-1);else added.push(row.id)}
  return added}
function entryBuildChange(beforePreview,afterPreview,state,{lead,beforeLabel="",afterLabel=""}={}){
  const diff=ProgramEntryAdapter?.identityDiff?.(beforePreview,afterPreview)||{n:0,total:(afterPreview?.program||[]).length};
  return{key:entryChangeKey(state),lead,beforeLabel,afterLabel,before:entryFactsText(beforePreview),after:entryFactsText(afterPreview),
    changed:diff.n,total:diff.total,added:entryAddedRowIds(beforePreview,afterPreview)}}
function entryChangedExerciseNames(beforePreview,afterPreview){
  const before=beforePreview?.programDefinition?.days||[];
  const changed=new Set((afterPreview?.programDefinition?.days||[]).flatMap((day,dayIndex)=>
    day.slots.filter((slot,slotIndex)=>before[dayIndex]?.slots[slotIndex]?.exerciseId!==slot.exerciseId).map(slot=>slot.id)));
  return(afterPreview?.program||[]).filter(row=>changed.has(row.slotId||row.id))
    .map(row=>libraryName(libraryEntry(row.libraryId))||row.name).filter(Boolean)}
function entryChangeNow(){return entryChange&&entryChange.key&&entryChange.key===entryChangeKey()?entryChange:null}
/* After a change the statement is the first thing the lifter should see: the top
   of the review when name, facts and statement fit above the pinned region,
   otherwise the statement itself just below the top edge. */
function entryShowChange(){
  const statement=$("#entryChange");
  if(!statement)return;
  const scroller=$("#onboarding");
  if(scroller){
    const pinned=$("#onbBody .entry__pinned");
    const top=statement.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
    const limit=scroller.clientHeight-(pinned?pinned.offsetHeight:0);
    const target=top+statement.offsetHeight<=limit-8?0:Math.max(0,top-16);
    scroller.scrollTo?.({top:target,left:0,behavior:"auto"});
    scroller.scrollTop=target}
  try{statement.focus({preventScroll:true})}catch{}}
/* The answers behind the review, each one a control that opens its own editor. */
const ENTRY_CHIP_KIND={goal:"desired_result",exp:"background",cons:"background",days:"schedule",minutes:"schedule",rest:"schedule",
  env:"environment",prio:"priorities",avoid:"priorities",emph:"priorities",prefs:"exercise_preferences",shape:"custom_shape"};
const ENTRY_EDITOR_TITLE={desired_result:"goal",background:"background",schedule:"schedule",environment:"environment",
  priorities:"priorities",exercise_preferences:"exercises",custom_shape:"shape"};
function entryNames(ids){return ids.map(id=>{const entry=libraryEntry(id);return entry?libraryName(entry):id}).join(", ")}
function entrySameSet(left,right){return JSON.stringify([...(left||[])].sort())===JSON.stringify([...(right||[])].sort())}
function entryChipList(){
  const a=entryState.answers||{},custom=entryState.route==="custom",out=[];
  const add=(chip,text)=>out.push({chip,text,what:t(`entry.chip.what.${chip}`)});
  if(a.desiredResult)add("goal",t(`entry.chip.goal.${a.desiredResult}`));
  if(a.structuredExperience)add("exp",t(`entry.lifting.${a.structuredExperience}`));
  if(a.daysPerWeek)add("days",t("entry.chip.days",{n:a.daysPerWeek}));
  if(a.sessionMinutes)add("minutes",t("entry.chip.minutes",{n:a.sessionMinutes}));
  if(a.environment?.kind)add("env",entryEnvironmentKindLabel(a.environment.kind));
  const avoided=(a.exerciseConstraints||[]).map(item=>item.exerciseId);
  const priorities=entryPriorityLabel(a),none=t("entry.preview.priorities_none");
  if(!custom){
    add("prio",priorities!==none?t("entry.chip.prio",{list:priorities}):t("entry.chip.prio_none"));
    if(avoided.length)add("avoid",t("entry.chip.avoid",{list:entryNames(avoided)}))}
  else{
    add("emph",priorities!==none?t("entry.chip.emph",{list:priorities}):t("entry.chip.emph_none"));
    const included=a.mustHaveExercises||[];
    add("prefs",[included.length?t("entry.chip.include",{list:entryNames(included)}):"",avoided.length?t("entry.chip.avoid",{list:entryNames(avoided)}):""]
      .filter(Boolean).join(" · ")||t("entry.chip.prefs_none"));
    const splits=entryCustomSplitChoices(a);
    const choice=splits.choices.length>=2?splits.choices.find(item=>item.id===a.splitPreference):null;
    if(choice)add("shape",t("entry.chip.shape",{name:t("entry.custom_shape.choice",{name:splitDisplayName(choice),days:choice.frequency})}))}
  return out}
function entryEditorTitleText(kind){
  const custom=entryState.route==="custom";
  const which=kind==="priorities"&&custom?"emphasis":ENTRY_EDITOR_TITLE[kind];
  return t(`entry.chip.fact.${which}`)}
/* The editor draws the very controls the question screens do, from its own copy
   of the answers; the committed answers are put back before anything else runs. */
function entryAnswerFieldsModel(source=entryState,kind=source?.step){
  const answers=source?.answers||{},names=new Set([...(answers.mustHaveExercises||[]),...(answers.exerciseConstraints||[]).map(item=>item.exerciseId),...(EntryUi.answerUi().pendingAvoid?[EntryUi.answerUi().pendingAvoid]:[])]);
  const named=entry=>({id:entry.id,name:libraryName(entry)});
  return{answers,route:source?.route||null,goalOpen:entryGoalOpen,activeProgram:hasActiveProgram(),hasLegacyHints:!!source?.legacyHints&&Object.keys(source.legacyHints).length>0,
    pendingAvoid:EntryUi.answerUi().pendingAvoid,avoidQuery:EntryUi.answerUi().avoidQuery,exerciseQuery:EntryUi.answerUi().exerciseQuery,
    avoidMatches:kind==="priorities"?entryAvoidMatches(EntryUi.answerUi().avoidQuery,source).map(named):[],exerciseMatches:kind==="exercise_preferences"?entryExerciseMatches(EntryUi.answerUi().exerciseQuery,source).map(named):[],
    exerciseNames:Object.fromEntries([...names].map(id=>{const entry=libraryEntry(id);return[id,entry?libraryName(entry):id]})),
    environments:ENTRY_ENVIRONMENTS,muscles:ENTRY_MUSCLES,movements:ENTRY_MOVEMENTS,avoidReasons:ENTRY_AVOID_REASONS,maxPriority:ProgramEntry.MAX_PRIORITY_MUSCLES,maxMuscles:ProgramEntry.MAX_MUSCLE_CONTROLS||22,
    prioritiesEmpty:entryPrioritiesEmpty(source),splits:kind==="custom_shape"?entryCustomSplitChoices(answers):{choices:[]}};
}
function entryEditorBody(kind,source){return EntryUi.renderAnswerPart(kind,entryAnswerFieldsModel(source,kind))}
function renderEntryEditor(){
  const editor=entryEditor,body=entryEditorBody(editor.kind,editor.draft);
  const pending=!!EntryUi.answerUi().pendingAvoid;
  return `<section class="entry-editor" id="entryEditor" aria-labelledby="entryEditorTitle">`+
    `<h3 class="entry-editor__title" id="entryEditorTitle" tabindex="-1">${esc(entryEditorTitleText(editor.kind))}</h3>`+
    (editor.error?`<div class="entry__notice entry__notice--error" id="entryEditorError" role="alert"><p>${esc(editor.error)}</p></div>`:"")+
    `<div class="entry-editor__body">${body}</div>`+
    `<div class="entry-editor__acts"><button type="button" class="btn btn--cta btn--noarrow" id="entryChipApply"${pending?` disabled aria-describedby="entryPendingAvoidNote"`:""}>${esc(t("entry.chip.apply"))}</button>`+
    `<button type="button" class="btn btn--steel" id="entryChipKeep">${esc(t("entry.chip.keep"))}</button></div></section>`}
function renderEntryChips(){
  const open=entryEditor?.chip||null;
  return `<section class="entry__answers" aria-labelledby="entryChipsLabel"><h2 class="entry__section-head" id="entryChipsLabel">${esc(t("entry.chips.title"))}</h2>`+
    `<p class="entry__hint">${esc(t("entry.chips.hint"))}</p><div class="entry-chips">`+
    entryChipList().map(chip=>`<button type="button" class="entry-chip${open===chip.chip?" is-open":""}" data-entry-chip="${chip.chip}" aria-expanded="${open===chip.chip?"true":"false"}"`+
      `${open===chip.chip?` aria-controls="entryEditor"`:""} aria-label="${esc(t("entry.chip.aria",{what:chip.what,value:chip.text}))}">`+
      `<span class="entry-chip__text">${esc(chip.text)}</span><span class="entry-chip__edit icon-mask icon-mask--pencil icon-mask--sm" aria-hidden="true"></span></button>`).join("")+
    `</div>${entryEditor?renderEntryEditor():""}</section>`}
function entryResetEditorFields(){EntryUi.resetAnswerFields()}
function openEntryEditor(chip){
  if(!entryState?.result)return;
  if(entryEditor?.chip===chip){closeEntryEditor();return}
  entryResetEditorFields();
  entryEditor={chip,kind:ENTRY_CHIP_KIND[chip],draftId:entryState.draftId,draft:{...entryState,answers:cloneSnapshot(entryState.answers)},error:null};
  entryReviewError=null;
  renderOnboarding();
  const title=$("#entryEditorTitle"),editor=$("#entryEditor"),scroller=$("#onboarding");
  try{title?.focus({preventScroll:true})}catch{}
  /* The editor opens in flow, below its chip. Bring its top into view; if its
     update control would still sit below the fold, bring that up instead. */
  if(editor&&scroller){
    const box=scroller.getBoundingClientRect(),top=editor.getBoundingClientRect().top-box.top+scroller.scrollTop;
    const apply=$("#entryChipApply"),bottom=apply?apply.getBoundingClientRect().bottom-box.top+scroller.scrollTop:top;
    const target=bottom-top+24<=scroller.clientHeight?Math.max(0,top-12):Math.max(0,bottom-scroller.clientHeight+16);
    scroller.scrollTo?.({top:target,left:0,behavior:"auto"});scroller.scrollTop=target}}
function closeEntryEditor({refocus=true}={}){
  const chip=entryEditor?.chip;
  entryEditor=null;entryResetEditorFields();
  renderOnboarding();
  if(refocus&&chip)try{$(`[data-entry-chip="${chip}"]`)?.focus({preventScroll:true})}catch{}}
function entryCanon(value){
  if(Array.isArray(value))return`[${value.map(entryCanon).join(",")}]`;
  if(value&&typeof value==="object")return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${entryCanon(value[key])}`).join(",")}}`;
  return JSON.stringify(value===undefined?null:value)}
/* ONE transition. The patched answers, the program they compile to and the
   result stamped for those answers become the next state together, and the
   draft is written once. The committed state is never left with answers that
   have no result, so nothing between the two is ever persisted or resumed.
   An answer changed while an earlier change is still generating builds on
   that change and supersedes it: the last answer wins and none is lost. */
async function applyEntryAnswerEdit(patch,{lead,beforeLabel,afterLabel}={}){
  if(!ProgramEntry||!entryState?.result?.preview)return{ok:false};
  const route=entryState.route;
  if(route!=="recommend"&&route!=="custom")return{ok:false};
  const committed=entryState,before=committed.result;
  const next=ProgramEntry.setAnswers(entryAnswerJob?.committed===committed?entryAnswerJob.next:committed,patch);
  if(before.preview.programDefinition?.provenance?.source==="recovered_generation_rules"){
    const mapped=entryGeneratorRequest(next);
    if(!mapped.ok)return{ok:false,failure:{code:"generation_conflict",conflicts:mapped.failure?.conflicts||[]}};
    if(!ProgramCompiler.availableSplits(mapped.request).includes(mapped.request.split))return{ok:false,failure:{code:"generation_conflict",
      conflicts:[{code:"unsupported_generation_domain"}]}}}
  entryAnswerJob?.controller.abort();
  const job={committed,next,controller:new AbortController()};
  entryAnswerJob=job;syncEntryBusy();
  let outcome;
  try{outcome=await generateEntryCandidate(next,{signal:job.controller.signal,timed:true})}
  catch{return{ok:false,superseded:true}}
  if(entryAnswerJob!==job)return{ok:false,superseded:true};
  entryAnswerJob=null;syncEntryBusy();
  if(entryState!==committed)return{ok:false,superseded:true};
  if(!outcome.ok)return{ok:false,failure:outcome.failure};
  const compiled=outcome.result;
  // The completion event belongs to the walk, not to each rebuild.
  if(before.telemetry?.completed===true&&compiled.telemetry)compiled.telemetry={...compiled.telemetry,completed:true};
  const final=ProgramEntry.setResult(next,compiled);
  entryChange=entryBuildChange(before.preview,compiled.preview,final,{lead,beforeLabel,afterLabel});
  if(Object.prototype.hasOwnProperty.call(patch,"movementConfirmations"))
    entryChange.changedNames=entryChangedExerciseNames(before.preview,compiled.preview);
  entryEditor=null;entryResetEditorFields();entryReviewError=null;
  entryPinnedVersionsExecutable=false;
  publishEntryDraft(final);
  if(entryAdjustRoute())adoptEntryAdjust(cloneSnapshot(compiled));
  entrySetState(entryState);
  startEntryOfferVerification(entryState,outcome);
  entryShowChange();
  return{ok:true}}
async function confirmEntryMovementOffer(offer){
  const key=entryOfferKey(entryState,entryOfferBaseline(entryState));
  if(entryState?.route!=="recommend"||entryState?.step!=="result"||entryOfferState.key!==key||
    !entryCurrentVerifiedOffers(entryState).some(item=>item.slotId===offer?.slotId&&item.offeredExerciseId===offer?.offeredExerciseId))
    return{ok:false,stale:true};
  const confirmations=cloneSnapshot(entryState.answers?.movementConfirmations||{});
  confirmations[offer.offeredExerciseId]=[...offer.prerequisiteIds];
  const outcome=await guardEntryRebuild(()=>applyEntryAnswerEdit({movementConfirmations:confirmations},{lead:t("entry.change.lead.answer")}));
  if(outcome?.ok){
    [...document.querySelectorAll("[data-review-confirmation-undo]")]
      .find(button=>button.dataset.reviewConfirmationUndo===offer.offeredExerciseId)?.focus({preventScroll:true});
    return outcome}
  return outcome===false?{ok:false,cancelled:true}:{...outcome,message:entryFailureText(outcome?.failure)||t("entry.issue.compile")}}
async function undoEntryMovementConfirmation(exerciseId){
  if(!entryState?.answers?.movementConfirmations?.[exerciseId])return{ok:false,stale:true};
  const confirmations=cloneSnapshot(entryState.answers.movementConfirmations);
  delete confirmations[exerciseId];
  const outcome=await guardEntryRebuild(()=>applyEntryAnswerEdit({movementConfirmations:confirmations},{lead:t("entry.change.lead.answer")}));
  return outcome===false?{ok:false,cancelled:true}:outcome?.ok?outcome:
    {...outcome,message:entryFailureText(outcome?.failure)||t("entry.issue.compile")}}
async function applyEntryEditor(){
  const editor=entryEditor;
  if(!editor||EntryUi.answerUi().pendingAvoid)return;
  const base=entryState.answers,draft=editor.draft.answers,patch={};
  for(const key of Object.keys(draft))if(entryCanon(base[key])!==entryCanon(draft[key]))patch[key]=draft[key];
  if(!Object.keys(patch).length){closeEntryEditor();return}
  const outcome=await applyEntryAnswerEdit(patch,{lead:t("entry.change.lead.answer")});
  if(outcome.ok||outcome.superseded||entryEditor!==editor)return;
  editor.error=entryFailureText(outcome.failure)||t("entry.issue.compile");
  renderOnboarding();
  try{$("#entryEditorTitle")?.focus({preventScroll:true})}catch{}}
async function restoreEntryConstraint(exerciseId){
  const kept=(entryState.answers.exerciseConstraints||[]).filter(item=>item.exerciseId!==exerciseId);
  const outcome=await applyEntryAnswerEdit({exerciseConstraints:kept},{lead:t("entry.change.lead.restore")});
  if(outcome.ok||outcome.superseded)return;
  entryReviewError=entryFailureText(outcome.failure)||t("entry.issue.compile");
  renderOnboarding();
  try{$("#entryReviewError")?.focus({preventScroll:true})}catch{}}
/* The first result of a walk says something only when it is true and meaningful:
   the answers changed the program the lifter just left, or constraints reshaped
   it (stated against the program without them). */
function entryNoteFirstResult(result,without){
  const left=entryLastPreview&&entryLastPreview.draftId===entryState.draftId?entryLastPreview.preview:null;
  entryLastPreview=null;
  const key=entryChangeKey();
  if(left){
    const change=entryBuildChange(left,result.preview,entryState,{lead:t("entry.change.lead.answers")});
    if(change.changed>0){entryChange=change;return}}
  const constraints=entryState.answers.exerciseConstraints||[];
  if(constraints.length){
    if(without){
      entryChange=entryBuildChange(without.preview,result.preview,entryState,{lead:t("entry.change.lead.constraints"),
        beforeLabel:t("entry.change.without"),afterLabel:t("entry.change.with")});
      return}}
  if(entryChange&&entryChange.key!==key)entryChange=null}
function renderEntryConstraints(){
  const a=entryState.answers||{},rows=[];
  for(const id of a.mustHaveExercises||[]){
    const entry=libraryEntry(id);
    if(entry)rows.push(`<li class="entry__row entry__constraint"><span class="entry__row-ico icon-mask icon-mask--check" aria-hidden="true"></span><span class="entry__row-body">${esc(t("entry.constraints.include",{exercise:libraryName(entry)}))}</span></li>`)}
  for(const item of a.exerciseConstraints||[]){
    const entry=libraryEntry(item.exerciseId);
    if(!entry)continue;
    const exercise=libraryName(entry);
    rows.push(`<li class="entry__row entry__constraint"><span class="entry__row-ico icon-mask icon-mask--shield" aria-hidden="true"></span>`+
      `<span class="entry__row-body">${esc(t("entry.constraints.avoid",{exercise,reason:t(`entry.priorities.reason.${item.reason}`).toLowerCase()}))}</span>`+
      `<button type="button" class="btn btn--steel entry__restore" data-entry-restore="${esc(item.exerciseId)}" aria-label="${esc(t("entry.constraints.restore_aria",{exercise}))}">${esc(t("entry.constraints.restore"))}</button></li>`)}
  if(!rows.length)return"";
  return `<section class="entry__constraints" aria-labelledby="entryConstraintsLab"><h2 class="entry__section-head" id="entryConstraintsLab">${esc(t("entry.constraints.title"))}</h2>`+
    (entryReviewError?`<div class="entry__notice entry__notice--error" id="entryReviewError" role="alert" tabindex="-1"><p>${esc(entryReviewError)}</p></div>`:"")+
    `<ul class="entry__rows">${rows.join("")}</ul></section>`}
function renderEntryAdjusted(preview){
  const rows=[];
  for(const item of preview.limitations||[])rows.push(entryCodeText("limitation",item.code));
  for(const item of preview.reductions||[])rows.push(entryCodeText("reduction",item.step));
  if(!rows.length)return"";
  return `<section class="entry__adjusted" aria-labelledby="entryAdjustedLab"><h2 class="entry__section-head" id="entryAdjustedLab">${esc(t("entry.adjusted.title"))}</h2>`+
    `<ul class="entry__rows">${rows.map(text=>`<li class="entry__row"><span class="entry__row-ico icon-mask icon-mask--scale" aria-hidden="true"></span><span class="entry__row-body">${esc(text)}</span></li>`).join("")}</ul></section>`}
/* A generated route's result is the review: the program first (name, four
   facts, what just changed, the week), then the answers it was built from, why
   it fits, what was adjusted and the constraints the lifter set. */
/* B's conflict (Plan 072 §4.3): a job nothing in the catalog can fill names
   the jobs and returns to the equipment, with the adjustment kept; any other
   conflict says so plainly and returns to the screen that set it. */
function entryJobName(purposeId){
  const key=ReviewRules.JOB_KEYS.find(item=>String(purposeId||"").endsWith(item));
  return key?t(`entry.review.job.${key}`):""}
function renderBConflict(failure){
  const conflicts=Array.isArray(failure?.conflicts)?failure.conflicts:[];
  const equipment=conflicts.filter(item=>item?.code==="no_eligible_exercise"||item?.code==="insufficient_candidates");
  const time=conflicts.some(item=>item?.code==="time_ceiling_exceeded");
  const jobs=[...new Set(equipment.map(item=>entryJobName(item.purposeId)).filter(Boolean))];
  if(!equipment.length&&!time)return null;
  const body=equipment.length&&jobs.length?t("entry.conflict_b.equipment",{jobs:whyList(jobs)}):t("entry.conflict_b.generic");
  const target=equipment.length?"equipment":"session_length";
  const backLabel=target==="equipment"?t("entry.conflict_b.back_equipment"):t("entry.back");
  return entryHeading(t("entry.conflict_b.title"))+
    `<div class="entry__notice entry__notice--error" role="alert"><p>${esc(body)}</p><p>${esc(t("entry.conflict_b.nothing"))}</p>`+
    `<button type="button" class="btn btn--cta" data-entry-action="conflict-back" data-entry-step="${target}">${esc(backLabel)}</button></div>`}
function renderResultStep(){
  const custom=entryState?.route==="custom";
  const resultTitle=custom?t("entry.result.custom_title"):t("entry.result.title");
  if(entryEditor&&entryEditor.draftId!==entryState.draftId)entryEditor=null;
  const result=entryState.result?.preview?entryState.result:null;
  if(!result&&!entryCompileError){
    // A resumed draft can stand on the result step without its program.
    if(!entryResultJob)startEntryResult(entryState);
    return entryHeading(resultTitle)+`<p class="visually-hidden" role="status">${esc(t("entry.result.building"))}</p>`}
  if(!result){
    const failure=entryCompileError&&typeof entryCompileError==="object"?entryCompileError:null;
    const unavailable=(failure?.conflicts||[]).filter(item=>item.code==="must_have_unavailable").map(item=>libraryEntry(item.exerciseId)).filter(Boolean);
    if(unavailable.length)return entryHeading(resultTitle)+`<div class="entry__notice" role="alert"><strong>${esc(t("entry.result.must_unavailable_title"))}</strong>`+
      `<p>${esc(t("entry.result.must_unavailable_body",{exercises:unavailable.map(libraryName).join(", ")}))}</p>`+
      `<button type="button" class="btn btn--cta" data-entry-action="change-exercise-preferences">${esc(t("entry.result.change_preferences"))}</button></div>`;
    if(entryIsB()){
      const conflict=renderBConflict(failure);
      if(conflict)return conflict}
    return entryHeading(t("entry.result.error_title"))+`<div class="entry__notice entry__notice--error" role="alert"><p>${esc(entryFailureText(failure||entryCompileError)||t("entry.issue.compile"))}</p></div>`}
  reportGeneratorCompleted(result);
  const preview=result.preview||{},explanation=result.explanation||{};
  const goal=explanation.desiredResult?t(`entry.goal.${explanation.desiredResult}`):"";
  const days=explanation.daysPerWeek||preview.frequency||"";
  const minutes=explanation.sessionMinutes||"";
  const environmentKind=explanation.mainConstraint;
  const exercisePreferences=entryExercisePreferenceLabel();
  const whyRows=[
    goal?{icon:"flex",text:t("entry.result.why_goal",{goal})}:null,
    days&&minutes?{icon:"cal",text:t("entry.result.why_schedule",{days,minutes})}:null,
    environmentKind?{icon:"building",text:t(`entry.result.why_environment.${environmentKind}`)}:null,
    (entryPriorityLabel()!==t("entry.preview.priorities_none"))?{icon:"target",text:t("entry.result.why_priorities",{priorities:entryPriorityLabel()})}:null,
    custom&&exercisePreferences!==t("entry.preview.exercise_preferences_none")?{icon:"dumbbell",text:t("entry.result.why_exercise_preferences",{preferences:exercisePreferences})}:null,
    {icon:"trend",text:entryProgressionSentence(preview)},
    (preview.reductions||[]).length?{icon:"scale",text:t("entry.result.why_reductions",{n:preview.reductions.length})}:null,
    (preview.limitations||[]).length?{icon:"scale",text:t("entry.result.why_compromises",{n:preview.limitations.length})}:null,
    explanation.recentConsistency==="about_half"&&preview.programStructure?.weekPrescriptions?.length
      ?{icon:"clock",text:t("entry.result.why_interrupted")}:null,
  ].filter(Boolean);
  const alternative=result.alternative?.fingerprint&&result.alternative?.preview&&result.alternative?.reason?result.alternative:null;
  const alternativeBlock=!alternative?"":`<section class="entry__alternative" aria-labelledby="entryAlternativeLab"><h2 class="entry__section-head" id="entryAlternativeLab">${esc(t("entry.result.alternative"))}</h2>`+
    `<button type="button" class="btn btn--steel" data-entry-select-alternative>`+
    `${esc(isPt()?alternative.namePt||alternative.name:alternative.name)} · ${esc(t("entry.catalogue.days_badge",{days:alternative.daysPerWeek}))}</button>`+
    `<p class="entry__hint">${esc(t("entry.result.alternative_reason.compatible_split_variation"))}</p></section>`;
  const progressionIssue=entryPreviewHasProgressionIssue(preview);
  /* Plan 070: the program is onboarding B's review editor, mounted into
     #entryReview after this render (mountEntryAdjust). What the program was
     built from stays below it until B's question screens replace these. */
  return `<section id="entryCandidateReview" class="entry__review" aria-labelledby="entryHeading"${entryAnswerJob?` aria-busy="true"`:""}>`+
    `<div id="entryReview" class="entry__adjust ph-no-capture"></div>`+
    renderEntryChangeStatement(entryChange)+
    (hasActiveProgram()&&!entryUiNotice?`<p class="entry__active" role="status">${esc(t("entry.active_notice"))}</p>`:"")+
    `<h2 class="entry__section-head entry__built-head" id="entryBuiltLab">${esc(t("entry.review.built_title"))}</h2>`+
    renderEntryChips()+
    `<section class="entry__why" aria-labelledby="entryWhyLab"><h2 class="entry__section-head" id="entryWhyLab">${esc(t("entry.result.why"))}</h2>`+
    `<ul class="entry__rows entry__rows--reasons">${whyRows.map(row=>`<li class="entry__row"><span class="entry__row-ico icon-mask icon-mask--${esc(row.icon)}" aria-hidden="true"></span><span class="entry__row-body">${esc(row.text)}</span></li>`).join("")}</ul>`+
    `<p class="entry__hint">${esc(t("entry.result.lede"))}</p>`+
    `<p class="entry__hint">${esc(t(entryPreviewProgressionCopy(preview,progressionIssue)))}</p></section>`+
    renderEntryAdjusted(preview)+
    renderEntryConstraints()+
    alternativeBlock+
    renderEntryMore({edit:false})+
    (entryEditor?"":renderEntryPinned({progressionIssue,configurationIssue:entryNeedsMetricConfiguration(),reviewIssue:entryAdjustIssue()}))+
    `</section>`}
/* Plan 070: onboarding B's review editor (program-review.js) on Generate's
   result screen. The recommendation is regenerated in memory from the canonical
   request; every adjustment is committed to
   the setup draft as the edited definition. The edit log that makes undo
   survive a reload is tab-scoped and never leaves the device: it holds the
   draft id, the recommendation's fingerprint and the edits, and is kept after
   a reload only if replaying it rebuilds the saved definition. */
const EntryReview=createEntryReviewSession({storage:sessionStorage});
let entryAdjustView={tab:null,reorder:null},entryAdjustMount=null,entryAdjustSheetClose=null,entryAdjustDialog=null;
const entryAdjustRoute=()=>entryState?.route==="recommend"||entryState?.route==="custom"||entryState?.route==="shared";
const entryGeneratorReviewRoute=()=>entryState?.route==="recommend"||entryState?.route==="custom";
function entryAdjustCtx(){
  return{compiler:ProgramCompiler,catalog:rawExerciseCatalog,metrics:ExerciseMetrics,
    customDefinitions:entryState?.route==="shared"?(entryState.result?.preview?.customExercises||[]):[],dayName:entryAdjustDayName}}
function clearEntryAdjust(){
  entryAdjustMount?.dispose();entryAdjustMount=null;EntryReview.clear();entryAdjustView={tab:null,reorder:null}}
const sameDefinition=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function prepareEntryAdjust(){
  const Review=ReviewRules,result=entryState?.result;
  if(!Review||!entryAdjustRoute()||!result?.preview?.programDefinition||!rawExerciseCatalog)return null;
  if(entryGeneratorReviewRoute()&&result.preview.programDefinition.generatorVersion!==ProgramCompiler.GENERATOR_VERSION)return null;
  const current=EntryReview.current(entryState);if(current)return current;
  if(entryState.route==="shared")return adoptEntryAdjust(cloneSnapshot(result));
  const cached=entryGeneratedPeek(entryState);
  if(!cached){loadEntryAdjustBaseline();return null}
  startEntryOfferVerification(entryState,cached);
  return adoptEntryAdjust(cached.result)}
function adoptEntryAdjust(baseline){
  const adopted=EntryReview.adopt(entryState,baseline,entryAdjustCtx());
  if(adopted)entryAdjustView={tab:null,reorder:null};
  return adopted}
/* After a reload the recommendation is not at hand: generate it, then mount
   the review it belongs to if that result is still on screen. */
let entryAdjustLoading=null;
function loadEntryAdjustBaseline(){
  if(!entryGeneratorReviewRoute()||entryState?.result?.preview?.programDefinition?.generatorVersion!==ProgramCompiler.GENERATOR_VERSION)return Promise.resolve(null);
  const from=entryState,answers=from?.result?.answersFingerprint;
  if(entryAdjustLoading?.draftId===from?.draftId&&entryAdjustLoading?.answers===answers)return entryAdjustLoading.promise;
  const promise=generateEntryCandidate(from).catch(()=>({ok:false})).then(outcome=>{
    if(entryAdjustLoading?.promise===promise)entryAdjustLoading=null;
    if(!outcome.ok||!entryAdjustRoute()||entryState?.draftId!==from.draftId||entryState.result?.answersFingerprint!==answers||
      !entryState.result?.preview?.programDefinition)return null;
    const current=EntryReview.current(entryState);if(current)return current;
    startEntryOfferVerification(entryState,outcome);
    const review=adoptEntryAdjust(outcome.result);
    if($("#entryReview")&&!entryAdjustMount)mountEntryAdjust();
    return review});
  entryAdjustLoading={draftId:from?.draftId,answers,promise};
  return promise}
async function entryAdjustReady(){return prepareEntryAdjust()||(entryAdjustRoute()?await loadEntryAdjustBaseline():null)}
/* What still keeps Activate disabled on the review: an emptied training day. */
function entryAdjustIssue(){
  if(!entryAdjustRoute())return null;
  const blockers=ReviewRules?.blockers(entryState?.result?.preview?.programDefinition)||[];
  return blockers.length?"entry.review.blocked_empty":null}
/* How far the activated program sits from the recommendation, in the review's
   own change count (Plan 071 §5.3). Only the generated routes have one. */
function entryReviewChanges(){
  const Review=ReviewRules;
  if(!Review?.changes||!entryGeneratorReviewRoute())return null;
  const review=EntryReview.current(entryState);
  if(!review)return null;
  try{return Review.changes(review.baseline.preview.programDefinition,entryState.result.preview.programDefinition).count}catch{return null}}
function reportActivationFailed(reason){
  const route=entryState?.route;
  if(["recommend","custom","build","import","shared"].includes(route))captureEvent("program_activation_failed",{route,reason})}
/* Does the result carry the lifter's adjustments (a rebuild would discard them)? */
async function entryAdjusted(){
  const review=await entryAdjustReady();
  if(!review)return false;
  return !sameDefinition(review.baseline.preview.programDefinition,entryState.result.preview.programDefinition)||
    entryResultName()!==entryResultName(review.baseline)}
async function commitEntryAdjust({definition,edits,name}){
  const review=EntryReview.current(entryState);
  if(!review||!entryState?.result)return{ok:false};
  const base=review.baseline;
  const shared=entryState.route==="shared";
  const preview=shared?(()=>{
    const current=cloneSnapshot(entryState.result.preview),customs=current.customExercises||[];
    const program=flatProgramFromDefinition(definition,customs,1);
    const dayById=new Map((definition.days||[]).map(day=>[day.id,day]));
    const structure=cloneSnapshot(current.programStructure||{schemaVersion:1,days:[],provenance:{source:"shared"}});
    structure.days=(structure.days||[]).map(item=>{
      const day=dayById.get(item.dayId);
      return day?{...item,label:day.name}:item});
    return{...current,program,programDefinition:cloneSnapshot(definition),programStructure:structure,
      days:sharedPreviewDays(program,structure,current.sharedSettings)}
  })():{...cloneSnapshot(entryState.result.preview),...generatedPreview(definition,entryState.route)};
  const result={...cloneSnapshot(entryState.result),preview};
  result.name=name==null?base.name:name;delete result.namePt;
  result.fingerprint=sameDefinition(definition,base.preview.programDefinition)&&result.name===base.name
    ?base.fingerprint:entryCandidateFingerprint(entryState.route,result.name,result.preview);
  entryPinnedVersionsExecutable=false;
  const next=ProgramEntry.setResult(entryState,result);
  if(shared)publishEntryDraft(next);
  else{
    const saved=await persistEntryRulesState(next);
    if(!saved?.ok)return{ok:false}}
  if(!EntryReview.committed(review,entryState,edits))return{ok:false};
  syncEntryAdjustFooter();
  return{ok:true}}
/* The pinned footer follows the review without re-rendering the screen. */
function syncEntryAdjustFooter(){
  const pinned=$("#entryCandidateReview .entry__pinned");
  if(!pinned)return;
  pinned.outerHTML=renderEntryPinned({progressionIssue:entryPreviewHasProgressionIssue(entryState.result.preview),
    configurationIssue:entryNeedsMetricConfiguration(),reviewIssue:entryAdjustIssue()});
  const activate=$("#entryActivate");if(activate)activate.onclick=()=>activateEntryPreview()}
function entryAdjustSheet(){
  const el=$("#reviewSheet");
  return{el,title:$("#reviewSheetTitle"),body:$("#reviewSheetBody"),foot:$("#reviewSheetFoot")}}
function openEntryAdjustSheet({onClose}={}){
  const sheet=$("#reviewSheet"),scrim=$("#reviewSheetScrim");
  if(!sheet)return;
  entryAdjustSheetClose=onClose||null;
  if(shellView().activeModal?.el===sheet){sheet.querySelector("#reviewRenameInput")?.focus();return}
  const close=sheet.querySelector("[data-review-sheet-close]");if(close)close.onclick=()=>closeEntryAdjustSheet();
  if(scrim)scrim.onclick=()=>closeEntryAdjustSheet();
  document.body.classList.add("is-sheet-open");
  openModal(sheet,{initialFocus:sheet.querySelector("#reviewRenameInput")||sheet,onEscape:closeEntryAdjustSheet,scrim,
    delayHide:reducedMotion()?0:280});
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}
function closeEntryAdjustSheet(){
  const sheet=$("#reviewSheet");
  const onClose=entryAdjustSheetClose;entryAdjustSheetClose=null;
  onClose?.();
  if(!sheet||(sheet.hidden&&!(shellView().activeModal&&shellView().activeModal.el===sheet)))return Promise.resolve(false);
  return closeModal(sheet)}
function pickEntryAdjustExercise({mode,day,exercise,accept}){
  return new Promise(resolve=>{
    let settled=false;const finish=id=>{if(settled)return;settled=true;resolve(id)};
    const exclude=pickableExercises().filter(entry=>!accept(entry.id)).map(entry=>entry.id);
    libraryUi.openExercisePicker({
      title:mode==="replace"?t("picker.title_change"):t("picker.add_to",{day:entryAdjustDayName(day,entryState.result.preview.programDefinition)}),
      subtitle:exercise?libraryName(libraryEntry(exercise.exerciseId)):"",exclude,catalogOnly:true,
      onPick:entry=>finish(entry?.id||null),onCancel:()=>finish(null)})})}
function entryAdjustDayName(day,definition){
  return localizedDayName({label:day?.name},day?.name,definition)}
function confirmEntryAdjust({title,body,go,keep}){
  return new Promise(resolve=>{
    entryAdjustDialog?.resolve(false);
    entryDialogOpener=entryOpenerToken();
    // Only the dialog opens: re-rendering the screen behind it would remount
    // the review that is waiting on the answer.
    entryAdjustDialog={title,body,go,keep,resolve};entryDialog="review";syncEntryDialog()})}
function resolveEntryAdjustDialog(confirmed){
  const pending=entryAdjustDialog;entryAdjustDialog=null;entryDialog=null;
  closeEntryDialog();
  pending?.resolve(confirmed)}
/* A change that rebuilds the program (an answer, the alternative split) asks
   first when a successful rebuild would discard the lifter's adjustments. */
async function guardEntryRebuild(rebuild){
  // A rebuild of this same result is already generating: its guard has dealt
  // with the adjustments, and the next answer builds on that rebuild.
  const rebuilding=entryAnswerJob&&entryAnswerJob.committed===entryState;
  if(!rebuilding&&await entryAdjusted()){
    const count=ReviewRules.changes(EntryReview.current(entryState).baseline.preview.programDefinition,
      entryState.result.preview.programDefinition).count||1;
    const confirmed=await confirmEntryAdjust({title:t("entry.review.rebuild_title"),
      body:t(count===1?"entry.review.rebuild_body_one":"entry.review.rebuild_body",{n:count}),
      go:t("entry.review.rebuild_go"),keep:t("entry.review.keep")});
    if(!confirmed)return false;
  }
  // The successful rebuild replaces the reviewed candidate atomically. A
  // rejected configuration keeps the lifter's adjustments and saved draft.
  return rebuild()}
let programReviewUi=null;
function mountedProgramReview(){return programReviewUi||(programReviewUi=createProgramReview({window,motion:ensureBrowserPresentation().motion}))}
function mountEntryAdjust(){
  entryAdjustMount?.dispose();entryAdjustMount=null;
  const host=$("#entryReview"),Review=ReviewRules;
  const review=prepareEntryAdjust();
  if(!host||!Review||!review)return;
  entryAdjustMount=mountedProgramReview().mountProgramReview(host,{
    view:entryAdjustView,
    read:()=>({baseline:EntryReview.current(entryState).baseline.preview.programDefinition,definition:entryState.result.preview.programDefinition,
      edits:EntryReview.current(entryState).edits,name:entryResultName()||t("untitled_program"),
      answers:entryState.answers,offers:entryCurrentVerifiedOffers(entryState),
      sessionMinutes:Number(entryState.answers?.sessionMinutes)||null,ctx:entryAdjustCtx()}),
    commit:commitEntryAdjust,
    confirmOffer:confirmEntryMovementOffer,
    undoConfirmation:undoEntryMovementConfirmation,
    // Owner decision (2026-10-13): a received shared program keeps its length,
    // pattern and deload as received, so its review has no block Change.
    changeBlock:entryGeneratorReviewRoute()?async patch=>{
      const outcome=await guardEntryRebuild(()=>applyEntryAnswerEdit(patch,{lead:t("entry.change.lead.answer")}));
      if(outcome===false)return{ok:false,cancelled:true};
      return outcome?.ok?outcome:{...outcome,message:entryFailureText(outcome?.failure)||t("entry.issue.compile")}}:undefined,
    observe:report=>{if(entryGeneratorReviewRoute())captureEvent("program_review_action",report)},
    t:(key,vars)=>key==="entry.review.source"&&entryState?.route==="shared"?t("entry.route.shared"):t(key,vars),esc,
    exerciseName:id=>libraryName(libraryEntry(id))||id,
    tile:(id,size)=>exerciseThumb(libraryEntry(id),{size}),
    muscleName:id=>{const token=SOURCE_FEATURE_TO_LEGACY_MUSCLE[String(rawCatalogObject(id)?.name||"").trim().toLowerCase()];return token?muscleLabel(token):""},
    dayName:entryAdjustDayName,
    nums:monoNums,
    exerciseWord:n=>tp(n,"exercise"),
    exerciseCount:n=>entryExerciseCountLabel(n),
    sheet:entryAdjustSheet,openSheet:openEntryAdjustSheet,closeSheet:closeEntryAdjustSheet,
    pickExercise:pickEntryAdjustExercise,confirm:confirmEntryAdjust,
    announce:message=>toast(message),
    swallowClick:()=>swallowNextClick(),
    reducedMotion:()=>reducedMotion(),
    changed:()=>syncEntryAdjustFooter(),
  })}
function renderCatalogueStep(){
  const cards=entryServices()?.browseCatalogue(entryState.answers)||[];
  const purposeLabels={
    build_muscle:t("entry.catalogue.purpose.build_muscle"),
    muscle_strength:t("entry.catalogue.purpose.muscle_strength"),
    strength_priority:t("entry.catalogue.purpose.strength_priority"),
    train_anywhere:t("entry.catalogue.purpose.train_anywhere")};
  const progressionLabels={
    range:t("program.progression.strategy.range"),rep_goal:t("program.progression.strategy.rep_goal"),
    effort_target:t("program.progression.strategy.effort_target"),anchor_backoff:t("program.progression.strategy.anchor_backoff")};
  const contextFacts=[
    {kind:"data",text:entryState.answers.daysPerWeek?t("entry.catalogue.context_days",{days:entryState.answers.daysPerWeek}):""},
    {kind:"data",text:entryState.answers.sessionMinutes?t("entry.catalogue.context_minutes",{minutes:entryState.answers.sessionMinutes}):""},
    {kind:"language",text:entryEnvironmentLabel()}].filter(fact=>fact.text);
  function renderCard(card){
    const familyName=isPt()?card.familyNamePt||card.familyName:card.familyName;
    const name=isPt()?card.namePt||card.name:card.name;
    const minutes=card.minutes?.length
      ?(card.minutes[0]===card.minutes[1]?t("entry.preview.minutes",{n:card.minutes[0]})
        :t("entry.catalogue.minutes",{min:card.minutes[0],max:card.minutes[1]})):"";
    const counts=card.structureFacts||[],exerciseCounts=counts.map(day=>day.exerciseCount),setCounts=counts.map(day=>day.setCount);
    const structure=counts.length?[
      entryRangeLabel(Math.min(...exerciseCounts),Math.max(...exerciseCounts),
        "entry.catalogue.exercises_range","entry.catalogue.exercises_exact"),
      entryRangeLabel(Math.min(...setCounts),Math.max(...setCounts),
        "entry.catalogue.sets_range","entry.catalogue.sets_exact")].join(" · "):"";
    const progression=(card.progressionStrategies||[]).map(id=>progressionLabels[id]).filter(Boolean).join(" · ");
    const equipment=(card.equipmentAssumptions||[]).map(token=>{
      const key=`entry.equip.${token}`,label=t(key);return label===key?"":label}).filter(Boolean).join(", ");
    const mismatch=card.mismatch==="frequency"?t("entry.catalogue.mismatch_frequency",{
      requested:entryState.answers.daysPerWeek,actual:card.daysPerWeek}):"";
    /* One flat button per program, laid out as a column: identity first, then
       the facts a reader compares across programs, then the assumptions. The
       hub's `.entry-card` is a row of three and cannot carry this shape. */
    return `<button type="button" class="entry-prog" data-entry-catalogue="${esc(card.id)}" aria-label="${esc(t("entry.catalogue.review_aria",{name}))}">`+
      `<span class="entry-prog__head"><span class="entry-prog__name">${esc(familyName)}</span>`+
      `<span class="entry-prog__days">${esc(t("entry.catalogue.days_badge",{days:card.daysPerWeek}))}</span>`+
      `<span class="entry-prog__go chevron" aria-hidden="true"></span></span>`+
      (purposeLabels[card.purpose]?`<span class="entry-prog__purpose">${esc(purposeLabels[card.purpose])}</span>`:"")+
      `<span class="entry-prog__facts">${minutes?`<span>${monoNums(minutes)}</span>`:""}${structure?`<span>${monoNums(structure)}</span>`:""}</span>`+
      (progression?`<span class="entry-prog__meta">${esc(t("entry.catalogue.progression",{progression}))}</span>`:"")+
      (equipment?`<span class="entry-prog__meta">${esc(t("entry.catalogue.equipment",{equipment}))}</span>`:"")+
      (mismatch?`<span class="entry-prog__warn">${esc(mismatch)}</span>`:"")+
      `</button>`}
  if(!cards.length)return entryHeading(t("entry.catalogue.title"))+`<div class="entry__notice" role="alert"><strong>${esc(t("entry.catalogue.empty_title"))}</strong>`+
    `<p>${esc(t("entry.catalogue.empty_body"))}</p><button type="button" class="btn btn--cta" data-entry-action="change-schedule">${esc(t("entry.custom_shape.change_schedule"))}</button></div>`;
  return entryHeading(t("entry.catalogue.title"))+`<p class="onb__explain">${esc(t("entry.catalogue.lede"))}</p>`+
    `<div class="entry__context"><div class="entry__facts" aria-label="${esc(t("entry.catalogue.context"))}">${contextFacts.map(fact=>`<span class="entry__fact--${fact.kind}">${monoNums(fact.text)}</span>`).join("")}</div>`+
    `<button type="button" class="btn btn--steel entry__carried-change" data-entry-action="change-schedule" aria-label="${esc(t("entry.catalogue.change_aria"))}">${esc(t("entry.about.change"))}</button></div>`+
    /* Every family is released at every frequency, so a flat list is twenty
       near-identical rows. Split the ones that match the answered schedule from
       the rest, which is the comparison the reader is actually making. */
    (()=>{const answered=entryState.answers.daysPerWeek;
      const fits=cards.filter(card=>!card.mismatch),others=cards.filter(card=>card.mismatch);
      const section=(label,list)=>!list.length?"":
        (label?`<p class="entry__group-lab">${esc(label)}</p>`:"")+
        `<div class="entry__progs">`+list.map(renderCard).join("")+`</div>`;
      if(!others.length)return section("",fits);
      return section(answered?t("entry.catalogue.group_fits",{days:answered}):"",fits)+
        section(t("entry.catalogue.group_other"),others)})()}

function renderBuildSetupStep(){return EntryUi.renderAnswerScreen('build_setup',entryAnswerFieldsModel(entryState,'build_setup'))}
/* One route, two doors. A Taurifer file is one shape of "I already have a
   program"; a coach's message pasted as text is the other, and the lifter
   arriving with the second should not have to recognise the first. */
function renderImportSourceStep(){
  return importSourceMode()==="freeform"?renderFreeformSourceStep():renderImportFileStep()}
function renderImportFileStep(){
  return entryHeading(t("entry.import_source.title"))+`<p class="onb__explain">${esc(t("entry.import_source.lede"))}</p>`+
    (hasActiveProgram()?`<p class="entry__active" role="status">${esc(t("entry.active_notice"))}</p>`:"")+
    `<div class="onb__opts entry__import-doors">`+
      entryImportDoor("entryImportPick","download","entry.import_source.pick","entry.import_source.pick_cap")+
      entryImportDoor("entryFreeformSwitch","clipboard","entry.import_source.to_freeform","entry.import_source.to_freeform_cap")+`</div>`+
    `<div class="entry__switch entry__switch--doors">`+entryWriteOwnLink()+`</div>`}
/* Plan 072 §7's two choices. Each one acts on tap, as the doors always have:
   a navigation button, not a selection that waits for Continue. */
function entryImportDoor(id,icon,key,capKey){
  return `<button type="button" class="radio-card entry__import-door" id="${id}">`+
    `<span class="radio-card__icon icon-mask icon-mask--${icon}" aria-hidden="true"></span>`+
    `<span class="radio-card__body"><span class="radio-card__title">${esc(t(key))}</span>`+
    `<span class="radio-card__cap">${esc(t(capKey))}</span></span></button>`}
/* The quiet way out of the import route. A lifter who has a program in their
   head rather than in a file or a message can write it themselves in Build.
   It is a route change, not a request: nothing is sent and nothing is read. */
function entryWriteOwnLink(){
  return `<button type="button" class="btn btn--ghost entry__write-own" id="entryWriteOwn">${esc(t("entry.import_source.write_own"))}</button>`}
/* The import route's own controls (Plan 064 R4c). wireEntryDom makes one call
   to this, so the shared handler list stays R4a's and R4b's. */
function renderFreeformSourceStep(){return EntryUi.renderSource({activeProgram:hasActiveProgram()})}
function entryPreviewHasProgressionIssue(preview=entryState?.result?.preview){
  return (Array.isArray(preview?.progressionIncompatibilities)&&preview.progressionIncompatibilities.length>0)||
    (preview?.program||[]).some(exercise=>exercise?.progressionIncompatibility)}
/* The facts strip: four Mono values, each with its unit beneath (days, minutes
   a session, exercises, working sets). The sentence the catalog always read is
   kept as the strip's accessible text, so meaning is unchanged. */
function renderEntryFactsStrip(preview){
  const facts=entryPreviewFacts(preview),duration=entryDurationLabel(preview);
  const days=(preview.days||[]).length;
  const cells=[
    [String(days),t(days===1?"entry.facts.day_one":"entry.facts.days")],
    facts.minMinutes?[facts.minMinutes===facts.maxMinutes?String(facts.minMinutes):`${facts.minMinutes}–${facts.maxMinutes}`,t("entry.facts.minutes")]:null,
    [String(facts.exercises),tp(facts.exercises,"exercise")],
    [String(facts.sets),t("entry.facts.sets")]].filter(Boolean);
  return `<p class="visually-hidden">${esc([entryExerciseCountLabel(facts.exercises),t("entry.preview.sets",{n:facts.sets}),duration].filter(Boolean).join(" · "))}</p>`+
    `<div class="entry__strip" aria-hidden="true">${cells.map(([value,unit])=>
      `<div class="entry__strip-cell"><span class="entry__strip-value">${esc(value)}</span><span class="entry__strip-unit">${esc(unit)}</span></div>`).join("")}</div>`}
/* What a change did to the program, in one sentence and a Before / Now pair.
   Every review has the slot; the Recommend and Custom reviews fill it when an
   answer changes. `change` is `{lead, before, after, changed, total}`. */
function renderEntryChangeStatement(change){
  if(!change||!change.key||change.key!==entryChangeKey())return"";
  const sentence=!change.changed?t("entry.change.none"):change.changed===1
    ?t("entry.change.one",{total:change.total}):t("entry.change.many",{n:change.changed,total:change.total});
  return `<div class="entry__change" id="entryChange" tabindex="-1" role="status" aria-live="polite" data-change-statement data-changed="${change.changed}" data-total="${change.total}">`+
    `<p class="entry__change-line">${esc([change.lead,sentence].filter(Boolean).join(" "))}${change.changedNames?.length?` <span class="visually-hidden">${esc(change.changedNames.join(", "))}</span>`:""}</p>`+
    (change.before&&change.after&&(change.changed||change.before!==change.after)?
      `<dl class="entry__change-grid"><dt>${esc(change.beforeLabel||t("entry.change.before"))}</dt><dd>${monoNums(change.before)}</dd><dt>${esc(change.afterLabel||t("entry.change.after"))}</dt><dd>${monoNums(change.after)}</dd></dl>`:"")+
    `</div>`}
function renderPreviewStep({merged=false}={}){
  const preview=entryState.result?.preview;
  if(!preview)return `<p class="lede" role="alert">${esc(t("entry.error.summary"))}</p>`;
  const previewAnswers=entryPreviewAnswers(preview);
  const days=renderEntryWeek(preview);
  const progressionIssue=entryPreviewHasProgressionIssue(preview);
  const compromises=(preview.limitations||[]).length+(preview.reductions||[]).length;
  const environment=entryEnvironmentLabel(previewAnswers);
  const custom=entryState?.route==="custom";
  const reviewRows=[
    {icon:"target",lab:t("entry.preview.priorities"),text:entryPriorityLabel(previewAnswers)},
    ...(custom?[{icon:"dumbbell",lab:t("entry.preview.exercise_preferences"),text:entryExercisePreferenceLabel(previewAnswers)}]:[]),
    {icon:"building",lab:t("entry.preview.equipment"),text:environment||t("entry.preview.equipment_unspecified")},
    {icon:"trend",lab:t("entry.preview.progression"),text:t(entryPreviewProgressionCopy(preview,progressionIssue))},
    {icon:"scale",lab:t("entry.preview.compromises"),text:compromises?t("entry.preview.compromises_some",{n:compromises}):t("entry.preview.compromises_none")},
  ];
  return (merged?`<h2 id="entryCandidateReviewTitle" class="entry__group-lab entry__section-head">${esc(t("entry.preview.title"))}</h2>`:entryHeading(t("entry.preview.title")))+`<p class="onb__explain">${esc(t("entry.preview.lede"))}</p>`+
    (hasActiveProgram()&&!entryUiNotice&&entryState?.step!=="activation_conflict"
      ?`<p class="entry__active" role="status">${esc(t("entry.active_notice"))}</p>`:"")+
    `<div class="entry__decision"><div class="entry__ident--boxed"><h3>${esc(entryResultName()||entryState.answers.programName||t("untitled_program"))}</h3>`+
    `<p class="entry__source"><span>${esc(t("entry.preview.source"))}</span> ${esc(entrySourceLabel())}</p></div>`+
    renderEntryFactsStrip(preview)+
    renderEntryChangeStatement(entryChange)+
    `<p class="entry__group-lab entry__section-head">${esc(t("entry.preview.days"))}</p><div class="onb__review">${days.join("")}</div>`+
    /* Each facet keeps its heading element: the review's heading outline is how
       a screen-reader user jumps between Priorities, Equipment, Progression and
       Compromises, so the redesign restyles `h4` rather than demoting it. */
    `<ul class="entry__rows">`+reviewRows.map(row=>`<li class="entry__row"><span class="entry__row-ico icon-mask icon-mask--${esc(row.icon)}" aria-hidden="true"></span><div class="entry__row-body"><h4 class="entry__row-lab">${esc(row.lab)}</h4><p>${esc(row.text)}</p></div></li>`).join("")+`</ul></div>`+
    renderEntryMore()+renderEntryPinned({progressionIssue,configurationIssue:entryNeedsMetricConfiguration()})}
function renderSharedReviewStep(){
  const preview=entryState?.result?.preview;
  if(!preview?.programDefinition)return `<p class="lede" role="alert">${esc(t("entry.error.summary"))}</p>`;
  return `<section id="entryCandidateReview" class="entry__review" aria-labelledby="entryHeading">`+
    `<div id="entryReview" class="entry__adjust ph-no-capture"></div>`+
    renderEntryPinned({progressionIssue:entryPreviewHasProgressionIssue(preview),
      configurationIssue:entryNeedsMetricConfiguration(),reviewIssue:entryAdjustIssue()})+
    `</section>`}
/* The week is a stack of hairline bands. The first day is open, so the first
   exercise is on the first screen (K-32); the others fold away, except a day
   that holds an exercise the last change added. */
function renderEntryWeek(preview){
  const added=new Set(entryChangeNow()?.added||[]);
  return (preview.days||[]).map((day,index)=>{
    const exercises=day.exercises||[],sets=sum(exercises.map(exercise=>+exercise.sets||0)),minutes=previewDayMinutes(preview,day);
    const dayName=previewDayLabel(day,index,preview);
    const open=index===0||exercises.some(exercise=>added.has(exercise.id));
    return `<details class="onb__day"${open?" open":""}><summary class="onb__dayname"><span class="onb__daynum" aria-hidden="true">${index+1}</span>${esc(dayName)}`+
    `<span>${monoNums(`${entryExerciseCountLabel(exercises.length)} · ${t("entry.preview.sets",{n:sets})}${minutes?` · ${t("entry.preview.minutes",{n:minutes})}`:""}`)}</span></summary>`+
    exercises.map(ex=>{const isNew=added.has(ex.id),summary=ex.hasRepTarget===false?programPrescriptionSummary(ex):`${ex.sets}×${ex.min}–${ex.max}`;
      return `<div class="onb__ex${isNew?" is-new":""}"><b>${esc(exerciseDisplayName(ex))}</b>${isNew?` <span class="entry__new">${esc(t("entry.preview.new"))}</span>`:""}${ex.sets!=null?` · ${esc(summary)}`:""}</div>`}).join("")+
    (!exercises.length?`<div class="onb__ex">${esc(t("program.empty.exercises"))}</div>`:"")+
    `</details>`})}
function renderEntryMore({edit=true}={}){
  return `<section class="entry__more" aria-labelledby="entryMoreLab"><p class="entry__group-lab entry__section-head" id="entryMoreLab">${esc(t("entry.preview.more"))}</p>`+
    `<div class="entry__confirm-alt">${edit?`<button type="button" id="entryEdit" class="btn btn--steel"><span class="icon-mask icon-mask--pencil icon-mask--sm" aria-hidden="true"></span>${esc(t("entry.preview.edit"))}</button>`:""}`+
    `<button type="button" id="entryRestart" class="btn btn--steel btn--destructive" aria-haspopup="dialog"><span class="icon-mask icon-mask--reset icon-mask--sm" aria-hidden="true"></span>${esc(t("entry.preview.restart"))}</button></div></section>`}
/* The confirm action is the point of the screen, so it is pinned: a long
   program cannot scroll it away, and a blocked one says why directly above. */
/* A custom movement arrives without a metric composition until the lifter
   chooses what it records; the program cannot start before that. */
function entryNeedsMetricConfiguration(){
  try{return !!entryState&&ProgramEntry.candidateActivationIssues(entryState).some(issue=>issue.startsWith("metric_configuration_required:"))}
  catch{return false}}
function renderEntryPinned({progressionIssue=false,configurationIssue=false,reviewIssue=null}={}){
  const activateLabel=hasActiveProgram()?t("entry.preview.activate_replace"):t("entry.preview.activate_first");
  const blocked=progressionIssue||configurationIssue||!!reviewIssue;
  const reason=progressionIssue?t("entry.preview.activation_blocked"):reviewIssue?t(reviewIssue):t("entry.preview.metrics_required");
  return `<div class="entry__pinned">`+
    (blocked?`<p id="entryActivationStatus" class="entry__reason" role="alert" tabindex="-1">${esc(reason)}</p>`:"")+
    `<button type="button" id="entryActivate" class="btn btn--cta${blocked?" btn--noarrow":""}"${blocked?` disabled aria-describedby="entryActivationStatus"`:""}>${esc(activateLabel)}</button></div>`}
function renderEntryNotice(){
  if(!entryUiNotice)return"";
  // Cancel is a dialog and Resume is a card on the hub; neither is a notice.
  if(entryUiNotice==="cancel"||entryUiNotice==="resume")return"";
  if(entryUiNotice==="corrupt")return `<div class="entry__notice" role="alert"><strong>${esc(t("entry.corrupt.title"))}</strong><p>${esc(t("entry.corrupt.body"))}</p></div>`;
  if(entryUiNotice==="save_failed")return `<div class="entry__notice" role="alert"><strong>${esc(t("entry.save_failed.title"))}</strong><p>${esc(t("entry.save_failed.body"))}</p></div>`;
  if(entryUiNotice==="save_conflict")return `<div class="entry__notice" role="alert"><strong>${esc(t("entry.save_conflict.title"))}</strong><p>${esc(t("entry.save_conflict.body"))}</p></div>`;
  if(entryUiNotice==="durable_conflict")return `<div class="entry__notice" role="alert"><strong>${esc(t("entry.durable_conflict.title"))}</strong><p>${esc(t("entry.durable_conflict.body"))}</p>`+
    `<div class="btnrow"><button type="button" class="btn btn--steel" id="entryDurableConflictReview">${esc(t("entry.conflict.review"))}</button></div></div>`;
  if(entryUiNotice==="rules_changed"){
    const keepPinned=entryState?.route==="import"||entryState?.route==="shared";
    const pinnedReady=entryPinnedPreviewCanActivate();
    const action=keepPinned
      ?`<button type="button" class="btn btn--steel" id="entryKeepPinned"${pinnedReady?"":" disabled aria-describedby='entryActivationStatus'"}>${esc(t("entry.rules_changed.keep"))}</button>`
      :`<button type="button" class="btn btn--steel" id="entryRebuildRules">${esc(t("entry.rules_changed.rebuild"))}</button>`;
    return `<div class="entry__notice entry__notice--warn" role="status"><strong>${esc(t("entry.rules_changed.title"))}</strong>`+
      `<p>${esc(t(keepPinned?"entry.rules_changed.body_keep":"entry.rules_changed.body_rebuild"))}</p>`+
      `<div class="btnrow">${action}</div></div>`;
  }
  if(entryUiNotice==="conflict"||entryState?.step==="activation_conflict")return `<div class="entry__notice" role="alert"><strong>${esc(t("entry.conflict.title"))}</strong><p>${esc(t("entry.conflict.body"))}</p>`+
    `<div class="btnrow"><button type="button" class="btn btn--steel" id="entryConflictReview">${esc(t("entry.conflict.review"))}</button></div></div>`;
  return""}
/* Entry dialogs. Cancel, replace and start over each ask one question that the
   lifter must answer before the screen behind them changes, so they share one
   native <dialog>: Escape dismisses it, Tab stays inside it, and focus returns
   to the control that opened it (K-26). It is built at body level on first use
   because `openModal` makes every other body child inert. */
let entryReplaceResolve=null,entryDialogOpener=null;
function entryDialogKind(){return entryUiNotice==="cancel"?"cancel":entryDialog}
function entryDialogElement(){
  let el=$("#entryDialog");
  if(el)return el;
  el=document.createElement("dialog");
  el.id="entryDialog";el.className="entry-dialog";el.setAttribute("aria-modal","true");
  el.innerHTML=`<h2 class="entry-dialog__title" tabindex="-1"></h2><p class="entry-dialog__body"></p><div class="entry-dialog__field" hidden></div><div class="entry-dialog__actions"></div>`;
  document.body.append(el);
  // Some engines close a modal <dialog> on Escape before a capture listener
  // runs; the cancel event routes that to the same dismissal.
  el.addEventListener("cancel",event=>{event.preventDefault();dismissEntryDialog()});
  return el}
function entryDialogSpec(kind){
  if(kind==="picker")return{titleId:"entryPickerTitle",title:entryPickerInput?.label||"",body:"",actions:[
    {id:"entryPickerDone",cls:"btn btn--cta btn--noarrow",label:t("dialog.done"),run:entryCommitPickerInput},
    {id:"entryPickerCancel",cls:"btn btn--steel",label:t("dialog.cancel"),run:()=>dismissEntryDialog()}]};
  if(kind==="review"){
    const dialog=entryAdjustDialog||{};
    return{titleId:"reviewConfirmTitle",title:dialog.title||"",body:dialog.body||"",actions:[
      {id:"reviewConfirmGo",cls:"btn btn--cta btn--noarrow",label:dialog.go||"",run:()=>resolveEntryAdjustDialog(true)},
      {id:"reviewConfirmKeep",cls:"btn btn--steel",label:dialog.keep||"",run:()=>resolveEntryAdjustDialog(false)}]}}
  if(kind==="cancel")return{titleId:"entryCancelTitle",title:t("entry.cancel_confirm.title"),body:t("entry.cancel_confirm.body"),actions:[
    {id:"entryCancelKeep",cls:"btn btn--cta btn--noarrow",label:t("entry.cancel_confirm.keep"),run:()=>keepEntryDraftAndCancel()},
    {id:"entryCancelDiscard",cls:"btn btn--steel",label:t("entry.cancel_confirm.discard"),run:()=>discardEntryDraftAndCancel()},
    {id:"entryCancelContinue",cls:"btn btn--steel",label:t("entry.cancel_confirm.continue"),run:()=>dismissEntryDialog()}]};
  if(kind==="replace"){
    const current=String(state?.programMeta?.name||"").trim()||t("untitled_program");
    const next=String(entryResultName()||entryState?.answers?.programName||"").trim()||t("untitled_program");
    return{titleId:"entryReplaceTitle",title:t("entry.replace_confirm.title"),
      body:t("entry.replace_confirm.body",{current,next}),actions:[
      {id:"entryReplaceConfirm",cls:"btn btn--cta btn--noarrow",label:t("entry.replace_confirm.confirm",{next}),run:()=>resolveEntryReplace(true)},
      {id:"entryReplaceCancel",cls:"btn btn--steel",label:t("entry.replace_confirm.cancel",{current}),run:()=>resolveEntryReplace(false)}]}}
  const resuming=entryUiNotice==="resume";
  const shared=!resuming&&entryState?.route==="shared";
  return{titleId:"entryRestartTitle",
    title:t(resuming?"entry.resume.discard_title":"entry.restart_confirm.title"),
    body:t(resuming?"entry.resume.discard_body":shared?"entry.restart_confirm.body_shared":"entry.restart_confirm.body"),actions:[
    {id:"entryRestartConfirm",cls:"btn btn--steel btn--destructive",label:t(resuming?"entry.resume.discard_confirm":"entry.restart_confirm.confirm"),run:()=>confirmEntryStartOver()},
    {id:"entryRestartCancel",cls:"btn btn--steel",label:t(resuming?"entry.resume.discard_cancel":"entry.restart_confirm.cancel"),run:()=>dismissEntryDialog()}]}}
/* Where focus returns: the control that was focused when the dialog opened,
   found again after any re-render, else the heading of whatever is showing. */
function entryOpenerToken(){
  const el=document.activeElement;
  if(!el||el===document.body||el.closest?.("#entryDialog"))return null;
  if(el.id)return{kind:"id",value:el.id};
  return entryFocusToken()}
function entryOpenerElement(){
  const token=entryDialogOpener;
  let el=null;
  if(token?.kind==="id")el=$("#"+CSS.escape(token.value));
  else if(token?.kind==="pick")el=$(`[data-entry-pick="${CSS.escape(token.key)}"][data-entry-val="${CSS.escape(token.val)}"]`);
  else if(token?.kind==="hub")el=$(`[data-entry-hub="${CSS.escape(token.value)}"]`);
  else if(token?.kind==="catalogue")el=$(`[data-entry-catalogue="${CSS.escape(token.value)}"]`);
  return el&&!el.disabled?el:($("#entryHeading")||$("#onbCancel"))}
/* Show, keep or remove the dialog for the current state. Called at the end of
   every render so the markup behind it and the dialog never disagree. */
function syncEntryDialog(){
  const kind=entryDialogKind();
  const el=$("#entryDialog");
  if(!kind){if(el?.open)closeModal(el);return}
  const dialog=el||entryDialogElement();
  if(dialog.open&&dialog.dataset.kind===kind)return;
  const spec=entryDialogSpec(kind);
  dialog.dataset.kind=kind;
  const title=dialog.querySelector(".entry-dialog__title");
  title.id=spec.titleId;title.textContent=spec.title;
  dialog.setAttribute("aria-labelledby",spec.titleId);
  const body=dialog.querySelector(".entry-dialog__body");
  body.textContent=spec.body;body.hidden=kind==="picker";
  const field=dialog.querySelector(".entry-dialog__field");
  field.hidden=kind!=="picker";
  field.innerHTML=kind==="picker"&&entryPickerInput
    ?`<label class="entry__field"><span>${esc(entryPickerInput.label)}</span><input id="entryPickerInput" class="entry__field-input" type="text" inputmode="${entryPickerInput.inputMode}" value="${esc(entryPickerInput.value)}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="entryPickerError"></label><p id="entryPickerError" class="entry-dialog__error" role="status" aria-live="polite" hidden></p>`
    :"";
  const typedInput=field.querySelector("#entryPickerInput");
  typedInput?.addEventListener("keydown",event=>{
    if(event.key==="Enter"){event.preventDefault();entryCommitPickerInput()}});
  const actions=dialog.querySelector(".entry-dialog__actions");
  actions.innerHTML=spec.actions.map(action=>`<button type="button" id="${action.id}" class="${action.cls}">${esc(action.label)}</button>`).join("");
  for(const action of spec.actions)actions.querySelector("#"+action.id).onclick=action.run;
  // The opener was noted before the render that replaced it; a dialog reached
  // some other way (browser Back) falls back to the heading.
  const opened=openModal(dialog,{returnFocus:()=>entryOpenerElement(),initialFocus:typedInput||title,onEscape:()=>dismissEntryDialog()});
  if(!opened&&!dialog.open)try{dialog.showModal()}catch{}}
function closeEntryDialog(){
  const el=$("#entryDialog");
  if(!el?.open)return;
  closeModal(el);
  if(el.open)try{el.close()}catch{}
  entryDialogOpener=null}
function dismissEntryDialog(){
  if(entryDialog==="review"){resolveEntryAdjustDialog(false);return}
  const resolve=entryReplaceResolve;
  entryReplaceResolve=null;
  if(entryUiNotice==="cancel")entryUiNotice=null;
  entryPickerInput=null;entryDialog=null;
  closeEntryDialog();
  if(resolve)resolve(false);
  renderOnboarding()}
function resolveEntryReplace(confirmed){
  const resolve=entryReplaceResolve;
  entryReplaceResolve=null;entryDialog=null;
  closeEntryDialog();
  // Confirming goes straight on to the activation, which renders its own outcome.
  if(!confirmed)renderOnboarding();
  resolve?.(confirmed)}
/* Replacing the active program asks first and says what happens to it. */
function entryConfirmReplaceIfNeeded(){
  if(!hasActiveProgram())return Promise.resolve(true);
  return new Promise(resolve=>{
    entryReplaceResolve?.(false);
    entryDialogOpener=entryOpenerToken();
    entryReplaceResolve=resolve;entryDialog="replace";renderOnboarding()})}
/* Start over discards the draft, so it is confirmed wherever it is offered. */
function requestEntryStartOver(){entryDialogOpener=entryOpenerToken();entryDialog="restart";renderOnboarding()}
function confirmEntryStartOver(){
  entryDialog=null;
  closeEntryDialog();
  entryStartOver()}
/* Rerendering a step must not strand keyboard users at the top of the page.
   Keep a small semantic token for the control that caused the update and restore
   that control after the HTML is replaced; a step transition intentionally moves
   focus to its heading instead. */
function entryFocusToken(){
  const el=document.activeElement;
  if(!el||!el.closest("#onbBody"))return null;
  if(el.id)return{kind:"id",value:el.id};
  if(el.dataset.entryPick)return{kind:"pick",key:el.dataset.entryPick,val:el.dataset.entryVal};
  if(el.dataset.entryHub)return{kind:"hub",value:el.dataset.entryHub};
  if(el.dataset.entryCatalogue)return{kind:"catalogue",value:el.dataset.entryCatalogue};
  return null;
}
function entryScreenKey(){
  // The cancel dialog sits over the screen it interrupts; it is not a screen.
  const notice=(entryUiNotice==="cancel"?null:entryUiNotice)||
    (entryValidationNotice?"validation":entryCompileError?(entryCompileError.code||"compile-error"):"");
  return [notice,entryState?.route||"",entryState?.step||""].join("|")}
function restoreEntryFocus(token){
  if(!token)return false;
  let el=null;
  if(token.kind==="id")el=$("#"+CSS.escape(token.value));
  else if(token.kind==="pick")el=$(`[data-entry-pick="${CSS.escape(token.key)}"][data-entry-val="${CSS.escape(token.val)}"]`);
  else if(token.kind==="hub")el=$(`[data-entry-hub="${CSS.escape(token.value)}"]`);
  else if(token.kind==="catalogue")el=$(`[data-entry-catalogue="${CSS.escape(token.value)}"]`);
  if(!el||el.disabled)return false;
  try{el.focus({preventScroll:true});return true}catch{try{el.focus();return true}catch{return false}}
}
function setupEntryRovingFocus(){
  // Radiogroups are composite widgets: one tab stop and arrow navigation.
  // Checkbox collections are ordinary independent controls; hiding all but one
  // from Tab would make keyboard users miss most available choices.
  const groups=$$("#onbBody [role='radiogroup']");
  for(const group of groups){
    const options=[...group.querySelectorAll("[role='radio']")].filter(el=>!el.disabled);
    if(!options.length)continue;
    const selected=options.find(el=>el.getAttribute("aria-checked")==="true");
    options.forEach((el,index)=>{el.tabIndex=el===selected||(!selected&&index===0)?0:-1});
    options.forEach((el,index)=>el.onkeydown=(event)=>{
      if(!["ArrowRight","ArrowDown","ArrowLeft","ArrowUp","Home","End"].includes(event.key))return;
      event.preventDefault();
      const delta=event.key==="ArrowLeft"||event.key==="ArrowUp"?-1:1;
      const next=event.key==="Home"?0:event.key==="End"?options.length-1:(index+delta+options.length)%options.length;
      options.forEach(option=>option.tabIndex=-1);
      options[next].tabIndex=0;options[next].focus({preventScroll:true});
      options[next].click();
    });
  }
}
/* The hub is also what a resumable draft opens on (Q633): the saved route and
   step are named on a card there, and nothing behind it is chosen until the
   lifter resumes or starts over. */
function entryHubMode(){
  return !entryState?.route||entryState.step==="entry"||entryUiNotice==="resume"}
/* Earlier answers, each one tap from being changed (G's answer rail). Question
   screens only: on a review a changed answer must recompile, which is not a
   jump, so the review has no rail. Browse's two questions need none. */
/* The about screen carries its goal as a band with Change, so it has no rail of its own. */
function entryWheel(...args){return EntryUi.renderWheel(...args)}
function entryQuestionModel(source=entryState){
  return{answers:source?.answers||{},basics:entryBasics(source),birth:entryBirthValue(source),birthYears:ENTRY_BIRTH_YEARS,
    monthNames:entryMonthNames(),heightUnit:entryHeightUnit(source),heightCm:entryHeightValue(source),weightUnit:entryWeightUnit(source),weightKg:entryWeightValue(source),
    environments:ENTRY_ENVIRONMENTS,muscles:ENTRY_B_MUSCLES,equipmentGroups:ProgramEntry.EQUIPMENT_GROUPS||[],presetEquipmentGroups:entryPresetGroups(source?.answers.environment?.kind),
    competencies:entryAbilityKeys(),sectionNames:ENTRY_B_SECTIONS.map(([name])=>name),priorityLimitShown:EntryUi.answerUi().priorityLimitShown,recommend:source?.route==="recommend"};
}
const ENTRY_B_RENDERERS=Object.freeze(Object.fromEntries(["intro","sex","birth_date","height","weight","background","cardio_experience","environment","equipment","desired_result","days_per_week","session_length","muscle_priorities","deload","abilities","building"]
  .map(step=>[step,(source=entryState)=>EntryUi.renderQuestion(step,entryQuestionModel(source))])));
function entryMotionRank(state){
  if(!state)return null;
  if(state.route==="recommend"){
    if(state.step==="entry")return-1;
    const index=ProgramEntry.ROUTE_STEPS.recommend.indexOf(state.step);
    return index>=0?index:null}
  return !state.route&&state.step==="entry"?-1:null}
function entryMotionDirection(from,to){
  if(setupEditorOpen||entryDialog||entryUiNotice==="resume")return null;
  const a=entryMotionRank(from),b=entryMotionRank(to);
  if(a==null||b==null||a===b)return null;
  return b>a?"in":"out"}
function entryMotionAvailable(){
  const motion=window.RepForgeMotion;
  return window.__repforgeBooted===true&&!!motion?.animatePush&&motion.available?.()===true&&motion.reducedMotion?.()!==true}
function entryStandaloneDisplay(){
  try{return window.matchMedia?.("(display-mode: standalone)")?.matches===true}catch{return false}}
function entryMotionLivePage(){
  const body=$("#onbBody");
  return body?.querySelector(":scope > .entry-motion-page:not([aria-hidden='true'])")||null}
function cloneEntryMotionPage(page){
  if(!page)return null;
  const copy=page.cloneNode(true);
  copy.id="onbBody";copy.classList.add("onb__body");
  copy.classList.remove("is-push-over","is-push-under","is-edge-swiping");
  copy.style.removeProperty("transform");
  copy.inert=true;copy.setAttribute("aria-hidden","true");copy.dataset.entryMotionCopy="true";
  return copy}
function removeEntryMotionUnder(){
  entryEdgeUnder?.remove();entryEdgeUnder=null;
  const body=$("#onbBody");
  if(!entryMotionRun&&!body?.querySelector(":scope > .entry-motion-page.is-push-over, :scope > .entry-motion-page.is-push-under"))
    body?.classList.remove("entry-motion-active")}
function disposeEntryEdgeSwipe(){
  const edge=entryEdgeSwipe;entryEdgeSwipe=null;
  if(!edge)return;
  edge.watch.disconnect();edge.registration.dispose();
  removeEntryMotionUnder()}
function clearEntryMotion(){
  disposeEntryEdgeSwipe();
  const run=entryMotionRun;entryMotionRun=null;
  run?.cancel?.();
  const cleanup=entryMotionCleanup;entryMotionCleanup=null;
  cleanup?.();
  const body=$("#onbBody");
  body?.querySelectorAll(":scope > .entry-motion-page").forEach(page=>{
    page.classList.remove("is-push-over","is-push-under","is-edge-swiping");
    if(page.dataset.entryMotionCopy==="true")page.remove()});
  body?.classList.remove("entry-motion-active")}
function entryMotionPageClasses(state,{hub=!state?.route||state.step==="entry"}={}){
  const step=hub?"entry":state.step;
  return `entry-body entry-body--${step}${hub?" entry-route--hub":` entry-route--${state.route}`} entry-motion-page`}
function entryMotionPage(state,html,options){
  const page=document.createElement("div");
  page.id="onbBody";
  page.className=entryMotionPageClasses(state,options);
  page.classList.add("onb__body");
  page.innerHTML=html;
  page.inert=true;page.setAttribute("aria-hidden","true");page.dataset.entryMotionCopy="true";
  return page}
function renderEntryMotionPage(source){
  if(!source?.route||source.step==="entry")return entryMotionPage(source,
    renderEntryHub({candidate:source,notice:null,choice:source?.route==="recommend"?"recommend":null}));
  if(source.route==="recommend"&&ENTRY_B_RENDERERS[source.step])return entryMotionPage(source,ENTRY_B_RENDERERS[source.step](source));
  // The previous page of Recommend's final result is a question. A result has
  // mounted review lifetimes, so it is never manufactured as an inert back page.
  return null;
}
function entryMotionPreviousState(){
  if(!entryState||entryHubMode()||!entryIsB())return null;
  const previous=ProgramEntry.back(entryState);
  return entryMotionRank(previous)==null?null:previous}
function mountEntryEdgeUnder(page){
  if(entryEdgeUnder)return;
  const body=$("#onbBody"),previous=entryMotionPreviousState();
  const under=previous&&renderEntryMotionPage(previous);
  if(!body||!under)return;
  under.classList.add("is-push-under");
  body.classList.add("entry-motion-active");body.append(under);
  entryEdgeUnder=under}
function syncEntryEdgeSwipe(){
  const page=entryMotionLivePage(),motion=window.RepForgeMotion;
  const eligible=page&&entryIsB()&&!entryHubMode()&&!entryMotionRun&&
    entryMotionRank(entryState)>-1&&motion?.registerEdgeSwipeBack&&motion.available?.()===true;
  const onboarding=$("#onboarding");
  onboarding?.classList.toggle("entry-edge-swipe-active",!!eligible&&entryStandaloneDisplay());
  if(entryEdgeSwipe?.page===page&&eligible)return;
  disposeEntryEdgeSwipe();
  if(!eligible)return;
  const registration=motion.registerEdgeSwipeBack({page,onCommit:()=>{
    entrySwipeCommitting=true;
    try{releaseSwallowedClick();$("#onbBack")?.click()}finally{entrySwipeCommitting=false}}});
  if(!registration)return;
  const watch=new MutationObserver(()=>{
    if(page.classList.contains("is-edge-swiping"))mountEntryEdgeUnder(page);
    else removeEntryMotionUnder()});
  watch.observe(page,{attributes:true,attributeFilter:["class"]});
  entryEdgeSwipe={page,registration,watch}}
function startEntryPageTransition({direction,outgoing}){
  const body=$("#onbBody"),live=entryMotionLivePage(),motion=window.RepForgeMotion;
  if(!body||!live||!outgoing||!entryMotionAvailable()){
    outgoing?.remove();syncEntryEdgeSwipe();return}
  disposeEntryEdgeSwipe();
  const pushed=direction==="in"?live:outgoing;
  const under=direction==="in"?outgoing:live;
  body.classList.add("entry-motion-active");
  under.classList.add("is-push-under");
  pushed.classList.add("is-push-over");
  if(direction==="in")body.append(outgoing);else body.append(outgoing);
  let run;
  const cleanup=()=>{
    outgoing.remove();live.classList.remove("is-push-under","is-push-over");
    body.classList.remove("entry-motion-active");
    if(entryMotionCleanup===cleanup)entryMotionCleanup=null};
  entryMotionCleanup=cleanup;
  run=motion.animatePush(pushed,{direction});
  entryMotionRun=run;
  Promise.resolve(run).then(()=>{
    if(entryMotionRun!==run)return;
    entryMotionRun=null;cleanup();syncEntryEdgeSwipe()})}
function startEntryEdgeSwipeSync(){
  if(entryMotionRun)return;
  syncEntryEdgeSwipe()}
const ENTRY_RAIL_STEPS=["desired_result","schedule","environment","priorities","exercise_preferences","custom_shape"];
function renderEntryRail(){
  const route=entryState?.route,stepId=entryState?.step;
  if(!route||route==="browse"||route==="recommend"||!ENTRY_RAIL_STEPS.includes(stepId))return"";
  const steps=ProgramEntry.ROUTE_STEPS[route]||[];
  const index=steps.indexOf(stepId);
  const a=entryState.answers||{};
  const chips=[];
  const add=(target,what,text)=>{
    if(!text||steps.indexOf(target)<0||steps.indexOf(target)>=index)return;
    chips.push(`<button type="button" class="entry-rail__chip" data-entry-rail="${target}" aria-label="${esc(t("entry.rail.edit",{what}))}: ${esc(text)}">`+
      `<span class="entry-rail__text">${esc(text)}</span><span class="entry-rail__edit icon-mask icon-mask--pencil icon-mask--sm" aria-hidden="true"></span></button>`)};
  if(a.desiredResult)add("desired_result",t("entry.rail.what.goal"),t(`entry.goal.${a.desiredResult}`));
  if(a.structuredExperience)add("background",t("entry.rail.what.background"),t(`entry.lifting.${a.structuredExperience}`));
  if(a.daysPerWeek&&a.sessionMinutes)add("schedule",t("entry.rail.what.schedule"),
    t("entry.rail.schedule",{days:a.daysPerWeek,minutes:a.sessionMinutes}));
  if(a.environment?.kind)add("environment",t("entry.rail.what.environment"),entryEnvironmentLabel());
  return chips.length?`<div class="entry-rail" role="group" aria-label="${esc(t("entry.rail.label"))}">${chips.join("")}</div>`:""}
/* The rail sits under the screen's title and lede, never above it: the title keeps its place at every
   width and text size, and the rail is the answers-so-far line that leads into the question. */
function entryRailAfterTitle(stepHtml,rail){
  if(!rail)return stepHtml;
  const head=stepHtml.match(/^<h[12][^>]*>[\s\S]*?<\/h[12]>(?:<p class="onb__explain">[\s\S]*?<\/p>)?/);
  return head?head[0]+rail+stepHtml.slice(head[0].length):rail+stepHtml}
function renderOnboarding({pageTransition=null}={}){
  if(!pageTransition)clearEntryMotion();
  const body=$("#onbBody"),title=$("#onbTitle"),step=$("#onbStepLabel"),back=$("#onbBack"),next=$("#onbNext");
  if(!body||!ProgramEntry||!entryState)return;
  entryPickers.dispose();
  const focusToken=entryFocusToken();
  const headerFocus=document.activeElement?.closest?.(".onb__bar")?document.activeElement.id:"";
  const onboarding=$("#onboarding");
  const screenKey=entryScreenKey();
  const sameScreen=screenKey===entryVisibleScreenKey;
  const environmentCorrectionOpen=sameScreen&&body.querySelector(".entry__correct")?.open===true;
  if(onboarding&&!sameScreen){
    onboarding.scrollTo?.({top:0,left:0,behavior:"auto"});
    onboarding.scrollTop=0;onboarding.scrollLeft=0;
  }
  entryVisibleScreenKey=screenKey;
  const hub=entryHubMode();
  const resuming=entryUiNotice==="resume";
  const route=hub?null:entryState.route,stepId=hub?"entry":entryState.step;
  observeEntryStep(route,stepId);
  const dialogOpen=!!entryDialogKind();
  const isEditor=setupEditorOpen&&!hub&&!!entryState?.result?.preview;
  const wasEditor=!!onboarding?.classList.contains("program-editor-onboarding");
  onboarding?.classList.toggle("entry-hub-active",hub);
  onboarding?.classList.toggle("program-editor-onboarding",isEditor);
  document.body.classList.toggle("is-entry-editor",isEditor);
  /* On a single-step route the chrome eyebrow and the page heading are the
     same string ("Import a program" twice, 60px apart). Show one of them. */
  const bSection=entryIsB()?entryBSection(stepId):null;
  const eyebrowText=bSection?t(`entry.section.${bSection.name}`):route?entryRouteLabel(route):t("entry.eyebrow");
  const titleText=isEditor?t("entry.build_editor_title"):t(route?`entry.${stepId}.title`:"entry.hub.title")||t("entry.eyebrow");
  const eyebrow=$("#onbEyebrow");
  if(eyebrow){const duplicate=eyebrowText===titleText;
    eyebrow.textContent=duplicate?"":eyebrowText;
    eyebrow.classList.toggle("hidden",duplicate)}
  title.textContent=titleText;
  const editorTitle=$("#onbEditorTitle");
  if(editorTitle){editorTitle.textContent=isEditor?titleText:"";editorTitle.hidden=!isEditor}
  const progress=entryProgressSections(route);
  const showProgress=Boolean(route)&&progress.show;
  /* #onbStepLabel is a live region: rewriting it with the same text re-announces it
     on every answer, so it is written only when the section changes (R7 J-12). */
  if(step){const stepText=showProgress?t("entry.step",{n:progress.n,total:progress.total}):"";
    if(step.textContent!==stepText)step.textContent=stepText;
    step.classList.toggle("hidden",!showProgress)}
  const seg=$("#onbSegbar");
  if(seg){const total=showProgress?progress.total:0,current=progress.n-1;
    seg.innerHTML=Array.from({length:total},(_,i)=>`<span class="segbar__seg${i<=current?" is-current":""}${i<current?" is-done":""}"></span>`).join("");
    seg.classList.toggle("hidden",!showProgress)}
  const cancel=$("#onbCancel");if(cancel)cancel.textContent=t("entry.cancel");
  const skipButton=$("#onbSkip");
  if(skipButton){skipButton.textContent=t("entry.skip");skipButton.hidden=!entrySkippable(stepId)||hub||isEditor||dialogOpen}
  /* The pinned region holds the one primary action. It is out of the way while
     the hub is up, an editor owns the screen, or a dialog is asking something. */
  const hideNext=(hub&&resuming)||stepId==="building"||stepId==="preview"||stepId==="result"||stepId==="catalogue"||stepId==="import_source"||stepId==="activation_conflict";
  const nav=$("#onboarding .onb__nav");if(nav)nav.classList.toggle("hidden",hideNext||isEditor||dialogOpen);
  if(back){back.classList.toggle("hidden",hub||isEditor);back.textContent=t("entry.back");back.setAttribute("aria-label",t("entry.back"))}
  const reason=$("#onbNextReason");
  if(next){
    next.classList.toggle("hidden",hideNext||isEditor);
    next.textContent=stepId==="build_setup"?t("entry.build_setup.open"):
      entryIsB()&&stepId==="intro"?t("entry.intro.start"):
      stepId==="custom_shape"?t("entry.custom_shape.generate"):t("entry.next");
    const pendingReason=stepId==="exercise_preferences"&&EntryUi.answerUi().pendingAvoid;
    const needsChoice=!hideNext&&!isEditor&&entryNeedsChoice(stepId);
    const blocked=!hideNext&&!isEditor&&(needsChoice||!hub&&ProgramEntry.validationIssues(entryState).length>0);
    next.disabled=!!pendingReason||blocked;
    if(entryResultJob)next.setAttribute("aria-busy","true");else next.removeAttribute("aria-busy");
    /* A blocked primary says why, in text above it, and drops its arrow. */
    const showReason=blocked&&!pendingReason;
    if(reason){reason.hidden=!showReason;reason.textContent=showReason?t(stepId==="build_setup"?"entry.pinned.reason_name":needsChoice?"entry.required":"entry.pinned.reason"):""}
    next.classList.toggle("btn--noarrow",next.disabled);
    if(pendingReason)next.setAttribute("aria-describedby","entryPendingAvoidNote");
    else if(showReason)next.setAttribute("aria-describedby","onbNextReason");
    else next.removeAttribute("aria-describedby")}
  let html=`<span id="entryChoiceDisabledNote" class="visually-hidden">${esc(t("entry.choice.disabled"))}</span>`+
    (entryValidationNotice?`<div id="entryValidation" class="entry__notice entry__notice--error" role="alert" aria-live="assertive" tabindex="-1"><strong>${esc(t("entry.validation.title"))}</strong><p>${esc(t("entry.validation.body"))}</p></div>`:"")+renderEntryNotice();
  const rail=!hub&&!isEditor?renderEntryRail():"";
  const bStep=entryIsB()&&ENTRY_B_RENDERERS[stepId];
  if(hub)html+=renderEntryHub();
  else if(bStep)html+=bStep();
  else if(stepId==="desired_result")html+=entryRailAfterTitle(renderDesiredResultStep(),rail);
  else if(stepId==="background")html+=entryRailAfterTitle(renderBackgroundStep(),rail);
  else if(stepId==="schedule")html+=entryRailAfterTitle(renderScheduleStep(),rail);
  else if(stepId==="environment")html+=entryRailAfterTitle(renderEnvironmentStep(),rail);
  else if(stepId==="abilities")html+=entryRailAfterTitle(renderAbilitiesStep(),rail);
  else if(stepId==="priorities")html+=entryRailAfterTitle(renderPrioritiesStep(),rail);
  else if(stepId==="exercise_preferences")html+=entryRailAfterTitle(renderExercisePreferencesStep(),rail);
  else if(stepId==="custom_shape")html+=entryRailAfterTitle(renderCustomShapeStep(),rail);
  else if((stepId==="result"||stepId==="activation_conflict"&&entryAdjustRoute())&&!isEditor)html+=renderResultStep();
  else if(stepId==="catalogue")html+=renderCatalogueStep();
  else if(stepId==="build_setup")html+=renderBuildSetupStep();
  else if(stepId==="import_source")html+=renderImportSourceStep();
  else if(isEditor)html+=`<div id="onbProgramEditor" class="program-editor-host ph-no-capture" data-role="onboarding-editor-host"></div>`+
    `<div class="program-editor-onboarding-actions">`+
      `<button type="button" class="btn btn--steel program-editor__save" id="entryEditorSave">${esc(t("entry.editor.save"))}</button>`+
      `<button type="button" class="btn btn--cta program-editor__activate" id="entryEditorActivate">${esc(t("entry.editor.use",undefined,"Use this program"))}</button>`+
    `</div>`;
  else if(stepId==="preview"&&route==="shared")html+=renderSharedReviewStep();
  else if(stepId==="preview"||stepId==="activation_conflict")html+=renderPreviewStep();
  else html+=renderEntryHub();
  body.className=`onb__body entry-body entry-body--${stepId}${route?` entry-route--${route}`:" entry-route--hub"}`;
  entryAdjustMount?.dispose();entryAdjustMount=null;
  const motionPageState=!isEditor&&!dialogOpen&&(hub||entryIsB()&&(bStep||stepId==="result"))?entryState:null;
  if(motionPageState){
    const live=document.createElement("div");
    live.className=entryMotionPageClasses(motionPageState,{hub});
    live.dataset.entryMotionKey=hub?"hub":`${motionPageState.route}|${motionPageState.step}`;
    live.innerHTML=html;body.replaceChildren(live)}
  else body.innerHTML=html;
  if((stepId==="result"||stepId==="activation_conflict")&&!isEditor||stepId==="preview"&&route==="shared")mountEntryAdjust();
  if(stepId==="result"&&!isEditor)playEntryBuild(body);
  const environmentCorrection=body.querySelector(".entry__correct");
  if(environmentCorrectionOpen&&environmentCorrection)environmentCorrection.open=true;
  const validation=$("#entryValidation");
  if(validation){
    const lede=body.querySelector(".onb__explain"),heading=body.querySelector(".onb__q");
    const anchor=lede||heading;
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(validation,anchor.nextSibling);
  }
  wireEntryDom();
  if(isEditor){
    mountOnboardingProgramEditor();
    updateOnboardingEditorActions();
  }
  setupEntryRovingFocus();
  if(!dialogOpen){
    if(!restoreEntryFocus(focusToken)){
      const header=headerFocus&&sameScreen?$("#"+CSS.escape(headerFocus)):null;
      if(header&&!header.classList.contains("hidden")&&canTakeFocus(header))try{header.focus({preventScroll:true})}catch{}
      else{
        const initialPreviewIssue=(stepId==="preview"||stepId==="activation_conflict")&&(entryPreviewHasProgressionIssue()||entryNeedsMetricConfiguration());
        const target=resuming?$("#entryResumeTitle"):initialPreviewIssue?$("#entryActivationStatus"):$("#entryHeading");
        if(target)try{target.focus({preventScroll:true})}catch{}
        // The editor has no #entryHeading: on the render that opens it, focus takes its title (R7 J-05).
        else if(isEditor&&!wasEditor)focusRoute($("#onbEditorTitle"))}}
    if(entryValidationNotice){const alert=$("#entryValidation");if(alert)try{alert.focus({preventScroll:true})}catch{}}}
  // The "entry" guide explains the five-job chooser, so it shows here rather
  // than on the landing that opens it. Not while a saved draft is asking first.
  if(hub&&!resuming)queueMicrotask(()=>maybeShowContextualGuides(["entry"]));
  syncEntryDialog();
  if(pageTransition)startEntryPageTransition(pageTransition);else startEntryEdgeSwipeSync()}
/** O3: draw the generated program in reading order, one block every 55ms
 *  (`.motion-build > .motion-build-item`, `--build-i` counting from zero): the
 *  name, where it came from, the four facts, what just changed, the week's
 *  heading and then each day. The answers, the reasons and every control stay
 *  out of it, so nothing a lifter can press is held back or disabled. The
 *  classes come off when the last block lands, and a render that follows draws
 *  the program at rest. Reduced motion draws it all at once with no classes. */
function playEntryBuild(body){
  const armed=entryBuildArmed;entryBuildArmed=null;
  const result=entryState?.result;
  if(!armed||!result?.fingerprint||armed.draftId!==entryState.draftId||armed.fingerprint!==result.fingerprint||!beatsOn())return;
  const review=body.querySelector("#entryReview .review"),panel=review?.querySelector(":scope > .review__panel");
  if(!review||!panel)return;
  // Nothing a lifter can press is part of the build (the title is a rename
  // control, the day head holds the day's actions): only the blocks they read.
  const still=el=>!el.matches(".visually-hidden,button,[role=tablist]")&&!el.querySelector("button");
  const lead=[...review.children].filter(el=>el!==panel&&still(el));
  const items=[...lead,...[...panel.children].filter(still)];
  items.forEach((el,i)=>{el.classList.add("motion-build-item");el.style.setProperty("--build-i",String(i))});
  const hosts=[review,panel].filter(el=>el.querySelector(":scope > .motion-build-item"));
  hosts.forEach(el=>el.classList.add("motion-build"));
  let left=items.length;
  const settle=()=>{if(--left>0)return;
    hosts.forEach(el=>el.classList.remove("motion-build"));
    items.forEach(el=>{el.classList.remove("motion-build-item");el.style.removeProperty("--build-i")})};
  items.forEach(el=>{el.addEventListener("animationend",settle,{once:true});el.addEventListener("animationcancel",settle,{once:true})});
  // A block the page never animates (hidden at this width) would never report back.
  setTimeout(()=>{left=1;settle()},55*items.length+1000)}
function wireEntryDom(){
  /* While a saved draft is waiting on Resume or Start over, the doors are
     inert. The markup already carries `inert`; this keeps a synthetic click
     from reaching a handler that would overwrite the draft. */
  const doorsWait=()=>entryUiNotice==="resume";
  EntryUi.bind();
  EntryUi.bindHub(doorsWait());
  const skipButton=$("#onbSkip");
  if(skipButton)skipButton.onclick=()=>entrySkip();
  mountEntryPickers();
  mountEntryBuilding();
  $$("[data-entry-rail]").forEach(btn=>btn.onclick=()=>entrySetState({...entryState,step:btn.dataset.entryRail}));
  EntryUi.bindAnswerFields(document.querySelector("#onbBody"),EntryLiveAnswerCommands);
  const changePriorities=$("[data-entry-action='change-priorities']");if(changePriorities)changePriorities.onclick=()=>{
    entryCompileError=null;entrySetState({...entryState,step:"priorities",result:null})};
  const changeExercisePreferences=$("[data-entry-action='change-exercise-preferences']");if(changeExercisePreferences)changeExercisePreferences.onclick=()=>{
    entryCompileError=null;entrySetState({...entryState,step:"exercise_preferences",result:null})};
  const conflictBack=$("[data-entry-action='conflict-back']");if(conflictBack)conflictBack.onclick=()=>{
    entryCompileError=null;entrySetState({...entryState,step:conflictBack.dataset.entryStep,result:null})};
  const changeSchedule=$("[data-entry-action='change-schedule']");if(changeSchedule)changeSchedule.onclick=()=>{
    const answers={...entryState.answers};delete answers.splitPreference;
    entryCompileError=null;entrySetState({...entryState,step:"schedule",result:null,answers})};
  const chooseAlternative=$("[data-entry-select-alternative]");if(chooseAlternative)chooseAlternative.onclick=()=>guardEntryRebuild(()=>{
    const alternative=entryState?.result?.alternative;
    if(!alternative)return;
    clearEntryAdjust();
    const selected={};
    for(const key of ["id","family","familyId","name","namePt","daysPerWeek","blueprintId","split","complexity","reentry","source"]){
      if(Object.prototype.hasOwnProperty.call(alternative,key))selected[key]=alternative[key]}
    entryPinnedVersionsExecutable=false;
    entrySetState(ProgramEntry.setResult(entryState,{
      ...entryState.result,
      fingerprint:alternative.fingerprint,
      name:alternative.name,
      namePt:alternative.namePt,
      selected,
      candidates:[selected],
      alternative:null,
      preview:alternative.preview}))});
  $$("[data-entry-catalogue]").forEach(btn=>btn.onclick=()=>{
    const id=btn.dataset.entryCatalogue;
    const card=(entryServices()?.browseCatalogue(entryState.answers)||[]).find(item=>item.id===id);
    if(!card)return;
    if(!entryState.answers.catalogueSelection)captureEvent("template_selected",{family:card.telemetryFamily});
    let next=ProgramEntry.setAnswers(entryState,{catalogueSelection:id});
    next={...next,versions:entryVersions()};
    next=ProgramEntry.setResult(next,{
      fingerprint:card.fingerprint,
      name:card.name,
      namePt:card.namePt,
      selected:{id:card.id,familyId:card.familyId,daysPerWeek:card.daysPerWeek,blueprintId:card.id},
      preview:card.preview,
      telemetry:{family:card.telemetryFamily}});
    entrySetState(ProgramEntry.advance(next).state)});
  const importPick=$("#entryImportPick");if(importPick)importPick.onclick=()=>{$("#importProgram")?.click()};
  const nameInput=$("#entryProgramName");if(nameInput){
    const sync=()=>{
      const value=nameInput.value.trim();
      if(value)publishEntryDraft(ProgramEntry.setAnswers(entryState,{programName:value}));
      else{
        const answers={...entryState.answers};delete answers.programName;
        publishEntryDraft({...entryState,answers,result:null})}
      persistSetupDraft(entryState);
      const next=$("#onbNext");if(next)next.disabled=ProgramEntry.validationIssues(entryState).length>0};
    nameInput.oninput=sync;nameInput.onchange=sync;nameInput.onblur=sync}
  const activate=$("#entryActivate");if(activate)activate.onclick=()=>activateEntryPreview();
  const editorSave=$("#entryEditorSave");if(editorSave)editorSave.onclick=async()=>{
    editorSave.disabled=true;
    const result=await persistSetupDraft(entryState);
    editorSave.disabled=false;
    const status=$("#onbProgramEditor [data-role=\"editor-status\"]")||$("#entryEditorStatus");
    if(result?.ok){
      updateOnboardingEditorActions();
      // Saving an otherwise incomplete Build is still a successful draft
      // write. Keep the saved state visible beside the editor, rather than
      // replacing it with the activation validation message.
      if(status){status.textContent=t("entry.editor.saved");status.hidden=false;status.classList.remove("is-error");status.setAttribute("role","status");status.setAttribute("aria-live","polite")}
      toast(t("entry.editor.saved"));
    }else if(status){status.textContent=t(result?.conflict?"entry.save_conflict.body":"entry.save_failed.body");status.hidden=false;status.classList.add("is-error");status.focus?.()}
  };
  const editorActivate=$("#entryEditorActivate");if(editorActivate)editorActivate.onclick=()=>activateEntryPreview();
  const edit=$("#entryEdit");if(edit)edit.onclick=()=>openEntryDraftEditor();
  const restart=$("#entryRestart");if(restart)restart.onclick=()=>requestEntryStartOver();
  const resumeContinue=$("#entryResumeContinue");if(resumeContinue)resumeContinue.onclick=()=>{
    entryUiNotice=null;
    if(entryState.step==="editor")openEntryDraftEditor();else renderOnboarding()};
  const resumeRestart=$("#entryResumeRestart");if(resumeRestart)resumeRestart.onclick=()=>requestEntryStartOver();
  const rebuild=$("#entryRebuildRules");if(rebuild)rebuild.onclick=()=>rebuildEntryForCurrentRules();
  const keepPinned=$("#entryKeepPinned");if(keepPinned)keepPinned.onclick=()=>{
    if(!entryPinnedPreviewCanActivate())return;
    entryPinnedVersionsExecutable=true;
    entryUiNotice=null;
    renderOnboarding()};
  const conflict=$("#entryConflictReview");if(conflict)conflict.onclick=()=>{
  entryUiNotice=null;
    entryPinnedVersionsExecutable=false;
    entryDurableConflictNeedsReload=false;
    entrySetState({...entryState,step:ProgramEntry.reviewStep(entryState.route),activeProgramRevisionAtStart:liveProgramRevision()})};
  const durableConflict=$("#entryDurableConflictReview");if(durableConflict)durableConflict.onclick=async()=>{
    durableConflict.disabled=true;
    if(entryDurableConflictNeedsReload){window.location.reload();return}
    if(entryState?.step==="activation_conflict"){
      entryUiNotice=null;
      entrySetState({...entryState,step:ProgramEntry.reviewStep(entryState.route),activeProgramRevisionAtStart:liveProgramRevision()});
      return;
    }
    const recovered=await recoverEntryDurableConflict();
    entryDurableConflictNeedsReload=!recovered.ok;
    entryUiNotice=recovered.ok?"conflict":"durable_conflict";
    renderOnboarding()};
  wireEntryAnswerControls()}
/* Recommend, Custom and Browse answer controls: the answer chips and their
   editors, Restore, Skip and the "about" screen's goal. Everything here is bound
   after the shared handlers, so an editor's controls can be wrapped. */
function wireEntryAnswerControls(){
  if(!entryState)return;
  if(entryState.step!=="background")entryGoalOpen=false;
  if(entryEditor&&(entryState.step!=="result"||entryEditor.draftId!==entryState.draftId))entryEditor=null;
  $$("[data-entry-chip]").forEach(btn=>btn.onclick=()=>openEntryEditor(btn.dataset.entryChip));
  $$("[data-entry-restore]").forEach(btn=>btn.onclick=()=>guardEntryRebuild(()=>restoreEntryConstraint(btn.dataset.entryRestore)));
  const apply=$("#entryChipApply");if(apply)apply.onclick=()=>guardEntryRebuild(()=>applyEntryEditor());
  const keep=$("#entryChipKeep");if(keep)keep.onclick=()=>closeEntryEditor();
  const editor=$("#entryEditor");
  if(editor&&entryEditor){
    const target=entryEditor;
    const commands=createEntryAnswerCommands({read:()=>entryEditor===target?target.draft:null,apply:patch=>{
      if(entryEditor!==target)return;target.draft=ProgramEntry.setAnswers(target.draft,patch);target.error=null;renderOnboarding();
    },vocabulary:entryAnswerVocabulary(),presetEquipmentGroups:entryPresetGroups});
    EntryUi.bindAnswerFields(editor,commands);
    editor.onkeydown=event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();closeEntryEditor()}};
    if(apply)apply.onclick=()=>guardEntryRebuild(()=>applyEntryEditor());
    if(keep)keep.onclick=()=>closeEntryEditor()}
  const goalChange=$("#entryGoalChange");
  if(goalChange)goalChange.onclick=()=>{
    entryGoalOpen=true;renderOnboarding();
    try{($('[data-entry-pick="desiredResult"][aria-checked="true"]')||$('[data-entry-pick="desiredResult"]'))?.focus({preventScroll:true})}catch{}};
  const skip=$("#entrySkip");
  if(skip)skip.onclick=()=>{
    if(!entryPrioritiesEmpty())return;
    publishEntryDraft(ProgramEntry.setAnswers(entryState,{primaryMuscles:[],priorityMovements:[],exerciseConstraints:[]}));
    entryAdvance()};
  const abilitiesSkip=$("#entryAbilitiesSkip");
  if(abilitiesSkip)abilitiesSkip.onclick=()=>{
    publishEntryDraft(ProgramEntry.setAnswers(entryState,{competencyAnswers:{}}));
    entryAdvance()};
  // Recommend's last question hands over to the program itself.
  const next=$("#onbNext");
  if(next&&entryState.route==="recommend"&&entryState.step==="priorities")next.textContent=t("entry.priorities.show")}
function entryStartOver(){
  const restarted=ProgramEntry.startOver({
    draftId:uid(),activeProgramRevisionAtStart:liveProgramRevision(),now:entryNow(),versions:entryVersions()});
  if(restarted.effects?.deleteSetupDraft)clearSetupDraft();
  entryUiNotice=null;entryCompileError=null;EntryUi.clearExerciseSearch();entryPinnedVersionsExecutable=false;
  reportEntryExit("start_over");
  entrySetState(restarted.state,{persist:true})}
async function recoverEntryDurableConflict(){
  const refreshed=await refreshPersistenceHead();
  const head=refreshed?.head;
  if(refreshed?.conflict||!head)return{ok:false,conflict:true};
  const currentRevision=readRevision(state),headRevision=readRevision(head);
  if(headRevision<=currentRevision)return{ok:false,conflict:headRevision<currentRevision};
  const liveBase=cloneSnapshot(state);
  applyAcceptedSnapshot(liveBase,head);
  if(entryState){
    publishEntryDraft({...entryState,step:"activation_conflict",activeProgramRevisionAtStart:headRevision});
    const saved=await persistSetupDraft(entryState);
    if(!saved?.ok)return{ok:false,conflict:true,saveConflict:true};
  }
  return{ok:true,revision:headRevision};
}
async function surfaceEntryDurableConflict(){
  const recovered=await recoverEntryDurableConflict();
  entryDurableConflictNeedsReload=!recovered.ok;
  entryUiNotice="durable_conflict";
  renderOnboarding();
  return recovered;
}
function entryAdvance(){
  if(!ProgramEntry||!entryState||entryResultJob)return;
  if(entryHubMode()){entryChooseHubRoute();return}
  entryGoalOpen=false;
  if(entryIsB()){entryCommitPicker(entryState.step);entryApplyShownDefaults(entryState.step);EntryUi.clearPriorityLimit()}
  if(entryState.step==="build_setup"){
    const nameInput=$("#entryProgramName");
    if(nameInput)publishEntryDraft(ProgramEntry.setAnswers(entryState,{programName:nameInput.value.trim()}));
  }
  if(entryState.step==="priorities"||entryState.step==="custom_shape"){
    // optional fields already stored
  }
  const issues=ProgramEntry.validationIssues(entryState);
  if(issues.length){entryValidationNotice=true;renderOnboarding();return}
  if(entryState.step==="build_setup"){
    const built=entryServices()?.buildEmptyProgram(entryState.answers);
    if(!built?.ok){entryCompileError=built?.code||"build_failed";renderOnboarding();return}
    let buildNext=ProgramEntry.setResult(entryState,{
      fingerprint:built.fingerprint,
      selected:{id:"manual_build",source:"manual_build"},
      preview:built.preview,
      name:built.name});
    buildNext=ProgramEntry.advance(buildNext).state;
    entrySetState(buildNext);
    return openEntryDraftEditor()}
  const advanced=entryQuestionFlow().advance(entryState);
  if(!advanced.ok){renderOnboarding();return}
  const nextState=advanced.state;
  if(nextState.step==="result"&&!nextState.result?.preview){startEntryResult(nextState);return}
  entrySetState(nextState)}
function entryBack(){
  if(!ProgramEntry||!entryState)return;
  if(entryDialog||entryUiNotice==="cancel"){dismissEntryDialog();return}
  if(setupEditorOpen){requestEntryCancel();return}
  if(entryUiNotice==="resume"||entryState.step==="entry"||!entryState.route){requestEntryCancel();return}
  // An open answer editor closes first; Back then leaves the review as before.
  if(entryEditor){closeEntryEditor();return}
  entryGoalOpen=false;
  if(entryState.step==="result"&&entryState.result?.preview)entryLastPreview={draftId:entryState.draftId,preview:entryState.result.preview};
  if(entryGoalFromHub&&entryState.route==="recommend"&&entryState.step==="background"){
    entryGoalFromHub=false;
    entrySetState(ProgramEntry.back(ProgramEntry.back(entryState)));
    return}
  const previous=entryQuestionFlow().back(entryState);
  if(entryState.route==="shared"&&entryState.step==="preview"&&previous.step==="shared_review"){
    // Plan 072 §7 keeps the received-link confirmation gate as this route's
    // prior step. Reuse that gate and its in-memory proposal; never fall back
    // to the unrelated entry hub or persist the received payload here.
    publishEntryDraft(previous);
    syncEntryHistory();
    observeEntryStep(previous.route,previous.step);
    closeOnboarding();
    openFirstRun("shared");
    return}
  entrySetState(previous)}
function onEntryPopState(){
  if(InstalledEditorView.onPopState())return;
  if(!$("#onboarding")?.classList.contains("active")||!entryState)return;
  try{history.pushState(entryHistoryState(true),"",location.href)}catch{}
  entryBack()}
async function activateEntryPreview({destination="log",manualBuild=false,skipReplaceConfirm=false,io=storageIO}={}){
  if(!ProgramEntry||!entryState)return;
  await EntryDraft.flush();
  const activationDraftHandle=EntryDraft.handle();
  // A previous attempt may already have committed the exact draft and then
  // failed only while consuming this separate setup record. Treat that receipt
  // as success and retry only the CAS cleanup; never mint a second program.
  if(setupActivationAlreadyCommittedToLive(activationDraftHandle?.raw)){
    const settled=await DurableState.settleCommittedSetupActivation(activationDraftHandle.raw);
    if(settled?.committed===true&&settled?.settled===true)
      return finishAlreadyCommittedSetup(activationDraftHandle);
    return settled}
  const readiness=ProgramEntry.activationReadiness(entryState,{
    liveActiveProgramRevision:liveProgramRevision(),
    currentVersions:entryVersions(),
    pinnedVersionsExecutable:entryPinnedVersionsExecutable});
  if(!readiness.ok){
    if(readiness.code==="active_program_changed"){
      reportActivationFailed("durable_conflict");
      entryUiNotice="conflict";
      entrySetState(readiness.state||{...entryState,step:"activation_conflict"});
      return}
    if(readiness.code==="rules_changed_rebuild_required"){entryUiNotice="rules_changed";renderOnboarding();return}
    if(readiness.code==="candidate_incomplete"){
      if(setupEditorOpen){renderOnboarding();$("#onbProgramEditor [data-role=\"editor-status\"]")?.focus?.()}
      else {renderOnboarding();$("#entryActivationStatus")?.focus?.()}
      return readiness}
    renderOnboarding();return}
  // Plan 069 S4: "Use this program" is a commit point for Suggest loads. An
  // incomplete opt-in is refused at its own field before anything else asks.
  if(entryState.route==="build"){
    const optIn=onboardingProgramEditor?.checkSuggestLoads?.();
    if(optIn&&!optIn.ok)return optIn}
  if(!skipReplaceConfirm&&!(await entryConfirmReplaceIfNeeded()))return{cancelled:true};
  const prepared=EntryActivation.candidate({draft:entryState,head:state,name:entryResultName()||entryState.answers.programName||"",hasWorkoutDraft:!!readDraftRaw()});
  if(!prepared.ok){
    reportActivationFailed("definition_invalid");
    if(prepared.code==="program-definition-required")toast(t("entry.issue.compile"),{assertive:true});
    renderOnboarding();return{invalid:true,code:prepared.code}}
  const result=await finalizeProgramSetup({...prepared.value,destination,origin:onboardingOrigin||"first-run",io,
    expectedSetupDraftRaw:activationDraftHandle?.raw??null,reviewChanges:entryReviewChanges()});
  if(result?.setupDraftConflict){
    reportActivationFailed("setup_conflict");
    entryUiNotice="save_conflict";
    renderOnboarding();
    return result}
  if(result?.staleRevision||result?.conflict||result?.duplicate||result?.ineligible){
    reportActivationFailed("durable_conflict");
    await surfaceEntryDurableConflict();
    return result}
  if(result?.committed===true&&result?.settled===true){
    const cleanup=await removeSetupDraftIfCurrent(activationDraftHandle);
    if(cleanup?.writeFailed)toast(t("entry.save_failed.body"));
    entryDurableConflictNeedsReload=false;
    publishEntryDraft(null);
    return result}
  return result}
function telemetryGeneratedProgram(goal){
  if(goal==="beginner_consistency")return{goal:"muscle_growth",family:"foundation"};
  if(goal==="strength_hypertrophy")return{goal:"balanced",family:"legacy"};
  if(goal==="hypertrophy")return{goal:"muscle_growth",family:"legacy"};
  return null}
async function finalizeProgramSetup({exercises,name,answers,destination,origin,io,draftConfirmed=false,discardDraftRaw,baseProposal=null,telemetryRoute="custom",entryTelemetry=null,entrySource=null,programStructure=null,programDefinition=null,expectedSetupDraftRaw=undefined,replace=false,expectedFirstRunEmpty=false,compilerContext=null,reviewChanges=null}={}){
  const adapter=requireAdapter(io||storageIO,"finalizeProgramSetup");
  const originEff=origin||onboardingOrigin||"first-run";
  const blockCap=originEff==="block"?pendingBlockTransition:null;
  let replacementCapture=null;
  if(originEff==="block"){
    const draftGuard=blockStartDraftGuard();
    if(draftGuard)return blockTransitionResult("failed",draftGuard);
    if(!blockCap)return blockTransitionResult("failed");
    if(state.programMeta?.id!==blockCap.oldProgramId)return blockTransitionResult("duplicate");
    replacementCapture=materializeProgramReplacementCapture(blockCap,state);
    if(!replacementCapture)return blockTransitionResult("duplicate");
  }else replacementCapture=captureProgramReplacement(state);
  const draftActive=draftHasProgress();
  const confirmedDraftRaw=discardDraftRaw===undefined?readDraftRaw():discardDraftRaw;
  if(draftActive&&!draftConfirmed&&!confirm(t("confirm.replace_program_discard_draft")))
    return{revision:readRevision(state),localOk:false,idbOk:false,cancelled:true};
  const prepared=EntryActivation.successor({base:baseProposal||state,metadataSource:baseProposal,
    name,answers:answers||{},entrySource,programDefinition,route:entrySource?.route||telemetryRoute,origin:originEff,destination,
    programStructure,compilerContext,expectedSetupDraftRaw,expectedProgramId:blockCap?.oldProgramId});
  if(!prepared.ok)return prepared.code==="duplicate"?blockTransitionResult("duplicate"):
    {revision:readRevision(state),localOk:false,idbOk:false,invalid:true,code:prepared.code};
  const proposal=prepared.proposal;
  const effect=destructiveDraftClearEffect(confirmedDraftRaw);
  const persisted=await commitProgramReplacement(proposal,adapter,
    {capture:replacementCapture,effect,expectedSetupDraftRaw,replace,expectedFirstRunEmpty});
  const result=originEff==="block"?blockTransitionDurableResult(persisted):persisted;
  if(result.committed!==true||result.settled!==true)return result;
  const versionCategory=telemetryRoute==="import"?"import_v1":
    telemetryRoute==="shared"?"shared_v1":
    telemetryRoute==="build"?"manual_v1":
    telemetryRoute==="browse"||telemetryRoute==="recommend"||telemetryRoute==="custom"?"taurifer_v1":"legacy_v1";
  if(!result.alreadyCommitted){
    const payload={route:telemetryRoute,version_category:versionCategory};
    if(telemetryRoute==="import")payload.source=stagedImportSource();
    const changes=Telemetry?.bucketChanges?.(reviewChanges);
    if(changes)payload.review_changes=changes;
    captureEvent("program_activated",payload);
    // A block that ends in a new program is committed here, at its successor's activation.
    if(originEff==="block")captureEvent("block_transition_chosen",{action:"new_program"});
  }
  clearFreeformSession();
  clearStagedImportSource();
  clearEntryAdjust();
  if(telemetryRoute==="shared")SharedSetup?.clearHandoffCookie?.();
  if(telemetryRoute==="shared")syncLang();
  resetDraftSessionState();
  setupEditorOpen=false;
  document.body.classList.remove("is-entry-editor");
  if(originEff==="block")pendingBlockTransition=null;
  onboardingOrigin=null;day=days()[0]||"Day 1";closeFirstRun();closeOnboarding();
  if(destination==="program-edit"){
    InstalledEditorView.setEditing(true);
    $$("nav button").forEach(x=>{const on=x.dataset.view==="program";x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    $$(".view").forEach(v=>v.classList.toggle("active",v.id==="program"));
    document.body.classList.remove("is-settings","is-workout","is-exercise","is-onboarding","is-library","is-preview","is-import");
    render();toast(t("toast.tweak_program"));focusRoute(routeHeading("program"));return result}
  render();toast(t("toast.onboarding_saved"));
  focusRoute(routeHeading("log"));
  maybeShowInstallBanner();
  return result}
window.closeOnboarding=closeOnboarding;window.startOnboarding=startOnboarding;

// ---- UI prefs (kept separate from training data so they never touch export/import) ----
const UIKEY="repforge_ui_v1";
const preferenceStore=createPreferences({local:localStorage,tab:sessionStorage,mutationGate:installTransferMutationFrozen,onError:error=>console.warn("ui prefs save failed",error)});
function loadUiPrefs(){return preferenceStore.reloadUi()}
let uiPrefs=loadUiPrefs();
function setUiPref(k,v){const ok=preferenceStore.setUi(k,v,{base:uiPrefs});uiPrefs=preferenceStore.readUi();return ok}
const INSTALL_PREF_DEFAULTS=Object.freeze({installLastOfferedMilestone:null,installLastOfferedAt:null,
  installDismissedMilestone:null,installDismissedAt:null});
function replaceUiPrefs(next){const ok=preferenceStore.replaceUi(next);if(ok)uiPrefs=preferenceStore.readUi();return ok}
function ensureInstallPolicyPrefs(){
  let changed=false;const next={...uiPrefs};
  for(const[key,value]of Object.entries(INSTALL_PREF_DEFAULTS)){
    if(!Object.prototype.hasOwnProperty.call(next,key)){next[key]=value;changed=true}}
  if(changed)replaceUiPrefs(next)}
function ensureGuidePrefs({persist=true}={}){
  if(!GuideRegistry?.migrateLegacyTourDone)return;
  const next=GuideRegistry.migrateLegacyTourDone(uiPrefs);
  if(JSON.stringify(next)===JSON.stringify(uiPrefs))return;
  if(persist)replaceUiPrefs({...next});else uiPrefs={...next}}

/* ---- Appearance ----
   A UI pref, not a setting: which paper this device prefers says nothing about
   the training in a backup, and a setup link that repainted the recipient's app
   would be reading far past its remit. So it stays out of state.settings, out
   of export/import, and out of the shared-setup allowlist.

   "system" is a live answer rather than a stored light/dark, so a phone on a
   sunrise schedule follows it without the app being reopened, but only once
   the lifter has explicitly chosen it: with nothing stored yet, the default
   is light rather than a read of the device. Everything else below resolves
   the pick to the concrete value <html data-theme> carries, which is the
   only thing styles.css ever looks at. */
let appearanceController=null;
function appearanceView(){return appearanceController||(appearanceController=createAppearance({window,
  preferences:{read:()=>uiPrefs,set:setUiPref},onPaint:renderLandingDevice,onChanged:redrawChart,report:captureEvent}))}
function currentTheme(){return appearanceView().current()}
function resolvedTheme(){return appearanceView().resolved()}
function applyTheme(){return appearanceView().apply()}
function setTheme(value){return appearanceView().set(value)}
function watchSystemTheme(){return appearanceView().watch()}

// ---- Install / PWA helpers ----
const isStandalone=()=>installView().isStandalone();
const isIOS=()=>installView().isIOS();
const isIOSSafari=()=>installView().isIOSSafari();
function installMode(){return installView().mode()}
function installPolicyDecision(source){return installView().decision(source)}
function renderInstallSurfaces(){return installView().render()}
function triggerInstall(source){return installView().trigger(source)}
function showInstallBanner(force){return installView().showBanner(force)}
function hideInstallBanner(remember){return installView().hideBanner(remember)}
function maybeShowInstallBanner(){return installView().maybeShowBanner()}
function showInstallTransferDivergenceDialog(onConfirm){return installView().divergence(onConfirm)}
function reportLandingAction(action){captureEvent("landing_action",{action})}
// Capture Chrome's single-use offer before init, without reading training state.
window.addEventListener("beforeinstallprompt",event=>installView().capturePrompt(event),true);

/* ---- First-run setup: install, then choose a program ----
   One screen, one layout. Only its install section changes, and it changes with
   what the browser can actually do — a captured beforeinstallprompt, Safari's
   manual Home Screen flow, or nothing — so no lifter is ever asked which phone
   they are holding. */
let sharedSetupDraft={status:"none",source:null,encoded:null,payload:null,error:null,previousLang:null};
let firstRunActive=false;
const firstRunOpen=()=>!!$("#firstRun")&&!$("#firstRun").classList.contains("hidden");
const sharedSetupReady=()=>sharedSetupDraft.status==="ready"&&!!sharedSetupDraft.payload;
const sharedTrainingDays=definition=>(definition?.days||[]).filter(day=>day.kind==="training").length;
const sharedSetupInvalid=()=>sharedSetupDraft.status==="invalid"||sharedSetupDraft.status==="unsupported";
const sharedSetupEligible=()=>firstRunPending()&&!(state.programHistory?.length);
function sharedSetupErrorKey(code,version=null){
  // Only a link from a later envelope is "newer". Retired envelopes and links
  // whose generator this release does not run are asked to be shared again.
  if(code==="unsupported-version")return Number.isSafeInteger(version)&&version>SharedSetup.ENCODING_VERSION
    ?"setup.shared.unsupported":"setup.shared.outdated";
  if(code==="decompression-unavailable")return"setup.shared.browser_unsupported";
  return"setup.shared.invalid"}
function renderFirstRunProgramMode(){
  const standard=$("#firstRunStandardProgram"),shared=$("#firstRunSharedProgram"),card=$("#firstRunSharedCard"),error=$("#firstRunSharedError");
  const ready=sharedSetupReady();
  const invalid=sharedSetupInvalid();
  standard?.classList.toggle("hidden",ready);
  shared?.classList.toggle("hidden",!ready);
  card?.classList.toggle("hidden",!ready);
  $("#firstRun")?.classList.toggle("is-shared",ready);
  if(ready){
    const name=sharedSetupDraft.payload.program.name;
    const n=sharedTrainingDays(sharedSetupDraft.payload.program.definition);
    const title=$("#firstRunSharedTitle"),nameLine=$("#firstRunSharedName");
    if(title)title.textContent=t("setup.shared.view");
    if(nameLine)nameLine.textContent=t(n===1?"setup.shared.cap_one":"setup.shared.cap_many",{name,n});
    if(error){error.textContent="";error.classList.add("hidden")}}
  else if(invalid){
    if(error){error.textContent=t(sharedSetupErrorKey(sharedSetupDraft.error,sharedSetupDraft.errorVersion));error.classList.remove("hidden")}}
  else if(error){error.textContent="";error.classList.add("hidden")}}
function setSharedSetupBusy(busy){
  const button=$("#firstRunSharedStart"),busyEl=$("#firstRunSharedBusy");
  if(button){button.disabled=busy;button.setAttribute("aria-busy",busy?"true":"false")}
  busyEl?.classList.toggle("hidden",!busy)}
async function commitSharedSetup(io=storageIO){
  if(!sharedSetupReady())return{revision:readRevision(state),localOk:false,idbOk:false};
  if(!sharedSetupEligible()){
    toast(t("setup.shared.existing"),{assertive:true});
    return{revision:readRevision(state),localOk:false,idbOk:false,ineligible:true}}
  const checked=SharedSetup?.validate(sharedSetupDraft.payload,sharedSetupCodecOptions());
  if(!checked?.ok){
    toast(t("setup.shared.commit_failed"),{assertive:true});
    $("#firstRunSharedStart")?.focus();
    return{revision:readRevision(state),localOk:false,idbOk:false,invalid:true}}
  // The codec/consent gate remains the compatibility boundary. Once accepted,
  // hand the decoded payload to the same candidate preview and activation state
  // machine used by every other entry route; no durable program write happens
  // until the shared preview's explicit activation action.
  setSharedSetupBusy(true);
  try {
    const shared=checked.value.program,definition=cloneSnapshot(shared.definition);
    const customs=cloneSnapshot(shared.customExercises||[]);
    const program=flatProgramFromDefinition(definition,customs,1);
    const days=definition.days.filter(day=>day.kind==="training").map((day,index)=>({dayId:day.id,label:day.name,order:index+1,
      exercises:program.filter(row=>row.dayId===day.id).map(cloneSnapshot)}));
    const preview={source:"shared",frequency:days.length,program,programDefinition:definition,
      programStructure:{schemaVersion:1,days:days.map(({dayId,label,order})=>({dayId,label,order})),provenance:{source:"shared"}},
      days,customExercises:customs,primaryMuscles:[],
      sharedMeta:{name:shared.name,daysPerWeek:days.length,mesocycleLengthWeeks:definition.cycles},
      sharedSettings:cloneSnapshot(checked.value.settings)};
    startOnboarding("first-run",{userInitiated:true,forceFresh:true});
    let next=ProgramEntry.selectRoute(entryState,"shared");
    next=ProgramEntry.setAnswers(next,{sharedReady:true});
    next=ProgramEntry.setResult(next,{fingerprint:entryServices()?.fingerprint?.({route:"shared",name:shared.name,preview})||"shared",selected:{id:"shared",source:"shared"},name:shared.name,preview,telemetry:{family:"shared_v1"}});
    next={...next,step:"preview"};
    publishEntryDraft(next);
    // The first-run Start control opens the in-memory review. The received
    // definition stays out of the resumable setup-draft store until activation.
    EntryDraft.adopt(null,next);
    suspendFirstRun();
    showOnboardingView();
    renderOnboarding();
    return{revision:readRevision(state),localOk:false,idbOk:false,staged:true,inMemory:true};
  } catch {
    toast(t("setup.shared.commit_failed"),{assertive:true});
    $("#firstRunSharedStart")?.focus();
    return{revision:readRevision(state),localOk:false,idbOk:false,invalid:true};
  } finally { setSharedSetupBusy(false); }
}
/** Write the install section from the current reading, or take it away. Rule 5:
 *  a browser with no mechanism gets no section at all, never a dead button. */
function renderFirstRunInstall(){return installView().renderLanding()}
/** The lede and the escape hatch both speak to the install offer, so they follow
 *  it. With nothing to install — most of all inside the installed app — the
 *  screen is only the program question, and "Continue in browser" would be an
 *  answer to a question nobody asked. */
function setFirstRunOffer(offer){
  renderFirstRunHeroCopy();
  $("#firstRunContinue")?.classList.toggle("hidden",!offer);
}
/** The hero's headline and lede follow the landing in view: a shared link, a
 *  link that cannot be used, a return to an un-onboarded device, or the first visit. */
function renderFirstRunHeroCopy(){
  const shared=sharedSetupReady(),invalid=sharedSetupInvalid(),back=landingReturning();
  const headline=$("#firstRunHeadline"),lede=$("#firstRunLede");
  if(headline)headline.textContent=t(shared?"setup.shared.title":invalid?"landing.shared.invalid_headline":back?"landing.returning.headline":"landing.headline");
  if(lede)lede.textContent=t(shared?"landing.shared.body":invalid?"landing.shared.invalid_body":back?"landing.returning.sub":"landing.hero.sub");
}
/* ---- The returning landing (owner decision on #295, comment 5941692606) ----
   The generic landing is marked data-entry-visit="returning" by openFirstRun when
   the lifter has seen the full page before; a setup left half done also marks
   data-entry-draft with its route. Both are read from the marks, never from
   storage, so a re-render cannot turn a first visit into a return. */
const LANDING_RESUME_ROUTES=["recommend","custom","browse","build","import","shared"];
function landingReturning(){
  const root=$("#firstRun");
  return!!root&&root.dataset.entryVisit==="returning"&&!sharedSetupReady()&&!sharedSetupInvalid()}
/** The saved route, when the returning landing has a setup to continue. */
function landingResumeRoute(){
  return landingReturning()?String($("#firstRun").dataset.entryDraft||""):""}
function landingResumeLabel(route){
  return LANDING_RESUME_ROUTES.includes(route)?t(`landing.returning.resume.${route}`):t("landing.returning.resume.generic")}
/** With a saved setup, the landing's one creation action says so: the hero, the
 *  persistent control and the closing action all name the saved route instead of
 *  Build. They stay the same control and open the same chooser, whose resume card
 *  takes it from there; it does not jump to the saved step. */
function renderLandingResume(){
  const route=landingResumeRoute(),label=route?landingResumeLabel(route):t("landing.build");
  for(const name of["firstRunCreate","firstRunCreateClose","firstRunCreateDock"]){
    const button=$("#"+name),text=$(`#${name}Label`);
    if(text)text.textContent=label;
    if(button){if(route)button.dataset.entryResume=route;else delete button.dataset.entryResume}}}
/** Chrome accepted the install, or the app reports itself installed. Either way
 *  there is nothing left to install: the section goes, the choices stay. */
function closeFirstRunInstall(){return installView().closeLanding()}
/* ---- Landing page: engine-true numbers, filled copy and the proof ----
   Every number the page shows is produced here at render time and poured into an
   i18n template, never typed into markup or a catalog value. The three outcome
   cases go through the real progression engine with the app's default settings;
   the chart's figures come from the Progress model over the same four-session
   history the chart image is captured from (owner decision L-2). The inputs
   below are the only authored numbers: what the example lifter logged. */
let landingContentOwner=null;
function landingContentView(){return landingContentOwner||(landingContentOwner=createLandingContent({document,copy:{t,language:()=>uiLang()}}))}
const landingLang=()=>landingContentView().language();
const landingNum=value=>landingContentView().number(value);
function renderLandingContent(){landingContentView().render(buildLandingProof({model:TrainingModel,catalog:rawExerciseCatalog,minJump:DEFAULTS.minJump,defaultWeeks:EntryActivation.defaultCycles}))}

/* The proof controller. One object per open landing: it adds the pinned stage
   (phone, lens, rail) only when motion is welcome and the screen can hold it,
   keeps the persistent Build control in step with the hero action, and wires the
   two in-page controls. Everything it starts is recorded and removed by
   dispose(), which suspendFirstRun runs, so no listener, observer, timer or frame
   outlives the gate and the static cards remain once it is gone. */
let landingController=null;
function createLandingController(root){
  const reg={offs:[],obs:[],timers:new Set(),frames:new Set(),nodes:[]};
  const clamp=(x,lo,hi)=>x<lo?lo:x>hi?hi:x;
  const on=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);reg.offs.push(()=>target.removeEventListener(type,fn,opts))};
  const later=(fn,ms)=>{const id=setTimeout(()=>{reg.timers.delete(id);fn()},ms);reg.timers.add(id);return id};
  const motionQuery=window.matchMedia?.("(prefers-reduced-motion: reduce)")||null;
  const reduced=()=>window.RepForgeMotion?.reducedMotion?.()??!!motionQuery?.matches;
  const track=root.querySelector("#firstRunProofTrack"),stage=root.querySelector("#firstRunProofStage"),list=root.querySelector("#firstRunProofSteps");
  const steps=[...root.querySelectorAll("[data-landing-step]")];
  const ticks=new Set();
  let pin=null,pinOffs=[],tickPending=false,seq=null;
  const requestTick=()=>{
    if(tickPending)return;tickPending=true;
    const id=requestAnimationFrame(()=>{reg.frames.delete(id);tickPending=false;ticks.forEach(fn=>fn())});
    reg.frames.add(id)};
  /* ---- pinned stage ---- */
  const shouldPin=()=>{
    if(!track||!stage||!list||!steps.length||reduced()||landingReturning())return false;
    const font=parseFloat(getComputedStyle(document.documentElement).fontSize)||16;
    return root.clientHeight>=600&&font<=20};
  function unpin(){
    if(!pin)return;
    if(seq){clearTimeout(seq);reg.timers.delete(seq);seq=null}
    ticks.delete(pin.tick);
    pinOffs.forEach(off=>off());pinOffs=[];
    pin.nodes.forEach(node=>node.remove());
    track.classList.remove("is-pinned","is-ready");track.style.removeProperty("--firstrun-steps");
    steps.forEach(step=>{step.classList.remove("is-current");step.removeAttribute("aria-current")});
    pin=null}
  function lensTo(name){
    const read=LANDING_READ[name],spot=LANDING_SPOTS[read.scene][name];
    const img=pin.imgs[read.scene],phone=pin.phone,glass=pin.glass,lens=pin.lens;
    const pw=phone.clientWidth,gw=glass.clientWidth,gh=glass.clientHeight,gx=glass.offsetLeft,gy=glass.offsetTop;
    if(!pw||!gw||!gh)return;
    const tw=spot[2]/100*gw,th=spot[3]/100*gh;
    const m=Math.min(read.m,(pw-16-2*read.pad)/tw);
    let lw=tw*m+2*read.pad,lh=th*m+2*read.pad;
    if(read.shape==="round")lw=lh=Math.max(lw,lh);
    const cx=clamp(gx+spot[0]/100*gw,lw/2+8,pw-lw/2-8),cy=gy+spot[1]/100*gh;
    lens.style.setProperty("--firstrun-lens-w",`${lw}px`);lens.style.setProperty("--firstrun-lens-h",`${lh}px`);
    lens.style.setProperty("--firstrun-lens-radius",read.shape==="round"?"50%":read.shape==="pill"?`${Math.min(lh/2,22)}px`:`${read.r?read.r*gw/390*m:14}px`);
    lens.style.left=`${cx}px`;lens.style.top=`${cy}px`;
    lens.style.backgroundImage=`url("${img.currentSrc||img.src}")`;
    lens.style.backgroundSize=`${gw*m}px ${gh*m}px`;
    lens.style.backgroundPosition=`${lw/2-spot[0]/100*gw*m}px ${lh/2-spot[1]/100*gh*m}px`;
    lens.dataset.read=name;lens.classList.add("is-on")}
  function frame(index){
    const step=steps[index],reads=(step.dataset.read||"").split(" ").filter(Boolean);
    LANDING_SCENES.forEach(scene=>{
      const shown=scene===step.dataset.scene;
      pin.imgs[scene].classList.toggle("is-on",shown);
      pin.imgs[scene].setAttribute("aria-hidden",shown?"false":"true")});
    if(seq){clearTimeout(seq);reg.timers.delete(seq);seq=null}
    pin.phone.classList.toggle("is-reading",reads.length>0);
    if(!reads.length){pin.lens.classList.remove("is-on");delete pin.lens.dataset.read;return}
    lensTo(reads[0]);
    if(reads.length>1)seq=later(()=>{seq=null;if(pin)lensTo(reads[reads.length-1])},1500)}
  function setStep(index,force){
    if(!pin||(index===pin.current&&!force))return;
    pin.current=index;
    steps.forEach((step,j)=>{
      step.classList.toggle("is-current",j===index);
      if(j===index)step.setAttribute("aria-current","step");else step.removeAttribute("aria-current")});
    pin.rail.forEach((button,j)=>{
      button.classList.toggle("is-done",j<index);
      if(j===index)button.setAttribute("aria-current","step");else button.removeAttribute("aria-current")});
    frame(index)}
  function pinStage(){
    if(pin)return;
    const lang=landingLang();
    const loaded=()=>{if(pin)setStep(pin.current,true)};
    const element=(tag,cls,attrs={})=>{const node=document.createElement(tag);if(cls)node.className=cls;for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);return node};
    const phone=element("div","firstrun-proof__phone"),glass=element("div","firstrun-proof__glass");
    const screen=element("div","firstrun-proof__screen"),imgs={};
    LANDING_SCENES.forEach(scene=>{
      const source=steps.map(step=>step.querySelector("[data-landing-crop]")).find(node=>node?.src.includes(`wt-${scene}-`));
      const img=element("img","",{width:"780",height:"1688",decoding:"async",loading:"lazy",
        src:`assets/brand/wt-${scene}-${lang}-dark.webp`,alt:source?.alt||""});
      imgs[scene]=img;screen.append(img);
      img.addEventListener("load",loaded);pinOffs.push(()=>img.removeEventListener("load",loaded))});
    glass.append(screen);
    const lens=element("span","firstrun-proof__lens",{"aria-hidden":"true"});
    phone.append(glass,lens);
    const railNav=element("div","firstrun-proof__rail",{role:"group","aria-label":t("landing.demo.steps_aria")});
    const rail=steps.map((step,j)=>{
      const button=element("button","",{type:"button","data-go":String(j),
        "aria-label":t("landing.demo.step_aria",{n:landingNum(j+1),total:landingNum(steps.length)})});
      const go=()=>{
        const span=track.offsetHeight-stage.offsetHeight;
        const top=track.getBoundingClientRect().top-root.getBoundingClientRect().top+root.scrollTop+span*(j+.5)/steps.length;
        root.scrollTo({top,behavior:reduced()?"auto":"smooth"})};
      button.addEventListener("click",go);pinOffs.push(()=>button.removeEventListener("click",go));
      railNav.append(button);return button});
    stage.insertBefore(phone,list);stage.insertBefore(railNav,list);
    track.classList.add("is-pinned");track.style.setProperty("--firstrun-steps",String(steps.length));
    const tick=()=>{
      if(!pin)return;
      const span=track.offsetHeight-stage.offsetHeight;if(span<=0)return;
      if(!shouldPin()){layout();return}
      const progress=clamp((root.getBoundingClientRect().top-track.getBoundingClientRect().top)/span,0,1);
      setStep(Math.min(steps.length-1,Math.floor(progress*steps.length*.999+.0001)))};
    pin={phone,glass,lens,imgs,rail,nodes:[phone,railNav],current:-1,tick};
    ticks.add(tick);
    setStep(0);
    /* the steps fade only once the first state is painted, so none flashes on entry */
    const id=requestAnimationFrame(()=>{reg.frames.delete(id);if(pin)track.classList.add("is-ready")});
    reg.frames.add(id)}
  /* ---- the stepped reveal (O1) ----
     When the proof is the static cards (motion is welcome but the stage cannot
     pin), each card arrives with `.motion-step` > `.is-in` as it scrolls into
     view. The class that hides a step is `.motion-steps-ready` on the list and
     is added here, after the first observation, so without JavaScript every step
     is simply shown, a card already in view is never hidden and shown again, and
     the pinned stage (which has its own crossfade) and reduced motion never get
     it. Nothing about the stage or its steps changes: this only adds and removes
     classes, and dispose() takes them all off. */
  let reveal=null;
  function stopReveal(){
    if(!reveal)return;
    reveal.io.disconnect();const k=reg.obs.indexOf(reveal.io);if(k>=0)reg.obs.splice(k,1);
    list.classList.remove("motion-steps-ready");
    steps.forEach(step=>step.classList.remove("motion-step","is-in"));reveal=null}
  function syncReveal(){
    const want=!!list&&steps.length>0&&!pin&&!reduced()&&!landingReturning()&&typeof IntersectionObserver!=="undefined";
    if(!want){stopReveal();return}
    if(reveal)return;
    const state={io:null,armed:false};
    state.io=new IntersectionObserver(entries=>{
      if(reveal!==state)return;
      for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add("is-in");state.io.unobserve(entry.target)}
      if(!state.armed){state.armed=true;list.classList.add("motion-steps-ready")}},{root,threshold:.15});
    reveal=state;reg.obs.push(state.io);
    steps.forEach(step=>{step.classList.add("motion-step");state.io.observe(step)})}
  function layout(){
    if(shouldPin()){if(pin)setStep(pin.current,true);else pinStage()}else unpin();
    syncReveal();
    requestTick()}
  /* ---- the persistent Build control ---- */
  function mountDock(){
    const dock=root.querySelector("#firstRunDock"),hero=root.querySelector("#firstRunCreate"),close=root.querySelector("#firstRunCreateClose");
    if(!dock||!hero||!close||sharedSetupReady()||typeof IntersectionObserver==="undefined")return;
    let gone=false,closing=false;
    const paint=()=>dock.classList.toggle("is-on",gone&&!closing);
    const watch=(node,fn)=>{const io=new IntersectionObserver(fn,{root});reg.obs.push(io);io.observe(node)};
    watch(hero,entries=>{const e=entries[entries.length-1];gone=!e.isIntersecting&&e.boundingClientRect.bottom<(e.rootBounds?e.rootBounds.top:0)+1;paint()});
    watch(close,entries=>{const e=entries[entries.length-1];closing=e.isIntersecting||e.boundingClientRect.top<(e.rootBounds?e.rootBounds.top:0);paint()});
    /* the first painted ground beneath the control's resting place decides its ink */
    const luminance=(x,y)=>{
      for(const hit of document.elementsFromPoint(x,y)){
        if(dock.contains(hit))continue;
        for(let node=hit;node&&node!==document.documentElement;node=node.parentElement){
          const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(node).backgroundColor);
          if(m&&(m[4]===undefined||+m[4]>.5))return(.2126*m[1]+.7152*m[2]+.0722*m[3])/255}}
      return 1};
    ticks.add(()=>{
      const box=dock.getBoundingClientRect();
      const y=box.height?window.innerHeight-parseFloat(getComputedStyle(dock).bottom)-box.height/2:window.innerHeight-60;
      dock.dataset.ground=luminance(window.innerWidth/2,y)<.4?"dark":"light"});
    reg.nodes.push(()=>{dock.classList.remove("is-on");delete dock.dataset.ground})}
  /* ---- in-page controls ---- */
  function mountControls(){
    const hand=root.querySelector("#firstRunHandBtn"),body=root.querySelector("#firstRunHand");
    if(hand&&body){
      on(hand,"click",()=>{const open=hand.getAttribute("aria-expanded")!=="true";hand.setAttribute("aria-expanded",String(open));body.hidden=!open});
      reg.nodes.push(()=>{hand.setAttribute("aria-expanded","false");body.hidden=true})}
    const link=root.querySelector("#firstRunFooterPrivacy"),data=root.querySelector("#firstRunData");
    if(link&&data)on(link,"click",event=>{
      event.preventDefault();
      data.scrollIntoView({block:"start",behavior:reduced()?"auto":"smooth"});
      try{data.focus({preventScroll:true})}catch{}})}
  /* ---- lifecycle ---- */
  function mount(){
    mountControls();mountDock();
    on(root,"scroll",requestTick,{passive:true});
    on(window,"resize",layout);
    if(motionQuery?.addEventListener)on(motionQuery,"change",layout);
    layout()}
  function dispose(){
    unpin();stopReveal();
    reg.offs.forEach(off=>off());reg.offs.length=0;
    reg.obs.forEach(io=>io.disconnect());reg.obs.length=0;
    reg.timers.forEach(clearTimeout);reg.timers.clear();
    reg.frames.forEach(cancelAnimationFrame);reg.frames.clear();
    reg.nodes.forEach(fn=>fn());reg.nodes.length=0;
    ticks.clear();tickPending=false}
  const live=()=>({listeners:reg.offs.length+pinOffs.length,observers:reg.obs.length,timers:reg.timers.size,frames:reg.frames.size,
    pinned:!!pin,step:pin?pin.current:null,ticks:ticks.size});
  return{mount,dispose,live}}
function mountLandingController(){
  disposeLandingController();
  const root=$("#firstRun");if(!root)return;
  // openFirstRun marks the landing first or returning after it renders, so the
  // marks are applied to the hero here, before the controller reads it.
  renderFirstRunHeroCopy();renderLandingResume();
  landingController=createLandingController(root);
  landingController.mount()}
function disposeLandingController(){
  if(!landingController)return;
  landingController.dispose();landingController=null}
/** Test hook: what the open landing's controller is holding (nothing once closed). */
window.__repforgeLandingProof=()=>landingController?{open:true,...landingController.live()}:{open:false,listeners:0,observers:0,timers:0,frames:0,pinned:false,step:null,ticks:0};
/** Real-app captures that follow the chosen appearance: swap the file on
 *  <html data-theme>, never on prefers-color-scheme, so the page and the app agree. */
function renderLandingDevice(){landingContentView().paintDevice()}
function renderFirstRun(){
  renderFirstRunProgramMode();
  renderLandingDevice();
  renderLandingContent();
  const decision=installPolicyDecision(),mode=installMode();
  setFirstRunOffer(decision.eligible||mode==="safari"&&decision.state==="unsupported");
  const label=$("#firstRunContinueLabel");
  if(label)label.textContent=isIOSSafari()?t("setup.continue_safari"):t("setup.continue_browser");
  renderFirstRunInstall();
}
function currentEntryLanding(){
  if(sharedSetupReady())return"shared";
  if(sharedSetupInvalid())return"shared-invalid";
  return"generic"}
function openFirstRun(kind=currentEntryLanding()){
  const el=$("#firstRun");if(!el)return false;
  firstRunActive=true;
  renderFirstRun();
  el.dataset.entryLanding=kind;
  // The generic landing tells a first visit from a return, and names the setup
  // the lifter left half done, so the returning landing can lead with it.
  const returning=kind==="generic"&&uiPrefs.entryLandingSeen===true;
  el.dataset.entryVisit=returning?"returning":"first";
  const draft=returning?readSetupDraftRecord():null;
  const draftRoute=draft?.ok&&draft.envelope&&!isGuidedRepairSetupDraft(draft.envelope)?String(draft.envelope.state?.route||""):"";
  if(draftRoute)el.dataset.entryDraft=draftRoute;else delete el.dataset.entryDraft;
  el.classList.remove("hidden");
  document.body.classList.add("is-firstrun");
  captureEvent("landing_viewed",{landing:kind==="shared-invalid"?"shared_invalid":kind==="shared"?"shared":"generic",visit:returning?"returning":"first"});
  window.scrollTo({top:0});
  el.scrollTop=0;
  // The screen itself takes focus, not its first choice: a ring drawn around
  // Create before the lifter has touched anything reads as a recommendation.
  try{el.focus({preventScroll:true})}catch{}
  mountLandingController();
  // No guide is presented here. This screen's whole job is the proposition,
  // and every cue that could anchor to it explains a control the screen has
  // already named: the two entry actions carry their own labels, the install
  // card carries its own title and body, and Privacy is a standing link in
  // the header. A cue above the headline pushed the product argument off the
  // first paint to restate what was already on it. The guides themselves are
  // untouched — "entry" shows at the chooser it explains, and "install" and
  // "privacy" show in Settings, where they are anchored to controls whose
  // purpose is not self-evident and where replay reaches them.
  if(kind==="generic"&&uiPrefs.entryLandingSeen!==true)setUiPref("entryLandingSeen",true);
  return true}
/** The landing's tab stops: the modal set plus the questions' <summary> controls. */
function firstRunFocusables(root){
  const sel='a[href],button:not([disabled]),summary,input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return [...root.querySelectorAll(sel)].filter(el=>{
    if(el.hasAttribute("hidden")||el.closest("[hidden]"))return false;
    const st=getComputedStyle(el);
    return st.display!=="none"&&st.visibility!=="hidden"&&el.getClientRects().length>0})}
function trapFirstRunTab(event){
  if(event.key!=="Tab"||!firstRunOpen())return;
  const root=$("#firstRun"),focusable=firstRunFocusables(root);
  if(!focusable.length){event.preventDefault();root?.focus();return}
  const current=focusable.indexOf(document.activeElement);
  if(event.shiftKey&&(current<=0)){
    event.preventDefault();focusable[focusable.length-1].focus()}
  else if(!event.shiftKey&&(current===-1||current===focusable.length-1)){
    event.preventDefault();focusable[0].focus()}}
/** Hide the gate without giving up on it: the import review lives in the app
 *  shell underneath, so it needs the overlay out of the way while it decides. */
function suspendFirstRun(){
  const el=$("#firstRun");if(!el)return;
  disposeLandingController();
  el.classList.add("hidden");document.body.classList.remove("is-firstrun")}
function closeFirstRun(){
  firstRunActive=false;installView().resetPresented();suspendFirstRun()}
const firstRunPending=()=>!state.programMeta?.onboarded&&!state.log.length;
/** Resolve the landing before ordinary navigation. A valid or invalid shared
 *  handoff always gets its complete fail-closed surface. Otherwise the landing
 *  is the boot surface until the device is onboarded (owner decision on #295,
 *  amending G-47/L-08 and Q633): the full landing on the first visit, the
 *  returning landing on later ones; the chooser is reached from it. */
function maybeShowFirstRun(){
  if(sharedSetupDraft.status==="existing")return false;
  if(!firstRunPending())return false;
  const kind=currentEntryLanding();
  // A restored or migrated program with the flag unset is real content
  // (hasProgramContent, as Today and Program read it): the generic landing never
  // covers it. A shared link's own gate still decides for itself.
  if(kind==="generic"&&hasProgramContent())return false;
  return openFirstRun(kind)}
window.closeFirstRun=closeFirstRun;window.openFirstRun=openFirstRun;

/* ---- "Why this weight?" sheet ----
   Plan 043: the recommendation is the product's differentiator, so it must not
   read as a magic number. Everything here is built at tap time from fields the
   engine attached to its own result — no arithmetic is re-derived, and the Log
   tab's render path pays nothing but one static button per card. */
// Log list and focus cards render every slot through sessionExercise, so resolving
// by id here matches what they drew. The exercise page does NOT: it renders the raw
// slot whenever the workout is not active (openExerciseView), so a slot substituted
// earlier in the session would have the page showing one movement's recommendation
// and the sheet showing another's arithmetic. That caller passes its own resolved
// movement to openWhySheetFor instead.
function openWhySheet(exId,opener){
  const slot=prog.find(exId);if(!slot)return;
  const ex=sessionExercise(slot);if(!ex)return;
  openWhySheetFor(ex,opener)}
/* ---- Why this weight (Direction D, spec 4.3) ----
   Sentences first, each under a bold lead, then the working behind "See the working"
   and the evidence footer. Every sentence is a row of explainRecommendation(), the
   producer above, and every figure is a fact the engine attached; this model only
   orders them, gives each its lead, and lays out the working. */
const whyList=items=>formatList(items,uiLang());
function explainRecommendation(ex){return WhyPresentation.capture(focusPresentationFacts()).explain(ex)}
function recCueLoad(rec){return WhyPresentation.cueLoad(rec)}
function whySheetModel(ex,surface="focus"){return WhyPresentation.capture(focusPresentationFacts()).model(ex,surface)}
function setsTargetLine(ex,rec){return WhyPresentation.capture(focusPresentationFacts()).targetLine(ex,rec)}

function focusWhyView(){
  if(!focusWhyView.instance)focusWhyView.instance=Focus.createWhySheet({document,
    shell:shellView(),motion:ensureBrowserPresentation().motion,
    commands:{recommendationExplained:payload=>captureEvent("recommendation_explained",payload)}});
  return focusWhyView.instance}
function openWhySheetFor(ex,opener){
  if(!ex)return;
  const surface=opener?.closest?.("#exDetail")?"exercise":"focus",model=whySheetModel(ex,surface);
  return focusWhyView().open({model,opener,surface})}
function closeWhySheet(){return focusWhyView().close()}
function installTransferRenderState(stateName,detail){return installView().renderTransfer(stateName,detail)}
function openIosInstallSheet(stateName,options){return installView().openSheet(stateName,options)}
function closeIosInstallSheet(){return installView().closeSheet()}
function openPrivacySheet(options){return installView().openPrivacy(options)}
function closePrivacySheet(){return installView().closePrivacy()}

// ---- Contextual guides ----
let contextualGuides=null;
function guidesView(){return contextualGuides||(contextualGuides=createGuidesView({window,registry:GuideRegistry,
  preferences:{read:()=>uiPrefs,reload:loadUiPrefs,replace:replaceUiPrefs},t,landingOpen:firstRunOpen,
  onGeometryChanged:syncFocusFloor,report:captureEvent}))}
function removeContextualGuide(){return guidesView().remove()}
function dismissContextualGuide(options){return guidesView().dismiss(options)}
function showContextualGuide(id,options){return guidesView().show(id,options)}
function maybeShowContextualGuides(ids){return guidesView().maybeShow(ids)}
function completeContextualGuide(){return guidesView().complete()}
function replayContextualGuide(id){return guidesView().replay(id)}
function contextualGuideState(){return guidesView().state()}
function onContextualGuideAction(event){return guidesView().onAction(event)}


function showSettings(){
  $$("nav button").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-current","false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="settings"));
  document.body.classList.add("is-settings");document.body.classList.remove("is-exercise","is-onboarding","is-workout");
  workoutActive=false;workoutLeft=true;window.scrollTo({top:0});render();
  // Settings opens on its heading (R7 J-09); Back, below, returns to the control that opened it.
  focusRoute(routeHeading("settings"));
  queueMicrotask(()=>maybeShowContextualGuides(["install","privacy"]))}
/* Returns to a bottom-nav destination from a stacked view. navTo cannot do it:
   it skips the click when the nav button is already marked active, which it
   still is after a full-screen view took over without touching the dock. */
function returnToTab(view){
  $$("nav button").forEach(b=>{const on=b.dataset.view===view;
    b.classList.toggle("active",on);b.setAttribute("aria-current",on?"page":"false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===view));
  window.scrollTo({top:0})}
function navTo(view){
  if(view==="settings"){showSettings();return}
  const b=$(`nav button[data-view="${view}"]`);
  if(b){if(!b.classList.contains("active"))b.click();return}
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===view));
  window.scrollTo({top:0});render()
}
window.__repforgeEnterWorkout=enterWorkout;
window.__repforgeGoToLogExercise=goToLogExercise;
// The public harness seam can exercise only the ordinary completion path. The
// early-finish capability stays private to the confirmation handler below so
// callers cannot turn an arbitrary programmatic save into an early finish.
window.__repforgeSaveWorkout=()=>saveWorkout({preventDefault(){}});
window.__repforgeWorkoutDraft={
  current:()=>activeWorkoutDraft,
  raw:()=>activeWorkoutDraftRaw,
  projection:()=>WorkoutSession.projection(),
  target:draftTargetFromKey,
  dispatch:(type,payload)=>WorkoutSession.dispatch(type,payload),
  initialize:initializeWorkoutDraft,
  checkpoint:()=>DraftStore.readV2Checkpoint(),
  read:()=>DraftStore.readCanonicalStatus(),
  // Browser harness seam: settle both the ordered DraftV2 write queue and any
  // suggestion refresh that is still computing or retrying before inspecting
  // acknowledged state. Production callers use the same drain internally.
  flush:()=>WorkoutSession.flush(),
  cas:({expectedRaw,expectedDraftId,expectedRevision,nextRaw,operationId})=>
    DraftStore.compareAndSwapV2({expectedRaw,expectedDraftId,expectedRevision,nextRaw,operationId}),
  stageLegacy:(transactionId,raw)=>DraftStore.writeSidecar(transactionId,raw),
  promote:(transactionId=null,contextFingerprint=draftContextFingerprint(state))=>DraftStore.promote(transactionId,contextFingerprint),
  reconcile:async()=>{const read=DraftStore.readCanonicalStatus();return read.status==="ok"?reconcileV2Checkpoint(read,day):read},
  clear:clearDraft,
  recovery:()=>draftUiRecovery,
  retryRecovery:retryDraftRecovery,
  reloadRecovery:reloadLatestWorkoutDraft,
  discardRecovery:discardRecoveredWorkoutDraft,
  effect:{preserve:draftPreservationEffect,clear:destructiveDraftClearEffect,rename:draftDayReplacementEffect},
  inspectEffect:effect=>pendingJournalEffectState(effect),
  commitEffect:(proposal,effect,io=storageIO)=>commitProposedState(proposal,io,{effect}),
  state:()=>cloneSnapshot(state),
};
// Test seam for the Focus deck, alongside the other __repforge* harness hooks.
function focusDirectTo(index){focusNavigation().direct(index)}
window.__repforgeFocus={
  go:focusAnimateTo,list:focusList,at:()=>focusUi.index,editing:()=>focusUi.edit,
  to:focusDirectTo,
};
window.__repforgeLeaveWorkout=leaveWorkout;
window.__repforgeShowSettings=showSettings;
window.__repforgeUi={loadUiPrefs,isStandalone,isIOS,showInstallBanner,currentTheme,resolvedTheme,setTheme,
  installPolicyDecision:()=>installPolicyDecision(),guideState:contextualGuideState,
  replayGuide:replayContextualGuide,showGuide:showContextualGuide,
  openInstallTransferState:stateName=>openIosInstallSheet(stateName),openPrivacy:()=>openPrivacySheet()};
function resumeProgramEditFollowUp(){
  if(state?.[STORAGE_FOLLOWUP]?.kind!=="onboarding-edit")return false;
  InstalledEditorView.setEditing(true);
  document.body.classList.remove("is-settings","is-workout","is-exercise","is-onboarding","is-library","is-preview","is-import");
  $$("nav button").forEach(x=>{const on=x.dataset.view==="program";x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="program"));
  return true}
window.__repforgeOnboarding={
  entry:()=>entryState,
  setupDraftKey:SETUP_DRAFT_KEY,
  services:entryServices,
  render:renderOnboarding,
  flushDraft:()=>EntryDraft.flush(),
  clearDraft:clearSetupDraft};

function init(){
  ensureBrowserPresentation();
  programSharingView.mount();
  ensureInstallPolicyPrefs();
  ensureGuidePrefs({persist:currentEntryLanding()==="generic"});
  // The pre-paint snippet in index.html has already done this for a dark
  // device; re-running it is what covers the light case and a snippet that
  // could not read storage.
  applyTheme();watchSystemTheme();
  window.addEventListener("hashchange",()=>{handleSharedSetupHash()});
  $("#firstRun")?.addEventListener("keydown",trapFirstRunTab);
  document.addEventListener("click",onContextualGuideAction,true);
  let rzT;window.addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(redrawChart,150)});
  window.addEventListener("orientationchange",()=>setTimeout(redrawChart,200));
  // Chrome decides when to offer this, and it usually decides after the first
  // paint — often after the lifter has touched something. Every install surface
  // is rewritten from the new reading rather than assumed at boot, which is what
  // lets the install section appear on a first-run screen the lifter is already
  // reading. One that has been left for the wizard is not pulled back: the
  // banner carries the offer from there.
  window.addEventListener("beforeinstallprompt",e=>{installView().capturePrompt(e);
    renderSettings();renderInstallSurfaces();maybeShowInstallBanner()});
  window.addEventListener("appinstalled",()=>installView().installed());
  $("#installBtn").onclick=triggerInstall;
  $("#installBannerClose").onclick=()=>hideInstallBanner(true);
  $("#installBannerAction").onclick=triggerInstall;
  $("#firstRunInstallLink").onclick=event=>{reportLandingAction("install");return triggerInstall(event)};
  $("#firstRunPrivacy").onclick=()=>{reportLandingAction("privacy");openPrivacySheet()};
  const openFirstRunCreate=()=>{reportLandingAction("create");closeFirstRun();startOnboarding("first-run")};
  $("#firstRunCreate").onclick=openFirstRunCreate;
  $("#firstRunCreateClose").onclick=openFirstRunCreate;
  $("#firstRunCreateDock").onclick=openFirstRunCreate;
  // Import runs through the same review as everywhere else; the gate stays
  // standing behind it so backing out returns here rather than to an empty app.
  // Copy and paste is the primary BYOP door, with the file door one tap away.
  const openFirstRunImport=()=>{
    reportLandingAction("import");
    closeFirstRun();
    // A saved setup is resumed or discarded only on the chooser's resume card
    // (Q-A): Track must never start a fresh import over it.
    if(readSetupDraftRecord().raw!==null){startOnboarding("first-run");return}
    startOnboarding("first-run",{userInitiated:true,forceFresh:true});
    setImportSourceMode("freeform",{render:false});
    entrySelectRoute("import")};
  $("#firstRunImport").onclick=openFirstRunImport;
  $("#firstRunImportClose").onclick=openFirstRunImport;
  // "Continue in browser" is an answer to the install offer, not to the program
  // question: it takes the offer off the table for a while, then hands over to
  // the same first run the app has always had.
  $("#firstRunContinue").onclick=()=>{reportLandingAction("continue_browser");installView().dismissPresented();
    if(sharedSetupReady()){closeFirstRunInstall();renderFirstRunProgramMode();return}
    closeFirstRun();startOnboarding("first-run")};
  const sharedCreate=$("#firstRunSharedCreate");if(sharedCreate)sharedCreate.onclick=()=>{
    reportLandingAction("create");
    discardSharedSetup();
    closeFirstRun();startOnboarding("first-run")};
  const sharedStart=$("#firstRunSharedStart");if(sharedStart)sharedStart.onclick=async()=>{
    if(sharedStart.disabled)return;
    reportLandingAction("shared_start");
    await commitSharedSetup(storageIO)};
  $("#installTransferStart").onclick=installTransferCreateFromSafari;
  $("#installTransferPrivacy").onclick=()=>openPrivacySheet({fromTransfer:true});
  $("#privacyDetails").onclick=()=>openPrivacySheet();
  $("#privacyClose").onclick=closePrivacySheet;
  $("#privacyScrim").onclick=closePrivacySheet;
  $("#iosInstallClose").onclick=closeIosInstallSheet;
  $("#iosInstallDone").onclick=closeIosInstallSheet;
  $("#iosInstallScrim").onclick=closeIosInstallSheet;
  $("#guideReplayToggle").onclick=()=>setDisclosure($("#guideReplayToggle"),$("#guideReplayPanel"),!$("#guideReplayPanel")?.classList.contains("is-open"));
  $$('[data-guide-replay]').forEach(button=>button.onclick=()=>replayContextualGuide(button.dataset.guideReplay));
  $("#installApp").onclick=()=>triggerInstall("manual-settings");
  restSheet().mount();
  const noteCancel=$("#exNoteCancel");if(noteCancel)noteCancel.onclick=closeExNoteSheet;
  const noteSave=$("#exNoteSave");if(noteSave)noteSave.onclick=saveExNoteSheet;
  const noteScrim=$("#exNoteScrim");if(noteScrim)noteScrim.onclick=closeExNoteSheet;
  const dayPickCancel=$("#dayPickCancel");if(dayPickCancel)dayPickCancel.onclick=closeDayPickSheet;
  const dayPickScrim=$("#dayPickScrim");if(dayPickScrim)dayPickScrim.onclick=closeDayPickSheet;
  const dayPickOk=$("#dayPickConfirm");if(dayPickOk)dayPickOk.onclick=()=>confirmPickerDay();
  libraryUi.bind();
  const impBack=$("#importBack");if(impBack)impBack.onclick=()=>closeImportReview();
  const impCancel=$("#importReviewCancel");
  if(impCancel)impCancel.onclick=()=>{closeImportReview();toast(t("toast.program_import_cancelled"))};
  const impCommit=$("#importCommit");
  if(impCommit)impCommit.onclick=()=>commitImportReview(pendingImportIo||storageIO);
  trackSheetViewport();
  // Sheet and card deck gestures are mounted via explicit gesture controller lifetime.
  const openSettingsBtn=$("#openSettings");if(openSettingsBtn)openSettingsBtn.onclick=()=>openSettingsView();
  const settingsBack=$("#settingsBack");if(settingsBack)settingsBack.onclick=()=>{navTo("log");focusRoute("#openSettings")};
  const startWo=$("#startWorkout");if(startWo)startWo.onclick=()=>enterWorkout({});
  const otherDay=$("#chooseAnotherDay");if(otherDay)otherDay.onclick=()=>openDayPickSheet();
  const reviewToday=$("#reviewTodaySession");if(reviewToday)reviewToday.onclick=()=>openTodaySessionInHistory();
  // Training twice in a day is the lifter's call, never Today's suggestion, so it
  // opens the day that follows the one already done rather than repeating it.
  const another=$("#logAnotherSession");if(another)another.onclick=()=>enterWorkout({day:dayAfterTrainedToday()||day});
  const leaveWo=$("#leaveWorkout");if(leaveWo)leaveWo.onclick=leaveWorkout;
  focusView().mount();
  initializeSessionSheet();

  const exActionRepeat=$("#exActionRepeatBtn");
  if(exActionRepeat)exActionRepeat.onclick=async()=>{
    const id=activeExActionsId;
    const progEx=id?prog.find(id):null;
    const prevSets=progEx?last(sessionExercise(progEx)):[];
    if(!prevSets.length||!activeWorkoutDraft)return;
    const values=prevSets.map(s=>Array.isArray(s.metricValues)?({
      ordinal:s.set,
      metrics:Object.fromEntries(s.metricValues.map(value=>[value.metricId,canonicalNumberText(value.value)])),
      ...(s.rir==null?{}:isEffortMode()?{effort:effortForRir(s.rir)}:{rir:canonicalNumberText(s.rir)})
    }):({ordinal:s.set,load:canonicalNumberText(s.load),reps:canonicalNumberText(s.reps),
      ...(isEffortMode()?{effort:effortForRir(s.rir)}:{rir:canonicalNumberText(s.rir)})}));
    const res=await WorkoutSession.dispatch("repeatPreviousSetValues",{exerciseInstanceId:id,values});
    if(res.status==="applied"){
      renderWorkout();
      toast(t("toast.filled_from_last"));
      closeExActionsSheet();
    }
  };

  const exActionSubst=$("#exActionSubstBtn");
  if(exActionSubst)exActionSubst.onclick=()=>{
    const id=activeExActionsId;
    closeExActionsSheet().then(()=>{
      if(id)openSubstitutePicker(id);
    });
  };

  const exActionRestoreOrig=$("#exActionRestoreOrigBtn");
  if(exActionRestoreOrig)exActionRestoreOrig.onclick=async()=>{
    const id=activeExActionsId;
    if(id&&activeWorkoutDraft){
      const res=await WorkoutSession.dispatch("restoreOriginalExercise",{exerciseInstanceId:id});
      if(res.status==="applied"){
        renderWorkout();
        closeExActionsSheet();
      }
    }
  };

  const exActionSkip=$("#exActionSkipBtn");
  if(exActionSkip)exActionSkip.onclick=async()=>{
    const id=activeExActionsId;
    if(id&&activeWorkoutDraft){
      const isSkipped=activeWorkoutDraft.exercises[id]?.status==="skipped";
      const type=isSkipped?"restoreExercise":"skipExercise";
      const res=await WorkoutSession.dispatch(type,{exerciseInstanceId:id});
      if(res.status==="applied"){
        renderWorkout();
        closeExActionsSheet();
      }
    }
  };

  const exActionNotes=$("#exActionNotesBtn");
  if(exActionNotes)exActionNotes.onclick=()=>{
    const id=activeExActionsId;
    closeExActionsSheet().then(()=>{
      if(id)openExNoteSheet(id);
    });
  };

  const exActionsClose=$("#exActionsClose");
  if(exActionsClose)exActionsClose.onclick=closeExActionsSheet;
  const exActionsScrim=$("#exActionsScrim");
  if(exActionsScrim)exActionsScrim.onclick=closeExActionsSheet;

  InstalledEditorView.bind();
  const histExport=$("#historyExportBtn");if(histExport)histExport.onclick=exportCsv;
  const restRow=$("#restSecRow");if(restRow)restRow.onclick=()=>setDisclosure(restRow,$("#restSecPanel"),!$("#restSecPanel")?.classList.contains("is-open"));
  const rirRow=$("#rirModeRow");if(rirRow)rirRow.onclick=()=>setDisclosure(rirRow,$("#rirModePanel"),!$("#rirModePanel")?.classList.contains("is-open"));
  const progRow=$("#progressionRow");if(progRow)progRow.onclick=()=>setDisclosure(progRow,$("#progressionDetails"),!$("#progressionDetails")?.classList.contains("is-open"));
  const notifyCfg=$("#notifyConfigRow");if(notifyCfg)notifyCfg.onclick=()=>setDisclosure(notifyCfg,$("#notifyTypes"),!$("#notifyTypes")?.classList.contains("is-open"));
  const dataBackup=$("#dataBackupRow");if(dataBackup)dataBackup.onclick=()=>{
    const open=!$("#dataBackupPanel")?.classList.contains("is-open");
    setDisclosure(dataBackup,$("#dataBackupPanel"),open);
    if(open)requestAnimationFrame(()=>maybeShowContextualGuides(["backup"]));
  };
  const profileRow=$("#profileRow");if(profileRow)profileRow.onclick=()=>setDisclosure(profileRow,$("#profilePanel"),!$("#profilePanel")?.classList.contains("is-open"));
  const profileClear=$("#profileClear");if(profileClear)profileClear.onclick=()=>clearProfile();
  const dataImport=$("#dataImportRow");if(dataImport)dataImport.onclick=()=>setDisclosure(dataImport,$("#dataImportPanel"),!$("#dataImportPanel")?.classList.contains("is-open"));
  [["#restSecRow","#restSecPanel"],["#rirModeRow","#rirModePanel"],["#progressionRow","#progressionDetails"],["#notifyConfigRow","#notifyTypes"],["#dataBackupRow","#dataBackupPanel"],["#profileRow","#profilePanel"],["#dataImportRow","#dataImportPanel"]].forEach(([b,p])=>setDisclosure($(b),$(p),false));
  setDisclosure($("#guideReplayToggle"),$("#guideReplayPanel"),false);
  const commitChangedSettings=()=>{settingsView().touch();return commitSettings(true)};
  $("#settings").addEventListener("input",()=>settingsView().touch());
  const voiceTog=$("#voiceToggle");if(voiceTog)voiceTog.onclick=()=>{const c=$("#voiceInputEnabled");if(c){c.checked=!c.checked;commitChangedSettings()}};
  const telemetryTog=$("#telemetryToggle");if(telemetryTog)telemetryTog.onclick=()=>{
    try{Telemetry?.setEnabled(!(Telemetry?.isEnabled?.()!==false))}catch{}
    renderSettings()};
  const notifyTog=$("#notifyToggle");if(notifyTog)notifyTog.onclick=()=>{
    const on=notificationControls().pending()||notifyEffective();
    setNotificationsEnabled(!on)};
  const onbCancel=$("#onbCancel");if(onbCancel)onbCancel.onclick=()=>requestEntryCancel();
  window.addEventListener("popstate",onEntryPopState);
  document.addEventListener("visibilitychange",onAppVisible);
  $("#glossary .glossary__close").onclick=()=>closeGlossary();
  document.addEventListener("click",e=>{const g=$("#glossary");if(!g||g.classList.contains("hidden"))return;
    if(!g.contains(e.target)&&!e.target.closest("[data-term]"))closeGlossary({restore:false})});
  document.addEventListener("keydown",e=>{
    if(e.key!=="Escape"||e.defaultPrevented)return;
    if(closeGlossary())e.preventDefault()});
  // Comma decimals from locale keypads: rewrite digit-comma-digit to a period
  // as the user types so steppers, drafts, and saves all see a parseable value.
  document.addEventListener("input",e=>{
    const t=e.target;if(!(t instanceof HTMLInputElement))return;
    if((t.getAttribute("inputmode")||t.inputMode)!=="decimal")return;
    const next=t.value.replace(/(\d),(\d)/g,"$1.$2");
    if(next===t.value)return;
    const s=t.selectionStart,en=t.selectionEnd;t.value=next;
    if(s!=null)try{t.setSelectionRange(s,en)}catch{}});
  $$("[data-term]").forEach(b=>{if(!b.onclick&&!b.closest("#workout"))b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)}});
  applyDraftContextToDom();
  updateBodyweightField();
  const vBtn=$("#voiceBtn");if(vBtn)vBtn.onclick=()=>{closeWorkoutOverflow();startVoiceInput()};
  updateVoiceBtn();
  $("#logForm").addEventListener("submit",(e)=>{e.preventDefault();saveWorkout(e)});
  ProgramUi.bind();
  $("#importProgram").onchange=importProgramFile;
  $("#endBlock").onclick=promptEndBlock;
  $("#saveSettings").onclick=()=>commitSettings(false);
  $("#createProgram").onclick=()=>startOnboarding("settings");
  $("#onbBack").onclick=()=>entryBack();
  $("#onbNext").onclick=()=>entryAdvance();
  ["#jumpPct","#minJump","#rirHigh","#hardRir","#restSec","#unit","#lang"].forEach(sel=>$(sel).onchange=commitChangedSettings);
  // Appearance lives in UI prefs, so it never joins a state proposal.
  const themeSel=$("#theme");if(themeSel)themeSel.onchange=()=>setTheme(themeSel.value);
  $$('input[name="rirMode"]').forEach(r=>r.onchange=commitChangedSettings);
  const vi=$("#voiceInputEnabled");if(vi)vi.onchange=commitChangedSettings;
  const ne=$("#notifyEnabled");
  if(ne)ne.onchange=()=>setNotificationsEnabled(!!ne.checked);
  ["#notifyTimer","#notifySession","#notifyUnfinished","#notifyMissed"].forEach(sel=>{const el=$(sel);if(el)el.onchange=commitChangedSettings});
  wireStatsTabs();
  const lc=$("#logContext");if(lc)lc.onclick=()=>{navTo("stats");setStatsSeg("review")};
  $("#exportCsv").onclick=exportCsv;$("#exportJson").onclick=exportJson;$("#importJson").onchange=importJson;
  $("#reset").onclick=async()=>{
    const discardDraftRaw=readDraftRaw();
    if(confirm(t("confirm.delete_log")))await deleteTrainingLog(storageIO,{discardDraftRaw})};
  $$("nav button").forEach(b=>b.onclick=()=>{
    if(InstalledEditorView.requestNavigation(b.dataset.view))return;
    ExerciseUi?.reset();workoutActive=false;workoutLeft=true;
    // Progress remembers its segment, so arriving there can itself open the review.
    const opensReview=b.dataset.view==="stats"&&ProgressUi.state().segment==="review"&&!ProgressUi.state().evidence&&!$("#stats")?.classList.contains("active");
    document.body.classList.remove("is-settings","is-exercise","is-onboarding","is-workout");
    $$("nav button").forEach(x=>{const on=x===b;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===b.dataset.view));window.scrollTo({top:0});render();
    if(opensReview)captureBlockReviewViewed()});
  $("#exBack").onclick=closeExerciseView;
  $("nav button.active")?.setAttribute("aria-current","page");
  render();
  maybeUnfinishedOnOpen();
  // First run puts the install first and the program choice second. Where there
  // is no install to offer, the gate would add a step and nothing else, so
  // onboarding opens exactly as it always has.
  if(!maybeShowFirstRun()){
    maybeShowOnboarding();
    if(!$("#onboarding").classList.contains("active"))maybeShowInstallBanner()}
  // Explicit gesture controller lifetime (Candidate D / R2)
  if (window.RepForgeMotion?.mountGestureController) {
    window.__repforgeGestureHandle = window.RepForgeMotion.mount();
  } else {
    window.__repforgeGestureHandle = mountFallbackGestures();
  }

  // The one signal that the whole boot pipeline — replica recovery, first-run
  // persistence, the first render — has finished. Test gates used to wait for a
  // day tab, which a device with no program never grows.
  window.__repforgeBooted=true;
}
function applyGotoParam(){
  try{
    const u=new URL(location.href);
    const g=u.searchParams.get("goto");
    if(g && days().includes(g)) day=g;
    if(u.searchParams.has("goto")){
      u.searchParams.delete("goto");
      history.replaceState({}, "", u.pathname+u.search+u.hash);
    }
  }catch{}
}

let storageRecoveryView;
function presentStorageRecovery(decision){
  storageRecoveryView||=createStorageRecoveryView({window,commands:createStorageRecoveryCommands({durable:DurableState}),
    t,countText,i18n:I18N,files:{exportRaw:(raw,name)=>download(encodeRawExport(raw),name,"application/json")},
    shell:{openModal,closeModal},returnFocus:()=>todayPrimaryControl});
  return storageRecoveryView.present(decision)}
async function resolveBootReplicas(candidate=null){return DurableState.resolveBootReplicas(candidate)}
async function settlePendingJournal(){return DurableState.settlePendingJournal()}
async function applyBootDecision(decision){
  const bootSnapshot=normalizeLoaded(decision.kind==="first-run"?null:decision.snapshot);
  bootSnapshot.program=makeProgram(bootSnapshot.program,snapshotLookup(bootSnapshot.customExercises),bootSnapshot.programMeta).toJSON();
  bootSnapshot.programMeta=normalizeProgramMeta(bootSnapshot.programMeta,bootSnapshot.log,bootSnapshot.program,{customExercises:bootSnapshot.customExercises});
  publishTrainingSnapshot(bootSnapshot);
  resetPersistenceBase(decision.kind==="first-run"?state:decision.snapshot);
  await refreshRecoveryProjectionCache(state);
  await DraftStore.promote(null,draftContextFingerprint(state));
  day=days()[0]||"Day 1";
  applyGotoParam();
  // An accepted cross-tab update may have arrived during the awaits above.
  // Migrate a copy of the current published head, never the stale boot candidate.
  const migratedSnapshot=cloneSnapshot(applicationSession.read());
  const migrated=migrateLogSnapshot(migratedSnapshot);
  if(migrated)publishTrainingSnapshot(migratedSnapshot);
  const metaDrift=decision.snapshot&&canonicalPayload({programMeta:decision.snapshot.programMeta})!==canonicalPayload({programMeta:state.programMeta});
  const revisionless=decision.snapshot&&!Object.prototype.hasOwnProperty.call(decision.snapshot,STORAGE_REV);
  if(decision.kind==="first-run"||decision.migrate||revisionless||migrated||metaDrift||decision.recoveryChanged)await persistBootNormalization();
  if(I18N)I18N.setLang(resolveLang())}
window.__repforgeSharedSetup={
  get status(){return sharedSetupDraft.status},
  get source(){return sharedSetupDraft.source},
  get error(){return sharedSetupDraft.error},
  get summary(){return sharedSetupDraft.payload?{
    name:sharedSetupDraft.payload.program.name,
    daysPerWeek:sharedTrainingDays(sharedSetupDraft.payload.program.definition),
    lang:sharedSetupDraft.payload.settings.lang}:null},
  build:()=>programSharing.buildPayload(),
  buildPayload:()=>programSharing.buildPayload(),
  buildValidation:()=>programSharing.buildValidation(),
  commit:io=>commitSharedSetup(io||storageIO),
  eligible:sharedSetupEligible};
function captureSharedSetupSource({allowCookie=true}={}){
  if(!SharedSetup)return null;
  try{
    const fragment=SharedSetup.readSetupFragment();
    if(fragment!=null){
      sharedSetupDraft={status:"loading",source:"fragment",encoded:null,payload:null,error:null,previousLang:null};
      return{source:"fragment",encoded:fragment}}
    if(!allowCookie)return null;
    const cookie=SharedSetup.readHandoffCookie();
    if(cookie){
      sharedSetupDraft={status:"loading",source:"cookie",encoded:null,payload:null,error:null,previousLang:null};
      return{source:"cookie",encoded:cookie}}
    return null}
  catch{
    sharedSetupDraft={status:"invalid",source:null,encoded:null,payload:null,error:"invalid-schema",previousLang:null};
    return null}}
let sharedSetupDecodeRequest=0,sharedSetupDecodeController=null;
function cancelSharedSetupDecode(){
  sharedSetupDecodeRequest++;
  sharedSetupDecodeController?.abort();
  sharedSetupDecodeController=null}
function clearSharedSetupHandoffIfMatches(encoded){
  try{if(SharedSetup.readHandoffCookie()===encoded)SharedSetup.clearHandoffCookie()}catch{}}
/* Owner decision (2026-10-13): "Create a program from scratch" discards the
   received proposal. The cookie and any fragment go, so a reload cannot bring
   it back; nothing from it was ever written, and its language is not kept. */
function discardSharedSetup(){
  cancelSharedSetupDecode();
  try{SharedSetup?.clearHandoffCookie?.()}catch{}
  try{if(SharedSetup?.readSetupFragment?.()!=null)history.replaceState({},"",SharedSetup.removeSetupFragment())}catch{}
  if(entryState?.route==="shared"){clearEntryAdjust();publishEntryDraft(null)}
  sharedSetupDraft={status:"none",source:null,encoded:null,payload:null,error:null,previousLang:null};
  syncLang()}
async function prepareSharedSetup(candidate){
  if(!candidate||!SharedSetup)return false;
  sharedSetupDecodeController?.abort();
  const request=++sharedSetupDecodeRequest,controller=new AbortController();
  sharedSetupDecodeController=controller;
  const isCurrent=()=>request===sharedSetupDecodeRequest&&!controller.signal.aborted;
  const {source,encoded}=candidate;
  let staged=false,matchingCookie=false;
  try{matchingCookie=SharedSetup.readHandoffCookie()===encoded}catch{}
  if(source==="fragment"&&typeof encoded==="string"&&
    encoded.length<=SharedSetup.MAX_ENCODED_CHARS){
    try{
      staged=SharedSetup.writeHandoffCookie(encoded)===true;
      if(staged&&location.pathname===SharedSetup.handoffCookiePath())
        staged=SharedSetup.readHandoffCookie()===encoded}
    catch{staged=false}}
  let decoded;
  try{decoded=await SharedSetup.decode(encoded,sharedSetupDecodeCodecOptions(controller.signal))}
  catch(error){
    if(error?.name==="AbortError"||!isCurrent())return false;
    decoded={ok:false,code:"invalid-schema"}}
  if(!isCurrent())return false;
  if(!decoded.ok){
    if(source==="cookie"||staged||matchingCookie)clearSharedSetupHandoffIfMatches(encoded);
    const unsupported=decoded.code==="unsupported-version"||decoded.code==="decompression-unavailable";
    sharedSetupDraft={status:unsupported?"unsupported":"invalid",source,encoded:null,payload:null,
      error:decoded.code,errorVersion:decoded.version??null,previousLang:null};
    return true}
  if(source==="fragment"&&staged){
    if(SharedSetup.readSetupFragment()!==encoded)return false;
    const next=SharedSetup.removeSetupFragment();
    history.replaceState({},"",next)}
  if(!sharedSetupEligible()){
    // The handoff cookie only exists to carry a link into first run. A device
    // that cannot accept it must not keep it waiting for a later data wipe.
    if(source==="cookie"||staged||matchingCookie)clearSharedSetupHandoffIfMatches(encoded);
    sharedSetupDraft={status:source==="fragment"?"existing":"none",source,encoded:null,payload:null,
      error:source==="fragment"?"existing":null,previousLang:null};
    return true}
  const previousLang=I18N?.getLang?.()||state.settings.lang||I18N?.detectLang?.()||"en";
  sharedSetupDraft={status:"ready",source,encoded,payload:decoded.value,error:null,previousLang};
  I18N?.setLang(decoded.value.settings.lang);
  return true}
async function handleSharedSetupHash(){
  const candidate=captureSharedSetupSource({allowCookie:false});
  if(!candidate||candidate.source!=="fragment"){
    cancelSharedSetupDecode();
    return}
  if(firstRunOpen())suspendFirstRun();
  if(!await prepareSharedSetup(candidate))return;
  if(sharedSetupDraft.status==="existing"){
    closeFirstRun();toast(t("setup.shared.existing"),{assertive:true});return}
  applyI18n();
  // A shared fragment can finish its asynchronous hash handoff after the
  // Start action has already entered the common preview. Do not reopen the
  // first-run gate over that preview.
  if(firstRunPending()&&!entryState)openFirstRun()}
async function boot(){
  ensureBrowserPresentation().shell.mount();
  await mountDashboardPresentation();
  // The full source catalog is an offline shell asset. Load it before state
  // normalization or any program surface can consume metric/taxonomy details;
  // the synchronous exercise index remains available for first-paint search.
  // A missing producer dependency is not a damaged durable snapshot: stop here
  // before replica resolution, normalization, journal replay or healing writes.
  if(I18N)I18N.setLang(I18N.detectLang());
  if(!await loadExerciseCatalog()){showExerciseCatalogUnavailable();return}
  initializePersistenceOwners();
  // Program metadata and the first render are built from the loaded state, so
  // the language has to be settled before that — not after the state exists.
  const sharedCandidate=captureSharedSetupSource();
  const transferResult=await TransferCommands.boot({
    hasPreBootRequest:window.__repforgeInstallTransferPreBootRequest!==undefined,
    takePreBootRequest:()=>{const request=window.__repforgeInstallTransferPreBootRequest;
      delete window.__repforgeInstallTransferPreBootRequest;return request},
    loadTraining:async()=>{
      let decision=await resolveBootReplicas();
      while(decision.kind==="unresolved"){
        const candidate=await presentStorageRecovery(decision);
        decision=await resolveBootReplicas(candidate)}
      await applyBootDecision(decision);return decision}
  });
  if(transferResult?.ok!==true){
    window.__repforgeBootFailure=transferResult;
    if(transferResult.productRecovery!==true)throw new Error(transferResult?.code||"install-transfer-failed");
    const blockedImportMarker=await installTransferReadMarker();
    if(blockedImportMarker){
      openIosInstallSheet("interrupted");
      return;
    }
    if(!state){
      const recoveredSnapshot=normalizeLoaded(null);
      recoveredSnapshot.program=makeProgram(recoveredSnapshot.program,snapshotLookup(recoveredSnapshot.customExercises),recoveredSnapshot.programMeta).toJSON();
      recoveredSnapshot.programMeta=normalizeProgramMeta(recoveredSnapshot.programMeta,recoveredSnapshot.log,recoveredSnapshot.program,{customExercises:recoveredSnapshot.customExercises});
      publishTrainingSnapshot(recoveredSnapshot);
      resetPersistenceBase(state);day=days()[0]||"Day 1";
      if(I18N)I18N.setLang(resolveLang())}
    init();
    const failureState=transferResult.code==="destination-meaningful"?"destination"
      :transferResult.state==="terminalUnavailable"||["service-unavailable","transfer-cookie-missing","claim-credential-invalid"].includes(transferResult.code)?"terminal"
      :"interrupted";
    openIosInstallSheet(failureState);
    return}
  const decision=transferResult.decision;
  bootTelemetry();
  if(transferResult.transferResult?.localOk===true){
    try{
      Telemetry?.recordLateInstallTransfer?.({
        state: transferResult.transferResult.state||"localCommitted",
        localImportVerified: true,
        cleanupRetry: transferResult.transferResult.cleanupRetry===true,
        platform_class: telemetryPlatformClass(),
      });
    }catch{}
  }
  if(!isStandalone()){
    await installTransferCheckOutboundOnBoot();
  }
  installTransferRecordBootDevice();
  await recoverCommittedSetupDraft();
  await prepareSharedSetup(sharedCandidate);
  const draftBoot=await initializeWorkoutDraft({restoreDay:true});
  if(draftBoot.status==="ready")hydrateWorkoutDraft({restoreDay:true});
  resumeProgramEditFollowUp();
  init();
  if(transferResult.transferResult?.localOk===true){
    openIosInstallSheet(transferResult.transferResult.cleanup?.ok===true?"success":"cleanup")}
  if(draftBoot.status!=="ready"&&draftBoot.status!=="absent")showDraftInitializationRecovery(draftBoot);
  captureEvent("app_boot",{first_run:firstRunPending(),language:I18N?.getLang?.()==="pt"?"pt":"en",platform_class:telemetryPlatformClass(),display_mode:isStandalone()?"standalone":"browser"});
  if(sharedSetupDraft.status==="existing")toast(t("setup.shared.existing"),{assertive:true});
  if(decision.draftConflict)toast(t("toast.draft_conflict_retry"),{assertive:true})}

boot();

let BackupCommands,backupUi=null;
function backupView(){return backupUi||(backupUi=createBackupView({window,commands:BackupCommands,
  copy:{t,tOne,tp},shell:{openModal,closeModal,canTakeFocus},toast,
  onImported:kind=>{if(kind==="replace"){resetDraftSessionState();day=days()[0]||"Day 1";syncLang()}
    leaveSetupGates();render()}}))}
let programAdditionCommands;
function initializePersistenceOwners(){
  if(DurableState)return;
  initializeWorkoutCommands();
  const now=()=>new Date().toISOString();
  const model=TrainingModel=createProgramModel({catalog:rawExerciseCatalog,
    librarySource:{library:EXERCISE_LIBRARY,legacyIds:LEGACY_LIBRARY_IDS},nextId:uid,now,
    calendarDate:today,language:()=>uiLang(),defaultExerciseName:()=>t('program.default.exercise')});
  programSharing=createProgramSharing({read:applicationSession.read,model,codec:SharedSetup,
    codecOptions:sharedSetupCodecOptions(),date:today,language:uiLang,locale:locTag,location,
    format:{t,muscleLabel,exerciseName:exerciseDisplayName}});
  programSharingView=createProgramSharingView({window,commands:programSharing,files:Files,
    shell:{openModal,closeModal,activeModal:()=>shellView().activeModal},reducedMotion,t,
    programName:()=>applicationSession.read().programMeta?.name||t('untitled_program'),toast,report:captureEvent});
  initializeBlockTransitionCommands(model);
  workoutReadModel=createWorkoutReadModel({catalog:rawExerciseCatalog,librarySource:{library:EXERCISE_LIBRARY},model});
  ProgressReadModels=createProgressReadModels({training:model,copy:{t},format:{locale:locTag,exercise:liftDisplayName,muscle:muscleLabel,shortDate,longDate,displayLoad:toDisplay,number:fmt}});
  blockReview=createBlockReview({model,queries:workoutReadModel});
  const entry=createEntryRules(rawExerciseCatalog),workout=createWorkoutRules(rawExerciseCatalog);
  EntryDraft=createSetupDraftStore({rules:ProgramEntry,storage:localStorage,
  lock:operation=>withStorageLock(storageIO,operation),ownerId:uid(),onFailure:reportSetupDraftWriteFailure,
  onSaved:()=>{if(entryUiNotice==="save_failed"||entryUiNotice==="save_conflict")entryUiNotice=null}});
  EntrySetup=createEntrySetup({rules:ProgramEntry,store:EntryDraft,nextId:uid,now:entryNow,
    context:()=>({versions:entryVersions(),activeProgramRevision:liveProgramRevision()}),mutationFrozen:installTransferMutationFrozen,
    onUpdate:next=>{entryState=next},onFailure:reportSetupDraftWriteFailure,onDiagnostic:value=>{entryPersistenceDiagnostic=value}});
  const policy=SnapshotPolicy.createSnapshotPolicy({entry,workout,compiler:ProgramCompiler,
    catalog:rawExerciseCatalog,model,transition:generationRules.transition,metrics:PersistenceMetrics,
    progression:PersistenceProgression,now,nextId:uid,language:I18N,digest:recoverySha256});
  customDefinitionImport=createCustomDefinitionImport({model,nextId:uid});
  EntryActivation=createEntryActivation({model,entry,imports:customDefinitionImport,build:createInstalledEditorRules({model,catalog:rawExerciseCatalog,nextId:uid,defaultProgramMeta:policy.defaultProgramMeta,allowCreateDefinition:true}),policy,identity:{programId:uid,blockId:allocateBlockId,now:entryNow,date:today},defaultName:()=>t("untitled_program")});
  ({normalizeMuscleAttribution,isValidMuscleDomainTree,isValidStoredMuscleField,isValidPlannedVolumeHistory,normalizeRecoveryCarrierSnapshot,isSafeProgressionFields,isSafeProgressionMeta,isSafeProgramHistoryEntry,isSafeLogRow,isSafeCustomExercise,isValidSetupActivationMarker,setupActivationMarker,setupActivationMatches,isValidStateShape,migrateLogSnapshot,defaultProgramMeta,normalizeProgramEntrySource,normalizeProgramMeta,normalizeLoadingConfiguration,withExplicitProgramStructure,normalizeProgramHistory,normalizeLoaded,normalizeNotify,normalizeSettings}=policy);
  validateRecoveryProjectionRecord=policy.validateRecoveryProjectionRecord;
  BuildAuthoring=createInstalledEditorRules({model,catalog:rawExerciseCatalog,nextId:uid,defaultProgramMeta,allowCreateDefinition:true});
  InstalledEditor=createInstalledEditor({read:applicationSession.read,model,catalog:rawExerciseCatalog,nextId:uid,
    defaultMeta:defaultProgramMeta,now,refreshHead:refreshPersistenceHead,
    commit:(proposal,options,io=storageIO)=>commitProposedState(proposal,io,options),
    readRecovery:snapshot=>activeRecoveryRecord?.diff?.recoveryWeek?.blockId===snapshot.programMeta?.blockId?activeRecoveryRecord:null,
    drafts:{readRaw:readDraftRaw,hasProgress:draftHasProgress,parse:raw=>WorkoutDraft.parse(raw),clear:destructiveDraftClearEffect,
      rename:draftDayReplacementEffect,removedSetsHaveProgress:draftHasProgressInRemovedSets},
    muscles:{validate:isValidMuscleDomainTree,invalid:invalidMuscleDomainCommit},
    readActiveDraft:()=>activeWorkoutDraft,
    onSettled:(result,{draftBefore})=>{const discarded=result.discardedWorkout===true;
      if(discarded)reportWorkoutDiscarded(activeWorkoutDraft||draftBefore,'program_edit');
      captureEvent('active_program_edited',{outcome:discarded?'discarded_workout':'saved'});
      if(discarded)resetDraftSessionState()}});
  programCommands=InstalledEditor.commands;
  InstalledEditorView=createInstalledEditorView({window,session:InstalledEditor,
    mountEditor:host=>mountedProgramEditor().mountProgramEditor(host,createInstalledProgramEditorAdapter()),
    shell:{openModal,closeModal},t,onChanged:render,onEdit:()=>ProgramUi.renderProgram(),onAccepted:maybeShowInstallBanner,
    entry:{isOpen:()=>setupEditorOpen,cancel:requestEntryCancel}});

  programAdditionCommands=createProgramAdditionCommands({read:applicationSession.read,
    readEditor:programEditorSnapshot,commit:proposal=>commitProposedState(proposal),commitEditor:commitProgramEditorProposal,
    model,authoring:createInstalledEditorRules({model,catalog:rawExerciseCatalog,nextId:uid,defaultProgramMeta})});
  DurableState=createDurableStore({snapshotPolicy:policy,workout,
    session:{getState:applicationSession.read,blockStartGuard:blockStartDraftGuard,
      onDraftRecovery:value=>{workoutDraftRecovery=value}},
    setup:{readRaw:readSetupDraftRaw,rebase:rebaseSharedSetupSnapshot},
    resolveCustomMutationIntent,onAccepted:applyAcceptedSnapshot,
    mutationGate:installTransferMutationFrozen,platform:window});
  storageIO=DurableState.storageIO;DraftStore=DurableState.DraftStore;
  BackupCommands=createBackupCommands({read:applicationSession.read,policy,model,
    drafts:{readRaw:readDraftRaw,clearEffect:destructiveDraftClearEffect},
    commit:(proposal,options,io)=>commitProposedState(proposal,io||storageIO,options),
    files:Files,csv:{readLogRow,exerciseLabel,rowMuscles,e1rm},now,date:today,onExported:renderSettings});

  const transferContract=createTransferContract({compiler:ProgramCompiler,entry:ProgramEntry,metrics:ExerciseMetrics,
    workout:WorkoutDraft,catalog:rawExerciseCatalog,crypto:window.crypto,TextEncoder,TextDecoder});
  const transferClient=createInstallTransfer({crypto:window.crypto,TextEncoder,TextDecoder,document,location:window.location,
    navigator,matchMedia:window.matchMedia?.bind(window),fetch:window.fetch?.bind(window),indexedDB,
    atob,btoa,now:()=>new Date().toISOString()});
  TransferCommands=createInstallTransferCommands({device:transferDevice,durable:DurableState,snapshotPolicy:policy,
    programModel:model,workoutRules:WorkoutDraft,entryRules:ProgramEntry,setupDraftStore:EntryDraft,
    trainingSession:applicationSession,entrySession:{read:()=>entryState,publish:publishEntryDraft},
    workoutSession:{current:()=>activeWorkoutDraft,flush:()=>WorkoutSession.flush(),writer:draftWriter,
      readAcknowledged:readLiveAcknowledgedDraftV2,adopt:(draft,raw)=>{
        activeWorkoutDraft=draft;activeWorkoutDraftRaw=raw;draftUiRecovery=null}},
    transfer:transferClient,contract:transferContract,telemetry:Telemetry,
    telemetryTransport:{restartIfStarted:()=>{if(installTransferTelemetryBooted)bootTelemetry()}},
    guideDefinitions:GuideRegistry?.GUIDE_DEFINITIONS||[],
    commit:(proposal,options)=>commitProposedState(proposal,storageIO,options),
    onDeviceChanged:()=>{uiPrefs=loadUiPrefs()},onProgress:change=>installView().transferProgress(change),
    fault:point=>{const hook=window.__repforgeInstallTransferImportFault;
      if(typeof hook==="function"&&hook(point)===true)throw new Error(`install-transfer-import-fault:${point}`);
      if(hook===point)throw new Error(`install-transfer-import-fault:${point}`)}});

  DurableState.addStorageHealthListener(noteWriteHealth);
  window.__repforgeStorage.durable=DurableState;
  programFormCommands=createProgramFormCommands({read:applicationSession.read,model,
    editor:{read:programEditorSnapshot,isSetup:()=>setupEditorOpen,
      commit:(proposal,opts={})=>commitProgramEditorProposal(proposal,storageIO,opts)},
    drafts:{readRaw:readDraftRaw,hasProgress:draftHasProgress,resetIdentity:resetWorkoutSessionIdentity,removedSetsHaveProgress:draftHasProgressInRemovedSets,
      preserve:draftPreservationEffect,clear:destructiveDraftClearEffect,rename:draftDayReplacementEffect},
    policy,flush:flushStorage});
  libraryUi=createLibraryController({window,
    queries:{snapshot:applicationSession.read,day:()=>day,libraryEntries:()=>EXERCISE_LIBRARY,
      libraryEntry,pickableExercises,customExercises,programEditorProgram},
    commands:{custom:customExerciseCommands,program:programAdditionCommands},model,
    rules:{muscleTokens:ProgramEntry.MUSCLE_TOKENS,equipment:ProgramEntry.KNOWN_EQUIPMENT,
      customIdPrefix:CUSTOM_ID_PREFIX,normalizeMuscleAttribution:ProgramEntry.normalizeMuscleAttribution},
    copy:{t,tOne},format:{libraryName,muscleLabel,dayLabel,countText,exerciseDisplayName},
    shell:{openModal,closeModal,canTakeFocus,reducedMotion,routePushBegin,routeViewEl,currentViewId,
      resolveReturnFocus,focusRoute,routeHeading,returnToTab,activeModal:()=>shellView().activeModal},
    editor:{setupOpen:()=>setupEditorOpen,focusEntryEditorStatus,showOnboardingView,renderOnboarding,setDayCollapsed:(day,on)=>ProgramUi.setDayCollapsed(day,on),
      synchronizeSetup:()=>{onboardingProgramEditor?.discard?.();updateOnboardingEditorActions()}},
    onChanged:render,onNotice:toast,onCustomCreated:()=>{customCreatedToastAt=performance.now()}});
  ProgramUi=createProgramController({window,library:libraryUi,commands:{form:programFormCommands,program:programCommands},
    queries:{snapshot:applicationSession.read,day:()=>day,program:()=>prog,hasProgramContent,hasActiveProgram,
      programEditorProgram,programEditorSnapshot,defaultProgramMeta,mesocycleWeek,programAdherence,
      programProgressionHealth,programVolumeCompliance,programStatusLabel,dayMuscles,strategyIdFor,recommendation,libraryEntry},
    editor:{setupOpen:()=>setupEditorOpen,installedEditing:()=>InstalledEditorView.editing,
      installedMounted:()=>InstalledEditorView.hasEditor,editInstalled:()=>{InstalledEditorView.setEditing(true)},mountInstalled:()=>InstalledEditorView.mount(),armInstalledHistory:()=>InstalledEditorView.arm(),
      focusEntryEditorStatus,notice:()=>entryUiNotice,entryState:()=>entryState,
      activationIssues:()=>ProgramEntry.candidateActivationIssues(entryState),saveDraft:()=>persistSetupDraft(entryState),
      activate:activateEntryPreview,endBlock:promptEndBlock},
    preferences:{read:()=>uiPrefs,set:setUiPref},copy:{t,tOne},
    format:{exerciseDisplayName,libraryName,dayLabel,muscleLabel,countText,fmtLoad,unitLabel,mesocycleWeekCopy,programPrescriptionSummary,fmt},
    actions:{openExerciseView,openProgramTextSheet:()=>programSharingView.openText(),openShareSetupSheet:()=>programSharingView.openSetup()},
    onChanged:render,onNotice:toast,onDayChanged:value=>{day=value},onSetupRequested:startOnboarding,
    onWorkoutChanged:()=>{updateGauge();updateSaveMeta()},
    onDraftRemoved:()=>{resetDraftSessionPresentation();stopRest()}});


}

let settingsCommandsOwner=null,settingsUiOwner=null,notificationUiOwner=null,settingsDraftEffectsOwner=null;
function settingsDraftEffects(){return settingsDraftEffectsOwner||(settingsDraftEffectsOwner=createSettingsDraftEffects({workout:WorkoutDraft,
  outcome:draftEffectOutcome,writer:draftWriter,operationId:uid,now:()=>new Date().toISOString()}))}
function settingsCommands(){return settingsCommandsOwner||(settingsCommandsOwner=createSettingsCommands({
  read:applicationSession.read,commit:(proposal,options,io=storageIO)=>commitProposedState(proposal,io,options),
  policy:{normalizeSettings,normalizeProfile:value=>ProgramEntry.normalizeProfile(value)},draft:{readRaw:readDraftRaw,hasProgress:draftHasProgress,unitEffect:(raw,oldUnit,newUnit)=>settingsDraftEffects().unitEffect(raw,oldUnit,newUnit)},report:captureEvent,revision:readRevision}))}
function notificationControls(){return notificationUiOwner||(notificationUiOwner=createNotificationControls({window,
  settings:settingsCommands(),capability:{permission:()=>Notifications?Notifications.permission():"unsupported",
    request:()=>Notifications?Notifications.request():Promise.resolve("unsupported")},t}))}
function settingsView(){return settingsUiOwner||(settingsUiOwner=createSettingsView({window,settings:settingsCommands(),
  i18n:{t,getLang:uiLang,normalizeLang:value=>I18N?.normalizeLang(value)},appearance:appearanceView(),notifications:notificationControls(),
  install:{decision:installPolicyDecision,mode:installMode},guides:guidesView(),telemetry:Telemetry||{},
  storage:{health:()=>DurableState.getStorageHealth(),raw:()=>localStorage.getItem(KEY)},shell:{setDisclosure},toast,
  onSaved:({before,after,current})=>{
    if(before.restSec!==after.restSec)focusRest.length=0;
    if(before.unit!==after.unit){const bw=$("#sessionBodyweight");if(bw&&bw.value!==""){const n=parseDec(bw.value);
      if(Number.isFinite(n))bw.value=fmtPlain(toDisplayUnit(fromDisplayUnit(n,before.unit),after.unit))}}
    if(before.lang!==after.lang&&I18N)I18N.setLang(after.lang);
    if(current)render();
  }}))}

let installUiOwner=null;
function abandonUnsealedInstallTransfer(){return TransferCommands.abandonUnsealed()}
function installView(){return installUiOwner||(installUiOwner=createInstallView({window,t,language:uiLang,policy:InstallPolicy,
  read:()=>{const meaningful=installTransferStateMeaningful(state);return {hasMeaningfulData:meaningful,transferMeaningful:meaningful||installTransferDeviceMeaningful(),savedWorkoutsCount:new Set((state?.log||[]).filter(isWork).map(row=>row.session)).size,
    transferAvailable:typeof navigator.locks?.request==="function"&&!!window.crypto?.subtle,firstRunActive,
    onboardingEdit:state?.[STORAGE_FOLLOWUP]?.kind==="onboarding-edit",onboardingOpen:$("#onboarding")?.classList.contains("active")}},
  preferences:{read:()=>uiPrefs,replace:replaceUiPrefs},
  transfer:{marker:installTransferOutboundMarker,create:installTransferCreateFromSafari,
    confirmDivergence:installTransferConfirmDivergence,abandonUnsealed:abandonUnsealedInstallTransfer},
  shell:{openModal,closeModal,canTakeFocus,reducedMotion,get activeModal(){return shellView().activeModal}},
  guides:{maybeShow:maybeShowContextualGuides},report:captureEvent,toast,onChanged:renderSettings,onLandingOffer:setFirstRunOffer}))}
