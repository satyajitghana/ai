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

## 2. Analytics

**Done:** Cloudflare Web Analytics — the beacon in `app/layout.tsx`, rendered
only when `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` is set (Cloudflare dashboard →
Analytics & Logs → Web Analytics → add `ai.thesatyajit.com` → copy the token
into Vercel's environment variables). Free, cookieless, no consent banner, no
event cap, Core Web Vitals included, and it works without the site being
proxied through Cloudflare. It does not do custom events.

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

- **Media:** move `thesatyajit.com`'s DNS to Cloudflare (free), create an R2
  bucket with the custom domain `media.thesatyajit.com`, and add R2 API keys as
  GitHub secrets; the sync Action and the switch are then one PR.
- **Analytics:** create the Cloudflare Web Analytics site and set
  `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` in Vercel. Decide whether film engagement
  is worth adding PostHog or Umami.
- **Social:** create the X and LinkedIn developer apps, add their secrets, and
  confirm approval-by-commit for the social-poster.
