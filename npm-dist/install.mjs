#!/usr/bin/env node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillSource = path.join(packageRoot, "my-wiki");
const skillName = "my-wiki";
const argv = process.argv.slice(2);
const packageMetadata = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));

function flagValue(flag) {
  const index = argv.indexOf(flag);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`${flag} requires a path.`);
    process.exit(2);
  }
  return value;
}

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith(`~${path.sep}`) || value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function stripExtendedPathPrefix(value) {
  if (value.startsWith("\\\\?\\UNC\\")) return `\\\\${value.slice(8)}`;
  if (value.startsWith("\\\\?\\")) return value.slice(4);
  return value;
}

function normalizedKey(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function exists(value) {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

const home = os.homedir();
const codexHome = process.env.CODEX_HOME || path.join(home, ".codex");
const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
const candidates = [
  { agent: "agents", root: path.join(home, ".agents", "skills") },
  { agent: "claude", root: path.join(home, ".claude", "skills") },
  { agent: "codex", root: path.join(codexHome, "skills") },
  { agent: "opencode", root: path.join(xdgConfig, "opencode", "skills") },
  { agent: "agents-config", root: path.join(xdgConfig, "agents", "skills") }
];

async function detectedTargets() {
  const found = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (!(await exists(candidate.root)) && !(await exists(path.dirname(candidate.root)))) continue;
    const key = normalizedKey(candidate.root);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(candidate);
  }
  return found;
}

function shouldCopy(entry, copyRoot) {
  const normalizedEntry = path.resolve(stripExtendedPathPrefix(entry));
  const relative = path.relative(copyRoot, normalizedEntry).replace(/\\/g, "/");
  const parts = relative.split("/");
  const basename = path.basename(entry);
  if (parts[0] === "tests") return false;
  if (parts.includes("node_modules") || parts.includes("dist")) return false;
  if (basename === ".DS_Store" || basename === "wiki-graph.json") return false;
  return !basename.endsWith(".log") && !basename.endsWith(".pid");
}

async function readMarker(target) {
  try {
    return JSON.parse(await fs.readFile(path.join(target, ".my-wiki-skill.json"), "utf8"));
  } catch {
    return null;
  }
}

async function cleanOwnedTemporaryDirectories(root) {
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.name.startsWith(`.${skillName}-staging-`) && !entry.name.startsWith(`.${skillName}-old-`)) continue;
    const candidate = path.resolve(root, entry.name);
    if (path.dirname(candidate) !== path.resolve(root)) throw new Error(`Unsafe temporary path: ${candidate}`);
    await fs.rm(candidate, { recursive: true, force: true });
  }
}

async function installInto({ agent, root }) {
  root = path.resolve(expandHome(root));
  await fs.mkdir(root, { recursive: true });
  await cleanOwnedTemporaryDirectories(root);

  const target = path.join(root, skillName);
  if (path.dirname(path.resolve(target)) !== path.resolve(root) || path.basename(target) !== skillName) {
    throw new Error(`Unsafe Skill target: ${target}`);
  }

  let targetStat = null;
  try {
    targetStat = await fs.lstat(target);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (targetStat) {
    const marker = await readMarker(target);
    if (marker?.name !== skillName) {
      throw new Error(`Refusing to replace unmanaged Skill directory: ${target}`);
    }
  }

  const staging = path.join(root, `.${skillName}-staging-${process.pid}`);
  const retired = path.join(root, `.${skillName}-old-${process.pid}`);
  const copyRoot = path.resolve(stripExtendedPathPrefix(skillSource));
  await fs.cp(skillSource, staging, {
    recursive: true,
    filter(entry) {
      return shouldCopy(entry, copyRoot);
    }
  });

  if (targetStat?.isSymbolicLink()) {
    await fs.unlink(target);
    targetStat = null;
  } else if (targetStat) {
    await fs.rename(target, retired);
  }

  try {
    await fs.rename(staging, target);
  } catch (error) {
    if (await exists(retired)) await fs.rename(retired, target);
    throw error;
  }

  const oldModules = path.join(retired, "assets", "dashboard", "node_modules");
  const nextModules = path.join(target, "assets", "dashboard", "node_modules");
  if (await exists(oldModules)) {
    await fs.mkdir(path.dirname(nextModules), { recursive: true });
    await fs.rename(oldModules, nextModules);
  }
  await fs.rm(retired, { recursive: true, force: true });

  return { agent, target, status: targetStat ? "updated" : "installed" };
}

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`My Wiki Skill installer v${packageMetadata.version}

Usage:
  npx my-wiki-skill@latest
  npx my-wiki-skill@latest --dir <skills-root>
  npx my-wiki-skill@latest --list
  npx my-wiki-skill@latest --codex-only
  npx my-wiki-skill@latest --opencode-only`);
  process.exit(0);
}

const explicitDir = flagValue("--dir");
let targets;
if (explicitDir) {
  targets = [{ agent: "custom", root: explicitDir }];
} else if (argv.includes("--codex-only")) {
  targets = [candidates.find(({ agent }) => agent === "codex")];
} else if (argv.includes("--opencode-only")) {
  targets = [candidates.find(({ agent }) => agent === "opencode")];
} else {
  targets = await detectedTargets();
}

if (argv.includes("--list")) {
  console.log(targets.length ? targets.map(({ root }) => path.resolve(root)).join("\n") : "(no common Skill directories detected)");
  process.exit(0);
}

if (!targets.length) {
  console.error("No common Agent Skill directory was detected.");
  console.error("Specify one explicitly: npx my-wiki-skill@latest --dir <skills-root>");
  process.exit(2);
}

if (!(await exists(path.join(skillSource, "SKILL.md")))) {
  console.error("The npm package is damaged: my-wiki/SKILL.md is missing.");
  process.exit(1);
}

const results = [];
for (const target of targets) results.push(await installInto(target));
for (const result of results) console.log(`${result.status}: ${result.target} (${result.agent})`);
console.log(`My Wiki Skill v${packageMetadata.version} is ready. Restart or open a new agent session to load it.`);
