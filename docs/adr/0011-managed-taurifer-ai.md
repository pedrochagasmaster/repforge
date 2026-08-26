# Managed Taurifer AI supersedes BYOK

**Status:** Accepted; sequenced after deterministic paid-beta economics

**Date:** August 26, 2026

**Owner source:** Q464–Q602 in the
[`product-grilling decision register`](../product-grilling-decision-register.md)

**Supersedes:** [`ADR 0002`](0002-byok-ai-coach.md) and
[`Plan 038`](../../plans/038-ai-coach.md)

## Context

ADR 0002 authorized a local browser feature in which users supplied provider
keys and Taurifer called OpenRouter, Anthropic, Ollama, or a custom endpoint.
That design minimized Taurifer infrastructure but transferred setup, cost,
provider compatibility, security, and model-quality responsibility to users.
It also assumed local chat storage and a narrow program-only proposal protocol.

The completed product grilling session chose a different product. Taurifer AI
is a managed Pro capability that Taurifer evaluates and operates. It arrives
only after the deterministic paid beta proves the business; it does not pull
accounts, cloud infrastructure, or LLM dependency into Free/core training.

## Decision

### Product and authority

- The capability is called **Taurifer AI**. Marketing describes concrete
  outcomes, not “AI personal trainer.”
- It is adult-only and launches in PT-BR Preview before English. Common English
  exercise terms are accepted; full English service waits for independent
  evaluation.
- AI appears contextually in Program, Progress, reviews, and strong detected
  problems. There is no Chat tab, human avatar, fictional name, or simulated
  relationship.
- Structured program proposals are primary; conversation explains, asks a
  focused question, and supports editing/rechecking. Any editor-supported
  change may be proposed, but hard Taurifer rules constrain application.
- Every mutation is user-approved and versioned. Consequential structural
  change receives a second confirmation. Workout history is immutable; accepted
  changes can be rolled back; stale proposals freeze against their evidence.
- AI does not diagnose injury or provide medical/nutrition coaching. Pain opens
  the Free deterministic safety path.
- AI output is explicitly labeled. Provider failure never silently falls back
  under the same label; an applicable deterministic alternative is separate.

### Context, conversation, and memory

- Core workout history remains local. Only request-relevant context is sent.
  Cloud scope is account identity, subscription, AI conversations, remembered
  preferences, and proposals.
- The current program is primary evidence. Relevant family/version, prior
  versions, and exact local history links may support the answer.
- Answers distinguish observations, user reports, and inference. They lead with
  conclusion, main reason, warning, and proposed difference; scientific and
  Taurifer-rule evidence is expandable.
- Each task/proposal receives its own conversation. A secondary AI history page
  complements contextual access; no endless universal thread exists.
- Taurifer offers to remember stable preferences and requires confirmation.
  Temporary circumstances have visible expiry. Conflicts ask whether the new
  statement is temporary or permanent. Users can inspect, correct, or delete
  remembered items.
- Service conversation history expires on a rolling twelve-month schedule.
  Lapse or master disable stops new processing but preserves reading, export,
  deletion, memory management, and explicit review/application of pending work.

### Providers, knowledge, and evaluations

- Taurifer owns provider/model selection and risk-based routing. Users never
  paste provider keys or choose models.
- A Taurifer-specific bake-off chooses primary and validated backup providers.
  Safety and correctness are hard gates before quality, latency, and cost.
- Provider retention must be zero. No provider training on Taurifer data is
  permitted. Provider, processing region, and retention are disclosed in
  settings/privacy and updated when they change.
- Provider, model, prompt, knowledge, rule, and redaction versions are evaluated,
  staged, monitored, and reversible. Backup-provider switching is manual and
  versioned initially.
- Evaluations use generated cases, founder cases, explicitly consented real
  cases, protected holdouts, deterministic checks, blind founder review, and a
  separate judge model. Disagreement is investigated rather than averaged away.
- Scientific authority is peer-reviewed primary research plus high-quality
  reviews, consensus, and position documents. Community/coaching content is not
  scientific authority. Knowledge changes consider the broader evidence base
  and become versioned regression targets.

### Account, data region, and deletion

- Account is required only for paid cloud features. Email one-time code/link is
  the first sign-in mechanism. Free/core remains accountless and local.
- Taurifer account, conversation, and research storage is EU-hosted. EU
  inference is preferred. A US inference provider is allowed only when it wins
  the bake-off and no-retention/no-training contracts, transfer safeguards, and
  disclosure are complete.
- Live deletion is prompt; backups expire within thirty days. Account deletion
  removes cloud identity/AI data without deleting the local workout record.
- Export includes conversations, proposals, and decision history. Hidden
  prompts, security controls, and internal metadata are excluded.

### Analytics, improvement sharing, and research

- PostHog receives allowlisted text-free lifecycle events only: shown, opened,
  accepted, rejected, edited, reverted, and outcome. It never receives
  conversation, proposal, memory, comment, support, or research text.
- Required request processing is explained at setup. Improvement sharing is a
  separate optional purpose invited only after a successful answer.
- One global improvement switch governs future sharing. Users may also share a
  single answer/comment without changing it and selectively share past
  conversations. A Shared conversations page lists title, date, status,
  sensitive permission, expiry, and deletion; it does not expose internal
  redacted research records.
- Sensitive conversations require contextual extra permission. Redaction
  happens before any research write. If safe redaction is uncertain, nothing is
  copied and the user may optionally review/redact.
- Research uses separate schemas/tables, credentials, access paths, and deletion
  jobs. A pseudonymous research subject ID has a separate deletion mapping;
  research is never joined to PostHog at person level.
- Raw research copies live at most twelve months. Deleting a shared conversation
  removes service and research copies. Anonymous aggregate derivatives, coded
  themes, evaluation cases that contain no personal data, and model improvements
  may persist.
- Initial improvement work targets evaluations, prompts, rules/knowledge, and
  regressions—not fine-tuning.

### Support and feedback

- Ordinary feedback is a quick rating, closed reasons, and an optional comment
  shared for that explicit purpose. Written feedback is not PostHog data.
- **Report a problem** lets the user select a serious issue and optionally share
  the conversation. Raw support access is temporary and logged.
- Report state is Received, Investigating, or Closed. The shared conversation is
  deleted within thirty days after closure and no later than 180 days after
  submission.
- Review sampling prioritizes serious reports/poor ratings plus a small random
  sample of consented cases.

### Preview and commercial boundary

- AI work begins only after the deterministic paid beta proves economics.
- Before Preview: Brazilian privacy-counsel review; provider/transfer contracts;
  zero retention; protected/generated evaluations; numeric safety, privacy,
  program, quality, latency, cost, outcome, and support gates; and an emergency
  global off switch.
- Eligible adult PT-BR Pro users self-select in controlled waves. A full wave
  offers an honest free waiting list with no promised date. Recruitment pauses
  at support/evaluation capacity.
- During Preview, AI is not part of the generally available Pro purchase
  promise. A user who shows genuine purchase intent may receive complementary
  access through the current program's next major decision, capped at twelve
  weeks. Payment, attempts, grants, and Preview use remain separate metrics.
- PT-BR may graduate independently and expand in monitored waves. English AI
  remains hidden until its own evaluation passes.

### Allowances and notifications

- Ordinary questions and consequential program reviews have separate published
  monthly allowances. A completed task includes required clarification and
  reasonable revision; a review counts only when delivered.
- Technical failures, safety refusals, and unsupported requests do not consume
  allowance. Repeated misuse is rate-limited separately.
- Ordinary questions do not roll over. Reviews may accrue only to a small
  published cap. No top-ups exist initially.
- Preview uses intended commercial limits. Exact counts are fixed before
  Preview from measured provider cost and representative journeys; later changes
  apply prospectively with notice.
- Prompts stay in-app by default. Users may opt into push for major checkpoints
  or a waiting proposal. Lock-screen wording is generic by default; one
  unresolved event receives at most one push until state materially changes.

## Consequences

- BYOK, browser-direct providers, custom endpoints, Ollama, user API keys, and
  the local `repforge_coach_v1` product are not authorized implementation paths.
- Managed AI requires an account/cloud boundary, but does not authorize hosted
  workout-history sync or make core training server-dependent.
- Plan 038 is retained as historical design context and marked superseded. A
  new implementation plan must be derived from this ADR only after the paid-
  beta sequencing gate.
- Exact provider, numeric gates, allowances, redaction implementation, and
  transfer documents are measured/specification outputs. They cannot weaken the
  decisions above through implementation accident.
