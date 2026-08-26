# Taurifer product-grilling decision register

**Status:** Owner decision record through August 26, 2026

**Answered coverage:** Q1–Q602, subject to the transcript notes below

**Pending:** No product-level branch remained when the owner closed the session
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
- The later interview continued after PR #188. Some assistant prompt wording
  between Q261 and Q556 is likewise unavailable in the retained compacted
  transcript. This update preserves every retained numbered answer, correction,
  qualification, and accepted recommendation, and records the resulting
  decisions in the canonical sections. It does not invent missing option text.
- Q271, Q314, Q362, Q371, and Q373 have no separate literal answer in the
  retained answer trace. Later answers resolved the branches they belonged to;
  the ledger marks that explicitly instead of manufacturing a selection.
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
| Q35 — initial library | Deferred to the parallel template-system plan | Resolved at Q261–Q281: original Taurifer families under the settled family/frequency/Home/Foundation policy, not a copied-classics catalogue. |
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
| Q202 | No individual letter retained; included in the adversarially reviewed UX approval. |
| Q203 | No individual letter retained; included in the adversarially reviewed UX approval. |
| Q204 | No individual letter retained; included in the adversarially reviewed UX approval. |
| Q205 | No individual letter retained; included in the adversarially reviewed UX approval. |
| Q206 | No individual letter retained; included in the adversarially reviewed UX approval. |
| Q207 | No individual letter retained; included in the adversarially reviewed UX approval. |
| Q208 | No individual letter retained; included in the adversarially reviewed UX approval. |
| Q209 | No individual letter retained; included in the adversarially reviewed UX approval. |
| Q210 | No individual letter retained; included in the adversarially reviewed UX approval. |
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

### Q261–Q281 — public program families

| Question | Owner answer / retained qualification | Canonical outcome |
|---|---|---|
| Q261 — what defines a program family | A | A family is a durable training promise and programming structure, not a marketing label for every small variation. |
| Q262 — Foundation placement | C | Foundation is a simple-start/re-entry profile used by recommendation logic, not a peer goal that confuses hypertrophy and strength choices. |
| Q263 — initial public family set and naming | A | Use a small Taurifer-owned public set; public copy is authored around the job and structure rather than borrowed program names. |
| Q264 — Volume family | A | Volume may exist as a distinct later family when it has a distinct training promise; it is not required for the first alpha set. |
| Q265 — required frequency coverage | A | Public recommendations must cover realistic schedules; three- and five-day forms are mandatory for the principal families. |
| Q266 — two- and six-day users | C | Recommend/Custom preserve two- and six-day coverage through generated schedule variants without requiring every public Browse family to expose both. |
| Q267 — relationship among frequency variants | B | Frequency variants are sibling blueprints in one family, sharing intent and evidence but owning their actual weekly structure. |
| Q268 — equipment variants | B | Equipment fit is compiled as a variant/substitution layer rather than multiplying public family identities. |
| Q269 — Browse-card information | A | Cards show the facts needed to choose: purpose, frequency, session-time range, experience fit, equipment assumptions, structure, and progression style. |
| Q270 — family updates | B | An activated program remains pinned to its blueprint/version; updates are offered, never silently applied. |
| Q271 — unfinished catalogue visibility | No separate literal answer retained | The later catalogue rule controls: show only executable, tested programs; do not use disabled cards or future-feature placeholders. |
| Q272 | B | Accepted as part of the family/catalogue branch; the resulting executable-only catalogue rule is authoritative. |
| Q273 | B | Accepted as part of program selection and ownership; see §§4 and 14. |
| Q274 | B | Accepted as part of program selection and ownership; see §§4 and 14. |
| Q275 | B | Accepted as part of program selection and ownership; see §§4 and 14. |
| Q276 | C | Accepted as part of program selection and ownership; see §§4 and 14. |
| Q277 | A | A selected program is instantiated as the athlete's editable program. |
| Q278 | C, qualified | Once selected, the program genuinely belongs to the user: it may be renamed or edited, and the shared engine continues to work with any supported progression strategy. |
| Q279 | B | Preserve source/family/version provenance without restricting ownership. |
| Q280 | B | Family identity is retained only while structurally meaningful; substantial edits become a customized descendant. |
| Q281 | A after discussion | Home is a separate consistency-first family for limited home equipment. A full home gym uses the ordinary Recommend/Browse families. |

### Q282–Q310 — equipment contexts, sibling programs, and substitutions

| Question | Owner answer / retained qualification | Canonical outcome |
|---|---|---|
| Q282 | A | Accepted; Home remains a real family rather than a generic equipment filter. |
| Q283 | B | Accepted; Home optimizes for the lowest-friction consistency path. |
| Q284 | C | Accepted; fully equipped home gyms use normal program families. |
| Q285 | A | Equipment context is reusable and user-managed. |
| Q286 | B | Program equipment adaptation is explicit rather than silently inferred. |
| Q287 | A, expanded | Support two or three gyms with similar but non-identical setups through user-curated sibling versions of the active program and an explicit location choice. |
| Q288 | A | Each gym/equipment context keeps its own applicable exercise mapping. |
| Q289 | A | Equivalent free-weight movements may share identity/history across gyms. |
| Q290 | C | Machine identity may remain separate when equipment mechanics make loads non-comparable. |
| Q291 | B | A Technogym and Cybex incline converging press may be sibling exercise instances, not one interchangeable load history. |
| Q292 | C | Cross-gym comparison follows declared movement/equipment equivalence rather than name matching. |
| Q293 | A | The user chooses the current gym/context before beginning the session. |
| Q294 | B | Exercise alternatives are contextual choices, not automatic permanent rewrites. |
| Q295 | A, expanded | Same-session substitutions are valuable in crowded gyms and remain available without changing the source blueprint. |
| Q296 | B, qualified | The proposed edge case was intentionally left out of v1 scope. |
| Q297 | B | Accepted as part of contextual substitution behavior. |
| Q298 | C | Accepted as part of contextual substitution behavior. |
| Q299 | A | Preserve distinct performance history when two implementations are not mechanically comparable. |
| Q300 | A | Share history only across explicitly equivalent movement/equipment identities. |
| Q301 | B | Accepted as part of sibling-context curation. |
| Q302 | Explicitly rejected as too-specific edge work | Do not add bespoke product behavior for the hypothetical edge case. |
| Q303 | A | Sibling program changes remain explicit and reviewable. |
| Q304 | A | Accepted as part of the gym-context lifecycle. |
| Q305 | A | Accepted as part of the gym-context lifecycle. |
| Q306 | B | Accepted as part of the gym-context lifecycle. |
| Q307 | A | Accepted as part of the gym-context lifecycle. |
| Q308 | C | Accepted as part of the gym-context lifecycle. |
| Q309 | Recommended option accepted | Final behavior is consolidated in §14. |
| Q310 | Recommended option accepted | Final behavior is consolidated in §14. |

### Q311–Q332 — program-week invariants and one-off-session boundary

| Question | Owner answer / retained qualification | Canonical outcome |
|---|---|---|
| Q311 | B, clarified | Every programmed week in the initial fixed-week design is structurally the same; progression changes targets, not the weekly exercise schedule. |
| Q312 | B | Accepted as part of the fixed-week program model. |
| Q313 | Direct answer: keep six as the default | Six weeks remains the default block length, without forcing a scheduled deload. |
| Q314 | No separate literal answer retained | Later answers preserve fixed-week structure and evidence-triggered deloads. |
| Q315 | C | Accepted as part of block lifecycle behavior. |
| Q316 | A | Accepted as part of block lifecycle behavior. |
| Q317 | A | Accepted as part of program lifecycle behavior. |
| Q318 | A | Accepted as part of program lifecycle behavior. |
| Q319 | A | Accepted as part of program lifecycle behavior. |
| Q320 | C | Accepted as part of program lifecycle behavior. |
| Q321 | A | Accepted as part of program lifecycle behavior. |
| Q322 | A | Accepted as part of program lifecycle behavior. |
| Q323 | B | Accepted as part of the one-off-session Free/Pro boundary. |
| Q324 | C, qualified | Use active design: show a Pro recommendation where justified and always provide an override. |
| Q325 | A | Accepted as part of one-off-session generation. |
| Q326 | A | Accepted as part of one-off-session generation. |
| Q327 | A | Accepted as part of one-off-session generation. |
| Q328 | A | Accepted as part of one-off-session ownership/history. |
| Q329 | A | Accepted as part of one-off-session ownership/history. |
| Q330 | A and C both initially judged valid | The final hybrid was resolved through the later adversarial Free/Pro review; see §15. |
| Q331 | A | Accepted after narrowing the hybrid. |
| Q332 | Alternative D was explored and adversarially reviewed | Final one-off Free/Pro boundary is recorded in §15 and the dedicated one-off-session spec. |

### Q333–Q396 — one-off-session UX, alpha fit, and research operation

The retained transcript preserves the selections and qualifications below but
not every option sentence. Canonical product meaning is consolidated in §§9,
10, 15, and 16 rather than reconstructed from missing prompt text.

| Question | Owner answer / retained qualification |
|---|---|
| Q333 | B |
| Q334 | A |
| Q335 | Recommended option accepted |
| Q336 | Recommended option accepted |
| Q337 | Recommended option accepted |
| Q338 | A — generative/model-based testing was implemented to exercise long journeys and search for bugs |
| Q339 | A |
| Q340 | B |
| Q341 | A |
| Q342 | B — owner corrected a duplicate “340b” to Q342 |
| Q343 | Recommended option accepted |
| Q344 | Recommended option accepted |
| Q345 | Recommended option accepted |
| Q346 | Recommended option accepted |
| Q347 | B |
| Q348 | C |
| Q349 | A |
| Q350 | Recommended option accepted |
| Q351 | Recommended option accepted |
| Q352 | Answered through the supplied one-off-session mockups; see the dedicated spec and §15 |
| Q353 | A |
| Q354 | A |
| Q355 | B |
| Q356 | A |
| Q357 | A |
| Q358 | A |
| Q359 | Scenario judged very improbable; no bespoke v1 behavior authorized |
| Q360 | B |
| Q361 | A |
| Q362 | No separate literal answer retained; later one-off decisions govern |
| Q363 | C — corrected from an initial B |
| Q364 | A |
| Q365 | B |
| Q366 | B |
| Q367 | A |
| Q368 | A |
| Q369 | A, with reminder that the complete Pro bundle is larger than the abbreviated list presented |
| Q370 | Final choice B with a touch of C, followed by a deliberately bold C interpretation |
| Q371 | No separate literal number retained; the “be bold” resolution controls the experiment posture |
| Q372 | Users start Free; a user who reaches a real paywall and demonstrates purchase intent may receive complementary access for research |
| Q373 | No separate literal answer retained; complementary-access rules were later completed at Q577 |
| Q374 | Recommended option accepted |
| Q375 | C |
| Q376 | A |
| Q377 | B |
| Q378 | B |
| Q379 | A |
| Q380 | A |
| Q381 | A |
| Q382 | B |
| Q383 | A |
| Q384 | A |
| Q385 | A |
| Q386 | B |
| Q387 | A |
| Q388 | A |
| Q389 | B |
| Q390 | B |
| Q391 | A |
| Q392 | Recommended option accepted |
| Q393 | Recommended option accepted |
| Q394 | Recommended option accepted |
| Q395 | Recommended option accepted |
| Q396 | Recommended option accepted |

### Q397–Q463 — editor authority, release sequencing, privacy, and evaluation

| Question | Owner answer / retained qualification |
|---|---|
| Q397 | A |
| Q398 | D |
| Q399 | A |
| Q400 | A |
| Q401 | A |
| Q402 | A |
| Q403 | A |
| Q404 | A |
| Q405 | B — program creation exposes only progression systems Taurifer supports; unsupported strategies cannot be selected inside the app |
| Q406 | B |
| Q407 | C |
| Q408 | B |
| Q409 | A |
| Q410 | B |
| Q411 | Recommended option accepted |
| Q412 | Recommended option accepted |
| Q413 | Recommended option accepted |
| Q414 | Recommended option accepted |
| Q415 | Recommended option accepted |
| Q416 | Recommended option accepted |
| Q417 | Recommended option accepted |
| Q418 | Recommended option accepted |
| Q419 | Recommended option accepted |
| Q420 | Recommended option accepted |
| Q421 | Recommended option accepted |
| Q422 | A |
| Q423 | B |
| Q424 | C |
| Q425 | A |
| Q426 | A |
| Q427 | A |
| Q428 | Trigger the deferred expansion only after the paid beta proves Taurifer's economics |
| Q429 | B |
| Q430 | A |
| Q431 | C |
| Q432 | B |
| Q433 | Already decided earlier; no new branch created |
| Q434 | A |
| Q435 | A |
| Q436 | A |
| Q437 | A |
| Q438 | C |
| Q439 | B |
| Q440 | A |
| Q441 | A |
| Q442 | A |
| Q443 | A and B both apply |
| Q444 | B |
| Q445 | C |
| Q446 | C |
| Q447 | A |
| Q448 | B |
| Q449 | A |
| Q450 | B |
| Q451 | A |
| Q452 | A |
| Q453 | A |
| Q454 | A |
| Q455 | B |
| Q456 | C |
| Q457 | B |
| Q458 | C |
| Q459 | A |
| Q460 | C |
| Q461 | A |
| Q462 | C |
| Q463 | C |

### Q464–Q508 — managed Taurifer AI product boundary

| Question | Answer | Canonical outcome |
|---|---|---|
| Q464 — improvement-data constitution | A | A separate explicit improvement opt-in may copy redacted conversations into a dedicated research system; raw research copies live at most twelve months, deletion propagates, and anonymous derivatives/model improvements may persist. No transcripts enter PostHog. |
| Q465 — provider model | A | Taurifer AI is a managed service. This supersedes BYOK as the intended product direction. |
| Q466 — evidence shown to users | B | Show the conversation and a compact inspectable evidence summary, not a raw history dump. |
| Q467 — proposal authority | C | AI may propose any edit the Taurifer editor supports, but the user explicitly approves every change. |
| Q468 — sequencing | After paid beta | Build the managed AI layer only after the deterministic paid beta proves Taurifer's economics. |
| Q469 — human review | A | Permit limited, logged human review of purpose-shared, redacted cases for evaluation/support. |
| Q470 — sharing controls | A | Provide global improvement control plus the later reconciled conversation inventory and one-time sharing controls. |
| Q471 — account boundary | A | Account is required only for paid cloud capabilities; Free/core remains local and accountless. |
| Q472 — sensitive conversations | C | Sensitive conversations require contextual extra permission before research sharing. |
| Q473 — proposal scrutiny | C | Apply scrutiny according to consequence/risk rather than one uniform confirmation burden. |
| Q474 — proposal timing | C | Timing depends on the type of change and the evidence window it needs. |
| Q475 — review sampling | B | Review reported/poorly rated cases plus a small random sample. |
| Q476 — proposal presentation | B | Use a structured proposal, not prose-only advice or invisible mutation. |
| Q477 — major changes | B | Consequential structural changes require a second explicit confirmation. |
| Q478 — deterministic rules | A | AI cannot apply a change that violates Taurifer's hard rules; the user may still make a manual supported edit where permitted. |
| Q479 — proactive AI | B | Surface only at checkpoints or when strong evidence indicates a problem; never interrupt an active workout. |
| Q480 — rollback | A | Accepted AI changes create versioned program changes that can be rolled back; workout history is never rewritten. |
| Q481 — sensitive sharing UX | B | Use a nonblocking contextual sharing card rather than coercive consent. |
| Q482 — cloud scope | A | Account stores identity, subscription, AI conversations, and preferences; workout history remains local, and only request-relevant context is sent. |
| Q483 — evidence baseline | C | Current program is primary; family/version and prior versions remain available when relevant. |
| Q484 — proposal grouping | B | Group related edits into one coherent decision rather than many atomic approvals. |
| Q485 — local evidence links | B | Each material claim links the exact local evidence supporting it. |
| Q486 — uncertainty | C | State uncertainty and ask one focused question when it could change the decision. |
| Q487 — answer order | B | Lead with conclusion, main reason, warning, and proposed differences; deeper detail is expandable. |
| Q488 — editing a proposal | A | Users may edit the proposal inline and then ask Taurifer to recheck it. |
| Q489 — AI telemetry | C | PostHog receives text-free events such as shown/opened/accepted/rejected/edited/reverted/outcome; never conversation or proposal text. |
| Q490 — grouped decisions | C | Track independent and linked proposal groups distinctly. |
| Q491 — drafts | B | Unaccepted AI drafts remain local. |
| Q492 — audit trail | A | Program versions carry change records independently of conversation retention. |
| Q493 — outcome window | C | Evidence/reassessment window depends on the change type. |
| Q494 — outcome evaluation | A | Combine observed training metrics with a short user review. |
| Q495 — pain | A | Pain opens a Free conservative safety path; AI does not diagnose. |
| Q496 — analytics when sharing is off | A | Text-free product analytics may continue under analytics settings; detailed case use requires improvement consent. |
| Q497 — account deletion | A | Delete cloud identity/AI data while leaving the local training record intact. |
| Q498 — stale proposals | A | Freeze and mark proposals outdated when their evidence/program version is stale. |
| Q499 — concurrent proposals | A | Allow only one active program-level proposal at a time. |
| Q500 — follow-up | A | Follow-up recommends retain, revise, reverse, or gather more evidence; the user approves any action. |
| Q501 — aggregate learning | C | Aggregate outcomes create human-reviewed research candidates; they never silently rewrite shared rules. |
| Q502 — entry points | B | Place AI contextually in Program, Progress, and intervention surfaces; no permanent Chat tab. |
| Q503 — primary UX | B | Structured proposal is primary; conversation supports it rather than replacing it. |
| Q504 — allowed questions | B | Answer questions grounded in the user's program/history plus general hypertrophy/strength education; exclude medical, injury, and nutrition coaching. |
| Q505 — knowledge system | B | Use an approved, sourced, versioned knowledge base. |
| Q506 — offline/outage | A | Core and deterministic features continue; never silently queue sensitive AI context for later sending. |
| Q507 — change management | A | Version model, prompt, knowledge, and rules; evaluate, stage, monitor, and roll back changes. |
| Q508 — outside authority | A | Decline requests outside Taurifer's authority and redirect to safer product actions or appropriate professionals. |

### Q509–Q542 — provider, pricing, evaluation, accounts, and research separation

| Question | Answer | Canonical outcome |
|---|---|---|
| Q509 — provider selection | C | Run a bake-off on Taurifer-specific cases; do not choose from reputation or price alone. |
| Q510 — provider retention | A | Zero provider retention is a launch gate. |
| Q511 — model routing | A | Route by risk/complexity through product-owned models; users do not choose models. |
| Q512 — allowance | A | Publish a visible monthly allowance. |
| Q513 — provider disclosure | A | Disclose provider, processing location, and retention in settings/privacy; provider is not the product headline. |
| Q514 — age | A | Taurifer AI is adult-only. |
| Q515 — bake-off order | A | Safety/correctness are hard gates before quality, latency, and cost optimization. |
| Q516 — evaluation cases | C | Use staged generated cases, founder cases, and explicitly consented real cases. |
| Q517 — judging | A | Combine deterministic checks, blind founder review, and a separate judge model; investigate disagreement. |
| Q518 — provider fallback | B | Maintain a validated backup provider; switch manually and version the change. |
| Q519 — packaging | A | AI is included in the existing Pro subscription once stable, not sold as a separate add-on. |
| Q520 — allowance classes | B | Separate ordinary questions from consequential program reviews. |
| Q521 — limit reached | A | Pause AI at the limit, warn beforehand, and keep deterministic Taurifer working; no top-ups initially. |
| Q522 — provider changes | A | Notify users of provider changes and require renewed acceptance if privacy materially changes. |
| Q523 — adult gate | B | Use a simple 18+ attestation; do not collect date of birth. |
| Q524 — release | A | Require the complete release-gate set rather than a partial quality sign-off. |
| Q525 — preview | A | Begin with a small opt-in group of adult PT-BR Pro users. |
| Q526 — shutdown | A | Start with an emergency global AI off switch. |
| Q527 — knowledge entries | A | Knowledge entries are versioned and sourced. |
| Q528 — regression set | A | Keep protected holdout cases and continually add newly generated cases. |
| Q529 — conversation retention | B | Cloud AI conversation history has a rolling twelve-month limit. |
| Q530 — sign-in | A | Use email one-time code/link sign-in. |
| Q531 — lapse with pending work | B | Pending proposals remain reviewable/applicable after subscription expiry; no new AI generation or revision. |
| Q532 — data region | C | Store Taurifer account/conversation/research data in the EU; prefer EU inference, but allow a US provider only if it wins evaluation and contractual/retention/disclosure safeguards are satisfied. |
| Q533 — research separation | A, later strengthened by Q537 | A single service may be used only with real separation, not one boolean column. |
| Q534 — deletion | A | Delete live cloud data promptly and expire backups within at most thirty days. |
| Q535 — legal review | A | Obtain Brazilian privacy-counsel review before Preview. |
| Q536 — export | A | Export conversations, proposals, and decision history; exclude hidden prompts, security controls, and internal metadata. |
| Q537 — concrete separation | A | Separate account/conversation/research schemas or tables, credentials, access paths, and deletion jobs; research receives only consented redacted copies. |
| Q538 — redaction timing | A | Redact before writing to research storage. |
| Q539 — support access | A | Raw support access occurs only when the user explicitly shares it and is temporary and logged. |
| Q540 — retrospective sharing | B | Global opt-in governs future sharing; a selective retrospective screen may share chosen past conversations. |
| Q541 — research identity | A | Use a pseudonymous research subject ID with a separate deletion mapping; do not claim anonymity. |
| Q542 — analytics join | A | Never join research records to PostHog at person level. |

### Q543–Q561 — scientific claims, knowledge maintenance, and language release

| Question | Answer | Canonical outcome |
|---|---|---|
| Q543 — first use of improvement data | A | Use it for evaluation cases, prompts, knowledge/rules, and regressions—not model fine-tuning initially. |
| Q544 — provider comparison with real cases | A | Consented real cases may evaluate several disclosed providers only under no-retention/no-training and transfer safeguards. |
| Q545 — uncertain redaction | A | Do not copy a case when redaction is uncertain; offer the user optional review/redaction. |
| Q546 — improvement control | C, reconciled at Q549 | Prefer one global improvement switch over scattered per-conversation settings. |
| Q547 — deleting a shared conversation | A | Delete both service and research copies; local program change history remains. |
| Q548 — consent timing | B | Explain required processing at setup; invite optional improvement sharing only after the first successful answer. |
| Q549 — shared-conversation inventory | A | Keep one global switch plus a secondary Shared conversations page listing title/date/status/sensitive permission/expiry/delete, without exposing internal redacted research records. |
| Q550 — product name | A | Call the capability **Taurifer AI**. |
| Q551 — marketing | A | Lead with concrete outcomes and capabilities, never “AI personal trainer.” |
| Q552 — scientific authority | A and C | Use peer-reviewed primary studies plus high-quality reviews, consensus, and position documents; community/coaching material is not scientific authority. |
| Q553 — disagreement | A | Explain the disagreement, Taurifer's assumption, what depends on it, and where user preference legitimately resolves the choice. |
| Q554 — Preview exit | A | Graduate only after predeclared safety/privacy/program, quality, latency, cost, outcome, and support gates; define numeric thresholds before Preview. |
| Q555 — claims | A and B, resolved by Q557 | Personalization may be described factually, but no superior-outcome claim is permitted without evidence. |
| Q556 — voice | A | Be concise, analytical, and direct; distinguish facts, reports, and inferences; no motivational speeches or fake feelings. |
| Q557 — “personalized” claim | A | “Personalized” is allowed because history and constraints are used; effectiveness claims require outcome evidence. |
| Q558 — citations | A | Keep answers concise with expandable scientific/internal-rule evidence and exact local workout links. |
| Q559 — new evidence | A | Review new studies in the broader evidence base, then version and test any knowledge change; never chase one study. |
| Q560 — language order | B | Launch the AI Preview in PT-BR first; deterministic English remains available, and English AI waits for independent evaluation. |
| Q561 — source titles | A | Explain in PT-BR while showing the original English source title/link; never imply an official translation. |

### Q562–Q582 — conversation memory, feedback, and Preview operation

| Question | Answer | Canonical outcome |
|---|---|---|
| Q562 — conversation structure | B | Use separate task/proposal conversations; carry confirmed facts and accepted decisions, not one endless transcript. |
| Q563 — cross-conversation memory | B | Use current thread plus structured confirmed preferences/decisions; old chat affects work only when deliberately reopened. |
| Q564 — memory inspection | A | Provide a page where remembered items can be inspected, corrected, or deleted. |
| Q565 — ordinary feedback | B | Quick rating, closed reasons, and optional explicitly shared comment; written feedback never enters PostHog. |
| Q566 — serious report | A | Provide Report a problem with reason and optional temporary conversation sharing to support. |
| Q567 — maturity label | A | Label the capability Preview and explain once that it may be wrong and never changes a program without approval. |
| Q568 — English UI | A | Hide AI actions in English until English evaluation passes; Pro copy states the PT-BR limitation truthfully. |
| Q569 — creating memory | B | Offer to remember likely stable preferences and require confirmation; accepted program changes are separately recorded. |
| Q570 — memory duration | B | Distinguish lasting preferences from temporary context with visible expiry. |
| Q571 — conflicting memory | B | Ask whether the new statement is temporary or replaces the lasting preference when the distinction matters. |
| Q572 — conversation discovery | B | Keep conversations in context plus a secondary AI history page; no permanent Chat tab. |
| Q573 — one-time feedback sharing | B | A user may share one answer/comment without changing the global improvement setting. |
| Q574 — support retention | A | Keep a reported conversation until closure, delete within thirty days after closure, and cap total retention at 180 days. |
| Q575 — Preview enrollment | B | Eligible adult PT-BR Pro users self-select in controlled waves; pause enrollment at support/evaluation capacity. |
| Q576 — full wave | A | Offer an honest free waiting list with no promised date and notify when a wave opens. |
| Q577 — complementary access | B | For demonstrated purchase intent, grant access through the current program's next major decision, capped at twelve weeks. |
| Q578 — research burden | A | Normal product/onboarding plus brief optional checkpoint feedback and an optional closing interview. |
| Q579 — report status | A | Show Received, Investigating, or Closed, with optional email/in-app response. |
| Q580 — independent language graduation | A | PT-BR may become stable before English AI; English earns release separately. |
| Q581 — stable rollout | A | Expand PT-BR progressively while monitoring safety, cost, latency, and support; retain emergency shutdown. |
| Q582 — Pro entitlement during limited Preview | A | Preview is not part of the generally available paid entitlement; the purchase page sells only working Pro features and describes AI separately. |

### Q583–Q602 — lapse behavior, presentation, controls, and allowances

| Question | Answer | Canonical outcome |
|---|---|---|
| Q583 — access after lapse | A | Reading/export/deletion and memory management remain available; new questions and proposals stop. |
| Q584 — Preview around the paywall | A | Treat AI as a separate research Preview joined after purchase or verified purchase intent, not a Pro selling point. |
| Q585 — commercial measurement | A | Report purchases, attempts, complementary access, and Preview participation separately; only payment counts as conversion/revenue. |
| Q586 — discovery | A | Introduce AI at a real problem/checkpoint and on Pro information, not initial onboarding or a permanent Today card. |
| Q587 — persona | A | No human name, face, or fictional coaching relationship; Taurifer AI is a capability. |
| Q588 — conversation start | A | Offer contextual suggested actions plus free text. |
| Q589 — push notifications | B | In-app by default; optional push only for major checkpoints or a proposal awaiting review. |
| Q590 — master switch | A | A master switch stops new AI processing and hides AI actions while preserving read/export/delete controls. |
| Q591 — labeling | A | Explicitly distinguish AI-generated output from deterministic progression. |
| Q592 — outage fallback | A | Explain AI unavailability and separately offer an applicable deterministic alternative; never silently substitute. |
| Q593 — push privacy | A | Generic lock-screen copy by default; detailed notifications require explicit enablement. |
| Q594 — reminder frequency | A | At most one push per unresolved event; repeat only after material state change; provide category controls. |
| Q595 — allowance visibility | A | Show remaining ordinary/review allowances in AI history/settings and warn when low, not before every request. |
| Q596 — PT-BR boundary | A | Support Portuguese plus normal English exercise terms; full English requests are asked to continue in Portuguese. |
| Q597 — usage unit | A | Count one completed task; necessary clarification and reasonable revision are included. A review counts when delivered. |
| Q598 — unsuccessful requests | A | Technical failure, safety refusal, or unsupported request does not consume allowance; repeated misuse is rate-limited separately. |
| Q599 — rollover | B | Ordinary questions reset monthly; unused program reviews accrue only to a small published cap. |
| Q600 — Preview limits | A | Use intended commercial limits during Preview; restore uses consumed unfairly by bugs/research requests. |
| Q601 — turning AI off | A | Stop new processing/prompts/notifications; retain but do not proactively surface history, memory, and proposals. Deletion is separate. |
| Q602 — setting exact limits | A | Before Preview, derive published limits from measured cost and representative journeys; changes apply prospectively with notice. |

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
- Every principal public family needs genuine three- and five-day sibling
  blueprints. Recommend and Custom also preserve two- and six-day schedule
  coverage through generated variants; that does not force every Browse family
  to expose every frequency.
- Family siblings share purpose, evidence model, and progression vocabulary but
  own their weekly structure. They are not one schedule mechanically stretched
  across frequencies.
- **Home** is a separate limited-equipment, consistency-first family. A person
  with a full home gym uses the ordinary families. **Foundation** is an internal
  simple-start/re-entry profile, not a public goal beside hypertrophy and
  strength. A later high-volume family is valid only when it provides a truly
  different training promise and is not an alpha prerequisite.
- Browse exposes only complete executable programs. Cards communicate purpose,
  frequency, time, maturity fit, equipment assumptions, structure, and
  progression style. An activated instance stays pinned to its version; an
  update is an explicit offered migration, never a silent rewrite.
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
stagnation analysis, optional sync, and managed Taurifer AI after paid-beta
economics are later layers, not prerequisites hidden inside the first Pro MVP.

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
- Managed Taurifer AI is a later Pro capability, sequenced after the paid beta.
  It remains subordinate to the deterministic engine, grounded in owned local
  evidence and declared rules, and visibly identified as AI output.
- Native remains evidence-gated and follows **wrap, not rewrite**: preserve the
  deterministic core and add a native shell/boundary only when distribution or
  platform evidence justifies it.
- Gyms and partner-specific product surfaces remain exploratory. Do not build a
  major gym product without paid-pilot evidence.

### 14. Equipment contexts and sibling program instances

- A user may train the same active program at two or three gyms. They explicitly
  choose the current context and curate sibling program mappings where the
  equipment differs.
- Shared identity is based on real mechanical comparability, not an equal name.
  A barbell movement can normally share history across gyms. Different machine
  models may retain separate histories when the same displayed load does not
  imply comparable effort.
- Same-session substitution is a normal execution tool, including crowded-gym
  use. It may be temporary, mapped to the current gym, or promoted into a
  program change only through explicit user action.
- Equipment contexts and mappings are owned data. Taurifer never silently
  treats two machines as equivalent and never mutates the source blueprint.

### 15. One-off session mode

The dedicated specification is
[`docs/superpowers/specs/2026-08-25-one-off-session-design.md`](superpowers/specs/2026-08-25-one-off-session-design.md).
The governing decisions are:

- Enter from the existing **Choose another day** control below Start session on
  Today. One-off work is a route within that choice, not a new primary tab.
- A one-off session can start from a classic focus, selected muscle groups,
  an empty session, or a constrained recommendation that considers the active
  program, recent work, available time, and current equipment.
- The user chooses available time and equipment/context. A one-off session is
  saved to History and contributes honest performed-work evidence but does not
  silently alter the active program schedule or mark a programmed day complete.
- Free supports useful manual/classic one-offs. Pro may recommend a program-
  aware “best use of today” session and explain its trade-offs; the user can
  always override it. The boundary sells interpretation, not the ability to
  train off-program.
- Proposals must respect recent work, supported exercise/progression rules,
  current constraints, time estimates, and the same safety invariants as a
  normal session. Long generated journeys belong in the fast-check model-based
  suite.

### 16. Managed Taurifer AI

The prior BYOK direction is superseded. The product decision is a managed,
adult-only, PT-BR-first **Taurifer AI** capability after the deterministic paid
beta proves the business. It is not the acquisition headline and is never
marketed as an “AI personal trainer.”

#### Product role

- AI lives contextually in Program, Progress, reviews, and intervention flows;
  it has no permanent Chat tab, human avatar, fictional name, or coaching
  relationship.
- Structured, evidence-linked proposals are primary. Conversation explains,
  asks a focused question, and helps revise a proposal. The user approves every
  mutation; major structural changes require a second confirmation.
- AI may propose any edit the supported Taurifer editor can express, but hard
  deterministic rules still constrain application. AI never changes workout
  history, diagnoses injury, provides nutrition/medical coaching, or invents an
  unsupported progression system.
- AI is visibly labeled and never silently substituted for deterministic
  output. During outage, core Taurifer continues and may offer a separately
  labeled deterministic alternative.

#### Evidence, memory, and control

- Only context necessary for the request leaves the device. Account identity,
  subscription, conversations, preferences, and proposals may be cloud-backed;
  the workout record remains local.
- Claims distinguish observed facts, user reports, and inference. Concise
  answers link exact local evidence and expandable scientific/rule support.
- Separate conversations are tied to tasks or proposals. Confirmed stable
  preferences and accepted decisions carry forward; old raw chats do not
  silently become memory. Temporary context expires, conflicts are resolved
  explicitly, and users can inspect, correct, or delete remembered items.
- A master switch stops new AI processing, prompts, and notifications without
  deleting records. Reading, export, deletion, and memory controls remain
  available after cancellation or complementary access expires.

#### Provider and scientific controls

- Choose primary and backup providers through Taurifer-specific bake-offs.
  Safety/correctness are hard gates before quality, latency, and cost. Provider
  retention must be zero; model/prompt/knowledge/provider versions are staged,
  measured, and reversible.
- Product-owned risk routing chooses models. Users do not choose a provider or
  model. Provider, processing region, and retention are disclosed in settings
  and privacy materials rather than used as marketing.
- Scientific authority is peer-reviewed primary research plus high-quality
  reviews, consensus, and position documents. When evidence disagrees,
  Taurifer explains the disagreement, its assumption, what depends on it, and
  where preference legitimately decides. Knowledge updates consider the wider
  evidence base and pass versioned evaluation.

#### Preview, entitlement, and allowance

- PT-BR Preview enrolls self-selected adult Pro users in controlled waves. It
  is a separate research preview, not part of the generally available Pro
  promise or paid conversion claim. English AI remains hidden until it passes
  independent evaluation.
- A free user who reaches a real paywall and demonstrates purchase intent may
  receive complementary research access through the next major program
  decision, capped at twelve weeks. Purchases, attempts, complementary grants,
  and Preview participation are reported separately; only payment is revenue.
- Ordinary questions and consequential reviews have separate published
  allowances. One completed task includes necessary clarification/reasonable
  revision. Failures and refusals do not consume allowance. Questions reset
  monthly; reviews may accrue only to a small published cap. No top-ups at
  launch.
- Preview uses intended commercial limits. Exact counts are set before Preview
  from measured cost and representative journeys and change only prospectively
  with notice.

### 17. AI privacy, research, support, and release

- Required processing is explained at AI setup. Optional improvement sharing
  is invited only after a successful answer and controlled by one global
  switch, selective one-time sharing, and a Shared conversations inventory.
- PostHog receives text-free lifecycle events only. Conversation, proposal,
  comment, free text, and research data never enter PostHog and are never joined
  to it at person level.
- Research receives only an explicitly consented copy after redaction, into
  separately credentialed schemas/tables/access paths/deletion jobs. If safe
  redaction is uncertain, nothing is copied. A pseudonymous research ID retains
  a separate deletion mapping; do not call it anonymous.
- Service conversations expire on a rolling twelve-month schedule. Research
  raw copies live at most twelve months. Deleting a shared conversation deletes
  both copies; live deletion is prompt and backups expire within thirty days.
  Anonymous aggregate derivatives may remain.
- A serious report shares raw conversation only by explicit user action.
  Access is temporary and logged; status is Received, Investigating, or Closed;
  the report is deleted within thirty days after closure and no later than 180
  days after submission.
- Preview requires Brazilian privacy-counsel review, provider and transfer
  safeguards, predeclared numeric safety/privacy/quality/cost/latency/support
  gates, protected and generated evaluation sets, and an emergency global off
  switch. PT-BR may graduate independently and rolls out progressively.

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
| Public family/frequency policy pending | Principal families require three-/five-day siblings; generated coverage preserves two/six; Home is separate; Foundation is an internal simple-start profile |
| One equipment list per athlete | Reusable gym contexts plus user-curated sibling program mappings and comparability-aware history |
| Off-program training as an unmodeled exception | Explicit one-off sessions with honest history and a Free/manual versus Pro/interpretive boundary |
| BYOK browser coach / provider key in the PWA | Managed Taurifer AI after paid-beta economics, product-owned providers/models, account only for cloud Pro |
| AI as vague distant “history-grounded” layer | Fully bounded contextual proposal/review capability with inspectable evidence, memory controls, evaluation, and Preview gates |
| One endless coach chat | Separate task conversations plus confirmed structured memory and AI history |
| AI transcript as ordinary analytics/research data | Text-free PostHog; separately consented, redacted, purpose-specific research copies with deletion |
| English and PT-BR AI released together | PT-BR Preview and graduation first; English AI earns an independent release |
| AI Preview as a Pro purchase promise | Separate capacity-limited research Preview; paid economics count only working generally available Pro features |

## Required document reconciliation

This PR reconciles the following documents to this register:

- [`business-product-thesis.md`](business-product-thesis.md)
- [`pro-backlog.md`](pro-backlog.md)
- [`adr/0010-product-business-thesis-and-validation-sequencing.md`](adr/0010-product-business-thesis-and-validation-sequencing.md)
- [`../plans/044-posthog-measurement-experiments-paywall.md`](../plans/044-posthog-measurement-experiments-paywall.md)
- [`adr/0002-byok-ai-coach.md`](adr/0002-byok-ai-coach.md), superseded by the
  managed-AI ADR
- [`../plans/038-ai-coach.md`](../plans/038-ai-coach.md), retained only as a
  historical superseded plan

The reconciled sources must express the family/equipment/one-off decisions and
the complete managed-AI constitution above in addition to the earlier entry,
Free/Pro, organic-alpha, fast-check, session-time, and PostHog decisions.

## Implementation work, not unresolved product branches

The owner closed the grilling session after Q602 and confirmed shared
understanding. No product-level branch remains open. Successor specifications
must still derive and verify:

- exact public/PT-BR copy and final family names;
- detailed cause-to-action intervention rules within the fixed policy;
- exact AI numeric quality, safety, cost, latency, support, and allowance
  thresholds before Preview;
- provider selection from the approved evaluation rather than documentation;
- schemas, APIs, redaction implementation, and LGPD transfer documents;
- representative and model-based regression journeys for every new lifecycle.

Those are implementation/evaluation outputs. If they expose a genuine product
trade-off, reopen only that branch and add the resulting owner decision here.
