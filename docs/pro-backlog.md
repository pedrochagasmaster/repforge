# Taurifer Pro — capability backlog and maturity roadmap

**Status:** Living product document (owner decisions, 2026-08 strategy
sessions).
**Governed by:** [`docs/business-product-thesis.md`](business-product-thesis.md)
(§8 Free/Pro constitution, §18.2 monetization tiers, §22 validation
backlog) and
[ADR 0010](adr/0010-product-business-thesis-and-validation-sequencing.md).
On any conflict, the thesis and ADR win.
**Implements next:** [`plans/044-posthog-measurement-experiments-paywall.md`](../plans/044-posthog-measurement-experiments-paywall.md)
(Layer 0 below).

This document exhaustively maps the Pro capability territory and — more
importantly — distinguishes four very different states of maturity. The
categories of things that belong to Pro are fairly settled; the exact
feature set is not, and this document is deliberate about not pretending
otherwise. The immediate P0 paywall/capability work (plan 044), later real
Pro functionality, and production billing (Phase 2 commercial
infrastructure, thesis §18.2) are three separate things and must not be
conflated.

The conceptual dividing line, settled and constitutional (thesis §8.3):

> **Free can build you a good program. Pro can build a program around you
> and what Taurifer has learned about your training.**

## Constitutional guardrails (apply to every item below)

- **No clawbacks** (planks 14–15): nothing currently shipped free ever
  moves behind a capability check. The launched Free floor includes a
  capable baseline generator (plank 16).
- **No artificial scarcity** (thesis §7.3): no generation quotas, no
  deliberately degraded free output. The boundary is capability-based.
- **Analytical independence** (planks 12–13): no Pro capability, paywall,
  or upsell may alter, reorder, reword, or sit inside/above the
  deterministic engine's outputs. Pro monetizes capabilities around the
  engine, never control over its conclusions.
- **Launch clock** (§8.0): everything sold before commercial launch is an
  explicit pilot/early-access offer with mutable packaging.
- **Data**: core training stays serverless; the record stays owned and
  exportable; sync is optional; analytics never reconstructs the workout
  database (planks 25–30).

---

## 1. Pro capabilities already mapped

These are part of the current Pro thesis: legitimate paid territory by
owner decision, even though most are not yet specified deeply enough to
build.

| Pro area | Mapped capabilities |
|---|---|
| Advanced program generation | Muscle priorities, detailed exercise preferences, volume tolerance/preferences, sophisticated movement constraints |
| Advanced program structure | Advanced split controls, periodization controls, specialization blocks, detailed volume allocation |
| History-informed programming | Generate programs using prior training history; use previous blocks to determine what should change |
| Next-block intelligence | Automatic next-block generation, previous-block-informed adjustments |
| Multi-block planning | Plan beyond a single block / mesocycle |
| Cross-program analysis | Compare exercises/performance across different programs |
| Long-horizon intelligence | Multi-block trends, long-term capacity/performance trends, recurring stagnation detection |
| Cross-device continuity | Optional synchronization |
| Higher-order AI | Future AI analysis grounded in the athlete's actual longitudinal history |

Being *mapped* means: it may appear in Pro marketing framing, paywall
benefit copy, and demand tests. It does **not** mean it has a build
specification, a scheduled slot, or even a defined product surface. The
sections below assign each capability its actual state.

---

## 2. Backlogged now — P0 Pro infrastructure and demand testing

These have a known *when* (now) and a written plan
([plan 044](../plans/044-posthog-measurement-experiments-paywall.md)).
They make the Pro product **testable**; they deliberately build almost no
Pro intelligence.

### Capability/entitlement abstraction

Billing-agnostic capability checks so product code asks conceptually:

```javascript
hasCapability("advanced_generation")
hasCapability("muscle_priorities")
hasCapability("cross_program_analysis")
```

Never coupled to StoreKit, Google Play, or any billing vendor. Entitlement
is device-local (`repforge_pro_v1`), excluded from export/import and setup
links. This is infrastructure, but it is necessary to make Pro testable.

### Experimental Pro paywall

- explicit pilot/early-access framing (launch clock);
- price assignment via a PostHog experiment: R$149.90 / R$179.90 /
  R$199.90 annual;
- paywall-trigger attribution (which capability opened it);
- CTA measurement (view → intent conversion);
- generated-vs-BYO cohort comparison;
- fake-door intent first, real payment evidence quickly after (plan 044
  Step 8, owner-gated).

### Advanced-generator demand surfaces

One or more locked affordances, e.g. a "Muscle priorities · Pro" or
"Advanced options · Pro" row on the generator's review step. These are
initially **demand tests, not completed Pro functionality** — that is
deliberate. The question they answer:

> Do users care enough about this capability to hit the paywall?

before anyone spends serious build effort on the underlying optimizer.
Thesis §22 P0-C explicitly authorizes measuring demand ahead of the build.
The baseline generator remains genuinely capable and uninterrupted.

---

## 3. Backlogged after initial validation

Substantial real Pro features whose *when* is known ("after the Layer 0
demand data"), but which should not start before it.

### Advanced generator — the likely first real Pro product capability

If the paywall tests validate demand, this ships first. Potential first
package:

- muscle-group priorities;
- preferred/disliked exercises;
- volume preferences;
- more detailed movement constraints;
- perhaps split preferences.

This is conceptually close enough that a build specification could be
written soon after demand data arrives. See §8 for the recommended
concrete v1.

### Cross-program / multi-block intelligence

Already placed later in the roadmap (thesis §18.4, Phase 3). Example
product moments:

- **Compare blocks** — "Chest pressing capacity +8% across the last three
  blocks."
- **Exercise continuity** — "Incline dumbbell press has progressed across
  three programs despite being programmed differently."
- **Stagnation** — "Your lateral-raise performance has been essentially
  unchanged across the last two blocks."
- **Program comparison** — "Your previous Upper/Lower block produced
  better lower-body progression than the current one."

Strategically important because it is where Pro starts deriving value from
the history Taurifer accumulates, rather than merely unlocking controls —
the defensibility thesis (§17.3) runs through here.

### History-informed generation

Eventually: *"Build my next program using what happened in my previous
block."* A much stronger Pro proposition than "answer seven more
questions" — but it necessarily comes later because it needs actual user
history to exist.

### Automatic next-block generation

Likewise: *"Here's what the last block suggests changing, and here's the
proposed next one."* Belongs after the program-lifecycle work (thesis §22
P1-E: complete/archive → next program with history preserved) and after
enough real block-completion data exists to inform it.

---

## 4. Strategically mapped, but not backlogged

Legitimate Pro territory that should **not** enter an engineering queue
yet. Each is a category, not a product specification; each needs
product/science design before engineering.

### Advanced periodization

"Can be Pro" is decided; what it means in Taurifer is not. Could mean any
of: block length, RIR progression, rep-range progression, volume
progression, deload scheduling, intensity emphasis, phase sequencing.
Unscheduled until it is a spec rather than a word.

### Specialization blocks

Conceptually: *"Prioritize delts and arms for the next 8 weeks while
maintaining everything else."* Good Pro territory — but there is currently
no defined Taurifer specialization model (volume shifting, maintenance
floors, interaction with the capacity engine). Unscheduled.

### Detailed volume allocation

Conceptually Pro, but undefined whether users would manipulate
sets/muscle/week, direct vs indirect volume, exercise-level volume,
frequency, volume landmarks, or recovery constraints. Needs product and
science design first. Unscheduled.

### Multi-block planning

Something like *"plan the next 3 blocks"* belongs in Pro, but the right
interface is unknown: explicit macrocycle planning, a recommended
sequence, recurring automatic generation, or a lightweight "what comes
next" model. Remains unscheduled until Layer 2 evidence suggests a shape.

---

## 5. Still substantially undefined — strategic territories, not features

### Long-horizon intelligence

We know we want it; the product surface is undecided. Possibilities: a
dedicated Training Career screen; Pro cards within Progress;
block-comparison reports; proactive insights; a query interface; periodic
summaries. The data/model concepts exist (capacity, blocks, baselines);
the UX does not. Do not build from the phrase.

### Stagnation detection

"Recurring stagnation detection" sounds good in a thesis. Before
engineering it, define: what counts as stagnation; exercise continuity
across substitutions; the required observation period; how adherence
affects interpretation; confidence; whether a plateau is necessarily bad;
and when Taurifer should surface it. This could easily become
pseudo-scientific if poorly defined. It must not be built from the phrase
alone.

### History-grounded AI

Intentionally vague for now. Plausible questions: *"Why has my bench
stalled?" "Compare my last three blocks." "What should I emphasize
next?"* The AI product should only be designed after Taurifer has useful
longitudinal deterministic data to ground it in. **The old BYOK Coach
design (plan 038, ADR 0002) is not the roadmap for this** — it remains a
brainstorming artifact (see `CONTEXT.md` status labels and ADR 0010).
Constitution plank 11 stands: AI is subordinate to the deterministic
product.

### Sync

The business boundary is decided: optional cross-device sync can be Pro,
core training stays serverless, and basic device-level backup/recovery
leans free (thesis §8, §15.3). Undefined: identity/account model,
encryption architecture, conflict resolution, device semantics, storage
backend, recovery, sharing, and whether web/native sync semantics differ.
Definitively not Phase 1 (ADR 0010 platform planks).

---

## 6. The Pro maturity model — four layers

The useful way to think about the Pro roadmap.

### Layer 0 — test whether Pro exists *(now — plan 044)*

- capability abstraction;
- paywall;
- price experiments;
- advanced-feature fake doors;
- purchase intent, then real payment evidence.

No need to build much Pro intelligence yet.

### Layer 1 — immediate Pro value *(first actual paid product)*

Most likely: **advanced program generation**. Gives Pro value to someone
on day 1, solving the structural problem that longitudinal intelligence
cannot be valuable to a brand-new user. Likely first capabilities: muscle
priorities, exercise preferences, volume preferences, richer constraints.

### Layer 2 — accumulated-history Pro value *(once users have history)*

- cross-program analysis;
- block comparisons;
- long-term progression;
- stagnation/pattern detection;
- history-informed generation.

Potentially much more defensible than Layer 1 (thesis §17.3).

### Layer 3 — training-career intelligence *(later; the aspirational Pro product)*

- automatic next-block generation;
- multi-block planning;
- sophisticated periodization;
- higher-order AI;
- optional sync.

Progression between layers is evidence-gated, not calendar-gated: Layer 1
starts when Layer 0 demand data supports it; Layer 2 when real users have
real multi-block history; Layer 3 when Layer 2 has proven that history
intelligence retains and renews.

**Production billing is none of these layers.** StoreKit / Play Billing,
subscription lifecycle, receipt validation, and cross-device entitlement
are Phase 2 commercial infrastructure (thesis §18.2, ADR 0010), triggered
by the platform evidence gates — not by Pro feature maturity.

---

## 7. The one important unresolved product decision

The biggest open question is not *what category of things belong to Pro* —
that is fairly settled. It is:

> **Exactly where does Free generation stop and Pro generation start?**

The poles are known.

**Free definitely gets:** goal; experience; days/week; duration;
equipment; sensible basic exclusions; good exercise selection; a complete
executable program.

**Pro can contain:** muscle priorities; detailed preferences; volume
customization; sophisticated constraints; periodization; history-informed
behavior.

The boundary between those two has **not** been empirically located — and
that is intentional (thesis §8.4, Appendix D #1). The Layer 0 paywall
experiment exists to locate it: which locked capabilities actually pull
users to the paywall, at which price, in which cohort. Do not resolve this
boundary by intuition or by committee; resolve it with the experiment.

---

## 8. Recommended first actual Pro feature set — Pro Generator v1 (owner recommendation)

If the demand data supports it, make Pro Generator v1 very concrete:

**Free**

> Goal + experience + schedule + duration + equipment → good Taurifer
> program.

**Pro** — everything above, plus:

- Prioritize muscles
- Prefer/avoid exercises
- Tune training volume
- Additional movement constraints
- More control over program structure

**Stop there initially.** Do not build periodization, multi-block
planning, AI, sync, or sophisticated history-informed generation in v1.
This gives Taurifer a credible paid product without pretending we already
know what the mature Taurifer Pro should become.

---

## Status summary

| Capability | State | Gate to advance |
|---|---|---|
| Capability abstraction | **Backlogged now** (plan 044) | — |
| Experimental paywall + price experiment | **Backlogged now** (plan 044) | — |
| Advanced-generator demand surfaces (fake doors) | **Backlogged now** (plan 044) | — |
| Real-payment pilot (web checkout + manual codes) | Backlogged now, owner-gated (plan 044 Step 8) | Owner go |
| Advanced generator (Pro Generator v1, §8) | Backlogged after validation | Layer 0 demand data |
| Cross-program / multi-block intelligence | Backlogged after validation | Real multi-block user history |
| History-informed generation | Backlogged after validation | Real user history + lifecycle work (P1-E) |
| Automatic next-block generation | Backlogged after validation | Lifecycle work + block-completion data |
| Advanced periodization | Mapped, not backlogged | Product/science spec |
| Specialization blocks | Mapped, not backlogged | Specialization model design |
| Detailed volume allocation | Mapped, not backlogged | Product/science spec |
| Multi-block planning | Mapped, not backlogged | Layer 2 evidence suggests interface |
| Long-horizon intelligence surface | Undefined territory | UX design from real data |
| Stagnation detection | Undefined territory | Rigorous definition first |
| History-grounded AI | Undefined territory | Useful longitudinal deterministic data |
| Cross-device sync | Undefined territory (business boundary settled) | Phase 2 + architecture design |
| Production billing (StoreKit / Play Billing / lifecycle) | Not a Pro feature — Phase 2 infrastructure | Platform evidence gates (ADR 0010) |
