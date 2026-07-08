"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The core R3 mechanism at a single MoE layer (M=8 experts, top-K=2).
//
// RL for MoE uses two engines: an INFERENCE engine (SGLang) generates the
// rollout, a TRAINING engine (Megatron) recomputes probabilities for the
// update. The router picks experts from logits s = x·W_r; tiny numeric
// differences between the engines can flip which experts land in the top-K.
// When the training pass selects DIFFERENT experts than the rollout did, the
// layer output changes, the token's log-prob moves, and the importance-sampling
// ratio  w_t = π_train / π_infer  blows away from 1 — the signal that destab
// -ilizes PPO/GRPO.
//
// R3 fixes this by REPLAYING the rollout routing mask I_infer during training:
// the same experts fire, but softmax still runs over the TRAINING logits so the
// gradient keeps flowing to the router. Toggle R3 and step the token to watch
// the selection re-align and w_t snap back to ~1.
//
// This is a small, internally-consistent toy: each expert i has a router logit
// and a fixed "value" V[i] (its contribution to the token log-prob). Everything
// below — selections, gating softmax, log-probs, w_t — is derived from these in
// a pure, deterministic render (no timers, no randomness, no unbounded loops).
// Illustrative numbers, real mechanism.

const ACC = "oklch(0.62 0.16 150)" // aligned / rollout green
const BAD = "oklch(0.58 0.19 25)" // mismatch red
const K = 2

// expert output-value (log-prob contribution). Independent of routing logit —
// that independence is the whole point: the router can swap in an expert whose
// contribution is very different.
const V = [-0.2, -2.7, -0.8, -3.1, -1.55, -2.1, -2.95, -0.55]

type Tok = { name: string; infer: number[]; train: number[] }
// Router logits per engine. train = infer + a small per-expert numeric drift.
const TOKENS: Tok[] = [
  { name: "tok·A", infer: [3.0, 0.5, 1.2, 0.3, 1.0, 0.7, 0.4, 2.6], train: [3.04, 0.47, 1.23, 0.3, 0.96, 0.73, 0.38, 2.65] },
  { name: "tok·B", infer: [2.36, 2.45, 1.1, 0.3, 0.9, 0.6, 0.4, 2.5], train: [2.56, 2.45, 1.1, 0.3, 0.9, 0.6, 0.4, 2.5] },
  { name: "tok·C", infer: [2.5, 0.5, 1.0, 2.36, 0.9, 0.6, 0.4, 2.45], train: [2.5, 0.5, 1.0, 2.56, 0.9, 0.6, 0.4, 2.45] },
  { name: "tok·D", infer: [3.0, 0.5, 2.3, 0.3, 2.22, 0.6, 0.4, 1.0], train: [3.0, 0.5, 2.21, 0.3, 2.32, 0.6, 0.4, 1.0] },
]

// top-K indices of an 8-element logit vector (bounded, no unbounded loops)
function topK(logits: number[]): number[] {
  return logits
    .map((v, i) => [v, i] as const)
    .sort((a, b) => b[0] - a[0])
    .slice(0, K)
    .map(([, i]) => i)
    .sort((a, b) => a - b)
}
// softmax gating over a selected set S, using the given logits
function gatingOver(logits: number[], S: number[]): Map<number, number> {
  const m = Math.max(...S.map((i) => logits[i]))
  const exps = S.map((i) => Math.exp(logits[i] - m))
  const Z = exps.reduce((a, b) => a + b, 0)
  const g = new Map<number, number>()
  S.forEach((i, k) => g.set(i, exps[k] / Z))
  return g
}
// token log-prob proxy: base + Σ g_i · V[i]
function logProb(logits: number[], S: number[]): number {
  const g = gatingOver(logits, S)
  return S.reduce((acc, i) => acc + (g.get(i) ?? 0) * V[i], 0)
}

const W = 760
const H = 300
const N = 8
const PITCH = 86
const X0 = 46
const CELL = 42
const cx = (i: number) => X0 + i * PITCH

// logit → bar height (px), scaled to the max logit across both engines
const LMAX = 3.2
const barH = (l: number) => 4 + (Math.max(l, 0) / LMAX) * 26

// map w_t onto a log axis [0.25 … 4] → [0,1]
const WLO = 0.25
const WHI = 4
const wPos = (w: number) => (Math.log(Math.min(Math.max(w, WLO), WHI)) - Math.log(WLO)) / (Math.log(WHI) - Math.log(WLO))

export function RouterReplay() {
  const [tok, setTok] = useState(1) // default: token B — a mismatch, R3 off
  const [r3, setR3] = useState(false)

  const t = TOKENS[tok]
  const Sinfer = topK(t.infer)
  const StrainNaive = topK(t.train)
  const Strain = r3 ? Sinfer : StrainNaive // R3 replays the rollout mask

  const lpInfer = logProb(t.infer, Sinfer)
  const lpTrain = logProb(t.train, Strain) // softmax always over TRAINING logits
  const w = Math.exp(lpTrain - lpInfer)
  const extreme = w > 2 || w < 0.5

  const inSet = (S: number[], i: number) => S.includes(i)
  // an expert that inference picked but naive training dropped (or vice-versa)
  const dropped = (i: number) => inSet(Sinfer, i) && !inSet(StrainNaive, i)
  const added = (i: number) => !inSet(Sinfer, i) && inSet(StrainNaive, i)
  const match = Sinfer.filter((i) => Strain.includes(i)).length

  // y bands — labels sit above each row of squares; logit bars hang below them,
  // so nothing collides.
  const rowAsq = 74 // rollout squares top
  const rowBsq = 212 // training squares top

  const expert = (engine: "infer" | "train", i: number) => {
    const logits = engine === "infer" ? t.infer : t.train
    const S = engine === "infer" ? Sinfer : Strain
    const sq = engine === "infer" ? rowAsq : rowBsq
    const sel = inSet(S, i)
    // colour: rollout selected = green; training selected = green if aligned,
    // red if this is a naive-only swap-in
    let fill = "var(--muted-foreground)"
    let op = 0.14
    if (sel) {
      const isBadAdd = engine === "train" && !r3 && added(i)
      fill = isBadAdd ? BAD : ACC
      op = 0.95
    }
    // training expert that rollout used but naive training dropped: ghost outline
    const ghostDrop = engine === "train" && !r3 && dropped(i)
    return (
      <g key={`${engine}-${i}`}>
        {/* logit bar hanging below the square — near-tie heights are why a tiny
            perturbation can flip the top-2 */}
        <rect x={cx(i) + CELL / 2 - 4} y={sq + CELL + 3} width={8} height={barH(logits[i])} rx={2} fill={sel ? fill : "var(--muted-foreground)"} opacity={sel ? 0.8 : 0.3} className="transition-all duration-300" />
        {/* the expert cell */}
        <rect x={cx(i)} y={sq} width={CELL} height={CELL} rx={6} fill={fill} opacity={op} stroke={ghostDrop ? ACC : sel ? fill : "transparent"} strokeWidth={ghostDrop ? 1.5 : 0} strokeDasharray={ghostDrop ? "3 3" : undefined} className="transition-all duration-300" />
        <text x={cx(i) + CELL / 2} y={sq + CELL / 2 + 4} textAnchor="middle" className="font-mono" fontSize={13} fontWeight={600} fill={sel ? "var(--background)" : "var(--muted-foreground)"} opacity={sel ? 1 : 0.7}>
          E{i}
        </text>
      </g>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one MoE layer · 8 experts · top-{K} router</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="A single MoE layer showing the rollout (inference) router selection on top and the training router selection below. With R3 off, the training router flips an expert and the importance-sampling ratio blows up; with R3 on, the training pass replays the rollout mask and the ratio returns to about 1.">
          {/* row labels — above each row of expert cells */}
          <text x={X0} y={rowAsq - 14} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>rollout · inference engine (SGLang)</text>
          <text x={W - X0} y={rowAsq - 14} textAnchor="end" className="font-mono" fontSize={10} fill={ACC}>selects {Sinfer.map((i) => `E${i}`).join(", ")}</text>

          <text x={X0} y={rowBsq - 14} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            {r3 ? "training update · replaying rollout mask" : "training update · recomputes its own top-2"}
          </text>
          <text x={W - X0} y={rowBsq - 14} textAnchor="end" className="font-mono" fontSize={10} fill={r3 ? ACC : extreme ? BAD : "var(--muted-foreground)"}>
            selects {Strain.map((i) => `E${i}`).join(", ")}
          </text>

          {Array.from({ length: N }, (_, i) => expert("infer", i))}
          {Array.from({ length: N }, (_, i) => expert("train", i))}

          {/* replay connector in the gap between the two rows (y ≈ 152–190) */}
          {r3 ? (
            <>
              <line x1={X0 + 8} y1={rowAsq + CELL + barH(LMAX) + 8} x2={X0 + 8} y2={rowBsq - 24} stroke={ACC} strokeWidth={1.5} />
              <text x={X0 + 18} y={rowBsq - 30} className="font-mono" fontSize={10} fill={ACC}>
                ↓ replay I_infer — same experts, gradient still flows through softmax(s_train)
              </text>
            </>
          ) : (
            <text x={X0 + 8} y={rowBsq - 30} className="font-mono" fontSize={10} fill="var(--muted-foreground)">
              two engines, two top-2 masks — {match < K ? "they disagree" : "they happen to agree"}
            </text>
          )}
        </svg>

        {/* importance-sampling ratio meter */}
        <div className="mt-1 rounded-lg border bg-muted/20 px-4 py-3">
          <div className="flex items-baseline justify-between font-mono text-xs text-muted-foreground">
            <span>
              importance ratio w<sub>t</sub> = π<sub>train</sub> / π<sub>infer</sub>
            </span>
            <span className={cn("text-sm font-semibold tabular-nums", extreme ? "" : "text-foreground")} style={extreme ? { color: BAD } : undefined}>
              {w.toFixed(2)}× {extreme ? "· extreme (>2×)" : match < K ? "· off-diagonal" : "· aligned"}
            </span>
          </div>
          {/* log-scale track from 0.25× to 4× with a safe [0.5,2] band */}
          <div className="relative mt-2 h-5">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
            <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ left: `${wPos(0.5) * 100}%`, right: `${(1 - wPos(2)) * 100}%`, background: "color-mix(in oklch, var(--muted-foreground) 30%, transparent)" }} />
            {[0.25, 0.5, 1, 2, 4].map((tick) => (
              <span key={tick} className="absolute top-1/2 -translate-y-1/2 font-mono text-[9px] text-muted-foreground/70" style={{ left: `${wPos(tick) * 100}%`, transform: "translate(-50%,-50%)" }}>
                {tick}×
              </span>
            ))}
            <div className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-300" style={{ left: `${wPos(w) * 100}%`, background: extreme ? BAD : ACC }} />
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/70">safe band 0.5×–2× · outside it PPO clipping saturates and gradient variance spikes</p>
        </div>

        {/* controls */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">token</span>
            {TOKENS.map((tk, i) => (
              <button key={tk.name} type="button" onClick={() => setTok(i)} aria-pressed={tok === i} className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", tok === i ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")} style={tok === i ? { background: ACC } : undefined}>
                {tk.name}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setR3((v) => !v)} aria-pressed={r3} className={cn("cursor-pointer rounded-md border px-3 py-1 font-mono text-[10px] transition-colors", r3 ? "text-background" : "text-muted-foreground hover:text-foreground")} style={r3 ? { background: ACC, borderColor: ACC } : undefined}>
            R3 {r3 ? "on" : "off"}
          </button>
          <div className="ml-auto flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACC }} /> aligned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BAD }} /> mismatch
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The rollout router picks its top-2 experts; the training router recomputes logits on a different engine and can land on a{" "}
          <span style={{ color: BAD }}>different top-2</span>. When it does, the layer output shifts, the token log-prob moves, and{" "}
          <span className="text-foreground">
            w<sub>t</sub>
          </span>{" "}
          swings away from 1 — token B goes to <span style={{ color: BAD }}>3.42×</span>, token C to <span style={{ color: BAD }}>0.27×</span>. Turn{" "}
          <span style={{ color: ACC }}>R3 on</span> and the training pass replays the rollout mask <span className="font-mono text-xs">I_infer</span>; the same experts
          fire, softmax still runs over the training logits so the router keeps learning, and every token returns to{" "}
          <span style={{ color: ACC }}>w ≈ 1</span>.
        </p>
      </div>
    </figure>
  )
}
