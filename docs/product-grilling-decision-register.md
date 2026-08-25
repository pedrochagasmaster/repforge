# Taurifer product-grilling decision register

**Status:** Owner decision record through August 25, 2026  
**Answered coverage:** Q1–Q260, subject to the transcript notes below  
**Pending:** Q261–Q271  
**Purpose:** Preserve the owner’s answers, qualifications, corrections,
supersessions, and the product decisions reached between numbered questions.

This document records the extended product-strategy grilling session that
followed the initial business thesis and Plan 044. It is an audit trail, not a
new implementation plan. Where a later decision in this register conflicts
with an older thesis, backlog, ADR, or plan, the later owner decision is the
position that those documents must be revised to express.

## How to read this register

- **Answer** records the owner’s selected option or direct response.
- **Canonical outcome** records the final meaning after debate and later
  qualifications. Selecting an option did not freeze its original wording when
  the owner later narrowed or superseded it.
- A later decision wins over an earlier one. The supersession index below makes
  the important cases explicit.
- Several assistant question messages between Q60 and Q210 were compacted out
  of the retained conversation transcript. Their exact option wording is not
  recreated from memory. The literal answer sequence and every retained owner
  qualification are recorded below; the substantive decisions they produced
  are consolidated in the canonical-decision sections.
- The owner typed Q118 twice and Q131 twice while otherwise continuing in
  sequence. This register treats the second occurrences as Q119 and Q132,
  respectively, but marks that numbering inference rather than concealing it.
- While answering Q211–Q221, the owner wrote “127 — the ‘generate a custom
  program’ flow should still exist.” Because the original Q127 already had a
  different answer, this is recorded as an unnumbered correction to the entry
  design, not as a replacement for historical Q127.

## Sequential answer ledger

### Q1–Q10 — customer, commercial boundary, and telemetry

| Question | Answer | Canonical outcome |
|---|---|---|
| Q1 — first paying customer | A | Initially selected serious self-directed lifters already running repeatable programs. Later generator-first decisions broadened the acquisition user to self-directed intermediates who want Taurifer to create and adapt the program; BYOP remains a migration/expert path. |
| Q2 | A | Accepted as asked. The later resolution separates execution validation from generator monetization rather than requiring one cohort to prove both. |
| Q3 | C | Prototype and pre-commercial entitlements may change. The permanent Free floor begins at commercial launch; ownership of records and free export are protected regardless. |
| Q4 — charging before Pro works | Leaned A and requested debate | Superseded. Taurifer will not charge for a roadmap, run a fake paywall, or accept payment until a real minimum Pro product and entitlement lifecycle work. |
| Q5 — telemetry posture | A | Full PostHog functionality is authorized only with the later Q10 safeguards, accurate pseudonymous disclosure, a working opt-out, and mechanical prevention of sensitive-data leakage. |
| Q6 — founding offer | Direct answer: real-user/payment testing begins only after a genuine minimum set of Pro features exists | This supersedes the immediate-payment premise. |
| Q7 — one cohort or two | B | Execution learning and generator monetization are distinct evidence problems. Later alpha decisions use organically recruited generated/template users rather than a BYOP-first cohort. |
| Q8 — behavior replaced | A | Taurifer should replace a spreadsheet or paper program plus manual progression decisions, while later generator-first acquisition reduces the requirement that the user already own a program. |
| Q9 — muscle priorities | B | Basic priority selection remains Free; Pro must provide materially richer specialization and adaptation. |
| Q10 — meaning of full PostHog | A | Full functionality is conditional on closing `$`-event, console, replay, URL, input, text, and network-body leakage paths and describing the data as pseudonymous. |

### Q11–Q19 — pilot sequencing, Pro job, expiry, and metrics

| Question | Answer | Canonical outcome |
|---|---|---|
| Q11 — pilot sequencing | Uncertain | Resolved by Q26A and Q41A: a noncommercial alpha may begin before Pro; paid testing waits for the working Pro MVP. |
| Q12 — first complete Pro job | B | Specialization around the athlete’s priorities within real time and volume constraints. This later became one part of a three-job Pro MVP. |
| Q13 — expiry | A | A generated program remains executable and editable after Pro lapses; only future Pro decisions stop. |
| Q14 — initial BYOP qualification | Agreed | The narrow BYOP definition was later superseded as the primary alpha design by organic generator/template recruitment. It remains a useful secondary-cohort definition. |
| Q15 — switching evidence | A, B, C, and D | Final hierarchy: speed/reliability is a guardrail; progression trust is the mechanism; spreadsheet abandonment is behavioral proof; repeated completion/retention is the outcome. |
| Q16 — staged pilot | Uncertain | Resolved in favor of a pre-Pro, noncommercial alpha, later made rolling and organic. |
| Q17 — metric hierarchy | Agreed | Locked in the hierarchy stated at Q15. |
| Q18 — generator domain | C | Superseded. Powerlifting was subsequently removed. Initial generated-program scope is hypertrophy and general strength. |
| Q19 — subscription cadence | B | Offer monthly and annual subscriptions rather than annual only. |

### Q20–Q32 — breadth, engine architecture, market entry, and pricing

| Question | Answer | Canonical outcome |
|---|---|---|
| Q20 — whether to withhold all external testing | No directly retained letter | Resolved by Q26A/Q41A: withhold commercial launch, not all contact with lifters. |
| Q21 — breadth of execution versus prescription | Earlier answer later discussed as broad first-class ambition | Superseded by removal of powerlifting. Taurifer supports hypertrophy and general-strength prescription; external/manual programs may use only declared supported strategies. |
| Q22 — progression architecture | B with a touch of C | Capacity is shared evidence; explicit strategies own prescription. Internal schemas may be extensible, but users do not enter arbitrary formulas. |
| Q23 — manual progression | A | An authored/imported exercise may tell Taurifer not to invent a target. |
| Q24 — first Pro generator breadth | Earlier answer not directly retained | Final scope is advanced hypertrophy/general-strength generation, not powerlifting. |
| Q25 — initial price pair | A | R$24.90/month and R$179.90/year; no three-price experiment in the small beta. |
| Q26 — middle-ground alpha | A | Run a pre-commercial program-based alpha before automated Pro is complete. Later decisions removed per-participant program review and made recruitment rolling and organic. |
| Q27 — entry hierarchy | A, with Taurifer program templates added | Generator primary; Taurifer-owned programs secondary; BYOP/build/import tertiary. Later UX splits generator into Recommend and Generate Custom without making both equal top-level products. |
| Q28 — primary initial customer | A | Self-directed intermediate lifters who want Taurifer to create and adapt their program. Organic alpha recruitment means actual entrants cannot be tightly selected. |
| Q29 — meaning of powerlifting | C | Superseded by removing powerlifting terminology entirely. Squat, bench, and deadlift may appear in general Strength without a powerlifting claim. |
| Q30 — release gate | B | Superseded insofar as it referenced powerlifting beta. Commercial launch still requires first-class hypertrophy/general-strength value. |
| Q31 — progression control | A | Taurifer selects a validated compatible strategy; users adjust bounded parameters and may override individual targets. |
| Q32 — Free/Pro generator boundary | A | Free baseline generation/default progression; Pro sells advanced personalization, history-aware decisions, and adaptation. |

### Q33–Q49 — program ownership, transitions, and Pro MVP

| Question | Answer | Canonical outcome |
|---|---|---|
| Q33 — external-program rights | Agreed with A | Named external programs require permission or a compatible licence. Otherwise Taurifer writes and owns its own programs. |
| Q34 — fidelity versus Taurifer progression | B | Superseded by the stronger parallel-thread decision: Taurifer does not reproduce named classics. It owns original blueprints compiled through the shared engine. |
| Q35 — initial library | Deferred to the parallel template-system plan | Working direction became original Taurifer program families, not a copied-classics catalogue. Public family naming and final library taxonomy remain pending in Q261–Q271. |
| Q36 — what Free can do after a program | A | Generate another basic program, choose another available Taurifer program, repeat, edit, or import. Personalized historical selection is Pro. |
| Q37 — end-of-program paywall | A | Free shows a useful retrospective and broad recommended direction; Pro turns the evidence into the detailed personalized prescription. |
| Q38 — data for the next program | A | Logged performance plus a short review of goals, recovery, enjoyment, pain, and changed schedule/constraints. |
| Q39 — minimum Pro before paid testing | A | Advanced first-program generation plus history-aware next-program generation; Q42 adds within-block adaptation. Noncommercial alpha may precede them. |
| Q40 — value between programs | A | Pro proposes bounded program-level adaptations during the block; ordinary set progression stays Free. |
| Q41 — validation contradiction | A | Core engine/program alpha may start before Pro. Payment waits for Pro MVP. |
| Q42 — Pro MVP bundle | A, plus engine evolution beyond double progression | Advanced first-program generation, history-aware next-program generation, and bounded within-block adaptation. The shared Free engine must first support multiple strategies. |
| Q43 — Free/Pro engine boundary | A | All supported progression mathematics/basic parameters are Free; Pro pays for intelligent selection and adaptation. |
| Q44 — intervention authority | A, with unresolved intervention catalogue noted | Taurifer explains and proposes bounded changes; user approval is required. Repeated skipping and exercise plateau are mandatory initial cases. |
| Q45 — permitted v1 adaptations | A, with cause-matched flexibility | Upcoming set volume, justified deload timing, and substitutions are initial tools; skip and plateau causes may justify other bounded changes without changing the program arbitrarily. |
| Q46 — minimum history | C | Use partial and unfinished history. Meet the lifter where they are and explain confidence. |
| Q47 — next-program mechanism | A | Select and personalize the best-fitting Taurifer program family rather than inventing an unconstrained structure. |
| Q48 — fake-door policy | C | No fake doors. Q59 further limits future-feature research to interviews and external prototypes. |
| Q49 — Pro lapse | A | Keep the program and accepted changes; Free progression continues; future program-level re-optimization and next-program generation stop. |

### Q50–Q59 — intervention foundation and research boundary

| Question | Answer | Canonical outcome |
|---|---|---|
| Q50 — Free/Pro intervention boundary | A | Free records events, runs normal exercise-level progression, and permits manual repair; Pro detects recurring patterns and proposes structural changes. |
| Q51 — initial issue catalogue | A | Repeated skip, exercise plateau, recurring recommendation override, recurring session overrun, schedule mismatch/missed sessions, and unfinished-program transition. Do not diagnose injury. |
| Q52 — repeated-skip trigger | A | Ask why after two skips in the last three eligible exposures. |
| Q53 — plateau detection | A | Strategy-specific, two-stage detection using comparable adherent exposures and confirmation/evidence before structural change. |
| Q54 — plateau escalation | A, but owner rejected a universal order and said load granularity is rarely the issue | Final rule: case-by-case diagnosis, smallest cause-matched intervention, normally one main variable. Granularity is only one conditional branch. |
| Q55 — unfinished program | A | Decide resume, repair, rebase, or switch; replacement is not automatic. |
| Q56 — exit reasons | A, expanded with session length, intensity, exercise affinity, and free text; owner initially required free text in telemetry | Structured reasons plus optional text. Later privacy resolution supersedes ordinary-PostHog storage: text uses a separate, explicitly consented feedback path with limited retention. |
| Q57 — partial-history confidence | A | Separate observed facts, user reports, and Taurifer inference; expose confidence. |
| Q58 — manual strategy control | A | Free users can select supported strategies/basic parameters; Pro automates selection/adaptation. |
| Q59 — future-feature research | B | Interviews and external prototypes only. Do not place concept previews or planned-feature affordances inside Taurifer. |

### Q60–Q89 — accepted follow-ups and volume-tolerance correction

The exact question wording for this compacted block is not retained. The
answer sequence is preserved literally; the decisions produced by the block
appear in the canonical sections below.

| Question | Answer / qualification |
|---|---|
| Q60 | A |
| Q61 | A |
| Q62 | A |
| Q63 | A |
| Q64 | A |
| Q65 | A |
| Q66 | A |
| Q67 | A |
| Q68 | A |
| Q69 | A |
| Q70 | A |
| Q71 | A |
| Q72 | A |
| Q73 | A |
| Q74 | A |
| Q75 | A |
| Q76 | A |
| Q77 | A |
| Q78 | A with part of B |
| Q79 | A |
| Q80 | A (sent separately) |
| Q81 | A |
| Q82 | A |
| Q83 | C. Do not ask volume tolerance during onboarding; most lifters do not know it, especially without controlling confounders such as intensity. |
| Q84 | A |
| Q85 | A |
| Q86 | A |
| Q87 | A |
| Q88 | A |
| Q89 | A |

Owner direction accompanying this block: the Pro backlog, business/product
thesis, ADR 0010, and Plan 044 are materially obsolete and must be revised.

### Q90–Q116 — muscle allocation, progression, and deload constraints

| Question | Answer / qualification |
|---|---|
| Q90 | A |
| Q91 | A |
| Q92 | A, with an explicit **ignore** setting added |
| Q93 | A |
| Q94 | A |
| Q95 | A |
| Q96 | A |
| Q97 | B |
| Q98 | A |
| Q99 | A |
| Q100 | A |
| Q101 | A |
| Q102 | A |
| Q103 | A |
| Q104 | A |
| Q105 | A, with the constitutional qualification that deloads must be justified by performance stagnation or degradation only |
| Q106 | A |
| Q107 | C |
| Q108 | A |
| Q109 | A |
| Q110 | A |
| Q111 | A |
| Q112 | A |
| Q113 | A |
| Q114 | A |
| Q115 | A |
| Q116 | A |

### Q117–Q144 — generation coverage, self-selection, and generated testing

| Question | Answer / qualification |
|---|---|
| Q117 | B |
| Q118 | C |
| Q119 | A — numbering inferred because the owner typed a second “Q118A” before continuing with Q120 |
| Q120 | A |
| Q121 | A, while acknowledging that B is also true to an extent |
| Q122 | A. The existing simple generator covers all current cases; its evolution should preserve that coverage. |
| Q123 | A |
| Q124 | B |
| Q125 | Participants should self-select rather than be assigned. |
| Q126 | A |
| Q127 | A, but do not advertise programs as “unvalidated.” |
| Q128 | A |
| Q129 | A |
| Q130 | A |
| Q131 | A |
| Q132 | A — numbering inferred because the owner typed Q131 twice before continuing with Q133 |
| Q133 | A |
| Q134 | A |
| Q135 | A |
| Q136 | A |
| Q137 | A |
| Q138 | A |
| Q139 | A |
| Q140 | A |
| Q141 | A |
| Q142 | A |
| Q143 | A, with the full lifecycle issue added to the parallel fast-check generative/model-based testing framework |
| Q144 | B |

Q143 requires generated tests to cover onboarding, program generation,
execution, progression, skips, stalls, overrides, interruptions, abandonment,
and transition—not merely isolated progression functions.

### Q145–Q161 — testing review and rolling organic alpha

| Question | Answer / qualification |
|---|---|
| Q145 | A |
| Q146 | A |
| Q147 | Human-review mechanism was unclear; later superseded by “no individual program audit.” |
| Q148 | Human-review mechanism was unclear; later superseded by “no individual program audit.” |
| Q149 | Human-review mechanism was unclear; later superseded by “no individual program audit.” |
| Q150 | Human-review mechanism was unclear; later superseded by “no individual program audit.” |
| Q151 | A |
| Q152 | A, with testing scope and cadence required to be **very strategic** |
| Q153 | Human-review/export mechanism was unclear; later superseded by “no individual program audit.” |
| Q154 | A |
| Q155 | Recruiting is organic, one person at a time, primarily by the founder; reaching the full cohort will take time. |
| Q156 | Every relevant program family needs three- and five-day versions. Participants cannot be tightly selected, social recruitment is unpredictable, and churn is expected. |
| Q157 | Rejected as an organizational-design question: the solo founder handles the work as it comes. |
| Q158 | Same solo-founder correction as Q157. |
| Q159 | A |
| Q160 | Same solo-founder correction as Q157. |
| Q161 | Same solo-founder correction as Q157, including customer service. |

The final human-review rule is development-time review of the underlying
program designs, rules, and representative synthetic outputs only. Taurifer
does not audit, approve, badge, or secretly repair each participant’s program.

### Q162–Q200 — volume inputs, onboarding time model, and PostHog

| Question | Answer / qualification |
|---|---|
| Q162 | A |
| Q163 | Initial volume depends only on training maturity, frequency, and session length. |
| Q164 | A |
| Q165 | A |
| Q166 | A |
| Q167 | A |
| Q168 | A, with a proper PostHog funnel analysis; the existing implementation must be developed further where needed. |
| Q169 | A |
| Q170 | A |
| Q171 | A |
| Q172 | Agreed |
| Q173 | A, adding preferred rest-interval length to onboarding so available training time can be estimated. |
| Q174 | A |
| Q175 | A |
| Q176 | A |
| Q177 | A |
| Q178 | A |
| Q179 | A, with a top-notch PostHog implementation required. |
| Q180 | A |
| Q181 | A |
| Q182 | A |
| Q183 | A |
| Q184 | A. Research participants use the normal onboarding and receive the same random identifier model as everyone else. |
| Q185 | A |
| Q186 | A |
| Q187 | A |
| Q188 | A |
| Q189 | A |
| Q190 | A |
| Q191 | A |
| Q192 | A |
| Q193 | A |
| Q194 | A |
| Q195 | A |
| Q196 | A |
| Q197 | A |
| Q198 | A |
| Q199 | A |
| Q200 | A |

### Q201–Q221 — replacing the goal-to-family mapping

| Question | Answer / qualification |
|---|---|
| Q201 | A, while identifying a conflict with the current “Build muscle / Build muscle and Strength / Build consistency” goal question and requesting an overall redesign. |
| Q202–Q210 | No individual letters retained. The owner requested a harsh adversarial review and approved the revised UX as a whole. The canonical result is recorded below. |
| Q211 | A — desired result uses three plain choices: prioritize muscle growth, balance muscle and strength, prioritize strength. |
| Q212 | A — Strength may choose suitable primary movements; the user may optionally name movements they care about. |
| Q213 | A — structured-program experience controls complexity; recent consistency is a separate current-state input. |
| Q214 | A — Foundation/Base is for genuinely new users or an explicitly simple start, not every experienced returner. |
| Q215 | A — Browse reuses/asks compatibility facts before showing programs. |
| Q216 | A — recommendation shows at most two suitable alternatives; Browse owns the full catalogue. |
| Q217 | A — split preference is optional and shown only where appropriate. |
| Q218 | A — explain the recommendation using desired result, current state, schedule, and main constraint; no opaque score. |
| Q219 | A — rejection offers a compatible alternative and optional reason without blocking. |
| Q220 | A — compatible substitutions preserve identity; structural changes produce “Customized from [program].” |
| Q221 | A — explicit, versioned, deterministic, explainable selection rules covered by generated tests. |

**Unnumbered correction sent with this batch:** the explicit **Generate a
custom program** flow must continue to exist.

### Q222–Q230 — four entry jobs and the Custom/manual boundary

| Question | Answer / qualification |
|---|---|
| Q222 | A — one primary Create action containing Recommend and Generate Custom; Browse and Bring/build remain separate. |
| Q223 | A — Custom exposes practical preferences while Taurifer still determines the prescription. |
| Q224 | A — Custom starts from answers; Browse starts from a named Taurifer program. |
| Q225 | A — the existing capable Custom generator remains Free. |
| Q226 | A, with Custom also asking program-specific questions such as split. |
| Q227 | Do not let the user make a known-wrong choice and explain it afterward. Show at most two compatible split choices. |
| Q228 | A — ask split after frequency; show compatible choices and a Taurifer-selected default. |
| Q229 | A — descriptive Custom name while retaining source family/version internally. |
| Q230 | A — preserve compatible answers when switching paths. |

### Q231–Q240 — what Custom generation may ask

| Question | Answer | Canonical outcome |
|---|---|---|
| Q231 | A | Up to two priority muscles in both generators; Custom may expose optional de-emphasize/ignore controls. |
| Q232 | A | Optional must-have/avoid exercise preferences; no long exercise-rating task. |
| Q233 | A | Dislike and pain/discomfort have different semantics even if later combined on one screen. |
| Q234 | A | Do not ask users to program volume, sets per muscle, RIR, rep ranges, or progression methods during Custom onboarding. |
| Q235 | A | Taurifer authors the days; compatible edits may follow generation. |
| Q236 | A | Preview schedule, exercises, estimated duration, priorities, progression approach, and compromises. |
| Q237 | A | Targeted, predictable preference changes rather than random rerolls. |
| Q238 | A | Same answers plus same engine/program versions produce the same result. |
| Q239 | A | Pro deepens Recommend and Custom; it is not a fifth entry path. |
| Q240 | A | Browsed programs get lighter compatibility setup and retain their identity. |

### Q241–Q250 — onboarding length, reuse, and draft safety

| Question | Answer | Canonical outcome |
|---|---|---|
| Q241 | A | Choose the entry path before answering path-specific questions. |
| Q242 | A | Ask only what can materially change the first program; defer safely editable detail. |
| Q243 | A | Recommend groups inputs into roughly five short sections rather than a screen per question or one dense form. |
| Q244 | A | Custom adds compatible split and optional exercise preferences after shared inputs. |
| Q245 | A | Prefill old answers but require review of changing circumstances. |
| Q246 | A | Ask approximate available minutes (30/45/60/75/90+) and preferred rest length. |
| Q247 | A | Start from a training-environment shortcut and allow quick equipment correction. |
| Q248 | A | Manual Build asks name and number of days, then opens empty day containers. |
| Q249 | A | Generation creates a draft; it cannot replace the active program until explicit activation. |
| Q250 | A | Save unfinished onboarding locally and later offer Resume or Start over. |

### Q251–Q260 — meaning of inputs and final Free/Pro history boundary

| Question | Answer | Canonical outcome |
|---|---|---|
| Q251 | A | Ask total time following structured resistance programs in broad ranges, not a self-assigned ability label or strength standard. |
| Q252 | A | Ask recent consistency over roughly six weeks in broad behavioral categories. |
| Q253 | A | Normal volume follows maturity/frequency/session time; recent inconsistency may temporarily reduce only the first one or two re-entry weeks. |
| Q254 | A | Experienced returners retain goal-appropriate complexity and receive a temporary re-entry treatment rather than automatic Foundation placement. |
| Q255 | A, later clarified | Free may use simple history facts for safe execution/prefill; Pro interprets recurring evidence to make program-level decisions. |
| Q256 | A | Optional maximum of two strength-movement priorities; no preference is valid. |
| Q257 | A | Overall goal governs the program; muscle priorities adjust compatible assistance work. |
| Q258 | B, clarified | Use one exercise-avoidance screen, then capture the reason per exercise: dislike, pain/discomfort, equipment, or other. UI is combined; safety semantics remain separate. |
| Q259 | A | Save reusable context locally and snapshot the selected answers/rule versions into each draft. |
| Q260 | A | Preference changes affect future programs unless explicitly applied to the active program. |

### Q261–Q271 — asked but not answered

| Question | Status |
|---|---|
| Q261 — what defines a program family | Pending |
| Q262 — whether Foundation is separated from goal-based programs | Pending |
| Q263 — initial public family set and naming | Pending |
| Q264 — whether Volume remains a family | Pending |
| Q265 — required schedule variants | Pending |
| Q266 — treatment of two- and six-day users | Pending |
| Q267 — relationship among frequency variants | Pending |
| Q268 — equipment variants versus substitutions | Pending |
| Q269 — Browse-card information | Pending |
| Q270 — active-program behavior when a family is updated | Pending |
| Q271 — whether unfinished catalogue work is shown | Pending |

## Canonical decisions reached across the session

The ledger above preserves sequence. This section is the consolidated product
position that implementation and the strategic-document rewrite must express.

### 1. Product scope and customer

- Taurifer is a progression-first hypertrophy and general-strength product.
  It may use squat, bench press, and deadlift within Strength, but it makes no
  powerlifting, peaking, tapering, meet-preparation, or attempt-selection claim.
- Generator-first acquisition is primary. The primary initial customer is a
  self-directed intermediate who wants Taurifer to create and adapt a coherent
  program. Ambitious beginners and advanced external-program users remain
  supported.
- Brazil and PT-BR are the initial learning/pricing beachhead. PT-BR is
  first-class authored copy, not a literal after-the-fact translation.
- The sharper commercial promise is: Free gives and progresses a good program;
  Pro notices when that program no longer fits, explains why, and reshapes what
  happens during or after it.
- A genuinely useful Free program is not intentionally damaged to create Pro
  demand.

### 2. Entry architecture and authorship boundary

The entry model contains four distinct jobs, but not four equally prominent
buttons:

1. **Create a Taurifer program** — primary group:
   - **Recommend a program:** Taurifer makes the important choices.
   - **Generate a custom program:** the user makes bounded program-specific
     choices; Taurifer still writes the executable prescription.
2. **Browse Taurifer programs:** the user deliberately selects a Taurifer-
   authored program and receives only compatibility adaptation.
3. **Bring or build my own:**
   - **Build a program:** start with named empty days; the user writes the
     prescription.
   - **Import a program:** use an externally authored prescription.

The authorship test is decisive: if answering preferences is enough for a
complete executable program to exist, Taurifer authored it. Choosing a split
does not make a program manual. Manual authorship begins when the user selects
the actual days, exercises, ordering, sets, targets, and declared progression
rules.

All paths converge on the same downstream editor and execution engine. Editing
does not erase provenance. Compatible substitutions preserve identity;
structural changes produce **Customized from [program]**.

The current shipped first-run flow is known to conflate these concepts:
“Create a program / Build your training from scratch” actually launches the
generator, while manual construction is reachable only by editing the generated
result. The redesign must separate them.

### 3. Onboarding and generation

- The existing labels “Build muscle,” “Build muscle and strength,” and “Build
  consistency” mix goals with current behavioral state and must be replaced.
- Desired result is one of: prioritize muscle growth; balance muscle and
  strength; prioritize strength. Consistency is a separate current-state input.
- Structured-program experience and recent consistency are separate. Use broad,
  behaviorally meaningful categories rather than self-assigned beginner/
  intermediate/advanced labels or strength standards.
- Experienced returners keep goal-appropriate exercise/progression complexity.
  A temporary re-entry treatment does not erase training maturity.
- Normal initial volume depends on maturity, training frequency, and available
  session time. Do not ask users to estimate volume tolerance. A recent break
  may temporarily reduce only the first one or two weeks.
- Muscle priorities redistribute that available work; they do not create an
  independent volume budget. When everything cannot fit, preserve the highest-
  priority work, reduce lower-priority direct work, and explain the compromise.
- Ask approximate available minutes and preferred rest length. Time estimation
  accounts for working sets, rest, warm-ups, exercise transitions, and a buffer;
  more available time is a ceiling, not a quota.
- Learn actual rest behavior for duration estimates without silently changing
  the user’s timer preference.
- Recommend asks only inputs that materially alter the program. Custom adds
  program-specific choices such as split and optional exercise preferences.
- After frequency is known, show at most two compatible split choices. Prevent
  a known-invalid choice instead of explaining the error after selection.
- Basic muscle emphasis allows up to two primary priorities. Custom may expose
  maintenance, de-emphasize, and ignore. Ignore removes direct specialization
  work, not unavoidable indirect compound involvement, and is distinct from a
  pain constraint.
- Use one exercise-avoidance screen, then retain the reason: dislike,
  pain/discomfort, equipment, or other. Pain follows a conservative safety
  path; dislike only affects selection.
- Custom does not ask the lifter to select volume tolerance, sets per muscle,
  RIR targets, rep ranges, or a progression algorithm. Taurifer remains
  responsible for programming.
- Generation is deterministic and versioned. The same answers under the same
  engine, exercise catalogue, and program versions produce the same result.
- A program preview is a draft. It does not replace or archive the active
  program until explicit activation. Incomplete onboarding may be resumed or
  restarted.
- Saved context may prefill later setup, but changing goals, availability,
  equipment, consistency, and constraints must be reviewed. Drafts snapshot
  their inputs and rule versions so old output remains explainable.

### 4. Taurifer-owned programs and shared engine

- Taurifer does not copy named Boostcamp, Reddit, book, forum, or coach
  programs. A named external program requires explicit permission or a
  compatible licence. Otherwise Taurifer owns the blueprint, identity, copy,
  and progression semantics.
- Program-family design and progression-engine evolution remain separate work
  streams. Families declare needs; they do not receive bespoke engines.
- Blueprints, program instances, blocks, slots, prescriptions, and changes are
  versioned. The engine never branches on `programId`.
- Capacity is shared performance evidence and an anchor, not the universal
  prescription formula.
- Shared strategies include range progression, rep-goal progression, anchor
  plus back-off, paired heavy/volume exposures, block-profile modifiers, and
  manual progression. RIR/RPE is an effort observation, not a standalone
  progression engine.
- A strategy may be used only where its declared capabilities fit the exercise
  and prescription. Incompatible requests receive a plain explanation and a
  compatible or manual alternative.
- Supported progression mathematics and basic manual parameters remain Free.
  Pro pays for intelligent strategy selection, history interpretation, and
  adaptation—not access to mathematics.
- Every program offered to the unpredictable alpha population needs realistic
  schedule coverage. The owner explicitly requires three- and five-day
  versions of the relevant families. The broader proposed rule that every
  public family also requires a four-day version remains pending at Q265.
- Recommend and Custom must preserve the existing simple generator’s schedule
  coverage, including its two- and six-day cases. Whether every named public
  family also needs those variants is the separate pending Q266 decision.
- The earlier Base 3 / Strength 3 / Balanced 4 / Hypertrophy 4 / Volume 6 list
  is a working historical direction, not final public catalogue policy. Public
  family purpose, naming, Volume, two-/six-day handling, and update semantics
  remain open in Q261–Q271.
- Do not advertise program designs as “unvalidated.” The product may be
  transparently labeled an evolving alpha without attaching a misleading
  quality badge to each program.
- A fixed six-week lifecycle may provide checkpoints, but it may not force a
  scheduled deload. Q105’s later rule controls: deload requires actual
  performance stagnation or degradation plus relevant corroboration.
- Commercial incentives never influence deterministic training conclusions.
  Subscription state, creator economics, marketplace incentives, and Taurifer’s
  own revenue interest remain outside program selection and progression logic.

### 5. Intervention policy

- Sequence: observe; interpret through the declared strategy; detect a pattern;
  ask why; propose the smallest cause-matched change; obtain approval; version
  it; reassess the effect.
- There is no universal plateau escalation ladder. Load granularity is rarely
  the primary problem and is only one conditional explanation. Normally change
  one main variable so the result is interpretable.
- Mandatory initial patterns are repeated exercise skipping, exercise plateau,
  recurring recommendation override, recurring session overrun, persistent
  schedule mismatch/missed sessions, and unfinished-program transition.
- Cluster signals that plausibly represent the same problem. For example,
  repeated late-session skipping and repeated session overrun normally produce
  one diagnosis flow rather than two unrelated alerts.
- Repeated skipping is two skips within the last three eligible exposures.
  Missed workouts, early endings, substitutions, equipment problems, and
  explicit skips remain distinguishable.
- Plateau detection is specific to the declared strategy and comparable,
  adherent exposures. No load increase alone is not a plateau.
- A whole-program deload may be proposed only when performance stagnation or
  degradation exists, corroborated by relevant fatigue/recovery evidence. A
  single stalled exercise, life disruption, schedule problem, or vague fatigue
  does not justify a deload.
- Taurifer does not diagnose injury. Pain/discomfort opens an immediate Free
  stop-or-substitute path.
- Interventions appear after a workout or at a defined checkpoint, except the
  immediate pain path. Users may accept, modify, snooze, dismiss, or ignore
  eligible advice; dismissal creates a cooldown rather than permanent silence
  when evidence materially worsens.
- Changes apply to the program instance, never the immutable source blueprint.

### 6. Program completion, interruption, and ownership

- Incomplete programs are valuable evidence rather than failed data. At any
  transition, Taurifer considers resume, repair, rebase, or switch. It creates a
  replacement only when switching is justified.
- Preserve completion, skips, substitutions, recommendation acceptance/
  overrides, performance trends with confidence, schedule/session friction,
  structured exit reasons, optional context, and current goals/constraints.
- Exit reasons include schedule, session length, recovery, difficulty,
  intensity, exercise problems, exercise affinity/dislike, motivation,
  pain/discomfort, equipment, goal change, and external interruption.
- Distinguish observed facts, user-reported reasons, and Taurifer inference.
  Partial history is usable, but confidence must be visible.
- The active program and training record remain the athlete’s. A generated
  program stays editable and executable after cancellation; accepted changes
  are never clawed back.

### 7. Free and Pro boundary

Free includes:

- a capable baseline Recommend and Custom generator;
- available Taurifer-owned programs;
- build/import/BYOP;
- all supported progression strategies and basic parameters;
- full execution and ordinary exercise-level progression;
- manual edits, compatible substitutions, repeats, and another basic program;
- safety paths;
- factual retrospective and useful broad next direction;
- owned/exportable records.

Pro MVP contains three complete jobs:

1. advanced first-program generation;
2. history-aware next-program generation, including partial/unfinished history;
3. bounded, approved within-program adaptation.

The history boundary is:

> **Free uses history to execute the current program safely. Pro uses history
> to make program-level decisions.**

Free may prefill recent consistency, detect an obvious long break, run normal
set progression, show prior performance, and provide a factual retrospective.
Pro connects recurring skips, stalls, overrides, overruns, adherence, schedule,
and reviews; asks a targeted cause question; selects or repairs a program;
proposes bounded changes; and checks whether an accepted intervention worked.
Safety facts and basic continuation are never paywalled.

Pro deepens Recommend and Custom; it is not another top-level entry path. It
must deliver immediate advanced specialization, recurring during-program value,
and useful end/interruption transitions rather than relying on a once-per-block
generation event.

Full cross-program dashboards, explicit multi-block planning, long-horizon
stagnation analysis, optional sync, and history-grounded AI are later layers,
not prerequisites hidden inside the first Pro MVP.

### 8. Commercialization and entitlement

- No fake doors, no feature-looking affordance for nonexistent capability, and
  no in-product concept-preview demand testing. Future demand research uses
  interviews and clearly external prototypes.
- The noncommercial alpha has no payment, paywall, public commercial promise,
  or stable entitlement contract.
- Paid testing begins only when the real Pro MVP works.
- Initial pricing is R$24.90/month and R$179.90/year. Do not run three annual
  price variants in the small beta.
- Production entitlement requires term, expiry, restoration, refund handling,
  and purchase reconciliation. A timeless device boolean/manual code is not a
  commercial entitlement.
- Cancellation stops future Pro decisions; it never removes an existing
  program, record, or accepted change.

### 9. Alpha design and founder reality

- The alpha is noncommercial and rolls in organically one person at a time.
  Recruitment is performed personally by the solo founder and through social
  posts. Eight to twelve participants is a useful milestone, not a synchronized
  cohort or launch gate.
- Taurifer cannot assume it may select or balance participants. Eligible users
  self-select among suitable Recommend, Custom, or Taurifer-program options.
  There is no random assignment, program quota, or controlled cohort. Churn is
  expected and itself produces transition evidence.
- Every participant receives normal product onboarding and the same random-ID
  model. There is no research-only onboarding, hidden research code, or special
  participant experience.
- Each participant has their own approximately six-week clock. Evaluate a
  hypothesis when its relevant denominator exists rather than waiting for a
  cohort-wide calendar date.
- Internally review the underlying program designs, rules, and representative
  synthetic outputs before alpha. Do not inspect, approve, badge, or repair each
  participant’s generated program.
- The solo founder handles support, incidents, and customer service as they
  arise. Do not turn founder staffing into artificial product-design choices.
- Pre-alpha requires reviewed program/rule designs, strict generated tests,
  coherent representative synthetic programs, reliable logging, reliable
  backup/recovery, and no serious known defect.
- Useful evidence milestones include: six people attempting real workouts for
  gym-floor usability; four with at least six workouts for progression
  behavior; and every completion, interruption, abandonment, and transition
  for lifecycle evidence.
- End alpha when the relevant evidence exists, serious reliability defects are
  resolved, and remaining uncertainty belongs to Pro beta—not because a date or
  enrollment target arrived.
- Version the app, engine, program family, and rules so staggered participants
  can be analyzed correctly.

### 10. Generated and model-based testing

- The parallel fast-check framework must generate plausible onboarding
  answers, programs, and histories and simulate the complete lifecycle:
  onboarding, generation, workouts, progression, skips, stalls, overrides,
  interruptions, abandonment, and transition.
- Contradictions, impossible values, invalid state transitions, data loss, and
  broken product promises are hard failures.
- Retain the random seed, minimize the failing case, and save it as a permanent
  regression.
- Run permanent regressions and a small generated set on every relevant change;
  broader campaigns on engine PRs; large campaigns overnight; and the full gate
  plus replay of every historical failure before alpha/release. Expand the
  relevant suite for high-risk changes.
- Generated tests establish consistency and catch contradictions. They do not
  prove human efficacy.
- Human judgment occurs during development when reviewing program designs,
  rules, representative outputs, and debatable programming cases—not through
  individual participant audits.
- The dedicated testing proposal owns implementation detail. Product and launch
  documents reference its gates.

### 11. PostHog, identifiers, and research data

- The PostHog implementation must be top-notch before recruitment and must be
  further developed/audited where necessary.
- Schema-defined events are the measurement source of truth. Full PostHog
  capability is authorized only after masking and leakage controls make it
  impossible to reconstruct the local workout database or expose setup
  fragments, full URLs, inputs, notes, names, values, console content,
  uncontrolled `$` properties, or network bodies.
- Describe analytics as pseudonymous. Provide plain-language disclosure and a
  working off switch.
- Every installation receives the same random identifier process, including
  research participants. The identifier survives ordinary updates/local data
  changes, resets on full-data reset, and is never included in workout backup.
  Settings may expose it voluntarily as a Support ID.
- Attribute acquisition only through allowlisted campaign/source values; store
  the recognized source, never the full URL.
- Maintain three connected funnels:
  1. acquisition/setup: visit → onboarding → generation → activation;
  2. training adoption: first → second → sixth workout and later retention;
  3. program relationship: sustained use → completion/interruption/abandonment
     → transition.
- Use appropriate windows: short setup, roughly six-week adoption, and a
  program-relative transition window. Distinguish explicit abandonment from
  14- and 30-day inactivity.
- Retention milestones include first, second, and sixth workout, 30-day
  activity, and transition. Break down evidence by source, program family,
  frequency, maturity, and app/engine/program versions.
- Offline events queue locally with original timestamps and deduplication,
  flush when online, and are deleted from the pending queue when the user opts
  out.
- Keep one versioned event catalogue and one allowlisting tracking wrapper.
  Tests cover event ordering, duplication, and forbidden properties.
- Required dashboards before recruitment cover funnels, workout retention,
  abandonment/inactivity, acquisition, program/version breakdowns, and
  analytics health. Freeze metric definitions before recruitment and version
  later changes.
- Monitor missing events, invalid properties, impossible ordering, and sudden
  capture-volume shifts. Broken measurement blocks product conclusions, not
  workouts.
- Small-alpha analytics are descriptive and interpreted with interviews and
  support context, not as market estimates.
- Onboarding events may record safe closed-category step outcomes, never raw
  text or enough detail to reconstruct the program.
- Session replay/autocapture must mask all inputs, text, URLs, network bodies,
  setup fragments, notes, training values, and console content.
- Optional free text is stored locally unless the user explicitly submits it
  for research. A central submission uses a purpose-specific non-PostHog
  endpoint, explicit per-submission consent, deletion within 90 days, and only
  retained coded themes. It may never independently trigger an automated
  intervention.

### 12. Strategic metrics

- Speed and reliability are guardrails; losing a workout is unacceptable.
- Progression trust and understanding are the primary product mechanism.
- Stopping spreadsheet consultation is the behavioral switching proof.
- Repeated planned-workout completion is the lagging retention outcome.
- Funnel analysis must separate signup/setup loss, activation, training
  adoption, interruption, abandonment, and transition so a failed commercial
  test is not misdiagnosed as a programming or UX failure.

### 13. Data ownership, distribution, and platform

- Local-first remains constitutional. Core training must work without a
  Taurifer server; the record remains owned, locally available, and exportable.
- “Local-first” does not prohibit narrowly scoped infrastructure for approved
  Phase 1 evidence, payment, entitlement, attribution, or explicitly consented
  feedback. It prohibits turning the cloud copy into the condition for core
  training ownership or execution.
- Optional future sync is additive. A user who declines it retains a complete
  usable product and export path.
- Creators remain acquisition infrastructure rather than Taurifer’s primary
  customer. Creator attribution is provenance, never a signal that steers the
  deterministic engine. A received creator program remains executable without
  a second consumer paywall.
- AI, if introduced later, is subordinate to the deterministic engine and must
  be grounded in owned history and declared rules. It cannot replace or obscure
  those rules.
- Native remains evidence-gated and follows **wrap, not rewrite**: preserve the
  deterministic core and add a native shell/boundary only when distribution or
  platform evidence justifies it.
- Gyms and partner-specific product surfaces remain exploratory. Do not build a
  major gym product without paid-pilot evidence.

## Supersession index

| Earlier position | Final position |
|---|---|
| BYOP-oriented first customer/cohort | Generator-first acquisition; organically recruited Recommend/Custom/Taurifer-program alpha; BYOP secondary |
| Withhold all users until Pro | Noncommercial alpha before Pro; payment waits for working Pro |
| Powerlifting in initial scope | Hypertrophy and general strength only; no powerlifting claim |
| One universal double-progression equation | Capacity as evidence plus explicit shared strategies |
| Copied/named classic templates | Original Taurifer-owned, versioned program families |
| Family-specific progression systems | One declarative shared engine, no program-ID branches |
| Fake-door/payment-intent test first | No fake doors; interviews/external prototypes; payment only for working Pro |
| Annual-only/three-price experiment | R$24.90 monthly and R$179.90 annual fixed pair |
| Pro as advanced controls | Three complete jobs: advanced first program, history-aware next program, bounded adaptation |
| Completed block required for history | Partial and unfinished history accepted with confidence |
| Ordered plateau escalation ladder | Case-by-case cause routing; granularity is conditional and rarely primary |
| General fatigue/life disruption can justify deload | Deload requires performance stagnation/degradation plus relevant corroboration |
| Fixed lifecycle implies an automatic scheduled deload | Lifecycle may schedule review/checkpoints; it cannot schedule a deload without Q105 evidence |
| Free text as ordinary telemetry | Separate, explicitly consented, purpose-specific feedback submission |
| In-product concept previews allowed | Q59B: interviews and external prototypes only |
| Assisted alpha with individual human program review | Autonomous participant generation from internally reviewed designs/rules; no individual audit |
| Curated/synchronized cohort | Rolling organic recruitment, self-selection, staggered clocks, expected churn |
| Special research onboarding/identifier | Normal product onboarding and random installation identifier for everyone |
| Ask volume tolerance | Never ask it; infer cautiously from actual evidence later |
| Goal directly selects Base/Balanced/Strength | Separate desired result, experience, consistency, and constraints; explicit deterministic recommendation rules |
| “Create from scratch” opens the generator | Separate Recommend, Generate Custom, Browse, Build, and Import jobs |
| Custom and manual distinguished by number of choices | Distinguished by authorship of the initial executable prescription |
| Generated preview replaces current program | Draft only until explicit activation |
| Pain and dislike must be separate screens | One combined avoid screen, but reason-specific semantics and safety handling remain separate |
| Free/Pro history boundary was vague | Free uses history for safe current-program execution; Pro makes program-level decisions |

## Required document reconciliation

The following repository documents are materially obsolete relative to this
register and require a coordinated rewrite rather than piecemeal edits:

- [`business-product-thesis.md`](business-product-thesis.md)
- [`pro-backlog.md`](pro-backlog.md)
- [`adr/0010-product-business-thesis-and-validation-sequencing.md`](adr/0010-product-business-thesis-and-validation-sequencing.md)
- [`../plans/044-posthog-measurement-experiments-paywall.md`](../plans/044-posthog-measurement-experiments-paywall.md)

At minimum, that rewrite must remove individual participant program review,
fixed-cohort assumptions, in-product future-capability previews, BYOP-first
language, obsolete family/frequency claims, the current goal-to-family mapping,
and any PostHog/free-text wording that conflicts with the rules above. It must
add the four-job entry design, the Free/Pro history boundary, organic rolling
alpha, normal participant onboarding, fast-check lifecycle gate, session-time
model, and current analytics requirements.

## Open decisions

- Q261–Q271: public program-family definition, Foundation placement, family
  naming, Volume, exact schedule-variant rule, two-/six-day handling, variant
  relationship, equipment adaptation, Browse-card content, updates, and
  unfinished catalogue visibility.
- Exact public/PT-BR copy remains a dedicated copy-design pass.
- Detailed intervention cause-to-action rules remain to be specified and
  tested; the policy constraints above are fixed.
- The existing product documents must be reconciled in one coherent change so
  no older section silently remains executable guidance.
