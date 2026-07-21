# Tools

This directory contains helper tools for the Obsidian knowledge vault.

## My Wiki Frontend

`wiki-dashboard/` is the local React frontend for My Wiki. Today it provides a read-only graph visualization surface; later it can host local-agent Q&A, vault maintenance controls, and other knowledge workflows. It does not require Obsidian.

- Obsidian-like graph browsing
- vault health counts
- inbox and follow-up queue snapshots
- unresolved link and processed-gate summaries
- selected-node links, backlinks, tags, and status

Run from the vault root:

```bash
npm run dashboard
```

Or run inside the dashboard package:

```bash
cd tools/wiki-dashboard
npm run graph
npm run dev
```
