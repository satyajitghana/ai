"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A toy of keyword biasing in beam search. Every log-probability below is
// ILLUSTRATIVE: I made them up to have the shape real beams have (a common
// spelling of a rare name beats the rare name by a little; an unrelated
// phrase beats it by a lot). Nothing here is Whistle's output; the engine is
// a closed binary and publishes no per-beam scores.
//
// The scoring rule is the one Cactus describes: beams ranked by
// length-normalised log probability, and a keyword automaton that lifts a
// beam's log probability as it advances through a listed phrase. Here each
// token that advances the automaton gets +bias. Whether the real engine
// takes the bonus back when a partial match dies is not published, and these
// beams are finished hypotheses, so the question does not arise.

type Tok = { t: string; lp: number; kw?: boolean; g?: boolean } // g: glued to the previous piece
type Beam = { toks: Tok[]; truth?: boolean }
type Clip = { id: string; said: string; beams: Beam[] }

const CLIPS: Clip[] = [
  {
    id: "siobhan",
    said: "call Siobhan at noon",
    beams: [
      { toks: [{ t: "call", lp: -0.1 }, { t: "shi", lp: -0.9 }, { t: "von", lp: -0.8, g: true }, { t: "at", lp: -0.1 }, { t: "noon", lp: -0.2 }] },
      { toks: [{ t: "call", lp: -0.1 }, { t: "she", lp: -1.0 }, { t: "von", lp: -1.1 }, { t: "at", lp: -0.1 }, { t: "noon", lp: -0.2 }] },
      {
        truth: true,
        toks: [
          { t: "call", lp: -0.1 },
          { t: "Si", lp: -1.6, kw: true },
          { t: "ob", lp: -0.9, kw: true, g: true },
          { t: "han", lp: -0.7, kw: true, g: true },
          { t: "at", lp: -0.1 },
          { t: "noon", lp: -0.2 },
        ],
      },
      { toks: [{ t: "call", lp: -0.1 }, { t: "Joan", lp: -2.2 }, { t: "at", lp: -0.1 }, { t: "noon", lp: -0.2 }] },
    ],
  },
  {
    id: "krzysztof",
    said: "ask Krzysztof to sign",
    beams: [
      { toks: [{ t: "ask", lp: -0.1 }, { t: "Christ", lp: -0.6 }, { t: "oph", lp: -0.5, g: true }, { t: "to", lp: -0.1 }, { t: "sign", lp: -0.2 }] },
      { toks: [{ t: "ask", lp: -0.1 }, { t: "Krist", lp: -1.0 }, { t: "of", lp: -0.4, g: true }, { t: "to", lp: -0.1 }, { t: "sign", lp: -0.2 }] },
      { toks: [{ t: "ask", lp: -0.1 }, { t: "cruise", lp: -1.9 }, { t: "to", lp: -0.1 }, { t: "sign", lp: -0.2 }] },
      {
        truth: true,
        toks: [
          { t: "ask", lp: -0.1 },
          { t: "Krz", lp: -2.0, kw: true },
          { t: "ysz", lp: -1.2, kw: true, g: true },
          { t: "tof", lp: -0.6, kw: true, g: true },
          { t: "to", lp: -0.1 },
          { t: "sign", lp: -0.2 },
        ],
      },
    ],
  },
  {
    id: "show",
    said: "put the show on now",
    beams: [
      {
        truth: true,
        toks: [{ t: "put", lp: -0.1 }, { t: "the", lp: -0.1 }, { t: "show", lp: -0.5 }, { t: "on", lp: -0.3 }, { t: "now", lp: -0.2 }],
      },
      { toks: [{ t: "but", lp: -0.5 }, { t: "the", lp: -0.1 }, { t: "show", lp: -0.5 }, { t: "on", lp: -0.3 }, { t: "now", lp: -0.2 }] },
      { toks: [{ t: "put", lp: -0.1 }, { t: "the", lp: -0.1 }, { t: "shove", lp: -1.2 }, { t: "on", lp: -0.3 }, { t: "now", lp: -0.2 }] },
      {
        toks: [
          { t: "put", lp: -0.1 },
          { t: "the", lp: -0.1 },
          { t: "Si", lp: -2.0, kw: true },
          { t: "ob", lp: -1.4, kw: true, g: true },
          { t: "han", lp: -1.2, kw: true, g: true },
          { t: "now", lp: -0.3 },
        ],
      },
    ],
  },
]

const OK = "oklch(0.58 0.15 155)"
const BAD = "oklch(0.6 0.2 27)"
const KW = "oklch(0.62 0.16 260)"

function score(b: Beam, bias: number) {
  let s = 0
  for (const k of b.toks) s += k.lp + (k.kw ? bias : 0)
  return s / b.toks.length
}

function text(b: Beam) {
  return b.toks.map((k, i) => (i > 0 && !k.g ? " " : "") + k.t).join("")
}

export function KeywordBiasBeam() {
  const [bias, setBias] = useState(0)
  const [clipId, setClipId] = useState("siobhan")
  const clip = CLIPS.find((c) => c.id === clipId) ?? CLIPS[0]

  const ranked = clip.beams
    .map((b) => ({ b, s: score(b, bias) }))
    .sort((x, y) => y.s - x.s)
  const winner = ranked[0]
  const right = !!winner.b.truth

  const verdicts = CLIPS.map((c) => {
    const top = c.beams.map((b) => ({ b, s: score(b, bias) })).sort((x, y) => y.s - x.s)[0]
    return { id: c.id, said: c.said, right: !!top.b.truth }
  })

  const lo = -2.6
  const hi = 0
  const pct = (s: number) => ((Math.min(hi, Math.max(lo, s)) - lo) / (hi - lo)) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          keywords = [&quot;Siobhan&quot;, &quot;Krzysztof&quot;] · four finished beams per clip · illustrative log-probs
        </span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CLIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClipId(c.id)}
              aria-pressed={clipId === c.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                clipId === c.id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              said: &ldquo;{c.said}&rdquo;
            </button>
          ))}
        </div>

        <label className="block">
          <div className="flex items-baseline justify-between font-mono text-xs">
            <span className="text-muted-foreground">bias per keyword token</span>
            <span className="tabular-nums">+{bias.toFixed(2)} nats</span>
          </div>
          <Range
            min={0}
            max={1.6}
            step={0.02}
            value={bias}
            onChange={(e) => setBias(Number(e.target.value))}
            aria-label="Keyword bias per matched token, in nats"
            className="mt-1 w-full"
          />
        </label>

        <ol className="space-y-1.5">
          {ranked.map(({ b, s }, i) => (
            <li key={text(b)} className={cn("rounded-md border px-2.5 py-2", i === 0 ? "border-foreground/30 bg-muted/40" : "border-border")}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[13px]">
                  <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                  {b.toks.map((k, j) => (
                    <span
                      key={j}
                      style={k.kw ? { color: KW, textDecoration: "underline", textUnderlineOffset: 3 } : undefined}
                    >
                      {j > 0 && !k.g ? " " : ""}
                      {k.t}
                    </span>
                  ))}
                  {b.truth ? (
                    <span className="ml-2 text-[10px]" style={{ color: OK }}>
                      what was said
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{s.toFixed(3)}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted/40">
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: `${pct(s).toFixed(2)}%`, background: b.truth ? OK : i === 0 ? BAD : "oklch(0.6 0.02 250)" }}
                />
              </div>
            </li>
          ))}
        </ol>

        <p className="font-mono text-xs" style={{ color: right ? OK : BAD }}>
          {right
            ? `transcript: "${text(winner.b)}" (correct)`
            : `transcript: "${text(winner.b)}" (wrong)`}
        </p>

        <div className="grid gap-1.5 sm:grid-cols-3">
          {verdicts.map((v) => (
            <div key={v.id} className="rounded-md border px-2 py-1.5 font-mono text-[11px]">
              <div className="text-muted-foreground">&ldquo;{v.said}&rdquo;</div>
              <div style={{ color: v.right ? OK : BAD }}>{v.right ? "right" : "wrong"}</div>
            </div>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Score = (sum of token log-probs + bias for each token that advances a keyword) / number of
        tokens. With these made-up numbers, &ldquo;Siobhan&rdquo; wins once the bias passes 0.36 nats,
        &ldquo;Krzysztof&rdquo; once it passes 0.80, and above 1.22 the name is inserted into a clip that never
        said it. The window where all three clips come out right is the tuning problem; the real
        engine&rsquo;s bias strength is not published.
      </figcaption>
    </figure>
  )
}
