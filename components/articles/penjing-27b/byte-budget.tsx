// Where the bytes actually go, per rung. Server-rendered, zero JS.
//
// Every figure is computed from the published GGUF tensor-info blocks: each
// tensor's element count times its ggml type's bytes-per-block, summed by role.
// Totals reconcile with the file sizes on the Hub to within the header (18 MB
// on the two trellis builds, 11 MB on the others -- a 248,320-entry tokenizer).
//
// The reason to draw it: at 1.9 bits per weight the conversation is usually
// about the MLP, and on this model one fifth of the smallest file is the
// embedding table plus the LM head, neither of which the ladder's headline type
// touches. That is not a criticism of the build -- protecting `output.weight`
// at low bit is the right call -- but it is where the size budget went.

const GROUPS = [
  { key: "mlpBody", label: "ffn_gate + ffn_up", hue: "oklch(0.58 0.15 250)" },
  { key: "mlpDown", label: "ffn_down", hue: "oklch(0.62 0.13 210)" },
  { key: "linAttn", label: "linear attention (48 blocks)", hue: "oklch(0.62 0.12 175)" },
  { key: "fullAttn", label: "full attention (16 blocks)", hue: "oklch(0.64 0.12 145)" },
  { key: "lmHead", label: "output.weight (LM head)", hue: "oklch(0.68 0.15 62)" },
  { key: "embd", label: "token_embd.weight", hue: "oklch(0.62 0.14 35)" },
  { key: "rest", label: "MTP head + norms", hue: "oklch(0.60 0.02 250)" },
] as const

type Key = (typeof GROUPS)[number]["key"]

const BUILDS: { name: string; bpw: number; mb: Record<Key, number> }[] = [
  {
    name: "IQ1_KT",
    bpw: 1.906,
    mb: { mlpBody: 2299.2, mlpDown: 1277.1, linAttn: 1224.2, fullAttn: 397.6, lmHead: 874.1, embd: 417.2, rest: 19.8 },
  },
  {
    name: "IQ2_XXS",
    bpw: 2.12,
    mb: { mlpBody: 2407.8, mlpDown: 1543.7, linAttn: 1441.3, fullAttn: 508.7, lmHead: 874.1, embd: 417.2, rest: 45.6 },
  },
  {
    name: "IQ2_KT",
    bpw: 2.15,
    mb: { mlpBody: 2412.0, mlpDown: 1588.3, linAttn: 1484.8, fullAttn: 520.7, lmHead: 874.1, embd: 417.2, rest: 45.6 },
  },
  {
    name: "IQ3_S",
    bpw: 3.785,
    mb: { mlpBody: 5048.4, mlpDown: 2524.2, linAttn: 2731.3, fullAttn: 818.0, lmHead: 1042.9, embd: 715.2, rest: 45.6 },
  },
]

export function ByteBudget() {
  const maxTotal = Math.max(
    ...BUILDS.map((b) => GROUPS.reduce((s, g) => s + b.mb[g.key], 0))
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          where the bytes went, by tensor role
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          summed from GGUF tensor shapes × block sizes
        </span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        {BUILDS.map((b) => {
          const total = GROUPS.reduce((s, g) => s + b.mb[g.key], 0)
          let x = 0
          return (
            <div key={b.name}>
              <div className="flex items-baseline justify-between font-mono text-[11px]">
                <span className="text-foreground">{b.name}</span>
                <span className="text-muted-foreground">
                  {(total / 1024).toFixed(2)} GiB · {b.bpw.toFixed(3)} bpw
                </span>
              </div>
              <svg
                viewBox={`0 0 100 7`}
                preserveAspectRatio="none"
                className="mt-1 h-5 w-full"
                role="img"
                aria-label={`${b.name}: ${GROUPS.map(
                  (g) => `${g.label} ${((100 * b.mb[g.key]) / total).toFixed(1)} percent`
                ).join(", ")}`}
              >
                {GROUPS.map((g) => {
                  const w = (100 * b.mb[g.key]) / maxTotal
                  const rect = (
                    <rect key={g.key} x={x} y={0} width={Math.max(w - 0.12, 0)} height={7} fill={g.hue}>
                      <title>{`${g.label}: ${b.mb[g.key].toFixed(0)} MB (${((100 * b.mb[g.key]) / total).toFixed(1)}% of the file)`}</title>
                    </rect>
                  )
                  x += w
                  return rect
                })}
              </svg>
            </div>
          )
        })}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          {GROUPS.map((g) => (
            <span key={g.key} className="flex items-center gap-1.5 font-mono text-[10px]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: g.hue }}
              />
              <span className="text-muted-foreground">{g.label}</span>
            </span>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Bars are to a common scale, so IQ3_S reads as twice the file rather than
        the same bar restacked. In the 6.53 GB IQ1_KT build the LM head is 874
        MB and the embedding table 417 MB — 19.8% of the file, in two tensors
        that the rung&apos;s name does not describe.
      </figcaption>
    </figure>
  )
}
