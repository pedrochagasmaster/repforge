/** CSV presentation uses the same source-metric and locale readers as History. */
export function csvFile({state,readLogRow,exerciseLabel,rowMuscles,e1rm,date}){
  const PER_SIDE_LOAD_SEMANTICS=new Set(["loadPerSideKg","persistentLoadPerSideKg"]);
  const hr=+state.settings.hardRir;
  const reading=row=>readLogRow(row);
  const hasPerSideMetric=row=>(row?.metricDefinitions||[]).some(metric=>
    PER_SIDE_LOAD_SEMANTICS.has(metric?.semantic)||metric?.semantic==="repsPerSide");
  const cols=[
    ["session",r=>r.session],["date",r=>r.date],["day",r=>r.day],
    ["name",r=>exerciseLabel(r)],["performed_name",r=>r.performedName||""],["exercise_id",r=>r.exerciseId||""],
    ["set",r=>r.set],["load",r=>reading(r).totalLoad??""],["reps",r=>reading(r).totalReps??""],
    ["load_per_side",r=>reading(r).loadPerSide??""],["reps_per_side",r=>reading(r).repsPerSide??""],["rir",r=>r.rir],
    ["e1rm",r=>{const value=reading(r);return value.strengthComparable?+value.e1rm.toFixed(2):hasPerSideMetric(r)?"":+e1rm(+r.load,+r.reps).toFixed(2)}],
    ["tonnage",r=>{const value=reading(r);return Number.isFinite(value.tonnage)?+value.tonnage.toFixed(2):hasPerSideMetric(r)?"":+((+r.load||0)*(+r.reps||0)).toFixed(2)}],
    ["primary",r=>rowMuscles(r).primary],["secondary",r=>rowMuscles(r).secondary],
    ["is_hard_set",r=>(+reading(r).load>0&&+reading(r).reps>0&&+r.rir<=hr&&!r.warmup)?1:0],
    ["is_warmup",r=>r.warmup?1:0],
    ["bodyweight",r=>r.bodyweight??""],
    ["notes",r=>r.notes],["exercise_note",r=>r.exNote||""],["created",r=>r.created],
  ];
  const q=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv=[cols.map(c=>c[0]).join(","),
    ...state.log.map(r=>cols.map(c=>q(c[1](r))).join(","))].join("\n");
  return {text:csv,name:`taurifer_log_${date}.csv`};
}
