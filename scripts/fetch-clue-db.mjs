/**
 * Ensure data/processed/clues.db exists before `next build`.
 *
 * The database (~110MB) is gitignored — locally it's built from the TSV via
 * `npm run db:build`, but deploy environments (Vercel) don't have the TSV,
 * so they download the prebuilt file from the GitHub release instead.
 * After regenerating data locally, refresh the release asset with:
 *   gh release upload clue-db-v1 data/processed/clues.db --clobber
 */
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const DB_PATH = path.join(process.cwd(), "data", "processed", "clues.db");
const RELEASE_URL =
  "https://github.com/manayd/jeopardy-map/releases/download/clue-db-v1/clues.db";
const MIN_PLAUSIBLE_BYTES = 50 * 1024 * 1024;

if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size >= MIN_PLAUSIBLE_BYTES) {
  console.log(`clues.db present (${(fs.statSync(DB_PATH).size / 1e6).toFixed(0)}MB) — skipping download.`);
  process.exit(0);
}

console.log(`Downloading clue database from ${RELEASE_URL} …`);
const response = await fetch(RELEASE_URL);
if (!response.ok || !response.body) {
  console.error(`Download failed: HTTP ${response.status}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const tmpPath = `${DB_PATH}.download`;
await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tmpPath));

const size = fs.statSync(tmpPath).size;
if (size < MIN_PLAUSIBLE_BYTES) {
  fs.rmSync(tmpPath, { force: true });
  console.error(`Downloaded file is implausibly small (${size} bytes) — aborting.`);
  process.exit(1);
}

fs.renameSync(tmpPath, DB_PATH);
console.log(`clues.db downloaded (${(size / 1e6).toFixed(0)}MB).`);
