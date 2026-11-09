import test from "node:test";
import assert from "node:assert/strict";
import {createManagedImportHandler,ImportBudget} from "../src/index.js";
import {IMPORT_PROMPTS} from "../src/prompts.mjs";
import {BUDGET} from "../src/budget.js";

const origin="https://taurifer.com";
const path=origin+"/api/program-import";
const text="Treino A\nSupino reto 3x8-12";
const correctReply='{"version":3,"meta":{"name":"Treino A"},"exercises":[{"day":"Treino A","order":1,"name":"Supino reto","sets":3,"min":8,"max":12}],"missing":[],"notImported":[]}';
const payload=(override={})=>({source:text,locale:"pt",token:"turnstile-valid-token",...override});
const req=(p=payload(),headers={})=>new Request(path,{method:"POST",headers:{"Content-Type":"application/json",Origin:origin,"CF-Connecting-IP":"198.51.100.24",...headers},body:JSON.stringify(p)});
const read=async res=>JSON.parse(await res.text());
function setup(opts={}){
  const stored=new Map();let alarm=null;const calls=[];
  const storage={
    async transaction(fn){return fn(storage)},
    async get(k){return stored.get(k)},
    async put(k,v){stored.set(k,v)},
    async getAlarm(){return alarm},
    async setAlarm(t){alarm=t},
    async list(){return new Map(stored)},
    async delete(keys){keys.forEach(k=>stored.delete(k))}
  };
  const budget=new ImportBudget({storage});
  const env={
    MANAGED_IMPORT_ENABLED:"true",
    MANAGED_IMPORT_ALLOWED_ORIGIN:origin,
    ANTHROPIC_API_KEY:"anthropic-secret-test",
    TURNSTILE_SECRET_KEY:"turnstile-secret-test",
    TURNSTILE_SITE_KEY:"public-widget-key",
    IMPORT_IP_PEPPER:"a-long-private-pepper-for-tests",
    IMPORT_BUDGET:{
      idFromName:()=>({name:"global-v1"}),
      get:()=>({fetch:r=>budget.fetch(r)})
    }
  };
  const fetchImpl=async(url,request)=>{
    calls.push({url,request});
    if(url.includes("siteverify"))return Response.json(
      opts.challenge||{success:true,hostname:"taurifer.com",action:"program_import"});
    if(url.includes("api.anthropic.com"))return Response.json(
      opts.provider||{type:"message",model:"claude-haiku-5-5",stop_reason:"end_turn",
        content:[{type:"thinking",thinking:"private notes"},{type:"text",text:correctReply}]});
    throw new Error("Unexpected upstream URL");
  };
  return {env,handle:createManagedImportHandler({fetchImpl}),calls,stored};
}
test("config exposes only sitekey, with kill switch",async()=>{
  const {env,handle}=setup();
  assert.deepEqual(await read(await handle(new Request(path+"/config"),env)),{
    enabled:true,sitekey:"public-widget-key",maxChars:12000
  });
  assert.equal((await read(await handle(new Request(path+"/config"),{
    ...env,MANAGED_IMPORT_ENABLED:"false"
  }))).enabled,false);
});
test("successful request uses canonical locale prompt and hides reasoning",async()=>{
  const {env,handle,calls,stored}=setup();
  const result=await handle(req(),env);
  assert.equal(result.status,200);
  assert.deepEqual(await read(result),{ok:true,reply:correctReply});
  assert.equal(calls.length,2);
  const challenge=new URLSearchParams(calls[0].request.body);
  assert.equal(challenge.get("secret"),env.TURNSTILE_SECRET_KEY);
  assert.equal(challenge.get("remoteip"),null);
  const provider=JSON.parse(calls[1].request.body);
  assert.equal(provider.model,"claude-haiku-5-5");
  assert.equal(provider.output_config.effort,"medium");
  assert.equal(provider.max_tokens,16384);
  assert.equal(provider.messages[0].content,IMPORT_PROMPTS.pt.replace("{program}",text));
  assert.equal(calls[1].request.headers["x-api-key"],env.ANTHROPIC_API_KEY);
  assert(!JSON.stringify([...stored]).includes(text));
  assert(!JSON.stringify([...stored]).includes("198.51.100.24"));
});
test("invalid input, origin and challenge block model spending",async()=>{
  const {env,handle,calls}=setup();
  for(const p of [payload({source:""}),payload({source:"short"}),payload({locale:"de"}),payload({token:""}),payload({extra:"not allowed"}),payload({source:"X".repeat(12001)})])
    assert.equal((await handle(req(p),env)).status,422);
  assert.equal((await handle(req(payload(),{Origin:"https://evil.example"}),env)).status,403);
  assert.equal((await handle(req(payload(),{"Content-Type":"text/plain"}),env)).status,415);
  assert.equal((await handle(req(payload(),{"Content-Length":"65000"}),env)).status,413);
  assert.equal((await handle(req(payload(),{"CF-Connecting-IP":""}),env)).status,403);
  assert.equal(calls.length,0);
  const blocked=setup({challenge:{success:true,hostname:"evil.example",action:"program_import"}});
  assert.equal((await blocked.handle(req(),blocked.env)).status,403);
  assert.equal(blocked.calls.length,1);
});
test("explicit daily per-IP budget cannot be bypassed by further requests",async()=>{
  const {env,handle,calls}=setup();
  for(let i=0;i<BUDGET.ipPerFiveMinutes;i++)assert.equal((await handle(req(),env)).status,200);
  const extra=await handle(req(),env);
  assert.equal(extra.status,429);
  assert.equal((await read(extra)).code,"limit_reached");
  assert.equal(calls.filter(x=>x.url.includes("api.anthropic.com")).length,BUDGET.ipPerFiveMinutes);
});
test("disabled, missing bindings and upstream errors fail closed",async()=>{
  const {env,handle,calls}=setup();
  assert.equal((await handle(req(),{...env,MANAGED_IMPORT_ENABLED:"false"})).status,503);
  assert.equal((await handle(req(),{...env,IMPORT_BUDGET:null})).status,503);
  assert.equal(calls.length,0);
  const failed=setup({provider:{type:"message",model:"claude-haiku-5-5",stop_reason:"max_tokens",content:[{type:"text",text:text}]}});
  const result=await failed.handle(req(),failed.env);
  assert.equal(result.status,502);
  assert.deepEqual(await read(result),{ok:false,code:"provider_unavailable"});
});
test("pasted text is inserted literally, never read as a replacement pattern",async()=>{
  const tricky="Treino A\nSupino reto 3x8-12 $' $& $` $$ {program}";
  const {env,handle,calls}=setup();
  assert.equal((await handle(req(payload({source:tricky})),env)).status,200);
  const [before,after]=IMPORT_PROMPTS.pt.split("{program}");
  assert.equal(JSON.parse(calls[1].request.body).messages[0].content,before+tricky+after);
});
test("the global per-minute cap holds across distinct visitors",async()=>{
  const realNow=Date.now,frozen=Date.parse("2026-11-09T12:00:30.000Z");
  Date.now=()=>frozen; // one budget minute for the whole test
  try{
  const {env,handle,calls}=setup();
  const from=i=>req(payload(),{"CF-Connecting-IP":"198.51.100."+(i+1)});
  for(let i=0;i<BUDGET.globalPerMinute;i++)assert.equal((await handle(from(i),env)).status,200);
  const extra=await handle(from(BUDGET.globalPerMinute),env);
  assert.equal(extra.status,429);
  assert.ok(Number(extra.headers.get("Retry-After"))>=1);
  assert.equal(calls.filter(x=>x.url.includes("api.anthropic.com")).length,BUDGET.globalPerMinute);
  }finally{Date.now=realNow}
});
test("no response carries a secret, the source or provider error detail",async()=>{
  const cases=[
    setup(),
    setup({challenge:{success:false}}),
    setup({provider:{type:"error",error:{type:"authentication_error",message:"bad key anthropic-secret-test"}}})
  ];
  for(const {env,handle} of cases){
    const body=await (await handle(req(),env)).text();
    for(const secret of [env.ANTHROPIC_API_KEY,env.TURNSTILE_SECRET_KEY,env.IMPORT_IP_PEPPER,"198.51.100.24"])
      assert(!body.includes(secret),"response leaked a secret or the visitor IP");
    if(!body.includes('"ok":true'))assert(!body.includes("Supino"),"an error response echoed the source");
  }
});
