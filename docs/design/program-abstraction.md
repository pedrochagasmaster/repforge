# Program abstraction — design note

> **Status**: Accepted (Phase 0 + Phase 1 implementation).
> **Related**: [`CONTEXT.md`](../../CONTEXT.md), ADR [`0001-program-metadata-sibling-key.md`](../adr/0001-program-metadata-sibling-key.md), plan 024 mesocycle blocks (orthogonal).

## Problem

The Program tab edits exercise templates but the split has no identity: no name, no start date, no at-a-glance status. Users cannot answer *what program am I running?*, *when did I start?*, or *am I sticking to the split?*

## Decision summary

| Topic | Choice |
|-------|--------|
| Multi-program library | Deferred (Phase 3 backlog) |
| Metadata placement | Sibling `state.programMeta` |
| Exercise storage | Unchanged `state.program: Exercise[]` |
| Primary progress metric | **Adherence** — unique program days logged in last 7 days |
| Secondary progress metric | **Week** — floor days since `started` ÷ 7 + 1 |
| Status label | Plain language from adherence + progression health |
| Export | v2 `{ version: 2, meta, exercises }`; array-only import forever |
| Default name | Blank → UI shows "Untitled program" |
| Default `started` on migration | Earliest log date, or `null` if no log |

## Progress and score signals

All signals are **computed at render time**, never stored as points or streaks.

### Adherence (primary)

```
daysLogged = unique training-day labels with ≥1 session in [today-6, today]
adherence = daysLogged / prog.days().length
display = "{daysLogged} / {totalDays} days this week"
```

Only days that exist in the current program template count toward the denominator.

### Week (secondary)

When `programMeta.started` is set:

```
week = floor((today - started) / 7 days) + 1
display = "Week {week}"
```

### Progression health (Phase 2)

For each exercise template with log history, reuse `recommendation().status`. Count share where status is `add` or `add2`:

```
hot = exercises with status add | add2
health = hot / exercisesWithHistory
```

Exercises with no history are excluded from the denominator.

### Volume compliance (Phase 2, secondary display)

Compare planned weekly hard sets per muscle (`prog.volume()`) vs completed hard sets in the last 7 days (`renderCompleted` logic). Show as a compact ratio or mini-bar on the Program tab — overlaps Stats but gives template-context feedback.

### Program status label

Plain-language mapping (not 0–100):

| Condition | Label |
|-----------|-------|
| adherence ≥ 1 (all days hit this week) and health ≥ 0.4 | **On track** |
| adherence ≥ 0.5 | **Partial week** |
| else | **Rebuilding** |

When no log history exists, show **Getting started** instead of Rebuilding.

## UI — Program tab header

Summary card above the day/exercise editor:

- Editable program name
- Editable start date
- Read-only chips: week (if started), adherence, status label
- Phase 2: progression health chip, volume compliance hint

## Explicit rejections

- Multi-program library / template switcher (Phase 3)
- Immutable program version snapshots
- Gamified numeric scores, streaks, badges, levels
- Sixth nav tab
- Storing progress as persisted state

## Relationship to mesocycle blocks (plan 024)

- `programMeta.started` = program lifecycle clock
- Log row `block` = training phase tag on sessions
- Layers are orthogonal; Phase 1 does not depend on plan 024

## Migration

On load, if `programMeta` is absent:

```javascript
{
  id: uid(),
  name: "",
  started: earliestLogDate || null,
  created: now,
  updated: now
}
```

Persisted on next save. Full backups include `programMeta` optionally.
