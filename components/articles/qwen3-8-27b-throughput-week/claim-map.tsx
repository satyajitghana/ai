"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Every published Qwen3.8-27B decode figure in the article, placed by how many
// streams produced it (x) and how many tokens a second they produced together
// (y). Both axes are log scales, so "aggregate = streams x per-stream speed"
// is a family of straight diagonals: a point's diagonal is the speed one of
// its users saw. All values are the publishers' own; the per-stream column is
// the aggregate divided by the stream count, which overstates per-stream
// speed when some streams finish early (the "tail").

type Kind = "plain" | "spec" | "claim"

type Point = {
  id: string
  b: number
  v: number
  kind: Kind
  gpu: "3090" | "5090"
  short: string
  detail: string
}

const POINTS: Point[] = [
  { id: "hq1", b: 1, v: 45.6, kind: "plain", gpu: "3090", short: "HyperQwen C1", detail: "HyperQwen batch mode, one request, no speculation. Its own README puts raw single-stream decode for 16 GB of weights on a 936 GB/s card near 50 tok/s." },
  { id: "hq2", b: 2, v: 83.7, kind: "plain", gpu: "3090", short: "C2", detail: "HyperQwen batch mode, two concurrent chat requests, 1,024-token answers." },
  { id: "hq4", b: 4, v: 162.7, kind: "plain", gpu: "3090", short: "C4", detail: "HyperQwen batch mode, four concurrent requests." },
  { id: "hq8", b: 8, v: 321, kind: "plain", gpu: "3090", short: "C8", detail: "HyperQwen batch mode, eight concurrent requests: 7.0x the single stream for eight times the users." },
  { id: "hq64", b: 64, v: 1035, kind: "claim", gpu: "3090", short: "HyperQwen 1,035", detail: "The headline: 64 random 128-in / 512-out requests on one RTX 3090 at 250 W. The batch README's table says ~1,094 steady decode, the demo video 1,046 (64 x 1000 / median TPOT of 61.2 ms). Either way about 16 tok/s per user." },
  { id: "hqs", b: 1, v: 127, kind: "spec", gpu: "3090", short: "HyperQwen single 127", detail: "Single-user mode with DFlash2 speculation, one stream. The same card, 2.8x the batch-mode single stream." },
  { id: "n1", b: 1, v: 143.8, kind: "spec", gpu: "5090", short: "NInfer MTP3 C1", detail: "NInfer NVFP4 with three MTP drafts, one stream, 335-token prompt, 8,192-token answers (run NS)." },
  { id: "n2", b: 2, v: 267.6, kind: "spec", gpu: "5090", short: "C2", detail: "NInfer MTP3, two streams." },
  { id: "n4", b: 4, v: 461.1, kind: "spec", gpu: "5090", short: "C4", detail: "NInfer MTP3, four streams." },
  { id: "n8", b: 8, v: 766.6, kind: "spec", gpu: "5090", short: "C8 766.6", detail: "NInfer MTP3, eight streams: 5.33x the single stream. Almost exactly TensorFold's eight-lane figure." },
  { id: "n0", b: 1, v: 71.2, kind: "plain", gpu: "5090", short: "NInfer no drafts 71.2", detail: "NInfer NVFP4 with speculation off, one stream at about 8K context (run N0). The plain-decode floor on this card." },
  { id: "cin", b: 1, v: 450.78, kind: "spec", gpu: "5090", short: "Cinference 450.78", detail: "Cinference's September headline: one request, MTP-10, 8,192-token archive-recall prompt that accepts 93% of drafts." },
  { id: "dy1", b: 1, v: 312, kind: "spec", gpu: "5090", short: "ninfer fork 312", detail: "dylanbrodiefafard/ninfer, DFlash2, one request on its Python-package workload." },
  { id: "dy6", b: 6, v: 1057, kind: "spec", gpu: "5090", short: "fork, 6 req 1,057", detail: "The same fork, six requests. Its README counts only the intervals with all six decoding." },
  { id: "tf", b: 8, v: 764, kind: "claim", gpu: "5090", short: "TensorFold 764", detail: "Eight code lanes of one prompt: 8,859 tokens in 13.32 s, 764 tok/s decode, 665.3 end to end. Shown in the video's last line; posted as '700 tok/s'." },
  { id: "sd", b: 8, v: 1099, kind: "claim", gpu: "5090", short: "Cinference 8 lanes 1,099", detail: "satellitedown's fafstmobel on Cinference, eight lanes: 14,539 tokens in 14.70 s, 1,099 decode, 989.3 end to end." },
  { id: "sdp", b: 8, v: 1623, kind: "claim", gpu: "5090", short: "best second 1,623", detail: "The same run's fastest one-second window, all eight lanes combined. Posted as '1600tps'." },
]

const PER_LINES = [10, 25, 50, 100, 200, 400]

const W = 760
const H = 360
const PL = 56
const PR = 20
const PT = 16
const PB = 42
const PW = W - PL - PR
const PH = H - PT - PB
const XMAX = 80
const YMIN = 20
const YMAX = 2400

const COLORS: Record<Kind, string> = {
  plain: "oklch(0.55 0.16 250)",
  spec: "oklch(0.60 0.12 160)",
  claim: "oklch(0.58 0.19 28)",
}
const LABELS: Record<Kind, string> = {
  plain: "one token per step",
  spec: "speculative, one or few streams",
  claim: "this week's headlines",
}

const px = (b: number) => PL + (mlog10(b) / mlog10(XMAX)) * PW
const py = (v: number) => PT + PH - ((mlog10(v) - mlog10(YMIN)) / (mlog10(YMAX) - mlog10(YMIN))) * PH

export function ClaimMap() {
  const [sel, setSel] = useState("tf")
  const [gpu, setGpu] = useState<"all" | "3090" | "5090">("all")
  const shown = POINTS.filter((p) => gpu === "all" || p.gpu === gpu)
  const cur = POINTS.find((p) => p.id === sel) ?? POINTS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Qwen3.8-27B decode claims by concurrency · publishers&apos; figures · diagonals are per-stream speed
      </div>
      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {(["all", "3090", "5090"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGpu(g)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              g === gpu ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {g === "all" ? "both cards" : `RTX ${g}`}
          </button>
        ))}
      </div>
      <div className="px-2 pt-3 sm:px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Log-log scatter of aggregate tokens per second against concurrent streams for every Qwen3.8-27B figure in the article. Diagonal lines mark constant per-stream speed. The 64-stream HyperQwen point sits near the 16 tokens per second diagonal; the eight-lane 5090 points sit between 95 and 200 per stream; the single-stream speculative points sit at 127 to 451."
        >
          <defs>
            <clipPath id="cm-plot">
              <rect x={PL} y={PT} width={PW} height={PH} />
            </clipPath>
          </defs>
          {[30, 100, 300, 1000].map((v) => (
            <g key={v}>
              <line x1={PL} y1={py(v)} x2={PL + PW} y2={py(v)} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={PL - 8} y={py(v) + 3.5} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
                {v.toLocaleString("en-US")}
              </text>
            </g>
          ))}
          {[1, 2, 4, 8, 16, 32, 64].map((b) => (
            <text key={b} x={px(b)} y={PT + PH + 16} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              {b}
            </text>
          ))}
          <text x={PL + PW / 2} y={H - 6} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
            concurrent streams
          </text>
          <text x={14} y={PT + PH / 2} textAnchor="middle" fontSize={10} transform={`rotate(-90 14 ${PT + PH / 2})`} className="fill-muted-foreground font-mono">
            aggregate tok/s
          </text>

          <g clipPath="url(#cm-plot)">
            {PER_LINES.map((s) => (
              <g key={s}>
                <line x1={px(1)} y1={py(s)} x2={px(XMAX)} y2={py(s * XMAX)} stroke="var(--muted-foreground)" strokeOpacity={0.35} strokeDasharray="4 4" />
              </g>
            ))}
          </g>
          {PER_LINES.map((s) => {
            // label each diagonal where it leaves the top edge, or at the right edge
            const bTop = YMAX / s
            const b = Math.min(bTop * 0.8, XMAX * 0.92)
            return (
              <text key={s} x={px(b)} y={py(s * b) - 4} fontSize={9} className="fill-muted-foreground font-mono" textAnchor="middle">
                {s}/stream
              </text>
            )
          })}

          {shown.map((p) => (
            <g key={p.id} onClick={() => setSel(p.id)} className="cursor-pointer">
              <circle
                cx={px(p.b)}
                cy={py(p.v)}
                r={p.id === sel ? 7 : 5}
                fill={p.id === sel ? COLORS[p.kind] : "var(--background)"}
                stroke={COLORS[p.kind]}
                strokeWidth={2}
              />
              {p.kind === "claim" || p.id === sel ? (
                <text
                  x={px(p.b) + (p.b >= 32 ? -10 : 10)}
                  y={py(p.v) + 4}
                  textAnchor={p.b >= 32 ? "end" : "start"}
                  fontSize={10}
                  className="fill-foreground font-mono"
                >
                  {p.short}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2 font-mono text-[11px] text-muted-foreground">
        {(Object.keys(LABELS) as Kind[]).map((k) => (
          <span key={k}>
            <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COLORS[k] }} />
            {LABELS[k]}
          </span>
        ))}
      </div>
      <div className="border-t px-4 py-3 text-sm">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs">
          <span className="font-medium">
            RTX {cur.gpu} · {cur.short}
          </span>
          <span className="text-muted-foreground">
            {cur.v.toLocaleString("en-US")} tok/s over {cur.b} {cur.b === 1 ? "stream" : "streams"} ={" "}
            <span className="text-foreground">{(cur.v / cur.b).toFixed(1)}</span> per stream
          </span>
        </div>
        <p className="text-muted-foreground">{cur.detail}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {POINTS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSel(p.id)}
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[10px]",
                p.id === sel ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {p.gpu} {p.short}
            </button>
          ))}
        </div>
      </div>
    </figure>
  )
}
