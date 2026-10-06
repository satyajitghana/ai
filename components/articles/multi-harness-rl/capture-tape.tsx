"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One model call through OpenEnv's capture proxy, and the tape it leaves.
//
// The mechanism follows openenv/core/harness/capture (commit 3f14355):
//   detection.py  path, then headers, then body shape picks the dialect
//   upstream.py   training sampling pins top_p=1.0, top_k=-1 and asks the engine
//                 for prompt ids, sampled ids and one logprob per sampled token
//   graph.py      a call's parent is the earlier call whose prompt+completion is
//                 the LONGEST EXACT token prefix of its prompt; no match, new root
//
// The token strings, ids and logprobs on the tape are illustrative, not captured
// from a run. The only real thing about them is their shape.

type HarnessKey = "opencode" | "claude" | "codex" | "gemini"

const HARNESSES: Record<HarnessKey, { label: string; dialect: string; path: string; key: string }> = {
  opencode: { label: "OpenCode", dialect: "OpenAI Chat Completions", path: "POST /v1/chat/completions", key: "provider config" },
  claude: { label: "Claude Code", dialect: "Anthropic Messages", path: "POST /v1/messages", key: "ANTHROPIC_API_KEY" },
  codex: { label: "Codex", dialect: "OpenAI Responses", path: "POST /v1/responses", key: "OPENAI_API_KEY" },
  gemini: { label: "Gemini CLI", dialect: "Gemini generateContent", path: "POST …:generateContent", key: "x-goog-api-key" },
}
const ORDER: HarnessKey[] = ["opencode", "claude", "codex", "gemini"]

type Tok = { s: string; id: number; lp: number }

// What the model sampled on turn 1, a tool call. Canonical split.
const T1: Tok[] = [
  { s: '{"', id: 5018, lp: -0.02 },
  { s: "cmd", id: 9206, lp: -0.11 },
  { s: '":"', id: 3332, lp: -0.01 },
  { s: "wc", id: 26377, lp: -0.64 },
  { s: " -l", id: 482, lp: -0.08 },
  { s: " data", id: 828, lp: -0.35 },
  { s: ".csv", id: 11604, lp: -0.21 },
  { s: '"}', id: 9388, lp: -0.03 },
]
// The same characters, sampled as a non-canonical split: ".c" + "sv".
const T1_ODD: Tok[] = [
  ...T1.slice(0, 6),
  { s: ".c", id: 520, lp: -2.9 },
  { s: "sv", id: 3576, lp: -0.01 },
  T1[7],
]
const T2: Tok[] = [
  { s: "The", id: 791, lp: -0.4 },
  { s: " file", id: 1052, lp: -0.09 },
  { s: " has", id: 706, lp: -0.05 },
  { s: " 1200", id: 4364, lp: -0.17 },
  { s: " rows", id: 6978, lp: -0.02 },
]

const STEPS = [
  "The harness calls what it believes is a model provider, in its own dialect. Its API key is a session id minted for this rollout.",
  "The proxy picks the dialect from the path, then headers, then body shape, converts it to chat completions, and asks for token ids and logprobs with top_p 1.",
  "vLLM tokenizes the prompt as a side effect of serving it and samples a completion. It returns prompt ids, sampled ids and one logprob per sampled token.",
  "The proxy stores the call as a node: prompt ids as context (loss mask 0), sampled ids as targets (loss mask 1), each with the logprob it was sampled at.",
  "The answer goes back to the harness re-wrapped in its own dialect, streamed if it asked for a stream. The harness runs the tool and builds turn 2.",
  "Turn 2 arrives. If its prompt ids start with turn 1's prompt plus completion, token for token, it is turn 1's child, and the path becomes one training sequence.",
]

const W = 720
const BOX_Y = 18
const BOX_H = 74
const BOXES = [
  { x: 8, w: 196, title: "HARNESS", sub: "unmodified, in a sandbox" },
  { x: 262, w: 196, title: "CAPTURE PROXY", sub: "the only new part" },
  { x: 516, w: 196, title: "vLLM", sub: "the policy being trained" },
]
const CELL = 34
const GAP = 3
const LABEL_W = 62

function lpText(v: number) {
  return v.toFixed(2).replace("-", "−")
}

export function CaptureTape() {
  const [h, setH] = useState<HarnessKey>("claude")
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<"proxy" | "text">("proxy")
  const [odd, setOdd] = useState(false)

  const H0 = HARNESSES[h]
  const sampled = odd ? T1_ODD : T1
  const textMode = mode === "text"
  // What a trainer that saved text and re-encoded it would train on: the canonical split.
  const reencoded = T1

  const tapeTop = BOX_Y + BOX_H + 44
  const rowH = 74
  const H = tapeTop + rowH * 2 + 44

  const active = (i: number) => (step === 0 && i === 0) || (step === 1 && i === 1) || (step === 2 && i === 2) || (step === 3 && i === 1) || (step === 4 && i === 0) || (step === 5 && i === 1)

  // arrows
  const a1 = { x1: BOXES[0].x + BOXES[0].w, x2: BOXES[1].x, y: BOX_Y + BOX_H / 2 }
  const a2 = { x1: BOXES[1].x + BOXES[1].w, x2: BOXES[2].x, y: BOX_Y + BOX_H / 2 }

  const promptCells = (n: number, x0: number, y: number, label: string) => (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={x0 + i * (CELL - 12 + GAP)}
          y={y}
          width={CELL - 12}
          height={24}
          rx={4}
          fill="url(#mh-hatch)"
          stroke="currentColor"
          strokeOpacity={0.25}
        />
      ))}
      <text x={x0} y={y + 38} fontSize={10} className="fill-muted-foreground">
        {label}
      </text>
    </g>
  )

  const sampledCells = (toks: Tok[], x0: number, y: number, opts: { lp: boolean; bad?: Set<number> }) => (
    <g>
      {toks.map((t, i) => {
        const x = x0 + i * (CELL + GAP)
        const bad = opts.bad?.has(i)
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={CELL}
              height={24}
              rx={4}
              fill={bad ? "oklch(0.72 0.14 0 / 0.28)" : "oklch(0.62 0.12 250 / 0.3)"}
              stroke={bad ? "oklch(0.6 0.18 0)" : "oklch(0.55 0.12 250)"}
              strokeDasharray={bad ? "3 2" : undefined}
            />
            <text x={x + CELL / 2} y={y + 15.5} fontSize={9.5} textAnchor="middle" className="fill-foreground font-mono">
              {t.s.replace(/ /g, "·")}
            </text>
            <text x={x + CELL / 2} y={y + 36} fontSize={8.5} textAnchor="middle" className="fill-muted-foreground font-mono">
              {opts.lp ? lpText(t.lp) : "?"}
            </text>
          </g>
        )
      })}
    </g>
  )

  // turn 1 row
  const r1y = tapeTop + 8
  const p1x = LABEL_W
  const p1n = 8
  const s1x = p1x + p1n * (CELL - 12 + GAP) + 8

  // which re-encoded cells differ from what was sampled
  const badSet = new Set<number>()
  if (textMode && odd) badSet.add(6)

  // turn 2 row
  const r2y = tapeTop + rowH + 8
  const prefixW = 150
  const tool2x = LABEL_W + prefixW + 8
  const s2x = tool2x + 6 * (CELL - 12 + GAP) + 8
  const linked = !odd
  // proxy: with a non-canonical split, vLLM re-tokenizes turn 1's text inside turn 2's prompt as
  // ".csv", so the exact-prefix test fails and turn 2 opens a new root.

  const trainable = step >= 3 ? (textMode ? 0 : sampled.length) + (step >= 5 && !textMode ? T2.length : 0) : 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one model call through the capture proxy, and the tape it leaves</span>
        <span className="font-mono text-[11px] text-muted-foreground">illustrative tokens, ids and logprobs</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setH(k)}
              aria-pressed={h === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                h === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {HARNESSES[k].label}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px]">
          <span className="text-muted-foreground">training data from:</span>
          {(["proxy", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 transition-colors",
                mode === m ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "proxy" ? "engine token ids (proxy)" : "saved text, re-tokenized"}
            </button>
          ))}
          <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={odd} onChange={(e) => setOdd(e.target.checked)} />
            model sampled “.csv” as “.c” + “sv”
          </label>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
          <defs>
            <pattern id="mh-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.2" />
            </pattern>
            <marker id="mh-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
          </defs>

          {BOXES.map((b, i) => (
            <g key={i}>
              <rect
                x={b.x}
                y={BOX_Y}
                width={b.w}
                height={BOX_H}
                rx={10}
                className={active(i) ? "fill-muted/60" : "fill-muted/20"}
                stroke={active(i) ? "oklch(0.6 0.12 200)" : "currentColor"}
                strokeOpacity={active(i) ? 1 : 0.2}
                strokeWidth={active(i) ? 2 : 1}
              />
              <text x={b.x + 12} y={BOX_Y + 19} fontSize={10.5} className="fill-muted-foreground font-mono">
                {b.title}
              </text>
              <text x={b.x + 12} y={BOX_Y + 37} fontSize={12.5} fontWeight={600} className="fill-foreground">
                {i === 0 ? H0.label : b.sub}
              </text>
              <text x={b.x + 12} y={BOX_Y + 56} fontSize={10} className="fill-muted-foreground font-mono">
                {i === 0 ? `key = sess_7f3a` : i === 1 ? (step >= 1 ? "dialect → chat, top_p 1" : "waiting") : "ids + logprobs on"}
              </text>
              {i === 0 ? (
                <text x={b.x + 12} y={BOX_Y + 69} fontSize={9} className="fill-muted-foreground font-mono">
                  via {H0.key}
                </text>
              ) : null}
            </g>
          ))}

          {/* harness -> proxy (request) / proxy -> harness (reply) */}
          <g className={step === 0 || step === 4 ? "text-foreground" : "text-muted-foreground/40"}>
            <line
              x1={step === 4 ? a1.x2 - 2 : a1.x1 + 2}
              x2={step === 4 ? a1.x1 + 4 : a1.x2 - 4}
              y1={a1.y}
              y2={a1.y}
              stroke="currentColor"
              strokeWidth={1.5}
              markerEnd="url(#mh-arrow)"
            />
          </g>
          <text x={(a1.x1 + a1.x2) / 2} y={a1.y - 8} fontSize={8.5} textAnchor="middle" className="fill-muted-foreground font-mono">
            {step === 4 ? "re-wrapped" : "request"}
          </text>
          {/* proxy -> vLLM */}
          <g className={step === 1 || step === 2 ? "text-foreground" : "text-muted-foreground/40"}>
            <line
              x1={step === 2 ? a2.x2 - 2 : a2.x1 + 2}
              x2={step === 2 ? a2.x1 + 4 : a2.x2 - 4}
              y1={a2.y}
              y2={a2.y}
              stroke="currentColor"
              strokeWidth={1.5}
              markerEnd="url(#mh-arrow)"
            />
          </g>
          <text x={(a2.x1 + a2.x2) / 2} y={a2.y - 8} fontSize={8.5} textAnchor="middle" className="fill-muted-foreground font-mono">
            {step === 2 ? "ids + logprobs" : "chat, no stream"}
          </text>

          <text x={BOXES[0].x} y={BOX_Y + BOX_H + 18} fontSize={10} className="fill-muted-foreground font-mono">
            {H0.path} · {H0.dialect}
          </text>

          {/* tape */}
          <rect x={4} y={tapeTop - 14} width={W - 8} height={H - tapeTop + 8} rx={10} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeDasharray="4 3" />
          <text x={14} y={tapeTop} fontSize={10} className="fill-muted-foreground font-mono">
            CAPTURE TAPE
          </text>
          <text x={W - 14} y={tapeTop} fontSize={10} textAnchor="end" className="fill-muted-foreground font-mono">
            {trainable} trainable tokens
          </text>

          <text x={14} y={r1y + 24} fontSize={11} className="fill-foreground font-mono">
            turn 1
          </text>
          {step >= 3 ? (
            <g>
              {promptCells(p1n, p1x, r1y + 8, "prompt ids, mask 0")}
              {textMode
                ? sampledCells(reencoded, s1x, r1y + 8, { lp: false, bad: badSet })
                : sampledCells(sampled, s1x, r1y + 8, { lp: true })}
            </g>
          ) : (
            <text x={p1x} y={r1y + 24} fontSize={10} className="fill-muted-foreground font-mono">
              {step === 2 ? "sampling…" : "waiting for the first completion"}
            </text>
          )}

          <text x={14} y={r2y + 24} fontSize={11} className="fill-foreground font-mono">
            turn 2
          </text>
          {step >= 5 ? (
            textMode ? (
              <text x={LABEL_W} y={r2y + 24} fontSize={10} className="fill-muted-foreground font-mono">
                only the text survives; the trainer re-renders it with its own chat template
              </text>
            ) : (
              <g>
                <rect
                  x={LABEL_W}
                  y={r2y + 8}
                  width={prefixW}
                  height={24}
                  rx={4}
                  fill={linked ? "oklch(0.7 0.1 180 / 0.18)" : "oklch(0.72 0.14 0 / 0.18)"}
                  stroke={linked ? "oklch(0.6 0.1 180)" : "oklch(0.6 0.18 0)"}
                  strokeDasharray={linked ? undefined : "3 2"}
                />
                <text x={LABEL_W + prefixW / 2} y={r2y + 24} fontSize={9.5} textAnchor="middle" className="fill-foreground font-mono">
                  {linked ? "= turn 1 prompt + sample" : "… .csv … ≠ … .c sv …"}
                </text>
                <text x={LABEL_W} y={r2y + 46} fontSize={10} className="fill-muted-foreground">
                  {linked ? "exact token prefix: child of turn 1" : "prefix breaks: turn 2 opens a new root"}
                </text>
                {promptCells(6, tool2x, r2y + 8, "tool result, mask 0")}
                {sampledCells(T2, s2x, r2y + 8, { lp: true })}
              </g>
            )
          ) : (
            <text x={LABEL_W} y={r2y + 24} fontSize={10} className="fill-muted-foreground font-mono">
              not yet
            </text>
          )}
        </svg>

        <div className="mt-2 flex items-center gap-3">
          <span className="w-14 shrink-0 font-mono text-[11px] text-muted-foreground">
            {step + 1}/{STEPS.length}
          </span>
          <Range min={0} max={STEPS.length - 1} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} aria-label="Step through the call" className="w-full" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{STEPS[step]}</p>
        {step >= 3 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {textMode
              ? odd
                ? "Saved as text and re-encoded, “.c” + “sv” comes back as “.csv”: a token the model never sampled, with no behaviour logprob. Recomputing one with the current weights makes the importance ratio exactly 1."
                : "Saved as text and re-encoded, the ids happen to match here, but there is still no behaviour logprob. Recomputing it with the current weights makes the importance ratio exp(new − old) exactly 1, even when the weights have moved."
              : odd
                ? "The sampled ids are kept exactly, “.c” and “sv” included. But the harness sends text back, and vLLM tokenizes turn 2’s prompt canonically, so the exact-prefix test fails and turn 2 starts a new root. Nothing is fabricated; one rollout becomes two sequences."
                : "Each target token carries the logprob it was sampled with, so GRPO’s importance ratio exp(new − old) compares the trained policy with the one that actually acted."}
          </p>
        ) : null}
      </div>
    </figure>
  )
}
