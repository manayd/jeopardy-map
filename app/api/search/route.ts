import { NextResponse } from "next/server";
import { searchArchive } from "@/lib/clue-db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").slice(0, 80);
    if (!query.trim()) {
      return NextResponse.json({ answers: [], categories: [], clues: [] });
    }
    return NextResponse.json(searchArchive(query), {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=600" },
    });
  } catch {
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
