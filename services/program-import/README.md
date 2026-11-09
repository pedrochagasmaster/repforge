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

## Worktree and local verification

```bash
cd /home/ubuntu/repforge-import-managed
node services/program-import/scripts/build-prompts.mjs --check
node --test services/program-import/test/import-worker.test.mjs
node tools/run-tests.mjs --check
REPFORGE_URL=http://127.0.0.1:8372/ node test/program-managed-import.mjs

cd services/program-import
/home/ubuntu/repforge/services/install-transfer/node_modules/.bin/wrangler \
  deploy --dry-run --env production
```

The generated `src/prompts.mjs` is an exact copy of the existing EN/PT
`entry.freeform.prompt` string from the repo's i18n JSON. Run the generator
after a change in the prompt and commit both prompt and generation together.
Never assemble a second, unreviewed prompt in Worker code.

## Provisioning

Use the logged-in Wrangler already installed on the devbox. **Do not copy**
any of the following credentials into the PWA, a repository file, PR discussion,
telemetry, an HTTP URL or CLI arguments.

```bash
cd /home/ubuntu/repforge-import-managed/services/program-import
WRANGLER=/home/ubuntu/repforge/services/install-transfer/node_modules/.bin/wrangler

# First deploy with MANAGED_IMPORT_ENABLED=false.
"$WRANGLER" deploy --env production

# The existing devbox ANT_KEY is never echoed.
source <(grep -m1 '^export ANT_KEY=' /home/ubuntu/.bashrc)
printf %s "$ANT_KEY" | "$WRANGLER" secret put ANTHROPIC_API_KEY --env production

# Private devbox env file (chmod 600), created for this Turnstile widget.
source /home/ubuntu/.config/taurifer/managed-import-turnstile.env
printf %s "$TURNSTILE_SECRET_KEY" | "$WRANGLER" secret put TURNSTILE_SECRET_KEY --env production

# Private, randomly generated visitor-hash pepper.
openssl rand -hex 32 | "$WRANGLER" secret put IMPORT_IP_PEPPER --env production
```

Test while disabled:

```bash
curl -fsS https://taurifer.com/api/program-import/config
# {"enabled":false,"sitekey":null,"maxChars":12000}
```

## Enable and kill

Change only production `MANAGED_IMPORT_ENABLED` from `false` to `true`
in `wrangler.jsonc`, commit the configuration and deploy after the PWA
update and physical-device smoke test.

```bash
"$WRANGLER" deploy --env production
curl -fsS https://taurifer.com/api/program-import/config
# Should show enabled=true and the public Turnstile sitekey.
```

To disable immediately, restore `MANAGED_IMPORT_ENABLED=false` and deploy.
Fail-closed controls will also refuse requests if any one of the three
secret bindings or Durable Object binding is missing. An existing import
candidate remains safe to review and activate offline; disabling the Worker
never alters workouts in local storage.

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
Cloudflare Wrangler secret setup precedes enabling managed imports.
