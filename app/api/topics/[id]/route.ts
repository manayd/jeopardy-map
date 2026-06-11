import { NextResponse } from "next/server";
import {
  findTopic,
  loadTopicTree,
  type RawClue,
  type TreeTopic,
} from "@/lib/topic-tree";

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

const normalizeTopic = (topic: TreeTopic): NormalizedTopic => ({
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
      children: [],
    })) ?? [],
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const { id } = await Promise.resolve(params);
    const tree = await loadTopicTree();
    const target = findTopic(tree, id);

    if (!target) {
      return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    }

    const normalized = normalizeTopic(target);
    return NextResponse.json(normalized, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load topics dataset." },
      { status: 500 },
    );
  }
}
