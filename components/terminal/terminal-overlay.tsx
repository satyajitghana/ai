"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  KeyReturnIcon,
  SparkleIcon,
  TerminalWindowIcon,
} from "@phosphor-icons/react/dist/ssr"

import { ChatMarkdown } from "@/components/chat/markdown"

// Spotlight-style command palette: open with ⌘K (or backtick on desktop, or the
// header search button on mobile). Type a command (ls/cat/open/whoami) OR ask a
// natural-language question — free text streams a grounded AI answer. Commands
// map onto the same agent surfaces (.md / JSON API) that LLMs use.

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
  "about", "resume", "projects", "blog", "articles", "arxiv", "publications",
  "patents", "health", "now", "uses", "reading", "snippets", "notes", "github",
  "colophon", "changelog",
]

const HELP = `commands:
  ls <section>   projects | blog | articles | logs | arxiv | snippets | notes
  cat <path>     print a page as markdown (e.g. cat about.md)
  open <path>    navigate (e.g. open resume)
  whoami         who is satyajit
  clear          clear  ·  exit / esc  close
or just type a question and press ↵ to ask the site AI.`

const CAT = `  /\\_/\\
 ( o.o )  meow. this site is run by agents,
  > ^ <   but a cat supervises the agents.`

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

type Block =
  | { kind: "out"; text: string } // command output (monospace)
  | { kind: "q"; text: string } // echoed user query
  | { kind: "answer"; text: string; streaming: boolean } // AI answer (markdown)

export function TerminalOverlay() {
  const [open, setOpen] = useState(false)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      const typing =
        t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable
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

  // Know whether the AI is reachable (so we can hint offline without a round-trip).
  useEffect(() => {
    if (online !== null) return
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setOnline(Boolean(d.online)))
      .catch(() => setOnline(false))
  }, [online])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [blocks])

  const print = useCallback((...lines: string[]) => {
    setBlocks((b) => [...b, ...lines.map((text) => ({ kind: "out" as const, text }))])
  }, [])

  const setLastAnswer = (text: string, streaming: boolean) =>
    setBlocks((b) => {
      const next = [...b]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].kind === "answer") {
          next[i] = { kind: "answer", text, streaming }
          break
        }
      }
      return next
    })

  async function ask(question: string) {
    setBusy(true)
    setBlocks((b) => [
      ...b,
      { kind: "q", text: question },
      { kind: "answer", text: "", streaming: true },
    ])
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: question }] }),
      })
      if (!res.ok || !res.body) {
        setLastAnswer(
          res.status === 503
            ? "AI is offline (no API key configured). Try `help` for commands, or read /llms.txt."
            : `error ${res.status}`,
          false
        )
        return
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let acc = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        setLastAnswer(acc, true)
      }
      setLastAnswer(acc || "(no answer)", false)
    } catch {
      setLastAnswer("connection error — try again", false)
    } finally {
      setBusy(false)
    }
  }

  async function runCommand(cmd: string) {
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
        setBlocks([])
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
            section === "blog" ? data.blog : section === "logs" ? data.logs : data
          print(
            ...(items as Array<{ slug: string; title?: string }>)
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
    }
  }

  function submit(raw: string) {
    const cmd = raw.trim()
    if (!cmd || busy) return
    setInput("")
    const verb = cmd.split(/\s+/)[0].toLowerCase()
    if (VERBS.includes(verb)) void runCommand(cmd)
    else void ask(cmd) // free text → ask the AI
  }

  if (!open) return null

  const trimmed = input.trim()
  const verb = trimmed.split(/\s+/)[0].toLowerCase()
  const isCommand = VERBS.includes(verb)
  const showAsk = trimmed.length > 0 && !isCommand
  const suggestions = getSuggestions(input)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 p-3 pt-[8vh] backdrop-blur-sm sm:p-4 sm:pt-[12vh]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="Search and command palette"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-background font-mono text-sm shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* input */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(input)
          }}
          className="flex items-center gap-2 border-b px-4 py-3"
        >
          <SparkleIcon size={16} weight="fill" className="shrink-0 text-muted-foreground" />
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
            placeholder="ask anything, or run a command…"
            className="w-full bg-transparent text-base outline-none sm:text-sm"
            aria-label="Search or command"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          <kbd className="hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            esc
          </kbd>
        </form>

        {/* output / answer stream */}
        {blocks.length ? (
          <div ref={scrollRef} className="max-h-[44vh] overflow-y-auto px-4 py-3">
            {blocks.map((b, i) =>
              b.kind === "answer" ? (
                <div key={i} className="mb-3 text-muted-foreground">
                  <ChatMarkdown>{b.text}</ChatMarkdown>
                  {b.streaming ? <span className="animate-pulse">▍</span> : null}
                </div>
              ) : b.kind === "q" ? (
                <div key={i} className="mb-1">
                  <span className="text-muted-foreground select-none">? </span>
                  {b.text}
                </div>
              ) : (
                <pre key={i} className="leading-6 whitespace-pre-wrap">
                  {b.text}
                </pre>
              )
            )}
          </div>
        ) : null}

        {/* suggestions / ask action */}
        <div className="border-t">
          {showAsk ? (
            <button
              type="button"
              onClick={() => submit(input)}
              disabled={busy}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-50"
            >
              <SparkleIcon size={15} weight="fill" className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                Ask the site AI:{" "}
                <span className="text-muted-foreground">{trimmed}</span>
              </span>
              {online === false ? (
                <span className="shrink-0 text-[10px] text-muted-foreground">offline</span>
              ) : (
                <KeyReturnIcon size={15} className="shrink-0 text-muted-foreground" />
              )}
            </button>
          ) : null}

          {suggestions.length ? (
            <div className="flex flex-wrap gap-1.5 px-4 py-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
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

          {!showAsk && !suggestions.length && !blocks.length ? (
            <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground">
              <TerminalWindowIcon size={14} weight="fill" />
              type a question, or <code className="rounded bg-muted px-1">help</code>{" "}
              for commands
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
