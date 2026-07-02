const KEY="repforge_v1",DRAFT="repforge_draft_v1";
const DB="repforge",STORE="kv";
function idbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbGet(key){const db=await idbOpen();
  try{return await new Promise((res,rej)=>{
    const tx=db.transaction(STORE,"readonly").objectStore(STORE).get(key);
    tx.onsuccess=()=>res(tx.result);tx.onerror=()=>rej(tx.error)})}
  finally{db.close()}}
async function idbSet(key,val){const db=await idbOpen();
  try{return await new Promise((res,rej)=>{
    const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(val,key);
    tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
  finally{db.close()}}
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
async function shareOrDownload(text,name,type){
  try{if(navigator.canShare){const file=new File([text],name,{type});
    if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"RepForge backup"});return}}}catch{}
  download(text,name,type)}
const GLOSSARY={
  RIR:"Reps in reserve — how many more reps you could have done before failing. RIR 2 = you had 2 left. Newer? Just estimate: could I do 1–2 more?",
  "rep range":"The target reps per set (e.g. 4–8). Stay in the range; when every set hits the top, add weight next time.",
  "double progression":"Add reps until you top the range, then add weight and drop back to the bottom of the range. That's the whole recommendation engine.",
  deload:"A deliberately lighter session to recover when progress stalls. Not a failure — it's how you keep progressing.",
  e1RM:"Estimated one-rep max from your set (Epley: load × (1 + reps/30)). A single number to compare hard sets across days.",
  "hard set":"A set taken close enough to failure to drive growth (at or under your hard-set RIR ceiling). These are what the volume audit counts.",
  "Easy effort":"You could have done several more reps — about 3 reps in reserve (RIR 3). Use this when the set felt comfortable.",
  "Hard effort":"You were working but not grinding — about 1 rep in reserve (RIR 1). This is the sweet spot for most working sets.",
  "Max effort":"You were at or very near failure — 0 reps in reserve (RIR 0). Save this for your last set or when you're pushing hard."
};
const EFFORT_RIR={easy:3,hard:1,max:0};
function glossaryPopover(term,anchor){const g=$("#glossary");if(!g)return;
  g.querySelector(".glossary__term").textContent=term;
  g.querySelector(".glossary__body").textContent=GLOSSARY[term]||"";
  g.classList.remove("hidden");
  const r=anchor.getBoundingClientRect();g.style.top=`${window.scrollY+r.bottom+6}px`;g.style.left=`${Math.max(8,r.left)}px`}
const DEFAULTS={jumpPct:2.5,minJump:2.5,rirHigh:2,hardRir:4,restSec:120,lastExport:"",unit:"kg",rirMode:"numeric"};
const normSetting=(v,def,min=0)=>Number.isFinite(+v)&&+v>=min?+v:def;
const normalizeSettings=s=>({jumpPct:normSetting(s?.jumpPct,DEFAULTS.jumpPct,0),minJump:normSetting(s?.minJump,DEFAULTS.minJump,0.01),rirHigh:normSetting(s?.rirHigh,DEFAULTS.rirHigh,0),hardRir:normSetting(s?.hardRir,DEFAULTS.hardRir,0),restSec:normSetting(s?.restSec,DEFAULTS.restSec,0),lastExport:typeof s?.lastExport==="string"?s.lastExport:"",unit:s?.unit==="lb"?"lb":"kg",rirMode:s?.rirMode==="effort"?"effort":"numeric"});
const LB=2.2046226218;
const toDisplayUnit=(kg,unit)=>unit==="lb"?(+kg||0)*LB:(+kg||0);
const fromDisplayUnit=(v,unit)=>unit==="lb"?(+v||0)/LB:(+v||0);
const isLb=()=>state.settings.unit==="lb";
const toDisplay=kg=>toDisplayUnit(kg,state.settings.unit);
const fromDisplay=v=>fromDisplayUnit(v,state.settings.unit);
const unitLabel=()=>isLb()?"lb":"kg";
const fmtLoad=kg=>fmt(toDisplay(kg));
const term=t=>`<button type="button" class="term" data-term="${esc(t)}">${esc(t)}</button>`;
const clearDraft=()=>localStorage.removeItem(DRAFT);
const loadDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT)||"{}")}catch{clearDraft();return{}}};
function convertDraftUnits(oldUnit,newUnit){
  if(oldUnit===newUnit)return;
  const d=loadDraft();let changed=false;
  for(const k of Object.keys(d)){
    if(k.startsWith("__")||!k.endsWith("_load"))continue;
    const v=d[k];if(v===""||v==null)continue;
    const n=+v;if(!Number.isFinite(n))continue;
    d[k]=fmt(toDisplayUnit(fromDisplayUnit(n,oldUnit),newUnit));changed=true}
  if(changed)localStorage.setItem(DRAFT,JSON.stringify(d))}
const posNum=(v,f=0)=>Math.max(0,Number.isFinite(+v)?+v:f);
const isWork=r=>!r.warmup;
const liftKey=x=>x.exerciseId||x.name;
const exerciseLabel=row=>{if(row.exerciseId){const ex=state.program.find(e=>e.id===row.exerciseId);if(ex)return ex.name}return row.name};
const displayName=row=>row.performedName||exerciseLabel(row);
// Muscles for a log row: prefer the saved snapshot, else resolve from the live program.
const rowMuscles=row=>{if(row.primary!=null||row.secondary!=null)return{primary:row.primary||"",secondary:row.secondary||""};
  const ex=state.program.find(e=>e.id===row.exerciseId)||state.program.find(e=>e.name===row.name);
  return ex?{primary:ex.primary,secondary:ex.secondary}:{primary:"",secondary:""}};

const defaultAlternates={
  "Hack squat or pendulum squat":["Leg press","Pendulum squat"],
  "45 degree leg press, quad-biased":["Hack squat","Belt squat"],
  "Incline converging chest press":["Flat chest press machine","Dumbbell incline press"],
  "Neutral-grip pulldown":["Lat pulldown","Assisted pull-up"]
};
const program=[
["Day 1",1,"Hack squat or pendulum squat",2,4,8,"Quads","Glutes,Adductors"],["Day 1",2,"Seated leg curl",2,4,8,"Hamstrings",""] ,["Day 1",3,"Incline converging chest press",2,4,8,"Chest","Front delts,Triceps"],["Day 1",4,"Chest-supported machine row",2,4,8,"Mid/upper back","Lats,Rear delts,Biceps"],["Day 1",5,"Machine lateral raise",2,6,8,"Side delts",""] ,["Day 1",6,"Hip adduction machine",2,6,8,"Adductors",""] ,
["Day 2",1,"45 degree leg press, quad-biased",2,4,8,"Quads","Glutes,Adductors"],["Day 2",2,"Smith machine RDL or machine hip hinge",2,4,8,"Hamstrings,Glutes","Spinal erectors"],["Day 2",3,"Machine shoulder press",2,4,8,"Front delts","Side delts,Triceps"],["Day 2",4,"Neutral-grip pulldown",2,4,8,"Lats","Mid/upper back,Biceps"],["Day 2",5,"Pec deck",2,6,8,"Chest",""] ,["Day 2",6,"Machine preacher curl",2,6,8,"Biceps",""] ,
["Day 3",1,"Leg extension",2,6,8,"Quads",""] ,["Day 3",2,"Lying or seated leg curl",2,6,8,"Hamstrings",""] ,["Day 3",3,"Machine chest dip or plate-loaded chest press",2,4,8,"Chest","Front delts,Triceps"],["Day 3",4,"Plate-loaded high row",2,4,8,"Lats,Mid/upper back","Rear delts,Biceps"],["Day 3",5,"Reverse pec deck",2,6,8,"Rear delts","Mid/upper back"],["Day 3",6,"Cable pressdown",2,6,8,"Triceps",""]
].map(x=>{const ex={id:uid(),day:x[0],order:x[1],name:x[2],sets:x[3],min:x[4],max:x[5],primary:x[6],secondary:x[7]};if(defaultAlternates[x[2]])ex.alternates=defaultAlternates[x[2]];return ex});

const programBeginner=[
["Day 1",1,"Leg press (quad focus)",2,4,8,"Quads","Glutes,Adductors","Feet low on the platform, back flat against the pad."],
["Day 1",2,"Seated leg curl",2,4,8,"Hamstrings","","Pad just above your ankles; squeeze at the bottom."],
["Day 1",3,"Chest press machine",2,4,8,"Chest","Front delts,Triceps","Look for a seat with chest pad and handles at armpit height."],
["Day 1",4,"Seated row machine",2,4,8,"Mid/upper back","Lats,Rear delts,Biceps","Chest against the pad; pull to your lower ribs."],
["Day 1",5,"Lateral raise machine",2,6,8,"Side delts","","Elbows on the pads; raise to shoulder height."],
["Day 1",6,"Hip adduction machine",2,6,8,"Adductors","","Pads on the inside of your knees; squeeze together."],
["Day 2",1,"Leg press (glute focus)",2,4,8,"Quads","Glutes,Adductors","Feet higher on the platform for more glute stretch."],
["Day 2",2,"Romanian deadlift machine",2,4,8,"Hamstrings,Glutes","Spinal erectors","Hinge at the hips; feel a stretch in your hamstrings."],
["Day 2",3,"Shoulder press machine",2,4,8,"Front delts","Side delts,Triceps","Handles at ear level; press straight up."],
["Day 2",4,"Lat pulldown",2,4,8,"Lats","Mid/upper back,Biceps","Wide grip; pull the bar to your upper chest."],
["Day 2",5,"Chest fly machine",2,6,8,"Chest","","Arms slightly bent; squeeze your chest at the top."],
["Day 2",6,"Preacher curl machine",2,6,8,"Biceps","","Upper arms flat on the pad; curl without lifting elbows."],
["Day 3",1,"Leg extension",2,6,8,"Quads","","Pad on your shins; extend without locking knees hard."],
["Day 3",2,"Leg curl machine",2,6,8,"Hamstrings","","Lying or seated — pad above ankles, curl smoothly."],
["Day 3",3,"Chest press (flat)",2,4,8,"Chest","Front delts,Triceps","Handles at mid-chest; press without arching off the seat."],
["Day 3",4,"High row machine",2,4,8,"Lats,Mid/upper back","Rear delts,Biceps","Pull toward your upper chest; squeeze shoulder blades."],
["Day 3",5,"Reverse fly machine",2,6,8,"Rear delts","Mid/upper back","Face the pad; open arms wide behind you."],
["Day 3",6,"Triceps pushdown",2,6,8,"Triceps","","Elbows pinned to your sides; push the bar down."]
].map(x=>{const ex={id:uid(),day:x[0],order:x[1],name:x[2],sets:x[3],min:x[4],max:x[5],primary:x[6],secondary:x[7],notes:x[8]||""};
  if(x[2]==="Leg press (quad focus)")ex.alternates=["Hack squat machine","Pendulum squat"];
  if(x[2]==="Lat pulldown")ex.alternates=["Assisted pull-up","Neutral-grip pulldown"];
  return ex});

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
    this.alternates=Array.isArray(d.alternates)?d.alternates.map(s=>String(s).trim()).filter(Boolean):
      typeof d.alternates==="string"?d.alternates.split(",").map(s=>s.trim()).filter(Boolean):[];
    if(d.libraryId!=null)this.libraryId=String(d.libraryId).trim();
    if(d.progressionType!=null)this.progressionType=String(d.progressionType).trim();
    if(d.targetRirStart!=null&&Number.isFinite(+d.targetRirStart))this.targetRirStart=+d.targetRirStart;
    if(d.targetRirEnd!=null&&Number.isFinite(+d.targetRirEnd))this.targetRirEnd=+d.targetRirEnd;
    if(d.minSets!=null&&Number.isFinite(+d.minSets)&&+d.minSets>0)this.minSets=Math.round(+d.minSets);
    if(d.maxSets!=null&&Number.isFinite(+d.maxSets)&&+d.maxSets>0)this.maxSets=Math.round(+d.maxSets);
    if(d.priority!=null)this.priority=String(d.priority).trim();
  }
  static posInt(v,fallback){const n=Math.round(+v);return Number.isFinite(n)&&n>0?n:fallback}
  toJSON(){const o={id:this.id,day:this.day,order:this.order,name:this.name,sets:this.sets,min:this.min,max:this.max,primary:this.primary,secondary:this.secondary,notes:this.notes,alternates:this.alternates};
    if(this.libraryId!==undefined)o.libraryId=this.libraryId;
    if(this.progressionType!==undefined)o.progressionType=this.progressionType;
    if(this.targetRirStart!==undefined)o.targetRirStart=this.targetRirStart;
    if(this.targetRirEnd!==undefined)o.targetRirEnd=this.targetRirEnd;
    if(this.minSets!==undefined)o.minSets=this.minSets;
    if(this.maxSets!==undefined)o.maxSets=this.maxSets;
    if(this.priority!==undefined)o.priority=this.priority;
    return o}
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
    else if(field==="alternates")e.alternates=String(value??"").split(",").map(s=>s.trim()).filter(Boolean);
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

const DAY_TYPES={full_body:["squat","hinge","press","pull","delts","arms"],upper:["press","row","pulldown","delts","chest_iso","arms"],
  lower:["squat","hinge","leg_curl","leg_extension","calves"],push:["press","incline_press","shoulder_press","lateral_raise","triceps"],
  pull:["row","pulldown","rear_delt","curl"],legs:["squat","hinge","leg_curl","leg_extension","adduction","calves"]};
const SESSION_BOUNDS={short:[4,5],normal:[5,7],long:[7,9]};
const FILLER_SLOTS=["curl","triceps","lateral_raise","chest_iso","calves","leg_curl"];
const EXERCISE_CATALOG=[
  {id:"sq_bb",name:"Barbell back squat",pattern:"squat",equipment:["barbell"],primary:"Quads",secondary:"Glutes,Adductors",beginnerFriendly:false},
  {id:"sq_sm",name:"Smith machine squat",pattern:"squat",equipment:["smith","machine"],primary:"Quads",secondary:"Glutes,Adductors",beginnerFriendly:true},
  {id:"sq_lp",name:"Leg press",pattern:"squat",equipment:["machine"],primary:"Quads",secondary:"Glutes,Adductors",beginnerFriendly:true,notes:"Feet low on the platform, back flat against the pad."},
  {id:"sq_db",name:"Goblet squat",pattern:"squat",equipment:["dumbbell"],primary:"Quads",secondary:"Glutes,Adductors",beginnerFriendly:true},
  {id:"hg_bb",name:"Barbell Romanian deadlift",pattern:"hinge",equipment:["barbell"],primary:"Hamstrings,Glutes",secondary:"Spinal erectors",beginnerFriendly:false},
  {id:"hg_sm",name:"Smith machine RDL",pattern:"hinge",equipment:["smith","machine"],primary:"Hamstrings,Glutes",secondary:"Spinal erectors",beginnerFriendly:true},
  {id:"hg_mc",name:"Romanian deadlift machine",pattern:"hinge",equipment:["machine"],primary:"Hamstrings,Glutes",secondary:"Spinal erectors",beginnerFriendly:true},
  {id:"pr_bb",name:"Barbell bench press",pattern:"press",equipment:["barbell"],primary:"Chest",secondary:"Front delts,Triceps",beginnerFriendly:false},
  {id:"pr_db",name:"Dumbbell bench press",pattern:"press",equipment:["dumbbell"],primary:"Chest",secondary:"Front delts,Triceps",beginnerFriendly:true},
  {id:"pr_mc",name:"Chest press machine",pattern:"press",equipment:["machine"],primary:"Chest",secondary:"Front delts,Triceps",beginnerFriendly:true},
  {id:"ip_db",name:"Dumbbell incline press",pattern:"incline_press",equipment:["dumbbell"],primary:"Chest",secondary:"Front delts,Triceps",beginnerFriendly:true},
  {id:"ip_mc",name:"Incline chest press machine",pattern:"incline_press",equipment:["machine"],primary:"Chest",secondary:"Front delts,Triceps",beginnerFriendly:true},
  {id:"ip_bb",name:"Barbell incline press",pattern:"incline_press",equipment:["barbell"],primary:"Chest",secondary:"Front delts,Triceps",beginnerFriendly:false},
  {id:"sp_bb",name:"Barbell overhead press",pattern:"shoulder_press",equipment:["barbell"],primary:"Front delts",secondary:"Side delts,Triceps",beginnerFriendly:false},
  {id:"sp_mc",name:"Shoulder press machine",pattern:"shoulder_press",equipment:["machine"],primary:"Front delts",secondary:"Side delts,Triceps",beginnerFriendly:true},
  {id:"sp_db",name:"Dumbbell shoulder press",pattern:"shoulder_press",equipment:["dumbbell"],primary:"Front delts",secondary:"Side delts,Triceps",beginnerFriendly:true},
  {id:"rw_bb",name:"Barbell row",pattern:"row",equipment:["barbell"],primary:"Mid/upper back",secondary:"Lats,Rear delts,Biceps",beginnerFriendly:false},
  {id:"rw_mc",name:"Seated row machine",pattern:"row",equipment:["machine"],primary:"Mid/upper back",secondary:"Lats,Rear delts,Biceps",beginnerFriendly:true},
  {id:"rw_cb",name:"Cable seated row",pattern:"row",equipment:["cable"],primary:"Mid/upper back",secondary:"Lats,Rear delts,Biceps",beginnerFriendly:true},
  {id:"pd_mc",name:"Lat pulldown",pattern:"pulldown",equipment:["machine","cable"],primary:"Lats",secondary:"Mid/upper back,Biceps",beginnerFriendly:true},
  {id:"pd_bw",name:"Assisted pull-up",pattern:"pulldown",equipment:["machine"],primary:"Lats",secondary:"Mid/upper back,Biceps",beginnerFriendly:true},
  {id:"pl_cb",name:"Cable pullover",pattern:"pull",equipment:["cable","machine"],primary:"Lats",secondary:"Mid/upper back",beginnerFriendly:true},
  {id:"pl_mc",name:"Neutral-grip pulldown",pattern:"pull",equipment:["machine","cable"],primary:"Lats",secondary:"Mid/upper back,Biceps",beginnerFriendly:true},
  {id:"dl_mc",name:"Lateral raise machine",pattern:"delts",equipment:["machine"],primary:"Side delts",secondary:"",beginnerFriendly:true},
  {id:"dl_db",name:"Dumbbell lateral raise",pattern:"delts",equipment:["dumbbell"],primary:"Side delts",secondary:"",beginnerFriendly:true},
  {id:"dl_cb",name:"Cable lateral raise",pattern:"delts",equipment:["cable"],primary:"Side delts",secondary:"",beginnerFriendly:true},
  {id:"lr_db",name:"Dumbbell lateral raise",pattern:"lateral_raise",equipment:["dumbbell"],primary:"Side delts",secondary:"",beginnerFriendly:true},
  {id:"lr_mc",name:"Lateral raise machine",pattern:"lateral_raise",equipment:["machine"],primary:"Side delts",secondary:"",beginnerFriendly:true},
  {id:"rd_mc",name:"Reverse pec deck",pattern:"rear_delt",equipment:["machine"],primary:"Rear delts",secondary:"Mid/upper back",beginnerFriendly:true},
  {id:"rd_db",name:"Rear delt fly",pattern:"rear_delt",equipment:["dumbbell"],primary:"Rear delts",secondary:"Mid/upper back",beginnerFriendly:true},
  {id:"ci_mc",name:"Pec deck",pattern:"chest_iso",equipment:["machine"],primary:"Chest",secondary:"",beginnerFriendly:true},
  {id:"ci_cb",name:"Cable fly",pattern:"chest_iso",equipment:["cable"],primary:"Chest",secondary:"",beginnerFriendly:true},
  {id:"ar_mc",name:"Preacher curl machine",pattern:"arms",equipment:["machine"],primary:"Biceps",secondary:"",beginnerFriendly:true},
  {id:"ar_db",name:"Dumbbell curl",pattern:"arms",equipment:["dumbbell"],primary:"Biceps",secondary:"",beginnerFriendly:true},
  {id:"cu_mc",name:"Preacher curl machine",pattern:"curl",equipment:["machine"],primary:"Biceps",secondary:"",beginnerFriendly:true},
  {id:"cu_db",name:"Dumbbell curl",pattern:"curl",equipment:["dumbbell"],primary:"Biceps",secondary:"",beginnerFriendly:true},
  {id:"cu_cb",name:"Cable curl",pattern:"curl",equipment:["cable"],primary:"Biceps",secondary:"",beginnerFriendly:true},
  {id:"tr_cb",name:"Cable pressdown",pattern:"triceps",equipment:["cable"],primary:"Triceps",secondary:"",beginnerFriendly:true},
  {id:"tr_mc",name:"Machine triceps extension",pattern:"triceps",equipment:["machine"],primary:"Triceps",secondary:"",beginnerFriendly:true},
  {id:"lc_mc",name:"Seated leg curl",pattern:"leg_curl",equipment:["machine"],primary:"Hamstrings",secondary:"",beginnerFriendly:true},
  {id:"le_mc",name:"Leg extension",pattern:"leg_extension",equipment:["machine"],primary:"Quads",secondary:"",beginnerFriendly:true},
  {id:"cv_mc",name:"Standing calf raise machine",pattern:"calves",equipment:["machine"],primary:"Calves",secondary:"",beginnerFriendly:true},
  {id:"ad_mc",name:"Hip adduction machine",pattern:"adduction",equipment:["machine"],primary:"Adductors",secondary:"",beginnerFriendly:true}
];
function resolveSplit(daysPerWeek,splitType){
  const n=Math.max(1,Math.min(7,Math.round(+daysPerWeek)||3)),st=splitType||"full_body";
  if(st==="full_body"||st==="machine_only")return Array.from({length:n},()=>"full_body");
  if(st==="upper_lower")return Array.from({length:n},(_,i)=>i%2?"lower":"upper");
  if(st==="ppl"){const c=["push","pull","legs"];return Array.from({length:n},(_,i)=>c[i%3]);}
  if(st==="bro"){const c=n<=3?["push","pull","legs"]:n===4?["push","pull","legs","upper"]:["push","pull","legs","push","pull","legs"];
    return Array.from({length:n},(_,i)=>c[i%c.length]);}
  return Array.from({length:n},()=>"full_body")}
function exerciseSlotsForDay(dayType,answers){return[...(DAY_TYPES[dayType]||DAY_TYPES.full_body)]}
function catalogForSlot(slot,equipment,experience){
  const eq=new Set((equipment||[]).map(s=>String(s).toLowerCase()));
  let pool=EXERCISE_CATALOG.filter(e=>e.pattern===slot);
  if(eq.size)pool=pool.filter(e=>e.equipment.some(x=>eq.has(String(x).toLowerCase())));
  if(!pool.length)pool=EXERCISE_CATALOG.filter(e=>e.pattern===slot);
  if(experience==="beginner"){const bf=pool.filter(e=>e.beginnerFriendly);if(bf.length)pool=bf}
  return pool.sort((a,b)=>a.id.localeCompare(b.id))}
function chooseExercise(slot,equipment,experience,usedIds){
  const pool=catalogForSlot(slot,equipment,experience).filter(e=>!usedIds.has(e.id));
  if(pool.length)return pool[0];
  return catalogForSlot(slot,equipment,experience)[0]||null}
function repScheme(experience,goal,slot){
  let sets=experience==="beginner"?2:3,min=experience==="beginner"?8:6,max=experience==="beginner"?12:10;
  if(goal==="strength"){min=4;max=6;sets=experience==="beginner"?3:4}
  const iso=["lateral_raise","rear_delt","chest_iso","curl","triceps","calves","leg_curl","leg_extension","adduction","delts","arms"];
  if(goal!=="strength"&&iso.includes(slot)){min=Math.max(min,8);max=Math.max(max,12)}
  return{sets,min,max}}
function muscleHit(ex,muscle){const m=muscle.toLowerCase();
  return muscles(ex.primary).concat(muscles(ex.secondary)).some(x=>x.toLowerCase()===m||x.toLowerCase().includes(m))}
function applyPriorityMuscles(program,priorityMuscles){
  if(!priorityMuscles?.length)return;
  for(const ex of program){
    if(priorityMuscles.some(m=>muscleHit(ex,m)))ex.sets=Math.min(ex.sets+1,5)}
  for(const muscle of priorityMuscles){
    if(program.some(ex=>muscleHit(ex,muscle)))continue;
    const day=program[0]?.day||"Day 1";
    const slot=muscle.includes("Quad")?"leg_extension":muscle.includes("Chest")?"chest_iso":muscle.includes("Bicep")?"curl":
      muscle.includes("Tricep")?"triceps":muscle.includes("Ham")?"leg_curl":muscle.includes("Glute")?"hinge":
      muscle.includes("Lat")||muscle.includes("Back")?"row":muscle.includes("delt")?"lateral_raise":"curl";
    const entry=chooseExercise(slot,[],null,new Set(program.map(e=>e.libraryId)));
    if(!entry)continue;
    const rs=repScheme("intermediate","hypertrophy",slot);
    program.push({id:uid(),day,order:program.filter(e=>e.day===day).length+1,name:entry.name,sets:rs.sets,min:rs.min,max:rs.max,
      primary:entry.primary,secondary:entry.secondary||"",notes:entry.notes||"",libraryId:entry.id})}}
function pickFillerForDay(dayExs,usedIds,equipment,experience){
  const have=new Set(dayExs.map(e=>e.libraryId));
  for(const slot of FILLER_SLOTS){
    const entry=chooseExercise(slot,equipment,experience,new Set([...usedIds,...have]));
    if(!entry||have.has(entry.id))continue;
    const rs=repScheme(experience,"hypertrophy",slot);
    return{id:uid(),day:dayExs[0].day,order:dayExs.length+1,name:entry.name,sets:rs.sets,min:rs.min,max:rs.max,
      primary:entry.primary,secondary:entry.secondary||"",notes:entry.notes||"",libraryId:entry.id}}
  return null}
function applySessionLength(program,sessionLength,equipment,experience){
  const [lo,hi]=SESSION_BOUNDS[sessionLength]||SESSION_BOUNDS.normal,out=[];
  const days=[...new Set(program.map(e=>e.day))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  for(const day of days){
    let list=program.filter(e=>e.day===day).sort((a,b)=>a.order-b.order);
    if(list.length>hi)list=list.slice(0,hi);
    const used=new Set(list.map(e=>e.libraryId));
    while(list.length<lo){const extra=pickFillerForDay(list,used,equipment,experience);if(!extra)break;used.add(extra.libraryId);list.push(extra)}
    list.forEach((e,i)=>{e.order=i+1;out.push(e)})}
  program.length=0;program.push(...out)}
function generateProgramFromOnboarding(answers){
  const a=answers||{},equipment=a.equipment||[],experience=a.experience||"intermediate",goal=a.goal||"hypertrophy";
  const dayTypes=resolveSplit(a.daysPerWeek,a.splitType),program=[];
  dayTypes.forEach((dayType,di)=>{
    const dayName=`Day ${di+1}`,slots=exerciseSlotsForDay(dayType,a),usedIds=new Set();let order=0;
    for(const slot of slots){
      const entry=chooseExercise(slot,equipment,experience,usedIds);if(!entry)continue;
      usedIds.add(entry.id);order++;
      const rs=repScheme(experience,goal,slot);
      program.push({id:uid(),day:dayName,order,name:entry.name,sets:rs.sets,min:rs.min,max:rs.max,
        primary:entry.primary,secondary:entry.secondary||"",notes:entry.notes||"",libraryId:entry.id})}});
  applyPriorityMuscles(program,a.priorityMuscles||[]);
  applySessionLength(program,a.sessionLength||"normal",equipment,experience);
  return program}

let state,prog,day,installPrompt=null,saving=false,editSession=null,volWindow=7;
let restEnd=0,restTick=null;
const collapsed=new Set();
const skipped=new Set();
const substituted=new Map();
const committed=new Set();
const touched=new Set();
const warmups=new Set();
let logMode="full",focusIndex=0;

function migrateLog(){let changed=false;for(const row of state.log){
  if(!row.exerciseId){const ex=state.program.find(e=>e.name===row.name&&e.day===row.day)||state.program.find(e=>e.name===row.name);if(ex){row.exerciseId=ex.id;changed=true}}
  const ld=posNum(row.load),rp=posNum(row.reps),rr=posNum(row.rir);
  if(ld!==row.load||rp!==row.reps||rr!==row.rir){row.load=ld;row.reps=rp;row.rir=rr;changed=true}}
  return changed}
function earliestLogDate(log){if(!log?.length)return null;return log.reduce((min,r)=>!min||String(r.date)<min?r.date:min,null)}
function defaultProgramMeta(log=[]){const now=new Date().toISOString();return{id:uid(),name:"",started:earliestLogDate(log),created:now,updated:now,
  goal:null,experience:null,daysPerWeek:null,splitType:null,equipment:[],priorityMuscles:[],sessionLength:null,
  mesocycleLengthWeeks:6,mesocycleStatus:"active",completedAt:null,onboarded:false}}
function normalizeProgramMeta(m,log=[]){const now=new Date().toISOString(),base=defaultProgramMeta(log);
  if(!m||typeof m!=="object")return base;
  const started=typeof m.started==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(m.started)?m.started:(m.started===null?null:base.started);
  const goal=typeof m.goal==="string"?m.goal.trim()||null:m.goal===null?null:base.goal;
  const experience=typeof m.experience==="string"?m.experience.trim()||null:m.experience===null?null:base.experience;
  const daysPerWeek=Number.isFinite(+m.daysPerWeek)?+m.daysPerWeek:m.daysPerWeek===null?null:base.daysPerWeek;
  const splitType=typeof m.splitType==="string"?m.splitType.trim()||null:m.splitType===null?null:base.splitType;
  const equipment=Array.isArray(m.equipment)?m.equipment.map(s=>String(s).trim()).filter(Boolean):base.equipment;
  const priorityMuscles=Array.isArray(m.priorityMuscles)?m.priorityMuscles.map(s=>String(s).trim()).filter(Boolean):base.priorityMuscles;
  const sessionLength=typeof m.sessionLength==="string"?m.sessionLength.trim()||null:m.sessionLength===null?null:base.sessionLength;
  const mesocycleLengthWeeks=Number.isFinite(+m.mesocycleLengthWeeks)&&+m.mesocycleLengthWeeks>0?Math.round(+m.mesocycleLengthWeeks):base.mesocycleLengthWeeks;
  const mesocycleStatus=m.mesocycleStatus==="active"||m.mesocycleStatus==="completed"?m.mesocycleStatus:base.mesocycleStatus;
  const completedAt=typeof m.completedAt==="string"?m.completedAt:m.completedAt===null?null:base.completedAt;
  const onboarded=typeof m.onboarded==="boolean"?m.onboarded:base.onboarded;
  return{id:typeof m.id==="string"&&m.id?m.id:base.id,name:typeof m.name==="string"?m.name.trim():"",started,
    created:typeof m.created==="string"?m.created:base.created,updated:typeof m.updated==="string"?m.updated:now,
    goal,experience,daysPerWeek,splitType,equipment,priorityMuscles,sessionLength,mesocycleLengthWeeks,mesocycleStatus,completedAt,onboarded}}
function normalizeLoaded(s){try{if(s?.program&&Array.isArray(s.log))
  return{settings:normalizeSettings(s.settings),programMeta:normalizeProgramMeta(s.programMeta,s.log),program:s.program,log:s.log,
    programHistory:Array.isArray(s.programHistory)?s.programHistory:[]}}catch{}return{settings:{...DEFAULTS},programMeta:defaultProgramMeta([]),program,log:[],programHistory:[]}}
function applyState(s){state={settings:normalizeSettings(s.settings),programMeta:normalizeProgramMeta(s.programMeta,s.log),program:s.program,log:Array.isArray(s.log)?s.log:[],
  programHistory:Array.isArray(s.programHistory)?s.programHistory:[]};
  prog=new Program(state.program);state.program=prog.toJSON();state.programMeta=normalizeProgramMeta(state.programMeta,state.log);migrateLog();save()}
function persistProgramMeta(partial={}){if(!state.programMeta)state.programMeta=defaultProgramMeta(state.log);
  if(partial.name!==undefined)state.programMeta.name=String(partial.name??"").trim();
  if(partial.started!==undefined){const v=partial.started;state.programMeta.started=v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null}
  if(partial.goal!==undefined)state.programMeta.goal=partial.goal;
  if(partial.experience!==undefined)state.programMeta.experience=partial.experience;
  if(partial.daysPerWeek!==undefined)state.programMeta.daysPerWeek=partial.daysPerWeek;
  if(partial.splitType!==undefined)state.programMeta.splitType=partial.splitType;
  if(partial.equipment!==undefined)state.programMeta.equipment=partial.equipment;
  if(partial.priorityMuscles!==undefined)state.programMeta.priorityMuscles=partial.priorityMuscles;
  if(partial.sessionLength!==undefined)state.programMeta.sessionLength=partial.sessionLength;
  if(partial.mesocycleStatus!==undefined)state.programMeta.mesocycleStatus=partial.mesocycleStatus;
  if(partial.onboarded!==undefined)state.programMeta.onboarded=partial.onboarded;
  state.programMeta.updated=new Date().toISOString();save()}
function programAdherence(){const totalDays=prog.days().length;if(!totalDays)return{logged:0,total:0,ratio:0};
  const cutoff=daysAgo(6),programDaySet=new Set(prog.days()),loggedDays=new Set();
  for(const x of state.log){if(String(x.date)<cutoff)continue;if(programDaySet.has(x.day))loggedDays.add(x.day)}
  const logged=loggedDays.size;return{logged,total:totalDays,ratio:totalDays?logged/totalDays:0}}
function programWeek(){const s=state.programMeta?.started;if(!s)return null;
  const start=new Date(`${s}T12:00:00`),now=new Date(`${today()}T12:00:00`);
  const days=Math.floor((now-start)/86400000);return days<0?1:Math.floor(days/7)+1}
function programProgressionHealth(){const withHistory=prog.exercises.filter(ex=>sessionsFor(ex).length>0);
  if(!withHistory.length)return null;
  const hot=withHistory.filter(ex=>{const st=recommendation(ex).status;return st==="add"||st==="add2"}).length;
  return{hot,total:withHistory.length,ratio:hot/withHistory.length}}
function programVolumeCompliance(){const planned=prog.volume();let plannedTotal=0;
  for(const [,v] of planned)plannedTotal+=v.d+v.p;if(!plannedTotal)return null;
  const m=completedHardSets(7);let completed=0;for(const [,v] of m)completed+=v.d+v.p;
  return{planned:plannedTotal,completed,ratio:Math.min(completed/plannedTotal,1)}}
function programStatusLabel(adherence,health){
  const hasLog=state.log.some(isWork);if(!hasLog)return"Getting started";
  const adRatio=adherence.ratio,hRatio=health?.ratio??0;
  if(adRatio>=1&&hRatio>=0.4)return"On track";if(adRatio>=0.5)return"Partial week";return"Rebuilding"}
function parseProgramImport(parsed){
  if(Array.isArray(parsed))return{exercises:parsed,meta:null};
  if(Array.isArray(parsed?.exercises))return{exercises:parsed.exercises,meta:parsed.meta??null};
  if(Array.isArray(parsed?.program))return{exercises:parsed.program,meta:parsed.meta??null};
  return null}
function save(){persist()}
function persist(){
  try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){console.warn("localStorage mirror failed",e)}
  idbSet(KEY,state).catch(e=>console.warn("idb persist failed",e))}
function days(){return [...new Set(state.program.map(x=>x.day))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))}
function exercises(d=day){return state.program.filter(x=>x.day===d).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name))}
function matchLift(ex){const id=ex?.id,name=ex?.name;return x=>id&&x.exerciseId?x.exerciseId===id:x.name===name}
function last(ex){const match=matchLift(ex);
  const hits=state.log.filter(x=>match(x)&&isWork(x));if(!hits.length)return[];
  const sid=[...hits].sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0].session;
  return hits.filter(x=>x.session===sid).sort((a,b)=>a.set-b.set)}
// One entry per past session for this lift, oldest→newest, working sets only (load>0).
function sessionsFor(ex){const match=matchLift(ex),m=new Map();
  for(const x of state.log){if(!match(x)||!(+x.load>0)||!isWork(x))continue;
    if(!m.has(x.session))m.set(x.session,{session:x.session,date:x.date,created:x.created,loads:[],reps:[],rirs:[]});
    const o=m.get(x.session);o.loads.push(+x.load);o.reps.push(+x.reps);o.rirs.push(+x.rir)}
  return [...m.values()].map(o=>({session:o.session,date:o.date,created:o.created,reps:o.reps,
    med:median(o.loads),top:Math.max(...o.loads),minReps:Math.min(...o.reps),maxReps:Math.max(...o.reps),medReps:median(o.reps),avgRir:avg(o.rirs)}))
    .sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)))}
const DELTA_THRESHOLDS={e1rmPct:.01,volumePct:.025,rir:.75};
function workingRows(rows){return(rows||[]).filter(r=>isWork(r)&&+r.load>0&&+r.reps>0)}
function exerciseSessionMetrics(rows){const w=workingRows(rows);if(!w.length)return null;let topLoad=0,topLoadReps=0,totalReps=0,totalVolume=0,bestE1rm=0;const rirs=[];
  for(const r of w){const ld=+r.load,rp=+r.reps;totalReps+=rp;totalVolume+=ld*rp;rirs.push(+r.rir);const em=e1rm(ld,rp);if(em>bestE1rm)bestE1rm=em;if(ld>topLoad||(ld===topLoad&&rp>topLoadReps)){topLoad=ld;topLoadReps=rp}}
  return{topLoad,topLoadReps,totalReps,totalVolume,bestE1rm,avgRir:avg(rirs),workingSets:w.length}}
function previousSessionForExercise(ex,beforeSessionId){const match=matchLift(ex),m=new Map();
  for(const x of state.log){if(!match(x)||!(+x.load>0)||!isWork(x)||!(+x.reps>0))continue;
    if(!m.has(x.session))m.set(x.session,{session:x.session,date:x.date,created:x.created,rows:[]});m.get(x.session).rows.push(x)}
  const ordered=[...m.values()].sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)));
  const curIdx=ordered.findIndex(s=>s.session===beforeSessionId);
  if(curIdx<0){const curCreated=state.log.find(r=>r.session===beforeSessionId)?.created;if(!curCreated)return ordered.length?ordered.at(-1).rows:[];
    const older=ordered.filter(s=>String(s.created).localeCompare(String(curCreated))<0);return older.length?older.at(-1).rows:[]}
  return curIdx>0?ordered[curIdx-1].rows:[]}
function buildSessionDelta(prevRows,currentRows){const previous=exerciseSessionMetrics(prevRows),current=exerciseSessionMetrics(currentRows),T=DELTA_THRESHOLDS;
  if(!previous||!current)return{status:"not_comparable",label:"Not comparable",text:"No working sets logged.",metrics:null};
  const loadDelta=current.topLoad-previous.topLoad,repsDelta=current.totalReps-previous.totalReps,volumeDelta=current.totalVolume-previous.totalVolume,
    e1rmDelta=current.bestE1rm-previous.bestE1rm,avgRirDelta=current.avgRir-previous.avgRir,deltas={loadDelta,repsDelta,volumeDelta,e1rmDelta,avgRirDelta};
  let status,label,text;
  if(e1rmDelta>previous.bestE1rm*T.e1rmPct){status="improved";label="Improved";text="Beat last session."}
  else if(Math.abs(loadDelta)<.01&&repsDelta>0){status="improved";label="Improved";text="Beat last session."}
  else if(volumeDelta>previous.totalVolume*T.volumePct&&avgRirDelta<=T.rir){status="improved";label="Improved";text="Beat last session."}
  else if(Math.abs(e1rmDelta)<=previous.bestE1rm*T.e1rmPct&&repsDelta===0&&Math.abs(volumeDelta)<=previous.totalVolume*T.volumePct){status="flat";label="Flat";text="Matched last session."}
  else if(e1rmDelta<0&&repsDelta<0){status="regressed";label="Regressed";text="Down from last session."}
  else{status="changed_load";label="Changed load";text="Different load — not directly comparable."}
  return{status,label,text,metrics:{current,previous,deltas}}}
function compareExerciseSession(ex,currentRows){const cur=workingRows(currentRows);
  if(!cur.length)return{status:"not_comparable",label:"Not comparable",text:"No working sets logged.",metrics:null};
  const prev=previousSessionForExercise(ex,cur[0]?.session);
  if(!prev.length)return{status:"new",label:"New",text:"No previous session for this lift.",metrics:null};
  return buildSessionDelta(prev,cur)}
function formatDelta(delta){if(!delta?.metrics)return"";const{deltas}=delta.metrics,{loadDelta,repsDelta,e1rmDelta}=deltas;
  if(Math.abs(loadDelta)<.01&&repsDelta!==0){const s=repsDelta>0?"+":"";return`${s}${repsDelta} reps at same load`}
  if(Math.abs(e1rmDelta)>=.01){const s=e1rmDelta>0?"+":"";return`${s}${Math.round(e1rmDelta)}kg e1RM`}
  const parts=[];if(repsDelta!==0)parts.push(`${repsDelta>0?"+":""}${repsDelta} reps`);if(Math.abs(e1rmDelta)>=.01)parts.push(`e1RM ${e1rmDelta>0?"+":""}${Math.round(e1rmDelta)}kg`);
  return parts.length?`vs last: ${parts.join(" · ")}`:""}
// Stalled = 3+ recent sessions at the same working load with no gain in top-set reps.
function isStalled(sess){if(sess.length<3)return false;const r=sess.slice(-3),l0=r[0].med,rep0=r[0].maxReps;
  return r.every(s=>Math.abs(s.med-l0)<0.01)&&r.every(s=>s.maxReps<=rep0)}
function round(v){const raw=+state.settings.minJump;const inc=Number.isFinite(raw)&&raw>0?raw:2.5;return Math.round(v/inc)*inc}
function jump(load,mult){return Math.max(load*(+state.settings.jumpPct||0)*mult/100,+state.settings.minJump||2.5)}
function lastBodyweight(){const rows=state.log.filter(r=>+r.bodyweight>0);
  if(!rows.length)return "";const latest=rows.sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0];
  return fmt(toDisplay(latest.bodyweight))}
function updateBodyweightField(){const el=$("#bodyweight");if(!el)return;
  el.placeholder=unitLabel();const lbl=$("#bodyweightLabel");
  if(lbl){for(const n of [...lbl.childNodes])if(n.nodeType===3)n.remove();
    lbl.insertBefore(document.createTextNode(`Bodyweight (${unitLabel()}, optional) `),el)}}
function focusList(){return exercises().filter(e=>!skipped.has(e.id))}
function setLogMode(m){logMode=m;focusIndex=0;$("#modeFull").classList.toggle("active",m==="full");$("#modeFocus").classList.toggle("active",m==="focus");renderWorkout()}

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
const PLAIN={add2:"Translation: it was easy and you hit the top reps — add weight.",
  add:"Translation: you hit the top of every set — add a little weight next time.",
  reduce:"Translation: this was too heavy to stay in range — drop the weight and rebuild.",
  hold:"Translation: keep this weight and try for one more rep next time.",
  new:"Translation: first time logging this — pick a weight you can control for the reps shown."};

function fmtClock(s){const m=Math.floor(s/60);return `${m}:${String(s%60).padStart(2,"0")}`}
function stopRest(){if(restTick){clearInterval(restTick);restTick=null}restEnd=0;const b=$("#restBar");if(b){b.classList.add("hidden");b.classList.remove("is-done")}}
function tickRest(){const b=$("#restBar");if(!b)return;const left=Math.round((restEnd-Date.now())/1000);
  if(left<=0){b.querySelector(".restbar__time").textContent="0:00";b.classList.add("is-done");clearInterval(restTick);restTick=null;return}
  b.querySelector(".restbar__time").textContent=fmtClock(left)}
function startRest(sec){const s=sec||+state.settings.restSec||0;if(s<=0)return;
  restEnd=Date.now()+s*1000;const b=$("#restBar");if(!b)return;b.classList.remove("hidden","is-done");
  b.querySelector(".restbar__time").textContent=fmtClock(s);clearInterval(restTick);restTick=setInterval(tickRest,250)}

function render(){renderTabs();renderWorkout();renderStats();renderHistory();renderProgram();renderSettings()}

function renderTabs(){const ds=days();if(!ds.includes(day))day=ds[0]||"Day 1";
  $("#dayTabs").innerHTML=ds.map(d=>`<button type="button" role="tab" aria-selected="${d===day?"true":"false"}" class="${d===day?"active":""}" data-day="${esc(d)}">${esc(d)}</button>`).join("");
  $$("#dayTabs button").forEach(b=>b.onclick=()=>{day=b.dataset.day;renderTabs();renderWorkout()})}

function renderWorkout(){
  const lc=$("#logContext");if(lc){const nm=state.programMeta?.name,wk=programWeek();
    lc.textContent=nm||wk?`${nm||"Untitled program"}${wk?` · Week ${wk}`:""}`:"Today's session"}
  const draft=loadDraft();
  committed.clear();(draft.__done||[]).forEach(k=>committed.add(k));
  touched.clear();(draft.__touched||[]).forEach(k=>touched.add(k));
  warmups.clear();(draft.__warm||[]).forEach(k=>warmups.add(k));
  const effortMode=state.settings.rirMode==="effort";
  const restOn=+state.settings.restSec>0;
  const hiddenCount=exercises().filter(e=>skipped.has(e.id)).length;
  const banner=hiddenCount?`<div class="skipbar">${hiddenCount} hidden today <button type="button" class="skipbar__show">Show all</button></div>`:"";
  const fl=focusList();
  if(logMode==="focus"&&fl.length)focusIndex=Math.min(focusIndex,fl.length-1);
  const curId=logMode==="focus"&&fl.length?fl[focusIndex]?.id:null;
  const wk=$("#workout");wk.classList.toggle("is-focus",logMode==="focus");
  wk.innerHTML=banner+exercises().map(ex=>{
    const r=recommendation(ex),prev=last(ex);
    const prevHtml=prev.length?`<div class="prev"><span>Last:</span>${prev.map(x=>`${fmtLoad(x.load)}×${x.reps}<small>@${fmt(x.rir)}</small>`).join(" ")}<button type="button" class="copylast" data-copy="${esc(ex.id)}">Copy</button></div>`:"";
    const rows=Array.from({length:ex.sets},(_,i)=>{const n=i+1,old=prev.find(x=>x.set===n);
      const draftKg=draft[`${ex.id}_${n}_load`];
      const kgVal=draftKg!=null?draftKg:(r.load!=null?fmtLoad(r.load):(old&&old.load!=null?fmtLoad(old.load):""));
      const repsVal=draft[`${ex.id}_${n}_reps`]??(old&&old.reps!=null?old.reps:ex.min);
      const key=`${ex.id}_${n}`;
      const isW=warmups.has(key);
      const cls=`${committed.has(key)?"is-done":(touched.has(key)?"":"is-suggested")}${isW?" is-warmup":""}`;
      const effortVal=draft[`${key}_effort`]||(old&&old.rir!=null?(old.rir>=2.5?"easy":old.rir<=0.5?"max":"hard"):"hard");
      const rirVal=draft[`${key}_rir`]??(old&&old.rir!=null?fmt(old.rir):1);
      const rirCell=effortMode
        ?`<div class="effort" role="group" aria-label="Set ${n} effort">`+
          ["easy","hard","max"].map(e=>`<button type="button" class="effort__btn${effortVal===e?" active":""}" data-eff="${esc(key)}" data-e="${e}">${e==="easy"?"Easy":e==="hard"?"Hard":"Max"}</button>`).join("")+`</div>`
        :`<input data-k="${ex.id}_${n}_rir" type="number" step="0.5" min="0" inputmode="decimal" aria-label="Set ${n} RIR" value="${esc(rirVal)}">`;
      return `<div class="setrow ${cls}" data-set="${esc(key)}"><button type="button" class="setrow__n" data-warm="${esc(key)}" aria-pressed="${isW?"true":"false"}" title="Tap to mark as warmup">${isW?"W":n}</button>`+
        `<div class="kg"><button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="-1" tabindex="-1" aria-label="Set ${n} decrease ${unitLabel()}">−</button>`+
        `<input data-k="${ex.id}_${n}_load" type="number" step="any" min="0" inputmode="decimal" aria-label="Set ${n} ${unitLabel()}" placeholder="${unitLabel()}" value="${esc(kgVal)}">`+
        `<button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="1" tabindex="-1" aria-label="Set ${n} increase ${unitLabel()}">+</button></div>`+
        `<input data-k="${ex.id}_${n}_reps" type="number" step="1" min="0" inputmode="numeric" aria-label="Set ${n} reps" value="${esc(repsVal)}">`+
        rirCell+
        `<button type="button" class="saveset" data-save="${esc(key)}" aria-label="Save set ${n}">${committed.has(key)?"✓":"Save"}</button></div>`;
    }).join("");
    const perf=substituted.get(ex.id);
    const nameHtml=perf?`${esc(perf)} <span class="ex__subfor">(for ${esc(ex.name)})</span>`:esc(ex.name);
    const subPick=ex.alternates?.length?`<div class="subst"><span class="subst__lab">Use:</span><select class="subst__pick" data-sub="${esc(ex.id)}" aria-label="Substitute for ${esc(ex.name)}">`+
      `<option value=""${!perf?" selected":""}>${esc(ex.name)}</option>`+
      ex.alternates.map(a=>`<option value="${esc(a)}"${perf===a?" selected":""}>${esc(a)}</option>`).join("")+
      `<option value="__other__"${perf&&!ex.alternates.includes(perf)&&perf!==ex.name?" selected":""}>Other…</option></select></div>`:"";
    return `<article class="exercise is-${r.status}${collapsed.has(ex.id)?" is-collapsed":""}${skipped.has(ex.id)?" is-skipped":""}${logMode==="focus"&&ex.id===curId?" is-current":""}" data-ex="${esc(ex.id)}">`+
      `<div class="ex__top"><div><h3 class="ex__name">${nameHtml}</h3>`+
      `<p class="ex__meta">${ex.sets}×${ex.min}-${ex.max} reps · ${term("RIR")} 0-${fmt(state.settings.rirHigh)}</p></div>`+
      `<div class="ex__topend"><span class="ex__tag">${esc(ex.primary)}</span>`+
      (restOn?`<button type="button" class="ex__rest" data-rest="1" aria-label="Start rest timer">⏱</button>`:"")+
      `<button type="button" class="ex__skip" data-skip="${esc(ex.id)}" aria-label="Skip ${esc(ex.name)} today">Skip</button>`+
      `<button type="button" class="ex__caret" data-collapse="${esc(ex.id)}" aria-label="Toggle ${esc(ex.name)} sets">▾</button></div></div>`+
      `<div class="heat"><span class="heat__track"><span class="heat__fill" style="width:${Math.round(r.heat*100)}%"></span></span>`+
      `<span class="chip">${esc(r.label)}</span></div>`+
      `<p class="rec">${esc(r.text)}${r.load!==null?` Target <b>${fmtLoad(r.load)} ${unitLabel()}</b>.`:""}</p>`+
      `<p class="rec__plain">${esc(PLAIN[r.status]||"")}</p>`+
      (ex.notes?`<p class="setup"><span>Setup</span>${esc(ex.notes)}</p>`:"")+
      subPick+
      prevHtml+
      `<div class="sets__head"><span>Set</span><span>${unitLabel()}</span><span>reps</span><span>${effortMode?"Effort":"RIR"}</span><span></span></div>${rows}</article>`;
  }).join("");
  bindWorkout();
  updateGauge();updateSaveMeta();renderFatigue();
  updateBodyweightField();
}

function saveDraft(){const d={};$$("#workout input").forEach(x=>d[x.dataset.k]=x.value);
  $$("#workout .effort__btn.active").forEach(b=>d[`${b.dataset.eff}_effort`]=b.dataset.e);
  d.__done=[...committed];d.__touched=[...touched];d.__warm=[...warmups];localStorage.setItem(DRAFT,JSON.stringify(d))}

function bindWorkout(){
  $$("#workout input").forEach(i=>{i.oninput=()=>{const row=i.closest(".setrow");
    if(row&&row.dataset.set){touched.add(row.dataset.set);row.classList.remove("is-suggested")}
    saveDraft();updateSaveMeta()};
  i.onfocus=()=>i.select()});
  $$("#workout .term").forEach(b=>b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)});
  $$("#workout .saveset").forEach(b=>b.onclick=()=>{const key=b.dataset.save;
    const load=+($(`[data-k="${key}_load"]`)?.value)||0;
    if(load<=0){toast("Enter a weight before saving the set.");return}
    const row=b.closest(".setrow");
    if(committed.has(key)){committed.delete(key)}
    else{committed.add(key);touched.add(key)}
    if(row){row.classList.toggle("is-done",committed.has(key));row.classList.remove("is-suggested");
      b.textContent=committed.has(key)?"✓":"Save"}
    saveDraft();updateSaveMeta();
    if(committed.has(key))startRest()});
  $$("#workout [data-warm]").forEach(b=>b.onclick=()=>{const key=b.dataset.warm;
    warmups.has(key)?warmups.delete(key):warmups.add(key);saveDraft();renderWorkout()});
  $$("#workout .stepbtn").forEach(b=>b.onclick=()=>{const inp=$(`[data-k="${b.dataset.step}"]`);if(!inp)return;
    const incKg=+state.settings.minJump||2.5,curKg=fromDisplay(+inp.value||0),
      nextKg=Math.max(0,Math.round((curKg+incKg*(+b.dataset.dir))/incKg)*incKg);
    inp.value=fmt(toDisplay(nextKg));
    const row=inp.closest(".setrow");
    if(row&&row.dataset.set){touched.add(row.dataset.set);row.classList.remove("is-suggested")}
    saveDraft();updateSaveMeta()});
  $$("#workout .copylast").forEach(b=>b.onclick=()=>{const prevSets=last({id:b.dataset.copy});if(!prevSets.length)return;
    const d=loadDraft();
    for(const s of prevSets){const key=`${b.dataset.copy}_${s.set}`;touched.add(key);
      if(state.settings.rirMode==="effort")d[`${key}_effort`]=+s.rir>=2.5?"easy":+s.rir<=0.5?"max":"hard";
      for(const f of ["load","reps"]){const inp=$(`[data-k="${key}_${f}"]`);if(inp)inp.value=f==="load"?fmt(toDisplay(s.load)):fmt(s[f])}
      if(state.settings.rirMode!=="effort"){const inp=$(`[data-k="${key}_rir"]`);if(inp)inp.value=fmt(s.rir)}}
    localStorage.setItem(DRAFT,JSON.stringify(d));saveDraft();renderWorkout();toast("Filled from last session.")});
  $$("#workout .ex__rest").forEach(b=>b.onclick=()=>startRest());
  $$("#workout .ex__skip").forEach(b=>b.onclick=()=>{const id=b.dataset.skip;
    skipped.has(id)?skipped.delete(id):skipped.add(id);
    if(logMode==="focus"){const fl=focusList();focusIndex=Math.min(focusIndex,Math.max(0,fl.length-1))}
    renderWorkout()});
  $$("#workout .subst__pick").forEach(sel=>{sel.onchange=()=>{const id=sel.dataset.sub;
    if(sel.value==="__other__"){const v=prompt("Alternate exercise name (max 80 chars):",substituted.get(id)||"");
      if(v==null){renderWorkout();return}
      const t=String(v).trim().slice(0,80);
      if(!t||t===prog.find(id)?.name){substituted.delete(id)}else{substituted.set(id,t)}
    }else if(!sel.value){substituted.delete(id)}else{substituted.set(id,sel.value)}
    renderWorkout()}});
  $$("#workout .effort__btn").forEach(b=>b.onclick=()=>{const key=b.dataset.eff;
    b.closest(".effort")?.querySelectorAll(".effort__btn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");touched.add(key);
    const row=b.closest(".setrow");if(row)row.classList.remove("is-suggested");
    saveDraft();updateSaveMeta()});
  const sb=$("#workout .skipbar__show");if(sb)sb.onclick=()=>{skipped.clear();renderWorkout()};
  $$("#workout .ex__caret").forEach(b=>b.onclick=()=>{const id=b.dataset.collapse,art=b.closest(".exercise");if(!art)return;
    const now=!collapsed.has(id);now?collapsed.add(id):collapsed.delete(id);art.classList.toggle("is-collapsed",now)});
  if(logMode==="focus"){const fl=focusList();const at=fl.length?Math.min(focusIndex,fl.length-1):0;
    const bar=document.createElement("div");bar.className="focusbar";
    bar.innerHTML=`<button type="button" class="btn btn--steel" data-fprev ${at===0?"disabled":""}>Prev</button>`+
      `<span class="focusbar__prog">${fl.length?at+1:0} of ${fl.length}</span>`+
      (fl.length&&at>=fl.length-1?`<button type="button" class="btn btn--forge" data-ffinish>Finish workout</button>`:`<button type="button" class="btn btn--forge" data-fnext>Next</button>`);
    $("#workout").append(bar);
    const p=$("[data-fprev]");if(p)p.onclick=()=>{focusIndex=Math.max(0,focusIndex-1);renderWorkout()};
    const n=$("[data-fnext]");if(n)n.onclick=()=>{focusIndex=Math.min(fl.length-1,focusIndex+1);renderWorkout();window.scrollTo({top:0})};
    const f=$("[data-ffinish]");if(f)f.onclick=()=>$("#logForm").requestSubmit()}
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
  if(exs.length>=3&&flagged>=2){el.className="fatigue";el.innerHTML=`<b>Fatigue watch</b> — ${flagged} lifts are backing off or stalled today. `+
    `<button type="button" class="fatigue__trim">Trim to essentials</button>`;
    $("#fatigue .fatigue__trim").onclick=()=>{skipped.clear();
      for(const e of exs){const s=recommendation(e).status;if(!(s==="add"||s==="add2"))skipped.add(e.id)}
      renderWorkout();toast("Trimmed to your priority lifts. Skip individually to adjust.")}}
  else el.className="fatigue hidden",el.innerHTML="";}

function updateSaveMeta(){const exs=exercises(),planned=sum(exs.map(e=>e.sets));
  const done=[...committed].length;
  const entered=$$("#workout input").filter(i=>i.dataset.k&&i.dataset.k.endsWith("_load")&&+i.value>0).length;
  $("#saveMeta").textContent=done?`${day} · ${done}/${planned} sets done`:(entered?`${day} · ${entered}/${planned} entered`:`${day} · ${planned} sets`);}

function saveWorkout(e){e.preventDefault();if(saving)return;saving=true;
  try{const date=$("#date").value||today(),session=`${date}_${day}_${uid()}`,notes=$("#notes").value.trim(),created=new Date().toISOString(),rows=[];
  const bwRaw=$("#bodyweight").value,bw=bwRaw===""||bwRaw==null?0:posNum(fromDisplay(bwRaw));
  for(const ex of exercises()){if(skipped.has(ex.id))continue;for(let n=1;n<=ex.sets;n++){
    const key=`${ex.id}_${n}`;
    const load=posNum(fromDisplay($(`[data-k="${ex.id}_${n}_load"]`).value)),reps=posNum($(`[data-k="${ex.id}_${n}_reps"]`).value);
    let rir;
    if(state.settings.rirMode==="effort"){
      const draft=loadDraft(),eff=draft[`${key}_effort`]||$(`.effort__btn.active[data-eff="${key}"]`)?.dataset.e||"hard";
      rir=EFFORT_RIR[eff]??1}else{rir=posNum($(`[data-k="${ex.id}_${n}_rir"]`).value)}
    if(load<=0)continue;
    if(!(committed.has(key)||touched.has(key)||warmups.has(key)))continue;
    const row={session,date,day,name:ex.name,exerciseId:ex.id,set:n,load,reps,rir,notes,created,primary:ex.primary,secondary:ex.secondary};
    if(substituted.has(ex.id))row.performedName=substituted.get(ex.id);
    if(warmups.has(key))row.warmup=true;
    if(bw>0)row.bodyweight=bw;
    rows.push(row)}}
  if(!rows.length){toast("Enter weight on at least one set before saving.");return}
  const prLifts=[];
  for(const ex of exercises()){if(skipped.has(ex.id))continue;
    const mine=rows.filter(r=>r.exerciseId===ex.id&&!r.warmup);if(!mine.length)continue;
    const newTop=Math.max(...mine.map(r=>+r.load));
    const match=matchLift(ex);
    const prevTop=Math.max(0,...state.log.filter(x=>match(x)&&isWork(x)).map(r=>+r.load));
    if(newTop>prevTop&&prevTop>0)prLifts.push(`${ex.name} ${fmtLoad(newTop)} ${unitLabel()}`)}
  state.log.push(...rows);save();clearDraft();committed.clear();touched.clear();warmups.clear();substituted.clear();$("#notes").value="";
  const btn=$(".btn--save");btn.classList.remove("is-stamped");void btn.offsetWidth;btn.classList.add("is-stamped");
  toast(prLifts.length?`Workout forged — ${rows.length} sets logged. PR: ${prLifts.join(", ")}!`:`Workout forged — ${rows.length} sets logged.`);render()}finally{saving=false}}

function summaries(){const m=new Map();
  for(const x of state.log){if(!isWork(x))continue;const k=`${x.session}|${liftKey(x)}`;if(!m.has(k))m.set(k,{session:x.session,date:x.date,day:x.day,liftKey:liftKey(x),name:displayName(x),loads:[],reps:[],rirs:[],sets:0});
    const o=m.get(k);o.loads.push(+x.load);o.reps.push(+x.reps);o.rirs.push(+x.rir);o.sets++}
  return [...m.values()].map(o=>{let top=0,topReps=0,vol=0,best=0;
    o.loads.forEach((ld,i)=>{const rp=o.reps[i];vol+=ld*rp;const e=e1rm(ld,rp);if(e>best)best=e;if(ld>top){top=ld;topReps=rp}});
    return{session:o.session,date:o.date,day:o.day,liftKey:o.liftKey,name:o.name,top,topReps,reps:sum(o.reps),rir:avg(o.rirs),sets:o.sets,volume:vol,e1rm:best};})
    .sort((a,b)=>a.date.localeCompare(b.date)||a.session.localeCompare(b.session))}

function renderStats(){
  // Stat exercise options: label shows performed name when set; value is liftKey for exerciseId-backed roll-up.
  const keys=[...new Set(state.log.filter(isWork).map(liftKey))].sort();
  const keyLabel=k=>{const rows=state.log.filter(r=>liftKey(r)===k);
    const latest=[...rows].sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0];
    return latest?displayName(latest):k};
  const sums=summaries();
  const totalVol=sum(state.log.filter(isWork).map(x=>(+x.load||0)*(+x.reps||0)));
  const bestE=state.log.length?Math.max(...state.log.filter(isWork).map(x=>e1rm(+x.load,+x.reps))):0;
  const tiles=[
    {label:"Sessions",val:new Set(state.log.map(x=>x.session)).size},
    {label:"Sets logged",val:state.log.length},
    {label:"Volume",val:kfmt(toDisplay(totalVol)),unit:unitLabel()},
    {label:"Best e1RM",val:fmt(Math.round(toDisplay(bestE))),unit:unitLabel(),hot:bestE>0},
  ];
  $("#metrics").innerHTML=tiles.map(t=>`<div class="metric${t.hot?" metric--hot":""}"><div class="metric__label">${t.label}</div><div class="metric__val">${t.val}${t.unit?`<small>${t.unit}</small>`:""}</div></div>`).join("");

  const old=$("#statExercise").value;
  $("#statExercise").innerHTML=keys.map(k=>`<option value="${esc(k)}">${esc(keyLabel(k))}</option>`).join("")||"<option>No data</option>";
  if(keys.includes(old))$("#statExercise").value=old;
  else if(keys.length)$("#statExercise").value=keys[0];
  const sel=$("#statExercise").value,rows=sums.filter(x=>x.liftKey===sel);
  draw(rows);

  if(rows.length){const first=rows[0].top,latest=rows.at(-1).top,delta=latest-first,be=Math.max(...rows.map(r=>r.e1rm));
    const dir=delta>0?"up":delta<0?"down":"";const arrow=delta>0?"▲":delta<0?"▼":"·";
    $("#trend").innerHTML=`<span>Top load <b>${fmtLoad(first)}→${fmtLoad(latest)} ${unitLabel()}</b></span>`+
      `<span class="${dir}">${arrow} ${fmt(toDisplay(Math.abs(delta)))} ${unitLabel()} over ${rows.length} session${rows.length>1?"s":""}</span>`+
      `<span>Best e1RM <b>${fmt(Math.round(toDisplay(be)))} ${unitLabel()}</b></span>`;
  }else $("#trend").innerHTML="";

  $("#recent").innerHTML=table(rows.slice(-8).reverse().map(x=>({Date:x.date,Top:fmtLoad(x.top),Reps:x.reps,RIR:fmt(x.rir),e1RM:fmt(Math.round(toDisplay(x.e1rm))),Vol:kfmt(toDisplay(x.volume))})));
  const topByLift=new Map();
  for(const x of state.log){if(!isWork(x))continue;const k=liftKey(x),ld=+x.load,cur=topByLift.get(k);
    if(!cur||ld>cur.load||(ld===cur.load&&+x.reps>+cur.reps))topByLift.set(k,{Exercise:displayName(x),load:ld,reps:x.reps,rir:x.rir,date:x.date})}
  const progRows=[...topByLift.values()].sort((a,b)=>b.load-a.load||b.reps-a.reps).map(r=>({Exercise:r.Exercise,[unitLabel()]:fmtLoad(r.load),Reps:r.reps,RIR:fmt(r.rir),Date:r.date}));
  $("#tops").innerHTML=table(progRows);
  renderPRs();renderAttention();renderCompleted();
}

function detectPRs(log,opts={}){
  const rows=(Array.isArray(log)?log:[]).filter(isWork).filter(r=>+r.load>0)
    .sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.created).localeCompare(String(b.created)));
  const best=new Map(),events=[];
  for(const row of rows){const k=liftKey(row),ld=+row.load,rp=+row.reps,em=e1rm(ld,rp);
    const cur=best.get(k)||{load:0,repsAtMax:0,e1rm:0};
    if(ld>cur.load){events.push({kind:"load",date:row.date,load:ld,reps:rp,rir:row.rir,exerciseName:displayName(row),exerciseId:row.exerciseId,deltaLoad:cur.load>0?ld-cur.load:undefined});
      cur.load=ld;cur.repsAtMax=rp}
    else if(ld===cur.load&&rp>cur.repsAtMax){events.push({kind:"reps",date:row.date,load:ld,reps:rp,rir:row.rir,exerciseName:displayName(row),exerciseId:row.exerciseId,deltaReps:rp-cur.repsAtMax});
      cur.repsAtMax=rp}
    if(em>cur.e1rm){events.push({kind:"e1rm",date:row.date,load:ld,reps:rp,rir:row.rir,exerciseName:displayName(row),exerciseId:row.exerciseId,deltaE1rm:cur.e1rm>0?em-cur.e1rm:undefined});
      cur.e1rm=em}
    best.set(k,cur)}
  return events}
window.detectPRs=detectPRs;
window.__repforgeGenerateProgram=generateProgramFromOnboarding;
window.__repforgeTestDeltas=(prevRows,currentRows)=>buildSessionDelta(prevRows,currentRows);
window.__repforgeCompareExercise=(ex,currentRows)=>compareExerciseSession(ex,currentRows);

function renderPRs(){const el=$("#prLedger");if(!el)return;
  const sel=$("#statExercise").value,events=detectPRs(state.log).filter(ev=>(ev.exerciseId||ev.exerciseName)===sel);
  if(!events.length){el.innerHTML=`<div class="empty">Log working sets to track PRs.</div>`;return}
  el.innerHTML=`<table><thead><tr><th>Date</th><th>Kind</th><th>Load</th><th>Reps</th><th>RIR</th><th>e1RM</th><th>Δ vs prev</th></tr></thead><tbody>${
    events.map(ev=>{const kindCls=ev.kind==="load"?"pr-kind--load":ev.kind==="reps"?"pr-kind--reps":"pr-kind--e1rm";
      const kindLabel=ev.kind==="e1rm"?"e1RM":ev.kind.charAt(0).toUpperCase()+ev.kind.slice(1);
      const delta=ev.kind==="e1rm"?(ev.deltaE1rm!=null?`+${fmt(Math.round(toDisplay(ev.deltaE1rm)))}`:"—")
        :ev.kind==="reps"?(ev.deltaReps!=null?`+${ev.deltaReps}`:"—")
        :(ev.deltaLoad!=null?`+${fmtLoad(ev.deltaLoad)}`:"—");
      return `<tr class="pr-row"><td>${esc(ev.date)}</td><td><span class="pr-kind ${kindCls}">${esc(kindLabel)}</span></td>`+
        `<td>${esc(fmtLoad(ev.load))}</td><td>${esc(ev.reps)}</td><td>${esc(fmt(ev.rir))}</td>`+
        `<td>${esc(fmt(Math.round(toDisplay(e1rm(ev.load,ev.reps)))))}</td><td>${esc(delta)}</td></tr>`}).join("")
  }</tbody></table>`}

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
  $$("#attention [data-attn]").forEach(b=>b.onclick=()=>{const ex=prog.exercises.find(e=>e.name===b.dataset.attn),k=ex?.id||b.dataset.attn;
    const has=[...$("#statExercise").options].some(o=>o.value===k);
    if(has){$("#statsDeep").open=true;$("#statExercise").value=k;renderStats();redrawChart();$("#chart").scrollIntoView({behavior:"smooth",block:"center"})}else toast("Log this lift to chart it.")});}

// Completed hard sets per muscle over a rolling window (load>0, reps>0, RIR within hardRir).
function completedHardSets(windowDays){const cutoff=daysAgo(windowDays-1),hr=+state.settings.hardRir,m=new Map();
  for(const x of state.log){if(String(x.date)<cutoff)continue;if(!(+x.load>0&&+x.reps>0&&+x.rir<=hr)||!isWork(x))continue;
    const mus=rowMuscles(x);
    for(const p of muscles(mus.primary))addVol(m,p,1,0);
    for(const s of muscles(mus.secondary))addVol(m,s,0,.5)}
  return m}
function renderCompleted(){const el=$("#completedVolume");if(!el)return;const m=completedHardSets(volWindow);
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
  for(let i=0;i<=3;i++){const gy=padT+ih*i/3,val=hi-(rng*i/3);ctx.beginPath();ctx.moveTo(padL,gy);ctx.lineTo(w-padR,gy);ctx.stroke();ctx.fillText(fmt(Math.round(toDisplay(val))),padL-8,gy)}
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
  ctx.fillText(`${fmtLoad(rows.at(-1).top)}${unitLabel()}`,lx+(lx>w-60?-10:9),ly-12);
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
    const sets=state.log.filter(r=>r.session===s.session).sort((a,b)=>String(displayName(a)).localeCompare(String(displayName(b)))||a.set-b.set);
    if(s.session===editSession)return sessionEditor(s,sets);
    const top=sets.filter(isWork).reduce((m,x)=>{const ld=+x.load,rp=+x.reps;return ld>m.load||(ld===m.load&&rp>m.reps)?{load:ld,reps:rp}:m},{load:0,reps:0});
    const vol=sum(sets.filter(isWork).map(x=>(+x.load||0)*(+x.reps||0)));
    return `<div class="session"><div class="session__info"><div class="session__day">${esc(s.day)}</div>`+
      `<div class="session__sub">${esc(s.date)} · ${sets.length} sets · <span class="session__stat">${fmtLoad(top.load)}×${top.reps}</span> top · ${kfmt(toDisplay(vol))} ${unitLabel()}</div></div>`+
      `<div class="session__btns"><button class="session__edit" data-edit="${esc(s.session)}">Edit</button>`+
      `<button class="session__del" data-del="${esc(s.session)}">Delete</button></div></div>`;
  }).join(""):`<div class="table"><div class="empty">No sessions yet. Forge your first on the Log tab.</div></div>`;
  $$("[data-del]").forEach(b=>b.onclick=()=>{if(confirm("Delete this session? This cannot be undone.")){state.log=state.log.filter(x=>x.session!==b.dataset.del);if(editSession===b.dataset.del)editSession=null;save();render();toast("Session deleted.")}});
  $$("[data-edit]").forEach(b=>b.onclick=()=>{editSession=b.dataset.edit;renderHistory()});
  $$("[data-edcancel]").forEach(b=>b.onclick=()=>{editSession=null;renderHistory()});
  $$("[data-edsave]").forEach(b=>b.onclick=()=>saveSessionEdit(b.dataset.edsave));
  const rows=[...state.log].sort((a,b)=>b.date.localeCompare(a.date)||displayName(a).localeCompare(displayName(b))||a.set-b.set).map(x=>({Date:x.date,Day:x.day,Exercise:displayName(x),Set:x.warmup?"W"+x.set:x.set,[unitLabel()]:fmtLoad(x.load),Reps:x.reps,RIR:fmt(x.rir)}));
  $("#historyTable").innerHTML=table(rows);
}

function sessionEditor(s,sets){
  const rows=sets.map(r=>{const key=`${liftKey(r)}|${r.set}`;
    return `<div class="edrow"><span class="edrow__name">${esc(displayName(r))} <small>#${r.set}</small></span>`+
      `<input class="edrow__in" data-ek="load|${esc(key)}" type="number" step="any" min="0" inputmode="decimal" value="${esc(fmtLoad(r.load))}" aria-label="${esc(displayName(r))} set ${r.set} ${unitLabel()}">`+
      `<input class="edrow__in" data-ek="reps|${esc(key)}" type="number" step="1" min="0" inputmode="numeric" value="${esc(r.reps)}" aria-label="${esc(displayName(r))} set ${r.set} reps">`+
      `<input class="edrow__in" data-ek="rir|${esc(key)}" type="number" step="0.5" min="0" inputmode="decimal" value="${esc(fmt(r.rir))}" aria-label="${esc(displayName(r))} set ${r.set} RIR"></div>`}).join("");
  return `<div class="session session--edit" data-editing="${esc(s.session)}">`+
    `<div class="edhead"><div class="session__day">${esc(s.day)}</div>`+
    `<label class="edate">Date<input data-ed="date" type="date" value="${esc(s.date)}"></label></div>`+
    `<div class="edrow edrow--head"><span>Set</span><span>${unitLabel()}</span><span>reps</span><span>RIR</span></div>`+rows+
    `<div class="edbtns"><button type="button" class="btn btn--steel" data-edcancel="1">Cancel</button>`+
    `<button type="button" class="btn btn--forge" data-edsave="${esc(s.session)}">Save changes</button></div></div>`;
}

function saveSessionEdit(sid){const card=$(`.session--edit[data-editing="${sid}"]`);if(!card)return;
  const newDate=card.querySelector('[data-ed="date"]').value||"",vals={};
  card.querySelectorAll("[data-ek]").forEach(inp=>vals[inp.dataset.ek]=inp.value);
  for(const r of state.log){if(r.session!==sid)continue;const key=`${liftKey(r)}|${r.set}`;
    if(`load|${key}`in vals)r.load=posNum(fromDisplay(vals[`load|${key}`]));
    if(`reps|${key}`in vals)r.reps=posNum(vals[`reps|${key}`]);
    if(`rir|${key}`in vals)r.rir=posNum(vals[`rir|${key}`]);
    if(newDate)r.date=newDate}
  state.log=state.log.filter(r=>r.session!==sid||+r.load>0);
  editSession=null;save();render();toast("Session updated.");}

function renderProgram(){renderProgramHeader();renderProgramEditor();renderVolume()}

function renderProgramChips(){
  const top=$("#pmetaChipsTop"),bottom=$("#pmetaChipsBottom");if(!top||!bottom)return;
  const ad=programAdherence(),week=programWeek(),health=programProgressionHealth(),vol=programVolumeCompliance();
  const status=programStatusLabel(ad,health);
  const weekChip=week?`<span class="pmeta__chip">Week ${week}</span>`:"";
  const healthChip=health?`<span class="pmeta__chip">${health.hot}/${health.total} ready to add</span>`:"";
  const volChip=vol?`<span class="pmeta__chip">${Math.round(vol.ratio*100)}% volume (7d)</span>`:"";
  top.innerHTML=`${weekChip}<span class="pmeta__chip pmeta__chip--status">${esc(status)}</span>`;
  bottom.innerHTML=`<span class="pmeta__chip">${ad.logged} / ${ad.total} days this week</span>${healthChip}${volChip}`;
}

function renderProgramHeader(){
  const el=$("#programMeta");if(!el)return;
  if(document.activeElement?.closest("#programMeta"))return;
  const meta=state.programMeta||defaultProgramMeta(state.log);
  el.innerHTML=
    `<div class="pmeta__row">`+
      `<label class="pmeta__name">Program name<input id="programName" type="text" value="${esc(meta.name)}" placeholder="Untitled program" aria-label="Program name"></label>`+
      `<div id="pmetaChipsTop" class="pmeta__chips"></div>`+
    `</div>`+
    `<div class="pmeta__row">`+
      `<label class="pmeta__started">Started<input id="programStarted" type="date" value="${esc(meta.started||"")}" aria-label="Program start date"></label>`+
      `<div id="pmetaChipsBottom" class="pmeta__chips"></div>`+
    `</div>`;
  renderProgramChips();
  const nameInp=$("#programName"),startInp=$("#programStarted");
  nameInp.oninput=()=>persistProgramMeta({name:nameInp.value});
  startInp.onchange=()=>{persistProgramMeta({started:startInp.value||null});renderProgramChips()};
}

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
    `<label class="pex__mus">Approved alternates (comma-separated)<input data-id="${esc(e.id)}" data-field="alternates" value="${esc((e.alternates||[]).join(", "))}" placeholder="e.g. Leg press, Pendulum squat"></label>`+
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
  $("#restSec").value=state.settings.restSec;$("#unit").value=state.settings.unit;
  $$('input[name="rirMode"]').forEach(r=>{r.checked=r.value===state.settings.rirMode});
  const le=state.settings.lastExport;const ago=le?`Last backup: ${le.slice(0,10)}.`:"Last backup: never.";
  $("#storageNote").textContent=`${ago} Everything lives in this browser under "${KEY}". There is no cloud copy — export before clearing site data or switching phones.`}

function commitSettings(silent){const num=(sel,def,min)=>{const n=+$(sel).value;return Number.isFinite(n)&&n>=min?n:def};
  const oldUnit=state.settings.unit,newUnit=$("#unit").value==="lb"?"lb":"kg";
  const oldRirMode=state.settings.rirMode;
  const newRirMode=$('input[name="rirMode"]:checked')?.value==="effort"?"effort":"numeric";
  if(oldUnit!==newUnit){convertDraftUnits(oldUnit,newUnit);
    const bw=$("#bodyweight");if(bw&&bw.value!==""){const n=+bw.value;if(Number.isFinite(n))bw.value=fmt(toDisplayUnit(fromDisplayUnit(n,oldUnit),newUnit))}}
  if(oldRirMode!==newRirMode)clearDraft();
  state.settings=normalizeSettings({jumpPct:num("#jumpPct",2.5,0),minJump:(()=>{const n=+$("#minJump").value;return Number.isFinite(n)&&n>0?n:2.5})(),rirHigh:num("#rirHigh",2,0),hardRir:num("#hardRir",4,0),restSec:num("#restSec",120,0),lastExport:state.settings.lastExport,unit:newUnit,rirMode:newRirMode});
  save();render();if(!silent)toast("Settings saved.");}

function table(rows){if(!rows.length)return'<div class="empty">No data yet.</div>';const h=Object.keys(rows[0]);
  return`<table><thead><tr>${h.map(x=>`<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${h.map(x=>`<td>${esc(r[x])}</td>`).join("")}</tr>`).join("")}</tbody></table>`}

function exportCsv(){
  const hr=+state.settings.hardRir;
  const cols=[
    ["session",r=>r.session],["date",r=>r.date],["day",r=>r.day],
    ["name",r=>exerciseLabel(r)],["performed_name",r=>r.performedName||""],["exercise_id",r=>r.exerciseId||""],
    ["set",r=>r.set],["load",r=>r.load],["reps",r=>r.reps],["rir",r=>r.rir],
    ["e1rm",r=>+e1rm(+r.load,+r.reps).toFixed(2)],
    ["tonnage",r=>+((+r.load||0)*(+r.reps||0)).toFixed(2)],
    ["primary",r=>rowMuscles(r).primary],["secondary",r=>rowMuscles(r).secondary],
    ["is_hard_set",r=>(+r.load>0&&+r.reps>0&&+r.rir<=hr&&!r.warmup)?1:0],
    ["is_warmup",r=>r.warmup?1:0],
    ["bodyweight",r=>r.bodyweight??""],
    ["notes",r=>r.notes],["created",r=>r.created],
  ];
  const q=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv=[cols.map(c=>c[0]).join(","),
    ...state.log.map(r=>cols.map(c=>q(c[1](r))).join(","))].join("\n");
  download(csv,`repforge_log_${today()}.csv`,"text/csv");
}
function exportJson(){state.settings.lastExport=new Date().toISOString();save();
  const text=JSON.stringify(state,null,2),name=`repforge_backup_${today()}.json`;
  shareOrDownload(text,name,"application/json");renderSettings()}
const fileSlug=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40);
function exportProgram(){const payload={version:2,meta:state.programMeta,exercises:prog.toJSON()};
  const slug=fileSlug(state.programMeta?.name);
  download(JSON.stringify(payload,null,2),`repforge_program_${slug?`${slug}_`:""}${today()}.json`,"application/json")}
async function importProgramFile(e){const f=e.target.files?.[0];if(!f)return;
  try{const parsed=JSON.parse(await f.text()),imp=parseProgramImport(parsed);
    if(!imp?.exercises?.length)throw Error();
    const list=imp.exercises;
    if(!confirm(`Replace your current program with ${list.length} exercises from this file?\n\nYour training log and settings are not touched. The program name comes from the file; your start date stays.`)){e.target.value="";toast("Program import cancelled.");return}
    if(typeof imp.meta?.name==="string"&&imp.meta.name.trim())persistProgramMeta({name:imp.meta.name});
    $("#programJson").value=JSON.stringify(list,null,2);saveProgram()}
  catch{toast("That file isn't a RepForge program export.")}
  e.target.value=""}
async function importJson(e){const f=e.target.files?.[0];if(!f)return;
  try{const s=JSON.parse(await f.text());if(!s.program||!Array.isArray(s.log))throw Error();
    const inSessions=new Set(s.log.map(r=>r.session)).size,inSets=s.log.length;
    const curSessions=new Set(state.log.map(r=>r.session)).size,curSets=state.log.length;
    const have=new Set(state.log.map(r=>r.session));
    const newSessions=new Set(s.log.filter(r=>!have.has(r.session)).map(r=>r.session)).size;
    openImportChoice({s,inSessions,inSets,curSessions,curSets,newSessions})}
  catch{toast("That file isn't a valid RepForge backup.")}
  e.target.value=""}
function openImportChoice(ctx){const d=$("#importChoice");
  $("#importChoiceBody").textContent=
    `This device: ${ctx.curSessions} sessions, ${ctx.curSets} sets.\n`+
    `File: ${ctx.inSessions} sessions, ${ctx.inSets} sets (${ctx.newSessions} new to this device).\n\n`+
    `Merge adds the ${ctx.newSessions} new sessions and keeps everything else. `+
    `Replace all overwrites program, settings, and log — this cannot be undone.`;
  d.classList.remove("hidden");
  const close=()=>{d.classList.add("hidden")};
  $("#importCancel").onclick=()=>{close();toast("Import cancelled.")};
  $("#importReplace").onclick=()=>{close();applyState(ctx.s);clearDraft();day=days()[0]||"Day 1";render();toast(`Imported ${ctx.inSessions} sessions.`)};
  $("#importMerge").onclick=()=>{close();mergeLog(ctx.s)};}
function mergeLog(s){const have=new Set(state.log.map(r=>r.session));
  const rows=s.log.filter(r=>r&&r.session&&!have.has(r.session));
  const added=new Set(rows.map(r=>r.session)).size;
  if(!added){toast("Nothing to merge — this device already has every session in the file.");return}
  state.log.push(...rows);
  migrateLog();save();
  render();toast(`Merged ${added} new session${added===1?"":"s"}.`)}

function switchToBeginnerProgram(){prog=new Program(programBeginner);persistProgram();clearDraft();day=prog.days()[0]||"Day 1";render();toast("Beginner-friendly program loaded. Your log is unchanged.")}

const ONB_SPLITS={2:["full_body","upper_lower"],3:["full_body","machine_only","ppl"],4:["upper_lower","full_body"],
  5:["ppl","bro","upper_lower"],6:["ppl"]};
const ONB_SPLIT_LABEL={full_body:"Full body",upper_lower:"Upper / lower",machine_only:"Machine only",ppl:"Push / pull / legs",bro:"Bro split"};
const ONB_EQ_UI=["machines","cables","dumbbells","barbells","bodyweight"];
const ONB_EQ_LABEL={machines:"Machines",cables:"Cables",dumbbells:"Dumbbells",barbells:"Barbells",bodyweight:"Bodyweight"};
const ONB_EQ_GEN={machines:"machine",cables:"cable",dumbbells:"dumbbell",barbells:"barbell",bodyweight:"bodyweight"};
const ONB_MUSCLES=["Chest","Back","Quads","Hamstrings","Glutes","Side delts","Arms","Calves"];
const ONB_TITLES=["What's your goal?","Training experience","Days per week","Choose a split","Equipment access",
  "Priority muscles (optional)","Session length","Review your program"];
let onbStep=0,onbAnswers={};
function defaultOnbAnswers(){return{goal:null,experience:null,daysPerWeek:null,splitType:null,equipment:["machines","cables"],
  priorityMuscles:[],sessionLength:null}}
function onbGenAnswers(a){const eq=(a.equipment||[]).map(x=>ONB_EQ_GEN[x]||x);
  const goal=a.goal==="strength_hypertrophy"?"strength":a.goal==="beginner_consistency"?"hypertrophy":a.goal||"hypertrophy";
  return{...a,goal,equipment:eq}}
function showOnboardingView(){$("#onboarding").classList.remove("hidden");$("#onboarding").classList.add("active");
  $$(".view").forEach(v=>{if(v.id!=="onboarding")v.classList.remove("active")})}
function closeOnboarding(){$("#onboarding").classList.remove("active");$("#onboarding").classList.add("hidden");
  const log=$("#log");if(log&&!log.classList.contains("active")){
    $$("nav button").forEach(x=>{const on=x.dataset.view==="log";x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    log.classList.add("active")}
  render()}
function startOnboarding(){onbStep=0;onbAnswers=defaultOnbAnswers();showOnboardingView();renderOnboarding()}
function maybeShowOnboarding(){if(!state.programMeta?.onboarded&&state.log.length===0)startOnboarding()}
function onbCanNext(){const a=onbAnswers;
  if(onbStep===0)return!!a.goal;if(onbStep===1)return!!a.experience;if(onbStep===2)return!!a.daysPerWeek;
  if(onbStep===3)return!!a.splitType;if(onbStep===4)return a.equipment?.length>0;if(onbStep===6)return!!a.sessionLength;return true}
function onbPick(key,val,multi){if(multi){const arr=onbAnswers[key]||[];const i=arr.indexOf(val);
  if(i>=0)arr.splice(i,1);else arr.push(val);onbAnswers[key]=arr}else onbAnswers[key]=val;
  if(key==="daysPerWeek"){const opts=ONB_SPLITS[val]||[];if(!opts.includes(onbAnswers.splitType))onbAnswers.splitType=null}
  renderOnboarding()}
function onbOpt(cls,key,val,label,sub,multi){const sel=multi?(onbAnswers[key]||[]).includes(val):onbAnswers[key]===val;
  return `<button type="button" class="onb__opt${sel?" is-selected":""}" data-onb-pick="${esc(key)}" data-onb-val="${esc(val)}" data-onb-multi="${multi?"1":"0"}">${esc(label)}${sub?`<small>${esc(sub)}</small>`:""}</button>`}
function renderOnboarding(){const body=$("#onbBody"),title=$("#onbTitle"),step=$("#onbStepLabel"),back=$("#onbBack"),next=$("#onbNext");
  if(!body)return;title.textContent=ONB_TITLES[onbStep]||"Create program";step.textContent=`Step ${onbStep+1} of 8`;
  back.classList.toggle("hidden",onbStep===0);next.classList.toggle("hidden",onbStep===7);
  let html="";
  if(onbStep===0)html=`<p class="onb__lede">We'll build a split around your goal and schedule.</p><div class="onb__opts">`+
    onbOpt("","goal","hypertrophy","Build muscle","Hypertrophy focus",false)+
    onbOpt("","goal","strength_hypertrophy","Build muscle with strength focus","Heavier compounds, lower reps",false)+
    onbOpt("","goal","beginner_consistency","Build consistency as a beginner","Simple, repeatable sessions",false)+`</div>`;
  else if(onbStep===1)html=`<div class="onb__grid">`+
    onbOpt("","experience","beginner","Beginner","",false)+onbOpt("","experience","intermediate","Intermediate","",false)+
    onbOpt("","experience","advanced","Advanced","",false)+`</div>`;
  else if(onbStep===2)html=`<div class="onb__grid">`+[2,3,4,5,6].map(n=>onbOpt("","daysPerWeek",n,String(n),"days",false)).join("")+`</div>`;
  else if(onbStep===3){const opts=ONB_SPLITS[onbAnswers.daysPerWeek]||[];
    html=`<p class="onb__lede">Splits that fit ${onbAnswers.daysPerWeek} days per week.</p><div class="onb__opts">`+
      opts.map(s=>onbOpt("","splitType",s,ONB_SPLIT_LABEL[s]||s,"",false)).join("")+`</div>`}
  else if(onbStep===4)html=`<p class="onb__lede">Pick everything you can use. We'll only program what you have.</p><div class="onb__grid">`+
    ONB_EQ_UI.map(e=>onbOpt("", "equipment",e,ONB_EQ_LABEL[e],"",true)).join("")+`</div>`;
  else if(onbStep===5)html=`<p class="onb__lede">Optional — we'll add a little extra volume where you want it.</p><div class="onb__grid">`+
    ONB_MUSCLES.map(m=>onbOpt("","priorityMuscles",m,m,"",true)).join("")+`</div>`;
  else if(onbStep===6)html=`<div class="onb__opts">`+
    onbOpt("","sessionLength","short","Short","4–5 exercises",false)+
    onbOpt("","sessionLength","normal","Normal","5–7 exercises",false)+
    onbOpt("","sessionLength","long","Long","7–9 exercises",false)+`</div>`;
  else{const gen=generateProgramFromOnboarding(onbGenAnswers(onbAnswers)),days=[...new Set(gen.map(e=>e.day))];
    const byDay=days.map(d=>{const exs=gen.filter(e=>e.day===d);
      return `<div class="onb__day"><div class="onb__dayname">${esc(d)}</div>`+
        exs.map(e=>`<div class="onb__ex"><b>${esc(e.name)}</b> · ${e.sets}×${e.min}–${e.max} · ${esc(e.primary)}</div>`).join("")+`</div>`});
    html=`<div class="onb__review">${byDay.join("")}<div class="onb__actions">`+
      `<button type="button" id="onbSave" class="btn btn--forge">Save program</button>`+
      `<button type="button" id="onbEdit" class="btn btn--steel">Edit before saving</button>`+
      `<button type="button" id="onbRestart" class="btn btn--steel">Start over</button></div></div>`}
  body.innerHTML=html;
  $$("[data-onb-pick]").forEach(b=>b.onclick=()=>{const k=b.dataset.onbPick,v=b.dataset.onbVal;
    const multi=b.dataset.onbMulti==="1",num=k==="daysPerWeek"?+v:v;onbPick(k,num,multi)});
  const saveBtn=$("#onbSave");if(saveBtn)saveBtn.onclick=saveOnboardingProgram;
  const editBtn=$("#onbEdit");if(editBtn)editBtn.onclick=editOnboardingProgram;
  const restartBtn=$("#onbRestart");if(restartBtn)restartBtn.onclick=()=>{onbStep=0;onbAnswers=defaultOnbAnswers();renderOnboarding()};
  if(next)next.disabled=!onbCanNext()}
function saveOnboardingProgram(){const a=onbAnswers;prog=new Program(generateProgramFromOnboarding(onbGenAnswers(a)));
  persistProgramMeta({goal:a.goal,experience:a.experience,daysPerWeek:a.daysPerWeek,splitType:a.splitType,equipment:a.equipment,
    priorityMuscles:a.priorityMuscles,sessionLength:a.sessionLength,started:today(),mesocycleStatus:"active",onboarded:true});
  persistProgram();day=prog.days()[0]||"Day 1";closeOnboarding();toast("Program saved.")}
function editOnboardingProgram(){prog=new Program(generateProgramFromOnboarding(onbGenAnswers(onbAnswers)));persistProgram();
  day=prog.days()[0]||"Day 1";closeOnboarding();
  $$("nav button").forEach(x=>{const on=x.dataset.view==="program";x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="program"));render();toast("Tweak your program, then save when ready.")}
window.closeOnboarding=closeOnboarding;window.startOnboarding=startOnboarding;

function init(){
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
  let rzT;window.addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(redrawChart,150)});
  window.addEventListener("orientationchange",()=>setTimeout(redrawChart,200));
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#installBtn").classList.remove("hidden")});
  $("#installBtn").onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installBtn").classList.add("hidden")}};
  $("#restBar").onclick=stopRest;
  $("#glossary .glossary__close").onclick=()=>$("#glossary").classList.add("hidden");
  document.addEventListener("click",e=>{const g=$("#glossary");if(!g||g.classList.contains("hidden"))return;
    if(!g.contains(e.target)&&!e.target.closest("[data-term]"))g.classList.add("hidden")});
  $$("[data-term]").forEach(b=>{if(!b.onclick)b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)}});
  $("#statsDeep").addEventListener("toggle",()=>{if($("#statsDeep").open)redrawChart()});
  $("#date").value=today();
  $("#bodyweight").value=lastBodyweight();
  updateBodyweightField();
  $("#modeFull").onclick=()=>setLogMode("full");
  $("#modeFocus").onclick=()=>setLogMode("focus");
  $("#logForm").onsubmit=saveWorkout;
  $("#statExercise").onchange=renderStats;
  $("#saveProgram").onclick=saveProgram;
  $("#exportProgram").onclick=exportProgram;
  $("#importProgram").onchange=importProgramFile;
  $("#addDay").onclick=()=>{day=prog.addDay();persistProgram();render();toast("Day added.")};
  $("#saveSettings").onclick=()=>commitSettings(false);
  $("#beginnerProgram").onclick=()=>{if(confirm("Replace your current program template? Your logged history stays."))switchToBeginnerProgram()};
  $("#createProgram").onclick=()=>startOnboarding();
  $("#onbBack").onclick=()=>{if(onbStep>0){onbStep--;renderOnboarding()}};
  $("#onbNext").onclick=()=>{if(onbStep<7&&onbCanNext()){onbStep++;renderOnboarding()}};
  ["#jumpPct","#minJump","#rirHigh","#hardRir","#restSec","#unit"].forEach(sel=>$(sel).onchange=()=>commitSettings(true));
  $$('input[name="rirMode"]').forEach(r=>r.onchange=()=>commitSettings(true));
  $$("#volWindow button").forEach(b=>b.onclick=()=>{volWindow=+b.dataset.win;renderCompleted()});
  $("#exportCsv").onclick=exportCsv;$("#exportJson").onclick=exportJson;$("#importJson").onchange=importJson;
  $("#reset").onclick=()=>{if(confirm("Delete the training log? Export a backup first if you need it.")){state.log=[];clearDraft();save();render();toast("Log deleted.")}};
  $$("nav button").forEach(b=>b.onclick=()=>{$$("nav button").forEach(x=>{const on=x===b;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===b.dataset.view));window.scrollTo({top:0});render()});
  $("nav button.active")?.setAttribute("aria-current","page");
  render();
  maybeShowOnboarding();
}
async function boot(){
  let raw=null;
  try{raw=await idbGet(KEY)}catch(e){console.warn("idb read failed",e)}
  if(raw==null){try{const ls=localStorage.getItem(KEY);
    if(ls){raw=JSON.parse(ls);try{await idbSet(KEY,raw)}catch(e){console.warn("idb migration failed",e)}}}
  catch(e){console.warn("localStorage read failed",e)}}
  state=normalizeLoaded(raw);
  prog=new Program(state.program);state.program=prog.toJSON();
  state.programMeta=normalizeProgramMeta(state.programMeta,state.log);
  day=days()[0]||"Day 1";
  migrateLog();
  persist();
  init();
}
boot();
