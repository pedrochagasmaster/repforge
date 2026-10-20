import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from './browser.mjs';
import {installSeedProgram,seedProgramMeta} from './fixtures/seed-program.mjs';
import {ensureBrowserInterchange} from './interchange-browser.mjs';
const browser=await launchChromium();
try{
 const context=await browser.newContext();
 await context.addInitScript(()=>{window.__sharingCalls=[];window.__sharingCopies=[];Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>window.__sharingCalls.push(payload)});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__sharingCopies.push(text)}})});
 const page=await context.newPage();await page.goto(process.env.REPFORGE_URL||'http://localhost:8000/');await waitForAppBoot(page);
 await installSeedProgram(page,{waitFor:waitForAppBoot});
 await page.evaluate(()=>{window.closeFirstRun?.();window.closeTour?.()});
 await page.click('nav button[data-view="program"]');await page.click('#shareProgramSetup');
 await page.waitForFunction(()=>document.querySelector('#shareSetupLink')?.textContent?.includes('#setup=v4.'));
 const link=await page.locator('#shareSetupLink').textContent();
 await ensureBrowserInterchange(page);
 const decoded=await page.evaluate(async link=>{const catalog=await(await fetch('./assets/exercise-catalog.json')).json();const {compiler}=await import('./src/training/generation.js');return window.__repforgeInterchangeTest.setup.decode(new URL(link).hash.slice(7),{catalogSnapshot:catalog,validateProgramDefinition:compiler.validateProgramDefinition,generateProgram:compiler.generateProgram,generatorVersion:compiler.GENERATOR_VERSION})},link);
 assert.equal(decoded.ok,true);assert.deepEqual(decoded.value.program.definition,seedProgramMeta().programDefinition,'production sharing carries the authored seed definition exactly');
 assert.deepEqual(Object.keys(decoded.value.settings).sort(),['hardRir','jumpPct','lang','minJump','restSec','rirHigh','rirMode','unit']);
 assert.deepEqual(Object.keys(decoded.value).sort(),['kind','language','program','settings','version'],'workout/history/device state is excluded');
 assert.equal(new URL(link).search,'');
 await page.click('#shareSetupCopy');await page.click('#shareSetupShare');
 assert.deepEqual(await page.evaluate(()=>window.__sharingCopies),[link]);
 const shares=await page.evaluate(()=>window.__sharingCalls);assert.equal(shares.length,1);assert.deepEqual(Object.keys(shares[0]).sort(),['title','url']);assert.equal(shares[0].url,link);
 await page.click('#shareSetupClose');await page.waitForFunction(()=>document.querySelector('#shareSetupSheet').hidden);
 await page.click('#exportProgramText');await page.waitForSelector('#programTextSheet:not([hidden])');
 const text=await page.locator('#programTextOut').textContent();assert.match(text,/1\. Hack squat: 2× 4 to 8/);assert.match(text,/2\. Seated leg curl: 2× 4 to 8/);
 await page.click('#programTextCopy');assert.equal((await page.evaluate(()=>window.__sharingCopies)).at(-1),text);
 await context.close();console.log('PASS native outbound production: exact authored definition, eight settings, URL-only copy/share and literal text grammar');
}finally{await browser.close()}
