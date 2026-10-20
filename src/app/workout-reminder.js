/** Unfinished-workout reminder lifetime. Only the durable notification marker
 * survives a reload; timer and commit cursor belong to this instance.
 * @param {{clock:{now:()=>number,setTimeout:(callback:()=>void,delay:number)=>number,clearTimeout:(id:number)=>void},read:()=>{done:number,lastCommitAt:number,enabled:boolean,visible:boolean},metadata:{read:()=>{unfinishedPromptedFor?:number},write:(value:{unfinishedPromptedFor?:number})=>unknown},notifications:{closeTag:(tag:string)=>unknown,fireOS:(message:{title:string,body:string,tag:string,url:string})=>Promise<boolean>},copy:()=>{title:string,body:string},showPrompt:()=>void}} options
 */
export function createWorkoutReminder({clock,read,metadata,notifications,copy,showPrompt}){
 const delay=15*60*1000;
 /** @type {number|null} */let timer=null;
 let lastCommitAt=0,epoch=0,disposed=false;
 const prompted=()=>metadata.read().unfinishedPromptedFor===lastCommitAt;
 /** @param {number} stamp */
 const mark=stamp=>metadata.write({...metadata.read(),unfinishedPromptedFor:stamp});
 function clear(){epoch++;if(timer!==null){clock.clearTimeout(timer);timer=null}notifications.closeTag('repforge-unfinished')}
 function prompt(){mark(lastCommitAt);showPrompt()}
 async function idle(){
  timer=null;
  const facts=read();if(disposed||!facts.done||!facts.enabled||prompted())return;
  if(facts.visible){prompt();return}
  const stamp=lastCommitAt,request=epoch;
  const ok=await notifications.fireOS({...copy(),tag:'repforge-unfinished',url:'./'});
  if(ok&&!disposed&&epoch===request&&lastCommitAt===stamp)mark(stamp);
 }
 /** @param {number} [milliseconds] */
 function arm(milliseconds=delay){clear();if(disposed||!read().enabled)return;timer=clock.setTimeout(()=>{void idle()},Math.max(0,milliseconds))}
 function hydrate(){if(disposed)return;const facts=read();lastCommitAt=facts.lastCommitAt;
  if(!facts.enabled||!facts.done||!lastCommitAt||prompted())return;
  const elapsed=clock.now()-lastCommitAt;if(elapsed>=delay)prompt();else arm(delay-elapsed)
 }
 return Object.freeze({hydrate,clear,
  /** @param {number} [at] */
  committed(at=clock.now()){if(disposed)return;lastCommitAt=at;arm()},
  reset(){clear();lastCommitAt=0},dispose(){if(disposed)return;disposed=true;clear()}});
}
