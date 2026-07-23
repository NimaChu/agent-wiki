# My Wiki

Install one Agent Skill. Keep your knowledge anywhere on your computer.

[简体中文](README.zh-CN.md)

My Wiki is a local-first, Markdown-native knowledge system maintained by Codex or OpenCode. The tool and the knowledge vault are independent:

- install the My Wiki Skill once;
- create one or more vaults in any local path;
- ask your agent to capture, maintain, search, answer, or visualize them;
- keep private `raw/` evidence and `wiki/` knowledge out of the tool repository.

No hosted database, vector database, Obsidian installation, or paid API is required.

## How It Works

```text
Codex / OpenCode
       |
       v
Self-contained My Wiki Skill
       |
       +---- personal -> D:\Knowledge\Personal
       +---- work     -> E:\Knowledge\Work
       +---- project  -> /Users/me/Projects/acme-vault
```

Each vault owns its data:

```text
my-vault/
  .my-wiki.json       vault marker
  .my-wiki/           local cache and runtime state
  raw/                captured evidence, snapshots, and images
  wiki/               durable knowledge pages
  templates/          vault-local Markdown templates
```

The installed Skill contains the agent workflow, CLI engine, templates, and Dashboard. It can run after being copied independently of this source checkout.

## Install

Requirements: Node.js 18+ and Git.

```bash
git clone https://github.com/NimaChu/my-wiki.git
cd my-wiki
npm run skill:install
```

The installer copies the complete `my-wiki/` folder into:

- Codex: `~/.codex/skills/my-wiki`
- OpenCode: `~/.config/opencode/skills/my-wiki`

Install only one integration when needed:

```bash
npm run skill:install -- --codex-only
npm run skill:install -- --opencode-only
```

Restart Codex or OpenCode after installation so it discovers the Skill.

Repository developers can use `npm run skill:install -- --link` to install directory links instead of standalone copies.

## Create A Vault Anywhere

```bash
node my-wiki/scripts/my-wiki.mjs init "D:\Knowledge\Personal" --name personal --use
```

This creates the Markdown structure, registers `personal`, and makes it the default vault. The source repository does not need to be the agent's working directory.

Then talk naturally to the agent:

```text
把这篇网页入库到 personal 知识库。
维护知识库。
查询 FlexSim Process Flow 的相关知识。
打开知识图谱。
```

The Skill resolves the default vault and performs the complete workflow without requiring long command prompts.

## Multiple Vaults

Register an existing vault without moving it:

```bash
node my-wiki/scripts/my-wiki.mjs vault add work "E:\Knowledge\Work"
node my-wiki/scripts/my-wiki.mjs vault use work
node my-wiki/scripts/my-wiki.mjs vault list
node my-wiki/scripts/my-wiki.mjs where
```

Target a vault for one command:

```bash
node my-wiki/scripts/my-wiki.mjs --vault personal status
node my-wiki/scripts/my-wiki.mjs --vault "E:\Knowledge\Work" search "simulation"
```

Vault resolution order is:

1. `--vault <registered-name-or-path>`
2. `MY_WIKI_VAULT` or a legacy vault environment variable
3. the nearest `.my-wiki.json`
4. the default in `~/.my-wiki/config.json`
5. a nearby legacy `raw/` plus `wiki/` vault as a compatibility fallback

## Existing My Wiki Users

An existing checkout that already contains local `raw/` and `wiki/` data remains valid. Register it as the default without moving any files:

```bash
node my-wiki/scripts/my-wiki.mjs vault add current "E:\agent-wiki\knowledge-base" --use
```

You can move the vault later and update the registered path. The public Git repository no longer tracks `raw/` or `wiki/`.

## Core Workflow

1. Capture source material into the selected vault's `raw/` layer.
2. Preserve source metadata, snapshots, inline image order, and useful visual evidence.
3. Distill reusable concepts into atomic pages under `wiki/`.
4. Link wiki claims back to raw evidence and close raw-to-wiki backlinks.
5. Run local status, lint, garden, universe, and repair checks.
6. Open the Dashboard only when visualization is requested.

`processed` is strict: a raw note is complete only when its primary wiki targets resolve, the wiki links back to the evidence, and follow-up flags are closed.

## CLI Reference

```bash
node my-wiki/scripts/my-wiki.mjs init /path/to/vault --name personal --use
node my-wiki/scripts/my-wiki.mjs vault list
node my-wiki/scripts/my-wiki.mjs vault add NAME /path/to/vault
node my-wiki/scripts/my-wiki.mjs vault use NAME
node my-wiki/scripts/my-wiki.mjs where

node my-wiki/scripts/my-wiki.mjs --vault NAME status
node my-wiki/scripts/my-wiki.mjs --vault NAME lint
node my-wiki/scripts/my-wiki.mjs --vault NAME garden
node my-wiki/scripts/my-wiki.mjs --vault NAME universes
node my-wiki/scripts/my-wiki.mjs --vault NAME repair-links
node my-wiki/scripts/my-wiki.mjs --vault NAME search "query terms"
node my-wiki/scripts/my-wiki.mjs --vault NAME capture --title "Source title" --url "https://example.com"
node my-wiki/scripts/my-wiki.mjs --vault NAME images --source raw/source-note.md
node my-wiki/scripts/my-wiki.mjs --vault NAME open-dashboard
```

Root npm scripts remain available for repository development and backwards compatibility.

## Knowledge Graph

The optional local frontend shows the selected vault's wiki universes, relationships, and raw evidence. It is started on demand:

```bash
node my-wiki/scripts/my-wiki.mjs --vault personal open-dashboard
```

Use `dashboard` instead of `open-dashboard` to start the service silently in the background without opening a browser. Neither command opens a terminal window for the background Vite server or watcher.

While it is running, the watcher refreshes graph data when that vault's Markdown changes. Opening another vault switches the graph and watcher to the newly selected vault.

## Images And Web Capture

My Wiki preserves image references and can mirror useful remote images into the selected vault. Firecrawl MCP remains an optional capture helper for rendered or difficult webpages; it is never the vault's source of truth.

After external capture, durable evidence must still be written into `raw/` and distilled through the normal workflow.

## Repository Layout

```text
my-wiki/              complete installable Skill
  scripts/core/       CLI engine
  assets/templates/   templates copied by `init`
  assets/dashboard/   optional local frontend
  tests/              source-only regression tests, excluded from installed copies
knowledge-base/       local ignored vault data
paper/                local ignored research materials and datasets
backup/               local ignored legacy files
```

The repository deliberately does not track user `raw/`, `wiki/`, snapshots, or mirrored assets.

## License

My Wiki is released under the [MIT License](LICENSE.txt).
