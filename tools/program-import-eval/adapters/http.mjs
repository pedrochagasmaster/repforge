/**
 * Direct provider HTTP requests for the development evaluator, not the PWA.
 * No dependency and no retry/fallback. Errors are reduced to safe metadata:
 * provider error bodies, tokens, credentials and workout text are not logged.
 */
const MAX_RESPONSE_BYTES=4*1024*1024;
const safeCode = status => status===401?"unauthorized":status===403?"forbidden"
  :status===429?"rate_limited":status>=500?"upstream_error":"request_rejected";

export async function postJSON(url,headers,payload,{timeoutMs=120000,fetchImpl=fetch}={}){
  const start=performance.now();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetchImpl(url,{method:"POST",headers:{
      "Content-Type":"application/json",...headers
    },body:JSON.stringify(payload),signal:controller.signal});
    if(!res.ok)return {
      errorCode:safeCode(res.status),status:res.status,
      latencyMs:Math.round(performance.now()-start)
    };
    const hinted=Number(res.headers.get("content-length")||0);
    if(hinted>MAX_RESPONSE_BYTES)return {errorCode:"response_too_large",
      status:res.status,latencyMs:Math.round(performance.now()-start)};
    // Bound streamed bytes before JSON parsing, not just after buffering.
    const reader=res.body?.getReader?.();
    let data="";
    if(reader){
      const decoder=new TextDecoder(),chunks=[];
      let size=0;
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        size+=value.byteLength;
        if(size>MAX_RESPONSE_BYTES) {
          await reader.cancel().catch(()=>{});
          return {errorCode:"response_too_large",status:res.status,
            latencyMs:Math.round(performance.now()-start)};
        }
        chunks.push(decoder.decode(value,{stream:true}));
      }
      data=chunks.join("")+decoder.decode();
    }else {
      data=await res.text();
      if(Buffer.byteLength(data)>MAX_RESPONSE_BYTES)
        return {errorCode:"response_too_large",status:res.status,
          latencyMs:Math.round(performance.now()-start)};
    }
    let body;
    try{body=JSON.parse(data)}catch {
      return {errorCode:"invalid_provider_json",status:res.status,
        latencyMs:Math.round(performance.now()-start)};
    }
    return {body,status:res.status,latencyMs:Math.round(performance.now()-start)};
  }catch(error){
    const code=controller.signal.aborted?"timeout":"network_error";
    return {errorCode:code,status:null,latencyMs:Math.round(performance.now()-start)};
  }finally{clearTimeout(timer)}
}

export function unavailable(transport,model,code,latencyMs=0) {
  return {transport,model,reply:"",usage:null,costUsd:null,actualModel:null,
    exitCode:1,timedOut:code==="timeout",tooLarge:code==="response_too_large",
    spawnError:code,unexpectedToolEvents:0,stderr:"",
    providerFormat:"api_error",latencyMs,errorCode:code};
}
