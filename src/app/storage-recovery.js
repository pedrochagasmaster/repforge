/** Concrete recovery actions for the two durable replicas. A view never clears
 * storage or manufactures a chosen snapshot from a displayed label. */
/** @typedef {import('../persistence/contracts.js').SnapshotChoice} Choice
 * @typedef {Extract<Choice,{kind:'unresolved'}>} Unresolved
 * @typedef {import('../persistence/contracts.js').StoredSnapshot} Snapshot
 * @typedef {import('../persistence/contracts.js').ReplicaRead} Replica
 */
/** @param {{durable:Pick<ReturnType<typeof import('../persistence/durable.js').createDurableStore>,'readLocalStatus'|'readIdbStatus'|'chooseSnapshot'|'clearPrimaryReplicas'|'clearAllPendingJournal'>}} options */
export function createStorageRecoveryCommands({durable}){
 async function retry(){return durable.chooseSnapshot(durable.readLocalStatus(),await durable.readIdbStatus())}
 /** @param {Unresolved} decision @param {'local'|'idb'} source @returns {Extract<Choice,{kind:'chosen'}>|null} */
 function choose(decision,source){const read=decision[source];return read.status==='valid'?{kind:'chosen',snapshot:read.parsed,source,heal:source==='local'?'idb':'local'}:null}
 /** @returns {Promise<Extract<Choice,{kind:'first-run'|'unresolved'}>>} */
 async function startFresh(){
  const cleared=await durable.clearPrimaryReplicas();
  // This named result is produced only by clearPrimaryReplicas; other lock
  // refusal outcomes carry no localNow/idbNow fields.
  const local='localNow' in cleared?/** @type {Replica} */(cleared.localNow):durable.readLocalStatus();
  const idb='idbNow' in cleared?/** @type {Replica} */(cleared.idbNow):await durable.readIdbStatus();
  if(local.status==='absent'&&idb.status==='absent'){
   durable.clearAllPendingJournal();return {kind:'first-run'}
  }
  return {kind:'unresolved',reason:'no-valid',local,idb};
 }
 /** @param {Unresolved} decision */
 function languageHint(decision){
  /** @param {unknown} value */
  function language(value){
   if(!value||typeof value!=='object'||!('settings' in value))return '';
   const settings=value.settings;
   return settings&&typeof settings==='object'&&'lang' in settings?String(settings.lang||''):'';
  }
  return language(decision.local.parsed)||language(decision.idb.parsed);
 }
 /** @param {Snapshot} snapshot */
 function summary(snapshot){
  const log=Array.isArray(snapshot.log)?snapshot.log:[];
  const sessions=new Set(log.map(row=>row&&row.session).filter(Boolean)).size;
  const dates=log.map(row=>String(row&&row.date||'')).filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  return {name:String(snapshot.programMeta?.name||'').trim(),sessions,sets:log.length,lastDate:dates.length?dates[dates.length-1]:''};
 }
 return Object.freeze({retry,choose,startFresh,languageHint,summary});
}
