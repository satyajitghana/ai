---
name: recheck-reposts
description: Recheck Satyajit's X reposts (https://x.com/thesudoer_) for things the site should write up, and write them. Use when he says "I reposted a few more", "check my reposts", "recheck", "/reposts", or shares that he has been reposting links he wants covered. Fetches the timeline with `pnpm reposts`, drops everything already decided in data/reposts-ledger.json, triages the rest (new article, update to an existing one, roundup, already covered, skip) with primary sources found for each, records every decision in the ledger, then writes the articles (in parallel for a batch) and ships them via PR.
---

# recheck-reposts: the repost-to-article loop

Satyajit bookmarks things he wants covered by **reposting** them on X. This skill
turns a recheck into a repeatable job:

**fetch → triage → record → write → review → ship.**

The ledger (`data/reposts-ledger.json`) is what makes it repeatable. Every post
ever triaged is in it with its decision, so a recheck only ever shows what is new.

## 1. Fetch what is new

```bash
pnpm reposts                 # new posts only, newest repost first
pnpm reposts --json          # the same, machine-readable
pnpm reposts --all --pages=5 # ignore the ledger (e.g. to re-audit)
```

`scripts/fetch-reposts.mts` reads the profile through the fxtwitter mirror
(`api.fxtwitter.com/2/profile/<handle>/statuses`). x.com itself needs a login.
The handle comes from `profile.links.x`.

**What it prints for each post:**
- text
- expanded links
- the quoted post
- media types
- **on the site** hints: pages that already mention its arXiv ids, Hugging Face or GitHub repos (**link** hits, strong), or distinctive names from the text (**name** hits, weak);
- its thread (below).

**Threads.** Many posts keep the substance below the first post: "repo in the post below 👇", a 🧵 whose later posts carry the paper and the numbers, "情報元はリプ欄" (the source is in the replies). So for every new post the scan also reads its thread and the first page of replies, and prints:
- `thread ↳` each continuation post by the author, with its links;
- `author reply ↳` the author's replies that carry a link;
- `replies link:` paper and repo links (arXiv, GitHub, Hugging Face, `*.github.io`, OpenReview, ModelScope) that other people replied with. These are leads, not sources: confirm one belongs to the post before using it.

Thread links count toward the coverage hints. Read the thread before deciding a post has no source. `--no-threads` skips it (about a minute faster for a hundred posts).

**Paging.** The API returns newest-repost first, but `created_at` is when the *original* was posted, so there is no date cutoff. Paging stops at the first page whose every post is already in the ledger.

**If the API fails,** retry once later. If it is still down, ask Satyajit to paste the links. Do not scrape x.com.

## 2. Triage every post

For each post, find the **primary source** before deciding anything:
- the paper (arXiv id);
- the repo (`git clone --depth 1`; curl to github.com is blocked in the sandbox);
- the model card (`https://huggingface.co/api/models?author=<org>` lists what exists);
- or the report.

Where to look when the post doesn't link it (after its thread, which the scan already printed):
- Posts in Japanese, Chinese or Korean often say the source is in the replies ("情報元はリプ欄"). **WebSearch** the title plus the author names.
- An `x.com/i/article/…` link cannot be read; search for the topic instead.

Then give each post one decision:

| Decision | When | Record as |
|---|---|---|
| **article** | A primary source exists, and there is a mechanism to explain or a claim to check. | `--status=article --slug=<planned slug>` |
| **roundup** | Several small posts on one theme: a week of Jev alternatives, six 3D-reconstruction papers, "27B on a 12 GB card". | `article` with the roundup's slug, one call for all its posts |
| **update** | It adds to an existing article: a port, a new variant, a correction, a new measurement. Write a dated section or note there and bump `updated:`. | `--status=update --slug=<existing>` |
| **covered** | The site already has it. Open the page the hints point to and confirm; a name hit alone is not proof. | `--status=covered --slug=<existing>` |
| **skip** | Nothing to check: a meme, praise, engagement bait, a closed product launch with no method, a frontier API launch with only a blog post, a demo video with no source, trading-returns promotion. | `--status=skip --note="<why>"` |

The **house guardrails** decide *how* a topic is covered, never *whether* to skip something the user asked for:

| Topic | Coverage |
|---|---|
| Trading systems | Architecture and decision boundary only. No strategy, returns or backtests. |
| Security | No exploit path. |
| Abliteration and refusal removal | Mechanism and published research only. No recipe. |
| Crypto tokens | No ticker, price or purchase path. |
| Fraud | Nothing that reads as evasion guidance. |

**Present the triage before writing**, unless Satyajit already said to go ahead: new articles (with sources), updates, roundups, covered, skipped (one line each). He redirects cheaply at this point and expensively after.

## 3. Record the decisions

Record every decision as soon as it is made, so a recheck in the middle of the batch does not surface the same posts again:

```bash
pnpm reposts record --status=article --slug=trackeverything 2104004642158051563
pnpm reposts record --status=skip --note="meme" 2102822762662228398
```

`record` fills each post's author, URL and date from the last scan. It refuses an article, update or covered decision without `--slug`, and a skip without `--note`.

If a planned slug changes while writing, record the post again with the final slug. Commit the ledger together with the articles it names.

## 4. Write

**One article:** use the **new-article** skill.

**A batch of more than two:** run parallel authors in the **shared checkout**, one per article. No git worktrees: Satyajit's disk is tight. The brief gives each author a fixed set of paths it may write (its article, components, media folder and storyboard) and forbids git writes, so the lead commits each article by explicit path when it reports. Corpus-wide checks can fail on another author's half-written file; authors fix only their own failures.

The lead owns everything shared: `lib/media-map.json` (`pnpm media:push /articles/<slug>`), the widget registry (stage a copy filtered to files that are committed, so each commit builds), `data/.generated/*` (`fetch:models` / `fetch:repos` for the new ids only), `pronounce.json`, the ledger and the changelog. Delete each author's scratch (clones, downloads) once its article is committed.

Brief each author with [`author-brief.md`](author-brief.md) (the shared contract), plus a subject message containing:
- slug and scratch directory;
- the primary sources;
- what to explain, and which claims to check;
- the related site articles to read and link;
- a component idea;
- a storyboard host: style, species, name, hat.

**Hosts must be unique across `data/films/**`.** Check a name is free before assigning it. Spread styles toward the least-used ones.

**Permitted exceptions to "never execute third-party code"** (running published weights through an official runtime, or stable-diffusion.cpp, which Satyajit asked for) must be granted explicitly in the subject message, with the limits.

**Limits on concurrency:**
- About 6–8 authors at once, all at `nice -n 10`.
- Watch disk (`df -h /`); authors keep scratch under 2 GB and delete it when done.
- If a container restart kills a run, resume the author by message rather than relaunching; its files survive.

## 5. Review, merge, ship

For each author report:
- **Re-check what it lists as unverified**, and spot-check 2 or 3 headline numbers yourself against the source. Recompute arithmetic.
- Two errors have come up before: a model-derived figure presented as measured (e.g. "2.4% per step" that was a multiply-add estimate), and units mixed (GB vs GiB).
- **Commit** its files by explicit path, with its media pushed and the filtered widget registry.
- **Cards:** fetch only the new ids. A full `pnpm fetch:models` re-dates every existing card.

  ```bash
  pnpm fetch:models <owner/name> …
  pnpm fetch:repos <owner/name> --clone-only --clones-dir=<dir>
  ```
- **Film and thumbnail:** storyboards are in the story format; a film pass adds bespoke scenes (SKILL.md) and renders `build.mjs <slug>` then `build.mjs --thumbs <slug>`, one render at a time. On a Mac set `NODE_PATH` and `EXPLAINER_PYTHON` as SKILL.md says. **Look at each one.**
  - A bare equation or an empty grid is a weak cover.
  - Point it at a mechanism scene with `"thumb": { "scene": N }`, inserted as one line after `"palette"`. Never reformat the JSON; that rewrites the whole file and changes the storyboard hash.
- Then:
  - `pnpm validate`
  - `pnpm build`
  - the function-size check from CLAUDE.md
  - commit with the regenerated changelog
  - push
  - open the PR, or update the open one.
- Report to Satyajit:
  - what was written (with the key finding of each);
  - what was covered or skipped and why;
  - anything left unverified.

## Files

- `scripts/fetch-reposts.mts`: the fetcher, coverage hints and `record`.
- `data/reposts-ledger.json`: every triaged post (status, slug or note, author, URL, posted, decided). Committed and reviewed in PRs like any other data.
- `author-brief.md`: the shared contract for parallel article authors.
