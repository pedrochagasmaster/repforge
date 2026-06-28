import type { Product, Category } from "./types";

// Seed catalog for the MVP. In production these rows come from product feeds
// (Shopee / Mercado Livre / Awin) with real affiliate URLs. URLs here are
// tracked-link placeholders so the click-tracking flow is real end-to-end.

const STORE_QUALITY: Record<string, number> = {
  Renner: 0.9,
  "C&A": 0.88,
  Riachuelo: 0.86,
  Amazon: 0.85,
  "Mercado Livre": 0.8,
  Shopee: 0.72,
  Shein: 0.65,
  "Brechó Garimpo": 0.6,
};

type Seed = Omit<Product, "currency" | "store_quality_score" | "affiliate_url"> & {
  store: keyof typeof STORE_QUALITY;
};

function aff(source: string, id: string): string {
  // Tracked affiliate redirect placeholder (would carry the partner sub-id).
  return `https://go.putmeon.com.br/out?src=${source}&pid=${id}&utm=mvp`;
}

const SEED: Seed[] = [
  // ---- TOPS: brown crewneck sweatshirts (matches the print) ----
  {
    id: "p_top_01", source: "shopee", title: "Moletom Crewneck Marrom Café Oversized", brand: "UrbanBasics",
    store: "Shopee", category: "top", subcategory: "moletom crewneck", price: 79.9,
    product_url: "https://shopee.com.br/p/p_top_01", available: true, sizes: ["P", "M", "G", "GG"],
    colors: ["marrom"], color_hex: "#4a3728", pattern: "solid", fit: "oversized",
    style_tags: ["streetwear", "minimal", "casual", "clean"], monetization_type: "affiliate",
    commission_rate: 0.1, estimated_cpc: 0.35, sponsored: false,
  },
  {
    id: "p_top_02", source: "mercado_livre", title: "Blusa Moletom Marrom Chocolate Básica", brand: "Hering",
    store: "Mercado Livre", category: "top", subcategory: "moletom crewneck", price: 119.9,
    product_url: "https://mercadolivre.com.br/p/p_top_02", available: true, sizes: ["P", "M", "G"],
    colors: ["marrom"], color_hex: "#43301f", pattern: "solid", fit: "regular",
    style_tags: ["minimal", "casual", "básico"], monetization_type: "affiliate",
    commission_rate: 0.07, estimated_cpc: 0.4, sponsored: false,
  },
  {
    id: "p_top_03", source: "amazon", title: "Suéter Moletom Marrom Terroso Algodão", brand: "Basico.",
    store: "Amazon", category: "top", subcategory: "moletom crewneck", price: 149.0,
    product_url: "https://amazon.com.br/p/p_top_03", available: true, sizes: ["M", "G", "GG"],
    colors: ["marrom terroso"], color_hex: "#5a4632", pattern: "solid", fit: "regular",
    style_tags: ["minimal", "premium", "clean", "casual"], monetization_type: "affiliate",
    commission_rate: 0.05, estimated_cpc: 0.5, sponsored: false,
  },
  {
    id: "p_top_04", source: "direct", title: "Moletom Marrom Gola Careca Premium", brand: "Renner",
    store: "Renner", category: "top", subcategory: "moletom crewneck", price: 99.9,
    product_url: "https://renner.com.br/p/p_top_04", available: true, sizes: ["P", "M", "G", "GG"],
    colors: ["marrom"], color_hex: "#4f3a29", pattern: "solid", fit: "regular",
    style_tags: ["minimal", "casual", "clean", "streetwear"], monetization_type: "direct_cpa",
    commission_rate: 0.12, estimated_cpc: 0.45, sponsored: false,
  },
  {
    id: "p_top_05", source: "shopee", title: "Moletom Patrocinado Marrom Soft Touch", brand: "DropWear",
    store: "Shopee", category: "top", subcategory: "moletom crewneck", price: 89.9,
    product_url: "https://shopee.com.br/p/p_top_05", available: true, sizes: ["P", "M", "G"],
    colors: ["marrom"], color_hex: "#4d3a2a", pattern: "solid", fit: "oversized",
    style_tags: ["streetwear", "casual", "clean"], monetization_type: "sponsored",
    commission_rate: 0.09, estimated_cpc: 0.9, sponsored: true,
    sponsored_disclosure_text: "Patrocinado",
  },
  {
    id: "p_top_06", source: "shein", title: "Moletom Bege Areia Oversized", brand: "Shein",
    store: "Shein", category: "top", subcategory: "moletom crewneck", price: 59.9,
    product_url: "https://shein.com.br/p/p_top_06", available: false, sizes: ["M", "G"],
    colors: ["bege"], color_hex: "#cdbb9e", pattern: "solid", fit: "oversized",
    style_tags: ["casual", "básico"], monetization_type: "affiliate",
    commission_rate: 0.08, estimated_cpc: 0.3, sponsored: false,
  },
  {
    id: "p_top_07", source: "mercado_livre", title: "Camiseta Branca Básica Algodão Pima", brand: "Insider",
    store: "Mercado Livre", category: "top", subcategory: "camiseta", price: 49.9,
    product_url: "https://mercadolivre.com.br/p/p_top_07", available: true, sizes: ["P", "M", "G", "GG"],
    colors: ["branco"], color_hex: "#f2f2ef", pattern: "solid", fit: "regular",
    style_tags: ["básico", "minimal", "clean"], monetization_type: "affiliate",
    commission_rate: 0.07, estimated_cpc: 0.25, sponsored: false,
  },
  {
    id: "p_top_08", source: "shopee", title: "Blusa Tricot Verde Musgo Gola Alta", brand: "ModaTrend",
    store: "Shopee", category: "top", subcategory: "tricot", price: 84.9,
    product_url: "https://shopee.com.br/p/p_top_08", available: true, sizes: ["P", "M", "G"],
    colors: ["verde"], color_hex: "#5b6b4a", pattern: "solid", fit: "regular",
    style_tags: ["casual", "inverno"], monetization_type: "affiliate",
    commission_rate: 0.09, estimated_cpc: 0.3, sponsored: false,
  },

  // ---- PANTS: cream / off-white wide-leg (matches the print) ----
  {
    id: "p_pant_01", source: "shopee", title: "Calça Wide Leg Off White Alfaiataria Leve", brand: "Studio77",
    store: "Shopee", category: "pants", subcategory: "calça wide leg", price: 89.9,
    product_url: "https://shopee.com.br/p/p_pant_01", available: true, sizes: ["36", "38", "40", "42"],
    colors: ["off white"], color_hex: "#efe9dc", pattern: "solid", fit: "wide leg",
    style_tags: ["minimal", "clean", "casual chic", "alfaiataria"], monetization_type: "affiliate",
    commission_rate: 0.1, estimated_cpc: 0.4, sponsored: false,
  },
  {
    id: "p_pant_02", source: "mercado_livre", title: "Calça Pantalona Creme Cintura Alta", brand: "AModa",
    store: "Mercado Livre", category: "pants", subcategory: "calça wide leg", price: 129.9,
    product_url: "https://mercadolivre.com.br/p/p_pant_02", available: true, sizes: ["38", "40", "42", "44"],
    colors: ["creme"], color_hex: "#e8dcc4", pattern: "solid", fit: "wide leg",
    style_tags: ["minimal", "clean", "alfaiataria"], monetization_type: "affiliate",
    commission_rate: 0.08, estimated_cpc: 0.45, sponsored: false,
  },
  {
    id: "p_pant_03", source: "direct", title: "Calça Wide Leg Areia Linho Premium", brand: "C&A",
    store: "C&A", category: "pants", subcategory: "calça wide leg", price: 159.9,
    product_url: "https://cea.com.br/p/p_pant_03", available: true, sizes: ["36", "38", "40", "42", "44"],
    colors: ["areia"], color_hex: "#e3d6bd", pattern: "solid", fit: "wide leg",
    style_tags: ["minimal", "clean", "premium", "linho"], monetization_type: "direct_cpa",
    commission_rate: 0.12, estimated_cpc: 0.5, sponsored: false,
  },
  {
    id: "p_pant_04", source: "shopee", title: "Calça Baggy Bege Cargo Streetwear", brand: "UrbanBasics",
    store: "Shopee", category: "pants", subcategory: "calça baggy", price: 99.9,
    product_url: "https://shopee.com.br/p/p_pant_04", available: true, sizes: ["P", "M", "G", "GG"],
    colors: ["bege"], color_hex: "#ddd0b6", pattern: "solid", fit: "baggy",
    style_tags: ["streetwear", "casual", "wide"], monetization_type: "affiliate",
    commission_rate: 0.1, estimated_cpc: 0.38, sponsored: false,
  },
  {
    id: "p_pant_05", source: "amazon", title: "Calça Wide Off White Patrocinada Soft", brand: "FlowPants",
    store: "Amazon", category: "pants", subcategory: "calça wide leg", price: 109.9,
    product_url: "https://amazon.com.br/p/p_pant_05", available: true, sizes: ["38", "40", "42"],
    colors: ["off white"], color_hex: "#ece5d6", pattern: "solid", fit: "wide leg",
    style_tags: ["minimal", "clean", "casual chic"], monetization_type: "sponsored",
    commission_rate: 0.07, estimated_cpc: 0.95, sponsored: true,
    sponsored_disclosure_text: "Patrocinado",
  },
  {
    id: "p_pant_06", source: "shein", title: "Calça Wide Leg Preta Alfaiataria", brand: "Shein",
    store: "Shein", category: "pants", subcategory: "calça wide leg", price: 69.9,
    product_url: "https://shein.com.br/p/p_pant_06", available: true, sizes: ["36", "38", "40"],
    colors: ["preto"], color_hex: "#1d1d1d", pattern: "solid", fit: "wide leg",
    style_tags: ["minimal", "alfaiataria"], monetization_type: "affiliate",
    commission_rate: 0.08, estimated_cpc: 0.3, sponsored: false,
  },
  {
    id: "p_pant_07", source: "direct", title: "Calça Reta Jeans Claro", brand: "Riachuelo",
    store: "Riachuelo", category: "pants", subcategory: "calça reta", price: 139.9,
    product_url: "https://riachuelo.com.br/p/p_pant_07", available: true, sizes: ["36", "38", "40", "42"],
    colors: ["jeans claro"], color_hex: "#b9c4d0", pattern: "solid", fit: "reta",
    style_tags: ["casual", "jeans"], monetization_type: "direct_cpa",
    commission_rate: 0.11, estimated_cpc: 0.42, sponsored: false,
  },
  {
    id: "p_pant_08", source: "shopee", title: "Calça Wide Leg Crua Garimpo", brand: "Brechó Garimpo",
    store: "Brechó Garimpo", category: "pants", subcategory: "calça wide leg", price: 54.9,
    product_url: "https://shopee.com.br/p/p_pant_08", available: true, sizes: ["38", "40"],
    colors: ["cru"], color_hex: "#e7ddc8", pattern: "solid", fit: "wide leg",
    style_tags: ["minimal", "vintage", "clean"], monetization_type: "affiliate",
    commission_rate: 0.06, estimated_cpc: 0.2, sponsored: false,
  },

  // ---- SHOES: black/white high-top sneakers (matches the print) ----
  {
    id: "p_shoe_01", source: "mercado_livre", title: "Tênis Cano Alto Preto e Branco Retrô", brand: "StreetKicks",
    store: "Mercado Livre", category: "shoes", subcategory: "tênis cano alto", price: 199.9,
    product_url: "https://mercadolivre.com.br/p/p_shoe_01", available: true, sizes: ["38", "39", "40", "41", "42", "43"],
    colors: ["preto", "branco"], color_hex: "#222222", pattern: "color block", fit: "high top",
    style_tags: ["streetwear", "retrô", "casual"], monetization_type: "affiliate",
    commission_rate: 0.08, estimated_cpc: 0.6, sponsored: false,
  },
  {
    id: "p_shoe_02", source: "shopee", title: "Tênis High Top Branco com Detalhe Preto", brand: "UrbanFeet",
    store: "Shopee", category: "shoes", subcategory: "tênis cano alto", price: 129.9,
    product_url: "https://shopee.com.br/p/p_shoe_02", available: true, sizes: ["37", "38", "39", "40", "41"],
    colors: ["branco", "preto"], color_hex: "#2a2a2a", pattern: "color block", fit: "high top",
    style_tags: ["streetwear", "casual", "retrô"], monetization_type: "affiliate",
    commission_rate: 0.1, estimated_cpc: 0.45, sponsored: false,
  },
  {
    id: "p_shoe_03", source: "amazon", title: "Tênis Cano Médio Off White Casual", brand: "Aerostep",
    store: "Amazon", category: "shoes", subcategory: "tênis casual", price: 169.0,
    product_url: "https://amazon.com.br/p/p_shoe_03", available: true, sizes: ["38", "39", "40", "41", "42"],
    colors: ["off white"], color_hex: "#ece7dc", pattern: "solid", fit: "mid top",
    style_tags: ["casual", "clean", "minimal"], monetization_type: "affiliate",
    commission_rate: 0.06, estimated_cpc: 0.5, sponsored: false,
  },
  {
    id: "p_shoe_04", source: "direct", title: "Tênis Retrô Preto/Branco Couro", brand: "Renner",
    store: "Renner", category: "shoes", subcategory: "tênis cano alto", price: 249.9,
    product_url: "https://renner.com.br/p/p_shoe_04", available: false, sizes: ["39", "40", "41", "42"],
    colors: ["preto", "branco"], color_hex: "#1f1f1f", pattern: "color block", fit: "high top",
    style_tags: ["streetwear", "premium", "retrô"], monetization_type: "direct_cpa",
    commission_rate: 0.12, estimated_cpc: 0.7, sponsored: false,
  },

  // ---- DRESSES / SKIRTS / JACKETS / BAGS (catalog breadth) ----
  {
    id: "p_dress_01", source: "shopee", title: "Vestido Midi Branco Linho Resort", brand: "SunDays",
    store: "Shopee", category: "dress", subcategory: "vestido midi", price: 119.9,
    product_url: "https://shopee.com.br/p/p_dress_01", available: true, sizes: ["P", "M", "G"],
    colors: ["branco"], color_hex: "#f4f0e8", pattern: "solid", fit: "midi",
    style_tags: ["resort", "clean", "verão", "minimal"], monetization_type: "affiliate",
    commission_rate: 0.1, estimated_cpc: 0.4, sponsored: false,
  },
  {
    id: "p_dress_02", source: "direct", title: "Vestido Longo Preto Alcinha", brand: "C&A",
    store: "C&A", category: "dress", subcategory: "vestido longo", price: 149.9,
    product_url: "https://cea.com.br/p/p_dress_02", available: true, sizes: ["P", "M", "G", "GG"],
    colors: ["preto"], color_hex: "#191919", pattern: "solid", fit: "longo",
    style_tags: ["festa", "minimal", "elegante"], monetization_type: "direct_cpa",
    commission_rate: 0.12, estimated_cpc: 0.5, sponsored: false,
  },
  {
    id: "p_skirt_01", source: "shopee", title: "Saia Midi Plissada Bege", brand: "ModaTrend",
    store: "Shopee", category: "skirt", subcategory: "saia midi", price: 79.9,
    product_url: "https://shopee.com.br/p/p_skirt_01", available: true, sizes: ["P", "M", "G"],
    colors: ["bege"], color_hex: "#ddd0b6", pattern: "plissado", fit: "midi",
    style_tags: ["clean", "casual chic"], monetization_type: "affiliate",
    commission_rate: 0.09, estimated_cpc: 0.3, sponsored: false,
  },
  {
    id: "p_jacket_01", source: "mercado_livre", title: "Jaqueta Jeans Oversized Clara", brand: "DenimCo",
    store: "Mercado Livre", category: "jacket", subcategory: "jaqueta jeans", price: 159.9,
    product_url: "https://mercadolivre.com.br/p/p_jacket_01", available: true, sizes: ["P", "M", "G", "GG"],
    colors: ["jeans claro"], color_hex: "#aebccb", pattern: "solid", fit: "oversized",
    style_tags: ["streetwear", "casual", "jeans"], monetization_type: "affiliate",
    commission_rate: 0.08, estimated_cpc: 0.45, sponsored: false,
  },
  {
    id: "p_jacket_02", source: "shopee", title: "Jaqueta Corta-Vento Marrom", brand: "TrailWear",
    store: "Shopee", category: "jacket", subcategory: "corta-vento", price: 109.9,
    product_url: "https://shopee.com.br/p/p_jacket_02", available: true, sizes: ["M", "G", "GG"],
    colors: ["marrom"], color_hex: "#5a4632", pattern: "solid", fit: "regular",
    style_tags: ["esportivo", "casual"], monetization_type: "affiliate",
    commission_rate: 0.1, estimated_cpc: 0.35, sponsored: false,
  },
  {
    id: "p_bag_01", source: "shopee", title: "Bolsa Tote Bege Lona", brand: "CarryAll",
    store: "Shopee", category: "bag", subcategory: "bolsa tote", price: 69.9,
    product_url: "https://shopee.com.br/p/p_bag_01", available: true, sizes: ["único"],
    colors: ["bege"], color_hex: "#d8c8a8", pattern: "solid", fit: "tote",
    style_tags: ["casual", "clean", "minimal"], monetization_type: "affiliate",
    commission_rate: 0.11, estimated_cpc: 0.3, sponsored: false,
  },
  {
    id: "p_bag_02", source: "amazon", title: "Bolsa Ombro Preta Couro PU", brand: "LuxeLite",
    store: "Amazon", category: "bag", subcategory: "bolsa ombro", price: 139.0,
    product_url: "https://amazon.com.br/p/p_bag_02", available: true, sizes: ["único"],
    colors: ["preto"], color_hex: "#161616", pattern: "solid", fit: "ombro",
    style_tags: ["elegante", "minimal"], monetization_type: "affiliate",
    commission_rate: 0.06, estimated_cpc: 0.4, sponsored: false,
  },
];

export const CATALOG: Product[] = SEED.map((s) => ({
  ...s,
  currency: "BRL" as const,
  store_quality_score: STORE_QUALITY[s.store],
  affiliate_url: aff(s.source, s.id),
}));

export function productsByCategory(category: Category): Product[] {
  return CATALOG.filter((p) => p.category === category);
}

export function getProduct(id: string): Product | undefined {
  return CATALOG.find((p) => p.id === id);
}

// Rough retail baseline per category (BRL), used to estimate the print's price
// when we have no exact match — drives the "you save X" copy.
export const CATEGORY_BASELINE: Record<Category, number> = {
  top: 180,
  pants: 220,
  dress: 240,
  skirt: 160,
  jacket: 280,
  bag: 200,
  shoes: 360,
};
