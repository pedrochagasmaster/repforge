import {IMPORT_SCHEMA} from "./import-schema.mjs";
import {postJSON,unavailable} from "./http.mjs";

const TRANSPORT="anthropic-api";
export async function invokeAnthropic(prompt,{
  model="claude-haiku-5-5",mode="prompt",timeoutMs=120000,
  apiKey=process.env.ANTHROPIC_API_KEY,fetchImpl=fetch,maxOutputTokens=8192
}={}){
  if(model!=="claude-haiku-5-5")
    return unavailable(TRANSPORT,model,"model_not_allowlisted");
  if(!["prompt","schema"].includes(mode))
    return unavailable(TRANSPORT,model,"unsupported_output_mode");
  if(!apiKey)return unavailable(TRANSPORT,model,"missing_anthropic_api_key");
  const payload={model,max_tokens:maxOutputTokens,
    messages:[{role:"user",content:prompt}]};
  if(mode==="schema")payload.output_config={format:{
    type:"json_schema",schema:IMPORT_SCHEMA}};
  const res=await postJSON("https://api.anthropic.com/v1/messages",{
    "x-api-key":apiKey,"anthropic-version":"2023-06-01"
  },payload,{timeoutMs,fetchImpl});
  if(res.errorCode)return {...unavailable(TRANSPORT,model,res.errorCode,res.latencyMs),
    httpStatus:res.status};
  const body=res.body;
  const blocks=Array.isArray(body.content)?body.content:[];
  const reply=blocks.filter(b=>b.type==="text"&&typeof b.text==="string")
    .map(b=>b.text).join("");
  const failure=body.stop_reason==="max_tokens"?"truncated_reply"
    :blocks.some(b=>b.type!=="text")?"unexpected_tool_output"
    :!reply.trim()?"empty_response"
    :body.model!==model?"model_mismatch":null;
  if(failure)return {...unavailable(TRANSPORT,model,failure,res.latencyMs),
    actualModel:body.model||null,httpStatus:res.status};
  return {transport:TRANSPORT,model,actualModel:body.model,reply,
    usage:body.usage?{
      input_tokens:body.usage.input_tokens||0,
      output_tokens:body.usage.output_tokens||0,
      cached_input_tokens:body.usage.cache_read_input_tokens||0,
      cache_write_input_tokens:body.usage.cache_creation_input_tokens||0
    }:null,
    costUsd:null,exitCode:0,timedOut:false,tooLarge:false,spawnError:null,
    unexpectedToolEvents:0,stderr:"",providerFormat:"anthropic_"+mode,
    httpStatus:res.status,latencyMs:res.latencyMs,providerRequestId:body.id||null};
}
