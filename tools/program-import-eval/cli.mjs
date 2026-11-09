#!/usr/bin/env node
import {existsSync,readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {generateAll,writeAll} from "./generate.mjs";
import {getCases,validateCases} from "./benchmark.mjs";
import {gradeCase} from "./grade.mjs";
import {compareRuns} from "./compare.mjs";
import {withTauriferParser} from "./parser.mjs";
import {executeRun} from "./runner.mjs";
import {loadRun,writeReport} from "./report.mjs";
const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,"../..");
function opts(args) {
  const out={};
  for(let i=0;i<args.length;i++){
    const x=args[i];
    if(!x.startsWith("--"))throw new Error("Unexpected positional argument: "+x);
    const key=x.slice(2);
    if(["execute","unlock-holdout"].includes(key))out[key]=true;
    else{if(!args[i+1]||args[i+1].startsWith("--"))throw new Error("Missing --"+key+" value");out[key]=args[++i]}
  }
  return out;
}
const help=[
  "Usage: node tools/program-import-eval/cli.mjs COMMAND [options]",
  "Commands:",
  "  generate                       Generate 200 deterministic synthetic cases",
  "  validate                       Verify gold, leakage, splits, reproducibility",
  "  validate-parser                Round-trip golden JSON through actual Taurifer importer",
  "  run --transport claude|codex --model ID --split development|validation|holdout",
  "      --prompt baseline|strict-v1|compact-v1 [--limit N] [--case ID]",
  "      [--repeat 1..5] [--out PATH] [--timeout-ms N] --execute",
  "      Use --unlock-holdout to run a finalist on protected holdout cases",
  "  report --run DIR               Recompute summary from an existing run",
  "  compare --left DIR --right DIR Paired comparison and family bootstrap CI"
].join("\n");
async function main(){
  const [command,...args]=process.argv.slice(2);
  if(!command||command==="help"||command==="--help"){console.log(help);return}
  const o=opts(args);
  if(command==="generate"){console.log(JSON.stringify(writeAll(),null,2));return}
  if(command==="validate"){console.log(JSON.stringify(validateCases(),null,2));return}
  if(command==="validate-parser"){
    const cases=getCases("all");
    await withTauriferParser(ROOT,async parse=>{
      let pass=0,fail=[];
      for(const sample of cases){
        const got=await parse(JSON.stringify(sample.expected));
        const scored=gradeCase(sample,got);
        if(scored.semanticPass)pass++;
        else fail.push({id:sample.id,status:scored.status,issues:scored.errors});
      }
      console.log(JSON.stringify({passed:pass,failed:fail.length,examples:fail.slice(0,15)},null,2));
      if(fail.length)process.exitCode=1;
    });
    return;
  }
  if(command==="run"){
    const transport=o.transport||"";
    const model=o.model||(transport==="claude"?"haiku":"gpt-6-luna");
    const result=await executeRun({repoRoot:ROOT,transport,model,
      promptId:o.prompt||"baseline",split:o.split||"development",
      limit:Number(o.limit||0),repeat:Number(o.repeat||1),
      caseId:o.case||null,timeoutMs:Number(o["timeout-ms"]||120000),
      out:o.out?resolve(o.out):null,execute:o.execute===true,
      unlockHoldout:o["unlock-holdout"]===true});
    console.log(JSON.stringify(result,null,2));return;
  }
  if(command==="report"){
    if(!o.run)throw new Error("Provide --run DIR");
    const dir=resolve(o.run),meta=JSON.parse(readFileSync(resolve(dir,"meta.json"),"utf8"));
    const results=loadRun(dir);
    console.log(JSON.stringify(writeReport(results,meta,dir).summary,null,2));return;
  }
  if(command==="compare"){
    if(!o.left||!o.right)throw new Error("Provide --left and --right run directories");
    console.log(JSON.stringify(compareRuns(resolve(o.left),resolve(o.right)),null,2));return;
  }
  throw new Error("Unknown command: "+command+"\n"+help);
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
