/** Existing file-parser bounds. Parsing never normalizes or writes the source. */
export const PROGRAM_MAX_BYTES=1024*1024;
export const PROGRAM_MAX_NODES=65536;
export const IMPORT_MAX_DEPTH=32;
/** @param {unknown} value */
export function importUtf8Bytes(value){return new TextEncoder().encode(String(value||'')).byteLength;}
/** @param {unknown} text @param {{maxBytes?:number,maxNodes?:number}} [options] @returns {unknown} */
export function boundedImportJson(text,{maxBytes=PROGRAM_MAX_BYTES,maxNodes=PROGRAM_MAX_NODES}={}){
  if(importUtf8Bytes(text)>maxBytes)return null;
  /** @type {unknown} */ let parsed;
  try{parsed=JSON.parse(String(text||''));}catch{return null;}
  let nodes=0;
  /** @param {unknown} value @param {number} depth @returns {boolean} */
  const visit=(value,depth)=>{
    if(++nodes>maxNodes||depth>IMPORT_MAX_DEPTH)return false;
    if(value===null||typeof value!=='object')return true;
    if(Array.isArray(value))return value.every(child=>visit(child,depth+1));
    const record=/** @type {Record<string,unknown>} */(value);
    return Object.keys(record).every(key=>visit(record[key],depth+1));
  };
  return visit(parsed,0)?parsed:null;
}

/** Validated transport values are JSON; retain structured-clone fallback semantics. */
/** @template T @param {T} snapshot @returns {T} */
export function cloneSnapshot(snapshot){
  if(snapshot==null||typeof snapshot!=='object')return snapshot;
  try{if(typeof structuredClone==='function')return structuredClone(snapshot);}catch{}
  return JSON.parse(JSON.stringify(snapshot));
}
