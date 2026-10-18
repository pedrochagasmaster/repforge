/** Concrete private-session Review host, DOM and transient presentation contracts. */
/** @typedef {import('../../training/authoring/internal/review-contracts.js').ProgramDefinition} ProgramDefinition */
/** @typedef {import('../../training/authoring/internal/review-contracts.js').ProgramDay} ProgramDay */
/** @typedef {import('../../training/authoring/internal/review-contracts.js').ProgramSlot} ProgramSlot */
/** @typedef {import('../../training/authoring/internal/review-contracts.js').ProgramSet} ProgramSet */
/** @typedef {import('../../training/authoring/internal/review-contracts.js').ReviewContext} ReviewContext */
/** @typedef {{kind:string,[key:string]:unknown}} ReviewEdit */
/** @typedef {{tab?:number|null,reorder?:number|null}} ReviewView */
/** @typedef {{slotId:string,offeredExerciseId:string,[key:string]:unknown}} VerifiedOffer */
/** @typedef {{baseline:ProgramDefinition,definition:ProgramDefinition,edits:ReviewEdit[],name:string,ctx:ReviewContext,sessionMinutes?:number|null,answers?:{block?:{cycles?:number,periodization?:string},deload?:boolean,movementConfirmations?:Record<string,unknown[]>},offers?:VerifiedOffer[]}} ReviewRead */
/** @typedef {{ok?:boolean,cancelled?:boolean,superseded?:boolean,message?:string}} ReviewReceipt */
/** @typedef {{el:HTMLElement,title:HTMLElement,body:HTMLElement,foot:HTMLElement}} SheetParts */
/** @typedef {{kind:'exercise',slotId:string,showAll:boolean}|{kind:'block',fixedCycles:boolean,cycles:number,periodization:string,deload:boolean}|{kind:'day'}|{kind:'rename',target:'day'|'program',inputValue?:string,error?:string|null}} ReviewSheet */
/** @typedef {{
 * view?:ReviewView,read:()=>ReviewRead,
 * commit:(next:{definition:ProgramDefinition,edits:ReviewEdit[],name:string|null})=>Promise<ReviewReceipt>,
 * esc:(value:unknown)=>string,t:(key:string,vars?:Record<string,unknown>)=>string,nums?:(value:string)=>string,
 * dayName:(day:ProgramDay,definition:ProgramDefinition)=>string,
 * exerciseName:(id:string)=>string,muscleName:(id:string)=>string,exerciseWord:(count:number)=>string,exerciseCount:(count:number)=>string,
 * tile:(id:string,size:string)=>string,
 * sheet:()=>SheetParts,openSheet:(options:{onClose:()=>void})=>unknown,closeSheet:()=>Promise<unknown>,
 * pickExercise:(request:{mode:string,day:ProgramDay,exercise:ProgramSlot|null,accept:(candidate:string)=>boolean})=>Promise<string|null>,
 * confirm:(request:{title:string,body:string,go:string,keep:string})=>Promise<boolean>,
 * announce:(message:string)=>unknown,reducedMotion:()=>boolean,swallowClick?:()=>unknown,
 * changed?:()=>unknown,observe?:(report:{action:string,kind?:string})=>unknown,
 * confirmOffer?:(offer:VerifiedOffer)=>Promise<ReviewReceipt>,undoConfirmation?:(id:string)=>Promise<ReviewReceipt>,
 * changeBlock?:(patch:{block:{cycles:number,periodization:string},deload:boolean})=>Promise<ReviewReceipt>,
 * }} ReviewAdapter */
/** @typedef {{id:number,row:HTMLElement,rows:HTMLElement[],from:number,to:number,y0:number,h:number}} ReviewDrag */
/** @typedef {{x:number,y:number,id:number}} ReviewSwipe */
export {};
