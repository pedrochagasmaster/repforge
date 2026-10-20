/** Concrete editor host and optional drag runtime contracts. Storage/route state
 * stays behind the application's named host commands; these are view DTOs. */
/** @typedef {import('../../training/authoring.js').EditorRow & {id:string,day:string,name:string,sets:number,order:number,notes:string,alternates:string[]}} EditorRow */
/** @typedef {Omit<import('../../training/authoring.js').EditorDocument,'program'> & {program:EditorRow[]}} EditorDocument */
/** @typedef {import('../../training/authoring.js').ProgramSlot} ProgramSlot */
/** @typedef {import('../../training/authoring.js').ProgramSet} ProgramSet */
/** @typedef {import('../../training/authoring.js').MetricDefinition} MetricDefinition */
/** @typedef {import('../../training/authoring.js').TargetEdit} TargetEdit */
/** @typedef {{revision?:number,programId?:string|null,blockId?:string|null,fingerprint?:string,draftRevision?:number}} EditorToken */
/** @typedef {{kind:string,[key:string]:unknown}} EditorIntent */
/** @typedef {{ok?:boolean,staged?:boolean,setupDraft?:boolean,localOk?:boolean,conflict?:boolean,staleRevision?:boolean,document?:EditorDocument,token?:EditorToken,message?:string,[key:string]:unknown}} EditorReceipt */
/** @typedef {{document:EditorDocument,token?:EditorToken}} EditorRead */
/** @typedef {{id:string,name:string,sets?:number,min?:number,max?:number,primary?:string,secondary?:string,notes?:string,namePt?:string}} LibraryEntry */
/** @typedef {{entry:LibraryEntry,stagedCustomDefinition?:LibraryEntry|null}} PickHandoff */
/** @typedef {{mode:string,day?:string,exercise?:EditorRow,repair?:boolean,exclude:(string|undefined)[]}} PickRequest */
/** @typedef {{
 * read:()=>EditorRead,
 * commit:(request:{expectedToken?:EditorToken,nextDocument:EditorDocument,intent:EditorIntent})=>EditorReceipt|Promise<EditorReceipt>,
 * t?:(key:string,vars?:Record<string,string|number>)=>string,
 * formatNumber?:(value:unknown)=>string,
 * reducedMotion?:()=>boolean,
 * dayLabel?:(day:string,index:number,stored:import('../../training/model.js').StructureDay|null)=>string,
 * exerciseLabel?:(exercise:EditorRow)=>string,
 * exerciseDisplayLabel?:(exercise:EditorRow)=>string,
 * exerciseEntry?:(id:string)=>LibraryEntry|null,
 * movementLabel?:(id:string)=>string,
 * metricDefinitionsForExercise?:(id:string|undefined)=>MetricDefinition[],
 * metricOptions?:()=>readonly MetricDefinition[],
 * metricCompositions?:()=>readonly (readonly string[])[],
 * metricLabel?:(definition:MetricDefinition)=>string,
 * metricDisplayUnit?:(definition:MetricDefinition)=>string,
 * formatMetricValue?:(definition:MetricDefinition,value:import("../../training/authoring.js").Target|undefined|null)=>string,
 * parseMetricInput?:(definition:MetricDefinition,raw:string)=>{value?:number|null,field?:string,key?:string},
 * cycleIndex?:(document:EditorDocument)=>number,
 * context?:(document:EditorDocument)=>string,
 * chooseExercise?:(request:PickRequest)=>LibraryEntry|PickHandoff|null|Promise<LibraryEntry|PickHandoff|null>,
 * announce?:(message:string,options:{change?:boolean,undo?:()=>unknown})=>unknown,
 * afterModal?:(callback:()=>void)=>unknown,
 * dayCount?:(count:number)=>string,
 * defaultLoadStepKg?:()=>number,
 * suggestLoads?:import('../../training/authoring.js').SuggestionPolicy,
 * dayAddPlacement?:(document:EditorDocument,day:string)=>string,
 * status?:(document:EditorDocument)=>string,
 * afterRender?:(host:HTMLElement,document?:EditorDocument)=>unknown,
 * confirm?:(request:{kind:string,day?:string})=>boolean,
 * }} EditorAdapter */
/** @typedef {{selector?:string,id?:string,roles?:string[],day?:string}} PendingFocus */
/** @typedef {{selector:string,value:string,selectionStart:number|null,selectionEnd:number|null,committedDuringTeardown:boolean}} LiveEdit */
/** @typedef {{duration:number,easing:string}|null} Glide */
/** @typedef {{id?:string,group?:string,index?:number,sortable?:{group?:string,index?:number},type?:string,data?:{day?:string},element?:HTMLElement,handle?:HTMLElement}} DragItem */
/** @typedef {{source?:DragItem,target?:DragItem}} DragOperation */
/** @typedef {{operation?:DragOperation,canceled?:boolean}} EditorDragEvent */
/** @typedef {{destroy:()=>void,monitor:{addEventListener:(name:string,callback:(event:EditorDragEvent)=>void)=>void}}} DragManager */
/** @typedef {{id:string,index?:number,group?:string,type:string,accept:string[],element:HTMLElement,handle?:HTMLElement,data:{day:string},transition?:Glide,collisionPriority?:number}} SortableOptions */
/** @typedef {{
 * DragDropManager:new(options:{plugins:(defaults:unknown[])=>unknown[],sensors:(defaults:unknown[])=>unknown[]})=>DragManager,
 * Accessibility:{configure:(options:{announcements:unknown,screenReaderInstructions:{draggable:string}})=>unknown},
 * Feedback:{configure:(options:{dropAnimation:Glide,keyboardTransition:Glide})=>unknown},
 * PointerSensor:{configure:(options:{activationConstraints:(event:PointerEvent,source:DragItem)=>unknown})=>unknown},
 * PointerActivationConstraints:{Delay:new(options:{value:number,tolerance:number})=>unknown},
 * Droppable:new(options:SortableOptions,manager:DragManager)=>{destroy:()=>void},
 * Sortable:new(options:SortableOptions,manager:DragManager)=>{destroy:()=>void},
 * CollisionPriority:{Low:number},
 * }} DragRuntime */
/** @typedef {{manager:DragManager,sortables:{destroy:()=>void}[],expandTimer:ReturnType<typeof setTimeout>|null,overDay:string|null}} Sorting */
export {};
