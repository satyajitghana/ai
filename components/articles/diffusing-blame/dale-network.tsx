"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Dale's principle, drawn as a small two-layer graph. In a STANDARD net a single
// weight is free to take either sign, so one source neuron fans out a mix of
// positive (excitatory) and negative (inhibitory) synapses. Under DALE'S
// PRINCIPLE each neuron is committed to one sign for ALL its outgoing synapses:
// it is purely excitatory or purely inhibitory, and the population is split into
// E and I. Toggle the two regimes; click a source neuron to isolate its fan-out
// and watch every one of its edges share a single sign.
//
// SSR-safe: deterministic render (default: Dale mode, an inhibitory neuron
// selected), state-only, no timers, no Math.random.

const EXC = "oklch(0.58 0.15 255)" // excitatory (+) — indigo accent
const INH = "oklch(0.64 0.18 30)" // inhibitory (−) — warm tint

const W = 660
const H = 340
const SX = 132 // source column x
const TX = 528 // target column x
const R = 19
const NS = 4
const NT = 4

const ys = (n: number, i: number) => 66 + i * ((H - 132) / (n - 1))

// standard-mode per-synapse sign: parity of (i + 1 + j) → each source gets a mix.
const stdSign = (i: number, j: number) => ((i + 1 + j) % 2 === 0 ? 1 : -1)
// dale-mode neuron type: even sources excitatory, odd sources inhibitory.
const daleType = (i: number) => (i % 2 === 0 ? 1 : -1)

const hcurve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

export function DaleNetwork() {
  const [dale, setDale] = useState(true)
  const [sel, setSel] = useState(1) // an inhibitory neuron by default

  const signOf = (i: number, j: number) => (dale ? daleType(i) : stdSign(i, j))
  const selType = daleType(sel)
  const plusCount = Array.from({ length: NT }, (_, j) => signOf(sel, j)).filter((s) => s > 0).length
  const minusCount = NT - plusCount

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one neuron&apos;s outgoing synapses · sign per edge</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Source neuron ${sel} fans out to four targets; in ${dale ? "Dale" : "standard"} mode its outgoing synapses are ${dale ? (selType > 0 ? "all excitatory" : "all inhibitory") : "a mix of excitatory and inhibitory"}.`}
        >
          <defs>
            <marker id="db-exc" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={EXC} strokeWidth={1.5} />
            </marker>
            <marker id="db-inh" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={INH} strokeWidth={1.5} />
            </marker>
            <filter id="db-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={SX} y={38} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
            source population
          </text>
          <text x={TX} y={38} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
            targets
          </text>

          {/* edges (drawn first, behind nodes) */}
          {Array.from({ length: NS }, (_, i) =>
            Array.from({ length: NT }, (_, j) => {
              const s = signOf(i, j)
              const on = i === sel
              const y1 = ys(NS, i)
              const y2 = ys(NT, j)
              return (
                <path
                  key={`${i}-${j}`}
                  d={hcurve(SX + R, y1, TX - R, y2)}
                  fill="none"
                  stroke={s > 0 ? EXC : INH}
                  strokeWidth={1.5}
                  opacity={on ? 0.9 : 0.1}
                  markerEnd={on ? `url(#${s > 0 ? "db-exc" : "db-inh"})` : undefined}
                  className="transition-opacity duration-300"
                />
              )
            })
          )}

          {/* source nodes (clickable) */}
          {Array.from({ length: NS }, (_, i) => {
            const t = daleType(i)
            const on = i === sel
            const c = t > 0 ? EXC : INH
            return (
              <g key={i} onClick={() => setSel(i)} className="cursor-pointer">
                <circle
                  cx={SX}
                  cy={ys(NS, i)}
                  r={R}
                  fill={dale ? c : "var(--muted)"}
                  fillOpacity={dale ? (on ? 0.9 : 0.42) : on ? 0.5 : 0.32}
                  stroke={on ? c : "var(--border)"}
                  strokeWidth={on ? 2 : 1.5}
                  filter={on ? "url(#db-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text x={SX} y={ys(NS, i) + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={on ? 700 : 500}>
                  {`S${i}`}
                </text>
                {dale ? (
                  <text x={SX - R - 8} y={ys(NS, i) + 4} textAnchor="end" className="font-mono" fontSize={13} fill={c}>
                    {t > 0 ? "+" : "−"}
                  </text>
                ) : null}
              </g>
            )
          })}

          {/* target nodes */}
          {Array.from({ length: NT }, (_, j) => (
            <g key={j}>
              <circle cx={TX} cy={ys(NT, j)} r={R} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
              <text x={TX} y={ys(NT, j) + 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11}>
                {`T${j}`}
              </text>
            </g>
          ))}
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            {([["std", "standard net"], ["dale", "Dale net"]] as const).map(([k, label]) => {
              const active = (k === "dale") === dale
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDale(k === "dale")}
                  aria-pressed={active}
                  className={cn(
                    "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                    active ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  style={active ? { background: "var(--foreground)" } : undefined}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: EXC }} /> excitatory +
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: INH }} /> inhibitory −
            </span>
          </div>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">click a source</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {dale ? (
            <>
              Under Dale&apos;s principle, neuron <span className="text-foreground">S{sel}</span> is committed:{" "}
              <span style={{ color: selType > 0 ? EXC : INH }}>{selType > 0 ? "excitatory" : "inhibitory"}</span>, so{" "}
              <span className="text-foreground">all {NT}</span> of its outgoing weights carry the same sign. The net keeps
              separate E and I populations; a unit can never send a + edge to one target and a − edge to another.
            </>
          ) : (
            <>
              In a standard net, each weight is free to take either sign. Neuron <span className="text-foreground">S{sel}</span>{" "}
              sends <span style={{ color: EXC }}>{plusCount} excitatory</span> and{" "}
              <span style={{ color: INH }}>{minusCount} inhibitory</span> synapses at once — a single unit acts with both
              signs. Biology forbids this; the sign is a property of the neuron, not the synapse.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
