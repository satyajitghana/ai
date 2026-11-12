"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Per-position KL divergence between each base model and its RL-Zero model, read
// out of the paper's own vector figures (arXiv 2610.06851v1, Figure 15a/15b,
// fig_kl_4models.svg and fig_kl_4models_basetraj.svg). The repository ships no
// data file, so these are the polyline vertices matplotlib wrote into the SVG,
// mapped back through the axis ticks (symlog x, linthresh 2; y ticks at 0 and 2).
// [position, KL in nats]. matplotlib drops any vertex within 1/9 pt of the line it
// draws (assuming matplotlib's default simplification threshold), about 0.0085 nats
// here: kept vertices are exact, but between them the curve is only known to within
// that distance of the drawn line. Olmo-3-7B / Qwen3-14B match the paper's Figure 3.

type Pt = [number, number]
type Pair = { baseRl: Pt[]; rlBase: Pt[] }
type Model = "Olmo-3-7B" | "Olmo-3-32B" | "Qwen3-4B" | "Qwen3-14B"
type Traj = "rl" | "base"

const DATA: Record<Model, Record<Traj, Pair>> = {
  "Olmo-3-7B": {
    rl: {
      baseRl: [[0, 0.3998], [1, 1.3614], [2, 0.0002], [4095, 0.0043]],
      rlBase: [[0, 0.4069], [1, 0.6852], [2, 0.0001], [4095, 0.0043]],
    },
    base: {
      baseRl: [[0, 0.3992], [1, 1.4279], [2, 0.0827], [3, 0.0764], [4, 0.0241], [5, 0.0515], [7, 0.0338], [10, 0.0391], [26, 0.01], [94, 0.0051], [139, 0.0045], [4095, 0.0027]],
      rlBase: [[0, 0.4062], [1, 1.5738], [2, 0.0912], [3, 0.0818], [4, 0.0216], [5, 0.0517], [7, 0.0286], [10, 0.0402], [12, 0.0323], [33, 0.0074], [116, 0.005], [422, 0.0042], [1072, 0.0045], [4095, 0.0027]],
    },
  },
  "Olmo-3-32B": {
    rl: {
      baseRl: [[0, 0.7639], [1, 1.722], [2, 0.0014], [3, 0.0321], [4, 0.0209], [5, 0.0217], [7, 0.0123], [173, 0.0028], [4095, 0.0047]],
      rlBase: [[0, 0.5205], [1, 0.4825], [2, 0.0012], [3, 0.0273], [4, 0.01], [5, 0.0151], [9, 0.0052], [23, 0.0011], [4095, 0.004]],
    },
    base: {
      baseRl: [[0, 0.765], [1, 0.8928], [2, 0.1002], [3, 0.09], [4, 0.0666], [5, 0.0757], [6, 0.0643], [8, 0.0721], [9, 0.1009], [10, 0.111], [11, 0.1004], [12, 0.082], [14, 0.0364], [48, 0.0035], [4095, 0.0037]],
      rlBase: [[0, 0.5212], [1, 0.3796], [2, 0.0996], [3, 0.0756], [4, 0.0423], [5, 0.0671], [6, 0.0471], [7, 0.0408], [11, 0.0484], [17, 0.0176], [32, 0.0035], [4095, 0.0034]],
    },
  },
  "Qwen3-4B": {
    rl: {
      baseRl: [[0, 0.4937], [1, 0.1207], [2, 0.0987], [3, 0.0412], [4, 0.0708], [5, 0.0507], [19, 0.0176], [27, 0.0211], [40, 0.0202], [49, 0.0209], [84, 0.0168], [137, 0.012], [296, 0.0084], [768, 0.0071], [969, 0.0065], [4095, 0.0004]],
      rlBase: [[0, 0.4843], [1, 0.0935], [2, 0.0967], [3, 0.0317], [4, 0.0646], [5, 0.0429], [8, 0.033], [39, 0.0171], [86, 0.0144], [149, 0.0113], [4095, 0.0002]],
    },
    base: {
      baseRl: [[0, 0.4953], [1, 0.1088], [2, 0.0788], [3, 0.0404], [4, 0.0457], [5, 0.0612], [7, 0.0412], [10, 0.0345], [15, 0.0215], [203, 0.014], [1058, 0.0084], [1087, 0.0087], [1309, 0.0066], [3152, 0.0039], [4095, 0.0078]],
      rlBase: [[0, 0.4844], [1, 0.1002], [2, 0.0744], [3, 0.036], [5, 0.055], [7, 0.037], [9, 0.0378], [13, 0.023], [163, 0.0175], [233, 0.0155], [290, 0.0148], [676, 0.0091], [799, 0.0081], [1001, 0.0088], [1767, 0.0032], [4095, 0.0032]],
    },
  },
  "Qwen3-14B": {
    rl: {
      baseRl: [[0, 3.2757], [1, 0.1096], [2, 0.1175], [3, 0.0373], [5, 0.0722], [7, 0.032], [9, 0.0305], [12, 0.0267], [17, 0.0202], [29, 0.0181], [56, 0.0048], [88, 0.0032], [140, 0.0027], [2449, 0.0016], [4095, 0.0015]],
      rlBase: [[0, 1.8497], [1, 0.0712], [2, 0.0612], [3, 0.0162], [5, 0.0412], [7, 0.0195], [10, 0.0247], [20, 0.0129], [4095, 0.0015]],
    },
    base: {
      baseRl: [[0, 3.2793], [1, 0.4935], [2, 0.2533], [3, 0.1352], [4, 0.1072], [5, 0.1614], [6, 0.1092], [7, 0.0871], [8, 0.0791], [9, 0.0823], [11, 0.0693], [20, 0.0435], [30, 0.0461], [33, 0.0438], [41, 0.0306], [65, 0.021], [166, 0.0067], [496, 0.0035], [4095, 0.001]],
      rlBase: [[0, 1.856], [1, 0.3144], [2, 0.186], [3, 0.0901], [4, 0.0744], [5, 0.1057], [6, 0.0782], [8, 0.0623], [10, 0.0617], [13, 0.0456], [17, 0.0373], [21, 0.0357], [24, 0.0415], [36, 0.0319], [48, 0.0203], [74, 0.0159], [117, 0.008], [225, 0.005], [454, 0.0034], [2525, 0.001], [4095, 0.001]],
    },
  },
}

// Each model's selected cue (cues/models.py, the registry the paper's runs use).
// Olmo runs use the RL-Zero prompt, Qwen runs the boxed prompt.
const OPENING: Record<Model, string> = {
  "Olmo-3-7B": "cue “.\\n\\n” + “Okay” = positions 0 and 1",
  "Olmo-3-32B": "cue “.\\n\\n” + “Okay” = positions 0 and 1",
  "Qwen3-4B": "cue “ To” + “ determine” = positions 0 and 1",
  "Qwen3-14B": "cue “ Alright” + “,” = positions 0 and 1",
}

const TOL = 0.0085
const TAIL = 4094 // positions 2..4095
const W = 560
const H = 230
const PAD = { l: 40, r: 12, t: 12, b: 34 }
const LIN = 1 / 0.9 // symlog: positions 0..2 take 1.11 decades of width, as in the paper's axis
const XMAX = LIN + mlog10(4095 / 2)

function sx(t: number) {
  const u = t <= 2 ? (t / 2) * LIN : LIN + mlog10(t / 2)
  return PAD.l + (u / XMAX) * (W - PAD.l - PAD.r)
}

export function KlPerPosition() {
  const [model, setModel] = useState<Model>("Olmo-3-7B")
  const [traj, setTraj] = useState<Traj>("rl")
  const [eps, setEps] = useState(0.0043)

  const pair = DATA[model][traj]
  const ymax = model === "Qwen3-14B" ? 3.5 : 2
  const sy = (v: number) => H - PAD.b - (v / ymax) * (H - PAD.t - PAD.b)
  const path = (pts: Pt[]) => pts.map(([t, v], i) => `${i ? "L" : "M"}${sx(t).toFixed(1)},${sy(v).toFixed(1)}`).join(" ")
  const opening = pair.baseRl[0][1] + pair.baseRl[1][1]
  const tail = eps * TAIL
  const ticks = [0, 1, 10, 100, 1000, 4095]
  const tickLabel = (t: number) => (t === 1000 ? "1k" : t === 4095 ? "4k" : String(t))
  const yTicks = ymax > 2 ? [0, 1, 2, 3] : [0, 1, 2]
  const tolTop = sy(TOL)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Model">
          {(Object.keys(DATA) as Model[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModel(m)}
              aria-pressed={m === model}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
                m === model ? "border-sky-500/60 bg-sky-500/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label="Whose text the two models read">
          {(["rl", "base"] as Traj[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTraj(t)}
              aria-pressed={t === traj}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
                t === traj ? "border-amber-500/60 bg-amber-500/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "rl" ? "RL-written text" : "base-written text"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Per-position KL between ${model} base and RL, on ${traj === "rl" ? "RL" : "base"}-written text`}>
          <rect x={PAD.l} y={tolTop} width={W - PAD.l - PAD.r} height={sy(0) - tolTop} className="fill-rose-500/10" />
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} className="stroke-muted-foreground/15" strokeDasharray="2 4" />
              <text x={PAD.l - 6} y={sy(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                {v}
              </text>
            </g>
          ))}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={sy(0)} y2={sy(0) + 4} className="stroke-muted-foreground/60" />
              <text x={sx(t)} y={sy(0) + 15} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
                {tickLabel(t)}
              </text>
            </g>
          ))}
          <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            output position (symlog, as in the paper)
          </text>
          <path d={path(pair.rlBase)} fill="none" className="stroke-muted-foreground" strokeWidth={1.4} strokeDasharray="5 4" />
          <path d={path(pair.baseRl)} fill="none" className="stroke-sky-500" strokeWidth={2} />
          {pair.baseRl.map(([t, v]) => (
            <circle key={t} cx={sx(t)} cy={sy(v)} r={2.2} className="fill-sky-500" />
          ))}
          <text x={W - PAD.r - 4} y={tolTop - 4} textAnchor="end" className="fill-rose-500 font-mono text-[9px]">
            between vertices: only known to ±{TOL} nats
          </text>
        </svg>

        <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            <span className="text-sky-600 dark:text-sky-400">━</span> KL(base ‖ RL)
          </span>
          <span>╌ KL(RL ‖ base)</span>
          <span>{OPENING[model]}</span>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-md border bg-background/60 px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">position {i}</div>
              <div className="font-mono text-sm tabular-nums">{pair.baseRl[i][1].toFixed(3)} nats</div>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-dashed px-3 py-3">
          <div className="mb-2 text-[12px] text-muted-foreground">
            What if every later token carried a divergence the figure cannot pin down? Slide the per-token KL for positions 2 to 4,095 (it starts at 0.0043, Olmo-3-7B’s last plotted point):
          </div>
          <Range
            min={0}
            max={TOL}
            step={0.0001}
            value={eps}
            onChange={(e) => setEps(Number(e.target.value))}
            aria-label="Assumed per-token KL after the opening"
            accent="oklch(0.65 0.2 15)"
          />
          <div className="mt-2 grid gap-1 font-mono text-[11px] tabular-nums sm:grid-cols-3">
            <span>per later token: {eps.toFixed(4)}</span>
            <span>opening, summed: {opening.toFixed(2)}</span>
            <span>
              4,094 later tokens: {tail.toFixed(2)}
              {tail > opening ? " (more than the opening)" : ""}
            </span>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Points are the vertices the paper&apos;s plotting library kept when it wrote the figure; the repository has no data
          file. Per token, the opening is where the models disagree most, by two to three orders of magnitude on
          Olmo-3-7B and Qwen3-14B and by less on Qwen3-4B. Summed over a 4,096-token response the figure cannot settle
          which is larger: between kept points it drew straight lines, and the true values may sit up to the shaded
          height away from them. The slider is my arithmetic, not a measurement.
        </p>
      </div>
    </figure>
  )
}
