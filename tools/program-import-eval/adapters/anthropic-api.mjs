import {IMPORT_SCHEMA} from "./import-schema.mjs";
import {postJSON,unavailable} from "./http.mjs";

const TRANSPORT="anthropic-api";
export async function invokeAnthropic(prompt,{
  model="claude-haiku-5-5",mode="prompt",timeoutMs=120000,
  apiKey=process.env.ANTHROPIC_API_KEY||process.env.ANT_KEY,fetchImpl=fetch,
  maxOutputTokens=8192,effort="medium"
}={}){
  if(model!=="claude-haiku-5-5")
    return unavailable(TRANSPORT,model,"model_not_allowlisted");
  if(!["prompt","schema"].includes(mode))
    return unavailable(TRANSPORT,model,"unsupported_output_mode");
  if(!apiKey)return unavailable(TRANSPORT,model,"missing_anthropic_api_key");
  if(!["low","medium","high","xhigh"].includes(effort))
    return unavailable(TRANSPORT,model,"unsupported_effort");
  const payload={model,max_tokens:maxOutputTokens,
    messages:[{role:"user",content:prompt}]};
  payload.output_config={effort};
  if(mode==="schema")payload.output_config.format={
    type:"json_schema",schema:IMPORT_SCHEMA};
  let res;let attempts=0;const started=performance.now();
  for(let i=0;i<3;i++){
    attempts++;
    res=await postJSON("https://api.anthropic.com/v1/messages",{
      "x-api-key":apiKey,"anthropic-version":"2023-06-01"
    },payload,{timeoutMs,fetchImpl});
    if(!res.errorCode)break;
    const transient=res.errorCode==="upstream_error"||
      (res.errorCode==="rate_limited"&&res.retryAfterSeconds!==null);
    if(!transient||i===2)break;
    const seconds=Math.min(30,res.retryAfterSeconds??(i+1)*2);
    await new Promise(resolve=>setTimeout(resolve,Math.max(0.5,seconds)*1000));
  }
  const totalLatency=Math.round(performance.now()-started);
  if(res.errorCode)return {...unavailable(TRANSPORT,model,res.errorCode,totalLatency),
    httpStatus:res.status,attempts};
  const body=res.body;
  const blocks=Array.isArray(body.content)?body.content:[];
  const reply=blocks.filter(b=>b.type==="text"&&typeof b.text==="string")
    .map(b=>b.text).join("");
  // Adaptive thinking is expected at high/xhigh. It is neither a tool call
  // nor user-visible output and MUST NOT enter the reply or stored artifacts.
  const failure=body.stop_reason==="max_tokens"?"truncated_reply"
    :blocks.some(b=>!["text","thinking","redacted_thinking"].includes(b.type))?"unexpected_tool_output"
    :!reply.trim()?"empty_response"
    :body.model!==model?"model_mismatch":null;
  // Public Haiku 5.5 list rates, prompts under 100k tokens (November 2026).
  // This is a calculated estimate, not a provider invoice.
  const usage=body.usage||null;
  const promptTokens=(usage?.input_tokens||0)+(usage?.cache_read_input_tokens||0)+
    (usage?.cache_creation_input_tokens||0);
  const longPrompt=promptTokens>100000;
  const multiplier=longPrompt?5:1;
  const estimatedUsd=usage ? multiplier*(
    (usage.input_tokens||0)*0.10/1_000_000+
    (usage.output_tokens||0)*0.50/1_000_000+
    (usage.cache_read_input_tokens||0)*0.01/1_000_000+
    (usage.cache_creation_input_tokens||0)*0.125/1_000_000):null;
  if(failure)return {...unavailable(TRANSPORT,model,failure,totalLatency),
    actualModel:body.model||null,httpStatus:res.status,
    usage:usage?{input_tokens:usage.input_tokens||0,output_tokens:usage.output_tokens||0,
      cached_input_tokens:usage.cache_read_input_tokens||0,
      cache_write_input_tokens:usage.cache_creation_input_tokens||0}:null,
    costUsd:estimatedUsd,costSource:"anthropic-haiku-5-5-list-price-2026-11",
    attempts};
  return {transport:TRANSPORT,model,actualModel:body.model,reply,effort,
    usage:body.usage?{
      input_tokens:body.usage.input_tokens||0,
      output_tokens:body.usage.output_tokens||0,
      cached_input_tokens:body.usage.cache_read_input_tokens||0,
      cache_write_input_tokens:body.usage.cache_creation_input_tokens||0
    }:null,
    costUsd:estimatedUsd,costSource:"anthropic-haiku-5-5-list-price-2026-11",
    exitCode:0,timedOut:false,tooLarge:false,spawnError:null,
    unexpectedToolEvents:0,stderr:"",providerFormat:"anthropic_"+mode,
    httpStatus:res.status,latencyMs:totalLatency,attempts,
    providerRequestId:body.id||null};
}
