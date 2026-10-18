/** The canvas trend is presentation over already-derived session facts. */
/** @param {Pick<import("./exercise-contracts.js").ChartOptions,"window"|"copy"|"format"> & {onPresentation?:(kind:string)=>void}} options */
export function createExerciseTrend({window,copy,format,onPresentation}){
const {document,devicePixelRatio}=window,{t}=copy;
const getComputedStyle=window.getComputedStyle.bind(window);
const {number:fmt,displayLoad:toDisplay,unit:unitLabel,date:shortDate}=format;
/** @param {string} selector */
const $=selector=>/** @type {HTMLCanvasElement|null} */(document.querySelector(selector));
/** @param {number} rngKg */
function chartLabelDecimals(rngKg){return toDisplay(rngKg/3)<1?1:0}

function chartPalette(){
  const css=getComputedStyle(document.documentElement),rootSize=parseFloat(css.fontSize)||16;
  const tok=/** @param {string} n */ n=>(css.getPropertyValue(n)||"").trim();
  return{
    accent:tok("--accent")||"#E04E14",
    deep:tok("--color-action-text")||"#B8410E",
    text:tok("--color-ink-secondary")||"#6E6A63",
    ink:tok("--color-ink")||"#1B1A17",
    rule:tok("--boundary-decorative")||"#E4E1DA",
    bg:tok("--bg")||"#F4F2EF",
    surface:tok("--color-surface")||"#FFFFFF",
    captionSize:rootSize*(parseFloat(tok("--font-size-caption"))||.75),
    fontFamily:tok("--font-language")||"sans-serif",
    strongWeight:tok("--weight-semibold")||"600"
  }}

/** @param {readonly import("../../app/exercise-contracts.js").TrendRow[]} rows @param {string} sel */
function draw(rows,sel="#chart"){
  const c=$(sel);if(!c)return;
  const ctx=/** @type {CanvasRenderingContext2D} */(c.getContext("2d")),w=c.clientWidth||320,h=240,ratio=devicePixelRatio||1;
  c.width=w*ratio;c.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const pal=chartPalette(),C={accent:pal.accent,steel:pal.text,dim:pal.text,rule:pal.rule,mist:pal.ink};
  const fontSize=`${pal.captionSize}px`,fontFamily=pal.fontFamily;
  ctx.font=`${fontSize} ${fontFamily}`;ctx.textBaseline="middle";
  if(!rows.length){
    ctx.fillStyle=C.steel;ctx.textAlign="center";
    /** @type {string[]} */const lines=[];
    for(const word of t("stats.chart.empty").split(/\s+/)){
      const current=lines.at(-1),candidate=current?`${current} ${word}`:word;
      if(current&&ctx.measureText(candidate).width>w-24)lines.push(word);
      else if(current)lines[lines.length-1]=candidate;
      else lines.push(word)
    }
    const lineHeight=pal.captionSize*1.35,startY=h/2-(lines.length-1)*lineHeight/2;
    lines.forEach((line,index)=>ctx.fillText(line,w/2,startY+index*lineHeight));return
  }
  const vals=rows.map(r=>r.e1rm??r.top),max=Math.max(...vals),min=Math.min(...vals),span=max-min||1,pad=span*0.25;
  const lo=Math.max(0,min-pad),hi=max+pad,rng=hi-lo||1;
  const decimals=chartLabelDecimals(rng),yLabel=/** @param {number} v */ v=>{const d=toDisplay(v);return decimals?fmt(+d.toFixed(1)):fmt(Math.round(d))};
  const tickLabels=Array.from({length:4},(_,i)=>`${yLabel(hi-(rng*i/3))} ${unitLabel()}`);
  const measuredLeft=Math.max(...tickLabels.map(label=>ctx.measureText(label).width));
  const padL=Math.max(42,Math.ceil(measuredLeft)+12),padR=14;
  const padT=Math.max(22,pal.captionSize*1.35),padB=Math.max(26,pal.captionSize*1.5);
  const iw=Math.max(1,w-padL-padR),ih=Math.max(1,h-padT-padB);
  const X=/** @param {number} i */ i=>padL+(rows.length===1?iw/2:i*iw/(rows.length-1)),Y=/** @param {number} v */ v=>padT+ih-((v-lo)/rng)*ih;
  const accent=pal.accent;
  ctx.strokeStyle=C.rule;ctx.lineWidth=1;ctx.fillStyle=C.dim;ctx.textAlign="right";
  for(let i=0;i<=3;i++){const gy=padT+ih*i/3;ctx.beginPath();ctx.moveTo(padL,gy);ctx.lineTo(w-padR,gy);ctx.stroke();ctx.fillText(tickLabels[i],padL-8,gy)}
  // Sparse-evidence policy (UI-29 / G-27): one point is a snapshot with no
  // connector, two points a comparison with a restrained secondary connector,
  // three or more a trend. The line never draws before the evidence supports it.
  const presentation=rows.length>=3?"trend":rows.length===2?"comparison":"snapshot";
  onPresentation?.(presentation);
  ctx.strokeStyle=accent;ctx.lineJoin="round";ctx.lineCap="round";
  if(presentation==="trend"){ctx.lineWidth=2;
    ctx.beginPath();rows.forEach((r,i)=>{const v=r.e1rm??r.top;i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v))});ctx.stroke()}
  else if(presentation==="comparison"){ctx.lineWidth=1.5;ctx.globalAlpha=.4;
    ctx.beginPath();rows.forEach((r,i)=>{const v=r.e1rm??r.top;i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v))});ctx.stroke();ctx.globalAlpha=1}
  else onPresentation?.(presentation);
  rows.forEach((r,i)=>{const v=r.e1rm??r.top,last=i===rows.length-1;ctx.beginPath();ctx.arc(X(i),Y(v),last?4:3.5,0,7);
    ctx.fillStyle=accent;ctx.fill()});
  const lastV=rows[rows.length-1].e1rm??rows[rows.length-1].top,lx=X(rows.length-1),ly=Y(lastV),valueLabel=`${fmt(Math.round(toDisplay(lastV)))} ${unitLabel()}`;
  ctx.fillStyle=pal.deep;ctx.font=`${pal.strongWeight} ${fontSize} ${fontFamily}`;
  const alignRight=lx+ctx.measureText(valueLabel).width+10>w-padR;ctx.textAlign=alignRight?"right":"left";
  ctx.fillText(valueLabel,lx+(alignRight?-10:9),ly-pal.captionSize*.75);
  ctx.fillStyle=C.dim;ctx.font=`${fontSize} ${fontFamily}`;ctx.textBaseline="alphabetic";
  ctx.textAlign="left";ctx.fillText(shortDate(rows[0].date),padL,h-8);
  if(rows.length>2){ctx.textAlign="center";ctx.fillText(shortDate(rows[Math.floor(rows.length/2)].date),padL+iw/2,h-8)}
  ctx.textAlign="right";ctx.fillText(shortDate(rows[rows.length-1].date),w-padR,h-8);
}

return Object.freeze({draw,palette:chartPalette,labelDecimals:chartLabelDecimals});
}
