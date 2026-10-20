/** Review operates on a previously validated recommendation; each raw edit is
 * checked locally and the resulting whole definition is validated again. */
/** @typedef {import('../../generation/internal/compiler-contracts.js').ProgramDefinition} ProgramDefinition */
/** @typedef {import('../../generation/internal/compiler-contracts.js').ProgramSlot} ProgramSlot */
/** @typedef {import('../../generation/internal/compiler-contracts.js').ProgramSet} ProgramSet */
/** @typedef {import('../../generation/internal/compiler-contracts.js').ProgramDay} ProgramDay */
/** @typedef {import('../../generation/internal/compiler-contracts.js').SourceCatalog} SourceCatalog */
/** @typedef {import('../../generation/internal/compiler-contracts.js').SourceExercise} SourceExercise */
/** @typedef {import('../../generation/internal/compiler-contracts.js').MetricDefinition} MetricDefinition */
/** @typedef {import('../../generation/internal/compiler-contracts.js').RepRange} RepRange */
/** @typedef {{compiler:ReturnType<typeof import('../../generation/internal/compiler.js').createCompiler>,catalog:SourceCatalog,metrics?:typeof import('../../metrics.js').default,ordinal?:number,customDefinitions?:unknown[],dayName?:(day:ProgramDay,definition:ProgramDefinition)=>string}} ReviewContext */
/** @typedef {{ok:false,code:string,issues:string[]}} ReviewRefusal */
/** @typedef {ReviewRefusal|{ok:true,definition:ProgramDefinition}} ReviewResult */
/** @typedef {{metricIds:string[],metricDefinitions:MetricDefinition[],semantic:string}} CatalogMetrics */
export {};
