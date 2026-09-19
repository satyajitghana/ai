import { mlog10 } from "@/lib/dmath"

// What a minute of 30 fps video costs, three ways.
//
// The Meta Model API charges $0.20 per 1,000 frames — a flat line, because the
// price does not know how many objects are in the frame. The compute underneath
// it is not flat at all. Before Object Multiplex, a minute at 128 objects took
// 1,125 seconds of one H100; after it, 157. So the release did not only make the
// model faster, it moved the cost of the busiest frames from three times the
// list price to four tenths of it.
//
// Server-rendered, zero JS. Log y-axis because the range is twenty-fold, and it
// is the crossing that matters, not the area.

const ACCENT = "oklch(0.58 0.16 250)" // SAM 3.1
const MUTED = "oklch(0.62 0.03 260)" // SAM 3, Nov 2025
const PRICE = "oklch(0.58 0.17 30)" // the API's flat price

const N = [1, 2, 4, 8, 16, 32, 64, 128]
const NOV = [26.5, 23.8, 19.7, 14.6, 9.8, 5.8, 3.0, 1.6]
const MUX = [33.8, 33.3, 32.5, 31.6, 30.2, 22.1, 15.1, 11.5]

const RATE = 3.38 // median on-demand H100, $/GPU-hr, 39 providers, 2026-09-19
const FRAMES = 1800 // one minute at 30 fps
const API_MIN = (FRAMES * 0.2) / 1000 // $0.20 per 1,000 frames

const cost = (fps: number) => (FRAMES / fps / 3600) * RATE

const W = 700
const H = 300
const PL = 52
const PR = 128
const PT = 18
const PB = 40

// Decade grid from $0.03 to $3.
const LO = mlog10(0.03)
const HI = mlog10(3)
const y = (v: number) => PT + (1 - (mlog10(v) - LO) / (HI - LO)) * (H - PT - PB)
const x = (i: number) => PL + (i / (N.length - 1)) * (W - PL - PR)

const path = (vals: number[]) =>
  vals
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(cost(v)).toFixed(1)}`)
    .join(" ")

const TICKS = [0.03, 0.1, 0.3, 1, 3]

export function PriceFloor() {
  const apiY = y(API_MIN)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one minute of 30 fps video — list price vs rented compute</span>
        <span className="text-muted-foreground/60">log scale · USD</span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Cost of one minute of 30 fps video against the number of tracked objects. The Meta Model API charges a flat 36 cents. On a rented H100 at the median rate, SAM 3.1 costs 5 cents at one object rising to 14.7 cents at 128; the November 2025 SAM 3 costs 6.4 cents rising to $1.06, crossing above the API's flat price at roughly forty objects."
        >
          {/* shaded band: self-hosting costs more than the list price */}
          <rect
            x={PL}
            y={PT}
            width={W - PL - PR}
            height={apiY - PT}
            fill={PRICE}
            opacity={0.05}
          />

          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={PL}
                x2={W - PR}
                y1={y(t)}
                y2={y(t)}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
              <text
                x={PL - 8}
                y={y(t) + 3}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                ${t < 1 ? t.toFixed(2) : t.toFixed(0)}
              </text>
            </g>
          ))}

          {/* the API's flat price */}
          <line
            x1={PL}
            x2={W - PR}
            y1={apiY}
            y2={apiY}
            stroke={PRICE}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <text
            x={W - PR + 8}
            y={apiY - 4}
            className="font-mono"
            fill={PRICE}
            fontSize={10}
          >
            API list price
          </text>
          <text
            x={W - PR + 8}
            y={apiY + 9}
            className="font-mono"
            fill={PRICE}
            fontSize={10}
          >
            $0.36 · flat
          </text>

          <path d={path(NOV)} fill="none" stroke={MUTED} strokeWidth={2.5} strokeLinecap="round" />
          <path d={path(MUX)} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" />

          {N.map((n, i) => (
            <g key={n}>
              <circle cx={x(i)} cy={y(cost(NOV[i]))} r={3} fill={MUTED} stroke="var(--background)" strokeWidth={1.2} />
              <circle cx={x(i)} cy={y(cost(MUX[i]))} r={3} fill={ACCENT} stroke="var(--background)" strokeWidth={1.2} />
              <text
                x={x(i)}
                y={H - PB + 16}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                {n}
              </text>
            </g>
          ))}

          <text
            x={W - PR + 8}
            y={y(cost(NOV[7])) + 3}
            className="font-mono"
            fill={MUTED}
            fontSize={10}
          >
            SAM 3 · $1.06
          </text>
          <text
            x={W - PR + 8}
            y={y(cost(MUX[7])) + 3}
            className="font-mono"
            fill={ACCENT}
            fontSize={10}
          >
            SAM 3.1 · $0.15
          </text>

          <text
            x={(PL + W - PR) / 2}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            objects tracked in the frame →
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The flat line is a price; the two curves are costs. Meta charges the
          same $0.36 for a minute whether it holds one object or a hundred and
          twenty-eight — but under the November model, a hundred and
          twenty-eight objects burned{" "}
          <span style={{ color: MUTED }}>$1.06</span> of rented H100 to serve,
          almost three times the fare. Object Multiplex pulls that to{" "}
          <span style={{ color: ACCENT }}>$0.15</span>, back under the line with
          room to spare. Whether that is why the price is flat, only Meta knows.
        </p>
      </div>
    </figure>
  )
}
