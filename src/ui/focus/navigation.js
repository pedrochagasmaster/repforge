/** Selected exercise is transient Focus state; the named application command
 * persists its acknowledged draft counterpart. Motion owns animation lifetime.
 * @param {{focus:ReturnType<typeof import('./state.js').createFocusState>,read:()=>{hasDraft:boolean,exercises:readonly {id:string}[]},workout:Pick<ReturnType<typeof import('../../app/workout.js').createWorkoutCommands>,'dispatch'>,motion:Pick<ReturnType<typeof import('../../platform/motion.js').createMotion>,'navigate'>,onSelection:(options:{scrollTop:boolean})=>void}} options */
export function createFocusNavigation({focus,read,workout,motion,onSelection}){
  function position(){const {exercises,hasDraft}=read(),at=exercises.length?Math.min(focus.index,exercises.length-1):0;return {exercises,hasDraft,at};}
  /** @param {number} index @param {ReturnType<typeof position>} context @param {boolean} scrollTop */
  function select(index,context,scrollTop){
    focus.navigateTo(index);
    const exercise=context.exercises[index];if(context.hasDraft&&exercise)void workout.dispatch('selectExercise',{exerciseInstanceId:exercise.id});
    onSelection({scrollTop});
  }
  /** @param {number} direction */
  function go(direction){const context=position(),next=context.at+direction;if(next<0||next>=context.exercises.length)return false;select(next,context,true);return true;}
  /** @param {number} index */
  function direct(index){select(Math.max(0,index),position(),false);}
  /** @param {number} direction */
  function canGo(direction){const {exercises,at}=position();return at+direction>=0&&at+direction<exercises.length;}
  /** @param {number} index */
  function jump(index){const context=position(),distance=index-context.at;if(!distance||index<0||index>=context.exercises.length)return false;if(Math.abs(distance)===1)return motion.navigate(distance);direct(index);return true;}
  return {go,direct,canGo,jump};
}
