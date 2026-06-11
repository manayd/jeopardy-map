/**
 * Build data/processed/clues.db from jeopardy_clues.tsv.
 *
 * Loads the FULL archive (every clue, every category) into SQLite so the
 * app can query any slice without the per-category caps of clues.json.
 * Category ids use the exact same scheme as scripts/ingest-jeopardy.mjs
 * (cat:<slug>:<sha1-prefix> over the normalized category title) so the
 * topic tree in topics.json keeps pointing at the right rows.
 *
 * Usage: node scripts/build-clue-db.mjs [input.tsv] [output.db]
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";
import Database from "better-sqlite3";

const inputPath = process.argv[2] ?? "jeopardy_clues.tsv";
const outputPath = process.argv[3] ?? "data/processed/clues.db";

const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const parseIntSafe = (value) => {
  const parsed = parseInt(String(value ?? "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const slugify = (value) =>
  normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const categoryId = (value) => {
  const slug = slugify(value);
  const hash = crypto.createHash("sha1").update(value).digest("hex").slice(0, 6);
  return `cat:${slug}:${hash}`;
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.rmSync(outputPath, { force: true });

const db = new Database(outputPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = OFF");

db.exec(`
  CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    clue_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE clues (
    id INTEGER PRIMARY KEY,
    category_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    answer TEXT NOT NULL,
    round INTEGER NOT NULL DEFAULT 0,
    value INTEGER NOT NULL DEFAULT 0,
    daily_double_value INTEGER NOT NULL DEFAULT 0,
    air_date TEXT NOT NULL DEFAULT ''
  );
`);

const insertClue = db.prepare(`
  INSERT INTO clues (category_id, prompt, answer, round, value, daily_double_value, air_date)
  VALUES (@category_id, @prompt, @answer, @round, @value, @daily_double_value, @air_date)
`);

const categories = new Map();
let total = 0;
let skipped = 0;
let batch = [];
const BATCH_SIZE = 5000;

const insertBatch = db.transaction((rows) => {
  for (const row of rows) insertClue.run(row);
});

const flush = () => {
  if (batch.length) {
    insertBatch(batch);
    batch = [];
  }
};

const rl = readline.createInterface({
  input: fs.createReadStream(inputPath),
  crlfDelay: Infinity,
});

let headers = null;
for await (const line of rl) {
  if (!line.trim()) continue;
  if (!headers) {
    headers = line.split("\t").map((h) => h.trim());
    continue;
  }
  const parts = line.split("\t");
  if (parts.length !== headers.length) {
    skipped += 1;
    continue;
  }
  const row = Object.fromEntries(headers.map((key, idx) => [key, parts[idx]]));

  const category = normalize(row.category);
  const prompt = normalize(row.answer);
  const answer = normalize(row.question);
  if (!category || !prompt || !answer) {
    skipped += 1;
    continue;
  }

  let cat = categories.get(category);
  if (!cat) {
    cat = { id: categoryId(category), title: category, count: 0 };
    categories.set(category, cat);
  }
  cat.count += 1;

  batch.push({
    category_id: cat.id,
    prompt,
    answer,
    round: parseIntSafe(row.round),
    value: parseIntSafe(row.clue_value),
    daily_double_value: parseIntSafe(row.daily_double_value),
    air_date: normalize(row.air_date),
  });
  total += 1;
  if (batch.length >= BATCH_SIZE) flush();
}
flush();

const insertCategory = db.prepare(
  "INSERT INTO categories (id, title, clue_count) VALUES (?, ?, ?)",
);
db.transaction(() => {
  for (const cat of categories.values()) {
    insertCategory.run(cat.id, cat.title, cat.count);
  }
})();

db.exec("CREATE INDEX idx_clues_category ON clues(category_id);");
db.pragma("optimize");
// Leave the file in rollback-journal mode so readonly consumers don't need
// to create -wal/-shm sidecar files.
db.pragma("journal_mode = DELETE");
db.close();

const sizeMb = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
console.log(
  `Built ${outputPath} (${sizeMb} MB): ${total} clues across ${categories.size} categories (${skipped} rows skipped).`,
);
