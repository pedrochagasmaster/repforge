import type { Attributes, Product, ScoredProduct, SearchResult, Category } from "./types";
import { CATALOG, CATEGORY_BASELINE } from "./catalog";

// ---- Assumptions used for unit-economics estimates (see spec §7.1) ----
export const ASSUMED_CLICKS_PER_SEARCH = 0.45;
export const ASSUMED_CONVERSION = 0.025; // click -> purchase
export const AI_COST_PER_SEARCH = 0.12; // BRL, one vision call

// Organic ranking weights (spec §12.1). commercial_score stays small on purpose.
const W = {
  visual: 0.4,
  attribute: 0.2,
  price: 0.15,
  availability: 0.1,
  store: 0.1,
  commercial: 0.05,
};

// Sponsored relevance gate (spec §12.2) — a sponsored item can only surface if
// it is genuinely a compatible product.
const SPONSORED_MIN_VISUAL = 0.5;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function colorSimilarity(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const dist = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  return Math.max(0, 1 - dist / 441.67); // 441.67 = max RGB distance
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a.map((x) => x.toLowerCase()));
  const sb = new Set(b.map((x) => x.toLowerCase()));
  if (sa.size === 0 && sb.size === 0) return 0;
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return inter / union;
}

function tokenMatch(a: string, b: string): number {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.6;
  return 0;
}

// Visual similarity proxy. Without a real image-embedding model we approximate
// "does it look like the print" from color + silhouette (fit) + subcategory.
function visualSimilarity(q: Attributes, p: Product): number {
  const color = colorSimilarity(q.color_hex, p.color_hex);
  const fit = tokenMatch(q.fit, p.fit);
  const sub = tokenMatch(q.subcategory, p.subcategory);
  return 0.55 * color + 0.25 * fit + 0.2 * sub;
}

function attributeSimilarity(q: Attributes, p: Product): number {
  const tags = jaccard(q.style_tags, p.style_tags);
  const pattern = tokenMatch(q.pattern, p.pattern);
  const fit = tokenMatch(q.fit, p.fit);
  return 0.5 * tags + 0.3 * pattern + 0.2 * fit;
}

function estimatePrintPrice(q: Attributes): number {
  const base = CATEGORY_BASELINE[q.category];
  const mult = q.price_intent === "budget" ? 0.7 : q.price_intent === "premium" ? 1.8 : 1.0;
  return Math.round(base * mult);
}

function score(q: Attributes, p: Product, priceRange: [number, number]): ScoredProduct {
  const visual = visualSimilarity(q, p);
  const attribute = attributeSimilarity(q, p);
  const [minP, maxP] = priceRange;
  const price_score = maxP > minP ? (maxP - p.price) / (maxP - minP) : 0.5;
  const availability = p.available ? 1 : 0.2;
  const store = p.store_quality_score;
  const commercial = Math.min(1, p.commission_rate / 0.12);

  const score_final =
    W.visual * visual +
    W.attribute * attribute +
    W.price * price_score +
    W.availability * availability +
    W.store * store +
    W.commercial * commercial;

  const estimated = estimatePrintPrice(q);
  return {
    product: p,
    score_final,
    visual_similarity: visual,
    attribute_similarity: attribute,
    price_score,
    availability_score: availability,
    store_quality_score: store,
    commercial_score: commercial,
    savings: Math.max(0, estimated - p.price),
  };
}

export function rankCatalog(query: Attributes, searchId: string): SearchResult {
  const candidates = CATALOG.filter((p) => p.category === query.category);
  const estimated_price = estimatePrintPrice(query);

  if (candidates.length === 0) {
    return {
      search_id: searchId,
      query,
      estimated_price,
      most_similar: [],
      cheapest: [],
      best_value: [],
      sponsored: [],
      no_results: true,
      cost_per_search: AI_COST_PER_SEARCH,
      est_revenue_per_search: 0,
    };
  }

  const prices = candidates.map((p) => p.price);
  const priceRange: [number, number] = [Math.min(...prices), Math.max(...prices)];

  const scored = candidates.map((p) => score(query, p, priceRange));
  const organic = scored.filter((s) => !s.product.sponsored);

  const most_similar = [...organic].sort((a, b) => b.score_final - a.score_final).slice(0, 6);

  const relevant = organic.filter((s) => s.visual_similarity >= 0.45);
  const cheapest = [...(relevant.length ? relevant : organic)]
    .sort((a, b) => a.product.price - b.product.price)
    .slice(0, 6);

  const valueOf = (s: ScoredProduct) =>
    0.6 * (0.6 * s.visual_similarity + 0.4 * s.attribute_similarity) + 0.4 * s.price_score;
  const best_value = [...organic].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 6);

  const sponsored = scored
    .filter(
      (s) =>
        s.product.sponsored &&
        s.product.available &&
        s.visual_similarity >= SPONSORED_MIN_VISUAL,
    )
    .sort((a, b) => b.score_final - a.score_final)
    .slice(0, 1);

  const topTickets = most_similar.slice(0, 4);
  const avgTicket = topTickets.length
    ? topTickets.reduce((a, s) => a + s.product.price, 0) / topTickets.length
    : 0;
  const avgCommission = topTickets.length
    ? topTickets.reduce((a, s) => a + s.product.commission_rate, 0) / topTickets.length
    : 0;
  const est_revenue_per_search =
    ASSUMED_CLICKS_PER_SEARCH * ASSUMED_CONVERSION * avgTicket * avgCommission;

  return {
    search_id: searchId,
    query,
    estimated_price,
    most_similar,
    cheapest,
    best_value,
    sponsored,
    no_results: most_similar.length === 0,
    cost_per_search: AI_COST_PER_SEARCH,
    est_revenue_per_search,
  };
}

export function estimatedCommission(price: number, commissionRate: number): number {
  // Expected commission per click, conservative (spec §7.1 conversion).
  return price * commissionRate * ASSUMED_CONVERSION;
}

export const CATEGORIES: Category[] = [
  "top",
  "pants",
  "dress",
  "skirt",
  "jacket",
  "bag",
  "shoes",
];
