# Deploy runbook — ai.thesatyajit.com

## 1. Vercel project
```bash
# from the repo root (after pushing to GitHub)
vercel link        # or import satyajitghana/ai in the Vercel dashboard
```
- Framework preset: **Next.js** (auto). Build command: `pnpm build` (the `prebuild`
  step generates `public/satyajit-ghana-resume.pdf` automatically).
- Node 20+ runtime (default is fine).

## 2. Environment variables (ALL optional — the site fully works with none)
| Var | Effect when set | Effect when absent |
|---|---|---|
| `SITE_URL` | canonical base for llms.txt/JSON-LD/sitemap | defaults to `https://ai.thesatyajit.com` |
| `GITHUB_TOKEN` | live GitHub stats (GraphQL, hourly revalidate) | dummy seed data + "seed data" footnote |
| `OPENAI_API_KEY` | RAG chat + `/api/ask` + MCP `ask_satyajit` go live | graceful 503 / offline notice |
| `CHAT_MODEL` | override the `mini` tier (router default) | `gpt-5.4-mini` |
| `CHAT_MODEL_NANO` / `CHAT_MODEL_MAIN` | override the `nano` / `main` tiers | `gpt-5.4-nano` / `gpt-5.4` |

Server-only — never `NEXT_PUBLIC_`.

## 3. Domain
- Vercel → Settings → Domains → add `ai.thesatyajit.com`.
- In your DNS (thesatyajit.com zone): `CNAME ai → cname.vercel-dns.com`.

## 4. Cron (optional, for live GitHub stats freshness)
`vercel.json`:
```json
{ "crons": [{ "path": "/api/github", "schedule": "0 * * * *" }] }
```
(Stats also revalidate hourly on demand via the tagged fetch; the cron just keeps them warm.)

## 5. Content updates = git pushes
Everything (pages, llms.txt, .md variants, feeds, PDF) regenerates per deploy.
The brand-crew agents open PRs; merging deploys. Nothing else to operate.

## 6. Post-deploy verification
```bash
curl https://ai.thesatyajit.com/llms.txt | head
curl https://ai.thesatyajit.com/blog/hello-world.md | head
curl https://ai.thesatyajit.com/api/resume | head -c 200
npx @modelcontextprotocol/inspector   # connect to https://ai.thesatyajit.com/api/mcp/mcp
```
Then the real test: paste `ai.thesatyajit.com` into Claude/ChatGPT and ask about Satyajit.
