// Generated from my own runs of llama-server (llama.cpp commit d7a695e, CPU build),
// 6 October 2026. Token pieces come from the server's /tokenize endpoint on the
// prompts its systemone templates render; costs are the bench script's medians.
// Do not edit by hand.

export const ANATOMY = {"kev": {"route": ["<|fim_prefix|>", "Customer", " message", ":", " I", " was", " charged", " twice", " for", " my", " order", " last", " week", " and", " nobody", " has", " replied", ".", "<|fim_middle|>", "Which", " team", " should", " handle", " this", "?", "<|box_start|>", "billing", ":", " payments", ",", " charges", ",", " refunds", ",", " invoices", "<|box_end|>", "<|box_start|>", "shipping", ":", " delivery", ",", " tracking", ",", " lost", " or", " late", " parcels", "<|box_end|>", "<|box_start|>", "technical", ":", " bugs", ",", " errors", ",", " login", " problems", "<|box_end|>", "<|fim_suffix|>"], "angry": ["<|fim_prefix|>", "Customer", " message", ":", " I", " was", " charged", " twice", " for", " my", " order", " last", " week", " and", " nobody", " has", " replied", ".", "<|fim_middle|>", "Is", " the", " customer", " angry", "?", "<|box_start|>", "no", "<|box_end|>", "<|box_start|>", "yes", "<|box_end|>", "<|fim_suffix|>"], "urgency": ["<|fim_prefix|>", "Customer", " message", ":", " I", " was", " charged", " twice", " for", " my", " order", " last", " week", " and", " nobody", " has", " replied", ".", "<|fim_middle|>", "How", " urgent", " is", " this", "?", "<|box_start|>", "can", " wait", "<|box_end|>", "<|box_start|>", "this", " week", "<|box_end|>", "<|box_start|>", "today", "<|box_end|>", "<|box_start|>", "right", " now", "<|box_end|>", "<|fim_suffix|>"]}, "julia": {"route": ["<bos>", " choice", " question", ":", " Which", " team", " should", " handle", " this", "?", "<eos>", "<mask>", " payments", ",", " charges", ",", " refunds", ",", " invoices", "<mask>", " delivery", ",", " tracking", ",", " lost", " or", " late", " parcels", "<mask>", " bugs", ",", " errors", ",", " login", " problems", "<eos>", " Customer", " message", ":", " I", " was", " charged", " twice", " for", " my", " order", " last", " week", " and", " nobody", " has", " replied", ".", "<eos>"], "angry": ["<bos>", " n", "oul", " question", ":", " Is", " the", " customer", " angry", "?", "<eos>", "<mask>", " false", "<mask>", " true", "<eos>", " Customer", " message", ":", " I", " was", " charged", " twice", " for", " my", " order", " last", " week", " and", " nobody", " has", " replied", ".", "<eos>"], "urgency": ["<bos>", " score", " question", ":", " How", " urgent", " is", " this", "?", "<eos>", "<mask>", " can", " wait", "<mask>", " this", " week", "<mask>", " today", "<mask>", " right", " now", "<eos>", " Customer", " message", ":", " I", " was", " charged", " twice", " for", " my", " order", " last", " week", " and", " nobody", " has", " replied", ".", "<eos>"]}, "lev": {"route_v0": ["<|im_start|>", "system", "\n", "You", " are", " a", " System", " One", " decision", " model", ".", " You", " read", " the", " Evidence", " and", " answer", " each", " Criterion", " by", " choosing", " exactly", " one", " of", " the", " listed", " options", ".", " You", " never", " explain", ".", " You", " answer", " with", " the", " single", " option", " label", " only", ".", "<|im_end|>", "\n", "<|im_start|>", "user", "\n", "#", " Evidence", "\n", "Customer", " message", ":", " I", " was", " charged", " twice", " for", " my", " order", " last", " week", " and", " nobody", " has", " replied", ".", "\n\n", "#", " Criterion", "\n", "Which", " team", " should", " handle", " this", "?", "\n\n", "#", " Options", "\n", "A", ".", " billing", ":", " payments", ",", " charges", ",", " refunds", ",", " invoices", "\n", "B", ".", " shipping", ":", " delivery", ",", " tracking", ",", " lost", " or", " late", " parcels", "\n", "C", ".", " technical", ":", " bugs", ",", " errors", ",", " login", " problems", "\n\n", "Respond", " with", " only", " the", " letter", " of", " the", " best", " option", ".", "\n", "<|im_end|>", "\n", "<|im_start|>", "assistant", "\n", "<think>", "\n\n", "</think>", "\n\n"], "route_v1": ["<|im_start|>", "system", "\n", "You", " are", " a", " System", " One", " decision", " model", ".", " You", " read", " the", " Evidence", " and", " answer", " each", " Criterion", " by", " choosing", " exactly", " one", " of", " the", " listed", " options", ".", " You", " never", " explain", ".", " You", " answer", " with", " the", " single", " option", " label", " only", ".", "<|im_end|>", "\n", "<|im_start|>", "user", "\n", "#", " Evidence", "\n", "Customer", " message", ":", " I", " was", " charged", " twice", " for", " my", " order", " last", " week", " and", " nobody", " has", " replied", ".", "\n\n", "#", " Criterion", "\n", "Which", " team", " should", " handle", " this", "?", "\n\n", "#", " Options", "\n", "A", ".", " technical", ":", " bugs", ",", " errors", ",", " login", " problems", "\n", "B", ".", " shipping", ":", " delivery", ",", " tracking", ",", " lost", " or", " late", " parcels", "\n", "C", ".", " billing", ":", " payments", ",", " charges", ",", " refunds", ",", " invoices", "\n\n", "Respond", " with", " only", " the", " letter", " of", " the", " best", " option", ".", "\n", "<|im_end|>", "\n", "<|im_start|>", "assistant", "\n", "<think>", "\n\n", "</think>", "\n\n"], "angry": ["<|im_start|>", "system", "\n", "You", " are", " a", " System", " One", " decision", " model", ".", " You", " read", " the", " Evidence", " and", " answer", " each", " Criterion", " by", " choosing", " exactly", " one", " of", " the", " listed", " options", ".", " You", " never", " explain", ".", " You", " answer", " with", " the", " single", " option", " label", " only", ".", "<|im_end|>", "\n", "<|im_start|>", "user", "\n", "#", " Evidence", "\n", "Customer", " message", ":", " I", " was", " charged", " twice", " for", " my", " order", " last", " week", " and", " nobody", " has", " replied", ".", "\n\n", "#", " Criterion", "\n", "Is", " the", " customer", " angry", "?", "\n\n", "#", " Scale", "\n", "0", " =", " certainly", " no", " ...", " ", "8", " =", " certainly", " yes", "\n\n", "Respond", " with", " only", " a", " digit", " from", " ", "0", " to", " ", "8", ".", "\n", "<|im_end|>", "\n", "<|im_start|>", "assistant", "\n", "<think>", "\n\n", "</think>", "\n\n"], "urgency": ["<|im_start|>", "system", "\n", "You", " are", " a", " System", " One", " decision", " model", ".", " You", " read", " the", " Evidence", " and", " answer", " each", " Criterion", " by", " choosing", " exactly", " one", " of", " the", " listed", " options", ".", " You", " never", " explain", ".", " You", " answer", " with", " the", " single", " option", " label", " only", ".", "<|im_end|>", "\n", "<|im_start|>", "user", "\n", "#", " Evidence", "\n", "Customer", " message", ":", " I", " was", " charged", " twice", " for", " my", " order", " last", " week", " and", " nobody", " has", " replied", ".", "\n\n", "#", " Criterion", "\n", "How", " urgent", " is", " this", "?", "\n\n", "#", " Options", "\n", "A", ".", " (", "level", " ", "0", " of", " ", "3", ")", " can", " wait", "\n", "B", ".", " (", "level", " ", "1", " of", " ", "3", ")", " this", " week", "\n", "C", ".", " (", "level", " ", "2", " of", " ", "3", ")", " today", "\n", "D", ".", " (", "level", " ", "3", " of", " ", "3", ")", " right", " now", "\n\n", "Respond", " with", " only", " the", " letter", " of", " the", " level", " that", " best", " matches", ".", "\n", "<|im_end|>", "\n", "<|im_start|>", "assistant", "\n", "<think>", "\n\n", "</think>", "\n\n"]}} as const

export type CostRow = { x: number; input?: number; processed?: number; cached?: number; ms?: number; msMin?: number; error?: string }

export const COST: Record<string, Record<string, CostRow[]>> = {
 "kev": {
  "opts": [
   {
    "x": 2,
    "input": 70,
    "processed": 70,
    "cached": 0,
    "ms": 431.0,
    "msMin": 344.6
   },
   {
    "x": 4,
    "input": 90,
    "processed": 90,
    "cached": 0,
    "ms": 610.3,
    "msMin": 469.8
   },
   {
    "x": 8,
    "input": 126,
    "processed": 126,
    "cached": 0,
    "ms": 807.9,
    "msMin": 719.0
   },
   {
    "x": 16,
    "input": 229,
    "processed": 229,
    "cached": 0,
    "ms": 1752.0,
    "msMin": 1501.9
   },
   {
    "x": 32,
    "input": 437,
    "processed": 437,
    "cached": 0,
    "ms": 3246.0,
    "msMin": 3033.5
   },
   {
    "x": 64,
    "error": "the question and its options (797 tokens) are too large to process. increase the batch size (current batch size: 512)"
   }
  ],
  "qs": [
   {
    "x": 1,
    "input": 398,
    "processed": 398,
    "cached": 0,
    "ms": 2876.6,
    "msMin": 2628.5
   },
   {
    "x": 2,
    "input": 800,
    "processed": 448,
    "cached": 352,
    "ms": 3485.3,
    "msMin": 3021.0
   },
   {
    "x": 4,
    "input": 1604,
    "processed": 548,
    "cached": 1056,
    "ms": 4139.3,
    "msMin": 3415.7
   },
   {
    "x": 8,
    "input": 3212,
    "processed": 1094,
    "cached": 2118,
    "ms": 8981.0,
    "msMin": 8111.5
   }
  ],
  "qs1": [
   {
    "x": 1,
    "input": 398,
    "processed": 398,
    "cached": 0,
    "ms": 3599.6,
    "msMin": 3341.9
   },
   {
    "x": 2,
    "input": 800,
    "processed": 800,
    "cached": 0,
    "ms": 11209.7,
    "msMin": 7918.6
   },
   {
    "x": 4,
    "input": 1604,
    "processed": 1604,
    "cached": 0,
    "ms": 13146.8,
    "msMin": 11210.7
   },
   {
    "x": 8,
    "input": 3212,
    "processed": 3212,
    "cached": 0,
    "ms": 22512.2,
    "msMin": 17005.0
   }
  ],
  "state": [
   {
    "x": 2,
    "input": 90,
    "processed": 90,
    "cached": 0,
    "ms": 714.6,
    "msMin": 650.6
   },
   {
    "x": 8,
    "input": 174,
    "processed": 174,
    "cached": 0,
    "ms": 1435.9,
    "msMin": 1229.3
   },
   {
    "x": 24,
    "input": 398,
    "processed": 398,
    "cached": 0,
    "ms": 3204.5,
    "msMin": 2975.3
   },
   {
    "x": 48,
    "input": 734,
    "processed": 734,
    "cached": 0,
    "ms": 6424.6,
    "msMin": 5702.4
   },
   {
    "x": 96,
    "input": 1406,
    "processed": 1406,
    "cached": 0,
    "ms": 10310.8,
    "msMin": 7528.2
   }
  ]
 },
 "julia": {
  "opts": [
   {
    "x": 2,
    "input": 68,
    "processed": 68,
    "cached": 0,
    "ms": 58.9,
    "msMin": 52.7
   },
   {
    "x": 4,
    "input": 82,
    "processed": 82,
    "cached": 0,
    "ms": 65.0,
    "msMin": 60.6
   },
   {
    "x": 8,
    "input": 106,
    "processed": 106,
    "cached": 0,
    "ms": 88.2,
    "msMin": 79.7
   },
   {
    "x": 16,
    "input": 161,
    "processed": 161,
    "cached": 0,
    "ms": 117.5,
    "msMin": 103.1
   },
   {
    "x": 32,
    "input": 273,
    "processed": 273,
    "cached": 0,
    "ms": 190.4,
    "msMin": 149.9
   },
   {
    "x": 64,
    "input": 306,
    "processed": 306,
    "cached": 0,
    "ms": 275.4,
    "msMin": 192.1
   }
  ],
  "qs": [
   {
    "x": 1,
    "input": 390,
    "processed": 390,
    "cached": 0,
    "ms": 281.0,
    "msMin": 252.4
   },
   {
    "x": 2,
    "input": 784,
    "processed": 784,
    "cached": 0,
    "ms": 584.7,
    "msMin": 559.4
   },
   {
    "x": 4,
    "input": 1572,
    "processed": 1572,
    "cached": 0,
    "ms": 1125.9,
    "msMin": 876.8
   },
   {
    "x": 8,
    "input": 3148,
    "processed": 3148,
    "cached": 0,
    "ms": 2878.3,
    "msMin": 2601.7
   }
  ],
  "state": [
   {
    "x": 2,
    "input": 82,
    "processed": 82,
    "cached": 0,
    "ms": 82.1,
    "msMin": 72.5
   },
   {
    "x": 8,
    "input": 166,
    "processed": 166,
    "cached": 0,
    "ms": 154.4,
    "msMin": 125.6
   },
   {
    "x": 24,
    "input": 390,
    "processed": 390,
    "cached": 0,
    "ms": 313.9,
    "msMin": 270.9
   },
   {
    "x": 48,
    "error": "input (726 tokens) is too large to process. increase the physical batch size (current batch size: 512)"
   },
   {
    "x": 96,
    "error": "input (1398 tokens) is too large to process. increase the physical batch size (current batch size: 512)"
   }
  ],
  "stateUb": [
   {
    "x": 2,
    "input": 82,
    "processed": 82,
    "cached": 0,
    "ms": 70.8,
    "msMin": 59.6
   },
   {
    "x": 8,
    "input": 166,
    "processed": 166,
    "cached": 0,
    "ms": 120.1,
    "msMin": 91.2
   },
   {
    "x": 24,
    "input": 390,
    "processed": 390,
    "cached": 0,
    "ms": 318.3,
    "msMin": 282.5
   },
   {
    "x": 48,
    "input": 726,
    "processed": 726,
    "cached": 0,
    "ms": 677.8,
    "msMin": 590.3
   },
   {
    "x": 96,
    "input": 1398,
    "processed": 1398,
    "cached": 0,
    "ms": 1267.7,
    "msMin": 1120.5
   }
  ]
 }
}
