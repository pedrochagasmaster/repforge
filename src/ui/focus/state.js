/** @typedef {{exId:string,n:number,snap:import('../../app/workout.js').EditSnapshot}} FocusEdit */
/** @typedef {{exId:string,n:number}} LoggedSet */
/** Transient Focus lifetime. DraftV2 remains the sole acknowledged workout. */
export function createFocusState() {
  let index=0;
  /** @type {FocusEdit|null} */ let edit=null;
  /** @type {LoggedSet|null} */ let logged=null;
  /** @type {string|null} */ let ledgerOpen=null;
  let shelf={key:"",field:"reps",editing:false},sequence=0;
  /** @type {Map<string,Readonly<{value:string,token:number}>>} */
  const held=new Map();
  /** @type {WeakMap<object,number>} */ let padTaps=new WeakMap();
  let valueBeat="directional",restRenderPending=false;
  const padTap=Object.freeze({get:/** @param {object} element */ element=>padTaps.get(element),
    set:/** @param {object} element @param {number} direction */ (element,direction)=>{padTaps.set(element,direction);},
    delete:/** @param {object} element */ element=>padTaps.delete(element)});
  const pending=Object.freeze({get:/** @param {string} key */ key=>held.get(key),has:/** @param {string} key */ key=>held.has(key),
    entries:()=>held.entries(),[Symbol.iterator]:()=>held[Symbol.iterator]()});
  return Object.freeze({
    pending,padTap,
    get restRenderPending(){return restRenderPending;},set restRenderPending(value){restRenderPending=value;},
    get valueBeat(){return valueBeat;},set valueBeat(value){valueBeat=value;},
    /** @param {string} key @param {unknown} value */
    holdPendingField(key,value) {
      const token=++sequence;
      held.set(key,Object.freeze({value:String(value??""),token}));
      return token;
    },
    /** @param {string} key @param {number} token */
    releasePendingField(key,token) {if(held.get(key)?.token===token)held.delete(key);},
    /** @param {string} key @param {string} [firstField] */
    shelfFor(key,firstField="reps") {return shelf.key===key?shelf:{key,field:firstField,editing:false};},
    /** @param {string} key @param {string} field @param {boolean} [editing] */
    shelfSelect(key,field,editing=false) {shelf=Object.freeze({key,field,editing});},
    /** The ledger and shelf select the same set from acknowledged membership
     * plus transient correction/disclosure state. Never changes a draft.
     * @param {{id:string,sets:number}} exercise
     * @param {ReadonlySet<string>} committed
     * @param {{peek?:boolean}} [options]
     */
    selectExercise(exercise,committed,{peek=false}={}) {
      const editing=edit?.exId===exercise.id?edit.n:0;
      let active=0,loggedCount=0;
      const done=[];
      for(let n=1;n<=exercise.sets;n++){
        const loggedSet=committed.has(`${exercise.id}_${n}`);
        if(loggedSet)done.push(n);
        if(loggedSet||n===editing)loggedCount++;
        if(!loggedSet&&!active)active=n;
      }
      if(editing>=1&&editing<=exercise.sets)active=editing;
      if(edit?.exId===exercise.id&&!done.includes(edit.n)){done.push(edit.n);done.sort((a,b)=>a-b)}
      let after=0;
      for(let n=active+1;n<=exercise.sets&&!after;n++)if(!committed.has(`${exercise.id}_${n}`))after=n;
      const fresh=!peek&&!!logged&&logged.exId===exercise.id;
      const expanded=active===0||!peek&&(ledgerOpen===exercise.id||edit?.exId===exercise.id);
      const visible=[];for(let n=1;n<=exercise.sets;n++)if(expanded||n===active||n===after)visible.push(n);
      return Object.freeze({active,after,editing,done:Object.freeze(done),loggedCount,
        expanded,visible:Object.freeze(visible),
        fresh,freshOrdinal:fresh?(logged?.n??0):0});
    },
    /** @param {string} exId @param {number} n @param {import('../../app/workout.js').EditSnapshot} snap */
    beginEdit(exId,n,snap){edit={exId,n,snap};},
    finishEdit(){edit=null;ledgerOpen=null;},
    get index(){return index;},set index(value){index=value;},
    get edit(){return edit;},set edit(value){edit=value;},
    get logged(){return logged;},set logged(value){logged=value;},
    get ledgerOpen(){return ledgerOpen;},set ledgerOpen(value){ledgerOpen=value;},
    reset() {restRenderPending=false;index=0;edit=null;logged=null;ledgerOpen=null;shelf={key:"",field:"reps",editing:false};held.clear();padTaps=new WeakMap();},
  });
}
