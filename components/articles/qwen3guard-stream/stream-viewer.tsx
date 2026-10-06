"use client"

import { useEffect, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// A token-by-token view of what a streaming guard does to one response.
//
// The response is written for this page and is harmless: an onboarding note that
// drifts into a colleague's personal phone number and home address (both
// invented), which is the PII category in Qwen3Guard's policy. The per-token
// probabilities are ILLUSTRATIVE: they are shaped like the behaviour the report
// describes (safe up to a boundary token, then the sample label), plus one
// isolated spike to show why the report debounces over two tokens. They are not
// outputs of Qwen3Guard-Stream; nothing on this page ran the model.
//
// The decision rule mirrors the report and its eval code: a token counts as
// flagged when its risk clears the threshold, and the stream is cut at the
// first flagged token whose predecessor was also flagged. Strict mode counts
// Controversial as unsafe, loose mode counts only Unsafe. The reference code
// takes an argmax over the three classes instead of a threshold; the slider is
// the knob a deployment would add on top of the softmax.

type Tok = { t: string; u: number; c: number; cat?: string }

// u = P(Unsafe), c = P(Controversial); P(Safe) = 1 - u - c.
const TOKENS: Tok[] = [
  { t: "Sure.", u: 0.01, c: 0.01 },
  { t: " Here", u: 0.01, c: 0.01 },
  { t: " is", u: 0.01, c: 0.01 },
  { t: " the", u: 0.01, c: 0.01 },
  { t: " onboarding", u: 0.02, c: 0.02 },
  { t: " note", u: 0.02, c: 0.02 },
  { t: " for", u: 0.01, c: 0.02 },
  { t: " the", u: 0.01, c: 0.02 },
  { t: " new", u: 0.01, c: 0.02 },
  { t: " team.", u: 0.01, c: 0.02 },
  { t: " Priya", u: 0.04, c: 0.08, cat: "PII" },
  { t: " leads", u: 0.03, c: 0.05 },
  { t: " data", u: 0.02, c: 0.04 },
  { t: " and", u: 0.02, c: 0.03 },
  { t: " sits", u: 0.05, c: 0.12, cat: "PII" },
  { t: " on", u: 0.06, c: 0.1, cat: "PII" },
  { t: " floor", u: 0.04, c: 0.08 },
  { t: " three.", u: 0.03, c: 0.05 },
  { t: " Her", u: 0.08, c: 0.14, cat: "PII" },
  { t: " personal", u: 0.41, c: 0.3, cat: "PII" },
  { t: " email", u: 0.12, c: 0.18, cat: "PII" },
  { t: " is", u: 0.1, c: 0.15, cat: "PII" },
  { t: " on", u: 0.04, c: 0.06 },
  { t: " the", u: 0.03, c: 0.05 },
  { t: " wiki.", u: 0.02, c: 0.04 },
  { t: " Her", u: 0.1, c: 0.16, cat: "PII" },
  { t: " home", u: 0.32, c: 0.3, cat: "PII" },
  { t: " address", u: 0.52, c: 0.28, cat: "PII" },
  { t: " is", u: 0.66, c: 0.22, cat: "PII" },
  { t: " 14", u: 0.83, c: 0.11, cat: "PII" },
  { t: " Example", u: 0.88, c: 0.08, cat: "PII" },
  { t: " Lane,", u: 0.9, c: 0.07, cat: "PII" },
  { t: " and", u: 0.86, c: 0.09, cat: "PII" },
  { t: " her", u: 0.85, c: 0.1, cat: "PII" },
  { t: " phone", u: 0.9, c: 0.07, cat: "PII" },
  { t: " is", u: 0.91, c: 0.06, cat: "PII" },
  { t: " 555-0142.", u: 0.94, c: 0.04, cat: "PII" },
]

const N = TOKENS.length
const SAFE = "oklch(0.58 0.13 155)"
const CONTRO = "oklch(0.72 0.14 80)"
const UNSAFE = "oklch(0.6 0.2 25)"
const ACCENT = "oklch(0.6 0.15 255)"

const W = 680
const H = 150
const PL = 30
const PR = 8
const PT = 10
const PB = 18

const sx = (i: number) => PL + (i + 0.5) * ((W - PL - PR) / N)
const sy = (p: number) => PT + (1 - p) * (H - PT - PB)

function riskOf(tok: Tok, strict: boolean) {
  return strict ? tok.u + tok.c : tok.u
}

function cutIndex(tau: number, strict: boolean, debounce: boolean) {
  for (let i = 0; i < N; i++) {
    const hit = riskOf(TOKENS[i], strict) >= tau
    if (!hit) continue
    if (!debounce) return i
    if (i > 0 && riskOf(TOKENS[i - 1], strict) >= tau) return i
  }
  return -1
}

function label(tok: Tok) {
  const s = 1 - tok.u - tok.c
  if (tok.u >= tok.c && tok.u >= s) return "Unsafe"
  if (tok.c >= s) return "Controversial"
  return "Safe"
}

export function StreamViewer() {
  const [tau, setTau] = useState(0.6)
  const [strict, setStrict] = useState(true)
  const [debounce, setDebounce] = useState(true)
  const [shown, setShown] = useState(N)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setShown((k) => {
        if (k >= N) {
          setPlaying(false)
          return k
        }
        return k + 1
      })
    }, 140)
    return () => clearInterval(id)
  }, [playing])

  const cut = cutIndex(tau, strict, debounce)
  const cutVisible = cut >= 0 && cut < shown
  const visibleEnd = cutVisible ? cut : shown // tokens the user actually received
  const userSaw = TOKENS.slice(0, visibleEnd)
    .map((x) => x.t)
    .join("")
    .trim()
  const linePath = TOKENS.map((tok, i) => `${i === 0 ? "M" : "L"} ${sx(i).toFixed(1)} ${sy(riskOf(tok, strict)).toFixed(1)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>stream guard · one score per token · cut on two in a row</span>
        <span className="text-muted-foreground/60">illustrative scores, not model output</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* the stream itself */}
        <div className="min-h-[5.5rem] rounded-md border bg-background/60 p-3 font-mono text-[12.5px] leading-7" aria-live="polite">
          {TOKENS.slice(0, shown).map((tok, i) => {
            const r = riskOf(tok, strict)
            const flagged = r >= tau
            const blocked = cutVisible && i >= cut
            const isCut = cutVisible && i === cut
            const col = flagged ? (strict && tok.c > tok.u ? CONTRO : UNSAFE) : r >= tau * 0.6 ? CONTRO : SAFE
            return (
              <span
                key={i}
                className="rounded-sm px-[1px]"
                style={{
                  color: blocked ? "var(--muted-foreground)" : undefined,
                  textDecoration: blocked ? "line-through" : undefined,
                  opacity: blocked && !isCut ? 0.35 : 1,
                  background: `color-mix(in oklch, ${col} ${Math.round(Math.min(1, r) * 45)}%, transparent)`,
                  outline: isCut ? `1.5px solid ${UNSAFE}` : undefined,
                }}
                title={`token ${i}: P(unsafe) ${tok.u.toFixed(2)}, P(controversial) ${tok.c.toFixed(2)}, argmax ${label(tok)}`}
              >
                {tok.t}
              </span>
            )
          })}
          {shown < N && !cutVisible ? <span className="animate-pulse text-muted-foreground">▍</span> : null}
        </div>

        {/* risk trace */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Per-token risk for ${N} tokens with threshold ${tau.toFixed(2)}. ${cut >= 0 ? `The stream is cut at token ${cut}, "${TOKENS[cut].t.trim()}".` : "The stream is never cut."}`}
        >
          {[0, 0.5, 1].map((p) => (
            <g key={p}>
              <line x1={PL} x2={W - PR} y1={sy(p)} y2={sy(p)} stroke="var(--border)" strokeWidth={1} />
              <text x={PL - 4} y={sy(p) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
                {p.toFixed(1)}
              </text>
            </g>
          ))}
          {TOKENS.map((tok, i) => {
            const r = riskOf(tok, strict)
            const bw = ((W - PL - PR) / N) * 0.62
            return (
              <rect
                key={i}
                x={sx(i) - bw / 2}
                y={sy(r)}
                width={bw}
                height={sy(0) - sy(r)}
                fill={r >= tau ? UNSAFE : SAFE}
                opacity={i < shown ? 0.55 : 0.12}
              />
            )
          })}
          <path d={linePath} fill="none" stroke="var(--foreground)" strokeWidth={1} opacity={0.35} />
          <line x1={PL} x2={W - PR} y1={sy(tau)} y2={sy(tau)} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={W - PR} y={sy(tau) - 4} textAnchor="end" fontSize={10} fontWeight={600} fill={ACCENT} className="font-mono">
            τ = {tau.toFixed(2)}
          </text>
          {cut >= 0 ? (
            <g>
              <line x1={sx(cut)} x2={sx(cut)} y1={PT} y2={sy(0)} stroke={UNSAFE} strokeWidth={1.5} />
              <text x={sx(cut) - 4} y={PT + 9} textAnchor="end" fontSize={10} fill={UNSAFE} className="font-mono">
                cut
              </text>
            </g>
          ) : null}
          <text x={PL} y={H - 4} fontSize={9} className="fill-muted-foreground font-mono">
            token position →
          </text>
        </svg>

        {/* controls */}
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">threshold τ on {strict ? "P(unsafe) + P(controversial)" : "P(unsafe)"}</span>
            <Range min={0.3} max={0.95} step={0.01} value={tau} onChange={(e) => setTau(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">
              tokens streamed: {shown} of {N}
            </span>
            <Range
              min={0}
              max={N}
              step={1}
              value={shown}
              onChange={(e) => {
                setPlaying(false)
                setShown(Number(e.target.value))
              }}
              className="w-full cursor-pointer"
              accent={ACCENT}
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px]">
          <button
            type="button"
            className="rounded-md border px-2.5 py-1 hover:bg-muted"
            onClick={() => {
              if (shown >= N) setShown(0)
              setPlaying((p) => !p)
            }}
          >
            {playing ? "pause" : "play stream"}
          </button>
          <button type="button" className="rounded-md border px-2.5 py-1 hover:bg-muted" aria-pressed={strict} onClick={() => setStrict((s) => !s)}>
            mode: {strict ? "strict (controversial counts)" : "loose (unsafe only)"}
          </button>
          <button type="button" className="rounded-md border px-2.5 py-1 hover:bg-muted" aria-pressed={debounce} onClick={() => setDebounce((d) => !d)}>
            debounce: {debounce ? "two tokens in a row" : "off, first token"}
          </button>
        </div>

        {/* readout */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">cut at token</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: cut >= 0 ? UNSAFE : SAFE }}>
              {cut >= 0 ? `${cut} "${TOKENS[cut].t.trim()}"` : "never"}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">category head at the cut</div>
            <div className="font-mono text-xl font-semibold">{cut >= 0 ? TOKENS[cut].cat ?? "n/a" : "not read"}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">tokens withheld</div>
            <div className="font-mono text-xl font-semibold tabular-nums">{cut >= 0 ? N - cut : 0}</div>
          </div>
        </div>

        <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          the user received: <span className="text-foreground">{userSaw.length ? `“${userSaw}”` : "nothing yet"}</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The response and every probability here are written for this page. Turn the debounce off and drop τ below about 0.7 in strict mode: the lone spike on{" "}
          <code>personal</code> cuts the stream at an onboarding note, which is the false alarm the report&apos;s two-token rule is there to absorb. With the debounce on, the
          cut lands inside <code>home address is</code>, a few tokens before the number itself, and the user never sees it.
        </p>
      </div>
    </figure>
  )
}
