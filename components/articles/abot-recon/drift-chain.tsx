"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { RUN } from "./data"
import { tablistKeys } from "@/components/articles/ui/tablist-keys"

// Tab 1-2 MEASURED: toy.py composes 4,661 adjacent SE(3) increments (1.094 m per step, a KITTI-02-sized drive with
// 12 random 90-degree turns), adds Gaussian noise to each increment, then Sim(3)-aligns to ground truth as the
// paper's protocol does. Mean over 8 seeds. Not the model: a stand-in for "small local errors, composed".
// Tab 3 REPORTED: the paper's Table 8 ablation, ATE in metres.

const TABS = [
  { id: "paths", label: "Toy: one drive" },
  { id: "ate", label: "Toy: ATE vs noise" },
  { id: "abl", label: "Paper: ablation" },
] as const
type TabId = (typeof TABS)[number]["id"]

const W = 520
const H = 360
const gt = RUN.paths.gt as unknown as number[][]
const rot = RUN.paths.rot005 as unknown as number[][]
const tr = RUN.paths.trans005 as unknown as number[][]
const all = [...gt, ...rot, ...tr]
const xs = all.map((p) => p[0])
const ys = all.map((p) => p[1])
const pad = 30
const x0 = Math.min(...xs) - pad
const x1 = Math.max(...xs) + pad
const y0 = Math.min(...ys) - pad
const y1 = Math.max(...ys) + pad
const sc = Math.min(W / (x1 - x0), H / (y1 - y0))
const ox = (W - (x1 - x0) * sc) / 2
const oy = (H - (y1 - y0) * sc) / 2
const poly = (pts: number[][]) => pts.map((p) => `${(ox + (p[0] - x0) * sc).toFixed(1)},${(oy + (y1 - p[1]) * sc).toFixed(1)}`).join(" ")

const LINES = [
  { id: "gt", pts: gt, label: "ground truth", col: "var(--foreground)", dash: undefined },
  { id: "tr", pts: tr, label: "translation noise 5% of a step", col: "oklch(0.62 0.15 150)", dash: undefined },
  { id: "rot", pts: rot, label: "rotation noise 0.05° a step", col: "oklch(0.62 0.19 28)", dash: undefined },
]

const ABL = [
  { label: "Adjacent-pair loss, 32-frame clips", k: 56.6, o: 10.16, v: 52.9 },
  { label: "+ composition loss", k: 27.66, o: 9.4, v: 44.72 },
  { label: "+ 128-frame clips", k: 22.31, o: 5.95, v: 36.77 },
  { label: "+ rotation refiner", k: 18.25, o: 4.35, v: 30.14 },
]

export function DriftChain() {
  const [tab, setTab] = useState<TabId>("paths")
  const rows = RUN.drift.rows
  const maxAte = Math.max(...rows.map((r) => r.ATE_m_mean + r.ATE_m_std))
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        {tab === "abl"
          ? "reported · paper Table 8 · average ATE in metres, no loop closure"
          : `measured · toy.py · ${RUN.drift.frames.toLocaleString("en-US")} composed steps of ${RUN.drift.metres_per_frame} m · Sim(3)-aligned`}
      </div>
      <div className="flex flex-wrap gap-2 px-3 pt-3" role="tablist" onKeyDown={tablistKeys()} aria-label="View">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded border px-2.5 py-1 font-mono text-xs transition-colors",
              tab === t.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "paths" && (
        <div className="p-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Top-down view of the toy drive: ground truth and two noisy compositions">
            {LINES.map((l) => (
              <polyline key={l.id} points={poly(l.pts)} fill="none" stroke={l.col} strokeWidth={l.id === "gt" ? 2.5 : 1.8} strokeDasharray={l.dash} opacity={l.id === "gt" ? 0.35 : 0.95} />
            ))}
          </svg>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {LINES.map((l) => (
              <li key={l.id} className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5" style={{ background: l.col, opacity: l.id === "gt" ? 0.5 : 1 }} />
                {l.label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            One seed, every 25th frame. Both noisy paths are fitted to ground truth with one similarity transform, so what
            is left is shape error, not a global offset.
          </p>
        </div>
      )}
      {tab === "ate" && (
        <div className="space-y-1.5 p-3">
          {rows.map((r) => (
            <div key={`${r.rot_noise_deg_per_frame}-${r.trans_noise_frac_of_step}`} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-2 text-xs sm:grid-cols-[14rem_1fr_7rem]">
              <span className="font-mono text-muted-foreground">
                rot {r.rot_noise_deg_per_frame.toFixed(2)}° · trans {(r.trans_noise_frac_of_step * 100).toFixed(0)}%
              </span>
              <div className="h-3 rounded-sm bg-muted">
                <div
                  className="h-3 rounded-sm"
                  style={{
                    width: `${Math.max(1, (r.ATE_m_mean / maxAte) * 100)}%`,
                    background: r.rot_noise_deg_per_frame === 0 ? "oklch(0.62 0.15 150)" : "oklch(0.62 0.19 28)",
                  }}
                />
              </div>
              <span className="text-right font-mono tabular-nums">
                {r.ATE_m_mean.toFixed(2)} ± {r.ATE_m_std.toFixed(2)} m
              </span>
            </div>
          ))}
          <p className="pt-2 text-xs text-muted-foreground">
            Per-step noise σ. Translation noise of 5% of every step costs {rows[0].ATE_m_mean.toFixed(2)} m; a rotation error of
            0.05° a step costs {rows[3].ATE_m_mean.toFixed(2)} m. Error at a gap of 11 frames with that rotation noise:{" "}
            {RUN.drift["gap_rmse_m_rot0.05"]["11"]} m; at 1,000 frames: {RUN.drift["gap_rmse_m_rot0.05"]["1000"]} m.
          </p>
        </div>
      )}
      {tab === "abl" && (
        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-[24rem] text-xs tabular-nums">
            <thead>
              <tr className="text-left font-mono text-muted-foreground">
                <th className="pb-1 font-normal">variant</th>
                <th className="pb-1 text-right font-normal">KITTI</th>
                <th className="pb-1 text-right font-normal">Oxford</th>
                <th className="pb-1 text-right font-normal">VBR</th>
              </tr>
            </thead>
            <tbody>
              {ABL.map((a, i) => (
                <tr key={a.label} className={cn(i === ABL.length - 1 && "font-medium")}>
                  <td className="py-0.5 pr-2">{a.label}</td>
                  <td className="text-right font-mono">{a.k.toFixed(2)}</td>
                  <td className="text-right font-mono">{a.o.toFixed(2)}</td>
                  <td className="text-right font-mono">{a.v.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pt-2 text-xs text-muted-foreground">
            Every row keeps the same 12-frame window. The composition loss alone halves KITTI&apos;s ATE; the refiner adds
            4.75M parameters to a model of about 1B.
          </p>
        </div>
      )}
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        A heading error turns every later step, so it grows into position error; a length error does not. That is why the
        paper refines rotation only and supervises chains of up to 11 steps.
      </figcaption>
    </figure>
  )
}
