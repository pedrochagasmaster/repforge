const KEY="repforge_v1",DRAFT="repforge_draft_v1";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const uid=()=>crypto?.randomUUID?.()||`id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmt=v=>Number.isFinite(Number(v))?(Number.isInteger(Number(v))?String(Number(v)):Number(v).toFixed(2).replace(/\.?0+$/,"")):"";
const kfmt=v=>{const n=Number(v)||0;return n>=10000?(n/1000).toFixed(n>=100000?0:1).replace(/\.0$/,"")+"k":String(Math.round(n))};
const avg=a=>a.length?a.reduce((s,x)=>s+Number(x||0),0)/a.length:0;
const sum=a=>a.reduce((s,x)=>s+Number(x||0),0);
const e1rm=(load,reps)=>load>0&&reps>0?load*(1+reps/30):0;
const muscles=s=>String(s||"").split(",").map(x=>x.trim()).filter(Boolean);
const shortDate=d=>{const p=String(d||"").split("-");return p.length===3?`${+p[1]}/${+p[2]}`:String(d||"")};
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.remove("hidden");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add("hidden"),2400)};
const download=(text,name,type="text/plain")=>{const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement("a");a.href=u;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(u)};

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
  }
  static posInt(v,fallback){const n=Math.round(+v);return Number.isFinite(n)&&n>0?n:fallback}
  toJSON(){return {id:this.id,day:this.day,order:this.order,name:this.name,sets:this.sets,min:this.min,max:this.max,primary:this.primary,secondary:this.secondary}}
}

class Program{
  constructor(list=[]){this.exercises=(Array.isArray(list)?list:[]).map(e=>new Exercise(e));this.renumber()}
  days(){return [...new Set(this.exercises.map(e=>e.day))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))}
  forDay(d){return this.exercises.filter(e=>e.day===d).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name))}
  find(id){return this.exercises.find(e=>e.id===id)}
  renumber(){for(const d of this.days())this.forDay(d).forEach((e,i)=>e.order=i+1)}
  toJSON(){return this.exercises.map(e=>e.toJSON())}
  update(id,field,value){const e=this.find(id);if(!e)return;
    if(field==="sets"||field==="min"||field==="max")e[field]=Exercise.posInt(value,e[field]);
    else if(field==="name"||field==="primary"||field==="secondary")e[field]=value;}
  addExercise(day){const order=Math.max(0,...this.forDay(day).map(e=>e.order))+1;
    const e=new Exercise({day,order,name:"New exercise",sets:3,min:6,max:10});this.exercises.push(e);return e}
  removeExercise(id){this.exercises=this.exercises.filter(e=>e.id!==id);this.renumber()}
  move(id,dir){const e=this.find(id);if(!e)return;const list=this.forDay(e.day),i=list.indexOf(e),j=i+dir;
    if(j<0||j>=list.length)return;[list[i].order,list[j].order]=[list[j].order,list[i].order]}
  addDay(){const ds=this.days();let n=ds.length+1,name=`Day ${n}`;while(ds.includes(name))name=`Day ${++n}`;
    this.exercises.push(new Exercise({day:name,order:1,name:"New exercise",sets:3,min:6,max:10}));return name}
  renameDay(oldName,newName){const nv=String(newName).trim();if(!nv||nv===oldName)return false;
    for(const e of this.exercises)if(e.day===oldName)e.day=nv;this.renumber();return true}
  removeDay(d){this.exercises=this.exercises.filter(e=>e.day!==d)}
  volume(){const m=new Map();for(const e of this.exercises){
    for(const x of muscles(e.primary))addVol(m,x,e.sets,0);
    for(const x of muscles(e.secondary))addVol(m,x,0,e.sets*.5)}return m}
}

let state=load(),prog=new Program(state.program),day=days()[0]||"Day 1",installPrompt=null;
state.program=prog.toJSON();

function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s?.program&&Array.isArray(s.log))return s}catch{}return{settings:{jumpPct:2.5,minJump:2.5,rirHigh:2},program,log:[]}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function days(){return [...new Set(state.program.map(x=>x.day))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))}
function exercises(d=day){return state.program.filter(x=>x.day===d).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name))}
function last(name){const r=state.log.filter(x=>x.name===name).sort((a,b)=>String(a.date).localeCompare(b.date)||String(a.created).localeCompare(b.created));if(!r.length)return[];const id=r.at(-1).session;return r.filter(x=>x.session===id).sort((a,b)=>a.set-b.set)}
function round(v){const inc=+state.settings.minJump||2.5;return Math.round(v/inc)*inc}

// Recommendation -> double progression, mapped to a temperature/status.
function recommendation(ex){
  const l=last(ex.name);
  if(!l.length)return{status:"new",heat:.12,label:"New lift",text:`No history yet. Pick a load you can hold for ${ex.min}-${ex.max} reps at 0-${state.settings.rirHigh} RIR.`,load:null};
  const reps=l.map(x=>+x.reps),rirs=l.map(x=>+x.rir),loads=l.map(x=>+x.load).sort((a,b)=>a-b),load=loads[Math.floor(loads.length/2)],minReps=Math.min(...reps),rir=avg(rirs);
  if(minReps>=ex.max&&rir>=state.settings.rirHigh+1)return{status:"add2",heat:1,label:"Add load ++",text:"You topped the range with reps in reserve. Jump up boldly.",load:round(load+Math.max(load*state.settings.jumpPct*2/100,state.settings.minJump))};
  if(minReps>=ex.max)return{status:"add",heat:.82,label:"Add load",text:"You hit the top of the range on every set. Add weight.",load:round(load+Math.max(load*state.settings.jumpPct/100,state.settings.minJump))};
  if(minReps<ex.min)return{status:"reduce",heat:.18,label:"Back off",text:`A set dropped below ${ex.min} reps. Hold or trim the load and rebuild.`,load};
  return{status:"hold",heat:.48,label:"Hold · add reps",text:"Keep the load and chase more reps inside your RIR target.",load};
}

function render(){renderTabs();renderWorkout();renderStats();renderHistory();renderProgram();renderSettings()}

function renderTabs(){const ds=days();if(!ds.includes(day))day=ds[0]||"Day 1";
  $("#dayTabs").innerHTML=ds.map(d=>`<button type="button" role="tab" class="${d===day?"active":""}" data-day="${esc(d)}">${esc(d)}</button>`).join("");
  $$("#dayTabs button").forEach(b=>b.onclick=()=>{day=b.dataset.day;renderTabs();renderWorkout()})}

function renderWorkout(){
  const draft=JSON.parse(localStorage.getItem(DRAFT)||"{}");
  $("#workout").innerHTML=exercises().map(ex=>{
    const r=recommendation(ex),prev=last(ex.name);
    const prevHtml=prev.length?`<p class="prev"><span>Last:</span>${prev.map(x=>`${fmt(x.load)}×${x.reps}<small>@${fmt(x.rir)}</small>`).join(" ")}</p>`:"";
    const rows=Array.from({length:ex.sets},(_,i)=>{const n=i+1,old=prev.find(x=>x.set===n),base=r.load??old?.load??0;
      return `<div class="setrow"><span class="setrow__n">${n}</span>`+
        `<input data-k="${ex.id}_${n}_load" type="number" step="0.5" inputmode="decimal" aria-label="Set ${n} kg" value="${esc(draft[`${ex.id}_${n}_load`]??fmt(base))}">`+
        `<input data-k="${ex.id}_${n}_reps" type="number" step="1" inputmode="numeric" aria-label="Set ${n} reps" value="${esc(draft[`${ex.id}_${n}_reps`]??ex.min)}">`+
        `<input data-k="${ex.id}_${n}_rir" type="number" step="0.5" inputmode="decimal" aria-label="Set ${n} RIR" value="${esc(draft[`${ex.id}_${n}_rir`]??1)}"></div>`;
    }).join("");
    return `<article class="exercise is-${r.status}">`+
      `<div class="ex__top"><div><h3 class="ex__name">${esc(ex.name)}</h3>`+
      `<p class="ex__meta">${ex.sets}×${ex.min}-${ex.max} reps · RIR 0-${fmt(state.settings.rirHigh)}</p></div>`+
      `<span class="ex__tag">${esc(ex.primary)}</span></div>`+
      `<div class="heat"><span class="heat__track"><span class="heat__fill" style="width:${Math.round(r.heat*100)}%"></span></span>`+
      `<span class="chip">${esc(r.label)}</span></div>`+
      `<p class="rec">${esc(r.text)}${r.load!==null?` Target <b>${fmt(r.load)} kg</b>.`:""}</p>`+
      prevHtml+
      `<div class="sets__head"><span>Set</span><span>kg</span><span>reps</span><span>RIR</span></div>${rows}</article>`;
  }).join("");
  $$("#workout input").forEach(i=>i.oninput=()=>{const d={};$$("#workout input").forEach(x=>d[x.dataset.k]=x.value);localStorage.setItem(DRAFT,JSON.stringify(d))});
  updateGauge();updateSaveMeta();
}

function updateGauge(){const exs=exercises();const hot=exs.filter(e=>{const s=recommendation(e).status;return s==="add"||s==="add2"}).length;
  const g=$("#heatGauge"),frac=exs.length?hot/exs.length:0;
  g.querySelector(".gauge__fill").style.width=`${Math.round(frac*100)}%`;
  g.querySelector(".gauge__label").textContent=hot?`${hot} hot`:"forge";
  g.classList.toggle("is-hot",hot>0);}

function updateSaveMeta(){const exs=exercises();const sets=sum(exs.map(e=>e.sets));$("#saveMeta").textContent=`${day} · ${sets} sets`;}

function saveWorkout(e){e.preventDefault();const date=$("#date").value||today(),session=`${date}_${day}_${Date.now()}`,notes=$("#notes").value.trim(),created=new Date().toISOString(),rows=[];
  for(const ex of exercises())for(let n=1;n<=ex.sets;n++)rows.push({session,date,day,name:ex.name,set:n,load:+$(`[data-k="${ex.id}_${n}_load"]`).value||0,reps:+$(`[data-k="${ex.id}_${n}_reps"]`).value||0,rir:+$(`[data-k="${ex.id}_${n}_rir"]`).value||0,notes,created});
  state.log.push(...rows);save();localStorage.removeItem(DRAFT);$("#notes").value="";
  const btn=$(".btn--save");btn.classList.remove("is-stamped");void btn.offsetWidth;btn.classList.add("is-stamped");
  toast(`Workout forged — ${rows.length} sets logged.`);render()}

function summaries(){const m=new Map();
  for(const x of state.log){const k=`${x.session}|${x.name}`;if(!m.has(k))m.set(k,{session:x.session,date:x.date,day:x.day,name:x.name,loads:[],reps:[],rirs:[],sets:0});
    const o=m.get(k);o.loads.push(+x.load);o.reps.push(+x.reps);o.rirs.push(+x.rir);o.sets++}
  return [...m.values()].map(o=>{let top=0,topReps=0,vol=0,best=0;
    o.loads.forEach((ld,i)=>{const rp=o.reps[i];vol+=ld*rp;const e=e1rm(ld,rp);if(e>best)best=e;if(ld>top){top=ld;topReps=rp}});
    return{session:o.session,date:o.date,day:o.day,name:o.name,top,topReps,reps:sum(o.reps),rir:avg(o.rirs),sets:o.sets,volume:vol,e1rm:best};})
    .sort((a,b)=>a.date.localeCompare(b.date)||a.session.localeCompare(b.session))}

function renderStats(){
  const names=[...new Set(state.log.map(x=>x.name))].sort();
  const totalVol=sum(state.log.map(x=>(+x.load||0)*(+x.reps||0)));
  const bestE=state.log.reduce((m,x)=>Math.max(m,e1rm(+x.load,+x.reps)),0);
  const tiles=[
    {label:"Sessions",val:new Set(state.log.map(x=>x.session)).size},
    {label:"Sets logged",val:state.log.length},
    {label:"Volume",val:kfmt(totalVol),unit:"kg"},
    {label:"Best e1RM",val:fmt(Math.round(bestE)),unit:"kg",hot:true},
  ];
  $("#metrics").innerHTML=tiles.map(t=>`<div class="metric${t.hot?" metric--hot":""}"><div class="metric__label">${t.label}</div><div class="metric__val">${t.val}${t.unit?`<small>${t.unit}</small>`:""}</div></div>`).join("");

  const old=$("#statExercise").value;
  $("#statExercise").innerHTML=names.map(n=>`<option>${esc(n)}</option>`).join("")||"<option>No data</option>";
  if(names.includes(old))$("#statExercise").value=old;
  const sel=$("#statExercise").value,rows=summaries().filter(x=>x.name===sel);
  draw(rows);

  if(rows.length){const first=rows[0].top,latest=rows.at(-1).top,delta=latest-first,be=Math.max(...rows.map(r=>r.e1rm));
    const dir=delta>0?"up":delta<0?"down":"";const arrow=delta>0?"▲":delta<0?"▼":"·";
    $("#trend").innerHTML=`<span>Top load <b>${fmt(first)}→${fmt(latest)} kg</b></span>`+
      `<span class="${dir}">${arrow} ${fmt(Math.abs(delta))} kg over ${rows.length} session${rows.length>1?"s":""}</span>`+
      `<span>Best e1RM <b>${fmt(Math.round(be))} kg</b></span>`;
  }else $("#trend").innerHTML="";

  $("#recent").innerHTML=table(rows.slice(-8).reverse().map(x=>({Date:x.date,Top:fmt(x.top),Reps:x.reps,RIR:fmt(x.rir),e1RM:fmt(Math.round(x.e1rm)),Vol:kfmt(x.volume)})));
  const top=names.map(n=>state.log.filter(x=>x.name===n).sort((a,b)=>b.load-a.load)[0]).filter(Boolean).sort((a,b)=>b.load-a.load).map(x=>({Exercise:x.name,kg:fmt(x.load),Reps:x.reps,RIR:fmt(x.rir),Date:x.date}));
  $("#tops").innerHTML=table(top);
}

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

function renderHistory(){
  const sessions=[...new Map(state.log.map(x=>[x.session,x])).values()].sort((a,b)=>String(b.created).localeCompare(String(a.created)));
  $("#sessions").innerHTML=sessions.length?sessions.map(s=>{
    const sets=state.log.filter(r=>r.session===s.session);
    const top=sets.reduce((m,x)=>+x.load>m.load?{load:+x.load,reps:+x.reps}:m,{load:0,reps:0});
    const vol=sum(sets.map(x=>(+x.load||0)*(+x.reps||0)));
    return `<div class="session"><div><div class="session__day">${esc(s.day)}</div>`+
      `<div class="session__sub">${esc(s.date)} · ${sets.length} sets · <span class="session__stat">${fmt(top.load)}×${top.reps}</span> top · ${kfmt(vol)} kg</div></div>`+
      `<button class="session__del" data-del="${esc(s.session)}">Delete</button></div>`;
  }).join(""):`<div class="table"><div class="empty">No sessions yet. Forge your first on the Log tab.</div></div>`;
  $$("[data-del]").forEach(b=>b.onclick=()=>{if(confirm("Delete this session? This cannot be undone.")){state.log=state.log.filter(x=>x.session!==b.dataset.del);save();render();toast("Session deleted.")}});
  const rows=[...state.log].sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name)||a.set-b.set).map(x=>({Date:x.date,Day:x.day,Exercise:x.name,Set:x.set,kg:fmt(x.load),Reps:x.reps,RIR:fmt(x.rir)}));
  $("#historyTable").innerHTML=table(rows);
}

function renderProgram(){renderProgramEditor();renderVolume()}

function renderProgramEditor(){
  const ds=prog.days();
  $("#programEditor").innerHTML=ds.length
    ?ds.map(dayCard).join("")
    :`<div class="table"><div class="empty">No training days yet. Add one to start building your split.</div></div>`;
  if(document.activeElement!==$("#programJson"))$("#programJson").value=JSON.stringify(prog.toJSON().map(({id,...x})=>x),null,2);
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
  `</div>`;
}

function bindEditor(){
  $$("#programEditor [data-field]").forEach(inp=>{
    inp.oninput=()=>{prog.update(inp.dataset.id,inp.dataset.field,inp.value);persistProgram();renderVolume();updateGauge();updateSaveMeta()};
    if(inp.type==="number")inp.onchange=()=>{const e=prog.find(inp.dataset.id);if(e)inp.value=e[inp.dataset.field]};
  });
  $$('#programEditor [data-act="renameDay"]').forEach(inp=>{
    inp.onchange=()=>{const old=inp.dataset.day;if(prog.renameDay(old,inp.value)){if(day===old)day=inp.value.trim();persistProgram();render();toast("Day renamed.")}else inp.value=old};
  });
  $$("#programEditor button[data-act]").forEach(b=>b.onclick=()=>editorAction(b.dataset.act,b.dataset));
}

function editorAction(act,ds){
  if(act==="addEx"){prog.addExercise(ds.day);persistProgram();render();toast("Exercise added.")}
  else if(act==="delEx"){prog.removeExercise(ds.id);persistProgram();render();toast("Exercise removed.")}
  else if(act==="up"){prog.move(ds.id,-1);persistProgram();render()}
  else if(act==="down"){prog.move(ds.id,1);persistProgram();render()}
  else if(act==="delDay"){if(confirm(`Delete ${ds.day} and all of its exercises?`)){prog.removeDay(ds.day);persistProgram();render();toast("Day deleted.")}}
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
  prog=new Program(parsed);persistProgram();day=prog.days()[0]||"Day 1";render();toast("Program saved.")}
  catch{toast("That JSON didn't parse. Check the brackets and commas.")}}

function renderSettings(){$("#jumpPct").value=state.settings.jumpPct;$("#minJump").value=state.settings.minJump;$("#rirHigh").value=state.settings.rirHigh;
  $("#storageNote").textContent=`Everything lives in this browser under "${KEY}". Export a backup before clearing site data or switching phones — there is no cloud copy.`}

function table(rows){if(!rows.length)return'<div class="empty">No data yet.</div>';const h=Object.keys(rows[0]);
  return`<table><thead><tr>${h.map(x=>`<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${h.map(x=>`<td>${esc(r[x])}</td>`).join("")}</tr>`).join("")}</tbody></table>`}

function exportCsv(){const h=["session","date","day","name","set","load","reps","rir","notes","created"],csv=[h.join(","),...state.log.map(r=>h.map(k=>`"${String(r[k]??"").replaceAll('"','""')}"`).join(","))].join("\n");download(csv,`repforge_log_${today()}.csv`,"text/csv")}
function exportJson(){download(JSON.stringify(state,null,2),`repforge_backup_${today()}.json`,"application/json")}
async function importJson(e){const f=e.target.files?.[0];if(!f)return;try{const s=JSON.parse(await f.text());if(!s.program||!Array.isArray(s.log))throw Error();state=s;prog=new Program(state.program);state.program=prog.toJSON();day=days()[0]||"Day 1";save();render();toast("Backup imported.")}catch{toast("That file isn't a valid RepForge backup.")}e.target.value=""}

function init(){
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#installBtn").classList.remove("hidden")});
  $("#installBtn").onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installBtn").classList.add("hidden")}};
  $("#date").value=today();
  $("#logForm").onsubmit=saveWorkout;
  $("#statExercise").onchange=renderStats;
  $("#saveProgram").onclick=saveProgram;
  $("#addDay").onclick=()=>{day=prog.addDay();persistProgram();render();toast("Day added.")};
  $("#saveSettings").onclick=()=>{state.settings={jumpPct:+$("#jumpPct").value||2.5,minJump:+$("#minJump").value||2.5,rirHigh:+$("#rirHigh").value||2};save();render();toast("Settings saved.")};
  $("#exportCsv").onclick=exportCsv;$("#exportJson").onclick=exportJson;$("#importJson").onchange=importJson;
  $("#reset").onclick=()=>{if(confirm("Delete the training log? Export a backup first if you need it.")){state.log=[];save();render();toast("Log deleted.")}};
  $$("nav button").forEach(b=>b.onclick=()=>{$$("nav button").forEach(x=>x.classList.toggle("active",x===b));$$(".view").forEach(v=>v.classList.toggle("active",v.id===b.dataset.view));window.scrollTo({top:0});render()});
  render();
}
init();
