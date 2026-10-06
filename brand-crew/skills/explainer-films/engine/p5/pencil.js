// pencil in the p5 tier. Loaded after the engine, for every film in the
// p5 tier, so it touches STYLES.pencil and nothing else.
//
// The lite and live tiers multiply each coloured-pencil fill onto the cream
// paper. In the p5 tier p5.brush mixes it into the paper as pigment, and a
// pale grey or teal lifted for its label mixed into cream comes out lavender:
// the hatching in step circles and pale nodes took a blue cast. Every fill
// this style paints (a node, a highlight, the host's shadow) is given to
// p5.brush in the colour multiply would have landed it at; the hatching and
// the pencil's tooth are p5.brush's own.
{
  const S = STYLES.pencil
  const mul = (c, p) => { const a = parseInt(c.slice(1), 16), b = parseInt(p.slice(1), 16); return '#' + [16, 8, 0].map(s => Math.round((a >> s & 255) * (b >> s & 255) / 255).toString(16).padStart(2, '0')).join('') }
  const landed = c => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? mul(c, S.paper) : c)
  // only for the duration of this style's own call: PB.shape sees the landed colour
  const through = f => function (...a) {
    const ps = PB.shape
    PB.shape = (pts, o, ...r) => ps.call(PB, pts, o && o.fill && !o.cover ? { ...o, fill: landed(o.fill) } : o, ...r)
    try { return f.apply(this, a) } finally { PB.shape = ps }
  }
  for (const m of ['shape', 'hl', 'shadow']) S[m] = through(S[m])
}
