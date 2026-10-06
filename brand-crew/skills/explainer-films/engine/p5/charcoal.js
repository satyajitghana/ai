// charcoal in the p5 tier. Loaded after the engine, for every film in the
// p5 tier, so it touches STYLES.charcoal and nothing else.
//
// Charcoal is a transparent medium: it can only darken the grey paper. The
// lite and live tiers multiply each fill onto the paper, so a node lifted
// toward white for its label still reads as dust on grey. In the p5 tier
// p5.brush mixes the fill into the paper as pigment, and a near-white charcoal
// mixed into #DCD7CD lands lighter than the paper: the nodes glowed like chalk.
// Every fill this style paints (a node, a highlight, the host's shadow) is
// given to p5.brush in the colour multiply would have landed it at, so it
// darkens the paper as charcoal does; the massing and grain are p5.brush's own.
{
  const S = STYLES.charcoal
  const mul = (c, p) => { const a = parseInt(c.slice(1), 16), b = parseInt(p.slice(1), 16); return '#' + [16, 8, 0].map(s => Math.round((a >> s & 255) * (b >> s & 255) / 255).toString(16).padStart(2, '0')).join('') }
  const landed = c => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? mul(c, S.paper) : c)
  // A massed fill is seeded once, not per drawing. Seeded per drawing (BOILN),
  // as the live tier does, p5.brush turns the whole gesture on every drawing,
  // horizontal to diagonal to vertical, and the fill strobes under its label
  // twelve times a second; the lite tier, which films ship from, keeps one
  // gesture per shape. The outline still boils (it is a PB.line, seeded per
  // drawing), so the drawing stays alive without the fill flickering.
  const still = (ps, pts, o, r) => { const b = BOILN; BOILN = 0; try { return ps.call(PB, pts, o, ...r) } finally { BOILN = b } }
  // only for the duration of this style's own call: PB.shape sees the landed colour
  const through = f => function (...a) {
    const ps = PB.shape
    PB.shape = (pts, o, ...r) => still(ps, pts, o && o.fill && !o.cover ? { ...o, fill: landed(o.fill) } : o, r)
    try { return f.apply(this, a) } finally { PB.shape = ps }
  }
  for (const m of ['shape', 'hl', 'shadow']) S[m] = through(S[m])
}
