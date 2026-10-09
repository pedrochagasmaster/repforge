import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const ROOT=resolve(import.meta.dirname,"..");
const DIST=join(ROOT,"dist");

test("Cloudflare Pages output excludes repository research and includes the app shell",()=>{
  const result=spawnSync(process.execPath,["scripts/build-pages-dist.mjs"],{cwd:ROOT,encoding:"utf8"});
  try {
    assert.equal(result.status,0,result.stderr);
    for(const path of ["index.html","sw.js","app.js","exercises.js","assets/exercise-catalog.json","fonts/plexsans.woff2","i18n-pt.json"]){
      assert.ok(existsSync(join(DIST,path)),path);
    }
    for(const path of ["plans","docs","tools","scripts","test",".git",".github","AGENTS.md","README.md","plans/067/data/app_file.json"]){
      assert.ok(!existsSync(join(DIST,path)),"unexpected public file: "+path);
    }
    assert.ok(readdirSync(DIST).length>10);
  } finally {
    rmSync(DIST,{recursive:true,force:true});
  }
});
