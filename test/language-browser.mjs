/** Test-owned handles to actual native composition, never a compatibility
 * global. Keep the exact release path AND query: queryless app imports boot a
 * second instance when the page loaded app.js?v=... . */
async function nativeHandle(page,kind){
  return page.evaluateHandle(async kind=>{
    const scripts=[...document.querySelectorAll('script[src]')];
    const matches=script=>new URL(script.src,document.baseURI).pathname.endsWith('/app.js');
    const entry=scripts.find(script=>script.type==='module'&&matches(script))||scripts.find(matches);
    if(!entry)throw new Error('Actual native app module URL unavailable');
    if(kind==='language'){
      const {language}=await import(entry.src);
      if(!language)throw new Error('Actual native language instance unavailable');
      return language;
    }
    return import(new URL('exercises.js',entry.src).href);
  },kind);
}
export function browserLanguage(page){return nativeHandle(page,'language')}
export function browserExerciseSource(page){return nativeHandle(page,'exercises')}
