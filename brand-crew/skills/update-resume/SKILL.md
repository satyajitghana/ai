---
name: update-resume
description: Update Satyajit's resume — edit the typed Resume object in data/resume.ts (experience, education, skills, projects, publications, patents, dates). Use when the user reports a new role, achievement, skill, or asks to fix resume details. The HTML page, downloadable PDF, and /resume.json all regenerate from this one object at the next build.
---

# update-resume

`data/resume.ts` is the single source of truth. Three surfaces regenerate from it
automatically at build time — never edit them directly:

- `/resume` (HTML page)
- `public/satyajit-ghana-resume.pdf` (via `scripts/build-resume-pdf.mts`, runs as `prebuild`)
- `/resume.json` (JSON Resume schema mapping)

## Steps

1. Read `data/resume.ts` and locate the section to change (`contact`, `summary`,
   `experience[]`, `education[]`, `skills[]`, `projects[]`, `publications[]`,
   `patents[]`). Keep the existing `Resume` interface shapes — do not add fields
   without updating the interface.
2. Make the edit. Dates use the existing string formats already in the file.
   Facts only — never invent titles, dates, or achievements; if a detail is
   missing, ask Satyajit instead of guessing.
3. Verify the PDF still renders on one clean page:
   `pnpm tsx scripts/build-resume-pdf.mts` (writes `public/satyajit-ghana-resume.pdf`;
   check it reports success). If content overflows, tighten wording rather than
   shrinking type.
4. Run `pnpm validate` — must pass.
5. Ship via PR (never commit to master directly). Mention in the PR body that
   the PDF regenerates at build.
