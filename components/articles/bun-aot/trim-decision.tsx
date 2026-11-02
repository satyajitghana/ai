"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// How --trim decides, as three probes I actually ran. Each case is a snippet,
// what the compiler printed or did, and whether the call still worked.

type Case = {
  id: string
  title: string
  code: string
  size: string
  verdict: "kept" | "removed"
  said: string
  runs: string
}

const CASES: Case[] = [
  {
    id: "name",
    title: "Name written in the source",
    code: "Bun.serve({ port: 0, fetch })",
    size: "34.6 MB",
    verdict: "kept",
    said: "serve is reachable by a name the compiler can read, so the HTTP server stays in the binary.",
    runs: "Ran: the server answered its own request.",
  },
  {
    id: "dynamic",
    title: "Name known only at run time",
    code: "const k = process.argv[2]\nBun[k]({ port: 0, fetch })",
    size: "38.5 MB",
    verdict: "removed",
    said: "Bun.serve was removed by --trim because your code never uses it by name. A name known only at run time, as in object[key]() or eval(text), does not count.",
    runs: "Ran with k = serve: threw ERR_FEATURE_REMOVED at dyn2.ts:2:15.",
  },
  {
    id: "dep",
    title: "A dependency that evals",
    code: "// zod/v4/core/doc.js:35\nnew Function(...)",
    size: "46.3 MB",
    verdict: "kept",
    said: "aot: trim: blocked by eval: the program calls eval() or new Function() at node_modules/zod/v4/core/doc.js:35:29. The build still finished, and the app ran.",
    runs: "Ran: the Hono + zod + sqlite app answered correctly.",
  },
]

export function TrimDecision() {
  const [id, setId] = useState("name")
  const c = CASES.find((x) => x.id === id) ?? CASES[0]
  const ok = c.verdict === "kept"
  return (
    <figure className="not-prose my-6 rounded-lg border p-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Probe">
        {CASES.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === id}
            onClick={() => setId(x.id)}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
              x.id === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {x.title}
          </button>
        ))}
      </div>
      <pre className="mt-3 overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-xs leading-relaxed">{c.code}</pre>
      <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-start">
        <span
          className="inline-block w-fit rounded-md px-2 py-0.5 font-mono text-xs text-background"
          style={{ background: ok ? "oklch(0.62 0.14 150)" : "oklch(0.60 0.19 25)" }}
        >
          Bun.serve {c.verdict} · {c.size}
        </span>
        <p className="text-sm">{c.said}</p>
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">{c.runs}</p>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Measured with `bun build --compile --aot --trim` on Bun 1.4.4 canary. Quoted text is the tool&apos;s own output.
      </figcaption>
    </figure>
  )
}
