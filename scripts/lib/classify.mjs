/**
 * Shared classification logic for the Jeopardy data pipeline.
 *
 * Both ingest-jeopardy.mjs (which builds the topic tree) and
 * build-clue-db.mjs (which stores per-category topic assignments in
 * SQLite) must classify categories IDENTICALLY, or tree node ids and
 * database assignments drift apart. This module is the single source
 * of truth: matching semantics (first rule whose keyword appears as a
 * substring, overrides first), id derivation, and rule loading.
 */
import fs from "node:fs";
import crypto from "node:crypto";

export const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const parseIntSafe = (value) => {
  const parsed = parseInt(String(value ?? "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const slugify = (value) =>
  normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const categoryId = (value) => {
  const slug = slugify(value);
  const hash = crypto.createHash("sha1").update(value).digest("hex").slice(0, 6);
  return `cat:${slug}:${hash}`;
};

export const subtopicNodeId = (topicId, subRuleId) => `sub:${topicId}:${subRuleId}`;
export const clusterNodeId = (subtopicNodeIdValue, clusterRuleId) =>
  `grp:${subtopicNodeIdValue}:${clusterRuleId}`;

export function loadRules() {
  const topicRules = JSON.parse(fs.readFileSync("config/topic-rules.json", "utf8"));
  const subtopicRules = JSON.parse(
    fs.readFileSync("config/subtopic-rules.json", "utf8"),
  );
  const clusterRules = JSON.parse(fs.readFileSync("config/cluster-rules.json", "utf8"));
  return { topicRules, subtopicRules, clusterRules };
}

/**
 * Category overrides: the hand/LLM-curated file plus the rule-generated
 * fixes from generate-auto-overrides.mjs. The curated file wins on conflict.
 */
export function loadOverrides({ includeAuto = true } = {}) {
  const main = fs.existsSync("config/category-overrides.json")
    ? JSON.parse(fs.readFileSync("config/category-overrides.json", "utf8"))
    : {};
  if (!includeAuto) return { ...main };
  const auto = fs.existsSync("config/category-overrides-auto.json")
    ? JSON.parse(fs.readFileSync("config/category-overrides-auto.json", "utf8"))
    : {};
  return { ...auto, ...main };
}

export function createClassifier({ topicRules, subtopicRules, clusterRules }, overrides) {
  const topicRuleById = new Map(topicRules.map((rule) => [rule.id, rule]));
  const miscRule = topicRules.find((rule) => rule.id === "misc") ?? {
    id: "misc",
    title: "Unclassified",
    summary: "Categories awaiting classification.",
    keywords: [],
  };

  const matchTopic = (category) => {
    const haystack = normalize(category).toUpperCase();
    const overrideTopicId = overrides[haystack];
    if (overrideTopicId) {
      const overrideRule = topicRuleById.get(overrideTopicId);
      if (overrideRule) return overrideRule;
    }
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

  /** Full assignment for one category title: topic, subtopic & cluster node ids. */
  const assign = (category) => {
    const topicRule = matchTopic(category);
    const subRule = matchSubtopic(topicRule.id, category);
    const clusterRule = matchCluster(topicRule.id, category);
    const subId = subtopicNodeId(topicRule.id, subRule.id);
    return {
      topicRule,
      subRule,
      clusterRule,
      topicId: topicRule.id,
      subtopicId: subId,
      groupId: clusterNodeId(subId, clusterRule.id),
    };
  };

  return { matchTopic, matchSubtopic, matchCluster, assign, miscRule };
}
