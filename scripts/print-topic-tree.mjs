import fs from "node:fs";
import path from "node:path";

const filePath = process.argv[2] ?? "data/processed/topics.json";
const maxDepth = Number(process.env.MAX_DEPTH ?? 5);
const maxChildren = Number(process.env.MAX_CHILDREN ?? 25);

const readJson = (targetPath) =>
  JSON.parse(fs.readFileSync(path.resolve(targetPath), "utf8"));

const formatCount = (value) => (Number.isFinite(value) ? ` • ${value}` : "");

const printNode = (node, depth, prefix, isLast) => {
  const connector = depth === 0 ? "" : isLast ? "└─ " : "├─ ";
  const label = depth === 0 ? node.title : `${node.title}${formatCount(node.count)}`;
  console.log(`${prefix}${connector}${label}`);

  if (!node.children || depth >= maxDepth) return;
  const children = node.children.slice(0, maxChildren);
  const remaining = node.children.length - children.length;
  const nextPrefix = depth === 0 ? "" : prefix + (isLast ? "   " : "│  ");

  children.forEach((child, index) => {
    const last = index === children.length - 1 && remaining <= 0;
    printNode(child, depth + 1, nextPrefix, last);
  });

  if (remaining > 0) {
    console.log(`${nextPrefix}└─ … +${remaining} more`);
  }
};

const data = readJson(filePath);
printNode(data, 0, "", true);
