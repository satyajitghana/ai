"use client"

// What StableGen's name-based skeleton profile resolves for five rigs. Every
// result below came from running the real _norm_name, _named_bone and
// _standard_name_profile (extracted from stablegen/animation/retargeting.py at
// f494e5f with ast, bpy not needed) on mock armatures built from the standard
// Mixamo bone list (MEASURED). SSR-safe: plain state.

import { useState } from "react"
import { tablistKeys } from "@/components/articles/ui/tablist-keys"

type Row = { chain: string; bones: string[]; bad?: number[] }
type Case = { id: string; label: string; note: string; result: string; rows: Row[] }

const CASES: Case[] = [
  {
    id: "colon",
    label: "mixamorig:Hips ... (65 bones)",
    note: "The names Mixamo ships and Blender's FBX importer keeps.",
    result: "method standard_names",
    rows: [
      { chain: "spine", bones: ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"] },
      { chain: "right_arm", bones: ["RightShoulder", "RightArm", "RightForeArm", "RightHand"] },
      { chain: "left_leg", bones: ["LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase"] },
    ],
  },
  {
    id: "underscore",
    label: "mixamorig_Hips ... (colon became an underscore)",
    note: "What some exporters write. The prefix is not stripped, so the substring fallback runs.",
    result: "method standard_names, one wrong bone",
    rows: [
      { chain: "spine", bones: ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"] },
      { chain: "right_arm", bones: ["RightShoulder", "RightArm", "RightForeArm", "LeftHandRing1"], bad: [3] },
      { chain: "left_leg", bones: ["LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase"] },
    ],
  },
  {
    id: "nospine",
    label: "no bone called Spine",
    note: "Spine1 and Spine2 only.",
    result: "method standard_names, one bone listed twice",
    rows: [
      { chain: "spine", bones: ["Hips", "Spine1", "Spine1", "Spine2", "Neck", "Head"], bad: [2] },
      { chain: "right_arm", bones: ["RightShoulder", "RightArm", "RightForeArm", "RightHand"] },
      { chain: "left_leg", bones: ["LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase"] },
    ],
  },
  {
    id: "nohead",
    label: "no bone called Head",
    note: "Only HeadTop_End is left.",
    result: "method standard_names, head is the tip bone",
    rows: [
      { chain: "spine", bones: ["Hips", "Spine", "Spine1", "Spine2", "Neck", "HeadTop_End"], bad: [5] },
      { chain: "right_arm", bones: ["RightShoulder", "RightArm", "RightForeArm", "RightHand"] },
      { chain: "left_leg", bones: ["LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase"] },
    ],
  },
  {
    id: "generic",
    label: "bone_0 ... bone_23",
    note: "The kind of name a learned rigger can emit.",
    result: "None: falls back to the geometry profile",
    rows: [],
  },
]

export function BoneNames() {
  const [id, setId] = useState("colon")
  const c = CASES.find((k) => k.id === id)!
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>reading a skeleton from its bone names</span>
        <span className="text-muted-foreground/70">real functions, mock armatures</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" onKeyDown={tablistKeys()} aria-label="Rig naming case">
          {CASES.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={k.id === id}
              tabIndex={k.id === id ? 0 : -1}
              onClick={() => setId(k.id)}
              className={"rounded-md border px-2.5 py-1 font-mono text-xs " + (k.id === id ? "bg-foreground text-background" : "bg-background/50 text-muted-foreground hover:text-foreground")}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{c.note}</p>
        <p className="mt-1 font-mono text-xs">{c.result}</p>
        <div className="mt-3 space-y-2">
          {c.rows.map((r) => (
            <div key={r.chain} className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
              <span className="w-20 text-muted-foreground">{r.chain}</span>
              {r.bones.map((b, i) => (
                <span key={i} className={"rounded border px-1.5 py-0.5 " + (r.bad?.includes(i) ? "border-[#d9622b] text-[#d9622b]" : "")}>
                  {b}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
