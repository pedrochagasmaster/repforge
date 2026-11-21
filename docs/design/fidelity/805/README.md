# Past zero fidelity for PR #805

The left frame is the approved Past zero prototype with `wu=C&p=C&prog=tie`.
The right frame is the corresponding production catalog state. Each state
has both phone sizes (390 × 844 and 320 × 568), light and dark, and normal
and 200% text in English. Frames are at twice the CSS viewport resolution.
The catalog also includes the Portuguese reading and the immediate chip swap
under reduced motion.

| Frame prefix | State |
| --- | --- |
| `past-zero__` | Confirmed zero with the partial-chip page open |
| `past-zero-selected__` | +3 selected on the 105 kg × 6 squat |
| `past-zero-ledger__` | Logged 6+3 and the tie notice |
| `past-zero-why__` | Explanation for the next working set |

## Visible differences

- The prototype has a Proto tab. The capture waits for its Skip warm-ups
  notice to dismiss. The production working-set flow has no Prelude controls
  in this slice.
- The 105 kg hold, six-full-rep target, shelf columns and six partial chips
  align at normal size. Production uses the existing ledger fold, so an
  upcoming row may be hidden and the catalog opens the logged row where it
  would otherwise fold. The prototype shows all three rows. This changes
  which part of the context is visible above the shelf, especially at 320 px.
- Production prints `6+3` and `6+2` without the prototype's visible gap, and
  tints and reduces the suffix in the CTA, prior-set line and readback.
  Production uses the approved Plan 085 copy for the evidence, Why and
  “since last time” toast. The reference says “over last time.”
- Production retains the app's responsive type rules. At 200% text, the
  chips use two equal rows of three and the effort label wraps at the
  word boundary. The prototype can use unequal rows at 390 px, split
  “Reps” at 320 px, and show a larger cue. Production keeps the shelf
  controls visible while the context scrolls behind them.
- The production rest tab uses the existing contour and focus behavior.
  The prototype draws its own resting outline. Focus indicators and which
  rows remain visible can differ when the working record advances.
- Why uses the existing sheet, headings, details and real recommendation
  evidence. It names the next working target and shows the recorded
  previous sets and tie. The prototype has fixture-only paragraphs,
  including its fixed seventh-rep and stalled statements. The production
  sheet reaches a different section at the bottom of the same viewport.

The History, Progress and finish catalog frames use the existing readers
as their nearest references. The prototype has no separate screens for
those surfaces.

The selected suffix palette has contrast ratios of 4.95:1 and 7.92:1 on
the light and dark page surfaces, and 6.22:1 and 4.81:1 on their CTA fills.

## Device review

Check the numeric-zero page and its selected-chip focus with VoiceOver or
TalkBack. Log the tie, reopen the set and cancel an edit, then verify the
rest controls, Why dismissal and shelf clearance with the keyboard open.
