/** Training decisions and presentation-free progress evidence. All clocks are caller supplied. */
import progression from "./progress/internal/progression.js";
import evidence from "./progress/internal/evidence.js";
import schedule from "./progress/internal/schedule.js";
export * from "./progress/internal/progression.js";
export * from "./progress/internal/evidence.js";
export * from "./progress/internal/schedule.js";
export { progression, evidence, schedule };
export { liftPR, sessionPRs, sessionMuscleWork, sessionOutcomeGroups, buildSessionSummary } from './progress/internal/summary.js';
export {workingRows,buildSessionDelta,compareProjectedSessionOutcome,noComparableSessionOutcome} from './progress/internal/session-outcome.js';
export {derivePersonalRecords} from './progress/internal/personal-records.js';
export {scalarSessions,previousScalarSessionRows,mergeLogChronology,isStalled,blockCompletionBucket,programProgressionHealth,programVolumeCompliance,programStatusKey,blockReviewRecommendation} from './progress/internal/health.js';

/** Public values consumed across owner boundaries; runtime validators remain authoritative.
 * @typedef {import('./progress/internal/contracts.js').EvidenceMeta} EvidenceMeta
 * @typedef {import('./progress/internal/contracts.js').EvidenceRecord} EvidenceRecord
 * @typedef {import('./progress/internal/personal-records.js').RecordRow} RecordRow
 * @typedef {import('./progress/internal/session-outcome.js').SessionOutcome} SessionOutcome
 */
