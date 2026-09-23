// Where the wall clock goes when Qwen-Image-2.1 runs on four CPU cores and no GPU.
//
// Every number here was measured on this machine: an Intel Xeon @ 2.80GHz,
// 4 cores, 15 GB of RAM, no /dev/dri and no CUDA. The binary is
// stable-diffusion.cpp at commit 2bb7294, built with -DGGML_NATIVE=ON against
// AVX-512F/BW/DQ/VL and AVX512-VNNI. Weights are leejet's GGUFs (cc11433),
// Unsloth's Q2_K (2c31ccd), Qwen's Q4_K_M Qwen3-VL encoder GGUF and the
// ComfyUI bf16 VAE; public/articles/qwen-image-2-1/data/cpu-run.json has every
// revision and SHA-256.
//
// Stage timings are sd.cpp's own -v instrumentation:
// `get_learned_condition completed`, `sampling completed`,
// `decode_first_stage completed`, `generate_image completed in`. The three
// stages sum to the total to within 0.1 s in every run, because sd.cpp loads
// each component's weights inside the stage that first needs them. The per-step
// figure is the median of the per-step times sd.cpp prints, which sum to the
// logged sampling time; a median is used because other jobs on this box
// overlapped some runs, and a median shrugs off a handful of slow steps where a
// mean does not. Peak RSS is VmHWM sampled from /proc every 0.5 s; in the second
// pass it includes the memory-mapped weights.
//
// Each pass is drawn to its own scale, because a 40-step run is sixty times a
// one-step one and on a shared scale the first pass would vanish.
//
// Zero JS: this renders on the server and ships no client bundle.
// Arithmetic is +, -, *, / and toFixed only.

type Run = {
  label: string
  config: string
  /** sd.cpp `get_learned_condition completed, taking Ns` */
  encode: number | null
  /** sd.cpp `sampling completed, taking Ns` */
  sample: number | null
  /** sd.cpp `decode_first_stage completed, taking Ns` */
  decode: number | null
  /** sd.cpp `generate_image completed in Ns`, or wall-clock where noted */
  total: number
  /** median of sd.cpp's per-step times */
  perStep: number | null
  /** VmHWM, MiB */
  rss: number | null
  note?: string
}

type Pass = { title: string; runs: Run[] }

const PASSES: Pass[] = [
  {
    title: "Second pass — 512², vendor sigmas, guidance off, --mmap",
    runs: [
      {
        label: "Q4_K · 40 steps",
        config: "the model's own settings; the headline image",
        encode: null,
        sample: null,
        decode: null,
        total: 3863,
        perStep: null,
        rss: null,
        note:
          "wall-clock from the job queue's timestamps; sd.cpp's own log for this run was lost (see the text), and other jobs overlapped it",
      },
      {
        label: "Q4_K · 20 steps",
        config: "the gallery's setting",
        encode: 4.92,
        sample: 1771.84,
        decode: 46.06,
        total: 1822.84,
        perStep: 87.09,
        rss: 11671.8,
      },
      {
        label: "Q2_K · 20 steps",
        config: "leejet's 2.88-bit rung, same everything else",
        encode: 5.85,
        sample: 1611.31,
        decode: 39.6,
        total: 1656.77,
        perStep: 79.43,
        rss: 10098.6,
      },
      {
        label: "Q2_K · 8 steps",
        config: "the first pass's step count, on the vendor's schedule",
        encode: 4.36,
        sample: 621.23,
        decode: 40.0,
        total: 665.6,
        perStep: 76.5,
        rss: 10097.8,
      },
    ],
  },
  {
    title: "First pass — sd.cpp's default schedule, no --mmap",
    runs: [
      {
        label: "256² · 1 step",
        config: "Q2_K, cfg 1.0 — the smoke test",
        encode: 6.15,
        sample: 33.63,
        decode: 18.49,
        total: 58.28,
        perStep: 33.63,
        rss: 8098.0,
      },
      {
        label: "256² · 8 steps",
        config: "Q2_K, cfg 1.0",
        encode: 8.58,
        sample: 177.38,
        decode: 17.34,
        total: 203.32,
        perStep: 22.18,
        rss: 8108.8,
      },
      {
        label: "512² · 8 steps",
        config: "Q2_K, cfg 1.0 — sharing the box with other jobs",
        encode: 6.23,
        sample: 804.11,
        decode: 91.36,
        total: 901.72,
        perStep: 100.27,
        rss: 9959.9,
      },
      {
        label: "256² · 8 steps",
        config: "Q2_K, cfg 4.0 — guidance on, two denoiser passes per step",
        encode: 8.17,
        sample: 449.79,
        decode: 16.64,
        total: 474.6,
        perStep: 53.17,
        rss: 8108.3,
      },
    ],
  },
]

const SEGMENTS = [
  { key: "encode", label: "text encode", cls: "bg-foreground/30" },
  { key: "sample", label: "sampling", cls: "bg-foreground/75" },
  { key: "decode", label: "VAE decode", cls: "bg-foreground/45" },
] as const

function Row({ r, max }: { r: Run; max: number }) {
  const known = r.encode != null && r.sample != null && r.decode != null
  const parts = { encode: r.encode ?? 0, sample: r.sample ?? 0, decode: r.decode ?? 0 }
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="font-mono text-xs text-foreground">{r.label}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {r.total.toFixed(2)} s
          {r.perStep != null ? ` · ${r.perStep.toFixed(2)} s/step median` : ""}
          {r.rss != null ? ` · ${(r.rss / 1024).toFixed(2)} GiB peak RSS` : ""}
        </span>
      </div>
      <div className="flex h-6 w-full overflow-hidden rounded-sm bg-muted/50">
        {known ? (
          SEGMENTS.map((s) => (
            <div
              key={s.key}
              className={s.cls}
              style={{ width: `${(parts[s.key] * 100) / max}%` }}
            />
          ))
        ) : (
          <div
            className="rounded-sm border border-dashed border-foreground/40 bg-foreground/10"
            style={{ width: `${(r.total * 100) / max}%` }}
          />
        )}
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        {r.config}
        {r.note ? ` — ${r.note}` : ""}
      </p>
    </div>
  )
}

export function CpuLedger() {
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Wall-clock breakdown of Qwen-Image-2.1 runs on four CPU cores with no GPU, first and second pass"
    >
      {PASSES.map((p) => {
        const max = Math.max(...p.runs.map((r) => r.total))
        return (
          <div key={p.title} className="border-b px-4 py-4 last:border-b-0">
            <p className="m-0 mb-3 font-mono text-xs text-foreground">{p.title}</p>
            <div className="space-y-4">
              {p.runs.map((r) => (
                <Row key={`${r.label}-${r.config}`} r={r} max={max} />
              ))}
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3">
        {SEGMENTS.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
          >
            <span className={`inline-block h-3 w-3 rounded-[2px] ${s.cls}`} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 rounded-[2px] border border-dashed border-foreground/40 bg-foreground/10" />
          total only
        </span>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Measured on this site&rsquo;s build box: 4 cores of an Intel Xeon at
        2.80GHz, 15 GB of RAM, no GPU of any kind. Each pass is drawn to its own
        longest run. Each stage includes reading that component&rsquo;s weights,
        which is why the segments sum to the total. The per-step figure is a
        median, because other jobs shared this box during some runs. Peak RSS is
        VmHWM, sampled from <code>/proc</code>
        {" "}while the process ran, and in the second pass it counts the
        memory-mapped weights.
      </figcaption>
    </figure>
  )
}
