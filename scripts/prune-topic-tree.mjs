/**
 * Post-process data/processed/topics.json after ingest:
 *
 * 1. Hoist "General" wrapper nodes — cluster/subtopic nodes titled exactly
 *    "General" add a click without adding information; their children move
 *    up to the parent.
 * 2. Collapse single-child chains (a container whose only child is another
 *    container) the same way.
 * 3. Drop empty topics (count 0) from the root.
 *
 * Run after ingest: node scripts/prune-topic-tree.mjs
 */
import fs from "node:fs";

const TREE_PATH = "data/processed/topics.json";

const isContainer = (node) => Array.isArray(node.children) && node.children.length > 0;

function pruneNode(node) {
  if (!isContainer(node)) return node;

  let children = node.children.map(pruneNode);

  // Hoist "General" wrappers.
  children = children.flatMap((child) =>
    child.title === "General" && isContainer(child) ? child.children : [child],
  );

  // Collapse single-container chains.
  while (children.length === 1 && isContainer(children[0])) {
    children = children[0].children;
  }

  return { ...node, children, childCount: children.length };
}

const root = JSON.parse(fs.readFileSync(TREE_PATH, "utf8"));
const before = JSON.stringify(root).length;

const pruned = pruneNode(root);
pruned.children = (pruned.children ?? []).filter((topic) => (topic.count ?? 0) > 0);
pruned.childCount = pruned.children.length;

fs.writeFileSync(TREE_PATH, JSON.stringify(pruned, null, 2));

const count = (node) =>
  1 + (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
console.log(
  `Pruned tree written: ${pruned.children.length} topics, ${count(pruned)} nodes ` +
    `(${(before / 1024 / 1024).toFixed(1)}MB → ${(JSON.stringify(pruned).length / 1024 / 1024).toFixed(1)}MB)`,
);
