import { NextResponse } from "next/server";
import {
  countCluesForCategories,
  getCategory,
  getCluesForCategories,
} from "@/lib/clue-db";
import { collectCategoryIds, findTopic, loadTopicTree } from "@/lib/topic-tree";

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

const parseSeed = (value: string | null) => {
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.abs(Math.floor(parsed));
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const { id } = await Promise.resolve(params);
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"), 8, 200);
    const offset = parseOffset(url.searchParams.get("offset"));
    // Optional: ?seed=N returns a deterministic pseudo-random ordering of the
    // full clue pool. Same seed, same deck; new seed, fresh deck.
    const seed = parseSeed(url.searchParams.get("seed"));

    let title: string;
    let categoryIds: string[];

    if (id.startsWith("cat:")) {
      const category = getCategory(id);
      if (!category) {
        return NextResponse.json({ error: "Category not found." }, { status: 404 });
      }
      title = category.title;
      categoryIds = [id];
    } else {
      const tree = await loadTopicTree();
      const topic = findTopic(tree, id);
      if (!topic) {
        return NextResponse.json({ error: "Topic not found." }, { status: 404 });
      }
      title = topic.title;
      categoryIds = collectCategoryIds(topic);
    }

    const total = countCluesForCategories(categoryIds);
    const clues = getCluesForCategories(categoryIds, { limit, offset, seed });

    return NextResponse.json({ id, title, total, offset, limit, clues });
  } catch {
    return NextResponse.json(
      { error: "Unable to load clues dataset." },
      { status: 500 },
    );
  }
}
