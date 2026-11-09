/**
 * Independent, deterministic semantic oracle. Every reported field is scored
 * against authored gold, never against a second model or source matching.
 * The only source of acceptance status is Taurifer's real parser.
 */
const norm = v => typeof v==="string"?v.normalize("NFC").trim():v;
const id = item => [norm(item.day),item.order,item.field].join("\x1f");
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const sortedSet = value => [...new Set(Array.isArray(value)?value:[])].sort();
const diagnostic = (sample,parsed,execution) => ({
  caseId:sample.id,referenceId:sample.referenceId,
  split:sample.split,locale:sample.locale,difficulty:sample.difficulty,
  tags:sample.tags,expectedOutcome:sample.expectedOutcome||"import",
  transport:execution.transport||null,model:execution.model||null,
  promptId:execution.promptId||null,latencyMs:execution.latencyMs??null,
  usage:execution.usage??null,costUsd:execution.costUsd??null,
  exitCode:execution.exitCode??null,
  rawOutputPath:execution.rawOutputPath||null
});
export function gradeCase(sample, parsed, execution={}){
  if(sample.requiresAdjudication)throw new Error("Manual adjudication case cannot be automatically scored");
  const status=parsed?.status||"unreadable";
  const got=Array.isArray(parsed?.exercises)?parsed.exercises:[];
  const parseable=status==="complete"||status==="gaps";
  if(sample.expectedOutcome==="reject"){
    return {
      ...diagnostic(sample,parsed,execution),
      status,parseable,semanticPass:!parseable,
      // Importing any program from non-program text is an unsafe acceptance.
      unsafeComplete:parseable,
      fidelity:null,expectedRows:0,actualRows:got.length,
      expectedGapCount:0,actualGapCount:Array.isArray(parsed?.gaps)?parsed.gaps.length:0,
      categoriesRecall:null,errors:parseable?[{code:"non_program_accepted"}]:[],
      failuresByRow:[]
    };
  }
  if(sample.expectedOutcome&&sample.expectedOutcome!=="import")
    throw new Error("Unknown expectedOutcome: "+sample.expectedOutcome);
  const exp=sample.expected;
  if(!exp?.exercises)throw new Error("Missing gold rows: "+sample.id);
  const failures=[],failuresByRow=[];
  const add=(code,i=null)=>{
    failures.push(code);
    if(i!==null)failuresByRow.push({row:i+1,code});
  };
  let matched=0,compared=0;
  if(!parseable)add("parse_failure");
  if(got.length!==exp.exercises.length)add("row_count_mismatch");
  const total=Math.max(got.length,exp.exercises.length);
  for(let i=0;i<total;i++){
    const a=exp.exercises[i],b=got[i];
    if(!a){add("extra_exercise",i);compared+=5;continue}
    if(!b){add("missing_exercise",i);compared+=5;continue}
    for(const [field,left,right] of [
      ["day",norm(a.day),norm(b.day)],
      ["order",a.order,b.order],
      ["name",norm(a.name),norm(b.name)]
    ]){
      compared++;
      if(left===right)matched++;else add("wrong_"+field,i);
    }
    compared++;
    if(a.sets===undefined&&b.sets!==undefined&&b.sets!==null)
      add("invented_sets",i);
    else if(a.sets===b.sets)matched++;
    else add("wrong_sets",i);
    compared++;
    if(a.min===undefined&&(b.min!==undefined||b.max!==undefined))
      add("invented_reps",i);
    else if(same([a.min,a.max],[b.min,b.max]))matched++;
    else add("wrong_reps",i);
  }
  // Names are legitimate model-written metadata: the user may rename at review.
  // Record drift diagnostically without treating a plausible title as a failure.
  const metaNameMatch=typeof parsed?.metaName==="string"&&
    typeof exp.meta?.name==="string" ?
    norm(parsed.metaName)===norm(exp.meta.name):null;
  const expectedGaps=exp.missing.map(id).sort();
  const actualGaps=(parsed?.gaps||[]).map(id).sort();
  if(!same(expectedGaps,actualGaps))add("gap_mismatch");
  if(exp.missing.length&&status!=="gaps")add("missing_gap_step");
  if(!exp.missing.length&&status==="gaps")add("unnecessary_gap_step");
  const categories=Array.isArray(parsed?.notImported)?parsed.notImported:[];
  const expectedCategories=sortedSet(exp.notImported);
  const actualCategories=sortedSet(categories);
  if(categories.length!==new Set(categories).size)add("duplicate_categories");
  if(!same(expectedCategories,actualCategories)){
    for(const x of expectedCategories)if(!actualCategories.includes(x))add("missing_category_"+x);
    for(const x of actualCategories)if(!expectedCategories.includes(x))add("invented_category_"+x);
  }
  const errors=[...new Set(failures)].map(code=>({code}));
  const semanticPass=parseable&&errors.length===0;
  const unsafeComplete=status==="complete"&&errors.some(e=>
    e.code==="extra_exercise"||e.code==="missing_exercise"||
    e.code==="row_count_mismatch"||e.code.startsWith("wrong_day")||
    e.code.startsWith("wrong_order")||e.code.startsWith("wrong_name")||
    e.code.startsWith("wrong_sets")||e.code.startsWith("wrong_reps")||
    e.code.startsWith("invented_sets")||e.code.startsWith("invented_reps"));
  return {
    ...diagnostic(sample,parsed,execution),
    status,parseable,semanticPass,unsafeComplete,metaNameMatch,
    fidelity:compared?matched/compared:0,
    expectedRows:exp.exercises.length,actualRows:got.length,
    expectedGapCount:exp.missing.length,actualGapCount:actualGaps.length,
    categoriesRecall:expectedCategories.length
      ?expectedCategories.filter(x=>actualCategories.includes(x)).length/
        expectedCategories.length:1,
    errors,failuresByRow
  };
}
