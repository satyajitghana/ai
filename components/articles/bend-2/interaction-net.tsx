"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Interaction combinators, drawn as Lafont draws them: agents are triangles,
// the tip is the ONE principal port, the flat base holds the (here: two)
// auxiliary ports. A "redex" (an active pair) is just two principal ports
// wired to each other -- nothing more. The three scenes below are the three
// facts that make this a parallel model of computation with no scheduler:
//
//   annihilate  (A B) ~ (C D)  ->  A~C, B~D            -- same agent, cancels
//   commute     (A B) ~ {C D}  ->  {x y}~A, {z w}~B,   -- different agents,
//                                  (x z)~C, (y w)~D       clones both
//   parallel    N independent redexes reduce to the SAME net whether a
//               single core visits them one at a time, or N cores grab one
//               each -- because firing one redex only ever touches the two
//               agents at its own principal ports. Nothing elsewhere in the
//               net can even tell which happened first.
//
// This is the mechanism behind HVM / HVM2 / Bend 1. Bend 2's own runtime
// (BendRT) does NOT use it -- see the prose right after this component.
// Rules per Lafont 1997 / HVM2 (Taelin 2024); illustrative, not to scale.

const CON = "oklch(0.58 0.17 250)"
const DUP = "oklch(0.70 0.16 55)"
const WIRE_IDLE = "var(--border)"

type Stage = "annihilate" | "commute" | "parallel"

type Dir = "right" | "left"

function agentPts(x: number, y: number, dir: Dir, hw = 30, hh = 22) {
  const apex: [number, number] = dir === "right" ? [x + hw, y] : [x - hw, y]
  const b1: [number, number] = dir === "right" ? [x - hw, y - hh] : [x + hw, y - hh]
  const b2: [number, number] = dir === "right" ? [x - hw, y + hh] : [x + hw, y + hh]
  return { apex, b1, b2 }
}

function Agent({
  x, y, dir, kind, dim = false, small = false,
}: { x: number; y: number; dir: Dir; kind: "CON" | "DUP"; dim?: boolean; small?: boolean }) {
  const hw = small ? 20 : 30
  const hh = small ? 14 : 22
  const { apex, b1, b2 } = agentPts(x, y, dir, hw, hh)
  const color = kind === "CON" ? CON : DUP
  return (
    <g opacity={dim ? 0.25 : 1} className="transition-opacity duration-300">
      <path
        d={`M ${apex[0]} ${apex[1]} L ${b1[0]} ${b1[1]} L ${b2[0]} ${b2[1]} Z`}
        fill={color} fillOpacity={0.16} stroke={color} strokeWidth={1.5}
        filter={small ? undefined : "url(#in-soft)"}
      />
      <text x={x} y={y + (small ? 3 : 3.5)} textAnchor="middle" className="font-mono font-semibold"
        fontSize={small ? 8 : 10} fill={color}>
        {kind}
      </text>
    </g>
  )
}

function Leaf({ x, y, label, faded = false }: { x: number; y: number; label?: string; faded?: boolean }) {
  return (
    <g opacity={faded ? 0.35 : 1}>
      <circle cx={x} cy={y} r={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
      {label ? (
        <text x={x} y={y + 3} textAnchor="middle" fontSize={8.5} className="fill-muted-foreground font-mono">
          {label}
        </text>
      ) : null}
    </g>
  )
}

function wireD(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

const W = 720
const H = 300

function AnnihilateScene({ fired }: { fired: boolean }) {
  const ly = 150
  const leftX = 300, rightX = 420
  const left = agentPts(leftX, ly, "right")
  const right = agentPts(rightX, ly, "left")
  const leafA = { x: 190, y: 118 }
  const leafB = { x: 190, y: 182 }
  const leafC = { x: 530, y: 118 }
  const leafD = { x: 530, y: 182 }
  return (
    <>
      {/* stub wires, agent to leaf -- fade once the agents are gone */}
      <path d={wireD(left.b1[0], left.b1[1], leafA.x, leafA.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} opacity={fired ? 0.15 : 1} />
      <path d={wireD(left.b2[0], left.b2[1], leafB.x, leafB.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} opacity={fired ? 0.15 : 1} />
      <path d={wireD(right.b1[0], right.b1[1], leafC.x, leafC.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} opacity={fired ? 0.15 : 1} />
      <path d={wireD(right.b2[0], right.b2[1], leafD.x, leafD.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} opacity={fired ? 0.15 : 1} />

      {/* the direct rewire, once the redex fires */}
      {fired ? (
        <>
          <path d={wireD(leafA.x, leafA.y, leafC.x, leafC.y)} fill="none" stroke={CON} strokeWidth={2} opacity={0.85} />
          <path d={wireD(leafB.x, leafB.y, leafD.x, leafD.y)} fill="none" stroke={CON} strokeWidth={2} opacity={0.85} />
        </>
      ) : (
        <ellipse cx={(leftX + rightX) / 2 + 10} cy={ly} rx={26} ry={16} fill={CON} opacity={0.12} />
      )}

      <Leaf x={leafA.x} y={leafA.y} label="A" />
      <Leaf x={leafB.x} y={leafB.y} label="B" />
      <Leaf x={leafC.x} y={leafC.y} label="C" />
      <Leaf x={leafD.x} y={leafD.y} label="D" />
      <Agent x={leftX} y={ly} dir="right" kind="CON" dim={fired} />
      <Agent x={rightX} y={ly} dir="left" kind="CON" dim={fired} />

      <text x={W / 2} y={40} textAnchor="middle" fontSize={11} className="fill-muted-foreground font-mono">
        {fired ? "(A B) ~ (C D)  ->  A~C, B~D" : "two CON agents, principal port to principal port"}
      </text>
    </>
  )
}

function CommuteScene({ fired }: { fired: boolean }) {
  const ly = 150
  const leftX = 300, rightX = 420
  const left = agentPts(leftX, ly, "right")
  const right = agentPts(rightX, ly, "left")
  const leafA = { x: 170, y: 90 }
  const leafB = { x: 170, y: 210 }
  const leafC = { x: 550, y: 90 }
  const leafD = { x: 550, y: 210 }

  // post-fire: two fresh DUPs (near A, B) and two fresh CONs (near C, D),
  // wired per {x y}~A, {z w}~B, (x z)~C, (y w)~D -- the crossing is real.
  const dupA = agentPts(226, 90, "left", 20, 14) // apex faces leafA
  const dupB = agentPts(226, 210, "left", 20, 14)
  const conC = agentPts(494, 90, "right", 20, 14)
  const conD = agentPts(494, 210, "right", 20, 14)

  return (
    <>
      {!fired ? (
        <>
          <path d={wireD(left.b1[0], left.b1[1], leafA.x, leafA.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} />
          <path d={wireD(left.b2[0], left.b2[1], leafB.x, leafB.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} />
          <path d={wireD(right.b1[0], right.b1[1], leafC.x, leafC.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} />
          <path d={wireD(right.b2[0], right.b2[1], leafD.x, leafD.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} />
          <ellipse cx={(leftX + rightX) / 2 + 10} cy={ly} rx={26} ry={16} fill={DUP} opacity={0.14} />
          <Agent x={leftX} y={ly} dir="right" kind="CON" />
          <Agent x={rightX} y={ly} dir="left" kind="DUP" />
        </>
      ) : (
        <>
          {/* stubs to the outer leaves */}
          <path d={wireD(leafA.x, leafA.y, dupA.apex[0], dupA.apex[1])} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} />
          <path d={wireD(leafB.x, leafB.y, dupB.apex[0], dupB.apex[1])} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} />
          <path d={wireD(conC.apex[0], conC.apex[1], leafC.x, leafC.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} />
          <path d={wireD(conD.apex[0], conD.apex[1], leafD.x, leafD.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} />
          {/* the crossing: DUP_A -> {CON_C top, CON_D top}; DUP_B -> {CON_C bottom, CON_D bottom} */}
          <path d={wireD(dupA.b1[0], dupA.b1[1], conC.b1[0], conC.b1[1])} fill="none" stroke={DUP} strokeWidth={1.5} opacity={0.8} />
          <path d={wireD(dupA.b2[0], dupA.b2[1], conD.b1[0], conD.b1[1])} fill="none" stroke={DUP} strokeWidth={1.5} opacity={0.8} />
          <path d={wireD(dupB.b1[0], dupB.b1[1], conC.b2[0], conC.b2[1])} fill="none" stroke={DUP} strokeWidth={1.5} opacity={0.8} />
          <path d={wireD(dupB.b2[0], dupB.b2[1], conD.b2[0], conD.b2[1])} fill="none" stroke={DUP} strokeWidth={1.5} opacity={0.8} />
          <Agent x={226} y={90} dir="left" kind="DUP" small />
          <Agent x={226} y={210} dir="left" kind="DUP" small />
          <Agent x={494} y={90} dir="right" kind="CON" small />
          <Agent x={494} y={210} dir="right" kind="CON" small />
        </>
      )}
      <Leaf x={leafA.x} y={leafA.y} label="A" />
      <Leaf x={leafB.x} y={leafB.y} label="B" />
      <Leaf x={leafC.x} y={leafC.y} label="C" />
      <Leaf x={leafD.x} y={leafD.y} label="D" />

      <text x={W / 2} y={40} textAnchor="middle" fontSize={11} className="fill-muted-foreground font-mono">
        {fired ? "(A B) ~ {C D}  ->  {x y}~A, {z w}~B, (x z)~C, (y w)~D" : "a CON meets a DUP: different agents"}
      </text>
    </>
  )
}

const PAIR_YS = [50, 118, 186, 254]

function ParallelScene({ firedCount }: { firedCount: number }) {
  return (
    <>
      <text x={W / 2} y={26} textAnchor="middle" fontSize={11} className="fill-muted-foreground font-mono">
        four independent redexes, in the same net at the same time
      </text>
      {PAIR_YS.map((y, i) => {
        const done = i < firedCount
        const leftX = 320, rightX = 400
        const left = agentPts(leftX, y, "right", 22, 15)
        const right = agentPts(rightX, y, "left", 22, 15)
        const leafA = { x: 240, y }
        const leafD = { x: 480, y }
        return (
          <g key={i}>
            <text x={150} y={y + 3} fontSize={9.5} className="fill-muted-foreground font-mono">pair {i + 1}</text>
            {done ? (
              <path d={wireD(leafA.x, leafA.y, leafD.x, leafD.y)} fill="none" stroke={CON} strokeWidth={2} opacity={0.85} />
            ) : (
              <>
                <path d={wireD(left.b1[0], left.b1[1], leafA.x, leafA.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} />
                <path d={wireD(right.b1[0], right.b1[1], leafD.x, leafD.y)} fill="none" stroke={WIRE_IDLE} strokeWidth={1.5} />
                <ellipse cx={(leftX + rightX) / 2} cy={y} rx={16} ry={11} fill={CON} opacity={0.16} />
              </>
            )}
            {!done && <Agent x={leftX} y={y} dir="right" kind="CON" small />}
            {!done && <Agent x={rightX} y={y} dir="left" kind="CON" small />}
            <Leaf x={leafA.x} y={y} faded={done} />
            <Leaf x={leafD.x} y={y} faded={done} />
          </g>
        )
      })}
    </>
  )
}

const STAGE_LABEL: Record<Stage, string> = {
  annihilate: "annihilate · same agent",
  commute: "commute · different agents",
  parallel: "parallel · no scheduler",
}

export function InteractionNet() {
  const [stage, setStage] = useState<Stage>("annihilate")
  const [fired, setFired] = useState(false)
  const [firedCount, setFiredCount] = useState(0)
  const [ticks, setTicks] = useState(0)
  const [mode, setMode] = useState<"parallel" | "sequential">("parallel")

  function pickStage(s: Stage) {
    setStage(s)
    setFired(false)
    setFiredCount(0)
    setTicks(0)
  }

  function fire() {
    if (stage === "parallel") {
      if (mode === "parallel") {
        setFiredCount(4)
        setTicks(1)
      } else if (firedCount < 4) {
        setFiredCount(firedCount + 1)
        setTicks(ticks + 1)
      }
    } else {
      setFired(true)
    }
  }

  function reset() {
    setFired(false)
    setFiredCount(0)
    setTicks(0)
  }

  const canFire = stage === "parallel" ? firedCount < 4 : !fired

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>interaction combinators · {STAGE_LABEL[stage]}</span>
        <span className="text-muted-foreground/50">Lafont 1997 / HVM2 · illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label={
            stage === "annihilate"
              ? `Two CON agents meeting principal port to principal port ${fired ? "have annihilated, rewiring their four leaves directly" : "form an active pair, ready to fire"}`
              : stage === "commute"
                ? `A CON agent meeting a DUP agent ${fired ? "has commuted: each is now cloned, with wires crossing between the two new pairs" : "forms an active pair, ready to fire"}`
                : `Four independent active pairs in one net; ${firedCount} of 4 have fired in ${ticks} tick${ticks === 1 ? "" : "s"}`
          }>
          <defs>
            <filter id="in-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>
          {stage === "annihilate" && <AnnihilateScene fired={fired} />}
          {stage === "commute" && <CommuteScene fired={fired} />}
          {stage === "parallel" && <ParallelScene firedCount={firedCount} />}
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">rule</span>
            {(["annihilate", "commute", "parallel"] as Stage[]).map((s) => (
              <button key={s} type="button" onClick={() => pickStage(s)} aria-pressed={stage === s}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  stage === s ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}>
                {s}
              </button>
            ))}
          </div>

          {stage === "parallel" ? (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">fire</span>
              {(["parallel", "sequential"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                  className={cn(
                    "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                    mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  style={mode === m ? { background: CON } : undefined}>
                  {m}
                </button>
              ))}
            </div>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            {stage === "parallel" ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                ticks used: <span className="text-foreground">{ticks}</span> · fired {firedCount}/4
              </span>
            ) : null}
            <button type="button" onClick={fire} disabled={!canFire}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] font-medium transition-colors disabled:cursor-default disabled:opacity-40",
                "text-background"
              )}
              style={{ background: CON }}>
              fire →
            </button>
            <button type="button" onClick={reset} className="cursor-pointer font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground">
              reset ↺
            </button>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {stage === "annihilate" && (
            <>Two matching agents facing each other collapse in place: their leaves rewire directly,
              nothing elsewhere in the net is touched. This is beta-reduction and pattern-matching.</>
          )}
          {stage === "commute" && (
            <>A <span style={{ color: CON }}>CON</span> meeting a <span style={{ color: DUP }}>DUP</span> clones
              both, wiring the copies crosswise. This is how a shared value gets duplicated one
              constructor at a time, instead of by walking a whole structure up front.</>
          )}
          {stage === "parallel" && (
            <>Same net, same four redexes, same final result either way — firing them
              {" "}<span className="text-foreground">one at a time takes 4 ticks</span>; firing them
              {" "}<span className="text-foreground">together takes 1</span>. No dependency exists between them
              to schedule: each is only two nodes pointing at each other, so <em>N</em> cores can each just
              grab one, with nothing to lock and nothing to coordinate.</>
          )}
        </p>
      </div>
    </figure>
  )
}
