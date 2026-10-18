/** JSON-shaped training values; no storage envelopes or runtime hosts. */
const PROGRESSION_VALUE_LIMITS=Object.freeze({depth:32,nodes:1000,keys:128,arrayItems:128,stringLength:4000});
function cloneSnapshot(s){return s==null?s:JSON.parse(JSON.stringify(s))}
function isPlainStateObject(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const proto=Object.getPrototypeOf(value);
  return proto===Object.prototype||proto===null}
function isBoundedProgressionValue(value,depth=0,state={nodes:0}){
  if(++state.nodes>PROGRESSION_VALUE_LIMITS.nodes||depth>PROGRESSION_VALUE_LIMITS.depth)return false;
  if(typeof value==="string")return value.length<=PROGRESSION_VALUE_LIMITS.stringLength;
  if(value===null||typeof value==="boolean")return true;
  if(typeof value==="number")return Number.isFinite(value);
  if(Array.isArray(value))return value.length<=PROGRESSION_VALUE_LIMITS.arrayItems&&value.every(item=>isBoundedProgressionValue(item,depth+1,state));
  if(!isPlainStateObject(value)||Object.keys(value).length>PROGRESSION_VALUE_LIMITS.keys)return false;
  return Object.keys(value).every(key=>isBoundedProgressionValue(value[key],depth+1,state));
}
function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==="object"){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=canonicalize(value[key]);
    return out}
  return value}
export { cloneSnapshot, isPlainStateObject, isBoundedProgressionValue, canonicalize, PROGRESSION_VALUE_LIMITS };
