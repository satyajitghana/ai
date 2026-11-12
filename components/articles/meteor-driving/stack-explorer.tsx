"use client"

import { useState } from "react"

// Three ways to turn sensors into a trajectory, stage by stage. Columns:
// Autoware's modular stack (the published architecture of autoware_universe),
// METEOR v157 (tier4/METEOR README, hf/MODEL_CARD.md, meteor_v157.param.yaml,
// bevlane/guardrail.py) and AutoE2E v1.0 (Model/README.md and the Hub
// config.json). Each cell says what crosses that boundary, because the
// difference between the stacks is what is hand-specified at each interface.

type Col = "modular" | "meteor" | "autoe2e"

type Stage = {
  id: string
  name: string
  cells: Record<Col, { what: string; learned: "learned" | "rules" | "both" | "absent" }>
}

const COLS: { id: Col; label: string; sub: string }[] = [
  { id: "modular", label: "Modular (Autoware)", sub: "separate nodes, typed messages" },
  { id: "meteor", label: "METEOR v157", sub: "one 54M network, 12 heads" },
  { id: "autoe2e", label: "AutoE2E v1.0", sub: "79.9M, mostly frozen BEVFormer" },
]

const STAGES: Stage[] = [
  {
    id: "sense",
    name: "Sensors in",
    cells: {
      modular: { what: "LiDAR, cameras, radar, GNSS/IMU, each with its own driver node", learned: "rules" },
      meteor: { what: "8 cameras at 768x432, K and T_cam_ego per camera, ego speed v0. LiDAR optional", learned: "rules" },
      autoe2e: { what: "6 cameras at 512x512 (+ a 1024 front view), 8 frames 0.5 s apart, 64 steps of ego history", learned: "rules" },
    },
  },
  {
    id: "loc",
    name: "Localization and map",
    cells: {
      modular: { what: "NDT scan matching against a point-cloud map, plus a Lanelet2 HD map", learned: "rules" },
      meteor: { what: "none at inference; the road, lanes and edges are predicted as a BEV map every frame", learned: "learned" },
      autoe2e: { what: "a 14-channel HD-map raster and a 2-channel route, 450x300 at 0.4 m, both optional", learned: "both" },
    },
  },
  {
    id: "percep",
    name: "Perception",
    cells: {
      modular: { what: "detectors (CenterPoint, YOLOX...) emit object lists with boxes and classes", learned: "learned" },
      meteor: { what: "depth, 2D seg and boxes, BEV lanes, 3D boxes, occupancy: heads on one shared BEV, kept as outputs", learned: "learned" },
      autoe2e: { what: "a BEV feature grid, 300x200; BEV segmentation is an auxiliary training head only", learned: "learned" },
    },
  },
  {
    id: "pred",
    name: "Prediction",
    cells: {
      modular: { what: "a forecaster per tracked object, from the object list", learned: "both" },
      meteor: { what: "per-agent 3 s futures (3 modes) and a parked/stopped flag, from the same BEV", learned: "learned" },
      autoe2e: { what: "implicit: nothing about other agents is output", learned: "absent" },
    },
  },
  {
    id: "plan",
    name: "Planning",
    cells: {
      modular: { what: "behaviour and motion planners over the HD map, rules plus optimisation", learned: "rules" },
      meteor: { what: "3 candidate paths, 6 waypoints at 0.5 s (3 s), with confidences and steer/accel/brake", learned: "learned" },
      autoe2e: { what: "a GRU emits acceleration and curvature for 64 steps at 10 Hz (6.4 s)", learned: "learned" },
    },
  },
  {
    id: "check",
    name: "Safety check",
    cells: {
      modular: { what: "per-module diagnostics, emergency handling, validated in simulation", learned: "rules" },
      meteor: { what: "a rule-based guardrail checks the chosen path against the network's own boxes, occupancy and traffic light, and can veto to a stop", learned: "rules" },
      autoe2e: { what: "a written RSS review in Safety/; no runtime checker in the v1.0 model", learned: "absent" },
    },
  },
  {
    id: "ctrl",
    name: "Control",
    cells: {
      modular: { what: "a controller tracks the planned trajectory (MPC or pure pursuit)", learned: "rules" },
      meteor: { what: "not included: no ROS 2 node yet, outputs are for visualisation and evaluation", learned: "absent" },
      autoe2e: { what: "not included: the trajectory is the output", learned: "absent" },
    },
  },
]

const TONE: Record<string, string> = {
  learned: "oklch(0.68 0.13 250 / 0.22)",
  rules: "oklch(0.75 0.12 80 / 0.25)",
  both: "oklch(0.72 0.1 160 / 0.22)",
  absent: "transparent",
}

const WORD: Record<string, string> = { learned: "learned", rules: "hand-specified", both: "mixed", absent: "absent" }

export function StackExplorer() {
  const [sel, setSel] = useState<string>("percep")
  const [focus, setFocus] = useState<Col | "all">("all")
  const stage = STAGES.find((s) => s.id === sel)!
  const cols = focus === "all" ? COLS : COLS.filter((c) => c.id === focus)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5">
        <span className="mr-1 font-mono text-[11px] text-muted-foreground">show</span>
        {(["all", "modular", "meteor", "autoe2e"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFocus(c)}
            aria-pressed={focus === c}
            className={`rounded-md border px-2 py-0.5 font-mono text-xs ${focus === c ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {c === "all" ? "all three" : COLS.find((x) => x.id === c)!.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto p-3 sm:p-4">
        <table className="w-full min-w-[560px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-[22%] px-2 py-1 text-left font-mono font-normal text-muted-foreground">stage</th>
              {cols.map((c) => (
                <th key={c.id} className="px-2 py-1 text-left font-normal">
                  <div className="font-semibold">{c.label}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{c.sub}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STAGES.map((s) => (
              <tr
                key={s.id}
                onClick={() => setSel(s.id)}
                className={`cursor-pointer border-t align-top ${sel === s.id ? "outline outline-1 outline-foreground/40" : ""}`}
              >
                <td className="px-2 py-1.5 font-mono">
                  <button type="button" onClick={() => setSel(s.id)} aria-pressed={sel === s.id} className="text-left underline-offset-2 hover:underline">
                    {s.name}
                  </button>
                </td>
                {cols.map((c) => {
                  const cell = s.cells[c.id]
                  return (
                    <td key={c.id} className="px-2 py-1.5" style={{ background: TONE[cell.learned] }}>
                      <span className={cell.learned === "absent" ? "text-muted-foreground italic" : undefined}>
                        {sel === s.id || focus !== "all" ? cell.what : WORD[cell.learned]}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          {stage.name}: in the modular stack this boundary is a message someone designed; in METEOR it is{" "}
          {stage.cells.meteor.learned === "absent" ? "missing" : `${WORD[stage.cells.meteor.learned]}`}; in AutoE2E it is{" "}
          {stage.cells.autoe2e.learned === "absent" ? "missing" : WORD[stage.cells.autoe2e.learned]}.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          {(["learned", "rules", "both", "absent"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ background: TONE[k] }} />
              {WORD[k]}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Click a stage to read what crosses it in each stack; the other rows collapse to whether that stage is learned or
        hand-specified. METEOR and AutoE2E cells are from their repositories and model cards; the modular column is
        Autoware Universe&apos;s published architecture, simplified.
      </figcaption>
    </figure>
  )
}
