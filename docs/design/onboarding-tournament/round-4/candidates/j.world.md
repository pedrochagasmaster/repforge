# J · Conversa: the world

A messaging thread built in Taurifer's own material. The grammar is the one
Brazilian lifters use all day (bubbles with tails, quick replies, ticks,
quoted replies, "pasted" and "forwarded" labels, a pill composer with a round
send button, an app bar with an avatar and a status line); the colour, type
and marks are Taurifer's, not any messaging brand's. It is not a chatbot:
there is no typing indicator, no first person, no free-text understanding,
and the status line under "Taurifer" reports the task ("Seção 3 de 5"), never
presence.

## Palette (tokens in `j.css`, light / dark)

| Token | Role | Light | Dark | Contrast |
| --- | --- | --- | --- | --- |
| `--j-wall` + `--j-wall-print` | Wallpaper: concrete sage, printed with faint training marks (plates, ticks, a bar, a stopwatch, ×, +) as an authored 148 px SVG tile | `#dde2e0`, marks at 8.5% | `#0e1113`, marks at 5% white | ink on wall 13.5:1 |
| `--j-in` / `--j-in-ink` / `--j-in-soft` | Taurifer's bubbles: white paper, ink, secondary | `#fff` / `#15191b` / `#566064` | `#1d2225` / `#e8eceb` / `#9aa5a9` | 17.7 / 6.5 · 13.5 / 6.4 |
| `--j-out` / `--j-out-ink` / `--j-out-soft` | The lifter's voice: signal orange with ink text; unchanged in dark | `#ff6b2c` / `#1a0e07` / `#4a2410` | same | 6.7 / 4.8 |
| `--j-bar` / `--j-bar-ink` / `--j-bar-soft` | Graphite app bar | `#15191b` / `#f4f6f5` / `#a9b3b6` | `#171b1d` / same | 16.3 / 8.3 |
| `--j-accent` | Actions written in a bubble (attached buttons, links, quote author) | `#b8410e` | `#ff8a57` | 5.5 on white · 6.9 on charcoal |
| `--j-chip-edge` | Outline of a quick reply waiting on the lifter's side | `#c2491a` | `#ff8a57` | 3.8 vs wallpaper · 8.1 |
| `--j-sys` / `--j-sys-ink` | System notices (privacy, active program, change statement) | `#fbefd5` / `#3d3320` | `#2a2518` / `#efe3c2` | 10.9 / 11.9 |
| `--j-quote-bg` / `--j-quote-bar` | Quoted lines and the program's reply-able facts | `#eef1f0` / `#c2491a` | `#262c30` / `#ff8a57` | accent on quote 4.9 / 6.1 |
| `--j-danger` | Destructive actions, errors | `#b3261e` | `#ff8a80` | 6.5 / 7.0 |
| `--j-disabled` / `--j-disabled-ink` | A send or activate that cannot run yet | `#c9cfce` / `#4f585b` | `#2c3337` / `#9aa5a9` | 4.6 / 5.1 |
| `--j-focus` | Focus ring, distinct from every surface | `#1557d6` | `#8ab4ff` | — |

Selection is orange with ink, the caret is the orange edge, scrollbars take
the rule colour. Colour is never the only signal: sent answers are also
right-aligned with a tail and a tick; selected toggles carry a check mark;
disabled controls carry an `aria-describedby` reason.

## Type

Atkinson Hyperlegible Next (400–800), self-hosted from `round-4/fonts/`, for
everything; Atkinson Hyperlegible Mono only for the pasted program, the
prompt and the assistant's reply (it is literally code and data there). The
face was chosen for the job, not the subject: it was drawn for character
disambiguation at small sizes (1/l/I, 0/O, rn/m), which is what short bubbles,
set counts and "3 × 8–12" need one-handed and at 200% text. Scale: headline
and program name 1.625rem / 800 / -0.022em; questions 1.0625rem / 700; body
1rem; notes .8125rem; meta .6875rem; tabular numerals throughout.

## Components

- **App bar**: back arrow (one question back), the mark on a paper plate,
  "Taurifer" as the h1, a task status line, and one text action (Privacidade
  on the landing, Sair in setup).
- **Bubbles**: incoming white, outgoing orange; the first of a run gets a tail
  (drawn on the row so it never widens the control). Every bubble carries its
  time; sent answers carry one tick, and two ticks once a program was built
  from them.
- **Quick replies**: outlined pills on the lifter's side; numeric ones show a
  big number and a small unit. Tapping one sends it: the pill lifts into the
  outgoing bubble's place (FLIP) and stays in the thread as a button with the
  same `data-key`/`data-val`, so focus never moves.
- **Attached buttons**: full-width buttons under a bubble, divided by
  hairlines (landing actions, route offer, hand-off, conflict, Start over).
- **Forms in a message**: equipment and priority toggles with check boxes,
  search with results, avoid-reason radios, gap fields.
- **Program message**: document glyph, program name, source and version,
  the change statement (amber), the facts line, the week as collapsible days
  with numbered badges and tabular prescriptions, adjustments, constraints,
  "Montado com as suas respostas" as quotable lines, and "Por que combina com
  você" folded. A superseded version folds to a one-line message.
- **Reply sheet** (signature): the composer risen as a sheet, quoting the
  line being answered, with radios and toggles, and "Enviar resposta".
- **Composer**: a pill that is either a hint ("Toque em uma resposta acima"),
  a draft summary, or the paste field, plus the round send button (the
  `data-advance` control). At a review it becomes the dock holding "Usar este
  programa".
- **Dialogs**: centred paper cards with stacked right-aligned text buttons
  (Sair, Começar de novo, Recomeçar, replacement, attach); an image viewer
  for the Today capture.

## Motion

One grammar, orchestrated once: messages arrive from an already-visible
state (opacity .45, 10 px down, 98.5%) with a 340 ms expo-out and a 70 ms
stagger when several land together; a tapped quick reply FLIPs into its
bubble (280 ms); the reply sheet rises by a clip reveal from its send bar
upward, so the confirm is in place from the first frame; a swipe right on a
reply-able line arms a reply icon at 56 px and opens the sheet. Reduced
motion is one rule on `:root[data-motion="reduced"]` and
`prefers-reduced-motion`: every animation and transition is removed and
scrolling is instant; the JS FLIP checks the same decision.

## Dark rendition

The same chat at night: near-black wallpaper with the marks at 5%, charcoal
bubbles, graphite bar, lighter orange for text actions, and the orange voice
bubbles unchanged so the lifter's answers read identically. The mark keeps
its paper plate; the Today capture switches to the dark rendering.
