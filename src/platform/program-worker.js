import { createGenerationRules } from "../training/generation.js";
import { createCatalog } from "./catalog.js";
const {compiler,transition,identity}=createGenerationRules();
/** Dedicated worker composition root; the page sends this release's commands.
 * @typedef {ReturnType<typeof createCatalog>} CatalogReader
 * @typedef {{type?:unknown,id?:unknown,request?:unknown,generationOptions?:unknown,input?:Record<string,unknown>|null,catalogSha256?:string,catalogUrl?:string}} WorkerCommand
 */
/** @type {CatalogReader|null} */let catalog=null;
/** @type {Promise<import('./catalog.js').CatalogSnapshot>|null} */let ready=null;
/** @type {Pick<DedicatedWorkerGlobalScope,'onmessage'|'postMessage'>} */
const worker=/** @type {Pick<DedicatedWorkerGlobalScope,'onmessage'|'postMessage'>} */(/** @type {unknown} */(globalThis));
/** @param {unknown} error */
const errorMessage=error=>String(/** @type {{message?:unknown}|null|undefined} */(error)?.message||error);
/** @param {WorkerCommand} message */
function initialize(message) {
  if(!ready) {
    catalog=createCatalog({identity,catalogSha256:message.catalogSha256,assetUrl:message.catalogUrl});
    ready=catalog.load();
  }
  return ready;
}
worker.onmessage=async event=>{
  const message=/** @type {WorkerCommand} */(event.data||{});
  if(message.type==="init") {
    try { await initialize(message); worker.postMessage({type:"ready"}); }
    catch(error) { worker.postMessage({type:"failed",message:errorMessage(error)}); }
    return;
  }
  try {
    const snapshot=/** @type {CatalogReader} */(catalog).snapshot();
    /** @type {unknown} */const value=message.type==="generate"
      ?compiler.generateProgram(message.request,snapshot,message.generationOptions)
      :transition.deriveSuccessor({...message.input,catalogSnapshot:snapshot});
    worker.postMessage({id:message.id,ok:true,value});
  } catch(error) { worker.postMessage({id:message.id,ok:false,message:errorMessage(error)}); }
};
