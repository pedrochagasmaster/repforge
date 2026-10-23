# An iOS-native feel for Taurifer: prototypes and proposal

**Status:** design prototype for owner review (2026-10-22). Nothing here changes the app.
The prototype is static HTML, CSS and JS in this folder. It uses Taurifer's real tokens
(`tokens.css` is copied verbatim from `styles.css`), IBM Plex, the G icon set and the
Direction D layouts.

**Owner decisions this works within (2026-10-22):** depth is *feel and structure*, which covers
touch physics, the navigation model, sheets and native-style controls. Taurifer's visual
identity stays: Direction D colours, style and the accent budget. The type stays IBM Plex, with
no SF Pro. The work is web only, with no native shell.

**Starting point:** the 22 findings of the Apple-design audit (draft PR #476,
`docs/design/apple-design-audit-2026-10.md` on `audit/apple-design`). This prototype answers
F-1, F-2 (as an option), F-3, F-5, F-7, F-8, F-10, F-11, F-14 (partly) and F-18. It leaves the
copy and semantics findings (F-4, F-6, F-17, F-21, F-22) alone.

## How to open it

| | |
| --- | --- |
| Hub | `index.html`: how to try it, the prototype switches, and before/after for each screen |
| The app, after | `app.html`: Today → Focus → summary, Settings, Program editor sheet, History, the dock |
| Controls lab | `lab.html`: each control on its own, with today's press feedback beside the proposal |
| Deep links | `app.html#focus`, `#settings`, `#daypicker`, `#editor`, `#summary`, `#dock` |

Every URL is relative, so the folder works under any path prefix. It is served from
`127.0.0.1:8772` (tmux session `taurifer-native-feel`) and exposed to the owner's iPhone at
`/native-feel`.

The prototype switches are on the hub and inside the app at Settings → *Prototype only*.
They cover appearance, 200% text, reduced motion, the tip style, the back-swipe mode, wheel or
keyboard entry, Focus in Portuguese, and the day-change undo. They are stored in `localStorage`
under `nf-prefs-v1`.

To test the Home Screen behaviour, open the hub in Safari and use Share → Add to Home Screen
(the folder has its own manifest). The installed copy runs `display: standalone`, so the back
swipe starts at the left edge, as it would in the installed Taurifer.

**Verified so far:** Chromium with iPhone 13 and iPhone SE emulation and synthetic touch, in
light, dark, 200% text in Portuguese, reduced motion and all three tip styles. The interactive
back swipe was released short of halfway and settled back without popping. There were no
console errors. **None of this is physical-device evidence.** The feel on a real iPhone is
exactly what the owner's review is for.

## Research

Sources: the apple-design skill (WWDC 2018 *Designing Fluid Interfaces*, the HIG, the 2026
design principles) and the Appllama library. I took the following from each app:

| App | What I took |
| --- | --- |
| **Strong** (Active Workout, Rest Timer Overlay, Exercise Picker) | The workout is a sheet with a grabber and **one exit, Finish, top right**. Its rest timer runs as an **anchored tip that points at the control** ("Timer running. Tap to edit or skip.") instead of a modal. That is the model for the anchored Focus tip. Its exercise picker is a page sheet that pushes the workout back. |
| **Hevy** (Workout home) | A plain large title with the start action as the first thing under it, and a standard tab bar whose labels do not grow. This supports capping the dock at large text. |
| **Drafts** (Editor Settings) | Segmented controls inside grouped rows, switches with a light off track, and a floating glass tab bar of the iOS 26 kind. This is the model for Settings' Appearance and Units rows and the switch's off state. |
| **Flighty** (Settings) | One × per sheet and nothing else, with grouped rows and chevrons. This is the model for read-only sheets with one exit. |
| **Apple's own apps** (Settings, Health, Fitness, Clock, Reminders), from the HIG and the skill | The large title that collapses into the bar, a bar material that appears only when content is under it, re-tapping a tab to go to the top and then to the root, page sheets that push the presenting view back, medium and large detents, a guarded dismiss when there are unsaved edits, context menus with slide-to-select, `UIStepper` hold-to-repeat, the timer's wheel picker, and the large-content viewer on tab bars. |

The library has no Things or Apollo screens, so the Apollo-style idea, a **full-width back
swipe**, comes from the platform pattern rather than a capture. It is offered below as a choice
because it is what makes a swipe back work inside a Safari tab.

## The patterns

The same structure throughout: what it does, why (audit finding and Apple principle), and what
the web can't do.

### 1. Press feedback (F-3)
- **What:** every tappable control (`[data-press]`) gets its pressed state on **touch-down**
  with no transition on the way in. Primary buttons take a pressed tone one step off their fill
  (`--control-primary-pressed-bg`, PROPOSED) and scale to 0.97. Rows take a quiet wash. Icon
  and text buttons dim to 40%, as iOS bar buttons do. The release returns on a spring, and
  sliding the finger more than 10px off the control removes the highlight. Sliding back
  restores it, and lifting outside does nothing (no click). Controls inside a scroller wait
  60ms before they highlight, so a scroll that starts on a row doesn't flash it; this is iOS's
  `delaysContentTouches`, shortened. Space and Enter show the same state.
- **Why:** response. Today a Log set press is a 0.5% shrink. The release is a spring
  (`pressRelease`, k=900, c=42, ζ≈0.7) baked into a CSS `linear()` curve, so it costs no
  JavaScript per frame.
- **Web limits:** none that matter. The real limit is haptics (see the gaps section).
  `linear()` needs Safari 17.2 or later; older versions fall back to an ease-out.

### 2. Navigation
- **Push and pop with parallax.** A pushed page comes in from the right on `navPush` while the
  page under it moves to −30% and dims by 10%, then reverses on pop. Both are driven by one
  spring value, so a pop started mid-push begins from wherever the page is. Under reduced
  motion it is a 160–180ms cross-fade.
- **Interactive back swipe.** The page follows the finger 1:1. On release the position is
  projected (decelerationRate 0.998). It commits if the projection passes halfway and the
  finger was not moving left; otherwise it settles back on `gestureSettle`, carrying the
  release velocity. A `touchcancel` never commits. Focus never registers the swipe (its deck
  owns horizontal gestures), and neither does the summary, which is a one-way door. Inside the
  editor sheet the swipe works from anywhere on the page, because a sheet has no browser edge
  to share.
- **How it shares the edge with Safari:**

  | Context | Who owns the left edge | What the prototype does | Result |
  | --- | --- | --- | --- |
  | Safari tab | Safari: its edge swipe is history back, with its own snapshot animation | Every push adds a `history` entry, so Safari's swipe and back button pop the stack. A `popstate` within 900ms of a touch near the edge is Safari's swipe, so the page pops **without** a second animation. Any other `popstate` animates the pop. | Safari's swipe works and lands on the right page. In **Auto** mode the app's own swipe is **full width** here (start anywhere right of Safari's edge zone), so a lifter can swipe back without reaching the edge |
  | Home Screen (standalone) | Nobody: iOS gives standalone web apps no system back gesture | The app's own swipe starts within 24px of the edge, as in the shipped app today | Matches a native app |
  | Inside a sheet | The sheet | Full-width swipe on the inner page | Matches iOS's in-sheet navigation |

  The switch offers **Auto / Edge / Full width** to compare. Full width conflicts with horizontal
  content, so `[data-hscroll]`, segmented controls and inputs opt out.
- **Large titles.** Each root page opens with a 30px large title (`--font-size-title`, −0.02em).
  When it scrolls under the bar, the bar's inline title fades in and the bar's material fades
  in (it appears only while content is under it). Pulling down past the top grows the title
  slightly, from its leading edge, as iOS does.
- **Tap the current tab.** On a pushed page it pops to the tab's root; at the root it scrolls to
  the top (instant under reduced motion). Tab switches stay instant (N3: panels switch without
  a slide), and the dock lens travels on `layoutShift`.
- **Web limits:** Safari's edge swipe can't be intercepted or replaced in a tab. A web page can't
  tell for certain that a `popstate` came from the swipe, so the 900ms heuristic is the best
  available. Each tab keeps its own stack, but browser history is one line, so switching tabs
  with pages pushed leaves entries for the other tab. The production version would collapse
  them on tab switch.

### 3. Sheets (F-8, F-19)
- **Detents:** `fit` (sized to its content), `medium` (about half the screen) and `large`
  (full height minus the top inset). The sheet follows the thumb 1:1 and rubber-bands above its
  top detent. A release is projected and snaps to the nearest detent or dismisses. A flick down
  faster than 1,100px/s from the lowest detent always dismisses. At `large` the body scrolls,
  and a downward drag that starts with the content at its top moves the sheet. That hand-off is
  done on `touchmove` with `preventDefault`, the only way Safari allows it.
- **One exit per sheet:**

  | Sheet | Today | Proposed |
  | --- | --- | --- |
  | Why this weight (read-only) | grabber, ×, Got it | grabber, × |
  | Choose another day | grabber, ×, Confirm day, Cancel | grabber, ×. **Tapping a day commits**: the check lands, the sheet leaves after 220ms, and a toast offers Undo (owner choice) |
  | Program editor | Cancel in the header, Done at the bottom | A page sheet with **Cancel and Done in its bar**, which pushes the app back. A swipe down with unsaved changes rubber-bands and asks **Discard changes / Keep editing**, as iOS's `isModalInPresentation` does |
  | Load / reps wheel | – | grabber, Done. The value applies as the wheel turns |
- **Accessibility:** `role=dialog`, `aria-modal`, labelled by the heading. Focus moves to the
  heading, Escape dismisses through the same guard, the page behind is `inert`, and focus
  returns to the opener. The `--kb` and `--vvh` VisualViewport sizing from ADR 0018 is kept.
- **Web limits:** none of substance. Safari's rubber-band on the page under a sheet is held off
  by `overscroll-behavior` and the fixed app root.

### 4. Native-style controls in Taurifer's look
- **Switch (F-10):** the off track is light (`--switch-off-track`), and its 3:1 extent is an
  inset ring in `--boundary-required`. The on track is `--accent-deep`. Pressing stretches the
  knob, as iOS's does. It is a `button[role=switch]`.
- **Segmented control:** `role=radiogroup`. The thumb travels on `layoutShift` and can be dragged
  across segments, and the arrow keys move the choice. Used for Appearance (applies at once),
  Units, and the Progress views.
- **Stepper:** − value +. Hold to repeat after 400ms, then every 90ms, speeding up after 12
  steps. The buttons disable at the limits and the value is announced politely. Used for the
  rest timer and the smallest load change.
- **Action sheet:** the Focus ⋯ menu (Finish workout, Reorder exercises, End without saving).
  It slides up on `navPush` with a separate Cancel. End without saving confirms once more with
  the existing prompt.
- **Context menu:** touch and hold for 450ms (cancelled by 10px of movement). The row lifts in
  a copy at 1.03 over a blurred page and the menu opens beside it. While the finger is still
  down it can **slide onto an item and lift to choose**. Right-click, Shift+F10 and the
  ContextMenu key open it too. Used on Today's exercise rows and the editor's exercises and
  alternates. In the editor it replaces three ↑ ↓ × buttons per alternate (F-14).
- **Pull-down menu:** Language in Settings and Day in the editor's exercise page, with a check
  on the current value.
- **Wheel picker:** a native `scroll-snap` column, so the momentum is Safari's own, with each
  item tilted by its distance from the centre. `role=spinbutton` with arrow keys. In Focus,
  tapping the already-selected field opens it in a `fit` sheet. The *Keyboard* switch keeps
  today's typed entry for comparison. The pads stay either way, and holding − or + repeats.
- **Web limits:** a wheel picker can't produce iOS's detent ticks or haptic clicks. A web
  context menu can't show a system preview or escape the page bounds. Long press needs
  `-webkit-touch-callout: none` on the row, or iOS shows its own callout.

### 5. Materials (F-11)
- The top bar is glass (`--bar-glass`, `blur(20px) saturate(180%)`) that **appears only while
  content is under it**. The dock keeps its approved Liquid Glass. A bottom scroll-edge fade
  sits under the dock so text never collides with it. At 200% text the dock uses its opaque
  material. Menus are glass, while action sheets and dialogs stay on the solid surface.
  `prefers-reduced-transparency` makes all of them solid. Each material has its own light and
  dark values.
- **Web limits:** `backdrop-filter` costs GPU time on older iPhones. Keep it to the bar, the dock
  and menus, and never stack one glass on another.

### 6. Tips (F-2, shown as an option)
The owner chose the centred dialog (2026-10-17 and 2026-10-21), and it remains in the
prototype. Two alternatives can be switched on:
- **Anchored** (the default in the prototype, for comparison only): a dark callout above the
  shelf, pointing at it, with ×. It **doesn't block**: logging a set dismisses it and logs in one
  tap. This is how Strong presents its timer tip.
- **Inline:** one row at the top of the shelf with ×. At 200% text it takes real room, the same
  cost the 2026-10-21 comparison found.

### 7. Large-text resilience (F-1, F-5)
- **Focus at 200%:** the exercise name moves into the bar, where it already is, and the large
  heading stays for VoiceOver only. The rest clock is capped at 52px, and the label and total go
  on the line under it. The ledger's column head is dropped. Shelf labels and values are capped,
  and the pads scroll sideways instead of growing. After every render, the open set is scrolled
  into view above the shelf (`scroll-padding-bottom` is the shelf height). Try it with Text size
  200% and Focus language Português.
- **Dock at 200%:** one row and one height. Labels are capped at 1.3× (14.3px) with the opaque
  material. **Touch and hold a tab** for a large-content viewer that shows the tab large; slide
  to another tab and lift to switch. An *Icons only* option is included.
- **Bar titles** cap at 21px, as iOS bars do.
- **Web limits:** the web can't read the iOS Dynamic Type setting directly. The production app
  scales with the root size and the text-size setting, and the prototype simulates 200% with
  `html { font-size: 200% }`.

### Reduced motion (F-18) and interruption
Every spring is interruptible, because a new target starts from the live value and velocity.
Under reduced motion, springs jump to their end state, while pushes, sheets and the summary
cover use a 160–180ms opacity cross-fade with no travel. Press feedback keeps its tone change
but drops the scale. The training-loop beats (set landing) stay as they are. The cross-fade
needs the amendment that F-18 names.

## What a web app can't close

- **Haptics.** iOS Safari does not implement the Vibration API, so set commits, detent snaps,
  switch flips and wheel ticks can't buzz. That is a native-shell item (F-12).
- **SF Symbols and system materials.** The web can only approximate them: we draw the G icon
  set, and `backdrop-filter` is not UIKit's material with its vibrancy.
- **Safari's own edge swipe** in a tab. It belongs to the browser: a page can't take it over,
  restyle it or cancel it, only react afterwards (`popstate`).
- **System controls.** A real `UIDatePicker` wheel, `UIContextMenuInteraction` previews that
  escape the page, and the large-content viewer wired to the accessibility setting are
  out of reach.
- **Dynamic Type.** There is no web API for the user's text-size category.
- **Keyboard accessory and interactive keyboard dismiss.** The web can't add a bar above the
  keyboard or let a drag down the scroll view dismiss the keyboard.
- **Status bar and home indicator.** The web can't tint them per screen or hide them in Focus.

## Implementation proposal (phased, touch physics first)

Each phase is one PR in the existing owners: `motion-layer.js` for gestures and springs,
`motion-polish.css` and `styles.css` for presentation, and `app.js` for routing and sheet
wiring. Every phase keeps reduced motion, the semantic contract and the catalog matrix, and
none adds a dependency. Each estimate is for one engineer and includes the owning
browser-suite proofs and catalog refresh.

| Phase | Scope | Findings | Effort |
| --- | --- | --- | --- |
| **1. Touch physics** | Pressed tokens (`--control-primary-pressed-bg`, the 0.97 scale), the `pressRelease` spring as a CSS `linear()` curve (a vocabulary amendment in the motion audit), the scroller delay and slide-off cancel in one small delegated press module in `motion-layer.js`, and the switch's knob stretch | F-3 | 2–3 days |
| **2. Sheets** | One exit per sheet across the nine sheets, day picker commit-on-tap (plus undo if chosen), `medium`/`large`/`fit` detents and rubber-banding in the existing sheet owner, the editor's Cancel/Done bar and guarded dismiss, and the reduced-motion cross-fade | F-8, F-18, F-19 kept | 4–5 days |
| **3. Navigation** | Large-title collapse and scroll-edge bar material on root pages, tab re-tap (top, then root), parallax and dim under pushed pages, the history integration so Safari's swipe pops cleanly, and the full-width option if chosen | F-9 (back control), F-11 | 4–6 days |
| **4. Controls** | Switch restyle (contract amendment), segmented controls for Appearance and Units, steppers for the rest timer and the smallest load change, the action sheet for Focus ⋯, context menus on Today rows and editor rows (replacing the per-row buttons) | F-10, F-14 | 5–7 days |
| **5. Large text** | Focus at 200% (stacked rest, capped clock and bar title, open set kept in view, sideways pads), dock label cap and large-content viewer, new 200% catalog frames | F-1, F-5 | 3–4 days |
| **6. Optional** | Wheel picker for load, reps and RIR if chosen (2–3 days); the anchored or inline tip if the owner revisits F-2 (2 days) | F-2 | 0–5 days |

Total: about 18–25 working days for phases 1–5, plus up to 5 for phase 6. Phase 1 is
independent and can ship alone. Phases 2 and 3 share the history integration.

## New strings (for owner approval)

The prototype's copy is English, with Portuguese for Focus. Strings that already exist are
reused under their keys and are not listed. These are the new ones, with proposed
Portuguese:

| Proposed key | English | Portuguese | Where |
| --- | --- | --- | --- |
| `today.day_changed` | Training Day {n} today | Hoje você treina o Dia {n} | Toast after the day picker commits (only if the undo is chosen) |
| `common.undo` | Undo | Desfazer | That toast's action (`program.editor.undo` exists and could be reused) |
| `today.row_actions_hint` | Touch and hold for actions | Toque e segure para ver ações | Screen-reader hint on Today's exercise rows |
| `today.skip_today` | Skip today | Pular hoje | Context menu (today's `log.skip` is "Skip") |
| `session.sheet.keep_training` | Keep training | Continuar treinando | Cancel in the End without saving confirmation |
| `program.editor.remove_alternate` | Remove | Remover | Alternate row menu |
| `program.editor.day` | Day | Dia | The editor exercise page's Day menu row |
| `focus.field.picker_hint` | tap again for the picker | toque de novo para abrir o seletor | Accessible name suffix on the selected shelf field (wheel option only) |
| `settings.rest_shorter` | Shorter rest | Descanso mais curto | Rest-timer stepper − |
| `settings.rest_longer` | Longer rest | Descanso mais longo | Rest-timer stepper + |
| `program.editor.step_smaller` | Smaller step | Passo menor | Smallest-load-change stepper − |
| `program.editor.step_larger` | Larger step | Passo maior | Smallest-load-change stepper + |
| `guide.dismiss_aria` | Dismiss tip | Dispensar dica | × on the anchored or inline tip (only if chosen) |

The existing strings reused are: `why.title`, `picker.title_substitute`, `program.editor.details`
or `preview.aria`, `log.restore`, `log.finish`, `program.editor.reorder`,
`session.sheet.abandon`, `session.sheet.abandon_prompt`, `program.editor.discard_changes`,
`program.editor.keep_editing`, `program.editor.move_up` and `move_down`,
`program.editor.remove_exercise`, `program.editor.title`, `dialog.done`, `dialog.close`,
`settings.language`, `settings.appearance.*`, `settings.units`, `settings.rest_timer_short`,
`focus.next_ex`, `toast.program_saved`, `guide.first-set.*`, `today.choose_day_title` and
`today.choose_day_sub`. The strings the proposal **retires** are `today.choose_day_confirm`
("Confirm day") and the read-only sheets' "Got it" buttons.

Anything under *Prototype only*, the deep-link toasts ("Prototype: …") and the Why sheet's body
text are prototype scaffolding, not proposed copy.

## New tokens and vocabulary (PROPOSED)

| Name | Light | Dark | Job |
| --- | --- | --- | --- |
| `--control-primary-pressed-bg` | `#3A3833` | `#C9C1B4` | Primary fill while pressed |
| `--control-pressed-scale` | `.97` | `.97` | Pressed scale (replaces `.995` in `--control-pressed-transform`) |
| `--row-pressed-bg` | ink at 6% | white at 7% | Row, menu item and pad wash while pressed |
| `--switch-off-track`, `--switch-off-ring` | ink at 10%, 1.5px `--boundary-required` ring | white at 10%, same ring | Switch off state |
| `--bar-glass`, `--bar-blur`, `--bar-edge` | paper at 72%, `blur(20px) saturate(180%)` | charcoal at 72% | Top bar scroll-edge material |
| `--menu-bg`, `--menu-blur` | paper at 86% | `#24211D` at 86% | Context and pull-down menus |
| `pressRelease` (motion vocabulary) | k=900, c=42, ζ≈0.7 | | A pressed control returning to rest; used only as a CSS `linear()` curve |

## Owner choices

1. **Press feedback strength.** Proposed: pressed tone plus 0.97 scale on primaries. The
   alternative is the tone only, with no scale.
2. **Back swipe in a Safari tab.** *Auto* (edge in the Home Screen app, full width in Safari),
   *Edge only everywhere* (today's rule: the app's swipe only in standalone), or *Full width
   everywhere*.
3. **Day picker.** Commit on tap is recommended. With or without the *Undo* toast?
4. **Read-only sheets' exit.** × only (recommended), or keep "Got it" and drop the ×.
5. **Program editor.** A page sheet with Cancel and Done in its bar that pushes the app back
   (recommended), or keep Done at the bottom.
6. **Switch off state.** Light track with a 3:1 ring (needs a semantic-contract amendment), or
   keep today's dark track.
7. **Context menus.** On Today's rows and the editor (recommended), editor only, or none.
8. **Load and reps entry.** Wheel picker on a second tap, typed entry (today), or both behind a
   setting.
9. **Tips.** Keep the centred dialog (the current decision), or switch Focus (and Progress) to
   the anchored or inline tip.
10. **Dock at 200%.** Capped labels with a large-content viewer (recommended), icons only, or
    today's 2×2 grid. Either change needs the contract amendment that F-5 names.
11. **Reduced motion.** A 160–180ms cross-fade for pushes and sheets (F-18; amends the
    "alternate state" rule), or keep the instant cut.
12. **Sequencing.** Ship phase 1 (touch physics) alone first (recommended), or bundle phases
    1–3.
