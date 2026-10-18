# Program Lab local artifact

Program Lab is an isolated owner workbench, built from the reviewed source checkout. It is excluded from production Pages publishing. It does not activate candidate programs in the workout app.

With Node.js (CI uses version 22) and Python 3 available, run from the implementation PR checkout:

```sh
node tools/build-programlab.mjs --out .ci-results/programlab-review
python3 -m http.server 8766 --bind 127.0.0.1 --directory .ci-results/programlab-review
```

Open `http://127.0.0.1:8766/`. Use a separate origin/port from the workout app. If the output directory already exists, choose a new directory; the builder refuses to overwrite it. If the port is occupied, choose another unused loopback port. Do not put this artifact under production `dist/` or publish it to the production origin.

The root entry is the same standalone entry exercised by the packaged browser journey. Keep the complete artifact together: compiler worker, archive worker, catalog, fonts and lab modules are required. A `file://` page cannot supply the required worker and fetch behavior.

`programlab/build-manifest.json` records source commit, working-tree dirty state, generator/schema/policy/diagnostics versions, runtime/catalog/lab fingerprints and each shipped file's SHA-256. Current runs retain bounded immutable build provenance. A clean source checkout is necessary for an artifact marked clean. The manifest is provenance and integrity data, not a signed attestation.

Lab experiments use IndexedDB `taurifer_programlab_v1` and the lab language preference uses `taurifer_programlab_ui_v1`. They belong to the chosen lab origin. Export run JSON to retain a portable snapshot before moving to a different origin or clearing browser data. Historical results stay read-only on runtime/catalog mismatch; “Run with this build” creates a separate current-build experiment after current validation.

For repository-owned browser verification under Node 22, install the pinned test dependencies and run:

```sh
npm ci --prefix test
(cd test && npx playwright install --only-shell chromium)
node tools/run-tests.mjs entry --suite-id test-programlab-ui-mjs
node tools/run-tests.mjs entry --suite-id test-programlab-ui-mjs---corpus
```

The runner builds and serves separate temporary loopback artifacts and cleans up its previews. It never needs a production deployment. The final implementation PR lists exact-head independent evidence and remaining CI or attachment limitations. An artifact existing in a cloud executor is not a delivered user attachment.

Canonical visual references use the repository's Playwright-pinned browser (CI currently installs Chromium 149). Use that browser for `tools/capture-ui-screens.mjs`; a system-browser override such as Chromium 151 can produce perceptual differences even when the rendered semantics agree. Functional journeys can use `REPFORGE_CHROME`, and their evidence must name the actual browser version.
