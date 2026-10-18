import {cloneSnapshot} from './json.js';
import {fileSlug} from './program-file.js';
export const PROGRAM_TEXT_DATA_MARKER='TAURIFER-DATA';
/** @typedef {ReturnType<typeof import('../training/model.js').createProgramModel>} Model
 * @typedef {import('../training/model.js').ProgramMeta & {name?:string,progressionRelations?:unknown,progressionModifiers?:unknown,progressionIncompatibilities?:unknown[]}} Meta
 * @typedef {import('../training/model.js').ExerciseRow & {progression?:unknown,progressionIncompatibility?:unknown}} Row
 */
/** The structured appendix retains authored progression envelopes; the readable
 * body keeps the released localized grammar consumed by program import.
 * @param {Meta|undefined} meta @param {Row[]} rows @param {Model} model */
export function programTextData(meta,rows,model){
  const relations=model.normalizeProgressionRelations(meta?.progressionRelations,rows);
  const exercises=rows.filter(row=>row.progression||row.progressionIncompatibility).map(row=>({day:row.day,order:row.order,id:row.id,
    movementId:row.movementId,...(row.progression?{progression:cloneSnapshot(row.progression)}:{}),
    ...(row.progressionIncompatibility?{progressionIncompatibility:cloneSnapshot(row.progressionIncompatibility)}:{})}));
  const modifiers=model.normalizeProgressionModifiers(meta?.progressionModifiers);
  const incompatibilities=Array.isArray(meta?.progressionIncompatibilities)?cloneSnapshot(meta.progressionIncompatibilities):[];
  if(!exercises.length&&!relations.length&&!modifiers.length&&!incompatibilities.length)return null;
  return{version:1,exercises,relations,modifiers,incompatibilities};
}
/** @param {{name?:string,meta?:Meta,rows:Row[],days:{name:string,muscles:string[],rows:Row[]}[],model:Model,date:string,locale:string,format:{t:(key:string,vars?:Record<string,unknown>)=>string,exerciseName:(row:Row)=>string}}} input */
export function programTextFile({name,meta,rows,days,model,date,locale,format}){
  const {t,exerciseName}=format;
  /** @param {unknown} value */
  const up=value=>String(value??'').toLocaleUpperCase(locale);
  const lines=[`${up(name||t('untitled_program'))}, ${t('program.export_text.days_per_week',{n:days.length})}`];
  for(const day of days){
    const muscles=day.muscles;
    lines.push('',`${up(day.name)}${muscles.length?`: ${muscles.join(' · ')}`:''}`);
    day.rows.forEach((row,index)=>{
      const reps=row.min===row.max?`${row.min}`:t('program.export_text.rep_range',{min:row.min,max:row.max});
      lines.push(`${index+1}. ${exerciseName(row)}: ${row.sets}× ${reps}`);
    });
  }
  const appendix=programTextData(meta,rows,model);
  if(appendix)lines.push('',PROGRAM_TEXT_DATA_MARKER,JSON.stringify(appendix));
  const slug=fileSlug(name);
  return{text:lines.join('\n'),name:`taurifer_program_${slug?`${slug}_`:''}${date}.txt`};
}
