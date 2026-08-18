# Shared setup links implementation plan

> **For agentic workers:** implement this plan through isolated branches or
> worktrees. The integration owner is the only worker allowed to edit `app.js`.
> Parallel workers must obey the file-ownership table in
> [Parallel implementation strategy](#parallel-implementation-strategy).

**Goal:** Let a coach share a Taurifer URL that carries a complete program,
program configuration, app settings, and language. A recipient with no active
program sees the existing first-run gate and installation guidance, but the
normal Create and Import choices are replaced by one action that starts the
shared program.

**Architecture:** A new dependency-free `shared-setup.js` module validates,
canonicalizes, gzip-compresses, encodes, decodes, and bounds a versioned setup
payload. The payload travels in the URL fragment, not in a query string. The
first-run gate treats a valid decoded payload as a transient proposal and does
not durably apply any payload field until the recipient presses the single
start action. The existing boot path may still persist its ordinary first-run
starter snapshot; that snapshot must not contain data from the shared payload.
Acceptance constructs a fresh local program identity and commits the program,
custom exercise definitions, metadata, language, and allowlisted app settings
through Taurifer's existing mirrored-state transaction path. A short-lived
cookie carries the compressed proposal across iOS Add to Home Screen because
WebKit copies cookies, but not local storage, into a newly installed Home Screen
web app.

**Tech stack:** Static HTML/CSS, classic dependency-free JavaScript, existing
`localStorage` + IndexedDB persistence, Web Compression Streams, Web Share API,
Clipboard API, Node tests, and Playwright browser tests. There is no build step
and no new application dependency.

**Prerequisite:** PR #157 is merged. Its `#firstRun` gate, capability-driven
install section, enlarged brand lockup, ethos hero, and responsive layout are
the foundation for this work.

---

## Product contract

### Locked behavior

1. The existing `#firstRun` gate remains the first screen.
2. The ethos hero, brand lockup, illustration, installation card, installation
   sheet, and responsive composition remain unchanged.
3. A normal first run still shows Create a program and Import a program.
4. A valid shared setup switches only the program-choice portion of the gate:
   Create and Import are hidden and one Start this program row is shown.
5. The gate itself is the confirmation surface. There is no second preview,
   file picker, exercise-mapping review, or eight-step generation wizard.
6. The row identifies the proposal with its program name and number of training
   days. It does not dump every exercise or setting into the gate.
7. The recipient can inspect or modify the program and settings after starting
   it through the existing Program and Settings screens.
8. Pressing Start this program performs one atomic durable commit and lands on
   Today.
9. The shared language is authoritative. The valid proposal changes the gate's
   runtime language before acceptance and persists that language with the rest
   of the proposal after acceptance.
10. The link never imports workout logs, completed sessions, prior blocks,
    drafts, notifications permission, or device-specific UI state.
11. The link never silently replaces an existing configured program or clears
    archived program history in the first implementation.
12. A malformed, oversized, unsupported, or internally inconsistent link
    writes no application state. If a bounded candidate was staged in the
    handoff cookie before decoding, clear it as soon as validation fails.
13. Automatic acceptance is allowed only when every linked exercise resolves
    to a current built-in library entry or to a valid custom definition carried
    by the same payload. No fuzzy name matching is permitted in this path.
14. A share link is a bearer capability. Anyone who possesses it can read and
    use the program. Encoding and compression are not encryption or proof of
    coach identity.

### Gate modes

| Mode | Condition | Program controls | Lede | Continue action |
|---|---|---|---|---|
| Standard | No shared setup source | Existing Create and Import rows | Existing copy | Existing behavior |
| Shared, install available | Valid proposal and first-run state | One Start this program row | Install the app, then start your program. | Dismiss the install offer; keep the shared row |
| Shared, installed/no offer | Valid proposal and first-run state | One Start this program row | Your program is ready. | Hidden, as it is today without an install offer |
| Shared, committing | Start action pressed | Same row, disabled and busy | Unchanged | Disabled |
| Shared, commit failed | Persistence rejected | Same row, re-enabled | Unchanged | Normal shared behavior |
| Invalid source | Decode or validation failed | Existing Create and Import rows plus an inline error | Existing standard lede | Existing behavior |
| Existing configured state | `programMeta.onboarded`, any log rows, or any `programHistory` entries | Do not open first-run gate | Not applicable | Do not mutate state |

### Shared-mode copy

Add exact EN/PT keys rather than constructing sentences in JavaScript.

| Key | English | Portuguese |
|---|---|---|
| `setup.shared.lede` | Install the app, then start your program. | Instale o app e comece seu programa. |
| `setup.shared.lede_installed` | Your program is ready. | Seu programa está pronto. |
| `setup.shared.title` | Start this program | Começar este programa |
| `setup.shared.cap_one` | {name} · 1 day per week | {name} · 1 dia por semana |
| `setup.shared.cap_many` | {name} · {n} days per week | {name} · {n} dias por semana |
| `setup.shared.invalid` | This shared program link is invalid or incomplete. | Este link de programa compartilhado é inválido ou está incompleto. |
| `setup.shared.unsupported` | This shared program was created by a newer version of Taurifer. | Este programa compartilhado foi criado por uma versão mais recente do Taurifer. |
| `setup.shared.browser_unsupported` | This browser cannot open shared program links. | Este navegador não pode abrir links de programas compartilhados. |
| `setup.shared.too_large` | This program is too large to share as an install-safe link. | Este programa é grande demais para ser compartilhado por um link compatível com a instalação. |
| `setup.shared.existing` | This setup link can only be started during initial setup. | Este link só pode ser iniciado durante a configuração inicial. |
| `setup.shared.commit_failed` | The program could not be started. Try again. | Não foi possível iniciar o programa. Tente novamente. |
| `program.share_setup` | Share setup link | Compartilhar link de configuração |
| `program.share_setup_sub` | Program, settings and app language · no workout history | Programa, configurações e idioma do app · sem histórico de treinos |
| `program.share_setup_title` | Share program setup | Compartilhar configuração do programa |
| `program.share_setup_body` | The link includes this program, its settings, and the app language. Workout history is not included. | O link inclui este programa, suas configurações e o idioma do app. O histórico de treinos não é incluído. |
| `program.share_setup_building` | Preparing link… | Preparando link… |
| `program.share_setup_share` | Share link | Compartilhar link |
| `program.share_setup_copy` | Copy link | Copiar link |
| `program.share_setup_unsupported` | This browser cannot create setup links. | Este navegador não pode criar links de configuração. |
| `program.share_setup_unlinked` | Save every unlinked exercise as a custom exercise before sharing. | Salve cada exercício não vinculado como exercício personalizado antes de compartilhar. |
| `program.share_setup_invalid` | This program has settings that cannot be included in a setup link. | Este programa tem configurações que não podem ser incluídas em um link. |
| `toast.setup_link_copied` | Setup link copied | Link de configuração copiado |

Choose `cap_one` when `n === 1` and `cap_many` otherwise. Do not construct the
caption from English word fragments or rely on English word order in Portuguese.

### Out of scope for the first implementation

- Replacing an existing user's configured program from a setup link.
- Merging a setup link into an existing program.
- Verified-coach identity, signatures, accounts, revocation, or server-side
  access control.
- A hosted short-link service.
- Sharing workout logs or program history.
- Importing notification permission or turning notifications on.
- Importing browser/device UI preferences.
- Supporting an arbitrary remote payload URL.
- Fuzzy exercise matching or an exercise-mapping review.
- Changing the first-run hero or installation design.

---

## User journeys

### Coach creates a link

1. The coach configures the active program and app settings in Taurifer.
2. The coach opens Program and presses Share setup link.
3. Taurifer constructs an allowlisted payload from live state.
4. Taurifer validates the payload before encoding it.
5. Taurifer canonicalizes the payload, encodes it as UTF-8, compresses it with
   gzip, and base64url-encodes the bytes.
6. Taurifer verifies that the encoded value fits the install-handoff limit.
7. A share sheet explains exactly what is and is not included.
8. The coach presses Share link or Copy link.
9. The shared URL points to the canonical `index.html` start path and carries
   the proposal in `#setup=`.

No program data is uploaded by Taurifer in this version. The URL itself is the
shared artifact.

### Recipient opens the link in Safari and installs first

1. Safari loads the static application shell. The fragment is not part of the
   HTTP request.
2. Taurifer captures the `setup` fragment before first-run rendering.
3. Taurifer validates the encoded length, writes the same encoded value to the
   temporary handoff cookie, decodes it, and validates the payload.
4. Taurifer changes the runtime locale to `payload.settings.lang` without yet
   applying that language or any other payload field to durable state.
5. The first-run gate renders in that language with the existing installation
   card and one shared-program action.
6. The recipient follows Add to Home Screen.
7. The installed web app launches at `manifest.webmanifest`'s
   `./index.html` start URL.
8. On supported iOS versions, the handoff cookie is present in the installed
   web app even though localStorage and IndexedDB are not copied.
9. Taurifer reconstructs the same transient proposal from the cookie and shows
   the shared gate.
10. The recipient presses Start this program.
11. Taurifer commits a fresh local program and clears the handoff cookie.
12. Today opens with the first program day selected.

### Recipient continues in the browser

1. The recipient presses Continue in Safari/browser.
2. Taurifer remembers the install dismissal using the existing UI preference.
3. Taurifer removes the install section and continue action.
4. The shared-program row stays on the gate.
5. Pressing Start this program commits in the browser context.
6. Keep the handoff cookie until its normal expiry when not standalone. If the
   recipient installs shortly afterward, iOS can still copy the proposal into
   the new Home Screen app.

### Recipient already has configured state

1. Decode and validate the fragment so malformed data cannot enter another
   path.
2. Do not call `openFirstRun()` and do not alter runtime language.
3. Do not apply the proposal.
4. Remove the fragment only after capture and show the localized existing-state
   notice through the normal toast/announcement surface.
5. Preserve the temporary handoff only when needed for a separately installed,
   still-empty app context; otherwise let it expire naturally.

---

## Payload contract

### Canonical v1 document

```json
{
  "kind": "taurifer-shared-setup",
  "version": 1,
  "program": {
    "meta": {
      "name": "Coach program",
      "goal": "hypertrophy",
      "experience": "intermediate",
      "daysPerWeek": 4,
      "splitType": "upper_lower",
      "equipment": ["machines", "cables"],
      "priorityMuscles": ["Chest", "Back"],
      "sessionLength": "normal",
      "mesocycleLengthWeeks": 6
    },
    "exercises": [
      {
        "day": "Day 1",
        "order": 1,
        "libraryId": "pr_mc",
        "sets": 3,
        "min": 6,
        "max": 10,
        "notes": "",
        "alternates": [],
        "progressionType": "double_progression",
        "targetRirStart": 3,
        "targetRirEnd": 1,
        "minSets": 2,
        "maxSets": 4,
        "priority": "normal"
      }
    ],
    "customExercises": []
  },
  "settings": {
    "jumpPct": 2.5,
    "minJump": 2.5,
    "rirHigh": 2,
    "hardRir": 4,
    "restSec": 120,
    "unit": "kg",
    "lang": "en",
    "rirMode": "numeric"
  }
}
```

`settings.lang` is required in v1 and must be `"en"` or `"pt"`. It is not a
display-only hint. It controls the proposal gate and becomes the durable app
language when the program is accepted.

### Top-level rules

- `kind` must equal `taurifer-shared-setup`.
- `version` must equal integer `1`.
- `program`, `program.meta`, `program.exercises`, and `settings` are required.
- `program.customExercises` is optional and defaults to `[]`.
- Unknown keys are ignored only after explicit field picking. Never spread an
  untrusted object into state.
- `program.exercises` must contain at least one entry.

### Shared program metadata

| Field | Required | Validation | Acceptance behavior |
|---|---:|---|---|
| `name` | Yes | Trimmed non-empty string, maximum 100 Unicode code points | Preserve |
| `goal` | No | `hypertrophy`, `strength_hypertrophy`, `beginner_consistency`, or `null` | Preserve normalized value |
| `experience` | No | `beginner`, `intermediate`, `advanced`, or `null` | Preserve normalized value |
| `daysPerWeek` | Yes | Integer 1–7 and equal to distinct program-day count | Preserve |
| `splitType` | No | `full_body`, `machine_only`, `ppl`, `upper_lower`, `bro`, or `null` | Preserve normalized value |
| `equipment` | No | Unique values from `machines`, `cables`, `dumbbells`, `barbells`, `bodyweight`; maximum 5 | Preserve normalized list |
| `priorityMuscles` | No | Array of at most 32 unique trimmed strings, each at most 80 code points | Preserve normalized list |
| `sessionLength` | No | `short`, `normal`, `long`, or `null` | Preserve normalized value |
| `mesocycleLengthWeeks` | Yes | Integer 1–52 | Preserve |

The outbound builder converts legacy singular equipment values to the canonical
plural values (`machine` → `machines`, `cable` → `cables`, `dumbbell` →
`dumbbells`, `barbell` → `barbells`). It derives `daysPerWeek` from distinct day
labels and defaults a missing `mesocycleLengthWeeks` to the current six-week
default. An unrecognized optional legacy goal, experience, split, or session
length becomes `null`; it must not make an otherwise valid current program
impossible to share. The decoder accepts only the canonical values in the table.

The payload must not carry or control:

- `id`
- `started`
- `created`
- `updated`
- `mesocycleStatus`
- `completedAt`
- `onboarded`
- `blockPromptDismissedId`

Acceptance creates those locally:

```text
id                     = uid()
started                = today()
created                = new Date().toISOString()
updated                = created
mesocycleStatus         = "active"
completedAt             = null
onboarded               = true
blockPromptDismissedId  = null
```

### Shared app settings

| Field | Required | Validation | Notes |
|---|---:|---|---|
| `jumpPct` | Yes | Finite JSON number from 0 through 100 | Reuse `normSetting` semantics after validation |
| `minJump` | Yes | Finite JSON number from 0.01 through 1,000 | Stored in kg, matching current semantics |
| `rirHigh` | Yes | Finite JSON number from 0 through 100 | Reuse `normSetting` semantics after validation |
| `hardRir` | Yes | Finite JSON number from 0 through 100 | Reuse `normSetting` semantics after validation |
| `restSec` | Yes | Integer from 0 through 86,400 | Reuse `normalizeRestSec` after validation |
| `unit` | Yes | `kg` or `lb` | Preserve |
| `lang` | Yes | `en` or `pt` | Apply to gate and persist |
| `rirMode` | Yes | `numeric` or `effort` | Preserve |

Explicitly exclude:

- `lastExport`
- `voiceInputEnabled`
- `notify` and every nested notification switch

Do not call `normalizeSettings(payload.settings)` directly. Missing excluded
fields would be filled from defaults and could overwrite device-owned choices.
Create `sharedSettingsPatch(raw)` that picks and normalizes only the eight
allowed fields, then apply it over the current normalized settings:

```js
proposal.settings = {
  ...proposal.settings,
  ...sharedSettingsPatch(payload.settings)
};
```

### Exercise rules

Each shared exercise carries program-slot configuration, not historical
identity.

| Field | Required | Validation | Default |
|---|---:|---|---|
| `day` | Yes | Trimmed non-empty string, maximum 80 code points | — |
| `order` | Yes | Integer 1–1,000 | — |
| `libraryId` | Yes | String, maximum 200 code points; current built-in ID or ID defined in the same payload | — |
| `sets` | Yes | Integer 1–100 | — |
| `min` | Yes | Integer 1–1,000 | — |
| `max` | Yes | Integer 1–1,000 and `max >= min` | — |
| `displayName` | No | Trimmed string, maximum 200 code points | Omit |
| `notes` | No | String, maximum 2,000 code points | `""` |
| `alternates` | No | Array of at most 20 non-empty strings, each at most 200 code points | `[]` |
| `progressionType` | No | Trimmed string, maximum 80 code points | Omit |
| `targetRirStart` | No | Finite JSON number from 0 through 100 | Omit |
| `targetRirEnd` | No | Finite JSON number from 0 through 100 | Omit |
| `minSets` | No | Integer 1–100 | Omit |
| `maxSets` | No | Integer 1–100 and not less than `minSets` when both exist | Omit |
| `priority` | No | Trimmed string, maximum 80 code points | Omit |

Do not coerce numeric strings at the schema boundary. The outbound builder emits
JSON numbers, and a hand-authored `"3"` must fail rather than rely on unary `+`.

Do not include or accept the source slot's `id` or `movementId`. Let
`new Exercise()` mint a recipient-local slot ID. A recognized `libraryId`
reconstructs canonical name, primary muscles, and secondary muscles through the
existing library lookup. This reduces payload size and prevents a coach's slot
identity from becoming shared durable identity.

Detached/raw exercises are out of scope for v1. The coach must create a custom
exercise first so its definition travels with the program. That condition is
what makes it safe to skip exercise mapping.

For outbound links only, translate an ID present in `LEGACY_LIBRARY_IDS` to its
current canonical built-in ID before validation. A received v1 payload must
already contain current IDs; keeping legacy aliases out of the wire format
prevents v1 links from minting new long-lived references to retired IDs.

Hard bounds:

- Maximum 100 program exercises.
- Maximum 7 distinct day labels.
- Maximum 50 embedded custom definitions.
- Maximum 20 alternates per slot.
- Maximum 2,000 code points for a notes field.
- Maximum 200 code points per alternate or display name.
- Reject duplicate `(day, order)` pairs rather than silently reorder them.

### Custom exercise rules

The payload carries only the fields needed to reconstruct a reusable definition:

| Field | Required | Validation | Acceptance behavior |
|---|---:|---|---|
| `id` | Yes | Unique string beginning `custom:`, maximum 200 code points | Preserve or remap through the existing collision-safe merge |
| `name` | Yes | Trimmed non-empty string, maximum 200 code points | Preserve |
| `namePt` | No | Trimmed string, maximum 200 code points; default to `name` | Preserve normalized value |
| `equipment` | Yes | Array of 1–10 trimmed strings, each at most 80 code points | Preserve normalized values |
| `primary` | No | String, maximum 500 code points | Preserve |
| `secondary` | No | String, maximum 500 code points | Preserve |
| `notes` | No | String, maximum 2,000 code points | Preserve |

Reuse `normalizeCustomExercises()` and `mergeImportedCustomExercises()` semantics
after applying those bounds. Collision behavior is part of the contract:

| Recipient state | Result |
|---|---|
| No matching custom ID or definition | Add the shared definition |
| Same ID and same normalized definition | Reuse the recipient definition |
| Same ID but different definition | Mint a recipient-local ID and rewrite every affected shared slot |
| Different ID but same normalized definition | Reuse the recipient ID and rewrite every affected shared slot |

Do not carry `archived`, `created`, `patterns`, `beginnerFriendly`, or `custom`.
Acceptance creates those local bookkeeping values. Reject a custom ID that
shadows a built-in ID. Every custom ID referenced by a slot must have exactly
one definition. Definitions not referenced by the program are removed before
encoding. Unknown custom-definition keys are discarded by explicit picking.

### Keys that must never appear in a generated payload

```text
log
programHistory
_storageRevision
_storageFollowUp
_storageDraftTransaction
repforge_draft_v1 content
UI preferences
notification metadata
program metadata identity/timestamps
exercise slot IDs
```

The decoder must ignore these keys if a hand-authored link contains them. Tests
must prove they cannot reach the proposal.

---

## Encoding and transport

### URL

Canonical form:

```text
https://pedrochagasmaster.github.io/repforge/index.html#setup=v1.<base64url-gzip>
```

Rules:

- Use `index.html`, matching the manifest start URL.
- Use one fragment parameter named `setup`.
- Prefix the encoded value with `v1.` so gross incompatibility can be rejected
  before decompression.
- Do not use a query parameter. Existing `?goto=` handling remains independent.
- Preserve unrelated query parameters when removing the setup fragment.
- If future fragment parameters are introduced, remove only `setup`.

### Canonicalization

Before encoding:

1. Build an allowlisted payload.
2. Validate it through the same validator used by decoding.
3. Recursively sort object keys.
4. Preserve array order.
5. Serialize with `JSON.stringify()` and no whitespace.
6. Encode as UTF-8 with `TextEncoder`.

Deterministic canonicalization makes identical state produce identical JSON and
gives tests a stable uncompressed fingerprint. Do not promise identical
compressed bytes across browser engines: the Compression Streams contract does
not make compressor implementation details part of this feature's wire
contract. Decoding and canonical payload equality are the interoperability
requirements.

### Compression and base64url

Encoding algorithm:

```text
canonical JSON
  → TextEncoder UTF-8 bytes
  → CompressionStream("gzip")
  → collect bounded byte chunks
  → base64
  → replace + with -, / with _, strip = padding
  → prefix v1.
```

Decoding reverses those steps with `DecompressionStream("gzip")` and
`TextDecoder` in fatal UTF-8 mode when supported.

After removing `v1.`, accept only the canonical base64url alphabet
`[A-Za-z0-9_-]`, reject padding and a length whose remainder modulo four is one,
restore padding internally, and verify decoded bytes do not exceed the
compressed ceiling before opening the gzip stream.

Do not add a compression dependency. Feature-detect `CompressionStream` and
`DecompressionStream`. Link creation is unavailable with a localized error if
compression is unsupported. Normal program creation/import remains available.

### Limits

Define constants in `shared-setup.js`:

```js
const MAX_ENCODED_CHARS = 3072;
const MAX_COMPRESSED_BYTES = 2301;
const MAX_DECOMPRESSED_BYTES = 65536;
```

`MAX_ENCODED_CHARS` includes the three-character `v1.` prefix. Exactly 2,301
compressed bytes encode to 3,068 unpadded base64url characters, so the complete
value is 3,071 characters and fits; 2,302 bytes require 3,070 base64url
characters, so the complete value would be 3,073 and must fail. Both character
and byte checks must exist, and tests must cover those boundaries.

Read decompression output chunk by chunk and stop once the accumulated byte
count exceeds `MAX_DECOMPRESSED_BYTES`. Do not call
`new Response(stream).arrayBuffer()` without an output bound; that permits a
small compressed input to allocate an arbitrarily large result.

### Error taxonomy

The codec should return typed results rather than throw raw parsing errors into
the UI:

```js
{ ok: true, value }
{ ok: false, code: "missing" }
{ ok: false, code: "unsupported-version" }
{ ok: false, code: "compression-unavailable" }
{ ok: false, code: "decompression-unavailable" }
{ ok: false, code: "encoded-too-large" }
{ ok: false, code: "invalid-base64" }
{ ok: false, code: "invalid-gzip" }
{ ok: false, code: "decompressed-too-large" }
{ ok: false, code: "invalid-utf8" }
{ ok: false, code: "invalid-json" }
{ ok: false, code: "invalid-schema", issues: [...] }
```

`app.js` maps codes to localized UI. Tests may inspect codes. User-facing copy
must not expose stack traces or the encoded payload.

---

## iOS installation handoff

### Why localStorage is insufficient

The app's manifest launches `./index.html`, not the original shared URL. WebKit
documents that installation copies cookies into a Home Screen web app while no
other local storage is copied. Therefore a draft kept only in memory,
localStorage, IndexedDB, Cache Storage, or the original fragment can disappear
between Safari and the installed app.

References:

- [WebKit: Safari 17.2 login cookies and Home Screen apps](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/)
- [Web App Manifest `start_url`](https://www.w3.org/TR/appmanifest/#start_url-member)
- [WebKit: Compression Streams in Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)

### Cookie contract

```text
Name:      repforge_setup_v1
Value:     v1.<base64url-gzip>
Path:      canonical index.html pathname
Max-Age:   604800 (7 days)
SameSite:  Lax
Secure:    yes outside localhost
HttpOnly:  impossible because client JavaScript must read it
```

Compute the path with:

```js
new URL("index.html", location.href).pathname
```

This yields `/repforge/index.html` in production and `/index.html` in the local
test server. Scoping the cookie to the HTML path keeps it off asset requests.
The cookie is still attached to the matching navigation request; document this
honestly because the encoded program is not encryption.

### Capture order

1. Read `#setup`.
2. Reject an invalid prefix or an encoded value over the limit.
3. Attempt to write the exact encoded value to the handoff cookie.
4. Read the cookie back when the current path allows it; otherwise trust only
   the setter operation and keep the in-memory source.
5. Decode and validate.
6. Only after successful validation, remove `setup` from the fragment with
   `history.replaceState()`.
7. If cookie writing fails, keep the fragment so reload does not destroy the
   only copy. The gate may still operate in the current browser.

### Clearing rules

- Invalid cookie source: clear immediately.
- Successful standalone acceptance: clear immediately.
- Successful browser acceptance: keep until expiry to permit a later iOS
  installation.
- Explicit abandonment is not added in v1 because the first-run gate has no
  general skip-program path.
- A standard URL must never delete a valid handoff cookie before checking
  whether the current context is a fresh standalone app.

### Supported baseline

The seamless cookie handoff is supported on iOS/iPadOS 17.2 and newer according
to WebKit's documented copy behavior. The link still operates in-browser on
older platforms, but the PR must not claim that an older Home Screen
installation will inherit the proposal. Document and manually test the
supported baseline.

---

## State and trust boundaries

### Transient shared state

Add one module-level value in `app.js`:

```js
let sharedSetupDraft = {
  status: "none",       // none | loading | ready | invalid | unsupported
  source: null,          // fragment | cookie
  encoded: null,
  payload: null,
  error: null,
  previousLang: null
};
```

This object is not written to `repforge_v1`, IndexedDB, UI preferences, the
workout draft, or pending journals. It exists only to render and commit the
proposal.

### Boot integration order

The existing boot process resolves localStorage/IndexedDB recovery before
`init()` renders the app. Integrate the shared source without bypassing that
recovery path:

1. Detect the browser language as today.
2. Capture the raw fragment/cookie candidate without mutating application state.
3. Resolve replicas and any storage-recovery dialog through
   `resolveBootReplicas()`.
4. Run `applyBootDecision(decision)` unchanged, including its ordinary
   first-run starter-state persistence and migration behavior.
5. Decode and validate the captured setup candidate against the loaded exercise
   library.
6. Evaluate `sharedSetupEligible()`, defined as `firstRunPending()` plus an empty
   `programHistory`, against the recovered state.
7. Only for a valid, pending first run, set `I18N` to
   `payload.settings.lang`, store the transient proposal, and then call `init()`.
8. For configured state, keep the recovered state's language and retain only
   enough transient status to announce that setup links are first-run-only.

This ordering prevents the proposal from pre-empting storage recovery, avoids a
flash of standard controls, and makes the pre-acceptance storage assertion
precise: durable state may contain Taurifer's normal starter snapshot, but none
of the shared program, metadata, custom definitions, or settings.

### Language lifecycle

1. Boot detects the browser language as it does today.
2. A valid first-run proposal records the current runtime language in
   `sharedSetupDraft.previousLang`.
3. Set the runtime language to validated `payload.settings.lang` before
   `openFirstRun()` renders.
4. Do not persist the shared language or any other payload field merely because
   the link was opened.
5. Acceptance applies `lang` in the same state proposal as the program.
6. Invalid proposals do not change runtime language.
7. A proposal ignored because configured state already exists does not change
   runtime language.
8. If a future cancel action is added, restore `previousLang` before returning
   to standard first run.

### Proposal construction

Create `proposalFromSharedSetup(payload, baseState)` in `app.js` or as a pure
helper exposed to tests.

Order matters:

1. Clone `baseState`.
2. Build and merge normalized custom definitions.
3. Validate that every exercise `libraryId` resolves against the merged custom
   list plus built-ins.
4. Construct `proposal.program` through `new Program(exercises, lookup)`.
5. Build fresh `proposal.programMeta`.
6. Apply `sharedSettingsPatch()` over existing normalized settings, including
   `lang`.
7. Set `proposal.log = []`.
8. Set `proposal.programHistory = []`.
9. Remove `_storageFollowUp`.
10. Never copy storage revision or a draft transaction from the payload.

### Atomic acceptance

Add `commitSharedSetup(io = storageIO)`.

```text
revalidate transient payload
  → verify sharedSetupEligible()
  → build proposal
  → capture destructive-draft precondition
  → commitProposedState(proposal, adapter, transition/effect)
  → on success: reset draft session, select first day, close gates, render
  → on failure: retain proposal and re-enable the action
```

Use existing `programTransitionPrecondition()`,
`destructiveDraftClearEffect()`, `commitProposedState()`, and mirrored
localStorage/IndexedDB handling. Do not write localStorage directly.

Although a legitimate first-run state should have no workout progress, keep
the existing draft-discard protection. If `draftHasProgress()` is true at the
button press, require the existing `confirm.replace_program_discard_draft`
confirmation before capturing `readDraftRaw()`; cancellation leaves the shared
gate untouched. Storage can be restored or modified in another tab while the
gate is open.

### Success behavior

- Clear the busy state.
- Close first run and onboarding defensively.
- Set `day` to the first program day.
- Render Today.
- Show the existing localized `toast.onboarding_saved` success treatment; do
  not add a second success dialog.
- Run the existing first-run tour decision.
- Show the post-setup install banner only when installation still applies.
- Clear the handoff cookie only according to the standalone/browser rules.

### Failure behavior

- Keep the first-run gate visible.
- Keep `sharedSetupDraft.payload` intact for retry.
- Re-enable Start this program.
- Announce the localized failure assertively.
- Do not fall through to the generated-program wizard.
- Do not partially update runtime state from the failed proposal.

---

## Security and privacy requirements

1. Treat every fragment and cookie byte as untrusted.
2. Validate encoded size before base64 allocation.
3. Validate compressed size before decompression.
4. Bound decompressed output while reading the stream.
5. Use fatal UTF-8 decoding where available.
6. Parse JSON once.
7. Require plain objects and safe arrays.
8. Pick every accepted field explicitly; never merge the decoded root into
   state.
9. Reject `__proto__`, `prototype`, and `constructor` keys anywhere in decoded
   objects, even though JSON parsing alone does not execute them.
10. Render all payload-derived text through `textContent` or existing `esc()`.
11. Do not let the payload provide HTML, CSS, URLs, image sources, API origins,
    or script names.
12. Do not enable notifications or request permissions from the payload.
13. Do not log the payload, cookie, or full URL to the console.
14. Do not put the payload in error telemetry or toast text.
15. Do not advertise authenticity. A modified but valid payload is still just a
    bearer link.
16. Keep the program and settings share explicit on the coach's share sheet.
17. State clearly that anyone with the URL can use and inspect the setup.
18. Document that the bearer URL can remain in browser history, clipboard
    history, synced tabs, messaging previews, or screenshots even though its
    fragment is not sent in the initial HTTP request.

---

## File map

| File | Change | Owner during parallel work |
|---|---|---|
| Create `test/fixtures/shared-setup.mjs` | Frozen valid/invalid payload fixtures and interface constants | Integration owner in Wave 0 |
| Create `shared-setup.js` | Codec, canonicalization, bounded compression/decompression, cookie helpers, structural validation | Codec agent |
| Create `test/shared-setup-unit.mjs` | Pure/Node codec and schema tests | Codec agent |
| Modify `index.html` | Shared gate row, error status, program share sheet, script tag | UI/localization agent |
| Modify `styles.css` | Shared-row states and share sheet using existing tokens | UI/localization agent |
| Modify `i18n-en.json` | Exact English strings | UI/localization agent |
| Modify `i18n-pt.json` | Exact Portuguese strings | UI/localization agent |
| Regenerate `i18n.js` | Generated dictionary | UI/localization agent |
| Create `test/shared-setup-flow.mjs` | Browser-level link, gate, commit, and handoff cases | Browser-test agent |
| Modify `test/install-modes.mjs` | Shared mode across capability and layout matrix | Browser-test agent |
| Modify `test/accessibility.mjs` | Gate focus and accessible-name assertions | Browser-test agent |
| Modify `app.js` | Payload creation, boot capture, gate mode, language switch, sharing, proposal construction, atomic commit | Integration owner only |
| Modify `sw.js` | Precache `shared-setup.js`, add to shell, cache bump | Integration owner only |
| Modify `AGENTS.md` | Cache version/inventory and shared setup constraints | Integration owner only |
| Create `docs/adr/0007-shared-setup-links.md` | Decision, trade-offs, language, install handoff, limitations | Documentation agent |
| Modify `docs/brand-guide.md` | Standard/shared first-run modes and exact data-sharing statement | Documentation agent |
| Modify `README.md` | Sharing/privacy and supported install handoff | Documentation agent |

---

## Exact implementation tasks

### Task 0: Lock fixtures and interfaces

**Owner:** Integration owner

**Files:** `test/fixtures/shared-setup.mjs`

- [ ] Confirm PR #157 is present in the base branch.
- [ ] Confirm the base still uses `repforge-v92`. If no intervening cache bump
  has landed, reserve `repforge-v93`; otherwise reserve exactly one greater than
  the cache on the implementation branch.
- [ ] Record current program export v3 shape and current settings defaults.
- [ ] Use the existing `pr_mc` built-in library ID in the minimal fixture and
  add every other built-in ID used by the representative fixture to its
  exported `BUILT_IN_IDS` set.
- [ ] Create a representative four-day fixture with at least 24 exercises, a
  custom exercise, effort mode, Portuguese language, non-default rest time, and
  non-default progression settings.
- [ ] Create an invalid fixture for every decoder error code.
- [ ] Freeze the `RepForgeSharedSetup` interface below before delegating.

Required browser/global API:

```js
RepForgeSharedSetup = {
  KIND,
  VERSION,
  MAX_ENCODED_CHARS,
  MAX_COMPRESSED_BYTES,
  MAX_DECOMPRESSED_BYTES,
  canonicalize,
  validate,
  encode,
  decode,
  readSetupFragment,
  removeSetupFragment,
  handoffCookiePath,
  readHandoffCookie,
  writeHandoffCookie,
  clearHandoffCookie
};
```

Required Node export: the same object through `module.exports`.

Freeze these call contracts as well:

| Function | Contract |
|---|---|
| `canonicalize(value)` | Return a deep plain clone with recursively sorted object keys and preserved array order; throw only for programmer-supplied unsupported types |
| `validate(raw, { builtInIds })` | Return `{ok:true,value:<picked canonical payload>}` or a typed `invalid-schema` result; never mutate `raw` |
| `encode(raw, { builtInIds })` | Async; validate, canonicalize, gzip, and return `{ok:true,value:"v1.…",compressedBytes,decompressedBytes}` or a typed error |
| `decode(encoded, { builtInIds })` | Async; enforce every bound and return `{ok:true,value:<picked canonical payload>,compressedBytes,decompressedBytes}` or a typed error |
| `readSetupFragment(url = location.href)` | Return the raw `setup` value or `null`; do not decode or mutate history |
| `removeSetupFragment(url = location.href)` | Return a relative `pathname + search + hash` string with only `setup` removed; the caller performs `history.replaceState()` |
| Cookie helpers | Accept explicit document/location adapters for Node tests; never read application state |

`builtInIds` is a `Set<string>` in v1. Browser integration constructs it from
the loaded exercise library; unit tests inject a fixture set. Codec functions
do not read `window.EXERCISES`, `state`, or `app.js` globals.

Commit the fixture/interface contract before starting parallel workers. Every
worker branches from that commit.

### Task 1: Write codec/schema unit tests

**Owner:** Codec agent

**Files:** `test/shared-setup-unit.mjs`

- [ ] Load `shared-setup.js` through `createRequire`.
- [ ] Assert deterministic canonical key order.
- [ ] Assert UTF-8 EN/PT round trip.
- [ ] Assert `settings.lang` is required and accepts only `en`/`pt`.
- [ ] Assert every allowed settings field survives.
- [ ] Assert excluded settings and state keys are absent after validation.
- [ ] Assert wrong kind and versions fail with stable codes.
- [ ] Assert malformed base64, gzip, UTF-8, and JSON fail safely.
- [ ] Stub missing Compression Streams and assert the two stable unavailable
  codes without changing globals after the test.
- [ ] Assert exact encoded and decompressed boundaries.
- [ ] Assert decompression stops above the output ceiling.
- [ ] Assert duplicate slot positions fail.
- [ ] Assert unknown built-in IDs fail through a supplied library-ID resolver.
- [ ] Assert a received legacy alias is rejected by the strict v1 validator.
- [ ] Assert custom references require definitions.
- [ ] Assert prototype-pollution keys fail.
- [ ] Assert fragment removal preserves query parameters and unrelated fragment
  parameters.
- [ ] Assert cookie path is `/repforge/index.html` in production-like paths and
  `/index.html` locally.

Run the tests before implementation and record the expected module-missing or
unimplemented failure.

### Task 2: Implement `shared-setup.js`

**Owner:** Codec agent

**Files:** `shared-setup.js`, `test/shared-setup-unit.mjs`

- [ ] Use a dual-export IIFE matching `schedule.js`/`notify.js`.
- [ ] Keep the module free of application state and DOM rendering.
- [ ] Implement plain-object and forbidden-key traversal.
- [ ] Implement explicit payload field picking and normalization.
- [ ] Accept a built-in library resolver or set of IDs as a validator argument;
  do not import `exercises.js` from the module.
- [ ] Implement deterministic canonicalization.
- [ ] Implement URL-safe base64 without stack-overflow-prone spreading of large
  byte arrays; process bytes in chunks.
- [ ] Implement bounded gzip compression and decompression.
- [ ] Implement structured success/error results.
- [ ] Implement fragment parser/removal with `URL` and `URLSearchParams`.
- [ ] Implement cookie write/read/clear helpers and localhost Secure handling.
- [ ] Run unit tests and `node --check shared-setup.js`.
- [ ] Commit only the two owned files.

### Task 3: Add shared-mode localization

**Owner:** UI/localization agent

**Files:** `i18n-en.json`, `i18n-pt.json`, generated `i18n.js`

- [ ] Add every key from [Shared-mode copy](#shared-mode-copy).
- [ ] Add singular/plural caption keys if the existing plural system requires
  them.
- [ ] Preserve exact placeholders between EN and PT.
- [ ] Do not edit generated `i18n.js` manually.
- [ ] Run `node tools/build-i18n.mjs`.
- [ ] Run `node tools/build-i18n.mjs --check`.
- [ ] Run `node test/i18n.mjs` with the app server if the suite requires it.
- [ ] Commit only localization sources and generated output.

### Task 4: Add inert markup and styles

**Owner:** UI/localization agent

**Files:** `index.html`, `styles.css`

- [ ] Load `shared-setup.js` after `exercises.js` and before `app.js`.
- [ ] Wrap the two existing first-run choices in
  `#firstRunStandardProgram` without changing their source order or copy.
- [ ] Add `#firstRunSharedProgram` as a hidden sibling inside the same Program
  section.
- [ ] Add one `.firstrun-row` button `#firstRunSharedStart`.
- [ ] Add stable descendants for shared title, program name/summary, and busy
  state; payload text must be assigned later with `textContent`.
- [ ] Add `#firstRunSharedError` with `role="status"` and hidden by default.
- [ ] Add a modal/sheet for the coach share explanation and the generated link,
  using the repository's existing modal primitives and focus management.
- [ ] Add `#shareSetupShare`, `#shareSetupCopy`, and close controls.
- [ ] Reuse existing row, button, rule, paper, ink, and accent tokens.
- [ ] Do not redesign the hero or installation surfaces.
- [ ] Ensure long program names wrap without horizontal overflow.
- [ ] Ensure hidden standard/shared groups use the existing `.hidden` behavior
  and leave no focusable descendants.
- [ ] Verify 320, 390, 430, 768, and 1280 px widths manually with inert markup.
- [ ] Commit only `index.html` and `styles.css`.

### Task 5: Add payload creation and coach sharing

**Owner:** Integration owner

**Files:** `app.js`

- [ ] Define `sharedProgramMeta(meta, program)` that picks the allowed metadata
  and derives `daysPerWeek` from distinct day labels when needed.
- [ ] Define `sharedExercise(ex)` that omits slot ID, movement ID, copied
  canonical name, and copied muscle fields while preserving allowed slot
  configuration.
- [ ] Canonicalize any outbound `LEGACY_LIBRARY_IDS` alias to its current ID;
  never emit a retired alias.
- [ ] Reuse `referencedCustomExercises()` and remove unreferenced definitions.
- [ ] Define `sharedSettings(settings)` including all eight fields and
  `settings.lang`.
- [ ] Define `buildSharedSetupPayload()` returning the canonical v1 object.
- [ ] Validate before encoding with the same module validator used on receipt.
- [ ] Add `#shareProgramSetup` as a rendered `.listrow` in
  `renderProgramOverview()` beside the existing program text export. Give it a
  stable localized title/subtitle and render it only when the active program has
  at least one day.
- [ ] Bind `#shareProgramSetup` to open the explanatory sheet.
- [ ] Generate the link asynchronously and show a busy state.
- [ ] If `CompressionStream` is unavailable, keep ordinary exports working and
  show `program.share_setup_unsupported`; do not create an uncompressed URL.
- [ ] If any slot lacks a resolvable `libraryId`, show
  `program.share_setup_unlinked`. If a value is outside the v1 schema bounds,
  show `program.share_setup_invalid`. Do not silently clamp or omit it.
- [ ] Do not call `navigator.share()` automatically after an asynchronous build;
  transient user activation may have expired. Require a second explicit Share
  link press after generation.
- [ ] Use `navigator.share({title, text, url})` when available.
- [ ] Use `navigator.clipboard.writeText(url)` for Copy link, with the existing
  safe fallback if clipboard access is unavailable.
- [ ] Disable sharing and display `setup.shared.too_large` when the encoded
  value exceeds the install-safe limit. Do not silently remove content.
- [ ] Never include log/history data in the share sheet, generated URL, or debug
  output.

### Task 6: Capture and validate setup sources during boot

**Owner:** Integration owner

**Files:** `app.js`

- [ ] Initialize `sharedSetupDraft` before boot.
- [ ] Follow [Boot integration order](#boot-integration-order) exactly: capture
  early, but decode/apply only after replica recovery and before `init()`.
- [ ] Do not delay storage-recovery decisions on codec work longer than
  necessary; gzip decode is local and bounded.
- [ ] Prefer a valid fragment over a cookie because it reflects the explicit
  link just opened.
- [ ] Fall back to the handoff cookie when there is no fragment.
- [ ] Clear invalid cookie input.
- [ ] Remove a valid fragment only after capture, cookie handoff attempt, decode,
  and validation.
- [ ] If state is first-run pending, apply the validated shared language to the
  runtime before `renderFirstRun()`.
- [ ] If state is already configured, retain current language and show the
  existing-state notice without mutation.
- [ ] Expose a narrow `window.__repforgeSharedSetup` test hook containing only
  status, decoded summary, payload builder, and commit entry point. Do not expose
  raw cookie helpers unnecessarily.

### Task 7: Render shared gate mode

**Owner:** Integration owner

**Files:** `app.js`

- [ ] Add `sharedSetupReady()` and `renderFirstRunProgramMode()`.
- [ ] Add `sharedSetupEligible()` as `firstRunPending()` plus an empty
  `programHistory`; use it both after boot recovery and immediately before the
  commit.
- [ ] In ready mode, hide `#firstRunStandardProgram`, show
  `#firstRunSharedProgram`, and clear the error.
- [ ] Populate the caption with localized program name and day count using
  `textContent`.
- [ ] In invalid/unsupported mode, show the matching localized error and the
  normal controls.
- [ ] Map `unsupported-version` to `setup.shared.unsupported`,
  `decompression-unavailable` to `setup.shared.browser_unsupported`, and all
  malformed/schema failures to `setup.shared.invalid`.
- [ ] In standard mode, preserve existing DOM and behavior.
- [ ] Make `setFirstRunOffer()` choose shared lede keys when appropriate.
- [ ] Change `#firstRunContinue` so shared mode only dismisses the install
  surface and keeps the gate; standard mode remains unchanged.
- [ ] Ensure `closeFirstRunInstall()` and the `appinstalled` event preserve the
  shared row.
- [ ] Bind `#firstRunSharedStart` once in `init()`.
- [ ] Add a busy guard and `aria-busy`/disabled state.
- [ ] Keep focus on a meaningful element after install-sheet closure and failed
  commits.

### Task 8: Construct and commit the shared proposal

**Owner:** Integration owner

**Files:** `app.js`

- [ ] Add `sharedSettingsPatch(raw)` with explicit field normalization,
  including `lang`.
- [ ] Add `buildSharedProgramMeta(rawMeta)` creating local IDs/timestamps and
  preserving the allowlisted semantic fields.
- [ ] Add `proposalFromSharedSetup(payload, baseState)` in the exact order from
  [Proposal construction](#proposal-construction).
- [ ] Revalidate immediately before proposal construction.
- [ ] Require `sharedSetupEligible()` immediately before commit to close the
  race with another tab and protect archived history.
- [ ] If `draftHasProgress()` is true, require the existing destructive-draft
  confirmation; on cancellation, perform no commit and re-enable the row.
- [ ] Use `programTransitionPrecondition(state)`.
- [ ] Use `destructiveDraftClearEffect(readDraftRaw())`.
- [ ] Commit through `commitProposedState()` only once.
- [ ] Consider the transaction successful when the existing persistence layer
  reports at least one durable replica, matching current behavior.
- [ ] On success, reset draft session state, set the first program day, close
  gates, render, continue tour/install logic, and apply cookie clearing rules.
- [ ] On failure, leave the gate and proposal available for retry.
- [ ] Add test hooks for pure proposal inspection with an injected state and
  persistence adapter.

### Task 9: Add browser flow tests

**Owner:** Browser-test agent

**Files:** `test/shared-setup-flow.mjs`, `test/install-modes.mjs`,
`test/accessibility.mjs`

Write tests against the frozen DOM IDs and module interface. It is acceptable
for the first browser-test commit to fail before Tasks 5–8 merge.

- [ ] Build a valid encoded English setup link in the browser.
- [ ] Build a valid Portuguese setup with non-default language/settings.
- [ ] Build from a state containing a legacy alias and assert the generated
  payload contains only its current canonical ID.
- [ ] Fresh link: hero and install card remain; standard choices are hidden;
  shared action is visible.
- [ ] The Portuguese link renders the gate in Portuguese before acceptance.
- [ ] Opening the link may create the same starter snapshot as an ordinary first
  run, but no shared program, metadata, custom definition, or setting—including
  `lang`—is durable before acceptance.
- [ ] Continue in Safari/browser removes only the install offer.
- [ ] Chrome install accepted/dismissed leaves the shared action standing.
- [ ] Cookie-only standalone launch reconstructs the shared gate.
- [ ] Start action persists program, custom definitions, program metadata, all
  allowlisted settings, and `lang`.
- [ ] Start action does not persist any payload log/history/notification/UI
  fields included by an adversarial fixture.
- [ ] New program ID, timestamps, started date, and exercise slot IDs differ
  from source values.
- [ ] The app lands on Today and the gate stays closed after reload.
- [ ] Double click produces one transition.
- [ ] Injected local-only and IDB-only persistence success follow existing
  transaction semantics.
- [ ] Total write failure retains the proposal and retry control.
- [ ] An unexpected in-progress workout draft requires the existing destructive
  confirmation; cancellation preserves both draft and proposal.
- [ ] Invalid/unsupported/oversized inputs write no application state, clear any
  staged invalid handoff cookie, and expose standard first-run choices.
- [ ] Missing Compression Streams use the exact localized unavailable messages;
  backup/program exports remain usable.
- [ ] Existing configured state or archived program history is never replaced
  and keeps its language.
- [ ] Unknown exercise IDs and missing custom definitions fail closed.
- [ ] Custom-definition ID collisions follow the remap/reuse table and never
  overwrite a recipient definition.
- [ ] Long program names cause no horizontal overflow.
- [ ] Standard no-link tests remain unchanged.
- [ ] EN/PT and install-mode matrix remain intact.
- [ ] Hidden controls are not keyboard-focusable or exposed to assistive
  technology.
- [ ] Shared action has an accessible name and visible focus treatment.

### Task 10: Service worker and cache rollover

**Owner:** Integration owner

**Files:** `sw.js`, `AGENTS.md`

- [ ] Add `./shared-setup.js` to `ASSETS` immediately before `app.js` or in the
  corresponding script order.
- [ ] Add it to `SHELL`.
- [ ] Bump `repforge-vNN` exactly once after all cached assets are final.
- [ ] Update the exact current cache name and asset inventory in `AGENTS.md`.
- [ ] Preserve the historical `repforge` cache-name prefix.
- [ ] Verify offline reload after one successful online load.

### Task 11: Documentation and decision record

**Owner:** Documentation agent

**Files:** `docs/adr/0007-shared-setup-links.md`, `docs/brand-guide.md`,
`README.md`

The ADR must record:

- Why the first-run gate, not import review, is the confirmation surface.
- Why known library/custom IDs are mandatory for review-free acceptance.
- Why language is part of the payload and is applied before acceptance.
- Why logs, history, notification permission, and UI preferences are excluded.
- Why the v1 transport is a self-contained fragment.
- Why a temporary cookie is required for iOS installation handoff.
- That the cookie value is encoded/compressed, not encrypted, and is sent with
  the matching `index.html` request.
- The 3,072-character install-safe ceiling and the cost: unusually large
  programs cannot use v1 links.
- The iOS 17.2 seamless-handoff baseline.
- The cost of not having server-backed short links: URLs can be long and cannot
  be revoked.
- The future migration path to an opaque token service without changing the
  inner payload schema.

The brand guide must describe standard and shared first-run modes without
changing the hero rules from ADR 0006.

README privacy copy must distinguish:

- ordinary training data, which remains local;
- a setup link, which the coach intentionally shares;
- the temporary install-handoff cookie;
- excluded workout history.

### Task 12: Full validation and visual proof

**Owner:** Integration owner, with browser-test agent assisting

Automated commands:

```bash
node test/shared-setup-unit.mjs
node test/shared-setup-flow.mjs
node test/install-modes.mjs
node test/program-import-review.mjs
node test/persistence-artifacts.mjs
node test/i18n.mjs
node test/accessibility.mjs
node test/simulation.mjs
node tools/build-i18n.mjs --check
node --check shared-setup.js
node --check app.js
node --check sw.js
git diff --check
```

Run browser suites against a static server:

```bash
python3 -m http.server 8000
```

Required screenshots in both languages where noted:

| Viewport | Browser mode | Payload language | Proof |
|---|---|---|---|
| 320 × 844 | iOS Safari | EN | Install card + one shared action; no overflow |
| 390 × 844 | iOS Safari | PT | Gate switches to Portuguese before acceptance |
| 430 × 932 | Android Chrome | EN | Worst mobile width and native install mode |
| 768 × 1024 | Standalone | PT | No install section; shared action aligned with hero |
| 1280 × 900 | Browser | EN | Wide hero and bounded shared control |

Manual device checks:

- [ ] iOS/iPadOS 17.2 or newer: link in Safari → Add to Home Screen → launch
  icon → shared gate recovered from cookie → accept.
- [ ] Current iOS: continue in Safari → accept → install shortly afterward →
  installed empty context can still recover the proposal.
- [ ] Current Android Chrome: open link → native install → standalone launch →
  accept.
- [ ] Copy the generated URL through at least one real messaging application
  and confirm it is not truncated.
- [ ] Airplane/offline after the shell and handoff are available: confirm the
  installed gate can decode locally.
- [ ] Clear site data: confirm no stale proposal survives.

PR description proof must include:

- Payload size for the representative four-day fixture before and after gzip.
- Exact encoded length relative to the 3,072-character limit.
- Screenshots listed above.
- A state diff showing the allowlisted fields that changed and excluded fields
  that did not.
- Automated command results.
- Manual iOS handoff result and OS/browser version.

---

## Parallel implementation strategy

### Principles

1. Parallelize by file ownership, not by vague feature slices.
2. Freeze interfaces and fixtures before parallel work begins.
3. Only the integration owner edits `app.js`, because boot, first-run rendering,
   share generation, language switching, and atomic persistence are tightly
   coupled in that file.
4. Parallel agents work on isolated branches/worktrees. They do not share a
   mutable checkout.
5. Each agent commits only owned files and returns a commit SHA plus validation
   output.
6. The integration owner cherry-picks in the prescribed order.
7. Agents must not opportunistically refactor adjacent code.
8. No agent bumps the service-worker cache except the integration owner at the
   end.

### Branch/worktree setup

After Task 0 is committed as `<contract-sha>`:

```bash
git worktree add ../repforge-codec -b agent/shared-setup-codec <contract-sha>
git worktree add ../repforge-ui -b agent/shared-setup-ui <contract-sha>
git worktree add ../repforge-tests -b agent/shared-setup-tests <contract-sha>
```

The parent/integration checkout remains on:

```text
agent/shared-setup-links
```

If the orchestration environment shares one filesystem rather than isolated
worktrees, do not run write-capable agents concurrently. Create the worktrees
first and give each agent its absolute worktree path.

### Wave 0 — integration owner only

Complete Task 0 and commit the contract. No other work begins until the payload
shape, limits, module API, DOM IDs, and fixtures are frozen.

### Wave 1 — three subagents in parallel, parent available for integration

| Worker | Assignment | Owned files | Must not edit | Completion gate |
|---|---|---|---|---|
| Codec agent | Tasks 1–2 | `shared-setup.js`, `test/shared-setup-unit.mjs` | `app.js`, HTML, CSS, i18n, SW | Unit tests + syntax pass |
| UI/localization agent | Tasks 3–4 | `index.html`, `styles.css`, `i18n-en.json`, `i18n-pt.json`, `i18n.js` | `app.js`, tests, SW | i18n build/check + static responsive inspection |
| Browser-test agent | Task 9 test authoring | `test/shared-setup-flow.mjs`, `test/install-modes.mjs`, `test/accessibility.mjs` | Application files | Tests are complete and fail only for missing implementation |
| Integration owner | Prepare Tasks 5–8 against frozen interfaces; review agent output | `app.js` only | Agent-owned files | `node --check app.js` throughout |

Suggested codec-agent prompt:

```text
Implement Tasks 1 and 2 from
docs/superpowers/plans/2026-08-17-shared-setup-links.md. Work only in
shared-setup.js and test/shared-setup-unit.mjs. Follow the frozen
RepForgeSharedSetup interface exactly. Do not edit app.js, HTML, CSS, i18n,
service worker, or documentation. Return the commit SHA and exact test output.
```

Suggested UI/localization-agent prompt:

```text
Implement Tasks 3 and 4 from
docs/superpowers/plans/2026-08-17-shared-setup-links.md. Work only in
index.html, styles.css, i18n-en.json, i18n-pt.json, and generated i18n.js. Keep
the PR #157 hero and install layout unchanged. Add inert DOM hooks and exact
EN/PT copy; do not add behavior or edit app.js/tests/sw.js. Return the commit
SHA, i18n check output, and viewport notes.
```

Suggested browser-test-agent prompt:

```text
Implement Task 9 tests from
docs/superpowers/plans/2026-08-17-shared-setup-links.md using the frozen module
API and DOM IDs. Own only test/shared-setup-flow.mjs, test/install-modes.mjs,
and test/accessibility.mjs. Do not weaken existing assertions. It is acceptable
for new tests to fail because behavior is not integrated yet; classify every
failure. Return the commit SHA and test output.
```

### Wave 1 merge order

1. Cherry-pick codec agent.
2. Run codec unit tests and syntax locally.
3. Cherry-pick UI/localization agent.
4. Regenerate/check i18n to prove no drift.
5. Cherry-pick browser-test agent.
6. Run new browser tests and confirm failures match missing integration rather
   than broken fixtures or selectors.

Do not resolve conflicts by dropping assertions or changing the frozen payload
contract. If a conflict reveals an interface error, pause integration, amend
the contract explicitly, and notify every affected agent.

### Wave 2 — integration and independent documentation

After Wave 1 is merged:

| Worker | Assignment | Owned files | Completion gate |
|---|---|---|---|
| Integration owner | Tasks 5–8 and 10 | `app.js`, then `sw.js` | Shared flow tests pass; syntax pass |
| Documentation agent | Task 11 | ADR, brand guide, README | Docs cover every locked trade-off |
| Browser-test agent | Diagnose failing browser cases; add only missing assertions | Test files only | No regression or weakened test |
| UI agent | Produce screenshots and report layout defects; no code changes unless reassigned | Proof artifacts outside code paths | Screenshot matrix complete |

Suggested documentation-agent prompt:

```text
Implement Task 11 from
docs/superpowers/plans/2026-08-17-shared-setup-links.md. Own only
docs/adr/0007-shared-setup-links.md, docs/brand-guide.md, and README.md. Do not
edit AGENTS.md, app.js, sw.js, tests, or UI. Record language as payload data, the
iOS cookie handoff, exact exclusions, privacy cost, URL-size limit, and future
token-service path. Return a commit SHA and diff summary. Put any recommended
AGENTS.md wording in the handoff message instead of editing the file.
```

### Wave 3 — serial integration gate

Only the integration owner writes during this wave.

1. Resolve remaining integration failures.
2. Review the entire state proposal field by field.
3. Run the complete automated command list.
4. Apply the one service-worker cache rollover.
5. Finish `AGENTS.md` with the actual cache number.
6. Run manual device handoff checks.
7. Generate screenshots and PR proof.
8. Run `git diff --check` last.

### Subagent handoff template

Every subagent must return:

```markdown
## Handoff

- Branch:
- Commit SHA:
- Files changed:
- Contract assumptions:
- Commands run:
- Passing checks:
- Expected failures:
- Risks or unresolved questions:
- Suggested cherry-pick order:
```

An answer without a commit SHA or with edits outside the assigned ownership is
not ready to integrate.

### Conflict-avoidance rules

- `app.js`: integration owner only.
- `sw.js`: integration owner only.
- `i18n.js`: localization agent generates it; integrator regenerates only for
  verification unless adding new keys was explicitly reassigned.
- Test agents never change product code to make tests pass.
- Product agents never delete or relax existing tests.
- Agents do not bump cache versions independently.
- Screenshot agents do not commit browser-generated temporary profiles or
  downloaded dependencies.
- If one workstream needs another workstream's file, communicate the requested
  interface change to the integration owner instead of editing across the
  boundary.

---

## Test matrix

### Payload matrix

| Case | Expected |
|---|---|
| EN, numeric RIR, kg | Gate EN; exact settings persist |
| PT, effort mode, kg | Gate PT before commit; PT persists |
| EN, effort mode, lb | Unit and RIR mode persist |
| Built-in IDs only | No review; commit allowed |
| Built-ins + embedded custom | Custom merges; commit allowed |
| Unknown built-in ID | Invalid; no write |
| Missing custom definition | Invalid; no write |
| Duplicate day/order | Invalid; no write |
| Missing language | Invalid v1; no application-state write; staged cookie cleared |
| Unsupported language | Invalid; no application-state write; staged cookie cleared |
| Payload contains logs/history | Keys ignored; empty arrays persist |
| Payload enables notifications | Key ignored; notifications remain device-owned |
| Payload contains source IDs/timestamps | Fresh local values persist |
| Oversized encoded input | Rejected before decode |
| Compression bomb | Rejected during bounded stream read |
| Future version | Unsupported message; normal choices available |

### Context matrix

| Context | Source | Expected |
|---|---|---|
| Fresh browser | Fragment | Shared gate |
| Fresh browser reload | Cookie after fragment cleaned | Shared gate |
| Fresh standalone | Copied cookie | Shared gate, no install section |
| Fresh browser | No source | Standard gate unchanged |
| Configured browser | Fragment | No replacement; notice |
| Configured standalone | Cookie | Ignore/retain safely; no replacement |
| Unonboarded state with archived history | Fragment | No replacement or history clearing; notice |
| Invalid cookie | Cookie | Clear cookie; standard gate |
| Persistence race | Valid fragment | Precondition prevents unintended replacement |

### Responsive/accessibility matrix

- Widths: 320, 390, 430, 759, 760, 768, 1024, 1280.
- Heights: 568, 844, 932, 1024 where relevant.
- Languages: EN and PT.
- Modes: iOS Safari install, other iOS browser explanation, Chromium native
  install, no mechanism, standalone.
- Assertions: no horizontal overflow; long name wraps; hero geometry unchanged;
  shared/standard hidden groups are not focusable; focus remains trapped in the
  modal gate; busy state announced; error status announced; color and focus
  styling preserve existing accessibility.

---

## Rollout, compatibility, and rollback

### Rollout

- Ship behind presence of a valid `#setup`/handoff source; no feature flag is
  needed for ordinary users because the normal path remains unchanged.
- Keep schema `version: 1` immutable after release. Add v2 rather than changing
  v1 interpretation.
- The generated link uses the deployed app URL, not the current localhost or
  preview origin, unless an explicit development hook is active in tests.
- Do not generate production links from an unmerged preview deployment.

### Compatibility

- Existing backup and program import formats remain unchanged.
- Existing `?goto=` links remain unchanged.
- Existing service-worker scope and manifest identity remain unchanged.
- Existing storage keys and `repforge` internal identifiers remain unchanged.
- A shared setup can be decoded offline once the app shell and proposal are
  locally available.
- Seamless Safari-to-installed handoff requires the documented iOS baseline.

### Rollback

If the feature must be disabled after release:

1. Stop rendering the share-link creation control.
2. Leave the decoder capable of recognizing existing v1 links long enough to
   show a clear unsupported notice rather than a blank gate.
3. Do not reinterpret v1 links as program-import files.
4. Clear invalid/stale handoff cookies.
5. Roll the service-worker cache again so clients receive the rollback.

Never delete or rewrite a user's accepted program during rollback; after
acceptance it is ordinary Taurifer state.

---

## Definition of done

- [ ] A coach can create and share an install-safe setup URL without exporting
  a file.
- [ ] The payload includes program, program metadata, allowlisted app settings,
  and language.
- [ ] Opening a valid link on first run preserves the current hero/install gate
  and replaces Create/Import with exactly one program-start action.
- [ ] The gate renders in the payload language before durable acceptance.
- [ ] Continue in browser does not enter the normal generator in shared mode.
- [ ] The recipient never sees file import or exercise mapping for a valid
  canonical payload.
- [ ] Acceptance is one atomic state transition.
- [ ] All program/app settings in the contract, including `lang`, persist.
- [ ] Logs, history, notification permission, voice preference, UI preferences,
  storage metadata, and source identities do not persist.
- [ ] Existing configured users are never overwritten.
- [ ] iOS Add to Home Screen handoff is verified on a real supported device.
- [ ] EN/PT, capability, responsive, persistence, i18n, and accessibility tests
  pass.
- [ ] Service-worker cache and `AGENTS.md` inventory agree.
- [ ] ADR, brand guide, README, screenshots, payload measurements, and PR proof
  are complete.
- [ ] `git diff --check` is clean.
