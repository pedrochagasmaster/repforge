# ADR 0026 — Trainer loop: a seven-day encrypted relay and a separate trainer site

**Status:** Accepted by the owner on 2026-11-26, with the amendment of the same date below. User-visible slices still wait for the prose amendments in Plan 086 slice 0 and for an approved design and copy.
**Scope:** Program handoff between an in-person trainer and their clients, the client's training update back to the trainer, and the trainer's own tool. Solo use of the app is unchanged.
**Amends:** [ADR 0007](0007-shared-setup-links.md)'s "no hosted store" boundary and first-run-only rule, for this scope only; the product guardrail in `plans/README.md` that names install transfer as the only server exception; the backlog's earlier "no coach view" line. [ADR 0013](0013-temporary-install-transfer.md) is not changed and is not reused as a transport.
**Implementation:** [Plan 086](../../plans/086-trainer-loop.md).

## Owner decisions (2026-11-25)

1. The audience is the in-person personal trainer with roughly 15–30 clients.
2. A local trainer view is reopened. The trainer keeps a client list.
3. The trainer's tool is a separate site at `studio.taurifer.com`. It does not include the rest of the app. The owner first chose `pro` and replaced it the same day because Pro already names the app's paid tier; "studio" reads the same in English and Portuguese and names a workplace, not Taurifer.
4. Payloads travel through an encrypted relay. A relay link stays readable for seven days.
5. Three trainers reviewed the [concept mock](../design/trainer-loop-mock/README.md) and approved its direction. They named the transport format and the separate site as the two conditions.

## Why a relay

Measured on `main` 6f2e18a with `shared-setup.js`:

| Payload | Result |
| --- | --- |
| One-movement program sent in full | 649 characters |
| Generated four-day program sent as its recipe | 942 characters |
| The same four-day, seven-week program (15 slots) sent in full, as a hand-built program travels | refused as `encoded-too-large`; about 7.5 KB gzipped before the compact wire |

A trainer's hand-built program is the main case and it does not fit the 3,072-character link. The existing fallback is a program file, which a trainer cannot open from a chat into a website and a client must route through Import. A QR code also becomes unreliable long before 3,000 characters. The relay makes every link short and removes size as a failure.

The training update was measured afterwards on a fixture; see the amendment below.

## The relay contract

**Encryption is on the device.** The sender generates a random 256-bit key, encrypts the payload with AES-256-GCM in the browser, and uploads only ciphertext. The key travels in the link's fragment and is never sent to the service. This is stronger than ADR 0013, whose encryption is server-side; a seven-day record justifies the difference. The service cannot read a payload, and a storage or recovery image holds ciphertext without a key.

**Link shape.** `https://<origin>/#r=<record id>.<key>`, both unpadded base64url. The origin is the app for a program going to a client and the trainer site for an update going to a trainer. The same string is what a QR code encodes.

**Record lifetime.** The service assigns the expiry, at most seven days after creation, and deletes the record at expiry. A record can be read more than once until then, because a trainer may open an update on a phone and again on a laptop and a client may tap a link twice. The sender's device keeps the record id so a later slice can add "withdraw this link".

**What the service stores.** Ciphertext, nonce, protocol version, creation time, expiry and size. It stores no name, no account, no device identifier and no link between records. Request bodies and full URLs are never logged, as in ADR 0013.

**What a link grants.** Anyone holding the link within seven days can read that payload. This matches a setup link today, which carries its whole payload in the open. The disclosure says so.

**Limits and abuse.** The service is anonymous storage, so it enforces a payload size bound, a per-address create rate and an operating cost threshold that fails new creates and alerts the owner, following ADR 0013's operations contract. A kill switch stops new creates without affecting local data.

**When the relay is unavailable.** The sender falls back to the existing setup link when the payload fits and to the program file otherwise. Receiving a link needs a connection once; after that the program works offline as today.

**iOS Home Screen handoff.** The existing handoff cookie carries the encoded proposal. For a relay link it carries only the record id and key, which is far below the cookie's size limit. The cookie's name, scope and seven-day age are unchanged.

**Provider.** Cloudflare Workers with EU-jurisdiction Durable Objects, the provider already selected in ADR 0013 (owner, 2026-11-26).

## The two payloads

Both are versioned documents validated before anything is persisted, with the same fail-closed rules as `shared-setup.js`: unknown kinds and newer versions are refused whole and never partly applied.

**Program handoff (trainer to client).** The program definition, the custom exercises it references, the allowlisted settings and language that a setup link carries today, starting loads the trainer set, an optional message, and the trainer's attribution: display name and professional registration text. It carries nothing about any other client. A second handoff to the same client is a program update.

**Training update (client to trainer).** Sessions logged under the current program since the last update the client sent: exercises, loads, reps, effort and the client's notes, plus the current program. It excludes everything from before the current program, body weight, settings and device preferences.

## Consent and the client's control

- Nothing leaves the client's device until the client taps Send, every time. There is no automatic or scheduled sending and the trainer cannot request data from the client's device.
- The send sheet lists what goes and what stays before the tap, and states that an encrypted copy is held for up to seven days and that anyone with the link can open it.
- A program from a trainer is a proposal. A new client confirms at the first-run gate as today. An existing client sees what changed and chooses to use it or keep the current program; history is kept either way. This replaces ADR 0007's rule that a link is never applied once a program or history exists, for relay program handoffs only. Plain setup links keep that rule until the owner decides otherwise.
- Attribution is text. It never restyles the app and never affects a recommendation (`CONTEXT.md`, shared-program provenance).

## The trainer site

- A second static site in this repository, served at `studio.taurifer.com`. It has its own origin and therefore its own storage, so the client list never touches the app's single-program state.
- No account and no sync. The client list, each client's programs and received updates are stored on the trainer's device.
- It reuses the program editor, exercise catalogue, program compiler and the payload codecs. It does not include workout logging, Progress or History for the trainer.
- Because clearing browser data or changing devices would erase a trainer's client list, a backup export and import ships in the same slice as the client list.
- It works on a phone and on a laptop.
- Copy never calls Taurifer a coach or implies that Taurifer supervises training. The trainer is the professional; Taurifer is their tool. The existing `CONTEXT.md` rule stays.

## Threats considered

| Threat | Position |
| --- | --- |
| The service or its provider is compromised | Ciphertext only; keys are never uploaded. |
| A link is forwarded or leaked | The holder can read that one payload until expiry. Disclosed; withdrawal is a later slice. |
| Chat link-preview fetchers | They fetch the page without the fragment and cannot read a record. |
| A hostile payload | Decrypted bytes go through the same strict validation as a setup link before any state changes. |
| Anonymous storage abuse | Size bound, create rate and cost threshold. |
| The trainer's device is lost | Client data on it is as protected as the device. Stated on the trainer site. |

## Amendment (2026-11-26): measured results and settled values

The relay and the two documents were built and proven as Plan 086 slice 1 and the non-visual parts of slices 2–4 (#837, #838). The owner settled the values below the same day.

**Measured.**

| Item | Result |
| --- | --- |
| Link length | 90 characters for the app, 97 for the trainer site; both fit a 41×41-module QR code (version 6, medium error correction) |
| The refused four-day, seven-week program | 119,804 bytes of JSON; round-trips byte for byte locally and on staging |
| Training update, 3 weeks (12 sessions) | 167,721 bytes of JSON, 10,904 gzipped |
| Training update, 30 weeks (120 sessions) | 601,125 bytes of JSON, 28,188 gzipped |

The update figures come from a realistic fixture, not real user logs. The current program is most of the size; a session adds about 3.3 KB of JSON. A phone camera reading the code at arm's length is not yet tested; only a software decode is.

**Settled values.**

- **Record size:** at most 256 KiB of ciphertext per record.
- **Document size:** at most 1 MiB of JSON per document and at most 120 sessions per training update. Above 120 the encoder refuses with a code; it never drops sessions.
- **Create rate:** 300 creates per address per hour. A gym's Wi-Fi and many mobile carriers put many people behind one address, so a low per-address limit would refuse trainers and clients for no visible reason; the size bound and the cost gate carry the abuse limit. Reads: 120 per address per minute. (#837 was built with 30 creates per hour and must change before it merges.)
- **Cost gate:** new creates are refused when the larger of two figures reaches $10 USD in a month: the service's own running estimate at list prices, and the latest billing receipt the owner posts. A missing or stale receipt does not close creates. This is deliberately looser than ADR 0013, where a stale receipt closes creates; that rule is why install-transfer staging has refused creates since September. Reads continue past the threshold.
- **Record identity:** the record id travels only in request bodies, never in a URL.

**Document details.**

- "Since the last update sent" is the completion time of the newest session in the client's previous update, stored on the client's device.
- "Current program" is the program's block id, so a new block starts a fresh update.
- Starting loads are an opening load per training slot. Trainer attribution is a display name of at most 80 characters and optional registration text of at most 80.
- The training update also leaves out suggested warm-up rows, calibration records, per-row starting-load records and muscle lists.
- "Last rep slow" is left out for now. Whether trainers want it is a question for the slice 7 interviews; adding it later is a new document version.

## Open items for the owner

1. **Legal review.** A trainer who receives updates holds a client's training data and notes that may mention pain or injury. Review under LGPD before the alpha, together with the CREF-registered professional the coach-layer strategy already requires.
2. **Guardrail wording.** `plans/README.md` says "no full coach SaaS". This ADR adds no account, payment or hosted client data, but the owner should restate that line so it is clear the trainer site is inside it.
3. **Who pays.** The commercial model for trainers is undecided and is outside this ADR.
4. **Relay production host and route.** `taurifer.com/v1/*` belongs to install transfer, and no production environment is defined yet. The cost-alert token is also not provisioned, so the alert is a log line only.
5. **Hosting** for a second site: the repository holds no domain configuration, so the deployment path is unknown to the plan.
