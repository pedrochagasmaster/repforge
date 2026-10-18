import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from '../browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();
try{
 for(const [locale,reduced,width] of [['en-GB','no-preference',390],['pt-BR','reduce',320]]){
  const context=await browser.newContext({viewport:{width,height:844},locale,reducedMotion:reduced,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(base,{waitUntil:'domcontentloaded'});await waitForAppBoot(page,{base});
  await page.locator('#firstRun').waitFor({state:'visible'});
  const pt=locale==='pt-BR';
  assert.equal(await page.locator('#firstRunHeadline').innerText(),pt?'Chegue na academia sabendo exatamente o que fazer.':'Walk into the gym knowing exactly what to do.');
  assert.equal(await page.locator('[data-landing-outcome="add"] [data-landing-next]').innerText(),pt?'62,5 kg × 9':'62.5 kg × 9');
  assert.equal(await page.locator('[data-landing-outcome="hold"] [data-landing-next]').innerText(),'100 kg × 7');
  assert.equal(await page.locator('[data-landing-outcome="reduce"] [data-landing-next]').innerText(),pt?'62,5 kg × 10':'62.5 kg × 10');
  assert.equal(await page.locator('[data-shot="paste-review"]').getAttribute('width'),'780');
  assert.ok((await page.locator('[data-shot="paste-review"]').getAttribute('alt')).length>40);
  assert.equal(await page.locator('#firstRun').evaluate(root=>root.scrollWidth<=root.clientWidth+1),true);
  await page.evaluate(()=>window.__repforgeStorage.flush());
  const raw=await page.evaluate(()=>localStorage.getItem('repforge_v1'));
  await page.evaluate(()=>window.__repforgeUi.setTheme('dark'));
  assert.ok((await page.locator('[data-shot="paste-review"]').getAttribute('src')).endsWith(pt?'paste-review-pt-dark.webp':'paste-review-en-dark.webp'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('repforge_v1')),raw,'landing paint must not write training data');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'firstRunPrivacy');
  if(reduced==='reduce'){
   assert.equal(await page.locator('.firstrun-proof__phone').count(),0);
   assert.equal(await page.locator('#firstRunProofSteps .motion-step').count(),0);
  }else{
   await page.waitForFunction(()=>document.querySelectorAll('.firstrun-proof__phone').length===1);
   await page.locator('#firstRun').evaluate(root=>{const track=root.querySelector('#firstRunProofTrack'),stage=root.querySelector('#firstRunProofStage');root.scrollTop=track.offsetTop+(track.offsetHeight-stage.offsetHeight)*.6;root.dispatchEvent(new Event('scroll'))});
   await page.waitForFunction(()=>Number(document.querySelector('.firstrun-proof__rail [aria-current="step"]')?.getAttribute('data-go'))>0);
   assert.equal(await page.locator('.firstrun-proof__rail [aria-current="step"]').count(),1);
  }
  await page.click('#firstRunCreate');
  await page.locator('#onboarding.active').waitFor();
  assert.equal(await page.locator('.firstrun-proof__phone').count(),0);
  assert.deepEqual(await page.evaluate(()=>window.__repforgeLandingProof()),{open:false,listeners:0,observers:0,timers:0,frames:0,pinned:false,step:null,ticks:0});
  await page.click('#onbCancel');await page.click('#entryCancelDiscard');
  await page.locator('#todayNoProgram').waitFor({state:'visible'});
  await page.evaluate(()=>window.openFirstRun());
  assert.equal(await page.locator('#firstRunHeadline').innerText(),pt?'Escolha como você quer treinar.':'Choose how you want to train.');
  assert.equal(await page.locator('#firstRun').getAttribute('data-entry-visit'),'returning');
  assert.equal(await page.locator('.firstrun-proof__phone').count(),0);
  await page.evaluate(()=>{window.closeFirstRun();window.dispatchEvent(new Event('resize'));document.querySelector('#firstRun').dispatchEvent(new Event('scroll'))});
  assert.equal(await page.locator('.firstrun-proof__phone').count(),0);
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('Landing actual browser: EN/PT literal engine figures, media/theme, no training writes, Tab focus, pinned/reduced-motion geometry, close disposal and returning/cancel navigation passed');
}finally{await browser.close()}
