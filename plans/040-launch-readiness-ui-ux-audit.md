# Plan 040: Launch-readiness UI/UX audit

> This is an audit and remediation brief, not an implementation. It was written
> for a separate executor. Do not treat a finding as fixed until its done
> criteria pass.

## Status

- **Priority**: P0 pre-launch for all retained findings (owner override)
- **Effort**: L across the complete remediation
- **Risk**: HIGH (the highest-priority fixes touch dual-store persistence,
  draft recovery, first-run state, and log validation)
- **Depends on**: none
- **Audited at**: commit `7b6ad58`, 2026-08-13
- **Product shape**: static, local-only mobile PWA; no backend or account system
- **Primary files**: `index.html`, `styles.css`, `app.js`, `i18n-en.json`,
  `i18n-pt.json`, `notify.js`, `sw.js`

> **Scheduling override (2026-08-13)**: the owner requires all 24 retained
> findings to land before launch. The original launch-gate/P1/P2 headings below
> remain as audit severity groupings only; they no longer imply deferral. Use
> [`plans/041-prelaunch-all-findings-remediation.md`](./041-prelaunch-all-findings-remediation.md)
> as the executable implementation and release plan.

## Executive verdict

RepForge's core is strong enough to launch: the Today-to-workout loop is fast,
the light editorial redesign is coherent, Focus mode is genuinely useful on a
phone, local-first storage is legible, and History/Progress/Program form a
credible post-workout loop.

The current build is **not ready to ship unchanged**, however. The remaining
problems are not broad visual polish. They cluster at trust boundaries:

1. a one-sided storage failure can make a newer local copy lose to stale
   IndexedDB data on the next boot;
2. changing RIR mode can silently destroy an in-progress workout;
3. reloading an in-progress workout forgets skipped and substituted exercises;
4. two legitimate first-run paths install a program without completing
   onboarding, so onboarding returns after reload;
5. invalid set values are silently coerced into believable-looking bad data;
6. notification controls can claim to be on when the browser has denied them;
7. Portuguese workout UI contains a duplicated English bodyweight label;
8. page zoom is intentionally disabled, excluding low-vision users; and
9. meaningful labels use text colors that fail the app's own 4.5:1 contrast
   requirement.

These nine issues are addressable without redesigning the product.
They should be the launch gate. If they cannot all land, disable or guard the
affected options rather than shipping silent data loss or false status.

The broader lesson is that RepForge is already feature-rich. It does not need
another feature before launch. It needs one consistent rule: **anything that
looks committed, enabled, or actionable must be true, reversible, and
keyboard-operable**.

## Method

The audit combined:

- hands-on mobile browser passes on clean origins at phone dimensions;
- fresh-state and populated-state runs in English and Portuguese;
- code vetting of every retained finding against commit `7b6ad58`;
- comparison with `docs/design/ui-overhaul-spec.md`;
- review of the existing browser simulation and focused test scripts; and
- PWA, import/export, persistence, notification-permission, and offline flows.

The manual passes used isolated origins and cleared browser storage between
first-run scenarios. This matters because `localStorage`, IndexedDB, service
worker caches, notification permission, and install eligibility are all
origin-scoped.

### Coverage

| Surface | States and stories exercised | Verdict |
|---|---|---|
| First run / onboarding | all eight steps; disabled/valid Continue states; Back, Cancel, Restart, Save, Edit before saving, program import, reload | Main save path passes; edit/import completion paths fail |
| Today | fresh program, populated history, day choice, exercise disclosure, ready-to-progress cue, Start vs Continue | Strong hierarchy and clear primary action |
| Active workout — List | suggested/touched/committed/warmup sets; steppers; copy last; collapse; substitution; skip/restore; notes; bodyweight; timer; voice option; finish | Fast and coherent; validation and resume-state defects remain |
| Active workout — Focus | card deck, swipe, previous/next, short viewport, long ledger, edit committed set, rest, note sheet, completion | Best part of the redesign; core behavior is sound |
| Progress — Overview | empty and populated; weekly verdict; ready list; attention groups; chart; volume; deep section | Useful, but period scope and destinations are inconsistent |
| Progress — Strength / Volume / PRs / Review | empty/populated tables, PR filters, 7/28-day controls, block snapshot | Data is readable; drill-down/action semantics are uneven |
| Exercise detail | new/populated, recommendation, chart, records, recent sessions, return to origin | Two controls advertise behavior they do not have |
| History | empty/populated, calendar navigation, search, hidden search, expand, edit, delete, CSV export | Functional by pointer; session rows fail keyboard access |
| Program | overview, day disclosures, edit mode, add/reorder/delete, raw JSON, program import/export, volume audit | Capable editor; template replacement can leave false identity |
| Block lifecycle | end-block confirmation, review, all next-block strategies, decide later, onboarding strategy | Review is clear; modal accessibility and cancel semantics need work |
| Settings | units, language, RIR mode, voice, timer, progression, notifications, tour, install, backup/import/reset | Well grouped; several switches overstate their effective state |
| PWA | manifest/assets, install affordances, service worker, reload, offline shell; dual-store failure path code-vetted | Offline shell passes; persistence conflict handling and installed-app copy do not |

### What was not treated as a defect

- Voice recognition quality depends on the browser/provider and cannot be
  judged deterministically in this local audit.
- Native install prompts vary by browser. Both the eligible and unavailable
  paths were inspected, but store-level presentation was not.
- OS notification delivery while the browser or PWA is fully terminated is
  explicitly best-effort; the finding below concerns truthful permission UI,
  not a promise of guaranteed background delivery.
- A static Strength table is not inherently broken. The finding is the wider
  mismatch between controls that look actionable and the behavior they expose.

## Launch gate

| ID | Finding | Impact | Effort | Fix risk | Confidence |
|---|---|---:|---:|---:|---:|
| DATA-01 | Reconcile IndexedDB and localStorage without rolling back newer state | Critical | M | HIGH | HIGH |
| UX-01 | Preserve an in-progress workout when RIR mode changes | Critical | S | MED | HIGH |
| UX-19 | Persist skips and substitutions as part of the workout draft | High | M | MED | HIGH |
| UX-02 | Complete onboarding through Save, Edit, and Import | High | S–M | MED | HIGH |
| UX-03 | Reject invalid set data instead of coercing it to zero | High | M | MED | HIGH |
| UX-04 | Reconcile notification UI with browser permission | High | S–M | LOW | HIGH |
| UX-05 | Render one translated bodyweight label | High polish / low effort | S | LOW | HIGH |
| UX-06 | Restore pinch zoom while retaining safe repeated taps | High accessibility | S | LOW | HIGH |
| A11Y-01 | Raise meaningful text to at least 4.5:1 contrast | High accessibility | S–M | LOW | HIGH |

## Detailed findings

### DATA-01 — Reconcile IndexedDB and localStorage without rolling back newer state

- **Evidence**: `persist()` at `app.js:768-774` writes the localStorage mirror
  synchronously, starts an unawaited IndexedDB write, and only warns when both
  stores fail. `boot()` at `app.js:3239-3252` always prefers any non-null
  IndexedDB value and consults localStorage only when IndexedDB has no value.
- **Failure mechanism**: if localStorage accepts a workout but the corresponding
  IndexedDB transaction fails, IndexedDB remains an older yet valid snapshot.
  The next boot selects that older snapshot, then `persist()` writes it back
  over the newer localStorage mirror. The successful save appears to be
  silently rolled back. Fire-and-forget writes also provide no ordering or
  recovery contract for rapid consecutive saves.
- **Impact**: completed workouts, settings, or program edits can disappear after
  reload—the most serious possible failure for a local-only tracker.
- **Effort**: M.
- **Risk**: HIGH because migration, import, and every save path share this layer.
- **Confidence**: HIGH in the code path; inject one-store failures to determine
  browser-specific frequency.
- **Fix sketch**: persist a monotonically increasing revision in a versioned
  envelope in both stores. On boot, read and validate both snapshots, choose
  the newest revision, and repair the stale store. Serialize writes so an older
  transaction cannot finish last. Show a persistent degraded-storage warning
  when only one store accepts a write; a toast only when both fail is too late.
- **Done criteria**:
  - injected IndexedDB failure plus successful localStorage write reloads the
    newer state and heals IndexedDB;
  - injected localStorage failure plus successful IndexedDB write reloads the
    newer state and heals localStorage;
  - delayed/out-of-order transactions cannot replace a higher revision;
  - malformed data in one store falls back to the other without resetting;
  - migration and replace/merge import preserve revision ordering.

### UX-01 — Preserve an in-progress workout when RIR mode changes

- **Evidence**: `app.js:2831-2836` compares the old/new RIR mode and calls
  `clearDraft()` before saving the setting. `clearDraft()` at `app.js:149-156`
  deletes `repforge_draft_v1`, clears unfinished-session metadata, and resets
  the draft prompt. The UI offers no warning.
- **Observed result**: after entering or committing a set, changing
  **Settings → RIR logging** turns **Continue workout** back into
  **Start workout** and removes the unsaved session.
- **Impact**: this violates the core local-first promise at the worst moment:
  between sets. A setting change must never silently discard training data.
- **Effort**: S for a launch guard; M for lossless conversion.
- **Risk**: MED. Numeric RIR maps many-to-one into Easy/Hard/Max, so a naive
  round-trip can also lose information.
- **Confidence**: HIGH.
- **Fix sketch**: for launch, block RIR-mode changes while
  `draftHasProgress()` is true and explain that the user must finish or
  explicitly discard the workout first. Keep the old radio selected. A later
  enhancement may migrate each draft field using `effortForRir()` and
  `EFFORT_RIR`, but it must preserve an untouched numeric snapshot if the user
  switches back.
- **Done criteria**:
  - changing RIR mode with no draft still works;
  - changing it with a filled, touched, warmup, or committed set preserves the
    draft and visibly explains why the mode did not change;
  - reload still shows **Continue workout** with the original values.

### UX-19 — Persist skips and substitutions as part of the workout draft

- **Evidence**: `skipped` and `substituted` are module-only collections at
  `app.js:470-471`. Their handlers at `app.js:1913-1923` only mutate memory and
  re-render. `saveDraft()` at `app.js:1850-1858` persists fields, effort, notes,
  committed/touched/warmup state, and a timestamp, but neither collection.
  `saveWorkout()` at `app.js:2027-2040` relies on those collections to exclude
  skipped exercises and record `performedName`.
- **Result**: after leave/close/reload/continue, skipped exercises return and
  substitutions display as the original exercise. Finishing after that reload
  can attribute an alternate exercise's surviving set values to the original
  program exercise.
- **Impact**: the app promises a resumable workout but only restores part of the
  session. This is both interaction drift and potentially incorrect history.
- **Effort**: M.
- **Risk**: MED because old drafts must remain compatible and substitutions
  need validation against the current program.
- **Confidence**: HIGH.
- **Fix sketch**: add `__skipped` exercise IDs and a
  `__substituted` ID-to-name map to the draft schema; rehydrate both before the
  first workout render. Remove unknown IDs, cap custom names, and clear this
  state only on explicit discard or successful finish.
- **Done criteria**:
  - skip/restore and predefined/custom substitutions survive leave, reload,
    List/Focus switching, and **Continue workout**;
  - a resumed substituted set saves the correct `performedName`;
  - a resumed skipped exercise stays excluded from save;
  - old drafts without the new keys still load, and changed programs discard
    only orphaned skip/substitution entries.

### UX-02 — Complete onboarding through Save, Edit, and Import

- **Evidence**: `maybeShowOnboarding()` at `app.js:2927` reopens onboarding
  whenever `programMeta.onboarded` is false and the log is empty. Only
  `saveOnboardingProgram()` at `app.js:2984-2988` sets `onboarded:true`.
  `editOnboardingProgram()` at `app.js:2989-2992` saves the generated program
  but does not persist the answers, start date, lifecycle state, or onboarding
  completion. First-step import calls the generic input at `app.js:2982`;
  `importProgramFile()` at `app.js:2869-2876` saves the template/name but also
  leaves `onboarded` false and keeps onboarding open.
- **Observed result**: both **Edit before saving → Done** and
  **I already have a program → Import** establish a real program, but onboarding
  appears again after a hard reload.
- **Impact**: the two paths aimed at experienced users behave like traps. The
  program is saved, so repeating onboarding also risks replacing something the
  user already edited or imported.
- **Effort**: S–M.
- **Risk**: MED because program metadata and the first feature-tour trigger are
  coupled to the normal Save path.
- **Confidence**: HIGH.
- **Fix sketch**: centralize first-run finalization in one helper that persists
  program metadata, sets `onboarded:true`, selects the first day, closes
  onboarding, and starts the tour/install follow-up once. Call it from Save,
  Edit, and successful first-run Import. Choosing Edit may mark setup complete
  immediately because a usable program already exists; the Program editor's
  **Done** action should not be required to repair hidden metadata.
- **Done criteria**:
  - Save, Edit, and Import each survive reload without reopening onboarding;
  - Edit preserves all onboarding answers in `programMeta`;
  - Import closes onboarding and adopts template identity without sender
    lifecycle metadata;
  - Cancel before a program is established still leaves first-run onboarding
    eligible.

### UX-03 — Reject invalid set data instead of coercing it to zero

- **Evidence**: `posNum()` at `app.js:167` clamps negative or invalid values to
  zero. `saveWorkout()` at `app.js:2031-2043` requires positive load but does
  not require positive, integral reps before writing a row. The History editor
  uses the same coercion at `app.js:2527-2535` and only removes rows whose load
  becomes zero.
- **Observed result**: entering `-1` reps can produce a saved set with `0` reps
  without a warning. In History, blanking load silently removes the row while
  negative reps/RIR silently become zero.
- **Impact**: zero-rep working sets feed session summaries and recommendation
  inputs as if they were intentional data. Silent correction is worse than an
  explicit validation error because the ledger looks successfully saved.
- **Effort**: M.
- **Risk**: MED. Existing imported data may already contain zero reps, so input
  validation should not silently rewrite history during migration.
- **Confidence**: HIGH.
- **Fix sketch**: validate at commit/save boundaries: load must be positive;
  reps must be a positive integer; RIR must be finite and non-negative.
  Preserve the user's text, focus the first invalid field, and show a specific
  inline message or toast. In History, make set deletion explicit instead of
  overloading a blank load as delete.
- **Done criteria**:
  - negative, fractional, blank, and non-numeric reps cannot be committed or
    saved;
  - invalid RIR/load cannot silently become zero;
  - History edits are atomic—one invalid field leaves the stored session
    unchanged;
  - explicit set deletion has confirmation or undo.

### UX-04 — Reconcile notification UI with browser permission

- **Evidence**: `renderSettings()` at `app.js:2810-2818` paints the toggle from
  persisted `notify.enabled` but prints permission separately. The change
  handler at `app.js:3206-3209` persists `enabled:true` before
  `requestPermission()` settles and ignores the returned permission when it
  does. `notify.js:37-39` correctly refuses to fire unless permission is
  `granted`, so the visible switch and actual behavior can diverge.
- **Observed result**: denying the prompt—or revoking permission in browser
  settings—leaves the orange toggle on while the status says `denied`.
- **Impact**: users reasonably interpret an enabled switch as a functioning
  reminder. Missed rest/session reminders then look like app unreliability.
- **Effort**: S–M.
- **Risk**: LOW.
- **Confidence**: HIGH.
- **Fix sketch**: persist enabled only after a `granted` result. On render and
  `visibilitychange`, reconcile revoked permission: show the effective toggle
  off/disabled and a short browser-settings instruction. Keep reminder-type
  preferences if useful, but distinguish “requested preference” from
  “effective permission.”
- **Done criteria**:
  - denied/default/granted each produce truthful toggle and status states;
  - revoking permission outside the app is reflected on return;
  - reminder-type controls cannot appear active when OS notifications cannot
    fire.

### UX-05 — Render one translated bodyweight label

- **Evidence**: `index.html:117-119` already contains a translated
  `<span data-i18n="log.bodyweight">`. `updateBodyweightField()` at
  `app.js:885-888` inserts a new hard-coded English text node before the input
  but leaves that span in place.
- **Observed result**: Portuguese shows a combined label equivalent to
  `PESO CORPORAL (OPCIONAL): BODYWEIGHT (KG, OPTIONAL)`.
- **Impact**: this is highly visible in the primary workout flow and makes the
  Portuguese launch look unfinished.
- **Effort**: S.
- **Risk**: LOW.
- **Confidence**: HIGH.
- **Fix sketch**: update the existing span with
  `t("log.bodyweight_unit",{unit:unitLabel()})`; never add a sibling text node.
  Re-run this after language and unit changes.
- **Done criteria**: exactly one bodyweight label appears in EN/PT and kg/lb,
  with no hard-coded English residue.

### UX-06 — Restore pinch zoom while retaining safe repeated taps

- **Evidence**: `index.html:5` sets `maximum-scale=1,user-scalable=no`.
  `styles.css:42-50` already applies `touch-action:manipulation` to prevent the
  accidental double-tap gesture while retaining normal interaction. The
  simulation at `test/simulation.mjs:783-813` explicitly treats disabled zoom
  as a requirement.
- **Impact**: low-vision users cannot magnify dense set tables, History rows,
  chart labels, or Settings copy. This conflicts with the accessibility intent
  in `docs/design/ui-overhaul-spec.md:419-420`, even though an earlier spec
  amendment deliberately pinned scale.
- **Effort**: S.
- **Risk**: LOW because the existing touch-action and 16px field protections
  address the original repeated-tap and focus-zoom problems.
- **Confidence**: HIGH.
- **Fix sketch**: remove `maximum-scale` and `user-scalable=no`; retain
  `width=device-width,initial-scale=1,viewport-fit=cover`,
  `touch-action:manipulation`, and 16px inputs. Replace the simulation
  assertion with one that verifies pinch zoom is not prohibited.
- **Done criteria**: pinch zoom works; repeated stepper taps do not trigger
  double-tap zoom; focused fields do not force iOS text zoom.

### A11Y-01 — Raise meaningful text to at least 4.5:1 contrast

- **Evidence**: `styles.css:18` defines `--ink-faint:#98948C`. It computes to
  3.02:1 on white and 2.70:1 on the page background, yet it is used for
  meaningful 10–13px section labels, set headers, unit hints, chart labels,
  exercise metadata, and session dates throughout `styles.css`. The text accent
  `#E04E14` is 3.99:1 on white and 3.57:1 on the page background. The overhaul
  specification at `docs/design/ui-overhaul-spec.md:419-420` explicitly
  requires all text to reach 4.5:1.
- **Impact**: low-vision users can zoom only after UX-06, but magnification does
  not repair low contrast. Tiny tertiary labels carry operational meaning in
  the workout and History flows.
- **Effort**: S–M.
- **Risk**: LOW; this is a token/usage correction, not a layout redesign.
- **Confidence**: HIGH.
- **Fix sketch**: reserve `--ink-faint` for non-text decoration or darken it to
  a compliant token. Use `--ink-soft` for tertiary text and `--accent-deep` for
  normal-size orange links/labels; retain the brighter accent for large text,
  icons, borders, dots, and chart graphics where the applicable threshold is
  met.
- **Done criteria**: an automated computed-style audit finds no meaningful
  normal text below 4.5:1 in EN/PT, disabled text remains distinguishable, and
  the editorial hierarchy still reads clearly on all three launch viewports.

## Former P1 — now pre-launch by owner decision

### UX-07 — Give every modal a real keyboard lifecycle

- **Evidence**: Block Review, Import Choice, and End Block Confirm declare
  `aria-modal="true"` in `index.html:453-477`, but their open/close functions
  (`app.js:728-733`, `app.js:2887-2893`) only toggle `.hidden`. They do not move
  focus, trap Tab, close on Escape, mark the background inert, or return focus
  to the trigger. The exercise-note sheet at `app.js:3108-3120` is the
  in-repo exemplar for Escape and focus trapping.
- **Impact**: keyboard and switch users can remain focused behind a full-screen
  modal or tab into obscured content. Escape does nothing on Block Review.
- **Effort**: M.
- **Risk**: MED because several overlays share the same problem.
- **Confidence**: HIGH.
- **Fix sketch**: build one small dialog controller for open, initial focus,
  focus containment, Escape, close, background inertness, and focus return.
  Use it for all modal dialogs; keep the tour/install banner non-modal.

### UX-08 — Do not complete a block before onboarding succeeds

- **Evidence**: `finishBlockAndStart()` at `app.js:726-727` calls
  `completeCurrentProgram()` before `startNextMesocycle()`.
  `startNextMesocycle("onboarding")` at `app.js:713-721` opens onboarding and
  returns without starting an active replacement. Cancel remains available.
- **Impact**: choosing **Start from onboarding again**, then cancelling, leaves
  the old program marked completed even though no next program was confirmed.
  The UI can still display that old template, creating an impossible
  “completed but current” state.
- **Effort**: M.
- **Risk**: MED-HIGH because program-history archival must remain exactly-once.
- **Confidence**: HIGH.
- **Fix sketch**: hold a pending transition in UI state. Archive/complete the
  old block only when the replacement program is saved or imported. Cancel
  discards the pending transition and leaves the old block active.

### UX-09 — Reset program identity when loading the beginner template

- **Evidence**: `switchToBeginnerProgram()` at `app.js:2902` replaces only
  `state.program`; it retains the old program name, id, start date, goal,
  experience, mesocycle status, and completion metadata.
- **Observed result**: a distinctively named custom program can keep its old
  name while its entire exercise structure becomes the beginner template.
- **Impact**: Program, Today, exports, and block reporting describe one program
  while the user is training another.
- **Effort**: S–M.
- **Risk**: MED because lifecycle semantics must be explicit.
- **Confidence**: HIGH.
- **Fix sketch**: treat this as applying a new template: create a new program
  identity, name it with localized beginner-program copy, start it today, mark
  it active/onboarded, and preserve only the training log. Say exactly that in
  the confirmation.

### UX-10 — Constrain rest timer input to whole seconds

- **Evidence**: `normalizeSettings()` at `app.js:122-127` accepts any finite
  non-negative `restSec`; `commitSettings()` at `app.js:2829-2836` passes
  decimal input through; `renderSettings()` at `app.js:2821-2822` then formats
  the remainder as a string.
- **Observed result**: `90.5` renders as a malformed fractional clock such as
  `1:30.5`.
- **Impact**: minor data issue, obvious settings rough edge.
- **Effort**: S.
- **Risk**: LOW.
- **Confidence**: HIGH.
- **Fix sketch**: parse a non-negative integer, reject/round fractional input
  consistently, and use the shared `fmtClock()` formatter.

### UX-11 — Make History filtering and session rows self-evident

- **Evidence**: History session rows are clickable `<div>` elements at
  `app.js:2469-2478` with no `tabindex`, role, or key handler. Search itself
  correctly matches day and exercise names at `app.js:2452-2455`, but the
  search button at `app.js:3155` can hide a non-empty field without exposing
  `aria-expanded` or any visible “filtered” state. A zero-result query reuses
  the first-run message at `app.js:2476`.
- **Impact**: keyboard users cannot open sessions. Pointer users can hide an
  active filter and see a mysteriously shortened list, while “No sessions yet”
  falsely implies data loss when the query simply has no matches.
- **Effort**: M.
- **Risk**: LOW.
- **Confidence**: HIGH.
- **Fix sketch**: render each expandable session header as a button with
  `aria-expanded`/`aria-controls`; retain action buttons inside a separate
  region. Give search an expanded state, clear action, active-filter cue, and
  dedicated “No matching sessions” copy.

### UX-12 — Remove or implement inert exercise-detail controls

- **Evidence**: `renderExerciseView()` at `app.js:2603` renders **12 weeks** as
  a button with a caret but attaches no handler. The load/e1RM record rows at
  `app.js:2607-2608` are also buttons with chevrons and no handlers; only
  **See all** is bound at `app.js:2613`.
- **Impact**: these are literal dead controls. They teach users that buttons
  and chevrons may do nothing, weakening trust in every drill-down affordance.
- **Effort**: S to render them as static text; M to implement ranges and
  record navigation.
- **Risk**: LOW for the launch-safe static treatment.
- **Confidence**: HIGH.
- **Fix sketch**: before launch, remove button/caret styling from unavailable
  behavior. Follow up with 12/26/52-week chart ranges and record rows that open
  a filtered PR view.

### UX-13 — Scope and keyboard-enable the Progress period control

- **Evidence**: `#statsPeriod` is a clickable `<span>` in
  `index.html:133-135`, so it is absent from the keyboard tab order. Its
  handler at `app.js:3159` changes `volWindow`. That variable only controls the
  deep **Completed hard sets** rendering at `app.js:2406-2411`; the weekly
  verdict, Strength dashboard, chart, and Volume dashboard do not follow the
  header-level period.
- **Impact**: a global-looking “7 days / 28 days” control appears to reframe
  Progress, but most of the page does not change.
- **Effort**: S for honest scope; L for a truly global period model.
- **Risk**: LOW for the scoped fix.
- **Confidence**: HIGH.
- **Fix sketch**: for launch, move or relabel it inside Completed hard sets and
  use a real button/segmented control. Do not imply a global range until every
  period-sensitive view follows it.

### UX-14 — Update the feature tour to the UI it is teaching

- **Evidence**: `i18n-en.json:537-540` and `i18n-pt.json:537-540` tell users
  that a bottom bar moves between Focus exercises. Current Focus navigation is
  swipe plus header chevrons (`app.js:1966-1975`), and the tab bar is hidden in
  Focus (`styles.css:418-424`). Tour steps remain on the Today view rather than
  opening the workout UI (`app.js:3039-3041`, `app.js:3065-3081`).
- **Impact**: the first instructional experience describes a removed control
  while the actual controls are not visible. This is worse than no tour for a
  user trying to learn the gym flow.
- **Effort**: S for truthful copy; M for contextual steps.
- **Risk**: LOW.
- **Confidence**: HIGH.
- **Fix sketch**: immediately replace the stale bottom-bar sentence with
  swipe/header-chevron instructions. Then make workout-specific steps enter a
  safe, non-mutating demo state or show a compact illustration rather than
  narrating hidden controls.

### UX-15 — Name destructive actions by their real scope

- **Evidence**: Settings labels `#reset` **Delete all data**
  (`index.html:415-418`), but its handler at `app.js:3215` clears only
  `state.log` and the draft. It keeps the program, settings, UI preferences,
  notification metadata, and program history. The confirmation says
  **Delete the training log?**
- **Impact**: the row overstates destruction while the confirmation narrows it.
  Users cannot predict whether “all data” means history only or a full reset.
- **Effort**: S.
- **Risk**: LOW.
- **Confidence**: HIGH.
- **Fix sketch**: rename it **Delete workout history** and list what remains.
  If a true factory reset is needed later, add it as a separate action with a
  detailed summary and fresh-backup gate.

### A11Y-02 — Announce status and expose selection/activation semantics

- **Evidence**: `#toast` at `index.html:519` has no `role` or `aria-live`, so
  save, validation, timer, and error feedback is visual-only. The session
  reminder is a `role="status"` `<div>` whose whole surface receives an
  `onclick` at `app.js:1223-1232`, but it is not keyboard-focusable or announced
  as an action. List/Focus buttons update only an `.active` class at
  `app.js:895`; the notification toggle at `index.html:323` has no accessible
  name; and flat Settings selects suppress both custom and default focus
  treatment at `styles.css:343`.
- **Impact**: assistive-technology users can miss whether data saved, cannot
  activate a reminder, and cannot reliably discover selected layout or focus.
- **Effort**: M.
- **Risk**: LOW.
- **Confidence**: HIGH.
- **Fix sketch**: make toasts a polite status region (use assertive only for
  destructive failure), render the banner's primary action as a button, expose
  List/Focus as pressed buttons or tabs, label every switch, and preserve a
  visible `:focus-visible` style on selects. Audit compact controls—including
  the 40×40 banner close button—against the 44px target contract.

### UX-20 — Stop labeling residual exercises as “stable”

- **Evidence**: `weeklySnapshot()` at `app.js:542-563` already computes an exact
  `flatLifts` count from exercises compared this week. `renderThisWeek()` at
  `app.js:2089-2101` ignores it and derives `flatGuess` from every exercise with
  any history minus current improved, ready, and whole-program attention
  counts.
- **Impact**: exercises not trained or not comparable this week can appear
  “stable.” The headline dashboard presents an inferred remainder as measured
  progress, weakening confidence in the coaching layer.
- **Effort**: S.
- **Risk**: LOW.
- **Confidence**: HIGH.
- **Fix sketch**: display `w.flatLifts` or rename/redefine the cell if the
  product intentionally wants a whole-program residual. Add a fixture with an
  old but untrained lift and a one-session lift so neither is counted stable.

## Former P2 — now pre-launch by owner decision

### UX-16 — Standardize disclosure semantics

Settings rows for timer, RIR, progression, notification types, backup, and
import toggle panels at `app.js:3160-3165`, but expose no
`aria-expanded`/`aria-controls` state. Add these attributes and keep chevron
state synchronized. Use the existing Today/program disclosure patterns as the
model.

### UX-17 — Tell users where coaching rows will take them

Ready rows open Exercise detail (`app.js:2114-2126`); new/stale Attention rows
open the workout; reduce/volume/fatigue rows open the deep chart
(`app.js:2374-2385`). Each destination is defensible, but identical-looking
rows have three different outcomes. Add a trailing action label such as
**Details**, **Log**, or **View trend**, or standardize on Exercise detail and
offer the next action there.

### UX-18 — Make installed-app positioning match the product

`manifest.webmanifest:4` still describes RepForge as a
“machine-only bodybuilding” tracker, while onboarding supports machines,
cables, dumbbells, barbells, and bodyweight. Update the install description so
the installed product matches the current audience.

### PERF-01 — Index History once per render

History filtering and rendering repeatedly scans the full log for each session
at `app.js:2452-2484`, producing quadratic work as a personal ledger grows.
Build one session map and normalized search index per render, then reuse it for
filtering, counts, expansion, and month grouping. Add a realistic long-history
fixture and a deterministic render/search budget so this remains a bounded
optimization, not a speculative rewrite.

## Holistic recommendations

### 1. Make persistence recoverable and draft state complete

Treat IndexedDB and localStorage as replicas of one versioned snapshot, not
“primary plus fallback” without conflict resolution. Treat the workout draft
as the complete resumable session—including skip/substitution state—not merely
the current inputs. Every reload test should prove semantic equivalence before
and after boot.

### 2. Protect state transitions centrally

Draft loss, onboarding loops, stale program identity, and premature block
completion are four expressions of one architectural UX problem: several
buttons mutate parts of the same program/workout state machine independently.
Create explicit transition helpers:

- `changeRirMode()` — refuses or migrates an active draft;
- `finalizeProgramSetup()` — one completion path for save/edit/import;
- `applyProgramTemplate()` — creates truthful identity/lifecycle metadata; and
- `commitNextBlock()` — archives the old block only after a successor exists.

This is a deeper and safer fix than adding one-off booleans in click handlers.

### 3. Separate preference from effective capability

Notifications demonstrate why persisted preference and browser capability are
different. Apply the same pattern to voice input and installation: show
unsupported, permission-blocked, available, and enabled as distinct states.
Never paint an “on” switch when the platform cannot perform the action.

### 4. Use native semantics before custom styling

RepForge already uses buttons well in many places. Finish the job: expandable
rows should be buttons, modal dialogs need focus management, clickable period
text must be a button, and static labels must not look like buttons. This one
rule resolves most of the keyboard issues and dead-affordance roughness without
changing the visual system.

### 5. Keep insight-to-action destinations predictable

Today and Progress now contain several coaching surfaces. Give every row a
visible destination verb. A user should know before tapping whether RepForge
will show evidence, open the exercise, or start logging.

## Recommended execution order

1. **Storage trust patch**: DATA-01 first, in an isolated change with
   fault-injection coverage.
2. **Workout/program trust patch**: UX-01, UX-19, UX-02, UX-03, UX-05.
   These share draft/program persistence and need focused regression tests
   before any copy polish.
3. **Capability/accessibility patch**: UX-04, UX-06, A11Y-01, UX-07,
   A11Y-02.
   Notification truth and browser interaction semantics are independent of the
   program model.
4. **Lifecycle patch**: UX-08, UX-09.
   Land together so every new-program route follows one identity rule.
5. **Accuracy/affordance patch**: UX-10 through UX-16 and UX-20.
   Mostly low-risk markup, copy, and event-state corrections.
6. **Final pre-launch coherence pass**: UX-17, UX-18, PERF-01, and the
   launch-safe static/scoped versions of UX-12/13.

Do not bundle a visual redesign, new analytics, or AI work into these patches.
The launch problem is trust and interaction truth, not missing scope.

## Verification plan

Add focused browser checks before changing behavior. The current simulation is
broad, but it does not cover the failure paths above and currently enforces the
zoom restriction.

### New automated checks

- Fault-inject each persistence store independently, delay writes out of order,
  and verify boot chooses/heals the highest valid revision.
- RIR mode with empty draft changes; with each draft-progress shape it refuses
  without data loss.
- Skip and predefined/custom substitution state survives leave/reload/continue
  and produces the same saved rows as an uninterrupted workout.
- Onboarding Save/Edit/Import each persist `onboarded:true` and stay complete
  after reload.
- Negative, blank, decimal, and non-numeric set values never mutate stored
  history.
- Notification request outcomes `granted`, `default`, and `denied`; permission
  revoked after enable.
- EN/PT and kg/lb bodyweight labels contain exactly one localized label.
- Viewport permits zoom while steppers retain `touch-action:manipulation`.
- Computed text colors meet 4.5:1 in all primary UI states.
- Every modal: initial focus, Tab containment, Escape, and trigger focus return.
- Toasts are announced; session reminder, layout selection, switches, and
  Settings selects expose keyboard and accessible state.
- Block-review onboarding cancel leaves the previous block active and
  unarchived; save archives it exactly once.
- Beginner template gets new, coherent metadata while preserving log rows.
- History session rows open with Enter/Space and expose expanded state.
- No-match search copy differs from the zero-history empty state.
- Every element rendered as a button on Exercise detail has a working handler.
- Weekly “stable” equals actual flat comparisons, excluding untrained and
  non-comparable lifts.

### Manual launch smoke

At 320×568, 390×844, and 430×932:

1. clean first run in EN: Save path, Edit path, and Import path, each followed
   by reload;
2. one complete List workout and one Focus workout, including an invalid entry,
   warmup, set edit, timer, note, skip, substitution, reload/continue, and
   finish;
3. Progress and History populated from that workout, including keyboard-only
   navigation;
4. switch to PT and lb, inspect every primary flow and bodyweight copy;
5. deny notification permission, grant it, revoke it externally, and return;
6. end a block, cancel onboarding strategy, then complete it;
7. export a backup, replace and merge it, then verify offline reload.

### Baseline note

At audit time:

- `node --check` passed for `app.js`, `i18n.js`, `notify.js`, and `schedule.js`;
- the pure schedule suite passed 8/8;
- browser suites could not start in this Cloud checkout because the
  `test/` Playwright package was not installed in the environment. This is an
  environment limitation, not a passing product signal. The retained findings
  are backed by hands-on browser reproduction and current code evidence.

## Previously reported claims rejected or corrected

These are recorded so a future audit does not re-file stale or contaminated
observations:

- **History search is not generally broken.** Current code searches day and
  displayed exercise name. Muscle-only queries are outside the documented
  contract. The real defects are hidden-filter state, wrong zero-result copy,
  and keyboard-inaccessible rows.
- **Hiding History search does not clear the filter.** It leaves the active
  query hidden, which is confusing for the opposite reason.
- **Blank History load does not revert by design.** Current code converts it to
  zero and removes that set row. The retained finding is silent deletion and
  non-atomic validation.
- **Workout overflow already closes on outside click/touch and Escape** at
  `app.js:3127-3137`.
- **A global visible focus ring exists** at `styles.css:178-180`. The retained
  accessibility issue is missing modal/session semantics, not a claim that no
  focus style exists anywhere.
- **Settings → Create new program → Cancel does not itself complete the old
  program** in current code. The real premature-completion path is Block Review
  → Start from onboarding again → Cancel.
- **Delete all data does not reset settings or replace the program** in current
  code. It clears log and draft only; the retained issue is misleading scope
  copy.

## Definition of done

The pre-launch remediation is complete only when:

- all 24 retained findings have automated regression coverage or a
  deterministic static assertion where browser automation is not applicable;
- the manual launch smoke passes in EN/PT and at all three phone sizes;
- no user action silently deletes or partially restores a draft, rolls back
  newer durable state, or silently writes coerced set data;
- every visible notification state matches effective browser permission;
- pinch zoom works and meaningful normal text meets 4.5:1 contrast;
- `node --check` is clean and every focused/browser suite reports zero
  failures; and
- service-worker cache/version and asset coverage are correct for every changed
  shell file.
