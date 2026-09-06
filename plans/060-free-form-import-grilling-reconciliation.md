# Plan 060: Free-form import — grilling reconciliation

- **Plan number:** 060
- **Phase:** Not part of the UI overhaul programme (049–059); an amendment to shipped work
- **Status:** Owner-ratified direction; implementation has not started
- **Owner approval state:** The four scope forks in *Ratified forks* are answered and final. Everything under *Resolved conflicts* is a reconciliation call made against the code and is open to reversal on review
- **Depends on:** ADR 0014 (needs the amendment in *ADR 0014 changes*); PR #225 as the base implementation
- **Blocks:** Nothing
- **Governing decisions:** Two independent grilling sessions on PR #225, reconciled here. Where they disagree, this plan is the surviving record
- **Affected surfaces:** `entry` import route (free-form door), `entry.freeform.*` copy in both catalogues, the import review's source disclosure, ADR 0014, the telemetry catalogue
- **Complexity:** High
- **Risk:** Medium — the executable program model, the progression engine and the log are untouched; the blast radius is the import route and one published privacy line

## Problem statement

PR #225 shipped a free-form paste door: paste a program, hand it to ChatGPT or
Claude with a prefilled prompt, bring the reply back, and fall into the existing
import review. Two independent grilling sessions then reviewed it. They agree on
the important things and contradict each other on four, and both rest on two
assumptions about the code that are false.

This plan is the reconciliation. It exists because neither grilling record can be
executed as written.

## What the code actually says

Four findings, all verified against the branch, that move the decisions.

1. **`null` cannot travel through the file parser.** `validImportedExerciseRow`
   (`app.js:8086`) requires integer `sets`, `min`, `max` in 1..1000, and
   `parseProgramSource` (`app.js:8124`) rejects the whole document if any row
   fails. Grilling 2's "explicit `null` in staging, resolved during review" needs
   a second, null-tolerant parse path beside the file one — which is the parallel
   import system both grillings said not to build.

2. **The import review has no numeric editing.** `renderImportReview`
   (`app.js:8525`) is a name → library mapping surface: a source name, an arrow, a
   thumbnail, a status badge, and four actions (`link`, `choose`, `raw`,
   `custom`). It never renders `sets`, `min`, `max` or `day`. Both grillings place
   gap resolution "inline in the existing review". That surface does not exist,
   and building it is a larger change than the whole of PR #225.

3. **The long-prompt fallback races navigation.** `openFreeformApp`
   (`app.js:8857`) calls `copyFreeformPrompt()` without awaiting it and returns
   `true`, so the anchor navigates while the clipboard write is in flight. The
   button still reads "Open in ChatGPT". Both grillings caught a piece of this.

4. **The long-prompt path is the common path, not the edge case.** The prompt
   template is ~1,100 characters before the program is substituted, and
   `encodeURIComponent` roughly doubles text carrying newlines and quotes. Against
   `FREEFORM_URL_MAX=6000` that leaves room for a pasted program of roughly 1,800
   characters. A coach's message with notes clears that easily, and the input cap
   is 12,000. Finding 3 is therefore not a rare-path defect.

And the defect both grillings led with, which needs no adjudication: the prompt
in `entry.freeform.prompt` contradicts itself inside one bullet —

> Do not invent days, exercises or numbers that are not in the program. If a
> number is missing, choose the closest sensible whole number.

The second sentence licenses exactly what the first forbids, and it is the rule
the model will follow because it is the one that lets it finish.

## Ratified forks

Answered by the owner during reconciliation. These are settled.

| # | Fork | Decision |
|---|---|---|
| F1 | Where incomplete programs get repaired | **In the paste door, before parsing.** Neither grilling proposed this |
| F2 | Persistence across the app switch | **Persist in `sessionStorage`**; amend ADR 0014 and rewrite the privacy line |
| F3 | UX ambition | **The progressive three-stage redesign** (Grilling 1's posture) |
| F4 | Telemetry | **The full privacy-safe funnel** (Grilling 2's posture) |

### F1 — gap resolution moves to the paste door

The assistant returns the structure it could read plus a `missing` sidecar naming
what the source never said. Taurifer resolves those gaps in the free-form step,
then assembles a complete document and hands *that* to `parseProgramSource`.

This keeps the claim both grillings care about actually true. The file parser is
untouched. The review screen is untouched. There is no staging schema, no
null-tolerant second parser, and no new activation gate — because nothing
incomplete ever reaches the parser, let alone the program model. Review remains
the trust boundary in the strict sense: every row that reaches it is a row the
lifter completed and will still confirm one by one.

The cost is that free-form gets one step a file import does not have. That is
inherent — a Taurifer export has no gaps — and it is a far smaller divergence than
a second parser.

### F2 — persist, and stop claiming otherwise

The failure this fixes is the primary path, not an edge: iOS discards a
backgrounded PWA page during the switch to ChatGPT, and the lifter returns to an
empty box having lost a message they cannot easily re-paste. ADR 0014 already
half-concedes the problem — it persists `importSourceMode` so a resumed draft
"comes back to the screen it left", just empty.

`sessionStorage` is tab-scoped, survives page discard-and-restore, and dies with
the tab. It is the tightest mechanism that fixes the case.

It is also, unambiguously, Taurifer keeping the text. The screen currently says
*"Taurifer does not keep it."* That line must go. The replacement states the true
narrow guarantee: it is held for this flow only, it never enters history, export,
a state proposal or telemetry, and it is dropped the moment the flow ends.

Grilling 2's Q14 ("do not persist the original source") is **superseded** by this.

### F3 — the three-stage flow

Today `renderFreeformSourceStep` (`app.js:9958`) renders the whole thing at once:
source field, character count, privacy note, both provider links, copy button,
reply field and the review CTA. On a 390px phone the reply box is visible and
typeable before any handoff has happened, and nothing marks what to do next.

Replace with: **Paste → Open assistant → Paste reply**, one route, collapsing
completed stages.

### F4 — the full funnel

Categorical and numeric properties only. No pasted text, no prompt, no reply, no
exercise or program names, ever. Both fields keep `ph-no-capture`.

## Resolved conflicts

Where the two records disagree and the owner did not adjudicate directly, these
are the reconciliation calls.

| Topic | Grilling 1 | Grilling 2 | Resolution |
|---|---|---|---|
| Missing-value encoding | `missing:[{exercise,field}]` sidecar (Q12) | `null` inline in staging (Q13) | **G1's sidecar.** Under F1 the rows never pass through a validator that would reject an omission, and a sidecar keeps the exercise array in the exact shape a file uses |
| Where gaps are repaired | Import review (Q11, Q29, Q59) | Import review (Q12) | **Neither — the paste door.** Both were written believing the review edits numbers. It does not |
| Unsupported information | "Tell the user" (Q30 D, Q42) | Structured localized categories (Q16) | **G2's category enum, rendered as G1's plain sentence.** A fixed enum localizes; unrecognised values are dropped. Shown in the paste door beside gap resolution, non-blocking, no acknowledgement checkbox |
| Raw structured output | Never surface it (Q23) | Structured categories (Q16) | **No contradiction.** The enum is internal; the lifter sees localized prose. No JSON is ever displayed |
| Repair prompt | Diagnostic prompt naming missing fields (Q22, Q27, Q28) | Not addressed | **Keep it, narrowed.** Under F1 missing values are no longer a failure, so the repair prompt exists only for a reply that yields no readable program at all, and says that |
| Long-prompt button | One button, "Copy & open ChatGPT" (Q13) | Copy, await, confirm, then navigate (Q9) | **Overridden — two taps.** See below |
| Source visible during review | Not addressed | Collapsed "View original text" (Q14) | **Adopt.** F2 makes the text available, and checking the import against the source is the point of the screen |
| Provider shown after conversion | No (Q31) | Not addressed | **Adopt G1.** Recording `method` in telemetry is categorical and is not surfacing it |
| Scope | Maximal; PR is provisional (Q1) | Architecture is sound, fix five defects | **Settled by F3** |

### The long-prompt override

Grilling 1 Q13 asks for a single button labelled "Copy & open ChatGPT". Grilling 2
Q9 asks that the copy complete before navigation. Together, as one tap, they are
not safely implementable: awaiting the clipboard write breaks the user-gesture
chain, and the code comment at `app.js:8853` records why a real anchor is used at
all — `window.open` does not survive a standalone install.

So when the prompt exceeds `FREEFORM_URL_MAX`, do not render an anchor. Render a
button that copies, waits, and confirms; on success it is replaced by the anchor,
now labelled to say the prompt is already on the clipboard. On failure the lifter
stays in Taurifer with a manual-copy path and nothing navigates.

Two deliberate taps, no race, no broken gesture chain, and the lifter is told
what is happening before it happens — which is what both grillings were protecting.

## Approved direction

### The prompt contract

Rewrite `entry.freeform.prompt` in both catalogues. It is copy, reviewed and
translated like any other string (ADR 0014), and the contradictory bullet is
replaced by strict transcription:

- Preserve exercise selection, order, day grouping and names exactly as the
  source writes them, in the source's language.
- Never substitute an exercise, never redesign, never invent a day, an exercise,
  a set count or a rep range.
- Where the source gives one rep number, use it for both bounds. That is
  transcription, not invention.
- Where a required value is genuinely absent, omit the field and name it in
  `missing`. Do not guess it, and do not ask a question — return the structure.
- Name anything the source carried that this shape cannot hold in `notImported`,
  using the fixed categories.
- Reply with the JSON and nothing else.

### The reply envelope

```json
{
  "version": 3,
  "meta": { "name": "Program name" },
  "exercises": [
    { "day": "Push A", "order": 1, "name": "Bench press", "sets": 4, "min": 6, "max": 8 },
    { "day": "Push A", "order": 2, "name": "Cable flyes", "sets": 3 }
  ],
  "missing": [ { "day": "Push A", "order": 2, "field": "reps" } ],
  "notImported": [ "rest_times", "rir_rpe" ]
}
```

`notImported` categories are exactly: `rest_times`, `rir_rpe`, `tempo`,
`supersets`, `warmups`, `cardio`, `progression_rules`, `deload`, `other_notes`.
Anything else is dropped rather than displayed.

### Reading a reply

`parseFreeformProgramReply` gains a second pass; the first is unchanged.

1. **Fast path.** Every candidate goes to `parseProgramSource` exactly as today.
   A complete reply parses here and nothing else runs.
2. **Gap path.** If no candidate parses, read the envelope directly: validate its
   shape, take the rows, and pair each `missing` entry to its row. If the only
   thing wrong is absent numeric fields, this is a gap result, not a failure.
3. **Resolve.** Render the gaps as numeric inputs in the paste door, one line per
   affected exercise, naming it. The lifter fills them.
4. **Reassemble and re-parse.** Serialize the completed document and put it
   through `parseProgramSource`. It must pass. If it does not, the reply was
   unreadable and the repair path applies.
5. **Unreadable.** Offer *Try again*, *Try another assistant*, *Edit the reply*,
   and *Copy a repair prompt* that names the actual failure.

`parseProgramSource` stays the only function that yields an import draft. The gap
reader produces a document, never a program.

### Flow and copy

Stages, collapsing as they complete:

1. **Paste a program from anywhere** — source field, counter, privacy line,
   *Continue*. Hard stop at 12,000 characters with the counter as the feedback
   (unchanged).
2. **Open it in ChatGPT or Claude** — the two links, *Preview prompt* as a
   low-emphasis disclosure, *Copy the prompt*. Copying advances to stage 3 with a
   note to come back. Source collapses to a summary with *Edit*; editing it
   invalidates a reply already pasted and says so.
3. **Paste the assistant's reply** — an *Import from clipboard* action first,
   then the reply field, revealed only after a handoff,
   *Review the program*, *Try another assistant*. On return from the app switch,
   scroll this into view and mark it; do not force focus or the keyboard.

Then: gap resolution and the `notImported` disclosure if either applies, then the
existing review, unchanged, with a collapsed *View original text*.

Copy decisions carried from Grilling 1's final round: entry point *Paste from
anywhere*; stage 1 headline *Paste a program from anywhere*; stage 1 body naming
coach, notes or anywhere else; final CTA *Review the program*. *Start over* is
present and secondary. Cancel and door-switch confirm only when meaningful text
would be lost.

### Session contract

`sessionStorage`, one key, holding source, reply, stage and last provider.
Cleared on: successful transition to review, cancel, start over, switching to
file import, and completed activation. It never enters `state`, an export, a
setup link, a state proposal or telemetry. `importSourceMode` stays in
`repforge_ui_v1` as it is.

### Telemetry

Categorical and numeric only, added to `docs/measurement/`:

| Event | Properties |
|---|---|
| `program_import_started` | `source: freeform \| file` |
| `program_import_handoff` | `method: chatgpt \| claude \| copy`, `outcome: opened \| copied \| copy_failed`, `long_prompt: bool` |
| `program_import_parsed` | `source`, `outcome: complete \| gaps \| unreadable`, `gap_count: int` |
| `program_import_review_reached` | `source` |
| `program_activated` | existing properties plus `source` |

### Provider links

ChatGPT and Claude stay first-class ordinary links; the clipboard stays the
deterministic fallback; no confirmation gate beyond the inline disclosure. `?q=`
is not treated as a guaranteed contract: automated tests cover URL construction,
the cap, and both branches of the long-prompt path, and real provider behaviour on
supported mobile shells is verified by hand at release.

## Non-goals

- No numeric editing in the import review, no activation gate, no staging schema,
  no second parser.
- No expansion of the executable program model for rest, RIR, tempo, supersets,
  warm-ups, cardio, progression rules or deloads.
- No API key, account, SDK, backend or proxy, and no request made by this app to
  any provider. ADR 0011 is not front-run.
- No third assistant.
- No AI-specific review screen and no AI branding on the entry point.

## ADR 0014 changes

Both are required; neither is optional under F2 and F4.

- **Persistence.** "The pasted program is never persisted … It lives in memory for
  the length of the flow" is no longer true. Restate as: held in tab-scoped
  session storage for the length of the flow, cleared on exit or import, never in
  history, export, a state proposal or telemetry.
- **Enumerations.** "Nothing in the entry schema, the draft envelope or the
  telemetry catalogue needed a new enumeration" is no longer true. Record the four
  new events and the `source` property.

The ADR's substance is unchanged: this is still a hand-off, not an integration.

## Verification

```bash
node --check app.js
node tools/build-i18n.mjs --check     # i18n.js is generated
node test/i18n.mjs                    # EN/PT key + placeholder parity
node test/exercise-library.mjs        # cache-revision lockstep
node test/generative/run.mjs
REPFORGE_URL=http://localhost:8000/ node test/program-freeform-import.mjs
```

New coverage in `test/program-freeform-import.mjs`: the strict-transcription
prompt has no self-contradicting rule; a gapped envelope produces a gap result
rather than a refusal; a resolved gap reassembles into a document
`parseProgramSource` accepts; an envelope whose gaps cannot be resolved still
refuses; both branches of the long-prompt path, including that nothing navigates
when the copy fails; the session survives a simulated discard and is cleared on
each of the five exits; `notImported` renders localized prose and never JSON.

Because `app.js`, `styles.css` and both catalogues change: bump `CACHE` in `sw.js`
and move every `?v=` revision that tracks it, in `index.html` and `sw.js`, in
lockstep. Read the current number off `sw.js` rather than off `CLAUDE.md`, which
is stale — this branch is at `repforge-v176`, so the next is `v177`, and the
revision is carried by `program-compiler.js`, `program-entry.js`,
`program-entry-adapter.js`, `shared-setup.js` and `app.js`. `program-editor.js`
sits at `v168` deliberately; move it only if it changes.

Because user-visible surfaces change: re-run `node tools/capture-ui-screens.mjs`
and commit the refreshed PNGs, adding the new stage and gap-resolution states to
`docs/ui-screens/manifest.json` with scenarios in
`tools/ui-screens/screens-onboarding.mjs`.

## Standing principles

Carried forward from both records, deduplicated. Where they conflicted, the
resolution above is what survives.

1. This is an import feature, not an AI feature. The lifter is importing a
   program, not using a ChatGPT integration.
2. Taurifer never invents training prescription. The assistant transcribes and
   structures; it does not decide what the program is.
3. Missing and unsupported are different. Missing required data is resolved by the
   lifter before anything parses. Unsupported information is disclosed and does
   not block.
4. Exercise names survive exactly as written, in their own language. The existing
   matching layer maps them; the free-form step never rewrites a name.
5. One import system. One parser, one review screen, one activation.
6. The lifter is in control. Nothing opens an assistant, picks a provider, fills a
   value or discards information on its own.
7. Recovery is first-class. A bad reply never dead-ends.
8. A reply belongs to the source it was generated from. Editing the source
   invalidates the reply.
9. Mobile app-switching is the primary path, and the flow survives it.
10. The privacy line is narrow and exact. What crosses the device boundary is what
    the lifter pasted and chose to send, in a link they tapped. Everything else
    stays here, and what stays here is held only for this flow.
