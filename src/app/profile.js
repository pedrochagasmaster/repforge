/** The per-field profile reader deliberately preserves invalid/future stored
 * bytes elsewhere: only answers understood by this release affect display or
 * bodyweight fallback. It never repairs or writes the user's profile.
 * @typedef {{sex?:string,birthDate?:string,heightCm?:number,heightUnit?:string,weightKg?:number,cardioExperience?:string}} Profile
 * @param {unknown} profile
 * @param {{normalizeProfile:(value:unknown)=>{ok:boolean,value?:Profile}}} policy
 * @returns {Profile} */
export function interpretProfile(profile,policy){
  if(!profile||typeof profile!=='object'||Array.isArray(profile))return {};
  const input=/** @type {Record<string,unknown>} */(profile),interpreted={};
  for(const key of ['sex','birthDate','heightCm','heightUnit','weightKg','cardioExperience']){
    if(!Object.prototype.hasOwnProperty.call(input,key))continue;
    const result=policy.normalizeProfile({[key]:input[key]});
    if(result.ok&&result.value&&Object.prototype.hasOwnProperty.call(result.value,key))
      Object.assign(interpreted,{[key]:/** @type {Record<string,unknown>} */(result.value)[key]});
  }
  return interpreted;
}
