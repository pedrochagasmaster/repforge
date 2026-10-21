import type {Settings,SettingsSaveResult} from '../../app/settings.js';
export type Browser=Window & typeof globalThis;
export type Translate=(key:string,values?:Record<string,unknown>)=>string;
export type UiPrefs=Record<string,unknown>;
export interface GuideDefinition {id:string;version:number;anchorSelector:string;wired:boolean}
export interface GuideRegistry {
  GUIDE_DEFINITIONS:readonly GuideDefinition[];PLAN_054_GUIDE_IDS:readonly string[];
  migrateLegacyTourDone(value:UiPrefs):UiPrefs;
  recordGuideTransition(value:UiPrefs,id:string,status:string,options:{version:number,nowMs:number}):UiPrefs;
  replayGuideState(value:UiPrefs,id:string,options:{version:number,nowMs:number}):UiPrefs;
  evaluateGuide(guide:GuideDefinition,context:{anchorPresent:boolean,anchorVisible:boolean,uiPrefs:UiPrefs}):{eligible:boolean,decision:string};
}
export interface GuideOptions {
  window:Browser;registry:GuideRegistry;preferences:{read:()=>UiPrefs,reload:()=>UiPrefs,replace:(value:UiPrefs)=>boolean};
  t:Translate;landingOpen:()=>boolean;
  shell:{openModal:(element:HTMLElement,options:import('../shell-contracts.js').ModalOptions)=>unknown,closeModal:(element:HTMLElement|null)=>Promise<unknown>,activeModal:import('../shell-contracts.js').ModalRecord|null};
  focusKey:(element:Element|null)=>{sel:string}|null;
  report:(event:string,properties:{guideId:string})=>void;
}
export type GuidesView=ReturnType<typeof import('./guides.js').createGuidesView>;
export type SettingsCommands=ReturnType<typeof import('../../app/settings.js').createSettingsCommands>;
export interface NotificationOptions {window:Browser;settings:SettingsCommands;capability:{permission:()=>string,request:()=>Promise<string>};t:Translate}
export type Notifications=ReturnType<typeof import('./notifications.js').createNotificationControls>;
export type Appearance=ReturnType<typeof import('./appearance.js').createAppearance>;
export interface SettingsViewOptions {
  window:Browser;settings:SettingsCommands;
  i18n:{t:Translate,getLang:()=>string,normalizeLang:(value:unknown)=>string|undefined};
  appearance:Appearance;notifications:Notifications;
  install:{decision:(source:string)=>{eligible:boolean},mode:()=>string};guides:Pick<GuidesView,'renderReplayList'>;
  telemetry:{isEnabled?:()=>boolean};storage:{health:()=>{degraded:boolean},raw:()=>string|null};
  shell:{setDisclosure:(button:HTMLElement,panel:HTMLElement,on:boolean)=>void};toast:(message:string)=>void;
  onSaved:(change:{before:Settings,after:Settings,current:boolean})=>void;
}
export interface TransferMarker extends Record<string,unknown> {phase?:string;sealedCredentials?:unknown;outcomeCode?:string;recoverySnapshot?:{mutatedAfterCreation?:boolean}}
export interface InstallModel {hasMeaningfulData:boolean;transferMeaningful:boolean;savedWorkoutsCount:number;transferAvailable:boolean;firstRunActive:boolean;onboardingEdit:boolean;onboardingOpen:boolean}
export interface PromptEvent {preventDefault:()=>void;prompt:()=>unknown;userChoice:Promise<{outcome?:string}>}
export type InstallDecision=ReturnType<typeof import('../../platform/install.js').evaluateInstallPolicy>;
export interface Modal {el:HTMLElement;returnFocus?:Element|null;onEscape?:()=>unknown}
export interface ModalOptions {scrim?:HTMLElement|null;initialFocus?:HTMLElement|null;onEscape?:(()=>unknown);handoff?:boolean;returnFocus?:Element|null;delayHide?:number}
export interface InstallOptions {
  policy:typeof import('../../platform/install.js');
  window:Browser;t:Translate;language:()=>string;read:()=>InstallModel;
  preferences:{read:()=>UiPrefs,replace:(value:UiPrefs)=>boolean};
  transfer:{marker:()=>TransferMarker|null,create:()=>unknown,confirmDivergence:()=>unknown,abandonUnsealed:()=>unknown};
  shell:{openModal:(element:HTMLElement,options:ModalOptions)=>unknown,closeModal:(element:HTMLElement|null)=>Promise<unknown>,canTakeFocus:(element:Element)=>boolean,reducedMotion:()=>boolean,activeModal:Modal|null};
  guides:{maybeShow:(ids:string[])=>unknown};report:(event:string,properties:Record<string,string>)=>void;
  toast:(message:string)=>void;onChanged:()=>void;onLandingOffer:(visible:boolean)=>void;
}
