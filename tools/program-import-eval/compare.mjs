import {loadRun,summarize} from "./report.mjs";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

function sampleFamilies(items,rand){
  const groups=new Map();
  for(const row of items){
    if(!groups.has(row.referenceId))groups.set(row.referenceId,[]);
    groups.get(row.referenceId).push(row);
  }
  const keys=[...groups.keys()];
  return Array.from({length:keys.length},()=>{
    const key=keys[Math.floor(rand()*keys.length)];
    return groups.get(key);
  }).flat();
}
function random(){
  let seed=0x9E3779B9;
  return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
}
function confidenceInterval(paired){
  if(!paired.length)return null;
  const rng=random(),samples=[];
  for(let i=0;i<2000;i++){
    const batch=sampleFamilies(paired,rng);
    samples.push(batch.reduce((a,x)=>a+x.delta,0)/batch.length);
  }
  samples.sort((a,b)=>a-b);
  return [
    samples[Math.floor(0.025*samples.length)],
    samples[Math.floor(0.975*samples.length)]
  ];
}
const key=r=>r.caseId+"#"+r.repeatIndex;
const unique=(list,label)=>{
  const m=new Map();
  for(const r of list){
    if(m.has(key(r)))throw new Error("Duplicate "+label+" entry: "+key(r));
    m.set(key(r),r);
  }
  return m;
};
export function compareRuns(left,right){
  const l=JSON.parse(readFileSync(resolve(left,"meta.json"),"utf8"));
  const r=JSON.parse(readFileSync(resolve(right,"meta.json"),"utf8"));
  if(l.benchmarkHash!==r.benchmarkHash||l.split!==r.split)
    throw new Error("Cannot compare different benchmark versions or splits");
  if(JSON.stringify(l.caseIds)!==JSON.stringify(r.caseIds)||
    l.repeat!==r.repeat)
    throw new Error("Paired comparison requires exactly the same cases and repeat count");
  const a=loadRun(left),b=loadRun(right);
  const total=l.caseIds.length*l.repeat;
  if(a.length!==total||b.length!==total)
    throw new Error("Both runs must be complete; partial comparisons are selection-biased");
  const before=unique(a,"baseline"),after=unique(b,"candidate");
  const paired=[];
  for(const [caseKey,baseline] of before){
    const candidate=after.get(caseKey);
    if(!candidate)throw new Error("Candidate missing paired case: "+caseKey);
    paired.push({
      caseId:baseline.caseId,
      referenceId:baseline.referenceId,
      locale:baseline.locale,expectedOutcome:baseline.expectedOutcome,
      before:baseline.semanticPass,after:candidate.semanticPass,
      delta:Number(candidate.semanticPass)-Number(baseline.semanticPass),
      beforeFidelity:baseline.fidelity,afterFidelity:candidate.fidelity,
      beforeUnsafe:baseline.unsafeComplete,afterUnsafe:candidate.unsafeComplete
    });
  }
  const regressions=paired.filter(x=>x.before&&!x.after);
  const improvements=paired.filter(x=>!x.before&&x.after);
  const unsafe=paired.filter(x=>!x.beforeUnsafe&&x.afterUnsafe);
  const exactDelta=paired.reduce((a,x)=>a+x.delta,0)/paired.length;
  return {
    paired:paired.length,referenceFamilies:new Set(paired.map(x=>x.referenceId)).size,
    baseline:{transport:l.transport,model:l.model,prompt:l.promptId,...summarize(a)},
    candidate:{transport:r.transport,model:r.model,prompt:r.promptId,...summarize(b)},
    exactDelta,familyBootstrap95CI:confidenceInterval(paired),
    improvements:improvements.map(x=>x.caseId),
    regressions:regressions.map(x=>x.caseId),
    newUnsafeAcceptances:unsafe.map(x=>x.caseId),
    screening:unsafe.length?"critical_regression" :
      regressions.length?"mixed_regressions" :
      improvements.length?"improved_without_case_regression":"no_measurable_improvement",
    productionPromotionApproved:false,
    caveat:"Synthetic screening only. Provider API, real programs and owner safety gates remain separate."
  };
}
