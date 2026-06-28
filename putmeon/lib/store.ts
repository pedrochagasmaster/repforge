import { randomUUID } from "node:crypto";
import type { Category, MonetizationType } from "./types";

// In-memory store (prototype: no persistence). A global singleton keeps data
// across Next.js dev hot-reloads. Uploaded originals auto-expire (spec §11.1, §16).

const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface SearchRecord {
  search_id: string;
  ts: number;
  upload_id: string;
  category: Category;
  subcategory: string;
  primary_color: string;
  estimated_price: number;
  cost_per_search: number;
  est_revenue_per_search: number;
  result_count: number;
  no_results: boolean;
  clicked: boolean;
  top: { product_id: string; store: string; rank: number }[];
}

export interface ClickRecord {
  search_id: string;
  product_id: string;
  store: string;
  category: Category;
  bucket: string;
  rank: number;
  price: number;
  commission_rate: number;
  monetization_type: MonetizationType;
  sponsored: boolean;
  estimated_commission: number;
  ts: number;
}

export interface FeedbackRecord {
  search_id: string;
  product_id?: string;
  value: "looks_like" | "not_like";
  ts: number;
}

interface Upload {
  buffer: Buffer;
  width: number;
  height: number;
  expiresAt: number;
}

interface StoreShape {
  uploads: Map<string, Upload>;
  searches: SearchRecord[];
  clicks: ClickRecord[];
  feedback: FeedbackRecord[];
}

const g = globalThis as unknown as { __PMO_STORE__?: StoreShape };

export const store: StoreShape =
  g.__PMO_STORE__ ??
  (g.__PMO_STORE__ = {
    uploads: new Map(),
    searches: [],
    clicks: [],
    feedback: [],
  });

function purgeExpiredUploads() {
  const now = Date.now();
  for (const [id, u] of store.uploads) {
    if (u.expiresAt <= now) store.uploads.delete(id);
  }
}

export function saveUpload(buffer: Buffer, width: number, height: number): string {
  purgeExpiredUploads();
  const id = `up_${randomUUID()}`;
  store.uploads.set(id, {
    buffer,
    width,
    height,
    expiresAt: Date.now() + UPLOAD_TTL_MS,
  });
  return id;
}

export function getUpload(id: string): Upload | undefined {
  purgeExpiredUploads();
  return store.uploads.get(id);
}

export function deleteUpload(id: string): boolean {
  return store.uploads.delete(id);
}

export function recordSearch(r: SearchRecord) {
  store.searches.unshift(r);
}

export function markSearchClicked(searchId: string) {
  const s = store.searches.find((x) => x.search_id === searchId);
  if (s) s.clicked = true;
}

export function recordClick(r: ClickRecord) {
  store.clicks.unshift(r);
  markSearchClicked(r.search_id);
}

export function recordFeedback(r: FeedbackRecord) {
  store.feedback.unshift(r);
}

export interface AdminReport {
  totals: {
    searches: number;
    searches_with_click: number;
    north_star_click_rate: number; // searches with click / searches
    no_result_rate: number;
    clicks: number;
    feedback: number;
    positive_feedback_rate: number;
  };
  economics: {
    avg_cost_per_search: number;
    avg_est_revenue_per_search: number;
    avg_margin_per_search: number;
    total_estimated_commission: number;
  };
  by_category: {
    category: string;
    searches: number;
    clicks: number;
    click_rate: number;
    no_result_rate: number;
  }[];
  by_store: { store: string; clicks: number; estimated_commission: number }[];
  recent_searches: SearchRecord[];
  problem_searches: SearchRecord[]; // no results or zero clicks — for review
}

export function buildReport(): AdminReport {
  const searches = store.searches;
  const clicks = store.clicks;
  const feedback = store.feedback;

  const nSearch = searches.length;
  const withClick = searches.filter((s) => s.clicked).length;
  const noResult = searches.filter((s) => s.no_results).length;
  const positive = feedback.filter((f) => f.value === "looks_like").length;

  const avgCost = nSearch ? searches.reduce((a, s) => a + s.cost_per_search, 0) / nSearch : 0;
  const avgRev = nSearch
    ? searches.reduce((a, s) => a + s.est_revenue_per_search, 0) / nSearch
    : 0;
  const totalCommission = clicks.reduce((a, c) => a + c.estimated_commission, 0);

  const cats = new Map<string, { s: number; c: number; nr: number }>();
  for (const s of searches) {
    const e = cats.get(s.category) ?? { s: 0, c: 0, nr: 0 };
    e.s += 1;
    if (s.clicked) e.c += 1;
    if (s.no_results) e.nr += 1;
    cats.set(s.category, e);
  }

  const stores = new Map<string, { c: number; comm: number }>();
  for (const c of clicks) {
    const e = stores.get(c.store) ?? { c: 0, comm: 0 };
    e.c += 1;
    e.comm += c.estimated_commission;
    stores.set(c.store, e);
  }

  return {
    totals: {
      searches: nSearch,
      searches_with_click: withClick,
      north_star_click_rate: nSearch ? withClick / nSearch : 0,
      no_result_rate: nSearch ? noResult / nSearch : 0,
      clicks: clicks.length,
      feedback: feedback.length,
      positive_feedback_rate: feedback.length ? positive / feedback.length : 0,
    },
    economics: {
      avg_cost_per_search: avgCost,
      avg_est_revenue_per_search: avgRev,
      avg_margin_per_search: avgRev - avgCost,
      total_estimated_commission: totalCommission,
    },
    by_category: [...cats.entries()].map(([category, e]) => ({
      category,
      searches: e.s,
      clicks: e.c,
      click_rate: e.s ? e.c / e.s : 0,
      no_result_rate: e.s ? e.nr / e.s : 0,
    })),
    by_store: [...stores.entries()]
      .map(([s, e]) => ({ store: s, clicks: e.c, estimated_commission: e.comm }))
      .sort((a, b) => b.estimated_commission - a.estimated_commission),
    recent_searches: searches.slice(0, 20),
    problem_searches: searches.filter((s) => s.no_results || !s.clicked).slice(0, 20),
  };
}
