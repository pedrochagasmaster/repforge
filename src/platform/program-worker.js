import { createGenerationRules } from "../training/generation.js";
import { createCatalog } from "./catalog.js";
const {compiler,transition,identity}=createGenerationRules();
let catalog=null, ready=null;
function initialize(message) {
  if(!ready) {
    catalog=createCatalog({identity,catalogSha256:message.catalogSha256,assetUrl:message.catalogUrl});
    ready=catalog.load();
  }
  return ready;
}
self.onmessage=async event=>{
  const message=event.data||{};
  if(message.type==="init") {
    try { await initialize(message); self.postMessage({type:"ready"}); }
    catch(error) { self.postMessage({type:"failed",message:String(error?.message||error)}); }
    return;
  }
  try {
    const snapshot=catalog.snapshot();
    const value=message.type==="generate"
      ?compiler.generateProgram(message.request,snapshot)
      :transition.deriveSuccessor({...message.input,catalogSnapshot:snapshot});
    self.postMessage({id:message.id,ok:true,value});
  } catch(error) { self.postMessage({id:message.id,ok:false,message:String(error?.message||error)}); }
};
