// Generated from fishaudio/drama-3 tokenizer.json (Hub commit e0a9218) with the
// Hugging Face tokenizers library: every pre-token the DirectionExplorer can
// produce, mapped to its BPE ids and pieces. Checked against a full encode of
// 30,000 random markups (0 mismatches) and replayed in JS (5,000, 0 mismatches).
// Counts for the fixed prompt segments come from the same tokenizer, each
// segment encoded on its own, as sglang-omni prompt.py does.

export const PRETOKENS: Record<string, readonly [readonly number[], readonly string[]]> = {
  " ": [[220], [" "]],
  " <": [[361], [" <"]],
  " Promise": [[7076], [" Promise"]],
  " [": [[498], [" ["]],
  " about": [[883], [" about"]],
  " accepted": [[11330], [" accepted"]],
  " already": [[2582], [" already"]],
  " as": [[430], [" as"]],
  " bright": [[9613], [" bright"]],
  " calm": [[18717], [" calm"]],
  " eager": [[22806], [" eager"]],
  " en": [[644], [" en"]],
  " excitement": [[26382], [" excitement"]],
  " her": [[1024], [" her"]],
  " if": [[413], [" if"]],
  " it": [[424], [" it"]],
  " me": [[728], [" me"]],
  " party": [[4464], [" party"]],
  " tell": [[3184], [" tell"]],
  " the": [[279], [" the"]],
  " tonight": [[17377], [" tonight"]],
  " won": [[2677], [" won"]],
  " you": [[488], [" you"]],
  "'t": [[914], ["'t"]],
  ",": [[11], [","]],
  ".": [[13], ["."]],
  ":": [[25], [":"]],
  "</": [[510], ["</"]],
  ">": [[29], [">"]],
  ">.": [[13867], [">."]],
  ">Promise": [[29, 20396], [">", "Promise"]],
  ">about": [[29, 8823], [">", "about"]],
  ">her": [[29, 1858], [">", "her"]],
  ">me": [[29, 2573], [">", "me"]],
  ">party": [[29, 31864], [">", "party"]],
  ">tell": [[58688, 598], [">t", "ell"]],
  ">the": [[29, 1719], [">", "the"]],
  ">tonight": [[29, 752, 481], [">", "ton", "ight"]],
  ">won": [[15821, 263], [">w", "on"]],
  ">you": [[29, 9053], [">", "you"]],
  "]": [[60], ["]"]],
  "emphasis": [[83218], ["emphasis"]],
  "gasps": [[38217, 1630], ["gas", "ps"]],
  "icy": [[2749], ["icy"]],
  "language": [[11197], ["language"]],
  "laughs": [[69997], ["laughs"]],
  "pause": [[26558], ["pause"]],
  "sighs": [[82, 1055, 82], ["s", "igh", "s"]],
  "slow": [[34045], ["slow"]],
  "whisper": [[1266, 26483], ["wh", "isper"]],
  "with": [[4058], ["with"]],
}

export const FIXED = {"sysStart": 3, "refInstr": 11, "ttsInstr": 6, "refHeader": 30, "msgEnd": 2, "userStart": 3, "genStart": 4} as const

export const SPEAKER_IDS: Record<string, number> = { "<|speaker:0|>": 248083, "<|speaker:1|>": 248084 }
