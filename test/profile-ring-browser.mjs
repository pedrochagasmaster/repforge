import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitForAppBoot } from './browser.mjs';
import { installGeneratedProgram, definitionSlot, isWeightRepsSlot, metricLogRow } from './fixtures/history-metric-rows.mjs';
import { appState } from '../tools/ui-screens/screens-app.mjs';
import { finishEarly } from './fixtures/focus-workout.mjs';
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
    // Compare catalog history with rows published by the actual draft/finish protocol.
    await page.evaluate(day=>window.__repforgeEnterWorkout({day}),lifts[0].day);
    await page.waitForSelector('#workout .exercise.is-current .focus-shelf');
    await page.evaluate(async libraryId=>{
      const api=window.__repforgeWorkoutDraft,draft=api.current();
      const exerciseInstanceId=draft.exerciseOrder.find(id=>draft.exercises[id].libraryId===libraryId||draft.exercises[id].sourceExerciseId===libraryId);
      if(!exerciseInstanceId)throw new Error('generated weight/reps lift missing from draft');
      const exercise=draft.exercises[exerciseInstanceId];
      for(const setId of exercise.setOrder.slice(0,2)){
        const set=exercise.sets[setId];
        for(const metric of set.programmed.metrics)
          await api.dispatch('editMetricValue',{exerciseInstanceId,setId,metricId:metric.id,value:/rep/i.test(metric.semantic)?'8':'60'});
        await api.dispatch('editSetField',{exerciseInstanceId,setId,field:'rir',value:'2'});
        const result=await api.dispatch('completeSet',{exerciseInstanceId,setId,completedAt:new Date().toISOString()});
        if(result.status!=='applied')throw new Error('production profile set refused: '+JSON.stringify(result));
      }
      await api.flush();
    },lifts[0].libraryId);
    await finishEarly(page);
    await page.reload({waitUntil:'domcontentloaded'});await waitForAppBoot(page,{base});
    const persisted=await page.evaluate(()=>{
      const saved=JSON.parse(localStorage.getItem('repforge_v1'));
      const row=saved.log[0],descriptor={exerciseId:row.performedLibraryId,metricType:row.metricType,
        metricIds:row.metricIds,metricDefinitions:row.metricDefinitions,loadingModel:row.loadingModel,
        context:{...row.loadingContext,equipmentId:row.equipmentId,loadingConvention:row.loadingConvention}};
      const history=[{sessionId:row.session,date:row.date,completed:true,
        sets:saved.log.map(item=>({...item,exerciseId:item.performedLibraryId,completed:true}))}];
      const engine=window.RepForgeProgression.readSavedLift(descriptor,history,{now:row.date});
      return {rows:saved.log,profile:window.__repforgeProgressEvidence.profile(),engine};
    });
    assert(persisted.rows.length===2&&persisted.rows.every(row=>['rir','reps_left'].includes(row.effortSource)),
      'production finish and reload preserve explicit effort, unlike the former catalog seed');
    assert(persisted.engine.sessions.length===1&&persisted.engine.standing.word==='learning',
      'the shipped engine anchors on the same production-saved history',persisted.engine);
    assert(persisted.profile.lifts.some(lift=>lift.active&&lift.depthDates.length===1&&lift.stage==='learning'),
      'a production-saved comparable session starts Learning with one saved date',persisted.profile);
    await page.evaluate(()=>window.__repforgeShowSettings());await page.click('#dataBackupRow');
    const [download]=await Promise.all([page.waitForEvent('download'),page.click('#exportJson')]);
    const backupPath=join(process.env.REPFORGE_ARTIFACT_DIR||'/tmp','profile-production-backup.json');
    await download.saveAs(backupPath);
    const backup=JSON.parse(readFileSync(backupPath,'utf8'));
    assert(JSON.stringify(backup.log)===JSON.stringify(persisted.rows),
      'production JSON backup retains the same comparable saved rows and explicit effort');
    await page.click('#settingsBack');
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
    const older={...state,log:state.log.filter(row=>row.set<=2).map(({effortSource,...row})=>row)};
    await commit(older);
    const olderProfile=await page.evaluate(()=>window.__repforgeProgressEvidence.profile());
    assert(olderProfile.lifts.filter(lift=>lift.active).every(lift=>lift.depthDates.length===3&&lift.depthSteps===1.5&&lift.stage==='learning'&&lift.current.standing.word==='learning'),
      'older numeric-RIR history counts saved dates at half quality without exceeding engine Learning',olderProfile);
    await page.locator('#overviewProfile [data-profile-lift]').first().click();
    const olderDepth=await page.locator('#profilePage .profile-depth').innerText();
    assert(olderDepth.includes('1.5 of 64'),'reader displays weighted date steps for older history',olderDepth);
    await page.click('#profilePageBack');await commit(state);
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
    for(const catalogKey of ['today/ready','progress/overview-profile','today/profile-first','today/profile']){
      await commit(appState(catalogKey,'en'));
      const profile=await page.evaluate(()=>window.__repforgeProgressEvidence.profile());
      assert(catalogKey==='today/profile'?profile.fill>=0.8&&profile.lifts.filter(lift=>lift.active).every(lift=>lift.depthSteps===48):catalogKey==='today/profile-first'?profile.units===0:
        profile.fill>0&&profile.lifts.some(lift=>lift.active&&lift.depthDates.length>0&&lift.stage!=='first'),
        `${catalogKey} catalog history has the intended fresh or learned evidence`,{fill:profile.fill,unsupported:profile.unsupportedRows});
    }
    await commit(appState('progress/profile-reader','pt'));await page.evaluate(()=>{I18N.setLang('pt');render();});await page.click('[data-view="stats"]');
    await page.locator('#overviewProfile [data-profile-lift]').first().click();
    for(const scale of ['100%','200%']){
      await page.evaluate(scale=>{document.documentElement.style.fontSize=scale;render();},scale);
      const reader=await page.locator('#profilePage').evaluate(node=>{
        const title=node.querySelector('h1'),marks=[...node.querySelectorAll('.profile-stage-mark')];
        const painted=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility==='visible'&&Number(s.opacity)>0;};
        const reading=node.querySelector('.profile-depth p:last-child');
        return {title:title?.textContent,titlePainted:title&&painted(title),marks:marks.length,marksPainted:marks.every(painted),
          separate:!!reading?.querySelector('br'),copy:reading?.textContent};
      });
      assert(reader.titlePainted&&reader.title&&reader.marks===5&&reader.marksPainted,
        `PT reader retains its heading and all five stage markers at ${scale}`,reader);
      assert(reader.separate,`PT reader separates the label from its full-sentence reading at ${scale}`,reader.copy);
    }
    assert(errors.length===0,'profile navigation and scope protocol have no page errors',errors);
  } finally {await context.close();}
}
