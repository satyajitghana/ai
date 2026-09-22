// Where google/ax's "single-writer architecture" actually holds, and where it
// stops. The unit of ownership is the conversation id; the mutual exclusion is
// an in-process Go map guarded by a sync.Mutex in internal/server/server.go.
// One process: the second caller gets FAILED_PRECONDITION. Three processes —
// what manifests/ax-deployment.yaml deploys — and each replica has its own map,
// so both callers are admitted and both reach the same actor and the same log.
//
// Server-rendered SVG, zero JS, integer arithmetic only.
const ACCENT = "oklch(0.60 0.15 255)"
const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"

function Pod({
  x,
  y,
  label,
  map: mapLabel,
  tone,
}: {
  x: number
  y: number
  label: string
  map: string
  tone: string
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={150}
        height={72}
        rx={6}
        className="fill-background"
        stroke={tone}
        strokeWidth={1.5}
      />
      <text
        x={x + 10}
        y={y + 20}
        className="fill-foreground font-mono"
        style={{ fontSize: 10 }}
      >
        {label}
      </text>
      <rect
        x={x + 10}
        y={y + 30}
        width={130}
        height={30}
        rx={4}
        className="fill-muted/40"
        stroke="var(--border)"
        strokeWidth={1}
        strokeDasharray="3 2"
      />
      <text
        x={x + 17}
        y={y + 49}
        className="fill-muted-foreground font-mono"
        style={{ fontSize: 8.5 }}
      >
        {mapLabel}
      </text>
    </g>
  )
}

export function OwnershipScope() {
  const W = 880
  const H = 452
  const mid = 440

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        single-writer per conversation — the lock is one Go map, and a Go map
        does not leave the process
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="Two panels comparing the scope of AX's single-writer exclusion. Left panel, one ax-server process: two clients both request conversation conv-7; the process holds an in-flight map guarded by a mutex, admits the first caller and rejects the second with FAILED_PRECONDITION. The single writer holds. Right panel, the three-replica ReplicaSet that the shipped manifest deploys: each of the three ax-server pods holds its own in-flight map, so client one is admitted by pod A and client two is admitted by pod B. Both drive the same Substrate actor, named after the conversation id, and both append to the same Postgres event log. The exclusion never crossed the process boundary. A footer strip records that ownership is acquired by inserting into the map at the start of the RPC, released by a deferred delete when the RPC returns, has no lease, no expiry and no fencing token, and that the only Service in the manifest tree is the one in front of Postgres."
      >
        <defs>
          <marker
            id="os-arrow"
            viewBox="0 -5 10 10"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
            refX="7"
            refY="0"
          >
            <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
          </marker>
          <marker
            id="os-arrow-bad"
            viewBox="0 -5 10 10"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
            refX="7"
            refY="0"
          >
            <path d="M0,-4L6,0L0,4" fill="none" stroke={BAD} strokeWidth={1.5} />
          </marker>
        </defs>

        <line
          x1={mid}
          y1={14}
          x2={mid}
          y2={H - 66}
          className="stroke-border"
          strokeWidth={1}
        />

        {/* ───────────────── LEFT: one process ───────────────── */}
        <text x={16} y={26} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          one ax-server process
        </text>
        <text
          x={16}
          y={41}
          className="font-mono"
          style={{ fontSize: 9 }}
          fill={GOOD}
        >
          the invariant holds
        </text>

        <rect
          x={16}
          y={62}
          width={96}
          height={26}
          rx={4}
          className="fill-background"
          stroke="var(--border)"
        />
        <text x={24} y={79} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
          client 1 · conv-7
        </text>
        <rect
          x={16}
          y={104}
          width={96}
          height={26}
          rx={4}
          className="fill-background"
          stroke="var(--border)"
        />
        <text x={24} y={121} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
          client 2 · conv-7
        </text>

        <line
          x1={116}
          y1={75}
          x2={182}
          y2={90}
          stroke={ACCENT}
          strokeWidth={1.4}
          markerEnd="url(#os-arrow)"
        />
        <line
          x1={116}
          y1={117}
          x2={182}
          y2={104}
          stroke={ACCENT}
          strokeWidth={1.4}
          markerEnd="url(#os-arrow)"
        />

        <Pod x={190} y={62} label="ax-server" map="inFlight map + sync.Mutex" tone={ACCENT} />

        <text x={196} y={156} className="font-mono" style={{ fontSize: 9 }} fill={GOOD}>
          client 1 → admitted
        </text>
        <text x={196} y={172} className="font-mono" style={{ fontSize: 9 }} fill={BAD}>
          client 2 → FAILED_PRECONDITION
        </text>
        <text
          x={196}
          y={188}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          &quot;conversation is already in flight&quot;
        </text>

        <rect
          x={16}
          y={222}
          width={392}
          height={96}
          rx={5}
          className="fill-muted/30"
          stroke="var(--border)"
          strokeDasharray="4 3"
        />
        <text x={28} y={242} className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
          what the exclusion buys, in the project&apos;s own words
        </text>
        <text
          x={28}
          y={261}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          internal/harness/harness.go — &quot;a harness that durably
        </text>
        <text
          x={28}
          y={275}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          persists per-conversation state may use a last-write-wins
        </text>
        <text
          x={28}
          y={289}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          store without compare-and-swap, which is correct only
        </text>
        <text
          x={28}
          y={303}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          because there is a single writer per conversation.&quot;
        </text>

        {/* ───────────────── RIGHT: three replicas ───────────────── */}
        <text x={464} y={26} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          the shipped manifest — ReplicaSet, replicas: 3
        </text>
        <text x={464} y={41} className="font-mono" style={{ fontSize: 9 }} fill={BAD}>
          the invariant is not enforced anywhere
        </text>

        <rect
          x={464}
          y={62}
          width={86}
          height={24}
          rx={4}
          className="fill-background"
          stroke="var(--border)"
        />
        <text x={471} y={78} className="fill-foreground font-mono" style={{ fontSize: 8.5 }}>
          client 1 · conv-7
        </text>
        <rect
          x={464}
          y={96}
          width={86}
          height={24}
          rx={4}
          className="fill-background"
          stroke="var(--border)"
        />
        <text x={471} y={112} className="fill-foreground font-mono" style={{ fontSize: 8.5 }}>
          client 2 · conv-7
        </text>

        <line
          x1={554}
          y1={74}
          x2={600}
          y2={80}
          stroke={BAD}
          strokeWidth={1.4}
          markerEnd="url(#os-arrow-bad)"
        />
        <line
          x1={554}
          y1={108}
          x2={600}
          y2={158}
          stroke={BAD}
          strokeWidth={1.4}
          markerEnd="url(#os-arrow-bad)"
        />

        <Pod x={608} y={56} label="pod A" map="its own inFlight map" tone={BAD} />
        <Pod x={608} y={140} label="pod B" map="its own inFlight map" tone={BAD} />
        <Pod x={608} y={224} label="pod C" map="its own inFlight map" tone="var(--border)" />

        <text x={612} y={314} className="font-mono" style={{ fontSize: 9 }} fill={BAD}>
          both admitted
        </text>

        <line
          x1={758}
          y1={92}
          x2={790}
          y2={150}
          stroke={BAD}
          strokeWidth={1.4}
          markerEnd="url(#os-arrow-bad)"
        />
        <line
          x1={758}
          y1={176}
          x2={790}
          y2={166}
          stroke={BAD}
          strokeWidth={1.4}
          markerEnd="url(#os-arrow-bad)"
        />

        <rect
          x={794}
          y={140}
          width={70}
          height={40}
          rx={5}
          className="fill-background"
          stroke={BAD}
          strokeWidth={1.5}
        />
        <text x={800} y={157} className="fill-foreground font-mono" style={{ fontSize: 8.5 }}>
          actor
        </text>
        <text
          x={800}
          y={171}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8 }}
        >
          conv-7
        </text>
        <text
          x={794}
          y={196}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8 }}
        >
          one actor,
        </text>
        <text
          x={794}
          y={208}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8 }}
        >
          two turns
        </text>

        <rect
          x={794}
          y={232}
          width={70}
          height={40}
          rx={5}
          className="fill-background"
          stroke={BAD}
          strokeWidth={1.5}
        />
        <text x={800} y={249} className="fill-foreground font-mono" style={{ fontSize: 8.5 }}>
          event log
        </text>
        <text
          x={800}
          y={263}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8 }}
        >
          postgres
        </text>
        <line
          x1={758}
          y1={100}
          x2={790}
          y2={240}
          stroke={BAD}
          strokeWidth={1}
          strokeDasharray="3 3"
          markerEnd="url(#os-arrow-bad)"
        />
        <line
          x1={758}
          y1={184}
          x2={790}
          y2={248}
          stroke={BAD}
          strokeWidth={1}
          strokeDasharray="3 3"
          markerEnd="url(#os-arrow-bad)"
        />

        {/* ───────────────── footer ───────────────── */}
        <line
          x1={0}
          y1={H - 56}
          x2={W}
          y2={H - 56}
          className="stroke-border"
          strokeWidth={1}
        />
        <text
          x={16}
          y={H - 36}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          acquire: insert into the map when the RPC starts · release: a deferred
          delete when it returns · lease: none · expiry: none
        </text>
        <text
          x={16}
          y={H - 20}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8.5 }}
        >
          fencing token: none · the only Service in manifests/ is the one in front
          of Postgres; nothing pins a conversation to a replica
        </text>
      </svg>
    </figure>
  )
}
