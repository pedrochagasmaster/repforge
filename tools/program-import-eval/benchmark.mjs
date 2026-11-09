import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { generateAll, OUT, CATEGORY_VALUES } from "./generate.mjs";
import { REFERENCES } from "./sources.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const splits = ["development","validation","holdout"];
const required = (condition,message) => {if(!condition) throw new Error(message)};

export function getCases(split="development") {
  required(splits.includes(split)||split==="all","Unknown split: "+split);
  const file=resolve(OUT,split+".jsonl");
  return readFileSync(file,"utf8").trim().split("\n").map((line,i)=>{
    try{return JSON.parse(line)}catch(err){throw new Error(file+" line "+(i+1)+": "+err.message)}
  });
}
export function getTemplate(promptId, locale, repoRoot) {
  required(["en","pt"].includes(locale),"Invalid locale: "+locale);
  let template;
  if(promptId==="baseline"){
    const data=JSON.parse(readFileSync(resolve(repoRoot,"i18n-"+locale+".json"),"utf8"));
    template=data["entry.freeform.prompt"];
  }else{
    required(/^[a-z0-9][a-z0-9-_]{0,63}$/i.test(promptId),"Invalid prompt ID");
    template=readFileSync(resolve(ROOT,"prompts",promptId+"."+locale+".txt"),"utf8");
  }
  required(typeof template==="string","Prompt not a string");
  required((template.match(/\{program\}/g)||[]).length===1,"Prompt must contain exactly one {program}: "+promptId+"/"+locale);
  return template;
}
export function renderPrompt(template, source) {
  return template.replace("{program}",source);
}
export function promptHash(template) {
  return createHash("sha256").update(template).digest("hex");
}
export function validateCases(cases=getCases("all")) {
  required(REFERENCES.length===20,"Expected precisely 20 distinct researched references");
  required(cases.length===200,"Expected exactly 200 synthetic cases");
  const referenceIds=new Set(REFERENCES.map(ref=>ref.id));
  const caseIds=new Set();
  const byRef=new Map();
  const sourceHashes=new Set();
  for(const sample of cases){
    required(!caseIds.has(sample.id),"Duplicate case ID: "+sample.id);caseIds.add(sample.id);
    required(sample.origin==="synthetic"&&typeof sample.source==="string",sample.id+" is not synthetic");
    required(sample.source.length>=10 && sample.source.length<=12000,sample.id+" input size out of contract");
    const ref=REFERENCES.find(x=>x.id===sample.referenceId);
    required(ref&&referenceIds.has(sample.referenceId),sample.id+" unknown reference");
    required(sample.split===ref.split&&sample.locale===ref.locale,sample.id+" reference split/locale mismatch");
    const hash=createHash("sha256").update(sample.source).digest("hex");
    required(!sourceHashes.has(hash),sample.id+" duplicate source");sourceHashes.add(hash);
    byRef.set(ref.id,(byRef.get(ref.id)||0)+1);
    const truth=sample.expected;
    required(truth.version===3 && typeof truth.meta?.name==="string",sample.id+" invalid gold envelope");
    required(Array.isArray(truth.exercises)&&truth.exercises.length>0,sample.id+" no exercises");
    required(Array.isArray(truth.missing)&&Array.isArray(truth.notImported),sample.id+" missing sidecars");
    const seenOrders=new Map();
    for(const row of truth.exercises){
      required(typeof row.day==="string"&&typeof row.name==="string"&&row.name.trim(),sample.id+" invalid identity");
      const order=(seenOrders.get(row.day)||0)+1;
      required(row.order===order,sample.id+" non-sequential order");
      seenOrders.set(row.day,order);
      const missingS=truth.missing.some(m=>m.day===row.day&&m.order===row.order&&m.field==="sets");
      const missingR=truth.missing.some(m=>m.day===row.day&&m.order===row.order&&m.field==="reps");
      required(missingS===(row.sets===undefined),sample.id+" sets sidecar mismatch");
      required(missingR===(row.min===undefined||row.max===undefined),sample.id+" reps sidecar mismatch");
      if(!missingS)required(Number.isInteger(row.sets)&&row.sets>=1&&row.sets<=100,sample.id+" invalid sets");
      if(!missingR)required(Number.isInteger(row.min)&&Number.isInteger(row.max)&&row.min>=1&&row.max>=row.min&&row.max<=1000,sample.id+" invalid reps");
    }
    required(new Set(truth.notImported).size===truth.notImported.length,sample.id+" duplicate unsupported categories");
    required(truth.notImported.every(x=>CATEGORY_VALUES.includes(x)),sample.id+" unexpected category");
  }
  required(REFERENCES.every(r=>byRef.get(r.id)===10),"Each reference must own ten cases");
  const actual=generateAll();
  required(JSON.stringify(cases)===JSON.stringify(actual),"Fixture files drifted from deterministic generator; rerun generate");
  return {ok:true,cases:cases.length,references:REFERENCES.length,
    splits:Object.fromEntries(splits.map(s=>[s,cases.filter(x=>x.split===s).length])),
    locales:{pt:cases.filter(x=>x.locale==="pt").length,en:cases.filter(x=>x.locale==="en").length},
    exercises:cases.reduce((a,x)=>a+x.expected.exercises.length,0),
    gapCases:cases.filter(x=>x.expected.missing.length>0).length,
    unsupportedCases:cases.filter(x=>x.expected.notImported.length>0).length
  };
}
