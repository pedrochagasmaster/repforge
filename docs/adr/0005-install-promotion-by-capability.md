# Install promotion is decided by capability, and first run puts it before the program choice

Taurifer's install promotion read the platform, not the platform's
capabilities. `installInstructions()` branched on `isIOS()`, the Settings
row appeared whenever the app was not standalone, and every browser with
neither a deferred `beforeinstallprompt` nor iOS got "Open your browser
menu and choose Install app" — advice that is wrong in Firefox, wrong in
an iOS in-app webview, and unactionable everywhere it was shown. Install
also arrived late: the banner is a snoozeable interruption over a running
app, so the lifter most likely to want an installed app — someone opening
Taurifer for the first time — met the eight-step program wizard first and
the install offer afterwards, if at all.

Decision (product owner, 2026-08, from the four annotated mockups):
**one function decides which install interface a browser gets, from
capabilities and display mode only, and first run offers the install
before it offers the program.**

`installMode()` in `app.js` returns exactly one of:

| mode | condition | interface |
| --- | --- | --- |
| `none` | standalone display mode, or `navigator.standalone` | nothing is promoted anywhere |
| `native` | a deferred `beforeinstallprompt` is held | the Chromium card; its button asks Chrome to prompt |
| `ios` | iOS/iPadOS Safari | the iOS card; its button opens Taurifer's instruction sheet |
| `safari` | another browser on iOS/iPadOS | an explanation that installing happens in Safari, and no button |
| `none` | anything else | no install section at all |

Precedence is that order, and screen size is not an input at any point —
the same layout serves every width, and no lifter is ever asked which
device they are holding. Every surface (the first-run gate, the banner,
the Settings row, the top-bar button) is written from one reading of that
function by `renderInstallSurfaces()`, and rewritten whenever the reading
can have changed.

Two rules follow from the mockups and are load-bearing:

- **A button appears only where it does something.** No disabled or dead
  install controls; a browser with no mechanism gets no section, and the
  iOS-outside-Safari case gets prose instead of a control.
- **Nothing is claimed that the browser has not confirmed.** The native
  flow calls `prompt()`, awaits `userChoice`, and consumes the event
  whatever the answer. Only `accepted` (or a real `appinstalled`) removes
  the install section and reports an install; a dismissal leaves the
  program choices alone and does not prompt again.

**Chrome's install prompt is Chrome's.** Taurifer never recreates,
styles, overlays, or hard-codes it — its appearance varies by Chrome
version, device, theme, and manifest, and a drawn copy would be a lie the
moment any of those change. The one third-party interface Taurifer does
draw is Safari's toolbar inside the iOS instruction sheet, because Safari
exposes no install event and pointing at the control is the whole
mechanism; it is an illustration, and it is labelled as one in the markup.

The first-run screen (`#firstRun`, "Set up Taurifer") in its full form
shows the install section, then Create a program / Import a program, then
"Continue in browser" (or "Continue in Safari"), which takes the install
offer off the table and hands over to the wizard.

The screen carries two questions — install, and which program — and the
program question is live on **every** first run, so the screen opens on
every first run. It is the one door into a first program. Import used to
reach it only through a text link inside the wizard's first step, which
made bringing a shared program the hidden path and building one from
scratch the default; they are two equal ways to begin and now read as
two.

The install question decides only what the screen contains. Where
`installMode()` has an answer, the install section leads; where it has
none — a browser that cannot install, or the installed app itself — the
screen drops the install section, drops the "Continue in browser" link
(an answer to a question nobody asked), and swaps the lede for one
without the install sentence. The same trimming happens in place when
Chrome reports an accepted install, so the screen a lifter watches during
an install ends in the state a fresh launch would show.

Chrome usually fires `beforeinstallprompt` after load and after some
interaction. Boot does not stall waiting for it: every install surface is
rewritten when the event lands, which adds the install section to a
screen the lifter is already reading. A screen already left for the
wizard is not pulled back — the banner carries the offer from there.

We rejected: gating the screen on install capability, so that browsers
with nothing to install went straight to the wizard (it was the first
shape of this decision, and it failed twice — the installed app fell
through it, and it left Import hidden wherever it applied); waiting at
boot for an event that often never comes (it delays onboarding and lets a
late `showOnboarding` stomp on whatever the lifter started meanwhile);
re-opening the screen over an untouched wizard when the event lands late
(it undoes a tap the lifter has already made); and keeping the generic
"open your browser menu" copy as a fallback (it is a guess dressed as an
instruction — it survives only inside the replayable feature tour, where
it is describing rather than offering).

Copy and visual notes: the install card is the only large orange field in
the app, and it uses `--accent-deep`, not `--accent` — white body copy
measures ~5.5:1 on the deep tone and ~4.0:1 on the brighter one, which is
under AA. The gate's CSS is namespaced `firstrun*` because `.setup` was
already taken by the exercise template's setup-notes line.

Verified by `test/install-modes.mjs` (every mode, both languages, the
native accept/dismiss flows, and the gate's Create/Import/Continue
paths).

## Superseded in part (UI overhaul, Plan 049)

The capability model above stands: `installMode()` readings, buttons only
where they do something, and Chrome-prompt honesty are unchanged. Two scopes
are superseded:

- **First-run composition and promotion timing.** The install-first gate order
  and snoozeable-banner cadence give way to the landing composition (G-09,
  G-18–G-21) and the platform-sensitive, milestone-based promotion with
  cooldown (G-39, G-48, G-72), specified by Plans 053–054.
- **No late-data transfer.** The assumption that installation never moves
  existing data is superseded by the one-hour encrypted install transfer
  (G-71, G-84–G-88; [ADR 0013](0013-temporary-install-transfer.md)). The
  transfer offer, claim/import protocol, recovery snapshot, and divergence
  warning live there, not here.
