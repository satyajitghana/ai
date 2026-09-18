"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The same vecadd kernel, three ways, aliased or not.
//
// The launch that aliases the output with an input is drawn verbatim from
// NVIDIA's own announcement post (developer.nvidia.com/blog/introducing-cuda-rust...):
//   cuda-oxide:  module.vecadd(&stream, &prepared, &c_dev, &b_dev, &mut c_dev)?;
//                -> error[E0502]: cannot borrow `c_dev` as mutable because it
//                   is also borrowed as immutable
//   cutile-rs:   let z = api::zeros::<f32>(&[1024]);
//                kernel::add(z.partition([128]), z, y)
//                -> error[E0382]: use of moved value: `z`
//
// One honest wrinkle the toggle surfaces: for THIS kernel (c[i] = a[i] + b[i]),
// aliasing c with a or b is elementwise-independent and would not actually
// race — every thread's read and write share one index, so scheduling order
// never matters. CUDA C++ compiles and runs the aliased call correctly. Both
// Rust compilers reject it anyway, on the type-level rule alone, without
// asking whether this particular kernel tolerates it. That unconditional
// rejection is the point: it is also what catches the kernel shapes where
// aliasing DOES race (a stencil reading a neighbor, e.g. c[i] = a[i] + a[i+1]),
// which the copy below calls out rather than draws.

type Track = "cpp" | "oxide" | "cutile"

const HAZARD = "oklch(0.58 0.19 27)"
const OK = "oklch(0.55 0.16 155)"
const NOTE = "oklch(0.68 0.13 85)"

const HAZARD_BG = "color-mix(in oklch, oklch(0.58 0.19 27) 8%, transparent)"
const HAZARD_BORDER = "color-mix(in oklch, oklch(0.58 0.19 27) 45%, transparent)"
const OK_BG = "color-mix(in oklch, oklch(0.55 0.16 155) 8%, transparent)"
const OK_BORDER = "color-mix(in oklch, oklch(0.55 0.16 155) 45%, transparent)"

const TRACKS: { key: Track; label: string }[] = [
  { key: "cpp", label: "CUDA C++" },
  { key: "oxide", label: "cuda-oxide (SIMT)" },
  { key: "cutile", label: "cutile-rs (Tile)" },
]

export function AliasingCompare() {
  const [track, setTrack] = useState<Track>("cpp")
  const [aliased, setAliased] = useState(false)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          same vecadd kernel · {aliased ? "output aliases an input" : "disjoint buffers"}
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: track === "cpp" ? (aliased ? NOTE : OK) : aliased ? HAZARD : OK }}
        >
          {track === "cpp"
            ? aliased
              ? "compiles, runs — silently"
              : "compiles, runs"
            : aliased
              ? "compile error"
              : "compiles, runs"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {TRACKS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTrack(t.key)}
              aria-pressed={track === t.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                track === t.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <button
            type="button"
            onClick={() => setAliased((v) => !v)}
            aria-pressed={aliased}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              aliased
                ? "border-[color-mix(in_oklch,oklch(0.58_0.19_27)_45%,transparent)] bg-[color-mix(in_oklch,oklch(0.58_0.19_27)_10%,transparent)] text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {aliased ? "pass c as its own input" : "pass c, disjoint from a, b"}
          </button>
        </div>

        {track === "cpp" ? <CppPanel aliased={aliased} /> : null}
        {track === "oxide" ? <OxidePanel aliased={aliased} /> : null}
        {track === "cutile" ? <CutilePanel aliased={aliased} /> : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {aliased ? (
            <>
              Toggle the track above. CUDA C++ takes the aliased call without a diagnostic —{" "}
              <code className="font-mono text-[11px] text-foreground">__restrict__</code> is a
              promise to the optimizer, not a checked fact, and nothing in the toolchain reads the
              call site to see whether the promise still holds. Both Rust tracks refuse to build,
              and for the same underlying reason stated two different ways: cuda-oxide sees{" "}
              <code className="font-mono text-[11px] text-foreground">&c_dev</code> and{" "}
              <code className="font-mono text-[11px] text-foreground">&mut c_dev</code> live at
              once, an ordinary borrow conflict; cutile-rs sees{" "}
              <code className="font-mono text-[11px] text-foreground">z</code> passed by value
              twice, an ordinary move.
              <br />
              <br />
              Here is the honest part: for <em>this</em> kernel, the alias is harmless.{" "}
              <code className="font-mono text-[11px] text-foreground">c[i] = a[i] + b[i]</code>{" "}
              reads and writes the same index per thread, so no thread depends on another
              thread&rsquo;s write — the C++ version above runs and gets the right answer even
              aliased. Rust rejects it anyway, on the type-level rule alone, without asking whether
              this specific access pattern tolerates it. That unconditional rejection is what also
              catches the kernel shape where aliasing is <em>not</em> harmless — a stencil like{" "}
              <code className="font-mono text-[11px] text-foreground">{"c[i] = a[i] + a[i+1]"}</code>
              , where whether thread <em>i</em> reads the old or the already-overwritten value of{" "}
              <code className="font-mono text-[11px] text-foreground">{"a[i+1]"}</code> depends on
              scheduling order that CUDA never guarantees. Same rule, same rejection — this time
              for a case that really would have raced.
            </>
          ) : (
            <>
              With disjoint buffers all three compile and run identically —{" "}
              <code className="font-mono text-[11px] text-foreground">
                PASSED: all 1024 elements correct
              </code>
              . Flip the toggle to alias the output with an input.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}

function CppPanel({ aliased }: { aliased: boolean }) {
  return (
    <>
      <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/25 p-3 font-mono text-[10.5px] leading-5 text-foreground">
        {`__global__ void vecadd(const float* __restrict__ a,
                        const float* __restrict__ b,
                        float* __restrict__ c, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) c[i] = a[i] + b[i];
}
`}
        <span style={aliased ? { color: NOTE } : undefined}>
          {aliased ? "vecadd<<<blocks, 256>>>(c, b, c, n);  // c aliases c" : "vecadd<<<blocks, 256>>>(a, b, c, n);"}
        </span>
      </pre>
      <div
        className="mt-2 rounded-lg border px-3 py-2.5 font-mono text-[10.5px] leading-5"
        style={{
          borderColor: aliased ? HAZARD_BORDER : OK_BORDER,
          background: aliased ? HAZARD_BG : OK_BG,
          color: aliased ? NOTE : OK,
        }}
      >
        {aliased
          ? "$ nvcc -arch=sm_80 vecadd.cu -o vecadd  # zero warnings, zero errors — __restrict__ said this would never happen, and nothing checks that it didn't"
          : "$ nvcc -arch=sm_80 vecadd.cu -o vecadd  # zero warnings, zero errors"}
      </div>
    </>
  )
}

function OxidePanel({ aliased }: { aliased: boolean }) {
  return (
    <>
      <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/25 p-3 font-mono text-[10.5px] leading-5 text-foreground">
        {`#[kernel]
#[launch_contract(domain = 1, block = (256, 1, 1))]
pub fn vecadd(a: &[f32], b: &[f32], mut c: DisjointSlice<f32>) {
    let idx = thread::index_1d();
    if let Some(c_elem) = c.get_mut(idx) {
        *c_elem = a[idx.get()] + b[idx.get()];
    }
}
`}
        <span style={aliased ? { color: HAZARD } : undefined}>
          {aliased
            ? "module.vecadd(&stream, &prepared, &c_dev, &b_dev, &mut c_dev)?;"
            : "module.vecadd(&stream, &prepared, &a_dev, &b_dev, &mut c_dev)?;"}
        </span>
      </pre>
      {aliased ? (
        <div
          className="mt-2 overflow-x-auto rounded-lg border p-3 font-mono text-[10.5px] leading-5"
          style={{ borderColor: HAZARD_BORDER, background: HAZARD_BG }}
        >
          <span style={{ color: HAZARD }}>
            {`error[E0502]: cannot borrow \`c_dev\` as mutable because it is also borrowed as immutable`}
          </span>
          <br />
          <span className="text-muted-foreground">
            {`  --> src/main.rs  |  &c_dev (as \`a\`) is live when &mut c_dev (as \`c\`) is taken`}
          </span>
        </div>
      ) : (
        <div
          className="mt-2 rounded-lg border px-3 py-2.5 font-mono text-[10.5px] leading-5"
          style={{ borderColor: OK_BORDER, background: OK_BG, color: OK }}
        >
          PASSED: all 1024 elements correct
        </div>
      )}
    </>
  )
}

function CutilePanel({ aliased }: { aliased: boolean }) {
  return (
    <>
      <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/25 p-3 font-mono text-[10.5px] leading-5 text-foreground">
        {`#[cutile::entry()]
fn add<const B: i32>(
    z: &mut Tensor<f32, { [B] }>,
    x: &Tensor<f32, { [-1] }>,
    y: &Tensor<f32, { [-1] }>,
) {
    z.store(load_tile_like(x, z) + load_tile_like(y, z));
}
`}
        {aliased ? (
          <span style={{ color: HAZARD }}>
            {`let z = api::zeros::<f32>(&[1024]);
kernel::add(z.partition([128]), z, y)  // z passed twice`}
          </span>
        ) : (
          "let z = api::zeros::<f32>(&[1024]).partition([128]);\nkernel::add(z, x, y)"
        )}
      </pre>
      {aliased ? (
        <div
          className="mt-2 overflow-x-auto rounded-lg border p-3 font-mono text-[10.5px] leading-5"
          style={{ borderColor: HAZARD_BORDER, background: HAZARD_BG }}
        >
          <span style={{ color: HAZARD }}>{`error[E0382]: use of moved value: \`z\``}</span>
          <br />
          <span className="text-muted-foreground">
            {`  --> src/main.rs  |  \`z.partition(...)\` already moved \`z\`; the second \`z\` has nothing left to move`}
          </span>
        </div>
      ) : (
        <div
          className="mt-2 rounded-lg border px-3 py-2.5 font-mono text-[10.5px] leading-5"
          style={{ borderColor: OK_BORDER, background: OK_BG, color: OK }}
        >
          PASSED: all 1024 elements correct
        </div>
      )}
    </>
  )
}
