#!/usr/bin/env node
/**
 * Consolidate the 4 x 240 paired Haiku effort evals AFTER the audited gold
 * correction. Pure offline reporting: never invokes a model.
 */
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {readFileSync,writeFileSync} from "node:fs";
import {loadRun,summarize} from "./report.mjs";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const OUT=process.argv[2] ? resolve(process.argv[2]) :
  resolve(ROOT,"tools/program-import-eval/reports/runs",
    "haiku-55-effort-sweep-2026-11-08-corrected");
const EFFORTS=["low","medium","high","xhigh"];
const SPLITS=["development","validation","stress","holdout"];
const categoryError=x=>/^(missing_category_|invented_category_|duplicate_categories)/.test(x);
const fmtRate=x=>x===null||x===undefined?"n/a":(100*x).toFixed(1)+"%";
const fmtCost=x=>x===null||x===undefined?"n/a":"$"+x.toFixed(4);
const mean=list=>list.length?list.reduce((a,x)=>a+x,0)/list.length:null;
const percentile=(xs,p)=>{
  const a=xs.filter(x=>typeof x==="number").sort((a,b)=>a-b);
  if(!a.length)return null;
  return a[Math.max(0,Math.ceil(a.length*p)-1)];
};
const csvCell=v=>{
  const s=Array.isArray(v)?v.join(";"):String(v??"");
  return '"'+s.replaceAll('"','""')+'"';
};
const csv=(rows,keys)=>[keys.join(","),
  ...rows.map(r=>keys.map(k=>csvCell(r[k])).join(","))].join("\n")+"\n";
const seedRng=()=>{
  let x=0x65AFB4D1;
  return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296};
};
function familyCI(paired){
  const groups=new Map();
  for(const record of paired){
    const family=record.referenceId;
    if(!groups.has(family))groups.set(family,[]);
    groups.get(family).push(record);
  }
  const keys=[...groups.keys()],rng=seedRng(),samples=[];
  for(let n=0;n<5000;n++){
    let total=0,count=0;
    for(let k=0;k<keys.length;k++){
      const family=groups.get(keys[Math.floor(rng()*keys.length)]);
      for(const row of family){total+=row.delta;count++}
    }
    samples.push(total/count);
  }
  samples.sort((a,b)=>a-b);
  return [samples[Math.floor(.025*samples.length)],
    samples[Math.floor(.975*samples.length)]];
}
function loadAll(){
  const all=new Map();
  let previousHashes=new Set();
  for(const effort of EFFORTS){
    const rows=[];
    for(const split of SPLITS){
      const dir=resolve(OUT,effort,split);
      const meta=JSON.parse(readFileSync(resolve(dir,"meta.json"),"utf8"));
      const part=loadRun(dir);
      if(part.length!==meta.calls)throw new Error("Incomplete "+effort+"/"+split);
      if(meta.effort!==effort)throw new Error("Mislabeled effort: "+dir);
      if(part.some(r=>r.effort!==effort||r.split!==split))
        throw new Error("Row effort or split drift: "+dir);
      if(!meta.holdoutRegradeAuthorized && split==="holdout")
        throw new Error("Missing explicit owner holdout regrade authorization");
      previousHashes.add(meta.previousBenchmarkHash);
      rows.push(...part);
    }
    if(rows.length!==240)throw new Error("Expected 240 rows for "+effort);
    const id=new Set(rows.map(r=>r.caseId));
    if(id.size!==240)throw new Error("Duplicated or missing case ID: "+effort);
    all.set(effort,rows);
  }
  return all;
}
const data=loadAll();
const perEffort=[];
const rowMaps=new Map();
for(const effort of EFFORTS){
  const rows=data.get(effort);
  rowMaps.set(effort,new Map(rows.map(r=>[r.caseId,r])));
  const sum=summarize(rows);
  const positive=rows.filter(r=>r.expectedOutcome!=="reject");
  const negative=rows.filter(r=>r.expectedOutcome==="reject");
  const corePass=r=>r.expectedOutcome==="reject" ? r.semanticPass :
    r.parseable&&!r.transportFailure&&
    r.errors.every(e=>categoryError(e.code));
  const gapRows=positive.filter(r=>r.expectedGapCount>0);
  const gapPass=r=>r.parseable&&!r.transportFailure&&
    !r.errors.some(e=>/(gap_|invented_sets|invented_reps|missing_gap_step|unnecessary_gap_step|wrong_sets|wrong_reps)/.test(e.code));
  const errors={};
  for(const r of rows)for(const e of r.errors)
    errors[e.code]=(errors[e.code]||0)+1;
  perEffort.push({
    effort,summary:sum,
    coreAccuracy:rows.filter(corePass).length/rows.length,
    positiveCoreAccuracy:positive.filter(corePass).length/positive.length,
    gapHandlingRate:gapRows.length?gapRows.filter(gapPass).length/gapRows.length:null,
    meanLatencyMs:mean(rows.map(x=>x.latencyMs)),
    p50LatencyMs:percentile(rows.map(x=>x.latencyMs),.5),
    p95LatencyMs:percentile(rows.map(x=>x.latencyMs),.95),
    transportFailures:rows.filter(x=>x.transportFailure).length,
    negativeRejections:negative.filter(x=>x.semanticPass).length,
    unsafeCases:rows.filter(x=>x.unsafeComplete).map(x=>({
      caseId:x.caseId,split:x.split,locale:x.locale,
      errors:x.errors.map(e=>e.code)
    })),
    bySplit:Object.fromEntries(SPLITS.map(split=>
      [split,summarize(rows.filter(r=>r.split===split))])),
    byLocale:Object.fromEntries(["pt","en"].map(locale=>
      [locale,summarize(rows.filter(r=>r.locale===locale))])),
    errors
  });
}
const reference=rowMaps.get("low");
const pairwise=[];
for(const effort of EFFORTS.slice(1)){
  const cand=rowMaps.get(effort);
  const paired=[...reference.values()].map(base=>{
    const now=cand.get(base.caseId);
    if(!now)throw new Error("Missing paired case "+base.caseId);
    return {
      caseId:base.caseId,referenceId:base.referenceId,
      split:base.split,locale:base.locale,
      delta:Number(now.semanticPass)-Number(base.semanticPass),
      before:base.semanticPass,after:now.semanticPass,
      newUnsafe:!base.unsafeComplete&&now.unsafeComplete,
      removedUnsafe:base.unsafeComplete&&!now.unsafeComplete
    };
  });
  pairwise.push({
    versus:"low",effort,caseCount:paired.length,
    exactDelta:paired.reduce((a,x)=>a+x.delta,0)/paired.length,
    clusterBootstrap95CI:familyCI(paired),
    improvements:paired.filter(x=>x.delta>0).map(x=>x.caseId),
    regressions:paired.filter(x=>x.delta<0).map(x=>x.caseId),
    newUnsafe:paired.filter(x=>x.newUnsafe).map(x=>x.caseId),
    removedUnsafe:paired.filter(x=>x.removedUnsafe).map(x=>x.caseId)
  });
}
const matrix=[...reference.values()].sort((a,b)=>
  a.split.localeCompare(b.split)||a.caseId.localeCompare(b.caseId)).map(r=>{
  const base={
    caseId:r.caseId,split:r.split,locale:r.locale,
    difficulty:r.difficulty,referenceId:r.referenceId,
    expectedOutcome:r.expectedOutcome
  };
  for(const effort of EFFORTS){
    const x=rowMaps.get(effort).get(r.caseId);
    base[effort+"Pass"]=x.semanticPass;
    base[effort+"Unsafe"]=x.unsafeComplete;
    base[effort+"Errors"]=x.errors.map(e=>e.code);
    base[effort+"LatencyMs"]=x.latencyMs;
    base[effort+"EstimatedUsd"]=x.costUsd;
  }
  return base;
});
const grandTotal=perEffort.map(x=>x.summary.observedCostUsd);
const combinedCost=grandTotal.every(x=>typeof x==="number")?
  grandTotal.reduce((a,b)=>a+b,0):null;
const dataset=readFileSync(resolve(ROOT,"tools/program-import-eval/fixtures/manifest.json"),"utf8");
const manifest=JSON.parse(dataset);
const table=[
  "| Effort | Exact | Core prescription | Gap handling | Negative rejection | Unsafe complete | Mean / P95 latency | Estimated USD | USD / faithful import |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...perEffort.map(x=>{
    const s=x.summary;
    return "| "+x.effort+" | "+s.correct+"/240 ("+fmtRate(s.exactRate)+")"+
      " | "+fmtRate(x.coreAccuracy)+" | "+fmtRate(x.gapHandlingRate)+
      " | "+x.negativeRejections+"/16"+
      " | "+s.unsafeComplete+" | "+
      Math.round(x.meanLatencyMs)+" / "+Math.round(x.p95LatencyMs)+" ms"+
      " | "+fmtCost(s.observedCostUsd)+
      " | "+fmtCost(s.observedCostPerFaithfulImport)+" |";
  })
];
const splitTable=[
  "| Split | "+EFFORTS.join(" | ")+" |",
  "| --- | "+EFFORTS.map(()=> "---:").join(" | ")+" |",
  ...SPLITS.map(split=>"| "+split+" | "+perEffort.map(x=>
    fmtRate(x.bySplit[split].exactRate)+" ("+x.bySplit[split].unsafeComplete+" unsafe)")
    .join(" | ")+" |")
];
const localeTable=[
  "| Locale | "+EFFORTS.join(" | ")+" |",
  "| --- | "+EFFORTS.map(()=> "---:").join(" | ")+" |",
  ...["pt","en"].map(locale=>"| "+locale.toUpperCase()+" | "+
    perEffort.map(x=>fmtRate(x.byLocale[locale].exactRate)).join(" | ")+" |")
];
const errorsTable=[
  "| Error | "+EFFORTS.join(" | ")+" |",
  "| --- | "+EFFORTS.map(()=> "---:").join(" | ")+" |",
  ...[...new Set(perEffort.flatMap(x=>Object.keys(x.errors)))].sort()
    .map(code=>"| "+code+" | "+perEffort.map(x=>x.errors[code]||0).join(" | ")+" |")
];
const unsafe=perEffort.flatMap(x=>x.unsafeCases.map(y=>({...y,effort:x.effort})));
const md=[
 "# Taurifer — Haiku 5.5 effort sweep, corrected benchmark",
 "",
 "Complete: 960 direct Anthropic Messages API calls; model claude-haiku-5-5.",
 "Prompt: exact merged EN/PT i18n prompt; unforced JSON prompt output.",
 "Effort: low / medium / high / xhigh; same 32,768 maximum output tokens.",
 "Dataset: 120 development, 40 validation, 40 stress, 40 owner-exposed holdout.",
 "Gold correction: only day case and unsupported category labeling; all 200 source texts",
 "were byte-for-byte verified unchanged against baseline commit 465a4f4f5.",
 "",
 "## Main result",
 "",
 ...table,
 "",
 "Costs are derived from published API list rates ($0.10/MTok input,",
 "$0.50/MTok output for prompts under 100K tokens), not an invoice. The",
 "estimated charge per faithful import includes calls to reject non-programs.",
 "",
 "Core prescription = correct import/rejection without exercise, day, sets, reps",
 "or gap errors; missing/extra unsupported sidecars are counted separately.",
 "",
 "## Exact semantic success by dataset split",
 "",
 ...splitTable,
 "",
 "## Exact semantic success by locale",
 "",
 ...localeTable,
 "",
 "## Pairwise against low effort (family-cluster bootstrap)",
 "",
 ...pairwise.map(p=>"- "+p.effort+": "+(p.exactDelta*100).toFixed(1)+
   " percentage points; cluster bootstrap 95% CI ["+
   p.clusterBootstrap95CI.map(x=>(x*100).toFixed(1)).join(", ")+
   "]; improvements "+p.improvements.length+
   ", regressions "+p.regressions.length+
   ", new unsafe "+p.newUnsafe.length),
 "",
 "## Unsafe accepted prescriptions",
 "",
 ...(unsafe.length?unsafe.map(r=>"- "+r.effort+"/"+r.split+"/"+r.caseId+
   ": "+r.errors.join(", ")):["None"]),
 "",
 "## Error types",
 "",
 ...errorsTable,
 "",
 "## Interpretation limits",
 "",
 "- Synthetic references are not independent real-coach programs.",
 "- This run deliberately exposed the holdout across all four levels; do not",
 "  reuse it as a sealed holdout for subsequent prompt optimization.",
 "- Changed gold labels were corrected via saved synthetic model replies, not",
 "  repeat inference calls, and every original run remains intact.",
 "- CLI-proxy experiments from PR #707 are a separate population, not comparable",
 "  as API latency or billing.",
 "- No effort level is automatically promoted: a safety gate takes priority",
 "  over higher aggregate exact success.",
 "",
 "Primary sources:",
 "- Anthropic effort settings: https://platform.claude.com/docs/en/build-with-claude/effort",
 "- Haiku 5.5 pricing: https://www.anthropic.com/claude-haiku-5-5",
 "- Taurifer import contract: docs/adr/0014-free-form-program-import-handoff.md"
].join("\n")+"\n";
const result={
  benchmark:{version:manifest.version,mainHash:manifest.sha256,
    stressHash:manifest.stress.stressSha256},
  model:"claude-haiku-5-5",transport:"anthropic-api",
  efforts:perEffort,pairwise,
  fullCalls:960,complete:true,estimatedTotalUsd:combinedCost,
  holdoutExposed:true
};
writeFileSync(resolve(OUT,"corrected-effort-report.json"),
  JSON.stringify(result,null,2)+"\n");
writeFileSync(resolve(OUT,"corrected-effort-report.md"),md);
const keys=["caseId","split","locale","difficulty","referenceId","expectedOutcome",
  ...EFFORTS.flatMap(e=>[e+"Pass",e+"Unsafe",e+"Errors",
    e+"LatencyMs",e+"EstimatedUsd"])];
writeFileSync(resolve(OUT,"corrected-case-comparison.csv"),csv(matrix,keys));
console.log(JSON.stringify({path:OUT,complete:true,fullCalls:960,
  estimatedTotalUsd:combinedCost,
  levels:perEffort.map(x=>({effort:x.effort,exact:x.summary.correct,
    unsafe:x.summary.unsafeComplete,cost:x.summary.observedCostUsd,
    p95LatencyMs:x.p95LatencyMs,
    coreRate:x.coreAccuracy}))},null,2));
