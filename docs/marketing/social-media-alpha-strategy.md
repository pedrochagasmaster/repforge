# Social media content strategy for the noncommercial alpha

**Status:** Proposed strategy, greenfield. Nothing here is owner-approved
yet; section 13 lists the decisions the owner has to make before the first
post. This document defines how Taurifer talks in public during the rolling
noncommercial alpha. It is not a backlog: any product change it implies goes
through [`docs/backlog.md`](../backlog.md), and any claim it makes is bound by
[`docs/business-product-thesis.md`](../business-product-thesis.md),
[`ADR 0010`](../adr/0010-product-business-thesis-and-validation-sequencing.md),
the [decision register](../product-grilling-decision-register.md) and the
[brand guide](../brand-guide.md). Where this document and those disagree, they
win; fix this document.

**Audience for this document:** the solo founder, and any agent or
collaborator drafting posts, scripts, captures or replies.

---

## 0. The strategy in one paragraph

Taurifer's alpha is recruited one lifter at a time, without payment, paywall,
waitlist or launch claim, and its evidence is read through telemetry plus
interviews. Social media therefore has one job during the alpha: put the
product, truthfully and in Brazilian Portuguese, in front of self-directed
lifters who already train from a program, so that a few of them try it, a few
of those talk to the founder, and the founder learns which words land. The
voice is the product's voice, a quiet training partner: facts, next steps,
second person, no hype, no celebration, no mythology. The founder's personal
account leads; a reserved brand account waits for the commercial beta. Content
comes from four sources the repository already produces: the live app, the
screen catalog, the training-science documents, and the public commit history.
Reach, followers and virality are not objectives. Conversations are.

---

## 1. What the alpha is, and what social media is for

### 1.1 Binding facts about the alpha

These come from the thesis (§8.4, §22), ADR 0010 and register section 9.
Every post and every reply must stay inside them.

- The alpha is **noncommercial**. No payment, no paywall, no price mention as
  an offer, no stable entitlement promise, no fake door, no waitlist CTA
  (thesis, "Canonical Phase 1 backlog").
- Recruitment is **organic and rolling**: the solo founder's direct network
  first, then social posts. One person at a time. Eight to twelve participants
  is an evidence milestone, not a cohort or a target date.
- Participants **self-select** and get **normal onboarding**. There is no
  research onboarding, invite code, form, or special participant build.
- The alpha starts **only after the Now foundations are credible** and the
  owner says so (`docs/backlog.md` §1). Until then social media may build an
  audience and a vocabulary but must not ask anyone to install.
- The **commercial-launch boundary** is behavioral: "if Taurifer begins
  commercially marketing the PWA as the launched product before an app-store
  release, the clock has started" (thesis §8.0). Social content must present
  the alpha as an evolving test, never as a launch.
- **Paid acquisition, creator pilots and larger creators are later phases.**
  Creator pilots wait for publisher attribution, which is Later in the
  backlog. Paid social is Phase 4.
- **What the alpha validates:** logging speed and reliability, progression
  trust, spreadsheet abandonment, repeated workout completion. It does not
  validate willingness to pay. Switching proof is interview evidence; no chart
  may be labelled as it (alpha scorecard).
- **There are no users, testimonials, reviews, press or numbers to cite**
  (`PRODUCT.md`, "Evidence on hand"). Nothing may be invented to fill the gap.

### 1.2 Objectives, in order

1. **Recruit the right participants, one at a time.** Self-directed lifters,
   training from a structured program, logging load, in Brazil, on their own
   phone. Quality over count; the founder has to support every one of them.
2. **Start conversations that become interview evidence.** A DM that turns
   into a ten-minute WhatsApp call is worth more than a thousand views.
3. **Learn the vocabulary.** Which Portuguese words for the product's ideas
   make a stranger stop scrolling. This feeds copy, onboarding and the later
   commercial launch.
4. **Build a truthful public record** the commercial beta can inherit:
   reserved handles, an audience that knows what the product is and is not,
   a library of reusable captures and explanations.

### 1.3 Non-objectives

Follower counts, reach, a launch spike, virality, revenue, an email list,
a community group, creator deals, app-store rankings, and any metric that
would tempt the founder toward hype the product forbids.

---

## 2. Who we are talking to

### 2.1 Primary: the self-directed Brazilian lifter on a program

From `PRODUCT.md` and thesis §2: trains in a commercial gym, phone in hand
between sets, often one-handed, often offline. Follows a program they got from
a coach, a creator, a friend, a book or their own head. Today they log in one
of: Hevy, a spreadsheet, the phone's Notes app, a paper ficha from the gym, or
memory. Their mental model is "I want a real training plan. I want to know
what I am doing today. I want to know whether I am improving."

Where they already are online: Instagram (the default Brazilian fitness feed),
WhatsApp (where programs and fichas actually travel), YouTube (long-form
training education in Portuguese), TikTok (short-form), and a smaller set of
forums and subreddits. Android is roughly three quarters of the Brazilian
market (thesis §4.4), so screen recordings default to Android.

What they respond to, by hypothesis: concrete screens of a real session, a
clear "why this weight", honesty about limits, and the absence of hype in a
feed full of it. This is a hypothesis to test in the first weeks, not a fact.

### 2.2 Secondary: coaches and creators (listen only)

Coaches who hand out programs are a confirmed audience of the product, but
creator pilots are gated behind publisher attribution. During the alpha the
posture is: reply, learn, note who is interested, make no offer. A coach who
wants to hand a program to their own client through a setup link may do so
today; that is a product capability, not a pilot.

### 2.3 Tertiary: builders (build-in-public audience)

People who follow local-first, PWA, or solo-founder work. They will not become
alpha participants but they lend credibility, catch bugs, and occasionally
know a lifter. Served in English on X or LinkedIn at low cost by reusing
commit history and design decisions.

---

## 3. Positioning and message architecture

### 3.1 Category and proposition

Category: **progression-first strength-training app** (thesis §3.1). Never
"AI fitness coach", "workout tracker", "gym social network", "personal trainer
app".

Working propositions, from thesis §3.2. They are internal framing until the
owner adopts one as public copy:

| English | Portuguese (working) |
| --- | --- |
| Follow your program. Know what to do next. | Siga seu programa. Saiba o que fazer na próxima. |
| A training log should not merely remember what you did. It should make the next session clearer. | Um registro de treino não deve só lembrar o que você fez. Ele deve deixar a próxima sessão mais clara. |

### 3.2 Five message pillars and their proof

Each pillar names only what ships today (`PRODUCT.md`, "What ships today").
A post may not lean on a pillar without a proof point from the live app.

| Pillar | One-line claim | Shipped proof |
| --- | --- | --- |
| **The next target is clear** | After each set the app tells you what to attempt next, and why. | Deterministic double-progression recommendations; capacity = performed reps plus trusted RIR; the `Why this weight?` explanation; session summary; block review. |
| **Your program, not ours** | Bring the program you already trust. | File import with name-by-name review; free-form paste with an assistant handoff and review; setup links from a coach; visual program editor; library of 270 movements in PT and EN; custom exercises; Taurifer program families and a baseline generator. |
| **Built for the gym floor** | Works offline, one-handed, between sets. | Service-worker precached shell; rest timer and notifications; substitution with performed snapshots; write-ahead journal survives being backgrounded. |
| **Your records stay on your phone** | No account. Export any time. | No sync, no account; JSON, CSV and plain-text export; the only data-moving paths are user-initiated. Supporting message, never the headline (thesis §6.3 item 6). |
| **Calm by design** | No streaks, badges, feeds or cheering. | The brand's hard ban on gamification. On social this is the contrarian angle: the feed is loud, the product is not. |

AI is not a pillar. The free-form import hands a prompt to ChatGPT or Claude
and reviews the reply; describe it as exactly that. Taurifer AI is
unimplemented and must not be previewed, teased or promised (ADR 0011, no fake
doors).

### 3.3 What we never say

From thesis §3.5, register Q551, Q555, Q557 and `PRODUCT.md`:

- "the only" anything; "the definitive strength app"; "in Brazil, the first".
- "science proves", "the optimal program", "guaranteed results", any
  superior-outcome claim. "Personalized" is permitted only as a factual
  description of using history and constraints.
- "AI personal trainer", "AI coach", "AI builds the perfect workout".
- "launch", "lançamento", "now available", "download now" as if the product
  were the launched offering. The word is **alpha**, or **em teste**.
- Any user count, rating, testimonial, or quote that does not exist.
- Any price, plan name, "Pro", "Premium", "free forever" as an entitlement
  promise. What is safe: "hoje não tem pagamento", "não tem plano pago no
  alpha", and the constitutional facts "seus registros são seus" and
  "exportar é e continuará sendo gratuito" (thesis §15.2).
- Capabilities that are Next or Gated: history import from Hevy or Strong,
  one-off sessions, Pro generation, sync, native apps. If asked, answer
  honestly that it is planned and not shipped.
- The name's origin. No bull, calf, carrying, forge, Latin or Milo in any
  caption, alt text, hashtag, bio or video, in any language. The mark and the
  wordmark are the identity; the story is internal (brand guide; ADR 0004).
  Section 13 records the one owner decision that could reopen this for a
  single origin post; the recommendation is no.

---

## 4. Voice on social

The brand guide's copy mechanics were written for the app. They apply to
posts, captions, replies and video text with these extensions.

- **Facts and next steps, second person, no hype.** If a sentence could
  describe any fitness app, make it specific or delete it.
- **Sentence case. No exclamation marks. Periods at the end of sentences.**
  Both catalogs have zero exclamation marks; social keeps the same zero.
- **Portuguese first, written as Portuguese.** Você, not tu. One word per
  thing: programa, sessão, série, carga, repetições, histórico, Progresso.
  Loanwords Brazilian gyms already use stay: RIR, PR, deload, timer, backup.
  Use the lifter's words in the hook ("ficha", "treino") and the product's
  words in the explanation ("programa", "sessão").
- **English is a mirror, not the source.** Draft in PT-BR, then write the
  English version; do not translate English hype into Portuguese.
- **The founder speaks as a person.** First person singular on the founder
  account ("estou testando", "eu treino assim"). The brand account, when it
  exists, speaks as the product: third person, present tense, factual.
- **No motivation, no celebration, no jokes at the reader's expense.** A PR
  is a fact ("PR de 82,5 kg no supino, 8 repetições") not a party. No fire,
  no flexed-arm emoji, no "let's go".
- **Emoji: none by default.** The app uses no emoji glyphs. An owner decision
  may allow a single neutral emoji for platform conventions; see section 13.
- **Replies are support.** Answer questions with the actual behavior, admit
  bugs plainly, point to backup and export before anything risky, and move
  anything involving a person's data or program to a DM. Never ask anyone to
  post a screenshot of their history publicly.
- **Competitors are named factually or not at all.** "Hevy exporta CSV; a
  importação de histórico ainda não está pronta no Taurifer" is fine.
  Disparagement is not.

---

## 5. Channels and their roles

### 5.1 Account architecture

**Recommendation:** the founder's personal account leads throughout the alpha.
Organic one-at-a-time recruitment runs on personal trust, and the founder is
also the support desk. Reserve the brand handles now (Instagram, TikTok,
YouTube, X, and the same string everywhere) so they exist for the commercial
beta, publish a bio and the mark, and post there only a pinned "what this is"
note plus mirrors of factual product posts. Activating the brand account as a
daily voice is a commercial-beta decision.

### 5.2 Channel table

| Channel | Role in the alpha | Language | Formats | Cadence (see §8) |
| --- | --- | --- | --- | --- |
| **Instagram** (founder) | Primary discovery and recruitment surface for the Brazilian lifter. | PT-BR | Reels of real screens, carousels on paper/ink tokens, Stories with polls and questions, the link in bio | 3 feed posts and a few Stories per week |
| **WhatsApp** | Where recruitment and support actually happen: direct messages, sharing the link to friends of friends, check-in calls. Not a community group. | PT-BR | Status for the same posts, one-to-one messages, voice calls for interviews | Continuous, one person at a time |
| **YouTube** | Search-durable explanation. One walkthrough of a full session and one on progression logic. Shorts reuse Reels. | PT-BR, EN subtitles | 8 to 12 minute walkthroughs, Shorts | One long video per month at most |
| **TikTok** | Reposts of Reels. Lowest priority; no native effort until it shows conversations. | PT-BR | Same Reels | Mirror only |
| **X and LinkedIn** | Build in public for builders: decisions, merges, why local-first, why no streaks. | EN (PT mirror when cheap) | Text, a screenshot, a link to a merged PR | 2 posts per week, batched |
| **Reddit and forums** | Only where self-promotion is allowed by the community's rules, and only as a reply that answers a real question. Never a drive-by link. | PT-BR or EN by venue | Text replies | Opportunistic |
| **GitHub** | The public record. The repository is public; issues and merged PRs are the changelog. There is no license file, so do not call it open source until one exists. | EN | Links from build-in-public posts | Continuous by nature |

Not used during the alpha: paid placement, influencer seeding, giveaways or
contests (they are gamification and platform-policy risk), email or a
newsletter (no waitlist), a Discord or WhatsApp community (a support burden
and a social surface the product itself rejects), press.

---

## 6. Content pillars, formats and mix

Five pillars. The suggested mix is by count of feed posts; adjust after four
weeks based on which pillar produces DMs.

### P1. What the app tells you next (40%)

Product truth, shown not described. The strongest single format is a 20 to
40 second Android screen recording of Today → Focus → three logged sets → the
recommendation → `Why this weight?` → Finish → session summary, with PT-BR
captions burned in. Variations: a substitution when a machine is busy; the
rest timer; the block review; dark and light appearance; airplane mode on.

Rules: seeded synthetic program or the founder's own data only. Verify every
number on screen against the live build before recording. Never show a setup
link URL or its `#setup=` fragment on screen; it is a bearer capability.

### P2. Sobrecarga progressiva, sem mística (25%)

Education about the ideas the product computes: RIR and why the app asks for
it, double progression, what "capacity" means (performed reps plus reps in
reserve), why 2.5 kg matters, why a scheduled review is not an automatic
deload, hard sets per muscle. Carousels on the paper and ink palette, or a
talking-head Reel.

Sources: [`docs/progressive-overload-mechanics.md`](../progressive-overload-mechanics.md),
[`docs/hypertrophy-mechanics-review.md`](../hypertrophy-mechanics-review.md),
[`docs/progression-effort-target-v1.md`](../progression-effort-target-v1.md),
and the [Plan 047 science source ledger](../plan-047-science-source-ledger.md).
Scientific authority is peer-reviewed primary research plus high-quality
reviews and position documents (Q552). Cite when a claim is a claim; when
evidence disagrees, say so (Q553). Never "science proves".

### P3. Construindo o Taurifer (20%)

Build in public. Why there is no account. Why there are no streaks. What a
merged PR fixed. What the alpha is and is not. What broke last week and what
was done about it. The honest state of iOS install validation. Text plus one
screenshot. EN on X and LinkedIn, PT-BR on Instagram.

### P4. Treino de verdade (10%)

The founder's own sessions: what the app suggested, what actually happened,
what it suggests next. Real data, the founder's own consent. Stated as facts,
including the off days. This pillar is the living demo and the only "social
proof" the alpha legitimately has.

### P5. Traga seu programa (5%)

Portability. Paste the coach's ficha and review it name by name. Import a
file. Receive a setup link. Edit days and exercises. State plainly that
history import from other apps is planned and not shipped.

### Formats and production notes

| Format | Where | Notes |
| --- | --- | --- |
| Screen-recording Reel, 15 to 40 s | Instagram, TikTok, Shorts | Android phone, real touch, captions in PT-BR, no music that sets a hype mood; ambient or none. |
| Carousel, 5 to 8 slides | Instagram, LinkedIn | Paper `#F4F2EF`, ink `#1B1A17`, accent `#E04E14` sparingly, IBM Plex Sans for text and Plex Mono for numbers. Hairlines, whitespace, no gradients, no stock gym photos (the landing rule, extended). |
| Story poll or question | Instagram | Research instrument: "Onde você anota seu treino?", "Você sabe o que é RIR?". Record results privately as interview-class evidence, not telemetry. |
| Long walkthrough | YouTube | One take, one real session, chapters. EN subtitles. |
| Text post | X, LinkedIn | One decision, one reason, one link to the merged PR or ADR. |

---

## 7. Asset production

Everything visual already has a reproducible source in the repository.

- **Screens:** `docs/ui-screens/screens/` holds phone-frame captures of every
  primary surface in both appearances and both languages, regenerated with
  `node tools/capture-ui-screens.mjs`. They are the visual source of truth and
  the first choice for carousels.
- **Flows:** the browser suites under `test/` drive a seeded six-week program
  through the pinned Chromium. The same harness can produce deterministic
  screen recordings; a real phone recording is preferred for Reels because
  touch reads as real.
- **Identity:** `icons/icon.svg` is the mark (generated output, never
  hand-edited), `assets/brand/mark.png` the ground-free version,
  `docs/brief-assets/` the lockup and a ten-screen montage. Fonts are the
  self-hosted IBM Plex files in `fonts/`.
- **Illustrations:** the 96 exercise `.webp` files are licensed for the app
  (`NOTICE.md`). Confirm the license covers marketing use before any post
  features one; until then crop them out or use screens without them.
- **Data on screen:** seeded synthetic programs or the founder's own records.
  Never a participant's screen, even with consent, during the alpha.

Marketing renders are not app assets. Nothing here enters `sw.js` `ASSETS`,
`index.html`, or the cache inventory. Keep generated videos and large images
outside the repository; small reusable source files (a carousel template, a
caption bank) may live under `docs/marketing/` if the owner prefers version
history over a drive folder.

---

## 8. Cadence and founder capacity

The founder builds, supports, interviews and posts. The cadence has to fit in
roughly four hours a week or it will stop.

| Activity | Rhythm | Time |
| --- | --- | --- |
| Capture and record | One session per month, batching four to six Reels and two carousels | 2 to 3 h once a month |
| Instagram feed | 3 posts per week from the batch | 30 min per week to caption and post |
| Stories | 2 to 4 per week, mostly reposts, polls and replies | 15 min per week |
| Build in public | 2 text posts per week, written when a PR merges | 20 min per week |
| Replies and DMs | Daily glance, batch replies | 30 min per week, more when a participant joins |
| YouTube | One long video per month at most; skip a month rather than rush | 3 h when it happens |
| Reading | One page per week: what was posted, what produced a conversation, what to change | 20 min per week |

Stop rules: if a week's support load from participants exceeds the time
available, pause the recruitment CTA and keep publishing P2 and P3. If a post
type produces no conversation in four weeks, drop it. Never fill a gap with a
post that violates section 3.3.

---

## 9. Sequence

### Phase A. Before the alpha opens (now until the owner declares it)

The candidate is still being constructed (`docs/backlog.md` §1; the post-058
clearance sequence; Plan 059 sign-off). No install CTA yet.

1. Owner decides section 13.
2. Reserve handles, write bios, upload the mark, pin a "what this is" note.
3. Publish P3 and P2 only: what is being built, why it works the way it does,
   the training ideas behind it. Link to the repository if the owner allows.
4. Prepare the first capture batch on the frozen candidate SHA, not before;
   captures of an older build would be wrong the week they post.
5. Draft the alpha-open post and the expectations post (Appendix A) and have
   the owner approve the wording against the Privacy page so the two never
   disagree.

### Phase B. Alpha opens (owner declares)

1. Direct network first: personal WhatsApp messages to the people the founder
   already knows train from a program. Send the same link, the same
   expectations text.
2. Then the alpha-open post on Instagram with the link in bio. One post, not a
   campaign.
3. Every new participant gets a personal thank-you in DM, the backup reminder,
   and a request for a ten-minute call after their first week.
4. If two or more people join in the same week and support time is gone,
   remove the CTA from the pinned post until the next week. One at a time is
   the rule, not a limitation to apologize for.

### Phase C. Rolling (each participant on their own six-week clock)

Weekly rhythm per section 8. Interview after week one and near the end of the
block. Publish nothing about a participant without explicit, specific consent,
and nothing that identifies them even then; the roster is private (alpha
scorecard). At the eight-to-twelve milestone, read the evidence and reassess
this document. The alpha ends on the register's criteria, not on a calendar.

### Six-week starter calendar (Phase B onward)

| Week | Instagram feed | Stories | Build in public | Other |
| --- | --- | --- | --- | --- |
| 1 | A1 alpha-open post; A2 expectations carousel; P1 Reel: one full session | Poll: where do you log today | Why no account, why no streaks | WhatsApp direct-network round |
| 2 | P1 Reel: `Why this weight?`; P2 carousel: RIR in one minute; P4 founder log | Question: what is in your current program | What a merged PR fixed | First check-in calls |
| 3 | P1 Reel: substitution when the machine is busy; P2 carousel: double progression; P5 paste your ficha | Poll: coach program or own program | The honest state of iOS install | YouTube walkthrough, if ready |
| 4 | P1 Reel: offline in airplane mode; P2 carousel: why 2.5 kg matters; P4 founder log | Repost participant-safe P1 | Design decision: capacity as one currency | Read the month; adjust mix |
| 5 | P1 Reel: session summary and the week; P2 carousel: a review is not a deload; P3 what broke and what was fixed | Question: what stopped you logging | Data on the device, and export | Second capture batch |
| 6 | P1 Reel: block review; P2 carousel: hard sets per muscle; P4 founder log at block end | Poll: would you show a coach your block review | Six weeks in: what the alpha showed, facts only | Reassess this document |

---

## 10. Recruitment mechanics

- **The CTA is the link and a DM.** "O link está na bio. Me chama no direct se
  travar em algo." No form, no waitlist, no code, no "vagas limitadas". The
  product is live and onboarding is normal; the rolling limit is the founder's
  support time, managed by showing or hiding the CTA.
- **Soft qualification in the copy.** Say who it is for: trains from a
  program, logs load, has a phone. Say who it is not for yet: someone who
  wants history from another app, or a paid plan, or anything native.
- **Expectations, stated once and linked from the bio:** it is an alpha;
  things can break; workouts stay on the phone, so export a backup from
  Settings; the browser may evict storage; analytics is pseudonymous with an
  off switch, as the in-app Privacy page describes. Social copy must not
  strengthen or soften what the Privacy page says.
- **Which URL to post** is an owner decision (section 13). Product telemetry
  does not carry a referral source, and the app's URL handling and the setup
  fragment leave no safe room for tracking parameters; attribution is asked in
  the first interview instead.
- **Check-ins produce the evidence that matters.** A voice call after week one
  and near the end of the block: did you stop using the spreadsheet, did the
  suggestion make sense, what broke, how did you find us. Notes stay private
  and are recorded as interview evidence, separate from telemetry.

---

## 11. Measurement

Three evidence classes, kept apart as the alpha scorecard requires.

| Class | What it can show | Source | Weekly reading |
| --- | --- | --- | --- |
| **Platform analytics** | Which posts get saved, shared, clicked; profile visits; DMs started | Instagram, YouTube, X native insights | Link clicks and DM conversations per post, by pillar |
| **Product telemetry** | First-run boots, activation route, first set logged, session completion, repeat use | PostHog per the scorecard; closed schema; no referral or source property exists | The scorecard's own views, with their denominators; do not join to social |
| **Interviews** | How they found it, what they used before, whether they stopped using it, whether the next target made sense | WhatsApp calls, private notes | One line per participant per check-in |

Leading indicators worth watching, all descriptive: DM conversations per post,
the share of new participants who arrived through social versus direct
network, and, on the product side, how many first-run installations reach a
first logged set. No number in this document is a target. The scorecard
authorizes no conversion target or launch threshold for the alpha and neither
does this strategy.

Never add a user, program, exercise or workout identifier, a URL parameter, or
a new event to make social attribution easier. A new telemetry property is a
backlog decision with a privacy review, not a marketing convenience.

---

## 12. Guardrails

**Claims.** Section 3.3 is the checklist. When in doubt, describe the screen.

**Privacy and LGPD.** Health-related data linked to a person is sensitive
under LGPD (thesis §15.5). No participant's screen, name, numbers or
program appears in public, with or without consent, during the alpha. Story
poll results are aggregate and are not tied to individuals. The founder's own
data is the founder's to show.

**Setup links.** Never paste or show a setup link, its fragment, or the
handoff cookie. Anyone with the URL can start that program.

**Commercial boundary.** The words are alpha and em teste. No "lançamento", no
plan names, no prices, no "grátis para sempre" beyond record ownership and
free export.

**Brand theme.** No bull, calf, Milo, forge or Latin anywhere social, in any
language, including hashtags and alt text. Mark and wordmark only.

**Gamification.** No giveaways, contests, challenges, streak prompts or
"tag a friend who skips leg day" formats. They contradict the product and
most are platform-policy risk.

**Licensing.** Exercise illustrations: confirm marketing use is covered before
featuring them. The exercise dataset's attribution is in `NOTICE.md`. IBM Plex
is under the SIL Open Font License and is fine.

**AI.** The free-form import is a handoff to a general assistant the lifter
already uses; say so. Taurifer AI does not exist and is not previewed.

**Repository.** Public, unlicensed. "Código público" is accurate; "open
source" is not until a license file exists.

---

## 13. Decisions the owner must make before the first post

Each has a recommendation. None is assumed.

1. **Account architecture.** Founder-personal leads, brand handles reserved
   and mostly silent until the commercial beta. *Recommended: yes.*
2. **Handle string.** One string for all platforms; check availability of
   `taurifer` and a fallback before anything else.
3. **Public URL in the bio.** The production origin the measurement plan names
   (taurifer.com) if it is live and serves the production build; otherwise the
   GitHub Pages URL, accepting that it shows the internal `repforge` codename.
   *Recommended: the production origin, confirmed live first.*
4. **The name's origin on social.** *Recommended: no.* The brand guide's rule
   already covers store metadata and the thesis wants marketing more concrete
   than mythology. If the owner wants one origin post, it is one post, on the
   founder account, never repeated, and never a hashtag.
5. **Emoji.** *Recommended: none.* An allowed exception would be a single
   neutral emoji where a platform convention requires one.
6. **Language split.** *Recommended:* PT-BR on Instagram, WhatsApp, YouTube
   and TikTok; EN on X and LinkedIn with occasional PT mirror.
7. **The founder's face and voice on camera.** Talking-head Reels convert
   better than screen-only in this category, by common experience, not by
   evidence from this product. *Recommended: yes for P2 and P4, optional
   elsewhere.*
8. **Linking the public repository from posts.** *Recommended: yes* on build-
   in-public channels; optional on Instagram.
9. **Illustration license for marketing use.** A check, not a choice, but the
   owner holds the license.
10. **YouTube during the alpha.** *Recommended: one walkthrough after the
    candidate is frozen, then only if it produces conversations.*
11. **Reddit and forums.** *Recommended: reply-only, where rules allow.*
12. **When the install CTA goes live.** The owner declares alpha open per the
    backlog; this document does not.
13. **Marketing source files in the repository.** Under `docs/marketing/` or
    in an external folder. *Recommended: small templates and the caption bank
    in the repository; renders and video outside it.*

---

## 14. Out of scope until later phases

| Item | Why not now | Owner |
| --- | --- | --- |
| Creator pilots, creator content, affiliate mentions | Publisher attribution is Later; pilots wait for it | `docs/backlog.md` §5 |
| Paid social, boosted posts, influencer seeding | Phase 4, after retention and monetization signal | Thesis §22 |
| Waitlist, email list, newsletter | Explicitly prohibited during the alpha | Thesis, Canonical Phase 1 backlog |
| A community group (WhatsApp, Discord, Telegram) | Support burden on one founder; a social surface the product rejects | Thesis §19 |
| Pricing or Pro mentions | Payment waits for a working Pro MVP; prices are beta hypotheses | ADR 0010 |
| App-store listing copy | Native is evidence-gated Phase 2 | Thesis §22 |
| Press or launch announcements | Would start the commercial-launch clock | Thesis §8.0 |
| Brand account as a daily voice | Commercial-beta decision | This document §5.1 |

---

## Appendix A. Starter drafts

Portuguese is the source; English is a gloss. All drafts follow section 4.
Every screen fact must be re-verified against the frozen candidate before
posting. The owner approves A1 and A2 against the in-app Privacy page.

### A1. Alpha-open post (Instagram feed, founder account)

> Estou testando o Taurifer com poucas pessoas, uma de cada vez.
>
> É um app de treino para quem segue um programa e quer saber o que tentar
> na próxima série. Você anota carga, repetições e RIR. Ele calcula o próximo
> alvo e explica o porquê.
>
> Não tem conta, não tem feed e não tem plano pago. Seus treinos ficam no seu
> celular.
>
> É um alpha. Algumas coisas vão quebrar. Se você treina com programa e anota
> carga, o link está na bio. Me chama no direct se travar em algo.

Gloss: I am testing Taurifer with a few people, one at a time. It is a
training app for someone who follows a program and wants to know what to
attempt in the next set. You log load, reps and RIR. It computes the next
target and explains why. No account, no feed, no paid plan. Your workouts stay
on your phone. It is an alpha. Some things will break. If you train from a
program and log load, the link is in the bio. Message me if you get stuck.

### A2. Expectations carousel (pinned; linked from bio)

Slide 1: O que é o alpha do Taurifer.
Slide 2: Um app que roda no navegador do celular. Dá para instalar na tela
inicial. Funciona sem internet depois de aberto.
Slide 3: Seus treinos ficam no seu aparelho. Não existe conta. Exporte um
backup em Ajustes antes de trocar de celular ou limpar o navegador.
Slide 4: O navegador pode apagar dados guardados. Faça backup de vez em
quando.
Slide 5: O app envia uso pseudônimo para eu entender o que funciona. Tem um
botão para desligar. A página de Privacidade dentro do app explica tudo.
Slide 6: Não tem pagamento. Não tem plano pago. Não é um lançamento.
Slide 7: Se algo quebrar, me chama no direct. Se algo estiver certo, também.

### A3. Reel script: Por que esse peso? (P1)

On screen, Focus view, a lift with three sets logged. Captions:

1. "Ontem: 60 kg, 10, 9 e 8 repetições, RIR 2."
2. "Hoje o app sugere o próximo alvo."
3. Tap `Por que essa carga?` (the live PT label for `why.open`).
4. "Ele usa o que você fez e a folga que sobrou. Não usa motivação."
5. "Se você fechou o topo da faixa, ele sugere subir a carga. Se não, ele
   mantém e mostra o alvo de repetições."
6. "Você decide. Ele registra."

Verify the exact suggestion and the explanation text on the live build before
recording; the numbers above are placeholders.

### A4. Carousel: RIR em um minuto (P2)

Slide 1: RIR: repetições em reserva.
Slide 2: Quantas repetições você ainda faria com boa forma se continuasse.
Slide 3: RIR 0 é falha. RIR 2 é duas sobrando.
Slide 4: O Taurifer soma repetições feitas e RIR confiável para ler o que a
série mostrou.
Slide 5: Por isso ele pergunta. Não é nota. É medida.
Slide 6: Fonte: ver o ledger de fontes no repositório.

### A5. Build in public (X, English)

> Taurifer has no streaks, badges or celebration screens, by rule. A saved
> session says "Session saved" and shows the numbers. The engine reports what
> a set demonstrated; it does not cheer. Here is the ADR that made themed copy
> a one-time mistake: [link]

### A6. Founder log (P4, Instagram)

> Semana 3 do bloco. Supino: 80 kg, 8, 8, 7, RIR 2. O app manteve 80 e pediu
> 8, 8, 8 na próxima. Agachamento: pulei, joelho reclamando, troquei por leg
> press e o histórico registrou a troca. Próxima sessão quinta.

### A7. Traga sua ficha (P5, Reel)

Captions over the import flow:

1. "Sua ficha veio no WhatsApp? Cola aqui."
2. "O app prepara um pedido. Você cola no ChatGPT ou no Claude e traz a
   resposta."
3. "Ele revisa exercício por exercício antes de salvar. Nada é gravado sem
   você confirmar."
4. "Importar histórico de outros apps ainda não está pronto."

### A8. Story polls (research)

- Onde você anota seu treino hoje? App / planilha / papel / cabeça.
- Você sabe o que é RIR? Sim / mais ou menos / não.
- Seu programa veio de: coach / criador / você mesmo / academia.
- O que te faz parar de anotar? Demora / esqueço / não vejo diferença.

## Appendix B. Pre-publish checklist

1. Is every claim something the live candidate does today?
2. Is there any number, count, quote or result that does not exist?
3. Any exclamation mark, hype adjective, emoji, or celebration?
4. Any "launch", price, plan, Pro, waitlist, or entitlement promise?
5. Any bull, calf, Milo, forge, Latin, in any language, including hashtags?
6. Any setup link, fragment, cookie value, or participant data on screen?
7. Does it contradict the in-app Privacy page in either direction?
8. PT-BR drafted first, você, one Portuguese word per thing?
9. Does it name Taurifer AI, "coach", or "AI personal trainer"?
10. Is the illustration or asset on screen licensed for this use?
