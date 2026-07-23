import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = path.resolve(skill, "..");
const skillCli = path.join(skill, "scripts", "my-wiki.mjs");

function run(entry, args, env, cwd = repository) {
  return spawnSync(process.execPath, [entry, ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8"
  });
}

function stripExtendedPathPrefix(value) {
  if (value.startsWith("\\\\?\\UNC\\")) return `\\\\${value.slice(8)}`;
  if (value.startsWith("\\\\?\\")) return value.slice(4);
  return value;
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

test("initializes and resolves an external named vault through the Skill", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "my-wiki-runtime-"));
  const vault = path.join(temporary, "vault");
  const env = { MY_WIKI_CONFIG_PATH: path.join(temporary, "config.json") };

  try {
    const initialized = run(skillCli, ["init", vault, "--name", "demo", "--use"], env);
    assert.equal(initialized.status, 0, initialized.stderr);

    const located = run(skillCli, ["--vault", "demo", "where"], env);
    assert.equal(located.status, 0, located.stderr);
    assert.equal(path.resolve(located.stdout.trim()), path.resolve(vault));

    const status = run(skillCli, ["--vault", "demo", "status"], env);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /"rawSources": 0/);
    assert.match(status.stdout, /"unresolved": 0/);

    const lint = run(skillCli, ["--vault", "demo", "lint"], env);
    assert.equal(lint.status, 0, lint.stderr);
    assert.match(lint.stdout, /"missingFrontmatter": \[\]/);

    const marker = JSON.parse(await readFile(path.join(vault, ".my-wiki.json"), "utf8"));
    assert.equal(marker.version, 1);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("a copied Skill runs without repository wrappers", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "my-wiki-copy-"));
  const source = skill;
  const copiedSkill = path.join(temporary, "my-wiki");
  const copiedCli = path.join(copiedSkill, "scripts", "my-wiki.mjs");
  const vault = path.join(temporary, "vault");
  const env = { MY_WIKI_CONFIG_PATH: path.join(temporary, "config.json") };

  try {
    const copyRoot = path.resolve(stripExtendedPathPrefix(source));
    await cp(source, copiedSkill, {
      recursive: true,
      filter(entry) {
        const normalizedEntry = path.resolve(stripExtendedPathPrefix(entry));
        const relative = path.relative(copyRoot, normalizedEntry).replace(/\\/g, "/");
        const parts = relative.split("/");
        const basename = path.basename(entry);
        return parts[0] !== "tests" && !parts.includes("node_modules") && !parts.includes("dist") &&
          !basename.endsWith(".log") && !basename.endsWith(".pid") && basename !== "wiki-graph.json";
      }
    });

    const initialized = run(copiedCli, ["init", vault, "--name", "copy", "--use"], env, temporary);
    assert.equal(initialized.status, 0, initialized.stderr);

    const status = run(copiedCli, ["--vault", "copy", "status"], env, temporary);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /"rawSources": 0/);

    await readFile(path.join(vault, "templates", "raw-source.md"), "utf8");
    await readFile(path.join(copiedSkill, "assets", "dashboard", "package.json"), "utf8");
    assert.equal(await exists(path.join(copiedSkill, "tests")), false);
    assert.equal(await exists(path.join(copiedSkill, "assets", "dashboard", "node_modules")), false);
    assert.equal(await exists(path.join(copiedSkill, "assets", "dashboard", "public", "wiki-graph.json")), false);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
