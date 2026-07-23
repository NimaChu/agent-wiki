# My Wiki Frontend

Local read-only frontend for My Wiki. The current surface focuses on knowledge graph visualization, and the frontend is intended to grow into the place where users can inspect the local vault, ask local agents questions, and trigger maintenance workflows.

## Commands

```bash
npm install
npm run build
```

For normal use, launch through the installed Skill so the selected vault is passed to the graph generator:

```bash
node <skill-directory>/scripts/my-wiki.mjs --vault personal open-dashboard
```

For frontend development, set `MY_WIKI_VAULT` before running `npm run graph` and `npm run dev` in this directory. The graph command scans the selected vault's `wiki/` and `raw/`, then writes the ignored `public/wiki-graph.json` runtime artifact.
Navigation, maintenance, template, README, and archive files are intentionally excluded from the graph so the visual surface focuses on knowledge nodes and source evidence.

The frontend reads that JSON and displays an Obsidian-like graph surface:

- global and local graph browsing
- wiki-only Knowledge view by default
- Evidence drill-down for one wiki page and its directly linked raw sources
- mouse-wheel zoom on the graph surface
- search plus group/status filters
- grouped corpus labels for large documentation imports
- selected-node links, backlinks, tags, and status
- raw/wiki/link counts
- inbox, follow-up, stale, broken-link, and processed-gate counts

The current graph surface does not write to the vault.
