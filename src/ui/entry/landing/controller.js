import {createLandingContent} from './view.js';
import {createLandingProofController} from './proof.js';
/** @typedef {Pick<ReturnType<typeof import('../../settings/install.js').createInstallView>,'decision'|'mode'|'isIOSSafari'|'renderLanding'|'resetPresented'|'dismissPresented'|'closeLanding'>} Install
 * @typedef {import('../../../app/entry.js').LandingProof} Proof
 * @typedef {{ready:boolean,invalid:boolean,name:string,days:number,errorKey:string}} SharedView
 * @typedef {'generic'|'shared'|'shared-invalid'} LandingKind
 * @typedef {{shared:SharedView,proof:Proof}} Paint
 * @typedef {{start:(options?:{userInitiated?:boolean,forceFresh?:boolean})=>void,hasSavedDraft:()=>boolean,selectImport:()=>void,clearShared:()=>void,acceptShared:()=>Promise<unknown>,privacy:()=>void,install:(event:MouseEvent)=>unknown}} Commands
 */
/** Owns the first-run gate, focus, copy and all mounted landing resources.
 * Models contain presentation facts; payload validation, draft persistence and
 * activation remain named application commands.
 * @param {{window:Window & typeof globalThis,motion:{reducedMotion:()=>boolean},install:Install,
 * copy:{t:(key:string,vars?:Record<string,unknown>)=>string,language:()=>string},commands:Commands,
 * report:(event:string,properties:Record<string,string>)=>void,markSeen:()=>void}} options */
export function createEntryLanding({window,motion,install,copy,commands,report,markSeen}){
 const document=window.document,{t}=copy,content=createLandingContent({document,copy});
 /** @param {string} selector */const q=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
 const root=q('#firstRun');
 let active=false,bound=false,focusBound=false;
 /** @type {SharedView} */let shared={ready:false,invalid:false,name:'',days:0,errorKey:''};
 /** @type {ReturnType<typeof createLandingProofController>|null} */let proof=null;
 const routes=['recommend','custom','browse','build','import','shared'];
 function isOpen(){return !!root&&!root.classList.contains('hidden')}
 function returning(){return root?.dataset.entryVisit==='returning'&&!shared.ready&&!shared.invalid}
 function resumeRoute(){return returning()?root?.dataset.entryDraft||'':''}
 /** @param {string} route */function resumeLabel(route){return routes.includes(route)?t(`landing.returning.resume.${route}`):t('landing.returning.resume.generic')}
 function hero(){
  const back=returning(),headline=q('#firstRunHeadline'),lede=q('#firstRunLede');
  if(headline)headline.textContent=t(shared.ready?'setup.shared.title':shared.invalid?'landing.shared.invalid_headline':back?'landing.returning.headline':'landing.headline');
  if(lede)lede.textContent=t(shared.ready?'landing.shared.body':shared.invalid?'landing.shared.invalid_body':back?'landing.returning.sub':'landing.hero.sub');
 }
 function resume(){
  const route=resumeRoute(),label=route?resumeLabel(route):t('landing.build');
  for(const name of ['firstRunCreate','firstRunCreateClose','firstRunCreateDock']){
   const button=q('#'+name),text=q(`#${name}Label`);if(text)text.textContent=label;
   if(button){if(route)button.dataset.entryResume=route;else delete button.dataset.entryResume}
  }
 }
 /** @param {SharedView} model */
 function programMode(model){
  shared={...model};
  q('#firstRunStandardProgram')?.classList.toggle('hidden',shared.ready);
  q('#firstRunSharedProgram')?.classList.toggle('hidden',!shared.ready);
  q('#firstRunSharedCard')?.classList.toggle('hidden',!shared.ready);
  root?.classList.toggle('is-shared',shared.ready);
  const error=q('#firstRunSharedError');
  if(shared.ready){const title=q('#firstRunSharedTitle'),name=q('#firstRunSharedName');
   if(title)title.textContent=t('setup.shared.view');if(name)name.textContent=t(shared.days===1?'setup.shared.cap_one':'setup.shared.cap_many',{name:shared.name,n:shared.days});
   if(error){error.textContent='';error.classList.add('hidden')}
  }else if(error){error.textContent=shared.invalid?t(shared.errorKey):'';error.classList.toggle('hidden',!shared.invalid)}
 }
 /** @param {boolean} busy */
 function sharedBusy(busy){const button=/** @type {HTMLButtonElement|null} */(q('#firstRunSharedStart'));if(button){button.disabled=busy;button.setAttribute('aria-busy',String(busy))}q('#firstRunSharedBusy')?.classList.toggle('hidden',!busy)}
 /** @param {boolean} offer */function setOffer(offer){hero();q('#firstRunContinue')?.classList.toggle('hidden',!offer)}
 /** @param {Paint} model */
 function render(model){
  programMode(model.shared);content.paintDevice();content.render(model.proof);
  const decision=install.decision(),mode=install.mode();setOffer(decision.eligible||mode==='safari'&&decision.state==='unsupported');
  const label=q('#firstRunContinueLabel');if(label)label.textContent=t(install.isIOSSafari()?'setup.continue_safari':'setup.continue_browser');
  install.renderLanding();
 }
 function disposeProof(){proof?.dispose();proof=null}
 function mountProof(){
  disposeProof();if(!root)return;hero();resume();
  proof=createLandingProofController({window,root,motion,copy:{t,language:content.language,number:content.number},state:{returning:returning(),shared:shared.ready}});proof.mount();
 }
 /** @param {KeyboardEvent} event */
 function trapTab(event){
  if(event.key!=='Tab'||!isOpen()||!root)return;
  const selector='a[href],button:not([disabled]),summary,input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const nodes=[.../** @type {NodeListOf<HTMLElement>} */(root.querySelectorAll(selector))].filter(node=>{if(node.hasAttribute('hidden')||node.closest('[hidden]'))return false;const style=window.getComputedStyle(node);return style.display!=='none'&&style.visibility!=='hidden'&&node.getClientRects().length>0});
  if(!nodes.length){event.preventDefault();root.focus();return}
  const current=nodes.indexOf(/** @type {HTMLElement} */(document.activeElement));
  if(event.shiftKey&&current<=0){event.preventDefault();nodes[nodes.length-1].focus()}
  else if(!event.shiftKey&&(current===-1||current===nodes.length-1)){event.preventDefault();nodes[0].focus()}
 }
 /** @param {Paint & {kind:LandingKind,seen:boolean,draftRoute:string}} model */
 function open(model){
  if(!root)return false;active=true;
  const back=model.kind==='generic'&&model.seen;
  root.dataset.entryLanding=model.kind;root.dataset.entryVisit=back?'returning':'first';
  if(back&&model.draftRoute)root.dataset.entryDraft=model.draftRoute;else delete root.dataset.entryDraft;
  render(model);root.classList.remove('hidden');document.body.classList.add('is-firstrun');
  report('landing_viewed',{landing:model.kind==='shared-invalid'?'shared_invalid':model.kind==='shared'?'shared':'generic',visit:back?'returning':'first'});
  window.scrollTo({top:0});root.scrollTop=0;try{root.focus({preventScroll:true})}catch{}
  if(!focusBound){root.addEventListener('keydown',trapTab);focusBound=true}
  mountProof();if(model.kind==='generic'&&!model.seen)markSeen();return true;
 }
 function suspend(){if(!root)return;disposeProof();if(focusBound){root.removeEventListener('keydown',trapTab);focusBound=false}root.classList.add('hidden');document.body.classList.remove('is-firstrun')}
 function close(){active=false;install.resetPresented();suspend()}
 /** @param {string} action */function action(action){report('landing_action',{action})}
 function create(){action('create');close();commands.start()}
 function importProgram(){action('import');close();if(commands.hasSavedDraft()){commands.start();return}commands.start({userInitiated:true,forceFresh:true});commands.selectImport()}
 function continueBrowser(){action('continue_browser');install.dismissPresented();if(shared.ready){install.closeLanding();programMode(shared);return}close();commands.start()}
 /** @param {string} selector @param {(event:MouseEvent)=>unknown} handler */
 function click(selector,handler){const node=q(selector);if(node)node.onclick=handler}
 function bind(){
  if(bound)return;bound=true;
  click('#firstRunInstallLink',event=>{action('install');return commands.install(event)});
  click('#firstRunPrivacy',()=>{action('privacy');commands.privacy()});
  for(const selector of ['#firstRunCreate','#firstRunCreateClose','#firstRunCreateDock'])click(selector,create);
  for(const selector of ['#firstRunImport','#firstRunImportClose'])click(selector,importProgram);
  click('#firstRunContinue',continueBrowser);
  click('#firstRunSharedCreate',()=>{action('create');commands.clearShared();close();commands.start()});
  click('#firstRunSharedStart',async()=>{if(/** @type {HTMLButtonElement|null} */(q('#firstRunSharedStart'))?.disabled)return;action('shared_start');await commands.acceptShared()});
 }
 function proofState(){return proof?{open:true,...proof.live()}:{open:false,listeners:0,observers:0,timers:0,frames:0,pinned:false,step:null,ticks:0}}
 return Object.freeze({open,close,suspend,sharedBusy,setOffer,isOpen,isActive:()=>active,bind,proofState,paintDevice:content.paintDevice});
}
