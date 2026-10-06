// blueprint in the p5 tier. Loaded after the engine, for every film in the
// p5 tier, so it touches STYLES.blueprint and nothing else.
//
// A rotring line goes through the covering path (p5tier.js `cover`). Painted
// straight into the p5 canvas it lands one pixel wide and hard-edged, where
// the live tier's lands soft and nearer two: at 1920 a diagonal steps and
// thin lines read fainter than the type beside them. Every line here is
// drawn a little heavier (the construction overshoots with it), so it lands
// at two pixels and reads at the weight the other tiers show.
{
  const S = STYLES.blueprint, line = S.line
  const HEAVIER = 1.5
  S.line = function (pts, sw, col, o = {}) { return line.call(this, pts, sw * HEAVIER, col, o) }
}
