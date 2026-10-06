"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One file read, from a C++ engine thread to bytes in its buffer, as io_worker.js does it.
// Every code line below is quoted from the file the site serves (/b/8b0b5899ed/io_worker.js),
// trimmed to the lines that matter; line numbers are that file's.

type Step = { who: string; title: string; text: string; code: string; at: string }

const STEPS: Step[] = [
  {
    who: "engine thread",
    title: "1. Fill a slot, ring the doorbell, wait",
    text: "The C++ file layer (httpfs_wasm.cpp) owns one 16-word slot per thread in a table in shared memory. It writes the file id, the 64-bit offset, the destination address in the wasm heap and the length, sets the state word to 1 (requested), bumps the doorbell and blocks in Atomics.wait on its slot. It never touches fetch.",
    code: `// slot i (16 words at 16 + 16*i): [0] state 0 idle / 1 requested /
//   3 taken by this worker / 2 done, [1] file id, [2..3] offset,
//   [4..5] destination address, [6] length, [7] result (bytes or -1)`,
    at: "io_worker.js:18",
  },
  {
    who: "IO worker",
    title: "2. Wake up and claim the slot",
    text: "The IO worker is a normal JavaScript worker with an event loop. It parks on the doorbell with Atomics.waitAsync, so it costs nothing while idle, then claims each requested slot with a compare-and-swap from 1 to 3 so that no slot is served twice.",
    code: `const seen = Atomics.load(HEAP32, bell);
const n = Atomics.load(HEAP32, bell + 1);
for (let slot = 0; slot < n; slot++)
  if (Atomics.compareExchange(HEAP32, bell + 16 + 16 * slot, 1, 3) === 1)
    serve(slot);
drainHints(bell);
const r = Atomics.waitAsync(HEAP32, bell, seen);
if (r.async) await r.value;`,
    at: "io_worker.js:575",
  },
  {
    who: "IO worker",
    title: "3. Which 4 KB blocks are missing?",
    text: "The read is split into 4 KB blocks of the file. A Map from (file id, block) to an offset in the local store says which are already on disk; another Map says which are already being fetched. A sequential scan of a file also starts read-ahead, doubling from 64 KB to 512 KB, but the engine only waits for its own bytes.",
    code: `const first = Math.floor(off / BS), needLast = Math.floor((off + len - 1) / BS);
for (let b = first; b <= needLast; b++)
  if (!index.has(id * 1048576 + b)) { cold = cold || !inflight.has(id * 1048576 + b); need = true; }
if (need) need = ensureBlocks(id, first, needLast);
if (aheadLast > needLast) ensureBlocks(id, needLast + 1, aheadLast, true);`,
    at: "io_worker.js:502",
  },
  {
    who: "IO worker → host",
    title: "4. Fetch only the missing runs, in parallel slices",
    text: "Missing blocks are grouped into runs and fetched with HTTP Range requests. A read the engine is blocked on is cut into 128 KB slices fetched side by side at high priority, because one stream from the host moves about 0.15 MB/s after a 0.6 s round trip. Speculative fetches run whole and at low priority so they never queue in front of a blocking read.",
    code: `const init = { cache: 'no-store', priority: low ? 'low' : 'high' };
if (!whole) init.headers = { Range: 'bytes=' + start + '-' + end };
const res = await fetchRetry(url, init);   // 8 tries, jittered backoff
...
const slice = wholeFile || low ? b - a + 1 : SLICE_BLOCKS;   // 32 blocks = 128 KB`,
    at: "io_worker.js:332, 378",
  },
  {
    who: "IO worker → OPFS",
    title: "5. Stream the body straight into the disk store",
    text: "Each response chunk is written as it arrives into store.bin in the Origin Private File System through a synchronous access handle: no Blob, no Cache API, no ArrayBuffer kept around for the garbage collector. Two seconds later, after the data is flushed, 16-byte journal entries record where each block went, so the store survives a reload.",
    code: `jobs.push(fetchRange(f, s * BS, s * BS + n - 1,
  (chunk, at) => sh.write(chunk, { at: offset + pos + at }), wholeFile, low));
...
sh.flush();      // the data first, then the entries that point at it
jh.write(new Uint8Array(buf.buffer), { at: journalEnd });`,
    at: "io_worker.js:381, 311",
  },
  {
    who: "IO worker → engine",
    title: "6. Copy into the heap and wake the thread",
    text: "The bytes go from the store straight into the engine's buffer inside the shared wasm heap, merging blocks that happen to be contiguous on disk. Then the result is written, the state flips to 2 (done) and Atomics.notify wakes the blocked C++ thread, which returns from what it thinks was a normal read().",
    code: `got = sh.read(HEAPU8.subarray(dst + done, dst + done + n), { at: storeOff });
...
Atomics.store(HEAP32, w + 7, result);
Atomics.store(HEAP32, w, 2);
Atomics.notify(HEAP32, w, 1);`,
    at: "io_worker.js:421, 522",
  },
]

export function ReadPath() {
  const [i, setI] = useState(0)
  const s = STEPS[i]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one engine read, end to end · {s.who}</span>
        <div className="flex gap-1">
          {STEPS.map((_, k) => (
            <button
              key={k}
              type="button"
              onClick={() => setI(k)}
              className={cn(
                "h-6 w-6 rounded-md border font-mono text-xs",
                k === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="text-sm font-semibold">{s.title}</div>
        <p className="text-sm leading-relaxed">{s.text}</p>
        <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed">{s.code}</pre>
        <div className="font-mono text-xs text-muted-foreground">{s.at}</div>
      </div>
      <div className="flex justify-between border-t px-4 py-2">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="font-mono text-xs text-muted-foreground hover:text-foreground disabled:opacity-40">
          ← previous
        </button>
        <button type="button" disabled={i === STEPS.length - 1} onClick={() => setI(i + 1)} className="font-mono text-xs text-muted-foreground hover:text-foreground disabled:opacity-40">
          next →
        </button>
      </div>
    </figure>
  )
}
