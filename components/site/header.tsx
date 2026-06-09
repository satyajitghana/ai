"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ListIcon, TerminalWindowIcon, XIcon } from "@phosphor-icons/react/dist/ssr"

import { ThemeToggle } from "@/components/site/theme-toggle"
import { cn } from "@/lib/utils"

// Primary nav. The footer carries the full sitemap; the header stays focused
// on the main destinations so the site reads as organized.
const nav = [
  { href: "/projects", label: "projects" },
  { href: "/articles", label: "articles" },
  { href: "/blog", label: "blog" },
  { href: "/arxiv", label: "arxiv" },
  { href: "/resume", label: "resume" },
  { href: "/about", label: "about" },
] as const

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <>
      {nav.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "transition-colors hover:text-foreground",
              active ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </>
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Open the terminal palette — the overlay listens for ⌘K too; this dispatches
  // the same key so the button and the shortcut share one code path.
  const openPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true })
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="font-mono text-sm font-medium tracking-tight hover:text-muted-foreground"
        >
          ~/satyajit
        </Link>

        <nav className="hidden items-center gap-5 font-mono text-xs sm:flex">
          <NavLinks pathname={pathname} />
        </nav>

        <div className="flex items-center gap-4 font-mono text-xs">
          <button
            type="button"
            onClick={openPalette}
            className="hidden cursor-pointer items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            aria-label="Open command palette (⌘K)"
            title="Command palette (⌘K)"
          >
            <TerminalWindowIcon size={16} weight="fill" />
            <kbd className="rounded border px-1 py-0.5 text-[10px]">⌘K</kbd>
          </button>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground sm:hidden"
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? (
              <XIcon size={18} weight="bold" />
            ) : (
              <ListIcon size={18} weight="bold" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open ? (
        <nav className="mx-auto flex w-full max-w-3xl flex-col gap-3 border-t px-6 py-4 font-mono text-sm sm:hidden">
          <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
        </nav>
      ) : null}
    </header>
  )
}
