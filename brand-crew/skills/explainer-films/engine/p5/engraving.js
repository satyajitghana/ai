// engraving in the p5 tier. Loaded after the engine, for every film in the p5
// tier, so it touches STYLES.engraving and nothing else.
//
// The host's tone is a sheet of ruled lines multiplied over its fills. The
// sheet was ruled with p5.brush's hatch `gradient`, which widens every gap
// by a constant factor (1.04 at .4) from the sheet's corner on; over a sheet
// a few hundred lines across that compounds, so where the host stands the
// rules had spread to ~34 px apart at 1920 and read as a few heavy stripes
// across the face. Here the rules are even, ~13 px apart and finer, the
// density of the hatching on the nodes beside it.
{
  const S = STYLES.engraving
  S.hostTex = (tw, th) => { brush.hatch(6, .6, { rand: .02 }); brush.hatchStyle('rotring', '#BDB8AE', .4); brush.polygon([[0, 0], [tw, 0], [tw, th], [0, th]]); brush.noHatch() }
}
