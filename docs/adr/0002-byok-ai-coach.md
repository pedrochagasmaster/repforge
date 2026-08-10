# BYOK AI coach supersedes the "no AI coach" rejection

The improvement-plan guardrails (`plans/README.md`) rejected "AI coaching
chat, auto-generated programs" by persona consensus, largely because the
imagined shapes betrayed local-first: a cloud coach, accounts, a backend.
The product owner has decided (2026-08) to ship an AI coach in a shape
that preserves what the rejection was protecting.

Decision: an opt-in, **bring-your-own-key** LLM coach. The browser calls
the user's chosen provider directly (OpenAI-compatible `fetch`, presets
OpenRouter / Anthropic / local Ollama / custom base URL). RepForge runs no
backend, holds no credentials server-side, and sends nothing anywhere for
users who never enable the feature. A local Ollama endpoint keeps even
coach traffic on-device. Model choice per hosted preset is product-owned
(a pinned constant), not a user setting.

The coach can chat and can emit **structured program-change proposals**
(fenced JSON, strictly validated client-side) that the user applies with
an explicit tap — mirroring the existing "generated program the user can
edit before saving" pattern. Proposals may touch the program only, never
the log. Coach config and chat live in a separate `repforge_coach_v1`
localStorage key so no key material can leak into backups or exports.

We rejected: hosting any proxy or relay (a backend re-enters the product),
ChatGPT-subscription piggybacking via the unofficial Codex OAuth surface
(CORS-blocked from browsers, vendor-killable, ToS-gray), OpenAI-direct as
a preset (its API rejects browser-origin CORS), and SDK dependencies (the
repo has no build step; raw `fetch` + SSE suffices).

Unchanged guardrails: no accounts, no cloud sync, no RepForge-operated
backend, no sixth nav tab, Log-tab speed protected, no gamification.
Amended guardrail: "no AI chat coach" becomes "no AI coach that requires a
RepForge backend or ships on by default" — see plan 038 for the
implementing spec.
