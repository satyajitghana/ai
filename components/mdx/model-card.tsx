import {
  formatBytes,
  formatCount,
  formatParams,
  getModelCard,
  type ModelCardSnapshot,
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

/**
 * The Hugging Face mark, inline so the card never reaches out to a third-party
 * host to render. Drawn rather than fetched: two hands either side of a round
 * face. Used nominatively, to label a link to the Hub.
 */
function HuggingFaceMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Hugging Face"
      className={className}
      fill="none"
    >
      {/* hands */}
      <path
        d="M4.9 17.6c-1.3-.7-2.6.3-2.5 1.6.1 1.1 1 2.2 2.1 3.2"
        stroke="#FF9D0B"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M27.1 17.6c1.3-.7 2.6.3 2.5 1.6-.1 1.1-1 2.2-2.1 3.2"
        stroke="#FF9D0B"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* face */}
      <circle cx="16" cy="16" r="10.5" fill="#FFD21E" />
      <circle cx="12.2" cy="14.1" r="1.35" fill="#3A3B45" />
      <circle cx="19.8" cy="14.1" r="1.35" fill="#3A3B45" />
      {/* smile */}
      <path
        d="M11.4 19.1c0 2.5 2.1 4.2 4.6 4.2s4.6-1.7 4.6-4.2z"
        fill="#3A3B45"
      />
      {/* cheeks */}
      <circle cx="8.6" cy="17.6" r="1.5" fill="#FF9D0B" opacity="0.55" />
      <circle cx="23.4" cy="17.6" r="1.5" fill="#FF9D0B" opacity="0.55" />
    </svg>
  )
}

// Ordered so the dominant storage dtype of a checkpoint reads first.
const DTYPE_ORDER = [
  "BF16",
  "F16",
  "F32",
  "F8_E4M3",
  "F8_E5M2",
  "I8",
  "U8",
  "I64",
  "I32",
  "I16",
  "BOOL",
]

// One hue per dtype family so the proportion bar is readable without a legend
// lookup: wide formats warm, narrow formats cool.
const DTYPE_COLOR: Record<string, string> = {
  F32: "oklch(0.62 0.17 30)",
  BF16: "oklch(0.65 0.15 60)",
  F16: "oklch(0.68 0.13 85)",
  F8_E4M3: "oklch(0.60 0.14 155)",
  F8_E5M2: "oklch(0.56 0.13 175)",
  I8: "oklch(0.58 0.13 230)",
  U8: "oklch(0.54 0.14 265)",
}
const DTYPE_FALLBACK = "oklch(0.55 0.02 250)"

function dtypeRank(d: string) {
  const i = DTYPE_ORDER.indexOf(d)
  return i === -1 ? DTYPE_ORDER.length : i
}

function shortDate(iso?: string) {
  if (!iso) return undefined
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

function Stat({
  label,
  value,
  wide,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-sm break-words tabular-nums">
        {value}
      </dd>
    </div>
  )
}

function Shell({
  repo,
  meta,
  children,
}: {
  repo: string
  meta?: string
  children: React.ReactNode
}) {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b bg-muted/20 px-4 py-2.5">
        <a
          href={`https://huggingface.co/${repo}`}
          className="group flex min-w-0 items-center gap-2"
        >
          <HuggingFaceMark className="h-4 w-4 shrink-0" />
          <span className="truncate font-mono text-xs decoration-foreground/30 underline-offset-4 group-hover:underline">
            {repo}
          </span>
        </a>
        {meta ? (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </div>
      {children}
    </figure>
  )
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
  const m: ModelCardSnapshot | null = getModelCard(repo)

  // No snapshot for this repo: still give the reader the link rather than an
  // empty box or a build failure.
  if (!m || m.error) {
    return (
      <Shell repo={repo} meta="hugging face">
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Metadata not in the local snapshot
          {m?.error ? ` (${m.error})` : ""}. Figures in the prose are taken from
          the repository directly.
        </p>
      </Shell>
    )
  }

  const dtypes = Object.entries(m.parameters ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => dtypeRank(a[0]) - dtypeRank(b[0]) || b[1] - a[1])

  // Packed formats (NVFP4 in a U8 tensor, say) mean the per-dtype counts do not
  // always add up to `total`. Surface that rather than papering over it — it is
  // a real property of the checkpoint, and this site has run into it twice.
  const dtypeSum = dtypes.reduce((s, [, v]) => s + v, 0)
  const sumsCleanly =
    !m.totalParameters ||
    !dtypeSum ||
    Math.abs(dtypeSum - m.totalParameters) <= 1

  // Headline pair, shown large. Everything else goes in the grid below.
  const hero: { label: string; value: string }[] = []
  if (m.totalParameters)
    hero.push({ label: "parameters", value: formatParams(m.totalParameters) })
  if (m.usedStorage)
    hero.push({ label: "repo size", value: formatBytes(m.usedStorage) })

  const stats: { label: string; value: string; wide?: boolean }[] = []
  if (m.architecture ?? m.modelType)
    stats.push({ label: "architecture", value: m.architecture ?? m.modelType! })
  if (m.pipelineTag) stats.push({ label: "task", value: m.pipelineTag })
  if (m.library) stats.push({ label: "library", value: m.library })
  if (m.license) stats.push({ label: "license", value: m.license })
  if (m.shardCount)
    stats.push({
      label: "safetensors",
      value: `${m.shardCount} shard${m.shardCount === 1 ? "" : "s"}`,
    })
  if (m.ggufCount) stats.push({ label: "gguf files", value: String(m.ggufCount) })
  if (m.largestFile)
    stats.push({ label: "largest file", value: formatBytes(m.largestFile) })
  if (m.fileCount) stats.push({ label: "files", value: String(m.fileCount) })
  if (typeof m.downloads === "number")
    stats.push({ label: "downloads", value: formatCount(m.downloads) })
  if (typeof m.likes === "number")
    stats.push({ label: "likes", value: formatCount(m.likes) })
  if (m.gated) stats.push({ label: "gated", value: String(m.gated) })
  if (m.languages?.length)
    stats.push({ label: "languages", value: m.languages.join(", ") })

  const updated = shortDate(m.lastModified)
  const meta = [
    m.revision ? `@${m.revision}` : null,
    `snapshot ${m.fetchedAt}`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Shell repo={m.id} meta={meta}>
      <div className="px-4 py-3.5">
        {/* Announced-versus-measured, when the article supplies the claim. */}
        {claimed && m.totalParameters ? (
          <div className="mb-3.5 grid grid-cols-2 gap-3 rounded-lg border bg-muted/25 px-3 py-2">
            <div>
              <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
                announced
              </div>
              <div className="mt-0.5 font-mono text-sm">{claimed}</div>
            </div>
            <div>
              <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
                measured
              </div>
              <div className="mt-0.5 font-mono text-sm tabular-nums">
                {m.totalParameters.toLocaleString()}
              </div>
            </div>
          </div>
        ) : null}

        {hero.length ? (
          <div className="mb-3.5 flex flex-wrap gap-x-8 gap-y-2">
            {hero.map((h) => (
              <div key={h.label}>
                <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
                  {h.label}
                </div>
                <div className="font-mono text-2xl leading-tight tabular-nums">
                  {h.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Lineage: a derivative says what it derives from. */}
        {m.baseModel ? (
          <div className="mb-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-dashed px-3 py-2 font-mono text-xs">
            <span className="text-[9px] tracking-wide text-muted-foreground uppercase">
              {m.baseModelRelation ?? "base model"}
            </span>
            <span aria-hidden className="text-muted-foreground">
              of
            </span>
            <a
              href={`https://huggingface.co/${m.baseModel}`}
              className="break-all decoration-foreground/30 underline-offset-4 hover:underline"
            >
              {m.baseModel}
            </a>
          </div>
        ) : null}

        {stats.length ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
            {stats.map((s) => (
              <Stat key={s.label} {...s} />
            ))}
          </dl>
        ) : null}

        {/* Proportion bar — where the bytes actually live, by dtype. */}
        {dtypes.length ? (
          <div className="mt-4 border-t pt-3">
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              parameters by dtype
            </div>
            <div
              className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={dtypes
                .map(([d, v]) => `${d} ${formatParams(v)}`)
                .join(", ")}
            >
              {dtypes.map(([d, v]) => (
                <div
                  key={d}
                  style={{
                    width: `${(v / (dtypeSum || 1)) * 100}%`,
                    background: DTYPE_COLOR[d] ?? DTYPE_FALLBACK,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {dtypes.map(([d, v]) => (
                <span
                  key={d}
                  className="flex items-center gap-1.5 font-mono text-xs"
                >
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: DTYPE_COLOR[d] ?? DTYPE_FALLBACK }}
                  />
                  <span className="text-muted-foreground">{d}</span>
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

        {m.topics?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {m.topics.map((t) => (
              <span
                key={t}
                className="rounded-full border px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {note ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{note}</p>
        ) : null}

        {updated ? (
          <p className="mt-3 font-mono text-[10px] text-muted-foreground">
            repo last modified {updated}
          </p>
        ) : null}
      </div>
    </Shell>
  )
}
