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
  children?: RawTopic[];
};

type CluesFile = {
  generated_at: string;
  max_per_category: number;
  categories: Record<
    string,
    {
      id: string;
      title: string;
      total_count: number;
      clues: RawClue[];
    }
  >;
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

const findTopic = (topic: RawTopic, id: string): RawTopic | null => {
  if (topic.id === id) return topic;
  for (const child of topic.children ?? []) {
    const found = findTopic(child, id);
    if (found) return found;
  }
  return null;
};

const collectCategoryIds = (topic: RawTopic): string[] => {
  const ids: string[] = [];
  const walk = (node: RawTopic) => {
    for (const child of node.children ?? []) {
      if (child.id.startsWith("cat:")) {
        ids.push(child.id);
      } else {
        walk(child);
      }
    }
  };
  walk(topic);
  return ids;
};

const parseLimit = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
};

const parseOffset = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.floor(parsed), 0);
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const { id } = await Promise.resolve(params);
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"), 8, 50);
    const offset = parseOffset(url.searchParams.get("offset"));

    const cluesPath = path.join(process.cwd(), "data", "processed", "clues.json");
    const cluesRaw = await fs.readFile(cluesPath, "utf8");
    const cluesData = JSON.parse(cluesRaw) as CluesFile;

    if (id.startsWith("cat:")) {
      const bucket = cluesData.categories[id];
      if (!bucket) {
        return NextResponse.json({ error: "Category not found." }, { status: 404 });
      }
      const total = bucket.clues.length;
      const slice = bucket.clues.slice(offset, offset + limit).map(normalizeClue);
      return NextResponse.json({
        id: bucket.id,
        title: bucket.title,
        total,
        offset,
        limit,
        clues: slice,
      });
    }

    const topicsPath = path.join(process.cwd(), "data", "processed", "topics.json");
    const topicsRaw = await fs.readFile(topicsPath, "utf8");
    const topicsData = JSON.parse(topicsRaw) as RawTopic;
    const topic = findTopic(topicsData, id);

    if (!topic) {
      return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    }

    const categoryIds = collectCategoryIds(topic);
    const allClues = categoryIds.flatMap((id) => cluesData.categories[id]?.clues ?? []);
    const total = allClues.length;
    const slice = allClues.slice(offset, offset + limit).map(normalizeClue);

    return NextResponse.json({
      id: topic.id,
      title: topic.title,
      total,
      offset,
      limit,
      clues: slice,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load clues dataset." },
      { status: 500 },
    );
  }
}
