import {
  formatBytes,
  formatCount,
  formatParams,
  getModelCard,
} from "@/lib/model-cards"

// <ModelCard repo="openbmb/MiniCPM5-2B" /> — the Hub's own numbers for a model,
// read from a committed snapshot (see lib/model-cards.ts for why it is a
// snapshot and not a live fetch).
//
// A server component on purpose: the data is static JSON at build time, so this
// ships no JavaScript and renders identically for a reader and for the .md agent
// variant of the page.
//
// Dual-native rule: this is *corroboration*, not the argument. An article must
// still state in prose whatever the card shows that matters — the card exists so
// a reader can see the measured figure next to the claimed one, not so the prose
// can skip saying which is which.

const DTYPE_ORDER = [
  "BF16",
  "F16",
  "F32",
  "F8_E4M3",
  "F8_E5M2",
  "I8",
  "U8",
  "I32",
  "BOOL",
]

function dtypeRank(d: string) {
  const i = DTYPE_ORDER.indexOf(d)
  return i === -1 ? DTYPE_ORDER.length : i
}

export function ModelCard({
  repo,
  /** Optional: what the announcement claimed, e.g. "2B" or "124B / 5.1B active". */
  claimed,
  /** Optional one-line note rendered under the grid. */
  note,
}: {
  repo: string
  claimed?: string
  note?: string
}) {
  const m = getModelCard(repo)
  const href = `https://huggingface.co/${repo}`

  // No snapshot for this repo: still give the reader the link rather than an
  // empty box or a build failure.
  if (!m || m.error) {
    return (
      <figure className="my-6 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <a href={href} className="font-mono text-xs break-all">
            {repo}
          </a>
          <span className="font-mono text-[10px] text-muted-foreground">
            hugging face
          </span>
        </div>
        <div className="px-4 py-3 text-sm text-muted-foreground">
          Metadata not in the local snapshot
          {m?.error ? ` (${m.error})` : ""}. Figures in the prose above were
          taken from the repository directly.
        </div>
      </figure>
    )
  }

  const dtypes = Object.entries(m.parameters ?? {}).sort(
    (a, b) => dtypeRank(a[0]) - dtypeRank(b[0]) || b[1] - a[1]
  )

  // Packed formats (NVFP4 in a U8 tensor, say) mean the per-dtype counts do not
  // always add up to `total`. Surface that rather than papering over it — it is
  // a real property of the checkpoint, and this site has run into it twice.
  const dtypeSum = dtypes.reduce((s, [, v]) => s + v, 0)
  const sumsCleanly =
    !m.totalParameters || !dtypeSum || Math.abs(dtypeSum - m.totalParameters) <= 1

  const stats: { label: string; value: string }[] = []
  if (m.totalParameters)
    stats.push({ label: "parameters", value: formatParams(m.totalParameters) })
  if (m.usedStorage)
    stats.push({ label: "repo size", value: formatBytes(m.usedStorage) })
  if (m.architecture ?? m.modelType)
    stats.push({
      label: "architecture",
      value: m.architecture ?? m.modelType!,
    })
  if (m.license) stats.push({ label: "license", value: m.license })
  if (typeof m.downloads === "number")
    stats.push({ label: "downloads", value: formatCount(m.downloads) })
  if (typeof m.likes === "number")
    stats.push({ label: "likes", value: formatCount(m.likes) })
  if (m.gated) stats.push({ label: "gated", value: String(m.gated) })
  if (m.fileCount) stats.push({ label: "files", value: String(m.fileCount) })

  return (
    <figure className="my-6 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <a
          href={href}
          className="font-mono text-xs break-all underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground"
        >
          {m.id}
        </a>
        <span className="font-mono text-[10px] text-muted-foreground">
          hugging face · snapshot {m.fetchedAt}
        </span>
      </div>

      <div className="px-4 py-3">
        {claimed && m.totalParameters ? (
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border bg-muted/20 px-3 py-2">
            <span className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              announced
            </span>
            <span className="font-mono text-sm">{claimed}</span>
            <span className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              measured
            </span>
            <span className="font-mono text-sm tabular-nums">
              {m.totalParameters.toLocaleString()}
            </span>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
                {s.label}
              </dt>
              <dd className="font-mono text-sm break-words tabular-nums">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>

        {dtypes.length ? (
          <div className="mt-3 border-t pt-3">
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              parameters by dtype
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {dtypes.map(([d, v]) => (
                <span key={d} className="font-mono text-xs">
                  <span className="text-muted-foreground">{d}</span>{" "}
                  <span className="tabular-nums">{formatParams(v)}</span>
                </span>
              ))}
            </div>
            {!sumsCleanly ? (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                These add to {formatParams(dtypeSum)}, not the{" "}
                {formatParams(m.totalParameters!)} total — expected when a packed
                format stores more than one value per element.
              </p>
            ) : null}
          </div>
        ) : null}

        {note ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{note}</p>
        ) : null}
      </div>
    </figure>
  )
}
