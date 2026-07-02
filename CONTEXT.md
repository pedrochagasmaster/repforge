# RepForge

RepForge is a local-only progressive-overload tracker. Training data lives on the device; the app helps lifters log sets, follow a program template, and see whether they are progressing.

## Language

**Program**:
The active training split — metadata (name, start date) plus the exercise templates that define each training day.
_Avoid_: Template (when meaning the whole program), split (in user-facing copy unless the lifter uses that word), routine, plan

**Exercise template**:
One movement slot in the program: day, order, sets, rep range, muscles, notes, and alternates.
_Avoid_: Exercise (when meaning the template rather than a logged performance), lift (ambiguous with a logged set)

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

**Training day**:
A labeled group within the program (e.g. Day 1) whose exercises appear together on the Log tab.
_Avoid_: Session (a session is an instance; a training day is the template grouping)
