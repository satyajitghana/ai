"use client"

import { useState } from "react"

// Saluki against the file it was built from, tensor by tensor.
//
// Read from the two GGUF headers over HTTP range requests:
//   ConwayResearch/Underdog-Saluki-27B-1.0 / Underdog-Saluki-27B-1.0-IQ2-mix.gguf
//   ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF  / Qwen3.8-27B-GSQ-RCO-IQ2_XS.gguf
// One letter per block (0-63) per projection; "." where a block has no such
// projection (48 blocks are Gated DeltaNet, every fourth block is full
// attention). The scale-tuning layer is a byte diff of the same tensors: in
// all 352 quantized tensors whose type did not change, no code byte differs,
// and about 98% of the fp16 block scales do.

type Code = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j"

const TYPES: Record<Code, { name: string; bpw: number }> = {
  a: { name: "IQ1_S", bpw: 1.5625 },
  b: { name: "IQ1_M", bpw: 1.75 },
  c: { name: "IQ2_XXS", bpw: 2.0625 },
  d: { name: "IQ2_XS", bpw: 2.3125 },
  e: { name: "IQ2_S", bpw: 2.5625 },
  f: { name: "Q2_K", bpw: 2.625 },
  g: { name: "IQ3_XXS", bpw: 3.0625 },
  h: { name: "IQ3_S", bpw: 3.4375 },
  i: { name: "IQ4_XS", bpw: 4.25 },
  j: { name: "Q4_K", bpw: 4.5 },
}

type Role = { key: string; label: string; ista: string; saluki: string }

const ROLES: Role[] = [
  { key: "qkv", label: "DeltaNet qkv", ista: "hba.cbe.bbc.bcc.fcd.efc.cae.ddd.dde.edd.ccc.dee.dfg.fge.cgf.ccf.", saluki: "hba.cbe.bbc.bcc.fcd.efc.cae.ddd.dde.edd.ccc.dee.dfg.fge.cgf.ccf." },
  { key: "gate", label: "DeltaNet gate", ista: "hba.eba.afb.fbb.bbb.dfb.eab.dcb.fcf.efd.gfc.fah.ccf.ffd.gec.adc.", saluki: "hba.eba.afb.fbb.bbb.dfb.eab.dcb.fcf.efd.gfc.fah.ccf.ffd.gec.adc." },
  { key: "out", label: "DeltaNet out", ista: "ieh.ech.edd.eee.dgg.dhd.dcd.fge.dgh.edf.cge.eeh.fgh.hhf.hhg.ehh.", saluki: "ieh.ech.edd.eee.dgg.dhd.dcd.fge.dgh.edf.cge.eeh.fgh.hhf.hhg.ehh." },
  { key: "q", label: "attn q", ista: "...c...f...f...c...f...c...f...f...f...c...f...c...c...c...c...f", saluki: "...c...f...f...c...f...c...f...f...f...c...f...c...c...c...c...f" },
  { key: "k", label: "attn k", ista: "...c...b...j...g...d...g...e...f...i...i...h...h...g...h...h...h", saluki: "...c...b...j...g...d...g...e...f...i...i...h...h...g...h...h...h" },
  { key: "v", label: "attn v", ista: "...e...j...a...b...g...g...h...g...g...i...h...h...j...h...i...h", saluki: "...e...j...a...b...g...g...h...g...g...i...h...h...j...h...i...h" },
  { key: "o", label: "attn out", ista: "...a...b...d...b...c...a...h...h...h...g...h...h...h...h...h...h", saluki: "...a...b...d...b...c...a...h...h...h...g...h...h...h...h...h...h" },
  { key: "fg", label: "FFN gate", ista: "aaccccdaccaiaabaaaccbedbccafadcacbdccfadcjfbdeffffeefeeeggghhggf", saluki: "aacccccaccacaabaaaccbedbccafadcacbdccfadcjfbdeffffeefeeeggghhggf" },
  { key: "fu", label: "FFN up", ista: "baadecccdccabaacbicaffceffeefdefdcddeedffeebeedadedfchhghhhegegi", saluki: "baaccccccccabaacbccaccceffeefdefdcddeedffeebeedadedfchhghhhegegi" },
  { key: "fd", label: "FFN down", ista: "cdcfdedecadaccaacbdddcfgecceccedafgeedfgeeddefeeceihhghghhghgggi", saluki: "cccccccccacaccaacbccccccccccccccaccccccccccccccccccccchcccghccgi" },
]

// Colour by bits per weight: warm below 2.3, neutral blues above.
function fill(bpw: number): string {
  if (bpw < 1.8) return "oklch(0.62 0.19 25)"
  if (bpw < 2.1) return "oklch(0.72 0.15 50)"
  if (bpw < 2.4) return "oklch(0.82 0.11 85)"
  if (bpw < 2.7) return "oklch(0.78 0.06 220)"
  if (bpw < 3.2) return "oklch(0.64 0.1 245)"
  if (bpw < 3.6) return "oklch(0.52 0.13 260)"
  return "oklch(0.4 0.14 270)"
}

const LEGEND: { label: string; bpw: number }[] = [
  { label: "IQ1 (1.56-1.75)", bpw: 1.6 },
  { label: "IQ2_XXS (2.06)", bpw: 2.06 },
  { label: "IQ2_XS (2.31)", bpw: 2.31 },
  { label: "IQ2_S / Q2_K (2.56-2.63)", bpw: 2.6 },
  { label: "IQ3_XXS (3.06)", bpw: 3.06 },
  { label: "IQ3_S (3.44)", bpw: 3.44 },
  { label: "IQ4_XS / Q4_K (4.25-4.5)", bpw: 4.3 },
]

type View = "ista" | "saluki" | "diff"

const VIEWS: { id: View; label: string }[] = [
  { id: "ista", label: "ISTA IQ2_XS (8.42 GB)" },
  { id: "saluki", label: "Saluki (7.90 GB)" },
  { id: "diff", label: "what changed" },
]

const LABEL_W = 86
const CELL = 8.6
const ROW_H = 13
const GAP = 1
const TOP = 14
const GRID_W = LABEL_W + 64 * CELL
const H = TOP + ROLES.length * ROW_H + 30

export function TensorDiff() {
  const [view, setView] = useState<View>("diff")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          quant type per projection, blocks 0-63
        </span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Which file to show">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-pressed={view === v.id}
              className={
                "rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors " +
                (view === v.id
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${GRID_W + 4} ${H}`}
          className="min-w-[560px] w-full"
          role="img"
          aria-label="Grid of quantization types for ten projection kinds across 64 blocks. The mixer projections are identical in both files. The FFN down projections, which ISTA's search gave 3.06 to 4.25 bits in blocks 50 to 63, are almost all IQ2_XXS in Saluki; eight FFN up and gate projections also drop to IQ2_XXS."
        >
          {[0, 8, 16, 24, 32, 40, 48, 56, 63].map((b) => (
            <text
              key={b}
              x={LABEL_W + b * CELL + CELL / 2}
              y={10}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={7}
            >
              {b}
            </text>
          ))}
          {ROLES.map((r, ri) => (
            <g key={r.key}>
              <text
                x={LABEL_W - 4}
                y={TOP + ri * ROW_H + ROW_H / 2 + 2.5}
                textAnchor="end"
                className="fill-foreground font-mono"
                fontSize={7.5}
              >
                {r.label}
              </text>
              {r.saluki.split("").map((sc, bi) => {
                const ic = r.ista[bi]
                if (sc === ".") return null
                const s = TYPES[sc as Code]
                const i = TYPES[ic as Code]
                const changed = sc !== ic
                const shown = view === "ista" ? i : s
                const x = LABEL_W + bi * CELL + GAP / 2
                const y = TOP + ri * ROW_H + GAP / 2
                let color = fill(shown.bpw)
                let opacity = 1
                if (view === "diff") {
                  color = changed ? "oklch(0.62 0.19 25)" : "oklch(0.7 0.05 240)"
                  opacity = changed ? 1 : 0.35
                }
                return (
                  <rect
                    key={bi}
                    x={x}
                    y={y}
                    width={CELL - GAP}
                    height={ROW_H - GAP}
                    rx={1}
                    fill={color}
                    opacity={opacity}
                  >
                    <title>
                      {changed
                        ? `block ${bi} · ${r.label} · ${i.name} → ${s.name}`
                        : `block ${bi} · ${r.label} · ${s.name}, same codes, scales retuned`}
                    </title>
                  </rect>
                )
              })}
            </g>
          ))}
          <text x={LABEL_W} y={H - 12} className="fill-muted-foreground font-mono" fontSize={7}>
            {view === "diff"
              ? "red: re-quantized to a new type (49 FFN tensors) · faded: same codes byte for byte, only the fp16 block scales moved"
              : "outside the blocks: token embedding IQ1_M in both; LM head IQ4_XS in ISTA, IQ3_S in Saluki"}
          </text>
          <text x={LABEL_W} y={H - 3} className="fill-muted-foreground font-mono" fontSize={7}>
            {view === "diff"
              ? "not drawn: 96 DeltaNet alpha/beta tensors BF16 → Q8_0 (retrained), every norm nudged, LM head IQ4_XS → IQ3_S"
              : view === "ista"
                ? "whole file 2.505 bits per weight · RCO's per-tensor search under a 2.50 target"
                : "whole file 2.349 bits per weight · 524,472,320 bytes smaller than ISTA's file"}
          </text>
        </svg>
        {view !== "diff" && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 font-mono text-[10px]">
                <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: fill(l.bpw) }} />
                <span className="text-muted-foreground">{l.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        The attention and DeltaNet mixers are untouched by the re-typing. Nearly all of it lands on FFN down,
        including the late blocks where ISTA&apos;s sensitivity search had spent its most expensive types. Hover a
        cell for its type in each file.
      </figcaption>
    </figure>
  )
}
