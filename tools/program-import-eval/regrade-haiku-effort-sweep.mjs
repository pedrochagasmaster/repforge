#!/usr/bin/env node
/**
 * Regrade the owner's explicit four-level full API sweep against corrected
 * construction-time gold WITHOUT calling a model. Keeps original results and
 * provenance unchanged. Holdout is already consumed by the sweep itself.
 */
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {existsSync,readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {getCases,validateCases} from "./benchmark.mjs";
import {regradeRun} from "./regrade.mjs";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const BASE=resolve(ROOT,"tools/program-import-eval/reports/runs");
const efforts=["low","medium","high","xhigh"];
const splits=["development","validation","stress","holdout"];
function verifyIdenticalSources(){
  const original=execFileSync("git",["show",
    "465a4f4f5:tools/program-import-eval/fixtures/all.jsonl"],{
    cwd:ROOT,encoding:"utf8",maxBuffer:2_000_000});
  const before=new Map(original.trim().split("\n").map(x=>{
    const r=JSON.parse(x);return [r.id,r.source];
  }));
  const after=getCases("all");
  if(before.size!==200||after.length!==200)
    throw new Error("Source sample count unexpectedly changed");
  const drift=after.filter(x=>x.source!==before.get(x.id));
  if(drift.length)throw new Error("Regrading would change model inputs: "+
    drift.map(x=>x.id).join(","));
  return true;
}
async function main(){
  validateCases();
  verifyIdenticalSources();
  const from=resolve(BASE,"haiku-55-effort-sweep-2026-11-08");
  const to=resolve(BASE,"haiku-55-effort-sweep-2026-11-08-corrected");
  for(const split of splits){
    for(const effort of efforts){
      const origin=resolve(from,effort,split);
      const destination=resolve(to,effort,split);
      if(!existsSync(resolve(origin,"results.jsonl")))
        throw new Error("Incomplete original sweep: "+split+"/"+effort);
      if(existsSync(resolve(destination,"meta.json"))){
        const m=JSON.parse(readFileSync(resolve(destination,"meta.json"),"utf8"));
        if(!m.regradeGoldChanged&&split!=="stress")
          throw new Error("Pre-existing corrected run has unexpected hash "+destination);
        console.log("SKIP "+split+"/"+effort+" (already regraded)");
        continue;
      }
      const r=await regradeRun(origin,destination,ROOT,{unlockHoldout:true});
      console.log("REGRADED "+split+"/"+effort+" "+
        r.summary.correct+"/"+r.summary.cases+
        " exact, "+r.summary.unsafeComplete+" unsafe");
    }
  }
  console.log("All 16 effort/split runs regraded without any inference requests.");
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
