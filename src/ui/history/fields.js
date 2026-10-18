/** History form projections. Corrections apply to volatile working copies only;
 * application commands still validate and publish the captured saved session. */
export const isSourceMetricRow=row=>row?.metricType==="source_metrics@1"||Array.isArray(row?.metricIds)||Array.isArray(row?.metricValues);
export function historyMetricRecords(row){
      if(!isSourceMetricRow(row))return null;
      if(!Array.isArray(row?.metricIds)||!Array.isArray(row?.metricDefinitions)||!Array.isArray(row?.metricValues)||
        row.metricIds.length!==row.metricDefinitions.length||row.metricIds.length!==row.metricValues.length)return[];
      const records=row.metricIds.map((id,index)=>{
        const definition=row.metricDefinitions[index],value=row.metricValues[index];
        if(definition?.id!==id||value?.metricId!==id||typeof value.value!=="number"||!Number.isFinite(value.value))return null;
        return{definition,value:value.value,unit:value.unit};
      });
      return records.every(Boolean)?records:[]}
export function historyHasLoadAndReps(row){
      if(!isSourceMetricRow(row))return true;
      const semantics=new Set((historyMetricRecords(row)||[]).map(metric=>metric.definition.semantic));
      return semantics.has("loadKg")&&semantics.has("reps")}
export function historyHasStrengthMetrics(row){
      if(!isSourceMetricRow(row))return true;
      const semantics=new Set((historyMetricRecords(row)||[]).map(metric=>metric.definition.semantic));
      return["loadKg","assistanceKg","loadPerSideKg","persistentLoadPerSideKg","reps","repsPerSide"].some(semantic=>semantics.has(semantic))}
export function historyHasRir(rows){return(rows||[]).some(row=>Number.isFinite(row?.rir)||row?.rirMeasured===true)}
export function historyMetricProjection(row,metricId,value){
      const metric=historyMetricRecords(row)?.find(item=>item.definition.id===metricId)?.definition;
      if(metric?.semantic==="loadKg")row.load=value;
      if(metric?.semantic==="reps")row.reps=value}
