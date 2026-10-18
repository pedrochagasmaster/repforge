/** Concrete presentation contracts. These are UI records, not storage state. */
export type Browser=Window & typeof globalThis;
export type Direction='in'|'out';
export type FocusTarget=Element|string|(()=>Element|null|undefined)|null|undefined;
export interface InertState {el:HTMLElement;inert:boolean}
export interface ModalOptions {
  extras?:(HTMLElement|null)[];scrim?:HTMLElement|null;returnFocus?:FocusTarget;
  onEscape?:(()=>unknown)|null;delayHide?:number;prevInert?:InertState[];
  initialFocus?:HTMLElement|(()=>HTMLElement|null|undefined)|null;handoff?:boolean;
}
export interface ModalRecord {
  el:HTMLElement;scrim:HTMLElement|null;returnFocus:FocusTarget;onEscape?:ModalOptions['onEscape'];
  delayHide:number;prevInert:InertState[];closing:boolean;done?:boolean;
  onKey?:(event:KeyboardEvent)=>void;onPointer?:(event:PointerEvent)=>void;finish?:()=>void;
  motion?:unknown;
}
export interface PushPages {pushed:HTMLElement|null;under?:HTMLElement|null;ghost?:HTMLElement|null;offset?:number}
export interface PushState {mover:HTMLElement;under:HTMLElement|null;ghost:HTMLElement|null}
export interface ShellMotion {
  available?:()=>boolean;reducedMotion?:()=>boolean;
  animatePush?:(element:HTMLElement,options:{direction:Direction})=>Promise<boolean>;
  animateDisclosure?:(panel:HTMLElement,on:boolean,show:()=>void)=>unknown;
  registerEdgeSwipeBack?:(target:{page:HTMLElement,onCommit:()=>void})=>{dispose:()=>void}|null;
}
export interface ShellOptions {
  window:Browser;motion?:ShellMotion|null;isBooted?:()=>boolean;isFocusActive?:()=>boolean;
  releaseSheetDrag?:(record:ModalRecord)=>void;releaseSwallowedClick?:()=>void;
}
