# Native-fidelity audit — track C (today, workout/Focus, session)

**Re-checked 2026-10-24 against current main (5d2ca411), worktree `/tmp/taurifer-ui-kit`.** Since
the original pass: the wheel picker (#483, #503 physics), phase 3 navigation (#484), the fidelity
pass (#485: context menu material/icons/copy, dock ring removed, segmented control, steppers, day
picker check, sheet close disc + grabber, row-pressed wash), owner-bug fixes (#486/#488/#489),
onboarding inputs (#498/#500/#501), and phase 5 large text + the concentric shelf (#499). A
same-day commit (`51fbf65a`, "close semantic inventory and boot proof gaps") also turned
`--control-quiet-bg`/`--control-quiet-boundary` fully transparent, which quietly fixed most of
former Shared B below. Most catalog PNGs were recaptured; four new screens exist
(`today/ready-scrolled`, `today/dock-viewer`, `workout/wheel-load`, `workout/wheel-reps`) and are
covered at the end of Screens.

Out of scope per the recheck brief: the Today screen while a session is in progress and its mini
bar (#502), and the rest timer page and its floating element (rest-timer packet). Any finding
there is marked "covered by #502 / rest-timer packet" and not elaborated.

**Catalog data note (unchanged):** `workout/focus-per-side`, `workout/why-per-side`,
`workout/why-this-weight`, and `workout/why-in-session` still have byte-identical light/dark PNGs
(re-confirmed with `cmp`) — the dark variant is still the light file copied, not actually rendered
dark. Dark-theme fidelity for these four remains unverified by this audit.

**New screen `today/dock-viewer`:** only a `-light-en` canonical frame exists (no plain `-dark-en`).
This matches spec, not a gap — pr499 describes the canonical frame as "where a hold is only a
press" (i.e. a normal tap, no viewer shown); dark and 200% variants were captured only for the
`largeText` set (`dock-viewer__phone-390-dark-en-text200.png` etc., confirmed present).

## Shared components

### A. Buttons are rectangles, not pills — **open**
- Selectors: `.btn` (`styles.css:649`, `border-radius:var(--radius-control)`), `.btn--cta`,
  `.btn--save`, and every sheet/dialog action that inherits `.btn` or is styled to match it
  (`#sessionEarlyFinish`/`#draftRecoveryCopy`/`#draftRecoveryReload`/`#draftRecoveryRetry`:2514;
  `#historyDiscardDrop`/`#draftDiscardDrop`/`#sessionAbandon`/`#sessionAbandonConfirm`:2548;
  `#sessionEarlyConfirm`/`#exNoteSave`/`#historyDiscardKeep`/`#draftDiscardKeep`:2524;
  `#sessionEarlyCancel`/`#sessionAbandonCancel`/`#exNoteCancel`:2534; `#sumDone`:3585). All still
  `border-radius:var(--radius-control)` (8px).
- Kit: §3 Radii — "buttons are pills... a rectangular 8px or 12px button is off-kit."
- Fix: unchanged — apply `--radius-pill` to `.btn` and the id-selector groups above.
- Effort: M.
- Affects (2+): today/no-program, today/ready, today/ready-scrolled, today/rest-bar,
  today/day-picker, today/deload-week, today/draft-resume, today/skipped, workout/focus,
  workout/first-set-guide, workout/focus-utilities-guide, workout/focus-per-side,
  workout/deload-week, workout/stale-draft, workout/persist-retry, workout/invalid-draft,
  workout/rest-running, workout/rest-done, workout/exercise-note, workout/session,
  workout/early-finish, workout/abandon, workout/exercise-actions, workout/warmup-actions,
  workout/reorder, workout/correction, workout/logged-sets, workout/skipped-actions,
  workout/substituted-actions, workout/swap-alternates, workout/swap-reason, workout/actions
  (Cancel group only — the main group is already a glass sheet, see item fixed below),
  session/summary, session/summary-maintained, session/summary-declined, session/summary-first.
  today/done has no CTA to check.

### B. Icon-only header/utility buttons drawn as boxes — **fixed**
- Was: `#leaveWorkout, #sessionSheetBtn, #woOverflowBtn` (`styles.css:1146-1165`) and
  `.session-map__reorder-btn` (2467) carry `border:1px solid var(--control-quiet-boundary)` +
  `background:var(--control-quiet-bg)`.
- Now: `--control-quiet-bg` and `--control-quiet-boundary` both resolve to `transparent`
  (`styles.css:167,169`), so every control built on them — the Focus header's back chevron, table
  icon and `...` overflow, the session-map up/down reorder buttons, `#restSheetClose`/`#whyClose`,
  `#sumSee`, `.history .edrow__rm`, `.settings-btn`, `#history :is(#calPrev,#calNext,...)` — renders
  with no visible box at rest. Confirmed visually: `workout/focus`, `workout/wheel-load`,
  `workout/session`, `workout/early-finish`, `workout/abandon` all show plain back/table/overflow
  icons and plain reorder chevrons, no ring or fill. Hover/press still show `--well`/
  `--row-pressed-bg`, which is a background wash rather than the kit's literal "dim to 40%" — minor,
  not reflagging.
- Exception unaffected: `.wo-rest` (the idle/running timer pill, `styles.css:1125`) keeps its own
  `border:1px solid var(--control-secondary-boundary)` — the kit's named timer-pill exception, still
  correctly ringed in every Focus-header screenshot.
- Previously affected, now clean: every Focus-header screen in this set, plus
  `workout/session`'s reorder buttons specifically.

### C. Today prescription row numerals: wrong weight, target color partially fixed — **open (changed)**
- Selectors: `.rxrow__load` (`styles.css:7887`, `font-weight:var(--weight-medium)`, color
  `--color-ink`) and `.rxrow__target` (7891, `font-weight:var(--weight-regular)`, color
  `--color-ink`); `.rxrow__op,.rxrow__unit` (7894) now carry `--color-ink-secondary`.
- Kit: §8 "the load is Mono 22px regular in `--ink`; the target (`2 × 9`) is Mono 14px in
  `--ink-soft`."
- What changed: the target's font-size/weight already matched the kit (14px/regular) before and
  still does; the separator (`×`) is now `--color-ink-secondary`, which softens the row slightly,
  but the target's actual digits (`2`, `9`) are still full `--color-ink`, not `--ink-soft` as the
  kit specifies — and the load is still medium weight, not regular.
- Fix: `.rxrow__load{font-weight:var(--weight-regular)}`; `.rxrow__target{color:var(--color-ink-secondary)}`.
- Effort: S.
- Affects (2+): today/ready, today/ready-scrolled, today/rest-bar, today/day-picker (background
  table), today/deload-week, today/draft-resume, today/skipped.

### D. Leading icons in action-sheet rows (should be trailing) — **open**
- Selectors: `index.html:1099,1105,1106,1117` (`exActionRepeatBtn`, `exActionSubstBtn`,
  `exActionRestoreOrigBtn`, `exActionSkipBtn`) — each puts `<span class="icon-mask ...">` before
  `<span class="exactions__act-text">` in markup; `.exactions__act` (`styles.css:2582`) is a plain
  flex row with no `order` reversal, so the icon renders first exactly as before. Re-confirmed
  visually on `workout/exercise-actions` and `workout/warmup-actions`: history/reset/skip/document
  icons all sit left of their labels.
- Kit: §7 Placement — menu-row icons trail the label; these are generic actions, not identity rows.
- Fix: unchanged — move the icon span after the text span (swap the two `<span>`s in `index.html`
  for each of the four buttons), or reorder with flex `order`.
- Effort: S.
- Affects (2+): workout/exercise-actions, workout/warmup-actions, workout/skipped-actions,
  workout/substituted-actions.

### E. Floating popover combines a border AND a shadow — **open**
- Selector: `body.is-focus-wo #glossary` (`styles.css:3453`) — still
  `border-color:var(--boundary-floating)` together with `box-shadow:var(--elevation-floating-shadow)`.
  Visually confirmed on `workout/focus-glossary`: a clear 1px ring plus a soft drop shadow on the
  same card.
- Kit: §4 — "What the kit never draws: a border and a shadow on the same surface." §2's contract
  amendment: a floating layer's boundary should be the 0.5px `--bar-edge` hairline folded into the
  shadow (as `.native-context__menu` now does, see fixed item below), not a separate ring.
- Fix: unchanged — drop `border-color:var(--boundary-floating)`; fold `--bar-edge` into the
  `box-shadow` list instead.
- Effort: S.
- Affects: workout/focus-glossary (only screen in this set with the component).

### F. Day-picker selected row uses a left accent bar, not a trailing check — **fixed by #485**
- Was: `.daypick__row.is-selected{border-left-color:...}` with no check glyph.
- Now: `.daypick__row` (`styles.css:2340`) carries a `.daypick__check` element
  (`icon-mask--check`-equivalent, 22px, `--color-ink`) that springs in (`opacity`/`scale` transition)
  on `.is-selected` (2353-2354), and the row number goes full ink. Confirmed visually on
  `today/day-picker`: row 1 shows a trailing check mark, no colored left rule is visible.
- Affects: today/day-picker — clean now.

### G. Focus meta line renders a degenerate RIR range ("RIR 1–1") instead of one number — **new**
- Selectors/logic: `app.js:8382-8383` (`focusExMeta`, the `facts` branch used for adaptive/manual
  canonical slots) always calls `t("focus.exmeta.range",{...rmin:fmt(facts.rirMin),rmax:fmt(facts.rirMax)})`
  with no check for `rirMin === rirMax`; same gap in the progression-engine fallback branch
  (`app.js:8393-8397`, `focus.exmeta.goal`/`focus.exmeta.effort`/`focus.exmeta.range`). The
  templates themselves always print a pair (`i18n-en.json:57,58,60`: `"RIR {rmin}–{rmax}"`). A
  sibling computation already does this correctly: `app.js:8249` (the Why-sheet facts line) reads
  `facts.rirMin===facts.rirMax?fmt(facts.rirMin):`${rmin}–${rmax}``, so the fix pattern already
  exists in the same file, just not applied to `focusExMeta`.
- Effect: the "Barbell back squat" exercise in the catalog has `rirMin===rirMax===1`, so its Focus
  meta line reads "3 × 4–8 reps · RIR 1–1 · Adaptive" everywhere that exercise is the active one.
  Not universal — `workout/focus-per-side`'s "Dumbbell bench press" shows "RIR 1–2" (a real range,
  correctly not collapsed) and `workout/why-this-weight`'s "Smith machine bench press" shows "RIR
  1–2" too, so the bug is specifically the `min===max` case.
- Fix: in `focusExMeta`, collapse `rmin`/`rmax` to one value when equal before interpolating into
  `focus.exmeta.range`/`.goal`/`.effort`, mirroring `app.js:8249`; or add a `rir: "{min}"` vs
  `"{min}–{max}"` template choice.
- Effort: S (logic fix in one function; the three affected i18n keys already format the surrounding
  text identically either way).
- Affects (confirmed visually): workout/focus, workout/deload-week, workout/rest-running,
  workout/rest-done, workout/logged-sets, workout/correction, workout/exercise-note,
  workout/exercise-actions (background), workout/warmup-actions (background),
  workout/focus-glossary (background), workout/actions (background). Likely also
  workout/stale-draft, workout/persist-retry, workout/invalid-draft, workout/skipped-actions,
  workout/substituted-actions, workout/reorder, workout/early-finish, workout/abandon,
  workout/first-set-guide, workout/focus-utilities-guide (same "Barbell back squat" background
  exercise in the catalog's workout flow) — not individually re-screenshotted here but driven by
  the same shared `focusExMeta` call and the same catalog fixture.

Not flagged as shared because each appears once in this set: the sheet single-exit/footer-Cancel
pattern on `workout/exercise-note` (tagged below, still open — see Screens).

## Screens

### today/no-program
- light: docs/ui-screens/screens/today/no-program__phone-390-light-en.png · dark: ...dark-en.png
- severity: low
- deviations:
  - "Set up a program" CTA rectangular → pill (S) [shared A, open]

### today/ready
- light/dark: today/ready__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - "Start workout" CTA rectangular → pill (S) [shared A, open]
  - Prescription row load/target weight+color off-kit (S) [shared C, open/changed — op/unit now
    secondary-colored, digits and load weight still not]
  - Otherwise meets kit: unboxed list, hairlines only, no `.card` border.

### today/ready-scrolled — new
- light/dark: today/ready-scrolled__phone-390-{light,dark}-en.png
- severity: medium
- deviations: same screen mid-scroll (collapsed large title, list in view) —
  "Start workout" CTA rectangular [shared A, open]; prescription row styling [shared C, open]. Dock
  at the bottom is correctly a pill capsule on glass, selected tab cued by color only, no box —
  meets kit.

### today/rest-bar
- light/dark: today/rest-bar__phone-390-{light,dark}-en.png
- severity: medium
- deviations: [covered by #502 — Today-while-a-session-is-in-progress and its mini bar are out of
  scope for this recheck]. Prescription row styling behind it still applies [shared C, open].

### today/day-picker
- light/dark: today/day-picker__phone-390-{light,dark}-en.png
- severity: low (down from medium)
- deviations:
  - "Start workout" CTA behind the scrim rectangular → pill (S) [shared A, open]
  - Selected row left accent bar → trailing check: **fixed by #485** [shared F]
  - Sheet close button bare X → 30px disc: **fixed by #485** (`.sheetband__close`, styles.css:7820,
    now a filled `rgba(ink,.07)`-equivalent disc via `::before`)
  - Prescription row styling behind the scrim [shared C, open]

### today/done
- light/dark: today/done__phone-390-{light,dark}-en.png
- severity: low
- deviations: meets kit — unboxed outcome list, hairlines, verdict glyphs are identity icons. No
  primary CTA on this state to check.

### today/deload-week
- light/dark: today/deload-week__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - "Start workout" CTA rectangular → pill (S) [shared A, open]
  - Prescription row styling [shared C, open]
  - "Block ending" banner: left accent bar on tonal ground, no box — meets kit.

### workout/focus
- light/dark: workout/focus__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - Header back/table/overflow icon buttons: **fixed** — no box at rest [shared B]
  - "Log set 1" CTA rectangular → pill (S) [shared A, open]
  - Meta line reads "3 × 4–8 reps · RIR 1–1 · Adaptive" — degenerate range (S) [shared G, new]
  - Open/selected ledger row correctly uses the 2px inset ring, not border+shadow — meets kit.
  - Shelf fields (Load/Reps/RIR) and pads correctly carry the control-extent ring — meets kit.

### workout/first-set-guide
- light/dark: workout/first-set-guide__phone-390-{light,dark}-en.png
- severity: low
- deviations:
  - "Got it" CTA rectangular → pill (S) [shared A, open]
  - Header icon buttons: **fixed** [shared B]
  - Dialog shell (`.tip-dialog`) matches kit — owner-kept centred dialog, meets kit.

### workout/focus-utilities-guide
- light/dark: workout/focus-utilities-guide__phone-390-{light,dark}-en.png
- severity: low
- deviations: CTA rectangular [shared A, open]; header icons: **fixed** [shared B].

### workout/focus-per-side
- light: workout/focus-per-side__phone-390-light-en.png · dark: byte-identical to light, still
  unverified (catalog note)
- severity: medium
- deviations:
  - Header icon buttons: **fixed** [shared B]
  - "Log set 1" CTA rectangular → pill (S) [shared A, open]
  - Meta line reads "RIR 1–2" for this exercise (Dumbbell bench press) — a real range, correctly
    not collapsed; not an instance of [shared G].
  - Per-side shelf fields correctly use the control-extent ring — meets kit.

### workout/why-per-side
- light: workout/why-per-side__phone-390-light-en.png · dark: byte-identical to light, still
  unverified (catalog note)
- severity: low
- deviations: sheet matches kit anatomy. Close button is a disc — meets kit. No button row to check.

### workout/deload-week
- light/dark: workout/deload-week__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - Header icons: **fixed** [shared B]; "Log set 1" CTA rectangular [shared A, open]
  - Meta line "RIR 1–1" [shared G, new]
  - "Block ending" banner: left accent bar, no box — meets kit.

### workout/focus-glossary
- light/dark: workout/focus-glossary__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - `#glossary` definition popover draws border AND shadow together — still the kit's flagship
    "never" violation (S) [shared E, open]
  - Close button on the popover is correctly a round disc — meets kit there.
  - Header icon buttons: **fixed** [shared B]
  - Meta line "RIR 1–1" visible behind the popover [shared G, new]

### workout/stale-draft
- light/dark: workout/stale-draft__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - "Reload latest" / "Copy pending value" buttons rectangular → pill (S) [shared A, open]
  - Header icons: **fixed** [shared B]
  - Recovery banner: left accent bar, no box — meets kit.

### workout/persist-retry
- light/dark: workout/persist-retry__phone-390-{light,dark}-en.png
- severity: medium
- deviations: "Retry"/"Copy pending value" buttons rectangular (S) [shared A, open]; header icons:
  **fixed** [shared B].

### workout/invalid-draft
- light/dark: workout/invalid-draft__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - "Start workout" CTA + "Retry"/"Copy recovery data" rectangular → pill (S) [shared A, open]
  - Recovery banner uses left accent bar, no box — meets kit.

### workout/rest-running
- light/dark: workout/rest-running__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - Header icons: **fixed** [shared B]; the running rest pill (`.wo-rest.is-running`) is correctly
    pill-shaped — meets kit.
  - "Log set 2" CTA rectangular → pill (S) [shared A, open]; `-30s`/`Pause`/`+30s`/`Skip` pads
    correctly `--radius-control`, not flagged.
  - Meta line "RIR 1–1" [shared G, new]

### workout/rest-done
- light/dark: workout/rest-done__phone-390-{light,dark}-en.png
- severity: medium
- deviations: same as rest-running — header icons fixed [shared B], "Log set 2" CTA rectangular
  [shared A, open], meta line degenerate RIR likely present [shared G] (same catalog exercise).

### workout/exercise-note
- light/dark: workout/exercise-note__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - Sheet footer still has both "Cancel" and "Save" — the one-exit rule remains unmet here: this
    sheet uses the plain `.sheetband` (handle + title + sub, no close button in markup,
    `index.html:1007-1021`) rather than adopting `.sheetband__close`'s new disc, so it is now the
    clearest holdout of the fixed-elsewhere pattern (M) [open, not covered by #485's close-disc
    work — that landed on `.sheetband__close`-bearing sheets, not this one]
  - Both footer buttons rectangular → pill (S) [shared A, open]
  - Meta line "RIR 1–1" visible behind the sheet [shared G, new]
  - Note textarea correctly uses the control-extent ring — meets kit.

### workout/why-this-weight
- light: workout/why-this-weight__phone-390-light-en.png · dark: byte-identical to light, still
  unverified (catalog note)
- severity: low
- deviations: sheet matches kit anatomy (left title, close disc, sectioned body, hairlines). Header
  icons: **fixed** [shared B]. Meta line reads "RIR 1–2" for Smith machine bench press — a real
  range, not [shared G].

### workout/why-in-session
- light: workout/why-in-session__phone-390-light-en.png · dark: byte-identical to light, still
  unverified (catalog note)
- severity: low
- deviations: same as why-this-weight — meets kit sheet anatomy; header icons: **fixed** [shared B].

### workout/why-manual
- light/dark: workout/why-manual__phone-390-{light,dark}-en.png
- severity: low
- deviations: meets kit — single-sentence sheet body, close disc present, no border/shadow combo.
  Header icons: **fixed** [shared B].

### workout/why-setup
- light/dark: workout/why-setup__phone-390-{light,dark}-en.png
- severity: low
- deviations: meets kit, same as why-manual. Header icons: **fixed** [shared B]; per-side shelf
  fields correctly ringed.

### session/summary
- light/dark: session/summary__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - "Done" CTA rectangular → pill (S) [shared A, open]
  - Bottom "Done" action bar (`.sum-actions`, styles.css:3578) is still flat `--bg` with a
    `1px border-top` and `--elevation-persistent-shadow` — **still not glass**: the kit's own
    materials table admits "only the top bar uses `--bar-glass` so far" (open, not covered by #484
    despite the earlier tag — re-flagging as confirmed-still-open)
  - Outcome rows: PR badge, verdict word, "Next:" line unboxed with hairlines — meets kit.

### session/summary-maintained
- light/dark: session/summary-maintained__phone-390-{light,dark}-en.png
- severity: medium
- deviations: same as summary — "Done" CTA rectangular [shared A, open]; Done bar not glass (open).

### session/summary-declined
- light/dark: session/summary-declined__phone-390-{light,dark}-en.png
- severity: medium
- deviations: same — "Done" CTA rectangular [shared A, open]; Done bar not glass (open). Declined
  lifts render in plain ink, no destructive tint — correct per spec.

### session/summary-first
- light/dark: session/summary-first__phone-390-{light,dark}-en.png
- severity: medium
- deviations: same — "Done" CTA rectangular [shared A, open]; Done bar not glass (open).
  First-exposure callout uses a left accent bar, no box — meets kit.

### workout/session
- light/dark: workout/session__phone-390-{light,dark}-en.png
- severity: low (down from medium)
- deviations:
  - Up/down reorder icon buttons per exercise row: **fixed** — `.session-map__reorder-btn`
    (styles.css:2467) now `border:1px solid transparent;background:transparent` at rest; confirmed
    visually, no box on any of the five rows [shared B]
  - "Finish session early" / "End without saving" rectangular → pill (S) [shared A, open]
  - Sheet close button: **fixed** — `#sessionSheetClose` is now a `.sheetband__close` disc
    (index.html:1040)
  - Meta line "RIR 1–1" visible behind the sheet [shared G, new]
  - Session-map rows otherwise follow row anatomy — meets kit.

### workout/early-finish
- light/dark: workout/early-finish__phone-390-{light,dark}-en.png
- severity: low (down from medium)
- deviations:
  - Reorder icon buttons: **fixed** [shared B]
  - "Confirm early finish" / "Cancel" rectangular → pill (S) [shared A, open]
  - Per-exercise unlogged-set list is plain text rows, no box — meets kit.

### workout/abandon
- light/dark: workout/abandon__phone-390-{light,dark}-en.png
- severity: low (down from medium)
- deviations:
  - Reorder icon buttons: **fixed** [shared B]
  - "End and discard" / "Keep training" rectangular → pill (S) [shared A, open]
  - Reason chips ("Out of time", "Not recovered", "Pain", "Equipment", "Schedule changed", "Other")
    correctly full pills, selected chip gets the quiet accent ring — meets kit, still the best
    reference on this screen for what the rectangular buttons above them should look like.

### workout/exercise-actions
- light/dark: workout/exercise-actions__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - "Repeat last session", "Substitute exercise", "Skip exercise", "Edit exercise notes" rows all
    still carry leading icons instead of trailing (M) [shared D, open]
  - All three "Make warm-up" buttons still plain rectangles (S) [shared A, open]
  - Header icon buttons: **fixed** [shared B]
  - Sheet close button: **fixed** — now a disc, not a bare X
  - Meta line "RIR 1–1" visible behind the sheet [shared G, new]
  - Section captions correctly read as unboxed group headers — meets kit.

### workout/warmup-actions
- light/dark: workout/warmup-actions__phone-390-{light,dark}-en.png
- severity: high
- deviations: identical pattern to exercise-actions — leading icons [shared D, open], "Make working
  set"/"Make warm-up" rectangular [shared A, open], header icons fixed [shared B], meta line "RIR
  1–1" [shared G, new].

### workout/reorder
- light/dark: workout/reorder__phone-390-{light,dark}-en.png
- severity: low (down from medium)
- deviations: same Session-details sheet as workout/session, mid-reorder — reorder icon buttons:
  **fixed** [shared B]; footer buttons rectangular [shared A, open]. Dragged row has no stray
  box/shadow — meets kit.

### workout/correction
- light/dark: workout/correction__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - "Save set 1" CTA rectangular → pill (S) [shared A, open]; header icons: **fixed** [shared B]
  - Meta line "RIR 1–1" [shared G, new]
  - "Cancel edit" / "Why this weight?" correctly plain underlined text links, no box — meets kit.

### workout/logged-sets
- light/dark: workout/logged-sets__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - Header icons: **fixed** [shared B]; "Log set 2" CTA rectangular [shared A, open]
  - Meta line "RIR 1–1" [shared G, new]
  - Logged row shows a check mark in place of the set index, open row keeps the 2px quiet ring —
    meets kit.

### today/draft-resume
- light/dark: today/draft-resume__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - "Continue workout" CTA rectangular → pill (S) [shared A, open]
  - Prescription row styling [shared C, open]

### workout/skipped-actions
- light/dark: workout/skipped-actions__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - Leading icons on "Repeat last session", "Substitute exercise", "Restore exercise", "Edit
    exercise notes" (M) [shared D, open]
  - "Make warm-up" ×3 rectangular → pill [shared A, open]; header icons: **fixed** [shared B]
  - "Skipped" status line correctly plain bold text, no badge/box — meets kit.

### workout/substituted-actions
- light/dark: workout/substituted-actions__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - Leading icons on "Repeat last session", "Change substitution", "Restore original exercise",
    "Skip exercise" (M) [shared D, open]
  - "Make warm-up" ×3 rectangular → pill [shared A, open]; header icons: **fixed** [shared B]
  - "In place of Barbell back squat" sub-line correctly unboxed, `--ink-soft` tone — meets kit.

### workout/swap-alternates
- light/dark: workout/swap-alternates__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - "+ Create custom exercise" button rectangular → pill (S) [shared A, open]
  - Muscle-group filter chips and "Why swap?" reason chips correctly full pills, including the
    selected "All" chip's ring — meets kit.
  - Exercise rows (thumbnail + name + hairline) follow row anatomy. Empty exercise art: every
    alternates/your-exercises/trained row in this catalog capture shows a blank cream placeholder
    tile (no illustration rendered) — re-confirmed visually; not itself a kit violation (asset
    absence in the capture environment, not a style bug), but worth tracking if it also happens in
    production with real data.
  - Close button on the sheet is a proper disc — meets kit.

### workout/swap-reason
- light/dark: workout/swap-reason__phone-390-{light,dark}-en.png
- severity: medium
- deviations: same screen mid-selection ("Crowded" chip chosen, ring visible) — "+ Create custom
  exercise" rectangular [shared A, open]; otherwise meets kit. "Barbell back squat" row shows its
  real thumbnail where others are still empty placeholder tiles — consistent art direction, not a
  deviation.

### today/context-menu
- light/dark: today/context-menu__phone-390-{light,dark}-en.png
- severity: low (down from high)
- deviations: all three original findings are **fixed**:
  - Hard `1px solid` border around the menu → **fixed**: `.native-context__menu`
    (styles.css:8370) is now `border:0` with `box-shadow:var(--menu-shadow)` where
    `--menu-shadow:var(--elevation-popover-shadow),0 0 0 .5px var(--bar-edge)` — glass + shadow +
    folded-in hairline, exactly the kit's amendment.
  - Trailing icons → **fixed**: `app.js:9154` builds each row as
    `<span>{label}</span>{icon}` (icon after text); `todayRowContext` (app.js:9189-9192) assigns
    `target`/`reset`/`dumbbell`/`close` per the kit's icon table.
  - Copy "Substitute exercise" → "Swap exercise" → **fixed**: `i18n-en.json:882`
    (`picker.title_substitute`) now reads "Swap exercise".
  - Lifted preview row still matches kit reasonably in both themes (copy at ~1.03, no border) —
    meets kit.

### workout/actions
- light/dark: workout/actions__phone-390-{light,dark}-en.png
- severity: low (down from medium)
- deviations:
  - Action-sheet material: **fixed and confirmed in both themes** —
    `.native-actions__group` (styles.css:8357) is `border-radius:var(--radius-prominent)` (16px) on
    `--surface` with `--elevation-modal-shadow`, inset 8px from the sides/bottom
    (`.sheet--actions{left:var(--space-8);right:var(--space-8);bottom:...+var(--space-8)}`), and
    Cancel is a separate group (`#workoutActionCancel`) with the same radius/shadow — matches the
    kit's Action sheet spec exactly, visually confirmed light theme no longer reads flush-to-edge.
  - Meta line "RIR 1–1" visible behind the sheet [shared G, new]
  - Buttons inside the groups are centred `--font-size-subtitle`-scale text with hairline rules —
    meets kit.

### today/skipped
- light/dark: today/skipped__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - "Continue workout" CTA rectangular → pill (S) [shared A, open]
  - Prescription row styling [shared C, open]

### today/dock-viewer — new
- light: today/dock-viewer__phone-390-light-en.png (canonical frame, no overlay — by design, see
  catalog note above); large-text variants: `-dark-en-text200`, `-light-en-text200`,
  `-light-pt-text200`.
- severity: meets kit
- deviations: none in the canonical frame (plain Today screen, identical content to today/ready).
  In the `-dark-en-text200` variant the large-content viewer itself (`.dock-viewer`,
  styles.css:3357) renders at `border-radius:var(--dock-viewer-radius)` = 22px
  (styles.css:289) on `--menu-bg` glass with `--menu-blur` and `--elevation-dialog-shadow`, no
  border — matches the kit's large-content-viewer spec exactly (§3 radii table: "(viewer) 22px,
  large-content viewer only"; §1 materials: "Menu glass... large-content viewer").

### workout/wheel-load — new
- light/dark: workout/wheel-load__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found. `.wheel__band` (styles.css:1612) is `border-radius:var(--radius-control)`
  on `--wheel-band` (`rgba(ink,.07)`, styles.css:117) — exactly the kit's §3 radii entry ("wheel
  band" is explicitly listed at `--radius-control`). The sheet header ("Load, kg" left-aligned,
  keyboard-toggle icon + "Done" text action trailing, no rule under the head) is plain text/icon
  actions (`.sheet__act`/`.sheet__act--icon`/`.sheet__act--done`, styles.css:1887-1908) with no box
  — matches kit sheet-header conventions. Header icon buttons behind the sheet (back/table/overflow)
  are unboxed [shared B, fixed]; the timer-pill exception keeps its ring. Meta line behind the sheet
  reads "RIR 1" correctly here (Hack squat has a non-degenerate strategy in this capture) — no
  [shared G] instance on this screen.

### workout/wheel-reps — new
- light/dark: workout/wheel-reps__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: same wheel sheet, Reps column — no deviations, same analysis as wheel-load.

## Worst 3

1. **workout/exercise-actions** (and its near-twins warmup/skipped/substituted-actions) — still the
   single screen with the most stackable, distinct deviations: four action rows with leading icons
   instead of trailing (the opposite of every other menu in the kit, including the now-fixed
   context menu on the same app), three plain-rectangle "Make warm-up" buttons, and the new
   degenerate "RIR 1–1" bug in the Focus meta line behind it. Still not a flow the prototype showed.
2. **workout/focus-glossary** — now that header icons, the context menu, and the day picker are all
   fixed, this is the last screen in the set still breaking the kit's single explicit "never" rule
   (a border AND a shadow on the same floating surface, §4) — the exact mistake the owner originally
   flagged on the context menu, just not yet carried over to `#glossary`.
3. **workout/exercise-note** — the lone sheet in this set that never got the close-disc/one-exit
   treatment: no `.sheetband__close` in its markup at all, so it still exits through a footer
   Cancel/Save pair (both rectangular), the exact pattern the kit's "No Got it, no footer Cancel"
   line forbids, while sibling sheets around it (day picker, session details, exercise actions) all
   now have the fix.
