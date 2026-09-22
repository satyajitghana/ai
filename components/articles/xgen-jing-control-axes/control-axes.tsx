// Six control dimensions, and the date each one started carrying a value.
//
// jing_flash_v1/config.json declares control_config.dim_in = 6, and
// models/control.py refuses to build anything else ("This demo supports
// six-dimensional camera control"). What fills those six is control_vector(),
// and at the 17 September release it populated two of them: strafe from a/d
// and forward/back from w/s, with the other four hard-coded 0.0.
//
// Commit cbeec31 on 20 September 2026 — "fix: remove unintended limitations
// and clean up prompt skills" — added i/k for pitch and j/l for yaw. Roll is
// still a literal zero.
//
// The parameter counts on the right are read from the safetensors headers of
// the fifteen shards: control.encoder (541,696) plus 50 FiLM block injectors
// at 6,041,088 each. Server-rendered, zero JS.

const LIVE = "oklch(0.60 0.15 255)" // wired at release
const NEW = "oklch(0.55 0.16 155)" // wired by cbeec31
const DEAD = "oklch(0.62 0.03 250)" // still zero

type Axis = { i: number; name: string; keys: string; state: "live" | "new" | "dead" }

const AXES: Axis[] = [
  { i: 0, name: "tx · strafe", keys: "d − a", state: "live" },
  { i: 1, name: "ty · rise", keys: "—", state: "dead" },
  { i: 2, name: "tz · forward", keys: "w − s", state: "live" },
  { i: 3, name: "pitch · look", keys: "i − k", state: "new" },
  { i: 4, name: "yaw · turn", keys: "l − j", state: "new" },
  { i: 5, name: "roll", keys: "—", state: "dead" },
]

const INJECTORS = 50
const PER_INJECTOR = 6_041_088
const ENCODER = 541_696
const CONTROL_TOTAL = ENCODER + INJECTORS * PER_INJECTOR // 302,596,096
const MODEL_TOTAL = 33_425_588_992

const W = 700
const H = 262
const SLOT_W = 70
const SLOT_H = 44
const SLOT_GAP = 10
const GRID_X = 22
const GRID_Y = 74

function colour(s: Axis["state"]) {
  return s === "live" ? LIVE : s === "new" ? NEW : DEAD
}

export function ControlAxes() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>control_vector() → [tx, ty, tz, pitch, yaw, roll]</span>
        <span className="text-muted-foreground/60">dim_in = 6, enforced</span>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[600px]"
          role="img"
          aria-label="Six control slots. Strafe and forward were driven by the w, a, s and d keys at the 17 September release. Pitch and yaw were connected to i, k, j and l by a commit on 20 September. Rise and roll are still hard-coded zero. Behind the six numbers sit 302,596,096 parameters: one encoder and fifty per-layer FiLM injectors, 0.91 percent of the model."
        >
          <text x={GRID_X} y={30} className="fill-foreground font-mono" fontSize={11}>
            what the six slots carry
          </text>
          <text
            x={GRID_X}
            y={48}
            className="fill-muted-foreground font-mono"
            fontSize={9.5}
          >
            one vector per slice; opposite keys cancel, so each slot is −1, 0 or +1
          </text>

          {AXES.map((a) => {
            const x = GRID_X + a.i * (SLOT_W + SLOT_GAP)
            const c = colour(a.state)
            return (
              <g key={a.name}>
                <rect
                  x={x}
                  y={GRID_Y}
                  width={SLOT_W}
                  height={SLOT_H}
                  rx={4}
                  fill={c}
                  fillOpacity={a.state === "dead" ? 0.1 : 0.18}
                  stroke={c}
                  strokeWidth={1.4}
                  strokeDasharray={a.state === "dead" ? "3 3" : undefined}
                />
                <text
                  x={x + SLOT_W / 2}
                  y={GRID_Y + 20}
                  textAnchor="middle"
                  className="fill-foreground font-mono"
                  fontSize={12}
                >
                  {a.state === "dead" ? "0.0" : a.keys}
                </text>
                <text
                  x={x + SLOT_W / 2}
                  y={GRID_Y + 34}
                  textAnchor="middle"
                  fill={c}
                  className="font-mono"
                  fontSize={8}
                >
                  {a.state === "dead" ? "literal" : "from keys"}
                </text>
                <text
                  x={x + SLOT_W / 2}
                  y={GRID_Y - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  fontSize={8.5}
                >
                  {a.name}
                </text>
              </g>
            )
          })}

          {/* legend — deliberately NOT a rail under the slots: the two live
              slots at the 17 September release are tx and tz, which are not
              adjacent, so a span would say something untrue about ty. */}
          {[
            { c: LIVE, t: "live at the 17 Sep release", x: GRID_X },
            {
              c: NEW,
              t: "wired by cbeec31, 20 Sep · “remove unintended limitations”",
              x: GRID_X + 190,
            },
          ].map((l) => (
            <g key={l.t}>
              <rect
                x={l.x}
                y={GRID_Y + 66}
                width={9}
                height={9}
                rx={2}
                fill={l.c}
                fillOpacity={0.8}
              />
              <text
                x={l.x + 14}
                y={GRID_Y + 74}
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                {l.t}
              </text>
            </g>
          ))}
          <g>
            <rect
              x={GRID_X}
              y={GRID_Y + 82}
              width={9}
              height={9}
              rx={2}
              fill={DEAD}
              fillOpacity={0.2}
              stroke={DEAD}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <text
              x={GRID_X + 14}
              y={GRID_Y + 90}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              still a literal 0.0 in the parser
            </text>
          </g>

          {/* the machinery behind them */}
          <line
            x1={GRID_X}
            x2={W - 22}
            y1={GRID_Y + 100}
            y2={GRID_Y + 100}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />

          {[
            {
              x: GRID_X,
              n: (CONTROL_TOTAL / 1e6).toFixed(1) + "M",
              k: "parameters behind the six numbers",
            },
            {
              x: 256,
              n: `${INJECTORS}`,
              k: "FiLM injectors, one per layer",
            },
            {
              x: 440,
              n: ((CONTROL_TOTAL / MODEL_TOTAL) * 100).toFixed(2) + "%",
              k: "of the 33.43B checkpoint",
            },
          ].map((r) => (
            <g key={r.k}>
              <text
                x={r.x}
                y={GRID_Y + 130}
                className="fill-foreground font-mono"
                fontSize={20}
              >
                {r.n}
              </text>
              <text
                x={r.x}
                y={GRID_Y + 147}
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                {r.k}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </figure>
  )
}
