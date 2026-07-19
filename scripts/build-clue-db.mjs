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
import Database from "better-sqlite3";
import {
  categoryId,
  createClassifier,
  loadOverrides,
  loadRules,
  normalize,
  parseIntSafe,
} from "./lib/classify.mjs";
import { answerKey, detectFormat } from "./lib/answers.mjs";

const inputPath = process.argv[2] ?? "jeopardy_clues.tsv";
const outputPath = process.argv[3] ?? "data/processed/clues.db";

// The TSV escapes embedded quotes as \" (and a few \'). Unescape for stored
// text — but NOT for the category string fed into categoryId(), which must
// hash the raw form to keep ids aligned with topics.json from the ingest.
const unescapeTsv = (value) => value.replace(/\\(["'])/g, "$1");

const classifier = createClassifier(loadRules(), loadOverrides());

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.rmSync(outputPath, { force: true });

const db = new Database(outputPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = OFF");

db.exec(`
  CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    clue_count INTEGER NOT NULL DEFAULT 0,
    topic_id TEXT NOT NULL DEFAULT 'misc',
    subtopic_id TEXT NOT NULL DEFAULT '',
    group_id TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE clues (
    id INTEGER PRIMARY KEY,
    category_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    answer TEXT NOT NULL,
    round INTEGER NOT NULL DEFAULT 0,
    value INTEGER NOT NULL DEFAULT 0,
    daily_double_value INTEGER NOT NULL DEFAULT 0,
    air_date TEXT NOT NULL DEFAULT '',
    answer_key TEXT NOT NULL DEFAULT '',
    subject_id TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT 'standard'
  );
  CREATE TABLE answers (
    key TEXT PRIMARY KEY,
    display TEXT NOT NULL,
    clue_count INTEGER NOT NULL DEFAULT 0,
    subject_id TEXT NOT NULL DEFAULT '',
    confidence REAL NOT NULL DEFAULT 0
  );
`);

const insertClue = db.prepare(`
  INSERT INTO clues (category_id, prompt, answer, round, value, daily_double_value, air_date, answer_key, format)
  VALUES (@category_id, @prompt, @answer, @round, @value, @daily_double_value, @air_date, @answer_key, @format)
`);

const categories = new Map();
// answer_key → { count, displays: Map<rawAnswer, n>, votes: Map<topicId, n> }
const answersIndex = new Map();
let total = 0;
let skipped = 0;
let batch = [];
const BATCH_SIZE = 5000;

// Answer subjects are only trusted with this much agreement.
const MIN_VOTES = 2;
const MIN_SHARE = 0.6;
const UNINFORMATIVE_TOPICS = new Set(["misc", "potpourri"]);

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
  const prompt = unescapeTsv(normalize(row.answer));
  const answer = unescapeTsv(normalize(row.question));
  if (!category || !prompt || !answer) {
    skipped += 1;
    continue;
  }

  let cat = categories.get(category);
  if (!cat) {
    const assignment = classifier.assign(category);
    cat = {
      id: categoryId(category),
      title: unescapeTsv(category),
      count: 0,
      topicId: assignment.topicId,
      subtopicId: assignment.subtopicId,
      groupId: assignment.groupId,
    };
    categories.set(category, cat);
  }
  cat.count += 1;

  const key = answerKey(answer);
  const format = detectFormat(cat.title, prompt);

  if (key) {
    let entry = answersIndex.get(key);
    if (!entry) {
      entry = { count: 0, displays: new Map(), votes: new Map() };
      answersIndex.set(key, entry);
    }
    entry.count += 1;
    entry.displays.set(answer, (entry.displays.get(answer) ?? 0) + 1);
    // Topical categories vote on the answer's subject. Wordplay categories
    // don't: their keyword-derived topic reflects the mechanic, not the
    // knowledge the clue tests.
    if (!UNINFORMATIVE_TOPICS.has(cat.topicId) && format !== "wordplay") {
      entry.votes.set(cat.topicId, (entry.votes.get(cat.topicId) ?? 0) + 1);
    }
  }

  batch.push({
    category_id: cat.id,
    prompt,
    answer,
    round: parseIntSafe(row.round),
    value: parseIntSafe(row.clue_value),
    daily_double_value: parseIntSafe(row.daily_double_value),
    air_date: normalize(row.air_date),
    answer_key: key,
    format,
  });
  total += 1;
  if (batch.length >= BATCH_SIZE) flush();
}
flush();

const insertCategory = db.prepare(
  `INSERT INTO categories (id, title, clue_count, topic_id, subtopic_id, group_id)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
db.transaction(() => {
  for (const cat of categories.values()) {
    insertCategory.run(cat.id, cat.title, cat.count, cat.topicId, cat.subtopicId, cat.groupId);
  }
})();

// ---------------------------------------------------------------------------
// Answer index + subject propagation.
//
// Each answer's subject is the majority topic of its clues in TOPICAL
// categories. That subject then rescues clues stuck in wordplay/misc/
// potpourri categories: the archive's organized half classifies the
// disorganized half through shared answers.
// ---------------------------------------------------------------------------
const insertAnswer = db.prepare(
  "INSERT INTO answers (key, display, clue_count, subject_id, confidence) VALUES (?, ?, ?, ?, ?)",
);
let propagatedAnswers = 0;
db.transaction(() => {
  for (const [key, entry] of answersIndex) {
    let display = "";
    let displayBest = 0;
    for (const [raw, n] of entry.displays) {
      if (n > displayBest || (n === displayBest && raw.length < display.length)) {
        display = raw;
        displayBest = n;
      }
    }
    let subject = "";
    let confidence = 0;
    let voteTotal = 0;
    let topTopic = "";
    let topVotes = 0;
    for (const [topic, n] of entry.votes) {
      voteTotal += n;
      if (n > topVotes) {
        topTopic = topic;
        topVotes = n;
      }
    }
    if (voteTotal >= MIN_VOTES && topVotes / voteTotal >= MIN_SHARE) {
      subject = topTopic;
      confidence = topVotes / voteTotal;
      propagatedAnswers += 1;
    }
    insertAnswer.run(key, display, entry.count, subject, confidence);
  }
})();

// Clue subject: topical categories keep their topic; wordplay/misc/potpourri
// clues inherit their answer's propagated subject, falling back to the
// category topic when the answer has none.
db.exec(`
  UPDATE clues SET subject_id = (
    SELECT CASE
      WHEN cat.topic_id NOT IN ('misc','potpourri') AND clues.format != 'wordplay'
        THEN cat.topic_id
      ELSE COALESCE(
        (SELECT NULLIF(a.subject_id, '') FROM answers a WHERE a.key = clues.answer_key),
        cat.topic_id
      )
    END
    FROM categories cat WHERE cat.id = clues.category_id
  );
`);

// Full-text search over clue text. External-content (no text duplication)
// plus detail=none/columnsize=0: a match-only index — no phrase queries or
// bm25, but a fraction of the size, which matters for the serverless bundle.
db.exec(`
  CREATE VIRTUAL TABLE clues_fts USING fts5(
    prompt, answer,
    content='clues', content_rowid='id',
    detail=none, columnsize=0
  );
  INSERT INTO clues_fts(rowid, prompt, answer) SELECT id, prompt, answer FROM clues;
  INSERT INTO clues_fts(clues_fts) VALUES('optimize');
`);

db.exec(`
  CREATE INDEX idx_clues_category ON clues(category_id);
  CREATE INDEX idx_clues_subject ON clues(subject_id);
  CREATE INDEX idx_clues_answer_key ON clues(answer_key);
  CREATE INDEX idx_answers_subject ON answers(subject_id, clue_count);
  CREATE INDEX idx_categories_topic ON categories(topic_id);
  CREATE INDEX idx_categories_subtopic ON categories(subtopic_id);
  CREATE INDEX idx_categories_group ON categories(group_id);
`);

const rescued = db
  .prepare(
    `SELECT COUNT(*) AS n FROM clues
     JOIN categories cat ON cat.id = clues.category_id
     WHERE (cat.topic_id IN ('misc','potpourri') OR clues.format = 'wordplay')
       AND clues.subject_id NOT IN ('misc','potpourri')`,
  )
  .get().n;
const bySubject = db
  .prepare(
    "SELECT subject_id, COUNT(*) AS n FROM clues GROUP BY subject_id ORDER BY n DESC",
  )
  .all();
const byFormat = db
  .prepare("SELECT format, COUNT(*) AS n FROM clues GROUP BY format ORDER BY n DESC")
  .all();

db.pragma("optimize");
// Leave the file in rollback-journal mode so readonly consumers don't need
// to create -wal/-shm sidecar files.
db.pragma("journal_mode = DELETE");
db.close();

const sizeMb = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
console.log(
  `Built ${outputPath} (${sizeMb} MB): ${total} clues across ${categories.size} categories (${skipped} rows skipped).`,
);
console.log(
  `Answers: ${answersIndex.size} keys, ${propagatedAnswers} with propagated subjects.`,
);
console.log(`Rescued clues (wordplay/misc/potpourri → real subject): ${rescued}`);
console.log("Clues by subject:", bySubject.map((r) => `${r.subject_id || "?"}:${r.n}`).join(" "));
console.log("Clues by format:", byFormat.map((r) => `${r.format}:${r.n}`).join(" "));
