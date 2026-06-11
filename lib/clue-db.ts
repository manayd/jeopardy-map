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

export function countCluesForCategories(categoryIds: string[]): number {
  if (!categoryIds.length) return 0;
  const placeholders = categoryIds.map(() => "?").join(",");
  const row = getClueDb()
    .prepare(`SELECT COUNT(*) AS n FROM clues WHERE category_id IN (${placeholders})`)
    .get(...categoryIds) as { n: number };
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

export function getCluesForCategories(
  categoryIds: string[],
  options: { limit: number; offset: number; seed?: number },
): ClueRow[] {
  if (!categoryIds.length) return [];
  const placeholders = categoryIds.map(() => "?").join(",");
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
       WHERE clues.category_id IN (${placeholders})
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(...categoryIds, options.limit, options.offset) as ClueRow[];
}
