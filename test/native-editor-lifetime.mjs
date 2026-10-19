import assert from 'node:assert/strict';
import {launchChromium} from './browser.mjs';
import {seedProgram,seedProgramMeta} from './fixtures/seed-program.mjs';
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
  const consumption=await page.evaluate(async seed=>{
    const {createProgramEditor}=await import('./src/ui/editors/program.js');
    const editor=createProgramEditor({window,nextId:()=> 'boundary-new-id',motion:null,sorting:{read:()=>null,available:()=>true,load:async()=>null}});
    const firstId=seed.program[0].id,slotId=seed.program[0].slotId;
    const outcomes={};
    async function exercise(name,prepare,act,{choice=null,refused=false}={}){
      const input=structuredClone(seed);prepare?.(input);
      const original=JSON.stringify(input),host=document.createElement('section');document.body.append(host);
      let acknowledge;const committed=new Promise(resolve=>{acknowledge=resolve});const requests=[];
      const mount=editor.mountProgramEditor(host,{read:()=>({document:input}),
        chooseExercise:()=>choice,suggestLoads:{eligibility:()=> 'eligible'},
        commit:request=>{requests.push(structuredClone(request));acknowledge();return {ok:true,document:request.nextDocument}}});
      host.querySelector(`[data-role="toggle-exercise"][data-id="${firstId}"]`)?.click();
      await Promise.resolve(); // expansion renders in the mounted owner
      act(host);
      if(!refused){
        let timeout;
        try{await Promise.race([committed,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error(`${name} did not submit a host receipt`)),5000)})]);}
        finally{clearTimeout(timeout);}
      }
      // Drain the synchronous host receipt and picker promise, without a timer.
      await Promise.resolve();await Promise.resolve();await Promise.resolve();
      outcomes[name]={requests,unchanged:JSON.stringify(input)===original,invalid:!!host.querySelector('[aria-invalid="true"]')};
      mount.dispose();host.remove();
    }
    const slot=input=>input.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.id===slotId);
    const ready=input=>{for(const cycle of slot(input).prescriptionsByCycle)for(const set of cycle.sets){set.status='ready';set.rir=2;}};
    const change=(host,selector,value)=>{const input=host.querySelector(selector);if(!input)throw new Error(`Missing ${selector}`);input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));};
    await exercise('name',null,host=>change(host,'[data-role="program-name"]','  Boundary name  '));
    await exercise('remove',null,host=>host.querySelector(`[data-role="remove-exercise"][data-id="${firstId}"]`).click());
    const custom={id:'custom:boundary',name:'Boundary custom',metricIds:[],metricDefinitions:[]};
    await exercise('replace',null,host=>host.querySelector(`[data-role="replace"][data-id="${firstId}"]`).click(),{choice:{entry:custom,stagedCustomDefinition:custom}});
    await exercise('alternate',null,host=>host.querySelector(`[data-role="add-alternate"][data-id="${firstId}"]`).click(),{choice:{id:'other-movement',name:'Other'}});
    await exercise('alternateSelf',null,host=>host.querySelector(`[data-role="add-alternate"][data-id="${firstId}"]`).click(),{choice:{id:seed.program[0].libraryId,name:'Self'},refused:true});
    const repSelector=`[data-role="metric-target"][data-slot-id="${slotId}"][data-cycle-index="1"][data-set-index="1"][data-semantic="reps"]`;
    await exercise('target',ready,host=>change(host,repSelector+'[data-bound="min"]','5'));
    await exercise('targetRefusal',ready,host=>{host.querySelector(repSelector+'[data-bound="max"]').value='';change(host,repSelector+'[data-bound="min"]','');},{refused:true});
    await exercise('rir',ready,host=>change(host,'[data-role="suggest-loads-rir"]','6'));
    await exercise('rirRefusal',ready,host=>change(host,'[data-role="suggest-loads-rir"]',''),{refused:true});
    await exercise('composition',input=>{slot(input).metricOrigin='user_defined';},host=>change(host,'[data-role="metric-composition"]','[]'));
    return outcomes;
  },{program:seedProgram(),programMeta:seedProgramMeta(),customExercises:[]});
  for(const [name,result] of Object.entries(consumption))assert.equal(result.unchanged,true,`${name} leaves its host's acknowledged input untouched`);
  for(const name of ['targetRefusal','rirRefusal','alternateSelf'])assert.deepEqual(consumption[name].requests,[],`${name} never reaches the host`);
  for(const [name,kind] of [['name','program_name'],['remove','exercise_remove'],['replace','exercise_replace'],['alternate','slot_alternates'],['target','metric_target'],['rir','suggest_loads_rir'],['composition','metric_composition']]){
    assert.equal(consumption[name].requests.length,1,`${name} submits exactly one receipt`);
    assert.equal(consumption[name].requests[0].intent.kind,kind);
  }
  assert.equal(consumption.name.requests[0].intent.after,'Boundary name');
  assert.equal(consumption.remove.requests[0].nextDocument.program[0].order,1);
  assert.deepEqual(consumption.replace.requests[0].nextDocument.customExercises,[{id:'custom:boundary',name:'Boundary custom',metricIds:[],metricDefinitions:[]}]);
  assert.deepEqual(consumption.alternate.requests[0].intent.after,['other-movement']);
  assert.deepEqual(consumption.target.requests[0].intent.after,{present:true,value:{min:5,max:8}});
  assert.equal(consumption.rir.requests[0].intent.after,6);
  assert.equal(consumption.rirRefusal.invalid,true);
  assert.deepEqual(consumption.composition.requests[0].intent.metricIds,[]);
  console.log('PASS mounted editor consumes authoring preparation for metric, RIR, composition, alternate and structural receipts');
  console.log('PASS native editor disposal isolates late commit failures from the replacement DOM owner');
}finally{await browser.close()}
