/**
 * Generate config/category-overrides-auto.json — rule-derived topic fixes.
 *
 * The keyword matcher uses substring matching, which misfiles thousands of
 * categories through accidents like "COOKING" ⊃ "KING" (→ history) or
 * "WORD ORIGINS" ⊃ "GIN" (→ food & drink). Two classes of fix:
 *
 * 1. Bogus substring matches: the matched rule has NO keyword that starts
 *    at a word boundary in the title. Reassign using the first rule that
 *    DOES have a word-boundary match (else misc).
 * 2. Entertainment titles in history: "FILMS OF THE '90s"-style categories
 *    legitimately match history's decade keywords but are clearly
 *    pop-culture by their leading noun.
 *
 * The curated config/category-overrides.json always wins over this file.
 * Deterministic: regenerating after rule changes is safe.
 *
 * Usage: node scripts/generate-auto-overrides.mjs
 * Requires data/processed/clues.db (run `npm run db:build` first).
 */
import fs from "node:fs";
import Database from "better-sqlite3";
import { createClassifier, loadOverrides, loadRules, normalize } from "./lib/classify.mjs";

const rules = loadRules();
const curated = loadOverrides({ includeAuto: false });
const { topicRules } = rules;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const boundaryRegexes = new Map(
  topicRules.map((rule) => [
    rule.id,
    rule.keywords.map((k) => new RegExp(`(?<![A-Z0-9])${escapeRegExp(k)}`)),
  ]),
);

const firstBoundaryMatch = (haystack) => {
  for (const rule of topicRules) {
    if (rule.id === "misc") continue;
    if (boundaryRegexes.get(rule.id).some((re) => re.test(haystack))) return rule.id;
  }
  return "misc";
};

const classifier = createClassifier(rules, curated);

const ENTERTAINMENT = /(?:^|\W)(FILMS?|MOVIES?|TV|TELEVISION|MUSIC|SONGS?|ALBUMS?|SITCOMS?|BANDS?)(?:\W|$)/;

const db = new Database("data/processed/clues.db", { readonly: true });
const categories = db.prepare("SELECT title FROM categories").all();

const overrides = {};
let bogusCount = 0;
let entertainmentCount = 0;

for (const { title } of categories) {
  const haystack = normalize(title).toUpperCase();
  if (curated[haystack]) continue;

  const matched = classifier.matchTopic(title);
  if (matched.id === "misc") continue;

  const hasBoundaryHit = boundaryRegexes.get(matched.id).some((re) => re.test(haystack));
  if (!hasBoundaryHit) {
    overrides[haystack] = firstBoundaryMatch(haystack);
    bogusCount += 1;
    continue;
  }

  if (matched.id === "history" && ENTERTAINMENT.test(haystack)) {
    overrides[haystack] = "pop-culture";
    entertainmentCount += 1;
  }
}

const sorted = Object.fromEntries(
  Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)),
);
fs.writeFileSync(
  "config/category-overrides-auto.json",
  JSON.stringify(sorted, null, 2) + "\n",
);
console.log(
  `Wrote ${Object.keys(sorted).length} auto overrides ` +
    `(${bogusCount} bogus-substring fixes, ${entertainmentCount} entertainment-in-history).`,
);
