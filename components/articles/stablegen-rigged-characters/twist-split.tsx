"use client"

// The swing-twist split StableGen uses when it builds twist helper bones:
// _quaternion_twist_about_axis in stablegen/animation/retargeting.py at
// f494e5f. The function keeps the scalar part and the vector part projected
// onto the bone axis, then renormalises. This widget composes a swing about X
// and a twist about Y (the bone axis), runs the same arithmetic, and shows what
// comes back. The 20,000-rotation run in the article used the real function
// (MEASURED); this is the closed form for the two-axis case (REASONED).
// Uses lib/dmath for every trig call.

import { useState } from "react"
import { matan2, mcos, msin } from "@/lib/dmath"

const D = Math.PI / 180

export function TwistSplit() {
  const [swing, setSwing] = useState(90)
  const [twist, setTwist] = useState(40)
  const cs = mcos((swing * D) / 2)
  const ss = msin((swing * D) / 2)
  const ct = mcos((twist * D) / 2)
  const st = msin((twist * D) / 2)
  // q = swing(x) * twist(y)
  let w = cs * ct
  let x = ss * ct
  let y = cs * st
  let z = ss * st
  if (w < 0) {
    w = -w
    x = -x
    y = -y
    z = -z
  }
  const mag = Math.sqrt(w * w + y * y)
  const none = mag < 1e-8
  const rec = none ? null : (2 * matan2(y, w)) / D
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>swing and twist about a bone axis</span>
        <span className="text-muted-foreground/70">bone axis = Y</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div className="space-y-3 font-mono text-xs">
          <label className="block">
            swing about X: {swing} deg
            <input className="mt-1 block w-full" type="range" min={0} max={180} value={swing} onChange={(e) => setSwing(+e.target.value)} />
          </label>
          <label className="block">
            twist about Y: {twist} deg
            <input className="mt-1 block w-full" type="range" min={-180} max={180} value={twist} onChange={(e) => setTwist(+e.target.value)} />
          </label>
        </div>
        <div className="space-y-1 font-mono text-xs">
          <p>
            q = ({w.toFixed(4)}, {x.toFixed(4)}, {y.toFixed(4)}, {z.toFixed(4)})
          </p>
          <p>twist part = (w, 0, y, 0), length {mag.toExponential(2)}</p>
          <p className="text-sm">{none ? "returns None: no twist can be read" : `recovered twist: ${rec!.toFixed(2)} deg`}</p>
          <p className="text-muted-foreground">The length of the twist part is cos(swing / 2). It reaches the 1e-8 cut-off in the code only at a swing of 180 degrees, where the sign of the twist is gone with it.</p>
        </div>
      </div>
    </figure>
  )
}
