---
name: add-snippet
description: Add a code snippet to ai.thesatyajit.com (CUDA/PyTorch/C++/bash tricks). Use when Satyajit wants to save a small copy-pasteable code piece. Creates content/snippets/<slug>.mdx with valid frontmatter, then runs pnpm validate.
---

# add-snippet — author a code snippet

Create `content/snippets/<slug>.mdx`. `<slug>` is kebab-case from the title. URL: `/snippets/<slug>`.

## Frontmatter (Zod: `snippetFrontmatter`)
```yaml
---
title: <required>
description: <optional, 1 sentence>
date: 2026-06-04        # today
lang: cuda              # e.g. cuda, python, cpp, bash — required
tags: [cuda, kernels]   # kebab-case
---
```

## Body
A short explanation of *why* the snippet works, then a fenced code block tagged with the language:
```` ```cuda … ``` ````
Keep it tight and reusable. Read `brand-crew/brand/voice.md`.

## Steps
1. Pick the slug; confirm `content/snippets/<slug>.mdx` doesn't exist.
2. Write the file.
3. Run `pnpm validate` and report; fix Zod errors until green. Ship via PR.
