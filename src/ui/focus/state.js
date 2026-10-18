/** @typedef {{exId:string,n:number,snap:Record<string,unknown>}} FocusEdit */
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
  const pending=Object.freeze({get:/** @param {string} key */ key=>held.get(key),has:/** @param {string} key */ key=>held.has(key),
    entries:()=>held.entries(),[Symbol.iterator]:()=>held[Symbol.iterator]()});
  return Object.freeze({
    pending,
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
    get index(){return index;},set index(value){index=value;},
    get edit(){return edit;},set edit(value){edit=value;},
    get logged(){return logged;},set logged(value){logged=value;},
    get ledgerOpen(){return ledgerOpen;},set ledgerOpen(value){ledgerOpen=value;},
    reset() {index=0;edit=null;logged=null;ledgerOpen=null;shelf={key:"",field:"reps",editing:false};held.clear();},
  });
}
