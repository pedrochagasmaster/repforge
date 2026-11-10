#!/usr/bin/env node
/**
 * A fixed, reproducible effort sweep of the current production import prompt.
 * No prompt tuning between effort levels. The holdout is assessed last, and
 * only after explicit user authorization of the full 4-level sweep.
 *
 * The API key is supplied through ANT_KEY / ANTHROPIC_API_KEY in the shell.
 * Never write credentials to reports or fixtures.
 */
import {mkdirSync,existsSync,readFileSync,writeFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {executeRun,planRun} from "./runner.mjs";
import {getCases,validateCases} from "./benchmark.mjs";
import {loadRun,summarize} from "./report.mjs";

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const BASE=resolve(ROOT,"tools/program-import-eval/reports/runs");
const SPLITS=["development","validation","stress","holdout"];
const EFFORTS=["low","medium","high","xhigh"];
const COUNTS={development:120,validation:40,stress:40,holdout:40};
const TOTAL=EFT();
function EFT(){return EFFORTS.length*Object.values(COUNTS).reduce((a,b)=>a+b,0)}
const pct=v=>v===null?"—":(100*v).toFixed(1)+"%";
const dollars=v=>v===null?"—":"$"+v.toFixed(4);

function readConfig(args){
  const out={execute:false,includeHoldout:false,
    concurrency:8,maxOutputTokens:32768,timeoutMs:120000,
    out:resolve(BASE,"haiku-55-effort-sweep-2026-11-08")};
  for(let i=0;i<args.length;i++){
    const opt=args[i];
    if(opt==="--execute")out.execute=true;
    else if(opt==="--include-holdout")out.includeHoldout=true;
    else if(["--concurrency","--max-output-tokens","--timeout-ms","--out"].includes(opt)){
      if(!args[i+1])throw new Error("Missing value for "+opt);
      const v=args[++i];
      if(opt==="--out")out.out=resolve(v);
      else {
        if(!/^\d+$/.test(v))throw new Error(opt+" must be an integer");
        out[{"--concurrency":"concurrency",
          "--max-output-tokens":"maxOutputTokens",
          "--timeout-ms":"timeoutMs"}[opt]]=Number(v);
      }
    }else throw new Error("Unrecognized argument: "+opt);
  }
  if(!out.execute)throw new Error("Pass --execute to authorize "+TOTAL+" direct API calls");
  if(!out.includeHoldout)throw new Error(
    "Pass --include-holdout to acknowledge this consumes the protected holdout");
  if(!process.env.ANTHROPIC_API_KEY&&!process.env.ANT_KEY)
    throw new Error("Neither ANTHROPIC_API_KEY nor ANT_KEY is exported");
  return out;
}

function snapshot(base){
  const records=[];
  for(const split of SPLITS){
    for(const effort of EFFORTS){
      const path=resolve(base,effort,split);
      const file=resolve(path,"results.jsonl");
      const metaPath=resolve(path,"meta.json");
      if(!existsSync(file)||!existsSync(metaPath))continue;
      const meta=JSON.parse(readFileSync(metaPath,"utf8"));
      const rows=loadRun(path);
      const complete=rows.length===meta.calls;
      records.push({split,effort,path,complete,rows:complete?rows:[],
        completedCalls:rows.length,plannedCalls:meta.calls});
    }
  }
  return records;
}

function buildReport(base){
  const groups=snapshot(base);
  const results=[];
  for(const effort of EFFORTS){
    const completed=groups.filter(g=>g.effort===effort&&g.complete);
    const all=completed.flatMap(g=>g.rows);
    const summary=all.length?summarize(all):null;
    results.push({
      effort,completedSplits:completed.map(g=>g.split),
      completedCalls:all.length,
      remainingCalls:240-all.length,
      summary,bySplit:completed.map(g=>({split:g.split,
        summary:summarize(g.rows)}))
    });
  }
  const allRows=groups.filter(g=>g.complete).flatMap(g=>g.rows);
  const exceptions=allRows.filter(x=>x.unsafeComplete).map(x=>({
    effort:x.effort,split:x.split,id:x.caseId,
    failures:x.errors.map(e=>e.code)}));
  const totalEstimated=allRows.every(x=>typeof x.costUsd==="number")
    ?allRows.reduce((a,x)=>a+x.costUsd,0):null;
  const complete=groups.filter(g=>g.complete).length===16;
  const last=new Date().toISOString();
  const md=[
    "# Taurifer — Claude Haiku 5.5 full effort sweep",
    "",
    "Status: "+(complete?"Complete":"In progress; only completed split runs included"),
    "Generated: "+last,
    "",
    "Model: claude-haiku-5-5. Transport: direct Anthropic Messages API.",
    "Prompt: production i18n baseline, EN + PT. Output mode: prompt, not forced schema.",
    "Effort: low / medium / high / xhigh. Max response tokens: 32,768 for all levels.",
    "Case pool: 120 development + 40 validation + 40 stress + 40 protected holdout.",
    "The holdout was deliberately exposed by the owner's full-sweep request.",
    "",
    "## Aggregate metrics",
    "",
    "| Effort | Completed | Exact | Positive parse | Negative rejection | Unsafe acceptances | Mean latency | List-rate USD estimate | USD / faithful import |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...results.map(r=>{
      const s=r.summary;
      return "| "+r.effort+" | "+r.completedCalls+"/240 | "+
        (s?pct(s.exactRate):"—")+" | "+(s?pct(s.parseRate):"—")+
        " | "+(s?pct(s.rejectionRate):"—")+" | "+
        (s?s.unsafeComplete:"—")+" | "+
        (s?Math.round(s.meanLatencyMs)+" ms":"—")+" | "+
        (s?dollars(s.observedCostUsd):"—")+" | "+
        (s?dollars(s.observedCostPerFaithfulImport):"—")+" |";
    }),
    "",
    "USD is estimated from Anthropic's published Haiku 5.5 input/output rates,",
    "not read from a provider invoice. Unknown transport-error billing is excluded.",
    "",
    "## By effort and split",
    "",
    "| Effort | Split | Exact | Positive parse | Rejection | Unsafe | Estimated USD |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...results.flatMap(r=>r.bySplit.map(({split,summary:s})=>
      "| "+r.effort+" | "+split+" | "+pct(s.exactRate)+
      " | "+pct(s.parseRate)+" | "+pct(s.rejectionRate)+
      " | "+s.unsafeComplete+" | "+dollars(s.observedCostUsd)+" |")),
    "",
    "## Unsafe accepted outcomes",
    "",
    ...(exceptions.length?exceptions.map(x=>"- "+x.effort+"/"+x.split+"/"+x.id+
      ": "+x.failures.join(", ")) : ["None in completed runs"]),
    "",
    "## Interpretation",
    "",
    "Safety-critical wrong-but-accepted prescriptions trump improvements in",
    "overall exact rate. Do not choose a production effort level based only on",
    "synthetic data. The stress set is not an independent real-coach corpus.",
    "",
    "No human workout text or API secret is stored in these reports."
  ].join("\n")+"\n";
  const out={
    model:"claude-haiku-5-5",prompt:"baseline",mode:"prompt",
    effortLevels:EFFORTS,splits:SPLITS,expectedCalls:TOTAL,
    completedCalls:allRows.length,complete,generated: last,
    byEffort:results,
    estimatedTotalUsd:totalEstimated,
    unsafeAcceptances:exceptions,
    runDirs:groups.map(g=>({split:g.split,effort:g.effort,
      path:g.path,complete:g.complete,completedCalls:g.completedCalls}))
  };
  writeFileSync(resolve(base,"effort-sweep-summary.json"),
    JSON.stringify(out,null,2)+"\n");
  writeFileSync(resolve(base,"effort-sweep-report.md"),md);
  return out;
}

async function main(){
  const settings=readConfig(process.argv.slice(2));
  validateCases();
  mkdirSync(settings.out,{recursive:true});
  const expected=TOTAL;
  process.stdout.write("Haiku 5.5 direct API full effort sweep: "+expected+
    " calls; "+settings.concurrency+" concurrent requests per split.\n");
  for(const split of SPLITS){
    for(const effort of EFFORTS){
      const out=resolve(settings.out,effort,split);
      process.stdout.write("START "+split+" / "+effort+
        " ("+COUNTS[split]+" inputs)\n");
      try{
        const response=await executeRun({
          repoRoot:ROOT,transport:"anthropic-api",model:"claude-haiku-5-5",
          mode:"prompt",promptId:"baseline",
          split,effort,repeat:1,locale:"both",
          maxOutputTokens:settings.maxOutputTokens,
          timeoutMs:settings.timeoutMs,
          maxCalls:COUNTS[split],concurrency:settings.concurrency,
          unlockHoldout:settings.includeHoldout,
          persistRaw:true,out,execute:true
        });
        process.stdout.write("DONE "+split+"/"+effort+": "+
          response.summary.correct+"/"+response.summary.cases+
          " exact, "+response.summary.unsafeComplete+" unsafe, "+
          dollars(response.summary.observedCostUsd)+" est. USD\n");
      }catch(error){
        const partial=buildReport(settings.out);
        process.stderr.write("STOP at "+split+"/"+effort+": "+error.message+
          "\nCompleted calls: "+partial.completedCalls+
          ". Re-run with the same parameters to resume.\n");
        process.exitCode=1;
        return;
      }
      buildReport(settings.out);
    }
  }
  const result=buildReport(settings.out);
  process.stdout.write("SWEEP "+(result.complete?"COMPLETE":"INCOMPLETE")+
    ", "+result.completedCalls+"/"+expected+" calls"+
    ", estimated total "+dollars(result.estimatedTotalUsd)+"\n");
  if(!result.complete)process.exitCode=1;
}
main().catch(error=>{
  console.error(error.stack||error.message);process.exitCode=1;
});
