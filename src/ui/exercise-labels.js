/** @typedef {{id:string,name:string,namePt?:string}} LabelEntry
 * @typedef {{name?:unknown,displayName?:unknown,libraryId?:unknown,performedName?:unknown,performedLibraryId?:unknown,session?:unknown}} NamedExercise
 */
/** Display-only names never rewrite durable movement identity or stored names.
 * @param {{builtIns:ReadonlyMap<string,LabelEntry>,readCustom:()=>readonly LabelEntry[],language:()=>string}} options */
export function createExerciseLabels({builtIns,readCustom,language}){
  /** @param {unknown} name @param {unknown} libraryId */
  function movementName(name,libraryId){
    const stored=String(name??'');if(language()!=='pt'||libraryId==null||libraryId==='')return stored;
    const id=String(libraryId),entry=id.startsWith('custom:')?readCustom().find(entry=>entry.id===id):builtIns.get(id);
    return entry&&entry.namePt&&stored===entry.name?entry.namePt:stored;
  }
  /** @param {NamedExercise|null|undefined} item */
  function exercise(item){
    if(!item)return '';
    if(item.performedLibraryId!==undefined||item.performedName!==undefined||item.session!==undefined)
      return movementName(String(item.performedName||item.name||''),item.performedLibraryId);
    return movementName(item.name??item.displayName,item.libraryId);
  }
  /** @param {unknown} name @param {unknown} key */
  function lift(name,key){const id=String(key??'');return id.startsWith('library:')?movementName(name,id.slice(8)):String(name??'');}
  return {movementName,exercise,lift};
}
