"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where the bytes of Edge0-145B / 120B sit on three machines, and how many of
// them one decoded token reads.
//
// Every size is a file size from the Hugging Face API (?blobs=true) for
// Edge0/Edge0-{145B,120B}-{NVFP4,q3k}, checked against the GGUF headers of
// model-skeleton.gguf and ple-fp8.gguf (read by HTTP range request) and the
// per-expert record sizes in native_experts.txt:
//   experts.bin          145B: 47,563,800,576 (NVFP4) / 40,076,574,720 (Q3_K)
//                        120B: 33,974,255,616 (NVFP4) / 28,626,124,800 (Q3_K)
//   one expert record    145B: 1,935,376 / 1,630,720 B; 120B: 1,382,416 / 1,164,800 B
//   latent D/U           145B q8 3,743,416,320 (the 145B default); 120B q4 1,415,577,600 (its default)
//   model-skeleton.gguf  5,991,569,248 (identical in all four repos)
//   mtp/                 116,099,072 + 707,788,800
//   ple-fp8.gguf         51,200,246,112 (identical in all four repos)
// Per token: 48 layers x 10 routed experts = 480 records; the skeleton minus
// the token-embedding table (a lookup, one row) = 5,305,126,400 B; D/U whole.
// The PLE table: 16 rows of 160 B, read with direct I/O, so 16 pages of 4 KiB.
//
// Placement follows the README's own residency readings: the VRAM holds the
// skeleton, D/U, the MTP layer, about 1.5 GiB of buffers (my estimate) and an
// expert cache in what is left; host RAM holds the experts the card does not
// (disjoint sets) plus about 5.7 GiB of runtime: the four published readings
// leave 7.0-7.4 GiB after every weight byte, less the 1.5 GiB of buffers; the PLE table stays on the SSD (--ple-io direct).
//
// Only +, -, *, / and Math.round: exact on every engine, no dmath needed.

type Build = {
  id: string
  label: string
  experts: number
  record: number
  du: number
  duLabel: string
}

const BUILDS: Build[] = [
  { id: "145q3", label: "145B · Q3_K", experts: 40_076_574_720, record: 1_630_720, du: 3_743_416_320, duLabel: "q8" },
  { id: "145fp4", label: "145B · NVFP4", experts: 47_563_800_576, record: 1_935_376, du: 3_743_416_320, duLabel: "q8" },
  { id: "120q3", label: "120B · Q3_K", experts: 28_626_124_800, record: 1_164_800, du: 1_415_577_600, duLabel: "q4" },
  { id: "120fp4", label: "120B · NVFP4", experts: 33_974_255_616, record: 1_382_416, du: 1_415_577_600, duLabel: "q4" },
]

type Machine = {
  id: string
  label: string
  note: string
  vram: number // GiB the engine fills, 0 for unified
  ram: number // GiB of host RAM the experts may take
  unified: number // GiB of one shared pool, 0 for a discrete card
}

const MACHINES: Machine[] = [
  {
    id: "resident",
    label: "24 GB card + 64 GB RAM",
    note: "the README's residency runs: every expert in VRAM or RAM, none on the SSD",
    vram: 23.2,
    ram: 64,
    unified: 0,
  },
  {
    id: "budget",
    label: "16 GiB VRAM + 20 GiB RAM",
    note: "the documented minimum (cgroup MemoryMax=20G); the rest of the experts are read from the SSD",
    vram: 16,
    ram: 12,
    unified: 0,
  },
  {
    id: "unified",
    label: "one 64 GB unified pool",
    note: "an RTX Spark or a Mac: GPU and CPU read the same memory",
    vram: 0,
    ram: 0,
    unified: 64,
  },
]

const GB = 1e9
const GIB = 1024 * 1024 * 1024
const SKELETON = 5_991_569_248
const SKELETON_READ = 5_305_126_400
const MTP = 116_099_072 + 707_788_800
const PLE = 51_200_246_112
const PLE_READ = 16 * 4096
const BUFFERS = 1.5 * GIB
const RUNTIME = 5.7 * GIB
const ROUTED = 48 * 10

const COLORS = {
  skeleton: "#475569",
  du: "#7c3aed",
  mtp: "#0f766e",
  buffers: "#94a3b8",
  expertV: "#0369a1",
  expertR: "#38bdf8",
  expertS: "#f59e0b",
  ple: "#b91c1c",
  runtime: "#cbd5e1",
}

type Seg = { key: keyof typeof COLORS; label: string; bytes: number }

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const gb = (b: number) => `${r1(b / GB)} GB`

export function WhereItLives() {
  const [buildId, setBuildId] = useState("145q3")
  const [machineId, setMachineId] = useState("resident")
  const b = BUILDS.find((x) => x.id === buildId) ?? BUILDS[0]
  const m = MACHINES.find((x) => x.id === machineId) ?? MACHINES[0]

  const fixedGpu = SKELETON + b.du + MTP
  let vramExperts = 0
  let ramExperts = 0
  if (m.unified > 0) {
    const room = m.unified * GIB - fixedGpu - BUFFERS - RUNTIME
    vramExperts = Math.max(0, Math.min(b.experts, room))
  } else {
    vramExperts = Math.max(0, Math.min(b.experts, m.vram * GIB - fixedGpu - BUFFERS))
    ramExperts = Math.max(0, Math.min(b.experts - vramExperts, m.ram * GIB - (m.id === "budget" ? 0 : RUNTIME)))
  }
  const ssdExperts = b.experts - vramExperts - ramExperts

  const tiers: { name: string; segs: Seg[] }[] =
    m.unified > 0
      ? [
          {
            name: "unified memory",
            segs: [
              { key: "skeleton", label: "skeleton", bytes: SKELETON },
              { key: "du", label: `D/U (${b.duLabel})`, bytes: b.du },
              { key: "mtp", label: "MTP layer", bytes: MTP },
              { key: "buffers", label: "buffers", bytes: BUFFERS },
              { key: "expertV", label: "experts", bytes: vramExperts },
              { key: "runtime", label: "runtime", bytes: RUNTIME },
            ],
          },
          {
            name: "SSD",
            segs: [
              { key: "expertS", label: "experts", bytes: ssdExperts },
              { key: "ple", label: "PLE table", bytes: PLE },
            ],
          },
        ]
      : [
          {
            name: "VRAM",
            segs: [
              { key: "skeleton", label: "skeleton", bytes: SKELETON },
              { key: "du", label: `D/U (${b.duLabel})`, bytes: b.du },
              { key: "mtp", label: "MTP layer", bytes: MTP },
              { key: "buffers", label: "buffers", bytes: BUFFERS },
              { key: "expertV", label: "expert cache", bytes: vramExperts },
            ],
          },
          {
            name: "host RAM",
            segs: [
              { key: "expertR", label: "experts", bytes: ramExperts },
              { key: "runtime", label: "runtime", bytes: RUNTIME },
            ],
          },
          {
            name: "SSD",
            segs: [
              { key: "expertS", label: "experts", bytes: ssdExperts },
              { key: "ple", label: "PLE table", bytes: PLE },
            ],
          },
        ]

  const axis = 100 * GB
  const pct = (x: number) => `${r2(Math.min(100, (x / axis) * 100))}%`

  const nExperts = 48 * 512
  const shareV = vramExperts / b.experts
  const shareR = ramExperts / b.experts
  const perTokenExperts = ROUTED * b.record
  const perTokenDense = SKELETON_READ + b.du

  const resident = tiers
    .filter((t) => t.name !== "SSD")
    .reduce((a, t) => a + t.segs.reduce((s, x) => s + x.bytes, 0), 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">where the 145B lives</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          file sizes + GGUF headers, 13 Nov 2026
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap rounded-md border p-0.5" role="group" aria-label="build">
            {BUILDS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setBuildId(x.id)}
                aria-pressed={x.id === buildId}
                className={cn(
                  "rounded px-2 py-1 font-mono text-xs transition-colors",
                  x.id === buildId ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap rounded-md border p-0.5" role="group" aria-label="machine">
            {MACHINES.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setMachineId(x.id)}
                aria-pressed={x.id === machineId}
                className={cn(
                  "rounded px-2 py-1 font-mono text-xs transition-colors",
                  x.id === machineId ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 font-mono text-[10px] leading-4 text-muted-foreground">{m.note}</p>

        <div className="mt-4 space-y-3">
          {tiers.map((t) => {
            const total = t.segs.reduce((a, s) => a + s.bytes, 0)
            return (
              <div key={t.name}>
                <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] text-muted-foreground">
                  <span className="text-foreground">{t.name}</span>
                  <span>{gb(total)}</span>
                </div>
                <div className="flex h-8 w-full overflow-hidden rounded-md border bg-muted/20">
                  {t.segs
                    .filter((s) => s.bytes > 0)
                    .map((s) => (
                      <div
                        key={s.label}
                        className="h-full"
                        style={{ width: pct(s.bytes), background: COLORS[s.key] }}
                        title={`${s.label}: ${gb(s.bytes)}`}
                      />
                    ))}
                </div>
              </div>
            )
          })}
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>0</span>
            <span>50 GB</span>
            <span>100 GB</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {(
            [
              ["skeleton", "skeleton"],
              ["du", "D/U projections"],
              ["mtp", "MTP draft layer"],
              ["buffers", "buffers (est.)"],
              ["expertV", "experts, GPU-side"],
              ["expertR", "experts, RAM"],
              ["expertS", "experts, SSD"],
              ["ple", "PLE n-gram table"],
              ["runtime", "runtime (backed out)"],
            ] as const
          ).map(([k, l]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[k] }} />
              {l}
            </span>
          ))}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {[
            ["resident (not SSD)", gb(resident), "VRAM + RAM, or the unified pool"],
            [
              "experts by place",
              `${Math.round(shareV * 100)}% · ${Math.round(shareR * 100)}% · ${Math.round(
                (1 - shareV - shareR) * 100
              )}%`,
              m.unified > 0 ? "pool · — · SSD" : "VRAM · RAM · SSD",
            ],
            ["per token: experts", `${r2(perTokenExperts / GB)} GB`, `480 of ${nExperts} records`],
            ["per window: dense", `${r2(perTokenDense / GB)} GB`, `skeleton + D/U, PLE ${PLE_READ / 1024} KiB`],
          ].map(([a, v, c]) => (
            <div key={a} className="rounded-md border bg-muted/20 px-2.5 py-2">
              <dt className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">{a}</dt>
              <dd className="mt-0.5 font-mono text-sm text-foreground">{v}</dd>
              <dd className="font-mono text-[9px] text-muted-foreground">{c}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The red block never moves: 51.2 GB of n-gram table stays on the SSD on every machine, and a token
          reads 16 rows of it. What moves with the machine is the blue and amber of the expert pool. The dense
          side (attention, DeltaNet, routers, the eight D/U groups per layer) is read once per verify window
          and lives next to the GPU; the 145B&rsquo;s D/U alone is 3.7 GB, more bytes than the 0.78 GB of
          experts one token routes to.
        </p>
      </div>
    </figure>
  )
}
