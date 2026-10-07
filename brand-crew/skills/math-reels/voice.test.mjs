// Offline checks of the narration timing (no voice, no browser):
//   node brand-crew/skills/math-reels/voice.test.mjs
import assert from 'node:assert/strict'
import { checkVoice, fitVoice, applyDurs, placeVoice, vtt, need, estimate, LEAD, GAP, TAIL } from './voice.mjs'

const base = { title: {}, object: { dur: 6 }, proof: { archetype: 'squeeze', steps: ['a', 'b'] }, achievement: {}, verify: {}, voice: [
  { scene: 'title', text: 'Matrix multiplication, with exponent at most nine over four.' },
  { scene: 'object', text: 'Schoolbook multiplication costs n cubed products.' },
  { scene: 'object', text: 'Since nineteen ninety the best exponent barely moved.' },
  { scene: 'proof', text: 'Two inequalities squeeze a single score from both sides.' },
  { scene: 'achievement', text: 'The claim: omega is at most nine over four.' },
  { scene: 'verify', text: 'The main theorem is checked in Lean.' },
] }

// 1. lines that fit leave every scene alone
{
  const secs = [1.8, 2.0, 2.2, 2.4, 2.0, 1.4]
  const r = fitVoice(base, secs)
  assert.deepEqual(r.errs, [])
  assert.deepEqual(r.changed, {})
  assert.equal(r.total, +(2.5 + 6 + 5.5 + 3.5 + 2 + 1.2).toFixed(2))
  assert.equal(need(base, secs).object, +(LEAD + 2.0 + GAP + 2.2 + TAIL).toFixed(2))
}
// 2. a long title line lengthens the title, rounded up to 0.1 s, within its range
{
  const secs = [2.11, 2.0, 2.2, 2.4, 2.0, 1.4]
  const r = fitVoice(base, secs)
  assert.deepEqual(r.errs, [])
  assert.deepEqual(r.changed.title, [2.5, 2.7])      // 0.3 + 2.11 + 0.25 = 2.66 -> 2.7
  const s2 = applyDurs(base, r.durs)
  assert.equal(s2.title.dur, 2.7); assert.equal(base.title.dur, undefined)   // the input spec is not mutated
}
// 3. a line that cannot fit its scene's maximum is refused
{
  const r = fitVoice(base, [2.8, 2.0, 2.2, 2.4, 2.0, 1.4])   // title would need 3.35 > 3
  assert.equal(r.errs.length, 1); assert.match(r.errs[0], /title can be at most 3 s/)
}
// 4. a voice that pushes the total past 21 s is refused
{
  const r = fitVoice(base, [2.4, 3.6, 3.5, 2.4, 3.0, 1.6])   // object 7.65 -> 7.7, ach 3.55 -> 3.6, verify 2.15 -> 2.2
  assert.ok(r.errs.some(e => /over 21 s/.test(e)), r.errs.join('; '))
}
// 4b. a long object line is paid for by slack elsewhere (title, achievement,
//     proof), never by shortening the object scene or any scene below its lines
{
  const secs = [1.8, 3.0, 3.6, 2.4, 2.0, 1.4]          // object needs 7.3 s: 22.0 s before reclaiming
  const r = fitVoice(base, secs)
  assert.deepEqual(r.errs, [])
  assert.equal(r.total, 21)
  assert.equal(r.durs.object, 7.3); assert.equal(r.durs.end, 1.2); assert.equal(r.durs.verify, 2)
  assert.equal(r.durs.title, 2.4); assert.equal(r.durs.achievement, 3); assert.equal(r.durs.proof, 5.1)
  assert.deepEqual(r.changed.title, [2.5, 2.4])
}
// 5. placement: lead, gap, scene offsets
{
  const secs = [1.8, 2.0, 2.2, 2.4, 2.0, 1.4]
  const scenes = [['title', 0, 2.5], ['object', 2.5, 8.5], ['proof', 8.5, 14], ['achievement', 14, 17.5], ['verify', 17.5, 19.5], ['end', 19.5, 20.7]].map(([name, t0, t1]) => ({ name, t0, t1 }))
  const p = placeVoice(scenes, base, secs)
  assert.equal(p[0].t, LEAD)
  assert.equal(p[1].t, +(2.5 + LEAD).toFixed(3))
  assert.equal(p[2].t, +(2.5 + LEAD + 2.0 + GAP).toFixed(3))
  for (const q of p) { const sc = scenes.find(s => s.name === q.scene); assert.ok(q.end <= sc.t1 - TAIL + 1e-9, `${q.scene} line ends at ${q.end}, scene ends ${sc.t1}`) }
  const v = vtt(p)
  assert.match(v, /^WEBVTT\n\n1\n00:00:00\.300 --> 00:00:02\.100\nMatrix multiplication/)
  assert.equal((v.match(/-->/g) || []).length, 6)
}
// 6. long lines split into ~12-word cues that tile the line's time
{
  const p = [{ t: 1, end: 7, text: Array.from({ length: 30 }, (_, i) => 'w' + i).join(' ') }]
  const cues = vtt(p).split('\n').filter(l => l.includes('-->'))
  assert.equal(cues.length, 3); assert.match(cues[0], /^00:00:01\.000 --> /); assert.match(cues[2], / --> 00:00:07\.000$/)
}
// 7. checks: speech only, scene names, word budget
{
  assert.deepEqual(checkVoice(base).errs, [])
  assert.ok(checkVoice({ ...base, voice: [{ scene: 'object', text: '$\\omega \\le 9/4$' }] }).errs.length)
  assert.ok(checkVoice({ ...base, voice: [{ scene: 'credits', text: 'hello' }] }).errs.length)
  assert.ok(checkVoice({ title: {}, voice: [{ scene: 'proof', text: 'no proof scene here' }] }).errs.length)
  assert.ok(checkVoice({ ...base, voice: [{ scene: 'object', text: 'word '.repeat(70) }] }).errs.length)
  assert.equal(estimate('one two three four five six'), 2.25)
}
console.log('voice timing: all checks pass')
