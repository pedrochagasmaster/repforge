/** Optional pinned vendor/config resources, with one request per document URL.
 * Construction does no IO. Disposing settles pending requests and removes their
 * listeners/elements; settled scripts remain visible for runtime diagnostics.
 * @param {{document:Document}} options */
export function createOptionalScriptLoader({document}){
  /** @type {Map<string,Promise<boolean>>} */ const requests=new Map();
  /** @type {Set<()=>void>} */ const pending=new Set();let disposed=false;
  /** @param {string|URL} url @returns {Promise<boolean>} */
  function load(url){
    if(disposed)return Promise.resolve(false);
    const href=new URL(String(url),document.baseURI).href,cached=requests.get(href);if(cached)return cached;
    const promise=new Promise(/** @param {(ok:boolean)=>void} resolve */resolve=>{
      const script=document.createElement('script');script.src=href;script.async=false;
      let settled=false;
      /** @param {boolean} ok */
      function settle(ok){if(settled)return;settled=true;pending.delete(cancel);script.onload=null;script.onerror=null;if(!ok)script.remove();resolve(ok)}
      function cancel(){settle(false)}
      pending.add(cancel);script.onload=()=>settle(true);script.onerror=()=>settle(false);try{document.head.append(script)}catch{settle(false)}
    });requests.set(href,promise);return promise;
  }
  function dispose(){disposed=true;for(const cancel of [...pending])cancel();pending.clear()}
  return Object.freeze({load,dispose});
}
