"use client"

import { useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What a session costs in fresh-input-token equivalents, the unit of the paper's Eq. 4 and of
// tokeneconomizer/pricing.py: input 1, cache read 0.1 (0.05 on the models pricing.py lists that
// way), cache write 1.25 for the 5-minute cache or 2 for the 1-hour one, output 5 (Claude).
//
// A toy session: the first request writes the whole prefix P to the cache (a cold start); every
// later turn reads the previous request's context from the cache and writes the h new tokens the
// last turn added (tool results, the model's own output); every turn emits o output tokens.
// Removing T tokens of tool schemas takes T off every request.
//
//   cost = w*P + sum_{k=2..n} ( r*(P + (k-2)*h) + w*h ) + n*5*o
//   saving from T = w*T + r*T*(n-1)
//
// The "resume after a tool change" toggle adds the penalty the plugin's idle wait avoids: a
// conversation of H tokens resumed after its tool list changed rewrites H at w instead of
// reading it at r.

const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

const PRESETS = [
  { label: "paper's 19-tool mask", T: 26571 },
  { label: "a 2,000-token cut", T: 2000 },
]

function Btn({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
  <button
    type="button"
    aria-pressed={on}
    onClick={onClick}
    className={cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
    )}
  >
    {children}
  </button>
)
}

export function CacheBill() {
  const [P, setP] = useState(42866)
  const [T, setT] = useState(26571)
  const [n, setN] = useState(30)
  const [h, setH] = useState(1500)
  const [o, setO] = useState(300)
  const [r, setR] = useState(0.1)
  const [w, setW] = useState(1.25)
  const [resume, setResume] = useState(false)

  const Tc = Math.min(T, P - 1000)
  const cost = (p: number) => {
    let c = w * p
    for (let k = 2; k <= n; k++) c += r * (p + (k - 2) * h) + w * h
    return c + n * 5 * o
  }
  const base = cost(P)
  const after = cost(P - Tc)
  const H = P - Tc + (n - 1) * h
  const penalty = resume ? (w - r) * H : 0
  const after2 = after + penalty
  const saved = base - after2
  const pct = (saved / base) * 100
  const perToken = w + r * (n - 1)
  const reads = (() => {
    let c = 0
    for (let k = 2; k <= n; k++) c += r * (P + (k - 2) * h)
    return c
  })()

  const sliders: { label: string; v: number; set: (x: number) => void; min: number; max: number; step: number; show: string }[] = [
    { label: "first-request prefix P", v: P, set: setP, min: 10000, max: 80000, step: 500, show: `${fmt(P)} tok` },
    { label: "tool schemas removed T", v: T, set: setT, min: 0, max: 40000, step: 250, show: `${fmt(Tc)} tok` },
    { label: "turns n", v: n, set: setN, min: 2, max: 80, step: 1, show: `${n}` },
    { label: "new context per turn h", v: h, set: setH, min: 200, max: 6000, step: 100, show: `${fmt(h)} tok` },
    { label: "output per turn o", v: o, set: setO, min: 50, max: 2000, step: 50, show: `${fmt(o)} tok` },
  ]


  const bar = (v: number, cls: string) => (
    <div className="relative h-5 rounded bg-muted/40">
      <div className={cn("h-5 rounded transition-all duration-300", cls)} style={{ width: `${Math.min(100, (v / base) * 100)}%` }} />
      <span className="absolute inset-y-0 right-2 flex items-center text-foreground">{fmt(v)}</span>
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one session&apos;s bill, with the cache priced in</span>
        <span className="text-muted-foreground/60">fresh-input-token equivalents, a toy session</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid gap-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
          {sliders.map((s) => (
            <label key={s.label} className="block">
              <span className="flex justify-between">
                <span>{s.label}</span>
                <span className="text-foreground">{s.show}</span>
              </span>
              <Range aria-label={s.label} min={s.min} max={s.max} step={s.step} value={s.v} onChange={(e) => s.set(Number(e.target.value))} className="mt-1 w-full" />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <Btn key={p.label} on={T === p.T} onClick={() => setT(p.T)}>{p.label}</Btn>
          ))}
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">cache read</span>
          {[0.1, 0.05].map((x) => (
            <Btn key={x} on={r === x} onClick={() => setR(x)}>{`${x}x`}</Btn>
          ))}
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">cache write</span>
          {[1.25, 2].map((x) => (
            <Btn key={x} on={w === x} onClick={() => setW(x)}>{x === 2 ? "2x (1 h)" : "1.25x (5 min)"}</Btn>
          ))}
          <Btn on={resume} onClick={() => setResume(!resume)}>{resume ? "resumed after the tools changed" : "fresh session"}</Btn>
        </div>

        <div className="mt-4 space-y-2 font-mono text-[11px]">
          <div className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
            <span className="text-muted-foreground">all tools</span>
            {bar(base, "bg-foreground/35")}
          </div>
          <div className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
            <span className="text-muted-foreground">tools removed</span>
            {bar(after2, resume ? "bg-[oklch(0.58_0.17_25)]" : "bg-[oklch(0.55_0.13_250)]")}
          </div>
        </div>
        <div className="mt-3 grid gap-x-6 gap-y-1 font-mono text-[11px] sm:grid-cols-2">
          <div className="flex justify-between"><span className="text-muted-foreground">saved this session</span><span>{`${saved >= 0 ? "" : "+"}${fmt(Math.abs(saved))} (${pct >= 0 ? "-" : "+"}${Math.abs(pct).toFixed(1)}%)`}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">each removed token is worth</span><span>{`${perToken.toFixed(2)} fresh tokens`}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">cache reads, share of the bill</span><span>{`${((reads / base) * 100).toFixed(0)}%`}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">resume penalty</span><span>{resume ? fmt(penalty) : "none"}</span></div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          A model, not a measurement: one cold start, a constant growth per turn, no compaction and
          no cache expiry inside the session. The paper&apos;s ablation measured 13.2% and 17.7% from
          tool pruning alone on real SWE-Bench sessions, which grow unevenly and carry more output.
        </p>
      </div>
    </figure>
  )
}
