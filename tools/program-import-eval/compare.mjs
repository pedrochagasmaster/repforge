import {loadRun,summarize} from "./report.mjs";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
function sampleFamilies(items,rand) {
  const map=new Map();
  for(const r of items) {
    const id=r.referenceId;
    if(!map.has(id))map.set(id,[]);
    map.get(id).push(r);
  }
  const keys=[...map.keys()];
  return Array.from({length:keys.length},()=>{
    const id=keys[Math.floor(rand()*keys.length)];
    return map.get(id);
  }).flat();
}
function seeded(){
  let s=0x9E3779B9;
  return ()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296};
}
function ciDelta(rows){
  if(!rows.length)return null;
  const rng=seeded(),samples=[];
  for(let n=0;n<1000;n++){
    const sampled=sampleFamilies(rows,rng);
    samples.push(sampled.reduce((a,x)=>a+x.delta,0)/sampled.length);
  }
  samples.sort((a,b)=>a-b);
  return [samples[Math.floor(.025*samples.length)],samples[Math.floor(.975*samples.length)]];
}
export function compareRuns(left,right){
  const aMeta=JSON.parse(readFileSync(resolve(left,"meta.json"),"utf8"));
  const bMeta=JSON.parse(readFileSync(resolve(right,"meta.json"),"utf8"));
  if(aMeta.benchmarkHash!==bMeta.benchmarkHash || aMeta.split!==bMeta.split)
    throw new Error("Runs must share the same benchmark hash and split");
  const a=loadRun(left),b=loadRun(right);
  const map=new Map(a.map(r=>[r.caseId+"#"+r.repeatIndex,r]));
  const paired=[];
  for(const item of b) {
    const baseline=map.get(item.caseId+"#"+item.repeatIndex);
    if(!baseline)continue;
    paired.push({caseId:item.caseId,referenceId:item.referenceId,
      before:baseline.semanticPass,after:item.semanticPass,
      delta:Number(item.semanticPass)-Number(baseline.semanticPass),
      beforeFidelity:baseline.fidelity,afterFidelity:item.fidelity,
      beforeUnsafe:baseline.unsafeComplete,afterUnsafe:item.unsafeComplete});
  }
  const regressions=paired.filter(x=>x.before&&!x.after);
  const improvements=paired.filter(x=>!x.before&&x.after);
  const unsafeRegressions=paired.filter(x=>!x.beforeUnsafe&&x.afterUnsafe);
  return {
    paired:paired.length,
    baseline:summarize(a),candidate:summarize(b),
    exactDelta:paired.length?paired.reduce((a,x)=>a+x.delta,0)/paired.length:null,
    familyBootstrap95CI:ciDelta(paired),
    improvements:improvements.map(x=>x.caseId),
    regressions:regressions.map(x=>x.caseId),
    newUnsafeComplete:unsafeRegressions.map(x=>x.caseId),
    winnerGate:paired.length>0 && regressions.length===0 &&
      unsafeRegressions.length===0 && improvements.length>0
  };
}
