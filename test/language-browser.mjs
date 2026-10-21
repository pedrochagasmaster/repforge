/** Test-owned handles to actual native composition, never a compatibility
 * global. Keep the exact release path AND query: queryless app imports boot a
 * second instance when the page loaded app.js?v=... . */
async function nativeHandle(page,kind){
  return page.evaluateHandle(async kind=>{
    const scripts=[...document.querySelectorAll('script[src]')];
    const matches=script=>new URL(script.src,document.baseURI).pathname.endsWith('/app.js');
    const entry=scripts.find(script=>script.type==='module'&&matches(script))||scripts.find(matches);
    if(!entry)throw new Error('Actual native app module URL unavailable');
    if(kind==='language'||kind==='motion'){
      const owner=(await import(entry.src))[kind];
      if(!owner)throw new Error('Actual native '+kind+' instance unavailable');
      return owner;
    }
    return import(new URL('exercises.js',entry.src).href);
  },kind);
}
export function browserLanguage(page){return nativeHandle(page,'language')}
export function browserExerciseSource(page){return nativeHandle(page,'exercises')}

export function browserMotion(page){return nativeHandle(page,'motion')}
/** For page.evaluate bodies that read copy synchronously: the actual native
 * language instance under a test-owned name (call again after navigation). */
export async function installTestLanguage(page){
  const language=await browserLanguage(page);
  await page.evaluate(owner=>{window.__testLanguage=owner},language);
}
