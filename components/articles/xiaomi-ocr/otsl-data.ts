// OTSL strings used by the decoder widget. The first is the ground truth of the table we rendered for our own CPU test;
// the second is the model's own output on it, from our CPU run, unedited; the others exercise the span tags.
export const OTSL_PRESETS: { id: string; label: string; otsl: string }[] = [
  {
    id: "truth",
    label: "our test table, ground truth",
    otsl: [
      "<fcel>Benchmark results<lcel><lcel><nl>",
      "<fcel>Model<fcel>Params<fcel>Score<nl>",
      "<fcel>Alpha<fcel>0.8B<fcel>96.8<nl>",
      "<fcel>Bravo<fcel>0.9B<fcel>96.3<nl>",
      "<fcel>Charlie<fcel>1.2B<fcel>96.9<nl>",
      "<fcel>Delta<fcel>0.8B<fcel>96.6<nl>",
    ].join("\n"),
  },
  {
    id: "model",
    label: "the model's output on it",
    otsl: "<fcel>Benchmark results<lcel><lcel><nl><fcel>Model<fcel>Params<fcel>Score<nl><fcel>Alpha<fcel>0.8B<fcel>96.8<nl><fcel>Bravo<fcel>0.9B<fcel>96.3<nl><fcel>Charlie<fcel>1.2B<fcel>96.9<nl><fcel>Delta<fcel>0.8B<fcel>96.6<nl>",
  },
  {
    id: "spans",
    label: "row and column spans",
    otsl: ["<fcel>Region<fcel>Q1<lcel><fcel>Q2<lcel><nl>", "<ucel><fcel>North<fcel>South<fcel>North<fcel>South<nl>", "<fcel>2025<fcel>14<fcel>9<fcel>16<fcel>11<nl>"].join("\n"),
  },
  {
    id: "block",
    label: "a 2 × 2 block (xcel)",
    otsl: ["<fcel>Block<lcel><fcel>C<nl>", "<ucel><xcel><fcel>D<nl>", "<fcel>E<fcel>F<fcel>G<nl>"].join("\n"),
  },
]
