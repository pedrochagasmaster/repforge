import assert from "node:assert/strict";
import { launchChromium } from "./browser.mjs";
const base=process.env.REPFORGE_URL || "http://localhost:8000/";
const browser=await launchChromium();
try {
  const page=await browser.newPage();
  await page.goto(base);
  await page.setContent('<!doctype html><html><head></head><body><main><section class="view active" id="log"><h1>Today</h1><button id="opener">Open</button></section></main><div id="announcementHost"></div><div id="sheet" hidden class="hidden"><button id="first">First</button><button id="last">Last</button></div><div id="second" hidden class="hidden"><button id="next">Next</button></div><pre id="result">PENDING</pre>\n');
  const outcome=await page.evaluate(async base=>{

const {createShell}=await import(new URL("src/ui/shell.js",base).href);
const {createMotion}=await import(new URL("src/platform/motion.js",base).href);
const result=document.querySelector('#result');
const check=(value,label)=>{if(!value)throw Error(label)};
try {
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
} finally { await browser.close(); }
