#!/usr/bin/env node
/** Pure deterministic CI proof, with no paid model calls or browser. */
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {getCases,getTemplate,renderPrompt,validateCases} from "../tools/program-import-eval/benchmark.mjs";
import {gradeCase} from "../tools/program-import-eval/grade.mjs";
import {generateAll} from "../tools/program-import-eval/generate.mjs";

const root=resolve(import.meta.dirname,"..");
const info=validateCases();
assert.equal(info.cases,200);
assert.equal(info.exercises,2676);
assert.equal(info.gapCases,60);
assert.equal(info.unsupportedCases,120);
const samples=getCases("all");
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

console.log("program import eval: 200 gold fixtures, 20 references, adversarial/grading cases PASS; no LLM calls");
