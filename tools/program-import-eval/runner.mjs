import {appendFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {execFileSync} from "node:child_process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {createHash} from "node:crypto";
import {getCases,getTemplate,renderPrompt,promptHash,validateCases} from "./benchmark.mjs";
import {gradeCase} from "./grade.mjs";
import {writeReport} from "./report.mjs";
import {withTauriferParser} from "./parser.mjs";
import {invokeClaude} from "./adapters/claude.mjs";
import {invokeCodex} from "./adapters/codex.mjs";

const adapters={claude:invokeClaude,codex:invokeCodex};
const iso = () => new Date().toISOString().replace(/[:.]/g,"-");
function head(repoRoot){
  try{return execFileSync("git",["rev-parse","HEAD"],{cwd:repoRoot,encoding:"utf8"}).trim()}
  catch{return "unknown"}
}
const must=(cond,msg)=>{if(!cond)throw new Error(msg)};
export async function executeRun(options){
  const {transport,model,promptId="baseline",split="development",limit=0,repeat=1,
    caseId=null,execute=false,unlockHoldout=false,timeoutMs=120000,repoRoot}=options;
  must(adapters[transport],"Transport must be claude or codex");
  must(execute,"This command spends model calls. Re-run with --execute to authorize.");
  must(Number.isInteger(repeat)&&repeat>=1&&repeat<=5,"Repeat must be 1..5");
  must(Number.isInteger(limit)&&limit>=0,"Limit must be nonnegative integer");
  must(split!=="holdout"||unlockHoldout,
    "Protected holdout: use --unlock-holdout only for a finalist evaluation.");
  validateCases(); // Prevent paid calls against stale or tampered golden fixtures.
  let cases=getCases(split);
  if(caseId) cases=cases.filter(x=>x.id===caseId);
  if(limit)cases=cases.slice(0,limit);
  must(cases.length>0,"No selected cases");
  const promptTemplates=Object.fromEntries(["en","pt"].map(locale=>[
    locale,getTemplate(promptId,locale,repoRoot)]));
  const path=options.out||resolve(repoRoot,"tools/program-import-eval/reports/runs",
    "run-"+iso()+"-"+transport+"-"+promptId+"-"+split);
  const out=resolve(path);
  const resultsPath=resolve(out,"results.jsonl");
  const metadataPath=resolve(out,"meta.json");
  const benchmarkHash=JSON.parse(readFileSync(resolve(repoRoot,"tools/program-import-eval/fixtures/manifest.json"),"utf8")).sha256;
  const harnessFiles=["runner.mjs","grade.mjs","benchmark.mjs","parser.mjs","generate.mjs",
    "adapters/process.mjs","adapters/"+transport+".mjs"];
  const harnessHash=createHash("sha256");
  for(const file of harnessFiles) harnessHash.update(readFileSync(resolve(repoRoot,"tools/program-import-eval",file)));
  mkdirSync(resolve(out,"replies"),{recursive:true});
  const meta={benchmarkVersion:"1.0.0",mode:"cli-proxy",
    transport,model,promptId,split,repoRoot,gitHead:head(repoRoot),
    benchmarkHash,harnessHash:harnessHash.digest("hex"),
    promptHash:Object.fromEntries(Object.entries(promptTemplates).map(([k,v])=>[k,promptHash(v)])),
    repeat,caseCount:cases.length,holdoutUnlocked:split==="holdout"&&unlockHoldout,
    reportCreated:new Date().toISOString(),resultSchema:1};
  if(existsSync(metadataPath)){
    const prior=JSON.parse(readFileSync(metadataPath,"utf8"));
    for(const field of ["transport","model","promptId","split","gitHead","benchmarkHash","harnessHash","repeat"]){
      must(prior[field]===meta[field],"Refusing to resume differing run: "+field);
    }
    must(JSON.stringify(prior.promptHash)===JSON.stringify(meta.promptHash),
      "Refusing to resume changed prompt");
  }else writeFileSync(metadataPath,JSON.stringify(meta,null,2)+"\n");
  const seen=new Set();
  const results=existsSync(resultsPath)?
    readFileSync(resultsPath,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse):[];
  for(const r of results)seen.add(r.caseId+"#"+r.repeatIndex);
  const tmp=mkdtempSync(resolve(tmpdir(),"taurifer-eval-"));
  try{
    await withTauriferParser(repoRoot,async parse=>{
      for(const sample of cases){
        for(let rep=1;rep<=repeat;rep++){
          const runKey=sample.id+"#"+rep;
          if(seen.has(runKey))continue;
          const prompt=renderPrompt(promptTemplates[sample.locale],sample.source);
          const provider=await adapters[transport](prompt,{model,cwd:tmp,timeoutMs});
          const reply=provider.reply||"";
          const filename=sample.id+"-r"+rep+".txt";
          const rawOutputPath=resolve(out,"replies",filename);
          writeFileSync(rawOutputPath,reply,"utf8");
          let parsed;
          let parserError=null;
          try{parsed=await parse(reply)}catch(err){parserError=err.message;parsed={status:"unreadable"}}
          const graded=gradeCase(sample,parsed,{transport,model,promptId,
            latencyMs:provider.latencyMs,usage:provider.usage,costUsd:provider.costUsd,
            exitCode:provider.exitCode,rawOutputPath:resolve("replies",filename)});
          graded.repeatIndex=rep;
          graded.promptHash=promptHash(promptTemplates[sample.locale]);
          graded.transportFailure=provider.exitCode!==0||provider.timedOut||
            provider.tooLarge||!!provider.spawnError||provider.unexpectedToolEvents>0;
          if(graded.transportFailure){
            graded.semanticPass=false;
            graded.errors.push({code:"transport_failure"});
          }
          if(parserError){
            graded.semanticPass=false;
            graded.errors.push({code:"parser_exception"});
          }
          graded.provider={exitCode:provider.exitCode,timedOut:provider.timedOut,
            tooLarge:provider.tooLarge,spawnError:provider.spawnError,
            unexpectedToolEvents:provider.unexpectedToolEvents,
            format:provider.providerFormat,actualModel:provider.actualModel||null,
            stderrTail:provider.stderr.slice(-700)};
          appendFileSync(resultsPath,JSON.stringify(graded)+"\n");
          results.push(graded);seen.add(runKey);
          process.stdout.write("["+(results.length)+"/"+(cases.length*repeat)+"] "+
            runKey+" "+(graded.semanticPass?"PASS":"FAIL")+
            " status="+graded.status+" latency="+provider.latencyMs+"ms\n");
        }
      }
    });
  }finally{rmSync(tmp,{recursive:true,force:true})}
  const report=writeReport(results,meta,out);
  return {out,meta,summary:report.summary};
}
