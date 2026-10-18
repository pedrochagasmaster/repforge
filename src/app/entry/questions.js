/** @typedef {ReturnType<typeof import('../../training/authoring.js').createEntryRules>} Rules
 * @typedef {ReturnType<Rules['createState']>} Draft
 * @typedef {{choices:readonly {id:string,default?:boolean}[]}} SplitChoices
 */
/** Application navigation omits a custom split question with one legal answer.
 * Rendering never selects that answer, moves the draft, or saves it.
 * @param {{rules:Rules,splitChoices:(answers:Draft['answers'])=>SplitChoices}} options */
export function createEntryQuestionFlow({rules,splitChoices}){
 /** @param {Draft} draft @returns {Draft} */
 function normalizeScreen(draft){
  if(draft.route!=='custom'||draft.step!=='custom_shape')return draft;
  return selectSingle(draft,splitChoices(draft.answers).choices);
 }
 /** @param {Draft} draft @param {SplitChoices['choices']} choices @returns {Draft} */
 function selectSingle(draft,choices){
  if(choices.length!==1)return draft;
  const answered=rules.setAnswers(draft,{splitPreference:choices[0].id}),next=rules.advance(answered);
  return next.ok?next.state:draft;
 }
 /** @param {Draft} draft */
 function advance(draft){
  const outcome=rules.advance(draft);if(!outcome.ok)return outcome;
  let next=outcome.state;
  if(next.route==='custom'&&next.step==='custom_shape'){
   const choices=splitChoices(next.answers).choices;
   if(choices.length===1)next=selectSingle(next,choices);
   else if(choices.length>=2&&!choices.some(choice=>choice.id===next.answers.splitPreference)){
    const preferred=choices.find(choice=>choice.default)||choices[0];
    next=rules.setAnswers(next,{splitPreference:preferred.id});
   }
  }
  return {...outcome,state:next};
 }
 /** @param {Draft} draft @returns {Draft} */
 function back(draft){
  const previous=rules.back(draft);
  return draft.route==='custom'&&previous.step==='custom_shape'&&splitChoices(draft.answers).choices.length<2?
   {...previous,step:'exercise_preferences'}:previous;
 }
 return Object.freeze({normalizeScreen,advance,back});
}
