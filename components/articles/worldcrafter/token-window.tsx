// What the DiT actually attends over for one chunk, drawn to scale.
//
// Everything here is read from the released files, not the paper's prose:
//   - transformer/config.json: patch_size [1, 2, 2]; the Wan VAE latent for a
//     384 x 640 frame is 48 x 80, so one latent frame is 24 x 40 = 960 tokens.
//   - safetensors headers: patch_memory and patch_short are [5120, 16, 1, 2, 2];
//     patch_mid is [5120, 16, 2, 4, 4], so the two mid-history frames collapse
//     to 1 x 12 x 20 = 240 tokens.
//   - repencoder/manifest.json: output_shape [16, 4, 48, 80], i.e. the memory
//     arrives as four latent-frame-shaped tensors, embedded like clean history
//     (patch_memory is initialised from patch_short in diffusers/transformer.py).
//   - pipeline.py splits the window as [1, memory 4, mid 2, recent 1, chunk 9]
//     and transformer.py concatenates memory first, then mid, then the short
//     history (first frame + latest frame), then the noisy chunk.
// The token counts are my arithmetic from those shapes. Server-rendered, zero JS.

const OURS = "oklch(0.60 0.15 255)"
const CTX = "oklch(0.62 0.03 250)"
const NOISE = "oklch(0.68 0.13 85)"
const HIST = "oklch(0.55 0.16 155)"

const PER_FRAME = 24 * 40 // 960
const SEG = [
  { key: "mem", label: "memory", tokens: 4 * PER_FRAME, sub: "4 frames" },
  { key: "mid", label: "mid", tokens: 12 * 20, sub: "2 frames" },
  { key: "short", label: "sink + latest", tokens: 2 * PER_FRAME, sub: "2 frames" },
  { key: "noise", label: "chunk being denoised", tokens: 9 * PER_FRAME, sub: "9 latent frames" },
] as const
const TOTAL = SEG.reduce((a, s) => a + s.tokens, 0) // 14,640

const W = 700
const H = 312
const X0 = 20
const BAR_W = W - 40
const px = (t: number) => (t / TOTAL) * BAR_W

const fmt = (n: number) => n.toLocaleString("en-US")

// Left edge of each segment, computed once.
const STARTS = SEG.map((_, i) => X0 + px(SEG.slice(0, i).reduce((a, s) => a + s.tokens, 0)))

function Row({ y, memColour, memLabel }: { y: number; memColour: string; memLabel: string }) {
  return (
    <g>
      {SEG.map((s, i) => {
        const x = STARTS[i]
        const w = px(s.tokens)
        const colour = s.key === "mem" ? memColour : s.key === "noise" ? NOISE : HIST
        return (
          <g key={s.key}>
            <rect
              x={x + 0.8}
              y={y}
              width={w - 1.6}
              height={26}
              rx={3}
              fill={colour}
              fillOpacity={s.key === "noise" ? 0.35 : s.key === "mem" ? 0.8 : 0.45}
            />
            {w > 60 ? (
              <text x={x + w / 2} y={y + 16.5} textAnchor="middle" className="fill-foreground font-mono" fontSize={9.5}>
                {s.key === "mem" ? memLabel : s.label}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}

export function TokenWindow() {
  const memEnd = X0 + px(SEG[0].tokens)
  const midEnd = memEnd + px(SEG[1].tokens)
  const shortEnd = midEnd + px(SEG[2].tokens)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one chunk&apos;s attention window, to scale</span>
        <span className="text-muted-foreground/60">{fmt(TOTAL)} tokens</span>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[600px]"
          role="img"
          aria-label={`The token sequence WorldCrafter's DiT attends over for one chunk: ${fmt(SEG[0].tokens)} memory tokens, ${fmt(SEG[1].tokens)} tokens of compressed mid history, ${fmt(SEG[2].tokens)} tokens for the first frame and the latest frame, and ${fmt(SEG[3].tokens)} tokens for the nine latent frames being denoised, ${fmt(TOTAL)} in all. The context-memory ablation fills the same memory slot with four retrieved raw latent frames instead. Only the noisy chunk receives the camera-conditioning branch.`}
        >
          <text x={X0} y={22} className="fill-foreground font-mono" fontSize={10.5}>
            WorldCrafter
          </text>
          <text x={X0 + 96} y={22} className="fill-muted-foreground font-mono" fontSize={9}>
            memory = latest + 8 retrieved latent frames, encoded and read out at 4 upcoming poses
          </text>
          <Row y={32} memColour={OURS} memLabel="memory · 4 target views" />

          <text x={X0} y={92} className="fill-foreground font-mono" fontSize={10.5}>
            context-memory ablation
          </text>
          <text x={X0 + 162} y={92} className="fill-muted-foreground font-mono" fontSize={9}>
            same slot, filled with 4 retrieved raw frames
          </text>
          <Row y={102} memColour={CTX} memLabel="4 retrieved frames" />

          {/* token counts under the segments */}
          {[
            { x: X0, x1: memEnd, t: SEG[0].tokens },
            { x: memEnd, x1: midEnd, t: SEG[1].tokens },
            { x: midEnd, x1: shortEnd, t: SEG[2].tokens },
            { x: shortEnd, x1: X0 + BAR_W, t: SEG[3].tokens },
          ].map((s, i) => (
            <g key={i}>
              <line x1={s.x + 1} x2={s.x1 - 1} y1={138} y2={138} stroke="currentColor" className="text-muted-foreground" strokeOpacity={0.5} />
              {i === 1 ? (
                <line x1={(s.x + s.x1) / 2} x2={(s.x + s.x1) / 2} y1={140} y2={156} stroke="currentColor" className="text-muted-foreground" strokeOpacity={0.5} />
              ) : null}
              <text
                x={i === 1 ? (s.x + s.x1) / 2 + 4 : (s.x + s.x1) / 2}
                y={i === 1 ? 164 : 151}
                textAnchor={i === 1 ? "start" : "middle"}
                className="fill-muted-foreground font-mono"
                fontSize={8.5}
              >
                {fmt(s.t)}
                {i === 1 ? " mid history" : ""}
              </text>
            </g>
          ))}

          {/* what touches what */}
          <line x1={shortEnd + 1} x2={X0 + BAR_W - 1} y1={186} y2={186} stroke={NOISE} strokeWidth={2} />
          <text x={(shortEnd + X0 + BAR_W) / 2} y={200} textAnchor="middle" fill={NOISE} className="font-mono" fontSize={9}>
            camera branch (UCPE) acts here only
          </text>
          <line x1={X0 + 1} x2={shortEnd - 1} y1={186} y2={186} stroke={HIST} strokeWidth={2} />
          <text x={(X0 + shortEnd) / 2} y={200} textAnchor="middle" fill={HIST} className="font-mono" fontSize={9}>
            clean context, run at timestep 0
          </text>

          <line x1={X0} x2={W - 20} y1={218} y2={218} stroke="currentColor" className="text-border" />
          <text x={X0} y={236} className="fill-muted-foreground font-mono" fontSize={9}>
            one latent frame: 48 x 80 latent, 1 x 2 x 2 patches = {fmt(PER_FRAME)} tokens · mid history uses 2 x 4 x 4 patches
          </text>
          <text x={X0} y={252} className="fill-muted-foreground font-mono" fontSize={9}>
            the memory slot is {Math.round((SEG[0].tokens / TOTAL) * 100)}% of the window, whatever fills it; the ablation holds it fixed
          </text>
          <text x={X0} y={268} className="fill-muted-foreground font-mono" fontSize={9}>
            and changes only what goes in. Revisit LPIPS: 0.497 with raw frames, 0.255 with the memory encoder.
          </text>
          <text x={X0} y={292} className="fill-muted-foreground font-mono" fontSize={8.5}>
            token counts: my arithmetic from the shipped config and safetensors shapes · LPIPS: paper, ablation table
          </text>
        </svg>
      </div>
    </figure>
  )
}
