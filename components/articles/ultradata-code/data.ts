// Generated from the measurement run described in the article; see
// public/articles/ultradata-code/data/*.json for the same numbers as
// downloadable receipts. Every figure here was read out of the Hugging Face
// datasets-server APIs for openbmb/UltraData-Code on 2026-09-18, not from
// the dataset card. Nothing is hand-typed twice: the components below derive
// every total from this table.

export interface Lang {
  id: string
  name: string
  l2Rows: number
  l3Rows: number
  l2Tokens: number
  l3Tokens: number
  l2Bytes: number
  l3Bytes: number
  statRows: number
  partial: boolean
  cat: Record<string, number>
  catRaw: Record<string, number>
  algoFloor: number
  algoMean: number
  qFloor: number
  qCeil: number
  qMean: number
  algoHist: number[]
  algoEdges: number[]
  dup: { sampled: number; dup_rows: number; groups: number; max_group: number; nondet_groups: number }
}

export const CATS = ["ALGO", "TOOL", "WEB", "CONFIG", "TEST", "DATA"] as const

export const LANGS: Lang[] = [
  {
    "id": "cpp",
    "name": "C++",
    "l2Rows": 23290266,
    "l3Rows": 22600686,
    "l2Tokens": 24052002126,
    "l3Tokens": 39945026734,
    "l2Bytes": 32353895972,
    "l3Bytes": 181475734500,
    "statRows": 1502601,
    "partial": true,
    "cat": {
      "ALGO": 0.867242,
      "TOOL": 0.110512,
      "WEB": 0.002387,
      "CONFIG": 0.001774,
      "TEST": 0.014056,
      "DATA": 0.00403
    },
    "catRaw": {
      "ALGO": 1303118,
      "TOOL": 166055,
      "WEB": 3587,
      "CONFIG": 2665,
      "TEST": 21120,
      "DATA": 6056
    },
    "algoFloor": 0.85,
    "algoMean": 0.9872,
    "qFloor": 3.0,
    "qCeil": 8.7612,
    "qMean": 4.8857,
    "algoHist": [
      17944,
      19119,
      19928,
      21739,
      24395,
      27218,
      32658,
      41746,
      61968,
      1235886
    ],
    "algoEdges": [
      0.85,
      0.865,
      0.88,
      0.895,
      0.91,
      0.925,
      0.94,
      0.955,
      0.97,
      0.985,
      1.0
    ],
    "dup": {
      "sampled": 500,
      "dup_rows": 5,
      "groups": 2,
      "max_group": 5,
      "nondet_groups": 2
    }
  },
  {
    "id": "cs",
    "name": "C#",
    "l2Rows": 25779706,
    "l3Rows": 3614454,
    "l2Tokens": 39277230065,
    "l3Tokens": 6196622824,
    "l2Bytes": 55498707775,
    "l3Bytes": 29691081195,
    "statRows": 1031172,
    "partial": true,
    "cat": {
      "ALGO": 0.112085,
      "TOOL": 0.769085,
      "WEB": 0.032646,
      "CONFIG": 0.043998,
      "TEST": 0.040898,
      "DATA": 0.001287
    },
    "catRaw": {
      "ALGO": 115579,
      "TOOL": 793059,
      "WEB": 33664,
      "CONFIG": 45370,
      "TEST": 42173,
      "DATA": 1327
    },
    "algoFloor": 0.6,
    "algoMean": 0.8067,
    "qFloor": 3.00001,
    "qCeil": 8.5249,
    "qMean": 5.3815,
    "algoHist": [
      123141,
      117811,
      115590,
      95106,
      72362,
      63607,
      66604,
      77669,
      95480,
      203802
    ],
    "algoEdges": [
      0.6,
      0.64,
      0.68,
      0.71999,
      0.75999,
      0.79999,
      0.83999,
      0.87999,
      0.91998,
      0.95998,
      0.99998
    ],
    "dup": {
      "sampled": 500,
      "dup_rows": 21,
      "groups": 19,
      "max_group": 3,
      "nondet_groups": 17
    }
  },
  {
    "id": "go",
    "name": "Go",
    "l2Rows": 3778910,
    "l3Rows": 1948148,
    "l2Tokens": 4265862474,
    "l3Tokens": 2897055180,
    "l2Bytes": 6116352058,
    "l3Bytes": 12928100342,
    "statRows": 1889430,
    "partial": true,
    "cat": {
      "ALGO": 0.440905,
      "TOOL": 0.468519,
      "WEB": 0.004355,
      "CONFIG": 0.01539,
      "TEST": 0.067278,
      "DATA": 0.003553
    },
    "catRaw": {
      "ALGO": 833059,
      "TOOL": 885233,
      "WEB": 8229,
      "CONFIG": 29079,
      "TEST": 127117,
      "DATA": 6713
    },
    "algoFloor": 0.5,
    "algoMean": 0.8014,
    "qFloor": 3.0,
    "qCeil": 8.5047,
    "qMean": 5.3739,
    "algoHist": [
      188722,
      164157,
      146465,
      133393,
      123679,
      118080,
      117200,
      125057,
      160423,
      612254
    ],
    "algoEdges": [
      0.5,
      0.54997,
      0.59993,
      0.6499,
      0.69986,
      0.74983,
      0.7998,
      0.84976,
      0.89973,
      0.94969,
      0.99966
    ],
    "dup": {
      "sampled": 500,
      "dup_rows": 1,
      "groups": 1,
      "max_group": 2,
      "nondet_groups": 0
    }
  },
  {
    "id": "java",
    "name": "Java",
    "l2Rows": 43480052,
    "l3Rows": 21415405,
    "l2Tokens": 45456827449,
    "l3Tokens": 32305366414,
    "l2Bytes": 68042107554,
    "l3Bytes": 147506863567,
    "statRows": 1337835,
    "partial": true,
    "cat": {
      "ALGO": 0.470664,
      "TOOL": 0.464936,
      "WEB": 0.0034,
      "CONFIG": 0.032602,
      "TEST": 0.009666,
      "DATA": 0.018732
    },
    "catRaw": {
      "ALGO": 629671,
      "TOOL": 622007,
      "WEB": 4549,
      "CONFIG": 43616,
      "TEST": 12932,
      "DATA": 25060
    },
    "algoFloor": 0.7,
    "algoMean": 0.9053,
    "qFloor": 3.00012,
    "qCeil": 9.0762,
    "qMean": 5.9026,
    "algoHist": [
      85056,
      84514,
      83093,
      82084,
      81038,
      80799,
      80369,
      82251,
      96499,
      582132
    ],
    "algoEdges": [
      0.7,
      0.73,
      0.76,
      0.79,
      0.82,
      0.85,
      0.87999,
      0.90999,
      0.93999,
      0.96999,
      0.99999
    ],
    "dup": {
      "sampled": 500,
      "dup_rows": 0,
      "groups": 0,
      "max_group": 1,
      "nondet_groups": 0
    }
  },
  {
    "id": "js",
    "name": "JavaScript",
    "l2Rows": 57088927,
    "l3Rows": 6131527,
    "l2Tokens": 119976223657,
    "l3Tokens": 6757233858,
    "l2Bytes": 175165682200,
    "l3Bytes": 31128184230,
    "statRows": 718068,
    "partial": true,
    "cat": {
      "ALGO": 0.07858,
      "TOOL": 0.448814,
      "WEB": 0.415734,
      "CONFIG": 0.008946,
      "TEST": 0.047523,
      "DATA": 0.000402
    },
    "catRaw": {
      "ALGO": 56426,
      "TOOL": 322279,
      "WEB": 298525,
      "CONFIG": 6424,
      "TEST": 34125,
      "DATA": 289
    },
    "algoFloor": 0.75,
    "algoMean": 0.8731,
    "qFloor": 3.00019,
    "qCeil": 8.4995,
    "qMean": 6.0455,
    "algoHist": [
      62009,
      66272,
      70676,
      73725,
      80607,
      85304,
      87471,
      84563,
      67677,
      39764
    ],
    "algoEdges": [
      0.75,
      0.77489,
      0.79978,
      0.82466,
      0.84955,
      0.87444,
      0.89933,
      0.92422,
      0.9491,
      0.97399,
      0.99888
    ],
    "dup": {
      "sampled": 500,
      "dup_rows": 7,
      "groups": 6,
      "max_group": 3,
      "nondet_groups": 6
    }
  },
  {
    "id": "php",
    "name": "PHP",
    "l2Rows": 27474889,
    "l3Rows": 2306009,
    "l2Tokens": 101587141433,
    "l3Tokens": 6137074277,
    "l2Bytes": 124985011619,
    "l3Bytes": 25216656625,
    "statRows": 499567,
    "partial": true,
    "cat": {
      "ALGO": 0.040261,
      "TOOL": 0.477624,
      "WEB": 0.117013,
      "CONFIG": 0.345241,
      "TEST": 0.01638,
      "DATA": 0.003481
    },
    "catRaw": {
      "ALGO": 20113,
      "TOOL": 238605,
      "WEB": 58456,
      "CONFIG": 172471,
      "TEST": 8183,
      "DATA": 1739
    },
    "algoFloor": 0.85,
    "algoMean": 0.9267,
    "qFloor": 3.00002,
    "qCeil": 8.4959,
    "qMean": 5.7838,
    "algoHist": [
      37840,
      41594,
      42686,
      44796,
      46493,
      56693,
      45109,
      28787,
      32768,
      122801
    ],
    "algoEdges": [
      0.85,
      0.86363,
      0.87726,
      0.89089,
      0.90452,
      0.91816,
      0.93179,
      0.94542,
      0.95905,
      0.97268,
      0.98631
    ],
    "dup": {
      "sampled": 500,
      "dup_rows": 60,
      "groups": 29,
      "max_group": 7,
      "nondet_groups": 12
    }
  },
  {
    "id": "py",
    "name": "Python",
    "l2Rows": 72844227,
    "l3Rows": 20750202,
    "l2Tokens": 82331233678,
    "l3Tokens": 39123061320,
    "l2Bytes": 127815035932,
    "l3Bytes": 159330138871,
    "statRows": 1224287,
    "partial": true,
    "cat": {
      "ALGO": 0.251363,
      "TOOL": 0.309638,
      "WEB": 0.136229,
      "CONFIG": 0.073199,
      "TEST": 0.137113,
      "DATA": 0.092456
    },
    "catRaw": {
      "ALGO": 307741,
      "TOOL": 379086,
      "WEB": 166784,
      "CONFIG": 89617,
      "TEST": 167866,
      "DATA": 113193
    },
    "algoFloor": 0.0,
    "algoMean": 0.733,
    "qFloor": 3.00001,
    "qCeil": 10.0,
    "qMean": 5.3922,
    "algoHist": [
      137277,
      47686,
      31611,
      25891,
      23962,
      55298,
      59151,
      70098,
      120548,
      652765
    ],
    "algoEdges": [
      0.0,
      0.1,
      0.2,
      0.3,
      0.4,
      0.5,
      0.6,
      0.7,
      0.8,
      0.9,
      1.0
    ],
    "dup": {
      "sampled": 500,
      "dup_rows": 7,
      "groups": 6,
      "max_group": 3,
      "nondet_groups": 6
    }
  },
  {
    "id": "r",
    "name": "R",
    "l2Rows": 843971,
    "l3Rows": 304016,
    "l2Tokens": 1086633206,
    "l3Tokens": 547653878,
    "l2Bytes": 1505713548,
    "l3Bytes": 2877375488,
    "statRows": 843971,
    "partial": false,
    "cat": {
      "ALGO": 0.192005,
      "TOOL": 0.453531,
      "WEB": 0.01117,
      "CONFIG": 0.034267,
      "TEST": 0.051208,
      "DATA": 0.257819
    },
    "catRaw": {
      "ALGO": 162047,
      "TOOL": 382767,
      "WEB": 9427,
      "CONFIG": 28920,
      "TEST": 43218,
      "DATA": 217592
    },
    "algoFloor": 0.5,
    "algoMean": 0.7468,
    "qFloor": 3.0,
    "qCeil": 7.972,
    "qMean": 4.7083,
    "algoHist": [
      56939,
      56145,
      55524,
      57139,
      59306,
      66026,
      92698,
      174787,
      193622,
      31785
    ],
    "algoEdges": [
      0.5,
      0.54216,
      0.58432,
      0.62649,
      0.66865,
      0.71081,
      0.75297,
      0.79513,
      0.8373,
      0.87946,
      0.92162
    ],
    "dup": {
      "sampled": 500,
      "dup_rows": 2,
      "groups": 2,
      "max_group": 2,
      "nondet_groups": 2
    }
  },
  {
    "id": "rb",
    "name": "Ruby",
    "l2Rows": 6480797,
    "l3Rows": 846872,
    "l2Tokens": 5343099084,
    "l3Tokens": 1017355944,
    "l2Bytes": 8718501046,
    "l3Bytes": 4623255213,
    "statRows": 1620182,
    "partial": true,
    "cat": {
      "ALGO": 0.101911,
      "TOOL": 0.184932,
      "WEB": 0.242915,
      "CONFIG": 0.431449,
      "TEST": 0.030495,
      "DATA": 0.008298
    },
    "catRaw": {
      "ALGO": 165115,
      "TOOL": 299623,
      "WEB": 393566,
      "CONFIG": 699026,
      "TEST": 49408,
      "DATA": 13444
    },
    "algoFloor": 0.75,
    "algoMean": 0.9372,
    "qFloor": 3.00002,
    "qCeil": 8.0304,
    "qMean": 6.4052,
    "algoHist": [
      58310,
      61765,
      66346,
      70050,
      77842,
      86836,
      98054,
      124684,
      207280,
      769015
    ],
    "algoEdges": [
      0.75,
      0.77487,
      0.79975,
      0.82462,
      0.84949,
      0.87437,
      0.89924,
      0.92411,
      0.94898,
      0.97386,
      0.99873
    ],
    "dup": {
      "sampled": 500,
      "dup_rows": 52,
      "groups": 24,
      "max_group": 6,
      "nondet_groups": 12
    }
  },
  {
    "id": "rust",
    "name": "Rust",
    "l2Rows": 2746449,
    "l3Rows": 922564,
    "l2Tokens": 4338479618,
    "l3Tokens": 1616150587,
    "l2Bytes": 5742329869,
    "l3Bytes": 7947869828,
    "statRows": 915484,
    "partial": true,
    "cat": {
      "ALGO": 0.307834,
      "TOOL": 0.479178,
      "WEB": 0.041924,
      "CONFIG": 0.079575,
      "TEST": 0.063786,
      "DATA": 0.027702
    },
    "catRaw": {
      "ALGO": 281817,
      "TOOL": 438680,
      "WEB": 38381,
      "CONFIG": 72850,
      "TEST": 58395,
      "DATA": 25361
    },
    "algoFloor": 0.5,
    "algoMean": 0.8232,
    "qFloor": 3.00001,
    "qCeil": 8.9875,
    "qMean": 6.4475,
    "algoHist": [
      70428,
      67844,
      63914,
      60867,
      59782,
      57506,
      59189,
      63157,
      71237,
      341560
    ],
    "algoEdges": [
      0.5,
      0.55,
      0.6,
      0.65,
      0.7,
      0.75,
      0.8,
      0.85,
      0.9,
      0.95,
      1.0
    ],
    "dup": {
      "sampled": 500,
      "dup_rows": 0,
      "groups": 0,
      "max_group": 1,
      "nondet_groups": 0
    }
  },
  {
    "id": "sh",
    "name": "Shell",
    "l2Rows": 3070182,
    "l3Rows": 365222,
    "l2Tokens": 3888928178,
    "l3Tokens": 536902201,
    "l2Bytes": 5338429957,
    "l3Bytes": 1987138772,
    "statRows": 1842097,
    "partial": true,
    "cat": {
      "ALGO": 0.081317,
      "TOOL": 0.862573,
      "WEB": 0.000837,
      "CONFIG": 0.003656,
      "TEST": 0.013305,
      "DATA": 0.038313
    },
    "catRaw": {
      "ALGO": 149793,
      "TOOL": 1588943,
      "WEB": 1541,
      "CONFIG": 6734,
      "TEST": 24510,
      "DATA": 70576
    },
    "algoFloor": 0.85,
    "algoMean": 0.9643,
    "qFloor": 3.0,
    "qCeil": 7.6414,
    "qMean": 4.4915,
    "algoHist": [
      48974,
      57108,
      61395,
      73134,
      77579,
      98685,
      124236,
      170181,
      281404,
      849401
    ],
    "algoEdges": [
      0.85,
      0.865,
      0.88,
      0.895,
      0.91,
      0.925,
      0.94,
      0.955,
      0.97,
      0.985,
      1.0
    ],
    "dup": {
      "sampled": 500,
      "dup_rows": 23,
      "groups": 17,
      "max_group": 4,
      "nondet_groups": 10
    }
  }
]

export const TOTALS = {
  rows: 348083481,
  l2Rows: 266878376,
  l3Rows: 81205105,
  parquetBytes: 1215994166161,
  arrowBytes: 3061255972282,
  l2Tokens: 431603660968,
  l3FullContent: 137079503217,
  l3Content: 52440403282,
  l3RawContent: 79048938114,
  l3AllColumns: 402531314608,
  l2Claimed: 400e9,
  l3Claimed: 150e9,
}

export const DUP = {"sampled": 5500, "dup": 178, "groups": 106, "nondet": 67}

export const DUP_EXAMPLES = {
  "cpp": {
    "path": "windows/runner/utils.cpp",
    "chars": 1788,
    "category": "TOOL",
    "copies": 5,
    "rows": [
      {
        "idx": 3,
        "repo": "ambedgar777/quiz_flutter",
        "path": "windows/runner/utils.cpp",
        "q": 6.763549327850342,
        "algo": 0.9988085031509399
      },
      {
        "idx": 4658133,
        "repo": "Emad-Pro/Mini-Wall-Social-App",
        "path": "windows/runner/utils.cpp",
        "q": 6.760730266571045,
        "algo": 0.9987998008728027
      },
      {
        "idx": 13974204,
        "repo": "samir802/fileformatting",
        "path": "windows/runner/utils.cpp",
        "q": 6.760730266571045,
        "algo": 0.9987998008728027
      },
      {
        "idx": 13974239,
        "repo": "jackson338/gemini_goals",
        "path": "windows/runner/utils.cpp",
        "q": 6.760730266571045,
        "algo": 0.9987998008728027
      },
      {
        "idx": 18632256,
        "repo": "dev-ravan/hive_database_flutter",
        "path": "windows/runner/utils.cpp",
        "q": 6.760730266571045,
        "algo": 0.9987998008728027
      }
    ]
  },
  "php": {
    "path": "config/database.php",
    "chars": 5289,
    "category": "CONFIG",
    "copies": 7,
    "rows": [
      {
        "idx": 80,
        "repo": "BusitanJomilynM/library-collection-analysis",
        "path": "config/database.php",
        "q": 6.715481281280518,
        "algo": 0.9829564094543457
      },
      {
        "idx": 5494982,
        "repo": "ramesh-kashyap/gentius",
        "path": "config/database.php",
        "q": 6.715481281280518,
        "algo": 0.9829564094543457
      },
      {
        "idx": 5495053,
        "repo": "indradprasetya/PWL_11_RESTful-API",
        "path": "config/database.php",
        "q": 6.715481281280518,
        "algo": 0.9829564094543457
      },
      {
        "idx": 16484958,
        "repo": "MohammedFayiskv/mahall-commite",
        "path": "config/database.php",
        "q": 6.715481281280518,
        "algo": 0.9829564094543457
      },
      {
        "idx": 16485028,
        "repo": "alextselegidis/timecrack",
        "path": "config/database.php",
        "q": 6.715481281280518,
        "algo": 0.9829564094543457
      },
      {
        "idx": 16485029,
        "repo": "eonvse/timedata",
        "path": "config/database.php",
        "q": 6.715481281280518,
        "algo": 0.9829564094543457
      },
      {
        "idx": 16485031,
        "repo": "havizIM/loops-id",
        "path": "config/database.php",
        "q": 6.715481281280518,
        "algo": 0.9829564094543457
      }
    ]
  },
  "py": {
    "path": "venv/Lib/site-packages/pip/_vendor/rich/_ratio.py",
    "chars": 5467,
    "category": "ALGO",
    "copies": 3,
    "rows": [
      {
        "idx": 29137716,
        "repo": "gokuls999/exam_portal",
        "path": "venv/Lib/site-packages/pip/_vendor/rich/_ratio.py",
        "q": 8.447600364685059,
        "algo": 2.6479629013920203e-05
      },
      {
        "idx": 43706618,
        "repo": "ChiragJiwnani/DataCraft---End-to-End-Data-Science-Project-Tool",
        "path": "venv/lib/python3.12/site-packages/pip/_vendor/rich/_ratio.py",
        "q": 8.447600364685059,
        "algo": 1.3834218407282606e-05
      },
      {
        "idx": 58275388,
        "repo": "knagaki1225/memoApp",
        "path": "venv/lib/python3.12/site-packages/pip/_vendor/rich/_ratio.py",
        "q": 8.447600364685059,
        "algo": 1.3834218407282606e-05
      }
    ]
  },
  "cs": {
    "path": "Library/PackageCache/com.unity.ide.vscode@1.1.4/Editor/VSCodeDiscovery.cs",
    "chars": 4460,
    "category": "TOOL",
    "copies": 3,
    "rows": [
      {
        "idx": 5155973,
        "repo": "bluewolf2735/Unity_SimpleMQTTClient",
        "path": "Library/PackageCache/com.unity.ide.vscode@1.1.4/Editor/VSCodeDiscovery.cs",
        "q": 6.295753002166748,
        "algo": 0.6916747093200684
      },
      {
        "idx": 10311917,
        "repo": "kholoshnia/machine-learning-virtual-laboratory",
        "path": "Release Files/Unity map creators/NEAT map creator/Library/PackageCache/com.unity.ide.vscode@1.1.3/Editor/VSCodeDiscovery.cs",
        "q": 6.295753002166748,
        "algo": 0.6655435562133789
      },
      {
        "idx": 15467920,
        "repo": "liamthomas1/comp2007SetExercise",
        "path": "comp2007 to make a chest/Library/PackageCache/com.unity.ide.vscode@1.2.3/Editor/VSCodeDiscovery.cs",
        "q": 6.295753002166748,
        "algo": 0.6621782779693604
      }
    ]
  }
}
