"use client"

import { useMemo, useState } from "react"

import { BUF, FLAG, FigureCard, GATE, Legend, Segmented } from "./shared"

// The routing gate, measured rather than described.
//
// RelateAnything scores every pair twice — once from a geometry-led branch and
// once from an appearance-led one — and mixes the two per predicate with a
// weight alpha_p that a small MLP reads off the predicate's text embedding
// alone (Eq. 2). The paper says three times that nothing supervises that gate.
//
// Both series below come out of the released artifacts, not out of the paper:
//
//   gate   alpha recomputed in float64 from vocab_head.gate_mlp applied to the
//          checkpoint's own normalised vocabulary matrix W. It agrees with the
//          243-row deployment bank shipped beside the weights to 5.9e-05, so
//          this is the routing the model actually runs.
//   buffer the vocab_head.alpha tensor stored inside model.pth for the same
//          243 strings. It is NOT what the gate above computes (r = 0.53).
//
//   flag   is_spatial, shipped in predicate_bank.npz: the per-predicate spatial
//          majority the training code fits its warm-start probe against.
//
// The AUC readouts are exact rank statistics over 15 flagged x 228 unflagged
// strings, computed at module scope from the same array the dots are drawn
// from — so the number under the chart cannot drift from the chart.
//
// Full 243-row dump: /articles/relate-anything/data/gate-routing.json

type Row = readonly [name: string, gate: number, buffer: number, flagged: 0 | 1]

const BANK: Row[] = [
  ["behind", 1.0, 0.9616, 1],
  ["below", 0.9998, 0.9481, 1],
  ["containing", 0.9987, 0.0264, 0],
  ["forming part of", 0.9975, 0.2126, 0],
  ["beside", 0.9962, 0.927, 1],
  ["to the right of", 0.9959, 0.9136, 1],
  ["next to", 0.9945, 0.9184, 1],
  ["underneath", 0.9937, 0.9062, 1],
  ["to the left of", 0.9913, 0.8975, 1],
  ["accompanying", 0.9885, 0.0143, 0],
  ["depicting", 0.9876, 0.1164, 0],
  ["under", 0.9844, 0.924, 1],
  ["in front of", 0.9796, 0.8767, 1],
  ["above", 0.9647, 0.8737, 1],
  ["surrounding", 0.9637, 0.191, 0],
  ["contains", 0.9597, 0.0576, 0],
  ["facing", 0.9594, 0.3746, 0],
  ["contained in", 0.9424, 0.0008, 0],
  ["depicted in", 0.9299, 0.4411, 0],
  ["contained within", 0.9265, 0.0001, 0],
  ["held by", 0.9263, 0.2535, 0],
  ["standing in front of", 0.9232, 0.1701, 0],
  ["comprising", 0.9163, 0.0002, 0],
  ["showing", 0.9047, 0.1129, 0],
  ["attached to", 0.9018, 0.0277, 0],
  ["bordering", 0.8981, 0.1203, 0],
  ["inside", 0.8877, 0.9104, 1],
  ["depicted on", 0.8797, 0.3863, 0],
  ["forming", 0.8707, 0.3017, 0],
  ["standing under", 0.8494, 0.2548, 0],
  ["standing among", 0.8419, 0.0128, 0],
  ["featuring", 0.8362, 0.6636, 0],
  ["over", 0.8243, 0.9503, 1],
  ["displaying", 0.823, 0.0004, 0],
  ["standing beside", 0.8211, 0.1908, 0],
  ["on top of", 0.8121, 0.9116, 1],
  ["holding", 0.8036, 0.1722, 0],
  ["near", 0.7781, 0.9917, 1],
  ["standing by", 0.7781, 0.1368, 0],
  ["standing next to", 0.7693, 0.2103, 0],
  ["part of", 0.7643, 0.6876, 0],
  ["standing on", 0.7559, 0.1355, 0],
  ["standing near", 0.7381, 0.1621, 0],
  ["standing in", 0.7333, 0.1806, 0],
  ["holding hands with", 0.7329, 0.001, 0],
  ["standing behind", 0.7184, 0.2775, 0],
  ["standing with", 0.7084, 0.0479, 0],
  ["on", 0.6381, 0.9256, 1],
  ["sitting beside", 0.6043, 0.0049, 0],
  ["sitting behind", 0.5577, 0.009, 0],
  ["sitting by", 0.4809, 0.0007, 0],
  ["sitting at", 0.4317, 0.0002, 0],
  ["sitting in", 0.4143, 0.0019, 0],
  ["sitting near", 0.4021, 0.0012, 0],
  ["leading", 0.3677, 0.2015, 0],
  ["sitting on", 0.3001, 0.0012, 0],
  ["having", 0.2326, 0.0122, 0],
  ["posing in front of", 0.2083, 0.1021, 0],
  ["wearing", 0.195, 0.0004, 0],
  ["playing", 0.1611, 0.0005, 0],
  ["looking past", 0.144, 0.0676, 0],
  ["posing for", 0.1284, 0.0056, 0],
  ["smiling at", 0.126, 0.0239, 0],
  ["walking on", 0.1, 0.0003, 0],
  ["posing with", 0.0904, 0.01, 0],
  ["walking past", 0.0903, 0.0006, 0],
  ["integrated into", 0.0828, 0.0008, 0],
  ["smiling with", 0.0804, 0.0199, 0],
  ["carrying", 0.0774, 0.0, 0],
  ["eating", 0.0642, 0.0, 0],
  ["riding in", 0.046, 0.0203, 0],
  ["reading", 0.0385, 0.0006, 0],
  ["looking into", 0.0375, 0.0273, 0],
  ["walking along", 0.0352, 0.0002, 0],
  ["playing with", 0.0333, 0.0002, 0],
  ["leaning on", 0.0329, 0.0363, 0],
  ["embedded in", 0.0327, 0.0134, 0],
  ["perching on", 0.031, 0.0004, 0],
  ["posing for photo with", 0.0293, 0.0071, 0],
  ["eating from", 0.028, 0.0, 0],
  ["approaching", 0.0276, 0.1426, 0],
  ["laughing with", 0.0263, 0.0006, 0],
  ["housing", 0.024, 0.0003, 0],
  ["looking at", 0.0232, 0.0186, 0],
  ["drinking from", 0.023, 0.0, 0],
  ["topped with", 0.0225, 0.1282, 0],
  ["kissing", 0.0213, 0.0003, 0],
  ["handling", 0.0212, 0.004, 0],
  ["performing near", 0.02, 0.0008, 0],
  ["lining", 0.02, 0.0, 0],
  ["enclosing", 0.0174, 0.0157, 0],
  ["running past", 0.0171, 0.0055, 0],
  ["reaching for", 0.017, 0.0001, 0],
  ["stepping on", 0.0169, 0.0002, 0],
  ["accommodating", 0.0162, 0.0, 0],
  ["climbing", 0.0134, 0.0095, 0],
  ["looking through", 0.0133, 0.0243, 0],
  ["dancing with", 0.0131, 0.0038, 0],
  ["striking", 0.0129, 0.0032, 0],
  ["growing in front of", 0.0129, 0.0414, 0],
  ["carried by", 0.0125, 0.0003, 0],
  ["leaning against", 0.0122, 0.0855, 0],
  ["kicking", 0.0119, 0.0051, 0],
  ["traveling along", 0.0112, 0.0015, 0],
  ["observing", 0.0098, 0.0006, 0],
  ["stored in", 0.0095, 0.0001, 0],
  ["embracing", 0.0091, 0.0003, 0],
  ["talking to", 0.0083, 0.0, 0],
  ["riding", 0.0081, 0.0059, 0],
  ["walking across", 0.0077, 0.0003, 0],
  ["passing", 0.0075, 0.0244, 0],
  ["hugging", 0.0075, 0.0003, 0],
  ["parked behind", 0.007, 0.0004, 0],
  ["walking with", 0.0069, 0.0001, 0],
  ["gripping", 0.0069, 0.0002, 0],
  ["following", 0.0067, 0.0038, 0],
  ["attaching to", 0.0065, 0.0, 0],
  ["appearing in", 0.0062, 0.0083, 0],
  ["working on", 0.0061, 0.0005, 0],
  ["working near", 0.006, 0.0004, 0],
  ["kneeling on", 0.0058, 0.0016, 0],
  ["watching", 0.0057, 0.0, 0],
  ["throwing", 0.0056, 0.0, 0],
  ["talking into", 0.0054, 0.0, 0],
  ["growing beside", 0.0054, 0.0111, 0],
  ["looking towards", 0.005, 0.0164, 0],
  ["listening to", 0.0047, 0.0, 0],
  ["parked in front of", 0.0044, 0.0009, 0],
  ["using", 0.0043, 0.0191, 0],
  ["reaching toward", 0.0043, 0.0003, 0],
  ["photographing", 0.0041, 0.0331, 0],
  ["tucked into", 0.004, 0.0015, 0],
  ["hitting", 0.0039, 0.0064, 0],
  ["preparing", 0.0038, 0.0106, 0],
  ["assisting", 0.0037, 0.0003, 0],
  ["supporting", 0.0036, 0.0001, 0],
  ["speaking into", 0.0036, 0.0001, 0],
  ["filling", 0.0033, 0.0017, 0],
  ["tucked under", 0.0027, 0.0078, 0],
  ["lying in", 0.0027, 0.0655, 0],
  ["touching", 0.0024, 0.0431, 0],
  ["leaning over", 0.0023, 0.0586, 0],
  ["connected to", 0.0022, 0.0001, 0],
  ["walking through", 0.0021, 0.0003, 0],
  ["working at", 0.0021, 0.0002, 0],
  ["framing", 0.002, 0.1308, 0],
  ["growing near", 0.002, 0.0054, 0],
  ["flying over", 0.002, 0.0583, 0],
  ["performing with", 0.002, 0.0, 0],
  ["towering over", 0.0018, 0.0262, 0],
  ["blooming from", 0.0018, 0.0022, 0],
  ["lying on", 0.0016, 0.0523, 0],
  ["growing among", 0.0016, 0.0007, 0],
  ["encircling", 0.0015, 0.0002, 0],
  ["growing in", 0.0014, 0.0083, 0],
  ["resting beside", 0.0014, 0.01, 0],
  ["bending over", 0.0013, 0.1283, 0],
  ["resting inside", 0.0011, 0.0224, 0],
  ["grazing on", 0.0011, 0.0, 0],
  ["singing into", 0.001, 0.0001, 0],
  ["parked on", 0.001, 0.0, 0],
  ["growing from", 0.001, 0.0015, 0],
  ["floating in", 0.001, 0.1075, 0],
  ["parked beside", 0.001, 0.0003, 0],
  ["walking towards", 0.001, 0.0002, 0],
  ["parked in", 0.001, 0.0001, 0],
  ["reaching towards", 0.001, 0.0007, 0],
  ["grazing in", 0.001, 0.0, 0],
  ["grazing near", 0.001, 0.0, 0],
  ["mounted on", 0.0008, 0.0374, 0],
  ["displaying content for", 0.0008, 0.0, 0],
  ["jumping over", 0.0008, 0.0422, 0],
  ["driving on", 0.0006, 0.0009, 0],
  ["writing on", 0.0005, 0.001, 0],
  ["shaking hands with", 0.0005, 0.0, 0],
  ["parked by", 0.0005, 0.0, 0],
  ["decorated with", 0.0005, 0.0003, 0],
  ["clinging to", 0.0005, 0.0, 0],
  ["pushing", 0.0004, 0.0213, 0],
  ["manipulating", 0.0004, 0.0, 0],
  ["cooling", 0.0004, 0.0027, 0],
  ["worn by", 0.0003, 0.0039, 0],
  ["parked near", 0.0003, 0.0001, 0],
  ["pointing at", 0.0003, 0.0003, 0],
  ["running across", 0.0003, 0.0025, 0],
  ["piercing", 0.0003, 0.0025, 0],
  ["driving past", 0.0002, 0.0019, 0],
  ["operating", 0.0002, 0.0027, 0],
  ["pulling", 0.0002, 0.0, 0],
  ["obscuring", 0.0002, 0.0022, 0],
  ["swimming in", 0.0002, 0.0024, 0],
  ["resting near", 0.0002, 0.0031, 0],
  ["feeding", 0.0002, 0.0, 0],
  ["incorporating", 0.0002, 0.0, 0],
  ["resting in", 0.0001, 0.0041, 0],
  ["occupying", 0.0001, 0.0002, 0],
  ["driving", 0.0001, 0.0004, 0],
  ["interacting with", 0.0001, 0.0, 0],
  ["driving along", 0.0001, 0.0003, 0],
  ["pedaling", 0.0001, 0.0, 0],
  ["underlying", 0.0001, 0.0107, 0],
  ["floating in water near", 0.0001, 0.0553, 0],
  ["running towards", 0.0001, 0.0013, 0],
  ["reflected in", 0.0001, 0.1312, 0],
  ["filming", 0.0001, 0.0003, 0],
  ["resting on", 0.0, 0.0025, 0],
  ["covering", 0.0, 0.0004, 0],
  ["hanging from", 0.0, 0.0103, 0],
  ["illuminating", 0.0, 0.01, 0],
  ["decorating", 0.0, 0.0008, 0],
  ["shading", 0.0, 0.0004, 0],
  ["resting against", 0.0, 0.0101, 0],
  ["casting shadow on", 0.0, 0.0014, 0],
  ["reflecting", 0.0, 0.0031, 0],
  ["covering head of", 0.0, 0.0008, 0],
  ["hanging on", 0.0, 0.0331, 0],
  ["steering", 0.0, 0.0, 0],
  ["topping", 0.0, 0.0002, 0],
  ["covering eyes of", 0.0, 0.0007, 0],
  ["serving", 0.0, 0.0, 0],
  ["reflecting in", 0.0, 0.009, 0],
  ["cutting", 0.0, 0.0036, 0],
  ["mounting", 0.0, 0.0559, 0],
  ["casting light on", 0.0, 0.0002, 0],
  ["encasing", 0.0, 0.0, 0],
  ["controlling", 0.0, 0.0005, 0],
  ["recording", 0.0, 0.0, 0],
  ["capturing sound from", 0.0, 0.0, 0],
  ["blocking", 0.0, 0.0083, 0],
  ["driving through", 0.0, 0.0006, 0],
  ["garnishing", 0.0, 0.0, 0],
  ["gesturing towards", 0.0, 0.0, 0],
  ["swinging", 0.0, 0.0015, 0],
  ["fastening", 0.0, 0.0012, 0],
  ["petting", 0.0, 0.0, 0],
  ["cushioning", 0.0, 0.0, 0],
  ["casting light upon", 0.0, 0.0001, 0],
  ["typing on", 0.0, 0.0049, 0],
  ["dipping into", 0.0, 0.0008, 0],
  ["emitting sound for", 0.0, 0.0, 0],
  ["resting under", 0.0, 0.022, 0],
  ["paddling", 0.0, 0.0003, 0],
  ["amplifying sound for", 0.0, 0.0002, 0],
]

const FLAGGED = BANK.filter((r) => r[3] === 1)
const UNFLAGGED = BANK.filter((r) => r[3] === 0)

/** Exact rank statistic: P(flagged ranks above unflagged), ties at one half. */
function auc(pick: (r: Row) => number): number {
  let wins = 0
  for (const p of FLAGGED) {
    for (const n of UNFLAGGED) {
      const a = pick(p)
      const b = pick(n)
      wins += a > b ? 1 : a === b ? 0.5 : 0
    }
  }
  return wins / (FLAGGED.length * UNFLAGGED.length)
}

const VIEWS = {
  gate: {
    label: "the released gate",
    pick: (r: Row) => r[1],
    color: GATE,
    auc: auc((r) => r[1]),
    above: BANK.filter((r) => r[1] > 0.5).length,
    note: "sigmoid(gate_mlp(W)), recomputed from the weights",
  },
  buffer: {
    label: "the shipped buffer",
    pick: (r: Row) => r[2],
    color: BUF,
    auc: auc((r) => r[2]),
    above: BANK.filter((r) => r[2] > 0.5).length,
    note: "vocab_head.alpha, as stored inside model.pth",
  },
} as const

type ViewKey = keyof typeof VIEWS

// Named anchors, drawn with a leader line so the strip reads without hovering.
// Named readouts under the strip. Text inside an SVG scales with the viewBox
// and is unreadable at phone width, so every label here is HTML.
const ANCHORS = ["riding", "wearing", "holding", "on", "above", "behind"]

// Deterministic vertical scatter, hashed from the predicate STRING rather than
// from its index. Two reasons: Math.random would differ between the server
// render and hydration, and an index hash would correlate with alpha (the
// array is sorted), drawing a diagonal where a scatter belongs.
function lane(name: string): number {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 997) / 997
}

const W = 1000
const H = 190
const PAD = 14 // room for a dot on the rail at alpha = 0 and alpha = 1
const X = (a: number) => PAD + a * (W - 2 * PAD)
const TICKS = [0, 0.25, 0.5, 0.75, 1]

export function GateRouting() {
  const [view, setView] = useState<ViewKey>("gate")
  const [picked, setPicked] = useState<string>("holding")

  const v = VIEWS[view]
  const points = useMemo(
    () =>
      BANK.map((r) => ({
        name: r[0],
        x: X(v.pick(r)),
        y: 10 + lane(r[0]) * (H - 20),
        flagged: r[3] === 1,
      })),
    [v]
  )
  const row = BANK.find((r) => r[0] === picked)

  return (
    <FigureCard
      label="predicate routing, 243-string release bank"
      right={
        <span className="font-mono">
          AUC vs. the corpus spatial flag{" "}
          <span style={{ color: v.color }}>{v.auc.toFixed(4)}</span>
        </span>
      }
    >
      <div className="flex items-baseline justify-between font-mono text-[10px] text-muted-foreground">
        <span>&larr; appearance branch</span>
        <span>geometry branch &rarr;</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 w-full"
        role="img"
        aria-label={`Routing weight for all 243 predicate strings of the release bank under ${v.label}, on an axis from 0 (appearance-led) to 1 (geometry-led). The 15 strings the corpus flags as spatial are drawn as rings; the rank statistic separating them from the other 228 is ${v.auc.toFixed(4)}.`}
      >
        {TICKS.map((t) => (
          <line
            key={t}
            x1={X(t)}
            x2={X(t)}
            y1={0}
            y2={H}
            stroke="currentColor"
            strokeWidth={t === 0.5 ? 2 : 1}
            strokeDasharray={t === 0.5 ? "6 4" : undefined}
            className="text-border"
          />
        ))}

        {points.map((p) => (
          <circle
            key={p.name}
            cx={p.x}
            cy={p.y}
            r={p.name === picked ? 7 : 5}
            fill={p.flagged ? "transparent" : v.color}
            fillOpacity={p.flagged ? 0 : 0.6}
            stroke={p.flagged ? FLAG : p.name === picked ? "currentColor" : "none"}
            strokeWidth={p.flagged ? 2.2 : 2}
            className={p.name === picked ? "text-foreground" : undefined}
            style={{ transition: "cx 320ms ease" }}
            onClick={() => setPicked(p.name)}
            onMouseEnter={() => setPicked(p.name)}
            cursor="pointer"
          >
            <title>{p.name}</title>
          </circle>
        ))}
      </svg>

      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        {TICKS.map((t) => (
          <span key={t}>{t.toFixed(2)}</span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
        {ANCHORS.map((name) => {
          const r = BANK.find((b) => b[0] === name)
          if (!r) return null
          return (
            <button
              key={name}
              type="button"
              onClick={() => setPicked(name)}
              className="cursor-pointer tabular-nums"
            >
              <span
                className={
                  name === picked ? "text-foreground" : "text-muted-foreground"
                }
              >
                {name}
              </span>{" "}
              <span style={{ color: v.color }}>{v.pick(r).toFixed(3)}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="showing"
          value={view}
          onChange={setView}
          options={[
            { value: "gate", label: "released gate", accent: GATE },
            { value: "buffer", label: "shipped buffer", accent: BUF },
          ]}
        />
        <span className="font-mono text-[11px] text-muted-foreground">
          {v.above} of 243 above 0.5
        </span>
      </div>

      {row ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          <span className="text-foreground">{row[0]}</span> — released gate{" "}
          <span style={{ color: GATE }}>{row[1].toFixed(4)}</span>, shipped buffer{" "}
          <span style={{ color: BUF }}>{row[2].toFixed(4)}</span>
          {row[3] === 1 ? ", flagged spatial by the corpus" : ", not flagged"}.
        </p>
      ) : null}

      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {v.note}. The buffer separates the corpus flag perfectly — AUC exactly
        1.0000, all 15 flagged strings above every one of the 228 others — which
        is what an initialisation regressed onto that flag looks like. The gate
        the model runs scores 0.9592, because training moved 35 unflagged
        strings (<span className="font-mono">containing</span>,{" "}
        <span className="font-mono">forming part of</span>,{" "}
        <span className="font-mono">depicting</span>) onto the geometry branch
        that the flag never put there.
      </p>

      <Legend
        items={[
          { color: v.color, label: `routing weight — ${v.label}` },
          { color: FLAG, label: "string the corpus flags spatial", ring: true },
        ]}
      />
    </FigureCard>
  )
}
