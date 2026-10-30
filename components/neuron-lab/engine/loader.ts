// Fetch the model from Hugging Face at run time and keep it in the browser (OPFS) so the second
// visit needs no network. Nothing here is committed to git: the weights live on huggingface.co.
//
//   weights   Qwen/Qwen3-0.6B-GGUF, Qwen3-0.6B-Q8_0.gguf   639,446,688 bytes (610 MiB)
//   tokenizer Qwen/Qwen3-0.6B, tokenizer.json                 11,422,654 bytes
//
// Both are pinned to a commit so a later upstream edit cannot change what a visitor runs; the size
// is checked, and HTTP Range requests (3 in flight, 8 MiB each) make the download resumable.
import type { ByteSource, ProgressFn } from "./types"

export const MODEL_FILES = {
  ggufUrl: "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/23749fefcc72300e3a2ad315e1317431b06b590a/Qwen3-0.6B-Q8_0.gguf",
  ggufBytes: 639446688,
  tokenizerUrl: "https://huggingface.co/Qwen/Qwen3-0.6B/resolve/c1899de289a04d12100db370d81485cdf75e47ca/tokenizer.json",
  tokenizerBytes: 11422654,
  cacheKey: "qwen3-0.6b-q8_0-23749fe",
}
export const DOWNLOAD_MB = Math.round((MODEL_FILES.ggufBytes + MODEL_FILES.tokenizerBytes) / 1e6) // 651

export interface LoaderConfig {
  ggufUrl: string
  ggufBytes: number
  tokenizerUrl: string
  tokenizerBytes: number
  cacheKey: string
  /** false: stream straight into memory, nothing persisted (also the fallback when OPFS is unusable). */
  useCache: boolean
  chunkBytes: number
  concurrency: number
}

export const DEFAULT_LOADER: LoaderConfig = { ...MODEL_FILES, useCache: true, chunkBytes: 8 << 20, concurrency: 3 }

const DIR = "neuron-lab"

async function dir(create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage.getDirectory()
    return await root.getDirectoryHandle(DIR, { create })
  } catch { return null }
}

export type CacheState = { state: "none" | "partial" | "complete" | "unavailable"; bytes: number }

/** Cheap, works on the main thread (no sync handles). */
export async function cacheStatus(cfg: LoaderConfig = DEFAULT_LOADER): Promise<CacheState> {
  const d = await dir(false)
  if (!d) return { state: typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function" ? "none" : "unavailable", bytes: 0 }
  try {
    const ok = await (await d.getFileHandle(cfg.cacheKey + ".ok")).getFile()
    if (Number(await ok.text()) === cfg.ggufBytes) return { state: "complete", bytes: cfg.ggufBytes }
  } catch { /* not complete */ }
  try {
    const part = JSON.parse(await (await (await d.getFileHandle(cfg.cacheKey + ".part")).getFile()).text())
    return { state: part.done > 0 ? "partial" : "none", bytes: part.done || 0 }
  } catch { return { state: "none", bytes: 0 } }
}

export async function clearCache(): Promise<void> {
  try { const root = await navigator.storage.getDirectory(); await root.removeEntry(DIR, { recursive: true }) } catch { /* nothing cached */ }
}

async function fetchRange(url: string, a: number, b: number, signal?: AbortSignal): Promise<Uint8Array> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${a}-${b}` }, signal })
      if (r.status !== 206) throw new Error(`HTTP ${r.status} for bytes ${a}-${b} (Range not honoured?)`)
      const buf = new Uint8Array(await r.arrayBuffer())
      if (buf.length !== b - a + 1) throw new Error(`short read ${buf.length} of ${b - a + 1}`)
      return buf
    } catch (e) {
      if (signal?.aborted) throw e
      lastErr = e
      await new Promise((res) => setTimeout(res, 400 * 2 ** attempt))
    }
  }
  throw new Error(`download failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`)
}

/** No cache: read the file by Range requests as the loader asks for it. */
function httpSource(url: string, size: number): ByteSource {
  return {
    size,
    async read(offset, dst) {
      const CH = 16 << 20
      for (let o = 0; o < dst.length; o += CH) {
        const n = Math.min(CH, dst.length - o)
        dst.set(await fetchRange(url, offset + o, offset + o + n - 1), o)
      }
    },
  }
}

async function readJson(h: FileSystemDirectoryHandle, name: string): Promise<unknown | null> {
  try { return JSON.parse(await (await (await h.getFileHandle(name)).getFile()).text()) } catch { return null }
}

async function writeSmall(h: FileSystemDirectoryHandle, name: string, text: string) {
  const fh = await h.getFileHandle(name, { create: true })
  const sh = await fh.createSyncAccessHandle()
  try { sh.truncate(0); sh.write(new TextEncoder().encode(text), { at: 0 }); sh.flush() } finally { sh.close() }
}

export interface Opened { src: ByteSource; tokenizerJson: unknown; cached: boolean; downloaded: number; close(): void }

/**
 * Make the weights available as a ByteSource (downloading into OPFS first when needed) and fetch
 * the tokenizer. Download progress is reported on [0, dlShare]; the caller maps the unpacking
 * phase onto the rest.
 */
export async function openModel(cfg: LoaderConfig, onProgress: ProgressFn, dlShare: number, signal?: AbortSignal): Promise<Opened> {
  let useCache = cfg.useCache
  if (useCache) {
    if (!(navigator.storage?.getDirectory)) useCache = false
    else {
      const est = await navigator.storage.estimate?.()
      const st = await cacheStatus(cfg)
      if (est?.quota && st.state !== "complete" && est.quota - (est.usage ?? 0) < cfg.ggufBytes * 1.15) {
        useCache = false
        onProgress(0, "not enough free browser storage to keep the model: streaming without a cache")
      }
    }
  }
  const d = useCache ? await dir(true) : null
  let downloaded = 0
  // ---- tokenizer (small)
  let tokenizerJson: unknown = null
  const tokName = cfg.cacheKey + ".tokenizer.json"
  if (d) tokenizerJson = await readJson(d, tokName)
  if (!tokenizerJson) {
    const r = await fetch(cfg.tokenizerUrl, { signal })
    if (!r.ok) throw new Error(`tokenizer.json: HTTP ${r.status}`)
    const text = await r.text()
    downloaded += text.length
    tokenizerJson = JSON.parse(text)
    if (d) { try { await writeSmall(d, tokName, text) } catch { /* cache is best effort */ } }
  }
  if (!d) return { src: httpSource(cfg.ggufUrl, cfg.ggufBytes), tokenizerJson, cached: false, downloaded, close() {} }

  // ---- weights into OPFS
  const name = cfg.cacheKey + ".gguf"
  const fh = await d.getFileHandle(name, { create: true })
  let sh: FileSystemSyncAccessHandle
  try { sh = await fh.createSyncAccessHandle() } catch {
    // another tab holds the file: just stream
    return { src: httpSource(cfg.ggufUrl, cfg.ggufBytes), tokenizerJson, cached: false, downloaded, close() {} }
  }
  const status = await cacheStatus(cfg)
  if (status.state !== "complete" || sh.getSize() !== cfg.ggufBytes) {
    let prefix = status.state === "partial" ? Math.min(status.bytes, sh.getSize()) : 0
    prefix -= prefix % cfg.chunkBytes
    if (prefix === 0) sh.truncate(0)
    const nChunks = Math.ceil(cfg.ggufBytes / cfg.chunkBytes)
    let next = prefix / cfg.chunkBytes
    const firstChunk = next
    const finished = new Set<number>()
    let contiguous = firstChunk
    let got = prefix
    onProgress((got / cfg.ggufBytes) * dlShare, prefix ? `resuming download at ${Math.round(prefix / 1e6)} MB` : "downloading model from huggingface.co")
    // resolve the CDN URL once so each chunk skips the redirect
    let url = cfg.ggufUrl
    try {
      const probe = await fetch(cfg.ggufUrl, { headers: { Range: "bytes=0-0" }, signal })
      if (probe.status === 206 && probe.url) url = probe.url
      await probe.arrayBuffer()
    } catch { /* fall back to the canonical URL */ }
    const worker = async () => {
      for (;;) {
        if (signal?.aborted) throw new DOMException("aborted", "AbortError")
        const i = next++
        if (i >= nChunks) return
        const a = i * cfg.chunkBytes, b = Math.min(cfg.ggufBytes, a + cfg.chunkBytes) - 1
        let buf: Uint8Array
        try { buf = await fetchRange(url, a, b, signal) } catch { buf = await fetchRange(cfg.ggufUrl, a, b, signal) }
        sh.write(buf, { at: a })
        got += buf.length
        downloaded += buf.length
        finished.add(i)
        while (finished.has(contiguous)) contiguous++
        onProgress((got / cfg.ggufBytes) * dlShare, `downloading model: ${Math.round(got / 1e6)} of ${Math.round(cfg.ggufBytes / 1e6)} MB`)
        if (i % 4 === 0) { sh.flush(); await writeSmall(d, cfg.cacheKey + ".part", JSON.stringify({ done: Math.min(contiguous * cfg.chunkBytes, cfg.ggufBytes) })) }
      }
    }
    try {
      await Promise.all(Array.from({ length: cfg.concurrency }, worker))
    } catch (e) {
      try { sh.flush(); await writeSmall(d, cfg.cacheKey + ".part", JSON.stringify({ done: Math.min(contiguous * cfg.chunkBytes, cfg.ggufBytes) })) } catch { /* ignore */ }
      sh.close()
      throw e
    }
    sh.flush()
    if (sh.getSize() !== cfg.ggufBytes) { sh.close(); throw new Error(`downloaded ${sh.getSize()} bytes, expected ${cfg.ggufBytes}`) }
    await writeSmall(d, cfg.cacheKey + ".ok", String(cfg.ggufBytes))
    await writeSmall(d, cfg.cacheKey + ".part", JSON.stringify({ done: cfg.ggufBytes }))
  } else {
    onProgress(dlShare, "model found in this browser's cache")
  }
  const src: ByteSource = {
    size: cfg.ggufBytes,
    async read(offset, dst) { const n = sh.read(dst, { at: offset }); if (n !== dst.length) throw new Error(`cache read short: ${n}/${dst.length} at ${offset}`) },
  }
  return { src, tokenizerJson, cached: status.state === "complete", downloaded, close() { try { sh.close() } catch { /* already closed */ } } }
}
