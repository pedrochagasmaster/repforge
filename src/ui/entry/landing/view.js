import {escapeHtml as esc,formatNumberPlain as fmtPlain} from '../../format.js';
import {LANDING_SPOTS,LANDING_READ,LANDING_PASTE_SHOT} from './artwork.js';
/** @typedef {import('../../../app/entry.js').LandingProof} Frame
 * @typedef {NonNullable<Frame['recommendations'][string]>} Recommendation */
/** Landing copy/media consumes one explicit example frame; no engine, live
 * training snapshot, identity allocation or storage is reachable from paint.
 * @param {{document:Document,copy:{t:(key:string,vars?:Record<string,unknown>)=>string,language:()=>string}}} options */
export function createLandingContent({document,copy}){
 const {t}=copy;
 const language=()=>copy.language()==='pt'?'pt':'en';
 /** @param {unknown} value */
 const number=value=>{const s=fmtPlain(value);return language()==='pt'?s.replace('.',','):s};
 /** @param {Frame & {defaultWeeks:number}} frame */
 function render(frame){
 const {cases:LANDING_CASES,chartInput:LANDING_CHART,unit:LANDING_UNIT}=frame;
const landingLang=language;
/** @param {unknown} v */
const landingNum=number;
/** @param {unknown} v */
const landingKg=v=>`${landingNum(v)} ${LANDING_UNIT}`;
/** @param {string} id */
const landingExerciseName=id=>frame.names[id]?.[landingLang()]||'';
/** "7, 6 and 6" / "7, 6 e 6": the list pattern comes from the language, not from code. */
/** @param {readonly number[]} values */
function landingList(values){
  const items=values.map(landingNum);
  try{return new Intl.ListFormat(landingLang()==="pt"?"pt-BR":"en-GB",{style:"long",type:"conjunction"}).format(items)}
  catch{return items.join(", ")}}
/** A catalog template as markup: the template is escaped, then each {name} becomes
 *  escaped text or, for an app control's label, the bold interface term. */
/** @param {string} key @param {Record<string,unknown>} text @param {Record<string,unknown>} terms */
function landingRich(key,text,terms={}){
  return esc(t(key)).replace(/\{(\w+)\}/g,(whole,/** @type {string} */ name)=>
    name in terms?`<b class="firstrun-ui">${esc(terms[name])}</b>`:name in text?esc(text[name]):whole)}
/** @param {string} status @param {Recommendation} c */
function landingCue(status,c){
  const move=status==="advance"?"up":status==="reduce"?"down":"hold";
  return`${t(`focus.cue.${move}`,{load:landingNum(c.load),unit:LANDING_UNIT})} · ${t("focus.cue.reps",{reps:landingNum(c.reps)})}`}
/** @param {string} scene @param {Recommendation|null} add */
function landingSceneAlt(scene,add){
  const c=LANDING_CASES.add,first=c.logged[0];
  if(scene==="focus")return t("landing.demo.alt.focus",{exercise:landingExerciseName(c.ex),sets:landingNum(c.sets),
    min:landingNum(c.repMin),max:landingNum(c.repMax),load:landingKg(first[0]),reps:landingNum(first[1]),rir:landingNum(first[2]),
    cue:add?landingCue(add.status,add):"",action:t("today.log_set")});
  if(scene==="actions")return t("landing.demo.alt.actions",{action:t("ex.actions.substitute")});
  return scene==="rest"?t("landing.demo.alt.rest"):t("landing.demo.alt.note")}
/** The read of one step as a crop: the spot grown by the lens padding (a share of
 *  a 390 by 844 screen), as the five numbers the static card's CSS needs. */
/** @param {string} scene @param {string[]} reads */
function landingCropBox(scene,reads){
  const name=reads[reads.length-1],spot=LANDING_SPOTS[scene]?.[name],read=LANDING_READ[name];
  if(!spot||!read)return null;
  const padW=2*read.pad/390*100,padH=2*read.pad/844*100;
  return{x:spot[0],y:spot[1],w:Math.min(100,spot[2]+padW),h:Math.min(100,spot[3]+padH)}}
/** @param {Recommendation|null} add */
function renderLandingProof(add){
  const root=document.querySelector("#firstRun");if(!root)return;
  const lang=landingLang();
  /** @param {string} key @param {string} html */
  const fill=(key,html)=>{const node=root.querySelector(`[data-landing-fill="${key}"]`);if(node)node.innerHTML=html};
  /** @param {string} key @param {string} value */
  const text=(key,value)=>{const node=root.querySelector(`[data-landing-fill="${key}"]`);if(node)node.textContent=value};
  const c=LANDING_CASES.add,first=c.logged[0];
  text("s2",t("landing.demo.s2.text"));
  text("s3",t("landing.demo.s3.title",{action:t("today.log_set")}));
  fill("s5",landingRich("landing.demo.s5.text",{},{action:t("ex.actions.substitute")}));
  if(add){
    text("s7.value",t("landing.outcomes.target",{load:landingKg(add.load),reps:landingNum(add.reps)}));
    text("s7.sets",t("landing.demo.s7.sets",{sets:landingNum(c.sets)}));
    text("s7",t("landing.demo.s7.text",{done_reps:landingNum(first[1]),load:landingKg(first[0]),sets:landingNum(c.sets),
      min:landingNum(c.repMin),max:landingNum(c.repMax),next_load:landingKg(add.load),next_reps:landingNum(add.reps)}))}
  const seen=new Set();
  root.querySelectorAll("[data-landing-step]").forEach(step=>{
    const scene=step.getAttribute("data-scene")||"",reads=(step.getAttribute("data-read")||"").split(" ").filter(Boolean);
    const crop=/** @type {HTMLElement|null} */(step.querySelector(".firstrun-step__crop")),img=step.querySelector("[data-landing-crop]");
    if(img){
      img.setAttribute("src",`assets/brand/wt-${scene}-${lang}-dark.webp`);
      img.setAttribute("alt",seen.has(scene)?"":landingSceneAlt(scene,add))}
    seen.add(scene);
    const box=reads.length?landingCropBox(scene,reads):null;
    if(crop){
      /** @type {[string,number|undefined][]} */const properties=[["sx",box?.x],["sy",box?.y],["sw",box?.w],["sh",box?.h]];
      for(const [name,value] of properties){
        if(value==null)crop.style.removeProperty(`--firstrun-${name}`);
        else crop.style.setProperty(`--firstrun-${name}`,String(Math.round(value*100)/100))}}});
}
/** @param {Frame['recommendations']} results */
function renderLandingOutcomes(results){
  const root=document.querySelector("#firstRun");if(!root)return;
  for(const [id,c] of Object.entries(LANDING_CASES)){
    const node=root.querySelector(`[data-landing-outcome="${id}"]`),got=results[id];
    if(!node||!got)continue;
    const reps=c.logged.map(set=>set[1]),same=reps.every(r=>r===reps[0]);
    const did=same
      ?t("landing.outcomes.did_same",{reps:landingNum(reps[0]),load:landingKg(c.logged[0][0]),sets:landingNum(c.sets),min:landingNum(c.repMin),max:landingNum(c.repMax)})
      :t("landing.outcomes.did_mixed",{list:landingList(reps),load:landingKg(c.logged[0][0]),min:landingNum(c.repMin),max:landingNum(c.repMax)});
    const rule=id==="add"?t("rec.add.text"):id==="hold"?t("rec.hold_add_reps.text"):t("rec.reduce.text",{min:landingNum(c.repMin)});
    const next=node.querySelector("[data-landing-next]");if(next)next.textContent=t("landing.outcomes.target",{load:landingKg(got.load),reps:landingNum(got.reps)});
    const exercise=node.querySelector("[data-landing-exercise]");if(exercise)exercise.textContent=landingExerciseName(c.ex);
    const explain=node.querySelector("[data-landing-explain]");if(explain)explain.textContent=`${did} ${rule}`}}
/** @param {Frame['chart']} fig */
function renderLandingChart(fig){
  const root=document.querySelector("#firstRun");if(!root)return;
  const figure=root.querySelector("[data-landing-chart]");
  if(!figure||!fig)return;
  const vars={exercise:landingExerciseName(LANDING_CHART.libraryId),from:landingNum(fig.from),to:landingKg(fig.to),sessions:landingNum(fig.sessions),metric:t("stats.metric.best_e1rm")};
  const img=figure.querySelector("img");
  if(img){
    const dims=LANDING_CHART.dims[landingLang()];img.setAttribute("width",String(dims[0]));img.setAttribute("height",String(dims[1]));
    img.alt=t("landing.chart.alt",vars)}
  const caption=figure.querySelector("figcaption");if(caption)caption.textContent=t("landing.chart.caption",vars)}
function renderLandingWays(){
  const root=document.querySelector("#firstRun");if(!root)return;
  /** @param {string} key @param {string} html */
  const fill=(key,html)=>{const node=root.querySelector(`[data-landing-fill="${key}"]`);if(node)node.innerHTML=html};
  fill("ways.written",esc(t("landing.ways.written.body",{weeks:landingNum(frame.defaultWeeks)})));
  fill("ways.where",landingRich("landing.ways.paste.where",{},{track:t("landing.track"),hub:t("entry.hub.title"),
    own:t("entry.hub.b.import.title"),paste:t("entry.import_source.to_freeform")}));
  fill("data.pointer",landingRich("landing.data.pointer",{},{settings:t("nav.settings"),privacy:t("privacy.open")}));
  fill("faq.coach.a1",landingRich("landing.faq.coach.a1",{},{control:t("program.share_setup")}));
  fill("faq.data.a2",landingRich("landing.faq.data.a2",{},{settings:t("nav.settings"),toggle:t("settings.analytics.title")}));
  const lang=landingLang(),shot=LANDING_PASTE_SHOT,img=root.querySelector('[data-shot="paste-review"]');
  if(img){
    const dims=shot.dims[lang];img.setAttribute("width",String(dims[0]));img.setAttribute("height",String(dims[1]));
    const typed=String(t("landing.ways.paste.message")).split("\n")[1]?.replace(/\s+\d+x[\d-]+\s*$/,"")||"";
    img.setAttribute("alt",t("landing.ways.paste.alt",{screen:t("import.heading"),linked:landingNum(shot.counts[lang].linked),review:landingNum(shot.counts[lang].review),
      typed,exercise:landingExerciseName(shot.exercise),status:t("import.status.probable")}))}}
/** Everything on the landing that is a number or is built from one. */

 renderLandingProof(frame.recommendations.add||null);renderLandingOutcomes(frame.recommendations);renderLandingChart(frame.chart);renderLandingWays();
 }
 function paintDevice(){
  const lang=copy.language()==='pt'?'pt':'en',theme=document.documentElement.dataset.theme==='dark'?'dark':'light';
  document.querySelectorAll('img[data-shot]').forEach(image=>{image.setAttribute('src',`assets/brand/${image.getAttribute('data-shot')}-${lang}-${theme}.webp`)});
 }
 return Object.freeze({render,paintDevice,language,number});
}
