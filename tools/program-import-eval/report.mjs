import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const num=x=>typeof x==="number"&&Number.isFinite(x);
const mean=list=>list.length?list.reduce((a,x)=>a+x,0)/list.length:null;
const rate=(list,pred)=>list.length?list.filter(pred).length/list.length:null;
const pct=x=>x==null?"n/a":(100*x).toFixed(1)+"%";
const dollars=x=>x==null?"n/a":"$"+Number(x).toFixed(4);
export function summarize(rows){
  const positive=rows.filter(r=>r.expectedOutcome!=="reject");
  const rejected=rows.filter(r=>r.expectedOutcome==="reject");
  const costs=rows.map(r=>r.costUsd).filter(num);
  const correct=rows.filter(r=>r.semanticPass).length;
  const faithfulImports=positive.filter(r=>r.semanticPass).length;
  const totalCost=costs.length===rows.length
    ?costs.reduce((a,x)=>a+x,0):null;
  return {
    cases:rows.length,positiveCases:positive.length,
    rejectionCases:rejected.length,
    parsed:positive.filter(r=>r.parseable).length,
    rejected:rejected.filter(r=>!r.parseable).length,
    correct,faithfulImports,unsafeComplete:rows.filter(r=>r.unsafeComplete).length,
    parseRate:rate(positive,r=>r.parseable),
    rejectionRate:rate(rejected,r=>!r.parseable),
    exactRate:rate(rows,r=>r.semanticPass),
    positiveExactRate:rate(positive,r=>r.semanticPass),
    rejectionExactRate:rate(rejected,r=>r.semanticPass),
    meanFidelity:mean(rows.map(r=>r.fidelity).filter(num)),
    meanLatencyMs:mean(rows.map(r=>r.latencyMs).filter(num)),
    observedCostUsd:totalCost,
    observedCostPerFaithfulImport:totalCost!==null&&faithfulImports?
      totalCost/faithfulImports:null,
    inputTokens:rows.reduce((a,r)=>a+(r.usage?.input_tokens||0),0),
    outputTokens:rows.reduce((a,r)=>a+(r.usage?.output_tokens||0),0),
    failureCount:rows.filter(r=>!r.semanticPass).length
  };
}
function group(rows,key){
  const out={};
  for(const row of rows)(out[row[key]]??=[]).push(row);
  return Object.fromEntries(Object.entries(out).sort()
    .map(([k,v])=>[k,summarize(v)]));
}
export function makeReport(rows,meta={}){
  const summary=summarize(rows);
  const failures=new Map();
  for(const row of rows)for(const issue of row.errors||[])
    failures.set(issue.code,(failures.get(issue.code)||0)+1);
  const table=(grouped)=>{
    const lines=["| Group | Cases | Positive parse | Reject | Exact | Unsafe |",
      "| --- | ---: | ---: | ---: | ---: | ---: |"];
    for(const [k,v] of Object.entries(grouped))lines.push(
      "| "+k+" | "+v.cases+" | "+pct(v.parseRate)+" | "+pct(v.rejectionRate)+
      " | "+pct(v.exactRate)+" | "+v.unsafeComplete+" |");
    return lines;
  };
  const lines=[
    "# Taurifer program-import LLM evaluation","",
    "- **Benchmark**: "+(meta.benchmarkVersion||"unknown")+" / "+
      (meta.benchmarkHash||"no content hash"),
    "- **Repository commit**: "+(meta.gitHead||"unknown"),
    "- **Transport/model**: "+(meta.transport||"unknown")+" / "+(meta.model||"unknown"),
    "- **Output mode**: "+(meta.mode||"prompt"),
    "- **Prompt**: "+(meta.promptId||"unknown"),
    "- **Split**: "+(meta.split||"unknown"),
    "- **Cases**: "+summary.cases+" ("+summary.positiveCases+
      " expected imports, "+summary.rejectionCases+" expected rejections)",
    "- **Positive parser success**: "+pct(summary.parseRate),
    "- **Non-program rejection success**: "+pct(summary.rejectionRate),
    "- **Strict exact semantic success**: "+pct(summary.exactRate),
    "- **Unsafe accepted outcomes**: "+summary.unsafeComplete,
    "- **Mean field fidelity (positives only)**: "+pct(summary.meanFidelity),
    "- **Mean latency**: "+(summary.meanLatencyMs==null?"n/a":
      Math.round(summary.meanLatencyMs)+" ms"),
    "- **CLI-reported USD (only when available on every case)**: "+
      dollars(summary.observedCostUsd),
    "- **Observed charge per faithfully imported program (including rejection costs)**: "+
      dollars(summary.observedCostPerFaithfulImport),
    "- **Input/output tokens**: "+summary.inputTokens+
      " / "+summary.outputTokens,
    "",
    "API price is deliberately not inferred from CLI subscription usage.",
    "The result is synthetic-only, not evidence of human-source reliability.","",
    "## Locale","",...table(group(rows,"locale")),
    "","## Difficulty","",...table(group(rows,"difficulty")),
    "","## Errors","",
    ...([...failures].sort((a,b)=>b[1]-a[1])
      .map(([k,v])=>"- "+k+": "+v)),
    "","## Incorrect case IDs","",
    ...rows.filter(x=>!x.semanticPass)
      .map(x=>"- "+x.caseId+": "+x.errors.map(y=>y.code).join(", ")),
    "","No source or model reply text is included in this summary."
  ];
  return {summary,byLocale:group(rows,"locale"),
    byDifficulty:group(rows,"difficulty"),
    byReference:group(rows,"referenceId"),
    errors:Object.fromEntries(failures),
    markdown:lines.join("\n")+"\n"};
}
export function writeReport(rows,meta,dir){
  const data=makeReport(rows,meta);
  writeFileSync(resolve(dir,"summary.json"),JSON.stringify({
    ...meta,...data,markdown:undefined
  },null,2)+"\n");
  writeFileSync(resolve(dir,"report.md"),data.markdown);
  return data;
}
export function loadRun(dir){
  const data=readFileSync(resolve(dir,"results.jsonl"),"utf8").trim();
  return data?data.split("\n").filter(Boolean).map(JSON.parse):[];
}
