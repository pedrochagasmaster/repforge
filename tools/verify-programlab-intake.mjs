#!/usr/bin/env node
/** Reconcile an exact unmerged input in temporary space. Never writes its checkout. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,cp,rm,symlink,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const root=path.resolve(import.meta.dirname,'..');
const at=process.argv.indexOf('--source');
if(at<0 || !process.argv[at+1])throw Error('Usage: node tools/verify-programlab-intake.mjs --source <checkout-containing-pinned-commit> [--browser]');
const source=path.resolve(process.argv[at+1]);
const input=JSON.parse(await readFile(path.join(root,'docs/architecture/programlab-intake/source-inputs.json')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const temporary=await mkdtemp(path.join(tmpdir(),'taurifer-lab-intake-'));
let browser,server;
try {
 const checkout=path.join(temporary,'source');await mkdir(checkout);
 for(const [name,digest] of Object.entries(input.sourceFiles)) {
  const bytes=execFileSync('git',['-C',source,'show',`${input.head}:${name}`]);
  assert.equal(sha(bytes),digest,`pinned source drift: ${name}`);
  await mkdir(path.dirname(path.join(checkout,name)),{recursive:true});await writeFile(path.join(checkout,name),bytes);
 }
 const patch=path.join(root,'docs/architecture/programlab-intake/ce0b4403-native-imports.patch');
 execFileSync('git',['apply','--check',patch],{cwd:checkout});
 execFileSync('git',['apply',patch],{cwd:checkout});
 await cp(path.join(root,'src'),path.join(checkout,'src'),{recursive:true});
 await cp(path.join(root,'fonts'),path.join(checkout,'fonts'),{recursive:true});
 for(const name of ['exercises.js','assets/exercise-catalog.json','test/fixtures/program-compiler-corpus-cases.mjs']) {
  await mkdir(path.dirname(path.join(checkout,name)),{recursive:true});await cp(path.join(root,name),path.join(checkout,name));
 }
 await mkdir(path.join(checkout,'tools/typecheck'),{recursive:true});
 await symlink(path.join(root,'tools/typecheck/node_modules'),path.join(checkout,'tools/typecheck/node_modules'),'dir');
 const {buildProgramLab}=await import(pathToFileURL(path.join(checkout,'tools/build-programlab.mjs')).href);
 const output=path.join(temporary,'artifact');const manifest=await buildProgramLab({sourceDir:checkout,outDir:output});
 assert.equal(manifest.worker.type,'module');assert.equal(manifest.worker.url,'src/platform/program-worker.js');
 assert.equal(manifest.archiveWorker.url,'programlab/archive-entry.js');
 assert(manifest.runtimeFiles.includes('src/training/generation/internal/policy.js'));
 assert(manifest.runtimeFiles.every(name=>name==='exercises.js'||/^src\/(training|platform)\//.test(name)));
 for(const [name,record] of Object.entries(manifest.files))assert.equal(sha(await readFile(path.join(output,name))),record.sha256,`artifact bytes: ${name}`);
 assert(!Object.keys(manifest.files).some(name=>/^(?:app|program-engine|program-compiler|engine-policy)\.js$/.test(name)),'no permanent parallel engine');
 await assert.rejects(buildProgramLab({sourceDir:checkout,outDir:output}),/already exists/,'existing artifact is never overwritten');
 const policyFile=path.join(checkout,'src/training/generation/internal/policy.js');
 await rename(policyFile,policyFile+'.held');
 try{await assert.rejects(buildProgramLab({sourceDir:checkout,outDir:path.join(temporary,'missing-policy')}),/ENOENT/,'missing transitive policy cannot package a partial worker graph')}finally{await rename(policyFile+'.held',policyFile)}
 const entry=path.join(checkout,'src/training/generation.js'),originalEntry=await readFile(entry,'utf8');
 await writeFile(entry,originalEntry+'\nexport * from "../../programlab/domain.js";\n');
 try{await assert.rejects(buildProgramLab({sourceDir:checkout,outDir:path.join(temporary,'leaking-graph')}),/crossed its isolated public graph/,'production/Lab import backedge is rejected')}finally{await writeFile(entry,originalEntry)}
 // Run the exact pinned Lab metrics assertions against its patched domain and
 // the native shared owners. Only the import/composition header is substituted.
 let proof=await readFile(path.join(checkout,'test/programlab-native-policy.mjs'),'utf8');
 const first=proof.indexOf('const require ='),last=proof.indexOf('const request =');
 const moduleURL=name=>JSON.stringify(pathToFileURL(path.join(checkout,name)).href);
 proof=proof.slice(0,first)+`const {createGenerationRules}=await import(${moduleURL('src/training/generation.js')});
const {createEntryAdapter}=await import(${moduleURL('src/training/authoring.js')});
const {readFile}=await import('node:fs/promises');
const {compiler:C,identity}=createGenerationRules(),P=C,A=createEntryAdapter({compiler:C});
const K=JSON.parse(await readFile(new URL(${moduleURL('assets/exercise-catalog.json')})));
identity.prepareCatalog(K);
const D=(await import(${moduleURL('programlab/domain.js')})).default;
`+proof.slice(last);
 await writeFile(path.join(checkout,'pinned-policy-proof.mjs'),proof);
 const policyProof=execFileSync(process.execPath,[path.join(checkout,'pinned-policy-proof.mjs')],{encoding:'utf8'}).trim();
 if(process.argv.includes('--browser')) {
  const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.woff2':'font/woff2'};
  server=createServer(async(request,response)=>{
   const name=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
   const file=path.resolve(output,'.'+(name==='/'?'/index.html':name));
   if(!file.startsWith(output+path.sep)){response.writeHead(403);response.end();return}
   try{const bytes=await readFile(file);response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});response.end(bytes)}catch{response.writeHead(404);response.end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/`;
  const {launchChromium}=await import('../test/browser.mjs');browser=await launchChromium();
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  try{await page.waitForFunction(()=>!document.querySelector('#run')?.disabled,null,{timeout:15000})}
  catch(error){throw new Error(`Patched Lab did not become ready; browser errors: ${JSON.stringify(errors)}; UI: ${await page.locator('body').innerText()}`,{cause:error})}
  const result=await page.evaluate(async()=>{
   localStorage.setItem('repforge_v1','production-sentinel');localStorage.setItem('repforge_draft_v1','draft-sentinel');
   const S=globalThis.RepForgeProgramLabServices;
   const G=await import('./src/training/generation.js');
   const defaults=G.getDefaultEnginePolicy();
   const configuration={name:'Native intake proof',notes:'',mode:'single',scenarios:[S.fixture('three-day')],baselinePolicy:defaults,candidatePolicy:S.applyPreset('two_sets_low_rir@1'),referenceTimePolicy:defaults,sweep:null};
   const run=await S.run(configuration,{});if(run.status!=='completed')throw Error('Lab run failed: '+run.status);
   const bytes=records=>JSON.stringify(records.map(record=>[record.cellKey,record.resultJSON]).sort((a,b)=>a[0].localeCompare(b[0])));
   const saved=await S.save(run.plan.experiment);const loaded=await S.load(saved.id);
   if(bytes(loaded.run.records)!==bytes(run.records))throw Error('durable result bytes changed');
   const parts=await S.exportArchive(run.plan.experiment,run);
   const imported=await S.importArchive(parts.map(part=>part.text));
   if(bytes(imported.run.records)!==bytes(run.records))throw Error('archive result bytes changed');
   const provenance=run.buildProvenance;
   return{status:run.status,cells:run.records.length,roundTrip:true,sourceHashes:Object.keys(provenance.sourceHashes).length,
    nativePolicy:provenance.runtimeFiles.includes('src/training/generation/internal/policy.js'),
    production:localStorage.getItem('repforge_v1'),draft:localStorage.getItem('repforge_draft_v1'),workers:(await navigator.serviceWorker.getRegistrations()).length,
    databases:(await indexedDB.databases()).map(database=>database.name)};
  });
  assert.deepEqual(errors,[]);assert.equal(result.cells,2);assert.equal(result.nativePolicy,true);assert(result.sourceHashes>20);
  assert.equal(result.production,'production-sentinel');assert.equal(result.draft,'draft-sentinel');assert.equal(result.workers,0);
  assert.deepEqual(result.databases,['taurifer_programlab_v1']);
  console.log('PASS exact patched Lab root: actual native compiler worker, isolated IDB, save/load, module archive-worker byte round trip, native provenance, untouched production sentinels, no SW');
 }
 console.log(JSON.stringify({pinnedHead:input.head,nativeHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),nativeDirty:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()!=='',patchApplies:true,artifactFiles:Object.keys(manifest.files).length,runtimeFingerprint:manifest.runtimeFingerprint,policyProof},null,2));
} finally {
 await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));
 await rm(temporary,{recursive:true,force:true});
}
