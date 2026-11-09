"use client"

// Who owns each stage of OOOSplat's pipeline, read from the repository at commit
// 82d4620 (src-tauri/src/engines/*.rs, engines/manifest.linux.json,
// config/pipeline-optimization.json, html-viewer/*). Each stage says whether the
// code is OOOSplat's own or a pinned third-party engine it drives, the flags it
// passes, and what I did with it in this article: ran it, re-implemented it, or
// only read it. No numbers here are estimated.

import { useState } from "react"

type Owner = "theirs" | "wrapped"
type Did = "ran" | "reimplemented" | "read"

type Stage = {
  id: string
  name: string
  owner: Owner
  engine: string
  licence: string
  detail: string[]
  did: Did
  didNote: string
}

const STAGES: Stage[] = [
  {
    id: "frames",
    name: "Frames",
    owner: "theirs",
    engine: "Rust frame plan + FFmpeg / FFprobe",
    licence: "Apache-2.0 / LGPL",
    detail: [
      "FFprobe reads the video; OOOSplat's own frame plan picks frame indices.",
      "Target 6 / 8 / 12 fps for Fast / Balanced / Detailed, raised so a short clip still gets 30 frames, never above the source fps.",
      "FFmpeg only decodes the frames it is told to.",
    ],
    did: "reimplemented",
    didNote: "Frame-count arithmetic re-implemented in the second widget.",
  },
  {
    id: "features",
    name: "Features + matching",
    owner: "wrapped",
    engine: "COLMAP 4.2.1",
    licence: "BSD-3-Clause",
    detail: [
      "feature_extractor: SIMPLE_RADIAL, one shared camera, SIFT long edge 1,200 / 1,600 / 3,200, at most 4,096 / 8,192 / 16,384 features.",
      "Video: sequential_matcher, overlap 10, COLMAP's default quadratic overlap left on.",
      "Images: exhaustive_matcher up to 100 images; above that, the user is asked whether filenames follow capture order.",
    ],
    did: "ran",
    didNote: "Ran with pycolmap 4.2.1 on CPU, same COLMAP version.",
  },
  {
    id: "mapper",
    name: "Camera solve",
    owner: "wrapped",
    engine: "COLMAP mapper (Ceres, or Caspar on CUDA)",
    licence: "BSD-3-Clause",
    detail: [
      "Incremental mapper. Bundle adjustment on Ceres, CPU.",
      "Global Caspar BA only with at least 2,000,000 keypoints and 2,000,000 verified matches and a passing GPU probe.",
      "No GLOMAP: a test asserts global_mapper is never passed.",
    ],
    did: "ran",
    didNote: "Ran the incremental mapper on 30 rendered frames.",
  },
  {
    id: "bridge",
    name: "Bridge frames + budget",
    owner: "theirs",
    engine: "OOOSplat planner (Rust)",
    licence: "Apache-2.0",
    detail: [
      "Below 80% registration: one retry with up to 20% extra frames from the unregistered gaps.",
      "Detailed splat ceiling = 0.5 x sqrt(2462476 x 0.063362106 x pixels / mean track length).",
      "A ceiling, not a target; it is never below the initial point count.",
    ],
    did: "reimplemented",
    didNote: "Formula reproduced to the splat on their own logged example.",
  },
  {
    id: "train",
    name: "Training",
    owner: "wrapped",
    engine: "OOOBrush ooo-v1.0.0 (a pinned Brush fork)",
    licence: "Apache-2.0",
    detail: [
      "brush_app CLI on Burn + wgpu: Vulkan on Windows and Linux, Metal on macOS.",
      "8,000 / 15,000 / 30,000 iterations, refine every 200; SH degree left at Brush's default (pinned to 3 only for panoramas).",
      "Reads COLMAP's sparse model directly; OOOSplat runs no undistortion step.",
    ],
    did: "read",
    didNote: "Not run: no GPU here, and CPU-only Vulkan is unvalidated upstream too.",
  },
  {
    id: "view",
    name: "Preview + edit",
    owner: "theirs",
    engine: "React + PlayCanvas 2.21.4",
    licence: "Apache-2.0 / MIT",
    detail: [
      "PlayCanvas draws the splats (WebGPU or WebGL2). Selection, crop, delete, undo are OOOSplat's.",
      "Edits are a mask and a transform; final.ply is never rewritten.",
    ],
    did: "read",
    didNote: "Read only.",
  },
  {
    id: "html",
    name: "HTML export",
    owner: "theirs",
    engine: "Rust packer + PlayCanvas runtime",
    licence: "Apache-2.0 / MIT",
    detail: [
      "Writes the edited model as a standard float PLY, base64 in 768 KiB <script> chunks.",
      "The viewer runtime is inlined as base64 too; licences go at the end in a <details> block.",
      "No network requests, so it opens from file://.",
    ],
    did: "reimplemented",
    didNote: "Packer re-implemented byte for byte; runtime bundled; rendering it in Chromium was refused.",
  },
]

const THEIRS = "oklch(0.62 0.15 200)"
const WRAPPED = "oklch(0.68 0.15 55)"
const DID_LABEL: Record<Did, string> = { ran: "ran it", reimplemented: "re-implemented", read: "read only" }

export function OwnershipMap() {
  const [sel, setSel] = useState("features")
  const s = STAGES.find((x) => x.id === sel) ?? STAGES[0]
  const W = 700
  const boxW = 88
  const gap = (W - 20 - STAGES.length * boxW) / (STAGES.length - 1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>whose code runs at each stage</span>
        <span className="text-muted-foreground/60">read from the repo · commit 82d4620</span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <svg viewBox={`0 0 ${W} 96`} className="w-full" role="img" aria-label="Seven pipeline stages from frames to HTML export, coloured by whether OOOSplat wrote the code or wraps a third-party engine. Select a stage for details.">
          {STAGES.map((st, i) => {
            const x = 10 + i * (boxW + gap)
            const on = st.id === sel
            const c = st.owner === "theirs" ? THEIRS : WRAPPED
            return (
              <g key={st.id} onClick={() => setSel(st.id)} style={{ cursor: "pointer" }}>
                {i > 0 && <line x1={x - gap + 2} x2={x - 2} y1={40} y2={40} stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />}
                <rect x={x} y={14} width={boxW} height={52} rx={6} fill={c} fillOpacity={on ? 0.9 : 0.25} stroke={c} strokeWidth={on ? 2 : 1} />
                {st.name.split(" ").reduce<string[]>((lines, w) => {
                  const last = lines[lines.length - 1]
                  if (last && (last + " " + w).length <= 11) lines[lines.length - 1] = last + " " + w
                  else lines.push(w)
                  return lines
                }, []).map((ln, k, arr) => (
                  <text key={k} x={x + boxW / 2} y={42 - (arr.length - 1) * 6 + k * 12} fontSize={10.5} textAnchor="middle" className={on ? "fill-background font-mono" : "fill-foreground font-mono"}>
                    {ln}
                  </text>
                ))}
                <text x={x + boxW / 2} y={84} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">
                  {DID_LABEL[st.did]}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="flex flex-wrap gap-1.5 font-mono text-xs">
          {STAGES.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSel(st.id)}
              aria-pressed={sel === st.id}
              className={"rounded border px-2 py-0.5 " + (sel === st.id ? "text-background" : "bg-background/50")}
              style={sel === st.id ? { background: st.owner === "theirs" ? THEIRS : WRAPPED, borderColor: "transparent" } : undefined}
            >
              {st.name}
            </button>
          ))}
        </div>
        <div className="rounded-lg border bg-background/50 px-3 py-2.5 text-sm leading-relaxed">
          <div className="mb-1.5 font-mono text-xs text-muted-foreground">
            <span style={{ color: s.owner === "theirs" ? THEIRS : WRAPPED }}>{s.owner === "theirs" ? "OOOSplat's own code" : "wrapped engine"}</span>
            {" · "}
            <span className="text-foreground">{s.engine}</span>
            {" · "}
            {s.licence}
          </div>
          <ul className="list-disc space-y-1 pl-5">
            {s.detail.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            in this article: <span className="text-foreground">{DID_LABEL[s.did]}</span>. {s.didNote}
          </p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          <span style={{ color: THEIRS }}>■</span> OOOSplat&apos;s code{"   "}
          <span style={{ color: WRAPPED }}>■</span> pinned third-party engine it drives
        </p>
      </div>
    </figure>
  )
}
