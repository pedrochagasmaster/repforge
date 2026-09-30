# Plan 025 (design spike → gated build): Lifters who already train in Taurifer can receive a coach's setup link without losing their program

> **Executor instructions**: This plan is a **design spike with a gated
> build**. Phase 1 produces a design note, a draft ADR amendment, and
> characterization tests. It **stops for owner approval**. Phase 2 is outlined
> only; if approved, the advisor should expand it into its own plan. Do not
> start Phase 2 on your own. Update this plan's row in `advisor-plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 76a31602..HEAD -- app.js program-entry.js shared-setup.js docs/adr/0007-shared-setup-links.md test/shared-setup-flow.mjs`

## Status

- **Priority**: P2 (direction; must work before alpha participants receive a second program)
- **Effort**: M (Phase 1); M–L (Phase 2)
- **Risk**: LOW (Phase 1 is docs and tests) / MED (Phase 2 changes an entry gate)
- **Depends on**: advisor plan 001 (it guarantees that activation archives any existing program, which this design relies on). Product/UX work waits for the overhaul (Q604); the entry and management plans (054/057) own the surfaces involved.
- **Category**: direction (program relationship)
- **Planned at**: commit `76a31602`, 2026-09-23 (on `origin/ui-overhaul/057-management-surfaces`)
- **Backlog**: **Gated**: the "Existing-user shared-program handoff" row in §5. Gate: an owner-approved design (this plan's Phase 1) before any participant receives a second coach program; product/UX work, so it waits for the overhaul (Q604, Q615).

## Why this matters

Creator-led distribution (thesis §13.3) means a coach sends a program link, and later sends the *next* program. Today that second link is refused outright: `setup.shared.existing` = "This setup link can only be started during initial setup." ADR 0007 chose this deliberately ("Replacing an in-use program from a link remains a later product"). The product is now approaching that "later". The machinery to do it safely **already exists** for other routes. The entry hub can replace an active program, and it archives the old one first. This is a small, well-grounded extension rather than new infrastructure.

## Current state

- **Gate** (`app.js` at `76a31602`): `const sharedSetupEligible=()=>firstRunPending()&&!(state.programHistory?.length);` (around line 14901) and `const firstRunPending=()=>!state.programMeta?.onboarded&&!state.log.length;` (around 15086). When the device is ineligible, `prepareSharedSetup` sets `sharedSetupDraft.status="existing"` (around 16048-16051), and `handleSharedSetupHash` shows the `setup.shared.existing` toast (around 16060).
- **Shared route already exists** in the entry state machine: `program-entry.js:54` `const ROUTES = Object.freeze(["recommend", "custom", "browse", "build", "import", "shared"]);`. `commitSharedSetup` (around `app.js:14927`) hands the decoded payload "to the same candidate preview and activation state machine used by every other entry route; no durable program write happens until the shared preview's explicit activation action".
- **Replacement with archive already exists**:
  - `i18n-en.json:1799` `"entry.preview.activate_replace": "Archive current program and use this one"`
  - `:1568` `"entry.active_notice": "Your current program stays active until you confirm a replacement."`
  - `app.js:13805` `const activateLabel=hasActiveProgram()?t("entry.preview.activate_replace"):t("entry.preview.activate_first");`
  - `captureProgramReplacement(snapshot,review)` / `archiveCapturedProgram(proposal,cap)` (`app.js:3143-3150`) move the old program and structure into `programHistory`
  - an `activation_conflict` entry step handles a live workout draft
- **ADR 0007** (`docs/adr/0007-shared-setup-links.md:37-39`, `84-87`): configured state (onboarded, any log, any archived history) "never opens the gate and never mutates"; "Silently replacing an existing program, or clearing archived history, is out of scope so a forwarded link cannot overwrite someone who already trains in Taurifer." The payload formats (`v1.`/`v2.`/`v3.`) are locked. This design must not touch them.
- **iOS handoff cookie** (`repforge_setup_v1`): it carries a link into a *first* Home Screen install. For an existing installed user the cookie path may not apply. That is an open question for the design note.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Setup | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` | exit 0 |
| Setup-link suite | `node tools/run-tests.mjs entry --suite shared-setup-flow` | exit 0 |
| Doc checkers | `node tools/check-canonical-contradictions.mjs` | exit 0 |

## Scope

**Phase 1 (in scope):**
- `docs/design/existing-user-setup-handoff.md` (create): the design note
- `docs/adr/0007-shared-setup-links.md`: a **draft** amendment section clearly headed "Proposed amendment (not accepted)"
- `test/shared-setup-flow.mjs`: characterization cases only

**Out of scope for Phase 1:** any `app.js` change; any payload or codec change; the iOS cookie mechanics.

## Steps (Phase 1)

### Step 1: Characterize today's behavior for configured devices

Add `runCase`s to `test/shared-setup-flow.mjs`, modelled on `"Configured state and archived history refuse replacement"`, for:
(a) an onboarded program with log rows;
(b) an onboarded program with a live workout draft (seed a DraftV2 the way the existing draft-conflict cases in that file do; search for `repforge_draft_v1`);
(c) an onboarded program with archived history.

Each asserts today's refusal (toast text, no durable change) and logs `CHARACTERIZATION`.

**Verify**: `node tools/run-tests.mjs entry --suite shared-setup-flow` → exit 0.

### Step 2: Write the design note

`docs/design/existing-user-setup-handoff.md` must decide and justify:
1. **Entry**: for a configured device, a valid link opens the existing entry hub on the `shared` route in **replacement mode**, not the first-run gate. The preview shows `entry.active_notice`; activation uses `entry.preview.activate_replace` and `archiveCapturedProgram`.
2. **What is preserved**: all log rows, all `programHistory`, custom exercises (collision rules as today), and device settings. Which of the link's eight allowlisted settings apply to an existing user: recommend **none automatically**, with language offered only as an explicit choice.
3. **Live workout**: reuse `activation_conflict`; never discard a live draft.
4. **Consent copy**: EN/PT drafts that name the coach's program and say that the current program will be archived and not deleted.
5. **Forwarded-link safety**: a stranger's link must not be one tap from replacing a program. Recommend an explicit second confirmation for configured devices.
6. **iOS**: whether the cookie handoff applies; recommend fragment-only for configured devices.
7. **Telemetry**: `program_activated` with route `shared` already exists. `program_transition_selected` (`switch`) may be the right event for this flow; coordinate with plan 023's `RESERVED` list.
8. **Tests for Phase 2**: list each case (a)–(c) flipped into the new expected behavior, plus a forwarded-link cancel path that leaves the state byte-identical.

**Verify**: the note exists and covers all 8 headings (`grep -c "^## " docs/design/existing-user-setup-handoff.md` ≥ 8).

### Step 3: Draft the ADR 0007 amendment

Append a section "Proposed amendment (not accepted): existing-user handoff" summarizing the decision in 5–10 lines, and explicitly stating that the payload formats and the first-run gate for fresh devices are unchanged.

**Verify**: `node tools/check-canonical-contradictions.mjs` → exit 0. If the checker treats the draft as contradicting the accepted text, put the draft in the design note instead.

### Step 4: STOP for the owner decision

Report the design note path and the characterization output, and ask for approval and scheduling in `docs/backlog.md`.

## Phase 2 (outline only — expand into a new plan after approval)

Gate change (configured devices route to replacement mode instead of `status:"existing"`), entry hub wiring, copy in both catalogs, flipped tests, UI catalog captures for the new states, the cache ritual, and ADR 0007 amendment acceptance.

## Done criteria (Phase 1)

- [ ] 3 characterization cases pass
- [ ] Design note and draft ADR amendment exist; the doc checker passes
- [ ] No `app.js`/codec change (`git diff --stat -- '*.js' ':!test/**'` is empty)
- [ ] The owner decision is requested; the `advisor-plans/README.md` row is set to BLOCKED (awaiting owner) or DONE

## STOP conditions

- The characterization shows a configured device *can* already be replaced by a link. That is a live bug: report immediately (see plan 001).
- The design needs a payload-format change. That is out of scope and requires plan 026's versioning path.

## Maintenance notes

- Next-program transition at block end (resume/repair/rebase/switch) shares this archive-and-replace machinery. Design both consistently.
