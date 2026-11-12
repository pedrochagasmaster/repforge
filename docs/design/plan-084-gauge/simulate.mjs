// Design simulation only. Synthetic saved sessions through shipped pure APIs.
// No assertions, browser, app writes, test fixtures or CI commands.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const Engine = require('../../../progression-engine.js');
const Calibration = require('../../../effort-calibration.js');
const Metrics = require('../../../exercise-metrics.js');
const defs = ['loadKg', 'reps'].map(semantic => Metrics.DEFINITIONS.find(d => d.semantic === semantic));
const start = Date.parse('2026-01-05T12:00:00Z');
const dateAt = day => new Date(start + day * 86400000).toISOString().slice(0,10);
function prescription(key) {
  return { id:`${key}:s1`, slotId:key, cycleIndex:1, setIndex:1, exerciseId:key,
    metricType:'source_metrics@1', metricIds:defs.map(d => d.id), metricDefinitions:defs,
    targets:{reps:{min:8,max:12}}, rir:1, status:'ready', loadingModel:{bodyweightCoefficient:0} };
}
function context(key) {
  return { bySlotId:{ [key]:{ equipmentId:`machine-${key}`, loadingConvention:'external',
    bodyweightContributionEnabled:false, externalLoadMultiplier:1,
    availableLoadsKg:Array.from({length:61},(_,i) => i*2.5) } } };
}
function lift(key) { return { key, sessions:[], exposures:0, reached:[false,false,false,false], lastCheck:-1000 }; }
function save(lift, day, check, numeric) {
  const date = dateAt(day), calibration = Calibration.estimate(Calibration.checkErrors({sessions:lift.sessions,today:date}));
  const [before] = Engine.recommendSets([prescription(lift.key)],lift.sessions,[],context(lift.key),{now:date,calibration});
  const offer = Calibration.shouldOffer({standing:before.standing,calibration,lastCheckDays:day-lift.lastCheck});
  const doCheck = check && offer.ok && day-lift.lastCheck >= 14;
  const session = {sessionId:`${lift.key}-${day}`,date,completed:true,
    checks:doCheck ? [{predictedReps:10,reps:10}] : [],
    sets:[12,11,10].map((reps,setIndex) => ({exerciseId:lift.key,completed:true,setIndex,date,
      equipmentId:`machine-${lift.key}`,loadingConvention:'external',
      loadingContext:{loadingConvention:'external',bodyweightCoefficient:0,bodyweightContributionEnabled:false,externalLoadMultiplier:1},
      metricIds:defs.map(d => d.id),metricValues:[{metricId:defs[0].id,value:40,unit:'kg'},{metricId:defs[1].id,value:reps,unit:'reps'}],
      rir:doCheck && setIndex===2 ? 0 : 1,
      effortSource:doCheck && setIndex===2 ? 'failure' : numeric ? 'reps_left' : 'effort',
      ...(doCheck && setIndex===2 ? {calibration:{v:1,predictedReps:10,predictionEdited:true,prefillBasis:'reps_rir'}} : {}) })) };
  lift.sessions.push(session); lift.exposures++;
  if (doCheck) lift.lastCheck=day;
  const estimate=Calibration.estimate(Calibration.checkErrors({sessions:lift.sessions,today:date}));
  const [after]=Engine.recommendSets([prescription(lift.key)],lift.sessions,[],context(lift.key),{now:date,calibration:estimate});
  const standing=after.standing;
  if (standing.word!=='first' && !standing.unavailable) lift.reached[0]=true;
  if (lift.reached[0] && standing.word==='solid' && !standing.unavailable) lift.reached[1]=true;
  if (lift.reached[1] && (lift.sessions.some(s => s.checks.length) || lift.exposures>=32)) lift.reached[2]=true;
  const consistent=estimate.n>=3 && estimate.spread<=1.25 && ['calibrated','under','over'].includes(estimate.state);
  if (lift.reached[2] && (consistent || lift.exposures>=64)) lift.reached[3]=true;
  lift.current={date,selectionStatus:after.status,standingUnavailable:standing.unavailable===true,standing:standing.word,standingEvidence:standing.evidence,calibration:estimate};
}
function run(kind) {
  let lifts=Array.from({length:kind==='intermediate'?8:4},(_,i)=>lift(`lift-${i+1}`));
  const weeks=[];
  for(let week=1;week<=16;week++) {
    const days=kind==='intermediate'?[0,1,3,4]:[0,2,4];
    for(const [dayIndex,offset] of days.entries()) {
      const day=(week-1)*7+offset;
      const active=kind==='intermediate'?lifts.filter((_,i)=>i%2===dayIndex%2):lifts;
      // At most one offer per session and two per week. Four lifts rotate on
      // Mon/Fri, 14 days between a key's offered checks, uncertainty decides.
      const candidate=kind==='intermediate'?-1:dayIndex===0?((week-1)*2)%4:dayIndex===2?((week-1)*2+1)%4:-1;
      for(const item of active) save(item,day,lifts.indexOf(item)===candidate,kind==='intermediate');
    }
    // New program at the end of week 8 retains all four comparable lifts and
    // adds two. No training is invented for those new identities.
    const expansion=kind==='change' && week===8;
    if(expansion) lifts.push(lift('lift-5'),lift('lift-6'));
    const details=lifts.map(item=>({key:item.key,exposures:item.exposures,
      attained:item.reached,steps:Math.min(64,item.exposures)+item.reached.filter(Boolean).length,
      ...item.current}));
    const earned=details.reduce((n,item)=>n+item.steps,0), budget=68*lifts.length;
    weeks.push({week,earned,budget,expansion,lifts:details});
  }
  return weeks;
}
const scenarios={beginner:run('beginner'),intermediate:run('intermediate'),change:run('change')};
const rows=Array.from({length:16},(_,i)=>`| ${i+1} | ${scenarios.beginner[i].earned}/${scenarios.beginner[i].budget} | ${scenarios.intermediate[i].earned}/${scenarios.intermediate[i].budget} | ${scenarios.change[i].earned}/${scenarios.change[i].budget}${i===7?' *':''} |`);
const markdown=['| Week | Beginner, 3/week | Intermediate, 4/week, no tests | New program at week 8 |','| --- | --- | --- | --- |',...rows].join('\n');
await writeFile(new URL('simulation.json',import.meta.url),JSON.stringify({model:'profile-depth-proposal@084.2',standing:Engine.STANDING_VERSION,calibration:Calibration.CALIBRATION_VERSION,scenarios},null,2)+'\n');
await writeFile(new URL('simulation-table.md',import.meta.url),markdown+'\n');
const planUrl=new URL('../../../plans/084-gauge-return.md',import.meta.url);
const plan=await readFile(planUrl,'utf8');
await writeFile(planUrl,plan.replace(/(<!-- simulation-table:start -->\n)[\s\S]*?(\n<!-- simulation-table:end -->)/,`$1${markdown}$2`));
execFileSync('python3',[fileURLToPath(new URL('render-simulation.py',import.meta.url))]);
console.log(markdown);
