# Managed program import — deployment and operations

Separate Cloudflare Worker serving `https://taurifer.com/api/program-import`.
Taurifer's PWA is still deployed through its existing Git-connected Cloudflare
Pages project. The Worker owns no UI and no durable workout data. See
[ADR 0025](../../docs/adr/0025-founder-funded-managed-import.md).

## Security model

- API key: `ANTHROPIC_API_KEY` (secret, not source code).
- Turnstile secret: `TURNSTILE_SECRET_KEY` (server-only). The sitekey is
  public and restricted to the `taurifer.com` hostname.
- Hashed visitor counter pepper: `IMPORT_IP_PEPPER`, random secret at least
  24 characters long. Do not rotate during a pilot unless acceptable to reset
  per-IP quotas. Raw IPs are never persisted.
- A global SQLite Durable Object coordinates account-wide request budgets,
  with 200/day, 12/minute, 4/IP/day, 2/IP/five minutes. No source or reply
  text is written to the object or telemetry.
- Any invalid binding, mismatched `Origin`, failed Turnstile verification,
  stale token, failed budget reservation or disabled switch refuses requests
  before Anthropic inference.
- Explicit button action always precedes sending workout text.
- The browser receives only the model reply; it must still pass the existing
  parser, gap completion, per-row mapping and activation.
- The Worker's logs do not contain prompt, source, reply, model reasoning or
  any provider key. Cloudflare/Anthropic service-side retention is governed
  by their own terms; do not claim a contractual zero-retention guarantee.

## Local verification

From the repository root:

```bash
node tools/check-managed-import-prompts.mjs --check
node --test test/program-managed-import-worker.mjs
node tools/run-tests.mjs full-browser --suite program-managed-import
```

From this directory, with Wrangler installed (`npm install`):

```bash
npx wrangler deploy --dry-run --env production
```

The generated `src/prompts.mjs` is an exact copy of the existing EN/PT
`entry.freeform.prompt` string from the repo's i18n JSON. Run the generator
after a change in the prompt and commit both prompt and generation together.
Never assemble a second, unreviewed prompt in Worker code.

## Provisioning

Deploy and provision from the exact merged commit, with an authenticated
Wrangler. **Never** put a credential in the PWA, a repository file, PR
discussion, telemetry, a URL or a CLI argument: pipe each secret on stdin.

```bash
cd services/program-import

# 1. Deploy disabled. The committed configuration keeps MANAGED_IMPORT_ENABLED=false.
npx wrangler deploy --env production

# 2. Bind the three secrets from the operator's private store (stdin only).
printf %s "$ANTHROPIC_API_KEY_VALUE" | npx wrangler secret put ANTHROPIC_API_KEY --env production
printf %s "$TURNSTILE_SECRET_VALUE" | npx wrangler secret put TURNSTILE_SECRET_KEY --env production
openssl rand -hex 32 | npx wrangler secret put IMPORT_IP_PEPPER --env production
npx wrangler secret list --env production   # names only
```

Check the disabled service:

```bash
curl -fsS https://taurifer.com/api/program-import/config
# {"enabled":false,"sitekey":null,"maxChars":12000}
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://taurifer.com/api/program-import \
  -H "Origin: https://taurifer.com" -H "Content-Type: application/json" --data '{}'
# 503
```

## Enable and kill

The repository configuration stays `MANAGED_IMPORT_ENABLED=false`, so any
plain deploy is also the kill switch. Enable only after the PWA release and a
physical-device check, by overriding the one variable at deploy time:

```bash
npx wrangler deploy --env production --var MANAGED_IMPORT_ENABLED:true
curl -fsS https://taurifer.com/api/program-import/config
# enabled=true and the public Turnstile sitekey
```

To disable immediately, deploy without the override:

```bash
npx wrangler deploy --env production
curl -fsS https://taurifer.com/api/program-import/config   # enabled=false
```

Removing the provider key also fails closed at once
(`npx wrangler secret delete ANTHROPIC_API_KEY --env production`). The PWA
then hides Import with Taurifer and keeps the manual hand-off. An existing
import candidate stays safe to review and activate offline; disabling the
Worker never alters workouts in local storage.

## Operational limits

- The backend emits no per-user model text; privacy-safe aggregated request
  counts and provider billing must be monitored in Cloudflare/Anthropic.
- **No retry loop** or provider fallback for end-user requests. A failed
  attempt consumes its quota reservation to prevent accidental cost surges.
- The user can continue via the existing copy/paste assistant handoff when
  direct import is unavailable, rate-limited or declined.
- A completed model response is a *candidate*, never an executable workout
  until every row has been reviewed and explicitly activated.
- To change models, effort or prompt, rerun a pinned synthetic/consented eval;
  do not silently change the billed provider.

## Deploy caveats

This Worker is routed to the apex domain, not Cloudflare Pages preview URLs.
The currently configured Pages Git integration may not create PR previews.
Do not make the production app depend on an unreleased Worker route.
Secret setup precedes enabling managed imports.
