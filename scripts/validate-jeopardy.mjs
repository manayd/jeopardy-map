import fs from "node:fs/promises";
import path from "node:path";

const processedDir = path.join(process.cwd(), "data", "processed");
const topicsPath = path.join(processedDir, "topics.json");
const categoriesPath = path.join(processedDir, "categories.json");
const metaPath = path.join(processedDir, "meta.json");

const loadJson = async (filePath) => JSON.parse(await fs.readFile(filePath, "utf8"));

const main = async () => {
  const [topics, categories, meta] = await Promise.all([
    loadJson(topicsPath),
    loadJson(categoriesPath),
    loadJson(metaPath),
  ]);

  const errors = [];
  const warnings = [];

  if (!topics || topics.id !== "root") {
    errors.push("topics.json root node is missing or id is not 'root'.");
  }
  if (!Array.isArray(topics.children) || topics.children.length === 0) {
    errors.push("topics.json has no children for the root node.");
  }

  const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
  const seenCategoryIds = new Set();

  const walk = (node, depth = 0, parentTitle = "root") => {
    if (!node.id || !node.title) {
      errors.push(`Node missing id/title under "${parentTitle}".`);
      return;
    }
    if (depth > 0 && !node.summary) {
      warnings.push(`Node "${node.title}" missing summary.`);
    }
    if (!Array.isArray(node.sampleClues) || node.sampleClues.length === 0) {
      warnings.push(`Node "${node.title}" has no sample clues.`);
    }

    if (node.id.startsWith("cat:")) {
      if (seenCategoryIds.has(node.id)) {
        warnings.push(`Duplicate category id "${node.id}" across tree.`);
      }
      seenCategoryIds.add(node.id);
      if (!categoryMap.has(node.id)) {
        warnings.push(`Category "${node.title}" not found in categories.json.`);
      }
      return;
    }

    for (const child of node.children ?? []) {
      walk(child, depth + 1, node.title);
    }
  };

  for (const topic of topics.children ?? []) {
    walk(topic, 1, "root");
  }

  const topCategories = [...categories]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((cat) => ({ id: cat.id, title: cat.title, count: cat.count }));

  const report = {
    meta,
    errors,
    warnings,
    totals: {
      topics: (topics.children ?? []).length,
      categories: categories.length,
      root_children: topics.children?.length ?? 0,
      tree_categories: seenCategoryIds.size,
    },
    top_categories: topCategories,
  };

  await fs.writeFile(
    path.join(processedDir, "validation.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(`Validation complete. Errors: ${errors.length}, Warnings: ${warnings.length}`);
  if (errors.length) {
    console.log("Errors:");
    errors.forEach((err) => console.log(`- ${err}`));
  }
  if (warnings.length) {
    console.log("Warnings:");
    warnings.forEach((warn) => console.log(`- ${warn}`));
  }
};

main().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
