/** Device preferences and private tab records are separate from training data.
 * No method serializes a durable state or makes these records exportable.
 * Read failures never rewrite unknown/malformed storage records.
 */
export const UI_KEY='repforge_ui_v1';
export const NOTIFY_KEY='repforge_notify_v1';
const FREEFORM_KEY='repforge_freeform_session_v1';
const IMPORT_SOURCE_KEY='repforge_import_source_v1';
const ENTRY_REVIEW_KEY='repforge_entry_review_v1';

export function createPreferences({local,tab,mutationGate=()=>false,onError=()=>{}}) {
  function raw(storage,key){try{return storage.getItem(key)}catch{return null}}
  function parseUi(){try{const value=JSON.parse(raw(local,UI_KEY));return value&&typeof value==='object'?value:{}}catch{return{}}}
  let ui=parseUi();
  function setUi(key,value){
    if(mutationGate())return false;
    // Historical behavior retains the user's live choice even on quota failure.
    ui[key]=value;
    try{local.setItem(UI_KEY,JSON.stringify(ui));return true}
    catch(error){onError(error);return false}
  }
  function replaceUi(next){
    if(mutationGate())return false;
    try{local.setItem(UI_KEY,JSON.stringify(next));ui=next;return true}
    catch(error){onError(error);return false}
  }
  function writeRaw(storage,key,value){try{storage.setItem(key,value);return true}catch{return false}}
  function clear(storage,key){try{storage.removeItem(key);return true}catch{return false}}
  return Object.freeze({
    readUi:()=>ui,setUi,replaceUi,
    reloadUi(){ui=parseUi();return ui},
    readUiRaw:()=>raw(local,UI_KEY),
    readNotify(){try{return JSON.parse(raw(local,NOTIFY_KEY)||'{}')||{}}catch{return{}}},
    writeNotify(value){local.setItem(NOTIFY_KEY,JSON.stringify(value))},
    readFreeformRaw:()=>raw(tab,FREEFORM_KEY),
    writeFreeformRaw:value=>writeRaw(tab,FREEFORM_KEY,value),
    clearFreeform:()=>clear(tab,FREEFORM_KEY),
    readImportSource:()=>raw(tab,IMPORT_SOURCE_KEY),
    writeImportSource:value=>writeRaw(tab,IMPORT_SOURCE_KEY,value),
    clearImportSource:()=>clear(tab,IMPORT_SOURCE_KEY),
    readEntryReviewRaw:()=>raw(tab,ENTRY_REVIEW_KEY),
    writeEntryReviewRaw:value=>writeRaw(tab,ENTRY_REVIEW_KEY,value),
    clearEntryReview:()=>clear(tab,ENTRY_REVIEW_KEY),
  });
}
