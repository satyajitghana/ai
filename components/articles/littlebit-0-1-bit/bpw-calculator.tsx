"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Bits-per-weight arithmetic for a LittleBit layer, from the released code:
//
//   rank rule   quantization/modules/littlebit.py:55-85
//               residual:  r = (ab*b_target - 32(a+b)) / (2(a+b+16)), floored to a multiple of 8
//               one path:  r = (ab*b_target - 16(a+b)) / (a+b+16),   floored to a multiple of 8
//   bit count   quantization/modules/littlebit.py:88-97 (= paper Appendix D, Eq. 16)
//               residual:  2r(a+b+16) + 32(a+b)      one path:  r(a+b+16) + 16(a+b)
//
// a = d_in, b = d_out. Each path stores two sign matrices (1 bit per entry) and three FP16
// vectors h (d_out), g (d_in) and l (r). The embedding and lm_head are left in FP16, as in the
// paper (Table 3 caption) and the code (quant_util.py: exclude_names=["lm_head"]; the embedding
// is an nn.Embedding, not an nn.Linear, so it is never patched).
//
// "As the released loader holds it": quant_util.py:251-253 unpacks the sign bits into a dense
// tensor of the model dtype (bf16), so U and V cost 16 bits per entry in memory.

type Shape = { name: string; dOut: number; dIn: number }
type Model = {
  label: string
  layers: number
  hidden: number
  vocab: number
  shapes: Shape[]
}

const MODELS: Record<string, Model> = {
  l7: {
    label: "Llama2-7B",
    layers: 32,
    hidden: 4096,
    vocab: 32000,
    shapes: [
      { name: "q_proj", dOut: 4096, dIn: 4096 },
      { name: "k_proj", dOut: 4096, dIn: 4096 },
      { name: "v_proj", dOut: 4096, dIn: 4096 },
      { name: "o_proj", dOut: 4096, dIn: 4096 },
      { name: "gate_proj", dOut: 11008, dIn: 4096 },
      { name: "up_proj", dOut: 11008, dIn: 4096 },
      { name: "down_proj", dOut: 4096, dIn: 11008 },
    ],
  },
  l13: {
    label: "Llama2-13B",
    layers: 40,
    hidden: 5120,
    vocab: 32000,
    shapes: [
      { name: "q_proj", dOut: 5120, dIn: 5120 },
      { name: "k_proj", dOut: 5120, dIn: 5120 },
      { name: "v_proj", dOut: 5120, dIn: 5120 },
      { name: "o_proj", dOut: 5120, dIn: 5120 },
      { name: "gate_proj", dOut: 13824, dIn: 5120 },
      { name: "up_proj", dOut: 13824, dIn: 5120 },
      { name: "down_proj", dOut: 5120, dIn: 13824 },
    ],
  },
  l70: {
    label: "Llama2-70B",
    layers: 80,
    hidden: 8192,
    vocab: 32000,
    shapes: [
      { name: "q_proj", dOut: 8192, dIn: 8192 },
      { name: "k_proj", dOut: 1024, dIn: 8192 },
      { name: "v_proj", dOut: 1024, dIn: 8192 },
      { name: "o_proj", dOut: 8192, dIn: 8192 },
      { name: "gate_proj", dOut: 28672, dIn: 8192 },
      { name: "up_proj", dOut: 28672, dIn: 8192 },
      { name: "down_proj", dOut: 8192, dIn: 28672 },
    ],
  },
}

function rankFor(a: number, b: number, target: number, residual: boolean, scales: boolean): number {
  let x: number
  if (scales) {
    x = residual ? (a * b * target - 32 * (a + b)) / (2 * (a + b + 16)) : (a * b * target - 16 * (a + b)) / (a + b + 16)
  } else {
    x = (a * b * target) / ((residual ? 2 : 1) * (a + b))
  }
  const r = Math.floor(Math.floor(x) / 8) * 8
  return Math.max(r, 8)
}

type Row = Shape & { r: number; signBits: number; scaleBits: number; params: number }

function layerRows(m: Model, target: number, residual: boolean, scales: boolean): Row[] {
  const paths = residual ? 2 : 1
  return m.shapes.map((s) => {
    const r = rankFor(s.dIn, s.dOut, target, residual, scales)
    const signBits = paths * r * (s.dIn + s.dOut)
    const scaleBits = scales ? paths * 16 * (s.dIn + s.dOut + r) : 0
    return { ...s, r, signBits, scaleBits, params: s.dIn * s.dOut }
  })
}

const GB = 8e9 // bits per (decimal) gigabyte

const fmtGB = (bits: number) => {
  const g = bits / GB
  return g >= 10 ? g.toFixed(1) : g >= 1 ? g.toFixed(2) : g.toFixed(3)
}

export function BpwCalculator() {
  const [modelKey, setModelKey] = useState<keyof typeof MODELS>("l7")
  const [target, setTarget] = useState(0.1)
  const [residual, setResidual] = useState(true)
  const [scales, setScales] = useState(true)
  const [view, setView] = useState<"disk" | "loader">("disk")
  const [focus, setFocus] = useState(0)

  const m = MODELS[modelKey]
  const rows = useMemo(() => layerRows(m, target, residual, scales), [m, target, residual, scales])

  const linParams = rows.reduce((s, r) => s + r.params, 0) * m.layers
  const diskBits = rows.reduce((s, r) => s + r.signBits + r.scaleBits, 0) * m.layers
  // in memory with the released loader the signs sit in bf16: 16 bits per entry
  const loaderBits = rows.reduce((s, r) => s + r.signBits * 16 + r.scaleBits, 0) * m.layers
  const linBits = view === "disk" ? diskBits : loaderBits
  const linBpw = linBits / linParams
  const embBits = 2 * m.vocab * m.hidden * 16
  const normBits = (2 * m.layers + 1) * m.hidden * 16
  const fp16Bits = linParams * 16 + embBits + normBits
  const totalBits = linBits + embBits + normBits

  const cmp = [
    { key: "fp16", label: "FP16", bpw: 16 },
    { key: "q4", label: "4-bit (no group scales)", bpw: 4 },
    { key: "tern", label: "ternary, 1.58 bit", bpw: 1.58 },
    { key: "bin", label: "1-bit signs", bpw: 1 },
  ].map((c) => ({ ...c, bits: linParams * c.bpw + embBits + normBits, lin: linParams * c.bpw }))
  const bars = [...cmp, { key: "lb", label: `LittleBit, ${linBpw.toFixed(3)} bit`, bpw: linBpw, bits: totalBits, lin: linBits }]

  const sel = rows[Math.min(focus, rows.length - 1)]
  const selBpw = (sel.signBits + sel.scaleBits) / sel.params
  const selLoader = (sel.signBits * 16 + sel.scaleBits) / sel.params

  // log axis for the size bars: 0.1 GB .. 200 GB
  const W = 640
  const x0 = 170
  const x1 = W - 70
  const lo = -1
  const hi = mlog10(200)
  const X = (gb: number) => x0 + ((mlog10(Math.max(gb, 0.1)) - lo) / (hi - lo)) * (x1 - x0)
  const ticks = [0.1, 1, 10, 100]
  const barH = 22
  const H = 26 + bars.length * (barH + 8) + 18

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">bits per weight, the way littlebit.py counts them</span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {m.label} · linear layers {linBpw.toFixed(3)} bit · {fmtGB(totalBits)} GB total
        </span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(MODELS).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setModelKey(k)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30",
                k === modelKey && "bg-muted/40 text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>target bits per weight</span>
            <span className="tabular-nums text-foreground">{target.toFixed(2)}</span>
          </span>
          <Range min={0.05} max={1} step={0.05} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        </label>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setResidual(!residual)}
            className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px] hover:bg-muted/30", residual && "bg-muted/40")}
          >
            residual path: {residual ? "on (two paths)" : "off (one path)"}
          </button>
          <button
            type="button"
            onClick={() => setScales(!scales)}
            className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px] hover:bg-muted/30", scales && "bg-muted/40")}
          >
            FP16 scales h, g, l: {scales ? "counted" : "free (ignored)"}
          </button>
          <button
            type="button"
            onClick={() => setView(view === "disk" ? "loader" : "disk")}
            className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px] hover:bg-muted/30", view === "loader" && "bg-muted/40")}
          >
            {view === "disk" ? "on disk: signs packed 32 per word" : "in memory: released loader, signs as bf16"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse font-mono text-[11px] tabular-nums">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">layer</th>
                <th className="py-1 pr-2 font-normal">d_out x d_in</th>
                <th className="py-1 pr-2 text-right font-normal">rank r</th>
                <th className="py-1 pr-2 text-right font-normal">sign bits</th>
                <th className="py-1 pr-2 text-right font-normal">scale bits</th>
                <th className="py-1 text-right font-normal">bits/weight</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const bpw = (view === "disk" ? r.signBits + r.scaleBits : r.signBits * 16 + r.scaleBits) / r.params
                return (
                  <tr
                    key={r.name}
                    onClick={() => setFocus(i)}
                    className={cn("cursor-pointer border-b border-border/40 hover:bg-muted/20", i === focus && "bg-muted/30")}
                  >
                    <td className="py-1 pr-2">{r.name}</td>
                    <td className="py-1 pr-2">
                      {r.dOut.toLocaleString("en-US")} x {r.dIn.toLocaleString("en-US")}
                    </td>
                    <td className="py-1 pr-2 text-right">{residual ? `2 x ${r.r}` : r.r}</td>
                    <td className="py-1 pr-2 text-right">{r.signBits.toLocaleString("en-US")}</td>
                    <td className="py-1 pr-2 text-right">{r.scaleBits.toLocaleString("en-US")}</td>
                    <td className="py-1 text-right">{bpw.toFixed(4)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-mono text-foreground">{sel.name}</span>: {residual ? "two paths" : "one path"} of rank {sel.r}.
          Signs are {sel.signBits.toLocaleString("en-US")} bits, the FP16 scale vectors {sel.scaleBits.toLocaleString("en-US")}{" "}
          ({sel.signBits + sel.scaleBits > 0 ? ((100 * sel.scaleBits) / (sel.signBits + sel.scaleBits)).toFixed(1) : "0"}% of the
          layer), against {sel.params.toLocaleString("en-US")} original weights: {selBpw.toFixed(4)} bits each on disk,{" "}
          {selLoader.toFixed(2)} once the released loader has unpacked the signs into bf16.
        </p>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Model size on a log scale for ${m.label}: FP16, 4-bit, ternary, 1-bit and LittleBit at ${linBpw.toFixed(3)} bits per weight, each with the embedding and lm_head kept in FP16.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={X(t)} y1={14} x2={X(t)} y2={H - 16} stroke="var(--border)" strokeDasharray="2 3" />
              <text x={X(t)} y={H - 4} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
                {t} GB
              </text>
            </g>
          ))}
          <text x={x0} y={10} className="fill-muted-foreground font-mono text-[9px]">
            whole model; darker part = linear layers, lighter = FP16 embedding + lm_head + norms
          </text>
          {bars.map((b, i) => {
            const y = 20 + i * (barH + 8)
            const tot = b.bits / GB
            const lin = b.lin / GB
            const isLb = b.key === "lb"
            return (
              <g key={b.key}>
                <text x={x0 - 8} y={y + barH / 2 + 4} textAnchor="end" className={cn("font-mono text-[10px]", isLb ? "fill-foreground" : "fill-muted-foreground")}>
                  {b.label}
                </text>
                <rect x={x0} y={y} width={Math.max(1, X(tot) - x0)} height={barH} rx={3} fill={isLb ? "var(--chart-1, #2563eb)" : "var(--muted-foreground)"} fillOpacity={0.25} />
                <rect x={x0} y={y} width={Math.max(1, X(Math.max(lin, 0.1)) - x0)} height={barH} rx={3} fill={isLb ? "var(--chart-1, #2563eb)" : "var(--muted-foreground)"} fillOpacity={lin < 0.1 ? 0 : 0.7} />
                <text x={X(tot) + 6} y={y + barH / 2 + 4} className="fill-foreground font-mono text-[10px] tabular-nums">
                  {fmtGB(b.bits)} GB
                </text>
              </g>
            )
          })}
        </svg>

        <p className="text-xs leading-relaxed text-muted-foreground">
          The linear layers drop from {fmtGB(linParams * 16)} GB to {fmtGB(linBits)} GB ({(16 / linBpw).toFixed(0)}x). The whole model drops
          from {fmtGB(fp16Bits)} GB to {fmtGB(totalBits)} GB ({(fp16Bits / totalBits).toFixed(1)}x), because the embedding and lm_head stay in
          FP16 and are {((100 * embBits) / totalBits).toFixed(0)}% of what is left.
        </p>
      </div>
    </figure>
  )
}
