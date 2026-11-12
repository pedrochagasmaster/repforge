import { waitForAppBoot } from './browser.mjs';
import { installGeneratedProgram, definitionSlot, isWeightRepsSlot, metricLogRow } from './fixtures/history-metric-rows.mjs';
import { importInto } from './fixtures/install-transfer-import.mjs';

export async function profileRingProofs(browser, assert, base) {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const boot=async (p,dismiss=true)=>{await p.goto(base,{waitUntil:'domcontentloaded'});await waitForAppBoot(p,{base});if(dismiss)await p.evaluate(()=>window.closeFirstRun?.());};
  const commit=async next=>page.evaluate(async value=>{
    const result=await window.__repforgeCommitProposedState(value);
    if(!result.committed)throw new Error('profile fixture commit refused');
    await window.__repforgeStorage.flush();render();
  },next);
  try {
    await boot(page);
    assert(!await page.locator('#todayProfile').isVisible(),'no-program Today has no profile ring');
    const generated=await installGeneratedProgram(page);
    assert(await page.locator('#todayProfile').isVisible(),'onboarded fresh program has the ink profile ring');
    if(!await page.locator('#todayProfile').isVisible())return;
    assert(await page.locator('#todayProfile svg').getAttribute('data-profile-fill')==='0','fresh profile has no invented evidence');
    // A raw preference reset must not let automatic profile metadata resurrect contextual guides.
    await page.evaluate(()=>localStorage.removeItem('repforge_ui_v1'));
    await page.evaluate(()=>window.__repforgeShowSettings());
    const blocked=await page.locator('#guideDialog[open]').count()>0;
    assert(!blocked,'profile scope observation preserves canonical guide preferences after a raw reset');
    if(blocked)return;
    await page.click('#createProgram');
    await page.waitForSelector('#onboarding.active');
    await page.click('#onbCancel');await page.click('#entryCancelDiscard');
    await page.waitForFunction(()=>!document.querySelector('#onboarding')?.classList.contains('active'));
    assert(await page.locator('#createProgram').isVisible(),'Settings create-program returns after cancel without a guide intercepting navigation');
    await page.click('#settingsBack');
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
    const savedBeforeNavigation=await page.evaluate(()=>localStorage.getItem('repforge_v1'));
    await row.click();await page.waitForSelector('#profilePage.active .profile-stage-list');
    assert((await page.locator('#profilePage').innerText()).includes('Current estimate: Solid'),'stage reader separates attained stages from the current estimate');
    assert(await page.locator('#profilePage [data-attained="true"]').count()>=2,'saved boundaries appear as attained stages');
    assert((await page.locator('#profilePage .profile-depth').innerText()).includes('3 of 64'),'reader shows real distinct saved depth dates');
    await page.click('#profilePageBack');
    await page.waitForFunction(key=>document.activeElement?.getAttribute('data-profile-lift')===key,key);
    assert(await row.isVisible(),'Back restores the profile and focus to the opening lift');
    await row.click();await page.evaluate(()=>history.back());
    await page.waitForFunction(()=>document.querySelector('#stats')?.classList.contains('active'));
    await page.locator('#profilePage').waitFor({state:'hidden'});
    assert(!await page.locator('#profilePage').isVisible(),'browser Back returns from the stage reader');

    assert(savedBeforeNavigation===await page.evaluate(()=>localStorage.getItem('repforge_v1')),'profile navigation retains the saved training snapshot');
    await page.click('[data-view="log"]');
    await page.evaluate(()=>{
      const log=JSON.parse(localStorage.getItem("repforge_v1")).log,rows=log.filter(row=>row.session===log.at(-1).session);
      const summary=window.__repforgeSessionSummary.build({rows,prevLog:log.filter(row=>row.session!==rows[0].session),session:rows[0].session,date:rows[0].date,day:rows[0].day,startedAt:0});
      window.__repforgeSessionSummary.open(summary);
    });
    await page.click('#sumFinding');await page.waitForSelector('#summaryProfileBack');
    await page.locator('#overviewProfile [data-profile-lift]').first().click();
    await page.waitForFunction(()=>history.state?.tauriferRoute?.view==='profilePage');
    assert(await page.evaluate(()=>history.state.tauriferRoute.depth)===2,'reader retains the finish-to-profile route underneath it');
    await page.goBack();await page.waitForSelector('#summaryProfileBack');
    assert(await page.locator('#stats').isVisible(),'browser Back from nested reader returns to Overview');
    await page.click('#summaryProfileBack');await page.waitForSelector('#sessionSummary:not(.hidden)');
    assert(await page.locator('#sessionSummary').isVisible(),'the next Back restores the existing finish screen');
    await page.evaluate(()=>window.__repforgeSessionSummary.close());

    state.program=lifts.slice(0,3);await commit(state);
    await page.click('[data-view="stats"]');
    const tabsVisible=await page.locator('#statsSeg').isVisible();
    assert(tabsVisible,'pending scope growth keeps Progress tabs reachable',await page.evaluate(()=>({active:[...document.querySelectorAll('.view.active')].map(view=>view.id),scopePage:!!document.querySelector('#overviewProfile .profile-scope-rings')})));
    if(!tabsVisible)return;
    await page.click('#statsSeg [data-seg="strength"]');
    assert(await page.locator('#segStrength').isVisible(),'Strength stays reachable without acknowledging scope growth');
    await page.click('#statsSeg [data-seg="review"]');
    assert(await page.locator('#segReview').isVisible(),'Review stays reachable without acknowledging scope growth');
    assert((await page.evaluate(()=>window.__repforgeUi.loadUiPrefs().profileScope)).scope.length===2,'switching Progress tabs never acknowledges an unseen scope');
    await page.click('#statsSeg [data-seg="overview"]');
    assert(await page.locator('#overviewProfile .profile-scope-inline').isVisible(),'first Overview visit shows the pending before/now comparison within its panel');
    await page.click('[data-view="log"]');
    assert((await page.locator('#todayProfileNeed').innerText()).includes('1 new lift'),'Today explains actual scope growth');
    const expandedFill=Number(await page.locator('#todayProfile svg').getAttribute('data-profile-fill'));
    assert(expandedFill<Number(today),'current denominator applies immediately without a drain animation');
    await page.click('#todayProfile');await page.waitForSelector('#overviewProfile .profile-scope-rings');
    await page.waitForFunction(()=>!document.body.classList.contains('is-pushing'));
    const scopeGeometry=await page.evaluate(()=>({tabs:document.querySelector('#statsSeg').getBoundingClientRect().top,title:document.querySelector('#profileScopeTitle').getBoundingClientRect().top}));
    assert(scopeGeometry.tabs>=0&&scopeGeometry.title>=0,'scope opens within Overview with Progress tabs above it',scopeGeometry);
    assert(await page.locator('.profile-scope-rings svg').count()===2,'first Overview visit shows static before/now scope rings');
    assert(!await page.locator('.profile-scope-rings svg').evaluateAll(nodes=>nodes.some(n=>n.getAnimations({subtree:true}).length)),'scope rings have no backward tween');
    await page.reload({waitUntil:'domcontentloaded'});await waitForAppBoot(page,{base});
    await page.click('#todayProfile');await page.waitForSelector('#profileScopeContinue');
    assert(await page.locator('#profileScopeContinue').isVisible(),'pending scope explanation survives reload');
    await page.click('#profileScopeContinue');
    assert(await page.evaluate(()=>window.scrollY===0&&document.activeElement?.id==='overviewProfileTitle'),'acknowledgment returns to the profile heading with Progress navigation visible');
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

    state.program=lifts.slice(0,3);await commit(state);await page.click('[data-view="log"]');await page.click('#todayProfile');
    await page.waitForSelector('#profileScopeContinue');
    state.program=lifts.slice(0,4);
    await page.evaluate(async next=>{
      const result=await window.__repforgeCommitProposedState(next);
      if(!result.committed)throw new Error('concurrent scope change refused');
      await window.__repforgeStorage.flush();
    },state);
    await page.click('#profileScopeContinue');
    const raced=await page.evaluate(()=>window.__repforgeUi.loadUiPrefs().profileScope);
    assert(raced.scope.length===3,'acknowledgment covers the displayed expansion, never a later unrendered growth',raced.scope.length);
    if(raced.scope.length===3){
      await page.click('[data-view="log"]');await page.click('#todayProfile');
      await page.waitForSelector('#profileScopeContinue');
      assert(await page.locator('#profileScopeContinue').isVisible(),'the later unacknowledged growth still gets its own comparison');
      await page.click('#profileScopeContinue');
    }
    state.program=lifts.slice(0,2);await commit(state);await page.click('[data-view="log"]');await page.click('#todayProfile');
    await page.waitForSelector('#profileScopeContinue');await page.click('#profileScopeContinue');

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
        await boot(p,false);if(reload){
          // An existing telemetry identity is intentionally protected. This contract isolates automatic UI
          // metadata across reload; the separate transfer owner proves identity and consent protection.
          await p.evaluate(()=>localStorage.removeItem('repforge_telemetry_identity_v1'));await p.reload({waitUntil:'domcontentloaded'});await waitForAppBoot(p,{base});}
        const baseline=await p.evaluate(()=>window.__repforgeUi.loadUiPrefs().profileScope);
        assert(baseline?.v===1&&baseline.scope.length===0&&baseline.acknowledged===false,`fresh ${reload?'reload':'boot'} creates only the automatic empty scope baseline`);
        const result=await importInto(p,built.value);
        assert(result?.ok===true,`automatic scope metadata stays eligible after ${reload?'reload':'boot'}`,{result,prefs:await p.evaluate(()=>window.__repforgeUi.loadUiPrefs())});
        const actual=await p.evaluate(()=>window.__repforgeUi.loadUiPrefs().profileScope);
        assert(JSON.stringify(actual)===JSON.stringify(built.value.uiPreferences.profileScope),'install transfer clones the acknowledged scope exactly');
        await p.reload({waitUntil:'domcontentloaded'});await waitForAppBoot(p,{base});
        assert(JSON.stringify(await p.evaluate(()=>window.__repforgeUi.loadUiPrefs().profileScope))===JSON.stringify(built.value.uiPreferences.profileScope),'cloned acknowledgment survives destination reload');
      } finally {await target.close();}
    }
    if(built.ok)for(const record of [{v:1,scope:[],acknowledged:true},{v:2,scope:[],acknowledged:false},{v:1,scope:'invalid',acknowledged:false},{v:1,scope:[],acknowledged:false,futureField:true}]) {
      const target=await browser.newContext({guides:'live',serviceWorkers:'block'});const p=await target.newPage();
      try {
        await boot(p,false);await p.evaluate(value=>window.__repforgeUi.setPref('profileScope',value),record);
        await p.reload({waitUntil:'domcontentloaded'});await waitForAppBoot(p,{base});
        const before=await p.evaluate(()=>localStorage.getItem('repforge_ui_v1'));
        const result=await importInto(p,built.value);
        assert(result?.ok===false&&before===await p.evaluate(()=>localStorage.getItem('repforge_ui_v1')),'production import protects explicit, unknown or malformed scope records');
      } finally {await target.close();}
    }
    const equipmentId=await page.evaluate(()=>Object.entries(window.RepForgeExerciseCatalog.snapshot().uuidIndex).find(([,entry])=>entry.type==='equipment')[0]);
    state.log=state.log.map(row=>({...row,equipmentId}));await commit(state);
    await page.click('[data-view="log"]');await page.click('#todayProfile');
    const active=await page.evaluate(()=>window.__repforgeProgressEvidence.profile().lifts.filter(lift=>lift.active));
    assert(active.every(lift=>lift.stage==='first'&&lift.units===0),'a different saved machine cannot fill the active lift’s ring');
    assert(await page.locator('#overviewProfile .profile-archive [data-profile-lift]').count()>0,'other-machine evidence remains reachable outside the active ring');
    assert(errors.length===0,'profile navigation and scope protocol have no page errors',errors);
  } finally {await context.close();}
}
