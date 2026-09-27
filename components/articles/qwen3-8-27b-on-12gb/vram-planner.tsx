"use client"

import { useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"

// A VRAM budget for Qwen3.8-27B on one card, from the model's own numbers.
//
// Weights on the GPU are summed from the GGUF tensor-info blocks (Mirai S,
// ternary PTQ1_0) or from the parameter count (BF16) or the file size (Q4_K_M,
// the unsloth UD-Q4_K_M file minus its embedding and its MTP block). In every
// llama.cpp build the token embedding is a CPU lookup, so it is left out.
//
// KV cache: only the 16 full-attention layers of 64 keep one. Per token that is
// 2 (K, V) x 16 layers x 4 KV heads x 256 dims = 32,768 numbers: 65,536 bytes at
// f16, 34,816 at q8_0 (34 bytes per 32), 18,432 at q4_0 (18 bytes per 32). The
// MTP block adds one more attention layer, so x 17/16 with the head on.
//
// DeltaNet state: the other 48 layers keep a fixed recurrent state per sequence,
// 48 heads x 128 x 128 fp32 plus a 3 x 10,240 fp32 conv tail = 156,893,184 bytes
// per server slot, whatever the context.
//
// Runtime (compute buffers, the CUDA context, the f16 scratch flash attention
// uses on a quantized cache) is not in any file. It is a least-squares fit to
// nine reported nvidia-smi peaks: 0.52 GiB + 0.51 GiB per 100K tokens of
// context + 0.57 GiB with the MTP head, within 0.17 GiB of every one of them.
// Reported peaks are read as GiB, which is what nvidia-smi prints.
//
// Only + - x / below, so server and client render the same bytes.

const GIB = 1073741824
const STATE = 156893184
const RT_BASE = 0.52 * GIB
const RT_PER_TOKEN = (0.51 * GIB) / 100000
const RT_MTP = 0.57 * GIB
const MAX_CTX = 262144

type FormatId = "bf16" | "q4km" | "mirai" | "ternary"
type KvId = "f16" | "q8_0" | "q4_0"

const FORMATS: {
  id: FormatId
  name: string
  sub: string
  weights: number
  mtp: number
  source: string
}[] = [
  {
    id: "bf16",
    name: "BF16",
    sub: "16 bpw",
    weights: 51249200128,
    mtp: 849398784,
    source: "25,624,600,064 parameters x 2 bytes (measured)",
  },
  {
    id: "q4km",
    name: "Q4_K_M",
    sub: "unsloth UD",
    weights: 15398269856,
    mtp: 351008768,
    source: "16.46 GB file minus embedding and MTP block (reasoned)",
  },
  {
    id: "mirai",
    name: "Mirai S",
    sub: "2.5 bpw tapes",
    weights: 8168211788,
    mtp: 451319808,
    source: "GGUF header: trellis tapes, 3-bit head, scales (measured)",
  },
  {
    id: "ternary",
    name: "Ternary",
    sub: "PTQ1_0, 1.75 bpw",
    weights: 5657409536,
    mtp: 1066170368,
    source: "GGUF header: PTQ1_0 trunk and head, bf16 gates (measured)",
  },
]

const KVS: { id: KvId; bytes: number }[] = [
  { id: "f16", bytes: 65536 },
  { id: "q8_0", bytes: 34816 },
  { id: "q4_0", bytes: 18432 },
]

const CTX = [8192, 16384, 32768, 65536, 73728, 98304, 131072, 163840, 196608, 262144]
const CARDS = [8, 12, 16, 24]

type Setup = { fmt: FormatId; kv: KvId; ci: number; mtp: boolean; slots: number }

const PRESETS: (Setup & { id: string; label: string; reported: number; who: string })[] = [
  {
    id: "s128",
    label: "Mirai S · q4_0 · 128K",
    fmt: "mirai",
    kv: "q4_0",
    ci: 6,
    mtp: false,
    slots: 1,
    reported: 11.3,
    who: "fork README, RTX 3090",
  },
  {
    id: "s74",
    label: "Mirai S · q8_0 · 74K",
    fmt: "mirai",
    kv: "q8_0",
    ci: 4,
    mtp: false,
    slots: 1,
    reported: 11.1,
    who: "fork README, RTX 3090",
  },
  {
    id: "s128np",
    label: "Mirai S · 128K · 4 slots",
    fmt: "mirai",
    kv: "q4_0",
    ci: 6,
    mtp: false,
    slots: 4,
    reported: 11.7,
    who: "fork README, default -np",
  },
  {
    id: "smtp",
    label: "Mirai S · q8_0 · 128K · MTP",
    fmt: "mirai",
    kv: "q8_0",
    ci: 6,
    mtp: true,
    slots: 1,
    reported: 14.6,
    who: "fork README, 16 GB setup",
  },
  {
    id: "t262",
    label: "Ternary · q4_0 · 262K",
    fmt: "ternary",
    kv: "q4_0",
    ci: 9,
    mtp: false,
    slots: 1,
    reported: 11.7,
    who: "bonsai2-small-gpu, RTX 3060",
  },
  {
    id: "tmtp",
    label: "Ternary · 128K · MTP",
    fmt: "ternary",
    kv: "q4_0",
    ci: 6,
    mtp: true,
    slots: 1,
    reported: 10638 / 1024,
    who: "model card, RTX 3060",
  },
]

const C_W = "oklch(0.58 0.15 265)"
const C_MTP = "oklch(0.74 0.10 265)"
const C_KV = "oklch(0.66 0.14 160)"
const C_ST = "oklch(0.70 0.13 60)"
const C_RT = "oklch(0.62 0.02 260)"
const C_LINE = "oklch(0.62 0.20 25)"

function budget(s: Setup) {
  const f = FORMATS.find((x) => x.id === s.fmt) ?? FORMATS[2]
  const kvBytes = (KVS.find((x) => x.id === s.kv) ?? KVS[2]).bytes
  const kvFactor = s.mtp ? 17 / 16 : 1
  const ctx = CTX[s.ci]
  const weights = f.weights
  const mtp = s.mtp ? f.mtp : 0
  const kv = ctx * kvBytes * kvFactor
  const state = s.slots * STATE
  const runtime = RT_BASE + ctx * RT_PER_TOKEN + (s.mtp ? RT_MTP : 0)
  const total = weights + mtp + kv + state + runtime
  const fixed = weights + mtp + state + RT_BASE + (s.mtp ? RT_MTP : 0)
  const perToken = kvBytes * kvFactor + RT_PER_TOKEN
  return { f, ctx, weights, mtp, kv, state, runtime, total, fixed, perToken }
}

const gib = (b: number) => b / GIB
const fmtTokens = (n: number) => (Math.round(n / 1000) * 1000).toLocaleString("en-US")

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors " +
        (active
          ? "border-foreground/40 bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:bg-muted/40")
      }
    >
      {children}
    </button>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-14 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

// chart geometry
const W = 640
const H = 300
const L = 44
const R = 16
const T = 16
const CH = 170 // chart height
const BAR_Y = 232
const BAR_H = 26

export function VramPlanner() {
  const [s, setS] = useState<Setup>({ fmt: "mirai", kv: "q4_0", ci: 6, mtp: false, slots: 1 })
  const [card, setCard] = useState(12)
  const [preset, setPreset] = useState<string | null>("s128")

  const set = (patch: Partial<Setup>) => {
    setS((prev) => ({ ...prev, ...patch }))
    setPreset(null)
  }

  const b = budget(s)
  const yMax = Math.max(16, card + 4)
  const xOf = (ctx: number) => L + ((W - L - R) * ctx) / MAX_CTX
  const yOf = (g: number) => T + CH - (CH * Math.min(g, yMax)) / yMax
  const cardBytes = card * GIB
  const ctxFit = (cardBytes - b.fixed) / b.perToken
  const fitText =
    ctxFit < 0
      ? `does not fit a ${card} GiB card at any context`
      : ctxFit >= MAX_CTX
        ? `the full 262K window fits a ${card} GiB card`
        : `fits a ${card} GiB card up to about ${fmtTokens(ctxFit)} tokens`

  const lines = KVS.map((k) => {
    const sk = budget({ ...s, kv: k.id })
    const g0 = gib(sk.fixed)
    const g1 = gib(sk.fixed + MAX_CTX * sk.perToken)
    return { k, g0, g1 }
  })

  const activePreset = PRESETS.find((p) => p.id === preset)
  const segs = [
    { key: "w", label: `weights ${gib(b.weights).toFixed(2)}`, v: b.weights, c: C_W },
    { key: "m", label: s.mtp ? `MTP ${gib(b.mtp).toFixed(2)}` : "MTP off", v: b.mtp, c: C_MTP },
    { key: "k", label: `KV ${gib(b.kv).toFixed(2)}`, v: b.kv, c: C_KV },
    { key: "s", label: `state ${gib(b.state).toFixed(2)}`, v: b.state, c: C_ST },
    { key: "r", label: `runtime ${gib(b.runtime).toFixed(2)}`, v: b.runtime, c: C_RT },
  ]
  const barScale = (W - L - R) / (yMax * GIB)
  let bx = L
  const over = b.total > yMax * GIB

  const ticks: number[] = []
  for (let g = 0; g <= yMax; g += 4) ticks.push(g)
  const xticks = [0, 65536, 131072, 196608, 262144]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Qwen3.8-27B on one card: weights + KV cache + DeltaNet state + runtime
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          GiB · bytes from headers and config · runtime fitted
        </span>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        <Row label="format">
          {FORMATS.map((f) => (
            <Pill key={f.id} active={s.fmt === f.id} onClick={() => set({ fmt: f.id })}>
              {f.name} <span className="opacity-60">{f.sub}</span>
            </Pill>
          ))}
        </Row>
        <Row label="KV">
          {KVS.map((k) => (
            <Pill key={k.id} active={s.kv === k.id} onClick={() => set({ kv: k.id })}>
              {k.id} <span className="opacity-60">{(k.bytes / 1024).toFixed(k.id === "f16" ? 0 : 1)} KiB/tok</span>
            </Pill>
          ))}
        </Row>
        <Row label="MTP">
          <Pill active={!s.mtp} onClick={() => set({ mtp: false })}>
            off
          </Pill>
          <Pill active={s.mtp} onClick={() => set({ mtp: true })}>
            draft head on
          </Pill>
          <span className="ml-2 mr-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            slots
          </span>
          {[1, 4].map((n) => (
            <Pill key={n} active={s.slots === n} onClick={() => set({ slots: n })}>
              -np {n}
            </Pill>
          ))}
        </Row>
        <Row label="card">
          {CARDS.map((c) => (
            <Pill key={c} active={card === c} onClick={() => setCard(c)}>
              {c} GiB
            </Pill>
          ))}
        </Row>
        <div className="flex items-center gap-3">
          <span className="w-14 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            context
          </span>
          <Range
            min={0}
            max={CTX.length - 1}
            step={1}
            value={s.ci}
            onChange={(e) => set({ ci: Number(e.target.value) })}
            accent={C_KV}
            className="flex-1"
            aria-label="context length"
          />
          <span className="w-24 text-right font-mono text-[11px] tabular-nums">
            {b.ctx.toLocaleString("en-US")}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${b.f.name}, ${s.kv} cache, ${b.ctx} tokens${s.mtp ? ", MTP on" : ""}: ${gib(b.total).toFixed(2)} GiB. It ${fitText}.`}
        >
          {/* grid */}
          {ticks.map((g) => (
            <g key={g}>
              <line x1={L} x2={W - R} y1={yOf(g)} y2={yOf(g)} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 6} y={yOf(g) + 3} textAnchor="end" fontSize={10} fill="var(--muted-foreground)" className="font-mono">
                {g}
              </text>
            </g>
          ))}
          {xticks.map((x) => (
            <text key={x} x={xOf(x)} y={T + CH + 14} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)" className="font-mono">
              {x === 0 ? "0" : `${x / 1024}K`}
            </text>
          ))}
          <text x={L} y={T - 4} fontSize={10} fill="var(--muted-foreground)" className="font-mono">
            GiB
          </text>

          {/* the card */}
          <line x1={L} x2={W - R} y1={yOf(card)} y2={yOf(card)} stroke={C_LINE} strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - R} y={yOf(card) - 5} textAnchor="end" fontSize={10.5} fill={C_LINE} className="font-mono">
            {card} GiB card
          </text>

          {/* total vs context, one line per KV type */}
          {lines.map(({ k, g0, g1 }) => {
            const active = k.id === s.kv
            if (g0 >= yMax) return null
            // clip the line where it leaves the chart
            const x1 = xOf(0)
            const y1 = yOf(g0)
            let x2 = xOf(MAX_CTX)
            let y2 = yOf(g1)
            if (g1 > yMax) {
              const frac = (yMax - g0) / (g1 - g0)
              x2 = xOf(MAX_CTX * frac)
              y2 = yOf(yMax)
            }
            return (
              <g key={k.id} opacity={active ? 1 : 0.35}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C_KV} strokeWidth={active ? 2.2 : 1.2} />
                <text
                  x={Math.min(x2, W - R - 4)}
                  y={y2 - 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--muted-foreground)"
                  className="font-mono"
                >
                  {k.id}
                </text>
              </g>
            )
          })}

          {/* crossing with the card line */}
          {ctxFit > 0 && ctxFit < MAX_CTX && (
            <g>
              <line x1={xOf(ctxFit)} x2={xOf(ctxFit)} y1={yOf(card)} y2={T + CH} stroke={C_LINE} strokeWidth={1} opacity={0.5} />
              <circle cx={xOf(ctxFit)} cy={yOf(card)} r={3.5} fill={C_LINE} />
            </g>
          )}

          {/* the selected point */}
          {gib(b.total) <= yMax ? (
            <circle cx={xOf(b.ctx)} cy={yOf(gib(b.total))} r={5} fill="var(--background)" stroke={C_KV} strokeWidth={2} />
          ) : (
            <text x={xOf(b.ctx)} y={T + 10} textAnchor="middle" fontSize={11} fill={C_LINE} className="font-mono">
              ▲ {gib(b.total).toFixed(1)}
            </text>
          )}
          {activePreset && (
            <g>
              <path
                d={`M ${xOf(b.ctx) - 5} ${yOf(activePreset.reported)} L ${xOf(b.ctx) + 5} ${yOf(activePreset.reported)}`}
                stroke="var(--foreground)"
                strokeWidth={2}
              />
              <text
                x={xOf(b.ctx) + (b.ctx > 200000 ? -9 : 9)}
                y={yOf(activePreset.reported) - 9}
                textAnchor={b.ctx > 200000 ? "end" : "start"}
                fontSize={10}
                fill="var(--foreground)"
                className="font-mono"
              >
                reported {activePreset.reported.toFixed(1)}
              </text>
            </g>
          )}

          {/* stacked bar at the selected context */}
          <text x={L} y={BAR_Y - 7} fontSize={10} fill="var(--muted-foreground)" className="font-mono">
            at {b.ctx.toLocaleString("en-US")} tokens: {gib(b.total).toFixed(2)} GiB
          </text>
          <rect x={L} y={BAR_Y} width={W - L - R} height={BAR_H} rx={4} fill="var(--muted)" opacity={0.35} />
          {segs.map((sg) => {
            const w = Math.max(0, Math.min(sg.v * barScale, W - R - bx))
            const r = (
              <rect key={sg.key} x={bx} y={BAR_Y} width={w} height={BAR_H} fill={sg.c}>
                <title>{`${sg.label} GiB`}</title>
              </rect>
            )
            bx += w
            return r
          })}
          <line
            x1={L + card * GIB * barScale}
            x2={L + card * GIB * barScale}
            y1={BAR_Y - 3}
            y2={BAR_Y + BAR_H + 3}
            stroke={C_LINE}
            strokeWidth={2}
          />
          {over && (
            <text x={W - R - 4} y={BAR_Y + BAR_H / 2 + 4} textAnchor="end" fontSize={11} fill="var(--background)" className="font-mono">
              off scale ▶
            </text>
          )}
          {segs.map((sg, i) => (
            <g key={sg.key} transform={`translate(${L + i * 116}, ${BAR_Y + BAR_H + 16})`}>
              <rect width={9} height={9} y={-8} rx={2} fill={sg.c} />
              <text x={13} fontSize={10} fill="var(--muted-foreground)" className="font-mono">
                {sg.label}
              </text>
            </g>
          ))}
        </svg>

        <p className="font-mono text-[11px] leading-relaxed">
          <span className="text-foreground">{fitText}</span>
          <span className="text-muted-foreground">
            {" "}
            · {b.f.source}
            {activePreset
              ? ` · reported peak ${activePreset.reported.toFixed(2)} (${activePreset.who}), model ${gib(b.total).toFixed(2)}`
              : ""}
          </span>
        </p>

        <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            reported runs
          </span>
          {PRESETS.map((p) => (
            <Pill
              key={p.id}
              active={preset === p.id}
              onClick={() => {
                setS({ fmt: p.fmt, kv: p.kv, ci: p.ci, mtp: p.mtp, slots: p.slots })
                setCard(p.reported > 12 ? 16 : 12)
                setPreset(p.id)
              }}
            >
              {p.label}
            </Pill>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Only 16 of the 64 layers keep a KV cache, so a token costs 64 KiB at f16 and 18 KiB at q4_0.
        The 48 DeltaNet layers cost 0.146 GiB per slot at any context. Weights and state are
        measured from the files; the runtime slice is a fit to the reported peaks, not a
        measurement. The ternary MTP option is the 7.0 GB file, which carries its own copy of
        the embedding.
      </figcaption>
    </figure>
  )
}
