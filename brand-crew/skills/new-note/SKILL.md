---
name: new-note
description: Add a digital-garden note to ai.thesatyajit.com (evergreen, interlinked with [[wikilinks]]). Use when Satyajit wants to capture or grow an evergreen concept note. Creates content/notes/<slug>.mdx with valid frontmatter, then runs pnpm validate.
---

# new-note — author a digital-garden note

Create `content/notes/<slug>.mdx`. `<slug>` is kebab-case from the title (it's the wikilink target too: `[[<slug>]]`). URL: `/notes/<slug>`.

## Frontmatter (Zod: `noteFrontmatter`)
```yaml
---
title: <required>
date: 2026-06-04         # today (first written)
tags: [slam, lidar]      # kebab-case
# updated: 2026-06-04    # optional — set when revising an existing note
---
```

## Body
- Evergreen, concept-first prose. Interlink related notes with `[[other-note-slug]]` wikilinks (use the target slug exactly).
- Read `brand-crew/brand/voice.md`. Precise, first-principles.
- Growing an existing note: edit it in place and bump `updated` to today.

## Steps
1. Pick the slug; for a new note confirm `content/notes/<slug>.mdx` doesn't exist.
2. Write/edit the file; verify any `[[wikilinks]]` point at real note slugs (or note the intent to create them).
3. Run `pnpm validate` and report; fix Zod errors until green. Ship via PR.
