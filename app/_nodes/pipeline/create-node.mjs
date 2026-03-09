#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const [, , rawNodeName] = process.argv;
if (!rawNodeName) {
  console.error("Usage: node src/app/_nodes/pipeline/create-node.mjs <node-name>");
  process.exit(1);
}

const nodeName = rawNodeName.trim().toLowerCase();
const root = path.resolve(process.cwd(), "src/app/_nodes");
const templateDir = path.join(root, "templates", "node-template");
const targetDir = path.join(root, nodeName);

if (fs.existsSync(targetDir)) {
  console.error(`Node already exists: ${targetDir}`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

const templateTsx = fs
  .readFileSync(path.join(templateDir, "node.tsx"), "utf8")
  .replace(/NodeTemplate/g, toPascalCase(nodeName))
  .replace(/node-template/g, nodeName)
  .replace(/Node template/g, `Node ${nodeName}`);

const templateJson = fs
  .readFileSync(path.join(templateDir, "node.json"), "utf8")
  .replace(/node-template/g, nodeName)
  .replace(/Node Template/g, toTitle(nodeName));

const templateMd = fs
  .readFileSync(path.join(templateDir, "node.md"), "utf8")
  .replace(/Node Template/g, toTitle(nodeName));

fs.writeFileSync(path.join(targetDir, "node.tsx"), templateTsx);
fs.writeFileSync(path.join(targetDir, "node.json"), templateJson);
fs.writeFileSync(path.join(targetDir, "node.md"), templateMd);

console.log(`Node created at: ${targetDir}`);

function toPascalCase(value) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("");
}

function toTitle(value) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}
