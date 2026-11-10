import {spawn} from "node:child_process";

/** Bounded subprocess. Providers inherit authentication but get no user prompt logged by this helper. */
export async function runProcess(command,args,input,{cwd,timeoutMs=120000,maxBytes=4*1024*1024}={}){
  const started=performance.now();
  return new Promise((resolve)=>{
    const child=spawn(command,args,{cwd,stdio:["pipe","pipe","pipe"],
      env:{...process.env,NO_COLOR:"1",CI:"1"}});
    let stdout="",stderr="",total=0,timedOut=false,tooLarge=false,spawnError=null;
    const timer=setTimeout(()=>{timedOut=true;child.kill("SIGKILL")},timeoutMs);
    const collect=(stream,kind)=>{
      stream.on("data",chunk=>{
        total+=chunk.length;
        if(total>maxBytes){tooLarge=true;child.kill("SIGKILL");return;}
        if(kind==="out")stdout+=chunk.toString("utf8");else stderr+=chunk.toString("utf8");
      });
    };
    collect(child.stdout,"out");collect(child.stderr,"err");
    child.on("error",err=>{spawnError=err.message});
    child.on("close",(code,signal)=>{
      clearTimeout(timer);
      resolve({stdout,stderr,exitCode:code,signal,timedOut,tooLarge,spawnError,
        latencyMs:Math.round(performance.now()-started)});
    });
    child.stdin.on("error",()=>{});
    child.stdin.end(input);
  });
}
