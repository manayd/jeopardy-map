import path from "node:path";
import Database from "better-sqlite3";

export type ClueRow = {
  prompt: string;
  answer: string;
  round: number;
  value: number;
  daily_double_value: number;
  air_date: string;
  category: string;
};

export type CategoryRow = {
  id: string;
  title: string;
  clue_count: number;
};

const DB_PATH = path.join(process.cwd(), "data", "processed", "clues.db");

// Cached on globalThis so dev-mode module reloads reuse the same handle.
const globalForDb = globalThis as unknown as {
  __clueDb?: Database.Database;
};

export function getClueDb(): Database.Database {
  if (!globalForDb.__clueDb) {
    globalForDb.__clueDb = new Database(DB_PATH, {
      readonly: true,
      fileMustExist: true,
    });
  }
  return globalForDb.__clueDb;
}

export function getCategory(id: string): CategoryRow | undefined {
  return getClueDb()
    .prepare("SELECT id, title, clue_count FROM categories WHERE id = ?")
    .get(id) as CategoryRow | undefined;
}

/**
 * Every category row carries its topic/subtopic/group assignment, so any
 * tree node maps to a simple WHERE clause — the full archive is reachable
 * from every node, not just the capped category lists in topics.json.
 */
type NodeFilter = {
  clause: string;
  params: string[];
};

function filterForNode(nodeId: string): NodeFilter {
  if (nodeId === "root") return { clause: "", params: [] };
  if (nodeId.startsWith("cat:")) {
    return { clause: "WHERE clues.category_id = ?", params: [nodeId] };
  }
  if (nodeId.startsWith("sub:")) {
    return { clause: "WHERE categories.subtopic_id = ?", params: [nodeId] };
  }
  if (nodeId.startsWith("grp:")) {
    return { clause: "WHERE categories.group_id = ?", params: [nodeId] };
  }
  return { clause: "WHERE categories.topic_id = ?", params: [nodeId] };
}

export function countCluesForNode(nodeId: string): number {
  const { clause, params } = filterForNode(nodeId);
  const row = getClueDb()
    .prepare(
      `SELECT COUNT(*) AS n
       FROM clues
       JOIN categories ON categories.id = clues.category_id
       ${clause}`,
    )
    .get(...params) as { n: number };
  return row.n;
}

/**
 * Deterministic pseudo-shuffle multiplier. Multiplying clue ids by a large
 * odd seed-derived constant modulo 2^32 permutes them differently per seed,
 * so the same seed always yields the same "random" deck while different
 * seeds yield genuinely different ones.
 */
function shuffleMultiplier(seed: number): number {
  const s = Math.abs(Math.floor(seed)) % 65536;
  return s * 65536 + 32769;
}

/**
 * A seed-deterministic sample of the ENTIRE archive (not just tree-linked
 * categories). Clues referencing on-screen media ("seen here", audio/video
 * markers) are excluded since they're unanswerable as text.
 */
export function getDailyClues(seed: number, limit: number): ClueRow[] {
  return getClueDb()
    .prepare(
      `SELECT clues.prompt, clues.answer, clues.round, clues.value,
              clues.daily_double_value, clues.air_date,
              categories.title AS category
       FROM clues
       JOIN categories ON categories.id = clues.category_id
       WHERE clues.prompt NOT LIKE '%seen here%'
         AND clues.prompt NOT LIKE '%heard here%'
         AND clues.prompt NOT LIKE '%shown here%'
         AND clues.prompt NOT LIKE '%pictured%'
         AND clues.prompt NOT LIKE '%this clip%'
         AND clues.prompt NOT LIKE '%audio clue%'
         AND clues.prompt NOT LIKE '%video clue%'
         AND clues.prompt NOT LIKE '%[%'
       ORDER BY (clues.id * ${shuffleMultiplier(seed)}) % 4294967296
       LIMIT ?`,
    )
    .all(limit) as ClueRow[];
}

export function getCluesForNode(
  nodeId: string,
  options: { limit: number; offset: number; seed?: number },
): ClueRow[] {
  const { clause, params } = filterForNode(nodeId);
  const orderBy =
    options.seed !== undefined
      ? `(clues.id * ${shuffleMultiplier(options.seed)}) % 4294967296`
      : "clues.id";
  return getClueDb()
    .prepare(
      `SELECT clues.prompt, clues.answer, clues.round, clues.value,
              clues.daily_double_value, clues.air_date,
              categories.title AS category
       FROM clues
       JOIN categories ON categories.id = clues.category_id
       ${clause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit, options.offset) as ClueRow[];
}
