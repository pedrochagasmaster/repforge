/**
 * Replay previous synthetic model replies against current gold and current
 * production importer without another provider request. New results are a
 * separate artifact, never silently overwriting the original experiment.
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from "node:fs";
import {resolve,basename} from "node:path";
import {createHash} from "node:crypto";
import {getCases,validateCases} from "./benchmark.mjs";
import {withTauriferParser} from "./parser.mjs";
import {gradeCase} from "./grade.mjs";
import {loadRun,writeReport} from "./report.mjs";

export async function regradeRun(sourceDir,outDir,repoRoot,{unlockHoldout=false}={}){
  validateCases();
  const source=resolve(sourceDir),out=resolve(outDir);
  if(source===out)throw new Error("Regraded results must be written to a new directory");
  if(existsSync(resolve(out,"meta.json")))
    throw new Error("Destination already exists; preserve original replay evidence");
  const meta=JSON.parse(readFileSync(resolve(source,"meta.json"),"utf8"));
  if(!["development","validation","holdout","stress"].includes(meta.split))
    throw new Error("Unknown source run split");
  if(meta.split==="holdout"&&!unlockHoldout)
    throw new Error("Holdout regrade requires explicit --unlock-holdout; do not tune on it");
  const cases=new Map(getCases(meta.split).map(c=>[c.id,c]));
  const results=loadRun(source);
  const manifest=JSON.parse(readFileSync(resolve(repoRoot,
    "tools/program-import-eval/fixtures/manifest.json"),"utf8"));
  const newHash=meta.split==="stress"?manifest.stress.stressSha256:manifest.sha256;
  const identityHash=createHash("sha256")
    .update(JSON.stringify(meta)).digest("hex");
  const entries=[];
  await withTauriferParser(repoRoot,async parse=>{
    for(const old of results){
      const sample=cases.get(old.caseId);
      if(!sample)throw new Error("Case missing from current benchmark: "+old.caseId);
      if(!old.rawOutputPath)throw new Error("Raw synthetic reply absent: "+old.caseId);
      // The importer only reads a previously written synthetic benchmark reply.
      const filename=basename(old.rawOutputPath);
      if(filename!==old.caseId+"-r"+old.repeatIndex+".txt")
        throw new Error("Suspicious reply filename: "+filename);
      const rawFile=resolve(source,"replies",filename);
      const reply=readFileSync(rawFile,"utf8");
      const parsed=await parse(reply);
      const graded=gradeCase(sample,parsed,{
        transport:old.transport,model:old.model,promptId:old.promptId,
        latencyMs:old.latencyMs,usage:old.usage,costUsd:old.costUsd,
        exitCode:old.exitCode,rawOutputPath:null
      });
      graded.repeatIndex=old.repeatIndex;
      graded.effort=old.effort||meta.effort||"medium";
      graded.costSource=old.costSource||null;
      graded.promptHash=old.promptHash;
      graded.provider=old.provider;
      graded.transportFailure=old.transportFailure;
      if(old.transportFailure){
        graded.semanticPass=false;
        graded.errors.push({code:"transport_failure"});
      }
      entries.push(graded);
    }
  });
  const nextMeta={
    ...meta,
    benchmarkHash:newHash,gitHead:meta.gitHead,
    derivedFrom:source,originalMetaSha256:identityHash,
    previousBenchmarkHash:meta.benchmarkHash,
    holdoutRegradeAuthorized:meta.split==="holdout"&&unlockHoldout,
    graderReplayedAt:new Date().toISOString(),
    regradeGoldChanged:meta.benchmarkHash!==newHash,
    resultSchema:3,
    persistRaw:false
  };
  mkdirSync(out,{recursive:true});
  writeFileSync(resolve(out,"meta.json"),
    JSON.stringify(nextMeta,null,2)+"\n");
  writeFileSync(resolve(out,"results.jsonl"),
    entries.map(x=>JSON.stringify(x)).join("\n")+"\n");
  const report=writeReport(entries,nextMeta,out);
  return {out,from:source,summary:report.summary,
    goldChanged:nextMeta.regradeGoldChanged};
}
