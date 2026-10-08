"use client"

import { useState } from "react"

// Which tokens one query attends to, in each of T3-Video's five layer types.
// The grid is the real 4K latent frame: 136 x 240 tokens (2176 / 16 by 3840 / 16),
// one SVG unit per token, over 21 latent frames.
//
// (n_t, n_h, n_w) per layer type are copied from wan_video_dit.py:199-212
// (mode 'wan2.1_2176_3840', layer index % 5). The two branches are the two
// einops patterns at wan_video_dit.py:243 and :257:
//   close  'b (n_t w_t) (n_h w_h) (n_w w_w) d'  -> contiguous blocks
//   remote 'b (w_t n_t) (w_h n_h) (w_w n_w) d'  -> every n-th token, strided
// so a query at (t, h, w) shares its close window with tokens in the same block
// (t // w_t, h // w_h, w // w_w) and its remote window with tokens congruent
// to it (t % n_t, h % n_h, w % n_w). The block outputs are averaged (:272).

const T = 21
const H = 136
const W = 240

const TYPES = [
  { n: [21, 1, 1], name: "per-frame", layers: "0, 5, 10, 15, 20, 25" },
  { n: [1, 17, 30], name: "8 x 8 tiles, all frames", layers: "1, 6, 11, 16, 21, 26" },
  { n: [1, 8, 40], name: "17 x 6 tiles, all frames", layers: "2, 7, 12, 17, 22, 27" },
  { n: [3, 17, 8], name: "8 x 30 tiles, 7 frames", layers: "3, 8, 13, 18, 23, 28" },
  { n: [7, 8, 6], name: "17 x 40 tiles, 3 frames", layers: "4, 9, 14, 19, 24, 29" },
] as const

const CLOSE = "oklch(0.66 0.16 45)"
const REMOTE = "oklch(0.6 0.15 230)"

export function WindowPattern() {
  const [type, setType] = useState(1)
  const [q, setQ] = useState<[number, number, number]>([10, 60, 100]) // t, h, w
  const [branch, setBranch] = useState<"both" | "close" | "remote">("both")

  const [nt, nh, nw] = TYPES[type].n
  const wt = T / nt
  const wh = H / nh
  const ww = W / nw
  const [qt, qh, qw] = q

  // close window: one rectangle
  const ch0 = Math.floor(qh / wh) * wh
  const cw0 = Math.floor(qw / ww) * ww
  const ct0 = Math.floor(qt / wt) * wt

  // remote window: rows h = qh % nh + k*nh, cols w = qw % nw + k*nw
  const rh = Array.from({ length: wh }, (_, k) => (qh % nh) + k * nh)
  const rw = Array.from({ length: ww }, (_, k) => (qw % nw) + k * nw)
  const rt = Array.from({ length: wt }, (_, k) => (qt % nt) + k * nt)
  const same = nh === 1 && nw === 1 && wt === 1
  // in the per-frame type the remote window is the whole frame too; draw it as one rect
  const remotePath = same ? `M0 0H${W}V${H}H0z` : rh.flatMap((h) => rw.map((w) => `M${w} ${h}h1v1h-1z`)).join("")

  const ct = Array.from({ length: wt }, (_, k) => ct0 + k)
  const lb = wt * wh * ww

  const showClose = branch !== "remote"
  const showRemote = branch !== "close"

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const w = Math.min(W - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * W)))
    const h = Math.min(H - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * H)))
    setQ([qt, h, w])
  }

  // window grid lines for the close branch
  const grid = [
    ...Array.from({ length: nh - 1 }, (_, k) => `M0 ${(k + 1) * wh}H${W}`),
    ...Array.from({ length: nw - 1 }, (_, k) => `M${(k + 1) * ww} 0V${H}`),
  ].join("")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what one token attends to · 4K latent frame, 136 x 240 tokens</span>
        <span className="text-muted-foreground/60">from wan_video_dit.py</span>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t, k) => (
            <button
              key={t.name}
              type="button"
              aria-pressed={type === k}
              onClick={() => setType(k)}
              className="cursor-pointer rounded-md border px-2 py-1 text-left font-mono text-[10px] leading-4 transition-colors"
              style={type === k ? { background: CLOSE, color: "oklch(0.15 0 0)", borderColor: CLOSE } : undefined}
            >
              type {k}
              <br />
              <span className={type === k ? "" : "text-muted-foreground"}>{t.name}</span>
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-crosshair touch-none rounded border bg-muted/20"
          shapeRendering="crispEdges"
          onPointerDown={pick}
          onPointerMove={(e) => (e.buttons ? pick(e) : undefined)}
          role="img"
          aria-label={`Layer type ${type}: the query token at row ${qh}, column ${qw} attends to a close window of ${wt} by ${wh} by ${ww} tokens and a remote window of the same size spread across the frame.`}
        >
          {grid ? <path d={grid} stroke="currentColor" strokeWidth={0.25} className="text-border" /> : null}
          {showClose ? <rect x={cw0} y={ch0} width={ww} height={wh} fill={CLOSE} opacity={0.55} /> : null}
          {showRemote ? <path d={remotePath} fill={REMOTE} opacity={same ? 0.35 : 0.9} /> : null}
          <rect x={qw - 1.5} y={qh - 1.5} width={4} height={4} fill="none" stroke="currentColor" strokeWidth={0.8} className="text-foreground" />
        </svg>

        <div className="font-mono text-[10px] text-muted-foreground">latent frames in each window (query frame {qt})</div>
        <div className="flex gap-0.5">
          {Array.from({ length: T }, (_, t) => {
            const inC = showClose && ct.includes(t)
            const inR = showRemote && rt.includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => setQ([t, qh, qw])}
                aria-label={`latent frame ${t}`}
                className="h-5 flex-1 cursor-pointer rounded-sm border"
                style={{
                  background: inC && inR ? `linear-gradient(${CLOSE} 50%, ${REMOTE} 50%)` : inC ? CLOSE : inR ? REMOTE : undefined,
                  outline: t === qt ? "1.5px solid currentColor" : undefined,
                }}
              />
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
          {(["both", "close", "remote"] as const).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={branch === b}
              onClick={() => setBranch(b)}
              className="cursor-pointer rounded-md border px-2 py-0.5"
              style={branch === b ? { borderColor: "currentColor" } : undefined}
            >
              {b}
            </button>
          ))}
          <span className="ml-1">
            <span style={{ color: CLOSE }}>close</span> {wt} x {wh} x {ww} · <span style={{ color: REMOTE }}>remote</span>{" "}
            stride {nt} x {nh} x {nw} · {lb.toLocaleString("en-US")} tokens per window · layers {TYPES[type].layers}
          </span>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {same ? (
            <>
              In this layer type the window is one whole latent frame, and the two branches gather exactly the same
              32,640 tokens. The code still runs attention twice and averages two identical results.
            </>
          ) : (
            <>
              The <span style={{ color: CLOSE }}>close</span>{" "}branch sees a solid block around the query. The{" "}
              <span style={{ color: REMOTE }}>remote</span>{" "}branch sees the same number of tokens, one every {nh} rows and{" "}
              {nw} columns, so it spans the whole frame at low density. Both use the same Q, K and V projections, and
              their outputs are averaged. Click or drag on the frame to move the query.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
