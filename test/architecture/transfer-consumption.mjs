import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from '../browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();
try{
 const context=await browser.newContext({serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await waitForAppBoot(page);assert.deepEqual(errors,[]);
 const before=await page.evaluate(()=>({identity:localStorage.getItem('repforge_telemetry_identity_v1'),consent:localStorage.getItem('repforge_telemetry_enabled_v1')}));
 const rejected=await page.evaluate(()=>window.__repforgeInstallTransferImport({},{claimId:'invalid'}));
 assert.equal(rejected.ok,false);assert.equal(await page.evaluate(()=>localStorage.getItem('repforge_install_transfer_freeze_v1')),null);
 assert.deepEqual(await page.evaluate(()=>({identity:localStorage.getItem('repforge_telemetry_identity_v1'),consent:localStorage.getItem('repforge_telemetry_enabled_v1')})),before);
 await page.reload();await waitForAppBoot(page);assert.deepEqual(errors,[]);await context.close();
 console.log('Consumed native transfer: ordinary boot, rejected envelope, freeze release and reload pass');
}finally{await browser.close()}
