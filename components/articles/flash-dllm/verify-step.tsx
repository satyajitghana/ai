"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One denoising step of Flash-Verify on a single 16-token window, with the
// acceptance rule written two ways: the paper's (Algorithm 2 line 14 and
// Eq. 5: the mask view must agree with the draft and be at least gamma
// confident, token by token, stopping at the first failure) and the released
// code's (generate.py: gather the mask view's probability of each draft token,
// take a cumulative product in causality order, keep the prefix where the
// product is still >= gamma).
//
// The probabilities are toy numbers written for this widget, on a fragment of
// the GSM8K sample the paper prints in its Table 8. They are not measured. The
// structure is the code's: at least one token is always committed
// (`keep_num = max(keep_num, 1)`), the search set is capped at half the block
// (`min(num_verify, block_m // 2)` = 8), and the verify query is always
// 2 x 16 = 32 rows, so the tracked context shrinks as the search set grows.

type Tok = { t: string; c: number; v: number; agree: boolean }

// c: draft confidence (all 16 positions masked).
// v: the mask view's probability of the drafted token, with the earlier drafts
//    in causality order visible. agree: the mask view's own top token is the draft.
const WINDOW: Tok[] = [
  { t: "Rong", c: 0.97, v: 0.99, agree: true },
  { t: "saves", c: 0.93, v: 0.98, agree: true },
  { t: "20", c: 0.88, v: 0.97, agree: true },
  { t: "coins", c: 0.95, v: 0.99, agree: true },
  { t: "per", c: 0.99, v: 0.99, agree: true },
  { t: "month", c: 0.98, v: 0.99, agree: true },
  { t: ",", c: 0.91, v: 0.97, agree: true },
  { t: "so", c: 0.62, v: 0.72, agree: true },
  { t: "in", c: 0.74, v: 0.96, agree: true },
  { t: "one", c: 0.7, v: 0.9, agree: true },
  { t: "year", c: 0.84, v: 0.95, agree: true },
  { t: ",", c: 0.79, v: 0.93, agree: true },
  { t: "he", c: 0.55, v: 0.88, agree: true },
  { t: "saves", c: 0.48, v: 0.41, agree: false },
  { t: "20", c: 0.33, v: 0.6, agree: true },
  { t: "*", c: 0.25, v: 0.3, agree: false },
]

const BLOCK = 16
const MAX_SEARCH = BLOCK / 2
const ORDER = WINDOW.map((_, i) => i).sort((a, b) => WINDOW[b].c - WINDOW[a].c || a - b)

type Rule = "paper" | "code"

const CONFIDENT = "oklch(0.62 0.15 150)"
const VERIFIED = "oklch(0.6 0.14 235)"
const REJECTED = "oklch(0.7 0.15 60)"
const DRAFT_KEY = REJECTED

function run(eps: number, gamma: number) {
  const nConf = Math.max(1, ORDER.filter((i) => WINDOW[i].c >= eps).length)
  const confident = ORDER.slice(0, nConf)
  const search = ORDER.slice(nConf, nConf + Math.min(MAX_SEARCH, BLOCK - nConf))

  let paperStop = false
  let codeStop = false
  let prod = 1
  const rows = search.map((i) => {
    const tok = WINDOW[i]
    prod = prod * tok.v
    const paperOk = !paperStop && tok.agree && tok.v >= gamma
    if (!paperOk) paperStop = true
    const codeOk = !codeStop && prod >= gamma
    if (!codeOk) codeStop = true
    return { i, tok, prod, paperOk, codeOk }
  })
  const paperN = rows.filter((r) => r.paperOk).length
  const codeN = rows.filter((r) => r.codeOk).length
  return { confident, search, rows, paperN, codeN }
}

function MaskMatrix({ k }: { k: number }) {
  const n = 2 * k + 1
  const C = 12
  const L = 20
  const size = L + n * C
  const label = (j: number) => (j === 0 ? "T" : j <= k ? `d${j}` : `m${j - k}`)
  const allowed = (r: number, c: number) => {
    if (r === 0) return c === 0 || c > k
    if (c === 0) return true
    if (r <= k) {
      const i = r
      return c <= k ? c <= i : c - k > i
    }
    const i = r - k
    return c <= k ? c < i : c - k >= i
  }
  return (
    <svg viewBox={`0 0 ${size + 2} ${size + 2}`} role="img" className="h-auto w-full max-w-[240px]">
      <title>
        {`Verify-pass attention mask for ${k} search tokens. Rows are queries, columns are keys. The tracked context T sees itself and the mask view but no draft. Draft j sees earlier-or-equal drafts and later masks. Mask j sees earlier drafts and itself and later masks, never its own draft.`}
      </title>
      {Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={L + c * C + 0.5}
            y={L + r * C + 0.5}
            width={C - 1}
            height={C - 1}
            rx={1}
            fill={allowed(r, c) ? (c === 0 ? "currentColor" : c <= k ? DRAFT_KEY : VERIFIED) : "currentColor"}
            fillOpacity={allowed(r, c) ? (c === 0 ? 0.35 : 0.75) : 0.06}
          />
        )),
      )}
      {Array.from({ length: n }, (_, j) => (
        <g key={j}>
          <text x={L - 3} y={L + j * C + 8.5} fontSize={7} textAnchor="end" fill="currentColor" fillOpacity={0.65} fontFamily="ui-monospace, monospace">
            {label(j)}
          </text>
          <text x={L + j * C + C / 2} y={L - 4} fontSize={7} textAnchor="middle" fill="currentColor" fillOpacity={0.65} fontFamily="ui-monospace, monospace">
            {label(j)}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function VerifyStep() {
  const [eps, setEps] = useState(0.9)
  const [gamma, setGamma] = useState(0.8)
  const [rule, setRule] = useState<Rule>("code")

  const r = run(eps, gamma)
  const accepted = new Set(r.rows.filter((x) => (rule === "paper" ? x.paperOk : x.codeOk)).map((x) => x.i))
  const confident = new Set(r.confident)
  const searched = new Set(r.search)
  const k = r.search.length
  const tracked = 2 * BLOCK - 2 * k
  const nConf = r.confident.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one Flash-Verify step, one 16-token window</span>
        <span className="font-mono text-[10px] text-muted-foreground">toy probabilities · not measured</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1">
          {WINDOW.map((tok, i) => {
            const state = confident.has(i) ? "conf" : accepted.has(i) ? "ver" : searched.has(i) ? "rej" : "mask"
            const colour = state === "conf" ? CONFIDENT : state === "ver" ? VERIFIED : state === "rej" ? REJECTED : undefined
            return (
              <span
                key={i}
                className={cn(
                  "inline-flex min-w-[2.6rem] flex-col items-center rounded-md border px-1.5 py-1 font-mono text-[11px]",
                  state === "mask" && "border-dashed text-muted-foreground",
                )}
                style={
                  colour
                    ? {
                        borderColor: colour,
                        background: state === "rej" ? "transparent" : `color-mix(in oklch, ${colour} 22%, transparent)`,
                      }
                    : undefined
                }
              >
                <span className={cn(state === "mask" && "opacity-60")}>{state === "mask" || state === "rej" ? "[M]" : tok.t}</span>
                <span className="text-[9px] text-muted-foreground">{tok.c.toFixed(2)}</span>
              </span>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CONFIDENT }} /> committed: draft confidence ≥ ε
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: VERIFIED }} /> committed by verification
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ borderColor: REJECTED }} /> searched, stays masked
          </span>
          <span>dashed = outside the search set · small number = draft confidence</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>confidence threshold ε</span>
              <span className="text-foreground">{eps.toFixed(2)}</span>
            </span>
            <Range min={0.5} max={0.99} step={0.01} value={eps} onChange={(e) => setEps(Number(e.target.value))} aria-label="Confidence threshold epsilon" className="mt-1.5 w-full" />
          </label>
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>verify threshold γ</span>
              <span className="text-foreground">{gamma.toFixed(2)}</span>
            </span>
            <Range min={0.5} max={1} step={0.01} value={gamma} onChange={(e) => setGamma(Number(e.target.value))} aria-label="Verify threshold gamma" className="mt-1.5 w-full" />
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["code", "code rule: cumulative product ≥ γ"],
              ["paper", "paper rule: agree and each ≥ γ"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRule(key)}
              aria-pressed={rule === key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                rule === key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {k > 0 ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px] font-mono text-[10.5px]">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-1 pr-2 text-left font-normal">order</th>
                    <th className="py-1 pr-2 text-left font-normal">draft</th>
                    <th className="py-1 pr-2 text-right font-normal">draft c</th>
                    <th className="py-1 pr-2 text-right font-normal">mask view p</th>
                    <th className="py-1 pr-2 text-right font-normal">running ∏</th>
                    <th className="py-1 pr-2 text-center font-normal">paper</th>
                    <th className="py-1 text-center font-normal">code</th>
                  </tr>
                </thead>
                <tbody>
                  {r.rows.map((row, j) => (
                    <tr key={row.i} className="border-b border-border/50">
                      <td className="py-1 pr-2 text-muted-foreground">{j + 1}</td>
                      <td className="py-1 pr-2">
                        {row.tok.t}
                        {row.tok.agree ? null : <span className="text-muted-foreground"> (mask view disagrees)</span>}
                      </td>
                      <td className="py-1 pr-2 text-right">{row.tok.c.toFixed(2)}</td>
                      <td className="py-1 pr-2 text-right">{row.tok.v.toFixed(2)}</td>
                      <td className="py-1 pr-2 text-right">{row.prod.toFixed(3)}</td>
                      <td className="py-1 pr-2 text-center" style={{ color: row.paperOk ? VERIFIED : REJECTED }}>
                        {row.paperOk ? "accept" : "stop"}
                      </td>
                      <td className="py-1 text-center" style={{ color: row.codeOk ? VERIFIED : REJECTED }}>
                        {row.codeOk ? "accept" : "stop"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MaskMatrix k={k} />
              <span className="max-w-[240px] text-center font-mono text-[9.5px] leading-snug text-muted-foreground">
                verify mask: T = tracked context, d = draft view, m = mask view; filled = may attend
              </span>
            </div>
          </div>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">Every position cleared ε, so there is nothing left to verify.</p>
        )}

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">confidence only</div>
            <div className="text-base text-foreground">
              {nConf} <span className="text-[10px] text-muted-foreground">{nConf === 1 ? "token" : "tokens"} this step</span>
            </div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">+ Flash-Verify</div>
            <div className="text-base text-foreground">
              {nConf + (rule === "paper" ? r.paperN : r.codeN)}{" "}
              <span className="text-[10px] text-muted-foreground">
                ({rule} rule; {rule === "paper" ? "code" : "paper"} rule gives {nConf + (rule === "paper" ? r.codeN : r.paperN)})
              </span>
            </div>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <div className="text-muted-foreground">verify query, 32 rows</div>
            <div className="text-foreground">
              {tracked} tracked + {k} drafts + {k} masks
            </div>
          </div>
        </div>
      </div>
    </figure>
  )
}
