# Put the distilled ethos and the Milo illustration on the first-run gate

ADR 0004 confined the Milo theme to the app icon and reverted themed copy
from every working surface; the ethos canon was later recorded in the brand
guide as internal background. The product owner then mocked up a first-run
hero (2026-08): the setup gate opening on a distilled ethos line pair over a
Milo illustration — the calf-carrier grown into the bull-carrier — above the
existing install and program sections.

Decision (product owner, 2026-08, via mockup): the first-run setup gate is
the theme's second permitted surface. It gains a hero holding exactly two
strings — `setup.ethos.title` "Strength isn't given. It's built." and
`setup.ethos.body` "Load by load. Day after day. Until you're carrying what
once seemed impossible." — distilled from the canon in the brand guide, in
English and Portuguese, following every voice mechanic (sentence case, no
exclamation marks, meaning-first translation). One owner-licensed
illustration ships beside them at `assets/brand/milo-hero.webp`, decorative
(`alt=""`), replaced wholesale like the mark, precached like every asset.

Why this surface and no other: the gate is a threshold, not a working
surface. It appears before any training data exists and never again once a
program does, so the theme states why the app exists exactly once and then
gets out of the way. Inside the app the record speaks, not the brand — every
ban in ADR 0004 stands everywhere else: in-app copy, notifications, exports,
store metadata, tooltips, alt text.

Rejected: quoting the full canon on the gate (a manifesto is not a screen —
two lines carry it); themed copy on any working surface (ADR 0004's revert
was the point); softening the rule for store metadata (still banned); and
shipping placeholder art — icons, initials, silhouettes — while the licensed
export is pending. The empty-tile doctrine holds: the hero ships text-only
until the real illustration lands (steps in `assets/brand/README.md`).

Consequences: the brand guide's theme rule, Ethos section, and mark section
are amended to name the two permitted surfaces; `assets/brand/` exists for
owner-licensed brand art; `test/install-modes.mjs` locks the hero strings in
both languages the way it locks the install cards; ADR 0004 carries an
amendment pointer here. The canon itself stays internal, and the app past
the gate stays as quiet as it was.
