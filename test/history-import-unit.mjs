#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const HistoryImport = require("../history-import.js");
const fixture = name => readFileSync(new URL(`./fixtures/history-import/${name}`, import.meta.url), "utf8");
const moduleSource = readFileSync(new URL("../history-import.js", import.meta.url), "utf8");
let passed = 0;

function check(condition, message) {
  assert.ok(condition, message);
  passed++;
}

function target(id) {
  const muscles = {
    pr_bb: ["Chest", "Triceps"],
    lc_mc: ["Hamstrings", "Calves"],
    hg_bb: ["Hamstrings", "Glutes"],
    rw_cb: ["Mid/upper back", "Biceps"],
    sq_lp: ["Quads", "Glutes"],
  };
  const [primary, secondary] = muscles[id] || ["", ""];
  return { id, primary, secondary };
}

async function classify(name) {
  const lower = name.toLowerCase();
  if (lower === "bench press (barbell)") return { status: "alias", matchId: "pr_bb", candidateIds: [] };
  if (lower === "barbell bench press" || lower === "barbell bench press ") return { status: "exact", matchId: "pr_bb", candidateIds: [] };
  if (lower === "cadeira flexora") return { status: "alias", matchId: "lc_mc", candidateIds: [] };
  if (lower === "rdl" || lower === "romanian deadlift") return { status: "alias", matchId: "hg_bb", candidateIds: [] };
  if (lower === "seated cable row") return { status: "alias", matchId: "rw_cb", candidateIds: [] };
  if (lower.includes("hammer strength") || lower.includes("plate loaded") || lower.includes("life fitness")) {
    return { status: "probable", matchId: "sq_lp", candidateIds: ["sq_lp", "pr_bb"] };
  }
  if (lower.includes("custom") || lower.includes("treadmill")) return { status: "unmatched", matchId: null, candidateIds: [] };
  return { status: "unmatched", matchId: null, candidateIds: [] };
}

const getExercise = async id => ["pr_bb", "lc_mc", "hg_bb", "rw_cb", "sq_lp"].includes(id) ? target(id) : null;
const prepare = (text, options = {}) => HistoryImport.prepareHistoryImport(text, {
  classifyExercise: classify,
  getExercise,
  ...options,
});
const historyRow = (result, predicate = () => true) => result.proposal.rows.find(predicate);

const hevy = fixture("hevy.csv");
const hevyParse = HistoryImport.parseSourceText(hevy);
check(hevyParse.ok && hevyParse.source === "hevy" && hevyParse.records.length === 5,
  "detects the Hevy set-level schema");
check(hevyParse.delimiter === ",", "detects comma-delimited Hevy exports");
const hevyKg = "title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe\nPush,2024-03-11T08:00:00Z,2024-03-11T09:00:00Z,,Barbell bench press,,set,0,normal,20,8,,,7";
const hevyKgReady = await prepare(hevyKg);
check(hevyKgReady.status === "ready" && hevyKgReady.proposal.rows[0].load === 20,
  "Hevy's explicit kilogram header maps directly to canonical kilograms");

const hevyUnresolved = await prepare(hevy);
check(hevyUnresolved.status === "needs-review" && hevyUnresolved.proposal === null,
  "a probable machine candidate cannot become an import proposal");
const machineId = hevyUnresolved.sessions.flatMap(session => session.rows)
  .find(row => row.name.includes("Hammer Strength"))?.sourceMovementId;
check(typeof machineId === "string", "machine wording receives a stable unresolved movement id");
const hevyReady = await prepare(hevy, { decisions: { [machineId]: { kind: "keep-source" } } });
check(hevyReady.status === "ready", "explicitly keeping a machine identity unlocks the supported rows");
check(hevyReady.proposal.rows.length === 4, "unsupported cardio row is reported and excluded");
const hevyBench = historyRow(hevyReady, row => row.name === "Bench Press (Barbell)" && row.set === 1);
check(hevyBench.date === "2024-03-10", "offset timestamp keeps the source calendar date");
check(hevyBench.created === "2024-03-10T07:30:00.000Z", "explicit end offset becomes a UTC instant");
check(Math.abs(hevyBench.load - 135 / 2.2046226218) < 1e-12, "Hevy pounds convert to kilograms without display rounding");
check(hevyBench.rir === 2 && hevyBench.warmup === true, "Hevy RPE and warm-up fields normalize");
check(hevyBench.historyImport.sourceSupersetId === "A", "Hevy superset provenance is retained without changing movement identity");
check(hevyBench.name === "Bench Press (Barbell)" && hevyBench.performedName === hevyBench.name,
  "the source exercise name remains the performed name");
check(hevyBench.performedLibraryId === "pr_bb" && hevyBench.historyImport.identity === "alias",
  "a Plan 061 alias stores the selected performed identity");
check(!Object.hasOwn(hevyBench, "libraryId"), "an imported alias never repoints a program exercise library id");
const hevyMachine = historyRow(hevyReady, row => row.name.includes("Hammer Strength"));
check(!hevyMachine.performedLibraryId && hevyMachine.performedMovementId === machineId,
  "an explicitly kept machine stays outside library identity");
check(hevyMachine.performedPrimary === "" && hevyMachine.performedSecondary === "",
  "unresolved rows block current-program name fallback for muscle attribution");
check(hevyMachine.historyImport.sessionStatus === "partial", "a partial source session is marked on every included row");
check(hevyReady.warnings.some(item => item.code === "unsupported-non-strength-row"),
  "duration and distance activity reports its excluded source row");
check(Object.isFrozen(hevyReady.proposal) && Object.isFrozen(hevyBench.historyImport),
  "the validated proposal and nested metadata are immutable");
check(!/localStorage|indexedDB|commitProposedState|mergeImportedLog/.test(moduleSource),
  "proposal cancellation stays in memory and cannot bypass durable-state ownership");

const strong = fixture("strong.csv");
const strongParse = HistoryImport.parseSourceText(strong);
check(strongParse.ok && strongParse.source === "strong" && strongParse.delimiter === ";",
  "detects Strong headers and semicolon delimiter");
const strongDistanceUnit = "Date;Workout #;Workout Name;Exercise Name;Set Order;Weight (kg);Reps;Distance;Distance Unit\n2024-04-13;104;Cardio;Treadmill;1;;1;3;mi";
const strongDistanceParsed = HistoryImport.parseSourceText(strongDistanceUnit);
check(strongDistanceParsed.ok && strongDistanceParsed.records[0].values.distanceUnit[0] === "mi",
  "accepts Strong's documented Distance Unit column");
const strongReview = await prepare(strong);
check(strongReview.status === "needs-review" && strongReview.blockers.some(item => item.code === "possible-duplicate-session"),
  "a second semantically identical workout is presented as a possible duplicate");
check(strongReview.sessions[0].duplicateRows === 1, "an identical set row is deduplicated under a reliable session id");
const conflictingWorkoutNotes = "Date;Workout #;Workout Name;Exercise Name;Set Order;Weight (kg);Reps;Workout Notes\n2024-06-04;note-1;Push;Barbell bench press;1;80;8;first note\n2024-06-04;note-1;Push;Barbell bench press;1;80;8;changed note";
const workoutNoteConflict = await prepare(conflictingWorkoutNotes);
check(workoutNoteConflict.status === "needs-review" && workoutNoteConflict.proposal === null &&
  workoutNoteConflict.blockers.some(item => item.code === "session-source-conflict"),
  "a duplicate set key with changed workout notes blocks the session instead of dropping the changed note");
const conflictingWorkoutTitles = "Date;Workout #;Workout Name;Exercise Name;Set Order;Weight (kg);Reps\n2024-06-04;title-1;Push;Barbell bench press;1;80;8\n2024-06-04;title-1;Pull;Barbell bench press;1;80;8";
const workoutTitleConflict = await prepare(conflictingWorkoutTitles);
check(workoutTitleConflict.status === "needs-review" && workoutTitleConflict.blockers.some(item => item.code === "session-source-conflict"),
  "duplicate set rows with conflicting session metadata block the session");
const duplicateSession = strongReview.sessions.find(session => session.sourceSessionId === "103");
const strongReady = await prepare(strong, {
  sessionDecisions: { [duplicateSession.decisionKey]: { kind: "skip" } },
});
check(strongReady.status === "ready" && strongReady.proposal.rows.length === 3,
  "explicitly skipping a duplicate Strong session retains the first session only");
const strongBench = historyRow(strongReady, row => row.name === "Barbell bench press" && row.set === 1);
check(strongBench.date === "2024-04-13", "unambiguous day-first Strong date preserves its source day");
check(Math.abs(strongBench.load - 135 / 2.2046226218) < 1e-12 && strongBench.rir === 2,
  "Strong per-row pounds and RPE normalize");
check(strongReady.warnings.some(item => item.code === "rest-timer-skipped"), "Strong rest timers are reported and omitted");
check(strongReady.warnings.some(item => item.code === "duplicate-source-rows-removed"),
  "removed duplicate rows are counted in proposal diagnostics");

const generic = fixture("generic.csv");
const genericParse = HistoryImport.parseSourceText(generic, { source: "generic" });
check(genericParse.ok && genericParse.source === "generic-csv", "generic CSV requires and records explicit source selection");
check(HistoryImport.parseSourceText(generic).issues[0].code === "source-selection-required",
  "generic CSV is never inferred from a filename or guessed header set");
const quotedCsv = "\uFEFFdate;session_id;title;exercise_name;reps;notes\r\n2024-06-01;q-1;\"Upper \"\"A\"\"\";Barbell bench press;8;\"note, \"\"quoted\"\"\"";
const quotedParse = HistoryImport.parseSourceText(quotedCsv, { source: "generic" });
check(quotedParse.ok && quotedParse.records[0].values.sessionTitle[0] === 'Upper "A"' &&
  quotedParse.records[0].values.sessionNote[0] === 'note, "quoted"',
  "BOM, CRLF, delimiters inside quotes, and escaped quotes parse without changing cell data");
const tabParse = HistoryImport.parseSourceText("date\tsession_id\texercise_name\treps\n2024-06-01\tt-1\tBarbell bench press\t8", { source: "generic" });
check(tabParse.ok && tabParse.delimiter === "\t", "generic CSV supports tab-delimited exports");
const genericUnresolved = await prepare(generic, { source: "generic" });
check(genericUnresolved.status === "needs-review", "unmatched custom exercises block proposal creation");
const customId = genericUnresolved.sessions.flatMap(session => session.rows)
  .find(row => row.name === "Custom cable movement")?.sourceMovementId;
const genericReady = await prepare(generic, {
  source: "generic",
  decisions: { [customId]: { kind: "keep-source" } },
});
check(genericReady.status === "ready" && genericReady.source === "generic-csv", "generic candidates validate after explicit reconciliation");
const romanianRows = genericReady.proposal.rows.filter(row => row.name === "RDL" || row.name === "Romanian deadlift");
check(romanianRows.length === 2 && romanianRows.every(row => row.performedLibraryId === "hg_bb"),
  "provider exercise ids preserve a renamed movement after consistent exact and alias evidence");
check(romanianRows[1].rir === 1 && romanianRows[1].historyImport.sourceSetType === "drop_set",
  "explicit RIR takes precedence and drop sets retain source type");
const customRow = historyRow(genericReady, row => row.name === "Custom cable movement");
check(customRow.load === 0 && customRow.performedMovementId === customId && !customRow.performedLibraryId,
  "blank external load stays zero and a custom movement stays unresolved");
check(customRow.historyImport.source === "generic-csv" && customRow.historyImport.sourceSchema === "generic-csv-v1",
  "row provenance records generic source and schema versions");

const unitless = fixture("generic-unitless.csv");
const unitBlocked = await prepare(unitless, { source: "generic" });
check(unitBlocked.status === "needs-review" && unitBlocked.blockers.some(item => item.code === "unit-required"),
  "an unlabelled load cannot inherit the device unit");
const unitResolved = await prepare(unitless, { source: "generic", weightUnit: "lb" });
check(unitResolved.status === "ready" && Math.abs(unitResolved.proposal.rows[0].load - 100 / 2.2046226218) < 1e-12,
  "an explicit source-unit choice resolves the unlabelled load");
const invalidUnit = await prepare(unitless, { source: "generic", weightUnit: "stone" });
check(invalidUnit.status === "needs-review" && invalidUnit.blockers.some(item => item.code === "unit-invalid"),
  "an invalid source-unit override cannot become a proposal");

const ambiguousDate = fixture("ambiguous-date.csv");
const dateBlocked = await prepare(ambiguousDate, { source: "generic" });
check(dateBlocked.status === "needs-review" && dateBlocked.blockers.some(item => item.code === "date-order-required"),
  "ambiguous slash dates block validation");
const dmyDate = await prepare(ambiguousDate, { source: "generic", dateOrder: "DMY" });
const mdyDate = await prepare(ambiguousDate, { source: "generic", dateOrder: "MDY" });
check(dmyDate.proposal.rows[0].date === "2024-03-04" && mdyDate.proposal.rows[0].date === "2024-04-03",
  "explicit slash-date order selects the intended calendar date");
const strongAmbiguous = fixture("strong-ambiguous-date.csv");
const strongAmbiguousReview = await prepare(strongAmbiguous);
const strongAmbiguousDMY = await prepare(strongAmbiguous, { dateOrder: "DMY" });
check(strongAmbiguousReview.status === "needs-review" && strongAmbiguousDMY.proposal.rows[0].date === "2024-03-04",
  "Strong date variants use the same explicit slash-date policy");

const timezoneFree = "date,start_time,end_time,title,exercise_name,weight_kg,reps\n2024-05-06,08:30,09:30,Pull,Barbell bench press,80,8";
const localTime = await prepare(timezoneFree, { source: "generic" });
check(localTime.proposal.rows[0].date === "2024-05-06" && localTime.proposal.rows[0].created === "2024-05-06T09:30:00.000",
  "timezone-free wall time stays timezone-free and uses the source session date");
const monthNames = "date,session_id,exercise_name,weight_kg,reps\n12 março 2024,pt-1,Cadeira flexora,30,12";
const portugueseDate = await prepare(monthNames, { source: "generic" });
check(portugueseDate.proposal.rows[0].date === "2024-03-12", "Portuguese month names normalize without locale-dependent parsing");

const malformed = fixture("malformed.csv");
check(HistoryImport.parseSourceText(malformed, { source: "generic" }).issues[0].code === "unterminated-quote",
  "malformed CSV quoting rejects the whole file");
const empty = await prepare(fixture("empty.csv"), { source: "generic" });
check(empty.status === "empty" && empty.proposal === null, "empty exports create no proposal");
const tauriferCsv = "session,name,performed_name,exercise_id,is_hard_set\ns1,Press,Press,e1,1";
check(HistoryImport.parseSourceText(tauriferCsv, { source: "generic" }).issues[0].code === "taurifer-log-export-use-json-backup",
  "the lossy Taurifer analysis CSV directs users to the full JSON backup");
check(HistoryImport.parseSourceText("date,date,exercise_name,reps", { source: "generic" }).issues[0].code === "duplicate-header-field",
  "duplicate field headers reject the file");
check(HistoryImport.parseSourceText("date,exercise_name,reps,unmapped", { source: "generic" }).issues[0].code === "unsupported-columns",
  "unknown columns fail closed until a schema version is reviewed");
check(HistoryImport.parseSourceText("date,exercise_name,reps,weight[kg]", { source: "generic" }).issues[0].code === "unsupported-columns",
  "punctuation variants outside the bounded header aliases fail closed");
check(HistoryImport.parseSourceText("date,exercise_name,reps,notes\n2024-01-01," + "x".repeat(HistoryImport.LIMITS.maxCellChars + 1) + ",1,a", { source: "generic" }).issues[0].code === "cell-too-large",
  "oversized cells reject rather than truncate");
check(HistoryImport.parseSourceText("x".repeat(HistoryImport.LIMITS.maxBytes + 1), { source: "generic" }).issues[0].code === "file-too-large",
  "oversized exports reject before CSV parsing");
const overflowRows = `date,session_id,title,exercise_name,set,weight_kg,reps\n${Array(HistoryImport.LIMITS.maxRows + 1).fill("2024-05-06,s-1,Push,Barbell bench press,1,80,8").join("\n")}`;
check(HistoryImport.parseSourceText(overflowRows, { source: "generic" }).issues[0].code === "too-many-rows",
  "row limits reject the file while parsing instead of retaining an oversized table");
const partialRows = "date,session_id,title,exercise_name,set,weight_kg,reps\n2024-06-01,p-1,Push,Barbell bench press,1,80,8\n2024-06-01,p-1,Push,Barbell bench press,2,82,6,extra";
const partial = await prepare(partialRows, { source: "generic" });
check(partial.status === "ready" && partial.proposal.rows.length === 1 && partial.proposal.rows[0].historyImport.sessionStatus === "partial",
  "a malformed row is reported while supported rows remain explicitly partial");
check(partial.warnings.some(item => item.code === "column-count"), "partial failure diagnostics include source row errors");

const duplicateConflict = "date,session_id,title,exercise_name,set,weight_kg,reps\n2024-06-01,c-1,Push,Barbell bench press,1,80,8\n2024-06-01,c-1,Push,Barbell bench press,1,82,8";
const conflict = await prepare(duplicateConflict, { source: "generic" });
check(conflict.status === "needs-review" && conflict.blockers.some(item => item.code === "session-source-conflict"),
  "conflicting rows with a reliable repeated set key block that source session");

const repeatedSet = "date,title,exercise_name,set,weight_kg,reps\n2024-06-01,Push,Barbell bench press,1,80,8\n2024-06-01,Push,Barbell bench press,1,82,8";
const repeatedReview = await prepare(repeatedSet, { source: "generic" });
check(repeatedReview.status === "needs-review" && repeatedReview.blockers.some(item => item.code === "session-identity-ambiguous"),
  "repeated set keys without a reliable session id remain ambiguous");
const keptTogether = await prepare(repeatedSet, {
  source: "generic",
  sessionDecisions: { [repeatedReview.sessions[0].decisionKey]: { kind: "keep-together" } },
});
check(keptTogether.status === "ready" && keptTogether.proposal.rows.length === 2,
  "an explicit keep-together decision preserves two repeated sets");
const splitAssignments = Object.fromEntries(repeatedReview.sessions[0].rows.map((row, index) => [row.sourceRowKey, `part-${index}`]));
const split = await prepare(repeatedSet, {
  source: "generic",
  sessionDecisions: { [repeatedReview.sessions[0].decisionKey]: { kind: "split", assignments: splitAssignments } },
});
check(split.status === "ready" && split.proposal.sessions.length === 2 && split.proposal.sessions[0].session !== split.proposal.sessions[1].session,
  "explicit splitting yields stable distinct source sessions");
const repeatedIdentical = repeatedSet.replace(",82,8", ",80,8");
const identicalReview = await prepare(repeatedIdentical, { source: "generic" });
const identicalAssignments = Object.fromEntries(identicalReview.sessions[0].rows.map((row, index) => [row.sourceRowKey, `same-part-${index}`]));
const identicalSplit = await prepare(repeatedIdentical, {
  source: "generic",
  sessionDecisions: { [identicalReview.sessions[0].decisionKey]: { kind: "split", assignments: identicalAssignments } },
});
check(identicalSplit.status === "ready" && identicalSplit.proposal.sessions.length === 2,
  "an explicit split keeps identical-looking source rows in separate sessions");

const repeatedUnindexedSets = "date,title,exercise_name,weight_kg,reps\n2024-06-01,Push,Barbell bench press,80,8\n2024-06-01,Push,Barbell bench press,80,8";
const repeatedUnindexedReady = await prepare(repeatedUnindexedSets, { source: "generic" });
check(repeatedUnindexedReady.status === "ready" && repeatedUnindexedReady.proposal.rows.length === 2,
  "identical unindexed sets stay separate when there is no visible repeated exercise block");

const repeatedExerciseBlocks = "date,title,exercise_name,weight_kg,reps\n2024-06-01,Push,Barbell bench press,80,8\n2024-06-01,Push,Seated Cable Row,45,10\n2024-06-01,Push,Barbell bench press,82,6\n2024-06-01,Push,Seated Cable Row,50,8";
const repeatedBlockReview = await prepare(repeatedExerciseBlocks, { source: "generic" });
check(repeatedBlockReview.status === "needs-review" && repeatedBlockReview.blockers.some(item => item.code === "session-identity-ambiguous"),
  "a visibly repeated exercise block without session or set ids requires reconciliation");
const repeatedBlockKey = repeatedBlockReview.sessions[0].decisionKey;
const repeatedBlockRows = repeatedBlockReview.sessions[0].rows;
const repeatedBlockSplit = await prepare(repeatedExerciseBlocks, {
  source: "generic",
  sessionDecisions: {
    [repeatedBlockKey]: {
      kind: "split",
      assignments: Object.fromEntries(repeatedBlockRows.map((row, index) => [row.sourceRowKey, index < 2 ? "first" : "second"])),
    },
  },
});
check(repeatedBlockSplit.status === "ready" && repeatedBlockSplit.proposal.sessions.length === 2 &&
  repeatedBlockSplit.proposal.rows.every(row => row.set === 1),
  "splitting a repeated unindexed block starts set numbering for each session");

const indexedReversed = "date,session_id,title,exercise_name,set,weight_kg,reps\n2024-06-05,order-1,Push,Barbell bench press,2,82,6\n2024-06-05,order-1,Push,Barbell bench press,1,80,8";
const indexedReady = await prepare(indexedReversed, { source: "generic" });
check(indexedReady.status === "ready" && indexedReady.proposal.rows.map(row => row.set).join(",") === "1,2",
  "explicit set indices determine proposal order even when CSV rows are reversed");
const indexedReimport = await prepare(indexedReversed.split("\n").slice(0, 1).concat(indexedReversed.split("\n").slice(1).reverse()).join("\n"), {
  source: "generic",
  existingLog: indexedReady.proposal.rows,
});
check(indexedReimport.status === "no-new-sessions" && indexedReimport.skippedDuplicateSessions === 1,
  "reordered indexed sets keep a deterministic source fingerprint on retry");

const conflictingLabels = "date,session_id,title,exercise_name,exercise_id,set,weight_kg,reps\n2024-06-02,v-1,Push,Barbell bench press,reused-id,1,80,8\n2024-06-02,v-1,Push,Hammer Strength Chest Press,reused-id,2,80,8";
const labelConflict = await prepare(conflictingLabels, { source: "generic" });
check(labelConflict.status === "needs-review", "different source-name classifications do not silently share an imported identity");
const conflictNames = labelConflict.sessions[0].rows;
check(conflictNames.some(row => row.identity.status === "unresolved" && row.identity.reason === "source-label-variants-unresolved"),
  "a confident label cannot override a probable machine variant under one source exercise id");
const separateMachines = "date,title,exercise_name,set,weight_kg,reps\n2024-06-02,Push,Hammer Strength Iso-Lateral Chest Press,1,80,8\n2024-06-02,Push,Life Fitness Plate Loaded Chest Press,1,80,8";
const machineReview = await prepare(separateMachines, { source: "generic" });
const machineDecisions = Object.fromEntries(machineReview.sessions[0].rows.map(row => [row.sourceMovementId, { kind: "keep-source" }]));
const separateMachineReady = await prepare(separateMachines, { source: "generic", decisions: machineDecisions });
check(separateMachineReady.status === "ready" &&
  separateMachineReady.proposal.rows[0].performedMovementId !== separateMachineReady.proposal.rows[1].performedMovementId,
  "different machine-specific labels keep distinct source-scoped movement identities");

const retryCsv = "date,session_id,title,exercise_name,set,weight_kg,reps\n2024-06-03,retry-1,Push,Barbell bench press,1,80,8";
const firstImport = await prepare(retryCsv, { source: "generic" });
const retryImport = await prepare(retryCsv, { source: "generic", existingLog: firstImport.proposal.rows });
check(retryImport.status === "no-new-sessions" && retryImport.skippedDuplicateSessions === 1,
  "repeated identical imports deterministically skip the previously proposed session");
const duplicateRowExport = `${retryCsv}\n${retryCsv.split("\n")[1]}`;
const duplicateRowRetry = await prepare(duplicateRowExport, { source: "generic", existingLog: firstImport.proposal.rows });
check(duplicateRowRetry.status === "no-new-sessions" && duplicateRowRetry.skippedDuplicateSessions === 1,
  "an extra identical row under a reliable session id does not change the source fingerprint");
const legacyHistoryRow = { ...firstImport.proposal.rows[0] };
delete legacyHistoryRow.historyImport;
const legacyDuplicate = await prepare(retryCsv, { source: "generic", existingLog: [legacyHistoryRow] });
check(legacyDuplicate.status === "needs-review" && legacyDuplicate.blockers.some(item => item.code === "possible-duplicate-session"),
  "matching legacy History rows remain explicit duplicate candidates without importer provenance");
const changedCsv = retryCsv.replace(",80,8", ",82,8");
const changedReview = await prepare(changedCsv, { source: "generic", existingLog: firstImport.proposal.rows });
check(changedReview.status === "needs-review" && changedReview.blockers.some(item => item.code === "source-session-changed"),
  "changed exports under a known session key never overwrite earlier history");
const changedKey = changedReview.sessions[0].decisionKey;
const changedSeparate = await prepare(changedCsv, {
  source: "generic",
  existingLog: firstImport.proposal.rows,
  sessionDecisions: { [changedKey]: { kind: "keep-separate" } },
});
check(changedSeparate.status === "ready" && changedSeparate.proposal.rows[0].session !== firstImport.proposal.rows[0].session,
  "an explicit keep-separate choice produces a content-specific session id");

const strongOne = "Date,Workout #,Workout Name,Exercise Name,Set Order,Weight (kg),Reps,RPE\n2024-06-04,st-1,Push,Barbell bench press,1,80,8,8";
const genericSame = "date,session_id,title,exercise_name,set,weight_kg,reps,rir\n2024-06-04,g-2,Push,Barbell bench press,1,80,8,2";
const crossSourceBase = await prepare(strongOne);
const crossSourceReview = await prepare(genericSame, { source: "generic", existingLog: crossSourceBase.proposal.rows });
check(crossSourceReview.status === "needs-review" && crossSourceReview.blockers.some(item => item.code === "possible-duplicate-session"),
  "matching semantic history from another source requires a human duplicate decision");

const parsedForDetach = HistoryImport.parseSourceText(retryCsv, { source: "generic" });
const normalizedForDetach = await HistoryImport.normalizeSourceRecords(parsedForDetach);
const reconciledForDetach = await HistoryImport.reconcileCandidates(normalizedForDetach, { classifyExercise: classify, getExercise });
const detached = await HistoryImport.buildImportProposal(reconciledForDetach);
const frozenName = detached.proposal.rows[0].name;
reconciledForDetach.sessions[0].rows[0].name = "mutated after proposal";
check(detached.proposal.rows[0].name === frozenName, "proposal rows are detached from mutable candidate records");

console.log(`history import unit: ${passed} checks passed`);
