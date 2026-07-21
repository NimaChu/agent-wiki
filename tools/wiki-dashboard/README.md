# My Wiki Frontend

Local read-only frontend for My Wiki. The current surface focuses on knowledge graph visualization, and the frontend is intended to grow into the place where users can inspect the local vault, ask local agents questions, and trigger maintenance workflows.

## Commands

```bash
npm install
npm run graph
npm run dev
npm run build
```

`npm run graph` scans Markdown files in `wiki/` and `raw/`, then writes `public/wiki-graph.json`.
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
