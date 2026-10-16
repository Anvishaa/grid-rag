import { NextResponse } from "next/server";
import { retrieve, type Mode } from "../../../lib/retrieve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES: Mode[] = ["keyword", "vector", "hybrid"];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = String(body.query ?? "").trim();
    const mode = body.mode as Mode;
    const k = Math.min(Math.max(Number(body.k) || 5, 1), 20);

    if (!query || query.length > 500) {
      return NextResponse.json({ error: "Query must be 1-500 characters." }, { status: 400 });
    }
    if (!MODES.includes(mode)) {
      return NextResponse.json({ error: "mode must be keyword, vector or hybrid." }, { status: 400 });
    }

    const t0 = Date.now();
    const hits = await retrieve(query, mode, k);
    return NextResponse.json({ mode, ms: Date.now() - t0, hits });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
