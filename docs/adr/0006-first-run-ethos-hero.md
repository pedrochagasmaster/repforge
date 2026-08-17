# Put the distilled ethos and the Milo illustration on the first-run gate

ADR 0004 confined the Milo theme to the app icon and reverted themed copy
from every working surface; the ethos canon was later recorded in the brand
guide as internal background. The product owner then mocked up a first-run
hero (2026-08): the setup gate opening on the ethos, set as a short poem
beside a Milo illustration — the calf-carrier grown into the bull-carrier —
above the existing install and program sections.

Decision (product owner, 2026-08, via mockup): the first-run setup gate is the
theme's second permitted surface. It gains a hero holding exactly two strings —
`setup.ethos.title` "Strength isn't something you're born with." and
`setup.ethos.body`, the eleven-line passage the mockup sets in the mono face —
distilled from the canon in the brand guide, in English and Portuguese,
following every voice mechanic (sentence case, no exclamation marks,
meaning-first translation). One owner-licensed illustration sits behind the
copy on the right at `assets/brand/milo-hero.webp`, decorative, replaced
wholesale like the mark, precached like every asset.

How the hero is set, and why it is set at all: the body's line breaks live in
the strings (`\n`, honoured by `white-space:pre-line`) rather than falling
where the phone happens to wrap. The passage is the one piece of copy in the
app whose rhythm is load-bearing, and the mockup breaks it in eleven lines and
three stanzas; a measure-dependent wrap would break it somewhere else on every
screen width. The cost is that translations must be re-broken by hand, and
that lines have to stay short — 32 characters, which is what keeps the block
clear of the illustration on a narrow phone. The brand guide records both.

The illustration is painted by CSS (`background-image`), not marked up as an
`<img>`: it is decorative, it must never reach a screen reader, and an absent
export has to leave paper behind the copy rather than a broken-image glyph —
the same reason the exercise tiles render nothing at all without artwork. The
owner's file landed 2026-08; it is cropped to the ink and white-balanced onto
`--bg`, so its rectangle disappears into the page instead of needing a field
drawn around it the way the exercise detail page needs one (`mediaBg`). Details
in `assets/brand/README.md`.

The picture is landscape and the space beside a column of poem is portrait, so
something has to give for it to fill the corner beside the sentence (product
owner, 2026-08: fill it). The owner settled which: **never the picture.** It is
shown whole, inside the page, never cropped and never running off an edge —
including the bleed that was tried first and rejected. What varies is the copy:
the illustration is tucked into that corner and the poem flows around it, its
lines cut short while they pass the picture and running their full length once
below it. The line counts are recorded in the brand guide, because they are now
part of the copy in both languages.

The layout enforces the shape rather than trusting it: the picture is a float,
so a line that outgrows its gap wraps rather than colliding with the art, at any
width, in any language. Rejected along the way: bleeding it off the screen edge
(crops the load, and lands a cut mid-page on a wide shell); growing it towards
the copy (puts graphite behind the poem); and a uniformly narrower poem, which
makes the block taller as fast as it makes the picture wider, leaving the same
corner empty.

**Amended 2026-08 — the picture is measured from the poem, and the brand row is
centred.** Filling the sentence's corner emptied the one under the picture, and
the owner reviewed the built screen and asked for the opposite trade: centre the
mark, lower the picture, use the screen. The corner is the reason the picture
could be wider than the eight short lines it may pass, so giving it up costs
size — about 143 CSS px on a 390px phone rather than 180 — and what is bought is
that the picture sits inside the poem's own block, with the poem set
proportionally to its column (about 11px rather than 9.5px there) instead of
floating small in it. **The picture's size is no longer a number in the CSS.** It
is whichever is smaller of what the column has left once a 27-character line has
its room, and how far down the poem its ninth line — the first long one — begins.
Both are written from the poem's own type size, which is proportional to the
hero's column, so the shape now holds at every width instead of at the widths it
was drawn at: the fixed 52% it replaces wrapped three lines of the first stanza
on a 320px phone, breaking the rule this ADR set. `test/install-modes.mjs`
counts the poem's line boxes at 320, 390 and 430 px in both languages, so the
next change to this geometry has to keep the breaks or fail. The copy is
untouched; the sentence grew to `clamp(30px, 9.4vw, 40px)` to hold the top of
the block now that nothing sits beside its last line.

Rejected while lowering it, all for the same reason — on a 390px phone the
column is 346px and the passage's long lines are 36 characters of it: keeping
the picture at its old size and simply dropping it (its foot then lands on the
ninth line and wraps it); re-breaking the passage so every line is short enough
to pass the picture (a narrower poem leaves a wider void than the picture
fills, and the breaks are copy, not layout); giving the picture a band of its
own under the poem (a near-square drawn at column width is 322px tall there,
which costs the install card its place on the first screen); and setting it
beside the sentence alone, which has no room — that sentence's own lines run to
300px of the 346.

The gate's brand row stands the mark on the page instead of on a plate, so it
draws `assets/brand/mark.png` — the same mark with its full-bleed paper ground
dropped, derived from `icons/icon.svg` by `tools/build-brand-mark.mjs`. The app
icon's own warm ground (#EFE5DF) reads as a tile against the app's paper
(#F4F2EF), and neither a feathered mask nor the exercise-detail trick of
bleeding the artwork's own field fixes that at 48px: the first leaves a beige
disc, the second a 120px halo. Dropping the ground in the render does. The row
is centred on the column (owner, 2026-08), less the letter-space the tracked
wordmark ends on, so it is the ink and not the box that sits on the middle.

Why this surface and no other: the gate is a threshold, not a working
surface. It appears before any training data exists and never again once a
program does, so the theme states why the app exists exactly once and then
gets out of the way. Inside the app the record speaks, not the brand — every
ban in ADR 0004 stands everywhere else: in-app copy, notifications, exports,
store metadata, tooltips, alt text.

Rejected: quoting the full canon on the gate (a manifesto is not a screen —
the distilled passage carries it); themed copy on any working surface (ADR
0004's revert was the point); softening the rule for store metadata (still
banned); shipping placeholder art — icons, initials, silhouettes — while the
licensed export is pending; and hand-editing `icons/icon.svg` to strip its
ground, when a script that removes one path and re-renders leaves the source of
truth untouched.

Consequences: the brand guide's theme rule, Ethos section, and mark section
are amended to name the two permitted surfaces, the poem's breaks, and the
ground-free mark; `assets/brand/` holds owner-licensed brand art and the
generated mark; `test/install-modes.mjs` locks the hero strings in both
languages — line breaks included — the way it locks the install cards, plus
that the art stays out of the accessibility tree, that the gate never falls
back to the app icon, and (since the 2026-08 amendment) that the poem renders
the breaks it was written with at three phone widths in both languages; ADR
0004 carries an amendment pointer here. The canon itself stays internal, and
the app past the gate stays as quiet as it was.
