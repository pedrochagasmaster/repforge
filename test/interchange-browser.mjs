/** Compose actual native public interfaces inside the current browser document.
 * Test-owned handles replace removed product module globals; no application
 * state, parser, normalizer or protocol is recreated here. Call after navigation. */
export async function ensureBrowserInterchange(page){
  await page.evaluate(async()=>{
    if(window.__repforgeInterchangeTest)return;
    const url=path=>new URL(path,document.baseURI).href;
    const [setup,transfer,wire,generation,metrics,identity,authoring,workout]=await Promise.all([
      import(url('src/interchange/setup-link.js')),import(url('src/platform/install-transfer.js')),
      import(url('src/interchange/transfer-contract.js')),import(url('src/training/generation.js')),
      import(url('src/training/metrics.js')),import(url('src/training/identity.js')),
      import(url('src/training/authoring.js')),import(url('src/training/workout.js')),
    ]);
    const response=await fetch(url('assets/exercise-catalog.json'));
    if(!response.ok)throw new Error('Native interchange fixture catalog unavailable');
    const catalog=await response.json();
    const capabilities={crypto:window.crypto,TextEncoder,TextDecoder,CompressionStream,DecompressionStream,Blob,
      document,location:window.location,navigator,matchMedia:window.matchMedia.bind(window),
      fetch:window.fetch.bind(window),indexedDB,atob,btoa,now:()=>new Date().toISOString()};
    window.__repforgeInterchangeTest={
      setup:setup.createSetupLinkCodec({metrics:metrics.default,identity:identity.default,capabilities}),
      transfer:transfer.createInstallTransfer(capabilities),
      contract:wire.createTransferContract({compiler:generation.compiler,metrics:metrics.default,
        entry:authoring.createEntryRules(catalog),workout:workout.createWorkoutRules(catalog),catalog,
        crypto:window.crypto,TextEncoder,TextDecoder}),
    };
  });
}
