import {
  formatBytes,
  formatCount,
  getRepoCard,
  repoUrl,
  sourceForField,
  sourceLabel,
  type RepoCardSnapshot,
} from "@/lib/repo-cards"

// <RepoCard repo="facebookresearch/sam3" /> — a repository's own facts, read
// from a committed snapshot (see lib/repo-cards.ts for why it is a snapshot and
// not a live fetch, and for the two sources it can come from).
//
// A server component on purpose: the data is static JSON at build time, so this
// ships no JavaScript and renders identically for a reader and for the .md agent
// variant of the page.
//
// Dual-native rule: this is *corroboration*, not the argument. An article must
// still state in prose whatever the card shows that matters — the card exists so
// a reader can see the repository's own figure next to the claimed one, not so
// the prose can skip saying which is which.

/**
 * GitHub's own mark, from `@primer/octicons` v19.15.1 (`mark-github-16.svg`),
 * transcribed to JSX rather than approximated, and inlined so the card never
 * reaches a third-party host to render. Octicons is MIT-licensed; the licence
 * text is committed beside this file as OCTICONS-LICENSE.txt, per this repo's
 * habit of shipping the terms with anything it redistributes. Used
 * nominatively, to label a link to github.com.
 */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      role="img"
      aria-label="GitHub"
      className={className}
      fill="currentColor"
    >
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  )
}

// One hue per rank rather than per language: a per-language colour table would
// be a second set of facts to keep true, and the legend sits next to the bar.
const LANG_COLOR = [
  "oklch(0.62 0.17 30)",
  "oklch(0.65 0.15 60)",
  "oklch(0.68 0.13 85)",
  "oklch(0.60 0.14 155)",
  "oklch(0.56 0.13 175)",
  "oklch(0.58 0.13 230)",
  "oklch(0.54 0.14 265)",
  "oklch(0.55 0.02 250)",
]

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
          href={repoUrl(repo)}
          className="group flex min-w-0 items-center gap-2"
        >
          <GitHubMark className="h-4 w-4 shrink-0" />
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

export function RepoCard({
  repo,
  /** Optional one-line note rendered under the grid. */
  note,
}: {
  repo: string
  note?: string
}) {
  const r: RepoCardSnapshot | null = getRepoCard(repo)

  // No snapshot for this repo: still give the reader the link rather than an
  // empty box or a build failure.
  if (!r || r.error) {
    return (
      <Shell repo={repo} meta="github">
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Repository facts not in the local snapshot
          {r?.error ? ` (${r.error})` : ""}. Figures in the prose are taken from
          the repository directly.
        </p>
      </Shell>
    )
  }

  const languages = (r.languages ?? []).filter((l) => l.bytes > 0).slice(0, 7)
  const langTotal = languages.reduce((s, l) => s + l.bytes, 0)
  const langFrom = sourceForField(r, "languages")

  // Headline pair, shown large. Everything else goes in the grid below. Stars
  // only exist in an API snapshot; tracked files only in a clone snapshot — so
  // which two numbers a card leads with already tells you where it came from.
  const hero: { label: string; value: string }[] = []
  if (typeof r.stars === "number")
    hero.push({ label: "stars", value: formatCount(r.stars) })
  if (typeof r.fileCount === "number")
    hero.push({ label: "tracked files", value: r.fileCount.toLocaleString() })

  const pinned = shortDate(r.commitDate)

  const stats: { label: string; value: string; wide?: boolean }[] = []
  if (r.license) stats.push({ label: "license", value: r.license })
  if (r.branch) stats.push({ label: "branch", value: r.branch })
  if (typeof r.forks === "number")
    stats.push({ label: "forks", value: formatCount(r.forks) })
  if (typeof r.openIssues === "number")
    stats.push({ label: "open issues", value: formatCount(r.openIssues) })
  if (typeof r.hasTests === "boolean")
    stats.push({
      label: "tests",
      value: r.hasTests
        ? r.testFileCount
          ? `${r.testFileCount} file${r.testFileCount === 1 ? "" : "s"}`
          : "present"
        : "none found",
    })
  if (langTotal) stats.push({ label: "source", value: formatBytes(langTotal) })
  if (pinned) stats.push({ label: "commit date", value: pinned })
  if (r.pushedAt && !pinned)
    stats.push({ label: "last push", value: shortDate(r.pushedAt)! })
  if (r.archived) stats.push({ label: "archived", value: "yes" })

  // The commit is the whole point of the header: every number below describes
  // that tree and no other.
  const meta = [r.commit ? `@${r.commit}` : null, `snapshot ${r.fetchedAt}`]
    .filter(Boolean)
    .join(" · ")

  return (
    <Shell repo={r.id} meta={meta}>
      <div className="px-4 py-3.5">
        {r.description ? (
          <p className="mb-3.5 text-sm leading-6 text-muted-foreground">
            {r.description}
          </p>
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

        {stats.length ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
            {stats.map((s) => (
              <Stat key={s.label} {...s} />
            ))}
          </dl>
        ) : null}

        {/* Proportion bar — where the source actually is, by language. */}
        {languages.length ? (
          <div className="mt-4 border-t pt-3">
            <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
              source by language
            </div>
            <div
              className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={languages
                .map(
                  (l) =>
                    `${l.name} ${formatBytes(l.bytes)}${
                      l.files
                        ? ` in ${l.files} file${l.files === 1 ? "" : "s"}`
                        : ""
                    }`
                )
                .join(", ")}
            >
              {languages.map((l, i) => (
                <div
                  key={l.name}
                  style={{
                    width: `${(l.bytes / (langTotal || 1)) * 100}%`,
                    background:
                      LANG_COLOR[i] ?? LANG_COLOR[LANG_COLOR.length - 1],
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {languages.map((l, i) => (
                <span
                  key={l.name}
                  className="flex items-center gap-1.5 font-mono text-xs"
                >
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        LANG_COLOR[i] ?? LANG_COLOR[LANG_COLOR.length - 1],
                    }}
                  />
                  <span className="text-muted-foreground">{l.name}</span>
                  <span className="tabular-nums">{formatBytes(l.bytes)}</span>
                  {/* File counts, because bytes alone mislead: twelve notebooks
                      with embedded outputs outweigh two hundred .py files. */}
                  {l.files ? (
                    <span className="text-muted-foreground tabular-nums">
                      ({l.files})
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
            {langFrom?.kind === "local-clone" ? (
              <p className="mt-2 font-mono text-[10px] leading-4 text-muted-foreground">
                by size of tracked source at this commit, file counts in
                brackets; docs, data and vendored trees excluded
              </p>
            ) : null}
          </div>
        ) : null}

        {r.topics?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.topics.slice(0, 8).map((t) => (
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

        {/* Provenance. A repo card can be assembled from the GitHub API, from a
            clone of the repo read on this machine, or from both — so it says
            which fields came from where, and when. */}
        {r.sources?.length ? (
          <div className="mt-4 space-y-1.5 border-t pt-3">
            {r.sources.map((s) => (
              <p
                key={s.kind}
                className="font-mono text-[10px] leading-4 text-muted-foreground"
              >
                <span className="text-foreground/70">
                  {sourceLabel(s.kind)}
                </span>
                , {s.at}
                {s.kind === "local-clone" && r.commit
                  ? ` at ${r.commit}`
                  : ""}{" "}
                — {s.fields.join(", ")}
              </p>
            ))}
            {r.shallow ? (
              <p className="font-mono text-[10px] leading-4 text-muted-foreground">
                shallow clone: counts describe the pinned tree, not the history
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Shell>
  )
}
