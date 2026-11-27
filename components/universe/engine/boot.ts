// Boot steps for the /universe deck. Nothing here imports three, so the React side can use it
// before the engine chunk exists.
//
// Every stage of opening the deck (graphics card, engine chunk, fonts, renderer, scene chunk,
// pipelines, first frame) is a promise somebody else settles: the browser, the GPU process, the dev
// server compiling a chunk on first request. Any of them can stay pending for good, and a bare
// `await` on one is a loading bar that never moves again. So each stage runs through `attempt`: a
// time limit, one more try, and then a `StepError` that names the stage, which the bar shows.

/** A stage that failed for good. `step` and `reason` are fit to show: "failed: <step>, <reason>". */
export class StepError extends Error {
  constructor(
    readonly step: string,
    readonly reason: string,
  ) {
    super(`${step}, ${reason}`)
    this.name = "StepError"
  }
}

export const reasonOf = (e: unknown) => (e instanceof StepError ? e.reason : String((e as Error | null)?.message ?? e)).slice(0, 160)

const seconds = (ms: number) => `${Math.round(ms / 100) / 10} s`

/** `p`, or a rejection once `ms` have passed. The promise itself cannot be cancelled; `late` gets its value if it arrives after all. */
export function within<T>(p: Promise<T>, ms: number, late?: (v: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let over = false
    const timer = setTimeout(() => {
      over = true
      reject(new Error(`no answer after ${seconds(ms)}`))
    }, ms)
    p.then(
      (v) => {
        if (over) return late?.(v)
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        if (over) return
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

export type AttemptOpts<T> = {
  /** Time limit for each try. */
  ms: number
  /** Tries after the first (default 1). */
  retries?: number
  /** Checked before a retry: a boot that was cancelled does not try again. */
  alive?: () => boolean
  /** A try that timed out and then answered anyway: free what it made. */
  late?: (v: T) => void
}

/**
 * Run a stage with a time limit, and once more if it fails. A first failure is expected often
 * enough (a chunk the dev server was still compiling) that it is only logged; the last one throws
 * a `StepError` naming the stage.
 */
export async function attempt<T>(step: string, run: (tryNo: number) => Promise<T>, o: AttemptOpts<T>): Promise<T> {
  const tries = 1 + (o.retries ?? 1)
  for (let n = 0; ; n++) {
    try {
      return await within(Promise.resolve().then(() => run(n)), o.ms, o.late)
    } catch (e) {
      if (n + 1 >= tries || (o.alive && !o.alive())) throw new StepError(step, reasonOf(e))
      console.info(`[universe] ${step}: ${reasonOf(e)}; trying once more`)
    }
  }
}
