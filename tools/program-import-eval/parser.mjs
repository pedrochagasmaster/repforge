import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {launchChromium,waitForAppBoot} from "../../test/browser.mjs";

const MIME={".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",
  ".json":"application/json",".css":"text/css",".svg":"image/svg+xml",
  ".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",
  ".webp":"image/webp",".woff":"font/woff",".woff2":"font/woff2",
  ".webmanifest":"application/manifest+json",".txt":"text/plain"};
export async function startStaticServer(repoRoot){
  const root=resolve(repoRoot);
  const server=createServer(async (req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
    const path=resolve(root,"."+pathname+(pathname.endsWith("/")?"index.html":""));
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
    try{
      const info=await stat(path);
      const file=info.isDirectory()?resolve(path,"index.html"):path;
      const bytes=await readFile(file);
      res.writeHead(200,{"Content-Type":MIME[extname(file)]||"application/octet-stream",
        "Cache-Control":"no-store"});
      res.end(bytes);
    }catch{res.writeHead(404).end();}
  });
  await new Promise((ok,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",ok)});
  const url="http://127.0.0.1:"+server.address().port+"/";
  return {url,close:()=>new Promise(ok=>server.close(ok))};
}
export async function withTauriferParser(repoRoot,fn){
  const server=await startStaticServer(repoRoot);
  const old=process.env.REPFORGE_URL;
  process.env.REPFORGE_URL=server.url;
  let browser=null;
  try{
    browser=await launchChromium();
    const page=await browser.newPage();
    await page.goto(server.url,{waitUntil:"domcontentloaded"});
    await waitForAppBoot(page,{base:server.url});
    const parse=async reply=>page.evaluate(text=>{
      const parsed=window.__repforgeFreeform?.parseReply(text);
      if(!parsed)return {status:"unreadable"};
      return {
        status:parsed.status||"unreadable",
        exercises:Array.isArray(parsed.exercises)?parsed.exercises.map(x=>({
          day:x.day,order:x.order,name:x.name,
          ...(x.sets==null?{}:{sets:x.sets}),
          ...(x.min==null?{}:{min:x.min}),
          ...(x.max==null?{}:{max:x.max})
        })):[],
        gaps:Array.isArray(parsed.gaps)?parsed.gaps.map(x=>({
          day:x.day,order:x.order,name:x.name,field:x.field,rowIndex:x.rowIndex
        })):[],
        notImported:Array.isArray(parsed.notImported)?parsed.notImported:[]
      };
    },reply);
    return await fn(parse);
  }finally{
    if(browser)await browser.close();
    await server.close();
    if(old===undefined)delete process.env.REPFORGE_URL;
    else process.env.REPFORGE_URL=old;
  }
}
