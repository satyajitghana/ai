import type { TransitionId } from "../script"
import type { TransitionDef } from "../engine/types"
import anneal from "./anneal"
import aperture from "./aperture"
import axis from "./axis"
import cards from "./cards"
import clay from "./clay"
import dive from "./dive"
import dot from "./dot"
import ember from "./ember"
import fade from "./fade"
import hex from "./hex"
import lightsout from "./lightsout"
import mesh from "./mesh"
import mould from "./mould"
import pageturn from "./pageturn"
import platen from "./platen"
import pour from "./pour"
import scanline from "./scanline"
import settle from "./settle"
import splice from "./splice"
import squares from "./squares"
import steam from "./steam"
import tearoff from "./tearoff"
import thaw from "./thaw"
import thumbnail from "./thumbnail"
import ticker from "./ticker"
import torch from "./torch"
import trace from "./trace"
import unravel from "./unravel"

// Twenty-eight ways from one scene to the next, in running order. No two neighbours share one. Each is
// a small TSL module, so they are bundled with the engine and compiled only when a scene that
// uses one is near.
export const TRANSITIONS: Record<TransitionId, TransitionDef> = {
  fade,
  dot,
  pour,
  steam,
  lightsout,
  hex,
  dive,
  anneal,
  settle,
  thaw,
  pageturn,
  ember,
  torch,
  clay,
  mould,
  mesh,
  platen,
  aperture,
  ticker,
  splice,
  scanline,
  cards,
  squares,
  trace,
  unravel,
  axis,
  tearoff,
  thumbnail,
}
