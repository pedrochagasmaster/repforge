import assert from 'node:assert/strict';
import {launchChromium} from './browser.mjs';
const browser=await launchChromium();
try{
  const page=await browser.newPage();
  await page.goto(process.env.REPFORGE_URL||'http://localhost:8000/');
  const result=await page.evaluate(async()=>{
    const {createProgramSharingView}=await import('./src/ui/program/sharing.js');
    // An isolated real DOM mount supplies delayed application replies. The
    // released codec/payload producer is covered by shared-setup-flow separately.
    document.body.innerHTML=`<section id="shareSetupSheet"><button id="shareSetupClose"></button><div id="shareSetupBody"><input id="shareSetupLink"><button id="shareSetupCopy"></button><button id="shareSetupShare"></button></div><p id="shareSetupStatus"></p><button id="shareSetupFile"></button><p id="shareSetupFor"></p></section><div id="shareSetupScrim"></div><section id="programTextSheet"><pre id="programTextOut"></pre><button id="programTextCopy"></button></section>`;
    let active=null;const replies=[],events=[],notices=[],copies=[];
    let clipboardAck;
    const clipboard=new Promise(resolve=>clipboardAck=resolve);
    const commands={link:()=>new Promise(resolve=>replies.push(resolve)),file:()=>null,text:()=>({text:'ONE, 1 day per week\n\nA\n1. Squat: 3× 5',name:'literal.txt'})};
    const files={copyText:async text=>{copies.push(text);return clipboard},download:()=>{},shareOrDownload:async()=>{}};
    const shell={openModal:sheet=>{active={el:sheet};sheet.hidden=false},closeModal:async sheet=>{sheet.hidden=true;active=null},activeModal:()=>active};
    const view=createProgramSharingView({window,commands,files,shell,reducedMotion:()=>true,t:key=>key,programName:()=> 'Literal split',toast:message=>notices.push(message),event:(name,properties)=>events.push({name,...properties})});
    view.mount();view.mount();
    const first=view.openSetup();await view.closeSetup();const second=view.openSetup();
    replies[1]({status:'ready',url:'https://example.invalid/index.html#setup=v4.SECOND',outcome:{program_kind:'manual',form:'full',size_vs_limit:'under_limit'}});await second;
    replies[0]({status:'ready',url:'https://example.invalid/index.html#setup=v4.STALE',outcome:{program_kind:'manual',form:'full',size_vs_limit:'under_limit'}});await first;
    const current=document.querySelector('#shareSetupLink').value;
    document.querySelector('#shareSetupCopy').click();await Promise.resolve();
    view.dispose();document.querySelector('#shareSetupStatus').textContent='Replacement owner';
    clipboardAck(true);await clipboard;await Promise.resolve();await Promise.resolve();
    document.querySelector('#shareSetupCopy').click();await Promise.resolve();
    const status=document.querySelector('#shareSetupStatus').textContent;
    return{current,status,events,notices,copies};
  });
  assert.equal(result.current,'https://example.invalid/index.html#setup=v4.SECOND','late first encoding cannot overwrite the reopened sheet');
  assert.equal(result.status,'Replacement owner');
  assert.deepEqual(result.notices,[],'a disposed copy cannot announce through a replacement UI');
  assert.deepEqual(result.copies,['https://example.invalid/index.html#setup=v4.SECOND'],'mount is idempotent and disposal removes listeners');
  assert.deepEqual(result.events,[{name:'share_setup_outcome',action:'link_ready',program_kind:'manual',form:'full',size_vs_limit:'under_limit'}],'only the current successful build emits coarse telemetry');
  console.log('PASS outbound sharing lifetime: superseded encoding, clipboard acknowledgement and mounted listeners');
}finally{await browser.close()}
