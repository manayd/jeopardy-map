import fs from "node:fs/promises";
import path from "node:path";

export type RawClue = {
  prompt?: string;
  answer?: string;
  question?: string;
  air_date?: string;
  round?: number;
  value?: number;
  daily_double_value?: number;
  category?: string;
};

export type TreeTopic = {
  id: string;
  title: string;
  summary: string;
  clueSamples?: RawClue[];
  sampleClues?: RawClue[];
  children?: TreeTopic[];
  childCount?: number;
};

// Cached on globalThis so dev-mode module reloads don't re-parse the 15MB
// tree on every request.
const globalForTree = globalThis as unknown as {
  __topicTree?: Promise<TreeTopic>;
};

export function loadTopicTree(): Promise<TreeTopic> {
  if (!globalForTree.__topicTree) {
    const filePath = path.join(process.cwd(), "data", "processed", "topics.json");
    globalForTree.__topicTree = fs
      .readFile(filePath, "utf8")
      .then((raw) => JSON.parse(raw) as TreeTopic);
    globalForTree.__topicTree.catch(() => {
      globalForTree.__topicTree = undefined;
    });
  }
  return globalForTree.__topicTree;
}

export function findTopic(topic: TreeTopic, id: string): TreeTopic | null {
  if (topic.id === id) return topic;
  for (const child of topic.children ?? []) {
    const found = findTopic(child, id);
    if (found) return found;
  }
  return null;
}
