/** The one Focus rest clock. Device time and interval lifetime are UI-owned. */
export function createRestClock({window}) {
  let end=0,paused=null,length=0,notified=false,announced=false,padsBack=false,timer=null;
  const maximum=3600,minimum=15;
  const clamp=seconds=>Math.min(maximum,Math.max(minimum,Math.round(seconds)||0));
  const plan=defaultSeconds=>length>0?length:defaultSeconds;
  const left=defaultSeconds=>paused!=null?paused:end?end-window.Date.now():plan(defaultSeconds)*1000;
  function disarm(){if(timer){window.clearInterval(timer);timer=null;}}
  function arm(tick){disarm();timer=window.setInterval(tick,250);}
  function start(seconds){if(seconds<=0)return false;length=seconds;paused=null;padsBack=false;end=window.Date.now()+seconds*1000;notified=false;announced=false;return true;}
  function stop(){disarm();end=0;paused=null;announced=false;}
  function nudge(delta,defaultSeconds) {
    if(!end){length=clamp(plan(defaultSeconds)+delta);return {idle:true,rearmed:false};}
    const next=Math.min(maximum*1000,Math.max(-maximum*1000,left(defaultSeconds)+delta*1000));
    if(paused!=null)paused=next;else end=window.Date.now()+next;
    const seconds=Math.ceil(next/1000);if(seconds>length)length=Math.min(maximum,seconds);
    if(next>0){notified=false;announced=false;}
    return {idle:false,rearmed:next>0,needsTick:next>0&&paused==null&&!timer};
  }
  function toggleHold(defaultSeconds) {
    if(!end)return {idle:true};
    if(paused!=null){end=window.Date.now()+paused;paused=null;return {idle:false,resumed:true,needsTick:-left(defaultSeconds)/1000<maximum};}
    paused=end-window.Date.now();disarm();return {idle:false,resumed:false};
  }
  function skip(defaultSeconds){if(!end||Math.round(left(defaultSeconds)/1000)<=0)return false;end=window.Date.now();paused=null;notified=true;return true;}
  function expire(over=0){if(!end)return false;end=window.Date.now()-1-Math.max(0,Math.round(+over||0))*1000;paused=null;disarm();return true;}
  return Object.freeze({plan,left,arm,disarm,start,stop,nudge,toggleHold,skip,expire,clamp,dispose:disarm,
    get end(){return end;},get paused(){return paused;},get ticking(){return timer!=null;},
    get length(){return length;},set length(value){length=value;},
    get notified(){return notified;},set notified(value){notified=value;},
    get announced(){return announced;},set announced(value){announced=value;},
    get padsBack(){return padsBack;},set padsBack(value){padsBack=value;},
  });
}
