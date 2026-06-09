---
name: new-post
description: Write a new blog post for ai.thesatyajit.com. Use when Satyajit wants to publish a technical blog post, a "what I learned / what I shipped / TIL" daily post, or an explainer — from a topic, voice-note transcript, repo URL, or notes. Creates content/blog/<slug>.mdx with valid frontmatter, then runs pnpm validate.
---

# new-post — author a blog post

Create `content/blog/<slug>.mdx`. `<slug>` is kebab-case from the title (lowercase, alphanumerics + hyphens, no date prefix). The slug is the URL: `/blog/<slug>`.

## Frontmatter (Zod: `blogFrontmatter`)
```yaml
---
title: <required, concise>
description: <required, 1 sentence, used for SEO + cards>
date: 2026-06-04          # today (YYYY-MM-DD)
tags: [tag-one, tag-two]  # kebab-case topics
draft: false              # set true to stage without publishing
# updated: 2026-06-04     # optional, only when revising later
# cover: /covers/foo.png  # optional
---
```

## Body
- MDX. Read `brand-crew/brand/voice.md` first and write in that voice: precise, engineer-first, dry wit, no marketing fluff, show the code/numbers.
- Available MDX components: `<Callout type="tip|note|warning">…</Callout>`; fenced code blocks (rehype-pretty-code) with language tags; KaTeX math (`$…$`, `$$…$$`).
- For a daily "what I shipped / TIL" post keep it short; for a technical explainer go deep with code and benchmarks.

## Steps
1. Pick the slug; confirm `content/blog/<slug>.mdx` does not already exist.
2. Write the file with the frontmatter above + body.
3. Run `pnpm validate` and report the result. Fix any Zod errors and re-run until green.
4. Remind: ship via PR; nothing auto-deploys.
