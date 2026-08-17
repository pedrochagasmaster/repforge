# Put the distilled ethos and the Milo illustration on the first-run gate

ADR 0004 confined the Milo theme to the app icon and reverted themed copy
from every working surface; the ethos canon was later recorded in the brand
guide as internal background. The product owner then mocked up a first-run
hero (2026-08): the setup gate opening on the ethos, set as a short poem
with a Milo illustration — the calf-carrier grown into the bull-carrier —
above the existing install and program sections.

Decision (product owner, 2026-08, via mockup): the first-run setup gate is the
theme's second permitted surface. It gains a hero holding exactly two strings —
`setup.ethos.title` "Strength isn't something you're born with." and
`setup.ethos.body`, the eleven-line passage the mockup sets in the mono face —
distilled from the canon in the brand guide, in English and Portuguese,
following every voice mechanic (sentence case, no exclamation marks,
meaning-first translation). One owner-licensed illustration occupies its own
responsive region at `assets/brand/milo-hero.webp`, decorative, replaced
wholesale like the mark, precached like every asset.

How the hero is set, and why it is set at all: the body's line breaks live in
the strings (`\n`, honoured by `white-space:pre-line`) rather than falling
where the phone happens to wrap. The passage is the one piece of copy in the
app whose rhythm is load-bearing, and the mockup breaks it in eleven lines and
three stanzas; a measure-dependent wrap would break it somewhere else on every
screen width. The cost is that translations must be re-broken by hand and each
written line has to fit the compact text column without a browser-added wrap.
The brand guide records both.

The illustration is painted by CSS (`background-image`), not marked up as an
`<img>`: it is decorative, it must never reach a screen reader, and an absent
export has to leave paper behind the copy rather than a broken-image glyph —
the same reason the exercise tiles render nothing at all without artwork. The
owner's file landed 2026-08; it is cropped to the ink and white-balanced onto
`--bg`, so its rectangle disappears into the page instead of needing a field
drawn around it the way the exercise detail page needs one (`mediaBg`). Details
in `assets/brand/README.md`.

**Amended 2026-08 — art and text use separate responsive regions.** The floated
composition made the illustration only about 143 CSS px wide on a 390 px phone,
even though the gate had substantially more usable width. Growing that float
would either wrap the authored poem lines or put graphite behind text. The hero
therefore becomes a grid in source order: title, complete illustration, poem.
On compact screens those regions stack, with the illustration sized from the
usable column and capped at 250 px. At 760 px the grid switches to two columns;
the illustration spans the title and poem rows in a column at least 340 px wide.
The breakpoint and minimum meet without the art shrinking as the viewport grows.

The picture is always shown whole, inside the page, never cropped, stretched,
or run off an edge. Its element uses the export's exact `1072 / 998` aspect ratio
and `background-size:contain`; the grid gap makes text/art separation structural
rather than dependent on authored line lengths. The poem still renders exactly
the breaks carried by each translation. Once the art moved out of the poem's
float, its measure remains centred and capped at `40ch`; the margin beside that
measure is intentional. The poem's size is set for legibility, not column fill.
On a 390 px screen the picture remains at least 240 px wide and the introduction
to the setup controls must begin on the first screen. The accepted cost is that
the install card itself may require a short scroll: preserving the larger
picture takes priority, while the introduction still tells the lifter what to
do next. `test/install-modes.mjs` checks that geometry at compact and wide
viewports in English and Portuguese — including both sides of the 760 px
breakpoint — with no overlap, no horizontal overflow, exact artwork ratio,
continuous poem sizing, and the first control within 1.15 screens.

Rejected: bleeding the picture off an edge (crops the load); enlarging the old
float (wraps or overlaps the poem); placing it beside copy on a compact phone
(neither region remains wide enough); distorting the export to fit a shallower
box; and changing the poem to solve a layout problem.

The gate's brand row stands the mark on the page instead of on a plate, so it
draws `assets/brand/mark.png` — the same mark with its full-bleed paper ground
dropped, derived from `icons/icon.svg` by `tools/build-brand-mark.mjs`. The app
icon's own warm ground (#EFE5DF) reads as a tile against the app's paper
(#F4F2EF), and neither a feathered mask nor the exercise-detail trick of
bleeding the artwork's own field fixes that at its rendered size: the first
leaves a beige disc, the second a 120px halo. Dropping the ground in the render does. The row
is centred on the column (owner, 2026-08), with a 62–76 px mark and a 21–26 px
wordmark, less the letter-space the tracked wordmark ends on, so it is the ink
and not the box that sits on the middle.

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
the breaks it was written with while the responsive composition remains
contained and non-overlapping in both languages; ADR
0004 carries an amendment pointer here. The canon itself stays internal, and
the app past the gate stays as quiet as it was.
