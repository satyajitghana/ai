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
 * The Hugging Face mark — their own `huggingface_logo-noborder.svg`, transcribed
 * to JSX rather than approximated, and inlined so the card never reaches a
 * third-party host to render. Used nominatively, to label a link to the Hub.
 */
function HuggingFaceMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 95 88"
      role="img"
      aria-label="Hugging Face"
      className={className}
      fill="none"
    >
      <path
        fill="#FFD21E"
        d="M47.21 76.5a34.75 34.75 0 1 0 0-69.5 34.75 34.75 0 0 0 0 69.5Z"
      />
      <path
        fill="#FF9D0B"
        d="M81.96 41.75a34.75 34.75 0 1 0-69.5 0 34.75 34.75 0 0 0 69.5 0Zm-73.5 0a38.75 38.75 0 1 1 77.5 0 38.75 38.75 0 0 1-77.5 0Z"
      />
      <path
        fill="#3A3B45"
        d="M58.5 32.3c1.28.44 1.78 3.06 3.07 2.38a5 5 0 1 0-6.76-2.07c.61 1.15 2.55-.72 3.7-.32ZM34.95 32.3c-1.28.44-1.79 3.06-3.07 2.38a5 5 0 1 1 6.76-2.07c-.61 1.15-2.56-.72-3.7-.32Z"
      />
      <path
        fill="#FF323D"
        d="M46.96 56.29c9.83 0 13-8.76 13-13.26 0-2.34-1.57-1.6-4.09-.36-2.33 1.15-5.46 2.74-8.9 2.74-7.19 0-13-6.88-13-2.38s3.16 13.26 13 13.26Z"
      />
      <path
        fill="#3A3B45"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M39.43 54a8.7 8.7 0 0 1 5.3-4.49c.4-.12.81.57 1.24 1.28.4.68.82 1.37 1.24 1.37.45 0 .9-.68 1.33-1.35.45-.7.89-1.38 1.32-1.25a8.61 8.61 0 0 1 5 4.17c3.73-2.94 5.1-7.74 5.1-10.7 0-2.34-1.57-1.6-4.09-.36l-.14.07c-2.31 1.15-5.39 2.67-8.77 2.67s-6.45-1.52-8.77-2.67c-2.6-1.29-4.23-2.1-4.23.29 0 3.05 1.46 8.06 5.47 10.97Z"
      />
      <path
        fill="#FF9D0B"
        d="M70.71 37a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM24.21 37a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM17.52 48c-1.62 0-3.06.66-4.07 1.87a5.97 5.97 0 0 0-1.33 3.76 7.1 7.1 0 0 0-1.94-.3c-1.55 0-2.95.59-3.94 1.66a5.8 5.8 0 0 0-.8 7 5.3 5.3 0 0 0-1.79 2.82c-.24.9-.48 2.8.8 4.74a5.22 5.22 0 0 0-.37 5.02c1.02 2.32 3.57 4.14 8.52 6.1 3.07 1.22 5.89 2 5.91 2.01a44.33 44.33 0 0 0 10.93 1.6c5.86 0 10.05-1.8 12.46-5.34 3.88-5.69 3.33-10.9-1.7-15.92-2.77-2.78-4.62-6.87-5-7.77-.78-2.66-2.84-5.62-6.25-5.62a5.7 5.7 0 0 0-4.6 2.46c-1-1.26-1.98-2.25-2.86-2.82A7.4 7.4 0 0 0 17.52 48Zm0 4c.51 0 1.14.22 1.82.65 2.14 1.36 6.25 8.43 7.76 11.18.5.92 1.37 1.31 2.14 1.31 1.55 0 2.75-1.53.15-3.48-3.92-2.93-2.55-7.72-.68-8.01.08-.02.17-.02.24-.02 1.7 0 2.45 2.93 2.45 2.93s2.2 5.52 5.98 9.3c3.77 3.77 3.97 6.8 1.22 10.83-1.88 2.75-5.47 3.58-9.16 3.58-3.81 0-7.73-.9-9.92-1.46-.11-.03-13.45-3.8-11.76-7 .28-.54.75-.76 1.34-.76 2.38 0 6.7 3.54 8.57 3.54.41 0 .7-.17.83-.6.79-2.85-12.06-4.05-10.98-8.17.2-.73.71-1.02 1.44-1.02 3.14 0 10.2 5.53 11.68 5.53.11 0 .2-.03.24-.1.74-1.2.33-2.04-4.9-5.2-5.21-3.16-8.88-5.06-6.8-7.33.24-.26.58-.38 1-.38 3.17 0 10.66 6.82 10.66 6.82s2.02 2.1 3.25 2.1c.28 0 .52-.1.68-.38.86-1.46-8.06-8.22-8.56-11.01-.34-1.9.24-2.85 1.31-2.85Z"
      />
      <path
        fill="#FFD21E"
        d="M38.6 76.69c2.75-4.04 2.55-7.07-1.22-10.84-3.78-3.77-5.98-9.3-5.98-9.3s-.82-3.2-2.69-2.9c-1.87.3-3.24 5.08.68 8.01 3.91 2.93-.78 4.92-2.29 2.17-1.5-2.75-5.62-9.82-7.76-11.18-2.13-1.35-3.63-.6-3.13 2.2.5 2.79 9.43 9.55 8.56 11-.87 1.47-3.93-1.71-3.93-1.71s-9.57-8.71-11.66-6.44c-2.08 2.27 1.59 4.17 6.8 7.33 5.23 3.16 5.64 4 4.9 5.2-.75 1.2-12.28-8.53-13.36-4.4-1.08 4.11 11.77 5.3 10.98 8.15-.8 2.85-9.06-5.38-10.74-2.18-1.7 3.21 11.65 6.98 11.76 7.01 4.3 1.12 15.25 3.49 19.08-2.12Z"
      />
      <path
        fill="#FF9D0B"
        d="M77.4 48c1.62 0 3.07.66 4.07 1.87a5.97 5.97 0 0 1 1.33 3.76 7.1 7.1 0 0 1 1.95-.3c1.55 0 2.95.59 3.94 1.66a5.8 5.8 0 0 1 .8 7 5.3 5.3 0 0 1 1.78 2.82c.24.9.48 2.8-.8 4.74a5.22 5.22 0 0 1 .37 5.02c-1.02 2.32-3.57 4.14-8.51 6.1-3.08 1.22-5.9 2-5.92 2.01a44.33 44.33 0 0 1-10.93 1.6c-5.86 0-10.05-1.8-12.46-5.34-3.88-5.69-3.33-10.9 1.7-15.92 2.78-2.78 4.63-6.87 5.01-7.77.78-2.66 2.83-5.62 6.24-5.62a5.7 5.7 0 0 1 4.6 2.46c1-1.26 1.98-2.25 2.87-2.82A7.4 7.4 0 0 1 77.4 48Zm0 4c-.51 0-1.13.22-1.82.65-2.13 1.36-6.25 8.43-7.76 11.18a2.43 2.43 0 0 1-2.14 1.31c-1.54 0-2.75-1.53-.14-3.48 3.91-2.93 2.54-7.72.67-8.01a1.54 1.54 0 0 0-.24-.02c-1.7 0-2.45 2.93-2.45 2.93s-2.2 5.52-5.97 9.3c-3.78 3.77-3.98 6.8-1.22 10.83 1.87 2.75 5.47 3.58 9.15 3.58 3.82 0 7.73-.9 9.93-1.46.1-.03 13.45-3.8 11.76-7-.29-.54-.75-.76-1.34-.76-2.38 0-6.71 3.54-8.57 3.54-.42 0-.71-.17-.83-.6-.8-2.85 12.05-4.05 10.97-8.17-.19-.73-.7-1.02-1.44-1.02-3.14 0-10.2 5.53-11.68 5.53-.1 0-.19-.03-.23-.1-.74-1.2-.34-2.04 4.88-5.2 5.23-3.16 8.9-5.06 6.8-7.33-.23-.26-.57-.38-.98-.38-3.18 0-10.67 6.82-10.67 6.82s-2.02 2.1-3.24 2.1a.74.74 0 0 1-.68-.38c-.87-1.46 8.05-8.22 8.55-11.01.34-1.9-.24-2.85-1.31-2.85Z"
      />
      <path
        fill="#FFD21E"
        d="M56.33 76.69c-2.75-4.04-2.56-7.07 1.22-10.84 3.77-3.77 5.97-9.3 5.97-9.3s.82-3.2 2.7-2.9c1.86.3 3.23 5.08-.68 8.01-3.92 2.93.78 4.92 2.28 2.17 1.51-2.75 5.63-9.82 7.76-11.18 2.13-1.35 3.64-.6 3.13 2.2-.5 2.79-9.42 9.55-8.55 11 .86 1.47 3.92-1.71 3.92-1.71s9.58-8.71 11.66-6.44c2.08 2.27-1.58 4.17-6.8 7.33-5.23 3.16-5.63 4-4.9 5.2.75 1.2 12.28-8.53 13.36-4.4 1.08 4.11-11.76 5.3-10.97 8.15.8 2.85 9.05-5.38 10.74-2.18 1.69 3.21-11.65 6.98-11.76 7.01-4.31 1.12-15.26 3.49-19.08-2.12Z"
      />
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
  const arch = m.architecture ?? m.modelType
  // Architecture identifiers run long (BailingMoeV3ForCausalLM); a single
  // column breaks them mid-word, so give the long ones two.
  if (arch)
    stats.push({ label: "architecture", value: arch, wide: arch.length > 18 })
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
