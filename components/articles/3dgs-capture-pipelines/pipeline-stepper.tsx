"use client"

// Capture-to-splat, stage by stage, with what each of three real pipelines
// chose at that stage. Every value is the publisher's own (REPORTED, from the
// X posts, their threads and replies, and the linked pipeline guide), except
// the training-image count for the dam, which is REASONED from LichtFeld
// Studio's step auto-scale (iterations = 30,000 x images / 300). "not stated"
// means the source does not say, not that the stage was skipped.
// SSR-safe: plain state, no effects, no browser APIs.

import { useState } from "react"

type Pipe = "dam" | "shrine" | "geo"

type Stage = {
  key: string
  label: string
  why: string
  picks: Record<Pipe, string>
}

const PIPES: { key: Pipe; name: string; who: string }[] = [
  { key: "dam", name: "Miho dam", who: "kotohibi_3d" },
  { key: "shrine", name: "Togakushi approach", who: "DuckbillStudio" },
  { key: "geo", name: "Geo-referenced walk", who: "DuckbillStudio" },
]

const STAGES: Stage[] = [
  {
    key: "capture",
    label: "capture",
    why: "A 360 camera sees every direction at once, so one pass along a path covers both sides and the sky. The cost is resolution: 8K spread over a full sphere is far fewer pixels per degree than a normal lens.",
    picks: {
      dam: "DJI Avata 360 drone, 14:34 of 8K D-Log M video",
      shrine: "DJI Osmo 360 on foot, 2 km in 40 min, 10 clips; just under 400 extra stills at the gate",
      geo: "several Osmo 360s, shutter and phone GPS pushed over Bluetooth by an Android app",
    },
  },
  {
    key: "projection",
    label: "projection",
    why: "The same sphere can be stored as two fisheye circles, one equirectangular (ERP) panorama, or six cube faces. SfM wants one rigid camera per instant; most 3DGS trainers want pinhole images.",
    picks: {
      dam: "ERP for alignment, then six 90° cube faces per frame for training",
      shrine: "10 clips merged into 3 ERP videos in DJI Studio (LUT applied); dual-fisheye .osv would not fully align",
      geo: "geotagged .osv, optionally ERP from DJI Studio with the location carried over",
    },
  },
  {
    key: "frames",
    label: "frames + masks",
    why: "Video gives far more frames than SfM needs. Keep the sharpest per interval, and mask the operator, the drone's own parts and the stitch seam so they never become tie points or splats.",
    picks: {
      dam: "875 masked frames from the author's own tools",
      shrine: "around 5,000 images, 8K equirectangular",
      geo: "not stated",
    },
  },
  {
    key: "sfm",
    label: "SfM",
    why: "Structure from motion solves every camera pose and a sparse point cloud. A spherical camera model treats the whole panorama as one camera, so the two lenses never have to be discovered as a rig.",
    picks: {
      dam: "Metashape Standard, spherical camera, masks on key points, tie points cleaned in three passes",
      shrine: "Spirula Studio, all frames in one go, every image aligned",
      geo: "Spirula Studio with a weak per-frame GPS position prior",
    },
  },
  {
    key: "scale",
    label: "scale",
    why: "Images alone fix a scene only up to scale, rotation and translation. A known-size marker or a metric sensor pins the scale; GPS also pins where on Earth it is.",
    picks: {
      dam: "AprilTags on the ground, detected in the cube faces",
      shrine: "not stated",
      geo: "GPS through the SfM prior, then rescaled into geo-referenced 3D Tiles",
    },
  },
  {
    key: "train",
    label: "train",
    why: "3DGS optimises millions of anisotropic Gaussians against the posed images. Splat cap and SH degree set the file size and the VRAM; iterations scale with image count.",
    picks: {
      dam: "LichtFeld Studio, 15M splats, SH2, MRNF, PPISP; 481,300 iterations, about 14 h on an RTX 4090 (about 4,813 images, reasoned)",
      shrine: "Spirula Studio, no block splitting, on an RTX 4090",
      geo: "Spirula Studio",
    },
  },
  {
    key: "deliver",
    label: "deliver",
    why: "A trained scene is a big PLY. Shipping it means compressing it (SOG, SPZ) or tiling it (3D Tiles), and a renderer that can draw millions of translucent splats at frame rate.",
    picks: {
      dam: "camera path rendered in LichtFeld Studio; SuperSplat upload promised",
      shrine: "rendered fly-through video",
      geo: "optional SuperSplat edit, 3D Tiles, shown in a map viewer over terrain",
    },
  },
]

const ACCENT = "oklch(0.62 0.15 200)"

export function PipelineStepper() {
  const [i, setI] = useState(0)
  const stage = STAGES[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>capture → splat, three real pipelines</span>
        <span className="text-muted-foreground/60">reported</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Pipeline stage">
          {STAGES.map((s, k) => {
            const on = k === i
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setI(k)}
                className={
                  "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors " +
                  (on ? "text-background" : "bg-background/50 text-muted-foreground hover:text-foreground")
                }
                style={on ? { background: ACCENT, borderColor: ACCENT } : undefined}
              >
                {k + 1}. {s.label}
              </button>
            )
          })}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{stage.why}</p>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PIPES.map((p) => {
            const v = stage.picks[p.key]
            const missing = v === "not stated"
            return (
              <div key={p.key} className="rounded-lg border bg-background/60 px-3 py-2.5">
                <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {p.name}
                  <span className="normal-case text-muted-foreground/60"> · @{p.who}</span>
                </div>
                <div className={"mt-1 text-sm leading-snug " + (missing ? "italic text-muted-foreground/70" : "text-foreground")}>
                  {v}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setI((k) => Math.max(0, k - 1))}
            disabled={i === 0}
            className="rounded border px-2 py-0.5 disabled:opacity-40"
          >
            ← prev
          </button>
          <span>
            stage {i + 1} of {STAGES.length}
          </span>
          <button
            type="button"
            onClick={() => setI((k) => Math.min(STAGES.length - 1, k + 1))}
            disabled={i === STAGES.length - 1}
            className="rounded border px-2 py-0.5 disabled:opacity-40"
          >
            next →
          </button>
        </div>
      </div>
    </figure>
  )
}
