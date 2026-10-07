# The Brand Crew — specialized agents that run ai.thesatyajit.com

> Companion to `00-ai-site-master-plan.md`. This is the team of Claude agents that
> **manage Satyajit's AI page and personal brand**. You don't edit a website — you
> launch a specialist and review a PR. The crew covers the full brand lifecycle:
> **PLAN → CREATE → POLISH → SHIP → AMPLIFY → MAINTAIN.**

## Why this exists
The site is "managed by Claude." Updating it should be: *say what happened → an agent
produces on-brand content → it validates itself → opens a PR → Vercel deploys.* You
rarely touch a file. The same crew keeps your brand consistent across the **site AND
social** (LinkedIn / X / Medium / Hashnode), because they all read one **voice profile**.

## Primitives — when to use which (you said "agents/skill/plugin whatever")
| Primitive | Role | Why |
|---|---|---|
| **Skill** (`.claude/skills/<n>/SKILL.md` + `tsx` script) | the *hands* — writes a correctly-shaped file, then runs `pnpm validate` | the file shape (frontmatter, Zod schema, slug rules) must be exact every time and self-validate — the loud-failure safety net |
| **Subagent** (`.claude/agents/<n>.md`) | the *worker* — research + judgment in its own context, scoped tools, calls a skill to write | keeps your main session clean; gives each specialist only the tools it needs (web, `gh`, vision) |
| **Slash command** (`.claude/commands/<n>.md`) | the *launch button* you type | "I launch them" = one thing to type |
| **Hook + scheduled routine** | *autopilot* | validate-on-save; nightly/weekly jobs |
| **Plugin** (`brand-crew`) | the *box* it all ships in | one install, versioned with the repo, works in Claude Code local **and** web |

## The voice profile = your brand's DNA
`.claude/brand/voice.md` — read by every author + the voice-editor:
- who you are, what you write about (DL/CV/3D/CUDA/MLOps/systems)
- tone: precise, engineer-first, dry wit, **no marketing fluff**, show the code/numbers
- signature moves (CLI motifs, first-principles, benchmarks), banned words, formatting defaults
→ guarantees one consistent brand voice across the site *and* every cross-post.

---

## The org chart (lifecycle stages)

### 1 · PLAN — strategy & routing
- **editor-in-chief** (orchestrator + strategist) — the front door. Natural language in ("I want to post about the CUDA kernel I wrote"); it routes to the right specialist and chains them (author → voice → validate → audit → PR). Also proactive: maintains an idea queue, suggests topics from your recent git activity / reading / content gaps, and nudges cadence ("no log in 5 days; draft one from your commits?").

### 2 · CREATE — the authors (what you launch most)
| Launch | Agent | Input (effortless modalities) | Produces | Skill |
|---|---|---|---|---|
| `/blog <topic\|notes\|repo>` | **blog-author** | a topic, voice-note transcript, or a repo URL | full technical post (researches web+repo, picks tags, reading time) | new-post |
| `/log <braindump>` | **log-writer** | a sentence, or "from git" | polished dated daily log | new-log |
| `/project <repo-url>` | **project-curator** | GitHub URL | project page (README/stars/stack via `gh`), sets featured | new-project |
| `/read <link\|DOI>` | **reading-curator** | paper/book/arXiv/DOI | reading entry + 1-line take | add-reading |
| `/pub <DOI\|receipt>` | **publications-archivist** | DOI/arXiv or patent receipt | publication or patent record | add-publication / add-patent |
| `/papers [date]` | **paper-scout** | nothing (or a date / an arXiv id) | fetches new arXiv submissions (free Atom API, `scripts/fetch-arxiv.mts`), ranks vs `data/interests.ts`, picks top ~5–10 + writes a "take" each → daily digest `content/papers/<date>.mdx`. Links only (abs/pdf/HTML-view via arxiv.org/html → ar5iv fallback), no stored PDFs. Flags `standout` papers for amplify/blog. | add-papers-digest |
| `/health <lab.pdf>` | **health-ingestor** | lab PDF / photo / text | biomarkers→category/range, updates panel, sanity-checks statuses | update-health |
| `/me <change>` | **profile-keeper** | "now working on X", new GPU, resume edit | edits now / uses / profile / resume | update-now/uses/resume |

### 3 · POLISH — editorial quality
- **voice-editor** (brand-voice guardian) — rewrites/checks any draft against `voice.md`: tone, depth, no fluff, signature phrasing. The "does this sound like me?" gate before anything ships.
- **design-reviewer** (read-only) — pages match the editorial × terminal system (tokens, Hanken/IBM Plex, motion + reduced-motion, the `md·json·mcp` chip).

### 4 · SHIP — safety
- **content-validator** — runs `pnpm validate` / `typecheck` / `build`, diagnoses + fixes failures.
- **agent-readiness-auditor** (read-only) — confirms the new piece is in `llms.txt`, `feed.xml`, `/api/*`, JSON-LD, and the MCP tools; flags gaps (à la Cloudflare "agent readiness").

### 5 · AMPLIFY — brand growth (this is what makes it *brand*, not just *site*)
- **amplifier** (distribution) — turns a published post/project/log into platform-native variants: a **LinkedIn post**, an **X/Twitter thread**, a **Medium/Hashnode crosspost**, a short **TIL** — all drafted in your voice with a canonical link back to the site. Runs as part of the daily autopilot (below) and on `/amplify`.
- **social-poster** — actually publishes the drafts to **X + LinkedIn** (and crossposts). See "Social posting" below for the mechanism + credentials.
- **newsletter-curator** (optional, scheduled) — monthly "what I shipped" roundup from logs.

### 6 · MAINTAIN — freshness & guardians
| Agent | Trigger | Does |
|---|---|---|
| **stats-refresher** | `/refresh` or nightly cron | refresh GitHub/WakaTime/package counts in copy; `revalidateTag` |
| **weekly-digest** | weekly cron | read the week's git activity → draft a "what I shipped" log (as draft, for your ok) |
| **link-seo-curator** (optional) | on-demand | dead links, OG/meta, sitemap freshness |

---

## Daily autopilot (the brand machine that runs itself)
A scheduled chain fires **every day**. It drafts content and opens a **PR** (nothing auto-deploys — see Publish policy); social is **drafted and shown to you for approval before anything posts**. Cadence:

```
Daily (e.g. 21:00 IST) — scheduled routine "daily-brand-run":
  1. signal-gather    → today's git activity (gh) across your repos, WakaTime time,
                        new stars/repos, reading added, what you learned/achieved.
  2. daily-author     → draft today's piece in your voice:
                          • a short "what I learned / what I shipped today" BLOG post
                            (lessons, achievements, a TIL) — your main daily cadence, or
                          • if something big shipped → a full technical blog (held in PR).
                        → /new-post (uses the MDX explainer kit when useful)
  3. voice-editor     → polish to brand voice
  4. paper-scout      → fetch + rank today's arXiv (vs data/interests.ts), write the
                        daily digest content/papers/<date>.mdx (links only, no PDFs);
                        flag any `standout` "crazy paper".
  5. content-validator→ pnpm validate → open a PR with a Vercel preview (you review)
  6. amplifier        → draft an X thread + LinkedIn post + Medium/Hashnode crosspost
                        about the new piece — AND, when a standout paper exists, an
                        explainer thread/post about it ("crazy paper today: …").
                        If it deserves depth → queue blog-author for a full explainer
                        blog (math/diagrams via the MDX kit), as its own PR.
  7. social-poster    → SHOW you the drafts; post to X / LinkedIn / Medium / Hashnode
                        ONLY after you approve.
Nightly (e.g. 02:00) — "stats-refresher": refresh GitHub/WakaTime numbers (own PR).
Weekly (Sun)         — "weekly-digest": a longer "what I shipped this week" post + crosspost.
Monthly              — "newsletter-curator": roundup (optional).
```

- **If there's nothing meaningful that day**, the run no-ops (no filler) — quality gate so the brand never posts noise.
- Scheduling: **Claude Code on web scheduled agents / `/schedule` routines** (cron). Each run is a fresh agent session using the same skills/agents — the autopilot is the *same crew*, triggered by a clock instead of you.
- **`/packages` is dropped** (no popular published packages) — that page/agent is out of scope.

## Social posting — FREE-FIRST mechanism (no paid tools; Postiz ruled out)
Constraint: **no paid services.** (Postiz cloud is paid; self-hosting it is free but unwanted ops.) Since we already gate on **your approval before every post**, the marginal value of full automation is small — the bottleneck is your review, not the final click. So:
- **Drafts queue is the backbone (free, zero creds):** every run writes platform-ready drafts to a `drafts/<date>/` folder (X thread, LinkedIn post, Hashnode/dev.to article) — you review them in the PR. This always works regardless of API access.
- **Auto-post on approval, via FREE direct APIs where they exist:**
  - **X/Twitter:** the **Free API tier allows *posting*** (write-only, ~500 posts/mo — a daily bot is ~30/mo, well within). Post via OAuth — **$0**. ✅
  - **Hashnode:** free GraphQL publish API — clean dev crosspost. ✅
  - **dev.to:** free Forem publish API — add as the second free dev crosspost target (better than Medium). ✅
  - **LinkedIn:** no free *automatic* path (needs app review). Start **draft-and-you-post** (one paste); upgrade to API only if/when you get an app approved. ⚠️
  - **Medium:** posting API retired → **RSS import** (point Medium at `/feed.xml`) or skip. ⚠️
- **Platform MCPs** optional later, but they need the same creds and add 3–4 servers to maintain — not worth it for $0 setup.

**Platform realities (2026) — MCP vs direct API is a near-false choice (both hit the same API + need the same creds/approvals):**
- **X/Twitter:** write access needs a **paid API tier**; threads = chained replies. Workable directly or via MCP, but the cost/tier is the gate, not the transport.
- **LinkedIn:** posting needs the **"Share on LinkedIn"/Community Management product + app review** (`w_member_social`). This approval is the real bottleneck — same whether MCP or direct.
- **Medium:** **integration-token API was retired (~2023)** → no reliable programmatic posting. Crosspost via RSS import or skip; lean on **Hashnode** (clean GraphQL publish API) for dev crossposts.
- **Hashnode:** easy, well-documented GraphQL API.
→ With approval-before-posting, the free path is: **drafts queue → you approve in the PR → auto-post via free direct APIs (X free tier, Hashnode, dev.to); LinkedIn/Medium stay manual.** No paid tooling.

**Policy (LOCKED): approval before every post, $0 stack.** The crew always **shows you the drafts first** (in the PR / `drafts/`); nothing publishes until you approve. On approval, post via free direct APIs where available, else you paste. OAuth tokens live in server-only env, never in the repo.

## How you launch it (UX)
- **Common** → slash commands: `/blog /log /project /read /pub /health /me /amplify /refresh`.
- **Vague** → talk to **editor-in-chief**; it routes + chains the crew.
- **Hands-off** → scheduled routines: daily `daily-brand-run`, nightly `stats-refresher`, weekly `weekly-digest`, cadence nudges.
- **Publish policy (LOCKED): everything ships via PR with a Vercel preview** — nothing goes live to the site, and nothing posts to social, without your review/merge. Social is drafted, shown to you, and only published on approval.

## Autopilot
- **Validate hook** (PostToolUse/Stop): auto-run `pnpm validate` after any content edit so nothing broken is committed.
- **SessionStart hook**: on Claude Code web, install deps + prime the container so the crew is ready instantly.
- **Routines** (via `/schedule`): nightly stats, weekly digest, monthly newsletter.

## Packaging
Ship the whole thing as one **plugin: `brand-crew`** = all skills + agents + slash commands + the validate hook + the site's read-only MCP. One `claude plugin add`, versioned with the repo, identical in Claude Code local and web. The site is then *literally* maintained by an installable Claude crew.

## Decisions (LOCKED from Q&A)
- **Platforms:** X / Twitter, LinkedIn, Medium / Hashnode (all three). Canonical link always back to the site.
- **Daily content:** short "what I learned / what I shipped / achievement" blog posts as the main daily cadence; a full technical blog auto-drafted on big days; a weekly "what I shipped" roundup. **`/packages` dropped** (no popular packages).
- **Publish gate:** everything via PR + Vercel preview; you merge. Nothing auto-deploys.
- **Social:** drafted → shown to you → posted only on approval.
- **Blog richness:** MDX explainer kit (math, diagrams, interactive viz) — see `00-ai-site-master-plan.md`.

## Packaging (LOCKED)
Ship the whole crew as **one installable Claude plugin: `brand-crew`** — `claude plugin add` pulls in all skills + agents + slash commands + the validate/SessionStart hooks + the site's read-only MCP. Versioned with the repo (`.claude-plugin/` + a local marketplace entry so it installs from this repo), identical in Claude Code local and web. The site is *literally* maintained by an installable Claude crew.

(Social mechanism resolved: free-first — drafts queue + free direct APIs (X free tier, Hashnode, dev.to); LinkedIn/Medium manual. No paid tools.)
