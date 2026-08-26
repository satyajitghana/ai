"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The part of SGLang that is not an inference server.
//
// python/sglang/lang/ still contains a full frontend language: api.py exposes
// gen, gen_int, gen_string, select, image, video and the role helpers; ir.py
// defines the node types the tracer builds — SglGen, SglSelect, SglFork,
// SglGetForkItem, SglVariable, SglVarScopeBegin/End, SglConcateAndAppend,
// SglCommitLazy, SglSeparateReasoning; interpreter.py and tracer.py execute or
// trace them.
//
// SglCommitLazy is the load-bearing one. Because the program is an IR rather
// than a sequence of blocking HTTP calls, the runtime can defer, batch and
// schedule the generations — and a fork's branches share their prefix in the
// radix tree by construction rather than by coincidence.

const CALL = "oklch(0.60 0.15 255)"
const FORK = "oklch(0.55 0.16 155)"
const WAIT = "oklch(0.62 0.03 250)"
const SHARE = "oklch(0.68 0.13 85)"

type Mode = "api" | "sgl"

const BRANCHES = 4
const GEN = 6 // time units for one generation
const RTT = 1 // round trip per HTTP call

export function FrontendIr() {
  const [mode, setMode] = useState<Mode>("api")

  // OpenAI-style: each branch is its own request, prefix re-sent and re-prefilled
  // SGLang: one program, branches forked after a shared prefix, batched
  const rows =
    mode === "api"
      ? Array.from({ length: BRANCHES }, (_, i) => ({
          label: `POST #${i + 1}`,
          spans: [
            { t: "wait" as const, a: 0, b: RTT },
            { t: "prefill" as const, a: RTT, b: RTT + 2 },
            { t: "gen" as const, a: RTT + 2, b: RTT + 2 + GEN },
          ],
        }))
      : [
          { label: "shared prefix", spans: [{ t: "prefill" as const, a: 0, b: 2 }] },
          ...Array.from({ length: BRANCHES }, (_, i) => ({
            label: `fork ${i}`,
            spans: [{ t: "gen" as const, a: 2, b: 2 + GEN }],
          })),
        ]

  const end = Math.max(...rows.flatMap((r) => r.spans.map((s) => s.b)))
  const prefills = mode === "api" ? BRANCHES : 1

  const W = 700
  const X0 = 104
  const px = (t: number) => X0 + (t / 10) * (W - X0 - 30)
  const H = rows.length * 22 + 40

  const colourOf = (t: string) => (t === "gen" ? CALL : t === "prefill" ? SHARE : WAIT)

  const code =
    mode === "api"
      ? `# four independent HTTP calls
for style in styles:
    client.chat.completions.create(
        model=...,
        messages=[SYSTEM, FEWSHOT,
                  {"role": "user", "content": style}],
    )
# the shared prefix is re-sent and re-prefilled every time`
      : `@sgl.function
def compare(s, styles):
    s += sgl.system(SYSTEM)
    s += FEWSHOT                    # traced, not sent
    forks = s.fork(len(styles))     # SglFork
    for f, style in zip(forks, styles):
        f += sgl.user(style)
        f += sgl.gen("out", max_tokens=256)
    forks.join()                    # SglGetForkItem`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one prompt, {BRANCHES} variations
        </span>
        <span className="font-mono text-[10px]" style={{ color: mode === "sgl" ? FORK : WAIT }}>
          {end} units · {prefills} prefill{prefills > 1 ? "s" : ""} of the shared prefix
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["api", "four chat-completions calls"],
              ["sgl", "one SGLang program with fork()"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/25 p-3 font-mono text-[10.5px] leading-5 text-foreground">
          {code}
        </pre>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {mode === "api"
                ? `Four independent requests, each paying a round trip and its own prefill of the shared prefix before generating.`
                : `One program: the shared prefix is prefilled once, then four forks generate from it concurrently.`}
            </title>
            {rows.map((r, ri) => (
              <g key={r.label}>
                <text x={X0 - 10} y={16 + ri * 22} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                  {r.label}
                </text>
                {r.spans.map((s, si) => (
                  <rect
                    key={si}
                    x={px(s.a)}
                    y={6 + ri * 22}
                    width={Math.max(2, px(s.b) - px(s.a))}
                    height={13}
                    rx={2}
                    fill={colourOf(s.t)}
                    fillOpacity={0.82}
                  />
                ))}
              </g>
            ))}
            <line x1={px(end)} y1={2} x2={px(end)} y2={H - 24} stroke="currentColor" strokeOpacity={0.4} />
            {(
              [
                ["prefill of the shared prefix", SHARE, 0],
                ["generation", CALL, 190],
                ["round trip", WAIT, 300],
              ] as const
            ).map(([label, colour, dx]) => (
              <g key={label}>
                <rect x={X0 + dx} y={H - 14} width={8} height={8} rx={1.5} fill={colour} fillOpacity={0.82} />
                <text x={X0 + dx + 12} y={H - 7} fontSize={7.5} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                  {label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          SGLang began as a <em>language</em>, and the language is still in the repo —{" "}
          <span className="font-mono text-[11px] text-foreground">gen</span>,{" "}
          <span className="font-mono text-[11px] text-foreground">select</span>,{" "}
          <span className="font-mono text-[11px] text-foreground">fork</span>, role scopes, an IR and
          a tracer. That is the part people forget, and it is what the radix tree was built for.
          <br />
          <br />
          The difference is not the syntax. Four chat-completions calls are four independent
          requests: each pays a round trip and{" "}
          <span style={{ color: SHARE }}>re-prefills the shared prefix</span>, and the server can
          only recover the waste after the fact, by recognising the prefix in its cache. A forked
          SGLang program declares the sharing{" "}
          <span className="text-foreground">up front</span>, so the runtime prefills once and
          batches the branches — and because the program is an IR rather than a sequence of blocking
          calls, `SglCommitLazy` lets it defer and schedule rather than executing as it reads.
          <br />
          <br />
          Whether the language earns its keep now that prefix caching is universal is a fair
          question, and the honest answer is that it mostly matters for programs with real control
          flow — forks, joins, constrained choices between named options, multi-turn state. For a
          single completion it buys nothing at all.
        </p>
      </div>
    </figure>
  )
}
