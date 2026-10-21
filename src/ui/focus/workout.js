import {createFocusInputs} from './inputs.js';
import {createRestSlot} from './rest-slot.js';
import {createFocusDom} from './dom.js';
import {createFocusBindings} from './bindings.js';
/** Concrete Focus composition closes replacement events inside the feature.
 * Other page widgets receive only onRendered. Clock, Motion and application
 * commands retain their existing lifetimes; leaving Focus does not stop rest.
 * This view's dispose ends its lifetime; a new view creates fresh bindings.
 * @param {{window:Window & typeof globalThis,focus:Parameters<typeof createFocusDom>[0]['focus'],clock:Parameters<typeof createFocusBindings>[0]['clock'],presentation:Parameters<typeof createFocusDom>[0]['presentation'],controls:Parameters<typeof createFocusDom>[0]['controls'],geometry:Parameters<typeof createFocusDom>[0]['geometry'],effects:Parameters<typeof createFocusDom>[0]['effects'],motion:Parameters<typeof createFocusDom>[0]['motion'],navigation:Parameters<typeof createFocusBindings>[0]['navigation'],commands:Parameters<typeof createFocusBindings>[0]['commands'],input:Pick<Parameters<typeof createFocusInputs>[0],'read'|'commands'|'captureSet'|'onAcknowledged'>,readFrame:Parameters<typeof createFocusDom>[0]['readFrame'],copy:Parameters<typeof createFocusDom>[0]['copy'],exercise:Parameters<typeof createFocusDom>[0]['exercise'],help:Parameters<typeof createFocusBindings>[0]['help'],feedback:Parameters<typeof createFocusBindings>[0]['feedback'],exerciseActions:Parameters<typeof createFocusBindings>[0]['exerciseActions'],restActions:Parameters<typeof createRestSlot>[0]['actions'],onRendered:Parameters<typeof createFocusDom>[0]['onRendered'],onSetApplied:Parameters<typeof createFocusBindings>[0]['onSetApplied']}} options */
export function createFocusView({window,focus,clock,presentation,controls,geometry,effects,motion,navigation,commands,input,readFrame,copy,exercise,help,feedback,exerciseActions,restActions,onRendered,onSetApplied}){
  const inputs=createFocusInputs({window,focus,...input,values:presentation.values,shelf:presentation.shelf,effort:presentation.effort,controls});
  const onControlsReplaced=()=>bindings.bind();
  const rest=createRestSlot({window,focus,presentation,motion,effects,geometry,
    readFrame:()=>{const frame=readFrame();return frame.active?frame.context:null;},actions:restActions,onPadsReplaced:onControlsReplaced});
  const dom=createFocusDom({window,focus,presentation,controls,geometry,effects,rest,motion,readFrame,copy,exercise,onControlsReplaced,onRendered});
  const bindings=createFocusBindings({window,focus,clock,presentation,inputs,controls,geometry,dom,rest,motion,navigation,commands,readFrame,copy,help,feedback,exerciseActions,onSetApplied});
  function dispose(){bindings.dispose();dom.dispose();rest.dispose();effects.dispose();geometry.dispose();presentation.dispose();}
  return Object.freeze({mount:bindings.mount,render:dom.render,bind:bindings.bind,refreshShelf:dom.refreshShelf,restSync:rest.sync,dispose});
}
