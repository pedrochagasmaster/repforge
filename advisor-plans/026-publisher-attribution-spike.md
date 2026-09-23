# Plan 026 (design spike): Choose a compatible versioning path for publisher attribution in setup links, with measured URL-size impact

> **Executor instructions**: This is a **design spike**. It produces a design
> note, a size measurement, and a draft ADR amendment. No production code
> changes. Stop after the report. Update this plan's row in
> `advisor-plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 76a31602..HEAD -- shared-setup.js docs/adr/0007-shared-setup-links.md test/shared-setup-unit.mjs`

## Status

- **Priority**: P3 (direction; P0 before creator pilots, which are not yet scheduled)
- **Effort**: S–M (spike)
- **Risk**: LOW (no production change)
- **Depends on**: none. Plan 025 is complementary: attribution matters most when a coach sends a *second* program.
- **Category**: direction (creator distribution)
- **Planned at**: commit `76a31602`, 2026-09-23 (on `origin/ui-overhaul/057-management-surfaces`)
- **Backlog**: `docs/backlog.md:115` lists "Publisher attribution (deferred) — Later — Reopen only before creator pilots with a new scheduling decision." `CONTEXT.md` ("Publisher attribution"): "approved, unimplemented — P0 before creator pilots … needs an explicit compatible versioning path, not mutation of a locked schema."

## Why this matters

The business model's distribution channel is creators sharing programs (thesis §13.3: "One Taurifer, many publishers"). The thesis names the fields: publisher display name, handle, and a short program description, "text-first". The hard part is not the UI. It is fitting optional text into a **locked, self-contained URL format** with a 3,072-character hard limit, while every released link keeps decoding forever. The code already contains one successful precedent for this problem (`v3.`). This spike picks the path and measures its cost before anyone schedules the build.

## Current state

- `shared-setup.js:2-4`: `KIND = "taurifer-shared-setup"`, `VERSION = 1`, `MAX_ENCODED_CHARS = 3072`.
- `shared-setup.js:1492-1503` (`encode`) validates once, builds `v1.` (canonical JSON), builds `v2.` (compact tuple) unless the payload `needsV3`, builds `v3.`, and emits the shortest:

```js
    const needsV3 = hasOwn(checked.value.program.meta, "progressionRelations") || … ;
    const v2 = needsV3 ? { ok: false, code: "incompatible" } : await encodeCandidate("v2.", packV2(checked.value));
    const v3 = await encodeCandidate("v3.", packV3(checked.value));
```

- `decode` (around `shared-setup.js:1505-1512`) accepts envelope versions 1, 2, and 3 and rejects others as `unsupported-version`, which the app shows as `setup.shared.unsupported`.
- ADR 0007 (`docs/adr/0007-shared-setup-links.md:106-132`): "The semantic document remains kind `taurifer-shared-setup`, version `1`. That inner schema is immutable after release." `v2.` tuple layout and masks are "frozen forever". `v3.` is "a compact tuple extension for the versioned progression envelope. It does not change the v1/v2 decoder contract."
- ADR 0010 (`:221`): "publisher attribution is provenance, never steering."
- Size regression: `test/shared-setup-unit.mjs:910-911` asserts that the "representative complete URL is at most 700 characters".
- Brand/voice for any copy: `docs/brand-guide.md`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Unit baseline | `node test/shared-setup-unit.mjs` | exit 0 |
| Generative | `node test/generative/run.mjs --filter setup` | pass |
| Scratch measure | `node /tmp/attribution-size.mjs` (you write it, outside the repo) | prints sizes |

## Scope

**In scope:** `docs/design/publisher-attribution.md` (create); a draft section in `docs/adr/0007-shared-setup-links.md` headed "Proposed amendment (not accepted): publisher attribution"; a scratch script in `/tmp` (not committed).
**Out of scope:** any change to `shared-setup.js`, the app, tests, or catalogs.

## Steps

### Step 1: Characterize the two candidate paths

The design note must compare:
- **Option A — optional attribution block in the semantic document (still version 1) + a new `v4.` envelope.** This follows the `v3.` precedent: attribution fields are optional, v1 canonical JSON can carry them, `v2.`/`v3.` are skipped when present, and `v4.` extends the tuple. Risk: ADR 0007 calls the version-1 semantic schema immutable. The note must explain whether adding optional fields was how `v3.` shipped. Read `validate`/`pickMeta` in `shared-setup.js` (starting around line 705) and `git log -S"progressionRelations" -- shared-setup.js docs/adr/0007-shared-setup-links.md` for the precedent.
- **Option B — semantic document version 2** (`VERSION = 2`) with a `publisher` block, plus a `v4.` envelope. It is cleaner, but older cached app versions reject such links as `unsupported-version`.

For each option cover: backward compatibility (old app + new link; new app + old link), validator bounds (max chars per field, allowed characters, no URLs or markup), rendering location (handoff gate + block end, per `CONTEXT.md`), and the guarantee that attribution never reaches the progression engine.

**Verify**: the note contains both options with an explicit recommendation.

### Step 2: Measure the size cost

Write `/tmp/attribution-size.mjs`: load `shared-setup.js` via `createRequire` (UMD), take the representative payload used by `test/shared-setup-unit.mjs` (copy it), and add attribution fields at realistic lengths (name 40, handle 30, description 140 characters, including PT diacritics). Encode with the current `encode` (the v1 JSON path will carry the extra fields if the validator allows it; if the validator rejects unknown keys, measure the gzip+base64url size of the canonical JSON manually). Report: base URL length, with-attribution length, delta, and headroom against 700 and 3,072.

**Verify**: a table of the numbers in the note.

### Step 3: Draft the ADR amendment and stop

Add the draft section (5–10 lines) to ADR 0007. Report the recommendation and the measured cost, and ask the owner to schedule the build in `docs/backlog.md`.

**Verify**: `node tools/check-canonical-contradictions.mjs` → exit 0 (or move the draft into the design note if the checker objects).

## Done criteria

- [ ] `docs/design/publisher-attribution.md` has both options, a recommendation, and the measured size table
- [ ] The draft ADR section exists (or its content is in the note)
- [ ] No production change (`git diff --stat -- '*.js'` is empty); the `advisor-plans/README.md` row is updated

## STOP conditions

- The measurement shows the representative URL with attribution exceeds 700 characters. Report it; the owner must decide between shorter fields and relaxing the target.
- The precedent analysis finds that `v3.` *did* change the semantic version. Then Option A's premise is wrong; say so.

## Maintenance notes

- The build plan that follows must add generative properties for round-tripping attribution (`test/generative/properties/setup-links.mjs`) and keep decoding `v1.`–`v3.` forever.
