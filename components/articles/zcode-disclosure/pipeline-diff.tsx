// The two snapshot designs, side by side. Server-rendered, zero JS.
//
// Left: the workspace-snapshot pipeline as described in the public disclosure
// and in the two third-party assessment summaries -- an archive of the working
// tree built client-side and uploaded to the vendor's object storage. This is
// drawn at the level of "what data crossed which boundary", which is the level
// at which the incident is about anything. It is not drawn from code: that code
// is not in the published repository (see the audit below), so the shape here is
// the reporters' and the assessors' account, not my reading.
//
// Right: what v3.14.0 does instead, which IS in the published repository, at
// packages/services/src/git/repo/gitCheckpointRepo.ts -- a temporary
// GIT_INDEX_FILE, `git add -A -- <workspace pathspec>`, write-tree, commit-tree,
// and update-ref into a hidden ref inside the user's own repository. Nothing
// leaves the machine and nothing touches the user's real index.
//
// The interesting part is that the feature survived. Both designs give you
// restore-to-a-previous-state. Only one of them needs a network.

const LOCAL = "oklch(0.55 0.15 155)"
const REMOTE = "oklch(0.58 0.18 27)"
const NEUTRAL = "oklch(0.60 0.02 250)"

type Node = { y: number; label: string; sub: string; zone: "local" | "remote" }

const BEFORE: Node[] = [
  { y: 0, label: "working tree", sub: "source, plus the whole .git directory", zone: "local" },
  { y: 1, label: "archive built in ~/.zcode", sub: "packed and encrypted client-side", zone: "local" },
  { y: 2, label: "upload credential requested", sub: "server issues a key and limits", zone: "remote" },
  { y: 3, label: "direct upload to object storage", sub: "the bucket third parties later audited", zone: "remote" },
]

const AFTER: Node[] = [
  { y: 0, label: "working tree", sub: "scoped to the workspace pathspec", zone: "local" },
  { y: 1, label: "temporary GIT_INDEX_FILE", sub: "user's real index untouched", zone: "local" },
  { y: 2, label: "write-tree · commit-tree", sub: "objects land in the repo you already have", zone: "local" },
  { y: 3, label: "update-ref, hidden ref", sub: "restore, diff, delete — all local", zone: "local" },
]

function Column({
  title,
  version,
  nodes,
  x,
  note,
}: {
  title: string
  version: string
  nodes: Node[]
  x: number
  note: string
}) {
  const boxW = 268
  const boxH = 40
  const gap = 26
  return (
    <g>
      <text x={x} y={16} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
        {title}
      </text>
      <text x={x} y={29} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
        {version}
      </text>
      {nodes.map((n, i) => {
        const y = 44 + i * (boxH + gap)
        const c = n.zone === "remote" ? REMOTE : LOCAL
        return (
          <g key={n.label}>
            <rect
              x={x}
              y={y}
              width={boxW}
              height={boxH}
              rx={4}
              fill={c}
              opacity={n.zone === "remote" ? 0.14 : 0.1}
              stroke={c}
              strokeWidth={1}
            />
            <text x={x + 10} y={y + 17} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
              {n.label}
            </text>
            <text x={x + 10} y={y + 30} className="fill-muted-foreground font-mono" style={{ fontSize: 8 }}>
              {n.sub}
            </text>
            {i < nodes.length - 1 ? (
              <path
                d={`M ${x + boxW / 2} ${y + boxH} L ${x + boxW / 2} ${y + boxH + gap - 5}`}
                stroke={NEUTRAL}
                strokeWidth={1.2}
                markerEnd="url(#zc-arrow)"
              />
            ) : null}
          </g>
        )
      })}
      <text x={x} y={44 + nodes.length * (boxH + gap) + 2} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
        {note}
      </text>
    </g>
  )
}

export function PipelineDiff() {
  const W = 700
  const H = 330

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          where a workspace snapshot goes, before and after
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          left: reported · right: read from the published source
        </span>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[640px]"
          role="img"
          aria-label="Two flows side by side. The reported pipeline: working tree, then an archive built and encrypted in the .zcode directory, then an upload credential requested from the server, then a direct upload to object storage — the last two steps leaving the machine. The v3.14.0 checkpoint: working tree scoped to the workspace, a temporary git index file, write-tree and commit-tree, then update-ref into a hidden ref — every step local."
        >
          <defs>
            <marker id="zc-arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 1 L 6 4 L 0 7 z" fill={NEUTRAL} />
            </marker>
          </defs>

          <Column
            title="as reported, client 3.12.3"
            version="removed in 3.14.0"
            nodes={BEFORE}
            x={20}
            note="two of four steps cross the machine boundary"
          />
          <Column
            title="git checkpoint, client 3.14.0"
            version="packages/services/src/git/repo/gitCheckpointRepo.ts"
            nodes={AFTER}
            x={W / 2 + 22}
            note="zero steps cross the machine boundary"
          />

          <line x1={W / 2} x2={W / 2} y1={10} y2={H - 26} className="stroke-foreground/12" strokeWidth={1} />
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: LOCAL, opacity: 0.5 }} />
            <span className="text-muted-foreground">stays on the machine</span>
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: REMOTE, opacity: 0.5 }} />
            <span className="text-muted-foreground">crosses to the vendor</span>
          </span>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        The left column is not drawn from code — the code is not in the
        published repository. It is the shape described by the reporter and
        confirmed at the level of &quot;this workflow existed and has been
        disabled&quot; by both commissioned assessments. The right column is
        read directly from the source now on GitHub.
      </figcaption>
    </figure>
  )
}
