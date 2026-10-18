import { createTodayView } from "./view.js";

/** Owns only Today's event bindings. Actions are application commands; rendering
 * a model never invokes one. Existing Start/Review dock controls keep their
 * boot-owned listeners; this controller owns the dynamic dashboard controls.
 */
export function createTodayController({ document, copy, format, motion,
  onCreateProgram, onOpenExercise, onStartDay, onReviewProgram }) {
  const view=createTodayView({document,copy,format,motion});
  let bindings=[];
  function clearBindings(){
    for(const {element,handler} of bindings)if(element.onclick===handler)element.onclick=null;
    bindings=[];
  }
  function bind(element,handler){
    if(!element)return;
    element.onclick=handler;bindings.push({element,handler});
  }
  function render(model){
    clearBindings();view.render(model);
    if(!model.hasProgram){bind(document.querySelector("#todaySetupProgram"),()=>onCreateProgram());return}
    document.querySelectorAll("#todayExList [data-exopen]").forEach(button=>bind(button,()=>onOpenExercise(button.dataset.exopen)));
    if(model.next)bind(document.querySelector("#upNextBtn"),()=>onStartDay(model.next.day));
    const program=document.querySelector("#todayProgram");
    if(program&&!program.classList.contains("hidden")){program.style.cursor="pointer";bind(program,()=>onReviewProgram())}
  }
  return Object.freeze({render,dispose:clearBindings});
}
