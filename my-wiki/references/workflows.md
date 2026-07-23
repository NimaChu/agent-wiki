# My Wiki Workflows

## Ingest

1. Resolve the target vault.
2. Capture the source into `raw/` with complete provenance and local snapshots when practical.
3. Preserve inline image order; run `images` for image-rich sources.
4. Distill reusable concepts into atomic `wiki/` pages.
5. Link claims to raw evidence and raw notes back to their primary wiki targets.
6. Update `wiki/index.md` and `wiki/log.md` when knowledge changes materially.
7. Run `lint`. Do not open the Dashboard unless requested.

## Query

1. Read `wiki/index.md`.
2. Search `wiki/` before `raw/`.
3. Inspect linked raw evidence for grounding.
4. Include one to three useful local images when visual evidence materially improves the answer.

## Maintain

Treat short requests such as "维护知识库" or "maintain this vault" as complete instructions:

1. Run `status` and inspect `garden`.
2. Process a coherent batch of inbox or weak raw notes.
3. Create, split, merge, and link atomic wiki pages.
4. Review universes with a minimal-universe bias.
5. Repair links and update the index/log.
6. Run `lint` and report completed and remaining work.

Do not use Git as part of routine maintenance.

## Dashboard

Treat requests to view the graph, frontend, or Dashboard as permission to run `open-dashboard`. Each installed Skill uses a stable local port, so independent Codex and OpenCode copies do not serve one another's stale graph. Within one installation, opening another vault switches graph generation and the watcher to that vault.

## Vault Resolution

Resolution order is:

1. `--vault <registered-name-or-path>`
2. `MY_WIKI_VAULT` and legacy vault environment variables
3. the nearest `.my-wiki.json`
4. the default in `~/.my-wiki/config.json`
5. a nearby legacy `raw/` plus `wiki/` vault as a compatibility fallback
