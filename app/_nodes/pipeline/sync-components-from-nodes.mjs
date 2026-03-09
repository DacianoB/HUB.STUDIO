import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve("src/app/_nodes");
const COMPONENTS_PATH = path.join(ROOT_DIR, "components.json");
const TEMPLATE_DIR = path.join(ROOT_DIR, "templates");

const DEFAULT_LAYOUT = {
  w: [2],
  h: [6],
  minW: 1,
  minH: 3,
};

const BOOLEAN_KEYS = [
  "requiresAuth",
  "requiresVisitor",
  "internal",
  "searchable",
  "discoverable",
];

function toTitle(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeNodeConfig(raw, canonicalType) {
  const legacyType = canonicalType.replace(/^node-/, "");
  const normalized = {
    type: canonicalType,
    name:
      typeof raw?.name === "string" && raw.name.trim()
        ? raw.name
        : toTitle(canonicalType),
    description:
      typeof raw?.description === "string" && raw.description.trim()
        ? raw.description
        : `Node ${toTitle(legacyType)}`,
    tags: Array.isArray(raw?.tags)
      ? raw.tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
      : ["node", legacyType],
    defaultLayout:
      raw?.defaultLayout && typeof raw.defaultLayout === "object"
        ? raw.defaultLayout
        : DEFAULT_LAYOUT,
  };

  for (const key of BOOLEAN_KEYS) {
    if (typeof raw?.[key] === "boolean") normalized[key] = raw[key];
  }

  return normalized;
}

function toComponentConfig(nodeConfig) {
  const { type: _type, ...config } = nodeConfig;
  return config;
}

async function readJson(filePath, fallback = null) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  const existingComponents = (await readJson(COMPONENTS_PATH, {})) ?? {};
  const dirEntries = await fs.readdir(ROOT_DIR, { withFileTypes: true });
  const nodeDirs = dirEntries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("node-"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const generatedNodeConfigs = [];

  for (const dirName of nodeDirs) {
    const nodeDir = path.join(ROOT_DIR, dirName);
    const nodeTsxPath = path.join(nodeDir, "node.tsx");
    const nodeJsonPath = path.join(nodeDir, "node.json");

    try {
      await fs.access(nodeTsxPath);
    } catch {
      continue;
    }

    const legacyType = dirName.replace(/^node-/, "");
    const seed =
      (await readJson(nodeJsonPath, null)) ??
      existingComponents[dirName] ??
      existingComponents[legacyType] ??
      {};
    const normalized = normalizeNodeConfig(seed, dirName);

    await writeJson(nodeJsonPath, normalized);
    generatedNodeConfigs.push(normalized);
  }

  const nextComponents = {};
  for (const nodeConfig of generatedNodeConfigs) {
    const canonicalType = nodeConfig.type;
    const legacyType = canonicalType.replace(/^node-/, "");
    const config = toComponentConfig(nodeConfig);

    // Canonical node key.
    nextComponents[canonicalType] = config;
    // Backwards-compatible legacy key derived from canonical node metadata.
    nextComponents[legacyType] = config;
  }

  await writeJson(COMPONENTS_PATH, nextComponents);

  // Keep template node.json in sync as a docs asset, but never include in components catalog.
  const templateNodeJson = await readJson(
    path.join(TEMPLATE_DIR, "node-template", "node.json"),
    null,
  );
  if (templateNodeJson?.type) {
    const normalizedTemplate = normalizeNodeConfig(
      templateNodeJson,
      templateNodeJson.type,
    );
    await writeJson(
      path.join(TEMPLATE_DIR, "node-template", "node.json"),
      normalizedTemplate,
    );
  }
}

main().catch((error) => {
  console.error("[nodes:sync] Failed to sync components from node.json files");
  console.error(error);
  process.exitCode = 1;
});
