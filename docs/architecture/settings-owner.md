# Settings, installation surfaces and guides

The slice-17 extraction preserves main's current behavior. `src/app/settings.js`
constructs durable proposals, checks whether an in-progress draft locks RIR mode,
and coordinates exact unit-conversion receipts. It emits setting names only.
`src/app/profile.js` interprets each understood Basics answer without rewriting
unknown stored fields. Profile deletion and backup `lastExport` keep the released
`localOk || idbOk` acceptance policy; workout settlement has different rules.
Backup acknowledgement remains in `src/app/interchange.js`.
The immediate RIR-mode guard is followed by the existing WAL protocol: native draft
work acknowledged while a settings proposal waits becomes a sidecar, which
`executeDraftTransaction` refuses before any prepared replica write. The two-tab
Settings proof holds the real state lock, captures the exact effort-mode journal,
acknowledges a new DraftV2 session and verifies settled refusal plus exact draft
preservation. This is existing protocol coverage, not a new parallel preflight.

`src/ui/settings/view.js` owns the form edit revision, decimal validation and
profile display. A failed older save cannot repaint newer input. Appearance owns
only device preferences and concrete document theme; notification controls own
permission-request intent and reject late enable responses after Disable.
`install.js` owns the single-use prompt, banner/landing presentation, install
sheet states and Privacy focus handoff. It cannot read/write storage or run the
transfer protocol; its transfer client exposes named marker/create/confirm/
abandon operations. No client receives mutable application state. The app root
still composes rendering effects after a settings save: reset the rest override,
convert the live bodyweight field, change language and request the owning render.

Proofs are `test/settings-owner.mjs` (real Settings controls, actual replica fault,
private data/export exclusions, guide preference rebase and focus return) and
`test/install-transfer-ui.mjs` (transfer actions, modal focus and offline Privacy).
After adding an owner module, run `node scripts/native-source-assets.mjs --write`;
the generator maintains source-preview HTML/SW assets. Final release assembly
uses the same filesystem-derived inventory.

## Moving input: guide #435

Read-only verification on 2026-10-18: #435 is an open, unmerged draft at
`7c0c438c8f654c7bb12c25db0e9b95c3932c0bbc`, based on
`15685a438ea2b713f3e9da1ce9318108e5ad846c`. It owns the approved modal design,
held first shelf tap/replay, one guide per Focus visit, cut-out placement and
viewport/resize lifetime. This extraction does not duplicate that implementation
or imply its merge. Main's existing inline cue remains until that owner's change
is reconciled; therefore modal-specific acceptance remains open.

The concrete reconciliation destination is **one** controller:
`src/ui/settings/guides.js`. Its existing `show`, `maybeShow`, `dismiss`, `remove`,
`complete`, `replay`, `state`, `onAction`, `renderReplayList` and `refreshAnchor`
methods replace app-local functions. Apply #435's dialog bodies to this module,
using its existing registry and device-preference clients. Add the existing shell
client (`openModal`, `closeModal`, current modal and settle callback) for modal
coordination; pass the viewport through `window`. Keep all placement frames,
observers and held-tap state private to this controller and dispose them with it.
The UI must still reload preferences before recording/replaying a guide so a
second tab's unknown choices survive. Registry versions/statuses remain unchanged.

The owner patch has four caller edits, which must be reconciled with the current
Focus owner rather than reintroduced into the composition root:

1. Replace the old shelf-rebuild `refreshAnchor` call with #435's placement
   reschedule. Remove inline-cue floor arithmetic from the Focus geometry owner.
2. At Focus entry/exit, call the owner implementation's arm/reset and visit-hold
   transitions. Never open the first-set dialog merely on arrival.
3. Capture the first shelf field/pad tap through the guide controller before the
   Focus action runs. Replay the exact held action after dismissal; logging a set
   without touching the shelf keeps the existing completion semantics.
4. Route modal close/cancel/Escape, replay return-focus and deferred modal opening
   through the shell client. Re-measure placement on viewport/panel changes and
   stop every watcher on close/dispose.

Adopt #435's existing `test/guide-modal.mjs` and its deliberate guide test/browser
policy changes as the owning proofs; do not substitute this extraction's inline
cue assertions for modal/held-tap/placement evidence. Reconcile its CSS, strings,
catalog states and role inventory as one owner change. The temporary inline cue
and `refreshAnchor` compatibility method are deleted in that same cutover, never
kept as a parallel controller. Re-read the PR head before integration and rebase
these named edits if it changed. No merge or deployment is implied here.
