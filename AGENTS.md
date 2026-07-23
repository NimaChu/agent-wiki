# My Wiki Development Rules

This repository contains the self-contained My Wiki Agent Skill. It is not the user's knowledge vault.

## Bootstrap

1. Read `README.md`.
2. Read `my-wiki/SKILL.md` when changing agent behavior.
3. Use root npm scripts or `node my-wiki/scripts/my-wiki.mjs ...` for testing.
4. Test path-sensitive changes against a temporary external vault.

## Architecture

- `my-wiki/` is the complete Codex/OpenCode Skill and source of truth.
- `my-wiki/scripts/core/` contains the canonical CLI engine.
- `my-wiki/assets/templates/` contains templates copied into a vault by `init`.
- `my-wiki/assets/dashboard/` contains the optional frontend.
- `knowledge-base/` is the local ignored vault used by this workspace.
- `paper/` and `backup/` are local ignored material, never public tool source.
- A vault owns `.my-wiki.json`, `.my-wiki/`, `raw/`, `wiki/`, and its copied `templates/`.

Keep the tool root and vault root independent. New code must resolve knowledge paths through `vaultPath()` or `resolveVaultPath()` and tool assets through `TOOL_ROOT`; do not reconstruct either root from the other.

## Compatibility

- Keep root npm scripts forwarding directly to `my-wiki/scripts/my-wiki.mjs`.
- Accept explicit `--vault <registered-name-or-path>` for every vault operation.
- Keep legacy vault environment variables working while preferring `MY_WIKI_VAULT`.
- Do not require Codex, OpenCode, Obsidian, Firecrawl, or IMA for core local CLI health checks.

## Skill Behavior

- Keep `SKILL.md` concise. Put detailed workflows in `my-wiki/references/`.
- Treat short ingest, query, maintenance, and Dashboard requests as complete instructions.
- Keep knowledge maintenance local; never commit or push vault content implicitly.
- Do not start the Dashboard during routine ingest or maintenance.
- Preserve raw evidence and keep wiki pages atomic, linked, synthesized, and evidence-backed.

## Validation

For path or Skill changes, verify at minimum:

1. initialize a temporary vault outside the repository;
2. resolve it by both path and registered name;
3. run capture, status, and lint through `my-wiki/scripts/my-wiki.mjs`;
4. build graph data for that external vault;
5. confirm no temporary knowledge files appear in Git status;
6. run the Skill validator when available.

Do not delete or move a user's local vault during tests. Use an isolated temporary directory and a temporary `MY_WIKI_CONFIG_PATH`.
