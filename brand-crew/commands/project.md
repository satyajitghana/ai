---
description: Add a project page from a GitHub repo.
argument-hint: [repo-url]
---

Use the **new-project** skill for: $ARGUMENTS

Pull repo metadata + README via `gh`, write `content/projects/<slug>.mdx`, then run `pnpm validate`. Ship via PR.
