// "All in one pipeline" usually means vendored. Here it means rewritten.
//
// Every row is a subprocess or a Python dependency that Spirula Studio used to
// shell out to, and the module inside the binary that replaced it. The line
// counts are `find src/<dir> -name '*.cpp' -o -name '*.h' -o -name '*.slang'`
// over the repository at 2026-09-22; the "borrowed" column is what is still
// somebody else's — in every case a checkpoint or a set of parameter defaults,
// never code.
//
// Server-rendered, zero JS: it is a ledger, and a ledger does not need state.

type Row = {
  gone: string
  now: string
  lines: number
  borrowed: string
}

const ROWS: Row[] = [
  {
    gone: "colmap (subprocess)",
    now: "src/sfm/",
    lines: 44310,
    borrowed: "COLMAP's behaviour and parameter defaults, as the reference",
  },
  {
    gone: "PyTorch + CUDA (inference)",
    now: "src/nn/",
    lines: 10886,
    borrowed: "nothing — Vulkan + Slang, its own tensor and op set",
  },
  {
    gone: "lang-segment-anything",
    now: "src/sam/",
    lines: 7962,
    borrowed: "Meta's SAM 2.1 / SAM 3 checkpoints, fetched on first use",
  },
  {
    gone: "ffmpeg (frame extraction)",
    now: "src/video/",
    lines: 9145,
    borrowed: "nothing — VK_KHR_video_decode plus its own demuxers",
  },
  {
    gone: "onnxruntime (features)",
    now: "src/aliked/ + src/loma/",
    lines: 5712,
    borrowed: "COLMAP's and LoMa's own ONNX exports, parsed in process",
  },
  {
    gone: "torch.hub + mmcv (depth)",
    now: "src/moge/ + src/metric3d/",
    lines: 4059,
    borrowed: "onnx-community and Ruicheng ONNX exports of MoGe-2 / Metric3D v2",
  },
]

const TOTAL = ROWS.reduce((s, r) => s + r.lines, 0)

export function DependencyLedger() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what &quot;no Python, no COLMAP&quot; costs</span>
        <span className="text-muted-foreground/60">
          {TOTAL.toLocaleString("en-US")} lines
        </span>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <table className="w-full min-w-[520px] border-collapse font-mono text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="border-b py-2 pr-3 text-left font-normal">
                dependency removed
              </th>
              <th className="border-b py-2 pr-3 text-left font-normal">
                what replaced it
              </th>
              <th className="border-b py-2 pr-3 text-right font-normal">
                lines
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.now} className="align-top">
                <td className="border-b py-2.5 pr-3 text-muted-foreground line-through decoration-muted-foreground/50">
                  {r.gone}
                </td>
                <td className="border-b py-2.5 pr-3">
                  <div className="text-foreground">{r.now}</div>
                  <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                    still borrowed: {r.borrowed}
                  </div>
                </td>
                <td className="border-b py-2.5 pr-3 text-right tabular-nums">
                  {r.lines.toLocaleString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          What is left of Python in the repository is 39 files under
          {" "}
          <code>reference/</code>, kept as the behavioural reference the ports
          were checked against, plus the build&apos;s own codegen. Nothing in the
          shipped binary runs them.
        </p>
      </div>
    </figure>
  )
}
