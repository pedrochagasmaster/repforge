# Trainer loop · app-side design candidates (Plan 086 slices 2–4)

**Status:** revision 2, 2026-11-26. The owner decided on the first candidates the same day (below); this revision applies those decisions. Nothing here is shipped. No production file changes: the frames are the app's own screens with this plan's new content placed on top.

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
| 2 | One tap | [share-start](sheets/share-start.webp) | Program › Share setup link opens with **Create link** and one collapsed row, **Add your name and a message**. A plain share is one tap. |
| 2 | Who it's from, row opened | [share-who](sheets/share-who.webp) | The row opens to an optional name, registration and message. They are encrypted into the handoff, and the fields remember their last values. |
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
| 4 | Today card | [send-entry](sheets/send-entry.webp) | A Today card in the week card's form: "For Rafael Lima · 10 sessions since your last send", with **Send to Rafael** and **Not now**. After **Not now** it returns at most once a week. Before the first send it says "since you started this program". |
| 4 | Program row | [send-program-row](sheets/send-program-row.webp) | A permanent row on Program, above Share setup link: **Send your sessions to Rafael**, with the count since the last send. |
| 4 | What goes, what stays | [send-sheet](sheets/send-sheet.webp) | Two lists, an optional message, the 7-day and bearer disclosure on the action bar, then **Send**. |
| 4 | Link ready | [send-ready](sheets/send-ready.webp) | The 97-character link to the trainer site: a QR code for the trainer to scan in person, plus Copy link and Share link. |
| 4 | More than 120 sessions | [send-too-many](sheets/send-too-many.webp) | **Send the first 120**; the rest go in the next send (ADR 0026, second amendment). |
| 4 | Relay unavailable | [send-unavailable](sheets/send-unavailable.webp) | "Nothing left this device", then Try again only. |
| 4 | Nothing new | [send-nothing](sheets/send-nothing.webp) | Shows the date of the last send. |

## Owner decisions (2026-11-26)

1. **Attribution from the app: yes.** Optional name, registration and message in the app's Share, collapsed behind one row so a plain share stays one tap (**share-start**, **share-who**).
2. **Where sending lives: both.** The Today card, which returns at most once a week after **Not now**, and a permanent row on Program (**send-program-row**). The card and the row appear only for a program that came from a trainer.
3. **What Send does.** It creates the link and shows it with a QR code, Copy link and Share link. The status reads "Link for Rafael created today", not "Sent" (approved with the strings).
4. **More than 120 sessions:** send the first 120 now and the rest next time. ADR 0026 is amended in #840.
5. **Relay down when sending:** Try again only. No file fallback.
6. **Large text on sheets:** the one-column scroll at 200% text is accepted. It ships as its own PR before slice 2 (Plan 086 slice 1b), through the fidelity gate.
7. **The update's actions:** **Use the update** is primary.
8. **Strings:** approved, with the Today card saying "{n} sessions since your last send", and "device" instead of "phone" everywhere. Revision 2 adds six strings for the new row, the first-send card and the Program row; they are marked **new, needs approval** in [`strings.md`](strings.md).

Still a design choice, not separately decided: the QR code stays black on white in dark mode, because cameras read dark modules on a light ground.

## Out of scope here

The trainer site (studio.taurifer.com), any production file, i18n keys, `sw.js` and the cache. The update diff here is a fixed example. Slice 3 builds the real one from the two `ProgramDefinition`s through `program-transition.js`.

## Reproduce

```sh
python3 -m http.server 0 --bind 127.0.0.1            # from the repository root; note the port
REPFORGE_URL=http://127.0.0.1:<port>/ node docs/design/trainer-loop-app/capture.mjs [--only share-ready,update]
node docs/design/trainer-loop-app/strings-table.mjs  # regenerates strings.md
```

`capture.mjs` needs the test dependencies (`test/node_modules`) and the relay's (`services/trainer-relay/node_modules`, for `qrcode`). Every link and QR code is a sample of the measured length and points at no record.
