const KEY="repforge_v1",DRAFT="repforge_draft_v1";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const uid=()=>crypto?.randomUUID?.()||`id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmt=v=>Number.isFinite(Number(v))?(Number.isInteger(Number(v))?String(Number(v)):Number(v).toFixed(2).replace(/\.?0+$/,"")):"";
const kfmt=v=>{const n=Number(v)||0;return n>=10000?(n/1000).toFixed(n>=100000?0:1).replace(/\.0$/,"")+"k":String(Math.round(n))};
const avg=a=>a.length?a.reduce((s,x)=>s+Number(x||0),0)/a.length:0;
const median=a=>{if(!a.length)return 0;const s=[...a].map(Number).sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const sum=a=>a.reduce((s,x)=>s+Number(x||0),0);
const daysAgo=n=>{const d=new Date();d.setDate(d.getDate()-n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const e1rm=(load,reps)=>load>0&&reps>0?load*(1+reps/30):0;
const muscles=s=>String(s||"").split(",").map(x=>x.trim()).filter(Boolean);
const shortDate=d=>{const p=String(d||"").split("-");return p.length===3?`${+p[1]}/${+p[2]}`:String(d||"")};
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.remove("hidden");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add("hidden"),2400)};
const download=(text,name,type="text/plain")=>{const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement("a");a.href=u;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(u)};
const DEFAULTS={jumpPct:2.5,minJump:2.5,rirHigh:2,hardRir:4};
const normSetting=(v,def,min=0)=>Number.isFinite(+v)&&+v>=min?+v:def;
const normalizeSettings=s=>({jumpPct:normSetting(s?.jumpPct,DEFAULTS.jumpPct,0),minJump:normSetting(s?.minJump,DEFAULTS.minJump,0.01),rirHigh:normSetting(s?.rirHigh,DEFAULTS.rirHigh,0),hardRir:normSetting(s?.hardRir,DEFAULTS.hardRir,0)});
const clearDraft=()=>localStorage.removeItem(DRAFT);
const loadDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT)||"{}")}catch{clearDraft();return{}}};
const posNum=(v,f=0)=>Math.max(0,Number.isFinite(+v)?+v:f);
const liftKey=x=>x.exerciseId||x.name;
const exerciseLabel=row=>{if(row.exerciseId){const ex=state.program.find(e=>e.id===row.exerciseId);if(ex)return ex.name}return row.name};
// Muscles for a log row: prefer the saved snapshot, else resolve from the live program.
const rowMuscles=row=>{if(row.primary!=null||row.secondary!=null)return{primary:row.primary||"",secondary:row.secondary||""};
  const ex=state.program.find(e=>e.id===row.exerciseId)||state.program.find(e=>e.name===row.name);
  return ex?{primary:ex.primary,secondary:ex.secondary}:{primary:"",secondary:""}};

const program=[
["Day 1",1,"Hack squat or pendulum squat",2,4,8,"Quads","Glutes,Adductors"],["Day 1",2,"Seated leg curl",2,4,8,"Hamstrings",""] ,["Day 1",3,"Incline converging chest press",2,4,8,"Chest","Front delts,Triceps"],["Day 1",4,"Chest-supported machine row",2,4,8,"Mid/upper back","Lats,Rear delts,Biceps"],["Day 1",5,"Machine lateral raise",2,6,8,"Side delts",""] ,["Day 1",6,"Hip adduction machine",2,6,8,"Adductors",""] ,
["Day 2",1,"45 degree leg press, quad-biased",2,4,8,"Quads","Glutes,Adductors"],["Day 2",2,"Smith machine RDL or machine hip hinge",2,4,8,"Hamstrings,Glutes","Spinal erectors"],["Day 2",3,"Machine shoulder press",2,4,8,"Front delts","Side delts,Triceps"],["Day 2",4,"Neutral-grip pulldown",2,4,8,"Lats","Mid/upper back,Biceps"],["Day 2",5,"Pec deck",2,6,8,"Chest",""] ,["Day 2",6,"Machine preacher curl",2,6,8,"Biceps",""] ,
["Day 3",1,"Leg extension",2,6,8,"Quads",""] ,["Day 3",2,"Lying or seated leg curl",2,6,8,"Hamstrings",""] ,["Day 3",3,"Machine chest dip or plate-loaded chest press",2,4,8,"Chest","Front delts,Triceps"],["Day 3",4,"Plate-loaded high row",2,4,8,"Lats,Mid/upper back","Rear delts,Biceps"],["Day 3",5,"Reverse pec deck",2,6,8,"Rear delts","Mid/upper back"],["Day 3",6,"Cable pressdown",2,6,8,"Triceps",""]
].map(x=>({id:uid(),day:x[0],order:x[1],name:x[2],sets:x[3],min:x[4],max:x[5],primary:x[6],secondary:x[7]}));

/* ============================================================
   Program model
   Exercise — one movement: day, sequence, rep range, muscles.
   Program — the whole split. Single source of truth for editing,
   ordering, day grouping, and the weekly volume audit. Persisted
   as plain objects (see toJSON) so backups stay forward-compatible.
   ============================================================ */
class Exercise{
  constructor(d={}){
    this.id=d.id||uid();
    this.day=String(d.day??"").trim()||"Day 1";
    this.order=Number.isFinite(+d.order)?+d.order:1;
    this.name=String(d.name??"").trim()||"Exercise";
    this.sets=Exercise.posInt(d.sets,2);
    this.min=Exercise.posInt(d.min,4);
    this.max=Math.max(this.min,Exercise.posInt(d.max,8));
    this.primary=String(d.primary??"");
    this.secondary=String(d.secondary??"");
    this.notes=String(d.notes??"").trim();
  }
  static posInt(v,fallback){const n=Math.round(+v);return Number.isFinite(n)&&n>0?n:fallback}
  toJSON(){return {id:this.id,day:this.day,order:this.order,name:this.name,sets:this.sets,min:this.min,max:this.max,primary:this.primary,secondary:this.secondary,notes:this.notes}}
}

class Program{
  constructor(list=[]){const ids=new Set();this.exercises=(Array.isArray(list)?list:[]).map(e=>{const ex=new Exercise(e);if(ids.has(ex.id))ex.id=uid();ids.add(ex.id);return ex});this.renumber()}
  days(){return [...new Set(this.exercises.map(e=>e.day))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))}
  forDay(d){return this.exercises.filter(e=>e.day===d).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name))}
  find(id){return this.exercises.find(e=>e.id===id)}
  renumber(){for(const d of this.days())this.forDay(d).forEach((e,i)=>e.order=i+1)}
  toJSON(){return this.exercises.map(e=>e.toJSON())}
  update(id,field,value){const e=this.find(id);if(!e)return;
    if(field==="sets")e.sets=Exercise.posInt(value,e.sets);
    else if(field==="min"){e.min=Exercise.posInt(value,e.min);if(e.max<e.min)e.max=e.min;}
    else if(field==="max"){e.max=Exercise.posInt(value,e.max);if(e.min>e.max)e.min=e.max;}
    else if(field==="name"||field==="primary"||field==="secondary"||field==="notes")e[field]=String(value??"").trim();}
  addExercise(day){const order=Math.max(0,...this.forDay(day).map(e=>e.order))+1;
    const e=new Exercise({day,order,name:"New exercise",sets:3,min:6,max:10});this.exercises.push(e);return e}
  removeExercise(id){this.exercises=this.exercises.filter(e=>e.id!==id);this.renumber()}
  move(id,dir){const e=this.find(id);if(!e)return;const list=this.forDay(e.day),i=list.indexOf(e),j=i+dir;
    if(j<0||j>=list.length)return;[list[i].order,list[j].order]=[list[j].order,list[i].order]}
  addDay(){const ds=this.days();let n=ds.length+1,name=`Day ${n}`;while(ds.includes(name))name=`Day ${++n}`;
    this.exercises.push(new Exercise({day:name,order:1,name:"New exercise",sets:3,min:6,max:10}));return name}
  renameDay(oldName,newName){const nv=String(newName).trim();if(!nv||nv===oldName)return false;
    if(this.days().includes(nv))return false;
    for(const e of this.exercises)if(e.day===oldName)e.day=nv;this.renumber();return true}
  removeDay(d){this.exercises=this.exercises.filter(e=>e.day!==d)}
  volume(){const m=new Map();for(const e of this.exercises){
    for(const x of muscles(e.primary))addVol(m,x,e.sets,0);
    for(const x of muscles(e.secondary))addVol(m,x,0,e.sets*.5)}return m}
}

let state=load(),prog=new Program(state.program),day=days()[0]||"Day 1",installPrompt=null,saving=false,editSession=null,volWindow=7;
const collapsed=new Set();
const committed=new Set();
const touched=new Set();
state.program=prog.toJSON();

function migrateLog(){let changed=false;for(const row of state.log){
  if(!row.exerciseId){const ex=state.program.find(e=>e.name===row.name&&e.day===row.day)||state.program.find(e=>e.name===row.name);if(ex){row.exerciseId=ex.id;changed=true}}
  const ld=posNum(row.load),rp=posNum(row.reps),rr=posNum(row.rir);
  if(ld!==row.load||rp!==row.reps||rr!==row.rir){row.load=ld;row.reps=rp;row.rir=rr;changed=true}}
  return changed}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s?.program&&Array.isArray(s.log))
  return{settings:normalizeSettings(s.settings),program:s.program,log:s.log}}catch{}return{settings:{...DEFAULTS},program,log:[]}}
function applyState(s){state={settings:normalizeSettings(s.settings),program:s.program,log:Array.isArray(s.log)?s.log:[]};prog=new Program(state.program);state.program=prog.toJSON();migrateLog();save()}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function days(){return [...new Set(state.program.map(x=>x.day))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))}
function exercises(d=day){return state.program.filter(x=>x.day===d).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name))}
function matchLift(ex){const id=ex?.id,name=ex?.name;return x=>id&&x.exerciseId?x.exerciseId===id:x.name===name}
function last(ex){const match=matchLift(ex);
  const hits=state.log.filter(match);if(!hits.length)return[];
  const sid=[...hits].sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0].session;
  return hits.filter(x=>x.session===sid).sort((a,b)=>a.set-b.set)}
// One entry per past session for this lift, oldest→newest, working sets only (load>0).
function sessionsFor(ex){const match=matchLift(ex),m=new Map();
  for(const x of state.log){if(!match(x)||!(+x.load>0))continue;
    if(!m.has(x.session))m.set(x.session,{session:x.session,date:x.date,created:x.created,loads:[],reps:[],rirs:[]});
    const o=m.get(x.session);o.loads.push(+x.load);o.reps.push(+x.reps);o.rirs.push(+x.rir)}
  return [...m.values()].map(o=>({session:o.session,date:o.date,created:o.created,reps:o.reps,
    med:median(o.loads),top:Math.max(...o.loads),minReps:Math.min(...o.reps),maxReps:Math.max(...o.reps),medReps:median(o.reps),avgRir:avg(o.rirs)}))
    .sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)))}
// Stalled = 3+ recent sessions at the same working load with no gain in top-set reps.
function isStalled(sess){if(sess.length<3)return false;const r=sess.slice(-3),l0=r[0].med,rep0=r[0].maxReps;
  return r.every(s=>Math.abs(s.med-l0)<0.01)&&r.every(s=>s.maxReps<=rep0)}
function round(v){const raw=+state.settings.minJump;const inc=Number.isFinite(raw)&&raw>0?raw:2.5;return Math.round(v/inc)*inc}
function jump(load,mult){return Math.max(load*(+state.settings.jumpPct||0)*mult/100,+state.settings.minJump||2.5)}
if(migrateLog())save();

// Recommendation -> RIR-aware double progression, mapped to a temperature/status.
function recommendation(ex){
  const sess=sessionsFor(ex);
  if(!sess.length)return{status:"new",heat:.12,label:"New lift",text:`No history yet. Pick a load you can hold for ${ex.min}-${ex.max} reps at 0-${state.settings.rirHigh} RIR.`,load:null,stalled:false};
  const l=sess.at(-1),load=l.med,reps=l.reps,n=reps.length,rir=l.avgRir,rirHigh=+state.settings.rirHigh;
  const atTop=reps.filter(r=>r>=ex.max).length,allTop=atTop===n;
  // Majority rule: on 3+ sets, one near-miss (within a rep of top) shouldn't veto the jump.
  const nearTop=n>=3&&atTop>=n-1&&l.minReps>=ex.max-1;
  const stalled=isStalled(sess);
  if((allTop||nearTop)&&rir>=rirHigh+1)return{status:"add2",heat:1,label:"Add load ++",text:"You topped the range with reps to spare. Jump up boldly.",load:round(load+jump(load,2)),stalled:false};
  if(allTop||nearTop)return{status:"add",heat:.82,label:"Add load",text:"Every set hit the top of the range. Add weight.",load:round(load+jump(load,1)),stalled:false};
  // Reduce uses the typical (median) set, so one junk set won't force a back-off — and it gives a real lighter target.
  if(l.medReps<ex.min)return{status:"reduce",heat:.18,label:"Back off",text:`Most sets fell below ${ex.min} reps. Drop the load and rebuild the range.`,load:Math.max(round(load-jump(load,1)),+state.settings.minJump||2.5),stalled};
  if(stalled)return{status:"reduce",heat:.3,label:"Stalled · deload",text:"No progress in three sessions. Take a lighter session or add a set, then rebuild.",load,stalled:true};
  if(rir<=0.5)return{status:"hold",heat:.42,label:"Hold · recover",text:"Sets are grinding near failure. Hold the load and bank some recovery.",load,stalled:false};
  if(rir>=rirHigh+1)return{status:"hold",heat:.6,label:"Push reps",text:"You left reps in reserve. Push closer to failure before adding load.",load,stalled:false};
  return{status:"hold",heat:.48,label:"Hold · add reps",text:"Keep the load and chase more reps inside your RIR target.",load,stalled:false};
}

function render(){renderTabs();renderWorkout();renderStats();renderHistory();renderProgram();renderSettings()}

function renderTabs(){const ds=days();if(!ds.includes(day))day=ds[0]||"Day 1";
  $("#dayTabs").innerHTML=ds.map(d=>`<button type="button" role="tab" aria-selected="${d===day?"true":"false"}" class="${d===day?"active":""}" data-day="${esc(d)}">${esc(d)}</button>`).join("");
  $$("#dayTabs button").forEach(b=>b.onclick=()=>{day=b.dataset.day;renderTabs();renderWorkout()})}

function renderWorkout(){
  const draft=loadDraft();
  committed.clear();(draft.__done||[]).forEach(k=>committed.add(k));
  touched.clear();(draft.__touched||[]).forEach(k=>touched.add(k));
  $("#workout").innerHTML=exercises().map(ex=>{
    const r=recommendation(ex),prev=last(ex);
    const prevHtml=prev.length?`<div class="prev"><span>Last:</span>${prev.map(x=>`${fmt(x.load)}×${x.reps}<small>@${fmt(x.rir)}</small>`).join(" ")}<button type="button" class="copylast" data-copy="${esc(ex.id)}">Copy</button></div>`:"";
    const rows=Array.from({length:ex.sets},(_,i)=>{const n=i+1,old=prev.find(x=>x.set===n);
      const draftKg=draft[`${ex.id}_${n}_load`];
      const kgVal=draftKg!=null?draftKg:(r.load!=null?fmt(r.load):(old&&old.load!=null?fmt(old.load):""));
      const repsVal=draft[`${ex.id}_${n}_reps`]??(old&&old.reps!=null?old.reps:ex.min);
      const rirVal=draft[`${ex.id}_${n}_rir`]??(old&&old.rir!=null?fmt(old.rir):1);
      const key=`${ex.id}_${n}`;
      const cls=committed.has(key)?"is-done":(touched.has(key)?"":"is-suggested");
      return `<div class="setrow ${cls}" data-set="${esc(key)}"><span class="setrow__n">${n}</span>`+
        `<div class="kg"><button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="-1" tabindex="-1" aria-label="Set ${n} decrease kg">−</button>`+
        `<input data-k="${ex.id}_${n}_load" type="number" step="any" min="0" inputmode="decimal" aria-label="Set ${n} kg" placeholder="kg" value="${esc(kgVal)}">`+
        `<button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="1" tabindex="-1" aria-label="Set ${n} increase kg">+</button></div>`+
        `<input data-k="${ex.id}_${n}_reps" type="number" step="1" min="0" inputmode="numeric" aria-label="Set ${n} reps" value="${esc(repsVal)}">`+
        `<input data-k="${ex.id}_${n}_rir" type="number" step="0.5" min="0" inputmode="decimal" aria-label="Set ${n} RIR" value="${esc(rirVal)}">`+
        `<button type="button" class="saveset" data-save="${esc(key)}" aria-label="Save set ${n}">${committed.has(key)?"✓":"Save"}</button></div>`;
    }).join("");
    return `<article class="exercise is-${r.status}${collapsed.has(ex.id)?" is-collapsed":""}" data-ex="${esc(ex.id)}">`+
      `<div class="ex__top"><div><h3 class="ex__name">${esc(ex.name)}</h3>`+
      `<p class="ex__meta">${ex.sets}×${ex.min}-${ex.max} reps · RIR 0-${fmt(state.settings.rirHigh)}</p></div>`+
      `<div class="ex__topend"><span class="ex__tag">${esc(ex.primary)}</span>`+
      `<button type="button" class="ex__caret" data-collapse="${esc(ex.id)}" aria-label="Toggle ${esc(ex.name)} sets">▾</button></div></div>`+
      `<div class="heat"><span class="heat__track"><span class="heat__fill" style="width:${Math.round(r.heat*100)}%"></span></span>`+
      `<span class="chip">${esc(r.label)}</span></div>`+
      `<p class="rec">${esc(r.text)}${r.load!==null?` Target <b>${fmt(r.load)} kg</b>.`:""}</p>`+
      (ex.notes?`<p class="setup"><span>Setup</span>${esc(ex.notes)}</p>`:"")+
      prevHtml+
      `<div class="sets__head"><span>Set</span><span>kg</span><span>reps</span><span>RIR</span><span></span></div>${rows}</article>`;
  }).join("");
  bindWorkout();
  updateGauge();updateSaveMeta();renderFatigue();
}

function saveDraft(){const d={};$$("#workout input").forEach(x=>d[x.dataset.k]=x.value);
  d.__done=[...committed];d.__touched=[...touched];localStorage.setItem(DRAFT,JSON.stringify(d))}

function bindWorkout(){
  $$("#workout input").forEach(i=>{i.oninput=()=>{const row=i.closest(".setrow");
    if(row&&row.dataset.set){touched.add(row.dataset.set);row.classList.remove("is-suggested")}
    saveDraft();updateSaveMeta()};
  i.onfocus=()=>i.select()});
  $$("#workout .saveset").forEach(b=>b.onclick=()=>{const key=b.dataset.save;
    const load=+($(`[data-k="${key}_load"]`)?.value)||0;
    if(load<=0){toast("Enter a weight before saving the set.");return}
    const row=b.closest(".setrow");
    if(committed.has(key)){committed.delete(key)}
    else{committed.add(key);touched.add(key)}
    if(row){row.classList.toggle("is-done",committed.has(key));row.classList.remove("is-suggested");
      b.textContent=committed.has(key)?"✓":"Save"}
    saveDraft();updateSaveMeta();
    if(committed.has(key)&&typeof startRest==="function")startRest()});
  $$("#workout .stepbtn").forEach(b=>b.onclick=()=>{const inp=$(`[data-k="${b.dataset.step}"]`);if(!inp)return;
    const inc=+state.settings.minJump||2.5,cur=+inp.value||0,next=Math.max(0,Math.round((cur+inc*(+b.dataset.dir))/inc)*inc);
    inp.value=fmt(next);
    const row=inp.closest(".setrow");
    if(row&&row.dataset.set){touched.add(row.dataset.set);row.classList.remove("is-suggested")}
    saveDraft();updateSaveMeta()});
  $$("#workout .copylast").forEach(b=>b.onclick=()=>{const prevSets=last({id:b.dataset.copy});if(!prevSets.length)return;
    for(const s of prevSets){touched.add(`${b.dataset.copy}_${s.set}`);
      for(const f of ["load","reps","rir"]){const inp=$(`[data-k="${b.dataset.copy}_${s.set}_${f}"]`);if(inp)inp.value=fmt(s[f])}}
    saveDraft();renderWorkout();toast("Filled from last session.")});
  $$("#workout .ex__caret").forEach(b=>b.onclick=()=>{const id=b.dataset.collapse,art=b.closest(".exercise");if(!art)return;
    const now=!collapsed.has(id);now?collapsed.add(id):collapsed.delete(id);art.classList.toggle("is-collapsed",now)});
}

function updateGauge(){const exs=exercises();const hot=exs.filter(e=>{const s=recommendation(e).status;return s==="add"||s==="add2"}).length;
  const g=$("#heatGauge"),frac=exs.length?hot/exs.length:0;
  g.querySelector(".gauge__fill").style.width=`${Math.round(frac*100)}%`;
  g.querySelector(".gauge__label").textContent=hot?`${hot} hot`:"forge";
  g.classList.toggle("is-hot",hot>0);
  g.style.cursor=hot?"pointer":"default";
  g.onclick=hot?()=>{const first=$("#workout .exercise.is-add, #workout .exercise.is-add2");if(first){collapsed.delete(first.dataset.ex);first.classList.remove("is-collapsed");first.scrollIntoView({behavior:"smooth",block:"center"})}}:null;}

function renderFatigue(){const el=$("#fatigue");if(!el)return;const exs=exercises();
  const flagged=exs.filter(e=>{const r=recommendation(e);return r.status==="reduce"||r.stalled}).length;
  if(exs.length>=3&&flagged>=2){el.className="fatigue";el.innerHTML=`<b>Fatigue watch</b> — ${flagged} lifts are backing off or stalled today. Consider a lighter session or a deload.`}
  else el.className="fatigue hidden",el.innerHTML="";}

function updateSaveMeta(){const exs=exercises(),planned=sum(exs.map(e=>e.sets));
  const done=[...committed].length;
  const entered=$$("#workout input").filter(i=>i.dataset.k&&i.dataset.k.endsWith("_load")&&+i.value>0).length;
  $("#saveMeta").textContent=done?`${day} · ${done}/${planned} sets done`:(entered?`${day} · ${entered}/${planned} entered`:`${day} · ${planned} sets`);}

function saveWorkout(e){e.preventDefault();if(saving)return;saving=true;
  try{const date=$("#date").value||today(),session=`${date}_${day}_${uid()}`,notes=$("#notes").value.trim(),created=new Date().toISOString(),rows=[];
  for(const ex of exercises())for(let n=1;n<=ex.sets;n++){
    const key=`${ex.id}_${n}`;
    const load=posNum($(`[data-k="${ex.id}_${n}_load"]`).value),reps=posNum($(`[data-k="${ex.id}_${n}_reps"]`).value),rir=posNum($(`[data-k="${ex.id}_${n}_rir"]`).value);
    if(load<=0)continue;
    if(!(committed.has(key)||touched.has(key)))continue;
    rows.push({session,date,day,name:ex.name,exerciseId:ex.id,set:n,load,reps,rir,notes,created,primary:ex.primary,secondary:ex.secondary})}
  if(!rows.length){toast("Enter weight on at least one set before saving.");return}
  state.log.push(...rows);save();clearDraft();committed.clear();touched.clear();$("#notes").value="";
  const btn=$(".btn--save");btn.classList.remove("is-stamped");void btn.offsetWidth;btn.classList.add("is-stamped");
  toast(`Workout forged — ${rows.length} sets logged.`);render()}finally{saving=false}}

function summaries(){const m=new Map();
  for(const x of state.log){const k=`${x.session}|${liftKey(x)}`;if(!m.has(k))m.set(k,{session:x.session,date:x.date,day:x.day,name:exerciseLabel(x),loads:[],reps:[],rirs:[],sets:0});
    const o=m.get(k);o.loads.push(+x.load);o.reps.push(+x.reps);o.rirs.push(+x.rir);o.sets++}
  return [...m.values()].map(o=>{let top=0,topReps=0,vol=0,best=0;
    o.loads.forEach((ld,i)=>{const rp=o.reps[i];vol+=ld*rp;const e=e1rm(ld,rp);if(e>best)best=e;if(ld>top){top=ld;topReps=rp}});
    return{session:o.session,date:o.date,day:o.day,name:o.name,top,topReps,reps:sum(o.reps),rir:avg(o.rirs),sets:o.sets,volume:vol,e1rm:best};})
    .sort((a,b)=>a.date.localeCompare(b.date)||a.session.localeCompare(b.session))}

function renderStats(){
  const names=[...new Set(state.log.map(x=>exerciseLabel(x)))].sort();
  const sums=summaries();
  const totalVol=sum(state.log.map(x=>(+x.load||0)*(+x.reps||0)));
  const bestE=state.log.length?Math.max(...state.log.map(x=>e1rm(+x.load,+x.reps))):0;
  const tiles=[
    {label:"Sessions",val:new Set(state.log.map(x=>x.session)).size},
    {label:"Sets logged",val:state.log.length},
    {label:"Volume",val:kfmt(totalVol),unit:"kg"},
    {label:"Best e1RM",val:fmt(Math.round(bestE)),unit:"kg",hot:bestE>0},
  ];
  $("#metrics").innerHTML=tiles.map(t=>`<div class="metric${t.hot?" metric--hot":""}"><div class="metric__label">${t.label}</div><div class="metric__val">${t.val}${t.unit?`<small>${t.unit}</small>`:""}</div></div>`).join("");

  const old=$("#statExercise").value;
  $("#statExercise").innerHTML=names.map(n=>`<option>${esc(n)}</option>`).join("")||"<option>No data</option>";
  if(names.includes(old))$("#statExercise").value=old;
  const sel=$("#statExercise").value,rows=sums.filter(x=>x.name===sel);
  draw(rows);

  if(rows.length){const first=rows[0].top,latest=rows.at(-1).top,delta=latest-first,be=Math.max(...rows.map(r=>r.e1rm));
    const dir=delta>0?"up":delta<0?"down":"";const arrow=delta>0?"▲":delta<0?"▼":"·";
    $("#trend").innerHTML=`<span>Top load <b>${fmt(first)}→${fmt(latest)} kg</b></span>`+
      `<span class="${dir}">${arrow} ${fmt(Math.abs(delta))} kg over ${rows.length} session${rows.length>1?"s":""}</span>`+
      `<span>Best e1RM <b>${fmt(Math.round(be))} kg</b></span>`;
  }else $("#trend").innerHTML="";

  $("#recent").innerHTML=table(rows.slice(-8).reverse().map(x=>({Date:x.date,Top:fmt(x.top),Reps:x.reps,RIR:fmt(x.rir),e1RM:fmt(Math.round(x.e1rm)),Vol:kfmt(x.volume)})));
  const topByLift=new Map();
  for(const x of state.log){const k=liftKey(x),ld=+x.load,cur=topByLift.get(k);
    if(!cur||ld>cur.load||(ld===cur.load&&+x.reps>+cur.reps))topByLift.set(k,{Exercise:exerciseLabel(x),load:ld,reps:x.reps,rir:x.rir,date:x.date})}
  const progRows=[...topByLift.values()].sort((a,b)=>b.load-a.load||b.reps-a.reps).map(r=>({Exercise:r.Exercise,kg:fmt(r.load),Reps:r.reps,RIR:fmt(r.rir),Date:r.date}));
  $("#tops").innerHTML=table(progRows);
  renderAttention();renderCompleted();
}

// Action board — which lifts need a decision, grouped by signal.
function renderAttention(){const el=$("#attention");if(!el)return;
  const g={add:[],reduce:[],fresh:[]};
  for(const ex of prog.exercises){const r=recommendation(ex);
    if(r.status==="add"||r.status==="add2")g.add.push(ex);
    else if(r.status==="reduce")g.reduce.push(ex);
    else if(r.status==="new")g.fresh.push(ex)}
  const grp=(list,cls,lead)=>list.length?`<div class="attn__grp attn--${cls}"><span class="attn__lead">${lead}</span>`+
    list.map(ex=>`<button type="button" class="attn__chip" data-attn="${esc(ex.name)}">${esc(ex.name)}</button>`).join("")+`</div>`:"";
  const html=grp(g.add,"add","Ready to add")+grp(g.reduce,"reduce","Back off / stalled")+grp(g.fresh,"new","Untested");
  el.innerHTML=html||`<div class="attn__grp"><span class="attn__lead">Every lift is holding — chase reps.</span></div>`;
  $$("#attention [data-attn]").forEach(b=>b.onclick=()=>{const nm=b.dataset.attn,has=[...$("#statExercise").options].some(o=>o.value===nm);
    if(has){$("#statExercise").value=nm;renderStats();$("#chart").scrollIntoView({behavior:"smooth",block:"center"})}else toast("Log this lift to chart it.")});}

// Completed hard sets per muscle over a rolling window (load>0, reps>0, RIR within hardRir).
function renderCompleted(){const el=$("#completedVolume");if(!el)return;const cutoff=daysAgo(volWindow-1),hr=+state.settings.hardRir,m=new Map();
  for(const x of state.log){if(String(x.date)<cutoff)continue;if(!(+x.load>0&&+x.reps>0&&+x.rir<=hr))continue;
    const mus=rowMuscles(x);
    for(const p of muscles(mus.primary))addVol(m,p,1,0);
    for(const s of muscles(mus.secondary))addVol(m,s,0,.5)}
  const arr=[...m.entries()].map(([name,v])=>({name,eff:v.d+v.p})).sort((a,b)=>b.eff-a.eff),max=Math.max(...arr.map(x=>x.eff),1);
  el.innerHTML=arr.length?arr.map(x=>`<div class="vrow"><span class="vrow__name">${esc(x.name)}</span>`+
    `<span class="vrow__bar"><span class="vrow__fill${x.eff>=10?" is-high":""}" style="width:${Math.max(4,Math.round(x.eff/max*100))}%"></span></span>`+
    `<span class="vrow__num"><b>${fmt(x.eff)}</b> sets</span></div>`).join(""):`<div class="table"><div class="empty">No hard sets in the last ${volWindow} days yet.</div></div>`;
  $$("#volWindow button").forEach(b=>{const on=+b.dataset.win===volWindow;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false")});}

function draw(rows){
  const c=$("#chart"),ctx=c.getContext("2d"),w=c.clientWidth||320,h=240,ratio=devicePixelRatio||1;
  c.width=w*ratio;c.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const C={ember:"#ff5a1f",gold:"#ffb44c",white:"#ffe9c7",quench:"#4fb6d9",steel:"#7c899b",dim:"#586474",rule:"#2a323d",mist:"#eceff4"};
  const padL=42,padR=14,padT=22,padB=26,iw=w-padL-padR,ih=h-padT-padB;
  ctx.font='11px "Plex Mono",monospace';ctx.textBaseline="middle";
  if(!rows.length){ctx.fillStyle=C.steel;ctx.textAlign="center";ctx.fillText("Log this lift to chart its progression.",w/2,h/2);return}
  const vals=rows.map(r=>r.top),max=Math.max(...vals),min=Math.min(...vals),span=max-min||1,pad=span*0.25;
  const lo=Math.max(0,min-pad),hi=max+pad,rng=hi-lo||1;
  const X=i=>padL+(rows.length===1?iw/2:i*iw/(rows.length-1)),Y=v=>padT+ih-((v-lo)/rng)*ih;
  // gridlines + y labels
  ctx.strokeStyle=C.rule;ctx.lineWidth=1;ctx.fillStyle=C.dim;ctx.textAlign="right";
  for(let i=0;i<=3;i++){const gy=padT+ih*i/3,val=hi-(rng*i/3);ctx.beginPath();ctx.moveTo(padL,gy);ctx.lineTo(w-padR,gy);ctx.stroke();ctx.fillText(fmt(Math.round(val)),padL-8,gy)}
  // area fill
  const grad=ctx.createLinearGradient(0,padT,0,padT+ih);grad.addColorStop(0,"rgba(255,90,31,.28)");grad.addColorStop(1,"rgba(255,90,31,0)");
  ctx.beginPath();rows.forEach((r,i)=>i?ctx.lineTo(X(i),Y(r.top)):ctx.moveTo(X(i),Y(r.top)));
  ctx.lineTo(X(rows.length-1),padT+ih);ctx.lineTo(X(0),padT+ih);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  // line (cool -> hot, left to right = progression heating up)
  const lg=ctx.createLinearGradient(padL,0,w-padR,0);lg.addColorStop(0,C.quench);lg.addColorStop(.55,C.gold);lg.addColorStop(1,C.white);
  ctx.strokeStyle=lg;ctx.lineWidth=2.5;ctx.lineJoin="round";ctx.lineCap="round";
  ctx.beginPath();rows.forEach((r,i)=>i?ctx.lineTo(X(i),Y(r.top)):ctx.moveTo(X(i),Y(r.top)));ctx.stroke();
  // points
  rows.forEach((r,i)=>{const last=i===rows.length-1;ctx.beginPath();ctx.arc(X(i),Y(r.top),last?5:3,0,7);
    if(last){ctx.fillStyle=C.white;ctx.shadowColor=C.ember;ctx.shadowBlur=16;ctx.fill();ctx.shadowBlur=0;}
    else{ctx.fillStyle=C.gold;ctx.fill()}});
  // last value callout
  const lx=X(rows.length-1),ly=Y(rows.at(-1).top);ctx.fillStyle=C.white;ctx.textAlign=lx>w-60?"right":"left";ctx.font='600 12px "Plex Mono",monospace';
  ctx.fillText(`${fmt(rows.at(-1).top)}kg`,lx+(lx>w-60?-10:9),ly-12);
  // x labels (first & last date)
  ctx.fillStyle=C.dim;ctx.font='10px "Plex Mono",monospace';ctx.textBaseline="alphabetic";
  ctx.textAlign="left";ctx.fillText(shortDate(rows[0].date),padL,h-8);
  ctx.textAlign="right";ctx.fillText(shortDate(rows.at(-1).date),w-padR,h-8);
}

function redrawChart(){if(!$("#stats").classList.contains("active"))return;
  const sel=$("#statExercise").value,rows=summaries().filter(x=>x.name===sel);draw(rows)}

function renderHistory(){
  const sessions=[...new Map(state.log.map(x=>[x.session,x])).values()].sort((a,b)=>{
    const dd=String(b.date).localeCompare(String(a.date));return dd||String(b.created).localeCompare(String(a.created))});
  $("#sessions").innerHTML=sessions.length?sessions.map(s=>{
    const sets=state.log.filter(r=>r.session===s.session).sort((a,b)=>String(exerciseLabel(a)).localeCompare(exerciseLabel(b))||a.set-b.set);
    if(s.session===editSession)return sessionEditor(s,sets);
    const top=sets.reduce((m,x)=>{const ld=+x.load,rp=+x.reps;return ld>m.load||(ld===m.load&&rp>m.reps)?{load:ld,reps:rp}:m},{load:0,reps:0});
    const vol=sum(sets.map(x=>(+x.load||0)*(+x.reps||0)));
    return `<div class="session"><div class="session__info"><div class="session__day">${esc(s.day)}</div>`+
      `<div class="session__sub">${esc(s.date)} · ${sets.length} sets · <span class="session__stat">${fmt(top.load)}×${top.reps}</span> top · ${kfmt(vol)} kg</div></div>`+
      `<div class="session__btns"><button class="session__edit" data-edit="${esc(s.session)}">Edit</button>`+
      `<button class="session__del" data-del="${esc(s.session)}">Delete</button></div></div>`;
  }).join(""):`<div class="table"><div class="empty">No sessions yet. Forge your first on the Log tab.</div></div>`;
  $$("[data-del]").forEach(b=>b.onclick=()=>{if(confirm("Delete this session? This cannot be undone.")){state.log=state.log.filter(x=>x.session!==b.dataset.del);if(editSession===b.dataset.del)editSession=null;save();render();toast("Session deleted.")}});
  $$("[data-edit]").forEach(b=>b.onclick=()=>{editSession=b.dataset.edit;renderHistory()});
  $$("[data-edcancel]").forEach(b=>b.onclick=()=>{editSession=null;renderHistory()});
  $$("[data-edsave]").forEach(b=>b.onclick=()=>saveSessionEdit(b.dataset.edsave));
  const rows=[...state.log].sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name)||a.set-b.set).map(x=>({Date:x.date,Day:x.day,Exercise:exerciseLabel(x),Set:x.set,kg:fmt(x.load),Reps:x.reps,RIR:fmt(x.rir)}));
  $("#historyTable").innerHTML=table(rows);
}

function sessionEditor(s,sets){
  const rows=sets.map(r=>{const key=`${liftKey(r)}|${r.set}`;
    return `<div class="edrow"><span class="edrow__name">${esc(exerciseLabel(r))} <small>#${r.set}</small></span>`+
      `<input class="edrow__in" data-ek="load|${esc(key)}" type="number" step="any" min="0" inputmode="decimal" value="${esc(fmt(r.load))}" aria-label="${esc(exerciseLabel(r))} set ${r.set} kg">`+
      `<input class="edrow__in" data-ek="reps|${esc(key)}" type="number" step="1" min="0" inputmode="numeric" value="${esc(r.reps)}" aria-label="${esc(exerciseLabel(r))} set ${r.set} reps">`+
      `<input class="edrow__in" data-ek="rir|${esc(key)}" type="number" step="0.5" min="0" inputmode="decimal" value="${esc(fmt(r.rir))}" aria-label="${esc(exerciseLabel(r))} set ${r.set} RIR"></div>`}).join("");
  return `<div class="session session--edit" data-editing="${esc(s.session)}">`+
    `<div class="edhead"><div class="session__day">${esc(s.day)}</div>`+
    `<label class="edate">Date<input data-ed="date" type="date" value="${esc(s.date)}"></label></div>`+
    `<div class="edrow edrow--head"><span>Set</span><span>kg</span><span>reps</span><span>RIR</span></div>`+rows+
    `<div class="edbtns"><button type="button" class="btn btn--steel" data-edcancel="1">Cancel</button>`+
    `<button type="button" class="btn btn--forge" data-edsave="${esc(s.session)}">Save changes</button></div></div>`;
}

function saveSessionEdit(sid){const card=$(`.session--edit[data-editing="${sid}"]`);if(!card)return;
  const newDate=card.querySelector('[data-ed="date"]').value||"",vals={};
  card.querySelectorAll("[data-ek]").forEach(inp=>vals[inp.dataset.ek]=inp.value);
  for(const r of state.log){if(r.session!==sid)continue;const key=`${liftKey(r)}|${r.set}`;
    if(`load|${key}`in vals)r.load=posNum(vals[`load|${key}`]);
    if(`reps|${key}`in vals)r.reps=posNum(vals[`reps|${key}`]);
    if(`rir|${key}`in vals)r.rir=posNum(vals[`rir|${key}`]);
    if(newDate)r.date=newDate}
  state.log=state.log.filter(r=>r.session!==sid||+r.load>0);
  editSession=null;save();render();toast("Session updated.");}

function renderProgram(){renderProgramEditor();renderVolume()}

function renderProgramEditor(){
  const ds=prog.days();
  $("#programEditor").innerHTML=ds.length
    ?ds.map(dayCard).join("")
    :`<div class="table"><div class="empty">No training days yet. Add one to start building your split.</div></div>`;
  if(document.activeElement!==$("#programJson"))$("#programJson").value=JSON.stringify(prog.toJSON(),null,2);
  bindEditor();
}

function dayCard(d){
  const exs=prog.forDay(d),sets=sum(exs.map(e=>e.sets));
  const body=exs.length
    ?exs.map((e,i)=>exCard(e,i,exs.length)).join("")
    :`<p class="pday__empty">No exercises yet. Add your first below.</p>`;
  return `<div class="pday" data-day="${esc(d)}">`+
    `<div class="pday__head">`+
      `<input class="pday__name" data-act="renameDay" data-day="${esc(d)}" value="${esc(d)}" aria-label="Day name">`+
      `<span class="pday__count">${exs.length} ex · ${sets} sets</span>`+
      `<button class="iconbtn iconbtn--del" type="button" data-act="delDay" data-day="${esc(d)}" title="Delete day" aria-label="Delete ${esc(d)}">✕</button>`+
    `</div>`+
    `<div class="pexlist">${body}</div>`+
    `<button class="btn btn--steel pday__add" type="button" data-act="addEx" data-day="${esc(d)}">+ Add exercise</button>`+
  `</div>`;
}

function exCard(e,i,n){
  const num=(f,label)=>`<label class="pex__num">${label}<input type="number" inputmode="numeric" min="1" step="1" data-id="${e.id}" data-field="${f}" value="${esc(e[f])}"></label>`;
  return `<div class="pex" data-id="${esc(e.id)}">`+
    `<div class="pex__head">`+
      `<input class="pex__name" data-id="${esc(e.id)}" data-field="name" value="${esc(e.name)}" placeholder="Exercise name" aria-label="Exercise name">`+
      `<div class="pex__move">`+
        `<button class="iconbtn" type="button" data-act="up" data-id="${esc(e.id)}"${i===0?" disabled":""} aria-label="Move up">▲</button>`+
        `<button class="iconbtn" type="button" data-act="down" data-id="${esc(e.id)}"${i===n-1?" disabled":""} aria-label="Move down">▼</button>`+
        `<button class="iconbtn iconbtn--del" type="button" data-act="delEx" data-id="${esc(e.id)}" aria-label="Delete exercise">✕</button>`+
      `</div>`+
    `</div>`+
    `<div class="pex__nums">${num("sets","Sets")}${num("min","Min reps")}${num("max","Max reps")}</div>`+
    `<label class="pex__mus">Primary<input data-id="${esc(e.id)}" data-field="primary" value="${esc(e.primary)}" placeholder="e.g. Chest"></label>`+
    `<label class="pex__mus">Secondary<input data-id="${esc(e.id)}" data-field="secondary" value="${esc(e.secondary)}" placeholder="e.g. Front delts, Triceps"></label>`+
    `<label class="pex__mus">Setup notes<input data-id="${esc(e.id)}" data-field="notes" value="${esc(e.notes)}" placeholder="e.g. Seat 4, feet high, 2s stretch"></label>`+
  `</div>`;
}

function bindEditor(){
  $$("#programEditor [data-field]").forEach(inp=>{
    inp.oninput=()=>{prog.update(inp.dataset.id,inp.dataset.field,inp.value);persistProgram();renderVolume();updateGauge();updateSaveMeta()};
    if(inp.type==="number"){
      inp.onfocus=()=>inp.select();
      inp.onchange=()=>{const e=prog.find(inp.dataset.id);if(!e)return;const card=inp.closest(".pex");
        (card?card.querySelectorAll('input[type="number"][data-field]'):[inp]).forEach(x=>x.value=e[x.dataset.field])};
    }
  });
  $$('#programEditor [data-act="renameDay"]').forEach(inp=>{
    inp.onchange=()=>{const old=inp.dataset.day,next=inp.value.trim();
      if(prog.renameDay(old,next)){for(const row of state.log)if(row.day===old)row.day=next;
        if(day===old)day=next;persistProgram();save();render();toast("Day renamed.")}
      else{inp.value=old;toast(prog.days().includes(next)?"That day name already exists.":"Couldn't rename day.")}};
  });
  $$("#programEditor button[data-act]").forEach(b=>b.onclick=()=>editorAction(b.dataset.act,b.dataset));
}

function editorAction(act,ds){
  if(act==="addEx"){prog.addExercise(ds.day);persistProgram();render();toast("Exercise added.")}
  else if(act==="delEx"){if(confirm("Remove this exercise from your program? Logged history will stay on this device.")){prog.removeExercise(ds.id);persistProgram();render();toast("Exercise removed.")}}
  else if(act==="up"){prog.move(ds.id,-1);persistProgram();render()}
  else if(act==="down"){prog.move(ds.id,1);persistProgram();render()}
  else if(act==="delDay"){if(confirm(`Delete ${ds.day} and all of its exercises? Logged history for these exercises will remain.`)){prog.removeDay(ds.day);persistProgram();render();toast("Day deleted.")}}
}

function renderVolume(){
  const arr=[...prog.volume().entries()].map(([name,v])=>({name,eff:v.d+v.p})).sort((a,b)=>b.eff-a.eff);
  const max=Math.max(...arr.map(x=>x.eff),1);
  $("#volume").innerHTML=arr.length?arr.map(x=>`<div class="vrow"><span class="vrow__name">${esc(x.name)}</span>`+
    `<span class="vrow__bar"><span class="vrow__fill${x.eff>=10?" is-high":""}" style="width:${Math.max(4,Math.round(x.eff/max*100))}%"></span></span>`+
    `<span class="vrow__num"><b>${fmt(x.eff)}</b> sets</span></div>`).join(""):`<div class="table"><div class="empty">No exercises in the program.</div></div>`;
}
function addVol(m,k,d,p){if(!m.has(k))m.set(k,{d:0,p:0});m.get(k).d+=d;m.get(k).p+=p}

function persistProgram(){state.program=prog.toJSON();save()}

function saveProgram(){try{const parsed=JSON.parse($("#programJson").value);if(!Array.isArray(parsed))throw Error();
  const byId=new Map(prog.exercises.map(e=>[e.id,e]));
  for(const row of parsed){if(row.id&&byId.has(row.id))continue;
    const match=prog.exercises.find(e=>e.name===row.name&&e.day===row.day)||prog.exercises.find(e=>e.name===row.name);
    if(match&&!parsed.some(r=>r.id===match.id))row.id=match.id}
  prog=new Program(parsed);persistProgram();clearDraft();day=prog.days()[0]||"Day 1";if(migrateLog())save();render();toast("Program saved.")}
  catch{toast("That JSON didn't parse. Check the brackets and commas.")}}

function renderSettings(){$("#jumpPct").value=state.settings.jumpPct;$("#minJump").value=state.settings.minJump;$("#rirHigh").value=state.settings.rirHigh;$("#hardRir").value=state.settings.hardRir;
  $("#storageNote").textContent=`Everything lives in this browser under "${KEY}". Export a backup before clearing site data or switching phones — there is no cloud copy.`}

function commitSettings(silent){const num=(sel,def,min)=>{const n=+$(sel).value;return Number.isFinite(n)&&n>=min?n:def};
  state.settings=normalizeSettings({jumpPct:num("#jumpPct",2.5,0),minJump:(()=>{const n=+$("#minJump").value;return Number.isFinite(n)&&n>0?n:2.5})(),rirHigh:num("#rirHigh",2,0),hardRir:num("#hardRir",4,0)});
  save();render();if(!silent)toast("Settings saved.");}

function table(rows){if(!rows.length)return'<div class="empty">No data yet.</div>';const h=Object.keys(rows[0]);
  return`<table><thead><tr>${h.map(x=>`<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${h.map(x=>`<td>${esc(r[x])}</td>`).join("")}</tr>`).join("")}</tbody></table>`}

function exportCsv(){const h=["session","date","day","name","set","load","reps","rir","notes","created"],csv=[h.join(","),...state.log.map(r=>h.map(k=>`"${String(r[k]??"").replaceAll('"','""')}"`).join(","))].join("\n");download(csv,`repforge_log_${today()}.csv`,"text/csv")}
function exportJson(){download(JSON.stringify(state,null,2),`repforge_backup_${today()}.json`,"application/json")}
async function importJson(e){const f=e.target.files?.[0];if(!f)return;try{const s=JSON.parse(await f.text());if(!s.program||!Array.isArray(s.log))throw Error();
  applyState(s);clearDraft();day=days()[0]||"Day 1";render();toast("Backup imported.")}catch{toast("That file isn't a valid RepForge backup.")}e.target.value=""}

function init(){
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
  let rzT;window.addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(redrawChart,150)});
  window.addEventListener("orientationchange",()=>setTimeout(redrawChart,200));
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#installBtn").classList.remove("hidden")});
  $("#installBtn").onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installBtn").classList.add("hidden")}};
  $("#date").value=today();
  $("#logForm").onsubmit=saveWorkout;
  $("#statExercise").onchange=renderStats;
  $("#saveProgram").onclick=saveProgram;
  $("#addDay").onclick=()=>{day=prog.addDay();persistProgram();render();toast("Day added.")};
  $("#saveSettings").onclick=()=>commitSettings(false);
  ["#jumpPct","#minJump","#rirHigh","#hardRir"].forEach(sel=>$(sel).onchange=()=>commitSettings(true));
  $$("#volWindow button").forEach(b=>b.onclick=()=>{volWindow=+b.dataset.win;renderCompleted()});
  $("#exportCsv").onclick=exportCsv;$("#exportJson").onclick=exportJson;$("#importJson").onchange=importJson;
  $("#reset").onclick=()=>{if(confirm("Delete the training log? Export a backup first if you need it.")){state.log=[];clearDraft();save();render();toast("Log deleted.")}};
  $$("nav button").forEach(b=>b.onclick=()=>{$$("nav button").forEach(x=>{const on=x===b;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===b.dataset.view));window.scrollTo({top:0});render()});
  $("nav button.active")?.setAttribute("aria-current","page");
  render();
}
init();
