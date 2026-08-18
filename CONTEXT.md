# Taurifer

Taurifer (formerly RepForge; internal storage keys and globals keep the `repforge` codename) is a local-first progressive-overload tracker. Workout logs, drafts, and history stay on the device; setup links intentionally share a program and selected settings. The app helps lifters log sets, follow a program template, and see whether they are progressing.

## Language

**Program**:
The active training split — metadata (name, start date) plus the exercise templates that define each training day.
_Avoid_: Template (when meaning the whole program), split (in user-facing copy unless the lifter uses that word), routine, plan

**Exercise template**:
One movement slot in the program: day, order, sets, rep range, muscles, notes, and alternates.
_Avoid_: Exercise (when meaning the template rather than a logged performance), lift (ambiguous with a logged set)

**Exercise library**:
The catalogue of movements the lifter chooses from — name in both languages, equipment, muscles, and the movement patterns the generator selects by. Ships with the app (`exercises.js`, generated); the lifter's own additions live beside it as custom exercises. Choosing from it copies name, muscles and notes onto the exercise template and records the library id as provenance, so a slot stays fully editable and never depends on the library to be read.
_Avoid_: Exercise database, catalog (the internal name for its predecessor), movement bank

**Custom exercise**:
A movement the lifter authored because the library lacked it. Stored with their data, offered in every picker beside the built-ins, reusable across programs, and carried inside a program export that references it. Needs a name, equipment and a primary muscle. Archived rather than deleted once anything points at it.
_Avoid_: Custom movement, user exercise, my exercise

**Display alias**:
A slot's local label for a linked movement — the name on the machine in this gym. Changes what the slot reads, never what it is; the library id and its muscles stay canonical. Changing the movement itself means detaching the slot.
_Avoid_: Rename, custom name, override (unqualified)

**Performed snapshot**:
What a logged set actually trained, when that differs from its template: the performed movement's library id, name and muscles, stored on the row. Volume and history read it in preference to the template, so a mid-session swap is credited to the movement that was done. Rows written before it exists keep using their template values.
_Avoid_: Substitution record, override, actual exercise

**Import review**:
The screen between reading a program file and writing it. Every imported name is classified — matched, the same movement in the other language, likely, or unknown — and a likely match must be decided before the import can commit. Nothing durable changes until then.
_Avoid_: Import preview (that is the backup-import summary), reconciliation wizard

**Program metadata**:
Identity and lifecycle fields for the active program — name, start date, created/updated timestamps — separate from individual exercise templates.
_Avoid_: Program settings, program config

**Program progress**:
Derived signals about how the lifter is running the program — adherence to the split, week number since start — computed from the log, not entered manually.
_Avoid_: Progress bar (generic), completion percentage, XP

**Program status**:
A plain-language summary of program health (e.g. On track, Partial week, Rebuilding) derived from adherence and progression signals — not a gamified score.
_Avoid_: Score, rating, grade, level, streak

**Session**:
All log rows saved together in one workout, sharing a session id, date, and training day.
_Avoid_: Workout (acceptable in casual copy; session is the domain term)

**Log row**:
One recorded set — load, reps, RIR — linked to an exercise template via exercise id.
_Avoid_: Set entry, record

**Capacity**:
What a set demonstrated the lifter could have done: performed reps plus trusted reps in reserve (RIR credited at most up to the hard-set ceiling, `hardRir`). Expressed as capacity reps at a load, or normalized across loads as capacity-e1RM via Epley. The deterministic engine's single currency (ADR 0003) — a measurement, never a judgment of how close to failure the lifter chooses to train.
_Avoid_: Potential, true max, e1RM (that is the RIR-blind variant), theoretical reps

**Capacity baseline**:
A lift's recent typical capacity-e1RM (median over its last few sessions), used to read today's performance as fresh or run-down. A reference for detecting off-days — never a target the lifter is steered toward.
_Avoid_: Target, goal, expected performance

**Session freshness**:
The weak, temper-only cross-exercise signal: how the lifts already completed in the current session are running against their capacity baselines, weighted by muscle overlap with a systemic floor. It can only lower a not-yet-started exercise's first-set suggestion, never raise it, and it goes silent once that lift has its own sets logged today.
_Avoid_: Readiness score, fatigue score, CNS fatigue

**Exercise session note**:
A free-text note attached to one exercise within one session — machine settings, seat height, grip. Stored on that session's log rows and carried forward as the default for the next session of that lift.
_Avoid_: Setup notes (that is the program template field), comment, log note (the session-wide note field)

**Exercise page**:
A per-lift view — recommendation, summary metrics, top-load chart, PRs, and session history with notes — reached by tapping an exercise name on the Log tab. Not a bottom-nav section.
_Avoid_: Exercise detail modal, lift profile, deep dive (that is the Stats disclosure)

**Training day**:
A labeled group within the program (e.g. Day 1) whose exercises appear together on the Log tab.
_Avoid_: Session (a session is an instance; a training day is the template grouping)

**Mesocycle**:
A finite run of a program — typically four to eight weeks — with a start date, target length, and a review at the end.
_Avoid_: Block (unless the lifter uses that word), training phase, macro cycle

**Block review**:
A summary generated at the end of a mesocycle from adherence, progression, hard-set volume, PRs, and fatigue signals.
_Avoid_: Report card, grade, score

**Generated program**:
A program created from onboarding answers; the user can edit it before saving.
_Avoid_: Auto-plan, AI workout, recommended routine

**Coach**:
The opt-in, bring-your-own-key LLM chat surface (plan 038, ADR 0002). Grounded in coach context; may emit coach proposals. Distinct from the deterministic signals (recommendations, program status), which exist without it.
_Avoid_: AI assistant, chatbot, trainer

**Coach context**:
The scoped, deterministic payload sent with a coach request — program, derived signals, and a bounded window of log data chosen per entry point. Bodyweight is excluded unless the lifter opts in; the payload is inspectable in the coach sheet.
_Avoid_: Prompt (the persona/system text), data dump

**Coach proposal**:
A structured, validated program change emitted by the coach and applied only by an explicit user tap. Proposals target the program (templates and metadata), never the log.
_Avoid_: Auto-adjustment, AI edit, recommendation (reserved for the deterministic engine)

**Session summary**:
The full-screen close of a finished session, opened by Finish workout. Reads back what the session did — sets, load moved, lifts, any personal records, how the lifts moved, hard sets per muscle, where the week now stands — and returns to Today when dismissed. Every figure is one an existing surface already computes, so it can never disagree with History or Progress. Deterministic and offline; unrelated to the coach.
_Avoid_: Score, rating, streak, badge, points, celebration screen

**Session review**:
A coach conversation seeded with the just-saved session and its previous comparable session, offered (never auto-opened) after Save workout. Distinct from the session summary, which is deterministic and always shown.
_Avoid_: Workout grade, post-workout report
