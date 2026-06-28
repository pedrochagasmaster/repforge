import { NextResponse } from "next/server";
import { cropRegion } from "@/lib/image";
import { describeCrop } from "@/lib/ai";
import { getUpload } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

// Manual-crop fallback (spec §9.1.2): user drags a box, we extract attributes
// for just that region. Never blocks the flow.
export async function POST(req: Request) {
  try {
    const { upload_id, region } = (await req.json()) as {
      upload_id?: string;
      region?: [number, number, number, number];
    };
    if (!upload_id || !region) {
      return NextResponse.json({ error: "upload_id e region obrigatórios" }, { status: 400 });
    }
    const up = getUpload(upload_id);
    if (!up) {
      return NextResponse.json({ error: "upload expirado, envie o print de novo" }, { status: 404 });
    }
    const crop = await cropRegion(up.buffer, region);
    const item = await describeCrop(crop.base64);
    if (!item) {
      return NextResponse.json({ error: "não consegui identificar a peça" }, { status: 422 });
    }
    item.bbox = region;
    return NextResponse.json({ item });
  } catch (err) {
    console.error("[crop] error", err);
    return NextResponse.json({ error: "falha ao recortar", detail: String(err) }, { status: 500 });
  }
}
