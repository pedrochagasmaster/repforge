import { NextResponse } from "next/server";
import { processUpload } from "@/lib/image";
import { detectGarments } from "@/lib/ai";
import { saveUpload } from "@/lib/store";
import type { AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 10 * 1024 * 1024; // spec §11.1
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing image" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "imagem acima de 10MB" }, { status: 413 });
    }
    if (file.type && !ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: "formato inválido (use JPG, PNG ou WEBP)" },
        { status: 415 },
      );
    }

    const input = Buffer.from(await file.arrayBuffer());
    const processed = await processUpload(input);
    // Keep the processed image so manual crop can re-extract from it later.
    const uploadId = saveUpload(
      Buffer.from(processed.base64, "base64"),
      processed.width,
      processed.height,
    );

    const items = await detectGarments(processed.base64);

    const body: AnalyzeResponse = {
      upload_id: uploadId,
      image_data_url: processed.dataUrl,
      width: processed.width,
      height: processed.height,
      items,
      fallback: items.length === 0,
      ms: Date.now() - started,
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[analyze] error", err);
    return NextResponse.json(
      { error: "falha ao analisar a imagem", detail: String(err) },
      { status: 500 },
    );
  }
}
