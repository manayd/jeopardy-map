import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";

const inputPath = process.argv[2] ?? "jeopardy_clues.tsv";
const outDir = process.argv[3] ?? "data/processed";
const maxSamplesPerCategory = Number(process.env.MAX_CATEGORY_SAMPLES ?? 20);
const maxSamplesPerTopic = Number(process.env.MAX_TOPIC_SAMPLES ?? 20);
const maxChildrenPerTopic = Number(process.env.MAX_TOPIC_CHILDREN ?? 12);
const maxSamplesPerSubtopic = Number(process.env.MAX_SUBTOPIC_SAMPLES ?? 20);
const maxChildrenPerSubtopic = Number(process.env.MAX_SUBTOPIC_CHILDREN ?? 10);
const maxSamplesPerCluster = Number(process.env.MAX_CLUSTER_SAMPLES ?? 10);
const maxChildrenPerCluster = Number(process.env.MAX_CLUSTER_CHILDREN ?? 18);
const maxCluesPerCategory = Number(process.env.MAX_CATEGORY_CLUES ?? 30);

const rulesPath = "config/topic-rules.json";
const topicRules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
const subtopicRules = JSON.parse(fs.readFileSync("config/subtopic-rules.json", "utf8"));
const clusterRules = JSON.parse(fs.readFileSync("config/cluster-rules.json", "utf8"));

const miscRule = topicRules.find((rule) => rule.id === "misc") ?? {
  id: "misc",
  title: "Miscellaneous",
  summary: "Topics that do not fit elsewhere.",
  keywords: [],
};

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

const matchTopic = (category) => {
  const haystack = normalize(category).toUpperCase();
  for (const rule of topicRules) {
    if (rule.id === "misc") continue;
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule;
    }
  }
  return miscRule;
};

const matchSubtopic = (topicId, category) => {
  const rules = subtopicRules[topicId];
  if (!rules || !rules.length) {
    return {
      id: `${topicId}-general`,
      title: "General",
      summary: "General subtopic grouping.",
      keywords: [],
    };
  }
  const haystack = normalize(category).toUpperCase();
  for (const rule of rules) {
    if (!rule.keywords?.length) continue;
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule;
    }
  }
  return rules.find((rule) => !rule.keywords?.length) ?? rules[rules.length - 1];
};

const matchCluster = (topicId, category) => {
  const rules = clusterRules[topicId] ?? clusterRules.default ?? [];
  if (!rules.length) {
    return { id: "general", title: "General", summary: "General grouping.", keywords: [] };
  }
  const haystack = normalize(category).toUpperCase();
  for (const rule of rules) {
    if (!rule.keywords?.length) continue;
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule;
    }
  }
  return rules.find((rule) => !rule.keywords?.length) ?? rules[rules.length - 1];
};

const categories = new Map();
const topics = new Map();
let total = 0;

const ensureTopic = (rule) => {
  if (!topics.has(rule.id)) {
    topics.set(rule.id, {
      id: rule.id,
      title: rule.title,
      summary: rule.summary,
      count: 0,
      categories: new Map(),
      sampleClues: [],
      subtopics: new Map(),
    });
  }
  return topics.get(rule.id);
};

const ensureSubtopic = (topicBucket, rule) => {
  if (!topicBucket.subtopics.has(rule.id)) {
    topicBucket.subtopics.set(rule.id, {
      id: `sub:${topicBucket.id}:${rule.id}`,
      title: rule.title,
      summary: rule.summary,
      count: 0,
      categories: new Map(),
      sampleClues: [],
      clusters: new Map(),
    });
  }
  return topicBucket.subtopics.get(rule.id);
};

const ensureCluster = (subtopicBucket, rule) => {
  if (!subtopicBucket.clusters.has(rule.id)) {
    subtopicBucket.clusters.set(rule.id, {
      id: `grp:${subtopicBucket.id}:${rule.id}`,
      title: rule.title,
      summary: rule.summary,
      count: 0,
      categories: new Map(),
      sampleClues: [],
    });
  }
  return subtopicBucket.clusters.get(rule.id);
};

const ensureCategory = (category) => {
  if (!categories.has(category)) {
    categories.set(category, {
      title: category,
      id: categoryId(category),
      count: 0,
      sampleClues: [],
    });
  }
  return categories.get(category);
};

const addSample = (bucket, clue, limit) => {
  bucket.sampleClues.push(clue);
  if (bucket.sampleClues.length > limit) {
    bucket.sampleClues.shift();
  }
};

const outputDir = path.resolve(outDir);
fs.mkdirSync(outputDir, { recursive: true });

const readTsv = async (onRow) => {
  const fileStream = fs.createReadStream(inputPath);
  const rl = readline.createInterface({
    input: fileStream,
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
      continue;
    }
    const row = Object.fromEntries(headers.map((key, idx) => [key, parts[idx]]));
    await onRow(row);
  }
};

await readTsv((row) => {
  const category = normalize(row.category);
  const clue = {
    prompt: normalize(row.answer),
    answer: normalize(row.question),
    air_date: normalize(row.air_date),
    round: parseIntSafe(row.round),
    value: parseIntSafe(row.clue_value),
    daily_double_value: parseIntSafe(row.daily_double_value),
    category,
  };

  total += 1;

  const categoryBucket = ensureCategory(category);
  categoryBucket.count += 1;
  addSample(categoryBucket, clue, maxSamplesPerCategory);

  const rule = matchTopic(category);
  const topicBucket = ensureTopic(rule);
  topicBucket.count += 1;
  addSample(topicBucket, clue, maxSamplesPerTopic);

  const subRule = matchSubtopic(rule.id, category);
  const subtopicBucket = ensureSubtopic(topicBucket, subRule);
  subtopicBucket.count += 1;
  addSample(subtopicBucket, clue, maxSamplesPerSubtopic);

  const clusterRule = matchCluster(rule.id, category);
  const clusterBucket = ensureCluster(subtopicBucket, clusterRule);
  clusterBucket.count += 1;
  clusterBucket.categories.set(
    category,
    (clusterBucket.categories.get(category) ?? 0) + 1,
  );
  addSample(clusterBucket, clue, maxSamplesPerCluster);
});

const categoriesOutput = [...categories.values()]
  .sort((a, b) => b.count - a.count)
  .map((item) => ({
    id: item.id,
    title: item.title,
    count: item.count,
    sampleClues: item.sampleClues,
  }));

const topicsOutput = topicRules.map((rule) => {
  const topicBucket = topics.get(rule.id) ?? {
    id: rule.id,
    title: rule.title,
    summary: rule.summary,
    count: 0,
    categories: new Map(),
    sampleClues: [],
    subtopics: new Map(),
  };

  const subtopics = [...topicBucket.subtopics.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxChildrenPerTopic)
    .map((subtopic) => {
      const clusters = [...subtopic.clusters.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, maxChildrenPerSubtopic)
        .map((cluster) => {
          const children = [...cluster.categories.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxChildrenPerCluster)
            .map(([categoryName, count]) => {
              const categoryBucket = categories.get(categoryName);
              return {
                id: categoryBucket?.id ?? categoryId(categoryName),
                title: categoryName,
                count,
                summary: "Jeopardy category",
                sampleClues: categoryBucket?.sampleClues ?? [],
                childCount: 0,
              };
            });

          return {
            id: cluster.id,
            title: cluster.title,
            summary: cluster.summary,
            count: cluster.count,
            sampleClues: cluster.sampleClues,
            children,
            childCount: cluster.categories.size,
          };
        });

      return {
        id: subtopic.id,
        title: subtopic.title,
        summary: subtopic.summary,
        count: subtopic.count,
        sampleClues: subtopic.sampleClues,
        children: clusters,
        childCount: subtopic.clusters.size,
      };
    });

  return {
    id: rule.id,
    title: rule.title,
    summary: rule.summary,
    count: topicBucket.count,
    sampleClues: topicBucket.sampleClues,
    children: subtopics,
    childCount: topicBucket.subtopics.size,
  };
});

const root = {
  id: "root",
  title: "Jeopardy Universe",
  summary: "A map of Jeopardy categories derived from archival clues.",
  children: topicsOutput,
  childCount: topicsOutput.length,
};

const selectedCategoryIds = new Set();
const selectedCategoryTitles = new Map();

for (const topic of topicsOutput) {
  for (const subtopic of topic.children ?? []) {
    for (const cluster of subtopic.children ?? []) {
      for (const child of cluster.children ?? []) {
        selectedCategoryIds.add(child.id);
        selectedCategoryTitles.set(child.id, child.title);
      }
    }
  }
}

const cluesByCategory = new Map();

const ensureClueBucket = (id, title) => {
  if (!cluesByCategory.has(id)) {
    const categoryBucket = categories.get(title);
    cluesByCategory.set(id, {
      id,
      title,
      total_count: categoryBucket?.count ?? 0,
      clues: [],
    });
  }
  return cluesByCategory.get(id);
};

await readTsv((row) => {
  const category = normalize(row.category);
  const id = categoryId(category);
  if (!selectedCategoryIds.has(id)) return;

  const bucket = ensureClueBucket(id, category);
  bucket.clues.push({
    prompt: normalize(row.answer),
    answer: normalize(row.question),
    air_date: normalize(row.air_date),
    round: parseIntSafe(row.round),
    value: parseIntSafe(row.clue_value),
    daily_double_value: parseIntSafe(row.daily_double_value),
    category,
  });
  if (bucket.clues.length > maxCluesPerCategory) {
    bucket.clues.shift();
  }
});

const cluesOutput = {
  generated_at: new Date().toISOString(),
  max_per_category: maxCluesPerCategory,
  categories: Object.fromEntries(
    [...selectedCategoryIds].map((id) => {
      const title = selectedCategoryTitles.get(id) ?? "";
      const bucket =
        cluesByCategory.get(id) ??
        ensureClueBucket(id, title || id.replace("cat:", ""));
      return [id, bucket];
    }),
  ),
};

const meta = {
  source: inputPath,
  total_clues: total,
  generated_at: new Date().toISOString(),
  max_category_samples: maxSamplesPerCategory,
  max_topic_samples: maxSamplesPerTopic,
  max_topic_children: maxChildrenPerTopic,
  max_subtopic_samples: maxSamplesPerSubtopic,
  max_subtopic_children: maxChildrenPerSubtopic,
  max_cluster_samples: maxSamplesPerCluster,
  max_cluster_children: maxChildrenPerCluster,
  max_category_clues: maxCluesPerCategory,
  selected_categories: selectedCategoryIds.size,
};

fs.writeFileSync(path.join(outputDir, "topics.json"), JSON.stringify(root, null, 2));
fs.writeFileSync(
  path.join(outputDir, "categories.json"),
  JSON.stringify(categoriesOutput, null, 2),
);
fs.writeFileSync(path.join(outputDir, "meta.json"), JSON.stringify(meta, null, 2));
fs.writeFileSync(path.join(outputDir, "clues.json"), JSON.stringify(cluesOutput, null, 2));

console.log(`Processed ${total} clues → ${outputDir}`);
