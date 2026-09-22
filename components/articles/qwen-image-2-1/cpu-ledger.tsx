// Where the wall clock goes when Qwen-Image-2.1 runs on four CPU cores and no GPU.
//
// Every number here was measured on this machine: an Intel Xeon @ 2.80GHz,
// 4 cores, 15 GB of RAM, no /dev/dri and no CUDA. The binary is
// stable-diffusion.cpp at commit 2bb7294, built with -DGGML_NATIVE=ON against
// AVX-512F/BW/DQ/VL and AVX512-VNNI; the weights are qwen_image_2.1-Q2_K.gguf
// (denoiser), Qwen3VL-8B-Instruct-Q4_K_M.gguf (text encoder) and
// qwen_image_2.1_vae_bf16.safetensors (VAE).
//
// Stage timings are sd.cpp's own -v instrumentation:
// `get_learned_condition completed`, `sampling completed`,
// `decode_first_stage completed`, `generate_image completed in`. The load
// segment is the residual: total minus the three measured stages, which is the
// three model_loader passes plus graph planning. Peak RSS is VmHWM sampled from
// /proc every 0.5 s by the wrapper that launched the process.
//
// Zero JS: this renders on the server and ships no client bundle.
// Arithmetic is +, -, *, / and toFixed only.

type Run = {
  label: string
  config: string
  /** sd.cpp `get_learned_condition completed, taking Ns` */
  encode: number
  /** sd.cpp `sampling completed, taking Ns` */
  sample: number
  /** sd.cpp `decode_first_stage completed, taking Ns` */
  decode: number
  /** sd.cpp `generate_image completed in Ns` */
  total: number
  /** the per-step numbers sd.cpp prints, steady state (first step excluded) */
  perStep: number
  steps: number
  /** VmHWM, MB */
  rss: number
}

const RUNS: Run[] = [
  {
    label: "256² · 1 step",
    config: "cfg 1.0 — the smoke test, one Euler step",
    encode: 6.15,
    sample: 33.63,
    decode: 18.49,
    total: 58.28,
    perStep: 33.63,
    steps: 1,
    rss: 8098.0,
  },
  {
    label: "256² · 8 steps",
    config: "cfg 1.0 — no classifier-free guidance, one denoiser pass per step",
    encode: 8.58,
    sample: 177.38,
    decode: 17.34,
    total: 203.32,
    perStep: 21.99,
    steps: 8,
    rss: 8108.8,
  },
  {
    label: "512² · 8 steps",
    config: "cfg 1.0 — four times the latent tokens of the row above",
    encode: 6.23,
    sample: 731.98,
    decode: 71.65,
    total: 812.85,
    perStep: 91.27,
    steps: 8,
    rss: 8776.5,
  },
  {
    label: "256² · 8 steps",
    config: "cfg 4.0 — guidance on, so two denoiser passes per step",
    encode: 6.19,
    sample: 353.02,
    decode: 17.29,
    total: 378.03,
    perStep: 43.92,
    steps: 8,
    rss: 8109.7,
  },
]

const SEGMENTS = [
  { key: "load", label: "weights + graph", cls: "bg-foreground/15" },
  { key: "encode", label: "text encode", cls: "bg-foreground/35" },
  { key: "sample", label: "sampling", cls: "bg-foreground/75" },
  { key: "decode", label: "VAE decode", cls: "bg-foreground/50" },
] as const

const parts = (r: Run) => ({
  load: r.total - r.encode - r.sample - r.decode,
  encode: r.encode,
  sample: r.sample,
  decode: r.decode,
})

export function CpuLedger() {
  const max = Math.max(...RUNS.map((r) => r.total))

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Wall-clock breakdown of four Qwen-Image-2.1 runs on four CPU cores with no GPU"
    >
      <div className="space-y-4 px-4 py-4">
        {RUNS.map((r) => {
          const p = parts(r)
          return (
            <div key={`${r.label}-${r.config}`} className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-mono text-xs text-foreground">
                  {r.label}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {r.total.toFixed(2)} s · {r.perStep.toFixed(2)} s/step ·{" "}
                  {(r.rss / 1024).toFixed(2)} GiB peak RSS
                </span>
              </div>
              <div className="flex h-6 w-full overflow-hidden rounded-sm bg-muted/50">
                {SEGMENTS.map((s) => (
                  <div
                    key={s.key}
                    className={s.cls}
                    style={{ width: `${(p[s.key] * 100) / max}%` }}
                  />
                ))}
              </div>
              <p className="m-0 text-xs text-muted-foreground">{r.config}</p>
            </div>
          )
        })}
      </div>

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
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Measured on this site&rsquo;s build box: 4 cores of an Intel Xeon at
        2.80GHz, 15 GB of RAM, no GPU of any kind. Bars are to scale against the
        longest run; the leading segment is the residual between the total and
        the three instrumented stages, which is loading 8.26 GB of weights off
        disk and planning the graphs. Peak RSS is VmHWM, sampled from{" "}
        <code>/proc</code> while the process ran.
      </figcaption>
    </figure>
  )
}
