// "Weights are files on disk, paged onto the GPU as needed, so model size is
// bounded by disk rather than VRAM."
//
// True, and the bound is a number in config.yaml. Every quantity here comes from
// the shipped defaults and from the shapes in minagi/paged.py, so the whole
// diagram is arithmetic rather than reportage:
//
//   one expert  = w1 + w3 + w2, each 2048 × 512 = 1,048,576 params
//               = 3,145,728 params
//   on disk     = weights fp32 (12.0 MiB) + six Adam moment arrays bf16 (12.0 MiB)
//               = 24.0 MiB, which is the 25.2 MB config.yaml quotes in decimal
//   in RAM      = the same file with the moments unpacked to fp32 → 36.0 MiB
//   on the card = weights + exp_avg + exp_avg_sq, all fp32 → 36.0 MiB
//
// growth.max_disk_gb is 10.0, so the pool that is "bounded by disk" is bounded
// at about 397 experts by default. And _rearrange() moves one expert at a time
// with blocking .to("cpu") / .to(dev) copies, so a swap is 36 MiB out and 36 MiB
// in across PCIe with nothing overlapped.
//
// Zero JS. Every number below is a literal or an exact ratio of literals.

const PARAMS = 3 * 2048 * 512 // 3,145,728
const MiB = 1024 * 1024

const DISK_MIB = (PARAMS * 4 + PARAMS * 2 * 2) / MiB // fp32 weights + bf16 moments = 24.0
const HOST_MIB = (PARAMS * 4 + PARAMS * 4 * 2) / MiB // moments unpacked to fp32 = 36.0
const CARD_MIB = HOST_MIB // weights + exp_avg + exp_avg_sq, all fp32

const DISK_CAP_EXPERTS = Math.floor((10.0 * 1e9) / (DISK_MIB * MiB)) // growth.max_disk_gb
const RAM_CACHE = 96 // pool.ram_cache
const RESIDENT = 32 // pool.resident

type Tier = {
  key: string
  what: string
  slots: string
  per: number
  total: string
  note: string
}

const TIERS: Tier[] = [
  {
    key: "disk",
    what: "one .npz per expert",
    slots: `≤ ${DISK_CAP_EXPERTS} experts`,
    per: DISK_MIB,
    total: "10.0 GB — growth.max_disk_gb",
    note: "weights fp32, Adam moments bf16",
  },
  {
    key: "RAM",
    what: "ram_cache, LRU",
    slots: `${RAM_CACHE} experts`,
    per: HOST_MIB,
    total: `${((RAM_CACHE * HOST_MIB) / 1024).toFixed(2)} GiB`,
    note: "moments unpacked back to fp32 on read",
  },
  {
    key: "VRAM",
    what: "resident — the working set",
    slots: `${RESIDENT} experts`,
    per: CARD_MIB,
    total: `${((RESIDENT * CARD_MIB) / 1024).toFixed(3)} GiB`,
    note: "the only tier that is scarce, on an 8 GB card",
  },
]

export function PagingTiers() {
  const W = 840
  const rowTop = 62
  const rowH = 62
  const H = rowTop + TIERS.length * rowH + 86
  const L = 16
  const barL = 300
  const barR = 660
  const MAX_MIB = 40
  const bw = (mib: number) => ((barR - barL) * mib) / MAX_MIB

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one expert, in three places · every figure derived from{" "}
        <span className="text-foreground">config.yaml</span> and the shapes in{" "}
        <span className="text-foreground">minagi/paged.py</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="A three-tier diagram of mini-AGI's expert paging. On disk an expert is a 24 mebibyte file holding fp32 weights and bfloat16 Adam moments, and the shipped config caps the pool at about 397 of them inside ten gigabytes. In system RAM the least-recently-used cache holds 96 experts at 36 mebibytes each, because the moments are unpacked back to fp32 on read, for 3.38 gibibytes. On the card 32 experts are resident at 36 mebibytes each — weights plus both Adam moments — for 1.125 gibibytes, and that is the only tier that is scarce. Below, the cost of one swap: 36 mebibytes leave the card and 36 arrive, one expert at a time, with no overlap."
      >
        <text x={L} y={26} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          3 × (2048 × 512) = 3,145,728 parameters per expert
        </text>
        <text x={L} y={40} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          the same expert costs different bytes in each tier, because the Adam moments change dtype
        </text>

        {[0, 12, 24, 36].map((t) => (
          <g key={t}>
            <line x1={barL + bw(t)} y1={rowTop - 10} x2={barL + bw(t)} y2={rowTop + TIERS.length * rowH - 16} className="stroke-border" strokeWidth={1} strokeOpacity={0.5} />
            <text x={barL + bw(t)} y={rowTop - 16} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {t}
            </text>
          </g>
        ))}
        <text x={barR + 8} y={rowTop - 16} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          MiB per expert
        </text>

        {TIERS.map((t, i) => {
          const y = rowTop + i * rowH
          return (
            <g key={t.key}>
              <text x={L} y={y + 12} className="fill-foreground font-mono" style={{ fontSize: 13 }}>
                {t.key}
              </text>
              <text x={L + 64} y={y + 12} className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
                {t.what}
              </text>
              <text x={L + 64} y={y + 26} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {t.note}
              </text>
              <text x={L + 64} y={y + 39} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {t.slots} · {t.total}
              </text>

              <rect x={barL} y={y} width={bw(t.per)} height={18} className={t.key === "VRAM" ? "fill-destructive" : "fill-foreground/75"} />
              <text x={barL + bw(t.per) + 8} y={y + 13} className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
                {t.per.toFixed(1)} MiB
              </text>
            </g>
          )
        })}

        <line x1={L} y1={H - 66} x2={W - 16} y2={H - 66} className="stroke-border" strokeWidth={1} />
        <text x={L} y={H - 48} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          one swap: {CARD_MIB.toFixed(0)} MiB off the card, {CARD_MIB.toFixed(0)} MiB on
        </text>
        <text x={L} y={H - 34} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          _rearrange() parks the leaver with a blocking .to(&quot;cpu&quot;), then fetches the arriver with a blocking .to(dev), one at a time
        </text>
        <text x={L} y={H - 20} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          a full {RESIDENT}-slot turnover is {((2 * RESIDENT * CARD_MIB) / 1024).toFixed(2)} GiB across the bus with nothing overlapped — and the run publishes no count of how often that happens
        </text>
      </svg>
    </figure>
  )
}
