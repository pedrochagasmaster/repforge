#!/usr/bin/env node
/**
 * Source of truth: the two existing i18n catalog entries, not a duplicate
 * prompt assembled in Worker code. Check mode belongs in CI.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const here=dirname(fileURLToPath(import.meta.url));
const repoRoot=resolve(here,"../../..");
const read=locale=>{
  const catalog=JSON.parse(readFileSync(resolve(repoRoot,"i18n-"+locale+".json"),"utf8"));
  const value=catalog["entry.freeform.prompt"];
  if(typeof value!=="string"||(value.match(/\{program\}/g)||[]).length!==1)
    throw new Error("Invalid production prompt in i18n-"+locale+".json");
  return value;
};
const prompts={en:read("en"),pt:read("pt")};
const path=resolve(here,"../src/prompts.mjs");
const rendered="/** Generated from entry.freeform.prompt in i18n-en/pt.json. Do not edit manually. */\n"+
  "export const IMPORT_PROMPTS = Object.freeze("+JSON.stringify(prompts,null,2)+");\n";
if(process.argv.includes("--check")){
  if(readFileSync(path,"utf8")!==rendered){
    throw new Error("Server import prompts drifted from i18n: run scripts/build-prompts.mjs");
  }
  console.log("Managed import prompt parity verified for both locales");
}else{
  writeFileSync(path,rendered);
  console.log("Updated Worker prompts from production i18n catalogs");
}
