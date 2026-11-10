"use client"

import { useState } from "react"
import { mexp, mlog } from "@/lib/dmath"

// rea-video's fusion of the offline tools' opinion with an image reader's (a
// VLM or the agent itself), from rea_video/classify.py: each label's score is a
// weighted log-linear pool,
//   exp(DET_WEIGHT[label] * 0.6 * log(det + 1e-4) + 0.7 * log(vlm + 1e-3)),
// then normalised. This widget shows that pool for two labels at a time. The
// real fuse() runs it twice (first over groups, then inside the winning group),
// applies hard temporal constraints and a two-of-three majority clamp; those
// are left out here, so read it as the shape of the weighting, not as the tool.

const VLM_WEIGHT = 0.7
const PAIRS = [
  { id: "live-ai", a: "live action", b: "AI video", wa: 0.6, wb: 0.6, note: "Equal weights of 0.6: the tools' probability enters with exponent 0.36, the reader's with 0.7, so on this question the reader leads. Tools at 80 % live action and a reader at 15 % fuse to 67 % AI video; tools at 5 % and a reader at 90 % fuse to 62 % live action." },
  { id: "code-3d", a: "code render", b: "3D render", wa: 1.0, wb: 0.5, note: "Code render weighs 1.0, 3D 0.5. A larger weight is a sharper exponent, so the tools' no to that label counts for more: tools at 5 % code render and a reader at 90 % fuse to 44 %, and 3D keeps it." },
  { id: "hold-ai", a: "static hold", b: "AI video", wa: 1.6, wb: 0.6, note: "Static hold weighs 1.6, the most. Tools at 5 % static hold and a reader at 90 % fuse to 21 %: the tools' veto stands. The real fuse() adds a hard rule on top: a shot measured as frozen multiplies every moving label by 0.05." },
]

function pool(det: number, vlm: number, w: number) {
  return mexp(w * 0.6 * mlog(det + 1e-4) + VLM_WEIGHT * mlog(vlm + 1e-3))
}

export function FusionPool() {
  const [pid, setPid] = useState("live-ai")
  const [det, setDet] = useState(5)
  const [vlm, setVlm] = useState(90)
  const p = PAIRS.find((q) => q.id === pid) ?? PAIRS[0]
  const da = det / 100
  const va = vlm / 100
  const sa = pool(da, va, p.wa)
  const sb = pool(1 - da, 1 - va, p.wb)
  const fa = sa / (sa + sb)
  const winner = fa >= 0.5 ? p.a : p.b

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>who wins when the tools and the image reader disagree</span>
        <span className="text-muted-foreground/50">from classify.py · simplified</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2 font-mono text-xs" role="group" aria-label="label pair">
          {PAIRS.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setPid(q.id)}
              aria-pressed={q.id === pid}
              className={`rounded-md border px-3 py-1.5 ${q.id === pid ? "border-foreground bg-muted/40" : "text-muted-foreground"}`}
            >
              {q.a} vs {q.b}
            </button>
          ))}
        </div>
        <div className="grid gap-2 font-mono text-xs sm:grid-cols-2">
          <Slider label={`tools: P(${p.a})`} value={det} set={setDet} />
          <Slider label={`image reader: P(${p.a})`} value={vlm} set={setVlm} />
        </div>
        <div className="space-y-1.5 font-mono text-xs">
          <Bar label="tools" v={da} a={p.a} b={p.b} />
          <Bar label="reader" v={va} a={p.a} b={p.b} />
          <Bar label="fused" v={fa} a={p.a} b={p.b} strong />
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <Cell k={`weight on ${p.a}`} v={`${p.wa} × 0.6 = ${(p.wa * 0.6).toFixed(2)}`} />
          <Cell k={`weight on ${p.b}`} v={`${p.wb} × 0.6 = ${(p.wb * 0.6).toFixed(2)}`} />
          <Cell k="reader weight" v={`${VLM_WEIGHT}`} />
          <Cell k="fused call" v={`${winner} ${(Math.max(fa, 1 - fa) * 100).toFixed(0)} %`} />
        </div>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          {p.note} The repo says 0.7 was chosen after a first real-Gemini run, where a weight of 1.0 let a confident, wrong reader override frame-rate and transcode evidence on AI videos.
        </p>
      </div>
    </figure>
  )
}

function Bar({ label, v, a, b, strong }: { label: string; v: number; a: string; b: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      <div className="relative h-5 flex-1 overflow-hidden rounded border">
        <div className="absolute inset-y-0 left-0" style={{ width: `${v * 100}%`, background: strong ? "oklch(0.62 0.17 250)" : "oklch(0.62 0.17 250 / 0.45)" }} />
        <span className="absolute inset-y-0 left-1.5 flex items-center text-[10px]">{a} {(v * 100).toFixed(0)} %</span>
        <span className="absolute inset-y-0 right-1.5 flex items-center text-[10px] text-muted-foreground">{b} {((1 - v) * 100).toFixed(0)} %</span>
      </div>
    </div>
  )
}

function Slider({ label, value, set }: { label: string; value: number; set: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1 rounded-md border px-3 py-2">
      <span className="text-muted-foreground">
        {label}: <span className="text-foreground">{value} %</span>
      </span>
      <input type="range" min={1} max={99} step={1} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
    </label>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-base">{v}</div>
    </div>
  )
}
