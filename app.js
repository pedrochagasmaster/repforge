const KEY="repforge_v1",DRAFT="repforge_draft_v1",NOTIFY_META="repforge_notify_v1";
const DB="repforge",STORE="kv";
function loadNotifyMeta(){
  try{return JSON.parse(localStorage.getItem(NOTIFY_META)||"{}")||{}}catch{return{}}
}
function saveNotifyMeta(m){localStorage.setItem(NOTIFY_META,JSON.stringify(m))}
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
const I18N=window.RepForgeI18n;
const t=(k,v)=>I18N?I18N.t(k,v):k;
const tp=(n,w)=>I18N?I18N.tp(n,w):(+n===1?w:w+"s");
const applyI18n=()=>{if(!I18N)return;I18N.applyDom();
  const hard=$("#statsHardSetLede");if(hard)hard.innerHTML=t("stats.completed_hard_sets.lede",{hardSet:term("hard set")});
  const langSel=$("#lang");if(langSel){if(state?.settings?.lang)langSel.value=state.settings.lang;[...langSel.options].forEach(o=>{o.textContent=t("settings.lang."+o.value)})}
  $$("[data-term]").forEach(b=>{const key=b.dataset.term;b.textContent=t(`glossary.term.${key}`)||key;if(!b.onclick)b.onclick=e=>{e.stopPropagation();glossaryPopover(key,b)}});
};
function syncLang(){if(!I18N)return;I18N.setLang(state?.settings?.lang||I18N.detectLang());applyI18n()}
const uid=()=>crypto?.randomUUID?.()||`id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmtPlain=v=>Number.isFinite(Number(v))?(Number.isInteger(Number(v))?String(Number(v)):Number(v).toFixed(2).replace(/\.?0+$/,"")):"";
const uiLang=()=>state?.settings?.lang||(typeof I18N!=="undefined"&&I18N?.getLang?.())||"en";
const isPt=()=>uiLang()==="pt";
const locTag=()=>isPt()?"pt-BR":"en-US";
/** Locale-aware display number (PT decimal comma). Not for input values. */
const fmt=v=>{const s=fmtPlain(v);if(!s)return"";return isPt()?s.replace(".",","):s};
const kfmt=v=>{const n=Number(v)||0;
  if(n>=10000){const raw=(n/1000).toFixed(n>=100000?0:1).replace(/\.0$/,"");return (isPt()?raw.replace(".",","):raw)+"k"}
  try{return Math.round(n).toLocaleString(locTag())}catch{return String(Math.round(n))}};
const plural=(n,word)=>`${word}${+n===1?"":"s"}`;
const avg=a=>a.length?a.reduce((s,x)=>s+Number(x||0),0)/a.length:0;
const median=a=>{if(!a.length)return 0;const s=[...a].map(Number).sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const sum=a=>a.reduce((s,x)=>s+Number(x||0),0);
const daysAgo=n=>{const d=new Date();d.setDate(d.getDate()-n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
function weekStart(date){const d=new Date(`${String(date).slice(0,10)}T12:00:00`),dow=d.getDay(),diff=dow===0?6:dow-1;
  d.setDate(d.getDate()-diff);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function weekRange(date){const start=weekStart(date),endD=new Date(`${start}T12:00:00`);endD.setDate(endD.getDate()+6);
  return{start,end:`${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,"0")}-${String(endD.getDate()).padStart(2,"0")}`}}
function sessionsInRange(start,end){const ids=new Set();for(const x of state.log){if(String(x.date)>=start&&String(x.date)<=end)ids.add(x.session)}return[...ids]}
window.__repforgeWeek={weekStart,weekRange,sessionsInRange};
const e1rm=(load,reps)=>load>0&&reps>0?load*(1+reps/30):0;
const muscles=s=>String(s||"").split(",").map(x=>x.trim()).filter(Boolean);
const shortDate=d=>{const p=String(d||"").split("-");if(p.length!==3)return String(d||"");
  const day=+p[2],mon=t("month_short."+(+p[1]-1));
  return isPt()?`${day} ${mon}`:`${mon} ${day}`};
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.remove("hidden");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add("hidden"),2400)};
const download=(text,name,type="text/plain")=>{const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement("a");a.href=u;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(u)};
async function shareOrDownload(text,name,type){
  try{if(navigator.canShare){const file=new File([text],name,{type});
    if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"RepForge backup"});return}}}catch{}
  download(text,name,type)}
const EFFORT_RIR={easy:3,hard:1,max:0};
function glossaryPopover(termKey,anchor){const g=$("#glossary");if(!g)return;
  g.querySelector(".glossary__term").textContent=t(`glossary.term.${termKey}`)||termKey;
  g.querySelector(".glossary__body").textContent=t(`glossary.${termKey}`)||"";
  g.classList.remove("hidden");
  const r=anchor.getBoundingClientRect();g.style.top=`${window.scrollY+r.bottom+6}px`;g.style.left=`${Math.max(8,r.left)}px`}
const DEFAULTS={jumpPct:2.5,minJump:2.5,rirHigh:2,hardRir:4,restSec:120,lastExport:"",unit:"kg",lang:null,rirMode:"numeric",voiceInputEnabled:false,notify:{enabled:false,timer:true,session:true,unfinished:true,missed:true}};
const normSetting=(v,def,min=0)=>Number.isFinite(+v)&&+v>=min?+v:def;
const normBool=(v,def)=>typeof v==="boolean"?v:def;
function normalizeNotify(n){
  return{enabled:!!(n&&n.enabled),timer:n?.timer!==false,session:n?.session!==false,unfinished:n?.unfinished!==false,missed:n?.missed!==false}}
const normalizeSettings=s=>{const lang=I18N?.normalizeLang(s?.lang)||I18N?.detectLang()||"en";return{jumpPct:normSetting(s?.jumpPct,DEFAULTS.jumpPct,0),minJump:normSetting(s?.minJump,DEFAULTS.minJump,0.01),rirHigh:normSetting(s?.rirHigh,DEFAULTS.rirHigh,0),hardRir:normSetting(s?.hardRir,DEFAULTS.hardRir,0),restSec:normSetting(s?.restSec,DEFAULTS.restSec,0),lastExport:typeof s?.lastExport==="string"?s.lastExport:"",unit:s?.unit==="lb"?"lb":"kg",lang,rirMode:s?.rirMode==="effort"?"effort":"numeric",voiceInputEnabled:normBool(s?.voiceInputEnabled,DEFAULTS.voiceInputEnabled),notify:normalizeNotify(s?.notify)}};
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const LB=2.2046226218;
/* Locale keyboards (pt-BR, de, fr, …) put a comma on the decimal pad. HTML
   type=number rejects it on iOS, and unary + / Number() treat "90,5" as NaN.
   parseDec mirrors normalizeCommandText: digit-comma-digit → period. */
const parseDec=v=>{
  if(typeof v==="number")return Number.isFinite(v)?v:NaN;
  if(v==null||v==="")return NaN;
  const n=Number(String(v).trim().replace(/(\d),(\d)/g,"$1.$2"));
  return Number.isFinite(n)?n:NaN};
const toDisplayUnit=(kg,unit)=>unit==="lb"?(+kg||0)*LB:(+kg||0);
const fromDisplayUnit=(v,unit)=>{const n=parseDec(v),x=Number.isFinite(n)?n:0;return unit==="lb"?x/LB:x};
const isLb=()=>state.settings.unit==="lb";
const toDisplay=kg=>toDisplayUnit(kg,state.settings.unit);
const fromDisplay=v=>fromDisplayUnit(v,state.settings.unit);
const unitLabel=()=>isLb()?"lb":"kg";
const fmtLoad=kg=>fmt(toDisplay(kg));
const fmtLoadPlain=kg=>fmtPlain(toDisplay(kg));
const term=key=>`<button type="button" class="term" data-term="${esc(key)}">${esc(t(`glossary.term.${key}`)||key)}</button>`;
function clearDraft(){
  localStorage.removeItem(DRAFT);
  clearUnfinishedWatch();
  lastCommitAt=0;
  const el=$("#unfinishedBanner");
  if(el){el.classList.add("hidden");el.hidden=true}
  delete document.body.dataset.unfinishedPrompt;
}
const loadDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT)||"{}")}catch{clearDraft();return{}}};
function convertDraftUnits(oldUnit,newUnit){
  if(oldUnit===newUnit)return;
  const d=loadDraft();let changed=false;
  for(const k of Object.keys(d)){
    if(k.startsWith("__")||!k.endsWith("_load"))continue;
    const v=d[k];if(v===""||v==null)continue;
    const n=parseDec(v);if(!Number.isFinite(n))continue;
    d[k]=fmtPlain(toDisplayUnit(fromDisplayUnit(n,oldUnit),newUnit));changed=true}
  if(changed)localStorage.setItem(DRAFT,JSON.stringify(d))}
const posNum=(v,f=0)=>{const n=parseDec(v);return Math.max(0,Number.isFinite(n)?n:f)};
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
let restEnd=0,restTick=null,restNotified=false;
let unfinishedTimer=null;
let lastCommitAt=0;             // module-level; hydrated from draft at boot
const UNFINISHED_MS=15*60*1000;

function clearUnfinishedWatch(){
  if(unfinishedTimer){clearTimeout(unfinishedTimer); unfinishedTimer=null}
  if(window.RepForgeNotify) RepForgeNotify.closeTag("repforge-unfinished");
}

function armUnfinishedWatch(delayMs=UNFINISHED_MS){
  clearUnfinishedWatch();
  if(!RepForgeNotify.enabledFor(state.settings,"unfinished")) return;
  unfinishedTimer=setTimeout(onUnfinishedIdle, Math.max(0,delayMs));
}

// Single-reminder guarantee: remember which commit timestamp we already
// prompted for (in repforge_notify_v1), so reopening the app or receiving
// the OS notification does not produce repeat prompts for the same session.
function unfinishedAlreadyPrompted(){
  return loadNotifyMeta().unfinishedPromptedFor===lastCommitAt;
}
function markUnfinishedPrompted(){
  const m=loadNotifyMeta(); m.unfinishedPromptedFor=lastCommitAt; saveNotifyMeta(m);
}

function showUnfinishedPrompt(){
  markUnfinishedPrompted();
  document.body.dataset.unfinishedPrompt="1";
  const el=$("#unfinishedBanner");
  if(!el) return;
  el.classList.remove("hidden");
  el.hidden=false;
  const d=$("#unfinishedDismiss");
  if(d) d.onclick=()=>{ el.classList.add("hidden"); el.hidden=true; };
}

function onUnfinishedIdle(){
  unfinishedTimer=null;
  const draft=loadDraft();
  if(!(draft.__done||[]).length) return;
  if(!RepForgeNotify.enabledFor(state.settings,"unfinished")) return;
  if(unfinishedAlreadyPrompted()) return;
  if(document.visibilityState==="visible") showUnfinishedPrompt();
  else RepForgeNotify.fireOS({title:t("notify.title"),body:t("notify.unfinished.body"),tag:"repforge-unfinished",url:"./index.html"}).then(ok=>{if(ok)markUnfinishedPrompted()});
}

function maybeUnfinishedOnOpen(){
  const draft=loadDraft();
  lastCommitAt=+draft.__lastCommitAt||0;   // hydrate module state from draft
  if(!RepForgeNotify.enabledFor(state.settings,"unfinished")) return;
  const done=(draft.__done||[]).length;
  if(!done||!lastCommitAt) return;
  if(unfinishedAlreadyPrompted()) return;  // single reminder per session
  const elapsed=Date.now()-lastCommitAt;
  if(elapsed>=UNFINISHED_MS) showUnfinishedPrompt();
  else armUnfinishedWatch(UNFINISHED_MS-elapsed);
}
const collapsed=new Set();
const skipped=new Set();
const substituted=new Map();
const committed=new Set();
const touched=new Set();
const warmups=new Set();
let logMode="full",focusIndex=0,focusEditSet=null,statsSeg="overview",prFilter="all";
let focusEnterFrom=0,focusDrag=null,focusFlinging=false;
let exView=null;
let workoutActive=false,workoutLeft=false,programEditMode=false,histMonth=null,histQuery="",expandedSession=null,readyExpanded=false;
const STATS_SEG={overview:"segOverview",strength:"segStrength",volume:"segVolume",prs:"segPRs",review:"segReview"};

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
function weeklySnapshot(date=today()){const{start,end}=weekRange(date),weekStart=start,weekEnd=end;
  const completedSessions=sessionsInRange(start,end).length,plannedDays=prog.days().length,programDaySet=new Set(prog.days()),loggedDays=new Set();
  for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;if(programDaySet.has(x.day))loggedDays.add(x.day)}
  const completedDays=loggedDays.size,adherence=plannedDays?completedDays/plannedDays:0,hr=+state.settings.hardRir;
  let totalWorkingSets=0,totalHardSets=0;for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;
    if(!isWork(x)||!(+x.load>0&&+x.reps>0))continue;totalWorkingSets++;if(+x.rir<=hr)totalHardSets++}
  const prs=detectPRs(state.log).filter(ev=>String(ev.date)>=start&&String(ev.date)<=end);
  const trained=new Map();for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;if(!isWork(x)||!(+x.load>0))continue;
    const k=liftKey(x),cur=trained.get(k);if(!cur||String(x.created)>String(cur.created))trained.set(k,{session:x.session,created:x.created})}
  let improvedLifts=0,flatLifts=0,regressedLifts=0,fatigueFlags=0;
  for(const[k,sess]of trained){const ex=prog.exercises.find(e=>e.id===k)||prog.exercises.find(e=>e.name===k);if(!ex)continue;
    const rows=state.log.filter(r=>r.session===sess.session&&liftKey(r)===k),cmp=compareExerciseSession(ex,rows);
    if(cmp.status==="improved")improvedLifts++;else if(cmp.status==="flat")flatLifts++;else if(cmp.status==="regressed")regressedLifts++;
    const r=recommendation(ex);if(r.status==="reduce"||r.stalled)fatigueFlags++}
  let readyToAdd=0;for(const ex of prog.exercises){const st=recommendation(ex).status;if(st==="add"||st==="add2")readyToAdd++}
  let status;if(completedSessions===0)status=t("status.needs_more_data");
  else if(adherence>=.85&&improvedLifts>=flatLifts)status=t("status.on_track");
  else if(adherence>=.65&&prs.length>0)status=t("status.productive_week");
  else if(fatigueFlags>=2)status=t("status.high_fatigue");
  else if(adherence<.5)status=t("status.under_target");
  else status=t("status.rebuilding");
  return{weekStart,weekEnd,plannedDays,completedDays,completedSessions,totalWorkingSets,totalHardSets,prs,improvedLifts,flatLifts,regressedLifts,readyToAdd,status}}
window.__repforgeWeeklySnapshot=weeklySnapshot;
function programWeek(){const s=state.programMeta?.started;if(!s)return null;
  const start=new Date(`${s}T12:00:00`),now=new Date(`${today()}T12:00:00`);
  const days=Math.floor((now-start)/86400000);return days<0?1:Math.floor(days/7)+1}
function mesocycleWeek(){const wk=programWeek(),total=state.programMeta?.mesocycleLengthWeeks||6;
  const current=wk!=null?Math.max(1,wk):null;
  const isFinalWeek=current!=null&&current>=total;
  const isComplete=state.programMeta?.mesocycleStatus==="completed"||(current!=null&&current>total);
  return{current,total,isFinalWeek,isComplete}}
function rowMusclesPure(row,program){if(row.primary!=null||row.secondary!=null)return{primary:row.primary||"",secondary:row.secondary||""};
  const ex=(program||[]).find(e=>e.id===row.exerciseId)||(program||[]).find(e=>e.name===row.name);
  return ex?{primary:ex.primary,secondary:ex.secondary}:{primary:"",secondary:""}}
function volMapToObj(m){const o={};for(const[k,v]of m)o[k]={d:v.d,p:v.p};return o}
function sessionsForLog(ex,log){const match=matchLift(ex),m=new Map();
  for(const x of log||[]){if(!match(x)||!(+x.load>0)||!isWork(x))continue;
    if(!m.has(x.session))m.set(x.session,{session:x.session,date:x.date,created:x.created,loads:[],reps:[],rirs:[]});
    const o=m.get(x.session);o.loads.push(+x.load);o.reps.push(+x.reps);o.rirs.push(+x.rir)}
  return[...m.values()].map(o=>({session:o.session,date:o.date,created:o.created,reps:o.reps,
    med:median(o.loads),top:Math.max(...o.loads),minReps:Math.min(...o.reps),maxReps:Math.max(...o.reps),medReps:median(o.reps),
    avgRir:avg(o.rirs),bestE1rm:Math.max(...o.loads.map((load,index)=>e1rm(load,o.reps[index])))}))
    .sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)))}
function previousSessionRowsLog(ex,beforeSessionId,log){const match=matchLift(ex),m=new Map();
  for(const x of log||[]){if(!match(x)||!(+x.load>0)||!isWork(x)||!(+x.reps>0))continue;
    if(!m.has(x.session))m.set(x.session,{session:x.session,date:x.date,created:x.created,rows:[]});m.get(x.session).rows.push(x)}
  const ordered=[...m.values()].sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)));
  const curIdx=ordered.findIndex(s=>s.session===beforeSessionId);
  if(curIdx<0){const curCreated=(log||[]).find(r=>r.session===beforeSessionId)?.created;if(!curCreated)return ordered.length?ordered.at(-1).rows:[];
    const older=ordered.filter(s=>String(s.created).localeCompare(String(curCreated))<0);return older.length?older.at(-1).rows:[]}
  return curIdx>0?ordered[curIdx-1].rows:[]}
function hardSetsInRange(log,program,started,ended,hardRir){const m=new Map();
  for(const x of log||[]){if(started&&String(x.date)<started)continue;if(ended&&String(x.date)>ended)continue;
    if(!(+x.load>0&&+x.reps>0&&+x.rir<=hardRir)||!isWork(x))continue;
    const mus=rowMusclesPure(x,program);
    for(const p of muscles(mus.primary))addVol(m,p,1,0);
    for(const s of muscles(mus.secondary))addVol(m,s,0,.5)}
  return m}
function buildBlockReview(programMeta,program,log){const p=new Program(program||[]),days=p.days(),total=programMeta?.mesocycleLengthWeeks||6;
  const started=programMeta?.started||null,ended=today(),hardRir=DEFAULTS.hardRir;
  const plannedSessions=total&&days.length?total*days.length:0;
  const blockRows=(log||[]).filter(r=>!started||r.date&&(String(r.date)>=started&&String(r.date)<=ended));
  const completedSessions=new Set(blockRows.map(r=>r.session)).size;
  const adherenceRatio=plannedSessions?Math.min(completedSessions/plannedSessions,1):0;
  let improvedLifts=0,flatLifts=0,regressedLifts=0,stalledLifts=0;
  for(const ex of p.exercises){const sess=sessionsForLog(ex,log),blockSess=started?sess.filter(s=>String(s.date)>=started&&String(s.date)<=ended):sess;
    if(!blockSess.length)continue;
    const latest=blockSess.at(-1),latestRows=(log||[]).filter(r=>r.session===latest.session&&matchLift(ex)(r));
    const delta=buildSessionDelta(previousSessionRowsLog(ex,latest.session,log),workingRows(latestRows));
    if(delta.status==="improved")improvedLifts++;
    else if(delta.status==="flat")flatLifts++;
    else if(delta.status==="regressed")regressedLifts++;
    if(isStalled(sess))stalledLifts++}
  const prs=detectPRs(log||[]).filter(e=>!started||e.date&&(String(e.date)>=started&&String(e.date)<=ended)).length;
  const plannedMap=p.volume(),plannedHardSetsByMuscle=volMapToObj(plannedMap);
  let totalPlanned=0;for(const[,v]of plannedMap)totalPlanned+=(v.d+v.p)*total;
  const completedMap=hardSetsInRange(log,program,started,ended,hardRir),completedHardSetsByMuscle=volMapToObj(completedMap);
  let totalCompleted=0;for(const[,v]of completedMap)totalCompleted+=v.d+v.p;
  const volumeCompliance=totalPlanned?Math.min(totalCompleted/totalPlanned,1):0;
  const improvedHigh=improvedLifts>=3||(improvedLifts>0&&improvedLifts>=flatLifts+regressedLifts);
  const fatigueHigh=(regressedLifts+flatLifts)>=4||regressedLifts>=2;
  let recommendation;
  if(adherenceRatio<.5)recommendation="repeat_with_simpler_schedule";
  else if(stalledLifts>=3&&fatigueHigh)recommendation="reduce_volume_or_deload";
  else if(improvedHigh&&adherenceRatio>=.8)recommendation="repeat_or_progress";
  else if(volumeCompliance<.6)recommendation="keep_program_improve_completion";
  else recommendation="repeat_with_small_swaps";
  return{programId:programMeta?.id||null,started,ended,plannedSessions,completedSessions,adherenceRatio,
    improvedLifts,flatLifts,regressedLifts,stalledLifts,prs,completedHardSetsByMuscle,plannedHardSetsByMuscle,
    volumeCompliance,recommendation,created:new Date().toISOString()}}
const REC_STRATEGY={repeat_or_progress:"repeat",repeat_with_small_swaps:"repeat_swaps",reduce_volume_or_deload:"reduce_volume",keep_program_improve_completion:"repeat",repeat_with_simpler_schedule:"reduce_volume"};
function blockRecommendationCopy(key){const k=key||"repeat_with_small_swaps";return{line:t(`block_rec.${k}.line`),why:t(`block_rec.${k}.why`)}}
function blockSnapshot(programMeta,log){const review=buildBlockReview(programMeta,prog.toJSON(),log),total=programMeta?.mesocycleLengthWeeks||6;
  let weekCurrent=null;const s=programMeta?.started;
  if(s){const start=new Date(`${s}T12:00:00`),now=new Date(`${today()}T12:00:00`);
    const days=Math.floor((now-start)/86400000);weekCurrent=days<0?1:Math.floor(days/7)+1}
  return{...review,weekCurrent,weekTotal:total}}
function buildPlainSummary(snapshot){if(!snapshot)return"";
  const parts=[];
  if(snapshot.weekCurrent!=null&&snapshot.weekTotal)parts.push(t("review.summary.week",{n:snapshot.weekCurrent,total:snapshot.weekTotal}));
  const ad=snapshot.adherenceRatio??0,adKey=ad>=.8?"solid":ad>=.5?"mixed":"low";
  if(snapshot.plannedSessions)parts.push(t("review.summary.adherence",{status:t(`review.summary.adherence.${adKey}`),done:snapshot.completedSessions,planned:snapshot.plannedSessions}));
  const imp=snapshot.improvedLifts??0,flat=snapshot.flatLifts??0;
  if(imp||flat)parts.push(t("review.summary.lifts",{improved:imp,lifts:tp(imp,"lift"),flatBit:flat?t("review.summary.lifts_flat",{flat}):""}));
  const vol=snapshot.volumeCompliance??0;
  if(vol<.6&&snapshot.plannedSessions)parts.push(t("review.summary.volume",{pct:Math.round(vol*100)}));
  const copy=blockRecommendationCopy(snapshot.recommendation);
  parts.push(copy.line.replace(/^Recommendation:\s*/i,"").trim());
  return parts.join(" ")}
function renderReview(){const el=$("#reviewPanel");if(!el)return;
  if(!state.programMeta?.started){el.innerHTML=`<p class="lede">${esc(t("review.no_start"))}</p>`;return}
  const snap=blockSnapshot(state.programMeta,state.log),pct=Math.round((snap.volumeCompliance||0)*100),summary=buildPlainSummary(snap);
  el.innerHTML=`<div class="blockprogress"><h4 class="blockprogress__title">${esc(t("review.progress_title"))}</h4>`+
    `<p><b>${esc(t("review.week_of",{n:snap.weekCurrent??"—",total:snap.weekTotal}))}</b></p>`+
    `<p><b>${esc(t("review.sessions"))}</b> ${esc(t("review.sessions_completed",{done:snap.completedSessions,planned:snap.plannedSessions}))}</p>`+
    `<p><b>${esc(t("review.lifts"))}</b> ${esc(t("review.lifts_summary",{improved:snap.improvedLifts,flat:snap.flatLifts,stalled:snap.stalledLifts}))}</p>`+
    `<p><b>${esc(t("review.volume"))}</b> ${esc(t("review.volume_planned",{pct}))}</p></div>`+
    `<p class="review__summary">${esc(summary)}</p>`}
function renderBlockReviewPanel(review){const copy=blockRecommendationCopy(review.recommendation),pct=Math.round((review.volumeCompliance||0)*100);
  const meta=state.programMeta||{},started=meta.started?new Date(`${meta.started}T12:00:00`):null;
  const end=new Date(`${today()}T12:00:00`);
  const range=started?`${started.getDate()} ${t("month_short."+started.getMonth())} – ${end.getDate()} ${t("month_short."+end.getMonth())}`:"";
  const weeks=meta.mesocycleLengthWeeks||6;
  const recKey=review.recommendation||"repeat_with_small_swaps";
  const strategies=[
    {id:"repeat_swaps",title:t("dialog.block_review.repeat_swaps"),cap:t("block_strategy.repeat_swaps.cap")},
    {id:"repeat",title:t("dialog.block_review.repeat"),cap:t("block_strategy.repeat.cap")},
    {id:"increase_volume",title:t("dialog.block_review.increase_volume"),cap:t("block_strategy.increase_volume.cap")},
    {id:"reduce_volume",title:t("dialog.block_review.reduce_volume"),cap:t("block_strategy.reduce_volume.cap")},
    {id:"onboarding",title:t("dialog.block_review.onboarding"),cap:t("block_strategy.onboarding.cap")},
  ];
  const recStrategy=REC_STRATEGY[recKey]||"repeat_swaps";
  $("#blockReviewBody").innerHTML=
    `<p class="blockreview__prog">${esc(meta.name||t("untitled_program"))}</p>`+
    `<h2 class="blockreview__hero">${esc(t("dialog.block_review.completed"))}</h2>`+
    `<p class="blockreview__range">${esc(t("dialog.block_review.range",{weeks,range}))}</p>`+
    `<div class="blockreview__adherence"><span>${esc(t("review.sessions_completed",{done:review.completedSessions,planned:review.plannedSessions}))}</span><span>${pct}%</span></div>`+
    `<div class="blockreview__bar"><span style="width:${pct}%"></span><i class="blockreview__bar-knob" style="left:${pct}%"></i></div>`+
    `<div class="statrow statrow--4">`+
    `<div class="statrow__cell"><div class="statrow__val">${review.improvedLifts}</div><div class="statrow__cap">${esc(t("stats.this_week.improved"))}</div></div>`+
    `<div class="statrow__cell"><div class="statrow__val">${review.flatLifts}</div><div class="statrow__cap">${esc(t("stats.this_week.stable"))}</div></div>`+
    `<div class="statrow__cell"><div class="statrow__val">${review.stalledLifts}</div><div class="statrow__cap">${esc(t("block_review.stalled"))}</div></div>`+
    `<div class="statrow__cell"><div class="statrow__val">${pct}%</div><div class="statrow__cap">${esc(t("block_review.volume"))}</div></div></div>`+
    `<div class="recblock"><div class="recblock__lab">${esc(t("today.recommendation"))}</div>`+
    `<div class="recblock__head">${esc(copy.line)}</div>`+
    `<p class="recblock__body"><span class="recblock__why-lab">${esc(t("review.why"))}</span> ${esc(copy.why)}</p>`+
    `<button type="button" class="text-link" id="blockSeeAnalysis">${esc(t("block_review.see_analysis"))}</button></div>`+
    `<p class="section-label">${esc(t("block_review.next_block"))}</p>`+
    `<div id="blockStrategies">${strategies.map(s=>`<button type="button" class="radio-card blockreview__act${s.id===recStrategy?" is-selected is-recommended":""}" data-strategy="${s.id}">`+
      `<span class="radio-card__body"><span class="radio-card__title">${esc(s.title)}${s.id===recStrategy?` <span class="tag-rec">${esc(t("aria.recommended"))}</span>`:""}</span>`+
      `<span class="radio-card__cap">${esc(s.cap)}</span></span><span class="radio-card__mark"></span></button>`).join("")}</div>`+
    `<p class="blockreview__lock">🔒 ${esc(t("block_review.preserved"))}</p>`+
    `<div class="blockreview__sticky"><button type="button" class="btn btn--cta" id="blockStartNext">${esc(t("block_review.start_next"))}</button>`+
    `<button type="button" class="text-link text-link--center text-link--accent" id="blockDecideLater">${esc(t("block_review.decide_later"))}</button></div>`;
  let selected=recStrategy;
  $$("#blockStrategies .blockreview__act").forEach(b=>b.onclick=()=>{selected=b.dataset.strategy;
    $$("#blockStrategies .blockreview__act").forEach(x=>x.classList.toggle("is-selected",x===b))});
  $("#blockStartNext").onclick=()=>finishBlockAndStart(selected);
  $("#blockDecideLater").onclick=closeBlockReview;
  const anal=$("#blockSeeAnalysis");if(anal)anal.onclick=()=>{closeBlockReview();navTo("stats");setStatsSeg("review")}}
let blockReviewCurrent=null;
function closeBlockReview(){const d=$("#blockReview");if(d)d.classList.add("hidden")}
function completeCurrentProgram(review){
  if(!state.programMeta)state.programMeta=defaultProgramMeta(state.log);
  if(!Array.isArray(state.programHistory))state.programHistory=[];
  state.programHistory.push({id:state.programMeta.id,meta:{...state.programMeta},program:prog.toJSON(),
    completedAt:new Date().toISOString(),review});
  state.programMeta.mesocycleStatus="completed";
  state.programMeta.completedAt=new Date().toISOString();
  state.programMeta.updated=new Date().toISOString();
  save()}
function startNextMesocycle(strategy){
  if(!state.programMeta)state.programMeta=defaultProgramMeta(state.log);
  if(strategy==="onboarding"&&typeof window.startOnboarding==="function"){window.startOnboarding();return}
  let list=prog.toJSON();
  if(strategy==="repeat_swaps")list=list.map(e=>e.alternates?.length?{...e,name:e.alternates[0]}:e);
  else if(strategy==="increase_volume")list=list.map(e=>({...e,sets:Math.min((e.sets||2)+1,e.maxSets||6)}));
  else if(strategy==="reduce_volume")list=list.map(e=>({...e,sets:Math.max((e.sets||2)-1,1)}));
  state.programMeta={...state.programMeta,id:uid(),started:today(),mesocycleStatus:"active",completedAt:null,onboarded:true,
    updated:new Date().toISOString()};
  prog=new Program(list);persistProgram();render();
  const msg={repeat:"toast.new_block_same",repeat_swaps:"toast.new_block_swaps",
    increase_volume:"toast.new_block_volume_increased",reduce_volume:"toast.new_block_volume_reduced",onboarding:"toast.new_block_started"};
  toast(t(msg[strategy]||"toast.new_block_started"))}
function finishBlockAndStart(strategy){const review=blockReviewCurrent;if(!review)return;
  completeCurrentProgram(review);startNextMesocycle(strategy);closeBlockReview()}
function openBlockReview(review){blockReviewCurrent=review;renderBlockReviewPanel(review);const d=$("#blockReview");if(!d)return;
  d.classList.remove("hidden");$("#blockReviewClose").onclick=closeBlockReview}
function promptEndBlock(){const d=$("#endBlockConfirm");if(!d)return;
  d.classList.remove("hidden");
  $("#endBlockGo").onclick=()=>{d.classList.add("hidden");openBlockReview(buildBlockReview(state.programMeta,state.program,state.log))};
  $("#endBlockCancel").onclick=()=>d.classList.add("hidden")}
function renderBlockPrompt(){const mc=mesocycleWeek(),show=mc.isComplete||mc.isFinalWeek;
  const html=show?`<p><b>${esc(t("review.block_ending"))}</b> ${esc(t("review.block_ending.body",{n:mc.current,total:mc.total}))} <button type="button" class="blockprompt__act">${esc(t("review.block_ending.cta"))}</button></p>`:"";
  for(const sel of["#logBlockBanner","#programBlockBanner"]){const el=$(sel);if(!el)continue;
    el.classList.toggle("hidden",!show);if(show){el.innerHTML=html;const btn=el.querySelector(".blockprompt__act");if(btn)btn.onclick=promptEndBlock}}}
function programProgressionHealth(){const withHistory=prog.exercises.filter(ex=>sessionsFor(ex).length>0);
  if(!withHistory.length)return null;
  const hot=withHistory.filter(ex=>{const st=recommendation(ex).status;return st==="add"||st==="add2"}).length;
  return{hot,total:withHistory.length,ratio:hot/withHistory.length}}
function programVolumeCompliance(){const planned=prog.volume();let plannedTotal=0;
  for(const [,v] of planned)plannedTotal+=v.d+v.p;if(!plannedTotal)return null;
  const m=completedHardSets(7);let completed=0;for(const [,v] of m)completed+=v.d+v.p;
  return{planned:plannedTotal,completed,ratio:Math.min(completed/plannedTotal,1)}}
function programStatusLabel(adherence,health){
  const hasLog=state.log.some(isWork);if(!hasLog)return t("status.getting_started");
  const adRatio=adherence.ratio,hRatio=health?.ratio??0;
  if(adRatio>=1&&hRatio>=0.4)return t("status.on_track");if(adRatio>=0.5)return t("status.partial_week");return t("status.rebuilding")}
function parseProgramImport(parsed){
  if(Array.isArray(parsed))return{exercises:parsed,meta:null};
  if(Array.isArray(parsed?.exercises))return{exercises:parsed.exercises,meta:parsed.meta??null};
  if(Array.isArray(parsed?.program))return{exercises:parsed.program,meta:parsed.meta??null};
  return null}
function save(){persist()}
function persist(){
  let lsOk=true;
  try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){lsOk=false;console.warn("localStorage mirror failed",e)}
  idbSet(KEY,state).catch(e=>{console.warn("idb persist failed",e);
    // Only alarm the user when neither store took the write — data is genuinely at risk.
    if(!lsOk&&!persist.warned){persist.warned=true;toast(t("toast.storage_full"))}})}
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
    med:median(o.loads),top:Math.max(...o.loads),minReps:Math.min(...o.reps),maxReps:Math.max(...o.reps),medReps:median(o.reps),
    avgRir:avg(o.rirs),bestE1rm:Math.max(...o.loads.map((load,index)=>e1rm(load,o.reps[index])))}))
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
  if(!previous||!current)return{status:"not_comparable",label:t("delta.not_comparable.label"),text:t("delta.not_comparable.text"),metrics:null};
  const loadDelta=current.topLoad-previous.topLoad,repsDelta=current.totalReps-previous.totalReps,volumeDelta=current.totalVolume-previous.totalVolume,
    e1rmDelta=current.bestE1rm-previous.bestE1rm,avgRirDelta=current.avgRir-previous.avgRir,deltas={loadDelta,repsDelta,volumeDelta,e1rmDelta,avgRirDelta};
  let status,label,text;
  if(e1rmDelta>previous.bestE1rm*T.e1rmPct){status="improved";label=t("delta.improved.label");text=t("delta.improved.text")}
  else if(Math.abs(loadDelta)<.01&&repsDelta>0){status="improved";label=t("delta.improved.label");text=t("delta.improved.text")}
  else if(volumeDelta>previous.totalVolume*T.volumePct&&avgRirDelta<=T.rir){status="improved";label=t("delta.improved.label");text=t("delta.improved.text")}
  else if(Math.abs(e1rmDelta)<=previous.bestE1rm*T.e1rmPct&&repsDelta===0&&Math.abs(volumeDelta)<=previous.totalVolume*T.volumePct){status="flat";label=t("delta.flat.label");text=t("delta.flat.text")}
  else if(e1rmDelta<0&&repsDelta<0){status="regressed";label=t("delta.regressed.label");text=t("delta.regressed.text")}
  else{status="changed_load";label=t("delta.changed_load.label");text=t("delta.changed_load.text")}
  return{status,label,text,metrics:{current,previous,deltas}}}
function compareExerciseSession(ex,currentRows){const cur=workingRows(currentRows);
  if(!cur.length)return{status:"not_comparable",label:t("delta.not_comparable.label"),text:t("delta.not_comparable.text"),metrics:null};
  const prev=previousSessionForExercise(ex,cur[0]?.session);
  if(!prev.length)return{status:"new",label:t("delta.new.label"),text:t("delta.new.text"),metrics:null};
  return buildSessionDelta(prev,cur)}
function formatDelta(delta){if(!delta?.metrics)return"";const{deltas}=delta.metrics,{loadDelta,repsDelta,e1rmDelta}=deltas;
  if(Math.abs(loadDelta)<.01&&repsDelta!==0){const s=repsDelta>0?"+":"";return t("delta.reps_same_load",{signed:s+repsDelta})}
  if(Math.abs(e1rmDelta)>=.01){const s=e1rmDelta>0?"+":"";return t("delta.e1rm",{signed:s,delta:Math.round(toDisplay(e1rmDelta)),unit:unitLabel()})}
  const parts=[];if(repsDelta!==0)parts.push(t("delta.reps",{signed:repsDelta>0?"+":"",delta:repsDelta}));if(Math.abs(e1rmDelta)>=.01)parts.push(t("delta.e1rm_labeled",{signed:e1rmDelta>0?"+":"",delta:Math.round(toDisplay(e1rmDelta)),unit:unitLabel()}));
  return parts.length?parts.join(" · "):""}
function sessionDeltaCounts(rows){const byLift=new Map();
  for(const r of rows){if(!isWork(r)||!(+r.load>0)||!(+r.reps>0))continue;
    const k=liftKey(r);if(!byLift.has(k))byLift.set(k,[]);byLift.get(k).push(r)}
  const counts={improved:0,flat:0,regressed:0,new:0};
  for(const [,liftRows]of byLift){const row=liftRows[0];
    const ex=prog.find(row.exerciseId)||prog.exercises.find(e=>e.name===row.name)||{id:row.exerciseId,name:row.name};
    const d=compareExerciseSession(ex,liftRows);if(d.status in counts)counts[d.status]++}
  return counts}
function formatDeltaCounts(c,{sep=" · "}={}){const parts=[];
  if(c.improved)parts.push(t("delta.count.improved",{n:c.improved}));if(c.flat)parts.push(t("delta.count.flat",{n:c.flat}));
  if(c.regressed)parts.push(t("delta.count.regressed",{n:c.regressed}));if(c.new)parts.push(t("delta.count.new_lifts",{n:c.new,lifts:tp(c.new,"lift")}));
  return parts.join(sep)}
function hasDeltaSummary(c){return c.improved||c.flat||c.regressed||c.new}
function draftRowsForExercise(ex,draft){const warm=new Set(draft.__warm||[]),rows=[];
  for(let n=1;n<=ex.sets;n++){const key=`${ex.id}_${n}`;if(warm.has(key))continue;
    const ld=fromDisplay(draft[`${key}_load`]||0),rp=parseDec(draft[`${key}_reps`])||0;if(ld<=0||rp<=0)continue;
    let rir=parseDec(draft[`${key}_rir`]);if(state.settings.rirMode==="effort")rir=EFFORT_RIR[draft[`${key}_effort`]]??1;
    else if(!Number.isFinite(rir))rir=1;
    rows.push({exerciseId:ex.id,name:ex.name,day:ex.day,load:ld,reps:rp,rir,warmup:false})}
  return rows}
function deltaPreviewFor(ex,draft){const rows=draftRowsForExercise(ex,draft);if(!workingRows(rows).length)return"";
  const cmp=compareExerciseSession(ex,rows);const fd=cmp.metrics?formatDelta(cmp):"";return fd?t("delta.preview",{delta:fd}):""}
// Stalled = 3+ recent sessions at the same working load with no gain in top-set reps.
function isStalled(sess){if(sess.length<3)return false;const r=sess.slice(-3),l0=r[0].med,rep0=r[0].maxReps;
  return r.every(s=>Math.abs(s.med-l0)<0.01)&&r.every(s=>s.maxReps<=rep0)}
// Recover = grinding near failure AND performance did not improve vs prior session (same/lower load).
function recoverSignal(ex,sess,rirCeiling=0.5){sess=sess||sessionsFor(ex);if(sess.length<2)return false;
  const last=sess.at(-1),prior=sess.at(-2);
  if(last.avgRir==null||!(+last.avgRir<=rirCeiling))return false;
  if(last.maxReps==null||last.medReps==null||prior.maxReps==null||prior.medReps==null)return false;
  if(+last.med-+prior.med>=0.01)return false;
  return +last.maxReps<=+prior.maxReps&&+last.medReps<=+prior.medReps}
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
function setWorkoutOverflow(open){const menu=$("#woOverflow");if(!menu)return;
  menu.classList.toggle("hidden",!open);
  $("#woOverflowBtn")?.setAttribute("aria-expanded",open?"true":"false")}
function closeWorkoutOverflow(){setWorkoutOverflow(false)}
function toggleWorkoutOverflow(){setWorkoutOverflow($("#woOverflow")?.classList.contains("hidden"))}
function setLogMode(m){logMode=m;document.body.classList.toggle("is-focus-wo",m==="focus");focusIndex=0;$("#modeFull").classList.toggle("active",m==="full");$("#modeFocus").classList.toggle("active",m==="focus");closeWorkoutOverflow();renderWorkout()}
function goToLogExercise(exId){
  const ex=prog.find(exId);if(!ex)return;
  day=ex.day;
  if(logMode==="focus"){
    const fl=focusList(),idx=fl.findIndex(e=>e.id===exId);
    focusIndex=idx>=0?idx:0;
  }
  const logBtn=$('nav button[data-view="log"]');
  if(logBtn){$$("nav button").forEach(x=>{const on=x===logBtn;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")})}
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="log"));
  document.body.classList.remove("is-settings","is-exercise","is-onboarding");
  enterWorkout({});
  const art=$(`#workout [data-ex="${exId}"]`);if(art){collapsed.delete(exId);art.classList.remove("is-collapsed");art.scrollIntoView({behavior:"smooth",block:"center"})}}
function setStatsSeg(seg){if(!STATS_SEG[seg])return;statsSeg=seg;
  $$("#statsSeg button").forEach(b=>{const on=b.dataset.seg===seg;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false")});
  for(const [k,id] of Object.entries(STATS_SEG)){const el=$("#"+id);if(el)el.classList.toggle("active",k===seg)}
  if(seg==="overview")redrawChart();else if(seg==="strength")renderStrengthDash();else if(seg==="volume")renderVolumeDash();else if(seg==="prs")renderPRTimeline();else if(seg==="review")renderReview()}

// Block (mesocycle) trend — a WEAK signal derived from e1RM across this lift's
// sessions inside the current block. Only tempers aggressiveness / rep targets.
function blockTrendFor(sess){
  const started=state.programMeta?.started;
  if(!started)return{dir:null,sessions:0};
  const block=sess.filter(s=>String(s.date)>=started);
  if(block.length<3)return{dir:null,sessions:block.length};
  const values=block.map(s=>s.bestE1rm);
  if(values.some(v=>!(v>0)))return{dir:null,sessions:block.length};
  const xMean=(values.length-1)/2,yMean=avg(values);
  let covariance=0,variance=0;
  values.forEach((value,index)=>{covariance+=(index-xMean)*(value-yMean);variance+=(index-xMean)**2});
  const projectedChange=variance&&yMean?covariance/variance*(values.length-1)/yMean:0;
  const dir=projectedChange>=.02?"rising":projectedChange<=-.02?"falling":"flat";
  return{dir,sessions:block.length,ratio:1+projectedChange}}
function blockTrendNote(trend){
  if(!trend||!trend.dir||trend.sessions<3)return"";
  return t(`rec.block.${trend.dir}`,{sessions:trend.sessions})}
// Recommendation -> RIR-aware double progression, mapped to a temperature/status.
// Primary signal is the previous session; the block trend nudges it weakly.
function recommendation(ex){
  const sess=sessionsFor(ex);
  if(!sess.length)return{status:"new",heat:.12,label:t("rec.new.label"),text:t("rec.new.text",{min:ex.min,max:ex.max,rirHigh:state.settings.rirHigh}),load:null,stalled:false,block:{dir:null,sessions:0},blockNote:"",pushReps:true};
  const l=sess.at(-1),load=l.med,reps=l.reps,n=reps.length,rir=l.avgRir,rirHigh=+state.settings.rirHigh;
  const atTop=reps.filter(r=>r>=ex.max).length,allTop=atTop===n;
  // Majority rule: on 3+ sets, one near-miss (within a rep of top) shouldn't veto the jump.
  const nearTop=n>=3&&atTop>=n-1&&l.minReps>=ex.max-1;
  const stalled=isStalled(sess);
  const rec=(()=>{
    if((allTop||nearTop)&&rir>=rirHigh+1)return{status:"add2",heat:1,label:t("rec.add2.label"),text:t("rec.add2.text"),load:round(load+jump(load,2)),stalled:false,pushReps:false};
    if(allTop||nearTop)return{status:"add",heat:.82,label:t("rec.add.label"),text:t("rec.add.text"),load:round(load+jump(load,1)),stalled:false,pushReps:false};
    // Reduce uses the typical (median) set, so one junk set won't force a back-off — and it gives a real lighter target.
    if(l.medReps<ex.min)return{status:"reduce",heat:.18,label:t("rec.reduce.label"),text:t("rec.reduce.text",{min:ex.min}),load:Math.max(round(load-jump(load,1)),+state.settings.minJump||2.5),stalled,pushReps:false};
    if(stalled)return{status:"reduce",heat:.3,label:t("rec.stalled.label"),text:t("rec.stalled.text"),load,stalled:true,pushReps:false};
    if(recoverSignal(ex,sess))return{status:"hold",heat:.42,label:t("rec.recover.label"),text:t("rec.recover.text"),load,stalled:false,pushReps:false};
    if(rir>=rirHigh+1)return{status:"hold",heat:.6,label:t("rec.push_reps.label"),text:t("rec.push_reps.text"),load,stalled:false,pushReps:true};
    return{status:"hold",heat:.48,label:t("rec.hold_add_reps.label"),text:t("rec.hold_add_reps.text"),load,stalled:false,pushReps:true};
  })();
  const trend=blockTrendFor(sess);
  // Weak block tempering: a block that is losing strength should not double-jump.
  if(rec.status==="add2"&&trend.dir==="falling"){rec.status="add";rec.heat=.82;rec.label=t("rec.add.label");
    rec.text=t("rec.add.tempered.text");rec.load=round(load+jump(load,1))}
  rec.block=trend;rec.blockNote=blockTrendNote(trend);
  return rec;
}
// Base reps target from the previous-session recommendation (no in-session data yet).
// Load-up / back-off resets to the bottom of the range; holds chase one more rep
// (double progression), capped at the range top. Hold · recover keeps the prior target.
function baseSetReps(ex,rec,old){
  if(rec.status==="add"||rec.status==="add2"||rec.status==="reduce")return ex.min;
  const prev=old&&+old.reps>0?+old.reps:null;
  if(prev==null)return ex.min;
  if(!rec.pushReps)return Math.max(ex.min,Math.min(ex.max,prev));
  return Math.max(ex.min,Math.min(ex.max,prev+1))}
// Per-set load + reps suggestion, layering three signals:
//  1. previous session (rec.load / baseSetReps) — primary
//  2. current-session performance (completed sets this workout) — strong autoregulation
//  3. block trend (folded into rec) — weak
function setSuggestion(ex,n,rec,draft,old){
  const rirHigh=+state.settings.rirHigh,minJ=+state.settings.minJump||2.5;
  const done=new Set(draft.__done||[]),warm=new Set(draft.__warm||[]);
  // Most recent completed working set for this lift earlier in THIS session.
  let prevInSession=null;
  for(let k=n-1;k>=1;k--){const key=`${ex.id}_${k}`;
    if(!done.has(key)||warm.has(key))continue;
    const ld=fromDisplay(parseDec(draft[`${key}_load`])||0),rp=parseDec(draft[`${key}_reps`])||0;
    if(!(ld>0&&rp>0))continue;
    let rir;if(state.settings.rirMode==="effort")rir=EFFORT_RIR[draft[`${key}_effort`]]??1;
    else{rir=parseDec(draft[`${key}_rir`]);if(!Number.isFinite(rir))rir=1}
    prevInSession={load:ld,reps:rp,rir};break}
  if(prevInSession){
    const{load:L,reps:R,rir}=prevInSession;
    if(R>=ex.max&&rir>=rirHigh+1)return{load:round(L+jump(L,1)),reps:ex.min,src:"session-up"};
    if(R<ex.min)return{load:Math.max(round(L-jump(L,1)),minJ),reps:ex.min,src:"session-down"};
    if(rir<=0)return{load:L,reps:Math.max(ex.min,R-1),src:"session-hold"};
    return{load:L,reps:Math.max(ex.min,Math.min(ex.max,R)),src:"session-hold"}}
  return{load:rec.load,reps:rec.load!=null?baseSetReps(ex,rec,old):(old&&+old.reps>0?+old.reps:ex.min),src:"base"}}
// One-line summary of how the current session is steering the next unlogged set.
function inSessionNote(ex,draft){
  const done=new Set(draft.__done||[]),warm=new Set(draft.__warm||[]),changed=new Set(draft.__touched||[]);
  const rec=recommendation(ex),u=unitLabel();
  for(let n=1;n<=ex.sets;n++){const key=`${ex.id}_${n}`;
    if(done.has(key)||warm.has(key)||changed.has(key))continue;
    const sg=setSuggestion(ex,n,rec,draft,null);
    if(sg.src==="session-up")return t("log.insession.up",{set:n,load:fmtLoad(sg.load),unit:u});
    if(sg.src==="session-down")return t("log.insession.down",{set:n,load:fmtLoad(sg.load),unit:u});
    if(sg.src==="session-hold")return t("log.insession.hold",{set:n,load:fmtLoad(sg.load),unit:u,reps:sg.reps})}
  return""}
// After a set is committed, re-apply suggestions to still-untouched later sets.
function refreshSuggestions(exId){const ex=prog.find(exId);if(!ex)return;
  const draft=loadDraft(),rec=recommendation(ex),prev=last(ex);
  for(let n=1;n<=ex.sets;n++){const key=`${ex.id}_${n}`;
    if(committed.has(key)||touched.has(key)||warmups.has(key))continue;
    const old=prev.find(x=>x.set===n),sg=setSuggestion(ex,n,rec,draft,old);
    if(sg.load!=null){const li=$(`[data-k="${key}_load"]`);if(li)li.value=fmtLoadPlain(sg.load)}
    if(sg.reps!=null){const ri=$(`[data-k="${key}_reps"]`);if(ri)ri.value=sg.reps}}
  saveDraft();updateInSessionNote(exId)}
function updateInSessionNote(exId){const art=$(`#workout [data-ex="${exId}"]`);if(!art)return;
  const ex=prog.find(exId);if(!ex)return;const text=inSessionNote(ex,loadDraft());
  let el=art.querySelector(".insession");
  if(!text){el?.remove();return}
  if(el){el.textContent=text;return}
  el=document.createElement("div");el.className="insession";el.textContent=text;
  const anchor=art.querySelector(".delta-prev")||art.querySelector(".prev");
  if(anchor)anchor.insertAdjacentElement("afterend",el);
  else{const head=art.querySelector(".sets__head");if(head)head.insertAdjacentElement("beforebegin",el)}}
function fmtClock(s){const m=Math.floor(s/60);return `${m}:${String(s%60).padStart(2,"0")}`}
function stopRest(){if(restTick){clearInterval(restTick);restTick=null}restEnd=0;const b=$("#restBar");if(b){b.classList.add("hidden");b.classList.remove("is-done")}
  if(window.RepForgeNotify)RepForgeNotify.closeTag("repforge-rest")}
function tickRest(){const b=$("#restBar");if(!b)return;const left=Math.round((restEnd-Date.now())/1000);
  if(left<=0){
    b.querySelector(".restbar__time").textContent="0:00";b.classList.add("is-done");clearInterval(restTick);restTick=null;
    if(restNotified)return;
    restNotified=true;
    if(!window.RepForgeNotify||!RepForgeNotify.enabledFor(state.settings,"timer"))return;
    if(document.visibilityState==="visible")navigator.vibrate?.([200,100,200]);
    else RepForgeNotify.fireOS({title:t("notify.title"),body:t("notify.rest.body"),tag:"repforge-rest",url:"./index.html"});
    return}
  b.querySelector(".restbar__time").textContent=fmtClock(left)}
function startRest(sec){const s=sec||+state.settings.restSec||0;if(s<=0)return;
  restEnd=Date.now()+s*1000;restNotified=false;if(window.RepForgeNotify)RepForgeNotify.closeTag("repforge-rest");
  const b=$("#restBar");if(!b)return;b.classList.remove("hidden","is-done");
  b.querySelector(".restbar__time").textContent=fmtClock(s);
  clearInterval(restTick);restTick=setInterval(tickRest,250)}
/** Shared visibility handler — rest-timer catch-up + session banner. */
function onAppVisible(){
  if(document.visibilityState!=="visible")return;
  if(restEnd&&Date.now()>=restEnd){
    const b=$("#restBar");
    if(b){b.querySelector(".restbar__time").textContent="0:00";b.classList.add("is-done");
      if(restTick){clearInterval(restTick);restTick=null}}
  }
  updateSessionBanner();
}

function updateSessionBanner(){
  const el=$("#sessionBanner"); if(!el) return;
  const n=state.settings.notify;
  const hide=()=>{el.className="sessionbanner hidden"; el.innerHTML=""; el.onclick=null};
  if(!n||!n.enabled) return hide();
  if(RepForgeSchedule.hasLoggedOn(state.log, today())) return hide();
  if(!state.log.length) return hide();

  const due=RepForgeSchedule.mostOverdueDay(state.log, days(), today());
  if(!due) return hide();

  const meta=loadNotifyMeta();
  const hour=new Date().getHours();
  const usual=RepForgeSchedule.usualHour(state.log);
  const missedOk=!!n.missed && usual!=null && hour>=usual;
  const sessionOk=!!n.session;

  if(!missedOk && !sessionOk) return hide();
  if(!missedOk && meta.sessionBannerDate===today() && meta.sessionBannerDismissed) return hide();
  if(missedOk && meta.missedBannerDate===today() && meta.missedBannerDismissed) return hide();

  const isMissed=missedOk;
  const title=isMissed?t("session_banner.missed.title",{hour:usual}):t("session_banner.today.title",{day:due.day});
  const body=isMissed?t("session_banner.missed.body",{day:due.day}):t("session_banner.today.body",{day:due.day});

  function dismissForToday(){
    const m=loadNotifyMeta();
    if(isMissed){m.missedBannerDate=today(); m.missedBannerDismissed=true}
    else{m.sessionBannerDate=today(); m.sessionBannerDismissed=true}
    saveNotifyMeta(m);
    hide();
  }

  el.className=`sessionbanner${isMissed?" is-missed":""}`;
  el.innerHTML=`<button type="button" class="sessionbanner__close" aria-label="${esc(t("session_banner.dismiss_aria"))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`+
    `<p class="sessionbanner__title">${esc(title)}</p><p class="sessionbanner__body">${esc(body)}</p>`;
  el.querySelector(".sessionbanner__close").onclick=e=>{e.stopPropagation();dismissForToday()};
  el.onclick=()=>{
    day=due.day;
    dismissForToday();
    renderTabs(); renderWorkout();
    toast(t("toast.day_ready",{day:due.day}));
  };
}

function draftHasProgress(){try{const d=JSON.parse(localStorage.getItem(DRAFT)||"{}");
  if((d.__done||[]).length||(d.__touched||[]).length||(d.__warm||[]).length)return true;
  return Object.keys(d).some(k=>/_load$/.test(k)&&parseDec(d[k])>0)}catch{return false}}
function setWorkoutActive(on){const was=workoutActive;workoutActive=!!on;
  document.body.classList.toggle("is-workout",workoutActive);
  const dash=$("#todayDash"),shell=$("#workoutShell");
  if(dash)dash.classList.toggle("hidden",workoutActive);
  if(shell)shell.classList.toggle("hidden",!workoutActive);
  if(!workoutActive){document.body.classList.remove("is-focus-wo");closeWorkoutOverflow()}
  updateFocusChrome();
  if(workoutActive!==was)playPanelAnimation(workoutActive?shell:dash,workoutActive?"wo-anim-enter":"wo-anim-leave")}
/** Replay a one-shot CSS animation on a panel that just became visible. */
function playPanelAnimation(el,cls){if(!el)return;
  el.classList.remove("wo-anim-enter","wo-anim-leave");
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener("animationend",()=>el.classList.remove(cls),{once:true})}
function updateFocusChrome(){document.body.classList.toggle("is-focus-wo",workoutActive&&logMode==="focus")}
function focusGo(dir){
  const fl=focusList(),at=fl.length?Math.min(focusIndex,fl.length-1):0,next=at+dir;
  if(next<0||next>=fl.length)return false;
  focusIndex=next;focusEnterFrom=dir>0?1:-1;renderWorkout();window.scrollTo({top:0});return true}
function focusCanGo(dir){const fl=focusList(),at=fl.length?Math.min(focusIndex,fl.length-1):0;
  return at+dir>=0&&at+dir<fl.length}
function focusCard(){return $("#workout.is-focus .exercise.is-current")}
/** Slide the freshly rendered card in from the side the swipe came from. */
function playFocusCardEnter(){
  const card=focusCard();if(!card)return;
  card.style.transform="";card.style.opacity="";
  if(!focusEnterFrom)return;
  const from=focusEnterFrom;focusEnterFrom=0;
  card.classList.add("is-entering");
  card.style.transform=`translateX(${from*60}%) rotate(${from*5}deg)`;card.style.opacity="0";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    card.classList.remove("is-entering");card.style.transform="";card.style.opacity=""}))}
function focusDragStart(e){
  if(focusFlinging||!workoutActive||logMode!=="focus")return;
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const el=e.target instanceof Element?e.target:null;
  // Fields keep their caret; every other part of the card is draggable, with the
  // click that follows a real drag swallowed so buttons don't also fire.
  if(el&&el.closest("input,select,textarea,[contenteditable]"))return;
  const card=focusCard();if(!card)return;
  focusDrag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,axis:null,card}}
function focusDragMove(e){
  if(!focusDrag||e.pointerId!==focusDrag.id)return;
  const mx=e.clientX-focusDrag.x,my=e.clientY-focusDrag.y;
  if(!focusDrag.axis){
    if(Math.abs(mx)<8&&Math.abs(my)<8)return;
    // Vertical intent belongs to the page scroller, so drop the drag entirely.
    if(Math.abs(my)>=Math.abs(mx)){focusDrag=null;return}
    focusDrag.axis="x";focusDrag.card.classList.add("is-dragging")}
  const blocked=(mx>0&&!focusCanGo(-1))||(mx<0&&!focusCanGo(1));
  const dir=mx<0?1:-1;
  if(dir!==focusDrag.shown){focusDrag.shown=dir;showBehindCard(dir)}
  focusDrag.dx=blocked?mx*.28:mx;
  // The card stays opaque while dragging so it reads as lifted over the one behind.
  focusDrag.card.style.transform=`translateX(${focusDrag.dx}px) rotate(${focusDrag.dx/26}deg)`}
/** Point the card behind the deck at the exercise the current drag is heading for. */
function showBehindCard(dir){
  const behind=$(".deck__behind");if(!behind)return;
  const fl=focusList(),at=fl.length?Math.min(focusIndex,fl.length-1):0,ex=fl[at+dir];
  if(!ex)return;
  const m=behind.querySelector(".focus-ex__muscle"),n=behind.querySelector(".focus-ex__name");
  if(m)m.textContent=ex.primary;
  if(n)n.textContent=substituted.get(ex.id)||ex.name}
function swallowNextClick(){
  const stop=ev=>{ev.stopPropagation();ev.preventDefault()};
  document.addEventListener("click",stop,{capture:true,once:true});
  setTimeout(()=>document.removeEventListener("click",stop,{capture:true}),350)}
function focusDragEnd(e){
  if(!focusDrag||(e&&e.pointerId!=null&&e.pointerId!==focusDrag.id))return;
  const{card,dx,axis}=focusDrag;focusDrag=null;
  if(axis!=="x")return;
  if(Math.abs(dx)>8)swallowNextClick();
  card.classList.remove("is-dragging");
  const dir=dx<0?1:-1,width=card.offsetWidth||320;
  const past=Math.abs(dx)>=Math.min(130,Math.max(60,width*.25));
  if(!past||!focusCanGo(dir)){card.style.transform="";card.style.opacity="";return}
  focusFlinging=true;
  card.style.transform=`translateX(${dir>0?"-":""}120%) rotate(${dir>0?-14:14}deg)`;
  card.style.opacity="0";
  setTimeout(()=>{focusFlinging=false;focusGo(dir)},170)}
function enterWorkout(opts={}){workoutLeft=false;setWorkoutActive(true);if(opts.day)day=opts.day;
  // Focus layout matches mock 01; List remains the default for broad editing/tests.
  if(opts.focus===true){logMode="focus";$("#modeFull")?.classList.remove("active");$("#modeFocus")?.classList.add("active")}
  else if(opts.focus===false){logMode="full";$("#modeFocus")?.classList.remove("active");$("#modeFull")?.classList.add("active")}
  document.body.classList.toggle("is-focus-wo",logMode==="focus");
  renderTabs();renderWorkout();renderToday();window.scrollTo({top:0})}
function leaveWorkout(){workoutLeft=true;setWorkoutActive(false);document.body.classList.remove("is-focus-wo");renderToday();window.scrollTo({top:0})}
function dayMuscles(d){const seen=[],exs=exercises(d||day);
  for(const e of exs){const m=String(e.primary||"").split(",")[0].trim();if(m&&!seen.includes(m))seen.push(m);if(seen.length>=3)break}
  return seen}
function formatLongDate(iso){const d=new Date(`${iso}T12:00:00`);if(Number.isNaN(+d))return iso;
  try{const s=d.toLocaleDateString(I18N?.speechLang?.()||state.settings.lang||"en",{weekday:"long",day:"numeric",month:"long"});
    return s?s.charAt(0).toUpperCase()+s.slice(1):s}
  catch{return iso}}
function weekdayLetters(){return state.settings.lang==="pt"?["S","T","Q","Q","S","S","D"]:["M","T","W","T","F","S","S"]}
function renderToday(){const dateEl=$("#todayDate");if(dateEl)dateEl.textContent=formatLongDate(today());
  const mc=mesocycleWeek(),nm=state.programMeta?.name,progEl=$("#todayProgram");
  if(progEl){if(nm||mc.current!=null){progEl.classList.remove("hidden");
    const segs=mc.total||6,cur=mc.current||0;
    progEl.innerHTML=`<div class="today-prog__name">${esc(nm||t("untitled_program"))}</div>`+
      (mc.current!=null?`<div class="today-prog__week">${esc(t("today.week_of",{n:mc.current,total:mc.total}))}</div>`:"")+
      `<div class="segbar">${Array.from({length:segs},(_,i)=>`<span class="segbar__seg${i<Math.min(cur,segs)?" is-done":""}${i===Math.min(cur,segs)-1?" is-current":""}"></span>`).join("")}</div>`}
    else{progEl.classList.add("hidden");progEl.innerHTML=""}}
  const sess=$("#todaySession");if(sess){const exs=exercises(),mus=dayMuscles(),hot=exs.filter(e=>{const s=recommendation(e).status;return s==="add"||s==="add2"}).length;
    sess.innerHTML=`<div class="today-session__name">${esc(day)}</div>`+
      (mus.length?`<div class="today-session__muscles">${esc(mus.join(" · "))}</div>`:"")+
      `<div class="today-session__meta">${esc(t("today.exercise_count",{n:exs.length}))}</div>`+
      (hot?`<button type="button" class="today-ready" id="readyLine"><span class="today-ready__dot" aria-hidden="true"></span>${esc(t("today.ready_to_increase",{n:hot}))}</button>`:"")}
    const ready=$("#readyLine");if(ready)ready.onclick=()=>{enterWorkout({focus:true});
      const first=$("#workout .exercise.is-add, #workout .exercise.is-add2");
      if(first){collapsed.delete(first.dataset.ex);first.classList.remove("is-collapsed");first.scrollIntoView({behavior:"smooth",block:"center"})}}
  // A draft with logged or filled sets means the session is still open.
  const cta=$("#startWorkout")?.querySelector("span");
  if(cta){const key=draftHasProgress()?"today.continue":"today.start";
    cta.setAttribute("data-i18n",key);cta.textContent=t(key)}
  const weekEl=$("#todayWeek");if(weekEl){const w=weeklySnapshot(),{start}=weekRange(today()),letters=weekdayLetters();
    const trained=new Set(state.log.filter(r=>String(r.date)>=start&&String(r.date)<=today()).map(r=>String(r.date)));
    const cells=letters.map((lab,i)=>{const d=new Date(`${start}T12:00:00`);d.setDate(d.getDate()+i);
      const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const isToday=iso===today(),done=trained.has(iso);
      const mark=done?`<span class="week-letters__check">✓</span>`:`<span class="week-letters__dot${isToday?" is-today":""}"></span>`;
      return `<div><div class="week-letters__d">${esc(lab)}</div><div class="week-letters__m">${mark}</div></div>`}).join("");
    weekEl.innerHTML=`<div class="ov-week-line">${esc(t("today.sessions_done",{done:w.completedDays,planned:w.plannedDays}))}</div><div class="week-letters">${cells}</div>`}
  const up=$("#todayUpNext");if(up){const ds=days(),idx=Math.max(0,ds.indexOf(day)),next=ds.length>1?ds[(idx+1)%ds.length]:null;
    if(next){const nEx=exercises(next).length;
      up.innerHTML=`<button type="button" class="listrow" id="upNextBtn"><div class="listrow__main"><div class="listrow__title">${esc(next)}</div>`+
        `<div class="listrow__sub">${esc(t("today.exercise_count",{n:nEx}))}</div></div><span class="chevron" aria-hidden="true"></span></button>`;
      $("#upNextBtn").onclick=()=>enterWorkout({day:next})}
    else up.innerHTML=`<p class="lede">${esc(t("today.no_up_next"))}</p>`}
  const lastEl=$("#todayLast");if(lastEl){const dates=state.log.map(r=>String(r.date)).filter(Boolean).sort();
    if(dates.length){const lastD=dates.at(-1),n=Math.max(0,Math.round((new Date(`${today()}T12:00:00`)-new Date(`${lastD}T12:00:00`))/86400000));
      lastEl.innerHTML=`<span class="today-footer__icon" aria-hidden="true">⏱</span>${esc(n===0?t("today.last_trained_today"):n===1?t("today.last_trained_one"):t("today.last_trained",{n}))}`}
    else lastEl.innerHTML=""}
  const lc=$("#logContext");if(lc){const nm2=state.programMeta?.name,mc2=mesocycleWeek();
    const hasCtx=!!(nm2||mc2.current!=null);
    lc.textContent=hasCtx?(mc2.current!=null?t("log.context.program_week",{name:nm2||t("untitled_program"),n:mc2.current,total:mc2.total}):(nm2||t("untitled_program"))):t("log.context.today");
    // Kept as a hidden deep-link hook; Today shows the program strip instead.
    lc.classList.add("hidden")}
  // Program strip also jumps to Progress → Review (legacy #logContext affordance).
  const progClick=$("#todayProgram");if(progClick&&!progClick.classList.contains("hidden")){
    progClick.style.cursor="pointer";progClick.onclick=()=>{navTo("stats");setStatsSeg("review")}}
  const woTitle=$("#woDayTitle");if(woTitle)woTitle.textContent=day;
  const woSub=$("#woDaySub");if(woSub){const mc3=mesocycleWeek();woSub.textContent=mc3.current!=null?t("today.week_short",{n:mc3.current}):""}
}

function render(){applyI18n();
  // Auto-resume an in-progress session (page reload mid-workout), but never
  // override an explicit leave — otherwise every tab switch re-hides the nav.
  if(!workoutActive&&!workoutLeft&&draftHasProgress())workoutActive=true;
  setWorkoutActive(workoutActive);
  renderToday();renderTabs();renderWorkout();renderStats();renderHistory();renderProgram();renderSettings();renderBlockPrompt();
  updateSessionBanner();
  if(exView&&$("#exercise")?.classList.contains("active"))renderExerciseView()}

function renderTabs(){const ds=days();if(!ds.includes(day))day=ds[0]||"Day 1";
  $("#dayTabs").innerHTML=ds.map(d=>`<button type="button" role="tab" aria-selected="${d===day?"true":"false"}" class="${d===day?"active":""}" data-day="${esc(d)}">${esc(d)}</button>`).join("");
  $$("#dayTabs button").forEach(b=>b.onclick=()=>{day=b.dataset.day;renderTabs();renderWorkout();renderToday()})}

function setFieldVals(ex,n,r,draft,prev){
  const old=prev.find(x=>x.set===n),draftKg=draft[`${ex.id}_${n}_load`],sg=setSuggestion(ex,n,r,draft,old);
  const kgVal=draftKg!=null?draftKg:(sg.load!=null?fmtLoadPlain(sg.load):(old&&old.load!=null?fmtLoadPlain(old.load):""));
  const repsVal=draft[`${ex.id}_${n}_reps`]??(sg.reps!=null?sg.reps:(old&&old.reps!=null?old.reps:ex.min));
  const key=`${ex.id}_${n}`,isW=warmups.has(key);
  const effortVal=draft[`${key}_effort`]||(old&&old.rir!=null?(old.rir>=2.5?"easy":old.rir<=0.5?"max":"hard"):"hard");
  const rirVal=draft[`${key}_rir`]??(old&&old.rir!=null?fmtPlain(old.rir):1);
  return{key,isW,kgVal,repsVal,rirVal,effortVal}}
function setRowHtml(ex,n,r,draft,prev,nextSet,effortMode){
  const{key,isW,kgVal,repsVal,rirVal,effortVal}=setFieldVals(ex,n,r,draft,prev);
  const cls=`${committed.has(key)?"is-done":(touched.has(key)?"":"is-suggested")}${isW?" is-warmup":""}${n===nextSet?" is-next":""}`;
  const rirCell=effortMode
    ?`<div class="effort" role="group" aria-label="${esc(t("log.set_effort_aria",{n}))}">`+
      ["easy","hard","max"].map(e=>`<button type="button" class="effort__btn${effortVal===e?" active":""}" data-eff="${esc(key)}" data-e="${e}">${esc(t("effort."+e))}</button>`).join("")+`</div>`
    :`<input data-k="${ex.id}_${n}_rir" type="text" inputmode="decimal" enterkeyhint="next" aria-label="${esc(t("log.set_rir_aria",{n}))}" value="${esc(rirVal)}">`;
  return `<div class="setrow ${cls}" data-set="${esc(key)}"><button type="button" class="setrow__n" data-warm="${esc(key)}" aria-pressed="${isW?"true":"false"}" title="${esc(t("log.warmup_title"))}">${isW?"W":n}</button>`+
    `<div class="kg"><button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="-1" tabindex="-1" aria-label="${esc(t("log.set_decrease_aria",{n,unit:unitLabel()}))}">−</button>`+
    `<input data-k="${ex.id}_${n}_load" type="text" inputmode="decimal" enterkeyhint="next" aria-label="${esc(t("log.set_unit_aria",{n,unit:unitLabel()}))}" placeholder="${unitLabel()}" value="${esc(kgVal)}">`+
    `<button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="1" tabindex="-1" aria-label="${esc(t("log.set_increase_aria",{n,unit:unitLabel()}))}">+</button></div>`+
    `<input data-k="${ex.id}_${n}_reps" type="text" inputmode="numeric" enterkeyhint="next" aria-label="${esc(t("log.set_reps_aria",{n}))}" value="${esc(repsVal)}">`+
    rirCell+
    `<button type="button" class="saveset" data-save="${esc(key)}" aria-label="${esc(t("log.save_set_aria",{n}))}">${committed.has(key)?"✓":esc(t("log.save_set"))}</button></div>`}
function cursetHtml(ex,n,r,draft,prev,effortMode){
  const{key,kgVal,repsVal,rirVal,effortVal}=setFieldVals(ex,n,r,draft,prev);
  const rirInner=effortMode
    ?`<div class="effort" role="group" aria-label="${esc(t("log.set_effort_aria",{n}))}">`+
      ["easy","hard","max"].map(e=>`<button type="button" class="effort__btn${effortVal===e?" active":""}" data-eff="${esc(key)}" data-e="${e}">${esc(t("effort."+e))}</button>`).join("")+`</div>`
    :`<input class="curset__val" data-k="${ex.id}_${n}_rir" type="text" inputmode="decimal" enterkeyhint="done" aria-label="${esc(t("log.set_rir_aria",{n}))}" value="${esc(rirVal)}">`+
      `<span class="curset__underline" aria-hidden="true"></span>`+
      `<div class="curset__steps"><button type="button" class="stepbtn" data-step="${ex.id}_${n}_rir" data-dir="-1" tabindex="-1" aria-label="${esc(t("log.set_decrease_aria",{n,unit:"RIR"}))}">−</button>`+
      `<button type="button" class="stepbtn" data-step="${ex.id}_${n}_rir" data-dir="1" tabindex="-1" aria-label="${esc(t("log.set_increase_aria",{n,unit:"RIR"}))}">+</button></div>`;
  const repsLab=esc(t("log.reps"));
  return `<div class="curset" data-set="${esc(key)}"><div class="curset__lab">${esc(t("today.current_set"))}</div><div class="curset__grid">`+
    `<div class="curset__cell is-load is-active"><div class="curset__cell-lab is-accent">${esc(t("today.load"))}</div>`+
    `<input class="curset__val" data-k="${ex.id}_${n}_load" type="text" inputmode="decimal" enterkeyhint="next" aria-label="${esc(t("log.set_unit_aria",{n,unit:unitLabel()}))}" value="${esc(kgVal)}">`+
    `<span class="curset__underline" aria-hidden="true"></span>`+
    `<div class="curset__steps"><button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="-1" tabindex="-1" aria-label="${esc(t("log.set_decrease_aria",{n,unit:unitLabel()}))}">−</button>`+
    `<button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="1" tabindex="-1" aria-label="${esc(t("log.set_increase_aria",{n,unit:unitLabel()}))}">+</button></div></div>`+
    `<div class="curset__cell"><div class="curset__cell-lab">${repsLab}</div>`+
    `<input class="curset__val" data-k="${ex.id}_${n}_reps" type="text" inputmode="numeric" enterkeyhint="next" aria-label="${esc(t("log.set_reps_aria",{n}))}" value="${esc(repsVal)}">`+
    `<span class="curset__underline" aria-hidden="true"></span>`+
    `<div class="curset__steps"><button type="button" class="stepbtn" data-step="${ex.id}_${n}_reps" data-dir="-1" tabindex="-1" aria-label="${esc(t("log.set_decrease_aria",{n,unit:repsLab}))}">−</button>`+
    `<button type="button" class="stepbtn" data-step="${ex.id}_${n}_reps" data-dir="1" tabindex="-1" aria-label="${esc(t("log.set_increase_aria",{n,unit:repsLab}))}">+</button></div></div>`+
    `<div class="curset__cell"><div class="curset__cell-lab">${effortMode?esc(term("Effort")):"RIR"}</div>${rirInner}</div></div></div>`+
    `<button type="button" class="saveset btn btn--cta curset__save" data-save="${esc(key)}"><span>${esc(t("today.log_set"))}</span></button>`}
function renderWorkout(){
  if(!workoutActive){updateGauge();updateSessionBanner();return}
  const lc=$("#logContext");if(lc){const nm=state.programMeta?.name,mc=mesocycleWeek();
    lc.textContent=nm||mc.current!=null?(mc.current!=null?t("log.context.program_week",{name:nm||t("untitled_program"),n:mc.current,total:mc.total}):(nm||t("untitled_program"))):t("log.context.today")}
  const draft=loadDraft();
  committed.clear();(draft.__done||[]).forEach(k=>committed.add(k));
  touched.clear();(draft.__touched||[]).forEach(k=>touched.add(k));
  warmups.clear();(draft.__warm||[]).forEach(k=>warmups.add(k));
  const effortMode=state.settings.rirMode==="effort";
  const restOn=+state.settings.restSec>0;
  const hiddenCount=exercises().filter(e=>skipped.has(e.id)).length;
  const banner=hiddenCount?`<div class="skipbar">${esc(t("log.skipbar",{n:hiddenCount}))} <button type="button" class="skipbar__show">${esc(t("log.skipbar.show_all"))}</button></div>`:"";
  const fl=focusList();
  if(logMode==="focus"&&fl.length)focusIndex=Math.min(focusIndex,fl.length-1);
  const curId=logMode==="focus"&&fl.length?fl[focusIndex]?.id:null;
  const at=logMode==="focus"&&fl.length?Math.min(focusIndex,fl.length-1):0;
  const wk=$("#workout");if(!wk)return;wk.classList.toggle("is-focus",logMode==="focus");
  wk.innerHTML=banner+exercises().map(ex=>{
    const r=recommendation(ex),prev=last(ex);
    const prevHtml=prev.length?`<div class="prev"><span>${esc(t("log.prev"))}</span>${prev.map(x=>`${fmtLoad(x.load)}×${x.reps}<small>@${fmt(x.rir)}</small>`).join(" ")}<button type="button" class="copylast" data-copy="${esc(ex.id)}">${esc(t("log.copy_last"))}</button></div>`:"";
    const deltaHtml=(()=>{const txt=deltaPreviewFor(ex,draft);return txt?`<div class="delta-prev">${esc(txt)}</div>`:""})();
    const blockHtml=r.blockNote?`<p class="rec__block">${esc(r.blockNote)}</p>`:"";
    const sessNote=inSessionNote(ex,draft),sessHtml=sessNote?`<div class="insession">${esc(sessNote)}</div>`:"";
    let nextSet=0;for(let n=1;n<=ex.sets;n++){if(!committed.has(`${ex.id}_${n}`)){nextSet=n;break}}
    const isFocusCur=logMode==="focus"&&ex.id===curId;
    // Focus: reopen a tapped committed set instead of advancing past it.
    if(isFocusCur&&focusEditSet&&focusEditSet.exId===ex.id){
      const m=focusEditSet.n;if(m>=1&&m<=ex.sets&&committed.has(`${ex.id}_${m}`)){committed.delete(`${ex.id}_${m}`);touched.add(`${ex.id}_${m}`)}
      nextSet=m>=1&&m<=ex.sets?m:nextSet;focusEditSet=null;
    }
    const rows=Array.from({length:ex.sets},(_,i)=>{
      const n=i+1;if(isFocusCur&&n===nextSet&&nextSet)return"";
      return setRowHtml(ex,n,r,draft,prev,nextSet,effortMode)}).join("");
    const doneTable=(()=>{
      if(!isFocusCur)return"";
      const done=[];for(let n=1;n<=ex.sets;n++){const key=`${ex.id}_${n}`;if(!committed.has(key))continue;
        const{kgVal,repsVal,rirVal}=setFieldVals(ex,n,r,draft,prev);
        const kgDisp=(()=>{const n=parseDec(kgVal);return Number.isFinite(n)?fmt(n):kgVal})();
        const rirDisp=(()=>{const n=parseDec(rirVal);return Number.isFinite(n)?fmt(n):rirVal})();
        done.push(`<button type="button" class="settable__row" data-editset="${esc(key)}" data-editex="${esc(ex.id)}" data-editn="${n}" aria-label="${esc(t("focus.edit_set_aria",{n}))}"><span>${n}</span><span>${esc(kgDisp)}</span><span>${esc(repsVal)}</span><span>${esc(rirDisp)}</span><span class="is-check">✓</span></button>`)}
      if(!done.length)return"";
      return `<div class="settable"><div class="settable__head"><span>${esc(t("log.set"))}</span><span>${esc(unitLabel())}</span><span>${esc(t("log.reps"))}</span><span>RIR</span><span></span></div>${done.join("")}</div>`})();
    const allDone=isFocusCur&&focusList().every(e=>{for(let n=1;n<=e.sets;n++)if(!committed.has(`${e.id}_${n}`))return false;return true});
    // Finish lives next to the sets and only once every exercise is logged;
    // the visually-hidden fallback on the last exercise keeps the harness path.
    const curHtml=!isFocusCur?"":nextSet?cursetHtml(ex,nextSet,r,draft,prev,effortMode)
      :allDone?`<div class="focus-done"><p class="focus-done__msg">${esc(t("focus.all_done"))}</p>`+
        `<button type="button" class="btn btn--cta" data-ffinish><span>${esc(t("log.finish"))}</span></button></div>`
      :"";
    // The card behind the current one: its lip shows at rest and the whole card is
    // revealed while dragging, so the deck reads as swipeable without any hint copy.
    const behindEx=!isFocusCur?null:fl[at+1]||fl[at-1]||null;
    const peeks=!isFocusCur?"":
      (at>0?`<div class="deck__peek deck__peek--prev" aria-hidden="true"></div>`:"")+
      (at<fl.length-1?`<div class="deck__peek deck__peek--next" aria-hidden="true"></div>`:"")+
      (behindEx?`<div class="deck__behind" aria-hidden="true"><p class="focus-ex__muscle">${esc(behindEx.primary)}</p>`+
        `<h3 class="focus-ex__name">${esc(substituted.get(behindEx.id)||behindEx.name)}</h3></div>`:"");
    const perf=substituted.get(ex.id);
    const nameLabel=perf?`${esc(perf)} <span class="ex__subfor">${esc(t("log.substitute_for",{name:ex.name}))}</span>`:esc(ex.name);
    const nameHtml=`<button type="button" class="ex__name ex__namebtn" data-exopen="${esc(ex.id)}" aria-label="${esc(t("log.open_exercise_aria",{name:perf||ex.name}))}">${nameLabel}</button>`;
    const noteVal=draft.__exnotes?.[ex.id]??lastExerciseNote(ex);
    const notePreview=noteVal?esc(noteVal):esc(t("log.note.empty"));
    const noteHtml=`<div class="exnote${noteVal?" has-note":""}">`+
      `<button type="button" class="exnote__toggle" data-exnote-toggle="${esc(ex.id)}" aria-expanded="false" aria-controls="exnote_${esc(ex.id)}">`+
      `<span class="exnote__lab">${esc(t("log.note"))}</span><span class="exnote__preview">${notePreview}</span></button>`+
      `<textarea class="exnote__input hidden" id="exnote_${esc(ex.id)}" data-exnote="${esc(ex.id)}" rows="2" `+
      `placeholder="${esc(t("log.note.placeholder"))}" aria-label="${esc(t("log.note_aria",{name:ex.name}))}">${esc(noteVal)}</textarea></div>`;
    const subPick=ex.alternates?.length?`<div class="subst"><span class="subst__lab">${esc(t("log.substitute.label"))}</span><select class="subst__pick" data-sub="${esc(ex.id)}" aria-label="${esc(t("log.substitute.aria",{name:ex.name}))}">`+
      `<option value=""${!perf?" selected":""}>${esc(ex.name)}</option>`+
      ex.alternates.map(a=>`<option value="${esc(a)}"${perf===a?" selected":""}>${esc(a)}</option>`).join("")+
      `<option value="__other__"${perf&&!ex.alternates.includes(perf)&&perf!==ex.name?" selected":""}>${esc(t("log.substitute.other"))}</option></select></div>`:"";
    const recHead=r.load!=null?t("today.rec_keep",{load:fmtLoad(r.load),unit:unitLabel()}):r.label;
    const recBlock=`<div class="recblock is-${r.status}"><div class="recblock__lab">${esc(t("today.recommendation"))}</div>`+
      `<div class="recblock__head">${esc(recHead)}</div><p class="recblock__body">${esc(r.text)}</p>${blockHtml}</div>`;
    const setX=nextSet||ex.sets;
    const focusHead=isFocusCur?`<p class="focus-ex__muscle">${esc(ex.primary)}</p>`+
      `<div class="focus-ex__row"><h3 class="focus-ex__name">${nameHtml}</h3>`+
      `<div class="focus-ex__setof">${esc(t("today.set_of",{x:" ",y:ex.sets})).replace(" ",`<b>${setX}</b>`)}</div></div>`+
      `<div class="focus-ex__target-row"><p class="focus-ex__target"><span class="focus-ex__alvo">${esc(t("today.target_label"))}</span>${esc(t("today.target_rest",{min:ex.min,max:ex.max,rir:fmt(state.settings.rirHigh)}))}</p>`+
      `<span class="focus-ex__tools">`+
      (restOn?`<button type="button" class="ex__rest" data-rest="1" aria-label="${esc(t("log.rest_aria"))}">⏱</button>`:"")+
      `<button type="button" class="icon-btn icon-btn--note" data-exnote-toggle="${esc(ex.id)}" aria-label="${esc(t("log.note_aria",{name:ex.name}))}"><span class="icon-mask icon-mask--note" aria-hidden="true"></span></button></span></div>`:"";
    const listHead=`<div class="ex__top"><div class="ex__head"><h3 class="ex__nameh">${nameHtml}</h3>`+
      `<p class="ex__meta"><span class="ex__tag">${esc(ex.primary)}</span><span class="nowrap">${ex.sets}×${ex.min}-${ex.max} reps</span> · <span class="nowrap">${term("RIR")} 0-${fmt(state.settings.rirHigh)}</span></p></div>`+
      `<div class="ex__topend">`+
      (restOn?`<button type="button" class="ex__rest" data-rest="1" aria-label="${esc(t("log.rest_aria"))}">⏱</button>`:"")+
      `<button type="button" class="ex__skip" data-skip="${esc(ex.id)}" aria-label="${esc(t("log.skip_aria",{name:ex.name}))}">${esc(t("log.skip"))}</button>`+
      `<button type="button" class="ex__caret" data-collapse="${esc(ex.id)}" aria-label="${esc(t("log.toggle_sets_aria",{name:ex.name}))}"><span class="icon-mask icon-mask--sm icon-mask--chev-down" aria-hidden="true"></span></button></div></div>`;
    return (isFocusCur?`<div class="deck">${peeks}`:"")+
      `<article class="exercise is-${r.status}${collapsed.has(ex.id)?" is-collapsed":""}${skipped.has(ex.id)?" is-skipped":""}${isFocusCur?" is-current":""}" data-ex="${esc(ex.id)}">`+
      (isFocusCur?focusHead:listHead)+
      `<div class="heat"><span class="heat__track"><span class="heat__fill" style="width:${Math.round(r.heat*100)}%"></span></span>`+
      `<span class="chip">${esc(r.label)}</span></div>`+
      (isFocusCur?doneTable+curHtml:"")+
      (isFocusCur?"":recBlock)+
      (ex.notes?`<p class="setup"><span>${esc(t("log.setup"))}</span>${esc(ex.notes)}</p>`:"")+
      subPick+
      prevHtml+deltaHtml+sessHtml+
      (isFocusCur?`<div class="focus-sets-sr">${rows}</div>`:`<div class="sets__head"><span>${esc(t("log.set"))}</span><span>${unitLabel()}</span><span>${esc(t("log.reps"))}</span><span>${effortMode?term("Effort"):term("RIR")}</span><span></span></div>${rows}`)+
      (isFocusCur?recBlock:"")+
      noteHtml+`</article>`+(isFocusCur?`</div>`:"");
  }).join("");
  bindWorkout();
  updateGauge();updateSaveMeta();renderFatigue();
  updateBodyweightField();
  updateSessionBanner();
  updateFocusChrome();
}

// Keep the "next set up" marker on the first unsaved row of an exercise card.
function updateNextMarker(art){if(!art)return;let found=false;
  art.querySelectorAll(".setrow").forEach(r=>{const on=!found&&!r.classList.contains("is-done");if(on)found=true;
    r.classList.toggle("is-next",on)})}
function refreshAfterCommittedEdit(row){
  if(!row?.dataset.set||!committed.has(row.dataset.set))return;
  const exId=row.closest(".exercise")?.dataset.ex;
  if(exId)refreshSuggestions(exId)}

function updateExerciseDeltaPreview(exId){const art=$(`#workout [data-ex="${exId}"]`);if(!art)return;
  const ex=prog.find(exId);if(!ex)return;const text=deltaPreviewFor(ex,loadDraft()),el=art.querySelector(".delta-prev");
  if(!text){el?.remove();return}
  if(el)el.textContent=text;else{const n=document.createElement("div");n.className="delta-prev";n.textContent=text;
    const anchor=art.querySelector(".prev")||art.querySelector(".sets__head");
    if(anchor)anchor.insertAdjacentElement(anchor.classList.contains("sets__head")?"beforebegin":"afterend",n)}}

// Latest note the lifter left on this exercise, so machine setup carries into the next session.
function lastExerciseNote(ex){const match=matchLift(ex);
  const rows=state.log.filter(r=>match(r)&&String(r.exNote||"").trim());
  if(!rows.length)return"";
  const latest=rows.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.created).localeCompare(String(b.created))).at(-1);
  return String(latest.exNote).trim()}
function currentExerciseNote(exId){const el=$(`[data-exnote="${exId}"]`);
  if(el)return el.value.trim();
  const d=loadDraft().__exnotes||{};return String(d[exId]??"").trim()}

function saveDraft(){const d={};$$("#workout input").forEach(x=>d[x.dataset.k]=x.value);
  $$("#workout .effort__btn.active").forEach(b=>d[`${b.dataset.eff}_effort`]=b.dataset.e);
  // Store every note field, empty included — an empty value is the lifter clearing a carried-forward note.
  const notes={};$$("#workout [data-exnote]").forEach(t=>notes[t.dataset.exnote]=t.value);
  if(Object.keys(notes).length)d.__exnotes=notes;
  d.__done=[...committed];d.__touched=[...touched];d.__warm=[...warmups];
  if(lastCommitAt&&committed.size)d.__lastCommitAt=lastCommitAt;
  localStorage.setItem(DRAFT,JSON.stringify(d))}

function bindWorkout(){
  $$("#workout input").forEach(i=>{i.oninput=()=>{const row=i.closest(".setrow, .curset");
    if(row&&row.dataset.set){touched.add(row.dataset.set);row.classList.remove("is-suggested")}
    saveDraft();updateSaveMeta();
    const m=i.dataset.k?.match(/^(.+)_\d+_/);if(m)updateExerciseDeltaPreview(m[1]);
    refreshAfterCommittedEdit(row)};
  i.onfocus=()=>i.select()});
  $$("#workout .term").forEach(b=>b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)});
  $$("#workout .saveset").forEach(b=>b.onclick=()=>{const key=b.dataset.save;
    const load=parseDec($(`[data-k="${key}_load"]`)?.value)||0;
    if(load<=0){toast(t("toast.enter_weight_before_save_set"));return}
    const row=b.closest(".setrow, .curset");
    if(committed.has(key)){committed.delete(key)}
    else{committed.add(key);touched.add(key)}
    if(row){row.classList.toggle("is-done",committed.has(key));row.classList.remove("is-suggested");
      if(b.classList.contains("visually-hidden")===false)b.textContent=committed.has(key)?"✓":t("log.save_set");
      updateNextMarker(row.closest(".exercise"))}
    if(committed.has(key))lastCommitAt=Date.now();
    saveDraft();updateSaveMeta();
    const exId=b.closest(".exercise")?.dataset.ex;if(exId)refreshSuggestions(exId);
    if(committed.has(key)){startRest();armUnfinishedWatch()}
    if(logMode==="focus")renderWorkout();
    else updateFocusChrome()});
  $$("#workout [data-warm]").forEach(b=>b.onclick=()=>{const key=b.dataset.warm;
    warmups.has(key)?warmups.delete(key):warmups.add(key);saveDraft();renderWorkout()});
  $$("#workout .stepbtn").forEach(b=>b.onclick=()=>{const inp=$(`[data-k="${b.dataset.step}"]`);if(!inp)return;
    const key=b.dataset.step||"",dir=+b.dataset.dir||0;
    if(/_reps$|_rir$/.test(key)){
      const cur=parseDec(inp.value)||0;inp.value=fmtPlain(Math.max(0,cur+dir));
    }else{
      const incKg=parseDec(state.settings.minJump)||2.5,curKg=fromDisplay(inp.value||0),
        nextKg=Math.max(0,Math.round((curKg+incKg*dir)/incKg)*incKg);
      inp.value=fmtPlain(toDisplay(nextKg));
    }
    const row=inp.closest(".setrow, .curset");
    if(row&&row.dataset.set){touched.add(row.dataset.set);row.classList.remove("is-suggested")}
    saveDraft();updateSaveMeta();refreshAfterCommittedEdit(row)});
  $$("#workout .copylast").forEach(b=>b.onclick=()=>{const prevSets=last({id:b.dataset.copy});if(!prevSets.length)return;
    const d=loadDraft();
    for(const s of prevSets){const key=`${b.dataset.copy}_${s.set}`;touched.add(key);
      if(state.settings.rirMode==="effort")d[`${key}_effort`]=+s.rir>=2.5?"easy":+s.rir<=0.5?"max":"hard";
      for(const f of ["load","reps"]){const inp=$(`[data-k="${key}_${f}"]`);if(inp)inp.value=f==="load"?fmtPlain(toDisplay(s.load)):fmtPlain(s[f])}
      if(state.settings.rirMode!=="effort"){const inp=$(`[data-k="${key}_rir"]`);if(inp)inp.value=fmtPlain(s.rir)}}
    localStorage.setItem(DRAFT,JSON.stringify(d));saveDraft();renderWorkout();toast(t("toast.filled_from_last"))});
  $$("#workout .ex__rest").forEach(b=>b.onclick=()=>startRest());
  $$("#workout .ex__skip").forEach(b=>b.onclick=()=>{const id=b.dataset.skip;
    skipped.has(id)?skipped.delete(id):skipped.add(id);
    if(logMode==="focus"){const fl=focusList();focusIndex=Math.min(focusIndex,Math.max(0,fl.length-1))}
    renderWorkout()});
  $$("#workout .subst__pick").forEach(sel=>{sel.onchange=()=>{const id=sel.dataset.sub;
    if(sel.value==="__other__"){const v=prompt(t("prompt.alternate_exercise_name"),substituted.get(id)||"");
      if(v==null){renderWorkout();return}
      const t=String(v).trim().slice(0,80);
      if(!t||t===prog.find(id)?.name){substituted.delete(id)}else{substituted.set(id,t)}
    }else if(!sel.value){substituted.delete(id)}else{substituted.set(id,sel.value)}
    renderWorkout()}});
  $$("#workout .effort__btn").forEach(b=>b.onclick=()=>{const key=b.dataset.eff;
    b.closest(".effort")?.querySelectorAll(".effort__btn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");touched.add(key);
    const row=b.closest(".setrow, .curset");if(row)row.classList.remove("is-suggested");
    saveDraft();updateSaveMeta();refreshAfterCommittedEdit(row)});
  $$("#workout [data-exnote-toggle]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.exnoteToggle;let wrap=b.closest(".exnote");
    if(!wrap&&id)wrap=$(`#workout [data-ex="${id}"] .exnote`);
    const ta=wrap?.querySelector(".exnote__input");if(!ta)return;
    const open=ta.classList.toggle("hidden")===false;b.setAttribute("aria-expanded",open?"true":"false");
    wrap.classList.toggle("is-open",open);
    if(open){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)}});
  $$("#workout .exnote__input").forEach(t=>{t.oninput=()=>{saveDraft();
    const prev=t.closest(".exnote")?.querySelector(".exnote__preview");
    if(prev)prev.textContent=t.value.trim()||t("log.note.empty");
    t.closest(".exnote")?.classList.toggle("has-note",!!t.value.trim())}});
  $$("#workout .ex__namebtn").forEach(b=>b.onclick=()=>openExerciseView(b.dataset.exopen,"log"));
  const sb=$("#workout .skipbar__show");if(sb)sb.onclick=()=>{skipped.clear();renderWorkout()};
  $$("#workout .ex__caret").forEach(b=>b.onclick=()=>{const id=b.dataset.collapse,art=b.closest(".exercise");if(!art)return;
    const now=!collapsed.has(id);now?collapsed.add(id):collapsed.delete(id);art.classList.toggle("is-collapsed",now)});
  if(logMode==="focus"){const fl=focusList();const at=fl.length?Math.min(focusIndex,fl.length-1):0;
    const progEl=$("#woProgress");
    if(progEl){progEl.classList.remove("hidden");
      progEl.innerHTML=`<div class="wo-progress__top">`+
        `<button type="button" class="focusnav" id="woPrev" aria-label="${esc(t("focus.prev_ex"))}"${at<=0?" disabled":""}>‹</button>`+
        `<div class="wo-progress__lab">${esc(t("today.exercise_of",{n:fl.length?at+1:0,m:fl.length}))}</div>`+
        `<button type="button" class="focusnav" id="woNext" aria-label="${esc(t("focus.next_ex"))}"${at>=fl.length-1?" disabled":""}>›</button></div>`+
        `<div class="segbar segbar--ex">${fl.map((_,i)=>`<span class="segbar__seg${i<at?" is-done":""}${i===at?" is-current":""}"></span>`).join("")}</div>`;
      $("#woPrev").onclick=()=>focusGo(-1);
      $("#woNext").onclick=()=>focusGo(1)}
    const f=$("[data-ffinish]");if(f)f.onclick=()=>$("#logForm").requestSubmit();
    // Tap a committed set row to reopen it for editing in the steppers.
    $$("#workout [data-editset]").forEach(b=>b.onclick=()=>{
      focusEditSet={exId:b.dataset.editex,n:+b.dataset.editn};saveDraft();renderWorkout()});
    playFocusCardEnter()}
  else{$("#woProgress")?.classList.add("hidden")}
  updateFocusChrome();
}

function updateGauge(){const exs=exercises();const hot=exs.filter(e=>{const s=recommendation(e).status;return s==="add"||s==="add2"}).length;
  const g=$("#heatGauge"),frac=exs.length?hot/exs.length:0;
  if(g){const fill=g.querySelector(".gauge__fill"),lab=g.querySelector(".gauge__label");
    if(fill)fill.style.width=`${Math.round(frac*100)}%`;
    if(lab)lab.textContent=hot?t("top.gauge.hot",{n:hot}):t("top.gauge.forge");
    g.classList.toggle("is-hot",hot>0);
    g.style.cursor=hot?"pointer":"default";
    g.onclick=hot?()=>{enterWorkout({});const first=$("#workout .exercise.is-add, #workout .exercise.is-add2");if(first){collapsed.delete(first.dataset.ex);first.classList.remove("is-collapsed");first.scrollIntoView({behavior:"smooth",block:"center"})}}:null}
}

function renderFatigue(){const el=$("#fatigue");if(!el)return;const exs=exercises();
  const flagged=exs.filter(e=>{const r=recommendation(e);return r.status==="reduce"||r.stalled}).length;
  if(exs.length>=3&&flagged>=2){el.className="fatigue";el.innerHTML=`<b>${esc(t("log.fatigue.title"))}</b> — ${esc(t("log.fatigue.body",{n:flagged}))} `+
    `<button type="button" class="fatigue__trim">${esc(t("log.fatigue.trim"))}</button>`;
    $("#fatigue .fatigue__trim").onclick=()=>{skipped.clear();
      for(const e of exs){const s=recommendation(e).status;if(!(s==="add"||s==="add2"))skipped.add(e.id)}
      renderWorkout();toast(t("toast.trimmed_priority"))}}
  else el.className="fatigue hidden",el.innerHTML="";}

function updateSaveMeta(){const exs=exercises(),planned=sum(exs.map(e=>e.sets));
  const done=[...committed].length;
  const entered=$$("#workout input").filter(i=>i.dataset.k&&i.dataset.k.endsWith("_load")&&parseDec(i.value)>0).length;
  $("#saveMeta").textContent=done?t("log.save_meta.done",{day,done,planned}):(entered?t("log.save_meta.entered",{day,entered,planned}):t("log.save_meta.planned",{day,planned}));}

function saveWorkout(e){e.preventDefault();if(saving)return;saving=true;
  try{const date=$("#date").value||today(),session=`${date}_${day}_${uid()}`,notes=$("#notes").value.trim(),created=new Date().toISOString(),rows=[];
  const bwRaw=$("#bodyweight").value,bw=bwRaw===""||bwRaw==null?0:posNum(fromDisplay(bwRaw));
  for(const ex of exercises()){if(skipped.has(ex.id))continue;
    const exNote=currentExerciseNote(ex.id);
    for(let n=1;n<=ex.sets;n++){
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
    if(exNote)row.exNote=exNote;
    if(warmups.has(key))row.warmup=true;
    if(bw>0)row.bodyweight=bw;
    rows.push(row)}}
  if(!rows.length){toast(t("toast.enter_weight_before_save"));return}
  const prLifts=[];
  for(const ex of exercises()){if(skipped.has(ex.id))continue;
    const mine=rows.filter(r=>r.exerciseId===ex.id&&!r.warmup);if(!mine.length)continue;
    const newTop=Math.max(...mine.map(r=>+r.load));
    const match=matchLift(ex);
    const prevTop=Math.max(0,...state.log.filter(x=>match(x)&&isWork(x)).map(r=>+r.load));
    if(newTop>prevTop&&prevTop>0)prLifts.push(`${ex.name} ${fmtLoad(newTop)} ${unitLabel()}`)}
  state.log.push(...rows);save();clearDraft();committed.clear();touched.clear();warmups.clear();substituted.clear();$("#notes").value="";
  const btn=$(".btn--save");btn.classList.remove("is-stamped");void btn.offsetWidth;btn.classList.add("is-stamped");
  const delta=sessionDeltaCounts(rows),deltaTxt=formatDeltaCounts(delta,{sep:", "});
  let msg=t("toast.workout_forged",{n:rows.length,sets:tp(rows.length,"set")});
  if(prLifts.length)msg+=` ${t("toast.workout_pr",{items:prLifts.join(", ")})}`;
  if(deltaTxt)msg+=` ${deltaTxt}.`;
  toast(msg);render()}finally{saving=false}}

function summaries(){const m=new Map();
  for(const x of state.log){if(!isWork(x))continue;const k=`${x.session}|${liftKey(x)}`;if(!m.has(k))m.set(k,{session:x.session,date:x.date,day:x.day,liftKey:liftKey(x),name:displayName(x),loads:[],reps:[],rirs:[],sets:0});
    const o=m.get(k);o.loads.push(+x.load);o.reps.push(+x.reps);o.rirs.push(+x.rir);o.sets++}
  return [...m.values()].map(o=>{let top=0,topReps=0,vol=0,best=0;
    o.loads.forEach((ld,i)=>{const rp=o.reps[i];vol+=ld*rp;const e=e1rm(ld,rp);if(e>best)best=e;if(ld>top){top=ld;topReps=rp}});
    return{session:o.session,date:o.date,day:o.day,liftKey:o.liftKey,name:o.name,top,topReps,reps:sum(o.reps),rir:avg(o.rirs),sets:o.sets,volume:vol,e1rm:best};})
    .sort((a,b)=>a.date.localeCompare(b.date)||a.session.localeCompare(b.session))}

function strengthDashboard(){
  const byLift=new Map();for(const s of summaries()){(byLift.get(s.liftKey)||byLift.set(s.liftKey,[]).get(s.liftKey)).push(s)}
  const prN=new Map();for(const ev of detectPRs(state.log)){const k=ev.exerciseId||ev.exerciseName;prN.set(k,(prN.get(k)||0)+1)}
  const rows=[];
  for(const [k,sess] of byLift){const latest=sess.at(-1),first=sess[0],best=Math.max(...sess.map(s=>s.e1rm));
    const ex=state.program.find(e=>e.id===k)||state.program.find(e=>e.name===k);
    const rec=ex?recommendation(ex):{label:"—"};
    rows.push({exercise:latest.name,latest:`${fmtLoad(latest.top)}×${latest.topReps}`,best,blockDelta:latest.e1rm-first.e1rm,
      prs:prN.get(k)||prN.get(latest.name)||0,lastTrained:latest.date,signal:rec.label})}
  return rows.sort((a,b)=>a.exercise.localeCompare(b.exercise))}
window.__repforgeStrengthDashboard=strengthDashboard;

function renderStrengthDash(){const el=$("#strengthDash");if(!el)return;const rows=strengthDashboard();
  if(!rows.length){el.innerHTML=`<div class="empty">${esc(t("stats.empty.no_lifts"))}</div>`;return}
  const u=unitLabel(),fmtDelta=d=>{const n=toDisplay(d),a=Math.abs(n);const s=n>0?"+":n<0?"-":"";return s+(a?fmt(Math.round(a)):0)};
  el.innerHTML=table(rows.map(r=>({[t("stats.table.exercise")]:r.exercise,[t("stats.table.latest")]:r.latest,[t("stats.table.best_e1rm_unit",{unit:u})]:fmt(Math.round(toDisplay(r.best))),
    [t("stats.table.delta_block")]:fmtDelta(r.blockDelta),[t("stats.table.prs")]:r.prs,[t("stats.table.signal")]:r.signal})))}

function renderThisWeek(){const el=$("#thisWeek");if(!el)return;const w=weeklySnapshot();
  const attnN=(attentionGroups().find(g=>g.key==="reduce")?.items.length||0)+(attentionGroups().find(g=>g.key==="stale")?.items.length||0);
  const withHist=prog.exercises.filter(e=>sessionsFor(e).length).length;
  const flatGuess=Math.max(0,withHist-w.improvedLifts-(attnN||0)-(w.readyToAdd||0));
  el.innerHTML=`<div class="ov-week-line">${esc(t("stats.this_week.line",{done:w.completedDays,planned:w.plannedDays,hardSets:`${w.totalHardSets} ${tp(w.totalHardSets,"hard set")}`}))}</div>`+
    `<div class="ov-week-status">${esc(t("stats.this_week.status",{status:w.status}))}</div>`+
    `<div class="statrow">`+
    `<div class="statrow__cell"><div class="statrow__val">${w.improvedLifts}</div><div class="statrow__cap">${esc(t("stats.this_week.improved"))}</div></div>`+
    `<div class="statrow__cell"><div class="statrow__val">${flatGuess}</div><div class="statrow__cap">${esc(t("stats.this_week.stable"))}</div></div>`+
    `<div class="statrow__cell${attnN?" is-attn":""}"><div class="statrow__val">${attnN||0}${attnN?`<span class="statrow__dot"></span>`:""}</div><div class="statrow__cap">${esc(t("stats.this_week.attention"))}</div></div>`+
    `</div>`}
function renderOverviewVolume(){const el=$("#overviewVolume");if(!el)return;
  const rows=volumeDashboard(7),planned=prog.volume(),max=Math.max(...rows.map(r=>Math.max(r.planned,r.completed7)),1);
  el.innerHTML=rows.length?rows.slice(0,8).map(r=>{
    const on=r.planned>0&&r.completed7>=r.planned*0.6&&r.completed7<=r.planned*1.3;
    const below=r.planned>0&&r.completed7<r.planned*0.6;
    const pct=Math.max(4,Math.round((r.completed7/max)*100));
    return `<div class="vrow"><span class="vrow__name">${esc(r.muscle)}</span>`+
      `<span class="vrow__bar"><span class="vrow__fill${on?" is-on":""}" style="width:${pct}%"></span></span>`+
      `<span class="vrow__num">${fmt(r.completed7)} / ${fmt(r.planned)}</span>`+
      `<span class="vrow__status${on?" is-on":""}">${esc(below?t("stats.volume_below"):t("stats.volume_on_target"))}</span></div>`}).join("")
    :`<div class="empty">${esc(t("stats.empty.no_hard_sets",{n:7}))}</div>`}
function renderReadyList(){const el=$("#readyList");if(!el)return;
  const add=attentionGroups().find(g=>g.key==="add");
  if(!add?.items.length){el.innerHTML="";readyExpanded=false;return}
  const items=add.items,cap=4,shown=readyExpanded?items:items.slice(0,cap),more=items.length-cap;
  const row=({ex,why})=>{const r=recommendation(ex);const prev=last(ex);const base=prev.find(s=>s.set===1)?.load??prev[0]?.load;
      const delta=r.load!=null&&base!=null?r.load-base:null;
      const deltaTxt=delta!=null?`+${fmtLoad(Math.abs(delta))} ${unitLabel()}`:r.label;
      return `<button type="button" class="ready-row listrow" data-ready="${esc(ex.id)}"><div class="listrow__main"><div class="listrow__title">${esc(ex.name)}</div>`+
        `<div class="listrow__sub">${esc(why)}</div></div><span class="ready-row__delta">${esc(deltaTxt)}<span class="chevron" aria-hidden="true"></span></span></button>`};
  el.innerHTML=`<p class="section-label">${esc(t("stats.ready_to_progress"))}</p>`+shown.map(row).join("")+
    (more>0&&!readyExpanded?`<button type="button" class="link-row-cta" id="readySeeAll"><span>${esc(t("stats.ready_see_all",{n:items.length}))}</span><span class="chevron" aria-hidden="true"></span></button>`:"");
  $$("#readyList [data-ready]").forEach(b=>b.onclick=()=>openExerciseView(b.dataset.ready,"stats"));
  const see=$("#readySeeAll");if(see)see.onclick=()=>{readyExpanded=true;renderReadyList()}}
function recentDeltaRows(){const sessMap=new Map();
  for(const x of state.log){if(!sessMap.has(x.session))sessMap.set(x.session,{session:x.session,date:x.date,created:x.created})}
  const recent=[...sessMap.values()].sort((a,b)=>String(b.created).localeCompare(String(a.created))||String(b.date).localeCompare(String(a.date))).slice(0,10);
  const out=[];
  for(const sess of recent){const byLift=new Map();
    for(const r of state.log.filter(x=>x.session===sess.session)){const k=liftKey(r);if(!byLift.has(k))byLift.set(k,[]);byLift.get(k).push(r)}
    for(const rows of byLift.values()){if(!workingRows(rows).length)continue;
      const ex=prog.find(rows[0].exerciseId)||{id:rows[0].exerciseId,name:rows[0].name,day:rows[0].day};
      const cmp=compareExerciseSession(ex,rows);if(cmp.status==="not_comparable")continue;
      const m=cmp.metrics?.current||exerciseSessionMetrics(rows);
      out.push({[t("stats.table.date")]:shortDate(sess.date),[t("stats.table.exercise")]:displayName(rows[0]),[t("stats.table.status")]:cmp.label,[t("stats.table.load")]:fmtLoad(m.topLoad),[t("stats.table.reps")]:m.totalReps,
        [t("stats.table.e1rm")]:fmt(Math.round(toDisplay(m.bestE1rm))),[t("stats.table.delta")]:cmp.status==="new"?"—":formatDelta(cmp)||"—"})}}
  return out}

function renderStats(){
  // First run: point at the Log tab instead of an all-zero dashboard.
  const hasLog=state.log.some(isWork),intro=$("#statsIntro");
  if(intro){
    intro.classList.toggle("hidden",hasLog);
    intro.innerHTML=hasLog?"":`<p class="emptystate__title">${esc(t("stats.empty.title"))}</p>`+
      `<p class="emptystate__body">${esc(t("stats.empty.body"))}</p>`+
      `<button type="button" class="btn btn--cta" id="statsIntroGo">${esc(t("stats.empty.cta"))}</button>`;
    const go=$("#statsIntroGo");if(go)go.onclick=()=>navTo("log");
    for(const sel of["#thisWeek","#readyList","#attention","#metrics","#statsDeep","#overviewVolume"]){const el=$(sel);if(el)el.classList.toggle("hidden",!hasLog)}
  }
  renderThisWeek();
  renderReadyList();
  renderOverviewVolume();
  // Stat exercise options: label shows performed name when set; value is liftKey for exerciseId-backed roll-up.
  const keys=[...new Set(state.log.filter(isWork).map(liftKey))].sort();
  const keyLabel=k=>{const rows=state.log.filter(r=>liftKey(r)===k);
    const latest=[...rows].sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0];
    return latest?displayName(latest):k};
  const sums=summaries();
  const totalVol=sum(state.log.filter(isWork).map(x=>(+x.load||0)*(+x.reps||0)));
  const bestE=state.log.length?Math.max(...state.log.filter(isWork).map(x=>e1rm(+x.load,+x.reps))):0;
  const lc=s=>s?s.charAt(0).toLowerCase()+s.slice(1):s;
  const tiles=[
    {label:lc(t("stats.metric.sessions")),val:new Set(state.log.map(x=>x.session)).size},
    {label:lc(t("stats.metric.sets_logged")),val:state.log.length},
    {label:lc(t("stats.metric.volume")),val:kfmt(toDisplay(totalVol)),unit:unitLabel()},
    {label:lc(t("stats.metric.best_e1rm")),val:fmt(Math.round(toDisplay(bestE))),unit:unitLabel(),hot:bestE>0},
  ];
  $("#metrics").innerHTML=tiles.map(t=>`<div class="metric${t.hot?" metric--hot":""}"><div class="metric__val">${t.val}${t.unit?`<small>${t.unit}</small>`:""}</div><div class="metric__label">${t.label}</div></div>`).join("");

  const old=$("#statExercise").value;
  $("#statExercise").innerHTML=keys.map(k=>`<option value="${esc(k)}">${esc(keyLabel(k))}</option>`).join("")||`<option>${esc(t("stats.table.no_data"))}</option>`;
  if(keys.includes(old))$("#statExercise").value=old;
  else if(keys.length)$("#statExercise").value=keys[0];
  const sel=$("#statExercise").value,rows=sums.filter(x=>x.liftKey===sel);
  draw(rows);

  if(rows.length){const first=rows[0].top,latest=rows.at(-1).top,delta=latest-first,be=Math.max(...rows.map(r=>r.e1rm));
    const dir=delta>0?"up":delta<0?"down":"";const arrow=delta>0?"▲":delta<0?"▼":"·";
    $("#trend").innerHTML=`<span>${t("stats.trend.top_load",{a:fmtLoad(first),b:fmtLoad(latest),unit:unitLabel()})}</span>`+
      `<span class="${dir}">${arrow} ${esc(t("stats.trend.over_sessions",{signed:fmt(toDisplay(Math.abs(delta))),unit:unitLabel(),sessions:`${rows.length} ${tp(rows.length,"session")}`}))}</span>`+
      `<span>${t("stats.trend.best_e1rm",{top:fmt(Math.round(toDisplay(be))),unit:unitLabel()})}</span>`;
  }else $("#trend").innerHTML="";

  $("#recent").innerHTML=table(rows.slice(-8).reverse().map(x=>({[t("stats.table.date")]:x.date,[t("stats.table.top")]:fmtLoad(x.top),[t("stats.table.reps")]:x.reps,[t("stats.table.rir")]:fmt(x.rir),[t("stats.table.e1rm")]:fmt(Math.round(toDisplay(x.e1rm))),[t("stats.table.vol")]:kfmt(toDisplay(x.volume))})));
  const rd=$("#recentDeltas");if(rd)rd.innerHTML=table(recentDeltaRows());
  const topByLift=new Map();
  for(const x of state.log){if(!isWork(x))continue;const k=liftKey(x),ld=+x.load,cur=topByLift.get(k);
    if(!cur||ld>cur.load||(ld===cur.load&&+x.reps>+cur.reps))topByLift.set(k,{Exercise:displayName(x),load:ld,reps:x.reps,rir:x.rir,date:x.date})}
  const progRows=[...topByLift.values()].sort((a,b)=>b.load-a.load||b.reps-a.reps).map(r=>({[t("stats.table.exercise")]:r.Exercise,[unitLabel()]:fmtLoad(r.load),[t("stats.table.reps")]:r.reps,[t("stats.table.rir")]:fmt(r.rir),[t("stats.table.date")]:r.date}));
  $("#tops").innerHTML=table(progRows);
  renderPRs();renderAttention();renderCompleted();renderReview();
  if(statsSeg==="strength")renderStrengthDash();
  if(statsSeg==="volume")renderVolumeDash();
  if(statsSeg==="prs")renderPRTimeline();
  const period=$("#statsPeriod");if(period)period.textContent=volWindow===7?t("stats.window.7_days"):t("stats.window.28_days");
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
function normalizeCommandText(text){return String(text??"").toLowerCase().replaceAll("×","x").replace(/@/g," rir ")
  .replace(/(\d),(\d)/g,"$1.$2").replace(/\breps\b/g,"").replace(/\s+/g," ").trim()}
function parseSetCommand(text){
  const n=normalizeCommandText(text),warnings=[];
  let set=null,load,reps,rir=null,effort=null,unit=null,confidence="low",gotReps=false;
  const setM=n.match(/(?:set|s)\s*(\d+)/);if(setM)set=+setM[1];
  const primary=n.match(/(\d+(?:\.\d+)?)\s*(kg|lb)?\s*(?:x|for)\s*(\d+)/);
  if(primary){load=+primary[1];unit=primary[2]||null;reps=+primary[3];confidence="high";gotReps=true}
  else{const nums=(n.match(/\d+(?:\.\d+)?/g)||[]).map(Number);
    if(set!=null){const i=nums.indexOf(set);if(i>=0)nums.splice(i,1)}
    if(!nums.length)return {ok:false,error:t("command.error.could_not_read_set"),warnings};
    if(nums.length<2)return {ok:false,error:t("command.error.could_not_find_reps"),warnings};
    load=nums[0];reps=nums[1];gotReps=true;if(nums.length>=3)rir=nums[2]}
  if(!gotReps)return {ok:false,error:t("command.error.could_not_find_reps"),warnings};
  const rirM=n.match(/(?:rir|@)\s*(\d+(?:\.\d+)?)/);if(rirM)rir=+rirM[1];
  else{const tr=n.match(/\b(\d+(?:\.\d+)?)\s*rir\b/);if(tr)rir=+tr[1]}
  const ef=n.match(/\b(easy|hard|max)\b/);if(ef)effort=ef[1];
  if(!unit){const u=n.match(/\b(\d+(?:\.\d+)?)\s*(kg|lb)\b/);if(u)unit=u[2]}
  let exerciseName=null;const exSrc=setM?n.slice(setM.index+setM[0].length).trim():n;
  const lead=exSrc.match(/^([a-z][a-z\s]*?)(?=\d)/);if(lead){const ex=lead[1].trim();if(ex)exerciseName=ex}
  return {ok:true,exerciseName,set,load,reps,rir,effort,unit,confidence,warnings}}
window.detectPRs=detectPRs;
window.__repforgeGenerateProgram=generateProgramFromOnboarding;
window.__repforgeTestDeltas=(prevRows,currentRows)=>buildSessionDelta(prevRows,currentRows);
window.__repforgeCompareExercise=(ex,currentRows)=>compareExerciseSession(ex,currentRows);
window.__repforgeMesocycleWeek=mesocycleWeek;
window.__repforgeBuildBlockReview=buildBlockReview;
window.__repforgeCompleteProgram=completeCurrentProgram;
window.__repforgeStartNextMeso=startNextMesocycle;
window.__repforgeParseCommand=parseSetCommand;
window.__repforgeNormalizeCommand=normalizeCommandText;
window.__repforgeParseDec=parseDec;

function resolveExerciseFromCommand(parsed,currentExercises){
  if(parsed.exerciseName){
    const q=parsed.exerciseName.toLowerCase();
    const hit=currentExercises.filter(e=>{const n=e.name.toLowerCase();return n.startsWith(q)||n.includes(q)});
    return hit.length===1?hit[0]:null}
  if(logMode==="focus"){const fl=focusList();return fl[Math.min(focusIndex,Math.max(0,fl.length-1))]||null}
  return currentExercises[0]||null}
function applyParsedCommand(parsed,context){
  const d=context?.day??day,exs=exercises(d).filter(e=>!skipped.has(e.id)),ex=resolveExerciseFromCommand(parsed,exs);
  if(!ex)return;
  const pick=n=>{if(n<1||n>ex.sets)return null;const k=`${ex.id}_${n}`;return committed.has(k)?null:n};
  let setN=null;
  if(parsed.set!=null){for(let n=parsed.set;n<=ex.sets;n++){setN=pick(n);if(setN)break}}
  else{for(let n=1;n<=ex.sets;n++){setN=pick(n);if(setN)break}}
  if(!setN){toast(t("toast.all_sets_saved"));return}
  const key=`${ex.id}_${setN}`;
  let loadDisp=parsed.load;
  if(parsed.unit&&parsed.unit!==state.settings.unit)loadDisp=toDisplay(fromDisplayUnit(parsed.load,parsed.unit));
  const loadInp=$(`[data-k="${key}_load"]`);if(loadInp)loadInp.value=fmt(loadDisp);
  const repsInp=$(`[data-k="${key}_reps"]`);if(repsInp)repsInp.value=fmt(parsed.reps);
  if(state.settings.rirMode==="effort"){
    let eff=parsed.effort;
    if(!eff&&parsed.rir!=null)eff=parsed.rir>=2.5?"easy":parsed.rir<=0.5?"max":"hard";
    if(!eff)eff="hard";
    $$(`.effort__btn[data-eff="${key}"]`).forEach(b=>b.classList.toggle("active",b.dataset.e===eff))}
  else{const rirInp=$(`[data-k="${key}_rir"]`);if(rirInp)rirInp.value=parsed.rir!=null?fmt(parsed.rir):""}
  touched.add(key);const row=$(`[data-set="${key}"]`);if(row)row.classList.remove("is-suggested");
  saveDraft();updateSaveMeta();return{ex,set:setN}}
/** Fill the next open set from a spoken set, e.g. "80 x 8 @1". Returns true when applied. */
function applyCommandText(text){
  const v=String(text||"").trim();if(!v)return false;
  const parsed=parseSetCommand(v);
  if(!parsed.ok){toast(parsed.error);return false}
  const exs=exercises().filter(e=>!skipped.has(e.id)),ex=resolveExerciseFromCommand(parsed,exs);
  if(!ex){toast(t("command.error.no_exercise_match"));return false}
  const r=applyParsedCommand(parsed,{day,logMode});
  if(!r)return false;
  const rirBit=parsed.rir!=null?` @${fmt(parsed.rir)}`:parsed.effort?` ${parsed.effort}`:"";
  toast(t("toast.command_applied",{load:fmt(parsed.load),reps:parsed.reps,rir:rirBit}));
  return true}
window.__repforgeApplyCommandText=applyCommandText;
function updateVoiceBtn(){const b=$("#voiceBtn");if(!b)return;b.classList.toggle("hidden",!(SR&&state.settings.voiceInputEnabled))}
function startVoiceInput(){
  if(!SR)return;const rec=new SR();rec.lang=I18N?I18N.speechLang():"en-US";rec.interimResults=false;rec.maxAlternatives=1;
  rec.onresult=e=>{const said=e.results[0]?.[0]?.transcript;if(said)applyCommandText(said)};
  rec.onerror=()=>toast(t("toast.voice_failed"));
  try{rec.start()}catch{toast(t("toast.voice_failed"))}}
window.__repforgeBlockSnapshot=blockSnapshot;
window.__repforgeBuildPlainSummary=buildPlainSummary;

function prTimeline(filter){
  const all=detectPRs(state.log);let events=all;
  if(filter==="load"||filter==="reps"||filter==="e1rm")events=all.filter(e=>e.kind===filter);
  else if(filter==="program"){const ids=new Set(prog.exercises.map(e=>e.id));
    events=all.filter(e=>e.exerciseId&&ids.has(e.exerciseId))}
  return events.sort((a,b)=>String(b.date).localeCompare(String(a.date)))}
window.__repforgePrTimeline=prTimeline;

function renderPRTimeline(){const el=$("#prTimeline");if(!el)return;
  $$("#prFilterSeg button").forEach(b=>{const on=b.dataset.prf===prFilter;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false");
    b.onclick=()=>{prFilter=b.dataset.prf;renderPRTimeline()}});
  const events=prTimeline(prFilter);
  if(!events.length){el.innerHTML=`<div class="empty">${esc(t("stats.empty.no_pr_filter"))}</div>`;return}
  const prDate=d=>{const p=String(d||"").split("-");return p.length===3?`${t("month."+(+p[1]-1))} ${+p[2]}`:String(d||"")};
  const kindLbl=k=>k==="load"?t("stats.pr.load"):k==="reps"?t("stats.pr.reps"):t("stats.pr.e1rm");
  const delta=ev=>ev.kind==="load"?(ev.deltaLoad!=null?`+${fmtLoad(ev.deltaLoad)}${unitLabel()}`:"")
    :ev.kind==="reps"?(ev.deltaReps!=null?`+${ev.deltaReps}`:"")
    :(ev.deltaE1rm!=null?`+${fmt(Math.round(toDisplay(ev.deltaE1rm)))}${unitLabel()}`:"");
  el.innerHTML=events.map(ev=>{const kc=ev.kind==="load"?"pr-kind--load":ev.kind==="reps"?"pr-kind--reps":"pr-kind--e1rm";
    const d=delta(ev);
    return `<div class="prtl__row"><span class="prtl__date">${esc(prDate(ev.date))}</span>`+
      `<span class="prtl__ex">${esc(ev.exerciseName)}</span>`+
      `<span class="pr-kind ${kc}">${esc(kindLbl(ev.kind))}</span>`+
      `<span class="prtl__set">${esc(fmtLoad(ev.load))}${unitLabel()} × ${esc(ev.reps)}</span>`+
      (d?`<span class="prtl__delta">${esc(d)}</span>`:"")+`</div>`}).join("")}

function renderPRs(){const el=$("#prLedger");if(!el)return;
  const sel=$("#statExercise").value,events=detectPRs(state.log).filter(ev=>(ev.exerciseId||ev.exerciseName)===sel);
  if(!events.length){el.innerHTML=`<div class="empty">${esc(t("stats.empty.log_prs"))}</div>`;return}
  el.innerHTML=`<table><thead><tr><th>${esc(t("stats.table.date"))}</th><th>${esc(t("stats.table.kind"))}</th><th>${esc(t("stats.table.load"))}</th><th>${esc(t("stats.table.reps"))}</th><th>${esc(t("stats.table.rir"))}</th><th>${esc(t("stats.table.e1rm"))}</th><th>${esc(t("stats.table.delta_vs_prev"))}</th></tr></thead><tbody>${
    events.map(ev=>{const kindCls=ev.kind==="load"?"pr-kind--load":ev.kind==="reps"?"pr-kind--reps":"pr-kind--e1rm";
      const kindLabel=ev.kind==="e1rm"?t("stats.pr.e1rm"):ev.kind==="reps"?t("stats.pr.reps"):t("stats.pr.load");
      const delta=ev.kind==="e1rm"?(ev.deltaE1rm!=null?`+${fmt(Math.round(toDisplay(ev.deltaE1rm)))}`:"—")
        :ev.kind==="reps"?(ev.deltaReps!=null?`+${ev.deltaReps}`:"—")
        :(ev.deltaLoad!=null?`+${fmtLoad(ev.deltaLoad)}`:"—");
      return `<tr class="pr-row"><td>${esc(ev.date)}</td><td><span class="pr-kind ${kindCls}">${esc(kindLabel)}</span></td>`+
        `<td>${esc(fmtLoad(ev.load))}</td><td>${esc(ev.reps)}</td><td>${esc(fmt(ev.rir))}</td>`+
        `<td>${esc(fmt(Math.round(toDisplay(e1rm(ev.load,ev.reps)))))}</td><td>${esc(delta)}</td></tr>`}).join("")
  }</tbody></table>`}

// Action board — which lifts need a decision, grouped by signal (one group per lift).
function attentionSignal(ex,fatigueCluster){
  const r=recommendation(ex),sess=sessionsFor(ex);
  if(r.status==="add"||r.status==="add2")return{key:"add",why:t("attention.add.why")};
  if(r.status==="reduce"||r.stalled)return{key:"reduce",why:t("attention.reduce.why")};
  if(r.status==="new")return{key:"new",why:t("attention.new.why")};
  if(sess.length){
    const lastDate=String(sess.at(-1).date).slice(0,10),cutoff=daysAgo(10);
    if(lastDate<cutoff){const n=Math.floor((new Date(`${today()}T12:00:00`)-new Date(`${lastDate}T12:00:00`))/86400000);
      return{key:"stale",why:t("attention.stale.why",{n})}}
  }
  const planned=prog.volume(),done=completedHardSets(7);
  for(const m of muscles(ex.primary)){const p=planned.get(m),d=done.get(m),target=p?p.d+p.p:0,actual=d?d.d+d.p:0;
    if(target>0&&actual<target)return{key:"vol",why:t("attention.vol.why")}}
  if(recoverSignal(ex,sess)||(fatigueCluster&&r.status==="hold"&&recoverSignal(ex,sess,1)))return{key:"fatigue",why:t("attention.fatigue.why")};
  return null}
function attentionGroups(){const fatigueCluster=prog.exercises.filter(ex=>{const r=recommendation(ex);return r.status==="reduce"||r.stalled}).length>=2;
  const defs=[{key:"add",cls:"add",lead:t("attention.add.lead")},{key:"reduce",cls:"reduce",lead:t("attention.reduce.lead")},{key:"new",cls:"new",lead:t("attention.new.lead")},
    {key:"stale",cls:"stale",lead:t("attention.stale.lead")},{key:"vol",cls:"vol",lead:t("attention.vol.lead")},{key:"fatigue",cls:"fatigue",lead:t("attention.fatigue.lead")}];
  const g=Object.fromEntries(defs.map(d=>[d.key,[]]));
  for(const ex of prog.exercises){const sig=attentionSignal(ex,fatigueCluster);if(sig)g[sig.key].push({ex,why:sig.why})}
  return defs.map(d=>({...d,items:g[d.key]})).filter(d=>d.items.length)}
window.__repforgeRecoverSignal=recoverSignal;
window.__repforgeRecommendation=recommendation;
window.__repforgeAttention=attentionGroups;
function renderAttention(){const el=$("#attention");if(!el)return;
  const groups=attentionGroups().filter(g=>g.key!=="add");
  if(!groups.length){el.innerHTML="";return}
  const html=`<p class="section-label">${esc(t("attention.title"))}</p>`+groups.map(({key,cls,lead,items})=>`<div class="attn__grp attn--${cls}"><span class="attn__lead visually-hidden">${esc(lead)}</span>`+
    `<p class="attn__why visually-hidden">${esc(items[0]?.why||"")}</p>`+
    items.map(({ex,why})=>`<button type="button" class="attn__chip" data-attn="${esc(ex.name)}" data-attngo="${esc(key)}"><span class="attn__dot" aria-hidden="true"></span><div class="listrow__main"><div class="listrow__title">${esc(ex.name)}</div><div class="listrow__sub">${esc(why)}</div></div><span class="chevron" aria-hidden="true"></span></button>`).join("")+`</div>`).join("");
  el.innerHTML=html;
  $$("#attention [data-attn]").forEach(b=>b.onclick=()=>{const grp=b.dataset.attngo,ex=prog.exercises.find(e=>e.name===b.dataset.attn),k=ex?.id||b.dataset.attn;
    if(grp==="new"||grp==="stale"){if(ex)goToLogExercise(ex.id)}
    else{const has=[...$("#statExercise").options].some(o=>o.value===k);
      if(has){$("#statsDeep").open=true;$("#statExercise").value=k;renderStats();redrawChart();$("#chart").scrollIntoView({behavior:"smooth",block:"center"})}else toast(t("toast.chart_missing_lift"))}});}

// Completed hard sets per muscle over a rolling window (load>0, reps>0, RIR within hardRir).
function completedHardSets(windowDays){const cutoff=daysAgo(windowDays-1),hr=+state.settings.hardRir,m=new Map();
  for(const x of state.log){if(String(x.date)<cutoff)continue;if(!(+x.load>0&&+x.reps>0&&+x.rir<=hr)||!isWork(x))continue;
    const mus=rowMuscles(x);
    for(const p of muscles(mus.primary))addVol(m,p,1,0);
    for(const s of muscles(mus.secondary))addVol(m,s,0,.5)}
  return m}
function volEff(m,name){const v=m.get(name);return v?v.d+v.p:0}
function volumeStatus(planned,completed7){if(!planned)return completed7>0?t("status.high"):t("status.on_target");
  const ratio=completed7/planned;return ratio<0.6?t("status.low"):ratio<=1.3?t("status.on_target"):t("status.high")}
function volumeDashboard(windowDays){const planned=prog.volume(),c7=completedHardSets(7),c28=completedHardSets(28);
  const names=new Set([...planned.keys(),...c7.keys(),...c28.keys()]);
  return[...names].sort((a,b)=>a.localeCompare(b)).map(muscle=>{
    const p=volEff(planned,muscle),c7v=volEff(c7,muscle),c28v=volEff(c28,muscle);
    return{muscle,planned:p,completed7:c7v,completed28:c28v,status:volumeStatus(p,c7v)}})}
window.__repforgeVolumeDashboard=volumeDashboard;
function renderVolumeDash(){const el=$("#volumeDash");if(!el)return;
  const rows=volumeDashboard(7).map(r=>({[t("stats.table.muscle")]:r.muscle,[t("stats.table.planned")]:fmt(r.planned),[t("stats.table.completed_7d")]:fmt(r.completed7),[t("stats.table.completed_28d")]:fmt(r.completed28),[t("stats.table.status")]:r.status}));
  el.innerHTML=table(rows)}
function renderCompleted(){const el=$("#completedVolume");if(!el)return;const m=completedHardSets(volWindow);
  const arr=[...m.entries()].map(([name,v])=>({name,eff:v.d+v.p})).sort((a,b)=>b.eff-a.eff),max=Math.max(...arr.map(x=>x.eff),1);
  el.innerHTML=arr.length?arr.map(x=>`<div class="vrow"><span class="vrow__name">${esc(x.name)}</span>`+
    `<span class="vrow__bar"><span class="vrow__fill${x.eff>=10?" is-high":""}" style="width:${Math.max(4,Math.round(x.eff/max*100))}%"></span></span>`+
    `<span class="vrow__num"><b>${fmt(x.eff)}</b> ${esc(tp(x.eff,"set"))}</span></div>`).join(""):`<div class="table"><div class="empty">${esc(t("stats.empty.no_hard_sets",{n:volWindow}))}</div></div>`;
  $$("#volWindow button").forEach(b=>{const on=+b.dataset.win===volWindow;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false")});}

function chartLabelDecimals(rngKg){return toDisplay(rngKg/3)<1?1:0}
window.__repforgeChartLabelDecimals=chartLabelDecimals;
function draw(rows,sel="#chart"){
  const c=$(sel);if(!c)return;
  const ctx=c.getContext("2d"),w=c.clientWidth||320,h=240,ratio=devicePixelRatio||1;
  c.width=w*ratio;c.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const C={accent:"#E04E14",steel:"#98948C",dim:"#98948C",rule:"#E4E1DA",mist:"#1B1A17"};
  const padL=42,padR=14,padT=22,padB=26,iw=w-padL-padR,ih=h-padT-padB;
  ctx.font='11px "Plex Sans",sans-serif';ctx.textBaseline="middle";
  if(!rows.length){ctx.fillStyle=C.steel;ctx.textAlign="center";ctx.fillText(t("stats.chart.empty"),w/2,h/2);return}
  const vals=rows.map(r=>r.e1rm??r.top),max=Math.max(...vals),min=Math.min(...vals),span=max-min||1,pad=span*0.25;
  const lo=Math.max(0,min-pad),hi=max+pad,rng=hi-lo||1;
  const X=i=>padL+(rows.length===1?iw/2:i*iw/(rows.length-1)),Y=v=>padT+ih-((v-lo)/rng)*ih;
  const decimals=chartLabelDecimals(rng),yLabel=v=>{const d=toDisplay(v);return decimals?fmt(+d.toFixed(1)):fmt(Math.round(d))};
  const accent="#E04E14";
  ctx.strokeStyle=C.rule;ctx.lineWidth=1;ctx.fillStyle=C.dim;ctx.textAlign="right";
  for(let i=0;i<=3;i++){const gy=padT+ih*i/3,val=hi-(rng*i/3);ctx.beginPath();ctx.moveTo(padL,gy);ctx.lineTo(w-padR,gy);ctx.stroke();ctx.fillText(yLabel(val)+` ${unitLabel()}`,padL-8,gy)}
  ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.lineJoin="round";ctx.lineCap="round";
  ctx.beginPath();rows.forEach((r,i)=>{const v=r.e1rm??r.top;i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v))});ctx.stroke();
  rows.forEach((r,i)=>{const v=r.e1rm??r.top,last=i===rows.length-1;ctx.beginPath();ctx.arc(X(i),Y(v),last?4:3.5,0,7);
    ctx.fillStyle=accent;ctx.fill()});
  const lastV=rows.at(-1).e1rm??rows.at(-1).top,lx=X(rows.length-1),ly=Y(lastV);ctx.fillStyle=accent;ctx.textAlign=lx>w-60?"right":"left";ctx.font='600 12px "Plex Sans",sans-serif';
  ctx.fillText(`${fmt(Math.round(toDisplay(lastV)))} ${unitLabel()}`,lx+(lx>w-60?-10:9),ly-12);
  ctx.fillStyle=C.dim;ctx.font='11px "Plex Sans",sans-serif';ctx.textBaseline="alphabetic";
  ctx.textAlign="left";ctx.fillText(shortDate(rows[0].date),padL,h-8);
  if(rows.length>2){ctx.textAlign="center";ctx.fillText(shortDate(rows[Math.floor(rows.length/2)].date),padL+iw/2,h-8)}
  ctx.textAlign="right";ctx.fillText(shortDate(rows.at(-1).date),w-padR,h-8);
}

function redrawChart(){
  if($("#exercise")?.classList.contains("active")&&exView){draw(summaries().filter(x=>x.liftKey===exView.key),"#exChart");return}
  if(!$("#stats").classList.contains("active")||statsSeg!=="overview")return;
  const sel=$("#statExercise").value,rows=summaries().filter(x=>x.liftKey===sel);draw(rows)}

function renderHistory(){
  if(!histMonth){const n=new Date();histMonth={y:n.getFullYear(),m:n.getMonth()}}
  renderHistoryCalendar();
  let sessions=[...new Map(state.log.map(x=>[x.session,x])).values()].sort((a,b)=>{
    const dd=String(b.date).localeCompare(String(a.date));return dd||String(b.created).localeCompare(String(a.created))});
  const q=histQuery.trim().toLowerCase();
  if(q)sessions=sessions.filter(s=>{
    const sets=state.log.filter(r=>r.session===s.session);
    return String(s.day).toLowerCase().includes(q)||sets.some(r=>displayName(r).toLowerCase().includes(q))});
  let lastMonth="";
  $("#sessions").innerHTML=sessions.length?sessions.map(s=>{
    const sets=state.log.filter(r=>r.session===s.session).sort((a,b)=>String(displayName(a)).localeCompare(String(displayName(b)))||a.set-b.set);
    if(s.session===editSession)return sessionEditor(s,sets);
    const work=sets.filter(isWork),vol=sum(work.map(x=>(+x.load||0)*(+x.reps||0)));
    const delta=sessionDeltaCounts(sets),deltaLine=hasDeltaSummary(delta)?`<div class="session__delta">${esc(formatDeltaCounts(delta))}</div>`:"";
    const mus=[...new Set(work.map(r=>String(r.primary||"").split(",")[0].trim()).filter(Boolean))].slice(0,3);
    const d=new Date(`${s.date}T12:00:00`);
    const monthKey=`${d.getFullYear()}-${d.getMonth()}`;
    let monthHdr="";
    if(monthKey!==lastMonth){lastMonth=monthKey;monthHdr=`<p class="section-label">${esc(t("month."+d.getMonth()).toUpperCase())}</p>`}
    const eyebrow=esc(t("history.session_eyebrow",{weekday:t("weekday."+d.getDay()),day:d.getDate(),month:t("month_short."+d.getMonth())}));
    const open=expandedSession===s.session;
    return monthHdr+`<div class="hist-row session${open?" is-open":""}" data-sess="${esc(s.session)}">`+
      `<div class="session__info"><div class="hist-eyebrow">${eyebrow}</div><div class="session__day hist-row__title">${esc(s.day)}</div>`+
      (mus.length?`<div class="session__sub">${esc(mus.join(" · "))}</div>`:"")+
      `<div class="session__sub">${esc(t("history.session_meta",{sets:sets.length,vol:kfmt(toDisplay(vol)),unit:unitLabel()}))}</div>${deltaLine}`+
      (open?`<div class="hist-row__actions" style="margin-top:8px"><button type="button" class="link-accent" data-edit="${esc(s.session)}">${esc(t("history.view_session"))}</button>`+
        `<button class="session__del" data-del="${esc(s.session)}">${esc(t("history.session.delete"))}</button></div>`:"")+
      `</div><span class="chevron${open?" is-up":""}" aria-hidden="true"></span></div>`;
  }).join(""):`<div class="table"><div class="empty">${esc(t("history.empty.sessions"))}</div></div>`;
  $$("#sessions .hist-row[data-sess]").forEach(row=>row.onclick=e=>{if(e.target.closest("[data-edit],[data-del]"))return;
    expandedSession=expandedSession===row.dataset.sess?null:row.dataset.sess;renderHistory()});
  $$("[data-del]").forEach(b=>b.onclick=e=>{e.stopPropagation();if(confirm(t("confirm.delete_session"))){state.log=state.log.filter(x=>x.session!==b.dataset.del);if(editSession===b.dataset.del)editSession=null;save();render();toast(t("toast.session_deleted"))}});
  $$("[data-edit]").forEach(b=>b.onclick=e=>{e.stopPropagation();editSession=b.dataset.edit;renderHistory()});
  $$("[data-edcancel]").forEach(b=>b.onclick=()=>{editSession=null;renderHistory()});
  $$("[data-edsave]").forEach(b=>b.onclick=()=>saveSessionEdit(b.dataset.edsave));
  const rows=[...state.log].sort((a,b)=>b.date.localeCompare(a.date)||displayName(a).localeCompare(displayName(b))||a.set-b.set).map(x=>({[t("stats.table.date")]:x.date,[t("stats.table.day")]:x.day,[t("stats.table.exercise")]:displayName(x),[t("stats.table.set")]:x.warmup?"W"+x.set:x.set,[unitLabel()]:fmtLoad(x.load),[t("stats.table.reps")]:x.reps,[t("stats.table.rir")]:fmt(x.rir)}));
  $("#historyTable").innerHTML=table(rows);
}
function renderHistoryCalendar(){const el=$("#historyCalendar");if(!el)return;
  const {y,m}=histMonth,first=new Date(y,m,1),startDow=(first.getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate();
  const monthSessions=state.log.filter(r=>String(r.date).startsWith(`${y}-${String(m+1).padStart(2,"0")}`));
  const byDay=new Map();for(const r of monthSessions){const d=+String(r.date).slice(8,10);if(!byDay.has(d))byDay.set(d,{sets:0,pr:false});byDay.get(d).sets++}
  for(const ev of detectPRs(state.log)){if(String(ev.date).startsWith(`${y}-${String(m+1).padStart(2,"0")}`)){const d=+String(ev.date).slice(8,10);const o=byDay.get(d)||{sets:0,pr:false};o.pr=true;byDay.set(d,o)}}
  const sessCount=new Set(monthSessions.map(r=>r.session)).size,setCount=monthSessions.length;
  const letters=state.settings.lang==="pt"?["S","T","Q","Q","S","S","D"]:["M","T","W","T","F","S","S"];
  // Monday-start letters already match weekdayLetters
  let cells=letters.map(l=>`<div class="cal-grid__dow">${esc(l)}</div>`).join("");
  for(let i=0;i<42;i++){let dayNum,out=false,iso;
    if(i<startDow){dayNum=prevDays-startDow+i+1;out=true;const pm=m===0?11:m-1,py=m===0?y-1:y;iso=`${py}-${String(pm+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    else if(i-startDow>=daysInMonth){dayNum=i-startDow-daysInMonth+1;out=true;const nm=m===11?0:m+1,ny=m===11?y+1:y;iso=`${ny}-${String(nm+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    else{dayNum=i-startDow+1;iso=`${y}-${String(m+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    const info=!out&&byDay.get(dayNum),isToday=iso===today();
    let mark="";if(info?.pr)mark=`<span class="cal-grid__mark is-pr"></span>`;else if(info)mark=`<span class="cal-grid__mark is-check">✓</span>`;else if(isToday)mark=`<span class="cal-grid__mark is-today"></span>`;
    cells+=`<div class="cal-grid__day${out?" is-out":""}">${dayNum}${mark}</div>`;
    if(i===41)break;if(i>=startDow+daysInMonth-1&&(i+1)%7===0)break}
  el.innerHTML=`<div class="cal-head"><button type="button" class="icon-btn icon-btn--ghost" id="calPrev" aria-label="Previous">‹</button>`+
    `<div class="cal-head__title">${esc(t("history.month_title",{month:(()=>{const s=t("month."+m);return s?s.charAt(0).toUpperCase()+s.slice(1):s})(),year:y}))}</div>`+
    `<button type="button" class="icon-btn icon-btn--ghost" id="calNext" aria-label="Next">›</button></div>`+
    `<div class="cal-summary">${esc(t("history.month_summary",{sessions:sessCount,sets:setCount}))}</div>`+
    `<div class="cal-grid">${cells}</div>`;
  $("#calPrev").onclick=()=>{if(histMonth.m===0){histMonth={y:histMonth.y-1,m:11}}else histMonth={y:histMonth.y,m:histMonth.m-1};renderHistory()};
  $("#calNext").onclick=()=>{if(histMonth.m===11){histMonth={y:histMonth.y+1,m:0}}else histMonth={y:histMonth.y,m:histMonth.m+1};renderHistory()}}


function sessionEditor(s,sets){
  const rows=sets.map(r=>{const key=`${liftKey(r)}|${r.set}`;
    return `<div class="edrow"><span class="edrow__name">${esc(displayName(r))} <small>#${r.set}</small></span>`+
      `<input class="edrow__in" data-ek="load|${esc(key)}" type="text" inputmode="decimal" enterkeyhint="next" value="${esc(fmtLoadPlain(r.load))}" aria-label="${esc(displayName(r))} ${esc(t("log.set").toLowerCase())} ${r.set} ${unitLabel()}">`+
      `<input class="edrow__in" data-ek="reps|${esc(key)}" type="text" inputmode="numeric" enterkeyhint="next" value="${esc(r.reps)}" aria-label="${esc(displayName(r))} ${esc(t("log.set").toLowerCase())} ${r.set} ${esc(t("log.reps"))}">`+
      `<input class="edrow__in" data-ek="rir|${esc(key)}" type="text" inputmode="decimal" enterkeyhint="done" value="${esc(fmt(r.rir))}" aria-label="${esc(displayName(r))} ${esc(t("log.set").toLowerCase())} ${r.set} ${esc(t("glossary.term.RIR"))}"></div>`}).join("");
  return `<div class="session session--edit" data-editing="${esc(s.session)}">`+
    `<div class="edhead"><div class="session__day">${esc(s.day)}</div>`+
    `<label class="edate">${esc(t("stats.table.date"))}<input data-ed="date" type="date" value="${esc(s.date)}"></label></div>`+
    `<div class="edrow edrow--head"><span>${esc(t("log.set"))}</span><span>${unitLabel()}</span><span>${esc(t("log.reps"))}</span><span>${esc(t("glossary.term.RIR"))}</span></div>`+rows+
    `<div class="edbtns"><button type="button" class="btn btn--steel" data-edcancel="1">${esc(t("history.edit.cancel"))}</button>`+
    `<button type="button" class="btn btn--cta" data-edsave="${esc(s.session)}">${esc(t("history.edit.save"))}</button></div></div>`;
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
  editSession=null;save();render();toast(t("toast.session_updated"));}

// ---- Exercise detail: one lift's stats, session history and session notes ----
// Reached by tapping an exercise name on the Log tab; not part of the bottom nav.
function exerciseSessionsDetail(key){const m=new Map();
  for(const r of state.log){if(liftKey(r)!==key)continue;
    if(!m.has(r.session))m.set(r.session,{session:r.session,date:r.date,day:r.day,created:r.created,rows:[],note:""});
    const e=m.get(r.session);e.rows.push(r);
    if(!e.note&&String(r.exNote||"").trim())e.note=String(r.exNote).trim()}
  return [...m.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.created).localeCompare(String(b.created)))}

function currentViewId(){return $$(".view").find(v=>v.classList.contains("active"))?.id||"log"}
function openExerciseView(key,from){if(!key)return;
  exView={key,from:from||currentViewId()};
  $$("nav button").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-current","false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="exercise"));
  document.body.classList.add("is-exercise");document.body.classList.remove("is-settings","is-onboarding","is-workout");
  window.scrollTo({top:0});renderExerciseView()}
function closeExerciseView(){const back=exView?.from||"log";exView=null;
  document.body.classList.remove("is-exercise");
  if(back==="settings"){showSettings();return}
  $$("nav button").forEach(x=>{const on=x.dataset.view===back;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===back));
  window.scrollTo({top:0});render()}
function openSettingsView(){showSettings()}

function renderExerciseView(){const el=$("#exDetail");if(!el||!exView)return;
  const key=exView.key,tmpl=prog.find(key),sessions=exerciseSessionsDetail(key);
  const latest=sessions.at(-1)?.rows.at(-1);
  const name=latest?displayName(latest):(tmpl?.name||key);
  const exRef=tmpl||(latest?{id:latest.exerciseId,name:latest.name}:null);
  const backKey=exView.from==="stats"?"nav.stats":exView.from==="program"?"nav.program":exView.from==="history"?"nav.history":"nav.log";
  const back=$("#exBack");if(back)back.textContent=`‹ ${t(backKey)}`;

  const rec=tmpl?recommendation(tmpl):null;
  const recHtml=rec?`<div class="recblock is-${rec.status}"><div class="recblock__row"><div><div class="recblock__lab">${esc(t("today.recommendation"))}</div>`+
    `<div class="recblock__head">${esc(rec.load!=null?t("today.rec_keep",{load:fmtLoad(rec.load),unit:unitLabel()}):rec.label)}</div>`+
    `<p class="recblock__body">${esc(rec.text)}</p></div>`+
    `<button type="button" class="link-accent" data-term="RIR">${esc(t("exercise.understand"))}</button></div></div>`:"";

  const work=state.log.filter(r=>liftKey(r)===key&&isWork(r));
  const topLoad=Math.max(0,...work.map(r=>+r.load||0));
  const bestE=work.length?Math.max(...work.map(r=>e1rm(+r.load,+r.reps))):0;
  const prCount=detectPRs(state.log).filter(ev=>(ev.exerciseId||ev.exerciseName)===key).length;
  const lcFirst=s=>s?s.charAt(0).toLowerCase()+s.slice(1):s;
  const tiles=[
    {label:lcFirst(t("stats.metric.sessions")),val:sessions.length},
    {label:t("exercise.top_load"),val:topLoad?`${fmtLoad(topLoad)} ${unitLabel()}`:"—"},
    {label:lcFirst(t("stats.metric.best_e1rm")),val:bestE?`${fmt(Math.round(toDisplay(bestE)))} ${unitLabel()}`:"—"},
    {label:t("stats.metric.prs"),val:prCount},
  ];
  const sums=summaries().filter(x=>x.liftKey===key);
  const prEvents=detectPRs(state.log).filter(ev=>(ev.exerciseId||ev.exerciseName)===key).reverse();
  const loadPr=prEvents.find(e=>e.kind==="load"),e1Pr=prEvents.find(e=>e.kind==="e1rm");
  const historyHtml=sessions.length?[...sessions].reverse().slice(0,8).map(s=>{
    const best=[...s.rows].filter(isWork).sort((a,b)=>+b.load-+a.load||+b.reps-+a.reps)[0];
    const cmp=exRef?compareExerciseSession(exRef,s.rows):null;
    const note=s.note?`<p class="exsess__note">${esc(s.note)}</p>`:"";
    return `<div class="exsess"><div class="exsess__head"><span class="exsess__date">${esc(shortDate(s.date))}</span>`+
      (best?`<span class="exsess__set">${fmtLoad(best.load)} × ${best.reps}</span><span class="exsess__day">RIR ${fmt(best.rir)}</span>`:"")+
      (cmp&&cmp.status!=="not_comparable"?`<span class="exsess__delta">${esc(cmp.label)}</span>`:"")+`</div>${note}</div>`}).join("")
    :`<div class="empty">${esc(t("exercise.empty.no_sets"))}</div>`;

  el.innerHTML=`<p class="exdet__muscle">${esc(tmpl?.primary||"")}</p><h2 class="exdet__name">${esc(name)}</h2>`+
    `<p class="exdet__meta">${tmpl?`${esc(tmpl.day)} · ${tmpl.sets} × ${tmpl.min}–${tmpl.max} ${esc(t("log.reps"))} · RIR 0–${fmt(state.settings.rirHigh)}`:esc(t("exercise.not_in_program"))}</p>`+
    recHtml+
    `<div class="statrow statrow--4">${tiles.map(tile=>`<div class="statrow__cell"><div class="statrow__val">${tile.val}</div><div class="statrow__cap">${tile.label}</div></div>`).join("")}</div>`+
    `<p class="section-label section-label--row"><span>${esc(t("exercise.progression"))}</span><button type="button" class="range-quiet">${esc(t("exercise.range_12w"))}<span class="caret" aria-hidden="true"></span></button></p>`+
    `<p class="lede">${esc(t("stats.e1rm_caption"))}</p>`+
    `<div class="chart-wrap"><canvas id="exChart" height="240" aria-label="${esc(t("exercise.chart_aria",{name}))}"></canvas></div>`+
    `<p class="section-label">${esc(t("exercise.records"))}</p>`+
    (loadPr?`<button type="button" class="listrow"><div class="listrow__main"><div class="listrow__title">${esc(t("stats.pr.load"))}</div><div class="listrow__sub">${fmtLoad(loadPr.load)} ${unitLabel()} × ${loadPr.reps}</div></div><span class="listrow__meta">${esc(shortDate(loadPr.date))}<span class="chevron" aria-hidden="true"></span></span></button>`:"")+
    (e1Pr?`<button type="button" class="listrow"><div class="listrow__main"><div class="listrow__title">${esc(t("stats.pr.e1rm"))}</div><div class="listrow__sub">${fmt(Math.round(toDisplay(e1rm(e1Pr.load,e1Pr.reps))))} ${unitLabel()}</div></div><span class="listrow__meta">${esc(shortDate(e1Pr.date))}<span class="chevron" aria-hidden="true"></span></span></button>`:"")+
    `<button type="button" class="link-row-cta" id="exSeePrs"><span>${esc(t("exercise.see_all_prs"))}</span><span class="chevron" aria-hidden="true"></span></button>`+
    `<p class="section-label">${esc(t("exercise.recent_sessions"))}</p><div class="exsessions">${historyHtml}</div>`;
  draw(sums,"#exChart");
  $$("#exDetail [data-term]").forEach(b=>b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)});
  const see=$("#exSeePrs");if(see)see.onclick=()=>{closeExerciseView();navTo("stats");setStatsSeg("prs")}}

function renderProgram(){renderProgramOverview();renderProgramHeader();renderProgramEditor();renderVolume();
  const ov=$("#programOverview"),ed=$("#programEditorWrap"),tog=$("#programEditToggle"),meta=$("#programMeta");
  if(ov)ov.classList.toggle("is-hidden",programEditMode);
  if(ed)ed.classList.toggle("is-hidden",!programEditMode);
  if(meta)meta.classList.toggle("visually-hidden",!programEditMode);
  if(tog)tog.textContent=programEditMode?t("program.done_edit"):t("program.edit")}
function renderProgramOverview(){const el=$("#programOverview");if(!el)return;
  const meta=state.programMeta||defaultProgramMeta(state.log),mc=mesocycleWeek(),ad=programAdherence(),health=programProgressionHealth(),vol=programVolumeCompliance();
  const ds=prog.days(),goal=meta.goal?t("onb.goal."+meta.goal+".label")||meta.goal:"";
  const segs=mc.total||6,cur=mc.current||0;
  const started=meta.started?(()=>{const d=new Date(`${meta.started}T12:00:00`);return t("program.started_on",{date:`${d.getDate()} ${t("month_short."+d.getMonth())}`})})():"";
  let daysHtml=`<p class="section-label">${esc(t("program.training_days"))}</p>`;
  const openDays=new Set(uiPrefs.overviewOpenDays||[]);
  if(!openDays.size&&ds.length)openDays.add(ds[0]);
  for(const d of ds){const exs=prog.forDay(d),sets=sum(exs.map(e=>e.sets)),mus=dayMuscles(d),open=openDays.has(d);
    daysHtml+=`<div class="prog-day"><button type="button" class="prog-day__head" data-ovday="${esc(d)}"><div>`+
      `<div class="prog-day__title">${esc(d)}</div>${mus.length?`<div class="prog-day__muscles">${esc(mus.join(" · "))}</div>`:""}</div>`+
      `<div class="prog-day__right">${esc(t("program.day_meta",{ex:exs.length,sets}))}<span class="chevron${open?" is-up":""}" aria-hidden="true"></span></div></button>`;
    if(open){daysHtml+=`<div class="prog-day__body">${exs.map(e=>`<button type="button" class="prog-ex" data-exopen="${esc(e.id)}"><span>${esc(e.name)}</span><span class="prog-ex__sets">${e.sets} × ${e.min}–${e.max}</span></button>`).join("")}`+
      `<button type="button" class="link-row-cta" data-exopen="${esc(exs[0]?.id||"")}"><span>${esc(t("program.see_details"))}</span><span class="chevron" aria-hidden="true"></span></button></div>`}
    daysHtml+=`</div>`}
  const planned=prog.volume();let plannedTotal=0;for(const[,v] of planned)plannedTotal+=v.d+v.p;
  el.innerHTML=`<div class="prog-overview__name">${esc(meta.name||t("untitled_program"))}</div>`+
    `<div class="prog-overview__meta">${[goal,t("program.days_per_week",{n:ds.length})].filter(Boolean).join(" · ")}</div>`+
    (mc.current!=null?`<div class="prog-overview__week">${esc(t("today.week_of",{n:mc.current,total:mc.total}))}</div>`+
      `<div class="segbar">${Array.from({length:segs},(_,i)=>`<span class="segbar__seg${i<Math.min(cur,segs)?" is-done":""}"></span>`).join("")}</div>`:"")+
    (started?`<div class="prog-overview__started">${esc(started)}</div>`:"")+
    `<div class="statrow">`+
    `<div class="statrow__cell"><div class="statrow__val">${ad.logged} / ${ad.total}</div><div class="statrow__cap">${esc(t("program.stat.sessions_week"))}</div></div>`+
    `<div class="statrow__cell"><div class="statrow__val">${health?.hot||0}</div><div class="statrow__cap">${esc(t("program.stat.ready"))}</div></div>`+
    `<div class="statrow__cell"><div class="statrow__val">${vol?Math.round(vol.ratio*100)+"%":"—"}</div><div class="statrow__cap">${esc(t("program.stat.volume"))}</div></div>`+
    `</div>${daysHtml}`+
    `<p class="section-label">${esc(t("program.planned_volume_label"))}</p>`+
    `<button type="button" class="listrow" id="seeVolumeAudit"><div class="listrow__main"><div class="listrow__title">${esc(t("program.effective_sets",{n:fmt(plannedTotal)}))}</div></div>`+
    `<span class="listrow__meta">${esc(t("program.see_audit"))}<span class="chevron" aria-hidden="true"></span></span></button>`+
    `<button type="button" class="listrow" id="reviewBlockLink" style="border-bottom:0"><div class="listrow__main"><div class="listrow__title">${esc(t("program.review_block"))}</div></div><span class="chevron" aria-hidden="true"></span></button>`;
  $$("#programOverview [data-ovday]").forEach(b=>b.onclick=()=>{
    const cur=new Set(uiPrefs.overviewOpenDays||[]);
    if(!(uiPrefs.overviewOpenDays||[]).length&&ds[0])cur.add(ds[0]);
    cur.has(b.dataset.ovday)?cur.delete(b.dataset.ovday):cur.add(b.dataset.ovday);
    setUiPref("overviewOpenDays",[...cur]);renderProgramOverview()});
  $$("#programOverview [data-exopen]").forEach(b=>b.onclick=()=>{if(b.dataset.exopen)openExerciseView(b.dataset.exopen,"program")});
  const audit=$("#seeVolumeAudit");if(audit)audit.onclick=()=>{programEditMode=true;renderProgram();$("#volume")?.scrollIntoView({behavior:"smooth"})};
  const rev=$("#reviewBlockLink");if(rev)rev.onclick=promptEndBlock}

function renderProgramChips(){
  const top=$("#pmetaChipsTop"),bottom=$("#pmetaChipsBottom");if(!top||!bottom)return;
  const ad=programAdherence(),mc=mesocycleWeek(),health=programProgressionHealth(),vol=programVolumeCompliance();
  const status=programStatusLabel(ad,health);
  const weekChip=mc.current!=null?`<span class="pmeta__chip">${esc(t("program.week_chip",{n:mc.current,total:mc.total}))}</span>`:"";
  const healthChip=health?`<span class="pmeta__chip">${esc(t("program.ready_chip",{done:health.hot,total:health.total}))}</span>`:"";
  const volChip=vol?`<span class="pmeta__chip">${esc(t("program.volume_chip",{pct:Math.round(vol.ratio*100)}))}</span>`:"";
  top.innerHTML=`${weekChip}<span class="pmeta__chip pmeta__chip--status">${esc(status)}</span>`;
  bottom.innerHTML=`<span class="pmeta__chip">${esc(t("program.days_this_week",{done:ad.logged,planned:ad.total}))}</span>${healthChip}${volChip}`;
}

function renderProgramHeader(){
  const el=$("#programMeta");if(!el)return;
  if(document.activeElement?.closest("#programMeta"))return;
  const meta=state.programMeta||defaultProgramMeta(state.log);
  el.innerHTML=
    `<div class="pmeta__row">`+
      `<label class="pmeta__name">${esc(t("program.name"))}<input id="programName" type="text" value="${esc(meta.name)}" placeholder="${esc(t("program.name.placeholder"))}" aria-label="${esc(t("program.name_aria"))}"></label>`+
      `<div id="pmetaChipsTop" class="pmeta__chips"></div>`+
    `</div>`+
    `<div class="pmeta__row">`+
      `<label class="pmeta__started">${esc(t("program.started"))}<input id="programStarted" type="date" value="${esc(meta.started||"")}" aria-label="${esc(t("program.started_aria"))}"></label>`+
      `<div id="pmetaChipsBottom" class="pmeta__chips"></div>`+
    `</div>`;
  renderProgramChips();
  const nameInp=$("#programName"),startInp=$("#programStarted");
  nameInp.oninput=()=>persistProgramMeta({name:nameInp.value});
  startInp.onchange=()=>{persistProgramMeta({started:startInp.value||null});renderProgramChips()};
}

// Collapsed program days live in UI prefs so the state survives reloads without touching training data.
function collapsedProgramDays(){const v=uiPrefs.collapsedProgramDays;return Array.isArray(v)?v.filter(x=>typeof x==="string"):[]}
function setDayCollapsed(d,on){const cur=new Set(collapsedProgramDays());
  on?cur.add(d):cur.delete(d);
  setUiPref("collapsedProgramDays",[...cur].filter(x=>prog.days().includes(x)))}
function renameCollapsedDay(oldName,newName){const cur=collapsedProgramDays();
  if(!cur.includes(oldName))return;
  setUiPref("collapsedProgramDays",cur.map(x=>x===oldName?newName:x))}

function renderProgramEditor(){
  const ds=prog.days();
  $("#programEditor").innerHTML=ds.length
    ?ds.map(dayCard).join("")
    :`<div class="table"><div class="empty">${esc(t("program.empty.days"))}</div></div>`;
  if(document.activeElement!==$("#programJson"))$("#programJson").value=JSON.stringify(prog.toJSON(),null,2);
  bindEditor();
}

function dayCard(d){
  const exs=prog.forDay(d),sets=sum(exs.map(e=>e.sets));
  const isCollapsed=collapsedProgramDays().includes(d);
  const body=exs.length
    ?exs.map((e,i)=>exCard(e,i,exs.length)).join("")
    :`<p class="pday__empty">${esc(t("program.empty.exercises"))}</p>`;
  return `<div class="pday${isCollapsed?" is-collapsed":""}" data-day="${esc(d)}">`+
    `<div class="pday__head">`+
      `<input class="pday__name" data-act="renameDay" data-day="${esc(d)}" value="${esc(d)}" aria-label="${esc(t("program.day.name_aria"))}">`+
      `<span class="pday__count">${esc(t("program.day.count",{n:exs.length,sets}))}</span>`+
      `<button class="iconbtn iconbtn--del" type="button" data-act="delDay" data-day="${esc(d)}" title="${esc(t("program.day.delete_title"))}" aria-label="${esc(t("program.day.delete_aria",{day:d}))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`+
      `<button class="iconbtn pday__caret" type="button" data-act="toggleDay" data-day="${esc(d)}" aria-expanded="${isCollapsed?"false":"true"}" title="${esc(t(isCollapsed?"program.day.expand":"program.day.collapse",{day:d}))}" aria-label="${esc(t(isCollapsed?"program.day.expand":"program.day.collapse",{day:d}))}"><span class="icon-mask icon-mask--sm icon-mask--chev-down" aria-hidden="true"></span></button>`+
    `</div>`+
    `<div class="pexlist">${body}</div>`+
    `<button class="btn btn--steel pday__add" type="button" data-act="addEx" data-day="${esc(d)}">${esc(t("program.day.add_exercise"))}</button>`+
  `</div>`;
}

function exCard(e,i,n){
  const num=(f,label)=>`<label class="pex__num">${label}<input type="number" inputmode="numeric" min="1" step="1" data-id="${e.id}" data-field="${f}" value="${esc(e[f])}"></label>`;
  return `<div class="pex" data-id="${esc(e.id)}">`+
    `<div class="pex__head">`+
      `<input class="pex__name" data-id="${esc(e.id)}" data-field="name" value="${esc(e.name)}" placeholder="${esc(t("program.exercise.name_placeholder"))}" aria-label="${esc(t("program.exercise.name_aria"))}">`+
      `<div class="pex__move">`+
        `<button class="iconbtn" type="button" data-act="up" data-id="${esc(e.id)}"${i===0?" disabled":""} aria-label="${esc(t("program.exercise.move_up"))}">▲</button>`+
        `<button class="iconbtn" type="button" data-act="down" data-id="${esc(e.id)}"${i===n-1?" disabled":""} aria-label="${esc(t("program.exercise.move_down"))}">▼</button>`+
        `<button class="iconbtn iconbtn--del" type="button" data-act="delEx" data-id="${esc(e.id)}" aria-label="${esc(t("program.exercise.delete_aria"))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`+
      `</div>`+
    `</div>`+
    `<div class="pex__nums">${num("sets",esc(t("program.exercise.sets")))}${num("min",esc(t("program.exercise.min_reps")))}${num("max",esc(t("program.exercise.max_reps")))}</div>`+
    `<label class="pex__mus">${esc(t("program.exercise.primary"))}<input data-id="${esc(e.id)}" data-field="primary" value="${esc(e.primary)}" placeholder="${esc(t("program.exercise.primary_placeholder"))}"></label>`+
    `<label class="pex__mus">${esc(t("program.exercise.secondary"))}<input data-id="${esc(e.id)}" data-field="secondary" value="${esc(e.secondary)}" placeholder="${esc(t("program.exercise.secondary_placeholder"))}"></label>`+
    `<label class="pex__mus">${esc(t("program.exercise.setup_notes"))}<input data-id="${esc(e.id)}" data-field="notes" value="${esc(e.notes)}" placeholder="${esc(t("program.exercise.setup_notes_placeholder"))}"></label>`+
    `<label class="pex__mus">${esc(t("program.exercise.alternates"))}<input data-id="${esc(e.id)}" data-field="alternates" value="${esc((e.alternates||[]).join(", "))}" placeholder="${esc(t("program.exercise.alternates_placeholder"))}"></label>`+
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
      if(prog.renameDay(old,next)){renameCollapsedDay(old,next);
        for(const row of state.log)if(row.day===old)row.day=next;
        if(day===old)day=next;persistProgram();save();render();toast(t("toast.day_renamed"))}
      else{inp.value=old;toast(prog.days().includes(next)?t("toast.day_name_exists"):t("toast.day_rename_failed"))}};
  });
  $$("#programEditor button[data-act]").forEach(b=>b.onclick=()=>editorAction(b.dataset.act,b.dataset));
}

function editorAction(act,ds){
  if(act==="toggleDay"){const card=$(`#programEditor .pday[data-day="${CSS.escape(ds.day)}"]`);if(!card)return;
    const now=!card.classList.contains("is-collapsed");
    card.classList.toggle("is-collapsed",now);setDayCollapsed(ds.day,now);
    const btn=card.querySelector(".pday__caret");
    if(btn){btn.setAttribute("aria-expanded",now?"false":"true");
      const label=t(now?"program.day.expand":"program.day.collapse",{day:ds.day});btn.setAttribute("aria-label",label);btn.title=label}}
  else if(act==="addEx"){prog.addExercise(ds.day);setDayCollapsed(ds.day,false);persistProgram();render();toast(t("toast.exercise_added"))}
  else if(act==="delEx"){if(confirm(t("confirm.remove_exercise"))){prog.removeExercise(ds.id);persistProgram();render();toast(t("toast.exercise_removed"))}}
  else if(act==="up"){prog.move(ds.id,-1);persistProgram();render()}
  else if(act==="down"){prog.move(ds.id,1);persistProgram();render()}
  else if(act==="delDay"){if(confirm(t("confirm.delete_day",{day:ds.day}))){prog.removeDay(ds.day);setDayCollapsed(ds.day,false);persistProgram();render();toast(t("toast.day_deleted"))}}
}

function renderVolume(){
  const arr=[...prog.volume().entries()].map(([name,v])=>({name,eff:v.d+v.p})).sort((a,b)=>b.eff-a.eff);
  const max=Math.max(...arr.map(x=>x.eff),1);
  $("#volume").innerHTML=arr.length?arr.map(x=>`<div class="vrow"><span class="vrow__name">${esc(x.name)}</span>`+
    `<span class="vrow__bar"><span class="vrow__fill${x.eff>=10?" is-high":""}" style="width:${Math.max(4,Math.round(x.eff/max*100))}%"></span></span>`+
    `<span class="vrow__num"><b>${fmt(x.eff)}</b> ${esc(tp(x.eff,"set"))}</span></div>`).join(""):`<div class="table"><div class="empty">${esc(t("program.empty.no_program_exercises"))}</div></div>`;
}
function addVol(m,k,d,p){if(!m.has(k))m.set(k,{d:0,p:0});m.get(k).d+=d;m.get(k).p+=p}

function persistProgram(){state.program=prog.toJSON();save()}

function saveProgram(){try{const parsed=JSON.parse($("#programJson").value);if(!Array.isArray(parsed))throw Error();
  const byId=new Map(prog.exercises.map(e=>[e.id,e]));
  for(const row of parsed){if(row.id&&byId.has(row.id))continue;
    const match=prog.exercises.find(e=>e.name===row.name&&e.day===row.day)||prog.exercises.find(e=>e.name===row.name);
    if(match&&!parsed.some(r=>r.id===match.id))row.id=match.id}
  prog=new Program(parsed);persistProgram();clearDraft();day=prog.days()[0]||"Day 1";if(migrateLog())save();render();toast(t("toast.program_saved"))}
  catch{toast(t("toast.program_json_invalid"))}}

function renderSettings(){
  const jp=$("#jumpPct"),mj=$("#minJump"),rh=$("#rirHigh"),hr=$("#hardRir"),rs=$("#restSec"),un=$("#unit");
  if(jp)jp.value=state.settings.jumpPct;if(mj)mj.value=state.settings.minJump;if(rh)rh.value=state.settings.rirHigh;if(hr)hr.value=state.settings.hardRir;
  if(rs)rs.value=state.settings.restSec;if(un)un.value=state.settings.unit;
  const langSel=$("#lang");if(langSel){langSel.value=state.settings.lang;[...langSel.options].forEach(o=>{o.textContent=t("settings.lang."+o.value)})}
  $$('input[name="rirMode"]').forEach(r=>{r.checked=r.value===state.settings.rirMode});
  const vi=$("#voiceInputEnabled");if(vi)vi.checked=!!state.settings.voiceInputEnabled;
  const vt=$("#voiceToggle");if(vt){vt.classList.toggle("is-on",!!state.settings.voiceInputEnabled);vt.setAttribute("aria-pressed",state.settings.voiceInputEnabled?"true":"false")}
  const n=state.settings.notify||normalizeNotify();
  const ne=$("#notifyEnabled");if(ne)ne.checked=!!n.enabled;
  const ntog=$("#notifyToggle");if(ntog){ntog.classList.toggle("is-on",!!n.enabled);ntog.setAttribute("aria-pressed",n.enabled?"true":"false")}
  const nt=$("#notifyTimer");if(nt)nt.checked=n.timer!==false;
  const ns=$("#notifySession");if(ns)ns.checked=n.session!==false;
  const nu=$("#notifyUnfinished");if(nu)nu.checked=n.unfinished!==false;
  const nm=$("#notifyMissed");if(nm)nm.checked=n.missed!==false;
  $$("#notifyTypes input").forEach(i=>{i.disabled=!n.enabled});
  const ps=$("#notifyPermStatus");if(ps)ps.textContent=t("settings.notifications.permission",{status:window.RepForgeNotify?RepForgeNotify.permission():t("notify.permission.unsupported")});
  updateVoiceBtn();
  const ia=$("#installApp");if(ia)ia.classList.toggle("hidden",isStandalone());
  const sec=+state.settings.restSec||0,disp=$("#restSecDisplay");
  if(disp)disp.textContent=sec?`${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`:t("settings.rest_off");
  const rirDisp=$("#rirModeDisplay");if(rirDisp)rirDisp.textContent=state.settings.rirMode==="effort"?t("settings.rir_effort"):t("settings.rir_numbers");
  const le=state.settings.lastExport,ago=le?t("settings.storage.last_backup",{lastBackup:le.slice(0,10)}):t("settings.storage.last_backup_never");
  const sn=$("#storageNote");if(sn)sn.textContent=`${ago} ${t("settings.storage.note",{key:KEY})}`;
  const sz=$("#storageSize");if(sz){try{const bytes=new Blob([localStorage.getItem(KEY)||""]).size;sz.textContent=bytes>1048576?`${fmt(+(bytes/1048576).toFixed(1))} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`}catch{sz.textContent="—"}}
}

function commitSettings(silent){const num=(sel,def,min)=>{const n=parseDec($(sel).value);return Number.isFinite(n)&&n>=min?n:def};
  const oldUnit=state.settings.unit,newUnit=$("#unit").value==="lb"?"lb":"kg",oldLang=state.settings.lang,newLang=I18N?.normalizeLang($("#lang")?.value)||oldLang;
  const oldRirMode=state.settings.rirMode;
  const newRirMode=$('input[name="rirMode"]:checked')?.value==="effort"?"effort":"numeric";
  if(oldUnit!==newUnit){convertDraftUnits(oldUnit,newUnit);
    const bw=$("#bodyweight");if(bw&&bw.value!==""){const n=parseDec(bw.value);if(Number.isFinite(n))bw.value=fmtPlain(toDisplayUnit(fromDisplayUnit(n,oldUnit),newUnit))}}
  if(oldRirMode!==newRirMode)clearDraft();
  state.settings=normalizeSettings({jumpPct:num("#jumpPct",2.5,0),minJump:(()=>{const n=parseDec($("#minJump").value);return Number.isFinite(n)&&n>0?n:2.5})(),rirHigh:num("#rirHigh",2,0),hardRir:num("#hardRir",4,0),restSec:num("#restSec",120,0),lastExport:state.settings.lastExport,unit:newUnit,lang:newLang,rirMode:newRirMode,voiceInputEnabled:!!$("#voiceInputEnabled")?.checked,notify:normalizeNotify({enabled:!!$("#notifyEnabled")?.checked,timer:!!$("#notifyTimer")?.checked,session:!!$("#notifySession")?.checked,unfinished:!!$("#notifyUnfinished")?.checked,missed:!!$("#notifyMissed")?.checked})});
  if(oldLang!==state.settings.lang&&I18N)I18N.setLang(state.settings.lang);
  save();render();if(!silent)toast(t("toast.settings_saved"));}

function table(rows){if(!rows.length)return`<div class="empty">${esc(t("stats.table.no_data"))}</div>`;const h=Object.keys(rows[0]);
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
    ["notes",r=>r.notes],["exercise_note",r=>r.exNote||""],["created",r=>r.created],
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
    if(!confirm(t("confirm.import_program_replace",{n:list.length}))){e.target.value="";toast(t("toast.program_import_cancelled"));return}
    if(typeof imp.meta?.name==="string"&&imp.meta.name.trim())persistProgramMeta({name:imp.meta.name});
    $("#programJson").value=JSON.stringify(list,null,2);saveProgram()}
  catch{toast(t("toast.program_import_invalid"))}
  e.target.value=""}
async function importJson(e){const f=e.target.files?.[0];if(!f)return;
  try{const s=JSON.parse(await f.text());if(!s.program||!Array.isArray(s.log))throw Error();
    const inSessions=new Set(s.log.map(r=>r.session)).size,inSets=s.log.length;
    const curSessions=new Set(state.log.map(r=>r.session)).size,curSets=state.log.length;
    const have=new Set(state.log.map(r=>r.session));
    const newSessions=new Set(s.log.filter(r=>!have.has(r.session)).map(r=>r.session)).size;
    openImportChoice({s,inSessions,inSets,curSessions,curSets,newSessions})}
  catch{toast(t("toast.import_invalid"))}
  e.target.value=""}
function openImportChoice(ctx){const d=$("#importChoice");
  $("#importChoiceBody").textContent=t("dialog.import.body",{curSessions:ctx.curSessions,curSets:ctx.curSets,inSessions:ctx.inSessions,inSets:ctx.inSets,newSessions:ctx.newSessions});
  d.classList.remove("hidden");
  const close=()=>{d.classList.add("hidden")};
  $("#importCancel").onclick=()=>{close();toast(t("toast.import_cancelled"))};
  $("#importReplace").onclick=()=>{close();applyState(ctx.s);clearDraft();day=days()[0]||"Day 1";syncLang();render();toast(t("toast.imported_sessions",{sessions:ctx.inSessions}))};
  $("#importMerge").onclick=()=>{close();mergeLog(ctx.s)};}
function mergeLog(s){const have=new Set(state.log.map(r=>r.session));
  const rows=s.log.filter(r=>r&&r.session&&!have.has(r.session));
  const added=new Set(rows.map(r=>r.session)).size;
  if(!added){toast(t("toast.nothing_to_merge"));return}
  state.log.push(...rows);
  migrateLog();save();
  render();toast(t("toast.merged_sessions",{n:added,sessions:tp(added,"session")}))}

function switchToBeginnerProgram(){prog=new Program(programBeginner);persistProgram();clearDraft();day=prog.days()[0]||"Day 1";render();toast(t("toast.beginner_loaded"))}

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
function showOnboardingView(){$("#onboarding").classList.remove("hidden");$("#onboarding").classList.add("active");document.body.classList.add("is-onboarding");
  $$(".view").forEach(v=>{if(v.id!=="onboarding")v.classList.remove("active")})}
function closeOnboarding(){$("#onboarding").classList.remove("active");$("#onboarding").classList.add("hidden");document.body.classList.remove("is-onboarding");
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
  return `<button type="button" class="radio-card${sel?" is-selected":""}" data-onb-pick="${esc(key)}" data-onb-val="${esc(val)}" data-onb-multi="${multi?"1":"0"}">`+
    `<span class="radio-card__body"><span class="radio-card__title">${esc(label)}</span>${sub?`<span class="radio-card__cap">${esc(sub)}</span>`:""}</span>`+
    `<span class="radio-card__mark" aria-hidden="true"></span></button>`}
function renderOnboarding(){const body=$("#onbBody"),title=$("#onbTitle"),step=$("#onbStepLabel"),back=$("#onbBack"),next=$("#onbNext");
  if(!body)return;title.textContent=t(`onb.title.${onbStep}`)||t("onb.title.default");
  if(step)step.textContent=t("onb.step",{n:onbStep+1,total:8});
  const seg=$("#onbSegbar");if(seg)seg.innerHTML=Array.from({length:8},(_,i)=>`<span class="segbar__seg${i<=onbStep?" is-current":""}${i<onbStep?" is-done":""}"></span>`).join("");
  const cancel=$("#onbCancel");if(cancel)cancel.textContent=onbStep===0?t("onb.cancel"):"‹";
  if(back)back.classList.toggle("hidden",onbStep===0||onbStep===7);
  if(next){next.classList.toggle("hidden",onbStep===7);next.textContent=t("onb.next")}
  let html=`<h2 class="onb__q">${esc(t(`onb.title.${onbStep}`)||t("onb.title.default"))}</h2>`;
  if(onbStep===0)html+=`<p class="onb__explain">${esc(t("onb.goal.lede"))}</p><div class="onb__opts">`+
    onbOpt("","goal","hypertrophy",t("onb.goal.hypertrophy.label"),t("onb.goal.hypertrophy.sub"),false)+
    onbOpt("","goal","strength_hypertrophy",t("onb.goal.strength_hypertrophy.label"),t("onb.goal.strength_hypertrophy.sub"),false)+
    onbOpt("","goal","beginner_consistency",t("onb.goal.beginner_consistency.label"),t("onb.goal.beginner_consistency.sub"),false)+`</div>`+
    `<div class="onb__changes"><div class="onb__changes-lab">${esc(t("onb.what_changes"))}</div><p class="lede">${esc(t("onb.goal.changes"))}</p></div>`+
    `<p class="onb__import">${esc(t("onb.have_program"))} · <button type="button" id="onbImportLink">${esc(t("onb.import"))}</button></p>`;
  else if(onbStep===1)html+=`<p class="onb__explain">${esc(t("onb.experience.lede")||"")}</p><div class="onb__opts">`+
    onbOpt("","experience","beginner",t("onb.experience.beginner"),"",false)+onbOpt("","experience","intermediate",t("onb.experience.intermediate"),"",false)+
    onbOpt("","experience","advanced",t("onb.experience.advanced"),"",false)+`</div>`;
  else if(onbStep===2)html+=`<div class="onb__opts">`+[2,3,4,5,6].map(n=>onbOpt("","daysPerWeek",n,String(n),t("onb.days.sub"),false)).join("")+`</div>`;
  else if(onbStep===3){const opts=ONB_SPLITS[onbAnswers.daysPerWeek]||[];
    html+=`<p class="onb__explain">${esc(t("onb.split.lede",{n:onbAnswers.daysPerWeek}))}</p><div class="onb__opts">`+
      opts.map(s=>onbOpt("","splitType",s,t("split."+s)||ONB_SPLIT_LABEL[s]||s,"",false)).join("")+`</div>`}
  else if(onbStep===4)html+=`<p class="onb__explain">${esc(t("onb.equipment.lede"))}</p><div class="onb__opts">`+
    ONB_EQ_UI.map(e=>onbOpt("", "equipment",e,t("equipment."+e)||ONB_EQ_LABEL[e],"",true)).join("")+`</div>`;
  else if(onbStep===5)html+=`<p class="onb__explain">${esc(t("onb.priority.lede"))}</p><div class="onb__opts">`+
    ONB_MUSCLES.map(m=>onbOpt("","priorityMuscles",m,t("muscle."+m)||m,"",true)).join("")+`</div>`;
  else if(onbStep===6)html+=`<div class="onb__opts">`+
    onbOpt("","sessionLength","short",t("onb.session.short.label"),t("onb.session.short.sub"),false)+
    onbOpt("","sessionLength","normal",t("onb.session.normal.label"),t("onb.session.normal.sub"),false)+
    onbOpt("","sessionLength","long",t("onb.session.long.label"),t("onb.session.long.sub"),false)+`</div>`;
  else{const gen=generateProgramFromOnboarding(onbGenAnswers(onbAnswers)),days=[...new Set(gen.map(e=>e.day))];
    const byDay=days.map(d=>{const exs=gen.filter(e=>e.day===d);
      return `<div class="onb__day"><div class="onb__dayname">${esc(d)}</div>`+
        exs.map(e=>`<div class="onb__ex"><b>${esc(e.name)}</b> · ${e.sets}×${e.min}–${e.max} · ${esc(e.primary)}</div>`).join("")+`</div>`});
    html=`<div class="onb__review">${byDay.join("")}<div class="onb__actions">`+
      `<button type="button" id="onbSave" class="btn btn--cta">${esc(t("onb.review.save"))}</button>`+
      `<button type="button" id="onbEdit" class="btn btn--steel">${esc(t("onb.review.edit"))}</button>`+
      `<button type="button" id="onbRestart" class="btn btn--steel">${esc(t("onb.review.restart"))}</button></div></div>`}
  body.innerHTML=html;
  $$("[data-onb-pick]").forEach(b=>b.onclick=()=>{const k=b.dataset.onbPick,v=b.dataset.onbVal;
    const multi=b.dataset.onbMulti==="1",num=k==="daysPerWeek"?+v:v;onbPick(k,num,multi)});
  const saveBtn=$("#onbSave");if(saveBtn)saveBtn.onclick=saveOnboardingProgram;
  const editBtn=$("#onbEdit");if(editBtn)editBtn.onclick=editOnboardingProgram;
  const restartBtn=$("#onbRestart");if(restartBtn)restartBtn.onclick=()=>{onbStep=0;onbAnswers=defaultOnbAnswers();renderOnboarding()};
  const imp=$("#onbImportLink");if(imp)imp.onclick=()=>{$("#importProgram")?.click()};
  if(next)next.disabled=!onbCanNext()}
function saveOnboardingProgram(){const a=onbAnswers;prog=new Program(generateProgramFromOnboarding(onbGenAnswers(a)));
  persistProgramMeta({goal:a.goal,experience:a.experience,daysPerWeek:a.daysPerWeek,splitType:a.splitType,equipment:a.equipment,
    priorityMuscles:a.priorityMuscles,sessionLength:a.sessionLength,started:today(),mesocycleStatus:"active",onboarded:true});
  persistProgram();day=prog.days()[0]||"Day 1";closeOnboarding();toast(t("toast.onboarding_saved"));
  if(!maybeStartTour())maybeShowInstallBanner()}
function editOnboardingProgram(){prog=new Program(generateProgramFromOnboarding(onbGenAnswers(onbAnswers)));persistProgram();
  day=prog.days()[0]||"Day 1";closeOnboarding();
  $$("nav button").forEach(x=>{const on=x.dataset.view==="program";x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="program"));render();toast(t("toast.tweak_program"))}
window.closeOnboarding=closeOnboarding;window.startOnboarding=startOnboarding;

// ---- UI prefs (kept separate from training data so they never touch export/import) ----
const UIKEY="repforge_ui_v1";
function loadUiPrefs(){try{const o=JSON.parse(localStorage.getItem(UIKEY));return o&&typeof o==="object"?o:{}}catch{return{}}}
let uiPrefs=loadUiPrefs();
function setUiPref(k,v){uiPrefs[k]=v;try{localStorage.setItem(UIKEY,JSON.stringify(uiPrefs))}catch(e){console.warn("ui prefs save failed",e)}}

// ---- Install / PWA helpers ----
const isStandalone=()=>window.matchMedia?.("(display-mode: standalone)")?.matches===true||window.navigator.standalone===true;
const isIOS=()=>{const ua=navigator.userAgent||"";return /iphone|ipad|ipod/i.test(ua)||(navigator.platform==="MacIntel"&&(navigator.maxTouchPoints||0)>1)};
const IOS_SHARE_SVG='<svg class="ios-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v13"/><path d="M8 7l4-4 4 4"/><path d="M6 12H4v8h16v-8h-2"/></svg>';
const INSTALL_SNOOZE_MS=7*86400000;
function installInstructions(){
  if(isIOS())return t("install.ios_instructions",{icon:IOS_SHARE_SVG});
  if(installPrompt)return t("install.prompt_instructions");
  return t("install.browser_instructions");
}
async function triggerInstall(){
  if(installPrompt){installPrompt.prompt();let outcome="";try{const c=await installPrompt.userChoice;outcome=c?.outcome||""}catch{}
    installPrompt=null;$("#installBtn")?.classList.add("hidden");
    if(outcome==="accepted"){hideInstallBanner(false);toast(t("toast.installing"))}
    renderSettings();return}
  showInstallBanner(true);
}
function installBannerEligible(){
  if(isStandalone())return false;
  if(tourActive||$("#onboarding")?.classList.contains("active"))return false;
  if(!installPrompt&&!isIOS())return false;
  const dis=+uiPrefs.installDismissedAt||0;
  if(dis&&Date.now()-dis<INSTALL_SNOOZE_MS)return false;
  return true;
}
function showInstallBanner(force){
  const b=$("#installBanner");if(!b)return;
  if(!force&&!installBannerEligible())return;
  if(isStandalone())return;
  $("#installBannerBody").innerHTML=installInstructions();
  const act=$("#installBannerAction");
  if(installPrompt){act.classList.remove("hidden");act.textContent=t("install.action")}else act.classList.add("hidden");
  b.classList.remove("hidden");
}
function hideInstallBanner(remember){$("#installBanner")?.classList.add("hidden");if(remember)setUiPref("installDismissedAt",Date.now())}
function maybeShowInstallBanner(){if(installBannerEligible())showInstallBanner(false)}

// ---- Feature tour (bottom-sheet coach that walks every feature) ----
const TOUR=[
  {view:"log"},{view:"log"},{view:"log"},{view:"log"},{view:"log"},{view:"log"},
  {view:"stats"},{view:"history"},{view:"program"},{view:"settings"},{view:"settings",install:true}
];
let tourStep=0,tourActive=false;
function tourSteps(){return TOUR.filter(s=>!(s.install&&isStandalone()))}
function showSettings(){
  $$("nav button").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-current","false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="settings"));
  document.body.classList.add("is-settings");document.body.classList.remove("is-exercise","is-onboarding","is-workout");
  workoutActive=false;workoutLeft=true;window.scrollTo({top:0});render()}
function navTo(view){
  if(view==="settings"){showSettings();return}
  const b=$(`nav button[data-view="${view}"]`);
  if(b){if(!b.classList.contains("active"))b.click();return}
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===view));
  window.scrollTo({top:0});render()
}
window.__repforgeEnterWorkout=enterWorkout;
window.__repforgeLeaveWorkout=leaveWorkout;
window.__repforgeShowSettings=showSettings;
function startTour(){tourStep=0;tourActive=true;hideInstallBanner(false);$("#tour").classList.remove("hidden");renderTour()}
function renderTour(){
  const steps=tourSteps(),s=steps[tourStep];
  if(!s){endTour(true);return}
  if(s.view)navTo(s.view);
  $("#tourEyebrow").textContent=t("tour.eyebrow_progress",{n:tourStep+1,total:steps.length});
  $("#tourTitle").textContent=t(`tour.${tourStep}.title`);
  const extra=$("#tourExtra");
  if(s.install){
    $("#tourBody").innerHTML=`${t("tour.install.body_prefix")} ${installInstructions()}`;
    extra.innerHTML=installPrompt?`<button type="button" id="tourInstallBtn" class="btn btn--cta">${esc(t("tour.install.cta"))}</button>`:"";
    const ib=$("#tourInstallBtn");if(ib)ib.onclick=triggerInstall;
  }else{$("#tourBody").innerHTML=t(`tour.${tourStep}.body`);extra.innerHTML=""}
  $("#tourDots").innerHTML=steps.map((_,i)=>`<span class="tour__dot${i===tourStep?" is-on":""}"></span>`).join("");
  $("#tourBack").classList.toggle("hidden",tourStep===0);
  $("#tourNext").textContent=tourStep===steps.length-1?t("tour.done"):t("tour.next");
  window.scrollTo({top:0});
}
function endTour(completed){tourActive=false;$("#tour").classList.add("hidden");setUiPref("tourDone",true);
  if(completed)navTo("log");
  maybeShowInstallBanner();}
function maybeStartTour(){if(uiPrefs.tourDone)return false;if($("#onboarding")?.classList.contains("active"))return false;startTour();return true}
window.startTour=startTour;window.closeTour=()=>{if(tourActive)endTour(false)};
window.__repforgeUi={loadUiPrefs,isStandalone,isIOS,showInstallBanner,startTour};

function init(){
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
  let rzT;window.addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(redrawChart,150)});
  window.addEventListener("orientationchange",()=>setTimeout(redrawChart,200));
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#installBtn")?.classList.remove("hidden");
    renderSettings();if(tourActive)renderTour();else maybeShowInstallBanner()});
  window.addEventListener("appinstalled",()=>{installPrompt=null;$("#installBtn")?.classList.add("hidden");hideInstallBanner(false);renderSettings()});
  $("#installBtn").onclick=triggerInstall;
  $("#installBannerClose").onclick=()=>hideInstallBanner(true);
  $("#installBannerAction").onclick=triggerInstall;
  $("#tourBack").onclick=()=>{if(tourStep>0){tourStep--;renderTour()}};
  $("#tourNext").onclick=()=>{if(tourStep<tourSteps().length-1){tourStep++;renderTour()}else endTour(true)};
  $("#tourSkip").onclick=()=>endTour(false);
  $("#replayTour").onclick=startTour;
  $("#installApp").onclick=triggerInstall;
  $("#restBar").onclick=stopRest;
  const openSettingsBtn=$("#openSettings");if(openSettingsBtn)openSettingsBtn.onclick=()=>openSettingsView();
  const settingsBack=$("#settingsBack");if(settingsBack)settingsBack.onclick=()=>navTo("log");
  const startWo=$("#startWorkout");if(startWo)startWo.onclick=()=>enterWorkout({focus:true});
  const viewEx=$("#viewExercises");if(viewEx)viewEx.onclick=()=>enterWorkout({focus:false});
  const leaveWo=$("#leaveWorkout");if(leaveWo)leaveWo.onclick=leaveWorkout;
  const woOv=$("#woOverflowBtn");if(woOv)woOv.onclick=e=>{e.stopPropagation();toggleWorkoutOverflow()};
  // The menu is a popover: any choice inside it, a tap outside, or Escape closes it.
  // iOS does not reliably bubble click to document, so touchstart backs it up.
  const dismissOverflow=e=>{
    const menu=$("#woOverflow");if(!menu||menu.classList.contains("hidden"))return;
    const target=e.target instanceof Element?e.target:null;
    if(target&&(menu.contains(target)||target.closest("#woOverflowBtn")))return;
    closeWorkoutOverflow()};
  document.addEventListener("click",dismissOverflow);
  document.addEventListener("touchstart",dismissOverflow,{passive:true});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeWorkoutOverflow()});
  // Focus mode is a card deck: drag it sideways, or use the arrow keys.
  const wk=$("#workout");
  if(wk)wk.addEventListener("pointerdown",focusDragStart);
  window.addEventListener("pointermove",focusDragMove,{passive:true});
  window.addEventListener("pointerup",focusDragEnd);
  window.addEventListener("pointercancel",focusDragEnd);
  document.addEventListener("keydown",e=>{
    if(!workoutActive||logMode!=="focus")return;
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    const el=e.target instanceof Element?e.target:null;
    if(el&&el.closest("input,select,textarea,[contenteditable]"))return;
    if(e.key==="ArrowRight")focusGo(1);
    else if(e.key==="ArrowLeft")focusGo(-1)});
  const woDate=$("#date");if(woDate)woDate.addEventListener("change",()=>closeWorkoutOverflow());
  const progEdit=$("#programEditToggle");if(progEdit)progEdit.onclick=()=>{programEditMode=!programEditMode;renderProgram()};
  const histSearchBtn=$("#historySearchBtn");if(histSearchBtn)histSearchBtn.onclick=()=>{$("#historySearchWrap")?.classList.toggle("hidden");$("#historySearch")?.focus()};
  const histSearch=$("#historySearch");if(histSearch)histSearch.oninput=()=>{histQuery=histSearch.value;renderHistory()};
  const histExport=$("#historyExportBtn");if(histExport)histExport.onclick=exportCsv;
  const gotoVol=$("#gotoVolume");if(gotoVol)gotoVol.onclick=()=>setStatsSeg("volume");
  const statsPeriod=$("#statsPeriod");if(statsPeriod)statsPeriod.onclick=()=>{volWindow=volWindow===7?28:7;$$("#volWindow button").forEach(b=>{const on=+b.dataset.win===volWindow;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false")});renderStats();renderCompleted()};
  const restRow=$("#restSecRow");if(restRow)restRow.onclick=()=>$("#restSecPanel")?.classList.toggle("is-open");
  const rirRow=$("#rirModeRow");if(rirRow)rirRow.onclick=()=>$("#rirModePanel")?.classList.toggle("is-open");
  const progRow=$("#progressionRow");if(progRow)progRow.onclick=()=>{const d=$("#progressionDetails");if(d)d.classList.toggle("is-open")};
  const notifyCfg=$("#notifyConfigRow");if(notifyCfg)notifyCfg.onclick=()=>$("#notifyTypes")?.classList.toggle("is-open");
  const dataBackup=$("#dataBackupRow");if(dataBackup)dataBackup.onclick=()=>$("#dataBackupPanel")?.classList.toggle("is-open");
  const dataImport=$("#dataImportRow");if(dataImport)dataImport.onclick=()=>$("#dataImportPanel")?.classList.toggle("is-open");
  const voiceTog=$("#voiceToggle");if(voiceTog)voiceTog.onclick=()=>{const c=$("#voiceInputEnabled");if(c){c.checked=!c.checked;commitSettings(true)}};
  const notifyTog=$("#notifyToggle");if(notifyTog)notifyTog.onclick=()=>{const c=$("#notifyEnabled");if(c){c.checked=!c.checked;c.dispatchEvent(new Event("change"))}};
  const onbCancel=$("#onbCancel");if(onbCancel)onbCancel.onclick=()=>{if(onbStep>0){onbStep--;renderOnboarding()}else closeOnboarding()};
  document.addEventListener("visibilitychange",onAppVisible);
  $("#glossary .glossary__close").onclick=()=>$("#glossary").classList.add("hidden");
  document.addEventListener("click",e=>{const g=$("#glossary");if(!g||g.classList.contains("hidden"))return;
    if(!g.contains(e.target)&&!e.target.closest("[data-term]"))g.classList.add("hidden")});
  // Comma decimals from locale keypads: rewrite digit-comma-digit to a period
  // as the user types so steppers, drafts, and saves all see a parseable value.
  document.addEventListener("input",e=>{
    const t=e.target;if(!(t instanceof HTMLInputElement))return;
    if((t.getAttribute("inputmode")||t.inputMode)!=="decimal")return;
    const next=t.value.replace(/(\d),(\d)/g,"$1.$2");
    if(next===t.value)return;
    const s=t.selectionStart,en=t.selectionEnd;t.value=next;
    if(s!=null)try{t.setSelectionRange(s,en)}catch{}});
  $$("[data-term]").forEach(b=>{if(!b.onclick)b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)}});
  $("#statsDeep").addEventListener("toggle",()=>{if($("#statsDeep").open)redrawChart()});
  $("#date").value=today();
  $("#bodyweight").value=lastBodyweight();
  updateBodyweightField();
  $("#modeFull").onclick=()=>setLogMode("full");
  $("#modeFocus").onclick=()=>setLogMode("focus");
  const vBtn=$("#voiceBtn");if(vBtn)vBtn.onclick=()=>{closeWorkoutOverflow();startVoiceInput()};
  updateVoiceBtn();
  $("#logForm").onsubmit=saveWorkout;
  $("#statExercise").onchange=renderStats;
  $("#saveProgram").onclick=saveProgram;
  $("#exportProgram").onclick=exportProgram;
  $("#importProgram").onchange=importProgramFile;
  $("#addDay").onclick=()=>{day=prog.addDay();persistProgram();render();toast(t("toast.day_added"))};
  $("#endBlock").onclick=promptEndBlock;
  $("#saveSettings").onclick=()=>commitSettings(false);
  $("#beginnerProgram").onclick=()=>{if(confirm(t("confirm.replace_program_template")))switchToBeginnerProgram()};
  $("#createProgram").onclick=()=>startOnboarding();
  $("#onbBack").onclick=()=>{if(onbStep>0){onbStep--;renderOnboarding()}};
  $("#onbNext").onclick=()=>{if(onbStep<7&&onbCanNext()){onbStep++;renderOnboarding()}};
  ["#jumpPct","#minJump","#rirHigh","#hardRir","#restSec","#unit","#lang"].forEach(sel=>$(sel).onchange=()=>commitSettings(true));
  $$('input[name="rirMode"]').forEach(r=>r.onchange=()=>commitSettings(true));
  const vi=$("#voiceInputEnabled");if(vi)vi.onchange=()=>commitSettings(true);
  const ne=$("#notifyEnabled");
  if(ne)ne.onchange=()=>{const turningOn=!state.settings.notify?.enabled&&ne.checked;
    let req=null;if(turningOn&&window.RepForgeNotify)req=RepForgeNotify.request();
    commitSettings(true);if(req)Promise.resolve(req).then(()=>renderSettings())};
  ["#notifyTimer","#notifySession","#notifyUnfinished","#notifyMissed"].forEach(sel=>{const el=$(sel);if(el)el.onchange=()=>commitSettings(true)});
  $$("#volWindow button").forEach(b=>b.onclick=()=>{volWindow=+b.dataset.win;renderCompleted()});
  $$("#statsSeg button").forEach(b=>b.onclick=()=>setStatsSeg(b.dataset.seg));
  const lc=$("#logContext");if(lc)lc.onclick=()=>{navTo("stats");setStatsSeg("review")};
  $("#exportCsv").onclick=exportCsv;$("#exportJson").onclick=exportJson;$("#importJson").onchange=importJson;
  $("#reset").onclick=()=>{if(confirm(t("confirm.delete_log"))){state.log=[];clearDraft();save();render();toast(t("toast.log_deleted"))}};
  $$("nav button").forEach(b=>b.onclick=()=>{exView=null;workoutActive=false;workoutLeft=true;
    document.body.classList.remove("is-settings","is-exercise","is-onboarding","is-workout");
    $$("nav button").forEach(x=>{const on=x===b;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===b.dataset.view));window.scrollTo({top:0});render()});
  $("#exBack").onclick=closeExerciseView;
  $("nav button.active")?.setAttribute("aria-current","page");
  render();
  maybeUnfinishedOnOpen();
  maybeShowOnboarding();
  if(!$("#onboarding").classList.contains("active"))maybeShowInstallBanner();
}
function applyGotoParam(){
  try{
    const u=new URL(location.href);
    const g=u.searchParams.get("goto");
    if(g && days().includes(g)) day=g;
    if(u.searchParams.has("goto")){
      u.searchParams.delete("goto");
      history.replaceState({}, "", u.pathname+u.search+u.hash);
    }
  }catch{}
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
  applyGotoParam();
  migrateLog();
  persist();
  if(I18N)I18N.setLang(state.settings.lang);
  init();
}
boot();
