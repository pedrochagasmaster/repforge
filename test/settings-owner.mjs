import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launchChromium,waitForAppBoot} from './browser.mjs';
const BASE=process.env.REPFORGE_URL||'http://localhost:8000/';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/install-transfer-clone-v1.json',import.meta.url),'utf8'));
const browser=await launchChromium();
let checks=0;
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',locale:'en-US'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 await page.addInitScript(snapshot=>{
   snapshot.profile={weightKg:74,weightUnit:'kg',sex:'female',futureAnswer:{private:'retained'}};
   localStorage.setItem('repforge_v1',JSON.stringify({...snapshot,_storageRevision:4}));
   localStorage.setItem('repforge_ui_v1',JSON.stringify({theme:'dark',tourDone:true,unknownChoice:{retained:true}}));
   localStorage.setItem('repforge_telemetry_enabled_v1','false');
 },fixture.durableState);
 await page.goto(BASE);await waitForAppBoot(page,{base:BASE});
 await page.click('#openSettings');
 assert.equal(await page.locator('#theme').inputValue(),'dark');
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 assert.equal(await page.locator('#profileRow').isVisible(),true);checks+=3;
 await page.selectOption('#theme','light');
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 const themeState=await page.evaluate(()=>({prefs:JSON.parse(localStorage.getItem('repforge_ui_v1')),snapshot:JSON.parse(localStorage.getItem('repforge_v1'))}));
 assert.deepEqual(themeState.prefs.unknownChoice,{retained:true});
 assert.equal('theme' in themeState.snapshot.settings,false);checks+=3;
 // A malformed rest interval is refused at the real form boundary, while the
 // other settings keep their ordinary save path.
 await page.click('#restSecRow');await page.fill('#restSec','1.5');await page.locator('#restSec').dispatchEvent('change');
 await page.waitForFunction(()=>document.querySelector('#restSec')?.getAttribute('aria-invalid')==='true');
 assert.equal(await page.locator('#restSec').inputValue(),'120');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('repforge_v1')).settings.restSec),120);checks+=2;
 await page.fill('#restSec','90');await page.locator('#restSec').dispatchEvent('change');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('repforge_v1')).settings.restSec===90);
 // Real one-replica acceptance policy for profile deletion: failure of IDB
 // must not silently prevent a user from deleting private Basics locally.
 await page.evaluate(()=>{const durable=window.__repforgeStorage.durable;
   window.__settingsOriginalWrite=durable.storageIO.writeIdb;durable.storageIO.writeIdb=async()=>{throw new Error('settings-owner injected IDB fault')};});
 await page.click('#profileRow');await page.click('#profileClear');
 await page.waitForFunction(()=>!Object.prototype.hasOwnProperty.call(JSON.parse(localStorage.getItem('repforge_v1')),'profile'));
 assert.equal(await page.locator('#profileRow').isVisible(),false);checks++;
 // lastExport uses the same approved either-replica policy. Device preferences
 // never enter the backup's durable snapshot.
 await page.click('#dataBackupRow');
 const download=page.waitForEvent('download');await page.click('#exportJson');const file=await download;
 const backup=JSON.parse(readFileSync(await file.path(),'utf8'));
 assert.equal('profile' in backup,false);assert.equal('theme' in backup.settings,false);
 assert.match(backup.settings.lastExport,/^\d{4}-\d{2}-\d{2}T/);checks+=3;
 // Guide Replay rebases its device record on the current stored preferences,
 // rather than restoring a stale in-memory preference snapshot.
 await page.evaluate(()=>{const prefs=JSON.parse(localStorage.getItem('repforge_ui_v1'));prefs.otherTabChoice='preserve';localStorage.setItem('repforge_ui_v1',JSON.stringify(prefs));});
 await page.click('#guideReplayToggle');await page.click('[data-guide-replay="privacy"]');
 await page.waitForSelector('[data-guide-cue="privacy"]');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('repforge_ui_v1')).otherTabChoice),'preserve');
 await page.click('[data-guide-cue="privacy"] [data-guide-dismiss]');
 assert.equal(await page.evaluate(()=>window.__repforgeUi.guideState().privacy.status),'dismissed');checks+=2;
 await page.click('#privacyDetails');await page.waitForSelector('#privacySheet.is-open');
 await page.click('#privacyClose');await page.waitForFunction(()=>document.activeElement?.id==='privacyDetails');checks++;
 // The command can wait on another tab's state lock while the draft owner
 // acknowledges new session work through its real WAL sidecar path.
 const race=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',locale:'en-US'});
 const settingsTab=await race.newPage();settingsTab.on('pageerror',error=>errors.push(error.message));
 await settingsTab.addInitScript(snapshot=>{localStorage.setItem('repforge_v1',JSON.stringify({...snapshot,_storageRevision:4}));
   localStorage.setItem('repforge_ui_v1',JSON.stringify({tourDone:true}));localStorage.setItem('repforge_telemetry_enabled_v1','false');},fixture.durableState);
 await settingsTab.goto(BASE);await waitForAppBoot(settingsTab,{base:BASE});await settingsTab.click('#openSettings');
 await settingsTab.evaluate(()=>window.__repforgeStorage.flush());
 assert.equal(await settingsTab.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('repforge_pending_v1:')).length),0,'race begins without unrelated recovery journals');
 const other=await race.newPage();other.on('pageerror',error=>errors.push(error.message));await other.goto(BASE);await waitForAppBoot(other,{base:BASE});
 await other.evaluate(()=>{window.__settingsLockTask=navigator.locks.request('repforge:state-write',async()=>{
   window.__settingsLockHeld=true;await new Promise(resolve=>{window.__settingsReleaseLock=resolve});});});
 await other.waitForFunction(()=>window.__settingsLockHeld===true);
 await settingsTab.evaluate(()=>{const owner=window.__repforgeStorage.durable,original=owner.enqueueStateChange;
   owner.enqueueStateChange=async function(...args){const result=await original(...args);window.__settingsRaceResult=result;return result};});
 await settingsTab.click('#rirModeRow');await settingsTab.locator('input[name="rirMode"][value="effort"]').check();
 await settingsTab.waitForFunction(()=>Object.keys(localStorage).some(key=>key.startsWith('repforge_pending_v1:')&&JSON.parse(localStorage.getItem(key)).proposal?.settings?.rirMode==='effort'));
 await other.evaluate(async()=>{await window.__repforgeEnterWorkout({day:JSON.parse(localStorage.getItem('repforge_v1')).program[0].day});
   const written=await window.__repforgeWorkoutDraft.dispatch('setSessionNotes',{value:'acknowledged while settings waited'});
   if(written.status!=='applied')throw new Error('Draft race setup did not acknowledge session progress');
   await window.__repforgeWorkoutDraft.flush();});
 const progressedRaw=await other.evaluate(()=>window.__repforgeWorkoutDraft.raw());
 await other.evaluate(()=>window.__settingsReleaseLock());
 await settingsTab.evaluate(()=>window.__repforgeStorage.flush());
 const refusal=await settingsTab.evaluate(()=>window.__settingsRaceResult);
 assert.equal(refusal.code,'draft_conflict');assert.equal(refusal.committed,false);assert.equal(refusal.settled,true);
 assert.equal(await settingsTab.evaluate(()=>JSON.parse(localStorage.getItem('repforge_v1')).settings.rirMode),'numeric','WAL sidecar guard refuses a mode change after another tab acknowledges draft progress');
 assert.equal(await settingsTab.locator('input[name="rirMode"][value="numeric"]').isChecked(),true);
 assert.equal(await settingsTab.evaluate(()=>localStorage.getItem('repforge_draft_v1')),progressedRaw,'rejection promotes and retains the exact acknowledged draft');
 checks+=6;await race.close();
 assert.deepEqual(errors,[],'native Settings graph produces no uncaught browser errors');checks++;
 await context.close();
 console.log(`Settings owner production controls passed (${checks} checks)`);
}finally{await browser.close()}
