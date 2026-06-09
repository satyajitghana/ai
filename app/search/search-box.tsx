"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

// Just the input. Navigating to /search?q=… lets the server component render
// results — no client fetch, no effects, no state-sync.
export function SearchBox({ initial }: { initial: string }) {
  const [query, setQuery] = useState(initial)
  const router = useRouter()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const q = query.trim()
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search")
      }}
      className="flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-sm"
    >
      <span className="text-muted-foreground select-none">/</span>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search projects, articles, blog, arxiv…"
        className="w-full bg-transparent outline-none placeholder:text-muted-foreground/60"
        aria-label="Search the site"
      />
      <button
        type="submit"
        className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        ↵
      </button>
    </form>
  )
}
