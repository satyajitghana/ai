// Build Receipts films: storyboard → narration → painted frames → score → one mp4.
//
//   node brand-crew/skills/receipt-films/build.mjs <slug ...>     these films
//   node brand-crew/skills/receipt-films/build.mjs --stale        every film whose hash changed or whose files are missing
//   node brand-crew/skills/receipt-films/build.mjs --all          everything
//   node brand-crew/skills/receipt-films/build.mjs <slug> --social --out=drafts/films
//                                                                 a 1280x720 cut for posting; not committed, no manifest
//   --workers=N  parallel render pages (default 3)
//
// Order of work, and why:
//   1. the narration lines come from the storyboard (render.mjs lines)
//   2. Kokoro speaks every line of every film in one Python process — loading
//      the model costs ~40 s, speaking costs ~0.5x real time — and caches the
//      wavs by text, so an unchanged film is never re-voiced
//   3. each scene is timed to the longer of its reading time and its speech,
//      and the frames are painted (render.mjs film, 1280x720, on twos)
//   4. audio.py places the voice, synthesizes an effect for every cue the
//      scenes emitted and a score under it all, and writes WebVTT captions
//   5. ffmpeg muxes picture and sound into public/films/<slug>.mp4
// The site cut is downscaled to 960x540 in the encoder: the article column is
// ~700 px wide, and type stays sharper than if it were painted at 960.
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { SKILL_DIR, ROOT, articleDate, filmSha } from './hash.mjs'

const args = process.argv.slice(2)
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true] }))
const SB = join(ROOT, 'data', 'films')
const MAN = join(ROOT, 'data', '.generated', 'films.json')
const social = !!opt.social
const OUT = opt.out ? join(ROOT, opt.out) : join(ROOT, 'public', 'films')
const CACHE = process.env.RECEIPTS_CACHE || join(homedir(), '.cache', 'receipt-films')
export const VOICE = 'af_heart'

const all = readdirSync(SB).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort()
const manifest = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : { films: {} }
const load = slug => JSON.parse(readFileSync(join(SB, `${slug}.json`), 'utf8'))
const shaOf = slug => filmSha(load(slug), articleDate(slug))
const stale = slug => {
  const m = manifest.films[slug]
  return !m || m.sha !== shaOf(slug) || !['.mp4', '-poster.webp', '.vtt'].every(e => existsSync(join(ROOT, 'public', 'films', slug + e)))
}

let slugs = args.filter(a => !a.startsWith('--'))
if (opt.all) slugs = all
else if (opt.stale) slugs = all.filter(stale)
for (const s of slugs) if (!all.includes(s)) throw new Error(`no storyboard: data/films/${s}.json`)
if (!slugs.length) { if (!social) save(); console.log('nothing to render'); process.exit(0) }

const tmp = join(tmpdir(), `receipts-${process.pid}`), frames = join(tmp, 'video')
mkdirSync(frames, { recursive: true }); mkdirSync(OUT, { recursive: true }); mkdirSync(CACHE, { recursive: true })
const sbPath = slug => join(tmp, `${slug}.json`)
for (const slug of slugs) writeFileSync(sbPath(slug), JSON.stringify({ ...load(slug), date: articleDate(slug) }))

const run = (cmd, a) => { const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error(`${cmd} ${a.slice(0, 3).join(' ')}: ${r.stderr}`); return r.stdout }

// 1-2. lines, then voice
console.log(`[1/3] narration for ${slugs.length} film(s)`)
const lr = spawnSync(process.execPath, [join(SKILL_DIR, 'render.mjs'), 'lines', ...slugs.map(sbPath)], { encoding: 'utf8', maxBuffer: 1 << 28 })
if (lr.status !== 0) throw new Error(lr.stderr)
const lines = JSON.parse(lr.stdout.trim().split('\n').pop())
writeFileSync(join(tmp, 'lines.json'), JSON.stringify(lines))
const tts = spawnSync('python3', [join(SKILL_DIR, 'audio.py'), 'tts', '--in', join(tmp, 'lines.json'), '--out', join(CACHE, 'voice'), '--voice', VOICE], { stdio: ['ignore', 'inherit', 'pipe'], encoding: 'utf8' })
if (tts.status !== 0) throw new Error('tts failed: ' + (tts.stderr || '').split('\n').slice(-6).join('\n'))
const durs = JSON.parse(readFileSync(join(CACHE, 'voice', 'durations.json'), 'utf8'))
for (const slug of slugs) {
  const sb = JSON.parse(readFileSync(sbPath(slug), 'utf8'))
  writeFileSync(sbPath(slug), JSON.stringify({ ...sb, _voice: durs[slug].sec }))
}

// 3-5. frames, then sound, then one file, film by film as the frames finish
console.log(`[2/3] painting ${slugs.length} film(s) on ${opt.workers || 3} page(s)`)
const flags = social ? ['--crf264=28'] : ['--scale=960', '--crf264=32']
const child = spawn(process.execPath, [join(SKILL_DIR, 'render.mjs'), 'film', ...slugs.map(sbPath), `--out=${frames}`, `--workers=${opt.workers || 3}`, ...flags], { stdio: ['ignore', 'pipe', 'inherit'] })
let buf = '', n = 0
child.stdout.on('data', d => {
  buf += d
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
    if (!line.startsWith('{')) { if (line) console.log(line); continue }
    try { finish(JSON.parse(line)) } catch (e) { console.error(`  ${JSON.parse(line).slug}: ${e.message.split('\n')[0]}`) }
  }
})
child.on('close', code => {
  if (!social) save()
  rmSync(tmp, { recursive: true, force: true })
  console.log(`[3/3] done: ${n}/${slugs.length}`)
  process.exit(code || (n === slugs.length ? 0 : 1))
})

function finish(r) {
  const slug = r.slug
  const film = join(tmp, `${slug}.film.json`), m4a = join(tmp, `${slug}.m4a`), vtt = join(OUT, `${slug}.vtt`)
  writeFileSync(film, JSON.stringify(r))
  run('python3', [join(SKILL_DIR, 'audio.py'), 'mix', '--film', film, '--voice', join(CACHE, 'voice', slug), '--out', m4a, '--vtt', vtt])
  const out = join(OUT, `${slug}.mp4`)
  run('ffmpeg', ['-v', 'error', '-y', '-i', join(frames, `${slug}.mp4`), '-i', m4a, '-map', '0:v', '-map', '1:a', '-c', 'copy', '-shortest', '-movflags', '+faststart', out])
  renameSync(join(frames, `${slug}-poster.webp`), join(OUT, `${slug}-poster.webp`))
  n++
  const size = f => statSync(f).size
  console.log(`  [${n}/${slugs.length}] ${slug}  ${r.duration}s  ${(size(out) / 1024).toFixed(0)} KB  (${r.wallS}s)`)
  if (social) return
  manifest.films[slug] = {
    sha: shaOf(slug),
    duration: r.duration,
    mp4Bytes: size(out),
    posterBytes: size(join(OUT, `${slug}-poster.webp`)),
    vttBytes: size(vtt),
    posterT: r.posterT,
    scenes: r.scenes.length,
    voice: VOICE,
    rendered: new Date().toISOString().slice(0, 10),
    transcript: r.lines.join(' '),
  }
  save()   // after every film, so an interrupted batch keeps what it finished
}

function save() {
  const sorted = {}
  for (const k of Object.keys(manifest.films).sort()) if (all.includes(k)) sorted[k] = manifest.films[k]
  mkdirSync(join(ROOT, 'data', '.generated'), { recursive: true })
  writeFileSync(MAN, JSON.stringify({ note: 'Written by brand-crew/skills/receipt-films/build.mjs. Do not edit.', films: sorted }, null, 2) + '\n')
}
