import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

type RawClue = {
  prompt?: string;
  answer?: string;
  question?: string;
  air_date?: string;
  round?: number;
  value?: number;
  daily_double_value?: number;
  category?: string;
};

type RawTopic = {
  id: string;
  title: string;
  summary: string;
  clueSamples?: RawClue[];
  sampleClues?: RawClue[];
  children?: RawTopic[];
  childCount?: number;
};

const normalizeClue = (clue: RawClue) => ({
  prompt: clue.prompt ?? clue.answer ?? "",
  answer: clue.answer ?? clue.question ?? "",
  air_date: clue.air_date,
  round: clue.round,
  value: clue.value,
  daily_double_value: clue.daily_double_value,
  category: clue.category,
});

const normalizeTopic = (topic: RawTopic) => ({
  id: topic.id,
  title: topic.title,
  summary: topic.summary,
  clueSamples: (topic.clueSamples ?? topic.sampleClues ?? []).map(normalizeClue),
  childCount: topic.childCount ?? topic.children?.length ?? 0,
  children: topic.children?.map(normalizeTopic) ?? [],
});

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "processed", "topics.json");
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as RawTopic;
    const normalized = normalizeTopic(parsed);
    return NextResponse.json(normalized, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load topics dataset." },
      { status: 500 },
    );
  }
}
