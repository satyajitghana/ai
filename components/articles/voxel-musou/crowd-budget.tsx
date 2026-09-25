"use client"

import { useMemo, useState } from "react"

// What ?enemies=N changes in voxel-musou (5702d90), counted from the source.
//
// Sim (src/crowd/crowd.js): N + 4 slots (four officers are always added), each
// carrying 39 struct-of-arrays fields — 19 Float64Array and 20 Int32Array — so
// 19·8 + 20·4 = 232 bytes per soldier in crowd.js alone.
//
// Render (src/crowd/view.js): 22 InstancedMeshes, capacities fixed at boot from
// N: 15N + 10·4 instance slots on the lit crowd material (instanceMatrix 64 B +
// instanceColor 12 B + the aHit tint 12 B = 88 B a slot), plus the banner mesh
// (N), the officer markers (4) and the two 32-slot telegraph stars at 76 B a
// slot. Every frame each visible mesh gets needsUpdate = true and no
// updateRanges, and three.js r186 then uploads the whole array
// (gl.bufferSubData(target, 0, array)) — so the bytes scale with the capacity,
// not with how many soldiers are on screen. Upper bound: every mesh visible.
//
// What does not scale: 22 meshes + 4 shadow proxies in the main pass and 16
// shadow casters, the director's target of 84 soldiers on the hero, the ring
// sizes and the attack tokens. Arithmetic only; nothing here runs the game.

const O = 4
const DEFAULT = 300
const MAX = 2000

const simBytes = (g: number) => (g + O) * 232
const slots = (g: number) => 16 * g + 11 * O + 64
const upload = (g: number) => 88 * (15 * g + 10 * O) + 76 * (g + O + 64)

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
const mb = (b: number) => (b / 1e6).toFixed(2)

const ACC = "oklch(0.62 0.14 250)"
const FLAT = "oklch(0.64 0.13 150)"

export function CrowdBudget() {
  const [g, setG] = useState(DEFAULT)

  const rows = useMemo(
    () => [
      { k: "sim slots", v: fmt(g + O), frac: (g + O) / (MAX + O), note: "?enemies + 4 officers" },
      { k: "crowd.js state", v: `${fmt(simBytes(g))} B`, frac: simBytes(g) / simBytes(MAX), note: "232 B per soldier" },
      { k: "instance slots", v: fmt(slots(g)), frac: slots(g) / slots(MAX), note: "allocated at boot, 22 meshes" },
      {
        k: "re-uploaded per frame",
        v: `≤ ${mb(upload(g))} MB`,
        frac: upload(g) / upload(MAX),
        note: `≤ ${mb(upload(g) * 60)} MB/s at 60 fps`,
      },
    ],
    [g]
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">?enemies=N · what it scales</span>
        <span className="font-mono text-[10px] text-muted-foreground">counted from crowd.js + crowd/view.js · not measured</span>
      </div>

      <div className="border-b px-4 py-3">
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">
            ?enemies=<span className="text-foreground tabular-nums">{g}</span>
            {g === DEFAULT ? " (the default)" : ""}
          </span>
          <input
            type="range"
            min={0}
            max={MAX}
            step={50}
            value={g}
            onChange={(e) => setG(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
            aria-label="number of enemy soldiers"
          />
        </label>
      </div>

      <div className="px-4 py-3">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">scales with N</div>
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.k} className="grid grid-cols-[8.5rem_1fr] items-center gap-3 sm:grid-cols-[10rem_1fr_17rem]">
              <span className="font-mono text-[11px] text-muted-foreground">{r.k}</span>
              <div className="h-2.5 overflow-hidden rounded-sm bg-muted/40">
                <div className="h-full rounded-sm" style={{ width: `${(r.frac * 100).toFixed(2)}%`, background: ACC }} />
              </div>
              <span className="col-span-2 font-mono text-[11px] tabular-nums text-foreground sm:col-span-1 sm:text-right">
                {r.v} <span className="text-muted-foreground">· {r.note}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">does not</div>
        <ul className="my-0 list-none space-y-1.5 pl-0 text-xs text-muted-foreground">
          {[
            "draw calls: at most 26 in the main pass (4 of them shadow proxies that write nothing) and 16 in the shadow pass",
            "the director's target: about 84 soldiers on the hero, at most 72 more marching in",
            "the rings: 14–18 in the inner ring, 20–30 in the second row, 3 attack tokens, at most 2 winding up at once",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span aria-hidden className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: FLAT }} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        {g === 0
          ? "At zero the army loop places nobody, but the four officers are placed by a separate loop and still spawn. Reinforcement columns need eight free slots, so none come."
          : g < 84
            ? "Below 84 the director can never reach its target, so it keeps sending blocks until none are left standing."
            : g === DEFAULT
              ? "The default. A bigger N buys more blocks standing in formation at the edge of the frame, not a bigger fight around the hero."
              : "More blocks standing in formation, the same fight around the hero, and a linear rise in the bytes the CPU moves every frame."}
      </p>
    </figure>
  )
}
