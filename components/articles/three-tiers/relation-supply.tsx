// The pattern that reconciles "Jev scores 0/100 on relational choice" with
// "Jev-first agents work": neither system ever asks the decision model a
// relational question. Deterministic code CONSTRUCTS the relation and hands the
// model an independent question about it.
//
// Left: Stanley links hunks by identifier (declaredIdentifiers ∩
// referencedIdentifiers, src/workflows/hunks.ts), then opens a two-hunk frame so
// the pair shares one state. Right: the xArm7 harness never asks for a movement
// vector; it asks four independent one-of-three questions and the executor
// supplies the magnitude.
//
// Server-rendered SVG, zero JS, integer arithmetic only.
const ACCENT = "oklch(0.60 0.15 255)"

const HUNKS = ["A", "B", "C", "D", "E"]
const AXES = [
  { k: "X", opts: "neg · hold · pos" },
  { k: "Y", opts: "neg · hold · pos" },
  { k: "Z", opts: "neg · hold · pos" },
  { k: "grip", opts: "open · hold · close" },
]

export function RelationSupply() {
  const W = 820
  const H = 396
  const mid = 412

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        two systems, one workaround — code builds the relation, the model scores one thing at a time
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[740px]"
        role="img"
        aria-label="Two panels. Left: Stanley splits a diff into hunks A through E, then deterministic code links hunk A to hunk D because A declares an identifier that D references. Only that constructed pair is placed into a single two-hunk frame, where one yes-or-no question asks whether A enables D. Right: the xArm7 harness does not ask for a movement vector, which would be a joint choice over eighty-one combinations. It asks four independent one-of-three questions for X, Y, Z and the gripper, and the deterministic executor supplies the step magnitude of eighteen, four or two millimetres. In both systems the model answers an independent question about a relation that code already built."
      >
        <defs>
          <filter id="rs-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
          </filter>
          <marker
            id="rs-arrow"
            viewBox="0 -5 10 10"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
            refX="7"
            refY="0"
          >
            <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
          </marker>
        </defs>

        <line x1={mid} y1={16} x2={mid} y2={H - 62} className="stroke-border" strokeWidth={1} />

        {/* ─────────── LEFT: Stanley ─────────── */}
        <text x={16} y={28} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          stanley-code · check
        </text>
        <text x={16} y={43} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          &quot;hunks are judged individually&quot; — its own notChecked list
        </text>

        {HUNKS.map((h, i) => {
          const y = 62 + i * 33
          const linked = h === "A" || h === "D"
          return (
            <g key={h}>
              <rect
                x={16}
                y={y}
                width={68}
                height={25}
                rx={5}
                className="fill-background"
                stroke={linked ? ACCENT : "var(--border)"}
                strokeWidth={linked ? 2 : 1}
              />
              <text x={27} y={y + 17} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
                hunk {h}
              </text>
            </g>
          )
        })}

        {/* deterministic link A -> D, drawn by code */}
        <path
          d="M 84 74 C 116 74, 116 173, 88 173"
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.5}
          markerEnd="url(#rs-arrow)"
        />
        {[
          "CODE, not the model:",
          "A declares an identifier",
          "that D references.",
          "A regex over added",
          "lines — no call.",
        ].map((t, i) => (
          <text
            key={t}
            x={104}
            y={96 + i * 12}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            {t}
          </text>
        ))}

        {/* the constructed pair frame */}
        <rect
          x={250}
          y={62}
          width={152}
          height={94}
          rx={8}
          className="fill-background"
          stroke={ACCENT}
          strokeWidth={2}
          filter="url(#rs-soft)"
        />
        <text x={262} y={80} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          one frame, two hunks
        </text>
        <text x={262} y={97} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          candidateHunk: A
        </text>
        <text x={262} y={109} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          dependentHunk: D
        </text>
        <text x={262} y={129} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
          noul: does A add
        </text>
        <text x={262} y={141} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
          something D needs?
        </text>

        <rect
          x={250}
          y={170}
          width={152}
          height={28}
          rx={6}
          className="fill-muted/40 stroke-border"
          strokeWidth={1}
        />
        <text x={262} y={188} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
          p ≥ 0.60 → clear the flag
        </text>

        {[
          "The pair never competes as two options in one question.",
          "It arrives as one state with a yes-or-no about it — the",
          "one shape the model can answer.",
          "",
          "Rationed, too: only a weak hunk linked to a strongly-",
          "related one gets a follow-up, and it gets exactly one.",
        ].map((t, i) =>
          t ? (
            <text
              key={t}
              x={16}
              y={240 + i * 13}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              {t}
            </text>
          ) : null
        )}

        {/* ─────────── RIGHT: the arm ─────────── */}
        <text x={mid + 18} y={28} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          jev-robot-control · one control cycle
        </text>
        <text x={mid + 18} y={43} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          the vector the model is never asked for
        </text>

        {/* the question NOT asked */}
        <rect
          x={mid + 18}
          y={56}
          width={168}
          height={40}
          rx={6}
          className="fill-muted/30 stroke-border"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text x={mid + 28} y={73} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          &quot;pick a move&quot; — 3×3×3×3
        </text>
        <text x={mid + 28} y={86} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          = 81 joint options
        </text>
        <line
          x1={mid + 24}
          y1={92}
          x2={mid + 180}
          y2={60}
          className="stroke-destructive"
          strokeWidth={1.5}
          opacity={0.75}
        />

        <text x={mid + 18} y={112} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          asked instead, in parallel, none reading another&apos;s answer:
        </text>

        {AXES.map((a, i) => {
          const y = 120 + i * 37
          return (
            <g key={a.k}>
              <rect
                x={mid + 18}
                y={y}
                width={168}
                height={29}
                rx={6}
                className="fill-background"
                stroke={ACCENT}
                strokeWidth={1.5}
              />
              <text x={mid + 28} y={y + 13} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
                question {i + 1}: {a.k}
              </text>
              <text x={mid + 28} y={y + 24} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {a.opts}
              </text>
              <line
                x1={mid + 186}
                y1={y + 14}
                x2={mid + 230}
                y2={y + 14}
                className="stroke-border"
                strokeWidth={1.2}
              />
            </g>
          )
        })}

        {/* the executor */}
        <rect
          x={mid + 234}
          y={120}
          width={150}
          height={140}
          rx={8}
          className="fill-background stroke-border"
          strokeWidth={1.5}
          filter="url(#rs-soft)"
        />
        <text x={mid + 246} y={140} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          shared executor
        </text>
        <text x={mid + 246} y={158} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          CODE supplies:
        </text>
        {["step 18 / 4 / 2 mm", "inverse kinematics", "workspace bounds", "0.32 s physics step"].map(
          (t, i) => (
            <text
              key={t}
              x={mid + 246}
              y={174 + i * 14}
              className="fill-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              {t}
            </text>
          )
        )}
        <text x={mid + 246} y={236} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          MODEL supplies:
        </text>
        <text x={mid + 246} y={251} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
          four signs.
        </text>

        {[
          "The model chooses direction. Code chooses distance.",
          "Every relation between the axes lives in the executor.",
        ].map((t, i) => (
          <text
            key={t}
            x={mid + 18}
            y={288 + i * 13}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            {t}
          </text>
        ))}

        {/* shared footer */}
        <line x1={16} y1={H - 52} x2={W - 16} y2={H - 52} className="stroke-border" strokeWidth={1} />
        <text x={16} y={H - 32} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          Same move, twice: a relation the decision tier cannot form is built by the tier below it,
        </text>
        <text x={16} y={H - 17} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          then handed down as an independent question. The workaround is the architecture.
        </text>
      </svg>
    </figure>
  )
}
