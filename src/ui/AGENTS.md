# Feature presentation

Locate the user surface first: `today`, `focus`, `history`, `progress`, `entry`,
`program`, `library`, or `settings`. A feature owns its transient selection,
listeners, timers and disposal. `shell.js` owns modal/route focus and navigation
lifetimes. Shared formatting/markup belongs to a specific shared file only when
multiple consumers actually use it.

Consume readonly facts and named application commands. A renderer does not
publish training state, write storage, allocate durable identity, or implement a
second training rule. Do not import another feature's private files; share a
small actual contract instead. Mount/dispose/remount must not duplicate effects.

Focus composition starts at `focus/controller.js` and its `presentation.js`.
Shared metric labels and display targets belong to `ui/metrics.js`, used by
Focus and History forms; canonical metric parsing stays in training.

Use `node tools/run-tests.mjs entry --list`, `workout --list`, or `state --list`
to locate the real owning journey. Preserve pending input, focus/Back, durable
acknowledgement and malformed-data negatives. Critical visual acceptance uses the
existing explicit matrix; system Chromium behavior checks do not certify pixels.

Only closed owners are currently in the strict gate. The migration ledger names
remaining work; an extracted but unconsumed file does not close a slice. Temporary
root forwarding bindings are removed at slices19–20, never a new extension API.
