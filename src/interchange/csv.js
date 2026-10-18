/** CSV presentation uses the same source-metric and locale readers as History. */
/** @typedef {{[key:string]:unknown,load?:number|string|null,reps?:number|string|null,rir?:number|string|null,warmup?:boolean,metricDefinitions?:Array<{semantic?:string}>}} CsvRow
 * @typedef {{load:number|null,reps:number|null,totalLoad:number|null,totalReps:number|null,loadPerSide:number|null,repsPerSide:number|null,tonnage:number|null}&({strengthComparable:true,e1rm:number}|{strengthComparable:false,e1rm:null})} CsvReading */
/** @param {{state:{settings:{hardRir?:unknown},log:CsvRow[]},readLogRow?:(row:CsvRow)=>CsvReading,exerciseLabel?:(row:CsvRow)=>string,rowMuscles?:(row:CsvRow)=>{primary:string,secondary:string},e1rm?:(load:number,reps:number)=>number,date:string}} input */
export function csvFile({state,readLogRow,exerciseLabel,rowMuscles,e1rm,date}){
  const PER_SIDE_LOAD_SEMANTICS=new Set(["loadPerSideKg","persistentLoadPerSideKg"]);
  if(state.log.length&&(!readLogRow||!exerciseLabel||!rowMuscles||!e1rm))throw new TypeError('CSV readers unavailable');
  const hr=Number(state.settings.hardRir);
  /** @param {CsvRow} row @returns {CsvReading} */
  const reading=row=>{if(!readLogRow)throw new TypeError('CSV reader unavailable');return readLogRow(row);};
  /** @param {CsvRow} row */
  const hasPerSideMetric=row=>(row?.metricDefinitions||[]).some(metric=>
    PER_SIDE_LOAD_SEMANTICS.has(metric?.semantic||'')||metric?.semantic==="repsPerSide");
  /** @type {Array<[string,(row:CsvRow)=>unknown]>} */
  const cols=[
    ["session",r=>r.session],["date",r=>r.date],["day",r=>r.day],
    ["name",r=>exerciseLabel?.(r)],["performed_name",r=>r.performedName||""],["exercise_id",r=>r.exerciseId||""],
    ["set",r=>r.set],["load",r=>reading(r).totalLoad??""],["reps",r=>reading(r).totalReps??""],
    ["load_per_side",r=>reading(r).loadPerSide??""],["reps_per_side",r=>reading(r).repsPerSide??""],["rir",r=>r.rir],
    ["e1rm",r=>{const value=reading(r);return value.strengthComparable?+value.e1rm.toFixed(2):hasPerSideMetric(r)?"":+(e1rm?.(Number(r.load),Number(r.reps))??NaN).toFixed(2)}],
    ["tonnage",r=>{const value=reading(r);return typeof value.tonnage==='number'&&Number.isFinite(value.tonnage)?+value.tonnage.toFixed(2):hasPerSideMetric(r)?"":+((Number(r.load)||0)*(Number(r.reps)||0)).toFixed(2)}],
    ["primary",r=>rowMuscles?.(r).primary],["secondary",r=>rowMuscles?.(r).secondary],
    ["is_hard_set",r=>(Number(reading(r).load)>0&&Number(reading(r).reps)>0&&Number(r.rir)<=hr&&!r.warmup)?1:0],
    ["is_warmup",r=>r.warmup?1:0],
    ["bodyweight",r=>r.bodyweight??""],
    ["notes",r=>r.notes],["exercise_note",r=>r.exNote||""],["created",r=>r.created],
  ];
  /** @param {unknown} v */
  const q=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv=[cols.map(c=>c[0]).join(","),
    ...state.log.map(r=>cols.map(c=>q(c[1](r))).join(","))].join("\n");
  return {text:csv,name:`taurifer_log_${date}.csv`};
}
