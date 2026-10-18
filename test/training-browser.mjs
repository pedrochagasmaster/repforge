/** Test-owned composition of the real public training/catalog interfaces. */
export async function installBrowserTraining(page) {
  await page.evaluate(async()=>{
    const entry=[...document.querySelectorAll('script[src]')].map(script=>script.src)
      .find(src=>new URL(src).pathname.includes('/src/'));
    const marker=entry?.lastIndexOf('/src/');
    const graphBase=entry&&marker!==undefined&&marker>=0?entry.slice(0,marker+1):document.baseURI;
    const url=path=>new URL(path,graphBase).href;
    const [generation,catalogModule,workoutModule,entryModule]=await Promise.all([
      import(url('src/training/generation.js')),import(url('src/platform/catalog.js')),
      import(url('src/training/workout.js')),import(url('src/training/authoring.js'))]);
    const rules=generation.createGenerationRules();
    const catalog=catalogModule.createCatalog({identity:rules.identity,
      librarySource:window.RepForgeExercises,fetcher:window.fetch.bind(window)});
    await catalog.load();
    const rawCatalog=catalog.snapshot();
    window.__repforgeTrainingTest={...rules,catalog:rawCatalog,
      workout:workoutModule.createWorkoutRules(rawCatalog),entry:entryModule.createEntryRules(rawCatalog),entryAdapter:entryModule.createEntryAdapter({compiler:rules.compiler})};
  });
}
