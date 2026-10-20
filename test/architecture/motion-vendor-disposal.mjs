/** Actual shipped Motion DOM renderer, including its deferred style flush. */
import assert from 'node:assert/strict';
import {launchChromium} from '../browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();let result;
try{
 const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'no-preference'}),page=await context.newPage();
 await page.goto(new URL('src/platform/motion.js',base).href);
 await page.addScriptTag({url:new URL('vendor/motion/motion.js',base).href});
 result=await page.evaluate(async()=>{
  const {createMotion}=await import('/src/platform/motion.js');
  document.body.innerHTML='<div id="host" style="width:200px;height:100px"></div><div id="indicator" style="position:absolute;left:100px;top:100px;width:40px;height:20px"></div><div id="panel"><div style="height:20px"></div></div><div id="page" style="width:400px;height:400px"></div><div id="track"></div>';
  const motion=createMotion({window,runtime:window.Motion,fallback:{mount:()=>({dispose(){}}),navigate:()=>false}});
  let paints=0;const host=document.querySelector('#host'),indicator=document.querySelector('#indicator'),panel=document.querySelector('#panel'),view=document.querySelector('#page'),track=document.querySelector('#track');
  const runs=[motion.animateCoordinates(host,[0],[200],()=>paints++),motion.animateIndicator(indicator,{left:0,top:0,width:20,height:10}),motion.animatePush(view),motion.animateSlot(panel,()=>panel.firstElementChild.style.height='80px'),motion.settleFocusDeck(track,{from:180})];
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const paintsBefore=paints;motion.dispose();
  const outcomes=await Promise.race([Promise.all(runs),new Promise((_,reject)=>setTimeout(()=>reject(Error('disposed Motion promises never settled')),2000))]);
  const paintsAtDispose=paints;
  await new Promise(resolve=>setTimeout(resolve,150));
  const released={height:panel.style.height,overflow:panel.style.overflow};
  // A replacement starts a fresh explicit lifetime. The old queued release
  // must not clear styles belonging to this new run on the same DOM element.
  const replaced=motion.animateSlot(panel,()=>panel.firstElementChild.style.height='160px');
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));motion.dispose();
  const fresh=motion.animateSlot(panel,()=>panel.firstElementChild.style.height='240px');
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const replacementHeight=panel.style.height;
  motion.dispose();const replacements=await Promise.all([replaced,fresh]);
  await new Promise(resolve=>setTimeout(resolve,150));
  return{released,replacements,replacementHeight,finalHeight:panel.style.height,outcomes,paintsBefore,paintsAtDispose,paintsAfter:paints,indicator:indicator.style.transform,page:view.style.transform,track:track.style.transform,height:panel.style.height,overflow:panel.style.overflow};
 });
 assert.deepEqual(result.outcomes,[false,false,false,false,false]);assert.equal(result.paintsAfter,result.paintsAtDispose);assert(result.paintsBefore>=1);
 for(const key of ['indicator','page','track','height','overflow'])assert.equal(result[key],'',key);
 assert.deepEqual(result.released,{height:'',overflow:''});
 assert.deepEqual(result.replacements,[false,false]);assert.notEqual(result.replacementHeight,'','queued release cannot clear replacement style');assert.equal(result.finalHeight,'');
 console.log('PASS actual vendored Motion cancellation: settled false, no late paint/inline-height resurrection, replacement lifetime retained');
}finally{await browser.close()}
