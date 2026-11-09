import {appendFileSync,existsSync,mkdirSync,readFileSync,writeFileSync,mkdtempSync,rmSync} from "node:fs";
import {resolve} from "node:path";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {createHash} from "node:crypto";
import {getCases,getTemplate,renderPrompt,promptHash,validateCases} from "./benchmark.mjs";
import {gradeCase} from "./grade.mjs";
import {writeReport} from "./report.mjs";
import {withTauriferParser} from "./parser.mjs";
import {invokeClaude} from "./adapters/claude.mjs";
import {invokeCodex} from "./adapters/codex.mjs";
import {invokeOpenAI} from "./adapters/openai-api.mjs";
import {invokeAnthropic} from "./adapters/anthropic-api.mjs";

const adapters={
  claude:invokeClaude,codex:invokeCodex,
  "openai-api":invokeOpenAI,"anthropic-api":invokeAnthropic
};
const defaultModel={
  claude:"haiku",codex:"gpt-6-luna",
  "openai-api":"gpt-6-luna","anthropic-api":"claude-haiku-5-5"
};
const cheapModel={
  claude:new Set(["haiku","claude-haiku-5-5"]),
  codex:new Set(["gpt-6-luna"]),
  "openai-api":new Set(["gpt-6-luna"]),
  "anthropic-api":new Set(["claude-haiku-5-5"])
};
const iso = () => new Date().toISOString().replace(/[:.]/g,"-");
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const isInt=n=>Number.isInteger(n)&&Number.isFinite(n);
const hashFiles=(files)=>{
  const h=createHash("sha256");
  for(const file of files)h.update(readFileSync(file));
  return h.digest("hex");
};
const gitHead=(root)=> {
  try{return execFileSync("git",["rev-parse","HEAD"],{
    cwd:root,encoding:"utf8",timeout:4000}).trim()}
  catch{return "unknown"}
};
const version=(bin)=>{
  try{return execFileSync(bin,["--version"],{
    encoding:"utf8",timeout:5000,stdio:["ignore","pipe","ignore"]}).trim()}
  catch{return "unavailable"}
};

function selectedCases({split="development",caseId=null,caseIds=null,indices=null,
  locale="both",limit=0}={}){
  must(["development","validation","holdout","stress"].includes(split),
    "Split must be development, validation, holdout or stress");
  must(["en","pt","both"].includes(locale),"Locale must be en, pt or both");
  must(!caseIds||!indices,"--cases and --indices are mutually exclusive");
  must(!caseId||(!caseIds&&!indices),"--case cannot be combined with --cases or --indices");
  must(isInt(limit)&&limit>=0,"Limit must be a nonnegative integer");
  let list=getCases(split);
  if(locale!=="both")list=list.filter(x=>x.locale===locale);
  if(caseId) list=list.filter(x=>x.id===caseId);
  if(caseIds){
    const ids=[...new Set(String(caseIds).split(",").map(s=>s.trim()).filter(Boolean))];
    must(ids.length>0,"No --cases IDs supplied");
    const available=new Set(list.map(x=>x.id));
    for(const id of ids)must(available.has(id),"Unknown/out-of-split case: "+id);
    const set=new Set(ids);list=list.filter(x=>set.has(x.id));
  }
  if(indices){
    const set=new Set(String(indices).split(",").map(s=>s.trim()).filter(Boolean));
    must(set.size>0,"No --indices supplied");
    for(const n of set)must(/^(0[1-9]|10)$/.test(n),
      "Variants must be 01..10, e.g. --indices 01,05,10");
    list=list.filter(x=>set.has(x.id.slice(-2)));
  }
  if(limit)list=list.slice(0,limit);
  must(list.length>0,"No cases selected");
  return list;
}

export function planRun(options={}){
  const {transport,model=defaultModel[transport],mode="prompt",
    repeat=1,unlockHoldout=false,maxCalls=100,repoRoot,effort="medium",concurrency=1,
    persistRaw=true,maxOutputTokens=8192}=options;
  must(adapters[transport],"Transport must be claude, codex, openai-api or anthropic-api");
  must(cheapModel[transport].has(model),"Only the explicitly approved inexpensive model is permitted for "+transport);
  must(["prompt","schema"].includes(mode),"Mode must be prompt or schema");
  must(["low","medium","high","xhigh"].includes(effort),"Effort must be low, medium, high or xhigh");
  must(transport==="anthropic-api"||effort==="medium",
    "Explicit effort levels in this benchmark are supported only by the direct Anthropic API");
  must(!["claude","codex"].includes(transport)||mode==="prompt",
    "CLI wrappers support only prompt mode; use direct APIs for schema mode");
  must(isInt(repeat)&&repeat>=1&&repeat<=5,"Repeat must be between 1 and 5");
  must(isInt(maxCalls)&&maxCalls>=1&&maxCalls<=5000,"--max-calls must be 1..5000");
  must(isInt(concurrency)&&concurrency>=1&&concurrency<=16,
    "Concurrent requests must be in range 1..16");
  must(isInt(maxOutputTokens)&&maxOutputTokens>=128&&maxOutputTokens<=32768,
    "--max-output-tokens must be 128..32768");
  const split=options.split||"development";
  must(split!=="holdout"||unlockHoldout,
    "Protected holdout: use --unlock-holdout only for the preselected finalist");
  validateCases(); // Refuse paid calls against stale or unverified fixtures.
  const cases=selectedCases(options);
  const calls=cases.length*repeat;
  must(calls<=maxCalls,"Refusing "+calls+" model calls: increase --max-calls explicitly");
  const templates=Object.fromEntries(["en","pt"].map(locale=>[
    locale,getTemplate(options.promptId||"baseline",locale,repoRoot)
  ]));
  const manifest=JSON.parse(readFileSync(resolve(repoRoot,
    "tools/program-import-eval/fixtures/manifest.json"),"utf8"));
  const harnessFiles=[
    "runner.mjs","grade.mjs","benchmark.mjs","parser.mjs","generate.mjs","stress.mjs",
    "report.mjs","adapters/http.mjs","adapters/import-schema.mjs",
    "adapters/process.mjs",
    "adapters/"+({claude:"claude",codex:"codex",
      "openai-api":"openai-api","anthropic-api":"anthropic-api"}[transport])+".mjs"
  ].map(f=>resolve(repoRoot,"tools/program-import-eval",f));
  return {
    benchmarkVersion:manifest.version,
    benchmarkHash:split==="stress"?manifest.stress.stressSha256:manifest.sha256,
    harnessHash:hashFiles(harnessFiles),
    gitHead:gitHead(repoRoot),mode,model,transport,effort,
    promptId:options.promptId||"baseline",
    promptHash:Object.fromEntries(Object.entries(templates).map(([lang,prompt])=>
      [lang,promptHash(prompt)])),
    caseIds:cases.map(x=>x.id),split,locale:options.locale||"both",
    repeat,calls,maxCalls,maxOutputTokens,persistRaw,concurrency,
    transportVersion:{"claude":"claude","codex":"codex"}[transport]
      ?version(transport):"direct-http-v1",
    templates,cases
  };
}

export async function executeRun(options){
  must(options.execute===true,
    "This command spends model calls. Re-run with --execute to authorize.");
  const plan=planRun(options);
  const {transport,model,mode,repeat,cases,templates,effort}=plan;
  if(transport==="openai-api"&&!process.env.OPENAI_API_KEY)
    throw new Error("OPENAI_API_KEY is not configured on the devbox");
  if(transport==="anthropic-api"&&!process.env.ANTHROPIC_API_KEY)
    throw new Error("ANTHROPIC_API_KEY is not configured on the devbox");
  const out=resolve(options.out||resolve(options.repoRoot,
    "tools/program-import-eval/reports/runs",
    "run-"+iso()+"-"+transport+"-"+plan.promptId+"-"+plan.split));
  const resultsPath=resolve(out,"results.jsonl");
  const metadataPath=resolve(out,"meta.json");
  const {templates:_templates,cases:_cases,...metaBase}=plan;
  const meta={
    ...metaBase,repoRoot:options.repoRoot,
    reportCreated:new Date().toISOString(),resultSchema:2
  };
  mkdirSync(resolve(out,"replies"),{recursive:true});
  if(existsSync(metadataPath)){
    const prior=JSON.parse(readFileSync(metadataPath,"utf8"));
    for(const field of ["transport","model","mode","effort","promptId","split",
      "gitHead","benchmarkHash","harnessHash","repeat","maxOutputTokens","persistRaw","concurrency"]){
      must(prior[field]===meta[field],"Refusing to resume differing run: "+field);
    }
    must(JSON.stringify(prior.caseIds)===JSON.stringify(meta.caseIds),
      "Refusing to resume with a different case selection");
    must(JSON.stringify(prior.promptHash)===JSON.stringify(meta.promptHash),
      "Refusing to resume with a changed prompt");
  }else{
    writeFileSync(metadataPath,JSON.stringify(meta,null,2)+"\n","utf8");
  }
  const results=existsSync(resultsPath)?
    readFileSync(resultsPath,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse):[];
  const allowed=new Set(plan.caseIds.flatMap(id=>Array.from({length:repeat},(_,i)=>id+"#"+(i+1))));
  const seen=new Set();
  for(const r of results){
    const key=r.caseId+"#"+r.repeatIndex;
    must(allowed.has(key),"Run results contain a foreign case: "+key);
    must(!seen.has(key),"Run results contain duplicate: "+key);
    seen.add(key);
  }
  const pending=plan.calls-seen.size;
  must(pending<=plan.maxCalls,"Remaining calls exceed --max-calls");
  const cwd=mkdtempSync(resolve(tmpdir(),"taurifer-eval-"));
  const tasks=cases.flatMap(sample=>Array.from({length:repeat},(_,i)=>({sample,rep:i+1})))
    .filter(({sample,rep})=>!seen.has(sample.id+"#"+rep));
  let cursor=0,fatalError=null;
  const worker=async parse=>{
    while(!fatalError){
      const task=tasks[cursor++];
      if(!task)return;
      const {sample,rep}=task;
      const key=sample.id+"#"+rep;
      const prompt=renderPrompt(templates[sample.locale],sample.source);
      const provider=await adapters[transport](prompt,{
        model,mode,effort,cwd,timeoutMs:options.timeoutMs||120000,
        maxOutputTokens:plan.maxOutputTokens
      });
      const reply=provider.reply||"";
      const filename=sample.id+"-r"+rep+".txt";
      const rawPath=resolve(out,"replies",filename);
      if(plan.persistRaw)writeFileSync(rawPath,reply,"utf8");
      let parsed,parserError=null;
      try{parsed=await parse(reply)}
      catch(err){parsed={status:"unreadable"};parserError=err.message}
      const graded=gradeCase(sample,parsed,{
        transport,model,promptId:plan.promptId,
        latencyMs:provider.latencyMs,usage:provider.usage,
        costUsd:provider.costUsd,exitCode:provider.exitCode,
        rawOutputPath:plan.persistRaw?"replies/"+filename:null
      });
      graded.effort=effort;
      graded.costSource=provider.costSource||null;
      graded.repeatIndex=rep;
      graded.promptHash=plan.promptHash[sample.locale];
      const resolved=provider.actualModel||null;
      const expected=transport==="claude"?"claude-haiku-5-5":model;
      const drift=resolved&&resolved!==expected;
      graded.transportFailure=provider.exitCode!==0||provider.timedOut||
        provider.tooLarge||!!provider.spawnError||!reply.trim()||
        provider.unexpectedToolEvents>0||!!drift;
      if(graded.transportFailure){
        graded.semanticPass=false;
        graded.errors.push({code:drift?"model_drift":"transport_failure"});
      }
      if(parserError){
        graded.semanticPass=false;graded.errors.push({code:"parser_exception"});
      }
      graded.provider={
        exitCode:provider.exitCode,timedOut:provider.timedOut,
        tooLarge:provider.tooLarge,errorCode:provider.errorCode||null,
        actualModel:resolved,httpStatus:provider.httpStatus||null,
        requestId:provider.providerRequestId||null,
        format:provider.providerFormat||null,
        unexpectedToolEvents:provider.unexpectedToolEvents||0
      };
      appendFileSync(resultsPath,JSON.stringify(graded)+"\n","utf8");
      results.push(graded);seen.add(key);
      process.stdout.write("["+results.length+"/"+plan.calls+"] "+key+" "+
        (graded.semanticPass?"PASS":"FAIL")+" status="+graded.status+
        " latency="+provider.latencyMs+"ms\n");
      if(["unauthorized","forbidden","model_not_allowlisted","request_rejected",
        "unsupported_effort","missing_anthropic_api_key"].includes(provider.errorCode)){
        fatalError=new Error("Provider configuration failed ("+provider.errorCode+
          "); stopped further requests. Resume from run directory after fixing it.");
      }
    }
  };
  try{
    await withTauriferParser(options.repoRoot,async parse=>{
      await Promise.all(Array.from({length:Math.min(plan.concurrency,tasks.length)},
        ()=>worker(parse)));
    });
  }finally{
    rmSync(cwd,{recursive:true,force:true});
  }
  if(fatalError){
    writeReport(results,meta,out);
    throw fatalError;
  }
  const report=writeReport(results,meta,out);
  return {out,meta,summary:report.summary};
}
