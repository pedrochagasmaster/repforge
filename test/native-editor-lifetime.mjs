import assert from 'node:assert/strict';
import {launchChromium} from './browser.mjs';
const browser=await launchChromium();
try{
  const page=await browser.newPage();
  await page.goto(process.env.REPFORGE_URL||'http://localhost:8000/');
  const result=await page.evaluate(async()=>{
    const {createProgramEditor}=await import('./src/ui/editors/program.js');
    const host=document.createElement('section');document.body.append(host);
    let settle;const commits=[];
    const pending=new Promise(resolve=>{settle=resolve});
    const editor=createProgramEditor({window,nextId:()=> 'literal-id',motion:null,sorting:{read:()=>null,available:()=>true,load:async()=>null}});
    const mounted=editor.mountProgramEditor(host,{read:()=>({document:{program:[],programMeta:{name:'Original'},customExercises:[]}}),commit:request=>{commits.push(request.intent.kind);return pending}});
    const input=host.querySelector('[data-role="program-name"]');input.value='Edited name';input.dispatchEvent(new Event('change',{bubbles:true}));
    mounted.dispose();host.textContent='Replacement owner';
    settle({ok:false,message:'Late failure must stay with disposed owner'});
    await pending;await Promise.resolve();await Promise.resolve();
    const text=host.textContent;await mounted.commit();host.remove();
    return{text,commits,classicMount:typeof window.mountProgramEditor};
  });
  assert.equal(result.text,'Replacement owner','late failed commit cannot repaint a new owner after disposal');
  assert.deepEqual(result.commits,['program_name'],'a stale exposed Apply after disposal cannot invoke the host again');
  assert.equal(result.classicMount,'undefined','production editor does not require the classic mount global');
  console.log('PASS native editor disposal isolates late commit failures from the replacement DOM owner');
}finally{await browser.close()}
