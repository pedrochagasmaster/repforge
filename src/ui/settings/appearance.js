/** Device appearance is intentionally independent of training state and backup.
 * @typedef {'light'|'dark'|'system'} Theme
 * @param {{window:Window & typeof globalThis,preferences:{read:()=>Record<string,unknown>,set:(key:string,value:unknown)=>boolean},onPaint:()=>void,onChanged:()=>void,report:(event:string,properties:{setting:string})=>void}} options */
export function createAppearance({window,preferences,onPaint,onChanged,report}){
  const document=window.document;
  /** @param {unknown} value @returns {Theme} */
  const normalize=value=>value==='system'||value==='dark'?value:'light';
  const current=()=>normalize(preferences.read().theme);
  const query=()=>window.matchMedia?.('(prefers-color-scheme: dark)')||null;
  const resolved=()=>{const pick=current();return pick==='system'?(query()?.matches?'dark':'light'):pick};
  function apply(){const value=resolved();document.documentElement.dataset.theme=value;onPaint();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',value==='dark'?'#141310':'#F4F2EF');return value}
  function repaint(){apply();onChanged()}
  /** @param {unknown} value */
  function set(value){const next=normalize(value),changed=next!==current();preferences.set('theme',next);repaint();
    if(changed)report('settings_changed',{setting:'theme'})}
  function watch(){const q=query();if(!q?.addEventListener)return;q.addEventListener('change',()=>{if(current()==='system')repaint()})}
  return Object.freeze({current,resolved,apply,set,watch});
}
