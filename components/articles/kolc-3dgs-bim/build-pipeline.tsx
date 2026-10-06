"use client"

// A KOLC+-like splat + BIM pipeline built from open parts, stage by stage: the
// tool I would pick, what goes in and comes out, the licence I read in the
// tool's own repository (LICENSE/COPYING/README, early October 2026), and what
// KOLC+ does at the same stage according to its press release and product
// pages. Licences are as read, not legal advice. SSR-safe: plain state only.

import { useState } from "react"

type Stage = {
  key: string
  label: string
  tool: string
  alt: string
  io: string
  licence: string
  warn?: boolean
  kolc: string
  note: string
}

const STAGES: Stage[] = [
  {
    key: "capture",
    label: "capture",
    tool: "DJI Osmo 360 or Insta360 X5, 8K equirectangular video; printed AprilTags plus surveyed targets",
    alt: "a LiDAR + camera rig (XGRIDS-style) where the earthwork tolerance demands it",
    io: ".OSV / .insv → ERP .mp4, GCP list in the site CRS",
    licence: "hardware; GCPs shot with RTK GNSS or a total station",
    kolc: "KOLC+ does not capture. The press release says customers scan with XGRIDS and export .lcc from LCC Studio.",
    note: "Put at least five targets around the perimeter and at two heights. Three is the minimum for a similarity; the extra ones are your check points.",
  },
  {
    key: "sfm",
    label: "SfM + priors",
    tool: "Spirula Studio, ERP as one spherical camera, GPS as a weak per-frame prior",
    alt: "COLMAP pose_prior_mapper or its global mapper (GLOMAP is now inside COLMAP)",
    io: "ERP frames + GPS → COLMAP-format cameras, images, sparse points",
    licence: "Spirula Studio GPLv3 · COLMAP BSD-3-Clause",
    kolc: "Not applicable: XGRIDS' own SLAM produces the poses before KOLC+ sees the file.",
    note: "GPS fixes scale and coarse placement; it does not make the model survey-grade. That is the next stage's job.",
  },
  {
    key: "train",
    label: "3DGS train",
    tool: "gsplat (3DGS for looks, its 2DGS rasteriser when geometry matters)",
    alt: "LichtFeld Studio or Spirula Studio's trainer; PGSR or GOF only for research",
    io: "posed images → .ply (one per epoch)",
    licence: "gsplat Apache-2.0 · LichtFeld GPLv3 · Inria 3DGS, 2DGS, GOF: non-commercial · PGSR: non-commercial",
    warn: true,
    kolc: "Not applicable: the splat arrives trained.",
    note: "The reference implementations of 2DGS and Gaussian Opacity Fields carry Inria's non-commercial licence. gsplat's own 2DGS path is the commercial-safe one.",
  },
  {
    key: "georef",
    label: "georeference",
    tool: "Umeyama similarity from GCPs (COLMAP model_aligner, or 30 lines of numpy), then ICP",
    alt: "Open3D or small_gicp point-to-plane ICP against a TLS scan or the BIM's floor and wall faces",
    io: "splat + GCPs → 4x4 similarity into JGD2011 plane rectangular (or your EPSG)",
    licence: "COLMAP BSD-3 · Open3D MIT",
    kolc: "Reported: a move/rotate tool and 3-point matching to a BIM model; data already in public coordinates lands in place automatically.",
    note: "Report the residual at the check points, not at the points you fitted.",
  },
  {
    key: "bim",
    label: "Revit → IFC",
    tool: "Revit IFC exporter, IFC4 with an EPSG code set, so it writes IfcMapConversion",
    alt: "Autodesk Platform Services Model Derivative for SVF2 geometry + properties (a paid cloud API)",
    io: ".rvt → .ifc; IfcOpenShell geometry iterator → per-element meshes keyed by GlobalId, Tag = Revit ElementId",
    licence: "revit-ifc LGPL-2.0 · IfcOpenShell LGPL-3.0 · APS proprietary",
    kolc: "Reported: Revit, IFC, Navisworks, SketchUp, Civil 3D, LandXML in one space.",
    note: "Pick the coordinate base deliberately. 'Shared coordinates' plus an EPSG code puts the survey point's eastings, northings and true-north angle into IfcMapConversion.",
  },
  {
    key: "volume",
    label: "earthwork",
    tool: "Splat → filtered points or depth renders → DEM per epoch (PDAL writers.gdal), difference in numpy",
    alt: "a 2DGS/TSDF mesh rasterised to a DEM; LandXML or IFC design surface as the reference",
    io: "two DEMs (GeoTIFF) → cut, fill, net in m³ by the point-height method",
    licence: "PDAL BSD · GDAL MIT · rasterio BSD-3",
    kolc: "Reported: BIM vs 3DGS or two epochs of 3DGS, a 0.5 m grid in the screenshot; product page names MLIT's point-height method and a median mode.",
    note: "The DEM step is where you choose what 'ground' is: lowest return, median, or opacity-weighted depth. Vegetation and floaters live there.",
  },
  {
    key: "section",
    label: "sections + DXF",
    tool: "Slice the Gaussians by a plane (closed-form ellipses), or slice the extracted mesh",
    alt: "trimesh section on the 2DGS mesh",
    io: "plane → polylines in site coordinates → .dxf (3D, large coordinates, or flattened 2D)",
    licence: "ezdxf MIT · trimesh MIT",
    kolc: "Reported: automatic tracing of a section, editable on screen, DXF out in public coordinates or flattened to XY.",
    note: "Write 3D polylines in the CRS and one layer per source (splat, IFC category), which is what KOLC+'s AutoCAD screenshot shows for BIM.",
  },
  {
    key: "deliver",
    label: "web viewer",
    tool: "splat-transform → streamed SOG (LOD); PlayCanvas engine for splats + That Open Engine (web-ifc) for IFC",
    alt: "Spark on three.js with the same IFC loader; CesiumJS for glTF splats (KHR_gaussian_splatting) in 3D Tiles",
    io: ".ply → lod-meta.json + SOG chunks; .ifc → fragments; one manifest per epoch for the 4D slider",
    licence: "splat-transform, PlayCanvas, SuperSplat MIT · Spark MIT · That Open components MIT, web-ifc MPL-2.0 · CesiumJS Apache-2.0",
    kolc: "Reported: LoD streaming, PLY/SPZ/SPLAT/KSPLAT/SOG in the standalone viewer, .lcc in the integrated app.",
    note: "This is the stage with no off-the-shelf answer: one depth buffer shared by splats and IFC meshes, picking that returns either a GlobalId or a splat depth.",
  },
]

const ACCENT = "oklch(0.6 0.14 250)"

export function BuildPipeline() {
  const [i, setI] = useState(0)
  const s = STAGES[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>splat + BIM from open parts</span>
        <span className="text-muted-foreground/60">licences as read in each repo</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Pipeline stage">
          {STAGES.map((st, k) => {
            const on = k === i
            return (
              <button
                key={st.key}
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
                {k + 1}. {st.label}
              </button>
            )
          })}
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="font-mono text-xs uppercase tracking-wide text-muted-foreground">pick</dt>
          <dd className="text-foreground">{s.tool}</dd>
          <dt className="font-mono text-xs uppercase tracking-wide text-muted-foreground">or</dt>
          <dd className="text-muted-foreground">{s.alt}</dd>
          <dt className="font-mono text-xs uppercase tracking-wide text-muted-foreground">in → out</dt>
          <dd className="font-mono text-xs leading-relaxed">{s.io}</dd>
          <dt className="font-mono text-xs uppercase tracking-wide text-muted-foreground">licence</dt>
          <dd className={"text-xs leading-relaxed " + (s.warn ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
            {s.licence}
          </dd>
          <dt className="font-mono text-xs uppercase tracking-wide text-muted-foreground">KOLC+</dt>
          <dd className="text-xs leading-relaxed text-muted-foreground">{s.kolc}</dd>
        </dl>
        <p className="mt-3 border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground" style={{ borderColor: ACCENT }}>
          {s.note}
        </p>

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
