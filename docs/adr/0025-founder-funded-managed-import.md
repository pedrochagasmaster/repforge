# ADR 0025 — Founder-funded managed free-text import

**Status:** Accepted by owner for deployment on November 9, 2026.
**Scope:** The existing PWA Import route only.
**Supersedes in this scope:** ADR 0014's prohibition on a Taurifer-operated import API and the sequencing restriction in ADR 0011. Neither broader managed Taurifer AI coaching nor the program model is changed.

## Owner decision and reason

The owner authorized retiring the cross-app copy/paste dependency as Taurifer's
primary free-text import path and funding cheap API inference. Independent
program import is an onboarding/acquisition operation, not an AI coach or
general conversational account feature.

Taurifer now offers a managed primary action directly in the existing
Import route. The optional manual ChatGPT/Claude handoff is retained whenever
the service is disabled, blocked, temporarily unavailable, or the lifter
prefers another assistant. File import and Build remain available.

The user explicitly chooses when a pasted program leaves their device.
Taurifer does not send history, biometric data, or the current program unless
the user themselves pasted it as source text.

## Scope and safeguards

- The PWA remains the primary validation product. No native app, account,
  subscription wall, client-managed API key, SDK, or new backend database is
  introduced.
- The production model is `claude-haiku-5-5`, effort `medium`, no agent tools.
  The server-only prompt is generated directly from the existing
  `entry.freeform.prompt` EN/PT catalogs.
- The Cloudflare Worker is isolated from the install-transfer service and
  handles `GET /api/program-import/config` and `POST /api/program-import` on
  `https://taurifer.com`. API credentials are Worker secrets, never browser
  code or exported config.
- An explicit user tap with a fresh Cloudflare Turnstile token is mandatory;
  Siteverify must confirm the `taurifer.com` hostname and `program_import`
  action before a paid request can occur.
- The same Durable Object serially enforces global 200 requests/day, global
  12/minute, per-visitor 4/day and 2/five-minute caps. A private peppered
  hash of the connecting IP is used for counters; the plaintext address and
  program are never written to the object. The budget is reserved before
  inference, even if the provider later fails.
- The server does not retain program text, model prompts/replies, reasoning,
  or exercise names. It returns only the provider's final answer; requests
  and responses use `no-store`.
- Only the existing `parseFreeformProgramReply`, missing-value resolution,
  per-row exercise mapping and explicit program activation can accept the
  result. Model output alone is never committed as training state.
- The Worker has a single deployment-level `MANAGED_IMPORT_ENABLED` kill
  switch and refuses requests when any required binding is unavailable.
  Changes are reversible without altering saved workout data.

## Evidence and risk acceptance

A founder-funded direct-API evaluation used 960 synthetic cases across
four Haiku 5.5 effort levels, with a corrected, reproducible benchmark
(see `docs/evals/2026-11-08-haiku-55-effort-sweep.md` when available).
At `medium` the strict exact success was 213/240 and the synthetic
corpus showed no wrong-but-accepted prescription. This is evidence for
this *initial limited deployment*, not proof of zero production errors.

This narrow release explicitly relaxes ADR 0011's requirement that all
managed AI work wait for proven deterministic Pro economics. It does
**not** imply that the general managed coaching capability or its memory,
accounts, paid entitlement, and cloud history can launch early.

The provider-data privacy line is important: standard Anthropic API
retention is not the same as a separately contracted zero-data-retention
arrangement. Taurifer must disclose provider processing, respect
consented source handling, and must not claim that Anthropic itself
performs zero retention without contract evidence. The first deployment
does not imply privacy/legal review for full managed Taurifer AI has
been satisfied.

The synthetic benchmark's holdout was deliberately exposed in this
effort sweep and must not be reused as a sealed holdout for future prompt
optimization. Real-coach pilot evidence remains necessary before making
claims of universal quality.

## Operational contract

1. Deploy the Worker *disabled* with the secret-bound Anthropic key,
   Turnstile secret, and IP-hash pepper. Confirm the disabled config
   response and no paid requests.
2. Release the PWA code and localize the user disclosure; test complete,
   gapped, unreadable, disabled and rate-limited paths on physical mobile.
3. Enable the Worker with owner approval and confirm the live same-origin
   flow on `taurifer.com`, one test import, and available fallbacks.
4. Kill switch returns an explicit unavailable response; never secretly
   degrade to a paid alternative or fail open. Operator can redeploy
   `MANAGED_IMPORT_ENABLED=false` without touching training history.
5. Restrict telemetry to existing approved categorical/numeric fields.
   The managed route does not have an external app handoff; evaluate the
   managed funnel as `started → parsed → review → activated`, separately
   from the handoff path.

**Public documentation:** https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
**Provider retention:** https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
