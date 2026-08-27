# Taurifer program-family design

Status: proposed Wave 1 contract for owner review. Nothing in this document is a production prescription or a public catalogue entry.

This reference defines the original Taurifer family system that later compiler work must implement. [Plan 047](../plans/047-taurifer-program-families-compiler.md) governs scope and release gates. [Plan 046](../plans/046-multi-strategy-progression-engine.md) governs progression behavior.

## Current generator audit

The current generator lives in `app.js`. It has no family, blueprint, slot, time-model, allocation-rule, or provenance contract.

| Current component | Current behavior | Replacement constraint |
|---|---|---|
| `DAY_TYPES` and `resolveSplit` | Repeats generic day-type arrays across two through six days. | Each 3-day and 5-day family needs its own authored weekly structure. The 2-day, 4-day, and 6-day paths need reviewed recipes. |
| `SESSION_BOUNDS` and `applySessionLength` | Treat session length as an exercise-count range. | The time model must include working sets, preferred rest, warm-ups, station changes, equipment friction, and a buffer. |
| `repScheme` | Selects sets and a rep range from the old experience and goal values. | Versioned allocation may use only structured-program maturity, weekly frequency, and session minutes. |
| `applyPriorityMuscles` | Adds a set to matching exercises and may add an exercise. | A priority must redistribute a bounded program budget. It cannot create an independent volume budget. |
| `catalogForSlot` and `chooseExercise` | Filters by pattern and equipment, then rotates candidates by repeated day-type occurrence. | Selection must use structured capabilities and stable ranking. It must preserve the selected exercise's `libraryId` provenance. |
| `Program.days()` and `Program.addDay()` | Infer days from exercise strings. Adding a day creates a placeholder exercise. | A compiled program needs stable day and slot IDs. Production work must wait for the explicit day model in Plan 047 Slice 2. |
| `programMeta` | Stores generator answers but discards unknown family/compiler provenance. | Activated instances must pin family, blueprint, compiler, rule, catalogue, and context-schema versions. |

The audit rejects parity with the current generator as a design goal. The old generator proves that Taurifer covers two through six training days. It does not define the new program science.

## Source and originality ledger

The ledger classifies each source before a blueprint uses it. Broad concepts and research findings can constrain Taurifer's choices. Neither category supplies a program table to copy.

| Source | Source class | Permitted use | Prohibited use | Taurifer result |
|---|---|---|---|---|
| Supplied copyrighted "Powerbuilding System" PDFs described in Plan 047 | Copyrighted structural reference. The files are not in this repository or workspace. | Broad concepts only: primary and assistance roles, an anchor with back-off work, distinct heavy and volume exposures, effort targets, practical rest/time constraints, and assistance around strength-priority work. | Names, prose, tables, exact schedule, exercise order, prescriptions, percentages, alternating weeks, or scheduled deloads. | No blueprint may be derived row by row. Fixed weekly structures and evidence-triggered deload policy override the references. |
| [ACSM progression models position stand](https://doi.org/10.1249/MSS.0b013e3181915670) | Published position stand. | General support for progressive resistance training, load/repetition ranges, exercise order, rest, and frequency as programming variables. | Treating broad recommendations as proof of one exact Taurifer slot table or threshold. | Families declare roles and progression needs. Plan 046 owns the executable method. |
| [Weekly-set dose-response meta-analysis](https://doi.org/10.1080/02640414.2016.1210197) | Published systematic review and meta-analysis. | General support for treating weekly volume as a meaningful variable. | Inferring a person's volume tolerance or copying study-group doses into a product rule. | The proposed allocation table uses conservative maturity/frequency/time bands and remains owner-gated. |
| [Resistance-training frequency meta-analysis](https://doi.org/10.1519/JSC.0000000000002855) | Published systematic review and meta-analysis. | General support for separating frequency from weekly volume and reviewing how work is distributed. | Claiming that one split or one frequency is universally superior. | Sibling blueprints distribute a family's promise differently at 3 and 5 days. Recipes cover 2, 4, and 6 days without mechanical stretching. |
| [Rest-interval systematic review](https://doi.org/10.1080/17461391.2017.1340524) | Published systematic review. | General support for modeling rest as a real time cost and prescription input. | Deriving a universal optimal rest time or ignoring exercise role and user preference. | Preferred rest feeds the time estimate within role-specific bounds. |
| [Business/product thesis](business-product-thesis.md) and [decision register](product-grilling-decision-register.md) | Taurifer product decisions. | Family set, authorship boundary, frequency coverage, Home, Foundation, re-entry, ownership, and no-volume-tolerance rules. | Reopening settled product branches inside implementation. | These decisions define the product contract in this document and the fixtures. |
| Plan 047 design work and fixtures | Original Taurifer design. | Create internal IDs, structures, slot roles, allocation proposals, time constants, profiles, and recipes. | Presenting proposed numeric choices as validated science or approved public copy. | Every proposed number and public name stays marked for owner review until approved. |

### Copyright checks

A proposed blueprint fails review if any of these statements is true:

- Its day and slot sequence can be mapped row for row to a named external program.
- It copies or closely paraphrases external names, descriptions, cues, or table labels.
- It copies exact set, repetition, load, percentage, or week-by-week prescriptions.
- It uses alternating exercise weeks or a scheduled deload from a reference.
- Its originality argument depends only on renamed exercises or reordered rows.

The repository must not contain the supplied PDFs. Review this boundary again before a fixture changes and before a blueprint becomes executable.

## Version and approval state

Stable internal family IDs are `growth`, `balanced`, `strength`, and `home`. Public names remain proposals and do not control those IDs.

Wave 1 may reference the proposed Plan 046 IDs `range@1`, `rep_goal@1`, `anchor_backoff@1`, `manual@1`, and `paired_exposure@1`. Plan 046 PR #193 has not yet published a stable strategy fixture. The production compiler must not use these references until Plan 046 merges a compatible contract to `main`.

The owner must approve these items before production compiler work uses them:

- the public English and PT-BR names and copy;
- every day and slot table;
- allocation and time-model constants;
- Foundation and re-entry parameters;
- every non-range strategy, relation, and modifier numeric fixture.
