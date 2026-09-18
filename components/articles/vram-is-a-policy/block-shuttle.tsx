// What a WanGP "6 GB" claim actually puts on the card, drawn from the measured
// checkpoints rather than from any README sentence.
//
// mmgp splits a diffusion transformer into its repeating stack ("blocks") plus
// everything else ("base"). Base stays resident while that model is the active
// one. Blocks do not: with WanGP's transformer budget of 100 MiB (wgp.py,
// init_pipe) no block clears mmgp's preload arithmetic, so offload.py's
// tune_preloading returns zero preloaded blocks and the stack becomes what its
// own log line calls a "circular shuttle" — one block computing, one block
// arriving on the transfer stream, everything else in system RAM.
//
// So the resident weight figure is base + 2 x block, independent of how many
// blocks there are. That is the whole trick, and it is why a 31.7 GiB
// checkpoint and a 5.3 GiB one land within a gigabyte of each other. The cost
// moved: it is now the right-hand column, the bytes that cross PCIe on every
// single forward pass through the stack.
//
// Server-rendered, zero JS. Every number below is measured — see the receipts
// table in the article for how.

const ACCENT = "oklch(0.60 0.15 255)" // resident base
const WARM = "oklch(0.68 0.13 85)" // the two-block window
const MUTED = "oklch(0.62 0.03 250)" // blocks parked in system RAM

type Row = {
  id: string
  label: string
  sub: string
  blocks: number
  blockMiB: number
  baseMiB: number
}

// MiB, 1 MiB = 1048576 B, matching mmgp's ONE_MB. Read out of each file's
// safetensors header over an HTTP range request.
const ROWS: Row[] = [
  {
    id: "h3",
    label: "MiniMax H3 FL2VA 33B",
    sub: "int8_convrot · 50 blocks · 31.70 GiB on disk",
    blocks: 50,
    blockMiB: 616.4,
    baseMiB: 1643.4,
  },
  {
    id: "h3p",
    label: "MiniMax H3 FL2VA pruned 20B",
    sub: "rank8 int8_convrot · 50 blocks · 19.61 GiB",
    blocks: 50,
    blockMiB: 371.1,
    baseMiB: 1528.3,
  },
  {
    id: "ovi-v",
    label: "Wan2.2 Ovi v1.1 · video tower",
    sub: "quanto int8 · 30 blocks · 5.27 GiB",
    blocks: 30,
    blockMiB: 174.3,
    baseMiB: 171.8,
  },
  {
    id: "ovi-a",
    label: "Wan2.2 Ovi v1.1 · audio tower",
    sub: "quanto int8 · 30 blocks · 6.26 GiB · co-tenant of the above",
    blocks: 30,
    blockMiB: 174.3,
    baseMiB: 1178.5,
  },
  {
    id: "yue",
    label: "YuE2 acoustic (NAR) tower",
    sub: "int8_convrot · 28 layers · 1.42 GiB",
    blocks: 28,
    blockMiB: 48.1,
    baseMiB: 105.5,
  },
]

function fmt(mib: number): string {
  return mib >= 1024 ? `${(mib / 1024).toFixed(2)} GiB` : `${Math.round(mib)} MiB`
}

// One row of the block stack: `blocks` cells, two of them lit (the block being
// computed and the block being prefetched behind it on the transfer stream).
function Stack({ n, litAt }: { n: number; litAt: number }) {
  const cells = Array.from({ length: n }, (_, i) => i)
  return (
    <div className="flex gap-[2px]" aria-hidden="true">
      {cells.map((i) => {
        const lit = i === litAt || i === litAt + 1
        return (
          <span
            key={i}
            className="h-4 flex-1 rounded-[1px]"
            style={{
              background: lit ? WARM : MUTED,
              opacity: lit ? 1 : 0.22,
            }}
          />
        )
      })}
    </div>
  )
}

export function BlockShuttle() {
  const maxResident = Math.max(...ROWS.map((r) => r.baseMiB + 2 * r.blockMiB))
  const maxTraffic = Math.max(...ROWS.map((r) => r.blocks * r.blockMiB))

  return (
    <figure className="my-8 rounded-md border bg-muted/20 px-4 py-4">
      <figcaption className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        resident weights vs. traffic, per model
      </figcaption>
      <p className="mt-0 mb-4 text-sm leading-6 text-muted-foreground">
        Lit cells are the only two blocks on the GPU: the one computing and the
        one arriving behind it. Everything dimmed is in system RAM and will be
        fetched, used once, and dropped — once per forward pass, every pass.
      </p>

      <div className="space-y-5">
        {ROWS.map((r, ri) => {
          const resident = r.baseMiB + 2 * r.blockMiB
          const traffic = r.blocks * r.blockMiB
          // Deterministic per-row window position; no animation, no JS.
          const litAt = 3 + ((ri * 7) % (r.blocks - 6))
          return (
            <div key={r.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium">{r.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {r.blocks} × {r.blockMiB.toFixed(1)} MiB
                </span>
              </div>
              <div className="mt-0.5 mb-2 font-mono text-[11px] text-muted-foreground">
                {r.sub}
              </div>

              <Stack n={r.blocks} litAt={litAt} />

              <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <div>
                  <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                    resident weights ={" "}
                    <span style={{ color: ACCENT }}>base</span> + 2 ×{" "}
                    <span style={{ color: WARM }}>block</span>
                  </div>
                  <div className="mt-1 flex h-3 w-full overflow-hidden rounded-[2px] bg-muted">
                    <span
                      style={{
                        background: ACCENT,
                        width: `${(r.baseMiB / maxResident) * 100}%`,
                      }}
                    />
                    <span
                      style={{
                        background: WARM,
                        width: `${((2 * r.blockMiB) / maxResident) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 font-mono text-[11px]">
                    {fmt(resident)}{" "}
                    <span className="text-muted-foreground">
                      ({fmt(r.baseMiB)} base + {fmt(2 * r.blockMiB)} window)
                    </span>
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                    bytes over PCIe, per forward pass
                  </div>
                  <div className="mt-1 flex h-3 w-full overflow-hidden rounded-[2px] bg-muted">
                    <span
                      style={{
                        background: MUTED,
                        width: `${(traffic / maxTraffic) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 font-mono text-[11px]">
                    {(traffic / 1024).toFixed(2)} GiB{" "}
                    <span className="text-muted-foreground">
                      × every denoising step
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-5 border-t pt-3 text-xs leading-5 text-muted-foreground">
        Compare the two H3 rows, which are the same model at two compression
        levels. Going from the pruned 20B to the full 33B adds 12.09 GiB of
        checkpoint and 11.98 GiB of traffic on every forward pass — and 0.59 GiB
        of resident VRAM. The VRAM number quotes the small half.
      </p>
    </figure>
  )
}
