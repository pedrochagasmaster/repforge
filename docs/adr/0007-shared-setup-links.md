# Shared setup links carry a validated first-run proposal

Taurifer is local-first and has no hosted program store. A coach shares a
complete program in a URL fragment; the recipient's browser decodes it on the
device. The link is a bearer capability, not proof of identity and not an
upload. The first-run gate is the consent boundary: no proposal field is
persisted until the recipient starts the program.

The active contract is the v4 protocol described below and in Plan 067.
[Plan 073](../../plans/073-generator-rule-parity.md) owns the current
deterministic generation and recipe-version rules. The
older implementation plan at
[`docs/superpowers/plans/2026-08-17-shared-setup-links.md`](../superpowers/plans/2026-08-17-shared-setup-links.md)
records the original interface and is retained as history; its v1/v2 codec and
permanent-decoding requirements are superseded.

## The proposal carries the complete program definition

The semantic document is:

```json
{
  "kind": "taurifer-shared-setup",
  "version": 2,
  "program": {
    "name": "Coach program",
    "definition": "complete canonical ProgramDefinition",
    "customExercises": []
  },
  "settings": "the eight allowlisted settings",
  "language": "en or pt"
}
```

`customExercises` is optional. The complete `ProgramDefinition` retains its
request, provenance, stable day/slot/prescription identities, training and rest
days, every cycle, raw metric UUIDs and definitions, and canonical targets.
It carries prescriptions, not performed actuals or history. Settings are the
existing eight-key allowlist: `jumpPct`, `minJump`, `rirHigh`, `hardRir`,
`restSec`, `unit`, `lang`, and `rirMode`. `settings.lang` and top-level
`language` must agree; the wire stores the language once and reconstructs both
fields on decode. Appearance remains device-only and is excluded.

Every selected built-in movement and ontology reference uses its exact current
source UUID. A custom movement must have its exact custom definition in the
same proposal. Names and historical IDs are not identity: received IDs are
never fuzzy-matched or repointed. The canonical program compiler validates
the complete definition, its metric composition, source IDs, and custom
references before a proposal is accepted.

## v4 wire format and retired versions

New links use this fragment form:

```text
https://pedrochagasmaster.github.io/repforge/index.html#setup=v4.<base64url-gzip>
```

The payload is compact positional JSON, gzip-compressed and encoded as
unpadded base64url. Its fixed tuple carries semantic version 2, program name,
the complete definition, optional custom definitions, the allowlisted setting
values, and one language code. The prefix identifies the wire format; the
semantic document's `version` identifies its object contract. Compression is
not encryption and does not authenticate the coach.

A generated program that its generator reproduces exactly from the canonical
request travels in a regenerable form instead of the full definition. The recipe
binds the semantic catalogue fingerprint, generator version and compact request.
It has no variable seed. Complete multi-cycle definitions can exceed the link
limit; the recipe can share an unchanged generated definition within that limit.
The receiver regenerates with its
own generator, and the result must equal the shared definition, so this form is
only chosen when the sender's regeneration is identical. A link from a
different generator version decodes as `unsupported-version` rather than
producing a different program. An edited generated program is never replaced
by its regeneration: it travels in full, or is refused when too large.

The previous `v1.`, `v2.`, and `v3.` wire formats are explicitly unsupported.
Decoding one returns an `unsupported-version` result with the exact original
encoded bytes. The app leaves that fragment or cookie untouched and does not
persist or clear it as a side effect. Unknown future wire versions follow the
same rule. This replacement intentionally retires the previous requirement to
decode old envelopes forever; Plan 067 authorizes a single replacement release
and no existing-user migration.

The encoded value, including the three-character `v4.` prefix, is limited to
**3,072 characters**. The compressed ceiling is 2,301 bytes. A valid proposal
that exceeds either bound is refused intact: exercises, notes, settings,
cycles, and provenance are never trimmed to fit. A representative complete
URL of at most 700 characters remains a regression target, not a universal
maximum. Different browsers need not produce identical gzip bytes; success is
semantic equality after decode.

The representative proof uses a complete seven-day manual definition with one
source-catalog movement whose only actual metric is repetitions, plus all eight
allowlisted settings. It measures the full production-origin URL, including the
path and `#setup=` fragment, then decodes the link and compares the complete
semantic proposal. The current Node 22 fixture measures 681 characters; the
assertion remains the 700-character regression target, not a fixed byte-for-byte
expectation across runtimes. A short URL only counts if the roundtrip preserves
every field and array order.

## First-run consent and identity rules

A valid decoded proposal may adapt the fresh-device first-run screen, but it
does not change durable language, settings, or program data. The recipient
must press **Start this program** before the proposal enters the common
editable preview. Activation remains explicit in that preview. A device with
an onboarded program, workout logs, or archived program history is ineligible;
opening a link there neither replaces its program nor mutates state.

An invalid or unsupported proposal is not partially staged. No logs, prior
blocks, drafts, notification permission, nested notification switches,
device UI preferences, or performed values belong in a setup proposal. An
incoming performed-state field makes the proposal invalid; the decoder does
not silently discard it.

## Temporary Home Screen handoff cookie

The manifest opens `index.html`, so the fragment is absent when a newly
installed Home Screen app first starts. The existing first-party cookie can
carry the encoded proposal across that navigation:

```text
Name:      repforge_setup_v1
Value:     v4.<base64url-gzip>
Path:      the app scope, the directory index.html lives in (/ on taurifer.com)
Max-Age:   604800 seconds
SameSite:  Lax
Secure:    yes outside localhost
HttpOnly:  no — client JavaScript reads the proposal
```

The cookie's historical name stays unchanged. The browser sends it with every
request inside the app scope that carries credentials: the document and the
app's static files. The transfer client's `/v1/` requests omit credentials, so
the transfer service never receives it. It contains readable compressed
data, not encrypted data. The setup module reads exact cookie and fragment
bytes without consuming them. Unsupported versions remain available for
diagnostics or explicit re-export and are not cleared automatically. The
seven-day limit and disclosure remain in force.

The handoff is documented for iOS/iPadOS 17.2 and newer, where WebKit may copy
cookies into a newly installed Home Screen app. The link still works in a
browser on older systems. Do not claim older Home Screen installs inherit the
cookie or claim physical iOS validation unless it has been performed.

### Amendment (2026-10-15): the cookie path is the app scope

The cookie used to be scoped to the pathname of `index.html`. On
`taurifer.com` the static host answers `/index.html` with `308 Location: /`,
so the app's document lives at `/`, and the installed app's manifest launch
(`./index.html`) lands there too. A cookie scoped to `/index.html` is neither
sent to `/` nor visible in its `document.cookie`, so a received link never
reached the installed app. The path is now the app scope, which covers
wherever the host serves the document. Writes and clears also expire any
cookie a previous release left at the `index.html` path. The manifest
`start_url` stays `./index.html` to keep the installed Android app's WebAPK
identity (#305). The cost is that the cookie now reaches the static host with
the app's file requests as well as the document request; it already reached
that host, and its contents and lifetime are unchanged.
`test/install-handoff-redirect.mjs` proves the handoff across the redirect.

## Privacy and sharing

Fragments are not sent in the initial HTTP request, but URLs may remain in
browser history, clipboard history, synced tabs, messaging previews, and
screenshots. The cookie is sent to the static host with requests inside the
app scope. The cached in-app Privacy page explains the bearer-link and cookie
behavior. The Share surface stays task-only; system sharing sends the title
and URL, and Copy link copies the URL. Never log the payload, cookie, or full
URL, and do not claim authenticity.

The one-hour encrypted install transfer ([ADR 0013](0013-temporary-install-transfer.md))
is a separate approved exception for moving an existing installation. It has
its own token and cookie and never carries, consumes, or replaces a setup
proposal. Ordinary workout data remains local except for that explicit
transfer and opted-in telemetry.
