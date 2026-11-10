/**
 * Durable Object: serializable reservation before every paid provider request.
 *
 * The object stores ONLY daily counters and HMAC-like keyed SHA-256 IP hashes,
 * never raw IP addresses, source programs, prompt text or provider replies.
 * A hard global cap bounds the founder's exposure even against distributed
 * traffic or a solved Turnstile challenge.
 */
export const BUDGET = Object.freeze({
  globalPerDay: 200,
  globalPerMinute: 12,
  ipPerDay: 4,
  ipPerFiveMinutes: 2
});
const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
});
const isoDay=now=>new Date(now).toISOString().slice(0,10);
const isoMinute=now=>Math.floor(now/60000);
const isoFiveMinutes=now=>Math.floor(now/300000);

export class ImportBudget {
  constructor(ctx){this.ctx=ctx}
  async fetch(request){
    if(request.method!=="POST"||new URL(request.url).pathname!=="/reserve")
      return json({ok:false,code:"not_found"},404);
    let data;
    try{data=await request.json()}catch{return json({ok:false,code:"invalid"},400)}
    if(!/^[0-9a-f]{64}$/.test(data?.ipHash||""))
      return json({ok:false,code:"invalid"},400);
    const now=Date.now(),day=isoDay(now),minute=isoMinute(now),five=isoFiveMinutes(now);
    const keys={
      globalDay:"global:"+day,
      globalMinute:"minute:"+minute,
      ipDay:"ip:"+day+":"+data.ipHash,
      ipFive:"ip5:"+five+":"+data.ipHash
    };
    const result=await this.ctx.storage.transaction(async tx=>{
      const values=await Promise.all(Object.values(keys).map(key=>tx.get(key)));
      const [globalDay,globalMinute,ipDay,ipFive]=values.map(x=>Number(x||0));
      let waitSeconds=0;
      if(globalDay>=BUDGET.globalPerDay||ipDay>=BUDGET.ipPerDay)
        waitSeconds=Math.max(60,Math.ceil((Date.parse(day+"T00:00:00.000Z")+86400000-now)/1000));
      else if(globalMinute>=BUDGET.globalPerMinute)
        waitSeconds=Math.max(1,60-Math.floor(now/1000)%60);
      else if(ipFive>=BUDGET.ipPerFiveMinutes)
        waitSeconds=Math.max(1,300-Math.floor(now/1000)%300);
      if(waitSeconds)return {ok:false,retryAfter:waitSeconds};
      await Promise.all([
        tx.put(keys.globalDay,globalDay+1),
        tx.put(keys.globalMinute,globalMinute+1),
        tx.put(keys.ipDay,ipDay+1),
        tx.put(keys.ipFive,ipFive+1)
      ]);
      return {ok:true};
    });
    // Daily cleanup is deliberately bounded and does not affect reservations.
    if(result.ok&&!await this.ctx.storage.getAlarm())
      await this.ctx.storage.setAlarm(Date.now()+86400000);
    return json(result,result.ok?200:429);
  }
  async alarm(){
    const day=isoDay(Date.now()),minutes=isoMinute(Date.now()),five=isoFiveMinutes(Date.now());
    let cursor;
    do{
      const rows=await this.ctx.storage.list({startAfter:cursor,limit:400});
      if(!rows.size)break;
      const expired=[];
      for(const key of rows.keys()){
        if(key.startsWith("global:")||key.startsWith("ip:")){
          const entryDay=key.split(":")[1];
          if(entryDay<day)expired.push(key);
        }else if(key.startsWith("minute:")||key.startsWith("ip5:")){
          const parts=key.split(":");
          const period=Number(parts[1]);
          if(period<(key.startsWith("minute:")?minutes-2:five-2))
            expired.push(key);
        }
      }
      if(expired.length)await this.ctx.storage.delete(expired);
      cursor=[...rows.keys()].at(-1);
      if(rows.size<400)break;
    }while(cursor);
    await this.ctx.storage.setAlarm(Date.now()+86400000);
  }
}
