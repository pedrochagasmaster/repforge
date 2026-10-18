import {boundedImportJson} from './json.js';
export const BACKUP_MAX_BYTES=16*1024*1024;
export const BACKUP_MAX_NODES=2000000;
/** Full backup policy includes durable profile/history; device preferences and
 * ephemeral tab sessions never enter the durable snapshot supplied here.
 * exportValue must be persistence.exportableState(snapshot); app orchestration
 * applies that policy before this serializer (interchange cannot import storage). */
export function backupFile(exportValue,date){
  return {text:JSON.stringify(exportValue),name:`taurifer_backup_${date}.json`};
}
export function parseBackupFile(text,isImportableState){
  const parsed=boundedImportJson(text,{maxBytes:BACKUP_MAX_BYTES,maxNodes:BACKUP_MAX_NODES});
  return isImportableState(parsed)?parsed:null;
}
/** Legacy flat programs cannot be restored wholesale into the canonical engine.
 * Their rows can still enter the distinct authoring review/matching path. */
export function isLegacyBackup(snapshot,{normalizeCustomExercises,canonicalProgramDefinition,compilerCustomDefinitions}){
  const rows=Array.isArray(snapshot?.program)?snapshot.program:[];
  if(!rows.length)return false;
  const definition=snapshot?.programMeta?.programDefinition;
  if(!definition)return true;
  const customs=normalizeCustomExercises(snapshot.customExercises||[]);
  return !canonicalProgramDefinition(definition,compilerCustomDefinitions(customs));
}
