# Knowledge Graph Dashboard

Local read-only graph dashboard for the Markdown vault. It is Obsidian-compatible but does not require Obsidian to be installed.

## Commands

```bash
npm install
npm run graph
npm run dev
npm run build
```

`npm run graph` scans Markdown files in `wiki/` and `raw/`, then writes `public/wiki-graph.json`.
Navigation, maintenance, template, README, and archive files are intentionally excluded from the graph so the visual surface focuses on knowledge nodes and source evidence.

The dashboard reads that JSON and displays an Obsidian-like graph surface:

- global and local graph browsing
- wiki-only Knowledge view by default
- Evidence drill-down for one wiki page and its directly linked raw sources
- mouse-wheel zoom on the graph surface
- search and section/group/type/status filters
- grouped corpus labels for large documentation imports
- selected-node links, backlinks, tags, and status
- raw/wiki/link counts
- inbox, follow-up, stale, broken-link, and processed-gate counts

The dashboard does not write to the vault.
