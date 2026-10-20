import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {launchChromium} from './browser.mjs';
import {createGenerationRules} from '../src/training/generation.js';
import {createEntryAdapter} from '../src/training/authoring.js';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const {compiler,identity}=createGenerationRules();
const raw=JSON.parse(readFileSync(new URL('../assets/exercise-catalog.json',import.meta.url)));
identity.prepareCatalog(raw);
const request=createEntryAdapter({compiler}).programRequestFromAnswers({desiredResult:'muscle_growth',structuredExperience:'6_to_24m',daysPerWeek:3,sessionMinutes:90,environment:{kind:'commercial_gym'}},raw).value;
const source=createRequire(import.meta.url)('../exercises.js');
const pin=source.EXERCISE_CATALOG_SHA256||source.catalogSha256;
const browser=await launchChromium();
try {
 const page=await browser.newPage();await page.goto(new URL('manifest.webmanifest',base).href);
 const proof=await page.evaluate(async({base,pin,request})=>{
  const [{createGenerationRules},{createCatalog},E]=await Promise.all(['src/training/generation.js','src/platform/catalog.js','src/platform/program-executor.js'].map(path=>import(new URL(path,base).href)));
  const rules=createGenerationRules();const catalog=createCatalog({identity:rules.identity,catalogSha256:pin});await catalog.load();
  const policy=structuredClone(rules.compiler.getDefaultEnginePolicy());for(const key in policy.volume.setsByType)policy.volume.setsByType[key]=2;
  const options={enginePolicy:policy,diagnostics:'allocation-lineage@1'};
  const common={compiler:rules.compiler,transition:rules.transition,catalog:()=>catalog.snapshot()};
  const worker=E.create({...common,allowMainThreadFallback:false,worker:{url:E.url,catalogSha256:pin}});
  const mode=await worker.ready();const generated=await worker.generate(request,options);
  const expected=rules.compiler.generateProgram(request,catalog.snapshot(),options);
  const fallback=E.create({...common,worker:{url:new URL('missing-lab-worker.js',base).href,catalogSha256:pin}});
  const fallbackMode=await fallback.ready();const recovered=await fallback.generate(request,options);
  const strict=E.create({...common,allowMainThreadFallback:false,worker:{url:new URL('missing-strict-lab-worker.js',base).href,catalogSha256:pin}});
  const strictMode=await strict.ready();let refused=false;try{await strict.generate(request,options)}catch(error){refused=error.code==='worker_unavailable'}
  const result={mode,fallbackMode,strictMode,refused,same:JSON.stringify(generated)===JSON.stringify(expected),fallbackSame:JSON.stringify(recovered)===JSON.stringify(expected),ok:generated.ok,
    twoSets:generated.value.days.flatMap(day=>day.slots).every(slot=>slot.prescriptionsByCycle[0].sets.length===2),strictMain:strict.stats().main};
  worker.dispose();fallback.dispose();strict.dispose();return result;
 },{base,pin,request});
 assert.deepEqual(proof,{mode:'worker',fallbackMode:'main',strictMode:'failed',refused:true,same:true,fallbackSame:true,ok:true,twoSets:true,strictMain:0});
 console.log('PASS actual native Lab policy+diagnostics worker/main byte parity and strict unavailable-worker refusal without main computation');
}finally{await browser.close()}
