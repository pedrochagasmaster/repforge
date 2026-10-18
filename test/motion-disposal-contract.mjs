import assert from 'node:assert/strict';
import {createMotion} from '../src/platform/motion.js';
function fixture(){
 const frames=new Map(),values=[],runs=[];let nextFrame=0;
 const runtime={motionValue(initial){let value=initial;const listeners=new Set();const target={listeners,stopped:false,get:()=>value,set(next){value=next;for(const listener of listeners)listener(next)},stop(){target.stopped=true},on(_event,listener){listeners.add(listener);return()=>listeners.delete(listener)}};values.push(target);return target},animate(target,to){let resolve;const promise=new Promise(done=>{resolve=done});const run={target,to,resolve,stopped:false};promise.stop=()=>{run.stopped=true};runs.push(run);return promise}};
 const window={document:{},performance,Element:class{},getComputedStyle:()=>({transform:'none'}),matchMedia:()=>({matches:false}),setTimeout,clearTimeout,requestAnimationFrame:callback=>{frames.set(++nextFrame,callback);return nextFrame},cancelAnimationFrame:id=>frames.delete(id)};
 return{motion:createMotion({window,runtime,fallback:{mount:()=>({dispose(){}}),navigate:()=>false}}),frames,values,runs,frame(){const due=[...frames.values()];frames.clear();due.forEach(callback=>callback())}}}
function box(){return{height:20,offsetHeight:20,offsetWidth:100,dataset:{id:'row'},style:{transform:'',removeProperty(name){delete this[name]}},classList:{add(){},remove(){},toggle(){}},getBoundingClientRect(){return{left:100,top:100,width:40,height:this.height}}}}
{
 const {motion,frames,runs,values,frame}=fixture(),element=box();
 const pending=motion.animateIndicator(element,{left:0,top:0,width:40,height:20});
 assert.equal(frames.size,1);assert.equal(runs.length,0);
 motion.dispose();assert.equal(frames.size,0,'dispose cancels queued native animation frame');
 frame();assert.equal(runs.length,0,'disposed work cannot start a runtime clock');assert.equal(await pending,false);
 assert.equal(element.style.transform,'');assert.equal(values[0].listeners.size,0);assert.equal(values[0].stopped,true);
 // A subsequent explicit operation belongs to a fresh lifetime on this instance.
 const next=motion.animateIndicator(element,{left:0,top:0,width:40,height:20});frame();assert.equal(runs.length,1);motion.dispose();assert.equal(await next,false);
}
{
 const {motion,values,runs}=fixture(),host=box(),track=box(),row=box(),panel=box(),sheet=box(),scrim=box();let paints=0;
 const coordinates=motion.animateCoordinates(host,[0,0],[100,100],()=>paints++);
 const push=motion.animatePush(box());const settle=motion.settleFocusDeck(track,{from:20});
 motion.animateExerciseReorder([row],new Map([['row',{top:20}]]));
 const slot=motion.animateSlot(panel,()=>{panel.height=40});const gesture=motion.trackSheetGesture(sheet,scrim);const sheetSettle=gesture.settle();
 const before=paints;motion.dispose();
 assert.equal(await coordinates,false);assert.equal(await push,false);assert.equal(await settle,false);assert.equal(await slot,false);assert.equal(await sheetSettle,false);
 assert(values.every(value=>value.stopped&&value.listeners.size===0),'all motion-value clocks stop and release paint listeners');
 assert.equal(runs.find(run=>run.target===panel).stopped,true,'DOM playback stops as well');
 for(const value of values)value.set(0);assert.equal(paints,before,'no paint after disposal');
 assert.equal(track.style.transform,'');assert.equal(row.style.transform,'');assert.equal(panel.style.height,'');assert.equal(sheet.style.transform,'');
 motion.dispose();assert.equal(paints,before,'disposal is idempotent');
}
console.log('PASS literal Motion owner cancellation: queued RAF, indicators, coordinates, page push, deck settle, reorder, measured slot and sheet handles');
