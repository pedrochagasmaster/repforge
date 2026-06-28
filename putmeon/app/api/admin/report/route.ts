import { NextResponse } from "next/server";
import { buildReport } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(buildReport());
}
