"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// How far each level of an H-JEPA looks on its first planning call, per the
// paper's planning settings (Table 7, configured horizon H per level, levels
// listed lowest first) and its temporal layout (a level-1 step is 5
// environment steps; every upper level has stride 2, so level l predicts
// 5 * 2^(l-1) environment steps per step). Success rates are the paper's
// final 50-task evaluation (Figure 6 bottom, also printed in the repo
// README), mean of three seeds. Clip share is Table 3: training clips per
// epoch as a percentage of the flat LeWM count.

type Env = {
  key: string
  label: string
  task: number
  taskNote: string
  budget: number
  lewm: { H: number; success: number }
  depths: Record<number, { H: number[]; hjepa: number; hwm: number; clips: number }>
}

const ENVS: Env[] = [
  {
    key: "ant",
    label: "Visual AntMaze",
    task: 82,
    taskNote: "expert route between cells three apart, 82 steps on average",
    budget: 350,
    lewm: { H: 23, success: 18.0 },
    depths: {
      2: { H: [4, 9], hjepa: 39.3, hwm: 34.0, clips: 96 },
      3: { H: [4, 2, 5], hjepa: 73.3, hwm: 38.7, clips: 88 },
      4: { H: [3, 2, 2, 3], hjepa: 67.3, hwm: 14.0, clips: 73 },
    },
  },
  {
    key: "fourroom",
    label: "FourRoom",
    task: 75,
    taskNote: "start and goal two rooms apart, 75 steps",
    budget: 210,
    lewm: { H: 23, success: 40.7 },
    depths: {
      2: { H: [2, 12], hjepa: 81.3, hwm: 75.3, clips: 96 },
      3: { H: [2, 2, 6], hjepa: 96.0, hwm: 99.3, clips: 88 },
      4: { H: [2, 2, 2, 3], hjepa: 88.0, hwm: 92.7, clips: 73 },
    },
  },
  {
    key: "cube",
    label: "OGBench Cube",
    task: 20,
    taskNote: "a 20-step segment centred on the grasp",
    budget: 30,
    lewm: { H: 4, success: 32.0 },
    depths: {
      2: { H: [2, 2], hjepa: 47.3, hwm: 46.7, clips: 92 },
      3: { H: [2, 2, 1], hjepa: 60.0, hwm: 53.3, clips: 75 },
      4: { H: [2, 2, 1, 1], hjepa: 62.7, hwm: 34.0, clips: 42 },
    },
  },
  {
    key: "pusht",
    label: "Push-T",
    task: 75,
    taskNote: "expert frames 75 steps apart",
    budget: 90,
    lewm: { H: 15, success: 40.0 },
    depths: {
      2: { H: [2, 8], hjepa: 45.3, hwm: 42.0, clips: 86 },
      3: { H: [2, 2, 4], hjepa: 17.3, hwm: 12.0, clips: 58 },
      4: { H: [2, 2, 2, 2], hjepa: 0.7, hwm: 0.0, clips: 14 },
    },
  },
]

const LEVEL_COLORS = [
  "oklch(0.56 0.13 250)",
  "oklch(0.58 0.17 25)",
  "oklch(0.55 0.15 300)",
  "oklch(0.6 0.13 150)",
]

const span = (level: number) => 5 * 2 ** (level - 1)

export function DepthLadder() {
  const [envKey, setEnvKey] = useState("ant")
  const [depth, setDepth] = useState(3)
  const env = ENVS.find((e) => e.key === envKey) ?? ENVS[0]

  // First planning call: the highest level whose horizon exceeds one plans with
  // its configured H; levels above it are skipped; every level below it holds
  // horizon 2 (pre_decay_horizon, the stride of the level above) and plans only
  // up to the first subgoal it is handed.
  const configured = depth === 1 ? [env.lewm.H] : env.depths[depth].H
  let topActive = 1
  configured.forEach((H, i) => {
    if (H > 1) topActive = i + 1
  })
  const rows = configured.map((cfg, i) => {
    const level = i + 1
    const H = level > topActive ? 1 : level === topActive ? cfg : 2
    return { level, H, cfg }
  })
  const reaches = rows.map((r) => r.H * span(r.level))
  const scaleMax = Math.max(env.task, ...reaches) * 1.08
  const X = (steps: number) => 120 + (steps / scaleMax) * 500

  const d = depth === 1 ? null : env.depths[depth]
  const skipped = rows.filter((r) => r.level > 1 && r.H === 1).map((r) => r.level)

  const rowH = 34
  const top = 40
  const height = top + rows.length * rowH + 44

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          what each level predicts on the first planning call (Table 7 settings)
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {depth === 1 ? "flat LeWM" : `${depth}-level`} · {env.label}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 640 ${height}`} className="w-full" role="img"
          aria-label={`Timeline in environment steps showing, for each hierarchy level, how many predictions it makes and how far they reach, against the task length of ${env.task} steps.`}>
          {/* task length */}
          <rect x={X(0)} y={top - 22} width={X(env.task) - X(0)} height={8} rx={3} fill="var(--muted-foreground)" fillOpacity={0.25} />
          <text x={X(env.task) + 6} y={top - 15} className="fill-muted-foreground font-mono text-[10px]">
            task ≈ {env.task} steps
          </text>

          {rows.slice().reverse().map((r, idx) => {
            const y = top + idx * rowH
            const col = LEVEL_COLORS[r.level - 1]
            const isSkipped = r.level > 1 && r.H === 1
            return (
              <g key={r.level} opacity={isSkipped ? 0.4 : 1}>
                <text x={8} y={y + 14} className="fill-foreground font-mono text-[11px]">level {r.level}</text>
                <text x={8} y={y + 27} className="fill-muted-foreground font-mono text-[9px]">
                  {span(r.level)} steps/pred · H={r.cfg}
                </text>
                <line x1={X(0)} y1={y + 12} x2={X(scaleMax / 1.08)} y2={y + 12} stroke="var(--border)" />
                {Array.from({ length: r.H }, (_, k) => (
                  <rect key={k} x={X(k * span(r.level)) + 1} y={y + 4}
                    width={Math.max(2, X(span(r.level)) - X(0) - 2)} height={16} rx={3}
                    fill={col} fillOpacity={0.75} />
                ))}
                <text x={X(r.H * span(r.level)) + 6} y={y + 16} className="font-mono text-[10px]" fill={col}>
                  {r.H * span(r.level)}{isSkipped ? " (skipped)" : ""}
                </text>
              </g>
            )
          })}

          <line x1={X(0)} y1={height - 30} x2={X(scaleMax / 1.08)} y2={height - 30} stroke="var(--muted-foreground)" />
          <text x={X(0)} y={height - 16} className="fill-muted-foreground font-mono text-[10px]">0</text>
          <text x={X(scaleMax / 1.08)} y={height - 16} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
            environment steps
          </text>
        </svg>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {ENVS.map((e) => (
            <button key={e.key} type="button" onClick={() => setEnvKey(e.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30",
                e.key === envKey && "bg-muted/40 text-foreground"
              )}>
              {e.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setDepth(n)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30",
                n === depth && "bg-muted/40 text-foreground"
              )}>
              {n === 1 ? "flat (LeWM)" : `${n} levels`}
            </button>
          ))}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">H-JEPA success</dt>
            <dd className="tabular-nums">{d ? `${d.hjepa.toFixed(1)}%` : "n/a"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">HWM success</dt>
            <dd className="tabular-nums">{d ? `${d.hwm.toFixed(1)}%` : "n/a"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">flat LeWM</dt>
            <dd className="tabular-nums">{env.lewm.success.toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">training clips vs LeWM</dt>
            <dd className="tabular-nums">{d ? `${d.clips}%` : "100%"}</dd>
          </div>
        </dl>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {env.label}: {env.taskNote}, episode budget {env.budget} steps. H is the configured
          horizon from the paper&rsquo;s Table 7. On the first call the top active level plans its full
          H; every level below it plans two steps, just enough to reach the first subgoal it is
          handed. Later calls shrink the top horizon toward one, and an upper level whose horizon
          is one is skipped.
          {skipped.length > 0 ? ` Here level ${skipped.join(" and ")} starts at one and never plans.` : ""}
          {d && d.clips < 60
            ? ` At this depth an epoch yields only ${d.clips}% of the flat model's training clips, which is the paper's explanation for the drop.`
            : ""}
        </p>
      </div>
    </figure>
  )
}
