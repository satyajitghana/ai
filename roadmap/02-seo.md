# SEO — audit, on-page improvements, and the off-page playbook

_Audited 2026-07-24 on ai.thesatyajit.com; re-audited 2026-11-12 after the move
to ai.satyajit.si (the old host 301s path-for-path). Next.js 16 App Router._

The technical/on-page foundation here is already strong. This doc records the
audit, the concrete changes shipped in this pass, and the off-page (backlink)
work — which is manual by nature and can't be committed as code.

## What was already solid (keep)

- **Metadata**: `app/layout.tsx` sets `metadataBase`, a title template, rich
  description, keywords, canonical, `openGraph`, `twitter` (summary_large_image),
  and a permissive `robots` (`max-image-preview: large`, `max-snippet: -1`).
- **Per-route OG images**: every section and every `[slug]` has an
  `opengraph-image.tsx` (branded 1200×630 via `lib/og`). This is the biggest
  social/backlink-CTR lever and it's already universal.
- **robots.ts**: welcomes all crawlers and explicitly allows the AI crawlers
  (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …); points at the sitemap.
- **sitemap.ts**: enumerates all static pages + every content item with
  `lastModified`.
- **JSON-LD**: `Person` + `WebSite` (with a valid `SearchAction` → the real
  `/search` page) sitewide; `Article`/`BlogPosting`/`ScholarlyArticle`/
  `SoftwareSourceCode` per page.
- **Agent-readable surfaces**: `llms.txt`, `llms-full.txt`, `.md` per page,
  `/api/*`, MCP — strong for AI-search visibility (ChatGPT/Perplexity/Claude).
- **Canonicals** on every page; **RSS** feed; clean semantic HTML headings.

## What this pass changed (on-page)

1. **Richer `Article`/`BlogPosting` JSON-LD** (`lib/jsonld.tsx`): added `image`
   (the per-article OG image, plus the cover when present), `publisher`,
   `mainEntityOfPage`, `wordCount`, `timeRequired`, `articleSection`,
   `inLanguage`, `isAccessibleForFree`, and a guaranteed `dateModified`. This is
   what makes an Article eligible for richer Google results (image + dates).
2. **`BreadcrumbList` JSON-LD** (`breadcrumbJsonLd`, injected on article pages):
   Home › Articles › <title>. A recognised rich-result + site-structure signal.
3. **Sitemap** (`app/sitemap.ts`): added the two missing pages (`/models`,
   `/architectures`); added `changeFrequency` + `priority` (homepage 1.0,
   article/blog indexes 0.8 daily, individual articles 0.7–0.8 monthly).

Verify after deploy: Google Rich Results Test + Search Console → Enhancements
(Breadcrumbs, Articles) and the sitemap submission.

## Pass 2 — 2026-11-12, after the domain move

Audited live and in code: no old-host reference in the code that writes
metadata, canonicals, the sitemap, robots, JSON-LD, the feed, llms.txt or the
OpenAPI document (the 2026-06-03 log's own prose still names it, as history);
every route has one `<h1>` and its own canonical; `/search` and the 404 are
`noindex`; every `<Figure>` has `alt`; no duplicate titles or descriptions;
`validate:links` holds the orphan floor. Changed:

1. Article/architecture/blog/project JSON-LD `author` and `publisher` carry
   `@type`, `name` and `url` beside the `@id`, instead of a bare reference that
   only resolves for a consumer joining nodes across script blocks.
2. `/articles` and `/architectures` emit `CollectionPage` + `ItemList` (the
   items the server renders, name and url only) and use `seo()`.
3. Four routes had no share image (`seo()` sets `openGraph`, which drops the
   root card): `/architectures`, `/math`, `/articles/scoring`, `/lab/neuron-lab`
   now have their own `opengraph-image.tsx`.
4. Sitemap: lastmod on index pages, thumbnails as image entries, the 211 films
   as video entries.
5. `/feed.xml`: newest 50 items (was every item, ~800 KB per poll) and an
   `atom:link rel="self"`.
6. `/arxiv/<date>` and `/logs/<slug>` descriptions (a 288-character run-on;
   none) and `og:url`; `/developers*` titles no longer get the suffix past 60.
7. IndexNow on production deploys (`.github/workflows/indexnow.yml`).

Open: 520 of 701 article titles exceed 60 characters ("Subject: hook"), so
results truncate them. A `seoTitle` frontmatter field is the fix if Search
Console shows poor click-through on them. The explainer-film engine still
paints `ai.thesatyajit.com` on every thumbnail and film end card.

## On-page backlog (worth doing, not yet done)

- ~~Related-articles block~~ — done (`lib/related.ts`, `<RelatedArticles>`).
- **`FAQPage` / `HowTo`** JSON-LD on explainers that naturally Q&A.
- **Tag hub pages** (`/articles/tag/<tag>`) — topical landing pages that
  aggregate internal links and rank for the topic term.
- **`Organization` node with a `logo`** (for Article `publisher`) if we ever
  want the publisher logo in rich results (Person publisher is fine for now).
- **Image `alt` sweep** across the interactive components (mostly done via
  `aria-label`; audit the `<Figure alt>` values agents generate).

## Off-page / backlinks playbook (manual, high-leverage)

Backlinks are earned, not shipped. The site already has the two things that make
a link worth giving: genuinely original explainers + diagrams, and clean OG
cards. The distribution work:

1. **Canonical cross-posts.** Re-publish flagship articles to Medium, dev.to,
   Hashnode, and LinkedIn with `rel=canonical` back to ai.thesatyajit.com. The
   `/amplify` flow already drafts these into `drafts/<date>/` — ship them. Each
   is a do-follow-ish referral + a canonical backlink.
2. **Aggregators / communities.** Submit standout pieces (the `standout`/
   `featured` ones) to Hacker News, Lobsters, r/MachineLearning, r/LocalLLaMA,
   and the relevant Discords. One front-page hit → dozens of organic links.
3. **Awesome-lists & directories.** PR the site/articles into `awesome-*`
   (awesome-llm, awesome-mlops, awesome-cuda) and personal-site directories.
4. **Ride the paper.** For paper explainers, link the article from the arXiv
   paper's "external discussion" surfaces (alphaXiv, Papers-with-Code, the
   authors' threads). Explainers of fresh papers earn links fastest — keep the
   24-hours-after-drop cadence.
5. **Reciprocal / citation links.** When an article builds on another lab's
   post, email them the explainer; many link back from their "coverage" section.
6. **Wikipedia / Wikidata** entity for the author (publications already give
   notability signals) → a high-authority `sameAs` link.
7. **GitHub.** Link the repo (README) to the site and vice-versa; pin the repo;
   the repo itself ranks and passes a link.
8. **Profiles.** Ensure `sameAs` targets (GitHub, LinkedIn, X, Scholar, Medium)
   all link back to the site — consistent NAP/identity strengthens the Person
   entity and E-E-A-T.

## Measurement

- Google Search Console (coverage, rich results, queries, top pages) + Bing
  Webmaster Tools; submit the sitemap to both.
- Track referring domains (Ahrefs/Semrush free tier or Search Console links).
- Watch AI-search citations (ChatGPT/Perplexity/Claude) — the `llms.txt` +
  clean structured data are what get us cited there; that's a growing channel.
