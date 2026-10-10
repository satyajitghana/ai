"use client"

import { useState } from "react"

import { CANDLES, CONTEXT_STATS } from "./data"

// Eight real five-minute candles, their normalised 6-vectors, the 20 bits the
// Kronos-Tokenizer-2k BSQ layer produced for them, the two 10-bit sub-token ids,
// and what the decoder rebuilt from the coarse half alone and from all 20 bits.
// Every number comes from one recorded CPU run (see data.ts); nothing here is
// simulated. Bit j of each half contributes 2^j to its id, as in
// BSQuantizer.bits_to_indices (model/module.py:234-243).

const FIELDS = ["open", "high", "low", "close", "volume"] as const
const ACC = "oklch(0.6 0.13 250)"
const COARSE = "oklch(0.68 0.16 55)"
const FULL = "oklch(0.58 0.15 155)"

type Mode = "coarse" | "full"

function fmt(v: number, k: number) {
  return k === 4 ? Math.round(v).toLocaleString("en-US") : v.toFixed(3)
}

export function KlineTokenizer() {
  const [sel, setSel] = useState(4)
  const [mode, setMode] = useState<Mode>("coarse")
  const c = CANDLES[sel]

  // chart scale over raw and both reconstructions
  const all = CANDLES.flatMap((d) => [d.raw[1], d.raw[2], d[mode][1], d[mode][2]])
  const lo = Math.min(...all) - 0.01
  const hi = Math.max(...all) + 0.01
  const W = 560
  const H = 170
  const pad = 26
  const y = (v: number) => pad / 2 + ((hi - v) / (hi - lo)) * (H - pad)
  const step = (W - 40) / CANDLES.length

  // mean absolute error over the four prices, in price units, for all 8 candles
  const mae = (m: Mode) =>
    CANDLES.reduce((a, d) => a + [0, 1, 2, 3].reduce((b, k) => b + Math.abs(d[m][k] - d.raw[k]), 0) / 4, 0) /
    CANDLES.length
  const tick = (v: number) => (v / CONTEXT_STATS.std[3]).toFixed(3)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">K-line tokenizer · a recorded run of Kronos-Tokenizer-2k</span>
        <div className="flex gap-1 font-mono text-[11px]">
          {(["coarse", "full"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded border px-2 py-0.5 ${mode === m ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {m === "coarse" ? "decode coarse 10 bits" : "decode all 20 bits"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border bg-background" role="img"
          aria-label={`Eight real five-minute candles in grey with the ${mode} reconstruction overlaid; candle ${sel + 1} selected`}>
          {CANDLES.map((d, i) => {
            const x = 30 + i * step + step / 2
            const up = d.raw[3] >= d.raw[0]
            const r = d[mode]
            return (
              <g key={d.ts} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
                <rect x={x - step / 2 + 2} y={4} width={step - 4} height={H - 8} rx={4}
                  fill={i === sel ? "currentColor" : "transparent"} opacity={0.06} />
                <line x1={x - 7} x2={x - 7} y1={y(d.raw[1])} y2={y(d.raw[2])} stroke="currentColor" opacity={0.55} />
                <rect x={x - 13} width={12} y={y(Math.max(d.raw[0], d.raw[3]))}
                  height={Math.max(1.5, Math.abs(y(d.raw[0]) - y(d.raw[3])))}
                  fill={up ? "currentColor" : "transparent"} stroke="currentColor" opacity={0.55} />
                <line x1={x + 7} x2={x + 7} y1={y(r[1])} y2={y(r[2])} stroke={mode === "coarse" ? COARSE : FULL} />
                <rect x={x + 1} width={12} y={y(Math.max(r[0], r[3]))}
                  height={Math.max(1.5, Math.abs(y(r[0]) - y(r[3])))}
                  fill={mode === "coarse" ? COARSE : FULL} opacity={0.85} />
                <text x={x} y={H - 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                  {d.ts.slice(6)}
                </text>
              </g>
            )
          })}
          <text x={4} y={y(hi - 0.01) + 4} className="fill-muted-foreground font-mono" fontSize={9}>{(hi - 0.01).toFixed(2)}</text>
          <text x={4} y={y(lo + 0.01)} className="fill-muted-foreground font-mono" fontSize={9}>{(lo + 0.01).toFixed(2)}</text>
        </svg>
        <p className="font-mono text-[11px] text-muted-foreground">
          grey: the real candle · colour: what the decoder rebuilt from the {mode === "coarse" ? "coarse 10 bits" : "full 20 bits"} · click a candle
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 font-mono text-[11px]">
            <div className="text-muted-foreground">1 · candle {c.ts}, normalised (z-score over the 512-candle context)</div>
            <div className="grid grid-cols-6 gap-1">
              {["open", "high", "low", "close", "vol", "amount"].map((f, k) => (
                <div key={f} className="rounded border px-1 py-1 text-center">
                  <div className="text-muted-foreground">{f}</div>
                  <div style={{ color: ACC }}>{c.norm[k].toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="text-muted-foreground">2 · encoder, then L2-normalise, then sign → 20 bits</div>
            <div className="space-y-1">
              {[0, 1].map((h) => (
                <div key={h} className="flex items-center gap-1">
                  <span className="w-12 text-muted-foreground">{h === 0 ? "coarse" : "fine"}</span>
                  {c.bits.slice(h * 10, h * 10 + 10).split("").map((b, j) => (
                    <span key={j} className="inline-block w-4 rounded-sm text-center"
                      style={{ background: b === "1" ? (h === 0 ? COARSE : FULL) : "transparent", color: b === "1" ? "white" : undefined, border: "1px solid currentColor", opacity: b === "1" ? 1 : 0.4 }}>
                      {b === "1" ? "+" : "−"}
                    </span>
                  ))}
                  <span className="ml-2">id {h === 0 ? c.s1 : c.s2}</span>
                </div>
              ))}
            </div>
            <div className="text-muted-foreground">
              3 · the transformer sees the pair ({c.s1}, {c.s2}): two lookups in 1,024-row tables, not one in a 1,048,576-row table
            </div>
          </div>

          <div className="space-y-2 font-mono text-[11px]">
            <div className="text-muted-foreground">4 · decoded back, de-normalised to price units</div>
            <table className="w-full">
              <thead>
                <tr className="text-muted-foreground"><th className="text-left">field</th><th className="text-right">real</th><th className="text-right">coarse</th><th className="text-right">full</th></tr>
              </thead>
              <tbody>
                {FIELDS.map((f, k) => (
                  <tr key={f}>
                    <td>{f}</td>
                    <td className="text-right">{fmt(c.raw[k], k)}</td>
                    <td className="text-right" style={{ color: COARSE }}>{fmt(c.coarse[k], k)}</td>
                    <td className="text-right" style={{ color: FULL }}>{fmt(c.full[k], k)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="rounded border px-2 py-1.5">
              mean price error over these 8 candles: coarse {mae("coarse").toFixed(4)} ({tick(mae("coarse"))} std),
              full {mae("full").toFixed(4)} ({tick(mae("full"))} std)
            </div>
          </div>
        </div>
      </div>
    </figure>
  )
}
