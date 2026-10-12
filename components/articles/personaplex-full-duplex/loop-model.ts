// The truth behind the loop-deck figure: a pure model, no DOM. Every number
// here is the article's, read from NVIDIA/personaplex @ 3428dfd:
//   - context 3000 (loaders.py _lm_kwargs) and RingKVCache in
//     modules/transformer.py: the temporal transformer's KV cache is a ring of
//     3,000 frames, attention mask delta < context
//   - 12.5 frames a second, so one frame is 80 ms and the ring is 240 s
//   - step_system_prompts (lm.py): voice prompt, 6 frames of silence, the text
//     prompt one token per frame, 6 more frames of silence
//   - the NATF2 preset is 51 frames; the repo's customer-service test prompt
//     is 73 tokens with its <system> tags, so the prefill is 136 frames
//   - dep_q = 16 depth steps per frame; steps 8 to 15 predict the user's
//     codebooks and are discarded (683.7M of 8,371.4M parameters)

export const FRAME_MS = 80
export const CONTEXT = 3000
export const RING_SECONDS = (CONTEXT * FRAME_MS) / 1000 // 240
export const VOICE = 51
export const PAUSE = 6
export const TEXT = 73
export const TEXT_START = VOICE + PAUSE // 57
export const PREFILL = VOICE + PAUSE + TEXT + PAUSE // 136
export const DEP_Q = 16
export const KEPT = 8
export const EXTRA_PARAMS_M = 683.7
export const TOTAL_PARAMS_M = 8371.4
export const WASTED_SHARE = EXTRA_PARAMS_M / TOTAL_PARAMS_M // 0.0817

export type Kind = "voice" | "pause" | "text" | "call"

// What each absolute frame index holds.
export const SEGMENTS: { kind: Kind; from: number; to: number }[] = [
  { kind: "voice", from: 0, to: VOICE },
  { kind: "pause", from: VOICE, to: TEXT_START },
  { kind: "text", from: TEXT_START, to: TEXT_START + TEXT },
  { kind: "pause", from: TEXT_START + TEXT, to: PREFILL },
  { kind: "call", from: PREFILL, to: Infinity },
]

// `written` frames have gone through the record head (frames 0 .. written-1).
// The ring holds the newest CONTEXT of them; the rest have been written over.
export function inView(written: number) {
  const oldest = Math.max(0, written - CONTEXT)
  return SEGMENTS.map(({ kind, from, to }) => ({ kind, from: Math.max(from, oldest), to: Math.min(to, written) })).filter(({ from, to }) => to > from)
}

// Seconds into the call (the call starts at frame PREFILL) when frame `frame`
// is written.
export const callSeconds = (frame: number) => ((frame - PREFILL) * FRAME_MS) / 1000

// Frame 0 is written over by frame CONTEXT: 229 s into the call.
export const VOICE_LEAVES_AT = callSeconds(CONTEXT) // 229.12
// The last role-text frame goes when frame CONTEXT + its index is written:
// just short of 240 s.
export const TEXT_GONE_AT = callSeconds(CONTEXT + TEXT_START + TEXT - 1) // 239.44

export interface Stop {
  id: string
  name: string
  written: number
  depth: boolean
  readout: string
  does: string
}

export const STOPS: Stop[] = [
  {
    id: "voice",
    name: "Voice prompt",
    written: VOICE,
    depth: false,
    readout: `${VOICE} frames · voice prompt`,
    does: `The NATF2 voice preset, ${VOICE} frames of speech, is recorded onto the agent's own eight audio tracks while its text track holds PAD. The user's eight tracks carry the 440 Hz sine, drawn dotted.`,
  },
  {
    id: "text",
    name: "Role text",
    written: TEXT_START,
    depth: false,
    readout: `frame ${TEXT_START} · role text begins`,
    does: `${PAUSE} frames of silence, then the role text starts at frame ${TEXT_START}: one token per frame on the text track, the agent's audio held at silence.`,
  },
  {
    id: "call",
    name: "Call starts",
    written: PREFILL,
    depth: false,
    readout: `frame ${PREFILL} · the call begins`,
    does: `The ${TEXT}-token service prompt and ${PAUSE} more silent frames make ${PREFILL} frames of prefill. From here the head records one column of 17 tokens every ${FRAME_MS} ms: the agent's text and eight codebooks from the model, the user's eight from the microphone.`,
  },
  {
    id: "wrap",
    name: "Round again",
    written: CONTEXT + 1,
    depth: false,
    readout: `${Math.floor(VOICE_LEAVES_AT)} s into the call · voice prompt leaving`,
    does: `The loop holds ${CONTEXT.toLocaleString("en-US")} frames, ${RING_SECONDS} s. When the head comes round to the start of the tape it records over frame 0, and the voice prompt starts to leave attention ${Math.floor(VOICE_LEAVES_AT)} s into the call.`,
  },
  {
    id: "gone",
    name: "Prompt gone",
    written: CONTEXT + TEXT_START + TEXT,
    depth: false,
    readout: `just short of ${RING_SECONDS} s · role text gone`,
    does: `The last role-text token is recorded over just short of ${RING_SECONDS} s into the call. From then on the model sees only the conversation. Nothing in the repository pins the prompt frames or writes them again.`,
  },
  {
    id: "depth",
    name: "Depth steps",
    written: CONTEXT + TEXT_START + TEXT,
    depth: true,
    readout: `${KEPT} of ${DEP_Q} depth steps binned · ${(WASTED_SHARE * 100).toFixed(1)}%`,
    does: `Inside every frame the depth transformer steps ${DEP_Q} times. Steps 0 to 7 make the agent's eight codebooks. Steps 8 to 15 predict the user's, which the head takes from the microphone instead, so those predictions go in the bin: ${EXTRA_PARAMS_M}M of ${TOTAL_PARAMS_M.toLocaleString("en-US")}M parameters, ${(WASTED_SHARE * 100).toFixed(1)}% of the weights read every frame.`,
  },
]

export const REST_STOP = 2
