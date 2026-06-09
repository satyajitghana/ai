---
name: new-project
description: Add a project page to ai.thesatyajit.com from a GitHub repo URL. Use when Satyajit wants to showcase a repo/project. Pulls README/stack/stars via gh, creates content/projects/<slug>.mdx with valid frontmatter, then runs pnpm validate.
---

# new-project — author a project page

Create `content/projects/<slug>.mdx`. `<slug>` is kebab-case, usually the repo name. URL: `/projects/<slug>`.

## Gather (when given a repo URL)
- `gh repo view <owner>/<name> --json name,description,stargazerCount,primaryLanguage,languages,url,homepageUrl`
- Read the README for an accurate summary and the real tech stack.

## Frontmatter (Zod: `projectFrontmatter`)
```yaml
---
title: <repo / project name>
description: <required, 1 sentence>
date: 2026-06-04            # today, or the project's start date
stack: [PyTorch, CUDA, C++]
repo: https://github.com/satyajitghana/<name>   # optional, must be a URL
# demo: https://…          # optional URL
featured: false            # true to pin on the homepage
# cover: /covers/foo.png   # optional
---
```

## Body
MDX: what it is, why it exists, the interesting engineering. Read `brand-crew/brand/voice.md` — show the substance, not hype.

## Steps
1. Pick the slug; confirm `content/projects/<slug>.mdx` doesn't exist.
2. Write the file.
3. Run `pnpm validate` and report; fix Zod errors until green.
4. Ship via PR.
