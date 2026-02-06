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
  children:
    topic.children?.map((child) => ({
      id: child.id,
      title: child.title,
      summary: child.summary,
      childCount: child.childCount ?? child.children?.length ?? 0,
      clueSamples: (child.clueSamples ?? child.sampleClues ?? []).map(normalizeClue),
    })) ?? [],
});

const findTopic = (topic: RawTopic, id: string): RawTopic | null => {
  if (topic.id === id) return topic;
  for (const child of topic.children ?? []) {
    const found = findTopic(child, id);
    if (found) return found;
  }
  return null;
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const { id } = await Promise.resolve(params);
    const filePath = path.join(process.cwd(), "data", "processed", "topics.json");
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as RawTopic;
    const target = findTopic(parsed, id);

    if (!target) {
      return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    }

    const normalized = normalizeTopic(target);
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
