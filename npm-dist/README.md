# my-wiki-skill npm installer

This directory contains the public `npx my-wiki-skill` installer source.

The npm package ships only:

- `npm-dist/install.mjs`
- the clean `my-wiki/` Skill directory
- the MIT license and bilingual package documentation

The installer detects common local Agent Skill roots, installs or updates `my-wiki` atomically, and preserves existing Dashboard dependencies. Use `--dir <skills-root>` for another Agent host and `--list` to inspect detected destinations.
