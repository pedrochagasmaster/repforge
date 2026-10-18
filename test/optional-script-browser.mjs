import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from './browser.mjs';
const browser=await launchChromium();
try{const context=await browser.newContext(),page=await context.newPage();let requests=0;
 await page.route('**/literal-optional-runtime.js',route=>{requests++;return route.fulfill({contentType:'application/javascript',body:'window.__literalOptionalExecutions=(window.__literalOptionalExecutions||0)+1;'})});
 await page.route('**/literal-optional-failure.js',route=>route.abort());
 await page.goto(process.env.REPFORGE_URL||'http://localhost:8000/');await waitForAppBoot(page);
 const result=await page.evaluate(async()=>{
  const{createOptionalScriptLoader}=await import('./src/platform/optional-script.js');
  const owner=createOptionalScriptLoader({document}),first=owner.load('./literal-optional-runtime.js'),second=owner.load('./literal-optional-runtime.js');
  const same=first===second,success=await first,failure=await owner.load('./literal-optional-failure.js');
  const pending=owner.load('./literal-pending-runtime.js'),node=[...document.scripts].find(script=>script.src.endsWith('/literal-pending-runtime.js'));owner.dispose();
  node?.dispatchEvent(new Event('load'));
  return{same,success,failure,executions:window.__literalOptionalExecutions,cancelled:await pending,afterDispose:await owner.load('./literal-optional-runtime.js'),pendingRemoved:!node?.isConnected,listenersRemoved:node?.onload===null&&node?.onerror===null};
 });
 assert.deepEqual(result,{same:true,success:true,failure:false,executions:1,cancelled:false,afterDispose:false,pendingRemoved:true,listenersRemoved:true});assert.equal(requests,1,'duplicate startup resource requests execute exactly one browser script');
 await context.close();console.log('PASS optional scripts: one real execution/request, graceful refusal, terminal disposal and late event isolation');
}finally{await browser.close()}
