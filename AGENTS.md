<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# This repo is agent-operated — start with CLAUDE.md

This is **ai.thesatyajit.com**, an AI-native personal site whose content is maintained by a crew of Claude agents. Whatever agent you are:

- **Read [`CLAUDE.md`](./CLAUDE.md) first.** It is the map: architecture, the content-layer contract (each content kind, its frontmatter, file naming), the `data/*.ts` records, "how to add X" recipes, the available commands, and the guardrails.
- **Read [`/llms.txt`](https://ai.thesatyajit.com/llms.txt)** (served from `app/`) for the machine-readable site index; pages also have `.md` variants and `/api/*` JSON surfaces.
- The crew (skills, slash commands, subagents, validate hook) ships as the installable **`brand-crew`** plugin under `brand-crew/`; specialist agents live in `brand-crew/agents/`. Design docs: `plans/00-ai-site-master-plan.md` and `plans/01-brand-crew.md`.

**Guardrails (apply to every agent):** run `pnpm validate` after any `content/`/`data/` edit and fix until green; never edit `data/.generated/*`; everything ships via PR (nothing auto-deploys); never post to social without explicit approval (`/amplify` only drafts into `drafts/<date>/`); no PDFs stored for papers.
