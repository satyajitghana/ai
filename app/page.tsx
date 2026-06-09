import Link from "next/link"

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

function SectionHeader({ path, href }: { path: string; href: string }) {
  return (
    <div className="mt-16 mb-4 flex items-baseline justify-between">
      <Link
        href={href}
        className="font-mono text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      >
        ~/{path}
      </Link>
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
  const articles = getArticles().slice(0, 3)
  const posts = getBlogPosts().slice(0, 3)
  const logs = getLogs().slice(0, 3)
  const digest = getArxivDigests()[0]

  return (
    <PageShell>
      {/* Hero */}
      <section>
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-foreground/70">$</span> whoami
        </p>
        <h1 className="font-heading mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {profile.name}
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
          <span className="text-foreground">🤖 agents:</span> this site is
          machine-readable. start at{" "}
          <a
            href="/llms.txt"
            className="text-foreground underline underline-offset-4"
          >
            /llms.txt
          </a>
          , fetch any page as markdown by appending{" "}
          <span className="text-foreground">.md</span>, query{" "}
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

      {/* Featured projects */}
      <SectionHeader path="projects" href="/projects" />
      <ul className="space-y-4">
        {projects.map((p) => (
          <li key={p.slug} className="group">
            <Link href={`/projects/${p.slug}`} className="block">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium underline-offset-4 group-hover:underline">
                  {p.title}
                </span>
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
              className="group flex items-baseline justify-between gap-4"
            >
              <span className="underline-offset-4 group-hover:underline">
                {p.title}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {p.date}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Curated articles */}
      {articles.length ? (
        <>
          <SectionHeader path="articles" href="/articles" />
          <ul className="space-y-3">
            {articles.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/articles/${a.slug}`}
                  className="group flex items-baseline justify-between gap-4"
                >
                  <span className="underline-offset-4 group-hover:underline">
                    {a.title}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {a.date}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* Latest logs */}
      <SectionHeader path="logs" href="/logs" />
      <ul className="space-y-3">
        {logs.map((l) => (
          <li key={l.slug}>
            <Link
              href={`/logs/${l.slug}`}
              className="group flex items-baseline justify-between gap-4"
            >
              <span className="underline-offset-4 group-hover:underline">
                {l.title ?? l.slug}
              </span>
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
            <div className="flex items-baseline justify-between gap-4">
              <span className="underline-offset-4 group-hover:underline">
                arXiv digest — {digest.papers.length} papers
                {digest.papers.some((p) => p.standout) ? " · standout ★" : ""}
              </span>
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
