"use client"

// How one BlenderWorld task is scored. The eleven criteria, their weights and
// their evidence routes are task bw_0160's real rubric (the Chesterfield sofa
// brief), MEASURED from tests/dataset/tasks/bw_0160/rubric.json in the
// Qwen/BlenderWorld Hugging Face repo (revision e67837a). The arithmetic is the
// evaluator's: build_score_summary() for the weighted pass rate, 10 x mean of
// eight 1-10 ratings for the dimension score, an unweighted mean of the two,
// and for scene_summary criteria the Agent-as-Judge's cross-check, where the
// criterion passes only if every applicable sub-verdict (bpy, visual) passes.
//
// SSR-safe: plain state, no effects. Numbers use + - * / only.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

type Route = "scene_summary" | "render"
type Check = "pass" | "fail" | "na"
type Crit = { id: string; label: string; cat: string; w: number; route: Route; bpy: Check; vis: Check }

const BASE: Crit[] = [
  { id: "R01", label: "Chesterfield body, 2200 x 950 x 750 mm", cat: "holistic", w: 3, route: "scene_summary", bpy: "pass", vis: "pass" },
  { id: "R02", label: "Turned 150 mm wood legs + brass casters", cat: "geometry", w: 3, route: "scene_summary", bpy: "pass", vis: "pass" },
  { id: "R03", label: "Diamond tufting at ~180 mm", cat: "geometry", w: 3, route: "scene_summary", bpy: "pass", vis: "pass" },
  { id: "R04", label: "Double-row brass nailheads", cat: "layout", w: 2, route: "scene_summary", bpy: "pass", vis: "pass" },
  { id: "R05", label: "Exactly three piped cushions", cat: "count", w: 3, route: "render", bpy: "na", vis: "pass" },
  { id: "R06", label: "Aniline leather PBR material", cat: "material", w: 3, route: "scene_summary", bpy: "pass", vis: "pass" },
  { id: "R07", label: "Three-point studio + HDRI", cat: "lighting", w: 3, route: "scene_summary", bpy: "pass", vis: "pass" },
  { id: "R08", label: "85 mm lens, three-quarter view", cat: "composition", w: 3, route: "scene_summary", bpy: "pass", vis: "pass" },
  { id: "R09", label: "Final PNG at exactly 3840 x 2160", cat: "function", w: 3, route: "scene_summary", bpy: "pass", vis: "na" },
  { id: "R10", label: "Editable .blend, Cycles saved", cat: "function", w: 3, route: "scene_summary", bpy: "pass", vis: "na" },
  { id: "R11", label: "Holds up under enlargement", cat: "holistic", w: 3, route: "render", bpy: "na", vis: "pass" },
]

const DIMS = [
  "Scene fidelity",
  "Physical plausibility",
  "Style and color",
  "Realism",
  "Spatial layout",
  "Proportion and scale",
  "Lighting and materials",
  "Completeness",
]

type Preset = { key: string; label: string; apply: (c: Crit) => Crit; dims: number[] }

const ALL7 = [7, 7, 7, 7, 7, 7, 7, 7]
const PRESETS: Preset[] = [
  { key: "clean", label: "everything passes", apply: (c) => c, dims: ALL7 },
  {
    key: "drift",
    label: "102 mm timber, 50 mm lens",
    apply: (c) =>
      c.id === "R02" ? { ...c, bpy: "fail" } : c.id === "R08" ? { ...c, bpy: "fail" } : c,
    dims: ALL7,
  },
  {
    key: "grey",
    label: "brass in bpy, grey on screen",
    apply: (c) => (c.id === "R02" ? { ...c, bpy: "pass", vis: "fail" } : c),
    dims: ALL7,
  },
]

const ACCENT = "oklch(0.58 0.13 250)"
const PASS = "oklch(0.62 0.14 150)"
const FAIL = "oklch(0.62 0.18 30)"

const verdict = (c: Crit) => {
  const applicable = [c.bpy, c.vis].filter((v) => v !== "na")
  return applicable.length > 0 && applicable.every((v) => v === "pass") ? 1 : 0
}
const next = (v: Check, allowNa: boolean): Check =>
  v === "pass" ? "fail" : v === "fail" ? (allowNa ? "na" : "pass") : "pass"
const f2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2)

export function RubricScorer() {
  const [crits, setCrits] = useState<Crit[]>(BASE)
  const [dims, setDims] = useState<number[]>(ALL7)
  const [preset, setPreset] = useState("clean")

  const wSum = crits.reduce((s, c) => s + c.w, 0)
  const wPass = crits.reduce((s, c) => s + c.w * verdict(c), 0)
  const rubric = (100 * wPass) / wSum
  const dimScore = (10 * dims.reduce((s, d) => s + d, 0)) / dims.length
  const fused = 0.5 * rubric + 0.5 * dimScore

  const toggle = (id: string, which: "bpy" | "vis") => {
    setPreset("")
    setCrits((cs) =>
      cs.map((c) => {
        if (c.id !== id) return c
        if (c.route === "render") return { ...c, vis: c.vis === "pass" ? "fail" : "pass" }
        return { ...c, [which]: next(c[which], true) }
      }),
    )
  }

  const chip = (v: Check, onClick: () => void, title: string) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title + ": " + v}
      className="w-11 rounded border px-1 py-0.5 text-center font-mono text-[10px]"
      style={
        v === "na"
          ? { opacity: 0.5 }
          : { color: "white", background: v === "pass" ? PASS : FAIL, borderColor: v === "pass" ? PASS : FAIL }
      }
    >
      {v === "na" ? "n/a" : v}
    </button>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>bw_0160 · Chesterfield sofa · 11 criteria</span>
        <span className="text-muted-foreground/70">rubric measured from the dataset; verdicts are yours</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets">
          {PRESETS.map((p) => {
            const on = preset === p.key
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setPreset(p.key)
                  setCrits(BASE.map(p.apply))
                  setDims(p.dims)
                }}
                className={
                  "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors " +
                  (on ? "text-background" : "bg-background/50 text-muted-foreground hover:text-foreground")
                }
                style={on ? { background: ACCENT, borderColor: ACCENT } : undefined}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">id</th>
                <th className="py-1 pr-2 font-normal">criterion</th>
                <th className="py-1 pr-2 font-normal">w</th>
                <th className="py-1 pr-2 font-normal">judge</th>
                <th className="py-1 pr-2 font-normal">bpy</th>
                <th className="py-1 pr-2 font-normal">visual</th>
                <th className="py-1 font-normal">score</th>
              </tr>
            </thead>
            <tbody>
              {crits.map((c) => {
                const s = verdict(c)
                return (
                  <tr key={c.id} className="border-t border-border/50">
                    <td className="py-1 pr-2">{c.id}</td>
                    <td className="py-1 pr-2">
                      {c.label}
                      <span className="block text-[10px] text-muted-foreground">{c.cat}</span>
                    </td>
                    <td className="py-1 pr-2 tabular-nums">{c.w}</td>
                    <td className="py-1 pr-2 text-muted-foreground">{c.route === "render" ? "VLM" : "agent"}</td>
                    <td className="py-1 pr-2">
                      {c.route === "render" ? (
                        <span className="text-muted-foreground/60">-</span>
                      ) : (
                        chip(c.bpy, () => toggle(c.id, "bpy"), c.id + " bpy check")
                      )}
                    </td>
                    <td className="py-1 pr-2">{chip(c.vis, () => toggle(c.id, "vis"), c.id + " visual check")}</td>
                    <td className="py-1 font-semibold tabular-nums" style={{ color: s ? PASS : FAIL }}>
                      {s}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {DIMS.map((d, i) => (
            <label key={d} className="grid grid-cols-[9.5rem_1fr_1.5rem] items-center gap-2 font-mono text-[11px]">
              <span className="truncate">{d}</span>
              <Range
                min={1}
                max={10}
                step={1}
                value={dims[i]}
                aria-label={d}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setPreset("")
                  setDims((ds) => ds.map((x, j) => (j === i ? v : x)))
                }}
              />
              <span className="text-right tabular-nums">{dims[i]}</span>
            </label>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center font-mono">
          {[
            ["rubric", rubric, `100 x ${wPass} / ${wSum}`],
            ["dimension", dimScore, "10 x mean of 8"],
            ["fused", fused, "0.5 R + 0.5 D"],
          ].map(([k, v, sub]) => (
            <div key={k as string} className="rounded-lg border bg-background/60 px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k as string}</div>
              <div className="text-lg tabular-nums" style={k === "fused" ? { color: ACCENT } : undefined}>
                {f2(v as number)}
              </div>
              <div className="text-[10px] text-muted-foreground">{sub as string}</div>
            </div>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        Click a chip to cycle pass, fail, n/a. Nine of the eleven criteria go to the scene-inspection
        agent, which must give a bpy verdict and, where the property is visible, a visual one; the
        criterion scores 1 only if every applicable sub-verdict passes. Weights sum to 32, so one
        missed weight-3 criterion costs 9.375 rubric points and 4.6875 fused points.
      </figcaption>
    </figure>
  )
}
