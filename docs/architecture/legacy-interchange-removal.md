# Interchange root-interface removal

Actual application consumers now use native public format/transfer owners. The service's `src/contract.js` composes the same portable contract with native training validators and the committed catalogue; it does not copy a schema. Its contract-consuming tests import that adapter too.

## Atomic deletion manifest

The integration owner removes these roots together with their shell/SW placeholders and temporary bootstrap bindings:

- `shared-setup.js` → `src/interchange/setup-link.js`
- `install-transfer-contract.js` → `src/interchange/transfer-contract.js`
- `install-transfer.js` → `src/platform/install-transfer.js`
- `unsupported-workout-grammar.js` → public `program-file.js` `unsupportedGrammar`

`tools/check-production-syntax.mjs` now expects those roots absent. Run `node scripts/native-source-assets.mjs --write` after integrating the new files; native graph/cache completeness belongs to the central assembler. Historical `test/fixtures/sw-v120.js` intentionally retains its release's paths and must not become a fictitious native release.

Retained Node consumers import `test/interchange-runtime.mjs`, a composition root over actual native factories/training modules. Browser global consumers in setup/entry/privacy/import/launch and landing-capture fixtures use `ensureBrowserInterchange(page)`. It imports production modules and the committed catalogue into the page and exposes test-owned `__repforgeInterchangeTest` handles. It contains no normalizer/schema/protocol and writes no application state. Invoke after navigation, including offline contexts where the production graph/catalogue are cached. Product code never publishes these handles.

## Retired format guarantees and retained behavior

| Former assertion | Replacement owner | Scope |
| --- | --- | --- |
| Classic script publishes `RepForgeInstallTransfer` | Retained client fault suite checks native cookie/endpoint constants and absence of module-global publication | Architecture retires global discovery; the same 45 client fault cases retain protocol behavior. |
| Unsupported-grammar script appears unrevisioned after telemetry | Grammar suite retains all vocabulary/privacy/ordering assertions; architecture source inventory/release browser suites own native graph membership/execution | Dependency-based loading replaces script-tag position. No vocabulary guarantee is dropped. |
| Node and classic-browser VM implementations agree | Retained contract/limits assertions execute actual native public graphs in independent `vm.SourceTextModule` realms | Module/realm parity, not physical-browser attestation. Real credentials/cookies/producer seam remains in client-browser suite. No same-object stand-in or validator fork. |
| Old/new public modules agree | Immutable `architecture-interchange-v1.json`, captured from unchanged source `792fc25f`, and existing domain fixtures | Exact v4 gzip bytes, refusals, acknowledged clone and envelope survive deletion. Producer SHA-256 values recorded; no recapture mode. |

The two realm suites accept `--experimental-vm-modules`; when absent, the helper starts the same command once with that required capability before executing its realm proof. This is capability setup, not retrying a failed contract. Child failures propagate. The former `require.cache` adapter is removed.

## Evidence and remaining gates

Native codec/client regression and retained contract proofs pass. The native service adapter passed static checks and its full command: 80 Vitest cases plus health-producer, production-ops and watcher-provisioning integration scripts. Only local test bindings were used; no deployment/settings/credential changes occurred.

The first browser client run caught a Window receiver regression: `capabilities.btoa(...)`. The corrected implementation captures base64 functions and invokes them without the capability object's receiver. Native bootstrap also exposed an old harness readiness assumption: startup can finish after DOMContentLoaded. The helper now awaits existing `waitForAppBoot` before storage clearing, client setup and producer inspection. Focused actual Chromium client proof passed after these corrections; earlier failures remain failures.

Strict allowJs/checkJs/strict/noEmit passes for five format modules (`json`, `backup`, `program-file`, `csv`, `unsupported-grammar`), without any aliases or suppression directives; application export orchestration has no own diagnostics. Three inherited large validators/protocol modules still need strict typing: setup-link 117, transfer-contract 139, platform install-transfer 137 diagnostics at this checkpoint. This is a remaining gate, not a completed directory exclusion. Full browser import/setup/offline acceptance, assembly and final-head CI also remain integration gates.
