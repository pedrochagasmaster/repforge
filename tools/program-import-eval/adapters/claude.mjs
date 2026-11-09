import {runProcess} from "./process.mjs";
export async function invokeClaude(prompt,{model="haiku",cwd,timeoutMs}={}){
  const args=["-p","--model",model,"--effort","low","--tools","",
    "--no-session-persistence","--output-format","json"];
  const run=await runProcess("claude",args,prompt,{cwd,timeoutMs});
  let payload=null,reply="";
  try{payload=JSON.parse(run.stdout);reply=typeof payload.result==="string"?payload.result:"";}
  catch{reply=run.stdout.trim();}
  const events=payload?.type==="result"?1:0;
  const resolvedModels=Object.keys(payload?.modelUsage||{});
  return {...run,transport:"claude",model,reply,
    actualModel:resolvedModels.length===1?resolvedModels[0]:null,
    usage:payload?.usage||null,costUsd:typeof payload?.total_cost_usd==="number"?payload.total_cost_usd:null,
    unexpectedToolEvents:0,providerFormat:events?"claude_json":"text_fallback"};
}
