// "Its expert pool has grown on its own to 169 experts."
//
// The pool is not a headline, it is a trajectory, and mini-AGI commits the
// trajectory: runs/samples.txt carries one block per sample with the character
// count and the live expert count on the same line. Every point below is read
// out of that file — 750 blocks, downsampled to 167 so every change of expert
// count survives.
//
// Two things the staircase shows that the number does not. The pool SHRINKS:
// nine prune events in the committed log, sixteen experts deleted. And growth
// is capped by a constant — config.yaml sets growth.every_chars to 2,000,000
// with growth.k = 1, so nothing can add faster than one expert per two million
// characters. That ceiling is the dashed line, and the run tracks well below it,
// which is what the five growth brakes are for.
//
// Zero JS. All arithmetic is +, -, * and / on exact doubles; no mlog10 here
// because both axes are linear.

// [characters read in millions, live expert count, held-out nats/char]
const SERIES: [number, number, number][] = [
  [3.0, 80, 2.5926], [4.2, 85, 2.3895], [5.2, 91, 2.3799], [6.2, 96, 2.2572],
  [9.0, 97, 2.0248], [14.6, 97, 1.8051], [21.5, 97, 1.5707], [28.2, 97, 1.481],
  [34.7, 97, 1.3994], [40.7, 97, 1.3293], [44.7, 98, 1.329], [46.1, 99, 1.2951],
  [48.5, 100, 1.2968], [50.1, 101, 1.2734], [52.1, 102, 1.2784], [54.1, 103, 1.2768],
  [56.1, 104, 1.2346], [58.4, 105, 1.2433], [60.2, 106, 1.2346], [62.4, 107, 1.2369],
  [64.1, 108, 1.2282], [66.3, 109, 1.2246], [68.0, 110, 1.2153], [70.2, 111, 1.2077],
  [72.3, 112, 1.2239], [74.1, 113, 1.1906], [76.4, 114, 1.2035], [78.1, 115, 1.1897],
  [83.8, 115, 1.1859], [89.2, 115, 1.1659], [94.4, 115, 1.1693], [99.9, 115, 1.1734],
  [104.4, 116, 1.1553], [106.4, 117, 1.1781], [108.3, 118, 1.1285], [110.2, 119, 1.1481],
  [112.2, 120, 1.126], [114.3, 121, 1.1363], [116.1, 122, 1.113], [118.1, 123, 1.1183],
  [120.3, 124, 1.1306], [122.2, 125, 1.1401], [124.3, 126, 1.11], [126.1, 127, 1.1256],
  [128.1, 128, 1.1157], [130.2, 129, 1.1141], [134.3, 130, 1.1138], [136.2, 131, 1.1012],
  [138.5, 132, 1.0922], [140.4, 133, 1.0953], [142.3, 134, 1.0991], [144.3, 135, 1.0988],
  [146.1, 136, 1.0806], [148.4, 137, 1.1091], [150.3, 138, 1.0795], [152.2, 139, 1.0836],
  [154.5, 140, 1.0544], [156.4, 141, 1.0813], [158.1, 142, 1.0564], [160.5, 143, 1.0401],
  [162.4, 144, 1.0295], [164.2, 145, 1.0334], [166.1, 146, 1.0482], [169.8, 146, 1.0206],
  [175.5, 146, 0.9832], [181.3, 146, 0.9664], [186.9, 146, 0.9548], [190.5, 147, 0.9476],
  [193.0, 147, 0.9342], [196.5, 144, 0.9348], [198.5, 143, 0.9155], [200.5, 142, 0.9231],
  [202.5, 137, 0.9374], [205.0, 137, 0.9358], [206.4, 138, 0.915], [208.3, 139, 0.9189],
  [210.2, 140, 0.9117], [212.2, 141, 0.9186], [216.6, 141, 0.9021], [222.8, 141, 0.9281],
  [224.3, 142, 0.9001], [226.4, 143, 0.8953], [230.5, 142, 0.9014], [232.6, 143, 0.9032],
  [238.6, 144, 0.891], [240.5, 145, 0.8877], [242.4, 146, 0.8935], [248.3, 147, 0.8842],
  [250.3, 146, 0.9076], [252.2, 147, 0.8836], [258.2, 148, 0.8759], [261.4, 149, 0.8727],
  [263.4, 150, 0.8785], [265.5, 151, 0.8763], [267.5, 152, 0.8717], [269.6, 153, 0.8627],
  [271.7, 154, 0.8776], [281.5, 155, 0.851], [283.6, 156, 0.8612], [285.7, 157, 0.8555],
  [289.8, 158, 0.8508], [291.9, 159, 0.849], [293.9, 160, 0.8576], [295.5, 161, 0.851],
  [297.5, 162, 0.8415], [299.6, 163, 0.8498], [301.7, 164, 0.844], [303.7, 165, 0.85],
  [305.7, 166, 0.8483], [307.5, 165, 0.8385], [309.6, 166, 0.841], [313.8, 167, 0.8431],
  [315.8, 168, 0.8357], [317.7, 169, 0.8379], [320.4, 170, 0.8566], [321.8, 171, 0.8323],
  [323.7, 172, 0.8327], [326.1, 173, 0.8343], [327.5, 174, 0.8297], [333.6, 175, 0.8355],
  [337.9, 176, 0.8358], [339.8, 177, 0.8222], [341.7, 178, 0.8381], [343.5, 179, 0.828],
  [345.7, 180, 0.821], [347.6, 179, 0.8229], [349.6, 180, 0.8192], [353.6, 178, 0.8164],
  [357.7, 179, 0.819],
]

// The README's snapshot: 318.1M characters, 169 experts, held-out 0.8336.
const SNAP_CHARS = 318.1
const SNAP_EXPERTS = 169

const X_MAX = 380
const Y_MAX = 240
const START_EXPERTS = 64

export function PoolGrowth() {
  const W = 840
  const H = 330
  const L = 52
  const R = 812
  const T = 30
  const B = 276
  const span = R - L
  const rise = B - T

  const x = (chars: number) => L + (chars / X_MAX) * span
  const y = (n: number) => B - (n / Y_MAX) * rise

  const path = SERIES.map(([c, n], i) => `${i === 0 ? "M" : "L"}${x(c).toFixed(2)},${y(n).toFixed(2)}`).join(" ")

  // Every point where the pool got smaller than the sample before it.
  const prunes = SERIES.filter(([, n], i) => i > 0 && n < SERIES[i - 1][1])

  const xTicks = [0, 50, 100, 150, 200, 250, 300, 350]
  const yTicks = [0, 40, 80, 120, 160, 200, 240]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the expert pool over the committed run · 167 samples read out of{" "}
        <span className="text-foreground">runs/samples.txt</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="A chart of mini-AGI's live expert count against characters read, from three million to 358 million. The pool starts at 64, jumps to 97 inside the first ten million characters, then climbs as a slow staircase to 180 before settling at 179. Nine steps go downward, the largest a drop from 142 to 137 at 202 million characters. A dashed line shows the ceiling the committed config allows, one expert per two million characters starting from 64, which reaches 243 by the end; the run tracks far below it after the first fifty million characters. A marker at 318 million characters and 169 experts shows the snapshot quoted in the README."
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={L} y1={y(t)} x2={R} y2={y(t)} className="stroke-border" strokeWidth={1} strokeOpacity={0.5} />
            <text x={L - 8} y={y(t) + 3.5} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={B + 16} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
            {t}M
          </text>
        ))}

        {/* what config.yaml allows: 64 + chars/2, one expert per 2M characters */}
        <line
          x1={x(0)}
          y1={y(START_EXPERTS)}
          x2={x(2 * (Y_MAX - START_EXPERTS))}
          y2={y(Y_MAX)}
          className="stroke-foreground/45"
          strokeWidth={1.5}
          strokeDasharray="6 5"
        />
        <text x={x(268)} y={y(START_EXPERTS + 268 / 2) - 9} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          ceiling: growth.every_chars 2M, k 1
        </text>

        {/* the pool itself */}
        <path d={path} fill="none" className="stroke-foreground" strokeWidth={2} strokeLinejoin="round" />

        {/* the pool getting smaller */}
        {prunes.map(([c, n]) => (
          <circle key={`${c}`} cx={x(c)} cy={y(n)} r={3.5} className="fill-destructive stroke-background" strokeWidth={1.2} />
        ))}

        {/* the README's snapshot */}
        <line x1={x(SNAP_CHARS)} y1={y(SNAP_EXPERTS)} x2={x(SNAP_CHARS)} y2={T + 10} className="stroke-foreground/50" strokeWidth={1} strokeDasharray="3 3" />
        <circle cx={x(SNAP_CHARS)} cy={y(SNAP_EXPERTS)} r={4.5} className="fill-foreground stroke-background" strokeWidth={1.5} />
        <text x={x(SNAP_CHARS) - 8} y={T + 12} textAnchor="end" className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          the quoted 169
        </text>

        <text x={L} y={T - 12} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          live experts in the pool
        </text>
        <text x={R} y={B + 16} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          characters read
        </text>

        <g className="font-mono" style={{ fontSize: 10 }}>
          <circle cx={L + 6} cy={B + 34} r={3.5} className="fill-destructive" />
          <text x={L + 16} y={B + 37.5} className="fill-muted-foreground">
            a sample where the pool was smaller than the one before it — nine of them, sixteen experts deleted
          </text>
        </g>
      </svg>
    </figure>
  )
}
