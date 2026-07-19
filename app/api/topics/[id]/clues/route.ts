import { NextResponse } from "next/server";
import {
  countCluesForNode,
  getCategory,
  getCluesForNode,
  type ClueFormat,
} from "@/lib/clue-db";
import { findTopic, loadTopicTree } from "@/lib/topic-tree";

const VALID_FORMATS = new Set<ClueFormat>(["standard", "wordplay", "fill-in", "media"]);

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

    // Optional filters: ?minValue=800 (hard mode) and ?format=standard,fill-in
    const minValue = (() => {
      const parsed = Number(url.searchParams.get("minValue"));
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
    })();
    const formats = (() => {
      const raw = url.searchParams.get("format");
      if (!raw) return undefined;
      const parsed = raw
        .split(",")
        .map((f) => f.trim())
        .filter((f): f is ClueFormat => VALID_FORMATS.has(f as ClueFormat));
      return parsed.length > 0 ? parsed : undefined;
    })();

    let title: string;

    if (id.startsWith("cat:")) {
      const category = getCategory(id);
      if (!category) {
        return NextResponse.json({ error: "Category not found." }, { status: 404 });
      }
      title = category.title;
    } else if (id.startsWith("subj:") || id.startsWith("canon:")) {
      const subject = id.slice(id.indexOf(":") + 1);
      if (id === "canon:all") {
        title = "The Jeopardy Canon";
      } else {
        const tree = await loadTopicTree();
        const topic = findTopic(tree, subject);
        if (!topic) {
          return NextResponse.json({ error: "Subject not found." }, { status: 404 });
        }
        title = id.startsWith("canon:") ? `${topic.title} Canon` : topic.title;
      }
    } else {
      const tree = await loadTopicTree();
      const topic = findTopic(tree, id);
      if (!topic) {
        return NextResponse.json({ error: "Topic not found." }, { status: 404 });
      }
      title = topic.title;
    }

    const total = countCluesForNode(id, { minValue, formats });
    const clues = getCluesForNode(id, { limit, offset, seed, minValue, formats });

    return NextResponse.json({ id, title, total, offset, limit, clues });
  } catch {
    return NextResponse.json(
      { error: "Unable to load clues dataset." },
      { status: 500 },
    );
  }
}
