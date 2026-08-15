# How Taurifer decides what you should lift next

This document explains, in plain language, the complete progressive-overload
mechanic built into Taurifer: what the app measures, what it learns about
you, and every rule it uses to suggest the next weight and rep target —
between workouts and live during one. There is no code here and as little
jargon as possible; where a term is unavoidable, it is defined the first
time it appears.

Everything described below is deterministic: the same training history
always produces the same suggestion. Nothing is sent anywhere; all of it is
computed on your device from your own log. The suggestions are exactly
that — suggestions. Anything you type over them wins, always.

---

## 1. The goal: progressive overload by double progression

Muscles grow when they are asked to do slightly more than last time.
"Slightly more" can mean more weight on the bar or more repetitions with the
same weight. RepForge uses the classic **double progression** scheme to
combine the two:

1. Every exercise has a **rep range** you chose for it — say 6 to 8.
2. You work with a fixed weight and try to add repetitions from workout to
   workout, climbing from the bottom of the range toward the top.
3. When you've shown you're strong enough beyond the top of the range, the
   weight goes up and the rep target comes back down inside the range.
4. Repeat, forever.

The rest of this document is about how the app decides where you are on
that ladder — and when it's safe, or overdue, to take the next step.

## 2. What you record

For every working set you log three numbers:

- **Weight** — what was on the bar (or the machine stack).
- **Reps** — how many repetitions you completed.
- **Effort** — how close to your limit the set was, recorded as
  **reps in reserve**: the number of extra reps you honestly could have done
  before failing. 0 means you had nothing left; 2 means you stopped two reps
  short of failure.

If you prefer words to numbers, the app has an effort mode with three
choices — *easy*, *hard*, and *max* — which it reads as roughly 3, 1, and 0
reps in reserve.

Two small conventions:

- If you leave effort blank, the app assumes 1 rep in reserve — a cautious
  middle guess.
- Sets marked as warm-ups are ignored by everything below. Only working
  sets teach the app anything.

## 3. The core idea: effort counts as reps

The engine's central concept is called **capacity**: what a set proved you
*could have done*, not just what you chose to do.

If you did 6 reps and stopped with 2 in reserve, you demonstrated 8 reps of
ability at that weight. The app treats those two facts — 6 performed, 2
in reserve — as one number: capacity 8. Someone else doing 6 reps with
nothing left in the tank demonstrated capacity 6. Same logged reps,
different demonstrated strength, and the app tells them apart.

This one idea fixes a family of problems at once:

- **Training to failure is never punished.** If you deliberately take every
  set to 0 reps in reserve, your capacity simply equals your performed
  reps. The app reads that as a fact about how you train, not a mistake to
  correct. It will never nag you to "leave more in the tank."
- **Stopping early is never misread as failing.** Getting 5 reps in a
  6-to-8 range with 2 in reserve means you *could* have hit 7 — you're fine,
  and the app won't lower your weight over it. Getting 5 with nothing left
  is a genuine shortfall, and it will.
- **Graded effort gives graded advice.** A set at 4 in reserve and a set at
  2 in reserve used to look identical to the old engine. Now one shows more
  spare strength than the other, and the suggestions respond
  proportionally.

### The trust ceiling

Reps-in-reserve estimates are accurate near failure and increasingly a
guess far from it — nobody really knows whether they had 6 or 9 reps left.
So the app only credits reps in reserve **up to a ceiling of 4** (the same
"hard set" threshold you can adjust in Settings). Log a set at 7 in
reserve and it counts as 4 for capacity purposes. The word-based effort
mode never exceeds 3, so it always sits inside the ceiling.

### One strength number across different weights

Comparing "100 kg for 8" with "102.5 kg for 6" needs a common yardstick.
The app uses a standard strength-coaching conversion in which every rep of
capacity is worth roughly 3% of the weight. That turns any set into a
single **strength score** that can be compared across weights — and, run
backwards, it can *predict* how many reps a given strength score should
allow at any other weight. That prediction is what powers everything in
sections 5 through 8.

## 4. What the app learns about you

From your recent history (the last three sessions of each exercise), the
app maintains two personal reference points per lift. Both are
measurements of how you actually train — never targets you're pushed
toward.

- **Your usual effort margin.** The typical reps-in-reserve you tend to
  keep. A to-failure lifter's margin is about 0; a more conservative
  lifter's might be 2. When the app predicts how many reps you will
  *actually perform* (rather than could perform), it subtracts this margin
  from your capacity — so its targets land at the effort level you already
  train at, whoever you are.
- **Your capacity baseline.** Your recent typical strength score for the
  lift. Today's performance is read against it: clearly below baseline
  means you're having a rough day; at or above means business as usual.
  A lift needs at least two logged sessions before it has a baseline at
  all.

## 5. Between workouts: the recommendation on each exercise

Before you train, every exercise carries a recommendation computed from
your last session with it (plus a couple of longer-horizon safety checks).
The app looks at your last session's typical set — the median, so one odd
set can't skew it — works out the capacity you demonstrated there, and
walks down this ladder. The first rule that matches wins:

| What it says | When it fires (plain language) | What happens |
|---|---|---|
| **New lift** | No history yet. | Pick a weight you can handle for your rep range with a little in reserve; the app starts learning from your first session. |
| **Add load ++** | Your demonstrated capacity is at least **3 reps past the top** of the range. | The weight jumps **two steps** at once — you've clearly outgrown it. |
| **Add load** | Either every set's performed reps reached the top of the range (one near-miss is forgiven when you did 3+ sets), **or** your capacity is at least **1 rep past the top** — even if you never performed top reps. | The weight goes up one step. This is the heart of the capacity idea: showing 6 reps with 3 in reserve in a 6-to-8 range proves the same thing as grinding out 8 — you don't have to spend extra sessions climbing reps you already own. |
| **Back off** | Your capacity — not your performed reps — falls short of the **bottom** of the range. | The weight comes down one step so you can rebuild inside the range. |
| **Stalled · deload** | Three sessions in a row at the same weight with no improvement in best reps. | Take a lighter session or add a set, then rebuild. |
| **Hold · recover** | You ground very close to failure last session and still didn't beat the one before it. | Keep the weight; bank recovery instead of pushing. |
| **Push reps** | You're keeping **2 or more reps in reserve** beyond what you perform, and your capacity still fits inside the range. | Keep the weight and take sets closer to your limit before adding load. |
| **Hold · add reps** | None of the above — the normal middle of the ladder. | Keep the weight and chase one more rep than last time. |

Two long-horizon signals temper this ladder:

- **Block trend.** Across the current training block (mesocycle), the app
  tracks whether your strength on this lift is rising, flat, or falling.
  A falling trend downgrades an aggressive double jump to a single step —
  a block that is losing strength shouldn't leap.
- **The heat gauge.** Each recommendation carries a "temperature" shown in
  the interface — hot for aggressive progress (add load), cool for
  caution (back off, recover). It's a reading of the same decision, not a
  separate judgment.

### How big is a step?

A weight step is **2.5% of the current weight, or 2.5 kg, whichever is
larger** (both adjustable in Settings). "Add load ++" uses a double-size
percentage jump (5%), still never smaller than the minimum step. "Back
off" takes one step down, and never below the minimum step itself.

## 6. Rep targets, and re-entering the range after a change

While you're climbing the ladder, the rep target is simple: one more than
you got last time, capped at the top of the range. (During *Hold ·
recover* it stays where it was — recovery sessions aren't for chasing.)

When the weight *changes*, the old behavior of every double-progression
app — reset blindly to the bottom of the range — wastes a session. If you
jump 2.5% after proving 9 reps of capacity, you can almost certainly do
more than the range minimum at the new weight.

So the app computes a **re-entry target** instead: it takes the strength
score you demonstrated, predicts how many reps that allows at the *new*
weight, subtracts your usual effort margin, and clamps the answer into
your rep range. In practice:

- After a small percentage jump, you typically re-enter near the **top**
  of the range — because you really are that strong.
- After a big percentage jump (light lifts, where the 2.5 kg minimum step
  is a large fraction of the bar), the prediction naturally lands at the
  **bottom** of the range — the old reset behavior survives exactly where
  it was correct all along.

The same re-entry logic applies when the weight comes down: the target is
what your demonstrated strength predicts at the lighter weight, not an
arbitrary number.

## 7. During the workout: live suggestions

On the Log tab, every set's weight and reps come pre-filled as a
suggestion (shown ghosted until you touch them or save the set). The
moment you save a set, the app re-thinks every *later* set of that
exercise using what just actually happened. Three rules about respect:

- Sets you've **edited by hand** are never overwritten.
- Sets you've already **saved** are never touched.
- **Warm-ups** neither receive working suggestions nor influence them.

### Anticipating the natural fade

Across a hard session your output naturally declines — 8, then 7, then 6
is a perfectly good day near failure. The old engine suggested a repeat of
your last set and was therefore always one set behind reality. The new one
is **anticipatory**: it predicts the next set from your last set *minus
the fade it expects*, where the expected fade comes from, in order of
preference:

1. **Today's evidence** — if you've saved two or more working sets of this
   lift already, the average decline between them;
2. **Your history** — this lift's typical set-to-set decline over recent
   sessions;
3. **Nothing** — a brand-new lift assumes no fade until it learns
   otherwise.

The assumed fade is capped at 5% per set, so one disastrous set can't
convince the app you're collapsing.

From the predicted capacity of your next set it derives predicted
*performed* reps (capacity minus your usual margin), and then:

- **Prediction at least one rep past the top of the range** → the weight
  goes up one step *mid-session*, with a re-entry rep target at the new
  weight. This is how a genuinely fresh day gets rewarded immediately —
  the first strong set is all the proof needed.
- **Prediction below the bottom of the range** → the weight comes down one
  step, again with a re-entry target, so the rest of the session stays
  productive instead of grinding to singles.
- **Anything in between** → same weight, and the rep target is the
  prediction itself (clamped into the range). If the anticipated fade is
  what lowered the target, the app says so (see section 9) rather than
  leaving you wondering why it suggests fewer reps than you just did.

## 8. Session freshness: how earlier lifts ease later ones

Exercises don't happen in a vacuum. If every bench set today was a grind
well below your usual strength, your incline press is not going to open at
its usual level either. The **session freshness** signal handles this —
carefully, because it's the noisiest signal in the system.

**What it reads.** For each exercise you've already trained today, it
compares today's best strength score against that lift's baseline. Running
below baseline counts as a deficit; running above counts as a surplus.

**How lifts are weighted.** A struggling lift affects an upcoming one in
proportion to how related they are. Sharing a primary muscle counts fully;
a primary-to-secondary overlap counts half; secondary-to-secondary a
quarter. On top of that, every finished lift contributes a small
baseline amount regardless of muscles — whole-body tiredness is real, just
smaller. Exercises with no muscle information still participate through
that shared component.

**What it does.** If the weighted picture shows a deficit, the *opening
set* of each exercise you haven't started yet is eased: the rep target
comes down a little, and only if the eased target would fall below the rep
range does the weight drop a step instead.

**Its strict limits** — each one deliberate:

- **It only ever eases; it never boosts.** A great bench day never talks
  the app into loading extra onto your squat opener. Surpluses can cancel
  out deficits in the average, but the final effect stops at zero.
  (Upward responsiveness comes from a lift's *own* first set — section 7.)
- **It's damped.** Only half of the measured deficit is applied.
- **It's capped.** The total easing can never exceed 5% of predicted
  capacity — a rep or two off an opener, never a rewritten plan.
- **It waits for evidence.** It stays silent until at least three working
  sets are saved across earlier lifts, and lifts without an established
  baseline (fewer than two logged sessions) contribute nothing.
- **It steps aside immediately.** The moment an exercise has its own saved
  set today, its own data takes over and freshness stops touching it.

## 9. The app explains itself

Whenever the live engine steers, a one-line note appears under the
exercise saying why, in words rather than arithmetic:

- last set flew, so the next one is nudged up;
- last set fell short, so the next one is eased;
- sets are trending down, so the target anticipates the fade;
- earlier lifts ran hot today, so the opener starts gently;
- new weight, and this rep target should land at your usual effort.

The goal is trust: the moment a suggestion surprises you is exactly the
moment it must be able to say why.

## 10. The dials in Settings — and what deliberately isn't one

Four settings shape the engine:

- **Weight jump (%)** — the size of a load step relative to the bar
  (default 2.5%).
- **Minimum jump** — the smallest sensible increment for your equipment
  (default 2.5 kg); also the floor a back-off can never go below.
- **Hard-set ceiling** — the reps-in-reserve value above which a set no
  longer counts as hard (default 4). The same number is the capacity
  trust ceiling from section 3.
- **Rep range per exercise** — set on each exercise template; the entire
  ladder pivots around it.

(A fifth setting, the target reps-in-reserve shown when starting a brand-new
lift, only shapes that first-session guidance text — it no longer influences
any decision the engine makes.)

Everything else — the fade cap, the freshness damping and limits, the
capacity margins that trigger jumps — is a fixed part of the engine, on
purpose. They're tuned as a coherent whole, and a settings page full of
engine internals would make every suggestion harder to trust, not easier.

## 11. Worked examples

**The classic climb.** Range 6–8 at 100 kg, training near failure. You log
6, then 7 across sessions, then hit 8 on every set. Capacity now sits a
rep past the top, so: *Add load* → 102.5 kg. Your demonstrated strength
predicts about 8 reps there, minus your near-zero margin — the re-entry
target is 7–8, not a wasteful reset to 6.

**The early jump.** Range 6–8 at 60 kg. After a layoff you log 6 with a
genuine 3 in reserve. Capacity 9 — one past the top plus margin. The very
next suggestion is *Add load*, even though you never performed 8. Under
the old rules you'd have spent two more sessions proving what that one set
already proved.

**The to-failure lifter.** You take every set to 0 in reserve, logging 8,
7, 6 in a 6–8 range. Capacity equals performed reps; the fade across sets
is your normal pattern, and the app learns it. Next session, as you save
each set, the live targets read 8, then 7, then 6 — matching your reality
instead of nagging you to repeat 8 three times or to "leave something in
the tank."

**The rough day.** Two sessions of history on both bench press and incline
press (both chest-primary). Today your first three bench sets all land
well under your bench baseline. Before you start incline, its opening
suggestion eases by a rep or two, with the note "earlier lifts ran hot
today." Your calf raises, sharing no muscles, barely move. Then your first
incline set is strong — and from that moment, incline's own data runs the
show.

**The stopped-early set.** Range 6–8; you log 5 reps but with 2 honestly
in reserve. Capacity 7 — inside the range. The old engine would have cut
your weight for "failing"; the new one holds and expects you to show the
reps next time. Log 5 with nothing left, though, and the weight comes down
one step: that's a real shortfall.

## 12. Principles, in one place

- **Measurement, not judgment.** Reps in reserve is read as information
  about your strength, never as a verdict on how you choose to train.
- **Capacity extends, never retracts.** Demonstrated spare strength can
  accelerate your progression; it can never take away a weight increase
  that your performed reps already earned.
- **Strong evidence beats weak evidence.** Your own saved sets today
  outrank predictions; predictions outrank cross-exercise inference; the
  cross-exercise signal only whispers, and only downward.
- **Everything is explainable.** Every steering decision has a
  plain-language reason attached, in the interface, at the moment it
  happens.
- **Deterministic and local.** Same history, same suggestion, computed on
  your device, every time.
