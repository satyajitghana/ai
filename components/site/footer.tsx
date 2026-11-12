import Link from "next/link"

import { profile } from "@/data/profile"
import { PERSON_URL } from "@/lib/site"

// The full sitemap, grouped. Every page renders this, so it stays a server
// component with plain markup, and its links do not prefetch: thirty
// viewport-prefetched routes on every page view would be thirty uncached
// requests to Vercel for pages most readers never open. Files and endpoints
// (`raw`) are plain anchors, since they are not routes the router can render.
type Item = { href: string; label: string; raw?: boolean }

const groups: { title: string; items: Item[] }[] = [
  {
    title: "read",
    items: [
      { href: "/articles", label: "articles" },
      { href: "/blog", label: "blog" },
      { href: "/notes", label: "notes" },
      { href: "/snippets", label: "snippets" },
      { href: "/logs", label: "logs" },
      { href: "/arxiv", label: "arxiv digest" },
      { href: "/reading", label: "reading" },
    ],
  },
  {
    title: "explore",
    items: [
      { href: "/lab/neuron-lab", label: "neuron lab" },
      { href: "/models", label: "models" },
      { href: "/math", label: "ai in maths" },
      { href: "/architectures", label: "architectures" },
      { href: "/articles/scoring", label: "how we score" },
      { href: "/search", label: "search" },
    ],
  },
  {
    title: "data & api",
    items: [
      { href: "/developers", label: "developers" },
      { href: "/llms.txt", label: "llms.txt", raw: true },
      { href: "/openapi.json", label: "openapi.json", raw: true },
      { href: "/feed.xml", label: "rss", raw: true },
      { href: "/changelog", label: "changelog" },
      { href: "/github", label: "github stats" },
    ],
  },
  {
    title: "about",
    items: [
      { href: "/about", label: "about" },
      { href: "/resume", label: "resume" },
      { href: "/projects", label: "projects" },
      { href: "/publications", label: "publications" },
      { href: "/patents", label: "patents" },
      { href: "/now", label: "now" },
      { href: "/uses", label: "uses" },
      { href: "/health", label: "health" },
      { href: "/contact", label: "contact" },
    ],
  },
  {
    title: "elsewhere",
    items: [
      { href: profile.links.github, label: "github", raw: true },
      { href: profile.links.x, label: "x", raw: true },
      { href: profile.links.linkedin, label: "linkedin", raw: true },
      { href: profile.links.scholar, label: "scholar", raw: true },
    ],
  },
]

// Link hover styles are set once on each container ([&_a]) rather than on
// forty links: the footer is in every page's HTML and its RSC payload twice
// over. Focus rings are the global outline-ring default.
const links = "[&_a]:transition-colors [&_a:hover]:text-foreground [&_a:focus-visible]:text-foreground"

export function SiteFooter() {
  return (
    // pb-24 on mobile clears the terminal launcher, which is fixed 16px off the
    // bottom-right at 48px square; without it the last line ran underneath it.
    <footer className="mx-auto w-full max-w-3xl px-6 pt-20 pb-24 sm:pb-10">
      <nav
        aria-label="Site map"
        className={`grid grid-cols-2 gap-x-6 gap-y-8 border-t pt-8 font-mono text-xs sm:grid-cols-3 md:grid-cols-5 ${links}`}
      >
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-foreground">{g.title}</h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {g.items.map((item) => (
                <li key={item.href}>
                  {item.raw ? (
                    <a href={item.href}>
                      {item.label}
                    </a>
                  ) : (
                    <Link href={item.href} prefetch={false}>
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className={`mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-6 font-mono text-xs text-muted-foreground ${links}`}>
        <span>
          © {new Date().getFullYear()}{" "}
          {/* His home page: the visible link that ties this site to satyajit.si */}
          <a href={PERSON_URL} rel="me">
            {profile.name}
          </a>
        </span>
        <span>
          managed by{" "}
          <Link
            href="/colophon"
            prefetch={false}
            className="underline decoration-foreground/30 underline-offset-4"
          >
            claude
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" prefetch={false}>
            privacy
          </Link>
        </span>
      </div>
    </footer>
  )
}
