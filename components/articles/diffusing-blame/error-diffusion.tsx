"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Error Diffusion vs backprop, side by side on the same little net. The forward
// pass is identical. The difference is how blame gets back to the hidden layers:
//
//  • backprop threads the error SEQUENTIALLY back through every layer, each hop
//    multiplying by the transposed forward weight Wᵀ (the "weight transport" that
//    biology can't implement).
//  • Error Diffusion BROADCASTS the output error straight to every hidden unit at
//    once — no transpose, no reverse chain — and routes it by "modulo": hidden
//    unit i takes error channel r(i) = i mod C.
//
// Step forward → diffuse → update, and flip backprop / error-diffusion.
// SSR-safe: deterministic (default forward pass, ED mode), state-only, no timers.

const FWD = "oklch(0.60 0.15 255)" // forward data flow — indigo
const ED = "oklch(0.60 0.15 165)" // the diffusing blame signal — teal
const BP = "oklch(0.64 0.19 30)" // backprop's transpose path — warm red

const W = 720
const H = 356
const C = 3 // output channels
const NU = 4 // units per hidden layer
const R = 15
const CY = 180

const IN_X = 60
const L1_X = 248
const L2_X = 440
const ERR_X = 645
const CH_X = 626 // channel-tick x inside the error node

const uy = (i: number) => 100 + i * 54 // unit y for i in 0..3  → 100,154,208,262
const cy = (c: number) => 128 + c * 52 // channel y for c in 0..2 → 128,180,232

const hcurve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

type Stage = "forward" | "diffuse" | "update"

export function ErrorDiffusion() {
  const [stage, setStage] = useState<Stage>("forward")
  const [mode, setMode] = useState<"bp" | "ed">("ed")
  const ed = mode === "ed"

  const fwdOp = stage === "forward" ? 0.9 : 0.12
  const showBlame = stage === "diffuse" || stage === "update"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>getting blame back to the hidden layers</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A two-hidden-layer net. Stage ${stage}, ${ed ? "error diffusion" : "backpropagation"} mode.`}
        >
          <defs>
            <marker id="ed-fwd" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={FWD} strokeWidth={1.5} />
            </marker>
            <marker id="ed-ed" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ED} strokeWidth={1.5} />
            </marker>
            <marker id="ed-bp" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={BP} strokeWidth={1.5} />
            </marker>
            <filter id="ed-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* column captions */}
          <text x={L1_X} y={40} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>hidden 1</text>
          <text x={L2_X} y={40} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>hidden 2</text>

          {/* forward bundled arrows (context) */}
          <path d={hcurve(IN_X + 26, CY, L1_X - R, CY)} fill="none" stroke={FWD} strokeWidth={1.8} opacity={fwdOp} markerEnd="url(#ed-fwd)" className="transition-opacity duration-300" />
          <path d={hcurve(L1_X + R, CY, L2_X - R, CY)} fill="none" stroke={FWD} strokeWidth={1.8} opacity={fwdOp} markerEnd="url(#ed-fwd)" className="transition-opacity duration-300" />
          <path d={hcurve(L2_X + R, CY, ERR_X - 24, CY)} fill="none" stroke={FWD} strokeWidth={1.8} opacity={fwdOp} markerEnd="url(#ed-fwd)" className="transition-opacity duration-300" />

          {/* blame path */}
          {showBlame && !ed && (
            <>
              {/* backprop: sequential reverse chain through Wᵀ */}
              <path d={hcurve(ERR_X - 24, CY, L2_X + R, CY)} fill="none" stroke={BP} strokeWidth={2} opacity={0.9} markerEnd="url(#ed-bp)" />
              <path d={hcurve(L2_X - R, CY, L1_X + R, CY)} fill="none" stroke={BP} strokeWidth={2} opacity={0.9} markerEnd="url(#ed-bp)" />
              <text x={(L2_X + ERR_X) / 2} y={CY - 14} textAnchor="middle" className="font-mono" fontSize={10} fill={BP}>· Wᵀ</text>
              <text x={(L1_X + L2_X) / 2} y={CY - 14} textAnchor="middle" className="font-mono" fontSize={10} fill={BP}>· Wᵀ</text>
            </>
          )}
          {showBlame && ed &&
            [L1_X, L2_X].flatMap((lx) =>
              Array.from({ length: NU }, (_, i) => {
                const c = i % C
                return (
                  <path
                    key={`${lx}-${i}`}
                    d={hcurve(CH_X - 8, cy(c), lx + R, uy(i))}
                    fill="none"
                    stroke={ED}
                    strokeWidth={1.2}
                    opacity={0.55}
                    markerEnd="url(#ed-ed)"
                  />
                )
              })
            )}

          {/* input node */}
          <rect x={IN_X - 26} y={92} width={52} height={176} rx={9} fill="var(--muted)" fillOpacity={0.5} stroke="var(--border)" strokeWidth={1.5} />
          <text x={IN_X} y={CY + 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>input</text>

          {/* hidden units */}
          {[L1_X, L2_X].flatMap((lx) =>
            Array.from({ length: NU }, (_, i) => {
              const pulse = stage === "update"
              return (
                <g key={`${lx}-${i}`}>
                  <circle
                    cx={lx}
                    cy={uy(i)}
                    r={R}
                    fill="var(--background)"
                    stroke={pulse ? ED : "var(--border)"}
                    strokeWidth={pulse ? 2.2 : 1.5}
                    filter={pulse ? "url(#ed-soft)" : undefined}
                    className="transition-all duration-300"
                  />
                  {ed ? (
                    <text x={lx} y={uy(i) + 3.5} textAnchor="middle" className="font-mono" fontSize={9} fill={showBlame ? ED : "var(--muted-foreground)"}>
                      {`c${i % C}`}
                    </text>
                  ) : (
                    <circle cx={lx} cy={uy(i)} r={3} fill="var(--muted-foreground)" opacity={0.5} />
                  )}
                </g>
              )
            })
          )}

          {/* error / output node */}
          <rect x={ERR_X - 24} y={92} width={72} height={176} rx={9} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
          <text x={ERR_X + 12} y={112} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>error S</text>
          {Array.from({ length: C }, (_, c) => (
            <g key={c}>
              <circle cx={CH_X} cy={cy(c)} r={7} fill={showBlame && ed ? ED : FWD} fillOpacity={showBlame && ed ? 0.9 : 0.35} stroke={showBlame && ed ? ED : FWD} strokeWidth={1.2} className="transition-all duration-300" />
              <text x={CH_X + 14} y={cy(c) + 3.5} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={9}>{`c${c}`}</text>
            </g>
          ))}
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">stage</span>
            {(["forward", "diffuse", "update"] as Stage[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                aria-pressed={stage === s}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  stage === s ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">rule</span>
            {([["bp", "backprop"], ["ed", "error diffusion"]] as const).map(([k, label]) => {
              const active = (k === "ed") === ed
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  aria-pressed={active}
                  className={cn(
                    "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                    active ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  style={active ? { background: k === "ed" ? ED : BP } : undefined}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {stage === "forward" ? (
            <>
              The <span style={{ color: FWD }}>forward pass</span> is the same either way: input to hidden 1 to hidden 2 to the
              output error <span className="font-mono">S</span>. Step to <span className="text-foreground">diffuse</span> to see the two rules part company.
            </>
          ) : !ed ? (
            <>
              Backprop sends blame back <span className="text-foreground">one layer at a time</span>, and every hop multiplies by{" "}
              <span style={{ color: BP }}>Wᵀ</span> — the same forward weights, transposed. That transpose is{" "}
              <span className="text-foreground">weight transport</span>: each synapse would have to read its partner&apos;s value
              backwards. No known biological synapse can do that.
            </>
          ) : (
            <>
              Error Diffusion <span style={{ color: ED }}>broadcasts</span> the output error straight to every hidden unit — no
              reverse chain, no transpose. Routing is by modulo: unit <span className="font-mono">i</span> learns from channel{" "}
              <span className="font-mono" style={{ color: ED }}>c{"(i mod C)"}</span>, so unit 3 wraps back to{" "}
              <span className="font-mono" style={{ color: ED }}>c0</span>. Every layer updates{" "}
              {stage === "update" ? <span className="text-foreground">locally, at once</span> : "in parallel"} — no signal has to
              travel through the ones above it.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
