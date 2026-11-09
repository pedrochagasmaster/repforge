/** Deterministic, founder-auditable evaluator. No model judge in the pass gate. */
const norm = v => typeof v==="string" ? v.normalize("NFC").trim() : v;
const key = item => [norm(item.day),item.order,item.field].join("\x1f");
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const distinctSorted = value => [...new Set(value||[])].sort();

export function gradeCase(sample, parsed, execution={}) {
  const exp=sample.expected;
  const got=Array.isArray(parsed?.exercises)?parsed.exercises:[];
  const status=parsed?.status||"unreadable";
  const parseable=status==="complete"||status==="gaps";
  const failures=[];
  let matched=0, compared=0;
  const failuresByRow=[];
  const add=(code,i=null)=>{
    failures.push(code);
    if(i!=null)failuresByRow.push({row:i+1,code});
  };
  if(!parseable) add("parse_failure");
  if(got.length!==exp.exercises.length) add("row_count_mismatch");
  const max=Math.max(got.length,exp.exercises.length);
  for(let i=0;i<max;i++){
    const a=exp.exercises[i],b=got[i];
    if(!a){ add("extra_exercise",i);compared+=5;continue; }
    if(!b){ add("missing_exercise",i);compared+=5;continue; }
    const props=[
      ["day",norm(a.day),norm(b.day)],
      ["order",a.order,b.order],
      ["name",norm(a.name),norm(b.name)]
    ];
    for(const [field,expected,actual] of props) {
      compared++;
      if(expected===actual) matched++;
      else add("wrong_"+field,i);
    }
    compared++;
    if(a.sets===undefined && b.sets!==undefined && b.sets!==null) add("invented_sets",i);
    else if(a.sets===b.sets) matched++;
    else add("wrong_sets",i);
    compared++;
    const aReps=[a.min,a.max],bReps=[b.min,b.max];
    if(a.min===undefined && (b.min!==undefined||b.max!==undefined)) add("invented_reps",i);
    else if(same(aReps,bReps)) matched++;
    else add("wrong_reps",i);
  }
  const expectedGaps=exp.missing.map(key).sort();
  const actualGaps=(parsed?.gaps||[]).map(key).sort();
  if(!same(expectedGaps,actualGaps))add("gap_mismatch");
  if(exp.missing.length && status!=="gaps") add("missing_gap_step");
  if(!exp.missing.length && status==="gaps") add("unnecessary_gap_step");
  const expectedCategories=distinctSorted(exp.notImported);
  const actualCategories=distinctSorted(parsed?.notImported);
  if(!same(expectedCategories,actualCategories)){
    for(const x of expectedCategories)if(!actualCategories.includes(x))add("missing_category_"+x);
    for(const x of actualCategories)if(!expectedCategories.includes(x))add("invented_category_"+x);
  }
  const fidelity=compared ? matched/compared : 0;
  const uniqueFailures=[...new Set(failures)];
  const semanticPass=parseable && !uniqueFailures.length;
  const unsafeComplete=status==="complete"&&uniqueFailures.some(x=>
    x.startsWith("invented_")||x.startsWith("wrong_")||
    x==="extra_exercise"||x==="missing_exercise"||x==="row_count_mismatch");
  const errors=uniqueFailures.map(code=>({code}));
  return {
    caseId:sample.id,referenceId:sample.referenceId,split:sample.split,
    locale:sample.locale,difficulty:sample.difficulty,tags:sample.tags,
    status,parseable,semanticPass,unsafeComplete,fidelity,
    expectedRows:exp.exercises.length,actualRows:got.length,
    expectedGapCount:exp.missing.length,actualGapCount:actualGaps.length,
    categoriesRecall:expectedCategories.length
      ? expectedCategories.filter(x=>actualCategories.includes(x)).length/expectedCategories.length:1,
    errors,failuresByRow,
    transport:execution.transport||null,model:execution.model||null,
    promptId:execution.promptId||null,latencyMs:execution.latencyMs??null,
    usage:execution.usage??null,costUsd:execution.costUsd??null,
    exitCode:execution.exitCode??null,rawOutputPath:execution.rawOutputPath||null
  };
}
