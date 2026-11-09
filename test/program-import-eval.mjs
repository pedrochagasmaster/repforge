#!/usr/bin/env node
/** Pure deterministic CI proof, with no paid model calls or browser. */
import {strict as assert} from "node:assert";
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {getCases,getTemplate,renderPrompt,validateCases} from "../tools/program-import-eval/benchmark.mjs";
import {gradeCase} from "../tools/program-import-eval/grade.mjs";
import {generateAll} from "../tools/program-import-eval/generate.mjs";
import {summarize} from "../tools/program-import-eval/report.mjs";
import {compareRuns} from "../tools/program-import-eval/compare.mjs";

const root=resolve(import.meta.dirname,"..");
const info=validateCases();
assert.equal(info.cases,200);
assert.equal(info.exercises,2676);
assert.equal(info.gapCases,60);
assert.equal(info.unsupportedCases,120);
const samples=getCases("all");
const stress=getCases("stress");
const manual=getCases("adjudication");
assert.equal(stress.length,40);
assert.equal(stress.filter(x=>x.expectedOutcome==="import").length,24);
assert.equal(stress.filter(x=>x.expectedOutcome==="reject").length,16);
assert.equal(manual.length,8);
assert(manual.every(x=>x.requiresAdjudication));
assert.equal(samples.length,200);
assert.equal(samples.filter(x=>x.locale==="en").length,100);
assert.equal(samples.filter(x=>x.locale==="pt").length,100);
assert.equal(samples.filter(x=>x.tags.includes("prompt_injection")).length,20);
assert.equal(samples.filter(x=>x.tags.includes("amrap")).length,20);
assert.deepEqual(samples,generateAll());

const sourceManifest=JSON.parse(readFileSync(resolve(root,"tools/program-import-eval/fixtures/manifest.json"),"utf8"));
const fixtureText=readFileSync(resolve(root,"tools/program-import-eval/fixtures/all.jsonl"),"utf8");
assert.equal(createHash("sha256").update(fixtureText).digest("hex"),sourceManifest.sha256);

for(const templateId of ["baseline","strict-v1","compact-v1"]){
  for(const locale of ["en","pt"]){
    const template=getTemplate(templateId,locale,root);
    const rendered=renderPrompt(template,"LIFTING_SOURCE_SENTINEL");
    assert(rendered.includes("LIFTING_SOURCE_SENTINEL"));
    assert(!rendered.includes("{program}"));
  }
}
const makeParser=(sample)=>({
  status:sample.expected.missing.length?"gaps":"complete",
  exercises:sample.expected.exercises,
  gaps:sample.expected.missing,
  notImported:sample.expected.notImported
});
for(const sample of samples){
  const result=gradeCase(sample,makeParser(sample));
  assert(result.semanticPass,sample.id+" gold should pass");
  assert(!result.unsafeComplete,sample.id+" gold should not be unsafe");
}
const complete=samples.find(x=>!x.expected.missing.length);
const corrupted=structuredClone(makeParser(complete));
corrupted.exercises[0].sets++;
const wrong=gradeCase(complete,corrupted);
assert(!wrong.semanticPass);
assert(wrong.unsafeComplete);
assert(wrong.errors.some(x=>x.code==="wrong_sets"));

const missing=samples.find(x=>x.expected.missing.some(y=>y.field==="sets"));
const invented=structuredClone(makeParser(missing));
const target=missing.expected.missing.find(x=>x.field==="sets");
const row=invented.exercises.find(x=>x.day===target.day&&x.order===target.order);
row.sets=3;
invented.gaps=invented.gaps.filter(x=>!(x.day===target.day&&x.order===target.order&&x.field==="sets"));
const inventedResult=gradeCase(missing,invented);
assert(!inventedResult.semanticPass);
assert(inventedResult.errors.some(x=>x.code==="invented_sets"));
const categoryCorruption=structuredClone(makeParser(complete));
categoryCorruption.notImported=["cardio"];
assert(!gradeCase(complete,categoryCorruption).semanticPass);

for(const sample of stress){
  if(sample.expectedOutcome==="reject"){
    const rejected=gradeCase(sample,{status:"unreadable"});
    assert(rejected.semanticPass&&rejected.unsafeComplete===false,sample.id+" should reject");
    const invented=gradeCase(sample,{status:"complete",exercises:[{
      day:"Fabricated",order:1,name:"Squat",sets:3,min:8,max:8
    }]});
    assert(!invented.semanticPass&&invented.unsafeComplete,
      sample.id+" invented program must be critical");
    assert(invented.errors.some(e=>e.code==="non_program_accepted"));
  }else{
    const exact=gradeCase(sample,makeParser(sample));
    assert(exact.semanticPass&&!exact.unsafeComplete,sample.id+" gold should pass");
  }
}
assert.throws(()=>gradeCase(manual[0],{status:"unreadable"}),/adjudication/);
const dup=structuredClone(makeParser(samples.find(x=>!x.expected.missing.length)));
dup.notImported=["rest_times","rest_times"];
assert(gradeCase(samples.find(x=>!x.expected.missing.length),dup)
  .errors.some(e=>e.code==="duplicate_categories"));

const costPositive=gradeCase(complete,makeParser(complete),{costUsd:0.01});
const rejectionSample=stress.find(x=>x.expectedOutcome==="reject");
const costRejected=gradeCase(rejectionSample,{status:"unreadable"},{costUsd:0.01});
const costSummary=summarize([costPositive,costRejected]);
assert.equal(costSummary.positiveCases,1);
assert.equal(costSummary.rejectionCases,1);
assert.equal(costSummary.observedCostUsd,0.02);
assert.equal(costSummary.observedCostPerFaithfulImport,0.02);
assert.equal(costSummary.rejectionRate,1);
assert.equal(costSummary.parseRate,1);

const rootTmp=mkdtempSync(resolve(tmpdir(),"taurifer-compare-proof-"));
try{
  const before=resolve(rootTmp,"before"),after=resolve(rootTmp,"after");
  mkdirSync(before);mkdirSync(after);
  const meta={benchmarkHash:"test-hash",split:"stress",caseIds:[rejectionSample.id],
    repeat:1,transport:"claude",model:"haiku",promptId:"baseline"};
  writeFileSync(resolve(before,"meta.json"),JSON.stringify(meta));
  writeFileSync(resolve(after,"meta.json"),JSON.stringify(meta));
  const baseline={
    ...costRejected,caseId:rejectionSample.id,repeatIndex:1,
    semanticPass:false,unsafeComplete:true,errors:[{code:"non_program_accepted"}]
  };
  const candidate={...costRejected,repeatIndex:1};
  writeFileSync(resolve(before,"results.jsonl"),JSON.stringify(baseline)+"\n");
  writeFileSync(resolve(after,"results.jsonl"),JSON.stringify(candidate)+"\n");
  const cmp=compareRuns(before,after);
  assert.equal(cmp.paired,1);
  assert.equal(cmp.exactDelta,1);
  assert.equal(cmp.productionPromotionApproved,false);
  const mismatched={...meta,caseIds:["other-case"]};
  writeFileSync(resolve(after,"meta.json"),JSON.stringify(mismatched));
  assert.throws(()=>compareRuns(before,after),/same cases/);
}finally{rmSync(rootTmp,{recursive:true,force:true})}

console.log("program import eval: 200 researched-style synthetic, 40 stress (24 positive / 16 reject), 8 adjudication cases PASS; no LLM calls");
