"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Each README claim of solidsf-inc/ssftalk (commit eb7722a, 18 Oct 2026), what the
// code at that commit does, and what we measured. "Measured" rows come from reading
// the files or from our own Python ports of the visible functions (codec.rs,
// mechinterp.rs), run on a shared 4-core cloud VM on 19 Oct 2026. "Hidden" rows sit
// in the four modules that build.rs decrypts from assets/ssftalk_moat_vault.bin; we
// did not decrypt, build or run them, so they are neither confirmed nor refuted.

type Verdict = "holds" | "hidden" | "fails"

type Row = {
  claim: string
  code: string
  found: string
  file: string
  verdict: Verdict
}

const ROWS: Row[] = [
  {
    claim: "j128: 15 samples to 10 bytes, exactly 16,000 B/s, over 28 dB speech SNR",
    code: "A 4-mode block ADPCM: 2-byte first sample, 1 header byte (predictor, scale), 14 four-bit residuals.",
    found: "Our port: 16,000 B/s on every clip; SNR 30.9 to 39.9 dB on three 4 s speech clips.",
    file: "src/codec.rs",
    verdict: "holds",
  },
  {
    claim: "265.5x geomean speedup over cloud TTS, Flash v2.5, Demucs, WhisperX and a dense audio-LLM",
    code: "Every baseline is a constant typed into the example (420,000.0, 75,000.0, 95,000.0 ...). No competitor runs.",
    found: "The 265.5 follows from the README's own table. It divides measured time into typed numbers.",
    file: "examples/full_suite_benchmark.rs",
    verdict: "fails",
  },
  {
    claim: "100% API parity with ElevenLabs v1, including mp3_44100_128",
    code: "The mp3 formats write an MPEG sync word, the tag SSFM, a length and a j128 payload. No MP3 frames.",
    found: "An MP3 decoder cannot play it. Request and response structs and paths do match the v1 shapes.",
    file: "src/codec.rs",
    verdict: "fails",
  },
  {
    claim: "Cut GPT-4o Realtime and Gemini Live audio KV-cache cost by 88.0%",
    code: "An amplitude gate over 480-sample frames. No model, no KV cache. 480/64 rounds to 7 words, so windows are 448 samples.",
    found: "88.0% is the gate on a test second that is 90% digital zero, plus the rounding. Real speech: 13.5 to 21.3%.",
    file: "src/mechinterp.rs",
    verdict: "fails",
  },
  {
    claim: "Match 256-bit Sparse Autoencoder voice circuits in hardware",
    code: "Hamming-distance argmin over 256-bit codes, on the CPU. The benchmark's 256 atoms are products of four constants.",
    found: "No SAE is trained or loaded, and no model activations exist to encode.",
    file: "src/mechinterp.rs, src/hardware.rs",
    verdict: "fails",
  },
  {
    claim: "Instant zero-shot voice clone: F0, 4 formants, breathiness",
    code: "F0 by autocorrelation on one 2,048-sample window. Formants are a fixed template scaled by (F0/165)^0.35.",
    found: "Formants are not measured from the audio. A voice is six numbers.",
    file: "src/voices.rs",
    verdict: "fails",
  },
  {
    claim: "64-D auditable signature, self-cos 1.000000",
    code: "Five coordinates are constants (0.875, 0.75, 0.9375, 1.0, 0.625); three are bits of a hash of the samples.",
    found: "Self-cosine is a vector compared with itself; it is 1 for any vector.",
    file: "src/mechinterp.rs",
    verdict: "fails",
  },
  {
    claim: "Cloud binary WebSocket at wss://api.solidsf.com",
    code: "The client strips wss:// and opens a plain TCP socket. The crate has no TLS code, and the default URL names no port.",
    found: "As written the default cannot connect; with a port it would send the Bearer key in clear text.",
    file: "src/cloud_ws.rs",
    verdict: "fails",
  },
  {
    claim: "112x real-time 24 kHz synthesis, 40.8 ms for 4.56 s",
    code: "The synthesizer, prosody predictor and streamer are in the encrypted vault.",
    found: "Not run. The arithmetic is consistent: 4.56 / 0.0408 is about 112.",
    file: "src/vocoder.rs (vault)",
    verdict: "hidden",
  },
  {
    claim: "Scribe ASR with diarization, 1.94 us",
    code: "Implemented in the vault. Every call site hands it the transcript as a hint; tests assert the hint's word count.",
    found: "Not run. No test transcribes audio it was not told the words of.",
    file: "src/sts_isolate.rs (vault)",
    verdict: "hidden",
  },
  {
    claim: "Audio isolation +21.9 dB versus Demucs",
    code: "Implemented in the vault. The benchmark's noise is a single sine (0.045 sin(0.15 n)) added to synthetic speech.",
    found: "Not run. A pure tone is the easiest noise there is.",
    file: "src/sts_isolate.rs (vault)",
    verdict: "hidden",
  },
]

const LABEL: Record<Verdict, string> = { holds: "holds", hidden: "hidden, not run", fails: "does not hold" }
const TONE: Record<Verdict, string> = {
  holds: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
  hidden: "border-amber-600/40 text-amber-700 dark:text-amber-400",
  fails: "border-rose-600/40 text-rose-700 dark:text-rose-400",
}

export function ClaimsLedger() {
  const [filter, setFilter] = useState<Verdict | "all">("all")
  const rows = filter === "all" ? ROWS : ROWS.filter((r) => r.verdict === filter)
  const count = (v: Verdict) => ROWS.filter((r) => r.verdict === v).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5" role="group" aria-label="Filter by verdict">
        {(["all", "holds", "hidden", "fails"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            aria-pressed={filter === v}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-1 font-mono text-xs transition-colors",
              filter === v ? "border-foreground/40 bg-muted/50" : "border-border text-muted-foreground hover:bg-muted/20",
            )}
          >
            {v === "all" ? `all ${ROWS.length}` : `${LABEL[v]} ${count(v)}`}
          </button>
        ))}
      </div>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.claim} className="space-y-1.5 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug">{r.claim}</p>
              <span className={cn("shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase", TONE[r.verdict])}>
                {LABEL[r.verdict]}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-mono text-foreground/70">code</span>{" "}
              {r.code}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-mono text-foreground/70">found</span>{" "}
              {r.found}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">{r.file}</p>
          </li>
        ))}
      </ul>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        README claims of ssftalk at commit eb7722a against its code. Measured by reading the files and by our own
        Python ports of the visible codec and pruning functions; vault modules were not decrypted or run.
      </figcaption>
    </figure>
  )
}
