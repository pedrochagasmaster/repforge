/** Test-owned composition of the real public training/catalog interfaces. */
async function composeBrowserTraining(){
  if(window.__repforgeTrainingTestReady)return window.__repforgeTrainingTestReady;
  window.__repforgeTrainingTestReady=(async()=>{
    if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
    const entry=[...document.querySelectorAll('script[src]')].map(script=>script.src)
      .find(src=>new URL(src).pathname.includes('/src/'));
    const marker=entry?.lastIndexOf('/src/');
    const graphBase=entry&&marker!==undefined&&marker>=0?entry.slice(0,marker+1):document.baseURI;
    const url=path=>new URL(path,graphBase).href;
    const [generation,catalogModule,workoutModule,entryModule,metrics,librarySource]=await Promise.all([
      import(url('src/training/generation.js')),import(url('src/platform/catalog.js')),
      import(url('src/training/workout.js')),import(url('src/training/authoring.js')),import(url('src/training/metrics.js')),import(url('exercises.js'))]);
    const rules=generation.createGenerationRules();
    const catalog=catalogModule.createCatalog({identity:rules.identity,
      librarySource,fetcher:window.fetch.bind(window)});
    await catalog.load();
    const rawCatalog=catalog.snapshot();
    window.__repforgeTrainingTest={...rules,catalog:rawCatalog,metrics,graphBase,librarySource,
      workout:workoutModule.createWorkoutRules(rawCatalog),entry:entryModule.createEntryRules(rawCatalog),entryAdapter:entryModule.createEntryAdapter({compiler:rules.compiler})};
    return;
  })();
  return window.__repforgeTrainingTestReady;
}
export async function installBrowserTraining(page){await page.evaluate(composeBrowserTraining)}
/** Worker probes may observe a real request before application boot settles.
 * Install this exact same public composition before navigation, rather than
 * restoring operational production globals or copying compiler policy. */
export async function installBrowserTrainingBeforeNavigation(page){await page.addInitScript(composeBrowserTraining)}
/** The validator fixture composes the actual native policy and its producers;
 * it does not duplicate bounds/schema logic or restore a production test hook. */
export async function installBrowserSnapshotPolicy(page){
 await installBrowserTraining(page);
 await page.evaluate(async()=>{
  const training=window.__repforgeTrainingTest,url=path=>new URL(path,training.graphBase).href;
  const [snapshot,modelModule,progress,i18nModule,languageData]=await Promise.all([import(url('src/persistence/snapshot.js')),import(url('src/training/model.js')),import(url('src/training/progress.js')),import(url('src/platform/i18n.js')),import(url('i18n.js'))]);
  const now=()=>new Date().toISOString(),nextId=()=>crypto.randomUUID();
  const language=i18nModule.createI18n({strings:languageData.STRINGS,document,navigator});
  const model=modelModule.createProgramModel({catalog:training.catalog,librarySource:training.librarySource,nextId,now,
   calendarDate:()=>now().slice(0,10),language:()=>document.documentElement.lang||'en',defaultExerciseName:()=> 'Exercise'});
  training.snapshotPolicy=snapshot.createSnapshotPolicy({entry:training.entry,workout:training.workout,compiler:training.compiler,
   catalog:training.catalog,model,transition:training.transition,metrics:training.metrics.default,progression:progress.progression,
   now,nextId,language,digest:async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')});
 });
}
