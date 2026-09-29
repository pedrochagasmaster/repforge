# J · Conversa: build notes

Files: `round-4/candidates/j.js`, `j.css`, `j.notes.md`, `j.world.md`; fonts
`round-4/fonts/atkinson-hyperlegible-next/`, `round-4/fonts/atkinson-hyperlegible-mono/`.
Page: `round-4/app.html?c=j&cp=<checkpoint>&lang=pt|en&theme=light|dark&text=100|200&motion=normal|reduced`.
Direction contract: the surface brief for `round-4/candidates/j.js`
(`.impeccable/surfaces/…-candidates-j-js-*.md`), seed key `41ef581f`.

## Product decision reopened: PD-1 (no chooser)

Declared in the header comment of `j.js`, in `policy.productDecisions: ["PD-1"]`
and here. There is no chooser screen. After "Montar meu programa" the thread
starts asking the Recommend questions at once, and the first Taurifer message
offers the other ways in as attached buttons: "Colar um programa que já tenho"
(paste door) and "Anexar um arquivo de programa" (file door). "Acompanhar meu
programa atual" on the landing opens the paste door directly. Those offers
leave the thread as soon as the first answer is sent. That message carries
`data-checkpoint="route-choice"`; with an active program, the notice above it
carries `hub-existing`.

The bet: route choice dissolves into "just reply". The cost, stated openly:
Custom, Browse and Build are not offered anywhere in this thread in Round 4
(they are outside the core journey). If J advances, they need a place,
probably as a third attached offer that opens their own short threads.

## Honesty rules the build keeps

- Taurifer never types, never says "eu", never reads free text. The status
  line under the name shows the task ("Seção 3 de 5", "Programa para
  revisar"), where a messaging app shows presence.
- The only free input is pasting a program, and the thread says what
  happens to it: "O Taurifer não lê texto livre. Um assistente que você abre
  converte o seu texto…". The assistant's reply comes back labelled "Resposta
  do ChatGPT, colada", the grammar of a forwarded message.
- The first message states the rule: "As mesmas respostas e regras produzem
  o mesmo programa todas as vezes." (production string).
- Ticks mean something checkable: one tick, the answer is in this setup; two
  ticks, the program on screen was built from it.
- Every program is `TF.compile` / `TF.importResult`; paste, gaps and rows go
  through `TS.freeform.apply` and `TS.importReview.apply`; activation is
  `TF.activate` with the real readiness checks.

## How the core journey maps

| Step | In the thread |
| --- | --- |
| Landing | Privacy notice, the real Today capture as an image message (tap opens a viewer), the production headline and body, two attached buttons (`#firstRunCreate`, `#firstRunImport`). Privacidade sits in the app bar (`data-privacy-open`). |
| Questions | Goal, experience, consistency, days, minutes, rest, place: one quick reply each, sent on tap. Then "{lugar} inclui: … Confere?" with Confere / Corrigir o equipamento (the correction form is `rec-env-correction`), then the optional priorities (Sem prioridades / Escolher prioridades). |
| Review | The program arrives as a message and the view jumps to its top. The composer becomes the dock with "Usar este programa". |
| Correction (signature) | Tap or swipe right on any answer bubble or any "Montado com" line; the reply sheet quotes it; "Enviar resposta" posts a reply bubble quoting the old answer and a new version of the program beneath it with the identity-diff statement and before/after counts. The old version folds to one line. |
| Paste door | Paste into the composer, send; the hand-off message (Abrir no ChatGPT / no Claude / Copiar o comando); "Colar a resposta do assistente" with Importar da área de transferência / Tentar outro assistente / Recomeçar; gaps as a form inside a message, sent from the composer; row review as a message; "Revisar o programa" in the dock. |
| Existing program | An active-program notice opens the thread; activation asks the shared replacement question; a cross-tab change posts the conflict as a system message with "Revisar de novo". |

`data-advance` is the round send button of the composer: disabled with the
hint as its reason while a quick reply is expected, enabled when there is a
draft to send (equipment correction, priorities, the paste, the gaps).

## Interpretations

- **Back** takes the last answer back and asks that question again (the
  chat reading of "back"). From the review it returns to the priorities
  question with every answer unchanged, as K-6 requires.
- **Editing before the review** (tapping an earlier answer) changes it in
  place and marks the bubble "editada"; after the review the same gesture
  rebuilds the program as a new version.
- **Sair** is the Cancel of setup. Its dialog says what is kept: "Salvar
  respostas e sair" / "Apagar esta conversa e sair" / "Continuar respondendo".
- **Edit before using** (the per-exercise editor) is not in this round's core
  and is not offered.

## Verification

Acceptance: `node docs/design/onboarding-tournament/tools/verify.mjs --round 4 --candidates j`
(results in the builder's report). Taps for Rafael from landing to Today: 11
(the landing button, seven quick replies, Confere, Sem prioridades, Usar este
programa). Correction from the review: 6 taps (bound 6).
Detector: `impeccable detect --json` on `j.js`/`j.css` reports only advisories
that the colours, sizes and radii are outside the app's DESIGN.md, which is
expected for a candidate that owns its world.
