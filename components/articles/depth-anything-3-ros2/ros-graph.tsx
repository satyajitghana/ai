import { cn } from "@/lib/utils"

// What the node actually moves, stage by stage, with the shape, the units and
// the frame at every hand-off. Everything here is read off
// ika-rwth-aachen/ros2-depth-anything-v3-trt at 9bad9db — no inferred fields.
//
// The point of drawing it this way is that a ROS graph diagram normally shows
// topic names and arrows, which is exactly the information that is never in
// doubt. The things that bite are the ones in the small print: which grid a
// number lives on, whether it is metres, whose frame it is in, and which pixels
// are a measurement rather than a fill value. So those get the columns.
//
// Server-rendered, zero JS.

type Band = "in" | "node" | "out"

interface Row {
  band: Band
  name: string
  kind: string
  detail: string
  facts: [string, string][]
  where: string
}

const ROWS: Row[] = [
  {
    band: "in",
    name: "~/input/image",
    kind: "sensor_msgs/msg/Image",
    detail:
      "Subscribed through image_transport; the node picks the compressed transport when the remapped topic ends in /compressed, raw otherwise.",
    facts: [
      ["qos", "SensorDataQoS (best-effort)"],
      ["frame", "whatever the driver stamps"],
    ],
    where: "depth_anything_v3_node.cpp:87–99",
  },
  {
    band: "in",
    name: "~/input/camera_info",
    kind: "sensor_msgs/msg/CameraInfo",
    detail:
      "Only k[0], k[2], k[4], k[5] are read — fx, cx, fy, cy. Distortion coefficients are never touched, so a fisheye or a raw un-rectified stream is silently treated as a pinhole.",
    facts: [
      ["sync", "ApproximateTime, queue 10"],
      ["max interval", "never set"],
    ],
    where: "depth_anything_v3_node.cpp:103–104",
  },
  {
    band: "node",
    name: "decode",
    kind: "CPU",
    detail:
      "cv_bridge::toCvShare to BGR8. This is outside the region the node times for its FPS readout.",
    facts: [["out", "H×W×3 uint8, BGR"]],
    where: "depth_anything_v3_node.cpp:174",
  },
  {
    band: "node",
    name: "resize + normalise",
    kind: "CUDA",
    detail:
      "One kernel: bicubic resize straight to the engine's input size, BGR→RGB, ImageNet mean/std, NCHW packing. The resize does not preserve aspect ratio.",
    facts: [
      ["out", "1×3×280×504 float32"],
      ["filter", "cv::INTER_CUBIC, A = −0.75"],
    ],
    where: "preprocess_gpu.cu:41",
  },
  {
    band: "node",
    name: "TensorRT",
    kind: "GPU",
    detail:
      "DA3METRIC-LARGE: DINOv2 ViT-L backbone, DPT head, two outputs. depth comes out of an exp activation, so it is strictly positive; sky comes out of a ReLU, so it is non-negative and is not a probability.",
    facts: [
      ["depth", "1×1×280×504, focal-normalised"],
      ["sky", "1×1×280×504, post-ReLU"],
    ],
    where: "tensorrt_depth_anything.cpp:306",
  },
  {
    band: "node",
    name: "scale to metres",
    kind: "CUDA",
    detail:
      "depth ×= 0.5·(fx·sx + fy·sy) / 300. This multiply is the only thing that makes the output metric. Nothing upstream of it is in metres.",
    facts: [
      ["constant", "300.0, hard-coded"],
      ["source of fx, fy", "CameraInfo, scaled to 504×280"],
    ],
    where: "tensorrt_depth_anything.cpp:360",
  },
  {
    band: "node",
    name: "sky mask + fill",
    kind: "CUDA",
    detail:
      "non-sky is sky < 0.3. The 99th percentile of the first 100 000 valid pixels in row-major order, capped at 200 m, is written into every sky pixel. Sky is filled, not invalidated.",
    facts: [
      ["sample", "row-major prefix, not spread"],
      ["cap", "200.0 m, not the ROS parameter"],
    ],
    where: "postprocess_gpu.cu:78–186",
  },
  {
    band: "node",
    name: "upscale",
    kind: "CUDA",
    detail:
      "Bicubic back to the camera's resolution, with no clamp — the kernel's own comment notes the overshoot is kept. Only the published depth image goes through this; the point cloud does not.",
    facts: [["out", "H×W float32, metres"]],
    where: "postprocess_gpu.cu:202",
  },
  {
    band: "node",
    name: "point cloud",
    kind: "CPU",
    detail:
      "Built from the 280×504 map with intrinsics scaled to it, X = (u−cx)·Z/fx, Y = (v−cy)·Z/fy, Z = depth. That is the optical-frame convention: +z forward, +x right, +y down.",
    facts: [
      ["grid", "280×504, then every Nth point"],
      ["sky + non-finite", "NaN"],
    ],
    where: "tensorrt_depth_anything.cpp:49",
  },
  {
    band: "out",
    name: "~/output/depth_image",
    kind: "sensor_msgs/msg/Image · 32FC1",
    detail:
      "Metres, at the camera's full resolution. header is copied wholesale from the input image, so the frame is the driver's image frame and the stamp is the capture time, not the publish time.",
    facts: [
      ["sky pixels", "min(p99, 200 m) — not NaN"],
      ["qos", "default reliable, depth 1"],
    ],
    where: "depth_anything_v3_node.cpp:209–213",
  },
  {
    band: "out",
    name: "~/output/point_cloud",
    kind: "sensor_msgs/msg/PointCloud2",
    detail:
      "Organised, is_dense = false, xyz plus rgb when colorize_point_cloud is on. The frame_id the cloud builder set from camera_info is overwritten one line later by the image header.",
    facts: [
      ["sky pixels", "NaN"],
      ["default size", "28×51 points at factor 10"],
    ],
    where: "depth_anything_v3_node.cpp:216–218",
  },
  {
    band: "out",
    name: "~/output/depth_image_debug",
    kind: "sensor_msgs/msg/Image · bgr8",
    detail:
      "Colormapped visualisation with an FPS overlay averaged over the last 20 frames. Off by default in the node, on by default in the shipped param file.",
    facts: [["clamp", "debug_colormap_min/max_depth"]],
    where: "depth_anything_v3_node.cpp:221–274",
  },
]

const BAND_LABEL: Record<Band, string> = {
  in: "subscribed",
  node: "inside the node",
  out: "published",
}

const BAND_COLOR: Record<Band, string> = {
  in: "oklch(0.62 0.13 240)",
  node: "oklch(0.68 0.13 85)",
  out: "oklch(0.62 0.15 160)",
}

export function RosGraph() {
  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent"
      aria-label="What the Depth Anything V3 ROS 2 node subscribes to, computes and publishes"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one callback · camera frame in, metres out
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          ros2-depth-anything-v3-trt @ 9bad9db
        </span>
      </div>

      <div className="divide-y divide-border/60">
        {ROWS.map((r, k) => {
          const newBand = k === 0 || ROWS[k - 1].band !== r.band
          return (
            <div key={r.name}>
              {newBand ? (
                <div className="flex items-center gap-2 bg-muted/25 px-4 py-1.5">
                  <span
                    className="inline-block size-1.5 rounded-full"
                    style={{ background: BAND_COLOR[r.band] }}
                  />
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    {BAND_LABEL[r.band]}
                  </span>
                </div>
              ) : null}

              <div className="flex gap-3 px-4 py-3">
                <div
                  className="mt-1.5 w-0.5 shrink-0 self-stretch rounded-full"
                  style={{ background: BAND_COLOR[r.band], opacity: 0.5 }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px] break-all">
                      {r.name}
                    </code>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {r.kind}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {r.detail}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {r.facts.map(([k, v]) => (
                      <span key={k} className="font-mono text-[10px] leading-4">
                        <span className="text-muted-foreground/60">{k}</span>{" "}
                        <span className="text-foreground/85">{v}</span>
                      </span>
                    ))}
                    <span
                      className={cn(
                        "font-mono text-[10px] leading-4 text-muted-foreground/50"
                      )}
                    >
                      {r.where}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        Everything above the &ldquo;scale to metres&rdquo; row is unitless. The
        conversion lives in the wrapper, not in the model file.
      </figcaption>
    </figure>
  )
}
