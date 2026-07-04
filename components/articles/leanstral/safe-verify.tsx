"use client"

import { useState } from "react"
import { CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Why the reward can't be gamed. If you train an agent to make Lean say "no errors,"
// it will find the cheap shortcuts: leave a `sorry`, call `native_decide` (known to be
// unsound), sneak in an extra axiom, or crank `set_option` limits. Leanstral is graded
// by a fork of SafeVerify, which rejects all of these — full reward only for a proof
// that compiles AND uses only standard Lean axioms AND took no shortcut. Toggle the
// shortcuts and watch the candidate proof fail a gate and the verdict flip.

const OK = "oklch(0.68 0.15 150)"
const BAD = "oklch(0.63 0.2 25)"

const SHORTCUTS = [
  { key: "sorry", label: "sorry", desc: "admit the goal unproven", gate: "no admitted goals (`sorry`)" },
  { key: "native", label: "native_decide", desc: "trust compiled evaluation", gate: "no `native_decide` (unsound)" },
  { key: "axiom", label: "extra axiom", desc: "assume what you can't prove", gate: "only standard axioms (#print axioms)" },
  { key: "setopt", label: "set_option …", desc: "loosen the checker", gate: "no `set_option` escape hatches" },
] as const

type Key = (typeof SHORTCUTS)[number]["key"]

// scene geometry (viewBox units)
const W = 760
const H = 300
const PROOF = { x: 34, y: 118, w: 138, h: 64 }
const GATE = { x: 250, w: 300, h: 30, top: 30 }
const gy = (i: number) => GATE.top + i * ((252 - GATE.top) / 4)
const VER = { x: 622, y: 118, w: 116, h: 64 }

export function SafeVerify() {
  const [on, setOn] = useState<Record<Key, boolean>>({ sorry: false, native: false, axiom: false, setopt: false })
  const cheats = SHORTCUTS.filter((s) => on[s.key])
  const accepted = cheats.length === 0

  const GATES = [
    { label: "type-checks against the Lean kernel", pass: true },
    ...SHORTCUTS.map((s) => ({ label: s.gate, pass: !on[s.key] })),
  ]

  const proofRight = PROOF.x + PROOF.w
  const proofMidY = PROOF.y + PROOF.h / 2
  const verLeft = VER.x
  const verMidY = VER.y + VER.h / 2
  const vc = accepted ? OK : BAD

  const curveH = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>SafeVerify · the reward is adversarial</span>
        <span>{cheats.length ? `${cheats.length} shortcut${cheats.length > 1 ? "s" : ""} taken` : "honest proof"}</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={accepted ? "All SafeVerify gates pass — proof accepted" : `${cheats.length} gate(s) fail — proof rejected`}>
          <defs>
            <marker id="lssv-arrow-ok" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={OK} strokeWidth={1.5} />
            </marker>
            <filter id="lssv-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* proof → each gate */}
          {GATES.map((g, k) => (
            <path key={`in-${k}`} d={curveH(proofRight, proofMidY, GATE.x, gy(k) + GATE.h / 2)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} opacity={0.4} />
          ))}

          {/* each gate → verdict (green only if it passes; a failed gate breaks the path to accept) */}
          {GATES.map((g, k) => (
            <path
              key={`out-${k}`}
              d={curveH(GATE.x + GATE.w, gy(k) + GATE.h / 2, verLeft, verMidY)}
              fill="none"
              stroke={g.pass ? OK : BAD}
              strokeWidth={g.pass ? 1.5 : 1.6}
              strokeDasharray={g.pass ? undefined : "3 4"}
              markerEnd={g.pass ? "url(#lssv-arrow-ok)" : undefined}
              opacity={g.pass ? 0.55 : 0.9}
              className="transition-all duration-300"
            />
          ))}

          {/* proof node */}
          <g filter="url(#lssv-soft)">
            <rect x={PROOF.x} y={PROOF.y} width={PROOF.w} height={PROOF.h} rx={10} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
          </g>
          <text x={PROOF.x + PROOF.w / 2} y={proofMidY - 6} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>candidate</text>
          <text x={PROOF.x + PROOF.w / 2} y={proofMidY + 9} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>proof</text>
          <text x={PROOF.x + PROOF.w / 2} y={proofMidY + 24} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{cheats.length ? "with shortcut(s)" : "honest"}</text>

          {/* gate nodes */}
          {GATES.map((g, k) => {
            const c = g.pass ? OK : BAD
            return (
              <g key={`gate-${k}`} className="transition-all duration-300">
                <rect x={GATE.x} y={gy(k)} width={GATE.w} height={GATE.h} rx={7} fill="var(--background)" stroke={c} strokeWidth={g.pass ? 1.3 : 1.8} opacity={g.pass ? 0.85 : 1} filter={g.pass ? undefined : "url(#lssv-soft)"} />
                <circle cx={GATE.x + 15} cy={gy(k) + GATE.h / 2} r={6} fill={c} opacity={0.18} />
                <text x={GATE.x + 15} y={gy(k) + GATE.h / 2 + 3.5} textAnchor="middle" className="font-mono" fontSize={10} fontWeight={700} fill={c}>{g.pass ? "✓" : "✗"}</text>
                <text x={GATE.x + 30} y={gy(k) + GATE.h / 2 + 3.5} className={cn("font-mono", g.pass ? "fill-muted-foreground" : "fill-foreground")} fontSize={10}>{g.label}</text>
              </g>
            )
          })}
          <text x={GATE.x + GATE.w / 2} y={gy(0) - 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>SafeVerify gates · all must pass</text>

          {/* verdict node */}
          <g filter="url(#lssv-soft)">
            <rect x={VER.x} y={VER.y} width={VER.w} height={VER.h} rx={10} fill="var(--background)" stroke={vc} strokeWidth={2} className="transition-all duration-300" />
          </g>
          {accepted ? (
            <text x={VER.x + VER.w / 2} y={verMidY - 8} textAnchor="middle" fontSize={16} fill={OK}>✓</text>
          ) : (
            <text x={VER.x + VER.w / 2} y={verMidY - 8} textAnchor="middle" fontSize={16} fill={BAD}>✗</text>
          )}
          <text x={VER.x + VER.w / 2} y={verMidY + 12} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={700} fill={vc}>{accepted ? "ACCEPTED" : "REJECTED"}</text>
          <text x={VER.x + VER.w / 2} y={verMidY + 26} textAnchor="middle" className="font-mono" fontSize={8} fill="var(--muted-foreground)">{accepted ? "full reward" : "no reward"}</text>
        </svg>

        {/* the actual control */}
        <div className="mt-1 mb-1 font-mono text-[10px] text-muted-foreground">try a shortcut the model might take to fake a proof:</div>
        <div className="flex flex-wrap gap-1.5">
          {SHORTCUTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setOn((p) => ({ ...p, [s.key]: !p[s.key] }))}
              aria-pressed={on[s.key]}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                on[s.key] ? "border-transparent text-background" : "text-muted-foreground hover:border-foreground/40",
              )}
              style={on[s.key] ? { background: BAD } : undefined}
              title={s.desc}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* verdict line — fixed height, only content/colour changes */}
        <div
          className="mt-4 flex items-center gap-2 rounded-md border px-3 py-2.5 font-mono text-sm transition-colors"
          style={{ borderColor: accepted ? OK : BAD, background: `${accepted ? OK : BAD}14` }}
        >
          {accepted ? <CheckCircleIcon size={18} weight="fill" style={{ color: OK }} /> : <XCircleIcon size={18} weight="fill" style={{ color: BAD }} />}
          <span className="font-medium" style={{ color: accepted ? OK : BAD }}>
            {accepted ? "ACCEPTED — full reward" : "REJECTED — no reward"}
          </span>
          <span className="text-muted-foreground">
            {accepted ? "a real proof, only standard axioms" : `caught: ${cheats.map((c) => c.label).join(", ")}`}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Because every one of these gets zero reward, RL can&apos;t learn to cheat its way to a green
          checkmark — the only policy that pays is producing genuinely kernel-checked proofs. It&apos;s the
          formal-methods version of a unit test that can&apos;t be satisfied by deleting the assertion.
        </p>
      </div>
    </figure>
  )
}
