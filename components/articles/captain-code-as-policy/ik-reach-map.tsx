"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where CaPtain-Harness's inverse kinematics finds a top-down gripper pose for a
// Franka Panda, on a 5 cm grid over one half of the table (y >= 0; the arm is
// symmetric about y = 0, which is the bottom edge of the map).
//
// Measured by me, on CPU, with my own numpy re-implementation of
// RobotCollisionModel.solve_ik / _solve_ik_seed from CaPtain-Harness @ de38d6d
// (src/captain_harness/adapters/robotics/model.py): damped least squares with
// damping 0.0025, steps capped at 0.12 rad, 180 iterations, tolerances 2 mm and
// 0.02 rad, and the same five seeds (the measured configuration, then four
// derived from joint limits). The Panda comes from Franka's published DH table;
// I did not run their MuJoCo model, and I skipped their self-collision check.
// "Joint 3 locked" freezes the redundant joint at 0 to get a 6-DoF arm.
//
// Cell codes: a = solved from the first seed, b = solved only after a restart,
// . = no seed converged. Rows run from y = 0.90 m (top) down to y = 0 m; columns
// from x = -0.30 m to x = 1.00 m. The base sits at x = 0, y = 0.

type Arm = "7" | "6"
type Height = "0.05" | "0.25"

const GRID: Record<Height, Record<Arm, string[]>> = {
  "0.05": {
    "7": [
      "...........................",
      "...........................",
      ".....aaa...................",
      ".aaaaaaaaaaa...............",
      "aaaaaaaaaaaaaa.............",
      "aaaaaaaaaaaaaaaa...........",
      "aaaaaaaaaaaaaaaaa..........",
      "aaaaaaaaaaaaaaaaaa.........",
      "aaaaaaaaaaaaaaaaaaa........",
      "aaaaaaaaaaaaaaaaaaaa.......",
      "aaaaaaaaaaaaaaaaaaaa.......",
      "aaaaaaaaaaaaaaaaaaaaa......",
      "aaaaaaaaaaaaaaaaaaaaa......",
      "aaaaaaaaaaaaaaaaaaaaaa.....",
      "aaaab...bbaaaaaaaaaaaa.....",
      "aaa.....b.baaaaaaaaaaa.....",
      "aab......b.baaaaaaaaaa.....",
      "aa.........baaaaaaaaaaa....",
      "b..........baaaaaaaaaaa....",
    ],
    "6": [
      "...........................",
      "...........................",
      ".....aaa...................",
      ".aaaaaaaaaaa...............",
      "aaaaaaaaaaaaaa.............",
      "aaaaaaaaaaaaaaaa...........",
      "aaaaaaaaaaaaaaaaa..........",
      "aaaaaaaaaaaaaaaaaa.........",
      "aaaaaaaaaaaaaaaaaaa........",
      ".aaaaaaaaaaaaaaaaaaa.......",
      ".aaaaaaaaaaaaaaaaaaa.......",
      "..aaaaaaaaaaaaaaaaaaa......",
      "...aaaaaaaaaaaaaaaaaa......",
      "...a.....aaaaaaaaaaaaa.....",
      "..........aaaaaaaaaaaa.....",
      "...........aaaaaaaaaaa.....",
      "............aaaaaaaaaa.....",
      "............aaaaaaaaaaa....",
      "............aaaaaaaaaaa....",
    ],
  },
  "0.25": {
    "7": [
      "...........................",
      "...........................",
      "...........................",
      ".aaaaaaaaaaa...............",
      "aaaaaaaaaaaaaa.............",
      "aaaaaaaaaaaaaaaa...........",
      "aaaaaaaaaaaaaaaaa..........",
      "aaaaaaaaaaaaaaaaaa.........",
      "aaaaaaaaaaaaaaaaaaa........",
      "aaaaaaaaaaaaaaaaaaaa.......",
      "aaaaaaaaaaaaaaaaaaaa.......",
      "aaaaaaaaaaaaaaaaaaaaa......",
      "aaaaaaaaaaaaaaaaaaaaa......",
      "aaaaaaaaaaaaaaaaaaaaaa.....",
      "aaaaaaa.aaaaaaaaaaaaaa.....",
      "aaaa......aaaaaaaaaaaa.....",
      "baa.......baaaaaaaaaaa.....",
      "bbb.......baaaaaaaaaaa.....",
      "bb........baaaaaaaaaaa.....",
    ],
    "6": [
      "...........................",
      "...........................",
      "...........................",
      ".aaaaaaaaaaa...............",
      "aaaaaaaaaaaaaa.............",
      "aaaaaaaaaaaaaaaa...........",
      "aaaaaaaaaaaaaaaaa..........",
      "aaaaaaaaaaaaaaaaaa.........",
      "aaaaaaaaaaaaaaaaaaa........",
      ".aaaaaaaaaaaaaaaaaaa.......",
      ".aaaaaaaaaaaaaaaaaaa.......",
      "..aaaaaaaaaaaaaaaaaaa......",
      "...aaaaaaaaaaaaaaaaaa......",
      "...aaaaaaaaaaaaaaaaaaa.....",
      ".........aaaaaaaaaaaaa.....",
      "..........aaaaaaaaaaaa.....",
      "...........aaaaaaaaaaa.....",
      "...........aaaaaaaaaaa.....",
      "...........aaaaaaaaaaa.....",
    ],
  },
}

const X0 = -0.3
const STEP = 0.05
const COLS = 27
const ROWS = 19
const CELL = 18
const PAD_L = 34
const PAD_B = 22

function count(rows: string[]) {
  let a = 0
  let b = 0
  for (const r of rows) for (const c of r) a += c === "a" ? 1 : 0
  for (const r of rows) for (const c of r) b += c === "b" ? 1 : 0
  return { a, b, total: rows.length * rows[0].length }
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { key: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded border px-2 py-1",
            o.key === value
              ? "border-foreground/60 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function IkReachMap() {
  const [arm, setArm] = useState<Arm>("7")
  const [z, setZ] = useState<Height>("0.05")
  const rows = GRID[z][arm]
  const other = GRID[z][arm === "7" ? "6" : "7"]
  const n = count(rows)
  const W = PAD_L + COLS * CELL + 4
  const H = ROWS * CELL + PAD_B + 4
  const baseX = PAD_L + ((0 - X0) / STEP) * CELL + CELL / 2
  const baseY = ROWS * CELL - CELL / 2
  const accent = "var(--hg-accent, oklch(0.72 0.15 195))"
  const warn = "oklch(0.75 0.16 70)"

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Map of where a damped-least-squares IK solver finds a top-down gripper pose for a Panda arm"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        top-down grasp poses on a 5 cm grid · my re-implementation of the solver in CaPtain-Harness ·
        measured on CPU
      </div>
      <div className="flex flex-col gap-2 border-b px-4 py-3 font-mono text-xs">
        <Toggle
          label="arm"
          value={arm}
          onChange={setArm}
          options={[
            { key: "7" as Arm, label: "Panda, 7 joints" },
            { key: "6" as Arm, label: "joint 3 locked (6)" },
          ]}
        />
        <Toggle
          label="gripper height"
          value={z}
          onChange={setZ}
          options={[
            { key: "0.05" as Height, label: "5 cm above base" },
            { key: "0.25" as Height, label: "25 cm above base" },
          ]}
        />
      </div>
      <div className="overflow-x-auto px-4 pt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="min-w-[420px]"
          role="img"
          aria-label={`${n.a + n.b} of ${n.total} grid cells solved, ${n.b} of them only after a restart.`}
        >
          {rows.map((r, i) =>
            r.split("").map((c, j) => {
              const lost = c === "." && other[i][j] !== "."
              return (
                <rect
                  key={`${i}-${j}`}
                  x={PAD_L + j * CELL + 1}
                  y={i * CELL + 1}
                  width={CELL - 2}
                  height={CELL - 2}
                  rx={2}
                  fill={c === "a" ? accent : c === "b" ? warn : "currentColor"}
                  opacity={c === "." ? (lost ? 0.28 : 0.07) : c === "a" ? 0.75 : 0.95}
                />
              )
            })
          )}
          <circle cx={baseX} cy={baseY} r={6} fill="none" stroke="currentColor" strokeWidth={2} />
          <text x={baseX + 9} y={baseY + 4} className="fill-current font-mono text-[10px]">
            base
          </text>
          {[0, 6, 12, 18, 26].map((j) => (
            <text
              key={j}
              x={PAD_L + j * CELL + CELL / 2}
              y={ROWS * CELL + 14}
              textAnchor="middle"
              className="fill-current font-mono text-[9px] opacity-60"
            >
              {(X0 + j * STEP).toFixed(1)}
            </text>
          ))}
          {[0, 6, 12, 18].map((i) => (
            <text
              key={i}
              x={PAD_L - 4}
              y={(ROWS - 1 - i) * CELL + CELL / 2 + 3}
              textAnchor="end"
              className="fill-current font-mono text-[9px] opacity-60"
            >
              {(i * STEP).toFixed(1)}
            </text>
          ))}
        </svg>
      </div>
      <div className="grid gap-1 px-4 py-3 font-mono text-xs sm:grid-cols-3">
        <div>
          <span className="tabular-nums">{n.a}</span>{" "}
          <span className="text-muted-foreground">cells solved from the first seed</span>
        </div>
        <div>
          <span className="tabular-nums">{n.b}</span>{" "}
          <span className="text-muted-foreground">solved only after a restart</span>
        </div>
        <div>
          <span className="tabular-nums">{n.total - n.a - n.b}</span>{" "}
          <span className="text-muted-foreground">no seed converged</span>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        x and y in metres from the arm&rsquo;s base, half the table shown (the arm is symmetric).
        Faint grey cells are the ones the other arm setting reaches and this one does not. No
        self-collision or table check, so this is a kinematic upper bound on what{" "}
        <code>move_to</code> will accept.
      </figcaption>
    </figure>
  )
}
