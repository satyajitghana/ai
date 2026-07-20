import Link from "next/link"
import {
  GithubLogoIcon,
  LinkedinLogoIcon,
  XLogoIcon,
} from "@phosphor-icons/react/dist/ssr"

import { profile } from "@/data/profile"

const footerLinks = [
  { href: "/publications", label: "publications" },
  { href: "/patents", label: "patents" },
  { href: "/health", label: "health" },
  { href: "/snippets", label: "snippets" },
  { href: "/notes", label: "notes" },
  { href: "/now", label: "now" },
  { href: "/uses", label: "uses" },
  { href: "/reading", label: "reading" },
  { href: "/github", label: "github" },
  { href: "/changelog", label: "changelog" },
  { href: "/colophon", label: "colophon" },
  { href: "/feed.xml", label: "rss" },
] as const

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-3xl px-6 pt-20 pb-10">
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-6 font-mono text-xs text-muted-foreground">
        {footerLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="transition-colors hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          <span>
            © {new Date().getFullYear()} {profile.name}
          </span>
          <a
            href={profile.links.github}
            className="flex items-center transition-colors hover:text-foreground"
            aria-label="GitHub"
          >
            <GithubLogoIcon size={16} weight="fill" />
          </a>
          <a
            href={profile.links.x}
            className="flex items-center transition-colors hover:text-foreground"
            aria-label="X (Twitter)"
          >
            <XLogoIcon size={16} weight="fill" />
          </a>
          <a
            href={profile.links.linkedin}
            className="flex items-center transition-colors hover:text-foreground"
            aria-label="LinkedIn"
          >
            <LinkedinLogoIcon size={16} weight="fill" />
          </a>
        </span>
        <span className="flex items-center gap-1.5">
          managed by{" "}
          <Link
            href="/colophon"
            className="underline decoration-foreground/30 underline-offset-4 transition-colors hover:text-foreground"
          >
            claude
          </Link>{" "}
          · agent-readable:{" "}
          <a href="/llms.txt" className="transition-colors hover:text-foreground">
            llms.txt
          </a>
        </span>
      </div>
    </footer>
  )
}
