// YuE2's four stages, and the weights each policy leaves on the card.
//
// The pipeline is explicitly staged (pipeline.py): plan() -> generate_semantic()
// -> synthesize() -> decode(). The first two run the AR half of the Mixture-of-
// Transformers; synthesize() runs only the NAR half; decode() runs neither and
// already moves the whole MoT to CPU on its own (`self._model.to("cpu")`). So
// the peak is per stage, not the sum — and three of the four stages hold weights
// they will not touch.
//
// Bars are WEIGHTS ONLY. KV cache, flow-matching activations and CUDA-graph
// buffers sit on top of every bar and scale with song length; the article says
// so in prose. Every figure is measured from a safetensors header:
//
//   whole MoT BF16 ......... 6925.0 MiB  (base 1548.5 + 28 x 192.0)
//   AR half + embeddings ... 4131.2 MiB  (base 1443.0 + 28 x  96.0)
//   NAR half ............... 2793.7 MiB  (base  105.5 + 28 x  96.0)
//   AR half, int8 .......... 2789.4 MiB  (base 1443.0 + 28 x  48.1)
//   NAR half, int8 ......... 1451.9 MiB  (base  105.5 + 28 x  48.1)
//   VAE decoder, FP32 ......  253.2 MiB  (upstream loads and runs it in FP32)
//   VAE decoder, BF16 ......  126.6 MiB  (WanGP's converted, decoder-only copy)
//
// Under mmgp, a tower is not resident: only its base plus a two-block window is
// (base + 2 x layer). That is the third row.
//
// Server-rendered, zero JS.

const STAGES = ["plan()", "generate_semantic()", "synthesize()", "decode()"] as const

const AR_BF16 = 4131.2
const NAR_BF16 = 2793.7
const MOT_BF16 = 6925.0 // 4131.2 + 2793.7, minus the 2 KiB shared final norm
const VAE_F32 = 253.2
const VAE_BF16 = 126.6
const AR_MMGP = 1443.0 + 2 * 48.1 // 1539.2
const NAR_MMGP = 105.5 + 2 * 48.1 // 201.7

const ACCENT = "oklch(0.60 0.15 255)" // weights the stage actually uses
const DEAD = "oklch(0.62 0.03 250)" // weights resident but idle this stage
const GOOD = "oklch(0.55 0.16 155)"

type Policy = {
  id: string
  label: string
  how: string
  // [used, idle] MiB per stage
  bars: [number, number][]
}

const POLICIES: Policy[] = [
  {
    id: "default",
    label: "Upstream default",
    how: "YuE2Pipeline(...), BF16, offload_ar=False",
    bars: [
      [AR_BF16, NAR_BF16],
      [AR_BF16, NAR_BF16],
      [NAR_BF16, AR_BF16],
      [VAE_F32, 0],
    ],
  },
  {
    id: "offload",
    label: "Upstream, offload_ar=True",
    how: "yue2 generate --offload-ar (undocumented outside the CLI help)",
    bars: [
      [AR_BF16, NAR_BF16],
      [AR_BF16, NAR_BF16],
      [NAR_BF16, 0],
      [VAE_F32, 0],
    ],
  },
  {
    id: "wangp",
    label: "WanGP · split int8 + mmgp",
    how: "YuE2_AR_int8 / YuE2_Acoustic_int8, 100 MiB budget, BF16 decoder",
    bars: [
      [AR_MMGP, 0],
      [AR_MMGP, 0],
      [NAR_MMGP, 0],
      [VAE_BF16, 0],
    ],
  },
]

function fmt(v: number): string {
  return v >= 1024 ? `${(v / 1024).toFixed(2)} GiB` : `${Math.round(v)} MiB`
}

export function ResidencyTrace() {
  const max = MOT_BF16

  return (
    <figure className="my-8 rounded-md border bg-muted/20 px-4 py-4">
      <figcaption className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        YuE2 weight residency, by stage and policy
      </figcaption>
      <p className="mt-0 mb-4 text-sm leading-6 text-muted-foreground">
        Solid is the half of the Mixture-of-Transformers the stage actually runs.
        Hatched is weights sitting on the card that this stage will not read
        once.
      </p>

      <div className="space-y-6">
        {POLICIES.map((p) => {
          const peak = Math.max(...p.bars.map(([u, i]) => u + i))
          return (
            <div key={p.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b pb-1">
                <span className="text-sm font-medium">{p.label}</span>
                <span className="font-mono text-[11px]">
                  peak weights{" "}
                  <span style={{ color: p.id === "wangp" ? GOOD : undefined }}>
                    {fmt(peak)}
                  </span>
                </span>
              </div>
              <div className="mt-1 mb-2 font-mono text-[11px] text-muted-foreground">
                {p.how}
              </div>

              <div className="space-y-1.5">
                {p.bars.map(([used, idle], i) => (
                  <div key={STAGES[i]} className="flex items-center gap-3">
                    <span className="w-[9.5rem] shrink-0 font-mono text-[11px] text-muted-foreground">
                      {STAGES[i]}
                    </span>
                    <span className="flex h-3.5 min-w-0 flex-1 overflow-hidden rounded-[2px] bg-muted/60">
                      <span
                        style={{
                          background: ACCENT,
                          width: `${(used / max) * 100}%`,
                        }}
                      />
                      {idle > 0 ? (
                        <span
                          style={{
                            width: `${(idle / max) * 100}%`,
                            backgroundImage: `repeating-linear-gradient(45deg, ${DEAD} 0 3px, transparent 3px 6px)`,
                            backgroundColor: "transparent",
                            opacity: 0.85,
                          }}
                        />
                      ) : null}
                    </span>
                    <span className="w-[5.5rem] shrink-0 text-right font-mono text-[11px]">
                      {fmt(used + idle)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-5 border-t pt-3 text-xs leading-5 text-muted-foreground">
        Note what the middle row does not do. <code>offload_ar</code> empties the
        NAR stage, but plan() and generate_semantic() still hold the whole file,
        so the peak does not move — the flag is a comfort during synthesis, not a
        lower floor. Only the third row, which never loads a tower it is not
        running, changes the peak: 1539.2 MiB against 6924.9, a difference of
        5.26 GiB of weights on a card whose stated requirement is 24 GB.
      </p>
    </figure>
  )
}
