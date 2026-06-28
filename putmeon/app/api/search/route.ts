import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { rankCatalog } from "@/lib/ranking";
import { recordSearch } from "@/lib/store";
import type { Attributes } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { item, upload_id } = (await req.json()) as {
      item?: Attributes;
      upload_id?: string;
    };
    if (!item || !item.category) {
      return NextResponse.json({ error: "peça inválida" }, { status: 400 });
    }

    const searchId = `srch_${randomUUID()}`;
    const result = rankCatalog(item, searchId);

    recordSearch({
      search_id: searchId,
      ts: Date.now(),
      upload_id: upload_id ?? "",
      category: item.category,
      subcategory: item.subcategory,
      primary_color: item.primary_color,
      estimated_price: result.estimated_price,
      cost_per_search: result.cost_per_search,
      est_revenue_per_search: result.est_revenue_per_search,
      result_count: result.most_similar.length,
      no_results: result.no_results,
      clicked: false,
      top: result.most_similar.slice(0, 3).map((s, i) => ({
        product_id: s.product.id,
        store: s.product.store,
        rank: i + 1,
      })),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[search] error", err);
    return NextResponse.json({ error: "falha na busca", detail: String(err) }, { status: 500 });
  }
}
