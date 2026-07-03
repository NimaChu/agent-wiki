#!/usr/bin/env node
import { closeSync, openSync } from "node:fs";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { DASHBOARD_PORT, DASHBOARD_URL, dashboardPath, exists, vaultPath } from "./wiki-lib.mjs";

const shouldServe = process.argv.includes("--serve");
const shouldBuild = process.argv.includes("--build");
const vault = vaultPath();
const dash = dashboardPath(vault);
const npmCommand = "npm";
const npmOptions = { cwd: dash, shell: process.platform === "win32" };

function run(command, args) {
  const result = spawnSync(command, args, { ...npmOptions, stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

async function isServerAlive() {
  return new Promise((resolve) => {
    const req = http.get(DASHBOARD_URL, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

if (!(await exists(dash))) {
  console.error(`Dashboard not found: ${dash}`);
  process.exit(1);
}

if (!(await exists(path.join(dash, "node_modules")))) {
  run(npmCommand, ["install"]);
}

run(npmCommand, ["run", "graph"]);
if (shouldBuild) run(npmCommand, ["run", "build"]);

if (shouldServe && !(await isServerAlive())) {
  const logPath = path.join(dash, "vite.log");
  const logFd = openSync(logPath, "a");
  const child = spawn(npmCommand, ["run", "dev", "--", "--port", String(DASHBOARD_PORT)], {
    ...npmOptions,
    detached: true,
    stdio: ["ignore", logFd, logFd]
  });
  child.unref();
  closeSync(logFd);

  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (await isServerAlive()) break;
  }
}

const graphPath = path.join(dash, "public", "wiki-graph.json");
const graph = JSON.parse(await fs.readFile(graphPath, "utf8"));
console.log(JSON.stringify({
  vault,
  dashboard: dash,
  url: DASHBOARD_URL,
  graph: graph.stats,
  server: shouldServe ? await isServerAlive() : "not requested"
}, null, 2));
