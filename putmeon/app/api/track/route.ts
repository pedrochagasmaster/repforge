import { NextResponse } from "next/server";
import { getProduct } from "@/lib/catalog";
import { estimatedCommission } from "@/lib/ranking";
import { recordClick } from "@/lib/store";
import type { Category } from "@/lib/types";

export const runtime = "nodejs";

// Outbound click tracking (spec §14.2). Records the click + estimated commission
// and returns the affiliate URL the client should open.
export async function POST(req: Request) {
  try {
    const { search_id, product_id, bucket, rank } = (await req.json()) as {
      search_id?: string;
      product_id?: string;
      bucket?: string;
      rank?: number;
    };
    const product = product_id ? getProduct(product_id) : undefined;
    if (!product) {
      return NextResponse.json({ error: "produto não encontrado" }, { status: 404 });
    }

    recordClick({
      search_id: search_id ?? "",
      product_id: product.id,
      store: product.store,
      category: product.category as Category,
      bucket: bucket ?? "most_similar",
      rank: rank ?? 0,
      price: product.price,
      commission_rate: product.commission_rate,
      monetization_type: product.monetization_type,
      sponsored: product.sponsored,
      estimated_commission: estimatedCommission(product.price, product.commission_rate),
      ts: Date.now(),
    });

    return NextResponse.json({ affiliate_url: product.affiliate_url });
  } catch (err) {
    console.error("[track] error", err);
    return NextResponse.json({ error: "falha ao registrar clique" }, { status: 500 });
  }
}
