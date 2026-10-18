/** Allocation and scheduling DTOs for the single recovered generation engine. */
/** @typedef {import('./candidate-contracts.js').DescribedExercise} DescribedExercise */
/** @typedef {import('./candidate-contracts.js').TemplateSpec} TemplateSpec */
/** @typedef {import('./candidate-contracts.js').CandidateRequest & {split:string,daysPerWeek:number,timeCeilingMinutes:number,periodization:string,cycles:number,deloadCycles:number[]}} LayoutRequest */
/** @typedef {ReturnType<typeof import('./candidates.js').create>} Selector */
/** @typedef {{exercise:DescribedExercise,numSets:number,type:string,accessoryMuscle?:string|null,restSecondsBySet?:(number|null)[]}} LayoutTemplate */
/** @typedef {{name:string,primary:readonly string[],secondary:readonly string[],extra:readonly string[]}} DayRule */
/** @typedef {{id:string,daysPerWeek:readonly number[],variants:Readonly<Record<number,{upperFraction:number,days:readonly DayRule[]}>>}} SplitDescriptor */
/** @typedef {number[]} AllocationRow */
/** @typedef {{compound:AllocationRow,isolation:AllocationRow}} RegionalAllocation */
/** @typedef {Record<string,RegionalAllocation>} Allocation */
/** @typedef {{template:LayoutTemplate,lineage:string,baseSetCount:number,initialDayIndex?:number}} DiagnosticRecord */
/** @typedef {{status:'unsupported',code:string}|{status:'ok'|'insufficient',code?:undefined,issues?:{code:string}[],days:{name:string,templates:LayoutTemplate[]}[],weeklySlots:(number|null)[],budgetMinutes:number,allocations:Allocation,estimatedSessionSeconds:number[],diagnosticRecords?:DiagnosticRecord[]}} LayoutResult */
export {};
