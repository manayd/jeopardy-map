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

type NormalizedClue = {
  prompt: string;
  answer: string;
  air_date?: string;
  round?: number;
  value?: number;
  daily_double_value?: number;
  category?: string;
};

type NormalizedTopic = {
  id: string;
  title: string;
  summary: string;
  clueSamples: NormalizedClue[];
  childCount: number;
  children: NormalizedTopic[];
};

const normalizeClue = (clue: RawClue): NormalizedClue => ({
  prompt: clue.prompt ?? clue.answer ?? "",
  answer: clue.answer ?? clue.question ?? "",
  air_date: clue.air_date,
  round: clue.round,
  value: clue.value,
  daily_double_value: clue.daily_double_value,
  category: clue.category,
});

const normalizeTopic = (topic: RawTopic): NormalizedTopic => ({
  id: topic.id,
  title: topic.title,
  summary: topic.summary,
  clueSamples: (topic.clueSamples ?? topic.sampleClues ?? []).map(normalizeClue),
  childCount: topic.childCount ?? topic.children?.length ?? 0,
  children: topic.children?.map(normalizeTopic) ?? [],
});

/** Recursively collapse nodes that have exactly one child by hoisting grandchildren up. */
function collapseOnlyChildren(topic: NormalizedTopic): NormalizedTopic {
  if (!topic.children.length) return topic;

  // Collapse children bottom-up first
  let children = topic.children.map(collapseOnlyChildren);

  // If this node has exactly 1 child, skip that child and use its children instead.
  // Repeat until we have 0 or 2+ children (handles chains of singletons).
  while (children.length === 1 && children[0].children.length > 0) {
    children = children[0].children.map(collapseOnlyChildren);
  }

  return { ...topic, children, childCount: children.length };
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "processed", "topics.json");
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as RawTopic;
    const normalized = collapseOnlyChildren(normalizeTopic(parsed));
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
