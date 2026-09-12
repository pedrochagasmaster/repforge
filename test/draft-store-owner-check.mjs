#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root=resolve(new URL("..",import.meta.url).pathname);
const fixture=mkdtempSync(join(tmpdir(),"taurifer-draft-owner-"));
try{
  writeFileSync(join(fixture,"durable-state.js"),readFileSync(join(root,"durable-state.js")));
  writeFileSync(join(fixture,"app.js"),`${readFileSync(join(root,"app.js"),"utf8")}
async function legacyCheckpointMutation(){
  DraftStore.writeV2Checkpoint({});
}
`);
  const result=spawnSync(process.execPath,[join(root,"tools/move-draft-store-owner.mjs"),"--check"],{
    encoding:"utf8",env:{...process.env,TAURIFER_DRAFT_STORE_ROOT:fixture}});
  if(result.status===0)throw new Error("ownership checker accepted app-owned checkpoint mutation");
  if(!`${result.stderr}${result.stdout}`.includes("app.js still mutates DraftV2 checkpoint state"))
    throw new Error(`ownership checker failed for the wrong reason: ${result.stderr||result.stdout}`);
  console.log("draft-store ownership negative fixture: passed");
}finally{rmSync(fixture,{recursive:true,force:true})}
