import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"

export const metadata: Metadata = {
  title: "404 — not found",
  robots: { index: false, follow: true },
}

const links = [
  { href: "/", label: "home" },
  { href: "/articles", label: "articles" },
  { href: "/blog", label: "blog" },
  { href: "/projects", label: "projects" },
  { href: "/arxiv", label: "arxiv" },
  { href: "/search", label: "search" },
] as const

export default function NotFound() {
  return (
    <PageShell>
      <div className="font-mono text-sm">
        <p className="text-muted-foreground">
          <span className="text-foreground/70">$</span> cat $REQUESTED_PATH
        </p>
        <p className="mt-3">
          <span className="text-muted-foreground">cat: </span>
          no such file or directory
        </p>

        <h1 className="font-heading mt-10 text-5xl font-bold tracking-tight">
          404
        </h1>
        <p className="mt-3 max-w-prose leading-7 text-muted-foreground">
          This page doesn&apos;t exist — but the site is small and well-indexed.
          Try one of these, search, or hit{" "}
          <kbd className="rounded border px-1 py-0.5 text-[10px]">⌘K</kbd> for the
          console.
        </p>

        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="transition-colors hover:text-foreground"
              >
                ~/{l.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-xs text-muted-foreground">
          agents:{" "}
          <a href="/llms.txt" className="underline underline-offset-4 hover:text-foreground">
            /llms.txt
          </a>{" "}
          has the full map.
        </p>
      </div>
    </PageShell>
  )
}
