/** Device-only install-transfer records and cross-tab ownership. The durable
 * mirror and logical import policy belong to the application command owner. */
export const TRANSFER_KEYS=Object.freeze({
 import:'repforge_install_import_v1',inbound:'repforge_transfer_inbound_v1',
 outbound:'repforge_transfer_outbound_v1',freeze:'repforge_install_transfer_freeze_v1',
 ui:'repforge_ui_v1',consent:'repforge_telemetry_enabled_v1',identity:'repforge_telemetry_identity_v1',
});
/** @typedef {(typeof TRANSFER_KEYS)[keyof typeof TRANSFER_KEYS]} DeviceKey
 * @typedef {Record<string,unknown>} RawRecord
 * @typedef {{ok:false,code:string,blocked:true}} LockFailure
 */
/** Construct at the old browser composition boundary, before automatic device
 * metadata or telemetry startup. Importing the module performs no browser IO.
 * @param {{browser:Window & typeof globalThis,nextId:()=>string,now:()=>number}} options */
export function createTransferDevice({browser,nextId,now}){
 const {localStorage,navigator}=browser;
 /** @type {string|null} */ let freezeOwner=null;
 /** @type {BroadcastChannel|null} */ let channel=null;
 /** @param {DeviceKey} key */
 function readRaw(key){try{return localStorage.getItem(key)}catch{return null}}
 /** Unlike soft device eligibility reads, mirrored marker IO must preserve a read failure.
  * @param {DeviceKey} key @returns {{ok:true,raw:string|null}|{ok:false}} */
 function readStatus(key){try{return{ok:true,raw:localStorage.getItem(key)}}catch{return{ok:false}}}
 /** @param {DeviceKey} key @param {string|null} raw */
 function writeRaw(key,raw){try{if(raw===null)localStorage.removeItem(key);else localStorage.setItem(key,raw);return true}catch{return false}}
 /** @param {DeviceKey} key @returns {RawRecord|null} */
 function readJson(key){try{const raw=localStorage.getItem(key);if(raw===null)return null;const value=/** @type {unknown} */(JSON.parse(raw));return value&&typeof value==='object'&&!Array.isArray(value)?/** @type {RawRecord} */(value):null}catch{return null}}
 const initialDevice={consent:readRaw(TRANSFER_KEYS.consent),identity:readRaw(TRANSFER_KEYS.identity)};
 /** @type {{consent:string|null,identity:string|null}|null} */let bootDevice=null;
 function recordBootDevice(){bootDevice={consent:readRaw(TRANSFER_KEYS.consent),identity:readRaw(TRANSFER_KEYS.identity)}}
 /** Malformed signals stay protected. @returns {RawRecord|null} */
 function freezeSignal(){try{const raw=localStorage.getItem(TRANSFER_KEYS.freeze);if(raw===null)return null;const value=/** @type {unknown} */(JSON.parse(raw));return value&&typeof value==='object'&&!Array.isArray(value)?/** @type {RawRecord} */(value):{invalid:true}}catch{return{invalid:true}}}
 function freezeOwned(){return !!freezeOwner&&freezeSignal()?.owner===freezeOwner}
 /** @returns {RawRecord|null} */
 function outboundMarker(){try{const raw=localStorage.getItem(TRANSFER_KEYS.outbound);if(raw===null)return null;const value=/** @type {unknown} */(JSON.parse(raw));return value&&typeof value==='object'&&!Array.isArray(value)?/** @type {RawRecord} */(value):{invalid:true,raw}}catch{return{invalid:true,code:'outbound-marker-invalid'}}}
 function outboundFrozen(){const marker=outboundMarker();return !!marker&&marker.phase!=='resumedDiverged'}
 function mutationFrozen(){const signal=freezeSignal();return !!(signal&&signal.owner!==freezeOwner)||outboundFrozen()}
 /** @param {string} type @param {string} value */
 function broadcast(type,value){try{if(typeof browser.BroadcastChannel!=='function')return;channel??=new browser.BroadcastChannel('repforge_install_transfer_v1');channel.postMessage({type,value})}catch{}}
 /** @template T @param {(owner:string)=>T|Promise<T>} work @returns {Promise<T|LockFailure>} */
 async function withFrozenLock(work){
  if(!navigator.locks?.request)return{ok:false,code:'install-transfer-lock-unavailable',blocked:true};
  if(freezeOwned())return work(/** @type {string} */(freezeOwner));
  const owner=nextId();
  try{return await navigator.locks.request('install-transfer',async()=>{
   freezeOwner=owner;
   try{localStorage.setItem(TRANSFER_KEYS.freeze,JSON.stringify({version:1,owner,createdAt:new Date(now()).toISOString()}));broadcast('freeze',owner)}
   catch{freezeOwner=null;return{ok:/** @type {false} */(false),code:'install-transfer-freeze-failed',blocked:/** @type {true} */(true)}}
   try{return await work(owner)}finally{
    try{if(freezeSignal()?.owner===owner)localStorage.removeItem(TRANSFER_KEYS.freeze)}catch{}
    broadcast('release',owner);freezeOwner=null;
   }
  })}catch{return{ok:false,code:'install-transfer-lock-failed',blocked:true}}
 }
 const operationLock=Object.freeze({
  /** @template T @param {string} name @param {()=>T|Promise<T>} work @returns {Promise<T>} */
  async withLock(name,work){if(!navigator.locks?.request)throw new Error('install-transfer-lock-unavailable');if(freezeOwned()&&name==='install-transfer')return Promise.resolve().then(work);return await navigator.locks.request(name,async()=>await work())},
 });
 /** @returns {RawRecord|null} */
 function inboundMarker(){try{const raw=localStorage.getItem(TRANSFER_KEYS.inbound);if(raw===null)return null;const marker=/** @type {unknown} */(JSON.parse(raw));return marker&&typeof marker==='object'&&!Array.isArray(marker)?/** @type {RawRecord} */(marker):{invalid:true,raw}}catch{return{invalid:true,code:'inbound-marker-invalid'}}}
 function outboundStore(){return{
  async read(){return outboundMarker()},
  /** @param {RawRecord} marker */async write(marker){localStorage.setItem(TRANSFER_KEYS.outbound,JSON.stringify(marker))},
  async clear(){localStorage.removeItem(TRANSFER_KEYS.outbound)},
 }}
 /** Deletion acknowledgement uses the same deferred inbound cleanup boundary
  * as the existing receiver. @param {{preserveCleanupMarker?:boolean}} [options] */
 function inboundStore({preserveCleanupMarker=false}={}){
  let deferCleanupClear=false;
  return{
   async read(){return inboundMarker()},
   /** @param {RawRecord} marker */async write(marker){const previous=inboundMarker();if(preserveCleanupMarker&&marker.phase==='cleanup-pending'&&marker.remoteState==='deleted'&&previous?.phase==='local-committed')deferCleanupClear=true;localStorage.setItem(TRANSFER_KEYS.inbound,JSON.stringify(marker))},
   async clear(){if(deferCleanupClear){deferCleanupClear=false;browser.queueMicrotask(()=>{try{localStorage.removeItem(TRANSFER_KEYS.inbound)}catch{}});return}localStorage.removeItem(TRANSFER_KEYS.inbound)},
  };
 }
 /** Status uncertainty may be retained even when Web Locks are unavailable,
  * matching the service client's original best-effort recovery boundary.
  * @template T @param {()=>T|Promise<T>} work @returns {Promise<T|false>} */
 async function withStatusLock(work){try{return navigator.locks?.request?await navigator.locks.request('install-transfer',()=>work()):await work()}catch{return false}}
 return Object.freeze({readRaw,readStatus,readJson,writeRaw,recordBootDevice,freezeSignal,freezeOwned,outboundMarker,outboundFrozen,
  mutationFrozen,withFrozenLock,operationLock,outboundStore,inboundMarker,inboundStore,withStatusLock,
  initialDevice:()=>({...initialDevice}),bootDevice:()=>bootDevice?{...bootDevice}:null,
  /** @param {string} value */async digest(value){const bytes=new Uint8Array(await browser.crypto.subtle.digest('SHA-256',new browser.TextEncoder().encode(value)));return[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('')},
  now,isoNow:()=>new Date(now()).toISOString(),nextId,
  /** @param {()=>void} callback @param {number} delay */schedule:(callback,delay)=>browser.setTimeout(callback,delay),
  /** @param {number} handle */cancel:handle=>browser.clearTimeout(handle),
  dispose(){channel?.close();channel=null},
 });
}
