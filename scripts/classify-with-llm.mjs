/**
 * classify-with-llm.mjs
 *
 * Uses Claude via AWS Bedrock to classify Jeopardy categories that keyword
 * matching couldn't handle. Outputs a category-overrides.json file that the
 * ingest script can use to place categories into the correct topic.
 *
 * Usage: node scripts/classify-with-llm.mjs
 *
 * Env vars:
 *   AWS_REGION          – Bedrock region (default: us-east-1)
 *   BATCH_SIZE          – categories per LLM call (default: 40)
 *   CONCURRENCY         – parallel API calls (default: 3)
 *   MAX_CATEGORIES      – cap for testing (default: all)
 *   OVERRIDES_PATH      – output path (default: config/category-overrides.json)
 */

import fs from "node:fs";
import path from "node:path";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 40);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
const MAX_CATEGORIES = Number(process.env.MAX_CATEGORIES ?? Infinity);
const OVERRIDES_PATH =
  process.env.OVERRIDES_PATH ?? "config/category-overrides.json";
const MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0";

// ── Load existing rules to figure out what's unclassified ───────────────

const topicRules = JSON.parse(fs.readFileSync("config/topic-rules.json", "utf8"));
const categories = JSON.parse(
  fs.readFileSync("data/processed/categories.json", "utf8"),
);

const normalize = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toUpperCase();

function matchTopic(category) {
  const haystack = normalize(category);
  for (const rule of topicRules) {
    if (rule.id === "misc") continue;
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.id;
    }
  }
  return "misc";
}

// Build list of unclassified categories
const miscCategories = categories
  .filter((c) => matchTopic(c.title) === "misc")
  .sort((a, b) => b.count - a.count)
  .slice(0, MAX_CATEGORIES);

console.log(`Found ${miscCategories.length} unclassified categories to process`);

// ── Build the taxonomy description for the prompt ───────────────────────

const topicList = topicRules
  .filter((r) => r.id !== "misc")
  .map((r) => `- ${r.id}: ${r.title} — ${r.summary}`)
  .join("\n");

// Also load subtopic rules for better classification
const subtopicRules = JSON.parse(
  fs.readFileSync("config/subtopic-rules.json", "utf8"),
);

const subtopicList = Object.entries(subtopicRules)
  .filter(([topicId]) => topicId !== "misc")
  .map(([topicId, subs]) => {
    const subDescs = subs
      .filter((s) => s.keywords?.length > 0)
      .map((s) => `  - ${topicId}/${s.id}: ${s.title}`)
      .join("\n");
    return subDescs;
  })
  .filter(Boolean)
  .join("\n");

// ── Bedrock client ──────────────────────────────────────────────────────

const client = new BedrockRuntimeClient({ region: REGION });

async function classifyBatch(batch) {
  const catList = batch
    .map((c) => {
      const sample =
        c.sampleClues?.[0]
          ? ` | Sample: "${c.sampleClues[0].prompt}" → "${c.sampleClues[0].answer}"`
          : "";
      return `${c.title} (${c.count} clues)${sample}`;
    })
    .join("\n");

  const prompt = `You are classifying Jeopardy categories into a topic taxonomy.

TOPICS:
${topicList}

SUBTOPICS:
${subtopicList}

For each category below, output ONLY a JSON array of objects with "title" (exact category title) and "topic" (the topic id from the list above). Choose the best-fitting topic. Use "potpourri" only for categories that truly mix multiple topics (like "GRAB BAG" or "BEFORE & AFTER").

CATEGORIES:
${catList}

Respond with ONLY valid JSON — an array of objects. No markdown, no explanation.`;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body,
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text = responseBody.content[0].text;

  // Extract JSON from response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("Failed to parse response:", text.slice(0, 200));
    return [];
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("JSON parse error:", e.message, text.slice(0, 200));
    return [];
  }
}

// ── Process in batches with concurrency ─────────────────────────────────

const batches = [];
for (let i = 0; i < miscCategories.length; i += BATCH_SIZE) {
  batches.push(miscCategories.slice(i, i + BATCH_SIZE));
}

console.log(
  `Processing ${batches.length} batches of ~${BATCH_SIZE} categories (concurrency: ${CONCURRENCY})`,
);

// Load existing overrides if resuming
let overrides = {};
if (fs.existsSync(OVERRIDES_PATH)) {
  overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
  console.log(`Loaded ${Object.keys(overrides).length} existing overrides`);
}

const validTopicIds = new Set(topicRules.map((r) => r.id));

let processed = 0;
let classified = 0;
let errors = 0;

async function processBatch(batch, batchIdx) {
  // Skip categories we already have overrides for
  const needed = batch.filter((c) => !overrides[normalize(c.title)]);
  if (needed.length === 0) {
    processed += batch.length;
    return;
  }

  try {
    const results = await classifyBatch(needed);

    for (const result of results) {
      // Handle "topic/subtopic" format by extracting just the topic
      let topicId = result.topic;
      if (topicId && topicId.includes("/")) {
        topicId = topicId.split("/")[0];
      }
      if (result.title && topicId && validTopicIds.has(topicId) && topicId !== "misc") {
        overrides[normalize(result.title)] = topicId;
        classified++;
      }
    }

    processed += batch.length;
    // Save progress after each batch
    if (processed % (BATCH_SIZE * 5) === 0 || batchIdx === batches.length - 1) {
      fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2));
    }

    console.log(
      `  Batch ${batchIdx + 1}/${batches.length}: ${results.length} classified, total: ${classified}/${processed}`,
    );
  } catch (err) {
    errors++;
    processed += batch.length;
    console.error(`  Batch ${batchIdx + 1} error: ${err.message}`);
    if (err.message.includes("throttl") || err.message.includes("Too many")) {
      // Back off on throttling
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Run with concurrency limit
async function runAll() {
  let batchIdx = 0;

  async function worker() {
    while (batchIdx < batches.length) {
      const idx = batchIdx++;
      await processBatch(batches[idx], idx);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
}

const startTime = Date.now();
await runAll();
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

// Final save
fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2));

console.log(`\nDone in ${elapsed}s`);
console.log(`  Total overrides: ${Object.keys(overrides).length}`);
console.log(`  Newly classified: ${classified}`);
console.log(`  Errors: ${errors}`);
console.log(`  Saved to: ${OVERRIDES_PATH}`);
