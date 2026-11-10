/**
 * Founder-funded program transcription for Taurifer's PWA.
 *
 * Same-origin Worker route: /api/program-import and /api/program-import/config
 * Model output is only a candidate; Taurifer's existing parser, gap editor,
 * row review and explicit activation remain the sole acceptance path.
 *
 * Security and privacy:
 * - the Anthropic API key exists only as a Worker secret
 * - source text is sent only after explicit visitor action and Turnstile
 * - strict origin, body size, per-IP and global daily cost caps
 * - no source, prompt, response, exercise names, email or raw IP are logged
 * - no provider fallback, no response caching, fail closed on missing bindings
 */
import {IMPORT_PROMPTS} from "./prompts.mjs";
import {ImportBudget} from "./budget.js";
export {ImportBudget};

const MODEL="claude-haiku-5-5";
const EFFORT="medium"; // Full 960-call eval: least costly with zero unsafe acceptances
const MAX_CHARS=12000,MAX_REQUEST_BYTES=64000,MAX_REPLY_BYTES=1024*1024;
const ANTHROPIC_TIMEOUT_MS=40000;
const ALLOWED_FIELDS=new Set(["source","locale","token"]);
const responseHeaders={
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store, max-age=0",
  "Pragma":"no-cache",
  "Referrer-Policy":"no-referrer",
  "X-Content-Type-Options":"nosniff",
  "Vary":"Origin",
};
const respond=(data,status=200,extras={})=>new Response(JSON.stringify(data),{
  status,headers:{...responseHeaders,...extras}
});
const failure=(status,code,extra={})=>respond({ok:false,code,...extra},status);

const ready=env=>env?.MANAGED_IMPORT_ENABLED==="true" &&
  typeof env?.ANTHROPIC_API_KEY==="string"&&env.ANTHROPIC_API_KEY.length>0 &&
  typeof env?.TURNSTILE_SECRET_KEY==="string"&&env.TURNSTILE_SECRET_KEY.length>0 &&
  typeof env?.TURNSTILE_SITE_KEY==="string"&&env.TURNSTILE_SITE_KEY.length>0 &&
  typeof env?.IMPORT_IP_PEPPER==="string"&&env.IMPORT_IP_PEPPER.length>=24 &&
  !!env.IMPORT_BUDGET?.idFromName;

async function boundedBody(request,maxBytes){
  const hinted=Number(request.headers.get("content-length")||0);
  if(hinted>maxBytes)return null;
  if(!request.body)return null;
  const reader=request.body.getReader();
  let total=0;
  const chunks=[];
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>maxBytes) {
        await reader.cancel().catch(()=>{});
        return null;
      }
      chunks.push(value);
    }
  }finally{reader.releaseLock()}
  const out=new Uint8Array(total);
  let index=0;
  for(const chunk of chunks){out.set(chunk,index);index+=chunk.byteLength}
  return new TextDecoder("utf-8",{fatal:true}).decode(out);
}
async function jsonFromResponse(response,maxBytes){
  const text=await boundedBody(response,maxBytes);
  if(text===null)return null;
  try{return JSON.parse(text)}catch{return null}
}
function normalizeSource(obj){
  if(!obj||typeof obj!=="object"||Array.isArray(obj))return null;
  if(Object.keys(obj).some(key=>!ALLOWED_FIELDS.has(key)))return null;
  if(typeof obj.source!=="string"||obj.source.trim().length<8 ||
    obj.source.length>MAX_CHARS||typeof obj.token!=="string"||
    obj.token.length<8||obj.token.length>2048||
    (obj.locale!=="pt"&&obj.locale!=="en"))return null;
  return {source:obj.source.trim(),locale:obj.locale,token:obj.token};
}
async function visitorHash(ip,pepper){
  const value=new TextEncoder().encode(pepper+":"+ip);
  const digest=await crypto.subtle.digest("SHA-256",value);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function verifyChallenge(fetchImpl,env,token){
  let res;
  try{
    const form=new URLSearchParams({
      secret:env.TURNSTILE_SECRET_KEY,response:token
    });
    res=await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
      method:"POST",body:form,signal:AbortSignal.timeout(8000)
    });
    if(!res.ok)return false;
    const body=await jsonFromResponse(res,16*1024);
    return body?.success===true &&
      body.hostname==="taurifer.com" && body.action==="program_import";
  }catch{return false}
}
async function reserveBudget(env,ipHash){
  const stub=env.IMPORT_BUDGET.get(env.IMPORT_BUDGET.idFromName("global-v1"));
  const response=await stub.fetch(new Request("https://budget.internal/reserve",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ipHash})
  }));
  const result=await jsonFromResponse(response,8192);
  if(!result||typeof result.ok!=="boolean")
    return {ok:false,unavailable:true};
  return result;
}
function extractAnswer(body){
  if(!body||body.type!=="message"||body.model!==MODEL||
     body.stop_reason!=="end_turn"||!Array.isArray(body.content))return null;
  if(body.content.some(block=>!["text","thinking","redacted_thinking"].includes(block.type)))
    return null;
  const text=body.content.filter(block=>block.type==="text").map(block=>block.text||"").join("").trim();
  if(!text||new TextEncoder().encode(text).length>MAX_REPLY_BYTES)return null;
  return text;
}
async function runInference(fetchImpl,env,source,locale){
  // A function replacer keeps "$&", "$'" and the like in pasted text literal.
  const prompt=IMPORT_PROMPTS[locale].replace("{program}",()=>source);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ANTHROPIC_TIMEOUT_MS);
  try{
    const res=await fetchImpl("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "x-api-key":env.ANTHROPIC_API_KEY,
        "anthropic-version":"2023-06-01"
      },
      body:JSON.stringify({
        model:MODEL,
        max_tokens:16384,
        output_config:{effort:EFFORT},
        messages:[{role:"user",content:prompt}]
      }),
      signal:controller.signal
    });
    if(!res.ok)return null;
    const body=await jsonFromResponse(res,MAX_REPLY_BYTES);
    return extractAnswer(body);
  }catch{return null}
  finally{clearTimeout(timer)}
}

export function createManagedImportHandler({fetchImpl=fetch}={}){
  return async (request,env)=>{
    const url=new URL(request.url);
    if(url.pathname==="/api/program-import/config"&&request.method==="GET"){
      const enabled=ready(env);
      return respond({
        enabled,
        sitekey:enabled?env.TURNSTILE_SITE_KEY:null,
        maxChars:MAX_CHARS
      });
    }
    if(url.pathname!=="/api/program-import")return failure(404,"not_found");
    if(request.method!=="POST")return failure(405,"method_not_allowed");
    if(!ready(env))return failure(503,"unavailable");
    if(request.headers.get("origin")!==env.MANAGED_IMPORT_ALLOWED_ORIGIN)
      return failure(403,"origin_not_allowed");
    if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||""))
      return failure(415,"invalid_content_type");
    let payload;
    try{
      const text=await boundedBody(request,MAX_REQUEST_BYTES);
      if(text===null)return failure(413,"input_too_large");
      payload=normalizeSource(JSON.parse(text));
    }catch{return failure(400,"invalid_request")}
    if(!payload)return failure(422,"invalid_program");
    const ip=request.headers.get("CF-Connecting-IP");
    if(!ip||ip.length>80)return failure(403,"visitor_unavailable");
    if(!await verifyChallenge(fetchImpl,env,payload.token))
      return failure(403,"challenge_failed");
    let budget;
    try{budget=await reserveBudget(env,await visitorHash(ip,env.IMPORT_IP_PEPPER))}
    catch{return failure(503,"quota_unavailable")}
    if(!budget.ok){
      if(budget.unavailable)return failure(503,"quota_unavailable");
      const retryAfter=Math.max(1,Math.min(86400,Math.floor(budget.retryAfter||60)));
      return respond({ok:false,code:"limit_reached",retryAfter},429,{
        "Retry-After":String(retryAfter)
      });
    }
    const reply=await runInference(fetchImpl,env,payload.source,payload.locale);
    if(!reply)return failure(502,"provider_unavailable");
    // Only the model's answer returns; never raw source or provider reasoning.
    return respond({ok:true,reply});
  };
}

export default {
  fetch: createManagedImportHandler()
};
