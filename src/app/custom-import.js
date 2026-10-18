import {cloneSnapshot,foldExerciseName} from '../training/model.js';
/** @typedef {ReturnType<typeof import('../training/model.js').createProgramModel>} Model
 * @typedef {import('../persistence/contracts.js').CustomExercise} CustomExercise
 * @typedef {import('../training/model.js').ExerciseInput} Exercise
 * @typedef {(byId:ReadonlyMap<string,CustomExercise>)=>string} Allocator
 */
/** Imported definitions reuse equivalent authored movements and remap actual
 * collisions. Existing records retain their extension fields. The caller owns
 * the proposed exercise rows and explicitly grants mutation of libraryId.
 * @param {{model:Pick<Model,'normalizeCustomExercises'>,nextId:()=>string}} options */
export function createCustomDefinitionImport({model,nextId}){
 /** @param {unknown} value */
 const equipment=value=>Array.isArray(value)?value.join(','):'';
 /** @param {CustomExercise} a @param {CustomExercise} b */
 const same=(a,b)=>foldExerciseName(a.name)===foldExerciseName(b.name)&&a.primary===b.primary&&a.secondary===b.secondary&&Array.isArray(a.equipment)&&Array.isArray(b.equipment)&&equipment(a.equipment)===equipment(b.equipment);
 /** @param {ReadonlyMap<string,CustomExercise>} byId */
 function allocateDefault(byId){let id;do{id=`custom:${nextId()}`}while(byId.has(id));return id}
 /** @param {{incoming:unknown,exercises:Exercise[],existing:CustomExercise[],allocate?:Allocator}} input */
 function merge({incoming,exercises,existing,allocate=allocateDefault}){
  const normalized=model.normalizeCustomExercises(incoming),mine=existing.map(cloneSnapshot),byId=new Map(mine.map(item=>[item.id,item]));
  /** @type {Map<string,string>} */const remap=new Map();let added=0,remapped=0;
  for(const entry of normalized){
   const found=byId.get(entry.id);
   if(found){
    if(same(found,entry))continue;
    const minted={...cloneSnapshot(entry),id:allocate(byId)};
    mine.push(minted);byId.set(minted.id,minted);remap.set(entry.id,minted.id);added++;remapped++;continue;
   }
   const twin=mine.find(item=>same(item,entry));
   if(twin){if(twin.id!==entry.id)remap.set(entry.id,twin.id);continue}
   mine.push(entry);byId.set(entry.id,entry);added++;
  }
  if(remap.size)for(const row of exercises)if(row?.libraryId&&remap.has(row.libraryId))row.libraryId=remap.get(row.libraryId);
  return{customExercises:mine,added,remapped,remap};
 }
 return Object.freeze({merge});
}
