/** @typedef {ReturnType<typeof import('../../app/program-sharing.js').createProgramSharing>} Sharing
 * @typedef {ReturnType<typeof import('../../platform/files.js').createFiles>} Files
 * @typedef {{initialFocus:HTMLElement|null,returnFocus:Element|null,onEscape:()=>unknown,scrim:HTMLElement|null,delayHide:number}} ModalOptions
 * @typedef {{openModal:(sheet:HTMLElement,options:ModalOptions)=>unknown,closeModal:(sheet:HTMLElement)=>Promise<unknown>,activeModal:()=>{el:HTMLElement}|null}} Shell
 * @typedef {(key:string,values?:Record<string,unknown>)=>string} Text
 */
/** Owns only outbound sheet state and browser presentation lifetimes. The
 * application captures payloads; format validation and encoding stay outside UI.
 * @param {{window:Window & typeof globalThis,commands:Sharing,files:Files,shell:Shell,reducedMotion:()=>boolean,t:Text,programName:()=>string,toast:(message:string)=>void,report:(name:string,properties:Record<string,string>)=>void}} options */
export function createProgramSharingView({window,commands,files,shell,reducedMotion,t,programName,toast,report}) {
  const document=window.document;
  const $=(/** @type {string} */ selector)=>/** @type {HTMLElement|null} */(document.querySelector(selector));
  /** @type {AbortController|null} */ let listeners=null;
  let generation=0,link='',frame=0;
  /** @type {import('../../app/program-sharing.js').ShareOutcome|null} */ let outcome=null;
  /** @type {{text:string,name:string}|null} */ let shownText=null;
  /** @param {string} action @param {import('../../app/program-sharing.js').ShareOutcome|null} [facts] */
  function capture(action,facts=outcome){if(facts)report('share_setup_outcome',{action,...facts})}
  /** @param {string} message @param {{ready?:boolean,fileFallback?:boolean}} [options] */
  function setLinkState(message,{ready=false,fileFallback=false}={}){
    const status=$('#shareSetupStatus'),output=$('#shareSetupLink'),share=$('#shareSetupShare'),copy=$('#shareSetupCopy'),file=$('#shareSetupFile');
    if(file){file.toggleAttribute('disabled',!fileFallback);file.classList.toggle('hidden',!fileFallback)}
    $('#shareSetupBody')?.classList.toggle('hidden',fileFallback);
    if(status){status.textContent=message;status.classList.toggle('hidden',!message)}
    if(output){if(output instanceof window.HTMLInputElement||output instanceof window.HTMLTextAreaElement)output.value=ready?link:'';else output.textContent=ready?link:''}
    if(share){const unavailable=!ready||typeof window.navigator.share!=='function';share.toggleAttribute('disabled',unavailable);share.classList.toggle('hidden',unavailable)}
    if(copy){copy.toggleAttribute('disabled',!ready);copy.classList.toggle('hidden',!ready)}
  }
  /** @param {string} code */
  function errorText(code){return t(code==='compression-unavailable'?'program.share_setup_unsupported':code==='encoded-too-large'?'program.share_setup_too_large':'program.share_setup_invalid')}
  /** @param {HTMLElement} sheet @param {HTMLElement|null} scrim @param {HTMLElement|null} initialFocus @param {()=>unknown} close */
  function open(sheet,scrim,initialFocus,close){
    document.body.classList.add('is-sheet-open');
    shell.openModal(sheet,{initialFocus,returnFocus:document.activeElement,onEscape:close,scrim,delayHide:reducedMotion()?0:280});
    const token=generation;
    window.cancelAnimationFrame(frame);
    frame=window.requestAnimationFrame(()=>{frame=0;if(token!==generation)return;sheet.classList.add('is-open');scrim?.classList.add('is-open')});
  }
  /** @param {string} selector */
  function close(selector){
    ++generation;window.cancelAnimationFrame(frame);frame=0;
    const sheet=$(selector);if(!sheet||sheet.hidden&&shell.activeModal()?.el!==sheet)return Promise.resolve(false);
    return shell.closeModal(sheet);
  }
  function closeText(){return close('#programTextSheet')}
  function closeSetup(){link='';outcome=null;return close('#shareSetupSheet')}
  function openText(){
    const sheet=$('#programTextSheet'),output=$('#programTextOut');if(!sheet||!output)return;
    ++generation;shownText=commands.text();output.textContent=shownText.text;output.scrollTop=0;
    const subtitle=$('#programTextFor');if(subtitle)subtitle.textContent=programName()||t('untitled_program');
    open(sheet,$('#programTextScrim'),$('#programTextCopy'),closeText);
  }
  async function openSetup(){
    const sheet=$('#shareSetupSheet');if(!sheet)return;
    const token=++generation;link='';outcome=null;
    const subtitle=$('#shareSetupFor');if(subtitle)subtitle.textContent=programName()||t('untitled_program');
    setLinkState(t('program.share_setup_building'));
    open(sheet,$('#shareSetupScrim'),$('#shareSetupClose'),closeSetup);
    const result=await commands.link();
    if(token!==generation||shell.activeModal()?.el!==sheet)return;
    outcome=result.outcome||null;
    if(result.status==='error'){
      if(result.fileFallback)capture('link_refused');
      setLinkState(errorText(result.code),{fileFallback:result.fileFallback});return;
    }
    link=result.url;capture('link_ready');setLinkState('',{ready:true});
  }
  function exportProgram(){const file=commands.file();if(!file){toast(t('toast.program_import_invalid'));return false}files.download(file.text,file.name,'application/json');return true}
  async function shareFile(){
    const file=commands.file();if(!file){toast(t('toast.program_import_invalid'));return false}
    const token=generation,facts=outcome;
    await files.shareOrDownload(file.text,file.name,'application/json',t('program.share_setup_title'));
    if(token===generation)capture('file_shared',facts);return true;
  }
  async function copyLink(){
    if(!link)return false;
    const token=generation,value=link,facts=outcome,ok=await files.copyText(value);
    if(ok&&token===generation&&link===value){toast(t('toast.setup_link_copied'));capture('copied',facts)}return ok;
  }
  async function shareLink(){
    if(!link||typeof window.navigator.share!=='function')return false;
    const token=generation,value=link,facts=outcome;
    try{await window.navigator.share({title:t('program.share_setup_title'),url:value});if(token===generation&&link===value)capture('shared',facts);return true}catch{return false}
  }
  async function copyText(){
    const value=$('#programTextOut')?.textContent||commands.text().text,token=generation;
    const ok=await files.copyText(value);
    if(token===generation)toast(t(ok?'toast.program_text_copied':'toast.program_text_copy_failed'));return ok;
  }
  function shareText(){const file=shownText||commands.text();return files.shareOrDownload($('#programTextOut')?.textContent||file.text,file.name,'text/plain')}
  function mount(){
    if(listeners)return;
    listeners=new window.AbortController();
    /** @param {string} selector @param {()=>unknown} handler */
    const bind=(selector,handler)=>$(selector)?.addEventListener('click',handler,{signal:listeners?.signal});
    bind('#programTextClose',closeText);bind('#programTextScrim',closeText);bind('#programTextCopy',copyText);bind('#programTextShare',shareText);
    bind('#shareSetupClose',closeSetup);bind('#shareSetupScrim',closeSetup);bind('#shareSetupCopy',copyLink);bind('#shareSetupShare',shareLink);bind('#shareSetupFile',shareFile);bind('#exportProgram',exportProgram);
  }
  function dispose(){++generation;listeners?.abort();listeners=null;window.cancelAnimationFrame(frame);frame=0;shownText=null;link='';outcome=null}
  return Object.freeze({mount,dispose,openText,closeText,openSetup,closeSetup,exportProgram});
}
