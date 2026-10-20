/** @param {{document:Document}} options */
export function createWorkoutReminderView({document}){
 let disposed=false;
 const banner=()=>document.querySelector('#unfinishedBanner');
 function clear(){const el=/** @type {HTMLElement|null} */(banner());if(el){el.classList.add('hidden');el.hidden=true}delete document.body.dataset.unfinishedPrompt}
 return Object.freeze({clear,show(){if(disposed)return;document.body.dataset.unfinishedPrompt='1';
  const el=/** @type {HTMLElement|null} */(banner());if(!el)return;
  el.classList.remove('hidden');el.hidden=false;
  const dismiss=/** @type {HTMLElement|null} */(document.querySelector('#unfinishedDismiss'));
  if(dismiss)dismiss.onclick=()=>{if(!disposed){el.classList.add('hidden');el.hidden=true}}
 },dispose(){disposed=true;clear();const dismiss=/** @type {HTMLElement|null} */(document.querySelector('#unfinishedDismiss'));if(dismiss)dismiss.onclick=null}});
}
