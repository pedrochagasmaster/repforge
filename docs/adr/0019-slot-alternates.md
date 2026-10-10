# ADR 0019: Slot alternates are an additive field of the canonical program

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decision owner:** Product owner, #317 option A (after option B shipped in #312)

## Context

Before #312 the program editor offered an Alternates control that stored a list
of names the canonical `ProgramDefinition` had no field for, and the mid-workout
swap picker never read it. Option B removed the control. Option A brings the
capability back only if it does something: a slot keeps an ordered list of
alternate movements, the lifter edits it in the program editor, and the swap
picker lists those alternates first.

## Decision

A slot may carry `alternates: [exerciseId, …]`, an ordered list of identities.
`program-compiler.js` `validateProgramDefinition` owns its rules: each entry is
a current catalog UUID or a custom movement the program carries, none repeats,
none is the slot's own exercise, and there are at most `MAX_SLOT_ALTERNATES`
(5). Names are never stored; a retired or unknown identity is refused, not
fuzzy-matched. `canonicalizeProgramDefinition` drops an empty list, so "no
field" and `[]` are one definition.

The field is additive and does not bump `PROGRAM_SCHEMA_VERSION`. Released
validators reject unknown slot keys, so a definition that uses alternates is
unreadable to an older release either way. A schema bump would also make every
definition without alternates unreadable to those releases and would move every
install-transfer and setup-link digest that pins a v2 definition. Keeping v2
leaves programs without alternates byte-identical.

A custom movement named only as an alternate is part of the program: export,
setup links, the install transfer and import carry its definition, and deleting
it archives it, as for a custom movement in a slot.

Setup links need no codec change. A generated program with alternates no longer
matches its regeneration from request and seed, so it travels in the full form;
an edited generated program that does not fit is still refused whole.

Swapping to an alternate is an ordinary substitution through
`substitutionProgram()`: shared metrics carry targets, an unconfigured custom
movement records what the slot records (#322), and a pending set holding typed
values blocks the swap rather than discarding them.

## Consequences and evidence

The editor intent `slot_alternates` carries the whole list before and after, so
a second tab's change rebases or conflicts like any other editor intent.
Replacing a slot's movement keeps its alternates, less the new movement itself.
A block-review regeneration (fewer days, shorter sessions) carries a surviving
slot's alternates to the successor slot holding the same movement, whether or
not its prescription edits could be identified; they are not reported as edits.
Repeat, reduce-volume and recovery-week copy the definition and keep them.

Proofs: `test/program-compiler-plan067.mjs` (validation and normalization),
`test/slot-alternates.mjs` (editor → reload → swap picker → protected values →
History, and archive-not-delete), `test/share-program-browser.mjs` (link and
file round trips with a custom alternate), `test/shared-setup-unit.mjs` (full
form), `test/install-transfer-plan067-contract.mjs` (clone round trip), and
`test/program-transition-plan067.mjs` (alternates across regeneration).
