import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

function mean(list){return list.length ? list.reduce((a,x)=>a+x,0)/list.length : null}
function pct(x){return x==null?"n/a":(100*x).toFixed(1)+"%"}
function num(x){return x==null?"n/a":Number(x).toFixed(3)}
export function summarize(rows) {
  const costs=rows.map(r=>r.costUsd).filter(x=>typeof x==="number"&&Number.isFinite(x));
  const success=rows.filter(r=>r.semanticPass).length;
  return {
    cases:rows.length, parsed:rows.filter(r=>r.parseable).length,
    correct:success,unsafeComplete:rows.filter(r=>r.unsafeComplete).length,
    parseRate:rows.length ? rows.filter(r=>r.parseable).length/rows.length : null,
    exactRate:rows.length ? success/rows.length : null,
    meanFidelity:mean(rows.map(r=>r.fidelity)),
    meanLatencyMs:mean(rows.map(r=>r.latencyMs).filter(x=>typeof x==="number")),
    observedCostUsd:costs.length===rows.length?costs.reduce((a,x)=>a+x,0):null,
    observedCostPerCorrect:costs.length===rows.length&&success?
      costs.reduce((a,x)=>a+x,0)/success:null,
    inputTokens:rows.reduce((a,r)=>a+(r.usage?.input_tokens||0),0),
    outputTokens:rows.reduce((a,r)=>a+(r.usage?.output_tokens||0),0)
  };
}
function group(rows,key) {
  const out={};
  for(const row of rows) (out[row[key]]??=[]).push(row);
  return Object.fromEntries(Object.entries(out).sort().map(([k,v])=>[k,summarize(v)]));
}
export function makeReport(rows,meta={}) {
  const summary=summarize(rows);
  const failures=new Map();
  for(const row of rows) for(const issue of row.errors||[])
    failures.set(issue.code,(failures.get(issue.code)||0)+1);
  const lines=[
    "# Taurifer program-import LLM evaluation",
    "",
    "- **Benchmark**: "+(meta.benchmarkVersion||"1.0.0"),
    "- **Commit**: "+(meta.gitHead||"unknown"),
    "- **Transport**: "+(meta.transport||"unknown")+" / "+(meta.model||"unknown"),
    "- **Prompt**: "+(meta.promptId||"unknown"),
    "- **Split**: "+(meta.split||"unknown"),
    "- **Cases**: "+summary.cases,
    "- **Parser success**: "+pct(summary.parseRate),
    "- **Exact semantic success**: "+pct(summary.exactRate),
    "- **Unsafe complete outcomes**: "+summary.unsafeComplete,
    "- **Mean field fidelity**: "+pct(summary.meanFidelity),
    "- **Mean latency**: "+(summary.meanLatencyMs==null?"n/a":Math.round(summary.meanLatencyMs)+" ms"),
    "- **Observed CLI-reported USD cost**: "+num(summary.observedCostUsd),
    "- **Observed cost per exact success**: "+num(summary.observedCostPerCorrect),
    "",
    "## Locale",
    "",
    "| Locale | Cases | Parse | Exact | Unsafe complete |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...Object.entries(group(rows,"locale")).map(([k,v])=>
      "| "+k+" | "+v.cases+" | "+pct(v.parseRate)+" | "+pct(v.exactRate)+" | "+v.unsafeComplete+" |"),
    "",
    "## Difficulty",
    "",
    "| Difficulty | Cases | Parse | Exact | Unsafe complete |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...Object.entries(group(rows,"difficulty")).map(([k,v])=>
      "| "+k+" | "+v.cases+" | "+pct(v.parseRate)+" | "+pct(v.exactRate)+" | "+v.unsafeComplete+" |"),
    "",
    "## Error classes",
    "",
    ...([...failures].sort((a,b)=>b[1]-a[1]).map(([k,v])=>"- "+k+": "+v)),
    "",
    "## Failing case IDs",
    "",
    ...rows.filter(x=>!x.semanticPass).map(x=>"- "+x.caseId+": "+x.errors.map(y=>y.code).join(", ")),
    "",
    "No benchmark source text or model reply is included in this summary."
  ];
  return {summary,byLocale:group(rows,"locale"),byDifficulty:group(rows,"difficulty"),
    byReference:group(rows,"referenceId"),errors:Object.fromEntries(failures),
    markdown:lines.join("\n")+"\n"};
}
export function writeReport(rows,meta,dir){
  const data=makeReport(rows,meta);
  writeFileSync(resolve(dir,"summary.json"),JSON.stringify({...meta,...data,markdown:undefined},null,2)+"\n");
  writeFileSync(resolve(dir,"report.md"),data.markdown);
  return data;
}
export function loadRun(dir) {
  return readFileSync(resolve(dir,"results.jsonl"),"utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
}
