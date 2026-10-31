// Every number here was measured on one Linux x64 box, Bun 1.4.4 canary
// (da867c60b), `bun build --compile` with and without --aot / --trim.
// Sizes are bytes of the output file. Times are the median of 40 launches.

export type Mode = "jit" | "trim" | "aot" | "aottrim"

export const MODES: { id: Mode; label: string; flags: string }[] = [
  { id: "jit", label: "plain", flags: "--compile" },
  { id: "trim", label: "trim only", flags: "--compile --trim" },
  { id: "aot", label: "aot only", flags: "--compile --aot" },
  { id: "aottrim", label: "aot + trim", flags: "--compile --aot --trim" },
]

export type Program = {
  id: string
  label: string
  what: string
  bytes: Record<Mode, number>
  startMs: Record<Mode, number>
  rssMb: Record<Mode, number>
}

export const PROGRAMS: Program[] = [
  {
    id: "hello",
    label: "hello",
    what: "console.log(\"hello\")",
    bytes: { jit: 140356264, trim: 84463016, aot: 68189224, aottrim: 25641320 },
    startMs: { jit: 5.3, trim: 4.7, aot: 5.2, aottrim: 5.5 },
    rssMb: { jit: 12.0, trim: 12.5, aot: 17.9, aottrim: 14.2 },
  },
  {
    id: "serve",
    label: "Bun.serve",
    what: "Bun.serve, one request to itself, stop",
    bytes: { jit: 140356264, trim: 84463016, aot: 68287528, aottrim: 34642152 },
    startMs: { jit: 8.3, trim: 8.3, aot: 8.2, aottrim: 8.3 },
    rssMb: { jit: 18.7, trim: 18.6, aot: 21.5, aottrim: 20.5 },
  },
  {
    id: "app",
    label: "hono + zod + sqlite",
    what: "Hono router, zod, bun:sqlite, node:crypto, node:zlib, one request",
    bytes: { jit: 140569256, trim: 84676008, aot: 71400488, aottrim: 46299368 },
    startMs: { jit: 36.4, trim: 35.8, aot: 14.4, aottrim: 15.0 },
    rssMb: { jit: 34.9, trim: 35.0, aot: 34.0, aottrim: 32.1 },
  },
  {
    id: "fib",
    label: "fib(35)",
    what: "recursive fib(35), print the result",
    bytes: { jit: 140356264, trim: 84463016, aot: 68205608, aottrim: 25682472 },
    startMs: { jit: 69.8, trim: 71.3, aot: 51.6, aottrim: 53.4 },
    rssMb: { jit: 19.1, trim: 19.5, aot: 16.7, aottrim: 14.5 },
  },
]

export const mb = (b: number) => (b / 1e6).toFixed(1)
