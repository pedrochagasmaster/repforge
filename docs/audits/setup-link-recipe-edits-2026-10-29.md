# Edited generated programs in a setup link (#527): measurement, 2026-10-29

Investigation only; nothing here is implemented or decided. It answers one
question from #527: can an edited, multi-week generated program travel
losslessly inside the current v4 setup-link envelope, and in what form?

## Method

Production code at `main` 4ddd1f53: `shared-setup.js` v4 `encode`,
`program-compiler.js` generator `073.4`, the Plan 067 catalog fixture
(`plans/067/data/app_file.json`) and the request in
`services/install-transfer/test/fixtures/program-definition-plan067-worker.json`
with 7 cycles, no deloads, `split: "auto"`. No user data: the owner's exported
file stays private, as #527 asks. The shapes are sanitized equivalents.

The "patch" rows are **estimates**: the production v4 recipe tuple plus a
deterministic patch, gzipped in one stream with Node's zlib. Two patch shapes:

- **leaf patch:** every changed leaf path with its new value. Arrays whose
  length changed are replaced whole.
- **id-keyed patch:** arrays of objects with `id`s (days, slots, cycles, sets)
  are matched by id. A changed order is one `order` entry, an inserted element
  is stored as a diff from its predecessor, and the rest is per-leaf. Nothing
  is dropped: applying it to the regenerated baseline reproduces the edited
  definition exactly.

The "typical review" edit set is: add one set (in every cycle) to two slots,
add 30 s rest to one slot, change one rep range, rename one day, swap the
order of two slots. The heavier set adds two movement swaps on top.

Limits (`shared-setup.js`): 3,072 fragment characters and 2,301 compressed
bytes.

## Results

| Program | Sets | Definition JSON | Unchanged (production) | One rest change (production) | Recipe + id-keyed patch: one rest change | Typical review | Typical + 2 swaps | Leaf patch, typical | Full definition gzip (plain JSON) |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 3 days, 60 min, 18 slots | 315 | 143,658 B | recipe, 941 chars / 703 B | refused (full form) | 1,414 / 1,058 B | 2,923 / 2,190 B | **3,073 / 2,302 B** | 4,030 / 3,020 B | 12,287 / 9,213 B |
| 3 days, 90 min, 30 slots | 462 | 211,167 B | recipe, 941 / 703 B | refused | 1,325 / 991 B | 2,591 / 1,941 B | 2,721 / 2,038 B | 3,442 / 2,579 B | 16,110 / 12,080 B |
| 4 days, 60 min, 22 slots | 434 | 191,841 B | recipe, 938 / 701 B | refused | 1,322 / 989 B | 2,881 / 2,158 B | 3,030 / 2,270 B | 3,690 / 2,765 B | 14,982 / 11,234 B |
| 5 days, 60 min, 31 slots | 532 | 238,095 B | recipe, 954 / 713 B | refused | 1,435 / 1,074 B | 2,331 / 1,746 B | 2,482 / 1,859 B | 3,225 / 2,416 B | 17,503 / 13,125 B |

Cells are encoded characters / compressed bytes. Bold: over a limit.

A cycle-delta compaction of the full definition (cycles 2–7 stored as
differences from the cycle before) only gets to 8–11 KB compressed. That's
3.5–5× over the cap. No exact canonical compaction of the full form comes
close.

## Findings

1. **Any edit loses the link today.** One rest-time change on one slot turns
   the regenerable recipe (≈940 chars) into the full form, and the full form
   is refused (9–13 KB compressed against 2.3 KB). The gzip stream is bounded
   at the cap, so a refusal reports no exact size. The plain-JSON figures above
   are an upper bound for the v4 full form.
2. **Provenance isn't the blocker.** The current generator stamps
   `provenance.source: "recovered_generation_rules"` itself, and such programs
   still encode as a recipe. #527's report that the definition's source is
   `recovered_generation_rules` describes current generated output, not a
   recovered import. The edits are what made it full-form.
3. **A recipe plus an id-keyed patch fits for light and typical edits.** One
   edit costs about 1 KB, and a typical review session 1.7–2.2 KB compressed,
   under the 2,301 B cap. Two extra swaps reach the cap exactly on the 18-slot
   program. So it fits ordinary review edits, but with no headroom for heavy
   editing.
4. **The patch shape decides it.** A naive leaf patch is 25–40% larger and
   misses the cap on every shape. An op vocabulary that names "every set of
   this slot" or "every cycle" once, instead of repeating per-set leaves, would
   be smaller again. This report doesn't measure that.
5. **Generator-version coupling.** A recipe link, and so a recipe-plus-patch
   link, decodes only on the generator version that made it. `regenerate`
   refuses with `unsupported-version`, and #317's recorded 067.1 link shows
   this. The same holds at encode time: a program generated before the last
   generator bump (`073.x` landed 2026-10-16) no longer regenerates byte-equal
   under the current generator. It would fall back to the full form however
   few edits it has. Programs created before an app update are exactly the
   ones lifters will have edited.

## What a recipe-plus-edits form would need (for the decision; not designed here)

- A fourth v4 definition form (`"p"`: fingerprint, generator version, recipe
  request, patch), decoded as regenerate → apply patch → full
  `validateProgramDefinition` → canonical equality with the sender's
  definition (a digest in the tuple). Any mismatch refuses the link, never a
  partial program.
- Patch semantics that cover every edit the editor can make: set count,
  per-cycle prescriptions, ids, moves and swaps, rest, metric definitions and
  per-side semantics, alternates and custom exercises. Each one needs a
  failing-first round-trip proof in `test/shared-setup-unit.mjs` and the
  browser share journey.
- An amendment to ADR 0007's form list, though not to its privacy or "no
  hosted store" boundary. The payload stays self-contained in the fragment.
- It doesn't help Build, imported or pre-update programs (findings 2 and 5;
  #387). Those still need the file, or the server-backed option in the
  backlog's evidence item.

## Against the backlog's reopen rule

The backlog's "Encrypted server-backed setup links" item already names
recipe-plus-edits as the fix when refusals are mostly `generated_edited`.
This measurement says that form is feasible for light-to-typical edits on
current-generator programs, and not otherwise. Whether to build it still
waits for the reopen evidence: ≥50 installations attempting a link,
`link_refused` ≥10%, split by `program_kind` and `size_vs_limit`. #529 notes
that `share_setup_outcome` currently has 3 events from 1 installation, which
is the owner's own report, not population evidence.

Reproduce: `node <script> <worktree> <daysPerWeek> <minutes>`; the script is in
the description of the PR that added this file.
