"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

// The signature toy: press ` (backtick) or ⌘K to open an in-browser console.
// Commands map onto the same agent-facing surfaces (.md variants, JSON API)
// that LLMs use — a human-playable demo of the site's machine-readability.
const HELP = `commands:
  help              this help
  whoami            who is satyajit
  ls <section>      list projects|blog|articles|logs|arxiv|snippets|notes
  cat <path>        print a page as markdown (e.g. cat about.md, cat blog/<slug>.md)
  open <path>       navigate (e.g. open resume)
  clear             clear the screen
  exit              close (or press Esc)
  cat 🐈            ?`

const CAT = `  /\\_/\\
 ( o.o )  meow. this site is run by agents,
  > ^ <   but a cat supervises the agents.`

// Autosuggest vocabulary — verbs, the `ls` sections, and the pages reachable
// via `open`/`cat`. Kept in sync with the command handlers below.
const VERBS = ["help", "whoami", "ls", "cat", "open", "clear", "exit"]
const SECTIONS = [
  "projects",
  "blog",
  "articles",
  "logs",
  "arxiv",
  "snippets",
  "notes",
]
const PAGES = [
  "about",
  "resume",
  "projects",
  "blog",
  "articles",
  "arxiv",
  "publications",
  "patents",
  "health",
  "now",
  "uses",
  "reading",
  "snippets",
  "notes",
  "github",
  "colophon",
  "changelog",
]

function getSuggestions(input: string): string[] {
  const parts = input.split(/\s+/)
  if (parts.length <= 1) {
    const q = (parts[0] ?? "").toLowerCase()
    return VERBS.filter((v) => v.startsWith(q) && v !== q).slice(0, 8)
  }
  const verb = parts[0].toLowerCase()
  const arg = (parts[1] ?? "").toLowerCase()
  const pool =
    verb === "ls" ? SECTIONS : verb === "open" || verb === "cat" ? PAGES : []
  return pool
    .filter((s) => s.startsWith(arg) && s !== arg)
    .slice(0, 8)
    .map((s) => `${verb} ${s}`)
}

export function TerminalOverlay() {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<string[]>(["satyajit@ai — type `help`"])
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === "`" && !typing) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines])

  const print = useCallback((...out: string[]) => {
    setLines((prev) => [...prev, ...out])
  }, [])

  async function run(raw: string) {
    const cmd = raw.trim()
    if (!cmd) return
    print(`$ ${cmd}`)
    const [verb, ...rest] = cmd.split(/\s+/)
    const arg = rest.join(" ")

    switch (verb) {
      case "help":
        print(HELP)
        break
      case "whoami":
        print(
          "satyajit ghana — head of engineering @ inkers. deep learning, 3d perception, cuda, high-performance systems."
        )
        break
      case "clear":
        setLines([])
        break
      case "exit":
        setOpen(false)
        break
      case "ls": {
        const section = arg || "projects"
        const api: Record<string, string> = {
          projects: "/api/projects",
          blog: "/api/posts",
          articles: "/api/articles",
          logs: "/api/posts",
          arxiv: "/api/arxiv",
          snippets: "/api/snippets",
          notes: "/api/notes",
        }
        const url = api[section]
        if (!url) {
          print(`ls: unknown section "${section}" — try ${Object.keys(api).join("|")}`)
          break
        }
        try {
          const data = await fetch(url).then((r) => r.json())
          const items =
            section === "blog"
              ? data.blog
              : section === "logs"
                ? data.logs
                : data
          print(
            ...(items as Array<{ slug: string; title?: string; date?: string }>)
              .slice(0, 20)
              .map((i) => `  ${i.slug}${i.title ? `  — ${i.title}` : ""}`)
          )
        } catch {
          print("ls: failed to fetch")
        }
        break
      }
      case "cat": {
        if (arg === "🐈" || arg === "cat" || arg === ":3") {
          print(CAT)
          break
        }
        if (!arg) {
          print("cat: missing path — try `cat about.md`")
          break
        }
        const path = arg.startsWith("/") ? arg : `/${arg}`
        const mdPath = path.endsWith(".md") ? path : `${path}.md`
        try {
          const res = await fetch(mdPath)
          if (!res.ok) {
            print(`cat: ${mdPath}: not found`)
            break
          }
          const text = await res.text()
          print(...text.split("\n").slice(0, 40), "  …")
        } catch {
          print("cat: failed to fetch")
        }
        break
      }
      case "open": {
        const path = arg.startsWith("/") ? arg : `/${arg}`
        setOpen(false)
        router.push(path)
        break
      }
      default:
        print(`${verb}: command not found — try \`help\``)
    }
  }

  if (!open) return null

  const suggestions = getSuggestions(input)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="Terminal"
    >
      <div
        className="w-full max-w-2xl rounded-md border bg-background font-mono text-sm shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
          <span>satyajit@ai:~</span>
          <span>esc to close</span>
        </div>
        <div ref={scrollRef} className="max-h-[50vh] overflow-y-auto px-3 py-2">
          {lines.map((l, i) => (
            <pre key={i} className="leading-6 whitespace-pre-wrap">
              {l}
            </pre>
          ))}
        </div>
        {/* Autosuggestions — Tab completes the first one; click to fill */}
        {suggestions.length ? (
          <div className="flex flex-wrap gap-1.5 border-t px-3 py-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  // Verb suggestions get a trailing space so you can keep typing args.
                  setInput(s.includes(" ") ? s : `${s} `)
                  inputRef.current?.focus()
                }}
                className="cursor-pointer rounded border px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run(input)
            setInput("")
          }}
          className="flex items-center gap-2 border-t px-3 py-2"
        >
          <span className="text-muted-foreground select-none">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && suggestions.length) {
                e.preventDefault()
                const top = suggestions[0]
                setInput(top.includes(" ") ? top : `${top} `)
              }
            }}
            className="w-full bg-transparent outline-none"
            aria-label="Terminal command"
            autoComplete="off"
            spellCheck={false}
            placeholder="try: ls projects  ·  cat about.md  ·  open resume  ·  Tab to complete"
          />
        </form>
      </div>
    </div>
  )
}
