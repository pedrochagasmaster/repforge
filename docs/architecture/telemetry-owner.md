# Telemetry owner cutover

`src/platform/telemetry.js` owns the closed event registry, redaction, installation
identity, consent, and coarse projections. `src/platform/posthog.js` owns only the
optional pinned SDK transport and its passive loader. The browser composition
passes the browser, local telemetry instance, and generated deployment data
explicitly. Only this adapter reads the optional `browser.posthog` SDK.

Telemetry construction does not mint identity, inspect storage or start transport.
Boot calls the adapter only after install-transfer marker recovery and verified
incoming device sections. The local facade gates `setEnabled` with the same
install-transfer freeze predicate used by device writes. Its writable methods
are an explicit per-instance test observation seam (`__repforgeTelemetry`), matching
the durable owner's fault seam. Product consumers keep the lexical instance;
replacing a window property cannot replace the operational owner.

The deployment generator inserts optional config before the application module.
SDK version, endpoint policy, masking, opt-out, and generated deployment values
are unchanged. The production HTML and current service worker no longer load
`telemetry.js` or `posthog-init.js`. The immutable v120 service-worker fixture
still precaches those exact historical URLs. Its already-retired schedule/setup
URLs are served only by the three test-owned upgrade servers from hash-pinned
release bytes in `test/fixtures/v120/`, never restored as production assets.
Physical telemetry compatibility-file deletion
belongs to slice 20: move these bytes into that fixture's isolated historical
server before deleting root files; do not change its pinned worker/hash or leave
a production bridge. Measurement generation and privacy tests now consume native
contracts directly.

The retained native adapter tests assert passive construction, exact SDK policy,
loading reuse and transport redaction. Browser leakage uses the real composition,
loader, consent control and outgoing requests with an intercepted SDK. Poisoned
classic module properties must remain untouched. Install-transfer import observes
the actual local facade boot calls and exact identity/consent bytes, including
malformed-marker refusal before identity or SDK startup. The production syntax
gate uses the native event registry and its seeded negative ownership checker.
