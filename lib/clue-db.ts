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

export type AnswerRow = {
  key: string;
  display: string;
  clue_count: number;
  subject_id: string;
};

export type ClueFormat = "standard" | "wordplay" | "fill-in" | "media";

const DB_PATH = path.join(process.cwd(), "data", "processed", "clues.db");

// Cached on globalThis so dev-mode module reloads reuse the same handle.
const globalForDb = globalThis as unknown as {
  __clueDb?: Database.Database;
};

/**
 * Deterministic per-seed shuffle key for a clue id (splitmix64 avalanche,
 * 53-bit output so it fits a JS/SQLite number). Registered as the SQL
 * function `shuffle_key(id, seed)` and used in ORDER BY: the same seed
 * always yields the same permutation, different seeds yield unrelated ones.
 *
 * Replaces a broken linear multiplier (`seed*2^16 + 32769`) under which any
 * clue whose id was divisible by 2^16 had the seed term vanish mod 2^32 —
 * freezing it near the top of every day's Daily quiz.
 */
const SK_C1 = BigInt("0x9e3779b97f4a7c15");
const SK_C2 = BigInt("0xd1b54a32d192ed03");
const SK_C3 = BigInt("0xbf58476d1ce4e5b9");
const SK_C4 = BigInt("0x94d049bb133111eb");
const SK_S30 = BigInt(30);
const SK_S27 = BigInt(27);
const SK_S31 = BigInt(31);
const SK_OUT = BigInt("0x1fffffffffffff"); // 53 bits — safe as a JS number

function shuffleKey(id: number, seed: number): number {
  let x =
    BigInt.asUintN(64, BigInt(id) * SK_C1) ^ BigInt.asUintN(64, BigInt(seed) * SK_C2);
  x = BigInt.asUintN(64, x);
  x ^= x >> SK_S30;
  x = BigInt.asUintN(64, x * SK_C3);
  x ^= x >> SK_S27;
  x = BigInt.asUintN(64, x * SK_C4);
  x ^= x >> SK_S31;
  return Number(x & SK_OUT);
}

export function getClueDb(): Database.Database {
  if (!globalForDb.__clueDb) {
    const db = new Database(DB_PATH, {
      readonly: true,
      fileMustExist: true,
    });
    db.function("shuffle_key", { deterministic: true }, (id: unknown, seed: unknown) =>
      shuffleKey(Number(id), Number(seed)),
    );
    globalForDb.__clueDb = db;
  }
  return globalForDb.__clueDb;
}

export function getCategory(id: string): CategoryRow | undefined {
  return getClueDb()
    .prepare("SELECT id, title, clue_count FROM categories WHERE id = ?")
    .get(id) as CategoryRow | undefined;
}

/**
 * Node ids map to WHERE conditions: tree nodes filter via category
 * assignments; `subj:` nodes filter on the clue-level subject (which also
 * covers clues rescued out of wordplay/misc categories by answer
 * propagation); `canon:` nodes are handled separately (one representative
 * clue per top answer).
 */
type NodeFilter = {
  conditions: string[];
  params: (string | number)[];
};

function filterForNode(nodeId: string): NodeFilter {
  if (nodeId === "root") return { conditions: [], params: [] };
  if (nodeId.startsWith("cat:")) {
    return { conditions: ["clues.category_id = ?"], params: [nodeId] };
  }
  if (nodeId.startsWith("sub:")) {
    return { conditions: ["categories.subtopic_id = ?"], params: [nodeId] };
  }
  if (nodeId.startsWith("grp:")) {
    return { conditions: ["categories.group_id = ?"], params: [nodeId] };
  }
  if (nodeId.startsWith("subj:")) {
    return { conditions: ["clues.subject_id = ?"], params: [nodeId.slice(5)] };
  }
  return { conditions: ["categories.topic_id = ?"], params: [nodeId] };
}

export type ClueQueryOptions = {
  limit: number;
  offset: number;
  seed?: number;
  /** Only clues worth at least this much (Final Jeopardy always qualifies). */
  minValue?: number;
  /** Restrict to these formats (e.g. ["standard","fill-in"]). */
  formats?: ClueFormat[];
};

function applyOptionFilters(
  filter: NodeFilter,
  options: { minValue?: number; formats?: ClueFormat[] },
): NodeFilter {
  const conditions = [...filter.conditions];
  const params = [...filter.params];
  if (options.minValue && options.minValue > 0) {
    conditions.push(
      "(clues.value >= ? OR clues.daily_double_value >= ? OR clues.round = 3)",
    );
    params.push(options.minValue, options.minValue);
  }
  if (options.formats && options.formats.length > 0) {
    conditions.push(
      `clues.format IN (${options.formats.map(() => "?").join(",")})`,
    );
    params.push(...options.formats);
  }
  return { conditions, params };
}

const whereClause = (filter: NodeFilter) =>
  filter.conditions.length ? `WHERE ${filter.conditions.join(" AND ")}` : "";

const isCanonNode = (nodeId: string) => nodeId.startsWith("canon:");

/** How many top answers a canon deck draws from. */
const CANON_SIZE = 100;

function canonAnswersSubquery(nodeId: string): { sql: string; params: string[] } {
  const subject = nodeId.slice("canon:".length);
  if (subject === "all") {
    return {
      sql: `(SELECT key FROM answers WHERE subject_id != ''
             ORDER BY clue_count DESC LIMIT ${CANON_SIZE})`,
      params: [],
    };
  }
  return {
    sql: `(SELECT key FROM answers WHERE subject_id = ?
           ORDER BY clue_count DESC LIMIT ${CANON_SIZE})`,
    params: [subject],
  };
}

export function countCluesForNode(
  nodeId: string,
  options: { minValue?: number; formats?: ClueFormat[] } = {},
): number {
  if (isCanonNode(nodeId)) {
    const canon = canonAnswersSubquery(nodeId);
    const row = getClueDb()
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT 1 FROM clues
           JOIN ${canon.sql} top ON top.key = clues.answer_key
           WHERE clues.format IN ('standard','fill-in')
           GROUP BY clues.answer_key
         )`,
      )
      .get(...canon.params) as { n: number };
    return row.n;
  }
  const filter = applyOptionFilters(filterForNode(nodeId), options);
  const row = getClueDb()
    .prepare(
      `SELECT COUNT(*) AS n
       FROM clues
       JOIN categories ON categories.id = clues.category_id
       ${whereClause(filter)}`,
    )
    .get(...filter.params) as { n: number };
  return row.n;
}

/**
 * A seed-deterministic sample of the ENTIRE archive. Media clues ("seen
 * here", audio/video markers) are excluded since they're unanswerable as
 * text — the format column computed at build time encodes exactly that.
 */
export function getDailyClues(seed: number, limit: number): ClueRow[] {
  return getClueDb()
    .prepare(
      `SELECT clues.prompt, clues.answer, clues.round, clues.value,
              clues.daily_double_value, clues.air_date,
              categories.title AS category
       FROM clues
       JOIN categories ON categories.id = clues.category_id
       WHERE clues.format != 'media'
       ORDER BY shuffle_key(clues.id, ?)
       LIMIT ?`,
    )
    .all(seed, limit) as ClueRow[];
}

export function getCluesForNode(nodeId: string, options: ClueQueryOptions): ClueRow[] {
  const seed = options.seed ?? 0;
  if (isCanonNode(nodeId)) {
    // One representative clue per top answer: SQLite's bare-column MIN()
    // picks the row achieving the minimum, so the representative follows
    // the seed. Wordplay/media clues make poor flashcards for a canonical
    // fact, so representatives come from standard/fill-in clues only.
    const canon = canonAnswersSubquery(nodeId);
    return getClueDb()
      .prepare(
        `SELECT clues.prompt, clues.answer, clues.round, clues.value,
                clues.daily_double_value, clues.air_date,
                categories.title AS category,
                MIN(shuffle_key(clues.id, ?)) AS ord
         FROM clues
         JOIN categories ON categories.id = clues.category_id
         JOIN ${canon.sql} top ON top.key = clues.answer_key
         WHERE clues.format IN ('standard','fill-in')
         GROUP BY clues.answer_key
         ORDER BY ord
         LIMIT ? OFFSET ?`,
      )
      .all(seed, ...canon.params, options.limit, options.offset) as ClueRow[];
  }
  const filter = applyOptionFilters(filterForNode(nodeId), options);
  const seeded = options.seed !== undefined;
  return getClueDb()
    .prepare(
      `SELECT clues.prompt, clues.answer, clues.round, clues.value,
              clues.daily_double_value, clues.air_date,
              categories.title AS category
       FROM clues
       JOIN categories ON categories.id = clues.category_id
       ${whereClause(filter)}
       ORDER BY ${seeded ? "shuffle_key(clues.id, ?)" : "clues.id"}
       LIMIT ? OFFSET ?`,
    )
    .all(
      ...filter.params,
      ...(seeded ? [seed] : []),
      options.limit,
      options.offset,
    ) as ClueRow[];
}

// ---------------------------------------------------------------------------
// Curriculum, canon, answers, and search
// ---------------------------------------------------------------------------

export function getSubjectCounts(): Array<{ subject_id: string; n: number }> {
  return getClueDb()
    .prepare(
      "SELECT subject_id, COUNT(*) AS n FROM clues GROUP BY subject_id ORDER BY n DESC",
    )
    .all() as Array<{ subject_id: string; n: number }>;
}

export function getCanonAnswers(subject: string, limit: number): AnswerRow[] {
  const where = subject === "all" ? "subject_id != ''" : "subject_id = ?";
  const params = subject === "all" ? [] : [subject];
  return getClueDb()
    .prepare(
      `SELECT key, display, clue_count, subject_id FROM answers
       WHERE ${where} ORDER BY clue_count DESC LIMIT ?`,
    )
    .all(...params, limit) as AnswerRow[];
}

export function getTopCategoriesForSubject(
  subject: string,
  limit: number,
): CategoryRow[] {
  return getClueDb()
    .prepare(
      `SELECT id, title, clue_count FROM categories
       WHERE topic_id = ? ORDER BY clue_count DESC LIMIT ?`,
    )
    .all(subject, limit) as CategoryRow[];
}

export function getAnswerByKey(key: string): AnswerRow | undefined {
  return getClueDb()
    .prepare("SELECT key, display, clue_count, subject_id FROM answers WHERE key = ?")
    .get(key) as AnswerRow | undefined;
}

export function getCluesForAnswer(
  key: string,
  limit: number,
  offset: number,
): ClueRow[] {
  return getClueDb()
    .prepare(
      `SELECT clues.prompt, clues.answer, clues.round, clues.value,
              clues.daily_double_value, clues.air_date,
              categories.title AS category
       FROM clues
       JOIN categories ON categories.id = clues.category_id
       WHERE clues.answer_key = ?
       ORDER BY clues.air_date DESC
       LIMIT ? OFFSET ?`,
    )
    .all(key, limit, offset) as ClueRow[];
}

export type SearchResults = {
  answers: AnswerRow[];
  categories: CategoryRow[];
  clues: Array<ClueRow & { subject_id: string }>;
};

/**
 * Archive search: FTS over clue text (match-only index, so tokens are
 * sanitized and the last one becomes a prefix), plus LIKE lookups over
 * answers and category titles. Clue hits rank by how canonical their
 * answer is — for studying, popular answers first beats bm25.
 */
export function searchArchive(query: string, limit = 20): SearchResults {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  if (tokens.length === 0) return { answers: [], categories: [], clues: [] };

  const db = getClueDb();
  const ftsQuery =
    tokens.slice(0, -1).join(" ") +
    (tokens.length > 1 ? " " : "") +
    tokens[tokens.length - 1] +
    "*";
  const joined = tokens.join(" ");

  const answers = db
    .prepare(
      `SELECT key, display, clue_count, subject_id FROM answers
       WHERE key LIKE ? OR key LIKE ?
       ORDER BY clue_count DESC LIMIT 10`,
    )
    .all(`${joined}%`, `% ${joined}%`) as AnswerRow[];

  const categories = db
    .prepare(
      `SELECT id, title, clue_count FROM categories
       WHERE title LIKE ? ORDER BY clue_count DESC LIMIT 10`,
    )
    .all(`%${joined}%`) as CategoryRow[];

  let clues: Array<ClueRow & { subject_id: string }> = [];
  try {
    clues = db
      .prepare(
        `SELECT clues.prompt, clues.answer, clues.round, clues.value,
                clues.daily_double_value, clues.air_date, clues.subject_id,
                categories.title AS category
         FROM clues
         JOIN categories ON categories.id = clues.category_id
         WHERE clues.id IN (SELECT rowid FROM clues_fts WHERE clues_fts MATCH ? LIMIT 400)
         ORDER BY COALESCE(
           (SELECT clue_count FROM answers a WHERE a.key = clues.answer_key), 0
         ) DESC
         LIMIT ?`,
      )
      .all(ftsQuery, limit) as Array<ClueRow & { subject_id: string }>;
  } catch {
    // Malformed FTS query (unlikely after sanitizing) — return other hits.
  }
  return { answers, categories, clues };
}
