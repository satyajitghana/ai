import { mix } from "three/tsl"

import type { TransitionDef } from "../engine/types"

// The simple form of a transition: a TSL function of the two finished frames. `a()` and `b()`
// sample the outgoing and incoming scene at this pixel (or at any y-up uv you pass them), `p` is
// the eased progress. Leaving `trans` out altogether gives this same mix.
const fade: TransitionDef = {
  id: "fade",
  dur: 0.9,
  trans: ({ a, b, p }) => mix(a(), b(), p),
}
export default fade
