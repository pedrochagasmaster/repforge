# Apple-design audit of Taurifer (October 2026)

This audit judges Taurifer as a lifter experiences it against Apple's interface
principles (fluid interfaces, the Human Interface Guidelines, the eight design
principles). It respects Taurifer's approved design language, set by the brand
guide, ADR 0012, ADR 0016 (Direction D), ADR 0018, the Plan 058 semantic
contract and the interaction runtime audit. Where an Apple principle and an
approved Taurifer decision disagree, the finding names the decision and
recommends an owner review. It never recommends silently overriding the decision.

**Scope.** First run and onboarding, the program result and editor, Today,
Focus (logging, rest and the keyboard), the session summary, History,
Progress, Program, Settings and the contextual tip dialogs.

**Evidence.** The committed catalog in `docs/ui-screens/` at `7a6bede3`
(paths below are relative to `docs/ui-screens/screens/`), plus `styles.css`,
`motion-polish.css`, `motion-layer.js` and `app.js` at the same commit. I did
not run the app or any tests: the catalog and the code answered every question.
Nothing here is physical-device evidence. Gesture feel, VoiceOver pacing and
the software keyboard on a real iPhone still sit behind the blank cells in
`docs/design/interaction-runtime-device-matrix.md`.

**Prior work.** PR #232 already ran an Apple-design pass over motion. Its fixes are
recorded in `docs/design/interaction-runtime-audit-apple-followup.md`: deck and
sheet interruption, momentum projection, reduced transparency and increased
contrast. This audit does not repeat those findings.

## Executive summary: the top five

1. **Focus breaks at 200% text.** In Portuguese with enlarged text, the rest
   total runs off the screen, the SET and KG column heads print on top of each
   other, and the shelf covers the whole ledger, so the lifter cannot see the
   set they are about to log. The screen people use most is the one that fails
   at large type. (High, [F-1](#f-1))
2. **Tip dialogs block the task they explain.** "Log your first set" appears as a
   centred modal over the Log set button. Apple's tips stay out of the way: they
   sit inline or point at the control and never stop the action. The owner chose
   this presentation on 2026-10-17 and 2026-10-21, so this needs an owner
   decision, not a quiet change. (High, [F-2](#f-2))
3. **The main buttons barely react when pressed.** Log set and Start workout
   shrink by 0.5% and move 1px, and the browser's own tap highlight is turned off.
   On a phone the tap looks unregistered, and this is the tap a lifter makes
   dozens of times a session. (High, [F-3](#f-3))
4. **Sheets ask for too many decisions.** Most sheets offer a grabber, an ×, and
   then a Cancel, Got it or Confirm button as well. The day picker makes the
   lifter pick a day and then confirm it. Apple sheets have one way to finish and
   commit a simple choice the moment it is made. (Medium, [F-8](#f-8))
5. **At large text the dock takes over the screen.** At 200% the four-tab dock
   becomes a 2×2 glass grid. With Start workout above it, the two cover about a
   third of the screen, and page text shows through the glass. iOS keeps the
   tab bar a fixed size and offers a large-content viewer instead. (Medium,
   [F-5](#f-5))

## How to read a finding

Each finding gives its severity, the evidence, the Apple principle involved, a
recommendation, and whether it conflicts with an approved Taurifer decision.
"No conflict" means the recommendation fits inside the current rules.

---

## 1. Typography, spacing and hierarchy

### F-1
**Focus does not hold together at 200% text.** High.

- **Evidence:** `workout/rest-running__phone-390-light-pt-text200.png`. The rest
  total "de 2:00" wraps and is clipped at the right edge. The column heads
  "SÉRIE" and "KG" overlap. The shelf covers the ledger completely, so no set row
  is visible: neither the open set nor the logged-sets disclosure.
  `styles.css:75` sizes the clock with `clamp(2rem,10cqi,2.625rem)`, but the label
  and the total beside it still grow with the root size.
- **Apple principle:** Flexibility. Dynamic Type means the layout scales with
  the text: a larger size may reflow the screen but must never lose content.
  At accessibility sizes iOS stacks what sat side by side.
- **Recommendation:** At large text, stack the rest block: the label and the
  total go on a line under the clock. Collapse the ledger header into the rows,
  or drop the SET column head. Give the ledger a guaranteed minimum (the
  open-set row at least) above the shelf, and let the shelf scroll its pads
  before it covers the open set. Add this frame to the critical matrix. The
  catalog's overflow assertion did not flag it, so check why it passed.
- **Conflict:** None. ADR 0012 already requires the PT 200% frames, and the
  Direction D spec §9 requires 200% text fit.

### F-4
**Headers stack too many levels before the content.** Medium.

- **Evidence:** `today/ready__phone-390-light-en.png` has five heading levels
  before the first exercise: "Today", "Full body / Week 4 of 6", the
  "TODAY'S SESSION" label, "Day 1" and "Today's prescription".
  `onboarding-recommend/result__phone-390-light-en.png` has Back and Cancel, then
  "Recommend", then the "TAURIFER RECOMMENDATION" label, then the title.
- **Apple principle:** Simplicity, not minimalism. Use hierarchy so the most
  important thing is the most obvious. A large title plus one section header is
  the iOS norm.
- **Recommendation:** On Today, merge the "TODAY'S SESSION" label into "Day 1",
  and drop "Today's prescription" or turn it into the ledger's column-head row
  (it already counts the exercises and sets). On the result screen, drop either
  the "Recommend" heading or the label above the title.
- **Conflict:** Partial. Direction D (ADR 0016) owns Today's composition and
  the strings appendix. Removing a heading changes a D screen, so it needs an
  owner decision.

### F-6
**Plex Mono is used for words.** Low.

- **Evidence:** `onboarding-recommend/review-sheet__phone-390-light-en.png`
  ("4–6 reps", "3 sets", "60 s", "PRIMARY COMPOUND" all in Mono),
  `onboarding-recommend/result__phone-390-light-en.png` ("4–6 reps"),
  `workout/early-finish__phone-390-light-en.png` ("sets 2, 3" mixes Sans and
  Mono in one line). `styles.css:1942`, `:1947` put the role label and the column
  heads in `--font-training-data`.
- **Apple principle:** Craft. Typography should be deliberate. Mixing faces in
  one phrase reads as an accident, and Mono's wide letterforms make a word harder
  to read.
- **Recommendation:** Set the number in Mono and the unit word in Sans, as
  Today's ledger already does ("102.5" in Mono, "Last 100 × 8" in Sans). Put the
  review sheet's labels back in Sans.
- **Conflict:** None. The semantic contract already says "choose by value, not
  ancestry" (`ui-system-semantic-contract.md`, Type).

### F-7
**Tracking stops at the title.** Low.

- **Evidence:** `styles.css:462` and `:472` give `title` (30px) −0.02em, and
  uppercase labels get +0.04 to +0.08em. Of the 18 rules that set
  `section-title` (24px) or `feature-title` (28px), only 4 set any tracking.
  The rest render at 0, for example "Day 1" on Today and the sheet titles.
- **Apple principle:** Typography. Tracking depends on size: negative for display
  sizes, near zero for body.
- **Recommendation:** Add a role-level tracking token, about −0.01em for 24 and
  28px and −0.02em for 30 and 40px, and set it on the role rather than per
  selector.
- **Conflict:** None. It adds a token inside Plan 058's type roles and needs no
  new size.

### F-9
**Gutters and header grammar vary between tabs.** Low.

- **Evidence:** Settings rows sit on a 32px gutter, every other tab on 16px
  (`settings/main__phone-390-light-en.png` against
  `today/ready__phone-390-light-en.png`). Settings uses a text "‹ Today" back
  link with a centred title. The onboarding screens use a drawn chevron plus a
  label. Focus uses a bare chevron. Program uses an eyebrow plus an "Edit" link
  that sits lower than the eyebrow (`program/overview__phone-390-light-en.png`).
- **Apple principle:** Familiarity and consistency. Things that look the same
  must behave the same, and one navigation-bar grammar lets people predict
  where Back lives.
- **Recommendation:** Use one back control (the drawn chevron plus the previous
  screen's name) and one header layout for pushed pages. Align Program's Edit to
  the title baseline or to the eyebrow, and give Settings the shared gutter.
- **Conflict:** None for the gutter and Back. Program's header is a Direction D
  screen (ADR 0016), so changing its layout needs an owner decision.

---

## 2. Colour, materials and dark mode

### F-10
**The switch's off state looks heavy.** Low.

- **Evidence:** `settings/main__phone-390-light-en.png` ("Enable voice input",
  off). The off track is `--boundary-required`, a dark taupe
  (`styles.css:636`), almost as heavy as the on track (`--accent-deep`).
- **Apple principle:** Familiarity. Off is a light, recessive track and on is a
  saturated fill, so the state reads at a glance without comparing two switches.
- **Recommendation:** Paint the off track in a light fill and meet the 3:1
  non-text requirement with a required-boundary ring around it, so the track
  itself does not have to.
- **Conflict:** Yes, with the Plan 058 semantic contract, which makes switch
  extents `required` at 3:1. The recommendation keeps 3:1 on the ring. Whether a
  ring satisfies the role is the owner's call.

### F-11
**Content shows under and below the floating dock.** Low.

- **Evidence:** `history/list__phone-390-light-en.png` ("Week 2 · 4 of 4" visible
  below the dock, a green "3 PRs" smeared under its edge),
  `program/overview__phone-390-light-en.png` (column heads under and below the
  dock), `today/ready__phone-390-light-en-text200.png` ("80" and "3 × 6" read
  through the glass).
- **Apple principle:** Materials. Floating chrome uses a scroll-edge effect, a
  blur or fade where content meets it, so text never collides with the bar.
  Translucency shows that content continues, not what it says.
- **Recommendation:** Add a bottom scroll-edge mask on the page, faded paper
  under and below the dock, active only while content is behind it. At large
  text sizes, raise `--dock-glass` toward the opaque value.
- **Conflict:** None. The brand guide allows "a sticky-nav scroll fade" as a
  functional gradient, and the dock's glass is the approved `persistent-action`
  nav variant.

### Dark mode
No defects found. `today/ready__phone-390-dark-en.png` and
`workout/rest-running__phone-390-dark-en.png` keep the hierarchy, use the
parchment primary inversion, and keep elevation shadows dark (semantic contract,
Type, shape, depth). See also [Already good](#already-good).

---

## 3. Touch, feedback and haptics

### F-3
**The primary actions give almost no press feedback.** High.

- **Evidence:** `--control-pressed-transform: translateY(1px) scale(.995)`
  (`styles.css:166`). Log set keeps its fill and only takes that transform
  (`styles.css:1341`). Start workout and Confirm day do the same
  (`styles.css:6734`). The tap highlight is transparent app-wide
  (`styles.css:406`). ADR 0018 says this "relies on the app's existing press
  feedback", but that feedback is a 0.5% scale. The shelf pads and fields also
  take `--well` (`styles.css:1230`, `:1484`), which is visible. The primary
  buttons do not.
- **Apple principle:** Response. Highlight on touch-down, instantly; directness
  "falls off a cliff" without it. Feedback must be visible under the thumb at
  arm's length.
- **Recommendation:** Give primary and CTA controls a pressed fill on touch-down,
  one tone step (`--control-primary-bg` to a pressed token), kept within the
  100ms press transition, and raise the scale to about 0.97 to match
  `motion-polish.css:16`. Keep it instant, with no spring and no rebound.
- **Conflict:** None. Pressed is a shared facet in the semantic contract
  (Controls). The interaction runtime audit keeps press feedback in CSS, and
  this stays in CSS.

### F-12
**There is no haptic or sound on commit, and iPhone gets none at all.** Low.

- **Evidence:** The only haptic is `navigator.vibrate?.([200,100,200])` at the
  end of rest (`app.js:6392`). iOS Safari does not implement the Vibration API,
  so on iPhone a finished rest is silent unless a notification fires.
- **Apple principle:** Multimodal feedback. Use haptics for meaningful moments
  (commit, snap), fired on the same frame as the visual.
- **Recommendation:** Do not chase iOS haptic workarounds. Record the gap, keep
  the notification path as the iPhone rest alert, and treat haptics on set
  commit as a native-app item in the product thesis's native direction.
- **Conflict:** None.

### F-13
**Disabled steppers in the session map are hard to see.** Low.

- **Evidence:** `workout/early-finish__phone-390-light-en.png`: the first row's
  up arrow and the last row's down arrow are faint, close to the page.
- **Apple principle:** Clarity. A disabled control stays legible and explains
  itself.
- **Recommendation:** Check the disabled boundary against the semantic
  contract's 3:1 rule for required marks, or hide the impossible direction rather
  than fading it.
- **Conflict:** None.

Touch targets otherwise pass: the 44px floor is enforced by the contract, and
the shelf uses 56px fields, 48px pads and a 52px action (Direction D spec §4.2).

---

## 4. Sheets, modals and tips

### F-2
**Contextual tips are blocking, centred modals.** High.

- **Evidence:** `workout/first-set-guide__phone-390-light-en.png` ("Log your first
  set" dims Focus and covers the ledger, and the shelf is inert behind the
  scrim). The same presentation is used in `onboarding-start/hub-guide`,
  `progress/overview-guide`, `progress/review-guide`,
  `workout/focus-utilities-guide`, `settings/backup-guide` and
  `settings/install-guide`.
- **Apple principle:** Agency, and HIG tips (TipKit). A tip is inline or a
  popover anchored to the feature it explains. It never blocks the action, and
  the lifter can act on the tip directly. A modal should be reserved for a task
  that needs a decision.
- **Recommendation:** For the owner to consider, at least for Focus and Progress:
  show the tip inline above the shelf (one line and a ×), or anchored to the
  control, and keep the centred dialog for the entry hub only. If the dialog
  stays, let a tap on the explained control dismiss the tip and perform the
  action in one step.
- **Conflict:** Yes. The modal presentation is an owner decision
  (2026-10-17), and the centred dialog won the 2026-10-21 comparison
  (`interaction-runtime-audit.md`, Panels, lists and dialogs, contextual guides
  row; `guide-presentation-comparison.md`). The comparison noted that the inline
  aside "took the shelf's room" on Focus. This audit records the Apple-side cost
  and leaves the decision with the owner.

### F-8
**Sheets have redundant ways out, and simple choices need a confirm step.** Medium.

- **Evidence:** `workout/why-this-weight__phone-390-light-en.png` (grabber, × and
  "Got it"), `today/day-picker__phone-390-light-en.png` (grabber, ×, "Confirm
  day" and "Cancel", and a picked day must still be confirmed),
  `workout/early-finish__phone-390-light-en.png` ("Cancel" plus ×).
- **Apple principle:** Simplicity, and HIG sheets. A sheet has one dismiss
  affordance (Done or Cancel, or the swipe and the grabber) and one commit. A
  single-choice list commits on tap. Duplicated exits make people stop and
  check which one is safe.
- **Recommendation:** Keep the grabber and the swipe everywhere. Then pick one
  button per sheet: × for read-only sheets (drop "Got it" on Why); Cancel plus
  the commit for sheets that commit (drop the ×). Let the day picker commit on
  tap and drop "Confirm day". The day change is reversible from the same sheet.
- **Conflict:** None found. Confirm day predates Direction D, and D's spec
  (§4.1) only restyles the day picker. If a durability reason for the confirm
  exists (for example a draft being replaced), keep the confirm in that case
  only.

### F-14
**The exercise-actions sheet is a long, mixed list.** Low.

- **Evidence:** `workout/exercise-actions__phone-390-light-en.png`. Seven group
  headings, several over a single row ("Exercise substitution", "Exercise
  status", "Exercise notes"), and three full-width outlined "Make warm-up"
  buttons that outweigh every other action. The sheet fills the screen.
- **Apple principle:** Simplicity, and grouping and mapping. Show the common path
  first, put advanced options one level deeper, and use headings only when they
  group more than one thing.
- **Recommendation:** Put the single actions (Repeat last session, Substitute,
  Skip, Notes) in one group with no headings. Move warm-up assignment one level
  down (a "Warm-up sets" row that opens its own list), or use a compact
  per-set toggle in place of three buttons.
- **Conflict:** G-42 (kept by ADR 0016) fixes what ⋯ holds, not its layout, so
  there is no conflict.

### F-15
**The onboarding Continue floats mid-screen on short steps.** Low.

- **Evidence:** `onboarding-start/hub__phone-390-light-en.png`. Continue sits
  directly under the content, about 60% of the way down, with empty paper below
  it. The result screen pins its CTA to the bottom
  (`onboarding-recommend/result__phone-390-light-en.png`).
- **Apple principle:** Flexibility. On iPhone the primary action belongs in the
  thumb zone, and its place should not depend on how much content is above it.
- **Recommendation:** Pin the footer (hint plus Continue) to the bottom safe
  area on every entry step, as the result screen does.
- **Conflict:** ADR 0020 (onboarding candidate B) owns the step layout. Check
  whether B's drawing placed it there on purpose before changing it.

---

## 5. Navigation and wayfinding

### F-5
**At large text the dock grows into a two-row glass grid.** Medium.

- **Evidence:** `today/ready__phone-390-light-en-text200.png`. The dock becomes
  2×2, and with Start workout above it the pair covers about 33% of the screen.
  The icons stay small while the labels double, and page text reads through
  the glass. `app.js` handles the two-row dock as a supported layout
  (`interaction-runtime-audit.md`, Dock lens R6).
- **Apple principle:** Flexibility. On iOS, tab bars do not scale with Dynamic
  Type: they keep their height and show a large-content viewer on long-press,
  so the content area stays usable at accessibility sizes.
- **Recommendation:** Cap the dock's label size, around 1.3× at most, keep one
  row, and use the opaque dock material while the labels are capped. If capped
  labels fail the readability bar, hide the labels at 200% and rely on the
  icons plus accessible names. That is a bigger change and needs a decision.
- **Conflict:** Yes, with the ADR 0012 release matrix and the semantic
  contract's rule that labels and captions cannot be the sole critical control
  text. Capping dock labels needs an owner decision and a contract amendment.

### F-16
**The Progress tab row is cut off at the edge.** Low.

- **Evidence:** `progress/overview__phone-390-light-en.png`: "Re…" for Review is
  clipped at the right edge, with no fade.
- **Apple principle:** Clarity. A clipped word reads as a mistake. A scrolling
  tab row says it scrolls with a fade at its edge.
- **Recommendation:** Add a trailing fade mask while the row can scroll.
- **Conflict:** The horizontal tab row is approved (ADR 0016, superseding G-29:
  "scrolls horizontally at 360 PT"). The fade only adds an affordance and keeps
  the decision.

### F-17
**Rest time appears twice on Focus.** Low.

- **Evidence:** `workout/rest-running__phone-390-dark-en.png`: the header pill
  shows "1:30" and the inline clock shows "1:30 of 2:00".
- **Apple principle:** Simplicity. Every element earns its place.
- **Recommendation:** While the inline clock is on screen, show only the stopwatch
  glyph and a running dot in the header, and show the time once the inline
  clock scrolls away.
- **Conflict:** Yes. Direction D spec §4.2 says the header timer "shows remaining
  time while running". Owner decision.

---

## 6. Motion

The motion system is the strongest part of the app against Apple's principles
(see [Already good](#already-good)). Two gaps remain.

### F-18
**Reduced motion cuts instead of cross-fading.** Low.

- **Evidence:** `.sheet,.sheet-scrim{transition:none}` under reduced motion
  (`styles.css:1569`). The push, deck, indicator and slot runs all "jump to the
  end state" (`interaction-runtime-audit.md`, Reduced motion). The sheet and its
  scrim appear in one frame.
- **Apple principle:** Reduced motion means a gentler equivalent, not none:
  replace slides with a short cross-fade and keep the opacity changes that aid
  comprehension.
- **Recommendation:** Under reduced motion, give sheets, pushed pages and the
  Focus deck a 150–200ms opacity cross-fade with no transform. Leave the
  training-loop beats (set landing, value change) off as they are.
- **Conflict:** Partial. The interaction runtime audit records reduced motion as
  "an alternate state, not a slower animation". A cross-fade keeps that (no
  travel, same information), but it changes a recorded decision, so it should be
  amended there.

### F-19
**The sheet opens on a CSS curve and the release uses a slightly bouncy spring.** Low, informational.

- **Evidence:** A tap opens the sheet with `transform .26s cubic-bezier(.2,.7,.2,1)`
  (`styles.css:1561`). A thumb release settles on `gestureSettle` (ζ≈0.82,
  `interaction-runtime-audit.md`, The motion vocabulary).
- **Apple principle:** Springs by default, and bounce only when the gesture
  carried momentum. Apple's drawer uses damping 0.8 and response 0.3.
- **Assessment:** This already matches. The tap-open has no velocity to carry, and
  the CSS transition is interruptible. The release spring is under-damped only
  where a thumb supplied momentum. No change recommended. It is recorded so a
  later pass does not "fix" it.
- **Conflict:** None.

---

## 7. Safe areas and the keyboard

### F-20
**The keyboard and safe-area handling is thorough, but no physical device has checked it.** Medium (risk, not defect).

- **Evidence:** Every fixed layer budgets `env(safe-area-inset-*)`
  (`styles.css:408`, `:429`, `:2373`, `:2904`, `:3112`). Sheets sit on `--kb` and
  `--vvh` from the VisualViewport owner (`styles.css:1554`, ADR 0018). The C2/C5
  iOS rows in `interaction-runtime-device-matrix.md` are blank, and the owner
  accepted that risk on 2026-09-08.
- **Apple principle:** Craft. Layouts that break on a real device read as
  carelessness. Test in real context.
- **Recommendation:** Before the next lifter-facing release, run Gate A and the
  keyboard rows on one physical iPhone: a shelf field opened for typing, a
  sheet with a text field, and the 320px width.
- **Conflict:** None. Plan 059 and ADR 0018 already name this gate.

---

## 8. Clarity of feedback and copy

### F-21
**A summary row can say "Maintained", "PR" and an up arrow at once.** Medium.

- **Evidence:** `session/summary__phone-390-light-en.png`, Barbell back squat:
  "= Maintained", "✓ PR +2.5 kg over your best", "↑ Next: 105 kg × 6".
- **Apple principle:** Understanding. Feedback must say one clear thing about
  what happened. Three signals pointing three ways make the lifter work it out.
- **Recommendation:** Keep the semantics and change the layout. Show the outcome
  word as the row's verdict and the PR as a separate positive line, and label
  the next target so it is clearly the next session's target. For example, write
  "Next session" in place of an arrow that repeats the verdict column's glyph.
- **Conflict:** Yes. The outcome rule ("outcomes describe the logged sets",
  ADR 0016 decision 4, `CONTEXT.md`) and Direction D's summary (§4.4) produce
  this row by design. Any change to glyphs or wording is an owner decision.

### F-22
**Copy has small craft defects.** Low.

- **Evidence:** `workout/why-this-weight__phone-390-light-en.png`: "over the last 1
  sessions" (plural with a count of one). `workout/focus__phone-390-light-en.png`
  and others: "RIR 1–1" (a range whose ends are equal).
  `program/overview__phone-390-light-en.png`: "Some sessions complete: 4 of 4 in
  the last 7 days" (four of four is not "some"). The rest controls use a hyphen
  in "-30s" while the load pads use a true minus in "− 2.5 kg"
  (`workout/rest-running__phone-390-dark-en.png`).
- **Apple principle:** Craft. Nothing is random.
- **Recommendation:** Add a `_one` template for the Why sentence, collapse equal
  ranges to one value, choose the status line by the count, and use U+2212 on
  the rest pads. All four are i18n-catalog changes in both languages.
- **Conflict:** None. The brand guide's copy rules already require number
  agreement.

---

## Already good

- **The motion system follows Apple's fluid-interface rules.** Sheets and the
  Focus deck track the thumb 1:1, use the exponential projection
  (`decelerationRate 0.998`), hand the release velocity into a spring, can be
  re-grabbed from the on-screen position, and abandon the gesture on
  `pointercancel`. Springs are written as physics, with pixel-scale rest
  thresholds, from one named vocabulary
  (`interaction-runtime-audit.md`, The motion vocabulary;
  `interaction-runtime-audit-apple-followup.md`).
- **Frequency decides how much motion an interaction gets.** The training loop
  gets 160ms acknowledgements that never gate input, rarer moments get more,
  and nothing celebrates. This fits Apple's "utility" rule for feedback and the
  brand's quiet-partner voice.
- **Indicators travel, and are not redrawn.** The dock lens, the Progress tab
  underline, the shelf field ring and the chart marker each move one element
  from its live position. That is spatial continuity done right.
- **Edge-swipe back only runs where it should.** It runs on pushed pages in
  standalone mode, never in Focus, and commits through the visible Back control.
- **The accessibility media queries are covered.** Reduced transparency makes the
  dock opaque, increased contrast strengthens the rules and the dock edge, and
  both are independent of the theme.
- **One-handed logging.** The Focus shelf puts the load, reps and RIR fields, the
  pads and Log set in the bottom third, with large targets. Logging stays
  enabled during rest, and the open set is outlined in the ledger
  (`workout/focus__phone-390-light-en.png`).
- **Dark mode is one token swap.** It keeps the material grammar, uses dark
  shadow channels, and gives the artwork a cream plate rather than inverting it
  (ADR 0009).
- **Restraint with colour.** One accent, used for verdicts, the current segment,
  the drain bar and the active tab, and green only for records. Hierarchy comes
  from weight and size, as Apple recommends.
- **Zoom is allowed.** ADR 0018 keeps pinch zoom and 16px editable text, and
  uses `touch-action: manipulation` only on controls.
