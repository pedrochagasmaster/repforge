// Shared domain types for Put Me On MVP.

export type Category =
  | "top"
  | "pants"
  | "dress"
  | "skirt"
  | "jacket"
  | "bag"
  | "shoes";

export const CATEGORY_LABEL_PT: Record<Category, string> = {
  top: "blusa",
  pants: "calça",
  dress: "vestido",
  skirt: "saia",
  jacket: "jaqueta",
  bag: "bolsa",
  shoes: "tênis/sapato",
};

export type PriceIntent = "budget" | "affordable" | "premium";

// Visual attributes extracted from the print (by the Cursor model) or stored
// on a catalog product.
export interface Attributes {
  category: Category;
  subcategory: string;
  primary_color: string; // free-text PT, e.g. "off white"
  color_hex: string; // best-guess hex so we can compute color distance
  pattern: string; // "solid" | "striped" | ...
  fit: string; // "wide leg" | "regular" | ...
  material_guess: string;
  style_tags: string[];
  price_intent: PriceIntent;
}

// One garment detected inside an uploaded print.
export interface DetectedItem extends Attributes {
  item_id: string;
  label_pt: string;
  // Normalised bounding box [x, y, w, h] in 0..1 of the processed image.
  bbox: [number, number, number, number];
  confidence: number;
}

export interface AnalyzeResponse {
  upload_id: string;
  image_data_url: string; // processed (resized, EXIF-stripped) image
  width: number;
  height: number;
  items: DetectedItem[];
  fallback: boolean; // true when detection found nothing and manual crop is required
  ms: number;
}

export type MonetizationType =
  | "affiliate"
  | "direct_cpa"
  | "direct_cpc"
  | "sponsored"
  | "organic";

export interface Product {
  id: string;
  source: string; // shopee | mercado_livre | amazon | awin | direct
  title: string;
  brand: string;
  store: string;
  category: Category;
  subcategory: string;
  price: number;
  currency: "BRL";
  product_url: string;
  affiliate_url: string;
  available: boolean;
  sizes: string[];
  colors: string[];
  // AI metadata
  color_hex: string;
  pattern: string;
  fit: string;
  style_tags: string[];
  store_quality_score: number; // 0..1 trust score
  // Commercial metadata
  monetization_type: MonetizationType;
  commission_rate: number; // 0..1
  estimated_cpc: number; // BRL
  sponsored: boolean;
  sponsored_disclosure_text?: string;
}

export interface ScoredProduct {
  product: Product;
  score_final: number;
  visual_similarity: number;
  attribute_similarity: number;
  price_score: number;
  availability_score: number;
  store_quality_score: number;
  commercial_score: number;
  savings: number; // BRL saved vs estimated print price (>=0)
}

export interface SearchResult {
  search_id: string;
  query: Attributes;
  estimated_price: number; // estimated retail of the print garment
  most_similar: ScoredProduct[];
  cheapest: ScoredProduct[];
  best_value: ScoredProduct[];
  sponsored: ScoredProduct[];
  no_results: boolean;
  // commercial bookkeeping
  cost_per_search: number;
  est_revenue_per_search: number;
}
