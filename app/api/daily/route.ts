import { NextResponse } from "next/server";
import { getDailyClues } from "@/lib/clue-db";

const QUIZ_SIZE = 20;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function serverDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    // The client sends its local date so the quiz rolls over at the user's
    // midnight, not the server's.
    const requested = url.searchParams.get("date");
    const date = requested && DATE_PATTERN.test(requested) ? requested : serverDate();
    const seed = Number(date.replaceAll("-", ""));

    const clues = getDailyClues(seed, QUIZ_SIZE);
    // Easy-to-hard ramp: single round before double, low values first.
    clues.sort((a, b) => a.round - b.round || a.value - b.value);

    // A given date's quiz never changes, so let the CDN serve it: only the
    // first request per date pays the serverless cold start.
    return NextResponse.json(
      { date, clues },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load the daily quiz." },
      { status: 500 },
    );
  }
}
