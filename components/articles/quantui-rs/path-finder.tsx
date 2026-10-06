"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Which code path a quantui-rs invocation takes, what it writes, and what the
// bytes are actually pinned to. Every row is transcribed from source:
//
//  - blobs: comfy_schema.rs encode_standard / encode_comfy_quant_int8_rowwise /
//    encode_comfy_quant_int8_convrot / encode_block_format, dispatched from
//    stream.rs:1188-1199 (INT8) and :1246-1251 (FP8). Default --format int8,
//    --scaling-mode block, --block-size 128 (commands/quantize.rs:43-44, 138-139).
//  - ComfyUI: QUANT_ALGOS in comfy/quant_ops.py:211-264 and the unguarded
//    QUANT_ALGOS[module.quant_format] lookup in comfy/ops.py:1211, ComfyUI
//    master at 0b5b009 (2026-10-06).
//  - GGUF: gguf_convert.rs:1063-1076 and :1190-1290 (weighted ports only when an
//    imatrix row exists, otherwise rlx_gguf::quantize), commands/gguf.rs:235-293
//    (iq* refused without --imatrix; the K-quant warning), tests/gguf_parity.rs
//    and tests/gguf_unweighted_parity.rs headers (what each path is pinned to),
//    tools/build_llamacpp.sh (the llama-quantize oracle: MSVC, GGML_FMA=OFF).

type Verdict = "loads" | "keyerror" | "silent" | "n/a"
type Row = {
  blob?: string
  comfy: Verdict
  comfyNote: string
  pinned: string
  note: string
}

const ORIG = `"orig_dtype": "torch.bfloat16"`

const QUANTIZE: Record<string, Record<string, Row>> = {
  int8: {
    block: {
      blob: `{"format": "int8_blockwise", ${ORIG}, "group_size": 128}`,
      comfy: "keyerror",
      comfyNote: "int8_blockwise is not a key of QUANT_ALGOS, and ops.py:1211 indexes it with no .get()",
      pinned: "convert_to_quant --simple, through the reference streaming quantizer (whole-file bytes)",
      note: "This is what quantui-rs writes when you pass no flags at all. Its own test file calls it a real, currently-unflagged incompatibility.",
    },
    row: {
      blob: `{"format": "int8_tensorwise", ${ORIG}, "per_row": true}`,
      comfy: "loads",
      comfyNote: "int8_tensorwise is registered (quant_ops.py:238)",
      pinned: "convert_to_quant --simple (row mode keeps torch's scalar·reciprocal division, 1 ULP off IEEE)",
      note: "One F32 scale per output row. Any shape works, no padding.",
    },
    tensor: {
      blob: `{"format": "int8_tensorwise", ${ORIG}}`,
      comfy: "loads",
      comfyNote: "int8_tensorwise is registered (quant_ops.py:238)",
      pinned: "convert_to_quant --simple",
      note: "One scale for the whole matrix: the smallest file, the coarsest grid.",
    },
  },
  int8_convrot: {
    row: {
      blob: `{"format": "int8_tensorwise", ${ORIG}, "convrot": true, "convrot_groupsize": 256, "per_row": true}`,
      comfy: "loads",
      comfyNote: "ops.py:1237-1241 reads convrot and convrot_groupsize, so the loader knows to rotate activations",
      pinned: "convert_to_quant's ConvRot path (Hadamard GEMM reproduced with oneDNN's 128-wide K chunks)",
      note: "Row-wise INT8 after a group-256 regular Hadamard rotation. Layers whose in_features is not a multiple of 256 fall back to plain row INT8.",
    },
  },
  fp8_e4m3: {
    block: {
      blob: `{"format": "float8_e4m3fn_blockwise", ${ORIG}, "group_size": 128}`,
      comfy: "keyerror",
      comfyNote: "float8_e4m3fn_blockwise is not a QUANT_ALGOS key",
      pinned: "convert_to_quant --simple, per tensor",
      note: "FP8 also defaults to block scaling, so the FP8 default has the same problem as the INT8 one.",
    },
    row: {
      blob: `{"format": "float8_e4m3fn_rowwise", ${ORIG}}`,
      comfy: "keyerror",
      comfyNote: "float8_e4m3fn_rowwise is not a QUANT_ALGOS key",
      pinned: "convert_to_quant --simple, per tensor",
      note: "Same story: a format string from convert_to_quant's registry that stock ComfyUI does not register.",
    },
    tensor: {
      blob: `{"format": "float8_e4m3fn", ${ORIG}}`,
      comfy: "loads",
      comfyNote: "float8_e4m3fn is registered (quant_ops.py:212)",
      pinned: "convert_to_quant --simple, per tensor",
      note: "The only FP8 scaling mode stock ComfyUI recognises.",
    },
  },
  mxfp8: {
    fixed: {
      blob: `{"format": "mxfp8", "group_size": 32, ${ORIG}, "orig_shape": [m, n]}`,
      comfy: "loads",
      comfyNote: "registered only when comfy-kitchen reports MXFP8 support (quant_ops.py:230-236)",
      pinned: "comfy-kitchen's eager quantize_mxfp8, per tensor",
      note: "32-element blocks, one power-of-two E8M0 exponent each, scales pre-swizzled into the cuBLAS tiled layout.",
    },
  },
  nvfp4: {
    fixed: {
      blob: `{"format": "nvfp4", "group_size": 16, ${ORIG}, "orig_shape": [m, n]}`,
      comfy: "loads",
      comfyNote: "registered (quant_ops.py:222), needs comfy-kitchen",
      pinned: "comfy-kitchen's eager quantize_nvfp4 on CPU (goldens must be made with CUDA hidden)",
      note: "Even element in the high nibble. ModelOpt packs the other way round, so this file is not a ModelOpt checkpoint.",
    },
  },
  nvfp4_l2: {
    fixed: {
      blob: `{"format": "nvfp4", "group_size": 16, ${ORIG}, "orig_shape": [m, n]}`,
      comfy: "loads",
      comfyNote: "same blob as nvfp4; the loader cannot tell them apart, and does not need to",
      pinned: "nothing: the run prints parity: quality-tuned",
      note: "Per-block search over ±4 E4M3 codes plus a least-squares refit of the tensor scale. Scored on weight error only.",
    },
  },
  nvfp4_rot16: {
    fixed: {
      blob: `{"format": "nvfp4", "group_size": 16, ${ORIG}, "orig_shape": [m, n]}`,
      comfy: "silent",
      comfyNote: "loads as plain nvfp4: the blob has no rotation key, so nothing rotates the activations",
      pinned: "the run prints parity: exact, because the quantizer itself is unchanged",
      note: "The weights are multiplied by a 16-wide Hadamard before quantizing. Without the inverse on the activation side the layer computes the wrong product.",
    },
  },
}

const GGUF: Record<string, Record<string, Row>> = {
  "q8_0 / f16": {
    none: {
      comfy: "n/a",
      comfyNote: "",
      pinned: "gguf-py's quantizer, byte for byte (rlx-gguf; 49/49 golden cases)",
      note: "Legacy formats have no scale search to disagree about, so any correct implementation lands on the same bytes.",
    },
  },
  q4_k_m: {
    none: {
      comfy: "n/a",
      comfyNote: "",
      pinned: "a regression pin of its own output only (rlx-gguf 0.2.14's plain min/max per sub-block)",
      note: "The default gguf run. llama.cpp's unweighted Q4_K runs a 20-step scale search (make_qkx2_quants); this does not, and the CLI warns about it.",
    },
    imatrix: {
      comfy: "n/a",
      comfyNote: "",
      pinned: "llama-quantize given the same imatrix (a port of quantize_row_q4_K_impl, make_qkx3_quants with 36 steps)",
      note: "attn_v and ffn_down go to Q6_K on the use_more_bits layers, as in llama.cpp. The oracle binary was built with MSVC and FMA off.",
    },
    uniform: {
      comfy: "n/a",
      comfyNote: "",
      pinned: "llama-quantize given that same all-ones imatrix, which is not llama-quantize with no imatrix",
      note: "The README's workaround. The all-ones file comes from a Python script that reads tensor names out of a GGUF you have already made.",
    },
  },
  iq4_xs: {
    none: {
      comfy: "n/a",
      comfyNote: "",
      pinned: "nothing: refused with exit 2",
      note: "quantui-rs requires --imatrix for every iq* method. llama.cpp only requires one for IQ1, IQ2 and IQ3_XXS; IQ4_XS without one falls back to x² weights.",
    },
    imatrix: {
      comfy: "n/a",
      comfyNote: "",
      pinned: "llama-quantize given the same imatrix (a port of quantize_row_iq4_nl_impl with ntry = 7)",
      note: "256-weight super-blocks, eight 6-bit sub-scales, codes on the 16-value non-uniform kvalues_iq4nl grid.",
    },
  },
}

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  loads: { label: "stock ComfyUI recognises the format", cls: "text-emerald-700 dark:text-emerald-400" },
  keyerror: { label: "stock ComfyUI raises KeyError at load", cls: "text-rose-700 dark:text-rose-400" },
  silent: { label: "loads, then computes the wrong thing", cls: "text-amber-700 dark:text-amber-400" },
  "n/a": { label: "", cls: "" },
}

function Pills<T extends string>({ items, value, onChange }: { items: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button key={it} type="button" onClick={() => onChange(it)}
          className={cn(
            "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30",
            it === value && "bg-muted/40 text-foreground"
          )}>
          {it}
        </button>
      ))}
    </div>
  )
}

export function PathFinder() {
  const [cmd, setCmd] = useState<"quantize" | "gguf">("quantize")
  const [qfmt, setQfmt] = useState("int8")
  const [qmode, setQmode] = useState("block")
  const [gm, setGm] = useState("q4_k_m")
  const [gi, setGi] = useState("none")

  const modes = Object.keys(QUANTIZE[qfmt])
  const mode = modes.includes(qmode) ? qmode : modes[0]
  const gModes = Object.keys(GGUF[gm])
  const gMode = gModes.includes(gi) ? gi : gModes[0]
  const row = cmd === "quantize" ? QUANTIZE[qfmt][mode] : GGUF[gm][gMode]

  const flags =
    cmd === "quantize"
      ? `quantui-rs quantize model.safetensors${qfmt === "int8" ? "" : ` --format ${qfmt}`}${
          mode === "fixed" || (qfmt === "int8_convrot") || mode === "block" ? "" : ` -m ${mode}`
        }`
      : `quantui-rs gguf model.safetensors -m ${gm === "q8_0 / f16" ? "q8_0" : gm}${
          gMode === "imatrix" ? " --imatrix imatrix.gguf" : gMode === "uniform" ? " --imatrix uniform.imatrix" : ""
        }`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">which path did your bytes take?</span>
        <span className="font-mono text-[11px] text-muted-foreground">quantui-rs d2cced6 · ComfyUI 0b5b009</span>
      </div>
      <div className="space-y-2 p-3 sm:p-4">
        <Pills items={["quantize", "gguf"] as ("quantize" | "gguf")[]} value={cmd} onChange={setCmd} />
        {cmd === "quantize" ? (
          <>
            <Pills items={Object.keys(QUANTIZE)} value={qfmt} onChange={setQfmt} />
            {modes.length > 1 && <Pills items={modes} value={mode} onChange={setQmode} />}
          </>
        ) : (
          <>
            <Pills items={Object.keys(GGUF)} value={gm} onChange={setGm} />
            {gModes.length > 1 && <Pills items={gModes} value={gMode} onChange={setGi} />}
          </>
        )}

        <pre className="mt-3 overflow-x-auto rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px]">$ {flags}</pre>

        <dl className="mt-2 space-y-2.5 font-mono text-[11px]">
          {row.blob && (
            <div>
              <dt className="text-muted-foreground">.comfy_quant blob written per layer</dt>
              <dd className="break-all">{row.blob}</dd>
            </div>
          )}
          {row.comfy !== "n/a" && (
            <div>
              <dt className="text-muted-foreground">ComfyUI loader</dt>
              <dd>
                <span className={cn("font-semibold", VERDICT[row.comfy].cls)}>{VERDICT[row.comfy].label}</span>
                <span className="text-muted-foreground">{" "}({row.comfyNote})</span>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">bytes are pinned to</dt>
            <dd>{row.pinned}</dd>
          </div>
        </dl>
        <p className="pt-1 text-[13px] leading-relaxed text-muted-foreground">{row.note}</p>
      </div>
    </figure>
  )
}
