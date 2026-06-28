import { NextResponse } from "next/server";
import { recordFeedback } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { search_id, product_id, value } = (await req.json()) as {
      search_id?: string;
      product_id?: string;
      value?: "looks_like" | "not_like";
    };
    if (value !== "looks_like" && value !== "not_like") {
      return NextResponse.json({ error: "feedback inválido" }, { status: 400 });
    }
    recordFeedback({ search_id: search_id ?? "", product_id, value, ts: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback] error", err);
    return NextResponse.json({ error: "falha ao registrar feedback" }, { status: 500 });
  }
}
