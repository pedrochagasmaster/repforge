import { waitForAppBoot } from './browser.mjs';
import { installGeneratedProgram, definitionSlot, isWeightRepsSlot, metricLogRow } from './fixtures/history-metric-rows.mjs';
import { importInto } from './fixtures/install-transfer-import.mjs';

export async function profileRingProofs(browser, assert, base) {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const boot=async p=>{await p.goto(base,{waitUntil:'domcontentloaded'});await waitForAppBoot(p,{base});await p.evaluate(()=>window.closeFirstRun?.());};
  const commit=async next=>page.evaluate(async value=>{
    const result=await window.__repforgeCommitProposedState(value);
    if(!result.committed)throw new Error('profile fixture commit refused');
    await window.__repforgeStorage.flush();
  },next);
  try {
    await boot(page);
    assert(!await page.locator('#todayProfile').isVisible(),'no-program Today has no profile ring');
    const generated=await installGeneratedProgram(page);
    assert(await page.locator('#todayProfile').isVisible(),'onboarded fresh program has the ink profile ring');
    if(!await page.locator('#todayProfile').isVisible())return;
    const unique=generated.program.filter((ex,i,all)=>all.findIndex(other=>other.libraryId===ex.libraryId)===i);
    const lifts=unique.filter(ex=>isWeightRepsSlot(definitionSlot(generated.programMeta,ex)));
    if(lifts.length<4)throw new Error('profile fixture requires four different weight/reps lifts');
    // Start from a fresh baseline, as first activation would, rather than treating fixture setup as a scope change.
    await page.evaluate(()=>window.__repforgeUi.setPref('profileScope',{v:1,scope:[],acknowledged:false}));
    const state={...generated,program:lifts.slice(0,2),log:[],settings:{...generated.settings,lang:'en'}};
    await commit(state);
    const date=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
    state.log=[3,2,1].flatMap(age=>state.program.flatMap(ex=>[1,2,3,4].map(set=>metricLogRow(state.programMeta,ex,{
      session:`profile-${age}`,date:date(age),set,load:60,reps:12-set,rir:2,extra:{effortSource:'rir'}
    }))));
    await commit(state);
    const today=await page.locator('#todayProfile svg').getAttribute('data-profile-fill');
    assert(Number(today)>0,'Today reads saved evidence through the production profile projection');
    await page.click('#todayProfile');
    await page.waitForSelector('#overviewProfile [data-profile-lift]');
    assert(await page.locator('#overviewProfile svg').first().getAttribute('data-profile-fill')===today,'Today and Overview use the identical reading');
    assert(!/%/.test(await page.locator('#overviewProfile').innerText()),'no percentage is printed in the profile');
    const row=page.locator('#overviewProfile [data-profile-lift]').first();
    const key=await row.getAttribute('data-profile-lift');
    await row.click();await page.waitForSelector('#profilePage.active .profile-stage-list');
    assert((await page.locator('#profilePage').innerText()).includes('Current estimate: Solid'),'stage reader separates attained stages from the current estimate');
    assert(await page.locator('#profilePage [data-attained="true"]').count()>=2,'saved boundaries appear as attained stages');
    assert((await page.locator('#profilePage .profile-depth').innerText()).includes('3 of 64'),'reader shows real distinct saved depth dates');
    await page.click('#profilePageBack');
    await page.waitForFunction(key=>document.activeElement?.getAttribute('data-profile-lift')===key,key);
    assert(await row.isVisible(),'Back restores the profile and focus to the opening lift');
    await row.click();await page.evaluate(()=>history.back());
    await page.waitForFunction(()=>document.querySelector('#stats')?.classList.contains('active'));
    assert(!await page.locator('#profilePage').isVisible(),'browser Back returns from the stage reader');

    state.program=lifts.slice(0,3);await commit(state);
    await page.click('[data-view="log"]');
    assert((await page.locator('#todayProfileNeed').innerText()).includes('1 new lift'),'Today explains actual scope growth');
    const expandedFill=Number(await page.locator('#todayProfile svg').getAttribute('data-profile-fill'));
    assert(expandedFill<Number(today),'current denominator applies immediately without a drain animation');
    await page.click('#todayProfile');await page.waitForSelector('#profilePage.active .profile-scope-rings');
    assert(await page.locator('.profile-scope-rings svg').count()===2,'first Overview visit shows static before/now scope rings');
    assert(!await page.locator('.profile-scope-rings svg').evaluateAll(nodes=>nodes.some(n=>n.getAnimations({subtree:true}).length)),'scope rings have no backward tween');
    await page.reload({waitUntil:'domcontentloaded'});await waitForAppBoot(page,{base});
    await page.click('#todayProfile');await page.waitForSelector('#profileScopeContinue');
    assert(await page.locator('#profileScopeContinue').isVisible(),'pending scope explanation survives reload');
    await page.click('#profileScopeContinue');
    const acknowledged=await page.evaluate(()=>window.__repforgeUi.loadUiPrefs().profileScope);
    assert(acknowledged?.v===1&&acknowledged.acknowledged===true&&acknowledged.scope.length===3,'acknowledgment records exactly the current scope');
    await page.reload({waitUntil:'domcontentloaded'});await waitForAppBoot(page,{base});await page.click('#todayProfile');
    assert(!await page.locator('#profileScopeContinue').isVisible(),'acknowledged expansion does not repeat after reload');
    state.program=lifts.slice(0,4);await commit(state);await page.click('[data-view="log"]');await page.click('#todayProfile');
    await page.waitForSelector('#profileScopeContinue');
    assert(await page.locator('#profileScopeContinue').isVisible(),'a later growth receives a new explanation');
    await page.click('#profileScopeContinue');
    state.program=lifts.slice(0,2);await commit(state);await page.click('[data-view="log"]');await page.click('#todayProfile');
    await page.waitForSelector('#profileScopeContinue');
    assert((await page.locator('.profile-scope-rings').innerText()).includes('4 lifts, before'),'scope shrink also explains the changed scale');
    await page.click('#profileScopeContinue');

    const built=await page.evaluate(async()=>{
      const captured=await installTransferCaptureLogicalSnapshot();
      if(!captured.ok)throw new Error(captured.code);
      return window.RepForgeInstallTransfer.buildEnvelope({logicalSnapshot:captured.value,
        source:{context:'browser',logicalInstallationId:captured.value.telemetryIdentity?.installationId||'profile-scope-proof',sourceRevision:0},
        contract:window.RepForgeInstallTransferContract,crypto:window.crypto});
    });
    assert(built.ok,'production capture and envelope builder include the scope preference');
    if(built.ok)for(const reload of [false,true]) {
      const target=await browser.newContext({guides:'live',serviceWorkers:'block'});const p=await target.newPage();
      try {
        await boot(p);if(reload){await p.reload({waitUntil:'domcontentloaded'});await waitForAppBoot(p,{base});}
        const baseline=await p.evaluate(()=>window.__repforgeUi.loadUiPrefs().profileScope);
        assert(baseline?.v===1&&baseline.scope.length===0&&baseline.acknowledged===false,`fresh ${reload?'reload':'boot'} creates only the automatic empty scope baseline`);
        const result=await importInto(p,built.value);
        assert(result?.ok===true,`automatic scope metadata stays eligible after ${reload?'reload':'boot'}`);
        const actual=await p.evaluate(()=>window.__repforgeUi.loadUiPrefs().profileScope);
        assert(JSON.stringify(actual)===JSON.stringify(built.value.uiPreferences.profileScope),'install transfer clones the acknowledged scope exactly');
      } finally {await target.close();}
    }
    if(built.ok)for(const record of [{v:1,scope:[],acknowledged:true},{v:2,scope:[],acknowledged:false},{v:1,scope:'invalid',acknowledged:false}]) {
      const target=await browser.newContext({guides:'live',serviceWorkers:'block'});const p=await target.newPage();
      try {
        await boot(p);await p.evaluate(value=>window.__repforgeUi.setPref('profileScope',value),record);
        await p.reload({waitUntil:'domcontentloaded'});await waitForAppBoot(p,{base});
        const before=await p.evaluate(()=>localStorage.getItem('repforge_ui_v1'));
        const result=await importInto(p,built.value);
        assert(result?.ok===false&&before===await p.evaluate(()=>localStorage.getItem('repforge_ui_v1')),'production import protects explicit, unknown or malformed scope records');
      } finally {await target.close();}
    }
    assert(errors.length===0,'profile navigation and scope protocol have no page errors',errors);
  } finally {await context.close();}
}
