# Put Me On — MVP prototype

Mobile-first web app: upload a print of an outfit (Instagram / TikTok / Pinterest),
tap the garment you want, and get **similar, buyable, cheaper** options for the
Brazilian market — ranked by visual similarity, price and availability.

> Promise: **"Ache o look do print, pagando menos."**

This is a Phase-1 prototype that implements the core loop from the spec:
`print → upload → seleção de peça → resultado parecido → clique em loja → feedback`,
with affiliate tracking and a margin-per-search admin from day one.

## How the AI works

Garment detection + visual attribute extraction run on **Cursor as the model
provider** through the official `@cursor/sdk`. The server sends the uploaded
image to a Cursor agent (`composer-2.5`) and gets back structured JSON
(category, subcategory, color, fit, pattern, style tags, price intent, bbox).

Auth uses the `CURSOR_API_KEY` environment variable. No key, no analysis.

```ts
// lib/ai.ts (simplified)
const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY,
  model: { id: "composer-2.5" },
  local: { cwd },
});
const run = await agent.send({ text: PROMPT, images: [{ data: base64, mimeType: "image/jpeg" }] });
const items = parse((await run.wait()).result);
```

## Run it

Requires Node 22.13+ and `CURSOR_API_KEY` in the environment.

```bash
npm install
npm run build && npm run start   # or: npm run dev
# open http://localhost:3000  (admin at /admin)
```

Tap **"Usar print de exemplo"** to try the flow with the bundled sample look.

## Architecture

- `app/page.tsx` — the whole mobile user flow (home → analyzing → select → results).
- `app/admin/page.tsx` — product + commercial dashboard (North Star, margin/search).
- `app/api/*` — `analyze` (Cursor SDK vision), `crop` (manual-crop fallback),
  `search` (ranking), `track` (outbound click + estimated commission),
  `feedback`, `admin/report`.
- `lib/ai.ts` — Cursor SDK integration. `lib/image.ts` — sharp resize / EXIF strip.
- `lib/catalog.ts` — seed catalog with AI + commercial metadata.
- `lib/ranking.ts` — organic score (spec §12.1) + 3 buckets + sponsored gate.
- `lib/store.ts` — in-memory analytics (prototype: no DB) + 24h upload expiry.

## Scoring (spec §12.1)

```
score_final = 0.40*visual + 0.20*attribute + 0.15*price
            + 0.10*availability + 0.10*store_quality + 0.05*commercial
```

`visual_similarity` is a heuristic proxy (color + silhouette + subcategory)
standing in for image embeddings. Sponsored results never enter the organic
ranking and only surface when they pass a relevance gate, always labeled
"Patrocinado".

## Prototype limits

- In-memory store (resets on restart); product images are generated SVG
  silhouettes; affiliate URLs are tracked-redirect placeholders.
- Not in scope (per spec §9.2): native app, social integrations, own checkout,
  paid subscription, creator dashboard, real embeddings.
