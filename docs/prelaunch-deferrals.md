# Pre-launch remediation deferrals

The pre-launch remediation cycle landed in PR #114, which consolidated PR #108
(validated UI/UX audit fixes, `docs/ui-ux-audit-2026-08-13-fix-prompt.md`) and
PR #110 (Plan 041, `plans/041-prelaunch-all-findings-remediation.md`). This
document is the single ledger of everything that cycle deliberately deferred,
so nothing silently falls off the backlog. Each item names its source.

## Product and design decisions still owed

These were excluded from the remediation pass because they need a product or
design decision first, not because they are hard to build.

- **F3 — pound display and actionable increment policy** (audit brief,
  explicitly DEFERRED). In lb mode the app shows unloadable values such as
  `115.74 lb` and deltas like `+5.51`. A stored historical value and an
  editable recommendation are different contracts: rounding both to 5 lb would
  falsify history, rounding only the cue would disagree with the prefilled
  input. `minJump` is kilogram-based even in lb mode. Any fix must cover
  history display, recommendation cues, and the entry pipeline together.
  Includes the `kfmt` unit-separator issue (`231klb`).
- **F12 — early workout finish** (audit brief, out of scope). No dedicated
  flow for truthfully ending a session before all planned sets are done.
- **F14 — landscape orientation** (audit brief, out of scope). Layout is
  designed portrait-first; landscape has no dedicated treatment.
- **F17–F30 and P3 audit items except C1** (audit brief, out of scope). Lower
  priority findings from `docs/ui-ux-audit-2026-08-13.md`; none were validated
  or implemented in this cycle. F13 and F16 were rejected outright, not
  deferred.
- **12/26/52-week chart range selection and clickable PR record details**
  (Plan 041, out of scope). UX-12 was fixed pre-launch by removing the false
  affordances; building the real features remains an open product option.
- **Global Progress period control** (Plan 041, out of scope). UX-13 was fixed
  by removing the duplicate global-looking `#statsPeriod`; `#volWindow` remains
  the only, explicitly scoped 7/28-day control. Making the period genuinely
  global is a product decision.
- **General factory reset** (Plan 041, out of scope). UX-15 was fixed by
  renaming the existing action to the truthful "Delete workout history"
  (log + draft only). A full factory reset does not exist.
- **Focus deck / Program editor / Block review redesigns** (audit brief, out
  of scope). Only behavioral fixes were made; no visual redesign.

## Consolidation trade-offs from PR #114

Decisions made while merging the two remediation branches; revisit only if the
product wants the other behavior.

- **Compact-dialog backdrop dismissal (F11 vs UX-07)**. PR 108 wanted
  `#endBlockConfirm` and `#importChoice` dimmed by a shared scrim and closable
  by backdrop tap. Plan 041's modal policy table — the one that shipped — says
  Escape cancels and outside click does nothing. If backdrop dismissal is ever
  wanted, it belongs in the shared `openModal` policy table, not a parallel
  system.
- **Opener-fallback focus restoration**. PR 108's modal controller re-resolved
  a hidden or re-rendered opener to a visible stand-in (same id, same note
  control, or a caller fallback) before restoring focus. The consolidated
  `closeModal` restores focus only to the recorded, still-focusable return
  target. Porting a narrow id-requery into `resolveReturnFocus` is a small
  future enhancement if focus loss after re-render proves annoying.
- **History performance at multi-year scale** (audit brief, out of scope
  there). Largely addressed by Plan 041's PERF-01 linear History index (tested
  at 5,000 sessions / 20,000 rows); anything beyond that scale — e.g.
  virtualized rendering — remains future work.

## Outstanding release evidence (Plan 041)

Plan 041 is implemented but **not marked DONE** in `plans/README.md` because
its manual matrix is incomplete:

- **Physical-device cells C2/C3/C5/C6** — iOS Safari with real pinch and
  VoiceOver (C2/C5) and Android Chrome with real pinch and TalkBack (C3/C6),
  in EN/kg and PT/lb pairings. They require a branch-addressable **HTTPS
  release-candidate origin** (`REPFORGE_RC_ORIGIN`) serving byte-identical
  shell assets for the exact commit, verified with the shell-asset hash
  command in Plan 041. Production URLs, another commit's preview, or phone
  loopback are explicitly not acceptable. Desktop cells C1/C4 can run on
  loopback and are covered by the automated gates.
- The per-cell evidence ledger
  (`/opt/cursor/artifacts/repforge_prelaunch_matrix.md` template in Plan 041),
  one iOS/VoiceOver video, one Android/TalkBack video, and one final-state
  screenshot per cell are still owed before Plan 041 can be marked DONE.

## Post-launch engineering follow-ups (PR #110)

Named by PR #110's code-quality audit as consolidation work, not release
blockers:

- **One draft-transaction result contract.** The transaction paths return a
  mix of result kinds/flags (`{revision, localOk, idbOk}`, `kind` variants,
  compensation markers). Consolidate behind a single result shape.
- **Extract the persistence protocol from `app.js`.** The revisioned
  dual-replica write path, WAL sidecars, Web-Lock rebasing, and recovery flow
  live inside `app.js`; they are cohesive enough to become a module boundary.
- **Centralize shared browser-harness helpers.** `waitForApp`, lock fixtures,
  and store-seeding helpers are duplicated across the focused suites; move
  them into `test/browser.mjs` or a sibling helper.
