// Narration timing for math reels: pure functions, no I/O, so the logic is
// checked offline with fake durations (voice.test.mjs) and the Windows farm
// only adds the real ones from Kokoro.
//
//   spec.voice = [{ scene, text, at? }]   spoken lines, written as speech
//   durations  = [seconds per line]       from audio.py tts (or estimate())
//
// fitVoice(spec, secs) lengthens any scene too short for its lines (never
// shortens one) and returns the new scene durations; placeVoice(scenes, spec,
// secs) turns lines into absolute start times; vtt() writes the captions.

export const SCENES = ['title', 'object', 'proof', 'achievement', 'verify', 'end']
export const LEAD = 0.3      // the cut lands before the voice
export const GAP = 0.15      // between two lines in one scene
export const TAIL = 0.25     // after the last line, before the next cut
// scene duration ranges and defaults: these mirror DUR / DUR_PROOF in engine/reel.js
export const DUR = { title: [2, 3, 2.6], object: [6, 9, 8], proof: [5, 6, 5.5], achievement: [3, 5, 4.4], verify: [2, 3, 2.6], end: [1.2, 2, 1.6] }
export const DUR_PROOF = { title: 2.5, object: 6, proof: 5.5, achievement: 3.5, verify: 2, end: 1.2 }
export const TOTAL_MAX = 21, TOTAL_MIN = 15

const words = s => String(s).trim().split(/\s+/).filter(Boolean).length
// Kokoro at speed 1.1 says about 3 words a second; used by `plan` on machines
// without the voice, and reported as an estimate
export const estimate = text => +(words(text) / 3.0 + 0.25).toFixed(2)

export function checkVoice(spec) {
  const errs = [], warns = []
  const v = spec.voice
  if (v == null) return { errs, warns }
  if (!Array.isArray(v) || !v.length) { errs.push('voice must be a non-empty array of {scene, text}'); return { errs, warns } }
  v.forEach((l, i) => {
    if (!SCENES.includes(l.scene)) errs.push(`voice.${i}.scene must be one of ${SCENES.join(', ')}`)
    if (l.scene === 'proof' && !spec.proof) errs.push(`voice.${i} is for the proof scene, but the spec has no proof`)
    if (!l.text || typeof l.text !== 'string') errs.push(`voice.${i}.text is empty`)
    else if (/[$\\{}^_=<>≤≥∞→]/.test(l.text)) errs.push(`voice.${i}.text must be written as speech, no TeX or symbols: "${l.text}"`)
  })
  const n = v.reduce((s, l) => s + words(l.text || ''), 0)
  if (n > 60) errs.push(`voice is ${n} words; a 20 s reel holds about 40-55`)
  else if (n < 30) warns.push(`voice is only ${n} words; aim for 40-55`)
  return { errs, warns }
}

export function sceneDurations(spec) {
  const P = !!spec.proof
  const out = {}
  for (const s of SCENES) {
    if (s === 'proof' && !P) continue
    const sc = s === 'end' ? spec.end || {} : spec[s] || {}
    out[s] = sc.dur != null ? sc.dur : P ? DUR_PROOF[s] : DUR[s][2]
  }
  return out
}

// What each scene needs to hold its lines.
export function need(spec, secs) {
  const byScene = {}
  spec.voice.forEach((l, i) => { (byScene[l.scene] ||= []).push({ ...l, sec: secs[i] }) })
  const out = {}
  for (const [s, ls] of Object.entries(byScene)) {
    let t = 0
    ls.forEach((l, k) => { const st = l.at != null ? l.at : (k ? t + GAP : LEAD); t = st + l.sec })
    out[s] = +(t + TAIL).toFixed(2)
  }
  return out
}

// When lengthening pushes the reel past TOTAL_MAX, time is taken back from
// scenes with slack, in this order, never below the scene's minimum or below
// what its own lines need. The object scene is never shortened: its panels,
// beats and slides are timed in the spec.
export const RECLAIM = ['end', 'verify', 'title', 'achievement', 'proof']

// Lengthen scenes to fit the voice, then reclaim slack if the total runs
// over. Returns { durs, changed, total, errs }; errs is non-empty only when
// the lines cannot fit at all (the render then fails that reel cleanly).
export function fitVoice(spec, secs) {
  const errs = [], changed = {}
  const durs = sceneDurations(spec), req = need(spec, secs)
  for (const [s, r] of Object.entries(req)) {
    const [, max] = DUR[s]
    if (r > durs[s] + 1e-9) {
      const nd = Math.ceil(r * 10 - 1e-6) / 10
      if (nd > max + 1e-9) errs.push(`voice for ${s} needs ${r.toFixed(2)} s, but ${s} can be at most ${max} s; shorten the line`)
      else { changed[s] = [durs[s], nd]; durs[s] = nd }
    }
  }
  const sum = () => +Object.values(durs).reduce((a, b) => a + b, 0).toFixed(2)
  for (const s of RECLAIM) {
    const over = sum() - TOTAL_MAX
    if (over <= 1e-6) break
    if (durs[s] == null) continue
    const floor = Math.max(DUR[s][0], req[s] != null ? Math.ceil(req[s] * 10 - 1e-6) / 10 : 0)
    const nd = +Math.max(floor, durs[s] - Math.ceil(over * 10 - 1e-6) / 10).toFixed(2)
    if (nd < durs[s] - 1e-9) { changed[s] = [changed[s] ? changed[s][0] : durs[s], nd]; durs[s] = nd }
  }
  const total = sum()
  if (total > TOTAL_MAX + 1e-6) errs.push(`with the voice the reel is ${total.toFixed(2)} s, over ${TOTAL_MAX} s even with every other scene at its minimum; shorten lines or object.dur (${Object.entries(durs).map(([k, v]) => `${k} ${v}`).join(', ')})`)
  if (total < TOTAL_MIN - 1e-6) errs.push(`the reel is ${total.toFixed(2)} s, under ${TOTAL_MIN} s`)
  return { durs, changed, total: +total.toFixed(2), errs }
}

// Write the fitted durations back into a copy of the spec.
export function applyDurs(spec, durs) {
  const s = JSON.parse(JSON.stringify(spec))
  for (const [k, d] of Object.entries(durs)) { if (k === 'end') s.end = { ...(s.end || {}), dur: d }; else s[k] = { ...s[k], dur: d } }
  return s
}

// Absolute start times, given the engine's scene table [{name, t0, t1}].
export function placeVoice(scenes, spec, secs) {
  const at = Object.fromEntries(scenes.map(s => [s.name, s]))
  const out = [], cursor = {}
  spec.voice.forEach((l, i) => {
    const sc = at[l.scene]
    const local = l.at != null ? l.at : cursor[l.scene] != null ? cursor[l.scene] + GAP : LEAD
    cursor[l.scene] = local + secs[i]
    out.push({ i, scene: l.scene, text: l.text, t: +(sc.t0 + local).toFixed(3), end: +(sc.t0 + local + secs[i]).toFixed(3) })
  })
  return out
}

// WebVTT from the placed lines; long lines split into cues of ~12 words,
// timed by their share of the words.
const ts = x => { const h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, s = x - 60 * Math.floor(x / 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}` }
export function vtt(placed) {
  const cues = []
  for (const p of placed) {
    const w = p.text.trim().split(/\s+/), n = Math.ceil(w.length / 12), per = Math.ceil(w.length / n)
    for (let k = 0; k < n; k++) {
      const part = w.slice(k * per, (k + 1) * per), a = k * per / w.length, b = Math.min(1, (k + 1) * per / w.length)
      cues.push([p.t + a * (p.end - p.t), p.t + b * (p.end - p.t), part.join(' ')])
    }
  }
  return 'WEBVTT\n\n' + cues.map(([a, b, tx], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${tx}\n`).join('\n')
}
