"use client"

import { useEffect, useRef, useState } from "react"
import { PaperPlaneRightIcon } from "@phosphor-icons/react/dist/ssr"

import { ChatMarkdown } from "@/components/chat/markdown"
import { cn } from "@/lib/utils"

type Msg = { role: "user" | "assistant"; content: string }

// The "ask my site" hero — a terminal-styled grounded chat. Degrades to an
// offline notice (pointing agents at llms.txt) when no API key is configured.
export function ChatConsole() {
  const [online, setOnline] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setOnline(Boolean(d.online)))
      .catch(() => setOnline(false))
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || busy) return
    setInput("")
    setBusy(true)

    const history: Msg[] = [...messages, { role: "user", content: question }]
    setMessages([...history, { role: "assistant", content: "" }])

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-12) }),
      })

      if (!res.ok || !res.body) {
        const detail =
          res.status === 503
            ? "chat is offline — but I'm fully machine-readable: see /llms.txt"
            : `error ${res.status}`
        setMessages([...history, { role: "assistant", content: detail }])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let answer = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        answer += decoder.decode(value, { stream: true })
        setMessages([...history, { role: "assistant", content: answer }])
      }
    } catch {
      setMessages([
        ...history,
        { role: "assistant", content: "connection error — try again" },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-print-hidden className="rounded-md border font-mono text-sm">
      <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
        <span>ask my site</span>
        <span>
          {online === null ? "…" : online ? "● online" : "○ offline"}
        </span>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "max-h-72 space-y-3 overflow-y-auto px-3 py-3",
          messages.length === 0 && "py-2"
        )}
      >
        {messages.length === 0 ? (
          <p className="text-xs leading-6 text-muted-foreground">
            {online === false
              ? "chat is offline (no API key configured). agents: read /llms.txt instead."
              : "ask anything about me — my work, projects, papers, patents. answers are grounded in this site's content."}
          </p>
        ) : (
          messages.map((m, i) => {
            const streaming =
              busy && i === messages.length - 1 && m.role === "assistant"
            return (
              <div key={i} className="flex gap-2 leading-6">
                <span className="shrink-0 text-muted-foreground select-none">
                  {m.role === "user" ? "$" : ">"}
                </span>
                {m.role === "user" ? (
                  <span>{m.content}</span>
                ) : (
                  <div className="min-w-0 text-muted-foreground">
                    <ChatMarkdown>{m.content}</ChatMarkdown>
                    {streaming ? (
                      <span className="animate-pulse">▍</span>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t px-3 py-2">
        <span className="text-muted-foreground select-none">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={online === false ? "offline" : "ask satyajit…"}
          disabled={online === false || busy}
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
          aria-label="Ask a question about Satyajit"
        />
        <button
          type="submit"
          disabled={online === false || busy || !input.trim()}
          className="flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send"
        >
          <PaperPlaneRightIcon size={15} weight="fill" />
        </button>
      </form>
    </div>
  )
}
