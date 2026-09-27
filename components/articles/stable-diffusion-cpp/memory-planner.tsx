"use client"

import { useId, useState } from "react"

import { cn } from "@/lib/utils"

// Will this pipeline fit? A memory planner for stable-diffusion.cpp.
//
// Weights are exact. Parameter counts come from each checkpoint's own tensor
// table (safetensors headers read over HTTP range requests; for FLUX.1-dev,
// the header of leejet/FLUX.1-dev-gguf's q4_0 file), split into the classes
// stable-diffusion.cpp treats differently at 2f88688:
//
//   q     2-D weights ModelLoader::tensor_should_be_converted lets through at
//         every block size (row length a multiple of 256)
//   q32   2-D weights whose rows are a multiple of 32 but not of 256: they take
//         q8_0/q5_0/q4_0, but under a K-quant they stay in the file's dtype
//   kept  weights the name filter never converts (embeddings, FLUX's
//         img_in/txt_in/time_in/…/final_layer, UNet time_embed), file dtype
//   conv  Conv2d/Conv3d weights: always F16, whatever --type says
//   vec   biases, norm weights, QK-norm scales: always F32
//
// Bytes per weight come from ggml-common.h's block sizes (q8_0 34 B per 32,
// q4_K 144 B per 256, …). The formula reproduces leejet's four other FLUX GGUF
// files from the q4_0 file's tensor table to the byte, less the 54,176-byte
// header each carries.
//
// The two workspace terms are reasoned lower bounds, not measurements:
//   * attention scores without flash attention: heads × L² × 4 bytes, the
//     F32 matrix ggml_ext_attention_ext materialises (L = image tokens at the
//     highest-resolution attention level, plus 256 T5 tokens for FLUX).
//   * VAE decode: 6,656 bytes per output pixel for the AutoencoderKL decoder
//     (a 256-channel F32 input, its 256 × 3 × 3 F16 im2col, and the skip input
//     alive at once); a --vae-tiling tile is 256 × 256 pixels.
// sd.cpp keeps a 512 MiB scratch reserve on a GPU (docs/performance.md).
//
// Arithmetic is + - * / on integers and toFixed; nothing transcendental.

type Part = {
  q: number
  q32?: number
  q32Src?: number
  kept?: number
  keptSrc?: number
  conv?: number
  vec: number
}

type Model = {
  key: string
  label: string
  core: string // "UNet" or "DiT"
  te: string
  te_: Part
  dit: Part
  vae: Part
  heads: number
  pxPerToken: number // output pixels per attention token at the largest attention level
  textTokens: number
  textNote: string
  source: string
}

const MODELS: Model[] = [
  {
    key: "sd15",
    label: "SD 1.5",
    core: "UNet",
    te: "CLIP-L",
    te_: { q: 84_934_656, kept: 38_004_480, keptSrc: 4, vec: 121_344 },
    dit: { q: 232_161_280, q32: 35_840_000, q32Src: 4, kept: 2_048_000, keptSrc: 4, conv: 589_027_840, vec: 443_844 },
    vae: { q: 0, conv: 83_587_920, vec: 65_943 },
    heads: 8,
    pxPerToken: 64,
    textTokens: 0,
    textNote: "self-attention at 1/8 resolution, 8 heads",
    source: "v1-5-pruned-emaonly.safetensors, stored in f32",
  },
  {
    key: "sdxl",
    label: "SDXL",
    core: "UNet",
    te: "CLIP-L + CLIP-G",
    te_: { q: 715_718_656, kept: 101_345_357, keptSrc: 2, vec: 656_385 },
    dit: { q: 2_163_916_800, q32: 61_440_000, q32Src: 2, kept: 7_290_880, keptSrc: 2, conv: 333_232_640, vec: 1_583_364 },
    vae: { q: 0, conv: 83_587_920, vec: 65_943 },
    heads: 10,
    pxPerToken: 256,
    textTokens: 0,
    textNote: "first attention level is at 1/16 resolution, 10 heads of 64",
    source: "sd_xl_base_1.0.safetensors, stored in f16",
  },
  {
    key: "flux",
    label: "FLUX.1-dev",
    core: "DiT",
    te: "T5-XXL + CLIP-L",
    te_: { q: 4_847_042_560, q32: 2_048, q32Src: 2, kept: 38_004_480, keptSrc: 2, vec: 322_048 },
    dit: { q: 11_834_228_736, kept: 64_094_208, keptSrc: 4, vec: 3_085_376 },
    vae: { q: 0, conv: 83_753_728, vec: 65_955 },
    heads: 24,
    pxPerToken: 256,
    textTokens: 256,
    textNote: "joint attention over image tokens plus 256 T5 tokens, 24 heads",
    source: "DiT from leejet/FLUX.1-dev-gguf (unquantised tensors stored in f32); encoders f16",
  },
  {
    key: "zimage",
    label: "Z-Image Turbo",
    core: "DiT",
    te: "Qwen3-4B",
    te_: { q: 4_022_272_000, vec: 196_096 },
    dit: { q: 6_151_864_320, kept: 2_006_528, keptSrc: 2, vec: 1_037_888 },
    vae: { q: 0, conv: 83_753_728, vec: 65_955 },
    heads: 30,
    pxPerToken: 256,
    textTokens: 0,
    textNote: "image tokens only, 30 heads; the prompt's own tokens come on top",
    source: "Comfy-Org/z_image_turbo split files, bf16; the FLUX VAE",
  },
]

type QType = { key: string; label: string; blk: number; bytes: number }

// ggml-common.h: bytes per block of `blk` weights
const QTYPES: QType[] = [
  { key: "f32", label: "f32", blk: 1, bytes: 4 },
  { key: "f16", label: "f16", blk: 1, bytes: 2 },
  { key: "q8_0", label: "q8_0", blk: 32, bytes: 34 },
  { key: "q6_K", label: "q6_K", blk: 256, bytes: 210 },
  { key: "q5_0", label: "q5_0", blk: 32, bytes: 22 },
  { key: "q4_K", label: "q4_K", blk: 256, bytes: 144 },
  { key: "q4_0", label: "q4_0", blk: 32, bytes: 18 },
  { key: "q3_K", label: "q3_K", blk: 256, bytes: 110 },
  { key: "q2_K", label: "q2_K", blk: 256, bytes: 84 },
]

const MiB = 1_048_576
const GiB = 1_073_741_824
const RESERVE = 512 * MiB
const VAE_BYTES_PER_PX = 6_656
const TILE_PX = 256 * 256

function partBytes(p: Part, t: QType) {
  const convertedQ32 = t.blk === 256 ? 0 : p.q32 ?? 0
  const leftQ32 = t.blk === 256 ? p.q32 ?? 0 : 0
  const quant = ((p.q + convertedQ32) * t.bytes) / t.blk
  const left = leftQ32 * (p.q32Src ?? 2)
  const kept = (p.kept ?? 0) * (p.keptSrc ?? 2)
  const conv = (p.conv ?? 0) * 2
  const vec = p.vec * 4
  return { total: quant + left + kept + conv + vec, quant, left, kept, conv, vec }
}

const gib = (b: number) => `${(b / GiB).toFixed(2)} GiB`
const mib = (b: number) => `${(b / MiB).toFixed(0)} MiB`
const bits = (t: QType) => {
  const s = ((t.bytes * 8) / t.blk).toFixed(4)
  return s.replace(/\.?0+$/, "")
}

const SIZES = [512, 768, 1024]
const VRAM = [0, 4, 6, 8, 12, 16, 24]
const RAM = [8, 16, 32, 64]

const ACCENT = "oklch(0.62 0.14 300)"

type Seg = { key: string; label: string; bytes: number; tone: number; dashed?: boolean }

export function MemoryPlanner() {
  const uid = useId().replace(/:/g, "")
  const [mk, setMk] = useState("flux")
  const [px, setPx] = useState(1024)
  const [teQ, setTeQ] = useState("q8_0")
  const [ditQ, setDitQ] = useState("q4_K")
  const [vaeQ, setVaeQ] = useState("q4_0")
  const [fa, setFa] = useState(true)
  const [tiling, setTiling] = useState(true)
  const [teCpu, setTeCpu] = useState(true)
  const [offload, setOffload] = useState(false)
  const [vram, setVram] = useState(8)
  const [ram, setRam] = useState(16)

  const m = MODELS.find((x) => x.key === mk) ?? MODELS[0]
  const q = (k: string) => QTYPES.find((x) => x.key === k) ?? QTYPES[1]

  const te = partBytes(m.te_, q(teQ))
  const dit = partBytes(m.dit, q(ditQ))
  const vae = partBytes(m.vae, q(vaeQ))

  const pixels = px * px
  const L = pixels / m.pxPerToken + m.textTokens
  const attn = fa ? 0 : m.heads * L * L * 4
  const vaeWs = VAE_BYTES_PER_PX * (tiling ? Math.min(pixels, TILE_PX) : pixels)

  const gpu = vram > 0
  const gpuSegs: Seg[] = []
  const ramSegs: Seg[] = []

  if (!gpu) {
    ramSegs.push(
      { key: "te", label: m.te, bytes: te.total, tone: 0.3 },
      { key: "dit", label: m.core, bytes: dit.total, tone: 0.75 },
      { key: "vae", label: "VAE", bytes: vae.total, tone: 0.5 },
      { key: "ws", label: "workspace", bytes: Math.max(attn, vaeWs), tone: 0.12, dashed: true }
    )
  } else if (offload) {
    const stages = [
      { key: "te", label: `${m.te} stage`, bytes: teCpu ? 0 : te.total },
      { key: "dit", label: `${m.core} stage`, bytes: dit.total + attn },
      { key: "vae", label: "VAE stage", bytes: vae.total + vaeWs },
    ]
    const peak = stages.reduce((a, b) => (b.bytes > a.bytes ? b : a))
    gpuSegs.push(
      { key: "reserve", label: "reserve", bytes: RESERVE, tone: 0.2 },
      { key: "peak", label: `largest: ${peak.label}`, bytes: peak.bytes, tone: 0.6 }
    )
    ramSegs.push(
      { key: "te", label: m.te, bytes: te.total, tone: 0.3 },
      { key: "dit", label: m.core, bytes: dit.total, tone: 0.75 },
      { key: "vae", label: "VAE", bytes: vae.total, tone: 0.5 }
    )
  } else {
    gpuSegs.push({ key: "reserve", label: "reserve", bytes: RESERVE, tone: 0.2 })
    if (!teCpu) gpuSegs.push({ key: "te", label: m.te, bytes: te.total, tone: 0.3 })
    gpuSegs.push(
      { key: "dit", label: m.core, bytes: dit.total, tone: 0.75 },
      { key: "vae", label: "VAE", bytes: vae.total, tone: 0.5 },
      { key: "ws", label: "workspace", bytes: Math.max(attn, vaeWs), tone: 0.12, dashed: true }
    )
    if (teCpu) ramSegs.push({ key: "te", label: m.te, bytes: te.total, tone: 0.3 })
  }

  const gpuNeed = gpuSegs.reduce((a, s) => a + s.bytes, 0)
  const ramNeed = ramSegs.reduce((a, s) => a + s.bytes, 0)
  const gpuFits = !gpu || gpuNeed <= vram * GiB
  const ramFits = ramNeed <= ram * GiB
  const fits = gpuFits && ramFits

  // --- scene geometry
  const W = 600
  const H = 254
  const LX = 64
  const LW = W - LX - 12
  const lanes = [
    { key: "gpu", label: gpu ? "GPU" : "GPU —", sub: gpu ? `${vram} GiB` : "none", segs: gpuSegs, need: gpuNeed, budget: vram * GiB, ok: gpuFits, y: 138 },
    { key: "ram", label: "RAM", sub: `${ram} GiB`, segs: ramSegs, need: ramNeed, budget: ram * GiB, ok: ramFits, y: 208 },
  ]

  const nodes = [
    { key: "te", label: m.te, sub: `${gib(te.total)} · ${q(teQ).label}`, onGpu: gpu && !teCpu, x: 10 },
    { key: "dit", label: `${m.core} × steps`, sub: `${gib(dit.total)} · ${q(ditQ).label}`, onGpu: gpu, x: 216 },
    { key: "vae", label: "VAE decoder", sub: `${gib(vae.total)} · ${q(vaeQ).label}`, onGpu: gpu, x: 422 },
  ]
  const NW = 168
  const NH = 52
  const NY = 16

  const verdict = fits
    ? gpu
      ? `fits: ${gib(gpuNeed)} of ${vram} GiB on the GPU, ${gib(ramNeed)} of ${ram} GiB in RAM`
      : `fits: ${gib(ramNeed)} of ${ram} GiB of RAM, no GPU`
    : !gpuFits
      ? `does not fit on the GPU: needs ${gib(gpuNeed)} of ${vram} GiB`
      : `does not fit in RAM: needs ${gib(ramNeed)} of ${ram} GiB`

  const row = (label: string, value: string, formula: string) => (
    <div key={label} className="contents">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
      <span className="text-muted-foreground">{formula}</span>
    </div>
  )

  const partFormula = (p: Part, t: QType, b: ReturnType<typeof partBytes>) => {
    const bits_: string[] = []
    const qn = p.q + (t.blk === 256 ? 0 : p.q32 ?? 0)
    if (qn) bits_.push(`${qn.toLocaleString("en-US")} × ${bits(t)} bits`)
    if (b.left) bits_.push(`${(p.q32 ?? 0).toLocaleString("en-US")} rows not a multiple of 256, left at ${(p.q32Src ?? 2) * 8} bits`)
    if (p.kept) bits_.push(`${p.kept.toLocaleString("en-US")} never converted, ${(p.keptSrc ?? 2) * 8} bits`)
    if (p.conv) bits_.push(`${p.conv.toLocaleString("en-US")} conv × 16 bits`)
    bits_.push(`${p.vec.toLocaleString("en-US")} bias/norm × 32 bits`)
    return bits_.join(" + ")
  }

  const btn = (active: boolean) =>
    cn(
      "rounded-sm border px-2.5 py-1 font-mono text-xs transition-colors",
      active
        ? "border-foreground/40 bg-foreground/10 text-foreground"
        : "text-muted-foreground hover:text-foreground"
    )

  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent"
      data-memory-planner={`${mk}-${px}-${fits ? "fits" : "no"}`}
      aria-label="Memory planner for stable-diffusion.cpp: pick a model, a weight type per component, flags and a memory budget, and see whether the weights and the largest workspace tensors fit"
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${m.label} at ${px} by ${px}: ${verdict}`}>
        <defs>
          <filter id={`soft-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
          </filter>
          <marker id={`arr-${uid}`} viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
            <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
          </marker>
        </defs>

        {nodes.map((n) => (
          <g key={n.key}>
            <rect
              x={n.x}
              y={NY}
              width={NW}
              height={NH}
              rx={9}
              fill={n.onGpu ? ACCENT : "var(--background)"}
              fillOpacity={n.onGpu ? 0.16 : 1}
              stroke={n.onGpu ? ACCENT : "var(--border)"}
              strokeWidth={1.5}
              strokeDasharray={n.onGpu ? undefined : "4 3"}
              filter={`url(#soft-${uid})`}
            />
            <text x={n.x + NW / 2} y={NY + 22} textAnchor="middle" fontSize={14} fill="var(--foreground)" className="font-mono">
              {n.label}
            </text>
            <text x={n.x + NW / 2} y={NY + 41} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)" className="font-mono">
              {n.sub} · {n.onGpu ? "GPU" : "CPU"}
            </text>
          </g>
        ))}
        {[0, 1].map((i) => {
          const x1 = nodes[i].x + NW
          const x2 = nodes[i + 1].x - 4
          const y = NY + NH / 2
          return (
            <path
              key={i}
              d={`M ${x1 + 2} ${y} C ${x1 + 14} ${y - 12}, ${x2 - 14} ${y - 12}, ${x2} ${y}`}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              markerEnd={`url(#arr-${uid})`}
            />
          )
        })}
        <text x={W / 2} y={NY + NH + 24} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)" className="font-mono">
          {offload && gpu
            ? "--offload-to-cpu: weights live in RAM; the GPU holds one stage at a time"
            : gpu
              ? "resident: every GPU-side weight stays in VRAM for the whole run"
              : "no GPU: weights and workspace all in system RAM"}
        </text>

        {lanes.map((ln) => {
          const scale = Math.max(ln.budget, ln.need, 1) * 1.04
          const wOf = (b: number) => (b * LW) / scale
          let cursor = LX
          const budgetX = LX + wOf(ln.budget)
          const inactive = ln.key === "gpu" && !gpu
          return (
            <g key={ln.key} opacity={inactive ? 0.45 : 1}>
              <text x={LX - 10} y={ln.y + 15} textAnchor="end" fontSize={14} fill="var(--foreground)" className="font-mono">
                {ln.key === "gpu" ? "GPU" : "RAM"}
              </text>
              <text x={LX - 10} y={ln.y + 31} textAnchor="end" fontSize={12} fill="var(--muted-foreground)" className="font-mono">
                {ln.sub}
              </text>
              <rect x={LX} y={ln.y} width={LW} height={34} rx={6} fill="var(--muted)" fillOpacity={0.35} stroke="var(--border)" strokeWidth={1} />
              {ln.segs.map((s) => {
                const w = wOf(s.bytes)
                const x = cursor
                cursor += w
                return (
                  <g key={s.key}>
                    <rect
                      x={x}
                      y={ln.y + 3}
                      width={Math.max(0, w - 1)}
                      height={28}
                      rx={4}
                      fill={ACCENT}
                      fillOpacity={s.tone}
                      stroke={s.dashed ? ACCENT : "none"}
                      strokeDasharray={s.dashed ? "3 3" : undefined}
                      strokeWidth={1}
                    />
                    {w > 66 ? (
                      <text x={x + w / 2} y={ln.y + 21} textAnchor="middle" fontSize={11.5} fill="var(--foreground)" className="font-mono">
                        {w > 134 ? `${s.label} ${gib(s.bytes)}` : s.label.length > 12 ? s.label.slice(0, 11) + "…" : s.label}
                      </text>
                    ) : null}
                  </g>
                )
              })}
              {!inactive ? (
                <>
                  <line x1={budgetX} x2={budgetX} y1={ln.y - 7} y2={ln.y + 41} stroke={ln.ok ? "var(--foreground)" : "oklch(0.62 0.2 25)"} strokeWidth={1.5} />
                  <text
                    x={budgetX < LX + 215 ? budgetX : Math.min(budgetX, LX + LW - 4)}
                    y={ln.y - 10}
                    textAnchor={budgetX < LX + 215 ? "start" : "end"}
                    fontSize={11.5}
                    fill="var(--muted-foreground)"
                    className="font-mono"
                  >
                    budget {ln.budget / GiB} GiB · need {gib(ln.need)}
                  </text>
                </>
              ) : null}
            </g>
          )
        })}
      </svg>

      <p
        className={cn(
          "mx-4 my-0 rounded-sm border px-3 py-2 font-mono text-xs",
          fits ? "border-foreground/20 text-foreground" : "border-red-500/40 text-red-600 dark:text-red-400"
        )}
      >
        {verdict}
      </p>

      <div className="space-y-3 border-b px-4 py-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="model">
          {MODELS.map((x) => (
            <button key={x.key} type="button" aria-pressed={mk === x.key} onClick={() => setMk(x.key)} className={btn(mk === x.key)}>
              {x.label}
            </button>
          ))}
          <span className="mx-1 self-center text-muted-foreground">·</span>
          {SIZES.map((s) => (
            <button key={s} type="button" aria-pressed={px === s} onClick={() => setPx(s)} className={btn(px === s)}>
              {s}²
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-xs text-muted-foreground">
          {[
            { label: m.te, v: teQ, set: setTeQ },
            { label: m.core, v: ditQ, set: setDitQ },
            { label: "VAE", v: vaeQ, set: setVaeQ },
          ].map((c) => (
            <label key={c.label} className="flex items-center gap-1.5">
              {c.label}
              <select
                value={c.v}
                onChange={(e) => c.set(e.target.value)}
                className="cursor-pointer rounded border bg-background px-2 py-1 font-mono text-xs text-foreground"
                aria-label={`${c.label} weight type`}
              >
                {QTYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-xs text-muted-foreground">
          {[
            { flag: "--diffusion-fa", v: fa, set: setFa },
            { flag: "--vae-tiling", v: tiling, set: setTiling },
            { flag: "--clip-on-cpu", v: teCpu, set: setTeCpu },
            { flag: "--offload-to-cpu", v: offload, set: setOffload },
          ].map((f) => (
            <label key={f.flag} className="flex items-center gap-1.5">
              <input type="checkbox" checked={f.v} onChange={(e) => f.set(e.currentTarget.checked)} />
              <span className={f.v ? "text-foreground" : undefined}>{f.flag}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            GPU
            <select
              value={vram}
              onChange={(e) => setVram(Number(e.target.value))}
              className="cursor-pointer rounded border bg-background px-2 py-1 font-mono text-xs text-foreground"
              aria-label="GPU memory budget"
            >
              {VRAM.map((v) => (
                <option key={v} value={v}>
                  {v === 0 ? "none (CPU only)" : `${v} GiB`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            RAM
            <select
              value={ram}
              onChange={(e) => setRam(Number(e.target.value))}
              className="cursor-pointer rounded border bg-background px-2 py-1 font-mono text-xs text-foreground"
              aria-label="system memory budget"
            >
              {RAM.map((v) => (
                <option key={v} value={v}>
                  {v} GiB
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <div className="grid min-w-[40rem] grid-cols-[9rem_6rem_1fr] gap-x-4 gap-y-1.5 font-mono text-[11px] leading-4 tabular-nums">
          {row(`${m.te}`, gib(te.total), partFormula(m.te_, q(teQ), te))}
          {row(`${m.core}`, gib(dit.total), partFormula(m.dit, q(ditQ), dit))}
          {row("VAE", gib(vae.total), partFormula(m.vae, q(vaeQ), vae))}
          {row(
            "attention scores",
            fa ? "—" : mib(attn),
            fa
              ? "flash attention: the score matrix is never materialised"
              : `${m.heads} heads × ${L.toLocaleString("en-US")}² tokens × 4 bytes (${m.textNote})`
          )}
          {row(
            "VAE decode",
            mib(vaeWs),
            `6,656 bytes × ${(tiling ? Math.min(pixels, TILE_PX) : pixels).toLocaleString("en-US")} pixels${tiling ? " (one 256 × 256 tile)" : ""}`
          )}
          {gpu ? row("GPU reserve", mib(RESERVE), "the scratch reserve sd.cpp keeps free on the device") : null}
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Weight rows are exact: parameter counts from each checkpoint&rsquo;s tensor
        table ({m.source}), split by the rules stable-diffusion.cpp applies at{" "}
        <code>2f88688</code>, priced at ggml&rsquo;s block sizes. Pick q4_0 for the
        VAE and nothing moves: every VAE weight is a convolution, and convolutions
        stay f16. The two workspace rows are reasoned lower bounds from the graph
        shapes, not measurements, and the real workspace also holds activations
        these rows ignore. Offloading is modelled as the largest single stage;
        sd.cpp&rsquo;s segmented execution can go below even that, at the cost of
        re-uploading weights every step.
      </figcaption>
    </figure>
  )
}
