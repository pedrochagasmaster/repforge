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

The first-run gate (`#firstRun`, "Set up Taurifer") shows the install
section, then Create a program / Import a program, then "Continue in
browser" (or "Continue in Safari"), which takes the install offer off the
table and hands over to the first run the app has always had.

The gate carries two questions — install, and which program — and opens
when **either** is live. Concretely: when `installMode()` offers
something, or when the app is already running standalone. The standalone
half is the one worth stating. A lifter who follows the install
instructions opens the app from its icon and lands on a first run with an
empty store; without that clause they meet the eight-step wizard and lose
Import at the exact moment they went to the most trouble to arrive. There
is nothing left to install there, so the screen opens without its install
section, without the "Continue in browser" link, and with a lede that
drops the install sentence. The same trimming happens in place when
Chrome reports an accepted install. In a browser that can neither install
nor claim to be installed, the screen would add a step and nothing else,
so onboarding opens directly, exactly as before. Chrome usually fires
`beforeinstallprompt` after load and after some interaction, so rather
than stalling boot to wait for it, the gate also opens when the event
lands while first run is still unanswered (an untouched step 0 has
nothing to lose; a lifter part-way through the questions keeps their
place and gets the banner instead).

We rejected: showing the gate on every first run, in every browser
(where nothing can be installed and nothing is installed, it is one more
screen between the lifter and their program — the Import link on
onboarding's first step already covers that case); waiting at boot for an event that
often never comes (it delays onboarding and lets a late `showOnboarding`
stomp on whatever the lifter started meanwhile); and keeping the generic
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
