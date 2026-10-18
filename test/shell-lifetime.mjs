import assert from "node:assert/strict";
import { launchChromium,waitForAppBoot } from "./browser.mjs";
const base=process.env.REPFORGE_URL || "http://localhost:8000/";
const browser=await launchChromium();
try {
  const page=await browser.newPage();
  // A source document establishes the origin without mounting the application.
  await page.goto(new URL("src/ui/shell.js",base).href);
  await page.setContent('<!doctype html><html><head></head><body><main><section class="view active" id="log"><h1>Today</h1><button id="opener">Open</button></section></main><div id="announcementHost"></div><div id="sheet" hidden class="hidden"><button id="first">First</button><button id="last">Last</button></div><div id="second" hidden class="hidden"><button id="next">Next</button></div><pre id="result">PENDING</pre>\n');
  await page.addScriptTag({url:new URL("vendor/motion/motion.js",base).href});
  const outcome=await page.evaluate(async base=>{

let constructionListeners=0;
const originalAdd=document.addEventListener;
document.addEventListener=function(...args){constructionListeners++;return originalAdd.apply(this,args)};
const {createShell}=await import(new URL("src/ui/shell.js",base).href);
const {createMotion}=await import(new URL("src/platform/motion.js",base).href);
const result=document.querySelector('#result');
const check=(value,label)=>{if(!value)throw Error(label)};
try {
  // Exercise the actual native route owner before mounting: constructing a
  // shell must not register listeners, and push lifetime is owned explicitly.
  let finishPush,registeredEdge=null,edgeDisposals=0,releasedClicks=0,focusActive=false;
  const routeMotion={available:()=>true,reducedMotion:()=>false,
    animatePush:()=>new Promise(resolve=>{finishPush=resolve}),
    registerEdgeSwipeBack:target=>{registeredEdge=target;return {dispose(){edgeDisposals++}}}};
  const routeShell=createShell({window,motion:routeMotion,isBooted:()=>true,isFocusActive:()=>focusActive,
    releaseSwallowedClick:()=>{releasedClicks++}});
  check(constructionListeners===0,'native shell import and construction register no implicit listeners');document.addEventListener=originalAdd;
  const under=document.querySelector('#log'),pushed=document.createElement('section');pushed.id='exercise';pushed.className='view';
  pushed.innerHTML='<h1>Exercise</h1><button id="exBack">Back</button>';document.querySelector('main').append(pushed);
  const change=routeShell.routePushBegin('in',{pushed,under});check(typeof change==='function','native route push capability');change();
  check(under.inert&&under.classList.contains('is-push-under')&&pushed.classList.contains('is-push-over'),'push owns underlay inertness');
  routeShell.dispose();check(!under.inert&&!pushed.classList.contains('is-push-over'),'dispose clears interrupted push');finishPush(true);await Promise.resolve();
  focusActive=true;check(routeShell.routePushBegin('in',{pushed,under})===null,'Focus underlay blocks page push');focusActive=false;
  let back=0;pushed.querySelector('#exBack').onclick=()=>{back++};under.classList.remove('active');pushed.classList.add('active');
  routeShell.mount();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  check(registeredEdge?.page===pushed,'native edge route registration');registeredEdge.onCommit();
  check(back===1&&releasedClicks===1,'edge commit releases swallowed clicks and uses actual Back');
  routeShell.dispose();check(edgeDisposals===1,'edge registration disposed exactly once');
  routeShell.mount();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));routeShell.dispose();
  check(edgeDisposals===2,'native route shell remount owns one registration');
  // The real shipped animation owner paints a transform synchronously. Shell
  // teardown must cancel that owned run, not only remove presentation classes.
  const animatedMotion=createMotion({window,fallback:{mount:()=>({dispose(){}}),navigate:()=>false}});
  const animatedShell=createShell({window,motion:animatedMotion,isBooted:()=>true});
  check(animatedMotion.available(),'actual vendored animation runtime present');
  animatedShell.routePushBegin('in',{pushed,under})?.();
  check(pushed.style.transform!=='','actual route animation started');
  animatedShell.dispose();check(pushed.style.transform==='','dispose cancels actual route transform');
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  check(pushed.style.transform==='','disposed route animation cannot paint again');
  animatedMotion.dispose();
  pushed.remove();under.classList.add('active');
  const shell=createShell({window});shell.mount();shell.mount();
  const opener=document.querySelector('#opener'),sheet=document.querySelector('#sheet'),second=document.querySelector('#second');
  opener.focus();check(shell.openModal(sheet,{returnFocus:opener}),'open');
  check(document.querySelector('main').inert,'background inert');
  check(!document.querySelector('#announcementHost').inert,'announcements live');
  check(document.activeElement.id==='first','initial focus');
  document.querySelector('#last').focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  check(document.activeElement.id==='first','focus wraps');
  check(shell.openModal(second)===false,'no implicit modal replacement');
  check(shell.openModal(second,{handoff:true}),'explicit handoff');
  await shell.closeModal(second);check(document.activeElement===opener,'handoff return focus');check(!document.querySelector('main').inert,'inert restored');
  shell.openModal(sheet,{returnFocus:opener,delayHide:1000});const closing=shell.closeModal(sheet);shell.dispose();await closing;
  check(sheet.hidden&&!document.querySelector('main').inert,'dispose closes pending transition');
  shell.mount();shell.dispose();
  let mounts=0,disposed=0;
  const motion=createMotion({window,runtime:null,fallback:{mount(){mounts++;return{dispose(){disposed++}}},navigate:()=>true}});
  check(mounts===0,'motion construct does not mount');
  const controller=motion.mount();check(motion.mount()===controller&&mounts===1,'idempotent gesture mount');
  check(controller.navigate(1)===true,'fallback navigation');motion.dispose();check(disposed===1,'dispose fallback');
  check(controller.navigate(1)===false,'disposed navigation inert');
  result.textContent='PASS shell focus/inert/handoff/transition disposal/remount and motion fallback lifetime';
} catch(error){result.textContent='FAIL '+error.stack}

    return result.textContent;
  },base);
  assert.match(outcome,/^PASS /);
  console.log(outcome);
  await page.close();
  for(const unavailable of ['restricted','absent','registration-rejected']){
    const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}}),app=await context.newPage(),errors=[];
    app.on('pageerror',error=>errors.push(error.message));
    await app.addInitScript(mode=>{
      localStorage.setItem('repforge_telemetry_enabled_v1','false');
      if(mode==='restricted')Object.defineProperty(navigator,'serviceWorker',{configurable:true,get(){throw new DOMException('restricted service worker','SecurityError')}});
      else if(mode==='absent')Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:undefined});
      else Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{controller:null,register(){window.__shellRegistrationCount=(window.__shellRegistrationCount||0)+1;return Promise.reject(new DOMException('registration disabled','SecurityError'))}}});
    },unavailable);
    await app.goto(base);await waitForAppBoot(app,{base});
    assert.equal(await app.evaluate(()=>typeof window.RepForgeMotion?.mount),'function','actual native Motion composed for restricted/network-only startup');
    await app.click('#firstRunPrivacy');await app.waitForSelector('#privacySheet.is-open');
    assert.equal(await app.evaluate(()=>document.activeElement?.id),'privacyClose');
    await app.click('#privacyClose');await app.waitForFunction(()=>document.activeElement?.id==='firstRunPrivacy');
    if(unavailable==='registration-rejected')assert.equal(await app.evaluate(()=>window.__shellRegistrationCount),1,'bootstrap owns the only service-worker registration');
    assert.deepEqual(errors,[],`${unavailable} startup/modal flow has no uncaught errors`);await context.close();
  }
  // Recovery presentation starts before normal init: it needs the same Motion
  // and shell owners, without mounting any gesture controller prematurely.
  for(const failure of ['catalog','storage']){
    const context=await browser.newContext({reducedMotion:'reduce'}),app=await context.newPage(),errors=[];
    app.on('pageerror',error=>errors.push(error.message));
    await app.addInitScript(mode=>{localStorage.setItem('repforge_telemetry_enabled_v1','false');
      if(mode==='storage')localStorage.setItem('repforge_v1','{unreadable user bytes');},failure);
    if(failure==='catalog')await app.route('**/assets/exercise-catalog.json*',route=>route.abort());
    await app.goto(base);
    const id=failure==='catalog'?'exerciseCatalogRecovery':'storageRecovery';await app.waitForSelector(`#${id}[open]`);
    const beforeInit=await app.evaluate(id=>({booted:window.__repforgeBooted===true,motion:typeof window.RepForgeMotion?.mount,
      mounted:!!window.__repforgeGestureHandle,styles:!!document.querySelector('#taurifer-apple-accessibility'),focus:document.querySelector('#'+id).contains(document.activeElement),
      raw:localStorage.getItem('repforge_v1')}),id);
    assert.equal(beforeInit.booted,false);assert.equal(beforeInit.motion,'function');assert.equal(beforeInit.mounted,false);
    assert.equal(beforeInit.styles,false,'Motion styles/gesture mount waits for init');assert.equal(beforeInit.focus,true,'pre-init recovery uses actual shell focus');
    if(failure==='storage')assert.equal(beforeInit.raw,'{unreadable user bytes','recovery retains exact unknown user bytes');
    await app.keyboard.press('Tab');assert.equal(await app.evaluate(id=>document.querySelector('#'+id).contains(document.activeElement),id),true);
    if(failure==='catalog'){
      await app.unroute('**/assets/exercise-catalog.json*');await app.click('#retryExerciseCatalog');await waitForAppBoot(app,{base});
      assert.equal(await app.locator('#exerciseCatalogRecovery').evaluate(el=>el.open),false);
      assert.equal(await app.locator('#taurifer-apple-accessibility').count(),1,'retry mounts the one existing Motion owner');
      await app.click('#firstRunPrivacy');await app.waitForSelector('#privacySheet.is-open');await app.click('#privacyClose');
      await app.waitForFunction(()=>document.activeElement?.id==='firstRunPrivacy');
    }
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS actual shell consumption: restricted/no-SW startup, one registration, and pre-init catalog/storage recovery');
} finally { await browser.close(); }
