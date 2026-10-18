import type { EvidenceMeta, EvidenceRecord } from '../training/progress.js';
export type { EvidenceMeta, EvidenceRecord };
export interface StrengthRow {
    exerciseId: string;
    session?: string | number;
    sessionKey: string;
    date: string;
    created?: string | null;
    blockId?: string | null;
    name: string;
    day?: string;
    load: number;
    reps: number;
    rir: number | null;
    work: true;
    strengthComparable?: boolean;
    strengthConvention?: string | null;
    perSideLoad?: boolean;
    perSideReps?: boolean;
    tonnage: number | null;
    e1rm: number;
}
export interface ProgramLift {
    key: string;
    name: string;
    signal: string;
}
export interface ProgressFacts {
    scope: string;
    recordKeys: readonly string[];
    rows: StrengthRow[];
    meta: EvidenceMeta;
    program: readonly ProgramLift[];
}
export interface PrEvent {
    liftKey: string;
    session?: string | number;
    date?: string;
    blockId?: string | null;
}
export interface ProjectionFacts extends ProgressFacts {
    records: EvidenceRecord[];
    prEvents: readonly PrEvent[];
}
export type StrengthSeries = ReturnType<typeof import("../training/progress.js").evidence.buildStrengthEvidence> & {
    perSideLoad: boolean;
    perSideReps: boolean;
};
export interface ProgressComparisonFacts {
    key: string;
    currentRows: readonly {
        key: string;
        session?: string | number;
    }[] | null;
    reader: {
        scope: unknown;
        convention: unknown;
        session: unknown;
        rows: Omit<StrengthRow, "e1rm">[] | null;
    } | null;
    meta: EvidenceMeta;
}
export type TrainingModel = ReturnType<typeof import('../training/model.js').createProgramModel>;
export type ProgramRow = import('../training/model.js').ExerciseInput;
export type ProgramMeta = import('../training/model.js').ProgramMeta;
export type RecoveryRecord = import('../training/model.js').RecoveryRecord;
export interface VolumeRow {
    session?: string | number;
    date?: string;
    created?: string | null;
    day?: string;
    name?: string;
    liftKey: string;
    displayName: string;
    load?: number | string | null;
    reps?: number | string | null;
    rir?: number | string | null;
    warmup?: boolean;
    work?: boolean;
    primary?: string | null;
    secondary?: string | null;
    performedPrimary?: string | null;
    performedSecondary?: string | null;
    strengthComparable?: boolean;
    strengthConvention?: string | null;
    blockId?: string | null;
}
export interface ProgressSnapshot {
    program: ProgramRow[];
    programMeta: Omit<ProgramMeta, 'started'> & {
        started?: string | null;
    };
    customExercises: import('../training/model.js').LibraryEntry[];
    settings: {
        hardRir: number | string;
    };
}
export interface ReadFacts {
    snapshot: ProgressSnapshot;
    programRows: ProgramRow[];
    program: readonly DisplayLift[];
    log: VolumeRow[];
    today: string;
    blockId?: string | null;
    recoveryRecord: RecoveryRecord | null;
}
export interface DisplayLift {
    key: string;
    id: string;
    name: string;
    displayName: string;
}
export type Projection = ReturnType<typeof import('./progress-read-models.js').buildStrengthProjection>;
export interface StrengthFacts {
    scope: string;
    projection: Projection;
    program: readonly DisplayLift[];
    rows: Omit<StrengthRow, "e1rm">[];
}
export interface Recommendation {
    status: string;
    stalled?: boolean;
    reason?: string;
    load?: number | null;
    label?: string;
    text?: string;
}
export interface ProgressFormat {
    locale: () => string;
    exercise: (name: string, key: string) => string;
    muscle: (name: string) => string;
    shortDate: (date: string) => string;
    longDate: (date: string) => string;
    displayLoad: (value: number) => number;
    number: (value: number) => string;
}
export interface ReadModelOptions {
    training: Pick<TrainingModel, 'flatProgramFromDefinition' | 'prescriptionForReceipt' | 'plannedPrescriptionForProgram' | 'recoveryReceiptForWeek' | 'isValidPlannedVolumeHistory' | 'mesocycleLifecycle' | 'normalizeMuscleAttribution'>;
    copy: {
        t: (key: string, values?: Record<string, unknown>) => string;
    };
    format: ProgressFormat;
}
export interface MuscleRow {
    performedPrimary?: string | null;
    performedSecondary?: string | null;
    primary?: string | null;
    secondary?: string | null;
    name?: string;
}
export type MuscleMap = Map<string, {
    d: number;
    p: number;
}>;
export interface DetailedPrEvent extends PrEvent {
    kind: string;
    load: number;
    reps: number;
    exerciseName: string;
    deltaLoad?: number;
    deltaReps?: number;
    deltaE1rm?: number;
}
export interface AttentionGroup {
    key: string;
    cls: string;
    lead: string;
    items: {
        ex: DisplayLift;
        why: string;
        item: ReturnType<typeof import('../training/progress.js').evidence.buildProgramActionQueue>[number];
    }[];
}

export interface MuscleWorkRow extends MuscleRow {date?:string;load?:number|string|null;reps?:number|string|null;rir?:number|string|null;warmup?:boolean}
