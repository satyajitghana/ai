"use client"

import { useState } from "react"

// Where Kokoro-82M's parameters sit, and where Paradee's went.
//
// Teacher per-stage counts: Paradee paper (arXiv 2610.06817), Appendix B, Table 7
//   ALBERT 6.3M, text encoder 5.6M, prosody predictor 16.2M, decoder AdaIN 33.6M,
//   generator 19.7M (+ a 0.4M projection after ALBERT, 81.8M total).
// Teacher FLOP shares (55 GFLOP per second of audio): paper Figure 2 —
//   text side 8%, AdaIN blocks 3%, generator 89%.
// Teacher widths: hexgrad/Kokoro-82M config.json (plbert hidden 768, 12 heads,
//   intermediate 2048, 12 layers; hidden_dim 512; style_dim 128;
//   upsample_initial_channel 512) and the paper (AdaIN blocks at 1024 channels).
//
// Student counts: read from the released checkpoints
//   sahilmahendrakar/Paradee-8M-v1.0 pytorch/text_side.pt and pytorch/decoder.pt,
//   tensor shapes summed per module (position_ids buffer excluded):
//   bert.* + bert_encoder 895,424 (65,792 of it is ALBERT's pooler, never called)
//   predictor.* 2,162,740 · text_encoder.* 812,160 · asr_proj (MLP) 361,472 · style 32
//   decoder encode/decode/asr_res/F0/N/style 2,662,604 · generator.* 1,185,974
//   => 4,231,828 + 3,848,578 = 8,080,406 (9,050 of it weight-norm gains; folded, 8,071,356).
// Student widths: training/scripts/student.py PRESETS["s"] = (256, 6, 4, 192, 32, 3)
//   and student_decoder.py DEC_PRESETS["A"] = (256, 128, [3, 7, 11]).

const TEACH = "oklch(0.62 0.04 250)"
const STUD = "oklch(0.62 0.16 155)"
const HOT = "oklch(0.66 0.17 45)"

type Stage = {
  id: string
  name: string
  half: "front" | "text" | "decoder" | "post"
  teacher: number // parameters
  student: number
  flops?: string
  teacherShape: string
  studentShape: string
  note: string
}

const STAGES: Stage[] = [
  {
    id: "g2p",
    name: "misaki G2P",
    half: "front",
    teacher: 0,
    student: 0,
    teacherShape: "dictionary lookup + spaCy tagger, eSpeak NG fallback",
    studentShape: "identical: Paradee reuses Kokoro's front end unchanged",
    note: "Not part of either model. The English dictionaries in the misaki wheel are 6.1 MB of JSON, and the install also pulls spaCy, an English spaCy model and eSpeak NG.",
  },
  {
    id: "albert",
    name: "Phoneme ALBERT",
    half: "text",
    teacher: 6_300_000,
    student: 895_424,
    teacherShape: "768 hidden · 12 heads · 2048 FFN · 12 layers, one shared block",
    studentShape: "256 hidden · 4 heads · 768 FFN · 6 layers, one shared block",
    note: "ALBERT shares one block across all its layers, so cutting 12 layers to 6 saves nothing. Width is what costs. 65,792 of the student's count is the pooler, which nothing calls.",
  },
  {
    id: "prosody",
    name: "Prosody predictor",
    half: "text",
    teacher: 16_200_000,
    student: 2_162_740,
    teacherShape: "512 hidden · style 128 · 3 LSTM layers · F0/energy/duration heads",
    studentShape: "192 hidden · learned constant style of 32 · 3 layers",
    note: "The largest piece of the text side in both models. The voice input is gone: one learned 32-number vector replaces the style vector Kokoro looks up per voice and per utterance length.",
  },
  {
    id: "textenc",
    name: "Text encoder",
    half: "text",
    teacher: 5_600_000,
    student: 1_173_632,
    teacherShape: "512 channels, CNN + LSTM",
    studentShape: "192 channels + a 2-layer MLP back up to 512 (361,472 params)",
    note: "The decoder expects 512-channel phoneme features. A linear 192-to-512 projection capped UTMOS at 4.15; the small MLP lifted it to 4.36.",
  },
  {
    id: "adain",
    name: "AdaIN decoder blocks",
    half: "decoder",
    teacher: 33_600_000,
    student: 2_662_604,
    flops: "3%",
    teacherShape: "1024 channels",
    studentShape: "256 channels",
    note: "The biggest block in Kokoro by parameters and almost free in compute. Quarter width would cut a convolution to a sixteenth. The blocks came out 12.6 times smaller instead, because the first one still reads the full 512-channel phoneme features.",
  },
  {
    id: "gen",
    name: "iSTFTNet generator",
    half: "decoder",
    teacher: 19_700_000,
    student: 1_185_974,
    flops: "89%",
    teacherShape: "512 initial channels · kernels 3, 7, 11 · upsample 10 x 6 · iSTFT n_fft 20, hop 5",
    studentShape: "128 initial channels · same kernels, upsampling, excitation and iSTFT head",
    note: "A quarter of Kokoro's parameters and 89% of its arithmetic, because its last stages run at 60 times the frame rate. Shrinking this is what makes the student fast.",
  },
  {
    id: "lock",
    name: "Phase-locking filter",
    half: "post",
    teacher: 0,
    student: 0,
    teacherShape: "not present",
    studentShape: "no parameters · 2-8 kHz, voiced frames, 33-frame smoothing",
    note: "Added after the decoder to remove a buzz. It costs about 5% of run time and no weights; the int8 file even rebuilds its DFT tables at load time instead of storing them.",
  },
]

const MAX = 33_600_000
const fmt = (n: number) => (n === 0 ? "0" : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${(n / 1e3).toFixed(0)}K`)

const HALF_LABEL: Record<Stage["half"], string> = {
  front: "before the model",
  text: "text side",
  decoder: "decoder",
  post: "after the model",
}

export function ParamMap() {
  const [sel, setSel] = useState("gen")
  const [view, setView] = useState<"both" | "student">("both")
  const s = STAGES.find((x) => x.id === sel) ?? STAGES[5]
  const tTot = 81_800_000
  const sTot = 8_080_406
  const scale = view === "student" ? 2_662_604 : MAX

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Kokoro-82M {fmt(tTot)} → Paradee {fmt(sTot)}, stage by stage
        </span>
        <div className="flex gap-1 font-mono text-[11px]">
          {(
            [
              ["both", "teacher vs student"],
              ["student", "student, zoomed"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-md border px-2 py-0.5 ${view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <ol className="space-y-1.5">
          {STAGES.map((st) => {
            const active = st.id === sel
            const tw = view === "both" ? (st.teacher / scale) * 100 : 0
            const sw = Math.min(100, (st.student / scale) * 100)
            return (
              <li key={st.id}>
                <button
                  type="button"
                  onClick={() => setSel(st.id)}
                  aria-pressed={active}
                  className={`grid w-full grid-cols-[8.5rem_1fr] items-center gap-2 rounded-md px-2 py-1.5 text-left sm:grid-cols-[11rem_1fr] ${active ? "bg-muted/60 ring-1 ring-border" : "hover:bg-muted/30"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{st.name}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {HALF_LABEL[st.half]}
                      {st.flops ? ` · ${st.flops} of Kokoro's FLOPs` : ""}
                    </span>
                  </span>
                  <span className="min-w-0 space-y-0.5">
                    {view === "both" && (
                      <span className="flex items-center gap-2">
                        <span
                          className="block h-2.5 rounded-sm"
                          style={{ width: `${tw.toFixed(2)}%`, minWidth: st.teacher ? 2 : 0, background: TEACH }}
                        />
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {st.teacher ? fmt(st.teacher) : st.id === "lock" ? "n/a" : "0"}
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-2">
                      <span
                        className="block h-2.5 rounded-sm"
                        style={{
                          width: `${sw.toFixed(2)}%`,
                          minWidth: st.student ? 2 : 0,
                          background: st.id === "gen" ? HOT : STUD,
                        }}
                      />
                      <span className="shrink-0 font-mono text-[10px]">
                        {st.student ? fmt(st.student) : "0 params"}
                        {st.teacher && st.student && view === "both"
                          ? ` · ${(st.teacher / st.student).toFixed(1)}x smaller`
                          : ""}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="mt-3 rounded-lg border bg-background/60 p-3 text-[13px] leading-relaxed">
          <div className="font-medium">{s.name}</div>
          <div className="mt-1 grid gap-1 font-mono text-[11px] sm:grid-cols-2">
            <span>
              <span style={{ color: TEACH }}>Kokoro</span> · {s.teacherShape}
            </span>
            <span>
              <span style={{ color: STUD }}>Paradee</span> · {s.studentShape}
            </span>
          </div>
          <p className="mt-2 text-muted-foreground">{s.note}</p>
        </div>

        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          grey: Kokoro-82M (paper, Table 7) · green: Paradee, summed from the released checkpoints ·
          orange: the generator, where the compute is. Bars share one linear scale
          {view === "student" ? ", rescaled to the student's largest stage" : ""}.
        </p>
      </div>
    </figure>
  )
}
