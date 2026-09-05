# A free-form program is converted by the lifter's own assistant, not by us

Import already existed, and it only ever accepted a Taurifer file. That is the
wrong shape for the person it is for. A lifter who says "I already have a
program" almost never has it as JSON. They have a coach's WhatsApp message, a
screenshot they typed out, a spreadsheet column, or four lines in their notes
app. The route that was supposed to welcome them asked for an export from an
app they had not used yet, and the only remaining door was Build — twenty
minutes of typing on a phone before the first set is ever logged. Setup dies
there.

Reading unstructured text into a program is a language problem, and Taurifer
has no model. ADR 0011 says a managed one is sequenced after deterministic paid
beta economics; ADR 0002's bring-your-own-key coach is dead. Neither is
available, and neither should be pulled forward to solve an onboarding paper
cut.

So the conversion is handed to the assistant the lifter already has open on the
same phone. The paste door writes a prompt around what they pasted — the shape
of the import JSON, the rules that keep it honest, and their program — and
offers ChatGPT or Claude as ordinary links. They tap one, the app opens with
the prompt already in the composer, they copy the reply, they come back and
paste it. From there it is the existing import: the same parser, the same
row-by-row review, the same explicit activation. Nothing about the program's
handling is special because a model touched it.

## What this is not

It is not an integration, and the distinction is the whole point of writing
this down.

There is no API key, no account, no SDK, and no request made by this app to
anyone. Taurifer composes a URL; the lifter decides whether to follow it. If
they never tap it, nothing has left the device — which is why the two links are
inert until something has been pasted, and why "Copy the prompt" exists at all:
a lifter who wants to read what they are about to send, or to use an assistant
we did not name, can.

It therefore does not pull an LLM dependency, an account platform, or any
backend into Free or core, and it does not front-run ADR 0011. If managed
Taurifer AI ships, this door stays useful for exactly the people who will never
have it: someone who wants to keep their coach's program and their own tools.

## The privacy line, stated plainly

Workout logs and history remain untouched by this feature. What crosses the
device boundary is the program text the lifter pasted and chose to send, in a
link they tapped, to a service they already use. That is the same class of
deliberate share as a setup link (ADR 0007) and it is disclosed on the screen
above the buttons rather than in a policy page.

What does *not* happen: the pasted program is never persisted, never exported,
never part of a state proposal, and never logged or sent to telemetry. It lives
in memory for the length of the flow and is dropped when onboarding closes. The
one thing remembered is which of the two doors was last used, as a device-only
UI pref (`repforge_ui_v1`, key `importSourceMode`), so a draft resumed after
the phone evicted the tab mid-hand-off comes back to the screen it left. Both
fields carry `ph-no-capture`.

## Why the reply is parsed defensively

An assistant answers in prose as often as it answers in JSON — a sentence, a
fenced block, an offer to keep going. Refusing that reply would push the
failure onto the lifter, who has no way to know which part we wanted. So the
reply is mined for candidates: fenced blocks first, then every balanced
top-level object or array, then the whole thing as a plain-text program export.
The first candidate that parses *and validates* wins.

None of that widens what is accepted. Every candidate goes through
`parseProgramSource` — the same size, depth, node and field validation a file
gets — and then through the review screen, where a lifter sees every row before
anything is written. A reply that yields nothing valid is refused with a
sentence that says what to ask for again, rather than importing half a program.

## The prompt is copy, not code

The prompt lives in the i18n catalogues as `entry.freeform.prompt`, with the
pasted program as its one placeholder. It is written and reviewed like every
other user-facing string, translated for both languages, and — because it is
the thing being sent — readable by the lifter before they send it. Keeping it
out of `app.js` is deliberate: a prompt assembled from fragments in code is a
prompt nobody reviews.

## Consequences

- The `import` route now has two doors on one step rather than two routes. The
  free-form path ends in the same candidate, the same fingerprint and the same
  `program_activated` route value, so nothing in the entry schema, the draft
  envelope or the telemetry catalogue needed a new enumeration.
- The prefilled link is capped (`FREEFORM_URL_MAX`). A longer prompt still
  works: the link opens the app's empty composer and the prompt goes to the
  clipboard instead.
- Adding a third assistant is a row in `FREEFORM_APPS` plus two strings. Do not
  add one that requires a key, an account we provision, or a request from this
  app — that is a different decision and belongs in ADR 0011's sequence.
