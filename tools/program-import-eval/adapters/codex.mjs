import {runProcess} from "./process.mjs";
export async function invokeCodex(prompt,{model="gpt-6-luna",cwd,timeoutMs}={}){
  const args=["exec","--model",model,"--sandbox","read-only",
    "--ignore-user-config","--skip-git-repo-check","--ephemeral","--json",
    "-c",'model_reasoning_effort="low"','-'];
  const run=await runProcess("codex",args,prompt,{cwd,timeoutMs});
  let reply="",usage=null,unexpectedToolEvents=0,actualModel=null;
  for(const line of run.stdout.split("\n")){
    if(!line.trim())continue;
    let event;
    try{event=JSON.parse(line)}catch{continue}
    const item=event.item||{};
    if(event.type==="item.completed"&&item.type==="agent_message")
      reply=typeof item.text==="string"?item.text:reply;
    if(["command_execution","file_change","mcp_tool_call","web_search"].includes(item.type))
      unexpectedToolEvents++;
    if(event.type==="turn.completed")usage=event.usage||usage;
    if(event.model)actualModel=event.model;
  }
  return {...run,transport:"codex",model,actualModel,reply,usage,costUsd:null,
    unexpectedToolEvents,providerFormat:"codex_jsonl"};
}
