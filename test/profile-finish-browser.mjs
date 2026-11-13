import { waitForAppBoot } from './browser.mjs';
import { installGeneratedProgram, definitionSlot, isWeightRepsSlot, metricLogRow } from './fixtures/history-metric-rows.mjs';
import { finishEarly, openEarlyFinish, sessionField } from './fixtures/focus-workout.mjs';

/** Real DraftV2 completion, durable publication, finish paint and its return path. */
export async function profileFinishProofs(browser, assert, base) {
  for(const scenario of ['solid','checked','calibrated','date','unchanged','reduced','backdated'].filter(key=>!process.env.REPFORGE_PROFILE_FINISH_CASE||key===process.env.REPFORGE_PROFILE_FINISH_CASE)) {
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:scenario==='reduced'?'reduce':'no-preference'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    try {
      await page.goto(base,{waitUntil:'domcontentloaded'});await waitForAppBoot(page,{base});
      await page.evaluate(()=>window.closeFirstRun?.());
      const generated=await installGeneratedProgram(page);
      const ex=generated.program.find(ex=>isWeightRepsSlot(definitionSlot(generated.programMeta,ex))&&!definitionSlot(generated.programMeta,ex).loadingModel?.bodyweightCoefficient);
      if(!ex)throw new Error('finish proof needs an external weight/reps lift');
      const age=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
      const dates=scenario==='solid'||scenario==='reduced'?[1]:scenario==='unchanged'?[1,0]:scenario==='backdated'?[3,1]:scenario==='calibrated'?[28,14]:[2,1];
      generated.program=[ex];generated.settings.lang='en';generated.settings.maxSetPrompts=false;
      generated.log=dates.flatMap((days,i)=>Array.from({length:5},(_,j)=>metricLogRow(generated.programMeta,ex,{
        session:`finish-history-${i}`,date:age(days),set:j+1,load:60,reps:8,rir:2,extra:{effortSource:'rir'}
      })).concat(scenario==='calibrated'?[metricLogRow(generated.programMeta,ex,{session:`finish-history-${i}`,date:age(days),set:6,load:60,reps:8,rir:0,
        extra:{effortSource:'failure',calibration:{v:1,predictedReps:8,predictionEdited:false,prefillBasis:'reps_rir'}}})]:[]));
      await page.evaluate(()=>window.__repforgeUi.setPref('profileScope',{v:1,scope:[],acknowledged:false}));
      await page.evaluate(async next=>{const result=await window.__repforgeCommitProposedState(next);if(!result.committed)throw new Error('finish fixture refused');await window.__repforgeStorage.flush();render();},generated);
      const before=await page.evaluate(()=>window.__repforgeProgressEvidence.profile());
      await page.evaluate(day=>window.__repforgeEnterWorkout({day}),ex.day);
      await page.waitForSelector('#workout .exercise.is-current .focus-shelf');
      if(scenario==='backdated')await sessionField(page,'#sessionDate',age(2));
      await page.evaluate(async ({check,libraryId})=>{
        const api=window.__repforgeWorkoutDraft,draft=api.current(),exerciseInstanceId=draft.exerciseOrder.find(id=>draft.exercises[id].libraryId===libraryId||draft.exercises[id].sourceExerciseId===libraryId);
        if(!exerciseInstanceId)throw new Error('finish target missing from actual draft');
        const exercise=draft.exercises[exerciseInstanceId];
        for(const [i,setId] of exercise.setOrder.entries()){
          if(i>=3)break;
          if(check&&i===1){const result=await api.dispatch('startMaxSet',{exerciseInstanceId,setId,copyLoadFromSetId:exercise.setOrder[0],calibration:{v:1,predictedReps:8,predictionEdited:false,prefillBasis:'reps_rir'}});if(result.status!=='applied')throw new Error('check refused '+JSON.stringify(result));}
          const set=api.current().exercises[exerciseInstanceId].sets[setId];
          for(const metric of set.programmed.metrics)await api.dispatch('editMetricValue',{exerciseInstanceId,setId,metricId:metric.id,value:metric.semantic==='reps'?'8':'60'});
          if(!(check&&i===1))await api.dispatch('editSetField',{exerciseInstanceId,setId,field:'rir',value:'2'});
          const result=await api.dispatch('completeSet',{exerciseInstanceId,setId,completedAt:new Date().toISOString()});
          if(result.status!=='applied')throw new Error('set refused '+JSON.stringify(result));
        }
        await api.flush();
      },{check:['checked','calibrated'].includes(scenario),libraryId:ex.libraryId});
      if(scenario==='solid'){
        await openEarlyFinish(page);await page.click('#sessionEarlyCancel');await page.click('#sessionSheetClose');await page.locator('#sessionSheet').waitFor({state:'hidden'});
        assert(!await page.locator('#sessionSummary').isVisible()&&JSON.stringify(before)===await page.evaluate(()=>JSON.stringify(window.__repforgeProgressEvidence.profile())),'cancelled finish adds no profile evidence');
        await page.evaluate(()=>{const io=window.RepForgeDurableState.storageIO,local=io.writeLocal,idb=io.writeIdb;io.writeLocal=async()=>false;io.writeIdb=async()=>false;window.__restoreFinishIO=()=>{io.writeLocal=local;io.writeIdb=idb;};});
        await openEarlyFinish(page);await page.click('#sessionEarlyConfirm');
        await page.waitForFunction(()=>window.__repforgeLastWorkoutFinish!=null);
        const failed=await page.evaluate(async()=>{try{return await window.__repforgeLastWorkoutFinish;}finally{window.__restoreFinishIO();}});
        assert(!failed.committed&&!await page.locator('#sessionSummary').isVisible()&&JSON.stringify(before)===await page.evaluate(()=>JSON.stringify(window.__repforgeProgressEvidence.profile())),'failed durable save adds nothing and never opens the profile finish');
      }
      // Observe the actual arc's paints, rather than an animation flag or a private helper.
      await page.evaluate(()=>{
        window.__profileFinishPaints=[];
        const sample=()=>{const arc=document.querySelector('#sumProfile .profile-ring__fill');if(!arc)return;window.__profileFinishPaints.push(parseFloat(getComputedStyle(arc).strokeDasharray));if(arc.getAnimations().some(run=>run.playState==='running'))requestAnimationFrame(sample);};
        new MutationObserver(()=>{if(!window.__profileFinishPaints.length)sample();}).observe(document.querySelector('#sessionSummaryBody'),{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
      });
      const result=await finishEarly(page);
      assert(result.committed===true,`${scenario}: production save commits`);
      if(scenario==='backdated')assert(await page.evaluate(date=>JSON.parse(localStorage.getItem('repforge_v1')).log.some(row=>row.date===date&&!String(row.session).startsWith('finish-history')),age(2)),'backdated: production rows keep the chosen past date');
      const hasRing=await page.locator('#sumProfile svg.profile-ring').count()===1;
      assert(hasRing,`${scenario}: successful finish shows the saved-profile ring in the finding slot`);
      if(!hasRing)continue;
      const after=await page.evaluate(()=>window.__repforgeProgressEvidence.profile());
      const stageDelta=after.lifts[0].stageUnits-before.lifts[0].stageUnits;
      const expected=['solid','checked','calibrated','reduced'].includes(scenario)?8:0;
      assert(stageDelta===expected,`${scenario}: projection adds exactly ${expected} stage units`,{before,after});
      assert(Math.abs(after.units-before.units-expected-(scenario==='unchanged'?0:.75))<1e-9,`${scenario}: date credit is separate and counted once`);
      assert(Number(await page.locator('#sumProfile svg').getAttribute('data-profile-fill'))===after.fill,`${scenario}: finish arc carries the exact after-save reading`);
      await page.waitForFunction(()=>{const svg=document.querySelector('#sumProfile svg');return Math.abs(parseFloat(getComputedStyle(svg.querySelector('.profile-ring__fill')).strokeDasharray)-Number(svg.dataset.profileFill)*100)<.00001;});
      const paints=await page.evaluate(()=>window.__profileFinishPaints);
      assert(paints.every((v,i)=>v>=before.fill*100-.00001&&v<=after.fill*100+.00001&&(!i||v>=paints[i-1]-.00001)),`${scenario}: fill never overshoots or moves backwards`,paints);
      if(scenario==='reduced'||scenario==='unchanged')assert(paints.every(v=>Math.abs(v-after.fill*100)<.00001),`${scenario}: first paint is the final unchanged or reduced-motion state`,paints);
      else assert(paints.some(v=>v<after.fill*100-.00001),`${scenario}: one visible forward fill connects the saved readings`,paints);
      assert((await page.locator('#sumProfile').innerText()).includes('Your profile')&&!/%/.test(await page.locator('#sumProfile').innerText()),`${scenario}: ink reading has its name without a printed percentage`);
      if(scenario==='unchanged')assert(await page.locator('#sumProfile > p').count()===0,'unchanged: no profile change line renders when the save adds nothing');
      if(['checked','calibrated'].includes(scenario))assert((await page.locator('#sumProfile').innerText()).includes('guessed 8, did 8'),`${scenario}: evidence reason states the saved guess and result`);
      if(scenario==='calibrated')assert(await page.locator('#sumFinding[data-finding]').count()===1,'agreeing check and new finding coexist without duplicate credit');
      await page.click('#sumProfileOpen');await page.waitForSelector('#summaryProfileBack');
      assert(Number(await page.locator('#overviewProfile svg').first().getAttribute('data-profile-fill'))===after.fill,`${scenario}: Overview agrees with the finish reading`);
      await page.locator('#overviewProfile [data-profile-lift]').first().click();await page.waitForSelector('#profilePage.active');
      await page.click('#profilePageBack');await page.click('#summaryProfileBack');
      await page.waitForSelector('#sessionSummary:not(.hidden)');
      assert(Number(await page.locator('#sumProfile svg').getAttribute('data-profile-fill'))===after.fill,`${scenario}: reader and Overview return to the same finish without replay`);
      assert(await page.locator('#sumProfile .profile-ring__fill').evaluate(el=>!el.getAnimations().length),`${scenario}: returned finish has no running fill`);
      if(scenario==='solid'){
        await page.setViewportSize({width:320,height:568});
        await page.evaluate(()=>document.documentElement.style.fontSize='200%');
        await page.click('#sumProfileLift');await page.waitForSelector('#profilePage.active');
        await page.click('#profilePageBack');await page.click('#summaryProfileBack');
        await page.waitForSelector('#sessionSummary:not(.hidden)');
        assert(await page.locator('#sumProfile').isVisible(),'direct lift link stays reachable at 320 and text200 and returns through Overview to the same finish');
      }
      await page.screenshot({path:`${process.env.REPFORGE_ARTIFACT_DIR||'/tmp'}/profile-finish-${scenario}.png`});
      assert(!errors.length,`${scenario}: no page errors`,errors);
    } finally {await context.close();}
  }
}
