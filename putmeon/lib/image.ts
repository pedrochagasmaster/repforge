import sharp from "sharp";

export interface ProcessedImage {
  base64: string; // raw base64 (no data: prefix)
  dataUrl: string;
  width: number;
  height: number;
  mimeType: "image/jpeg";
}

// Resize, strip EXIF metadata (sharp drops metadata unless withMetadata is set),
// and re-encode. Keeps the long edge <= 1024 to cap vision cost (spec §13.3).
export async function processUpload(input: Buffer): Promise<ProcessedImage> {
  const pipeline = sharp(input)
    .rotate() // bake in orientation, then metadata is dropped on output
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 });

  const buf = await pipeline.toBuffer();
  const meta = await sharp(buf).metadata();
  const base64 = buf.toString("base64");
  return {
    base64,
    dataUrl: `data:image/jpeg;base64,${base64}`,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    mimeType: "image/jpeg",
  };
}

// Crop a normalized region [x,y,w,h] (0..1) out of an image buffer.
export async function cropRegion(
  input: Buffer,
  region: [number, number, number, number],
): Promise<ProcessedImage> {
  const meta = await sharp(input).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const left = Math.max(0, Math.round(region[0] * W));
  const top = Math.max(0, Math.round(region[1] * H));
  const width = Math.min(W - left, Math.round(region[2] * W));
  const height = Math.min(H - top, Math.round(region[3] * H));

  const buf = await sharp(input)
    .rotate()
    .extract({ left, top, width: Math.max(1, width), height: Math.max(1, height) })
    .jpeg({ quality: 85 })
    .toBuffer();

  const base64 = buf.toString("base64");
  const m = await sharp(buf).metadata();
  return {
    base64,
    dataUrl: `data:image/jpeg;base64,${base64}`,
    width: m.width ?? width,
    height: m.height ?? height,
    mimeType: "image/jpeg",
  };
}
