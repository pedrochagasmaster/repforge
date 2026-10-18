export interface ExerciseRow {session?:string|number;date?:string;day?:string;created?:string|null;load?:number|string|null;reps?:number|string|null;rir?:number|string|null;exNote?:unknown;warmup?:boolean;e1rm:number}
export interface ExerciseSession {session?:string|number;date?:string;day?:string;created?:string|null;rows:ExerciseRow[];note:string}
export interface ExercisePr {kind:string;load:number;reps:number;date:string;e1rm:number}
export interface TrendRow {date:string;top:number;e1rm:number}
export interface ExerciseFacts {rows:readonly ExerciseRow[];prs:readonly ExercisePr[];summaries:readonly TrendRow[];comparisons:ReadonlyMap<string|number|undefined,{status:string,label:string}>}
