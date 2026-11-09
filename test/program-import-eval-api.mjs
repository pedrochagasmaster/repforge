#!/usr/bin/env node
import {strict as assert} from "node:assert";
import {invokeOpenAI} from "../tools/program-import-eval/adapters/openai-api.mjs";
import {invokeAnthropic} from "../tools/program-import-eval/adapters/anthropic-api.mjs";
import {IMPORT_SCHEMA} from "../tools/program-import-eval/adapters/import-schema.mjs";
import {postJSON} from "../tools/program-import-eval/adapters/http.mjs";

const input="3 x 8-12 Romanian deadlift";
const response=(obj,status=200)=>new Response(JSON.stringify(obj),{
  status,headers:{"Content-Type":"application/json"}
});
const fakeOpenAI={
  status:"completed",model:"gpt-6-luna",id:"resp_mock_123",
  output:[{type:"reasoning"},{type:"message",role:"assistant",
    content:[{type:"output_text",text:'{"version":3,"exercises":[]}'}]}],
  usage:{input_tokens:33,output_tokens:21,
    input_tokens_details:{cached_tokens:10},output_tokens_details:{reasoning_tokens:5}}
};
const fakeClaude={
  model:"claude-haiku-5-5",id:"msg_mock_456",stop_reason:"end_turn",
  content:[{type:"text",text:'{"version":3,"exercises":[]}'}],
  usage:{input_tokens:41,output_tokens:27}
};
const requests=[];
const fetchOpen=async(url,opts)=>{
  requests.push({url,opts});return response(fakeOpenAI);
};
const fetchClaude=async(url,opts)=>{
  requests.push({url,opts});return response(fakeClaude);
};

const open=await invokeOpenAI(input,{apiKey:"test-secret",mode:"prompt",fetchImpl:fetchOpen});
assert.equal(open.exitCode,0);
assert.equal(open.actualModel,"gpt-6-luna");
assert.equal(open.usage.cached_input_tokens,10);
assert.equal(open.costUsd,null);
assert.deepEqual(JSON.parse(requests[0].opts.body),{
  model:"gpt-6-luna",
  input:[{role:"user",content:input}],
  store:false,max_output_tokens:8192,reasoning:{effort:"low"}
});
assert.equal(requests[0].url,"https://api.openai.com/v1/responses");
assert.equal(requests[0].opts.headers.Authorization,"Bearer test-secret");
const structuredOpen=await invokeOpenAI(input,{apiKey:"test-secret",mode:"schema",fetchImpl:fetchOpen});
assert.equal(structuredOpen.exitCode,0);
const openBody=JSON.parse(requests[1].opts.body);
assert.deepEqual(openBody.text.format.schema,IMPORT_SCHEMA);
assert.equal(openBody.text.format.strict,true);
assert.equal(IMPORT_SCHEMA.properties.exercises.items.properties.min.type[1],"null");

const claude=await invokeAnthropic(input,{apiKey:"test-secret",mode:"prompt",fetchImpl:fetchClaude});
assert.equal(claude.exitCode,0);
assert.equal(claude.actualModel,"claude-haiku-5-5");
assert.equal(requests[2].opts.headers["x-api-key"],"test-secret");
assert.equal(requests[2].url,"https://api.anthropic.com/v1/messages");
// Adaptive reasoning must never appear in parser-visible text or be classed as a tool.
for(const effort of ["low","medium","high","xhigh"]){
  const reasoned=await invokeAnthropic(input,{apiKey:"test-secret",mode:"prompt",
    effort,fetchImpl:async()=>response({...fakeClaude,content:[
      {type:"thinking",thinking:"private internal model reasoning"},
      {type:"text",text:'{"version":3,"exercises":[]}'},
      {type:"redacted_thinking",data:"hidden"}
    ]})});
  assert.equal(reasoned.exitCode,0);
  assert.equal(reasoned.reply,'{"version":3,"exercises":[]}');
  assert.equal(reasoned.effort,effort);
  assert.equal(reasoned.costUsd,41*0.10/1e6+27*0.50/1e6);
}
assert.equal((await invokeAnthropic(input,{apiKey:"test-secret",effort:"max",
  fetchImpl:fetchClaude})).errorCode,"unsupported_effort");
const xhigh=await invokeAnthropic(input,{apiKey:"test-secret",effort:"xhigh",
  fetchImpl:fetchClaude});
assert.equal(JSON.parse(requests[requests.length-1].opts.body).output_config.effort,"xhigh");
const structuredClaude=await invokeAnthropic(input,{apiKey:"test-secret",mode:"schema",fetchImpl:fetchClaude});
assert.equal(structuredClaude.exitCode,0);
const anthropicBody=JSON.parse(requests[requests.length-1].opts.body);
assert.deepEqual(anthropicBody.output_config.format.schema,IMPORT_SCHEMA);

assert.equal((await invokeOpenAI("x",{apiKey:"",fetchImpl:fetchOpen})).errorCode,"missing_openai_api_key");
assert.equal((await invokeAnthropic("x",{apiKey:"",fetchImpl:fetchClaude})).errorCode,"missing_anthropic_api_key");
assert.equal((await invokeOpenAI("x",{model:"gpt-6-astra",apiKey:"test-secret",fetchImpl:fetchOpen})).errorCode,"model_not_allowlisted");
assert.equal((await invokeAnthropic("x",{model:"claude-opus-5",apiKey:"test-secret",fetchImpl:fetchClaude})).errorCode,"model_not_allowlisted");
const unsupported=await invokeOpenAI(input,{apiKey:"test-secret",mode:"schema",fetchImpl:async()=>response({error:"not_supported"},400)});
assert.equal(unsupported.errorCode,"request_rejected");
const throttle=await invokeAnthropic(input,{apiKey:"test-secret",fetchImpl:async()=>response({error:"rate limit"},429)});
assert.equal(throttle.errorCode,"rate_limited");
const wrong=await invokeOpenAI(input,{apiKey:"test-secret",fetchImpl:async()=>response({...fakeOpenAI,model:"gpt-6-astra"})});
assert.equal(wrong.errorCode,"model_mismatch");
const trunc=await invokeAnthropic(input,{apiKey:"test-secret",fetchImpl:async()=>response({...fakeClaude,stop_reason:"max_tokens"})});
assert.equal(trunc.errorCode,"truncated_reply");
assert(trunc.costUsd>0,"a truncated 200 response is still billable");
const tool=await invokeOpenAI(input,{apiKey:"test-secret",fetchImpl:async()=>response({...fakeOpenAI,output:[...fakeOpenAI.output,{type:"function_call",name:"eval"}]})});
assert.equal(tool.errorCode,"unexpected_tool_output");
const huge=await postJSON("https://fake.test",{a:"b"},{a:1},{fetchImpl:async()=>new Response("x".repeat(5*1024*1024))});
assert.equal(huge.errorCode,"response_too_large");
const invalid=await postJSON("https://fake.test",{a:"b"},{a:1},{fetchImpl:async()=>new Response("not-json")});
assert.equal(invalid.errorCode,"invalid_provider_json");

console.log("direct API adapters: OpenAI Responses + Anthropic Messages (prompt/schema) mock tests PASS");
