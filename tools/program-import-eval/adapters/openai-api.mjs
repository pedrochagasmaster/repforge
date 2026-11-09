import {IMPORT_SCHEMA} from "./import-schema.mjs";
import {postJSON,unavailable} from "./http.mjs";

const TRANSPORT="openai-api";
/**
 * Supports only the intended cheap model. Different model selection is a
 * separate explicit experiment and must not happen through fallback.
 */
export async function invokeOpenAI(prompt,{
  model="gpt-6-luna",mode="prompt",timeoutMs=120000,
  apiKey=process.env.OPENAI_API_KEY,fetchImpl=fetch,maxOutputTokens=8192
}={}){
  if(model!=="gpt-6-luna")return unavailable(TRANSPORT,model,"model_not_allowlisted");
  if(!["prompt","schema"].includes(mode))
    return unavailable(TRANSPORT,model,"unsupported_output_mode");
  if(!apiKey)return unavailable(TRANSPORT,model,"missing_openai_api_key");
  const payload={model,input:[{role:"user",content:prompt}],
    store:false,max_output_tokens:maxOutputTokens,reasoning:{effort:"low"}};
  if(mode==="schema")payload.text={format:{type:"json_schema",
    name:"taurifer_program_import",strict:true,schema:IMPORT_SCHEMA}};
  const res=await postJSON("https://api.openai.com/v1/responses",
    {Authorization:"Bearer "+apiKey},payload,{timeoutMs,fetchImpl});
  if(res.errorCode)return {...unavailable(TRANSPORT,model,res.errorCode,res.latencyMs),
    httpStatus:res.status};
  const body=res.body;
  // Responses can carry multiple output items; exclude reasoning and tool data.
  const visible=Array.isArray(body.output)?body.output.flatMap(item=>
    item.type==="message"&&item.role==="assistant" ?
      (item.content||[]).filter(c=>c.type==="output_text"&&typeof c.text==="string")
        .map(c=>c.text):[]):[];
  const text=visible.join("");
  const toolOutputs=(body.output||[]).filter(i=>i.type!=="message"&&i.type!=="reasoning");
  const failure=body.status!=="completed"?"incomplete_response"
    :toolOutputs.length?"unexpected_tool_output"
    :!text.trim()?"empty_response"
    :body.model!==model?"model_mismatch":null;
  if(failure)return {...unavailable(TRANSPORT,model,failure,res.latencyMs),
    actualModel:body.model||null,httpStatus:res.status};
  return {transport:TRANSPORT,model,actualModel:body.model,reply:text,
    usage:body.usage?{
      input_tokens:body.usage.input_tokens||0,
      output_tokens:body.usage.output_tokens||0,
      cached_input_tokens:body.usage.input_tokens_details?.cached_tokens||0,
      reasoning_output_tokens:body.usage.output_tokens_details?.reasoning_tokens||0
    }:null,
    costUsd:null,exitCode:0,timedOut:false,tooLarge:false,spawnError:null,
    unexpectedToolEvents:0,stderr:"",providerFormat:"openai_"+mode,
    httpStatus:res.status,latencyMs:res.latencyMs,providerRequestId:body.id||null};
}
