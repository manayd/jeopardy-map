import { NextResponse } from "next/server";
import { getAnswerByKey, getCluesForAnswer } from "@/lib/clue-db";

const parseLimit = (value: string | null, fallback: number, max: number) => {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
};

const parseOffset = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.floor(parsed), 0);
};

/** One canonical answer and every clue that has pointed at it. */
export async function GET(
  request: Request,
  { params }: { params: { key: string } | Promise<{ key: string }> },
) {
  try {
    const { key } = await Promise.resolve(params);
    const decoded = decodeURIComponent(key);
    const answer = getAnswerByKey(decoded);
    if (!answer) {
      return NextResponse.json({ error: "Answer not found." }, { status: 404 });
    }
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"), 50, 100);
    const offset = parseOffset(url.searchParams.get("offset"));
    return NextResponse.json(
      {
        ...answer,
        offset,
        limit,
        clues: getCluesForAnswer(decoded, limit, offset),
      },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load this answer." },
      { status: 500 },
    );
  }
}
