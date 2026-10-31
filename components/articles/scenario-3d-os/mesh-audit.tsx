"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Topology metrics for five procedural meshes, computed by our own re-implementation
// of the definitions in bx_audit.py (interior vertices only for valence; poles are
// valence 3 and 5+). The repository's own script needs Blender's bmesh and was not run.

type M = {
  id: string
  label: string
  verts: number
  faces: number
  quads: number
  e3: number
  e5: number
  v6: number
  cv: number
  note: string
  val: [number, number][]
}

const MESHES: M[] = [
  { id: "cube", label: "cube sphere, 16 per side", verts: 1538, faces: 1536, quads: 100, e3: 8, e5: 0, v6: 0, cv: 0.19, note: "All quads, eight valence-3 corners. The shape a studio base mesh starts from.", val: [[3, 8], [4, 1530]] },
  { id: "cubew", label: "cube sphere, density warped", verts: 1538, faces: 1536, quads: 100, e3: 8, e5: 0, v6: 0, cv: 0.388, note: "Same topology, loops pushed toward the corners. Valence is unchanged; only edge-length spread moves.", val: [[3, 8], [4, 1530]] },
  { id: "uv", label: "UV sphere, 48 by 24", verts: 1106, faces: 1152, quads: 91.67, e3: 0, e5: 2, v6: 2, cv: 0.313, note: "Two 48-valent poles fan out into 96 triangles. The audit's valence-6-plus rule flags exactly the two poles.", val: [[4, 1104], [48, 2]] },
  { id: "ico3", label: "icosphere, 3 subdivisions", verts: 642, faces: 1280, quads: 0, e3: 0, e5: 642, v6: 630, cv: 0.065, note: "Pure triangles. Every vertex is valence 5 or 6, so the quad-oriented pole counts read as noise.", val: [[5, 12], [6, 630]] },
  { id: "ico4", label: "icosphere, 4 subdivisions", verts: 2562, faces: 5120, quads: 0, e3: 0, e5: 2562, v6: 2550, cv: 0.065, note: "Four times the faces, same verdict: a triangle mesh is not a bad mesh, the quad rules just do not apply to it.", val: [[5, 12], [6, 2550]] },
]

function verdict(m: M) {
  const out: { rule: string; ok: boolean; got: string }[] = [
    { rule: "quads at least 98 percent", ok: m.quads >= 98, got: `${m.quads}%` },
    { rule: "no vertex with 6 or more edges", ok: m.v6 === 0, got: String(m.v6) },
    { rule: "pole density under 5 percent", ok: ((m.e3 + m.e5) / m.faces) * 100 < 5, got: `${(((m.e3 + m.e5) / m.faces) * 100).toFixed(2)}%` },
  ]
  return out
}

export function MeshAudit() {
  const [id, setId] = useState("cube")
  const m = MESHES.find((x) => x.id === id) ?? MESHES[0]
  const maxC = Math.max(...m.val.map((v) => v[1]))
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>topology audit, five procedural meshes</span>
        <span className="text-muted-foreground/50">measured, our reimplementation</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {MESHES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setId(x.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                id === x.id ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">interior vertices by valence</div>
            <div className="space-y-1.5">
              {m.val.map(([k, c]) => (
                <div key={k} className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="w-14 shrink-0 text-muted-foreground">valence {k}</span>
                  <div className="h-3 flex-1 rounded-sm bg-muted/40">
                    <div className="h-3 rounded-sm" style={{ width: `${(c / maxC) * 100}%`, background: k === 4 ? "oklch(0.62 0.14 150)" : "oklch(0.60 0.19 25)" }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-foreground">{c}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{m.note}</p>
          </div>
          <ul className="space-y-1.5 font-mono text-[11px]">
            {verdict(m).map((v) => (
              <li key={v.rule} className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5">
                <span className="text-muted-foreground">{v.rule}</span>
                <span className={v.ok ? "text-foreground" : "text-[oklch(0.60_0.19_25)]"}>{v.ok ? "pass" : "flag"} · {v.got}</span>
              </li>
            ))}
            <li className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5">
              <span className="text-muted-foreground">edge length spread (cv)</span>
              <span className="text-foreground">{m.cv}</span>
            </li>
            <li className="px-1 pt-1 text-[10px] text-muted-foreground">The pass and flag bands are the docstring values for deforming characters, applied by us.</li>
          </ul>
        </div>
      </div>
    </figure>
  )
}
