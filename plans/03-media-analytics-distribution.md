# Media, analytics and distribution

Four questions: where the films and heavy assets are served from, how traffic
is measured, how approved social posts go out automatically without losing
track of what was posted, and how the site earns backlinks. What is already
built is marked **done**; everything else needs a decision or an account.

## 1. Serving films and media

**Now (done):** media is committed to this GitHub repo and served from
`public/` by Vercel's CDN. Every film, poster and thumbnail URL goes through
`lib/media.ts` → `mediaUrl()`, so moving them is one environment variable:
`NEXT_PUBLIC_MEDIA_BASE=https://media.thesatyajit.com`. Captions stay
same-origin (a cross-origin `<track>` needs CORS and `crossorigin`).

Why it will not last:

| | today |
|---|---|
| `public/` | 334 MB: 264 MB article figures and media, 54 MB films, ~15 MB thumbnails |
| per film | 1.5-2.5 MB (pixel films ship at 640x360 and scale up hard-edged) |
| cost | every clone carries it; every play counts against the Vercel plan's data transfer; a thousand plays is ~2 GB |

**Options, best first:**

1. **Cloudflare R2 behind `media.thesatyajit.com` (recommended, free at our
   size).** R2's free tier covers 10 GB of storage — all of today's media is
   about a third of a gigabyte — and R2 never charges for bandwidth, so plays
   are free however many there are. S3 API, Cloudflare's CDN in front, range
   requests for video. The custom domain needs `thesatyajit.com`'s DNS on
   Cloudflare (free plan); `ai.thesatyajit.com` stays pointed at Vercel as a
   **DNS-only** record — do not proxy Vercel through Cloudflare, two CDNs in a
   row fight over caching and Vercel advises against it. Only `media.` is
   proxied. A
   `media-sync` GitHub Action uploads `public/films` and `public/thumbs` (later
   `public/articles/**` media) with `aws s3 sync --endpoint-url …` on every push
   to `master`; Vercel gets the env var; the manifests (`data/.generated/*.json`,
   with sha and bytes) stay in git so `pnpm validate` still proves each file is
   current. Media then leaves the repo (`.gitignore` + the bucket as the source of
   truth), and the repo stops growing.
2. **Staying on GitHub, properly:** a separate `ai-media` repo published with
   GitHub Pages behind `media.thesatyajit.com`. Correct `video/mp4` types,
   Fastly CDN, range requests; soft limits of 1 GB per site and 100 GB/month.
   The main repo stops growing; no new vendor. A good interim step.
3. Vercel Blob (simplest, same bill, egress priced), Bunny storage + pull zone
   (cheap, video-friendly), Cloudflare Stream or Mux (adaptive HLS, per-minute
   pricing — more than a 1-2 minute clip that plays muted by default needs).

Not suitable: GitHub Releases (downloads served as `application/octet-stream`,
meant for attachments), `raw.githubusercontent.com` (`text/plain` with
`nosniff`, so video may not play), jsDelivr's GitHub CDN (fair-use policy is
for code, 20 MB file cap).

**Status, 2026-09-27 (done):** `thesatyajit.com` is on Cloudflare DNS, and
`ai.thesatyajit.com` is a DNS-only CNAME to Vercel (answers carry
`server: Vercel`), so nothing about the site's own serving changes. Films,
posters, thumbnails and every article figure and clip are served from R2:

- `.github/workflows/media-sync.yml` runs on each push to `master` that
  touches `public/films`, `public/thumbs` or `public/articles`. It uses a
  pinned rclone (Ubuntu's 1.60 reports R2 uploads as 501 errors), a canary
  upload, and `rclone sync --checksum` of the images and videos under `ai/`,
  with a year of immutable caching. Last of all it publishes `ai/index.json`,
  every uploaded path with the first 16 hex digits of its SHA-256.
- Before `next build`, `scripts/media-map.mts` fetches that index and keeps an
  entry only where this checkout's file has the same hash, writing
  `lib/media-map.json`; `mediaUrl(path)` links a kept file as
  `${base}${path}?v=${hash}`, so a changed file is a new URL. Anything else
  stays same-origin, including a figure a pull request adds before it reaches
  the bucket, and everything if the index cannot be fetched. That is why
  `NEXT_PUBLIC_MEDIA_BASE` is safe on **Preview** as well as Production.
- A merge to `master` starts Vercel's production build and media-sync at the
  same moment, and the build reads the index in its first minute, before the
  sync has published it. The first merge with article media lost that race
  and served everything same-origin until a redeploy. So a production build
  that finds media here the index does not match yet polls for the index of
  its own commit (`VERCEL_GIT_COMMIT_SHA`) for up to `MEDIA_WAIT` seconds
  (default 300; the full first sync took two minutes). A build whose media
  all match, which is most of them, does not wait.
- On Vercel the same script deletes the served-from-R2 files from the build's
  copy of `public/` (~409 MB of 420), so a deployment no longer carries them.
  It keeps thumbnails (the OG image routes read them at build), any path a
  component names as a literal, and every non-media file (captions, which a
  cross-origin `<track>` would need CORS for, the JSON `<Receipts>` reads,
  interactives' data files). The files stay in git: `validate:films` and
  `validate:assets` check them, and a local build is always same-origin.

Why the pruning matters: Vercel stores every deployment's static output,
previews included, until it is deleted, and each one carried the whole of
`public/`. About eighty deployments of ~420 MB is how the project reached
35 GB of Deployment Storage. Set a retention policy (Project → Settings →
Deployment Retention) and push each branch in batches, not a commit at a time.

### The shared bucket

`ai-thesatyajit-media` sits behind `media.thesatyajit.com`, and more than one
site can serve from it, so it is laid out by site, one top-level prefix each,
and each repository writes only under its own:

```
ai-thesatyajit-media/                  https://media.thesatyajit.com/…
  ai/                                  ai.thesatyajit.com (this repo, media-sync)
    films/<slug>.mp4 | -poster.webp | .vtt
    films/architectures/<slug>.*
    thumbs/<slug>.jpg
    thumbs/architectures/<slug>.jpg
    articles/<slug>/…                  article figures and clips (images and videos only)
    index.json                         path → sha256[:16], written last (scripts/media-map.mts)
  <site>/                              another subdomain's own prefix
  shared/                              anything two sites both link to
```

`rclone sync` deletes remote files that are gone locally, so a sync must only
ever target its own prefix. media-sync refuses to run with an empty or nested
prefix. This site's `NEXT_PUBLIC_MEDIA_BASE` is `https://media.thesatyajit.com/ai`.

## 2. Analytics

**Done:** Cloudflare Web Analytics — the beacon in `app/layout.tsx`, on
Vercel production with the site's token as the default
(`NEXT_PUBLIC_CF_ANALYTICS_TOKEN` overrides it). Free, cookieless, no consent banner, no
event cap, Core Web Vitals included, and it works without the site being
proxied through Cloudflare. It does not do custom events.

**Done:** Vercel Web Analytics — `<Analytics />` from `@vercel/analytics/next`
in `app/layout.tsx`, which starts reporting once Analytics is enabled on the
project (Vercel → Project → Analytics). It counts page views by route,
referrer and country, and is also cookieless. The two overlap on purpose:
Cloudflare's has no event cap and Web Vitals; Vercel's sits beside the
deployment and usage numbers.

Next, by need:

- **Film engagement** (sound on, played to the end, which articles' films get
  watched) needs custom events. Free options: PostHog Cloud's free tier,
  Umami Cloud's free tier, or self-hosted Umami. Check each one's current
  monthly limits; any of them is plenty for this site today.
- **AI-agent traffic** — the `.md` twins, `llms.txt`, `/api/*`, MCP — never runs
  JavaScript, so page analytics cannot see it. Count it server-side: Vercel's
  logs/observability, or a small middleware counter keyed by user agent.
- **Search:** Google Search Console and Bing Webmaster Tools (both free; submit
  `sitemap.xml`).

## 3. Auto-posting to X and LinkedIn, and remembering what was posted

The approval rule stays: **nothing is posted unless Satyajit approved it.** What
changes is where approval lives — in a commit instead of a chat.

```
/amplify → drafts/<date>/<slug>/{x-thread.md, linkedin.md, devto.md, hashnode.md}
            frontmatter  status: draft
Satyajit → flips status: approved        (in the PR, or a follow-up commit: the approval record)
push to master → GitHub Action social-publish
            for each approved draft with no ledger entry:
              post it → append to data/social/posts.json → commit back [skip ci]
```

- **The ledger is the state.** `data/social/posts.json` holds one entry per
  draft × platform: post id, URL, time, and a hash of the text that was posted.
  An entry means it is never posted again; a draft edited after posting fails
  the run instead of reposting. The same file can drive "Discussed on X /
  LinkedIn" links under an article.
- **X:** API v2 `POST /2/tweets`; a thread is a chain of replies
  (`reply.in_reply_to_tweet_id`); the film's 1280x720 social cut uploads as
  native video. Needs a developer app with write access, keys as repo secrets.
  X's access tiers and post limits change often — check the current ones
  before relying on them.
- **LinkedIn:** the self-serve "Share on LinkedIn" product gives the
  `w_member_social` scope; `POST /rest/posts` with `author: urn:li:person:<id>`,
  the commentary and the article link; video goes through the Videos API
  (initialize upload → upload parts → finalize). Member tokens last 60 days and
  self-serve apps get no refresh token, so it needs re-authorising about every
  two months; the Action should warn a week before expiry.
- **dev.to and Hashnode** have free posting APIs and take a `canonical_url` —
  automatable today, and each post is a backlink.
- `brand-crew/agents/social-poster.md` currently accepts approval only "in the
  current conversation". The Action needs that rule restated as "approved in a
  commit by Satyajit". **That is a policy change and needs his explicit yes.**

## 4. Backlinks

`plans/02-seo.md` has the manual playbook. What can be automated on top of it:

1. **Canonical cross-posts** to dev.to and Hashnode (Medium by import) from the
   same publish Action: one backlink per flagship article, canonical preserved.
2. **Native video** — the film's social cut on X, LinkedIn and YouTube, each
   with the article URL. The films are the most shareable thing the site has.
3. **IndexNow** ping on deploy (Bing, Yandex, Seznam; free) so new articles are
   discovered in hours, not weeks.
4. **Measure:** the Search Console Links report monthly, plus webmentions
   (webmention.io + Bridgy) to collect links, reposts and replies from X,
   Bluesky and Mastodon into a `data/mentions` snapshot the site can show.
5. **Still human:** Hacker News, Lobsters and Reddit submissions, emailing the
   authors of reviewed projects, awesome-list PRs, alphaXiv comments. Agents
   draft these; a person sends them.

## What else Cloudflare gives for free

- **Workers** (a generous free daily request allowance, cron triggers): an
  IndexNow ping on each deploy, a webmention receiver, or the social-publish
  job itself if it ever outgrows GitHub Actions.
- **Email Routing:** `hello@thesatyajit.com` forwarding to a personal inbox,
  for the "email the authors" part of the backlinks playbook.
- **Turnstile:** a free, privacy-preserving CAPTCHA if the site ever grows a
  form (comments, a newsletter).
- Not recommended: moving hosting from Vercel to Cloudflare Pages. The site
  leans on Vercel's Next.js integration (prerendered OG images, route
  handlers, tracing), and nothing here needs it moved.

## Decisions needed

- **Media:** DNS is already on Cloudflare. Create an R2 bucket (default name in
  the workflow: `ai-thesatyajit-media`, or set the `R2_BUCKET` repository
  variable), attach the custom domain `media.thesatyajit.com`, add the
  secrets `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_ENDPOINT` (the S3
  endpoint shown with the token, the jurisdiction one if the bucket has one;
  the token's "token value" is not needed), run
  media-sync once (Actions → media-sync → Run workflow), then set
  `NEXT_PUBLIC_MEDIA_BASE=https://media.thesatyajit.com/ai` on Vercel Production
  and redeploy. **Done, 2026-09-27:** bucket, domain, secrets, sync, the
  env var on Production, and article media. Left: the env var on Preview too.
- **Analytics (done, 2026-09-27):** the site token is the default in
  `app/layout.tsx`, used on Vercel production only. Kept for reference:
  `ai.` is DNS-only, so Cloudflare's automatic setup (which
  injects the beacon at its edge) cannot apply; add the site with the manual
  JavaScript snippet, take the token from it, and set
  `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` in Vercel (or commit it as the default: it
  is public in every page). Decide whether film engagement
  is worth adding PostHog or Umami.
- **Social:** create the X and LinkedIn developer apps, add their secrets, and
  confirm approval-by-commit for the social-poster.
