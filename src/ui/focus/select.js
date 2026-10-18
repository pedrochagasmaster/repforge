/** @typedef {{ordinal:number}} TargetSet */
/** @typedef {{exerciseOrder:readonly string[],exercises:Record<string,{setOrder:readonly string[],sets:Record<string,TargetSet>}>}} TargetDraft */
/** Readonly facts shared by Focus rendering and application commands. */
export const FIELD_SEMANTICS=Object.freeze({load:Object.freeze(["loadKg","loadPerSideKg","persistentLoadPerSideKg","assistanceKg"]),reps:Object.freeze(["reps","repsPerSide"])});
/** @param {TargetDraft|null|undefined} draft @param {unknown} key */
export function selectDraftTarget(draft,key){
  const text=String(key);
  for(const exId of draft?.exerciseOrder||[]){
    const prefix=exId+"_";if(!text.startsWith(prefix))continue;
    const match=text.slice(prefix.length).match(/^(\d+)(?:_(load|reps|rir|effort)|_metric_([a-f0-9]{32}))?$/i);
    if(!match)continue;
    const ex=/** @type {TargetDraft} */ (draft).exercises[exId],ordinal=+match[1],setId=ex.setOrder.find(id=>ex.sets[id].ordinal===ordinal);
    if(setId)return{exerciseInstanceId:exId,setId,field:match[3]?"metric":match[2],metricId:match[3]||null,ordinal}}
  return null}

