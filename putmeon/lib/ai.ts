import { Agent } from "@cursor/sdk";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import type { Attributes, Category, DetectedItem, PriceIntent } from "./types";
import { CATEGORY_LABEL_PT } from "./types";

const VALID_CATEGORIES: Category[] = [
  "top",
  "pants",
  "dress",
  "skirt",
  "jacket",
  "bag",
  "shoes",
];

const MODEL_ID = process.env.PUTMEON_MODEL ?? "composer-2.5";

const DETECT_PROMPT = `You are a fashion computer-vision API for the Brazilian market.
Look at the attached image (a screenshot of an outfit / look) and identify the main wearable garments.
Only consider these categories: top, pants, dress, skirt, jacket, bag, shoes.
Ignore people, faces, background, accessories that are not in the list.

Return ONLY valid minified JSON, no prose and no markdown fences, with this exact shape:
{"items":[{
 "category":"one of: top|pants|dress|skirt|jacket|bag|shoes",
 "subcategory":"short pt-BR, e.g. 'calça wide leg', 'moletom crewneck', 'tênis cano alto'",
 "primary_color":"pt-BR color name",
 "color_hex":"#rrggbb best guess of the garment color",
 "pattern":"pt-BR, e.g. 'solid'/'liso','listrado','xadrez','floral'",
 "fit":"pt-BR, e.g. 'wide leg','oversized','regular','reta','high top'",
 "material_guess":"pt-BR best guess",
 "style_tags":["3-5 short pt-BR or en tags e.g. 'streetwear','minimal','clean','casual'"],
 "price_intent":"one of: budget|affordable|premium",
 "bbox":[x,y,w,h],
 "confidence":0.0
}]}
bbox values are normalized 0..1 relative to the image (x,y = top-left of the box).
List garments top-to-bottom. Return between 1 and 5 items. If you truly see no garment, return {"items":[]}.`;

const SINGLE_PROMPT = `You are a fashion computer-vision API for the Brazilian market.
The attached image is a tight crop of a SINGLE garment selected by the user.
Return ONLY valid minified JSON, no prose, no markdown fences, with this shape:
{"items":[{"category":"top|pants|dress|skirt|jacket|bag|shoes","subcategory":"...","primary_color":"...","color_hex":"#rrggbb","pattern":"...","fit":"...","material_guess":"...","style_tags":["..."],"price_intent":"budget|affordable|premium","bbox":[0,0,1,1],"confidence":0.0}]}`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(body.slice(start, end + 1));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function coerceCategory(c: unknown): Category | null {
  if (typeof c !== "string") return null;
  const v = c.toLowerCase().trim();
  return (VALID_CATEGORIES as string[]).includes(v) ? (v as Category) : null;
}

function coerceIntent(v: unknown): PriceIntent {
  return v === "budget" || v === "premium" ? v : "affordable";
}

function coerceHex(v: unknown): string {
  if (typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v.trim())) {
    const s = v.trim();
    return s.startsWith("#") ? s : `#${s}`;
  }
  return "#888888";
}

function coerceBbox(v: unknown): [number, number, number, number] {
  if (Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number")) {
    return [clamp01(v[0]), clamp01(v[1]), clamp01(v[2]), clamp01(v[3])];
  }
  return [0.1, 0.1, 0.8, 0.8];
}

function mapItems(parsed: unknown): DetectedItem[] {
  const raw = (parsed as { items?: unknown }).items;
  if (!Array.isArray(raw)) return [];
  const out: DetectedItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i] as Record<string, unknown>;
    const category = coerceCategory(r.category);
    if (!category) continue;
    const attrs: Attributes = {
      category,
      subcategory: String(r.subcategory ?? "").trim() || CATEGORY_LABEL_PT[category],
      primary_color: String(r.primary_color ?? "").trim() || "neutro",
      color_hex: coerceHex(r.color_hex),
      pattern: String(r.pattern ?? "solid").trim() || "solid",
      fit: String(r.fit ?? "regular").trim() || "regular",
      material_guess: String(r.material_guess ?? "").trim(),
      style_tags: Array.isArray(r.style_tags)
        ? (r.style_tags as unknown[]).map((t) => String(t)).slice(0, 6)
        : [],
      price_intent: coerceIntent(r.price_intent),
    };
    out.push({
      ...attrs,
      item_id: `itm_${i + 1}`,
      label_pt: CATEGORY_LABEL_PT[category],
      bbox: coerceBbox(r.bbox),
      confidence:
        typeof r.confidence === "number" ? clamp01(r.confidence) : 0.7,
    });
  }
  return out;
}

async function runVision(base64: string, prompt: string): Promise<DetectedItem[]> {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pmo-vision-"));
  const agent = await Agent.create({
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: MODEL_ID },
    local: { cwd },
  });
  try {
    const run = await agent.send({
      text: prompt,
      images: [{ data: base64, mimeType: "image/jpeg" }],
    });
    const result = await run.wait();
    if (result.status !== "finished" || !result.result) {
      throw new Error(`Vision run ${result.status}`);
    }
    return mapItems(extractJson(result.result));
  } finally {
    agent.close();
    fs.rm(cwd, { recursive: true, force: true }, () => {});
  }
}

export async function detectGarments(base64: string): Promise<DetectedItem[]> {
  return runVision(base64, DETECT_PROMPT);
}

export async function describeCrop(base64: string): Promise<DetectedItem | null> {
  const items = await runVision(base64, SINGLE_PROMPT);
  return items[0] ?? null;
}
