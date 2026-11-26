# Trainer loop · app-side design candidates (Plan 086 slices 2–4)

**Status:** candidates for owner approval, 2026-11-26. Nothing here is shipped or approved. No production file changes: the frames are the app's own screens with this plan's new content placed on top.

The flow follows the [concept mock](../trainer-loop-mock/README.md) that three trainers approved. The look comes from the app itself. `capture.mjs` opens each base screen through the screen catalog's own harness (`test/fixtures/catalog-state.mjs`: the same seed, clock and scenario as the catalog), adds `mock.css`, and fills in the app's existing components:

- the first-run band and its shared-program card;
- the Share setup sheet (band, scrolling body, glass action bar, steel and CTA buttons);
- the Today week card;
- fields and text links.

Every frame is real `styles.css` and real fonts. Tokens drive light and dark, and `document.documentElement.style.fontSize = "200%"` drives large text, as in the browser suites.

`sheets/<state>.webp` is one contact sheet per state, with 16 frames each. Columns are EN light, EN dark, PT light and PT dark. Rows are 390 wide at normal text, 390 at 200%, 320 × 568 at normal text, and 320 at 200%. [`strings.md`](strings.md) lists every new string in EN and PT.

## The screens

| Slice | State | Sheet | What it decides |
| --- | --- | --- | --- |
| 2 | Who it's from | [share-who](sheets/share-who.webp) | Program › Share setup link first asks for an optional name, registration and message. They are encrypted into the handoff, and the fields remember their last values. |
| 2 | Creating the link | [share-preparing](sheets/share-preparing.webp) | One status line; Copy and Share wait. |
| 2 | Ready | [share-ready](sheets/share-ready.webp) | A QR code of the 90-character link (a real version 6-M code), the camera hint, the 7-day expiry with its date, and the encrypted-but-bearer sentence. Copy link and Share link are unchanged. |
| 2 | Relay down, the program fits a link | [share-unavailable-link](sheets/share-unavailable-link.webp) | The ADR 0026 fallback: the existing setup link, with what it doesn't carry (encryption, name, message, starting loads). Try again stays available. |
| 2 | Relay down, the program is too large | [share-unavailable-file](sheets/share-unavailable-file.webp) | The fallback is the program file, worded as today's too-large message. |
| 2 | Gate, new client | [gate-trainer](sheets/gate-trainer.webp) | The existing gate with the trainer's name and registration on the card, their message, and what the link carries. **See the program** and **Create a program from scratch** are unchanged. |
| 2 | Gate, opening | [gate-opening](sheets/gate-opening.webp) | Shown while the record downloads and decrypts. It says a connection is needed once. |
| 2 | Gate, relay unavailable | [gate-unavailable](sheets/gate-unavailable.webp) | Try again comes first, then Build and Track. Nothing was saved. |
| 2 | Gate, link expired | [gate-expired](sheets/gate-expired.webp) | The sender's name is unknown once the record is gone, so the copy says "the person who sent it". |
| 2 | Gate, newer version | [gate-newer](sheets/gate-newer.webp) | Reload Taurifer, then open the link again. |
| 2 | Gate, incomplete link or wrong key | [gate-incomplete](sheets/gate-incomplete.webp) | Not in your list. It is the fail-closed case for a mistyped or truncated key; ADR 0026 keeps it separate from expiry. |
| 3 | Update | [update](sheets/update.webp) | A sheet over Today. It shows the number of changes, one row per changed exercise (swapped, changed, removed; old value struck, new value in training figures), the trainer's message, and **See the whole program**. The history sentence sits on the action bar, so it is read before the tap. **Use the update** comes first and **Keep my current program** second. |
| 3 | Update during a workout | [update-draft](sheets/update-draft.webp) | The workout in progress is left as it is; the update starts with the next session. |
| 3 | Update errors | [update-unavailable](sheets/update-unavailable.webp), [update-expired](sheets/update-expired.webp), [update-newer](sheets/update-newer.webp) | The gate's errors in a sheet. Nothing changes. |
| 4 | Entry | [send-entry](sheets/send-entry.webp) | A Today card in the week card's form: "For Rafael Lima · 10 sessions Rafael hasn't seen", with **Send to Rafael** and **Not now**. |
| 4 | What goes, what stays | [send-sheet](sheets/send-sheet.webp) | Two lists, an optional message, the 7-day and bearer disclosure on the action bar, then **Send**. |
| 4 | Link ready | [send-ready](sheets/send-ready.webp) | The 97-character link to the trainer site: a QR code for the trainer to scan in person, plus Copy link and Share link. |
| 4 | More than 120 sessions | [send-too-many](sheets/send-too-many.webp) | Proposed: **Send the first 120**. The rest go in the next send. See decision 4. |
| 4 | Relay unavailable | [send-unavailable](sheets/send-unavailable.webp) | "Nothing left this phone", then Try again. |
| 4 | Nothing new | [send-nothing](sheets/send-nothing.webp) | Shows the date of the last send. |

## Decisions these candidates need

1. **Attribution from the app.** Slice 2 lets anyone who shares from the app add a name, a registration and a message, all optional. Without this, only the trainer site could set a name. The alternative is to leave the app's Share without attribution until slice 5.
2. **Where "send my training" lives.** The candidate is a Today card in the week card's form, as the concept mock had it, with **Not now** to dismiss it. The alternative is a row on the Program screen next to Share setup link, which applies less pressure. The card appears only for a program that came from a trainer.
3. **What tapping Send does.** It creates the link, then shows it as a QR code with Copy link and Share link (**send-ready**). The client usually sends it by WhatsApp, and in person the trainer can scan it. The app cannot know whether the link reached the trainer, so the status after a send reads "Link for Rafael created today", not "Sent".
4. **More than 120 sessions.** ADR 0026 says the encoder refuses above 120 and never drops sessions. The candidate splits the send instead of dead-ending: the first 120 go now and the rest go next time. That is the same rule as "since the last update sent", so nothing is lost or repeated. This needs your approval because it changes the refusal into a choice. The case is rare: 120 sessions is 30 weeks of one program.
5. **Relay down when sending sessions.** The ADR's fallback (setup link or file) is defined only for program handoffs. The candidate offers Try again only. A file fallback for training updates would need the trainer site to import files.
6. **Large text on sheets.** At 200% on a 320 × 568 phone, the production sheet keeps its band and action bar fixed. A long title then leaves the body no height, and the production PT title "Compartilhar configuração do treino" already does this. The candidates scroll the band, body and actions as one column at 200% text, and step the title down one size. This is a component change for slice 2.
7. **The update's order of actions.** **Use the update** is primary and **Keep my current program** secondary, as in the concept mock. A neutral pair (two steel buttons) would avoid steering the choice.
8. **QR in dark mode.** The code stays black on white in both themes, because cameras read dark modules on a light ground.

## Out of scope here

The trainer site (studio.taurifer.com), any production file, i18n keys, `sw.js` and the cache. The update diff here is a fixed example. Slice 3 builds the real one from the two `ProgramDefinition`s through `program-transition.js`.

## Reproduce

```sh
python3 -m http.server 0 --bind 127.0.0.1            # from the repository root; note the port
REPFORGE_URL=http://127.0.0.1:<port>/ node docs/design/trainer-loop-app/capture.mjs [--only share-ready,update]
node docs/design/trainer-loop-app/strings-table.mjs  # regenerates strings.md
```

`capture.mjs` needs the test dependencies (`test/node_modules`) and the relay's (`services/trainer-relay/node_modules`, for `qrcode`). Every link and QR code is a sample of the measured length and points at no record.
