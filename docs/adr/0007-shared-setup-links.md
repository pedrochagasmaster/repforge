# Shared setup links are a first-run proposal carried in the URL itself

Taurifer is local-first: it has no accounts, no hosted program store, and no
backend that could hold a coach's split for a recipient to fetch. Coaches
still need a way to hand someone a complete program — metadata, slots,
embedded custom exercises, allowlisted app settings, and language — without
exporting a file or walking them through the eight-step generator. The
decision (product owner, 2026-08, locked in the shared-setup plan) is that
the shared artifact is a URL. The recipient with no active program still
meets the existing first-run gate (ADR 0005, ADR 0006). Create and Import
are replaced by one Start this program action. Nothing from the payload
becomes durable until that tap.

This ADR records the locked trade-offs. The implementing contract is
`docs/superpowers/plans/2026-08-17-shared-setup-links.md`.

## The gate is consent; preview is activation review

Import review exists because a program file can name movements the library
does not recognize. A shared setup is a different object: every slot must
already resolve to a current built-in library id or to a custom definition
carried in the same payload. That is what makes it safe to skip file
pickers, fuzzy name matching, and exercise-mapping review. The first-run gate
remains the consent boundary, and the row identifies the proposal by program
name and number of training days; it does not dump every exercise or setting.
After Start this program, the validated handoff enters Plan 048's common
editable preview. That preview is still a draft: the recipient must choose
its explicit Use this program action before the active program changes.

The original shared-link decision rejected routing through import review (it
would invent mapping work the payload already made unnecessary), auto-accepting
on open (a URL is not consent), and a dedicated shared-only preview (a second
threshold on a gate that already asked the recipient to start). Plan 048 later
made one editable preview and one archive-safe activation transaction the
shared contract for every program-entry route. This is a convergence of the
handoff after consent, not a change to the shared payload, codec, or eligibility
rules. Existing configured state — onboarded metadata, any log rows, or any
archived program history — never opens the gate and never mutates. Replacing an
in-use program from a link remains a later product, not this one.

## Known ids, or no acceptance

Handoff staging is allowed only when every linked exercise resolves. No fuzzy
matching is permitted on this path. Detached or raw slots are out of scope for
v1: the coach creates a custom exercise first so its definition travels with
the program. Outbound links may translate a `LEGACY_LIBRARY_IDS` alias to its
current built-in id; a received v1 payload must already contain current ids, so
retired aliases never become new long-lived references. Staging writes only
the owned setup draft. Final activation is explicit and uses the common
archive-safe transaction.

The cost is that a program with an unlinked slot cannot be shared until
the coach saves it as a custom exercise. The gain is that the recipient
never has to classify names, and a modified but still-schema-valid link
cannot smuggle an unknown movement into durable state.

## Language is payload data

`settings.lang` is required in v1 and must be `en` or `pt`. It is not a
display hint. A valid first-run proposal changes the gate's runtime
language before the hero renders, so a Portuguese program is offered in
Portuguese. Opening the link does not persist that language, or any other
payload field. Invalid sources, and links opened against already-configured
state, leave the recovered language alone. Start this program persists only
the owned setup draft; final activation writes `lang` in the same state proposal
as the program. If a future cancel action returns to standard first run, it
restores the language recorded before the proposal took the runtime.

We rejected detecting the recipient's browser language for the shared gate
(the coach chose the language with the program) and persisting `lang` on
decode (that would write shared settings before Start this program).

## What the link must not carry

A setup link is a program template, not a backup. Generated payloads omit
workout logs, completed sessions, prior blocks, drafts, notification
permission and every nested notification switch, voice-input preference,
device UI preferences, storage revisions, and source program or slot
identities. Final activation mints a fresh local program id, timestamps,
started date, and slot ids. The decoder ignores those keys if a hand-authored
link contains them; they must not reach the staged proposal or final active
state.

Notification permission is a device prompt, not a coach setting. UI chrome
belongs to the recipient's browser. History is the recipient's training
record. Silently replacing an existing program, or clearing archived
history, is out of scope so a forwarded link cannot overwrite someone who
already trains in Taurifer.

## Self-contained fragment

Canonical forms:

```text
https://pedrochagasmaster.github.io/repforge/index.html#setup=v1.<base64url-gzip>
https://pedrochagasmaster.github.io/repforge/index.html#setup=v2.<base64url-gzip>
```

The payload lives in the fragment, not in a query string. GitHub Pages and
any other static host never see it on the HTTP request. Existing `?goto=`
handling stays independent. The start path is `index.html`, matching the
manifest, so a later installed app and a browser session resolve the same
document. There is no backend and no upload: the URL itself is the shared
artifact.

The semantic document remains kind `taurifer-shared-setup`, version `1`.
That inner schema is immutable after release. Two outer envelopes carry
it; both are gzip via Compression Streams, then unpadded base64url, and
both are self-contained:

- `v1.` — deterministic canonical JSON of the semantic document.
- `v2.` — an immutable compact tuple JSON of the same document. Its optional
  bit masks and tuple layout are frozen forever.
- `v3.` — a compact tuple extension for the versioned progression envelope.
  It does not change the v1/v2 decoder contract.

The decoder must accept all three released prefixes forever. New encoding
validates the semantic payload once, builds every applicable envelope, and
emits the shortest valid candidate; equal length keeps `v1.`. A later unsupported prefix is
rejected before decompression. Compression and encoding are not
encryption.

The v2 tuple is a fixed 5-element array: metadata, settings, a day-label
table, exercises, and custom definitions. Closed enums become 1-based
codes (`0` for a present null). Exercises name a day by table index and
a custom movement by definition index. Optional fields ride on integer
masks with arity equal to the fixed prefix plus the set-bit count.
Unpacking is bounded and strict — wrong arity, unknown mask bits, or an
unreferenced day or custom fails closed — and the expanded object then
runs the existing semantic validator. Exact slot layouts live in
`shared-setup.js`; this ADR locks each released tuple layout and mask.

We rejected a query parameter (hosts, proxies, and referrers would log the
program), an arbitrary remote payload URL (that re-enters a backend and a
fetch trust boundary), and an uncompressed fragment (it would not fit the
install-safe ceiling). Do not reshape the inner fields to anticipate a
later opaque-token service; that path can wrap the same version-1
document.

## Temporary cookie for iOS installation

The manifest launches `./index.html`, not the shared URL, so the fragment
is gone when the Home Screen app first opens. WebKit copies cookies into a
newly installed Home Screen web app and does not copy localStorage,
IndexedDB, Cache Storage, or the original fragment. The compressed
proposal therefore also lives for up to seven days in a first-party cookie:

```text
Name:      repforge_setup_v1
Value:     v1.<base64url-gzip>, v2.<base64url-gzip>, or v3.<base64url-gzip>
Path:      pathname of index.html
           (/repforge/index.html in production, /index.html locally)
Max-Age:   604800
SameSite:  Lax
Secure:    yes outside localhost
HttpOnly:  no — client JavaScript must read it
```

The cookie name stays `repforge_setup_v1` even when the value is a `v2.` or
`v3.` envelope. The cookie carries the encoded value verbatim. It is a
historical identifier; renaming it would break already
installed handoff. The seven-day disclosure is unchanged.

The cookie is encoded and compressed, not encrypted. It is sent with the
matching `index.html` navigation request. Path-scoping keeps it off asset
requests; it does not keep the program off the document request. Treat
every fragment and cookie byte as untrusted: bound encoded size before
allocation, bound compressed size before gzip, bound decompressed output
while reading the stream, pick every accepted field explicitly, and never
merge a decoded object into state.

A valid fragment is preferred over the cookie because it is the link just
opened. The cookie is written before decode so a later Add to Home Screen
can recover the same bytes. Invalid staged cookies are cleared as soon as
validation fails. Successful acceptance in standalone clears immediately;
acceptance in the browser keeps the cookie until expiry so a shortly
later iOS install can still inherit the proposal. A standard URL must
never delete a valid handoff cookie before checking whether this context
is a fresh standalone app.

Seamless Safari-to-installed handoff is documented against **iOS/iPadOS
17.2** and newer, the baseline WebKit states for copying login cookies
into Home Screen apps. The link still works in-browser on older
platforms. This product must not claim that an older Home Screen
installation will inherit the proposal, and it must not claim physical
iOS device validation. Compression Streams themselves landed earlier
(Safari 16.4); that is necessary to encode and decode, not sufficient
for the cookie copy.

## Bearer links, size, and what we are not building

A share link is a bearer capability. Anyone who possesses it can read and
use the program. Encoding is not proof of coach identity. The fragment is
not sent in the initial HTTP request, but the URL can remain in browser
history, clipboard history, synced tabs, messaging previews, or
screenshots. The in-app share sheet states exactly what is included — this program,
its settings, and the app language — the seven-day cookie disclosure,
and that workout history is not included. That text stays on the sheet
until the coach acts. Outbound system share is title plus URL only;
Copy link writes the URL only. Do not paste the privacy or cookie
paragraph into recipient messages. Do not advertise authenticity. A
modified but valid payload is still just a bearer link.

The encoded value, including its three-character `v1.`, `v2.`, or `v3.` prefix,
must be at most **3,072** characters (`MAX_ENCODED_CHARS`). The matching
compressed ceiling is 2,301 bytes: 2,301 bytes encode to 3,071
characters and fit; 2,302 bytes encode to 3,073 and must fail. Sharing
disables rather than silently dropping exercises or notes. Notes-heavy
or custom-heavy programs may still produce a longer URL and must never
be truncated; they fail closed if they miss the hard ceiling.

A representative complete production URL — the GitHub Pages
`index.html#setup=` prefix plus a typical four-day payload — is a
regression target of **at most 700 characters**. That is not a universal
maximum.

Gzip bytes need not be identical across engines. Interoperability is
semantic equality after decode, and canonical tuple equality for a compact
v2 or v3 envelope, not identical compressed bytes.

There is no hosted short-link service in this version, so URLs can be
long and cannot be revoked. That is the cost of keeping the payload off
a server. The link remains a local-first bearer capability: unencrypted,
readable by anyone who has it.

A later opaque-token service can wrap the same inner document without
changing the v1 payload schema: the fragment would carry a token the
client redeems, while `taurifer-shared-setup` version 1 stays the program
object. Do not reshape the inner fields to anticipate that path.

Unchanged: the first-run hero, brand lockup, illustration, installation
card, installation sheet, and responsive composition (ADR 0006, ADR
0005); backup and program-import formats; storage keys and the `repforge`
codename; service-worker scope and manifest identity. Taurifer never uploads
ordinary workout data. The coach who sends the URL is the one who shared the
program; the temporary handoff cookie is sent to the static host as disclosed
above.
