// Every number in this file was printed by public/articles/sae-text-detectors/sae_probe.py
// (one seeded run; a re-run agrees to about three decimals, not to the last digit).
// Model: pythia-14m, residual stream entering block 3, 1,024-feature ReLU SAE, max-pooled,
// L1 logistic probe. Data: Hello-SimpleAI/HC3 pairs (CC BY-SA 4.0). Nothing here is the paper's.

export type Dom = "open_qa" | "medicine" | "wiki_csai"
export type Cell = { auc: number; tpr: number; fpr: number }

export const DOMAINS: { id: Dom; label: string }[] = [
  { id: "open_qa", label: "open_qa (Wikipedia-style answers)" },
  { id: "medicine", label: "medicine (doctor replies)" },
  { id: "wiki_csai", label: "wiki_csai (CS encyclopedia)" },
]

export const SAE = {"fracVarUnexplained": 0.024, "l0": 43.2, "dead": 0} as const

export const SWEEP: { tau: number; kept: number; nonzero: number; valAuc: number; test: Record<Dom, Cell> }[] = [
 {
  "tau": 0.0,
  "kept": 1024,
  "nonzero": 156,
  "valAuc": 0.997,
  "test": {
   "open_qa": {
    "auc": 0.935,
    "tpr": 0.932,
    "fpr": 0.235
   },
   "medicine": {
    "auc": 0.991,
    "tpr": 1.0,
    "fpr": 0.233
   },
   "wiki_csai": {
    "auc": 0.765,
    "tpr": 0.998,
    "fpr": 0.848
   }
  }
 },
 {
  "tau": 0.2,
  "kept": 248,
  "nonzero": 104,
  "valAuc": 0.996,
  "test": {
   "open_qa": {
    "auc": 0.899,
    "tpr": 0.887,
    "fpr": 0.263
   },
   "medicine": {
    "auc": 0.995,
    "tpr": 1.0,
    "fpr": 0.2
   },
   "wiki_csai": {
    "auc": 0.747,
    "tpr": 0.99,
    "fpr": 0.863
   }
  }
 },
 {
  "tau": 0.3,
  "kept": 184,
  "nonzero": 61,
  "valAuc": 0.995,
  "test": {
   "open_qa": {
    "auc": 0.894,
    "tpr": 0.823,
    "fpr": 0.207
   },
   "medicine": {
    "auc": 0.991,
    "tpr": 0.998,
    "fpr": 0.195
   },
   "wiki_csai": {
    "auc": 0.741,
    "tpr": 0.988,
    "fpr": 0.81
   }
  }
 },
 {
  "tau": 0.4,
  "kept": 148,
  "nonzero": 59,
  "valAuc": 0.995,
  "test": {
   "open_qa": {
    "auc": 0.894,
    "tpr": 0.815,
    "fpr": 0.2
   },
   "medicine": {
    "auc": 0.991,
    "tpr": 0.995,
    "fpr": 0.188
   },
   "wiki_csai": {
    "auc": 0.741,
    "tpr": 0.988,
    "fpr": 0.805
   }
  }
 },
 {
  "tau": 0.5,
  "kept": 113,
  "nonzero": 57,
  "valAuc": 0.994,
  "test": {
   "open_qa": {
    "auc": 0.888,
    "tpr": 0.865,
    "fpr": 0.245
   },
   "medicine": {
    "auc": 0.995,
    "tpr": 0.99,
    "fpr": 0.175
   },
   "wiki_csai": {
    "auc": 0.749,
    "tpr": 0.985,
    "fpr": 0.815
   }
  }
 },
 {
  "tau": 0.6,
  "kept": 87,
  "nonzero": 50,
  "valAuc": 0.993,
  "test": {
   "open_qa": {
    "auc": 0.889,
    "tpr": 0.748,
    "fpr": 0.177
   },
   "medicine": {
    "auc": 0.992,
    "tpr": 0.985,
    "fpr": 0.128
   },
   "wiki_csai": {
    "auc": 0.743,
    "tpr": 0.98,
    "fpr": 0.765
   }
  }
 },
 {
  "tau": 0.7,
  "kept": 67,
  "nonzero": 46,
  "valAuc": 0.992,
  "test": {
   "open_qa": {
    "auc": 0.901,
    "tpr": 0.713,
    "fpr": 0.113
   },
   "medicine": {
    "auc": 0.992,
    "tpr": 0.988,
    "fpr": 0.107
   },
   "wiki_csai": {
    "auc": 0.758,
    "tpr": 0.965,
    "fpr": 0.715
   }
  }
 }
]

export const DENSE: { valAuc: number; test: Record<Dom, Cell> } = {
 "valAuc": 0.946,
 "test": {
  "open_qa": {
   "auc": 0.769,
   "tpr": 0.485,
   "fpr": 0.14
  },
  "medicine": {
   "auc": 0.862,
   "tpr": 0.665,
   "fpr": 0.107
  },
  "wiki_csai": {
   "auc": 0.69,
   "tpr": 0.73,
   "fpr": 0.48
  }
 }
}

export type Ex = {
  domain: Dom
  kind: "fp" | "tp" | "tn" | "fn"
  y: number
  logit: number
  nTok: number
  text: string
  feats: { id: number; c: number; tok: string; ctx: string; top: string[] }[]
}
export const AUDIT = { bias: 0.0, threshold: -0.2, kept: 148, nonzero: 59 } as const
export const EXAMPLES: Ex[] = [
 {
  "domain": "open_qa",
  "kind": "fp",
  "y": 0,
  "logit": 3.391,
  "nTok": 128,
  "text": "Dredging is an excavation activity or operation usually carried out at least partly underwater, in shallow seas or fresh water areas with the purpose of gathering up bottom sediments and disposing of ",
  "feats": [
   {
    "id": 154,
    "c": -3.3,
    "tok": " the",
    "ctx": " water areas with the purpose",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 871,
    "c": 1.74,
    "tok": ".",
    "ctx": " body of water.For",
    "top": [
     ".",
     ").",
     "?"
    ]
   },
   {
    "id": 918,
    "c": 0.95,
    "tok": " or",
    "ctx": " of a rope or pole",
    "top": [
     " or",
     "or",
     " /"
    ]
   },
   {
    "id": 467,
    "c": 0.92,
    "tok": ",",
    "ctx": " is any device, machine",
    "top": [
     ",",
     "),",
     " ,"
    ]
   },
   {
    "id": 747,
    "c": 0.75,
    "tok": ",",
    "ctx": ".For example, a",
    "top": [
     ",",
     " ,",
     " that"
    ]
   },
   {
    "id": 490,
    "c": 0.67,
    "tok": " that",
    "ctx": ", or vessel that is",
    "top": [
     " that",
     " who",
     " which"
    ]
   }
  ]
 },
 {
  "domain": "open_qa",
  "kind": "tp",
  "y": 1,
  "logit": 3.382,
  "nTok": 118,
  "text": "The sign for degrees is the degree symbol, which looks like a small circle with a horizontal line through it. It is typically used to represent temperature, angles, or other measurements in a variety ",
  "feats": [
   {
    "id": 154,
    "c": -3.43,
    "tok": " the",
    "ctx": " for degrees is the degree",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 871,
    "c": 1.72,
    "tok": ".",
    "ctx": " application being used.",
    "top": [
     ".",
     ").",
     "?"
    ]
   },
   {
    "id": 467,
    "c": 1.1,
    "tok": ",",
    "ctx": " on a keyboard, or",
    "top": [
     ",",
     "),",
     " ,"
    ]
   },
   {
    "id": 918,
    "c": 0.95,
    "tok": " or",
    "ctx": " special character code or symbol",
    "top": [
     " or",
     "or",
     " /"
    ]
   },
   {
    "id": 747,
    "c": 0.73,
    "tok": ",",
    "ctx": ". For example, the",
    "top": [
     ",",
     " ,",
     " that"
    ]
   },
   {
    "id": 391,
    "c": -0.71,
    "tok": " in",
    "ctx": " or other measurements in a",
    "top": [
     " in",
     " In",
     " into"
    ]
   }
  ]
 },
 {
  "domain": "open_qa",
  "kind": "tn",
  "y": 0,
  "logit": -5.601,
  "nTok": 28,
  "text": "They lived in the tropical lowlands of south-central Mexico, in the modern-day states of Veracruz and Tabasco .",
  "feats": [
   {
    "id": 154,
    "c": -3.3,
    "tok": " the",
    "ctx": "They lived in the tropical",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 820,
    "c": -2.86,
    "tok": " .",
    "ctx": " Tabasco .",
    "top": [
     " .",
     " ...",
     " ;"
    ]
   },
   {
    "id": 467,
    "c": 0.78,
    "tok": ",",
    "ctx": "-central Mexico, in",
    "top": [
     ",",
     "),",
     " ,"
    ]
   },
   {
    "id": 391,
    "c": -0.56,
    "tok": " in",
    "ctx": "They lived in the",
    "top": [
     " in",
     " In",
     " into"
    ]
   },
   {
    "id": 354,
    "c": 0.43,
    "tok": " of",
    "ctx": "-day states of Ver",
    "top": [
     " of",
     " to",
     " for"
    ]
   },
   {
    "id": 333,
    "c": -0.29,
    "tok": "They",
    "ctx": "They lived",
    "top": [
     " they",
     " They",
     " them"
    ]
   }
  ]
 },
 {
  "domain": "open_qa",
  "kind": "fn",
  "y": 1,
  "logit": -4.385,
  "nTok": 25,
  "text": "I'm sorry, but I don't understand what you're asking. Could you please provide more context or clarify your question?",
  "feats": [
   {
    "id": 154,
    "c": -2.76,
    "tok": ",",
    "ctx": "I'm sorry, but",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 871,
    "c": 1.57,
    "tok": ".",
    "ctx": " you're asking. Could",
    "top": [
     ".",
     ").",
     "?"
    ]
   },
   {
    "id": 468,
    "c": -1.3,
    "tok": " I",
    "ctx": " sorry, but I don",
    "top": [
     " I",
     "I",
     " me"
    ]
   },
   {
    "id": 918,
    "c": 0.94,
    "tok": " or",
    "ctx": " provide more context or clarify",
    "top": [
     " or",
     "or",
     " /"
    ]
   },
   {
    "id": 988,
    "c": -0.84,
    "tok": " don",
    "ctx": ", but I don't",
    "top": [
     " don",
     " doesn",
     " didn"
    ]
   },
   {
    "id": 865,
    "c": -0.79,
    "tok": " what",
    "ctx": " don't understand what you",
    "top": [
     " what",
     " What",
     " how"
    ]
   }
  ]
 },
 {
  "domain": "medicine",
  "kind": "fp",
  "y": 0,
  "logit": 3.659,
  "nTok": 128,
  "text": "ESR is a nonspecific test indicating the presence of an inflammatory condition. This could be due to an infection or to many other causes. The inflammatory process and the change in ESR could be due t",
  "feats": [
   {
    "id": 154,
    "c": -3.15,
    "tok": " the",
    "ctx": "pecific test indicating the presence",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 871,
    "c": 1.67,
    "tok": ".",
    "ctx": " of an infection. Again",
    "top": [
     ".",
     ").",
     "?"
    ]
   },
   {
    "id": 467,
    "c": 1.21,
    "tok": ",",
    "ctx": " up with treatment, the",
    "top": [
     ",",
     "),",
     " ,"
    ]
   },
   {
    "id": 460,
    "c": 1.16,
    "tok": " as",
    "ctx": " infection, such as",
    "top": [
     " as",
     " including",
     " like"
    ]
   },
   {
    "id": 918,
    "c": 0.86,
    "tok": " or",
    "ctx": " to an infection or to",
    "top": [
     " or",
     "or",
     " /"
    ]
   },
   {
    "id": 747,
    "c": 0.71,
    "tok": ",",
    "ctx": " infection. Again, it",
    "top": [
     ",",
     " ,",
     " that"
    ]
   }
  ]
 },
 {
  "domain": "medicine",
  "kind": "tp",
  "y": 1,
  "logit": 9.643,
  "nTok": 128,
  "text": "It is possible that you may have strained a muscle in your lower back, which can cause pain and discomfort. This can happen if you make an sudden, awkward movement or if you have been engaging in acti",
  "feats": [
   {
    "id": 684,
    "c": 4.32,
    "tok": "⏎",
    "ctx": " up properly.⏎⏎",
    "top": [
     "⏎",
     ".",
     "\""
    ]
   },
   {
    "id": 154,
    "c": -3.26,
    "tok": " the",
    "ctx": " to help alleviate the pain",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 871,
    "c": 1.69,
    "tok": ".",
    "ctx": " pain and discomfort. This",
    "top": [
     ".",
     ").",
     "?"
    ]
   },
   {
    "id": 460,
    "c": 1.21,
    "tok": " as",
    "ctx": " muscles, such as lifting",
    "top": [
     " as",
     " including",
     " like"
    ]
   },
   {
    "id": 467,
    "c": 1.06,
    "tok": ",",
    "ctx": " your back muscles, such",
    "top": [
     ",",
     "),",
     " ,"
    ]
   },
   {
    "id": 221,
    "c": 1.01,
    "tok": " help",
    "ctx": ", which can help to",
    "top": [
     " help",
     " helps",
     " helping"
    ]
   }
  ]
 },
 {
  "domain": "medicine",
  "kind": "tn",
  "y": 0,
  "logit": -5.935,
  "nTok": 87,
  "text": "Hi...by what you quote I feel that your son might be having a post viral skin peeling or dry skin (idiopathic). I suggest using emollient ointment or creams for this. If still not better - I suggest y",
  "feats": [
   {
    "id": 432,
    "c": -4.74,
    "tok": "  ",
    "ctx": " you scientifically.  S",
    "top": [
     "  ",
     "   ",
     "    "
    ]
   },
   {
    "id": 154,
    "c": -3.26,
    "tok": " the",
    "ctx": " upload photographs of the same",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 871,
    "c": 1.52,
    "tok": ".",
    "ctx": " after seeing directly. Reg",
    "top": [
     ".",
     ").",
     "?"
    ]
   },
   {
    "id": 468,
    "c": -1.36,
    "tok": " I",
    "ctx": "idiopathic). I suggest",
    "top": [
     " I",
     "I",
     " me"
    ]
   },
   {
    "id": 467,
    "c": 1.27,
    "tok": ",",
    "ctx": " on this website, so",
    "top": [
     ",",
     "),",
     " ,"
    ]
   },
   {
    "id": 918,
    "c": 1.01,
    "tok": " or",
    "ctx": " ointment or cre",
    "top": [
     " or",
     "or",
     " /"
    ]
   }
  ]
 },
 {
  "domain": "medicine",
  "kind": "fn",
  "y": 1,
  "logit": -0.662,
  "nTok": 118,
  "text": "It's possible that your son has preauricular pits or sinuses, which are small, shallow pits or dimples located on the front of the ear, near the earlobe. These pits are present at birth and are though",
  "feats": [
   {
    "id": 154,
    "c": -3.24,
    "tok": " the",
    "ctx": "ples located on the front",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 871,
    "c": 1.76,
    "tok": ".",
    "ctx": " to prevent infection.",
    "top": [
     ".",
     ").",
     "?"
    ]
   },
   {
    "id": 468,
    "c": -1.49,
    "tok": " I",
    "ctx": " the pits, I would",
    "top": [
     " I",
     "I",
     " me"
    ]
   },
   {
    "id": 467,
    "c": 1.15,
    "tok": ",",
    "ctx": " about the pits, I",
    "top": [
     ",",
     "),",
     " ,"
    ]
   },
   {
    "id": 918,
    "c": 0.9,
    "tok": " or",
    "ctx": "auricular pits or sin",
    "top": [
     " or",
     "or",
     " /"
    ]
   },
   {
    "id": 391,
    "c": -0.57,
    "tok": " in",
    "ctx": " problems, but in some",
    "top": [
     " in",
     " In",
     " into"
    ]
   }
  ]
 },
 {
  "domain": "wiki_csai",
  "kind": "fp",
  "y": 0,
  "logit": 9.441,
  "nTok": 128,
  "text": "An electronic circuit is composed of individual electronic components, such as resistors, transistors, capacitors, inductors and diodes, connected by conductive wires or traces through which electric ",
  "feats": [
   {
    "id": 684,
    "c": 4.21,
    "tok": "⏎",
    "ctx": " to another.⏎Circ",
    "top": [
     "⏎",
     ".",
     "\""
    ]
   },
   {
    "id": 154,
    "c": -2.89,
    "tok": ",",
    "ctx": " individual electronic components, such",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 871,
    "c": 1.73,
    "tok": ".",
    "ctx": " current can flow. It",
    "top": [
     ".",
     ").",
     "?"
    ]
   },
   {
    "id": 460,
    "c": 1.23,
    "tok": " as",
    "ctx": " components, such as resist",
    "top": [
     " as",
     " including",
     " like"
    ]
   },
   {
    "id": 467,
    "c": 1.03,
    "tok": ",",
    "ctx": " to as electronic, rather",
    "top": [
     ",",
     "),",
     " ,"
    ]
   },
   {
    "id": 918,
    "c": 0.82,
    "tok": " or",
    "ctx": " by conductive wires or traces",
    "top": [
     " or",
     "or",
     " /"
    ]
   }
  ]
 },
 {
  "domain": "wiki_csai",
  "kind": "tp",
  "y": 1,
  "logit": 7.162,
  "nTok": 128,
  "text": "Computational learning theory is a subfield of artificial intelligence and computer science that deals with the study of how computers can learn from data. It is concerned with understanding the compu",
  "feats": [
   {
    "id": 154,
    "c": -3.5,
    "tok": " the",
    "ctx": " that deals with the study",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 684,
    "c": 3.15,
    "tok": "⏎",
    "ctx": " data.⏎⏎⏎⏎Comput",
    "top": [
     "⏎",
     ".",
     "\""
    ]
   },
   {
    "id": 871,
    "c": 1.75,
    "tok": ".",
    "ctx": " learn from data. It",
    "top": [
     ".",
     ").",
     "?"
    ]
   },
   {
    "id": 918,
    "c": 0.98,
    "tok": " or",
    "ctx": " can make predictions or decisions",
    "top": [
     " or",
     "or",
     " /"
    ]
   },
   {
    "id": 467,
    "c": 0.89,
    "tok": ",",
    "ctx": " on a dataset, which",
    "top": [
     ",",
     "),",
     " ,"
    ]
   },
   {
    "id": 490,
    "c": 0.69,
    "tok": " that",
    "ctx": " to build models that can",
    "top": [
     " that",
     " who",
     " which"
    ]
   }
  ]
 },
 {
  "domain": "wiki_csai",
  "kind": "tn",
  "y": 0,
  "logit": -0.926,
  "nTok": 41,
  "text": "John Joseph Hopfield (born July 15, 1933) is an American scientist most widely known for his invention of an associative neural network in 1982. It is now more commonly known as the Hopfield network.",
  "feats": [
   {
    "id": 154,
    "c": -3.34,
    "tok": ",",
    "ctx": "born July 15, 1933",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 871,
    "c": 1.57,
    "tok": ".",
    "ctx": " Hopfield network.",
    "top": [
     ".",
     ").",
     "?"
    ]
   },
   {
    "id": 684,
    "c": 0.71,
    "tok": ".",
    "ctx": " network in 1982. It",
    "top": [
     "⏎",
     ".",
     "\""
    ]
   },
   {
    "id": 391,
    "c": -0.66,
    "tok": " in",
    "ctx": " associative neural network in 1982",
    "top": [
     " in",
     " In",
     " into"
    ]
   },
   {
    "id": 460,
    "c": 0.62,
    "tok": " as",
    "ctx": " more commonly known as the",
    "top": [
     " as",
     " including",
     " like"
    ]
   },
   {
    "id": 810,
    "c": -0.56,
    "tok": " (",
    "ctx": " Joseph Hopfield (born",
    "top": [
     " (",
     "(",
     " ["
    ]
   }
  ]
 },
 {
  "domain": "wiki_csai",
  "kind": "fn",
  "y": 1,
  "logit": -3.818,
  "nTok": 35,
  "text": "I'm sorry, but I don't have any information about a person named \"Kumpati S. Narendra.\" Could you provide more context or clarify your question?",
  "feats": [
   {
    "id": 154,
    "c": -2.76,
    "tok": ",",
    "ctx": "I'm sorry, but",
    "top": [
     " the",
     ",",
     "."
    ]
   },
   {
    "id": 468,
    "c": -1.3,
    "tok": " I",
    "ctx": " sorry, but I don",
    "top": [
     " I",
     "I",
     " me"
    ]
   },
   {
    "id": 871,
    "c": 1.0,
    "tok": "?",
    "ctx": " clarify your question?",
    "top": [
     ".",
     ").",
     "?"
    ]
   },
   {
    "id": 918,
    "c": 0.93,
    "tok": " or",
    "ctx": " provide more context or clarify",
    "top": [
     " or",
     "or",
     " /"
    ]
   },
   {
    "id": 988,
    "c": -0.84,
    "tok": " don",
    "ctx": ", but I don't",
    "top": [
     " don",
     " doesn",
     " didn"
    ]
   },
   {
    "id": 365,
    "c": -0.77,
    "tok": "'t",
    "ctx": " but I don't have",
    "top": [
     "'t",
     " not",
     " have"
    ]
   }
  ]
 }
]

export const FEATURES: { id: number; w: number; conc: number; human: number; ai: number; top: string[] }[] = [
 {
  "id": 432,
  "w": -0.98,
  "conc": 0.83,
  "human": 131,
  "ai": 102,
  "top": [
   "  ",
   "   ",
   "    "
  ]
 },
 {
  "id": 684,
  "w": 0.73,
  "conc": 0.99,
  "human": 151,
  "ai": 241,
  "top": [
   "⏎",
   ".",
   "\""
  ]
 },
 {
  "id": 971,
  "w": -0.59,
  "conc": 0.43,
  "human": 229,
  "ai": 193,
  "top": [
   " just",
   " only",
   " simply"
  ]
 },
 {
  "id": 820,
  "w": -0.58,
  "conc": 0.98,
  "human": 224,
  "ai": 93,
  "top": [
   " .",
   " ...",
   " ;"
  ]
 },
 {
  "id": 467,
  "w": 0.41,
  "conc": 0.97,
  "human": 212,
  "ai": 280,
  "top": [
   ",",
   "),",
   " ,"
  ]
 },
 {
  "id": 871,
  "w": 0.4,
  "conc": 0.95,
  "human": 244,
  "ai": 285,
  "top": [
   ".",
   ").",
   "?"
  ]
 },
 {
  "id": 468,
  "w": -0.34,
  "conc": 0.71,
  "human": 181,
  "ai": 94,
  "top": [
   " I",
   "I",
   " me"
  ]
 },
 {
  "id": 37,
  "w": 0.33,
  "conc": 0.55,
  "human": 186,
  "ai": 238,
  "top": [
   " important",
   " difficult",
   " possible"
  ]
 },
 {
  "id": 485,
  "w": -0.33,
  "conc": 0.68,
  "human": 127,
  "ai": 65,
  "top": [
   "/",
   " /",
   "://"
  ]
 },
 {
  "id": 515,
  "w": -0.33,
  "conc": 0.8,
  "human": 151,
  "ai": 127,
  "top": [
   " etc",
   " ....",
   "org"
  ]
 },
 {
  "id": 717,
  "w": -0.3,
  "conc": 0.59,
  "human": 186,
  "ai": 155,
  "top": [
   " then",
   " now",
   " until"
  ]
 },
 {
  "id": 918,
  "w": 0.26,
  "conc": 0.95,
  "human": 176,
  "ai": 256,
  "top": [
   " or",
   "or",
   " /"
  ]
 }
]

export const PREFIX: { tokens: number; auc: number; tpr: number; fpr: number; humanLogit: number; aiLogit: number }[] = [
 {
  "tokens": 8,
  "auc": 0.645,
  "tpr": 0.048,
  "fpr": 0.003,
  "humanLogit": -2.35,
  "aiLogit": -1.81
 },
 {
  "tokens": 16,
  "auc": 0.66,
  "tpr": 0.107,
  "fpr": 0.028,
  "humanLogit": -2.46,
  "aiLogit": -1.68
 },
 {
  "tokens": 32,
  "auc": 0.758,
  "tpr": 0.496,
  "fpr": 0.174,
  "humanLogit": -2.05,
  "aiLogit": -0.21
 },
 {
  "tokens": 64,
  "auc": 0.847,
  "tpr": 0.875,
  "fpr": 0.325,
  "humanLogit": -1.4,
  "aiLogit": 2.56
 },
 {
  "tokens": 128,
  "auc": 0.858,
  "tpr": 0.932,
  "fpr": 0.398,
  "humanLogit": -0.81,
  "aiLogit": 4.51
 }
]

export const MASKED: Record<"all" | "format_off" | "only_684_off", { kept: number; nonzero: number; valAuc: number; test: Record<Dom, Cell> }> = {
 "format_off": {
  "kept": 117,
  "nonzero": 81,
  "valAuc": 0.973,
  "test": {
   "open_qa": {
    "auc": 0.854,
    "tpr": 0.655,
    "fpr": 0.125
   },
   "medicine": {
    "auc": 0.943,
    "tpr": 0.912,
    "fpr": 0.117
   },
   "wiki_csai": {
    "auc": 0.754,
    "tpr": 0.885,
    "fpr": 0.635
   }
  }
 },
 "only_684_off": {
  "kept": 147,
  "nonzero": 60,
  "valAuc": 0.994,
  "test": {
   "open_qa": {
    "auc": 0.907,
    "tpr": 0.838,
    "fpr": 0.155
   },
   "medicine": {
    "auc": 0.959,
    "tpr": 0.93,
    "fpr": 0.17
   },
   "wiki_csai": {
    "auc": 0.776,
    "tpr": 0.94,
    "fpr": 0.613
   }
  }
 },
 "all": {
  "kept": 148,
  "nonzero": 59,
  "valAuc": 0.995,
  "test": {
   "open_qa": {
    "auc": 0.894,
    "tpr": 0.815,
    "fpr": 0.2
   },
   "medicine": {
    "auc": 0.991,
    "tpr": 0.995,
    "fpr": 0.188
   },
   "wiki_csai": {
    "auc": 0.741,
    "tpr": 0.988,
    "fpr": 0.805
   }
  }
 }
}
