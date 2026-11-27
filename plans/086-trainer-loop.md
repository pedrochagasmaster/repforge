# Plan 086: Trainer loop

Status: **approved, in implementation**. The owner accepted [ADR 0026](../docs/adr/0026-trainer-loop-relay-and-trainer-site.md) on 2026-11-26. Slice 1 (#837) and the codec and validation parts of slices 2–4 (#838) merged on 2026-11-26, with every section 4 proof passing except a real phone camera reading the QR code; the owner closed that proof on 2026-11-27 (section 4, item 2). Slice 0, the app-side designs (`docs/design/trainer-loop-app/`) and the production relay environment merged on 2026-11-26; production was deployed with creates off. Slice 1b and slice 2 are draft PRs in owner review; slice 2 turns creates on in the production config, and deploying that waits for the owner. Written against `origin/main` 6f2e18a; re-check every anchor before executing. Scheduling lives in the [backlog](../docs/backlog.md).

## 1. Outcome and reference

An in-person trainer keeps a client list at `studio.taurifer.com`, hands a program to a client by QR code or link, receives the client's training when the client chooses to send it, and sends back an adjusted program that the client accepts without losing history.

The [concept mock](../docs/design/trainer-loop-mock/README.md) is the reference for the flow and for what each screen must answer. Three trainers approved its direction on 2026-11-25. It is not a visual specification: each user-visible slice needs an approved design and passes the fidelity gate against it.

Out of scope: accounts, sync, payment, messaging beyond the one optional note per payload, trainer-requested data pulls, groups or shared programs across clients, and any change to solo use.

## 2. Contracts this plan must respect

- ADR 0026 for the relay, the two payloads, consent and the trainer site.
- ADR 0007 for released setup-link payloads. The semantic version-1 document and the released envelopes stay locked; the handoff document is a new versioned kind, not a mutation.
- `AGENTS.md` for storage, privacy, cache and script-revision rules, and the naming inventory.
- `CONTEXT.md` for vocabulary. Slice 0 adds the trainer terms there before any copy is written.
- `program-transition.js` and the `app.js` transition adapter own replacing a program while keeping history. Slice 3 uses them and adds no second path.
- Telemetry stays a closed event list in `telemetry.js`. No payload content, link, record id or trainer name is ever an event property.

## 3. Slices

Each slice is one pull request with its owning tests. Slices 3 and 4 can run in parallel after slice 2.

| # | Slice | Delivers | Owning proof |
| --- | --- | --- | --- |
| 0 | Contracts | Owner resolves ADR 0026 open items 2, 4 and 5. Amend ADR 0007, the `plans/README.md` guardrails, `AGENTS.md`, `CONTEXT.md` and the Privacy page text in one prose-only PR. | Owner review. |
| 1 | Relay | A new service under `services/`, a shared request/record contract module, and a browser client that encrypts, uploads, downloads and decrypts. No UI. | Section 4. |
| 1b | Large-text sheets | Before slice 2, its own PR: at 200% text a bottom sheet scrolls as one column (header, body and actions) instead of squeezing the body, so the Share sheet's Portuguese copy fits at 320 wide. | Catalog frames at 390 and 320, normal and 200% text, EN and PT, through the fidelity gate against the #841 mocks. |
| 2 | Program handoff | The handoff document (program, settings, starting loads, message, attribution). The app's Share uses the relay at `relay.taurifer.com`, with optional name, registration and message behind one collapsed row; a share from the app carries no starting loads, so no app copy promises them; a new client receives at the first-run gate with the trainer's name shown; the iOS handoff cookie carries the record locator, the installed app clears it once it has opened the program, and a browser tab keeps it only while the program is an unopened proposal; fallback to link or file when the relay is down. | Codec unit and generative suites; setup-flow browser suite extended; catalog frames. |
| 3 | Program update for an existing client | An existing client opens a handoff, sees what changed and the note, and chooses to use it or keep the current program. History and the archive are kept. | Transition suites; a browser test that history, archive and an in-progress draft survive both choices. |
| 4 | Training update from the app | The update document; "send my sessions" from a Today card (after "Not now" it returns at most once a week) and a permanent row on Program, with the what-goes and what-stays sheet; the oldest 120 sessions per send, the rest with the next; Try again only when the relay fails. | Codec suites; a privacy test that excluded fields can never be encoded; real-log size measurement recorded in the PR. |
| 5 | Trainer site: client list and handoff | The second static site, its storage, add client, choose or build a program with the reused editor, starting loads per exercise, QR and link handoff, backup export and import. Starting loads arrive with this slice (owner, 2026-11-27): the app's gate names them only when a handoff carries some. | Its own browser suite; storage-loss and backup round-trip tests; phone and laptop frames. |
| 6 | Trainer site: review and adjust | Open an update link, client review (attendance, notes on their exercise, loads since the first week), adjust, send the update. | Browser suite covering the whole loop across both origins against a local relay. |
| 7 | Evidence | The loop on real phones with the three trainers and one client each, in Portuguese, including an iOS Home Screen install. | Owner-run; findings go to the backlog. |

## 4. Risky first proof (slice 1)

The plan depends on one claim: a hand-built program that the link refuses today travels through the relay as a short link, and the service never sees plaintext. Slice 1 is done only when all of these hold:

1. The four-day, seven-week program that `test/shared-setup-unit.mjs` generates, encoded in full, round-trips byte for byte through a local relay.
2. The resulting link is short enough to print as a QR code that a phone camera reads at arm's length; record the measured length. **Closed 2026-11-27.** The owner's iPhone Camera read a relay QR code from #845 at arm's length, against the staging relay; an Android phone scanned and started the program. The tested link was 108 characters, because the preview origin is 18 characters longer than `https://taurifer.com/`, so it printed as a version 7 code (45×45 modules, medium error correction). A production link is 90 characters, a version 6 code (41×41), which is easier to read. The same test passed the Home Screen handoff, relay-down recovery with Try again, and the incomplete-link screen.
3. A test inspects everything the service received and stored and finds neither the key nor any plaintext field.
4. A record is unreadable after its expiry and a wrong key fails closed without partial output.
5. The size bound, create rate and cost threshold reject as specified, and the kill switch stops creates while reads continue.

If item 2 fails, stop and return to the owner before slice 2.

## 5. Completion evidence

- A green `ci` check on the final head of each slice.
- The cross-origin loop test from slice 6 passing against the deployed staging relay.
- Slice 7's real-phone record. Browser automation is not physical iOS or Android validation.
- The Privacy page, `AGENTS.md` and the backlog updated in the same PR as the behavior they describe.

## 6. Owner and environment gates

- The relay's production host and route, its production deployment, and the cost-alert token. Staging exists.
- ~~A real phone camera reading a relay QR code at arm's length (section 4, item 2).~~ Done by the owner on 2026-11-27.
- DNS and hosting for `studio.taurifer.com`. The repository holds no domain configuration, so this path must be supplied.
- EN and PT copy approval for every new surface, and an approved design per user-visible slice.
- Legal review (ADR 0026 open item 1) before any trainer outside the three reviewers uses it.

## 7. Privacy page text (slice 0 draft, lands with slices 2 and 4)

The cached in-app Privacy page lives in `i18n-en.json` and `i18n-pt.json`. Slice 0 is prose only and must not describe behavior before it ships, so the owner approves the text here and slice 2 (handoff) and slice 4 (training update) put it on the page in the same PR as the behavior. Every row is a new promise to users. The owner approved this table on 2026-11-26 with two edits, applied here: copy says "device", never "phone", and the key sentence states who can receive the key on iOS. "personal" is the approved Portuguese word.

| Key | Change | EN | PT |
| --- | --- | --- | --- |
| `privacy.local_first` | changed (slice 4) | Your training data stays on this device except when you explicitly create an install transfer or send your sessions to your trainer. | Seus dados ficam neste dispositivo, exceto quando você cria explicitamente uma transferência para instalação ou envia suas sessões ao seu personal. |
| `privacy.limitations.body`, third sentence | changed (slice 2) | Setup links and links from a trainer are bearer links: forwarding one gives the recipient what it carries. | Links de configuração e links enviados por um personal são links portadores: encaminhar um deles entrega o conteúdo a quem receber. |
| `privacy.telemetry.body`, list | changed (slice 2) | … never workout values, exercise names, notes, free text, setup links, trainer links or names, transfer tokens, or backup data. | … nunca valores de sessão, nomes de exercícios, notas, texto livre, links de configuração, links ou nomes de personal, tokens de transferência ou dados de backup. |
| `privacy.trainer.title` | new (slice 2) | Trainer links and sending your sessions | Links do personal e envio das suas sessões |
| `privacy.trainer.handoff` | new (slice 2) | A trainer can send you a program by link or QR code. It is encrypted on the trainer's device with a key that exists only in the link. Taurifer stores the encrypted copy with Cloudflare in the EU for up to seven days and then deletes it; Cloudflare's global edge can handle the request first. The relay service never receives the key, so it cannot read the program. Anyone with the link can open it until it expires. | Um personal pode enviar um treino por link ou QR code. Ele é criptografado no dispositivo do personal com uma chave que só existe no link. O Taurifer guarda a cópia criptografada na Cloudflare, na UE, por até sete dias e depois a apaga; a entrada global da Cloudflare pode receber a solicitação antes. O serviço que guarda a cópia nunca recebe a chave, por isso não consegue ler o treino. Quem tiver o link pode abri-lo até ele expirar. |
| `privacy.trainer.sending` | new (slice 4) | Your sessions leave this device only when you tap Send, every time. Nothing is sent automatically, and your trainer cannot request it. A send carries your current program and the sessions you logged under it since your last send, up to 120 at a time: exercises, loads, reps, effort and notes. It never includes earlier programs, body weight, your setup answers, settings or device preferences. It is encrypted on this device and kept the same way, for up to seven days. | Suas sessões só saem deste dispositivo quando você toca em Enviar, toda vez. Nada é enviado automaticamente, e seu personal não pode pedir esses dados. Cada envio leva seu treino atual e as sessões registradas nele desde o último envio, até 120 por vez: exercícios, cargas, repetições, esforço e notas. Ele nunca inclui treinos anteriores, peso corporal, suas respostas da configuração, ajustes ou preferências do dispositivo. Ele é criptografado neste dispositivo e guardado da mesma forma, por até sete dias. |
| `privacy.trainer.storage` | new (slice 2; cookie sentence revised 2026-11-27) | The service stores the encrypted copy, its size, and when it was created and expires. It keeps no name, account or device identifier and does not link one copy to another. Abuse limits use keyed hashes of IP addresses that are deleted within an hour. On iPhone and iPad, to open a trainer's program in the app you added to the Home Screen, the repforge_setup_v1 cookie carries the link's record id and key. It is sent with the app's requests to the site that serves Taurifer, which Cloudflare also hosts. It is deleted as soon as the app you added to the Home Screen opens the program, or when you start the program or choose another one in the browser. It is also deleted when the link has expired, needs a newer version of Taurifer or is incomplete, and after seven days at most. It is never used for the sessions you send. | O serviço guarda a cópia criptografada, o tamanho e quando ela foi criada e expira. Ele não guarda nome, conta nem identificador do dispositivo e não liga uma cópia a outra. Os limites contra abuso usam resumos com chave de endereços IP, apagados em até uma hora. No iPhone e no iPad, para abrir o treino do personal no app que você adicionou à Tela de Início, o cookie repforge_setup_v1 leva o identificador e a chave do link. Ele é enviado com as solicitações do app ao site que serve o Taurifer, também hospedado na Cloudflare. Ele é apagado assim que o app que você adicionou à Tela de Início abre o treino, ou quando você começa o treino ou escolhe outro no navegador. Também é apagado quando o link expirou, precisa de uma versão mais nova do Taurifer ou está incompleto, e em no máximo sete dias. Ele nunca é usado para as sessões que você envia. |
| `privacy.trainer.recipient` | new (slice 4) | Your trainer keeps what you send on their own device. Taurifer cannot see it there or delete it for you. | Seu personal guarda o que você envia no próprio dispositivo. O Taurifer não vê esses dados lá nem pode apagá-los por você. |

Copy elsewhere that slice 2 must revisit, not changed here: the landing FAQ `landing.faq.coach.a2` ("The link isn't encrypted") becomes untrue for a relay link, and `landing.faq.coach.*` lists what a link carries; `privacy.setup.body` stays true for `#setup=` links.
