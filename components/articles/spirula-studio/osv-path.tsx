// What "360 camera support" means when it is not a marketing line.
//
// The path a DJI Osmo 360 .OSV takes from the file to a levelled, metric
// reconstruction, with the measurement the repository publishes for each step.
// Nothing here is undistorted to a pinhole first: the fisheye pair is
// reconstructed as a rig, and the file's own sensor log fixes the gauge.
//
// Every number is from src/sfm/README.md and the files it points at. Rendered
// as a stepped list rather than a diagram because the interesting content is
// the numbers, and a diagram at phone width would hide them. Server-rendered,
// zero JS.

type Step = {
  stage: string
  what: string
  measured: string
}

const STEPS: Step[] = [
  {
    stage: "container",
    what: "ISO-BMFF picked by content, not extension; the file's two video tracks are enumerated, never merged — a 360 camera's two fisheye lenses.",
    measured: "one output folder per track",
  },
  {
    stage: "decode",
    what: "VK_KHR_video_decode on the same device as everything else; the H.264/H.265/AV1 bitstream parsing and reference-picture state are Spirula's own.",
    measured: "127 s of 1080p30 in 10 s · ~15× vs shelling out to ffmpeg",
  },
  {
    stage: "rig",
    what: "kind: dual-fisheye — the second lens is the first turned 180° about the image vertical, and the baseline between them is its only translation (refined as axial).",
    measured:
      "Insta360 X, Osmo 360 and a PortalCam all calibrate within 0.8–1.4° of that rotation; the Osmo's baseline lands within a millimetre of the axis",
  },
  {
    stage: "matching",
    what: "--rig-pairs extends every verified frame pair to the other lens: cam0–cam0 brings cam1–cam1, cam0–cam1 brings cam1–cam0. A second, smaller verification pass over what the first confirmed.",
    measured:
      "72–95% of rig-mates verify on the dual fisheyes measured; 6% on a .360's narrow views, which is why it stops there",
  },
  {
    stage: "registration",
    what: "Once a member is calibrated the FRAME is what PnP estimates: every calibrated lens's 2D–3D correspondences go into one pool, one LO-RANSAC over all of it.",
    measured:
      "a hypothesis explaining one lens and contradicting the other nine loses to one that explains the frame",
  },
  {
    stage: "gauge",
    what: "The file's own sensors fix scale and up. The Osmo 360 carries an attitude stream but no raw gyro, so pre-integration runs from the attitude instead; the IMU-to-lens rotation is calibrated from the reconstruction itself.",
    measured:
      "gravity solves to 9.82 m/s² within 0.3° of up on a 118 s walk; the whole sensor fit takes 0.3 s",
  },
  {
    stage: "record",
    what: "sparse/N/gauge.txt states oriented and metric and which source settled each. A gauge a sensor settled is never overwritten by the guess it replaced.",
    measured:
      "scale and orientation uncertainties are printed and never gated on — measured against GPS they under-state the real error 3.9–4.5×",
  },
]

export function OsvPath() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one .OSV file → a levelled, metric reconstruction</span>
        <span className="text-muted-foreground/60">no undistortion step</span>
      </div>

      <ol className="m-0 list-none p-4 sm:p-5">
        {STEPS.map((s, i) => (
          <li
            key={s.stage}
            className={`relative pl-7 ${i === STEPS.length - 1 ? "" : "pb-5"}`}
          >
            {i < STEPS.length - 1 ? (
              <span
                aria-hidden
                className="absolute top-4 bottom-0 left-[7px] w-px bg-border"
              />
            ) : null}
            <span
              aria-hidden
              className="absolute top-1.5 left-0 h-[15px] w-[15px] rounded-full border-2 border-foreground/30 bg-background"
            />
            <div className="font-mono text-xs tracking-wide text-foreground uppercase">
              {s.stage}
            </div>
            <p className="my-1 text-[13px] leading-6 text-muted-foreground">
              {s.what}
            </p>
            <p className="my-0 font-mono text-[11px] leading-5 text-foreground/70">
              {s.measured}
            </p>
          </li>
        ))}
      </ol>
    </figure>
  )
}
