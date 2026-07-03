"use client"

import { useState } from "react"
import { CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Why the reward can't be gamed. If you train an agent to make Lean say "no errors,"
// it will find the cheap shortcuts: leave a `sorry`, call `native_decide` (known to be
// unsound), sneak in an extra axiom, or crank `set_option` limits. Leanstral is graded
// by a fork of SafeVerify, which rejects all of these — full reward only for a proof
// that compiles AND uses only standard Lean axioms AND took no shortcut. Toggle the
// shortcuts and watch the verdict flip. The honest proof (no toggles) is the only pass.

const OK = "oklch(0.72 0.15 150)"
const BAD = "oklch(0.63 0.2 25)"

const SHORTCUTS = [
  { key: "sorry", label: "sorry", desc: "admit the goal unproven", gate: "no admitted goals (`sorry`)" },
  { key: "native", label: "native_decide", desc: "trust compiled evaluation", gate: "no `native_decide` (unsound)" },
  { key: "axiom", label: "extra axiom", desc: "assume what you can't prove", gate: "only standard axioms (#print axioms)" },
  { key: "setopt", label: "set_option …", desc: "loosen the checker", gate: "no `set_option` escape hatches" },
] as const

type Key = (typeof SHORTCUTS)[number]["key"]

export function SafeVerify() {
  const [on, setOn] = useState<Record<Key, boolean>>({ sorry: false, native: false, axiom: false, setopt: false })
  const cheats = SHORTCUTS.filter((s) => on[s.key])
  const accepted = cheats.length === 0

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>SafeVerify · the reward is adversarial</span>
        <span>{cheats.length ? `${cheats.length} shortcut${cheats.length > 1 ? "s" : ""} taken` : "honest proof"}</span>
      </div>

      <div className="p-4">
        <div className="mb-1 font-mono text-[10px] text-muted-foreground">try a shortcut the model might take to fake a proof:</div>
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

        {/* the gates SafeVerify runs — fixed list, only status changes (no reflow) */}
        <div className="mt-4 space-y-1.5">
          {/* baseline gate: the honest proof does type-check */}
          <Gate label="type-checks against the Lean kernel" pass />
          {SHORTCUTS.map((s) => (
            <Gate key={s.key} label={s.gate} pass={!on[s.key]} />
          ))}
        </div>

        {/* verdict — fixed height, only content/colour changes */}
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

function Gate({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      {pass ? (
        <CheckCircleIcon size={14} weight="fill" style={{ color: OK }} />
      ) : (
        <XCircleIcon size={14} weight="fill" style={{ color: BAD }} />
      )}
      <span className={pass ? "text-muted-foreground" : "text-foreground"}>{label}</span>
    </div>
  )
}
