import type { Metadata } from "next"
import Link from "next/link"
import { StarIcon } from "@phosphor-icons/react/dist/ssr"

import { ChatConsole } from "@/components/chat/chat-console"
import { PageShell } from "@/components/site/page-shell"
import { profile } from "@/data/profile"
import {
  getArticles,
  getArxivDigests,
  getBlogPosts,
  getLogs,
  getProjects,
} from "@/lib/content"
import { TierBars } from "@/components/site/article-rating"
import { topicById } from "@/data/taxonomy"
import { articleScores, compareByLens } from "@/lib/content/signals"
import { seo } from "@/lib/seo"
import { HOME_TITLE, SITE_DESCRIPTION } from "@/lib/site"

export const metadata: Metadata = {
  ...seo("/", HOME_TITLE, SITE_DESCRIPTION),
  title: { absolute: HOME_TITLE },
}
const STAR = "oklch(0.79 0.15 82)" // warm gold, matches the articles page

function SectionHeader({ path, href }: { path: string; href: string }) {
  return (
    <div className="mt-16 mb-4 flex items-baseline justify-between">
      <h2 className="font-mono text-xs tracking-wide">
        <Link
          href={href}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          ~/{path}
        </Link>
      </h2>
      <Link
        href={href}
        className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        all →
      </Link>
    </div>
  )
}

export default function Page() {
  const projects = getProjects().filter((p) => p.featured)
  const articles = getArticles().slice(0, 5)
  const posts = getBlogPosts().slice(0, 3)
  const logs = getLogs().slice(0, 3)
  const digest = getArxivDigests()[0]

  // Rated-article picks. "Start here" is the clearest page (the learn lens) in
  // each of the six topics with the most rated articles; "must-reads" is the
  // best-scored work of the last 30 days, counted back from the newest article
  // so the build is deterministic. Both are empty, and hidden, until articles
  // carry ratings.
  const scores = articleScores()
  const all = getArticles()
  const ratedAll = all.filter((a) => scores.get(a.slug)?.tier)
  const byTopic = new Map<string, typeof all>()
  for (const a of ratedAll) if (a.topic) byTopic.set(a.topic, [...(byTopic.get(a.topic) ?? []), a])
  const startHere = [...byTopic.entries()]
    .sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0]))
    .slice(0, 6)
    .map(([topic, list]) => ({ topic: topicById(topic)!, a: [...list].sort(compareByLens("learn", scores))[0] }))
  const newest = all[0]?.lastUpdated ?? ""
  const monthAgo = newest ? new Date(Date.parse(newest) - 30 * 86_400_000).toISOString().slice(0, 10) : ""
  const mustReads = ratedAll
    .filter((a) => a.lastUpdated >= monthAgo)
    .sort(compareByLens("must-read", scores))
    .slice(0, 5)

  return (
    <PageShell>
      {/* Hero */}
      <section>
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-foreground/70">$</span>{" "}whoami
        </p>
        {/* The H1 carries the name AND what the site is about. A bare name is a
            weak document title: it gives a search engine, and a reader landing
            from a link, nothing about the subject. The visible line stays a
            name-first hierarchy by styling the qualifier down rather than by
            leaving it out. */}
        <h1 className="font-heading mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {profile.name}
          <span className="mt-1 block text-xl font-semibold text-muted-foreground sm:text-2xl">
            {profile.title}, AI &amp; 3D Perception
          </span>
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {profile.title} ·{" "}
          <a
            href={profile.company.url}
            className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
          >
            {profile.company.name}
          </a>{" "}
          · {profile.location}
        </p>
        <p className="mt-6 max-w-prose text-lg leading-8">{profile.tagline}</p>
        <p className="mt-3 max-w-prose leading-7 text-muted-foreground">
          {profile.bio[0]}
        </p>

        {/* Seed stats strip — replaced by live GitHub data when a token exists */}
        <p className="mt-8 font-mono text-xs text-muted-foreground">
          <span className="text-foreground">{profile.seedStats.repos}</span>{" "}
          repos ·{" "}
          <span className="text-foreground">{profile.seedStats.stars}</span>{" "}
          stars ·{" "}
          <span className="text-foreground">{profile.seedStats.followers}</span>{" "}
          followers ·{" "}
          <Link href="/github" className="hover:text-foreground">
            stats →
          </Link>
        </p>
      </section>

      {/* Ask my site — the hero interaction */}
      <section className="mt-12">
        <ChatConsole />
      </section>

      {/* Agent notice — the dual-native thesis, stated on the front door */}
      <section className="mt-6 rounded-md border p-4">
        <p className="font-mono text-xs leading-6 text-muted-foreground">
          <span className="text-foreground">🤖 agents:</span>{" "}this site is
          machine-readable. start at{" "}
          <a
            href="/llms.txt"
            className="text-foreground underline underline-offset-4"
          >
            /llms.txt
          </a>
          , fetch any page as markdown by appending{" "}
          <span className="text-foreground">.md</span>, query{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API endpoint for agents, not a page */}
          <a
            href="/api/profile"
            className="text-foreground underline underline-offset-4"
          >
            /api/*
          </a>{" "}
          for JSON, or call the{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API endpoint for agents, not a page */}
          <a
            href="/api/mcp/mcp"
            className="text-foreground underline underline-offset-4"
          >
            MCP endpoint
          </a>
          . humans: it&apos;s all just the website.
        </p>
      </section>

      {/* Curated articles — the site's flagship writing, led first */}
      {articles.length ? (
        <>
          <SectionHeader path="articles" href="/articles" />
          <ul className="space-y-3">
            {articles.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/articles/${a.slug}`}
                  className="group flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <h3 className="underline-offset-4 group-hover:underline">
                    {a.title}
                    {a.featured ? (
                      <StarIcon
                        size={13}
                        weight="fill"
                        aria-label="Featured"
                        className="ml-1.5 inline-block align-[-0.1em]"
                        style={{ color: STAR }}
                      />
                    ) : null}
                  </h3>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {a.date}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* Start here — one clear first read per popular topic */}
      {startHere.length ? (
        <>
          <SectionHeader path="start-here" href="/articles?lens=learn" />
          <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {startHere.map(({ topic, a }) => (
              <li key={topic.id}>
                <Link
                  href={`/articles?topic=${topic.id}`}
                  className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {topic.label}
                </Link>
                <Link
                  href={`/articles/${a.slug}`}
                  className="mt-0.5 block leading-snug underline-offset-4 hover:underline"
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* Must-reads this month — the best-scored recent work */}
      {mustReads.length ? (
        <>
          <SectionHeader path="must-reads" href="/articles" />
          <ul className="space-y-3">
            {mustReads.map((a) => {
              const s = scores.get(a.slug)!
              return (
                <li key={a.slug}>
                  <Link
                    href={`/articles/${a.slug}`}
                    className="group flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <h3 className="underline-offset-4 group-hover:underline">{a.title}</h3>
                    <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
                      <TierBars tier={s.tier!} />
                      {s.tier!.label}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}

      {/* Featured projects */}
      <SectionHeader path="projects" href="/projects" />
      <ul className="space-y-4">
        {projects.map((p) => (
          <li key={p.slug} className="group">
            <Link href={`/projects/${p.slug}`} className="block">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <h3 className="font-medium underline-offset-4 group-hover:underline">
                  {p.title}
                </h3>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {p.stack.slice(0, 3).join(" · ")}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {p.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Latest writing */}
      <SectionHeader path="blog" href="/blog" />
      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/blog/${p.slug}`}
              className="group flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <h3 className="underline-offset-4 group-hover:underline">
                {p.title}
              </h3>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {p.date}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Latest logs */}
      <SectionHeader path="logs" href="/logs" />
      <ul className="space-y-3">
        {logs.map((l) => (
          <li key={l.slug}>
            <Link
              href={`/logs/${l.slug}`}
              className="group flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <h3 className="underline-offset-4 group-hover:underline">
                {l.title ?? l.slug}
              </h3>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {l.date}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Today's arXiv digest */}
      {digest ? (
        <>
          <SectionHeader path="arxiv" href="/arxiv" />
          <Link href={`/arxiv/${digest.slug}`} className="group block">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <h3 className="underline-offset-4 group-hover:underline">
                arXiv digest — {digest.papers.length} papers
                {digest.papers.some((p) => p.standout) ? " · standout ★" : ""}
              </h3>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {digest.date}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {digest.papers.find((p) => p.standout)?.title ??
                digest.papers[0]?.title}
            </p>
          </Link>
        </>
      ) : null}
    </PageShell>
  )
}
