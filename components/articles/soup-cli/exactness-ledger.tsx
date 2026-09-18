"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { mlog10 } from "@/lib/dmath"

// "Bit-exact" is two independent measurements, and above ~165 MiB per NF4 layer they
// disagreed. This is the project's own per-model ledger on the axis the defect keys
// on, plus the synthetic sweep that bracketed the threshold to 163.8–171.5 MiB by
// holding 48 layers and hidden 5120 fixed and varying only `intermediate_size` — so
// the behaviour follows the SHAPE, not the checkpoint, and reproduces without
// downloading a 32B model.
//
// The bf16 rows are the control that matters: 480 and 570 MiB per layer, nearly four
// times the NF4 size, and bit-exact in both halves. The axis is not bytes alone — it
// is bytes through `bitsandbytes`' NF4 path.
//
// Every row: benchmarks/gate-h100-validation.md — the per-model ledger table (the
// forward/backward/post-repair columns) and the `intermediate_size` bracketing sweep.
// The assertion itself is tests/test_v07200.py:1598, `torch.equal`, no atol, no rtol.

const GREEN = "oklch(0.64 0.13 160)"
const RED = "oklch(0.62 0.2 25)"
const BLUE = "oklch(0.62 0.15 250)"

type Row = {
  name: string
  mib: number
  quant: "nf4" | "bf16"
  brokenPre: boolean // as measured on v0.72.x, pin=True, against a resident reference
  row: 0 | 1
}

const MODELS: Row[] = [
  { name: "0.5B", mib: 7, quant: "nf4", brokenPre: false, row: 0 },
  { name: "8B", mib: 105, quant: "nf4", brokenPre: false, row: 1 },
  { name: "14B", mib: 132, quant: "nf4", brokenPre: false, row: 0 },
  { name: "32B", mib: 234, quant: "nf4", brokenPre: true, row: 0 },
  { name: "72B", mib: 432, quant: "nf4", brokenPre: true, row: 0 },
  { name: "8B · bf16", mib: 480, quant: "bf16", brokenPre: false, row: 1 },
  { name: "14B · bf16", mib: 570, quant: "bf16", brokenPre: false, row: 1 },
]

// 48 layers, hidden 5120, only `intermediate_size` varies.
const SWEEP: { mib: number; ok: boolean }[] = [
  { mib: 136.7, ok: true },
  { mib: 148.3, ok: true },
  { mib: 163.8, ok: true },
  { mib: 171.5, ok: false },
  { mib: 179.3, ok: false },
  { mib: 187.0, ok: false },
  { mib: 241.2, ok: false },
]

const LO = 6
const HI = 650
const PAD = 30
const W = 720
const INNER = W - PAD * 2
const lo = mlog10(LO)
const span = mlog10(HI) - lo
const px = (v: number) => PAD + ((mlog10(v) - lo) / span) * INNER

const BAND_LO = px(163.8)
const BAND_HI = px(171.5)

const LANE_A = 48
const LANE_B = 84
const LANE_C = 116
const AXIS = 134
const H = 152

export function ExactnessLedger() {
  const [post, setPost] = useState(false)

  const backOk = (m: Row) => post || !m.brokenPre

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">bit-exactness ledger · torch.equal, no atol, no rtol</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "as measured, v0.72.x" },
            { v: true, label: "after v0.73.0" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setPost(o.v)}
              aria-pressed={post === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                post === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Bit-exactness against MiB per layer. The forward is exact at every size from 7 to 570 MiB per layer. ${
            post
              ? "After the v0.73.0 repair the backward is exact everywhere, re-gated at 256 of 256 gradient tensors on 32B and 320 of 320 on 72B."
              : "The backward is exact below a threshold bracketed at 163.8 to 171.5 MiB per NF4 layer and wrong above it, at 32B (234 MiB) and 72B (432 MiB), while bf16 layers of 480 and 570 MiB stay exact."
          }`}
        >
          {/* threshold band */}
          <rect x={BAND_LO} y={32} width={Math.max(BAND_HI - BAND_LO, 3)} height={AXIS - 32} fill={RED} opacity={0.16} />
          <line x1={BAND_LO} y1={32} x2={BAND_LO} y2={AXIS} stroke={RED} strokeWidth={1} opacity={0.6} />
          <line x1={BAND_HI} y1={32} x2={BAND_HI} y2={AXIS} stroke={RED} strokeWidth={1} opacity={0.6} />
          <text x={(BAND_LO + BAND_HI) / 2} y={27} textAnchor="middle" className="font-mono" fill={RED} fontSize={9} fontWeight={600}>
            163.8–171.5
          </text>

          {/* NF4 model labels, staggered so 8B and 14B don't collide */}
          {MODELS.filter((m) => m.quant === "nf4").map((m) => (
            <text
              key={`l-${m.name}`}
              x={px(m.mib)}
              y={m.row === 0 ? 16 : 27}
              textAnchor="middle"
              className="fill-foreground font-mono"
              fontSize={9}
              fontWeight={600}
            >
              {m.name}
            </text>
          ))}
          {/* the two bf16 rows sit 480 and 570 MiB apart — too close to label one by one */}
          <path d={`M ${px(480)} 21 v -6 H ${px(570)} v 6`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.55} />
          <text x={px(570) + 6} y={19} className="fill-muted-foreground font-mono" fontSize={9}>
            bf16
          </text>

          {/* lane A — forward */}
          <text x={PAD} y={LANE_A - 9} className="fill-muted-foreground font-mono" fontSize={9}>
            forward · torch.equal on the logits
          </text>
          <line x1={PAD} y1={LANE_A} x2={PAD + INNER} y2={LANE_A} stroke="var(--border)" strokeWidth={1} />
          {MODELS.map((m) => (
            <circle key={`a-${m.name}`} cx={px(m.mib)} cy={LANE_A} r={4.5} fill={m.quant === "bf16" ? "var(--background)" : GREEN} stroke={GREEN} strokeWidth={1.75} />
          ))}
          <text x={222} y={LANE_A - 9} className="font-mono" fill={GREEN} fontSize={9} fontWeight={600}>
            exact at every size, in both modes
          </text>

          {/* lane B — backward */}
          <text x={PAD} y={LANE_B - 9} className="fill-muted-foreground font-mono" fontSize={9}>
            backward · every LoRA gradient tensor vs a resident reference
          </text>
          <line x1={PAD} y1={LANE_B} x2={PAD + INNER} y2={LANE_B} stroke="var(--border)" strokeWidth={1} />
          {MODELS.map((m) => {
            const ok = backOk(m)
            return (
              <circle
                key={`b-${m.name}`}
                cx={px(m.mib)}
                cy={LANE_B}
                r={4.5}
                fill={m.quant === "bf16" ? "var(--background)" : ok ? GREEN : RED}
                stroke={ok ? GREEN : RED}
                strokeWidth={1.75}
                className="transition-all duration-200"
              />
            )
          })}

          {/* lane C — the bracketing sweep */}
          <text x={PAD} y={LANE_C - 9} className="fill-muted-foreground font-mono" fontSize={9}>
            synthetic sweep · 48 layers, hidden 5120, only intermediate_size varies
          </text>
          {SWEEP.map((s) => (
            <rect
              key={`c-${s.mib}`}
              x={px(s.mib) - 2}
              y={LANE_C - 5}
              width={4}
              height={10}
              rx={1}
              fill={s.ok ? GREEN : RED}
              opacity={0.9}
            />
          ))}

          {/* axis */}
          <line x1={PAD} y1={AXIS} x2={PAD + INNER} y2={AXIS} stroke="var(--border)" strokeWidth={1} />
          {[10, 30, 100, 300, 600].map((t) => (
            <g key={t}>
              <line x1={px(t)} y1={AXIS} x2={px(t)} y2={AXIS + 4} stroke="var(--border)" strokeWidth={1} />
              <text x={px(t)} y={AXIS + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
                {t}
              </text>
            </g>
          ))}
        </svg>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GREEN }} />
            NF4, bit-exact
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RED }} />
            NF4, disagrees with the resident reference
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: GREEN }} />
            bf16 control
          </span>
          <span className="text-muted-foreground/70">horizontal axis: MiB per layer, log scale</span>
        </div>
        <p className="mt-1 font-mono text-[10px] leading-snug text-muted-foreground/80">
          both tracks carry the record&rsquo;s own MiB/layer figures, and they are accounted slightly
          differently: the real 14B row reads 132, its synthetic reconstruction 136.7. A 3.5% gap, far narrower
          than the bracket it sits next to.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs sm:grid-cols-4">
          <Stat label="forward, 0.5B → 72B" value="exact" sub="torch.equal on the logits" tone={GREEN} />
          <Stat label="backward, NF4 below the band" value="96 · 128 · 192" sub="all tensors, all exact" tone={GREEN} />
          <Stat
            label="backward, NF4 above the band"
            value={post ? "256/256 · 320/320" : "8/256 · 8/320"}
            sub={post ? "re-gated on real 32B and 72B" : "32B and 72B, pre-repair"}
            tone={post ? GREEN : RED}
          />
          <Stat label="bf16 at 480 and 570 MiB" value="exact" sub="3.9× more bytes per layer, never affected" tone={BLUE} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {post ? (
            <>
              The repair was re-gated at the two sizes that were broken, each against a control arm that
              reproduced the defect in the{" "}
              <span className="text-foreground">same process</span> — 256/256 on real 32B against 8–12/256, and
              320/320 on real 72B against 8/320. The four rows below the band were not re-run, and the record
              says why rather than quietly showing a green cell: there was nothing there to repair. The sweep
              track stays as it was measured, because bracketing the threshold is a pre-repair experiment.
            </>
          ) : (
            <>
              The sweep track is what turns &ldquo;about 165 MiB&rdquo; into a number: hold 48 layers and hidden
              5120 fixed, vary only <code>intermediate_size</code>, and the flip lands between{" "}
              <span className="text-foreground">163.8 and 171.5 MiB</span> per NF4 layer. Its 136.7 point is a
              synthetic reconstruction of the real 14B&rsquo;s layer shape and is exact exactly as the real 14B
              is; its 241.2 point reconstructs the real 32B&rsquo;s and is broken exactly as the real 32B is — so
              the defect follows the shape, not the checkpoint. The two hollow bf16 markers out at 480 and 570
              MiB are the control that stops this being a story about transfer size: they move nearly four times
              the bytes per layer and stay exact. For scale, the shipped CI fixtures carry a{" "}
              <span className="text-foreground">0.01 MiB</span> layer — three orders of magnitude to the left of
              this axis, which is why nothing in CI could ever have caught it.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] leading-snug text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {sub ? <div className="text-[10px] leading-snug text-muted-foreground">{sub}</div> : null}
    </div>
  )
}
