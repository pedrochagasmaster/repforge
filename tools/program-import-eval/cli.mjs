#!/usr/bin/env node
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {writeAll} from "./generate.mjs";
import {getCases,validateCases} from "./benchmark.mjs";
import {gradeCase} from "./grade.mjs";
import {compareRuns} from "./compare.mjs";
import {withTauriferParser} from "./parser.mjs";
import {executeRun,planRun} from "./runner.mjs";
import {loadRun,writeReport} from "./report.mjs";
import {regradeRun} from "./regrade.mjs";

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const KNOWN=new Set(["transport","model","mode","effort","split","locale","prompt",
  "limit","case","cases","indices","repeat","out","timeout-ms",
  "max-calls","max-output-tokens","concurrency","execute","unlock-holdout",
  "no-raw-replies","left","right","run","from"]);
const BOOLEAN=new Set(["execute","unlock-holdout","no-raw-replies"]);
function opts(args){
  const out={};
  for(let i=0;i<args.length;i++){
    const flag=args[i];
    if(!flag.startsWith("--"))throw new Error("Unexpected positional arg: "+flag);
    const key=flag.slice(2);
    if(!KNOWN.has(key))throw new Error("Unrecognized option: "+flag);
    if(Object.hasOwn(out,key))throw new Error("Duplicate option: "+flag);
    if(BOOLEAN.has(key))out[key]=true;
    else {
      if(!args[i+1]||args[i+1].startsWith("--"))
        throw new Error("Missing value for "+flag);
      out[key]=args[++i];
    }
  }
  return out;
}
const help=[
  "Usage: node tools/program-import-eval/cli.mjs COMMAND [options]",
  "Commands (no paid calls):",
  "  generate                       Rebuild 200 synthetic + 40 stress cases",
  "  validate                       Verify dataset invariants, content hash and splits",
  "  validate-parser                Round-trip gold through the real Taurifer importer",
  "  plan --transport ...           Print selected cases, model, hashes and call count",
  "  report --run DIR               Recalculate an existing run report",
  "  regrade --from DIR --out DIR   Replay synthetic replies using current gold",
  "  compare --left DIR --right DIR Paired comparison (same cases/repeats)",
  "Execution (explicitly incurs model calls):",
  "  run --transport claude|codex|openai-api|anthropic-api",
  "      --model ID --mode prompt|schema --effort low|medium|high|xhigh",
  "      [--prompt baseline|strict-v1|compact-v1]",
  "      [--split development|validation|holdout|stress] [--locale en|pt|both]",
  "      [--cases id,id,... | --case id | --indices 01,05,08,10]",
  "      [--limit N] [--repeat 1..5] [--max-calls N] [--concurrency 1..16]",
  "      [--max-output-tokens 8192] [--timeout-ms 120000]",
  "      [--no-raw-replies] [--out DIR] --execute",
  "Defaults: development, both locales, one repeat, prompt mode, max 100 calls.",
  "Holdout requires --unlock-holdout and is for one preselected finalist only.",
  "API adapters require OPENAI_API_KEY or ANTHROPIC_API_KEY.",
  "Both API adapters support prompt and constrained JSON-schema output modes.",
  "CLI adapters do not support schema mode. Models are restricted to cheap models."
].join("\n");
const number=(value,fallback,name)=>{
  if(value===undefined)return fallback;
  if(!/^\d+$/.test(value))throw new Error(name+" must be an integer");
  return Number(value);
};
const config=(o)=>({
  repoRoot:ROOT,
  transport:o.transport||"",
  model:o.model,
  mode:o.mode||"prompt",effort:o.effort||"medium",promptId:o.prompt||"baseline",
  split:o.split||"development",locale:o.locale||"both",
  limit:number(o.limit,0,"--limit"),
  repeat:number(o.repeat,1,"--repeat"),
  maxCalls:number(o["max-calls"],100,"--max-calls"),
  concurrency:number(o.concurrency,1,"--concurrency"),
  maxOutputTokens:number(o["max-output-tokens"],8192,"--max-output-tokens"),
  timeoutMs:number(o["timeout-ms"],120000,"--timeout-ms"),
  caseId:o.case||null,caseIds:o.cases||null,indices:o.indices||null,
  execute:o.execute===true,unlockHoldout:o["unlock-holdout"]===true,
  persistRaw:o["no-raw-replies"]!==true,
  out:o.out?resolve(o.out):null
});
async function main(){
  const [command,...args]=process.argv.slice(2);
  if(!command||["--help","help"].includes(command)){console.log(help);return}
  const o=opts(args);
  if(command==="generate"){console.log(JSON.stringify(writeAll(),null,2));return}
  if(command==="validate"){console.log(JSON.stringify(validateCases(),null,2));return}
  if(command==="validate-parser"){
    const cases=[...getCases("all"),...getCases("stress")];
    await withTauriferParser(ROOT,async parse=>{
      let pass=0,schemaPass=0,schemaChecked=0;const fail=[];
      for(const sample of cases){
        const got=await parse(sample.expectedOutcome==="reject"
          ? sample.source:JSON.stringify(sample.expected));
        const scored=gradeCase(sample,got);
        if(scored.semanticPass)pass++;
        else fail.push({id:sample.id,mode:"gold",issues:scored.errors});
        if(sample.expectedOutcome==="reject")continue;
        // Strict API JSON Schemas require nullable numeric fields to appear.
        // The real gap reader must accept them and preserve missing-value gates.
        const json={
          ...sample.expected,
          exercises:sample.expected.exercises.map(x=>({
            ...x,sets:x.sets??null,min:x.min??null,max:x.max??null
          }))
        };
        const parsedSchema=await parse(JSON.stringify(json));
        const gradedSchema=gradeCase(sample,parsedSchema);
        schemaChecked++;
        if(gradedSchema.semanticPass)schemaPass++;
        else fail.push({id:sample.id,mode:"schema-null",issues:gradedSchema.errors});
      }
      console.log(JSON.stringify({
        passed:pass,checked:cases.length,
        schemaPassed:schemaPass,schemaChecked,
        failed:fail.length,examples:fail.slice(0,15)
      },null,2));
      if(fail.length)process.exitCode=1;
    });
    return;
  }
  if(command==="plan"){
    const {templates,cases,...plan}=planRun(config(o));
    console.log(JSON.stringify(plan,null,2));return;
  }
  if(command==="run"){
    console.log(JSON.stringify(await executeRun(config(o)),null,2));return;
  }
  if(command==="report"){
    if(!o.run)throw new Error("Provide --run DIR");
    const dir=resolve(o.run);
    const meta=JSON.parse(readFileSync(resolve(dir,"meta.json"),"utf8"));
    console.log(JSON.stringify(writeReport(loadRun(dir),meta,dir).summary,null,2));
    return;
  }
  if(command==="regrade"){
    if(!o.from||!o.out)throw new Error("Provide --from DIR and --out DIR");
    console.log(JSON.stringify(await regradeRun(resolve(o.from),resolve(o.out),ROOT),null,2));
    return;
  }
  if(command==="compare"){
    if(!o.left||!o.right)
      throw new Error("Provide --left DIR and --right DIR");
    console.log(JSON.stringify(compareRuns(resolve(o.left),resolve(o.right)),null,2));
    return;
  }
  throw new Error("Unknown command: "+command+"\n"+help);
}
main().catch(err=>{console.error(err.stack||err.message);process.exitCode=1});
