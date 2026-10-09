// The whole Atlas Camera Studio pipeline, one box per hop, with where each hop
// runs and what crosses it. Every number is from the repository:
//   1280 x 720 crop ............ src/trajectory/pose.ts fileToPoseBlob
//   images2PosedRGBD ........... server/jobs.ts (task name, targetResolution)
//   240,000-point budget ....... src/trajectory/pose.ts decodeLocalPointCloud
//   48 cameras ................. server/contracts.ts FRAMES, generateSchema .length(FRAMES)
//   atlasGenerate, seed 42 ..... server/jobs.ts, contracts.ts default
//   12 fps libx264 ............. server/jobs.ts makeVideo
// Server-rendered, zero JS.

type Hop = {
  where: "browser" | "server" | "World Labs"
  title: string
  detail: string
}

const HOPS: Hop[] = [
  { where: "browser", title: "Crop the photo", detail: "cover-crop to 1280 x 720 JPEG" },
  { where: "World Labs", title: "images2PosedRGBD", detail: "camera + linear-depth EXR" },
  { where: "browser", title: "Unproject depth", detail: "up to 240,000 coloured points" },
  { where: "browser", title: "Draw the path", detail: "keyframes, aim, smoothing" },
  { where: "browser", title: "Sample cameras", detail: "exactly 48 pinhole cameras" },
  { where: "World Labs", title: "atlasGenerate", detail: "48 generated 1280 x 720 frames" },
  { where: "server", title: "ffmpeg", detail: "libx264 at 12 fps: a 4 s MP4" },
]

const TONE: Record<Hop["where"], string> = {
  browser: "oklch(0.62 0.13 255)",
  server: "oklch(0.62 0.04 250)",
  "World Labs": "oklch(0.70 0.14 70)",
}

const BW = 178
const BH = 74
const GAP = 34
const W = 4 * BW + 3 * GAP + 20
const H = 2 * BH + 120

function pos(i: number): [number, number] {
  // a U: four across the top left to right, three back along the bottom right to left
  if (i < 4) return [10 + i * (BW + GAP), 34]
  const j = i - 4
  return [10 + (3 - j) * (BW + GAP), 34 + BH + 66]
}

export function StudioPipeline() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one photo → one 4-second shot</span>
        <span className="flex gap-3">
          {(Object.keys(TONE) as Hop["where"][]).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: TONE[k] }} />
              {k}
            </span>
          ))}
        </span>
      </div>
      <div className="overflow-x-auto p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[640px]"
          role="img"
          aria-label="Seven steps in a U shape. In the browser the photo is cropped to 1280 by 720. World Labs' images2PosedRGBD returns a camera and a depth map. The browser unprojects up to 240,000 points, the user draws a path, and the browser samples exactly 48 cameras. World Labs' atlasGenerate returns 48 generated frames. The server runs ffmpeg at 12 frames per second to make a 4 second MP4."
        >
          <defs>
            <marker id="mcs-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0L10,5L0,10z" className="fill-muted-foreground" />
            </marker>
          </defs>
          {HOPS.map((h, i) => {
            if (i === HOPS.length - 1) return null
            const [x0, y0] = pos(i)
            const [x1, y1] = pos(i + 1)
            if (i === 3) {
              return (
                <line
                  key={`e${i}`}
                  x1={x0 + BW / 2}
                  y1={y0 + BH + 2}
                  x2={x1 + BW / 2}
                  y2={y1 - 4}
                  className="stroke-muted-foreground"
                  strokeWidth={1.5}
                  markerEnd="url(#mcs-arrow)"
                />
              )
            }
            const forward = x1 > x0
            return (
              <line
                key={`e${i}`}
                x1={forward ? x0 + BW + 2 : x0 - 2}
                y1={y0 + BH / 2}
                x2={forward ? x1 - 4 : x1 + BW + 4}
                y2={y1 + BH / 2}
                className="stroke-muted-foreground"
                strokeWidth={1.5}
                markerEnd="url(#mcs-arrow)"
              />
            )
          })}
          {HOPS.map((h, i) => {
            const [x, y] = pos(i)
            return (
              <g key={h.title}>
                <rect x={x} y={y} width={BW} height={BH} rx={8} fill="none" stroke={TONE[h.where]} strokeWidth={2} />
                <rect x={x} y={y} width={BW} height={18} rx={8} fill={TONE[h.where]} opacity={0.22} />
                <text x={x + 8} y={y + 13} fontSize={10} className="fill-muted-foreground font-mono">
                  {i + 1} · {h.where}
                </text>
                <text x={x + 8} y={y + 38} fontSize={13} className="fill-foreground font-semibold">
                  {h.title}
                </text>
                <text x={x + 8} y={y + 58} fontSize={10.5} className="fill-muted-foreground">
                  {h.detail}
                </text>
              </g>
            )
          })}
          <text x={10} y={20} fontSize={11} className="fill-muted-foreground font-mono">
            no Gaussian splats anywhere: the preview is a depth point cloud, the output is generated pixels
          </text>
        </svg>
      </div>
    </figure>
  )
}
