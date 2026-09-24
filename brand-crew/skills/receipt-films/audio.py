"""Sound for Receipts films: narration, sound effects and a score, all made here.

    python3 audio.py tts  --in lines.json --out DIR [--voice af_heart]
        lines.json = {slug: [line, ...]}; writes DIR/<slug>/<i>.wav and
        DIR/durations.json = {slug: [seconds, ...]}. Kokoro-82M (Apache-2.0)
        on CPU; the model loads once per call, so pass every film at once.
    python3 audio.py mix --film film.json --voice DIR/<slug> --out audio.m4a --vtt captions.vtt
        film.json is the renderer's line for one film: duration, scenes with
        voiceAt, events, lines. Places each narration line at its scene's
        voiceAt, a synthesized effect at every event, and a score under it all,
        ducked while anyone is talking.

Nothing is sampled or licensed from anywhere: every effect and every note of
the score is synthesized below from sine waves, noise and a plucked-string
model, seeded by the film's slug, so the same storyboard always sounds the same.
"""
import argparse, hashlib, json, math, os, re, subprocess, sys
import numpy as np

SR = 24000  # Kokoro's rate; everything is mixed at it


# ---------------------------------------------------------------- speech
UNITS = [
    (r"(\d)\s?tok/s\b", r"\1 tokens per second"),
    (r"(\d)\s?ms\b", r"\1 milliseconds"),
    (r"(\d)\s?s\b", r"\1 seconds"),
    (r"(\d)\s?GiB\b", r"\1 gigabytes"), (r"(\d)\s?GB\b", r"\1 gigabytes"),
    (r"(\d)\s?MiB\b", r"\1 megabytes"), (r"(\d)\s?MB\b", r"\1 megabytes"),
    (r"(\d)\s?KB\b", r"\1 kilobytes"), (r"(\d)\s?TB\b", r"\1 terabytes"),
    (r"(\d)B\b", r"\1 billion"), (r"(\d)M\b", r"\1 million"), (r"(\d)[kK]\b", r"\1 thousand"),
    (r"(\d)\s?[x×]\b", r"\1 times"), (r"(\d)\s?[x×](?=\s|$|[.,;])", r"\1 times"),
    (r"(\d)\s?%", r"\1 percent"),
    (r"(\d+)\s?/\s?(\d+)", r"\1 of \2"),
    (r"#(\d+)", r"number \1"),
]
def speakable(s):
    s = s.replace("ai.thesatyajit.com", "ai dot the satyajit dot com")
    s = s.replace("~", "about ").replace("≈", "about ").replace("—", ", ").replace("–", " to ")
    s = s.replace("→", " to ").replace("&", " and ")
    for a, b in UNITS:
        s = re.sub(a, b, s)
    s = re.sub(r"\bvs\.?\b", "versus", s)
    s = re.sub(r"[\[\]{}()<>`_*|\\]", " ", s)   # code punctuation reads as noise
    return re.sub(r"\s+", " ", s).strip()

def tts(args):
    from kokoro import KPipeline
    import soundfile as sf
    pipe = KPipeline(lang_code="a")
    todo = json.load(open(args.inp))
    os.makedirs(args.out, exist_ok=True)
    dpath = os.path.join(args.out, "durations.json")
    durs = json.load(open(dpath)) if os.path.exists(dpath) else {}
    for slug, lines in todo.items():
        d = os.path.join(args.out, slug)
        key = hashlib.sha1(json.dumps([args.voice, lines]).encode()).hexdigest()[:12]
        if durs.get(slug, {}).get("key") == key and all(os.path.exists(os.path.join(d, f"{i}.wav")) for i in range(len(lines))):
            continue
        os.makedirs(d, exist_ok=True)
        out = []
        for i, line in enumerate(lines):
            chunks = [a for _, _, a in pipe(speakable(line), voice=args.voice, speed=1.0)]
            y = np.concatenate([c.numpy() if hasattr(c, "numpy") else np.asarray(c) for c in chunks]) if chunks else np.zeros(1, np.float32)
            y = trim(y)
            sf.write(os.path.join(d, f"{i}.wav"), y, SR)
            out.append(round(len(y) / SR, 3))
        durs[slug] = {"key": key, "voice": args.voice, "sec": out}
        json.dump(durs, open(dpath, "w"), indent=1)
        print(json.dumps({"slug": slug, "sec": out}), flush=True)

def trim(y, thr=0.01):
    idx = np.where(np.abs(y) > thr)[0]
    if not len(idx): return y
    a, b = max(0, idx[0] - int(.03 * SR)), min(len(y), idx[-1] + int(.08 * SR))
    return y[a:b]


# ---------------------------------------------------------------- synthesis
def t_(dur): return np.arange(int(dur * SR)) / SR
def env(n, a=.005, d=.2, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * curve / max(d, 1e-3))
    return e
def noise(rng, n): return rng.standard_normal(n)
def onepole(x, a):  # simple lowpass, a in (0,1): larger = darker
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc = acc + (1 - a) * (x[i] - acc); y[i] = acc
    return y
def bandnoise(rng, n, lo, hi):
    # cheap band-limited noise: FFT mask
    X = np.fft.rfft(noise(rng, n)); f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(X, n); return y / (np.max(np.abs(y)) + 1e-9)
def sweep_noise(rng, dur, f0, f1, f2):
    n = int(dur * SR); y = np.zeros(n); seg = 256
    for i in range(0, n, seg):
        k = i / n; f = f0 + (f1 - f0) * min(1, k * 2) if k < .5 else f1 + (f2 - f1) * (k - .5) * 2
        y[i:i + seg] = bandnoise(rng, seg * 4, f * .6, f * 1.6)[:len(y[i:i + seg])]
    return y
def pluck(freq, dur, rng, bright=.5):
    n = int(dur * SR); N = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, N); y = np.empty(n)
    for i in range(n):
        y[i] = buf[i % N]
        buf[i % N] = (1 - bright * .5) * .5 * (buf[i % N] + buf[(i + 1) % N]) + bright * .5 * buf[i % N] * .996
    return y * env(n, .002, dur * .6, 3)
def tone(freq, dur, harm=(1, .3, .12), a=.004, d=.5):
    t = t_(dur); y = sum(h * np.sin(2 * math.pi * freq * (k + 1) * t) for k, h in enumerate(harm))
    return y * env(len(t), a, d, 4)

def sfx(kind, rng, **kw):
    if kind == "pop":        # the punch: a paper thwack
        n = int(.18 * SR); t = t_(.18)
        y = .7 * bandnoise(rng, n, 300, 4000) * env(n, .001, .05, 6) + .8 * np.sin(2 * math.pi * (180 - 400 * t) * t) * env(n, .001, .08, 5)
        return y * .9
    if kind == "boing":
        t = t_(.35); f = 330 + 160 * np.sin(2 * math.pi * 7 * t) * np.exp(-6 * t)
        return .45 * np.sin(2 * math.pi * np.cumsum(f) / SR) * env(len(t), .003, .15, 3)
    if kind == "whoosh":
        y = sweep_noise(rng, .5, 300, 2200, 600); return .5 * y * np.sin(np.linspace(0, math.pi, len(y))) ** 1.5
    if kind == "slide":
        n = int(.32 * SR); return .35 * onepole(noise(rng, n), .75) * np.sin(np.linspace(0, math.pi, n)) ** 2
    if kind == "scratch":    # a pen loop
        n = int(.5 * SR); y = bandnoise(rng, n, 2200, 6500)
        am = np.abs(np.sin(2 * math.pi * 11 * np.arange(n) / SR + rng.uniform(0, 3))) ** 2
        return .35 * y * am * np.sin(np.linspace(0, math.pi, n)) ** .5
    if kind == "thunk":      # a rubber stamp
        n = int(.35 * SR); t = t_(.35)
        return .9 * np.sin(2 * math.pi * (95 - 40 * t) * t) * env(n, .002, .12, 5) + .5 * bandnoise(rng, n, 150, 2500) * env(n, .001, .03, 8)
    if kind == "count":      # an odometer
        out = np.zeros(int(.7 * SR))
        for i in range(10):
            k = i / 9; at = int(.65 * (1 - (1 - k) ** 2) * SR)
            c = tone(1800 + 60 * i, .03, (1,), .0005, .01) * .25
            out[at:at + len(c)] += c[:len(out) - at]
        return out
    if kind == "grow":       # a bar tearing across
        n = int(.75 * SR); y = bandnoise(rng, n, 600, 5000) * (.3 + .7 * (rng.uniform(0, 1, n) > .6))
        return .22 * y * np.linspace(1, .3, n)
    if kind in ("tick", "ticks"):
        count, span = (kw.get("n", 1), kw.get("span", 0)) if kind == "ticks" else (1, 0)
        count = max(1, min(int(count), 24)); out = np.zeros(int((span + .1) * SR) + 1)
        for i in range(count):
            at = int(span * (1 - (1 - i / max(1, count - 1)) ** 2) * SR) if count > 1 else 0
            c = (tone(2400 + 40 * (i % 5), .025, (1, .2), .0005, .01) * .22 + .15 * bandnoise(rng, 600, 3000, 8000)[:int(.025 * SR)] * env(int(.025 * SR), .0005, .01, 6))
            out[at:at + len(c)] += c[:len(out) - at]
        return out
    if kind == "ding":       # a soft bell under the verdict
        t = t_(1.4); y = sum(a * np.sin(2 * math.pi * 880 * r * t) * np.exp(-t * d) for r, a, d in [(1, .5, 3), (2.76, .2, 5), (5.4, .08, 8)])
        return .3 * y * env(len(t), .002, 1.2, 1.5)
    if kind == "print":      # a receipt printer
        span = kw.get("span", 1.5); n = int(span * SR); t = np.arange(n) / SR
        buzz = bandnoise(rng, n, 900, 4000) * (np.sin(2 * math.pi * 32 * t) > 0)
        stops = np.ones(n)
        for s in np.arange(.35, span, .35): stops[int(s * SR):int((s + .06) * SR)] = .15
        return .16 * buzz * stops * np.minimum(1, np.minimum(t / .05, (span - t) / .1))
    return np.zeros(1)


# ---------------------------------------------------------------- the score
NOTES = {"C": 0, "D": 2, "Eb": 3, "E": 4, "F": 5, "G": 7, "A": 9, "Bb": 10}
def midi(n): return 440 * 2 ** ((n - 69) / 12)
def score(dur, seed, punches):
    """A small paper-soft loop at 120 bpm: electric-piano chords, a plucked
    arpeggio, a round bass and brushed drums, all synthesized. Drum hits land
    on the punch cuts, then settle into the beat."""
    rng = np.random.default_rng(seed)
    n = int((dur + 1) * SR); mix = np.zeros(n)
    key = list(NOTES.values())[seed % len(NOTES)] + 48
    prog = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]]   # Imaj7 vi IV V
    if seed % 2: prog = [prog[1], prog[2], prog[0], prog[3]]
    beat = .5; bar = 4 * beat
    start = max(punches) + .36 if punches else 0
    def put(y, at, g):
        i = int(at * SR)
        if i >= n: return
        mix[i:i + len(y)] += g * y[:n - i]
    for hit in punches:
        put(sfx("thunk", rng) * .6, hit, .5)
    t = start; b = 0
    while t < dur:
        ch = prog[(b // 1) % 4]
        for off in (0, 1.5 * beat):   # keys: on one and the and-of-two
            for k, iv in enumerate(ch):
                put(tone(midi(key + 12 + iv), 1.2, (1, .35, .1, .05), .006, .8), t + off + k * .008, .045)
        for s in range(8):           # arpeggio in eighths
            iv = ch[[0, 1, 2, 3, 2, 1, 2, 3][s]]
            put(pluck(midi(key + 24 + iv), .5, rng, .4), t + s * beat / 2, .05 * (.7 + .3 * (s % 2 == 0)))
        put(tone(midi(key - 12 + ch[0]), 1.0, (1, .15), .01, .6), t, .16)
        put(tone(midi(key - 12 + ch[0]), .5, (1, .15), .01, .3), t + 2.5 * beat, .1)
        for q in range(4):           # drums
            at = t + q * beat
            if q in (0, 2):
                tt = t_(.14); put(np.sin(2 * math.pi * (70 - 120 * tt) * tt) * env(len(tt), .001, .08, 4), at, .35)
            else:
                m = int(.12 * SR); put(bandnoise(rng, m, 1200, 6000) * env(m, .001, .05, 5), at, .06)
            m = int(.05 * SR); put(bandnoise(rng, m, 5000, 11000) * env(m, .0005, .02, 6), at + beat / 2, .03)
        t += bar; b += 1
    # paper crackle
    for _ in range(int(dur * 3)):
        at = rng.uniform(0, dur); put(bandnoise(rng, 120, 2000, 9000) * .5, at, .015)
    fade = np.ones(n); f0 = int(max(0, dur - 1.2) * SR); fade[f0:] = np.linspace(1, 0, n - f0)
    fi = int(.08 * SR); fade[:fi] *= np.linspace(0, 1, fi)
    return mix * fade


# ---------------------------------------------------------------- mix
def load_wav(p):
    import soundfile as sf
    y, sr = sf.read(p, dtype="float32")
    if y.ndim > 1: y = y.mean(1)
    assert sr == SR, f"{p}: {sr} Hz"
    return y

def captions(lines, starts, durs):
    def ts(s): h = int(s // 3600); m = int(s % 3600 // 60); return f"{h:02d}:{m:02d}:{s % 60:06.3f}"
    out = ["WEBVTT", ""]
    for text, a, d in zip(lines, starts, durs):
        if not text or d <= 0: continue
        # split into cues of about 12 words, timed by word share
        chunks = []
        for sentence in re.split(r"(?<=[.!?])\s+", text):
            words = sentence.split()
            while words:
                take = len(words) if len(words) <= 14 else min(12, len(words) - 4)
                chunks.append(words[:take]); words = words[take:]
        total = sum(len(c) for c in chunks); t = a
        for c in chunks:
            dd = d * len(c) / total
            out += [f"{ts(t)} --> {ts(t + dd)}", " ".join(c), ""]; t += dd
    return "\n".join(out)

def mix(args):
    film = json.load(open(args.film))
    dur = film["duration"]; n = int((dur + .05) * SR)
    seed = int(hashlib.sha1(film["slug"].encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    voice = np.zeros(n); fx = np.zeros(n)
    starts, durs = [], []
    for i, sc in enumerate(film["scenes"]):
        p = os.path.join(args.voice, f"{i}.wav")
        if not os.path.exists(p): starts.append(0); durs.append(0); continue
        y = load_wav(p); at = int(sc["voiceAt"] * SR)
        y = y / (np.sqrt(np.mean(y ** 2)) + 1e-9) * .1          # level the lines
        voice[at:at + len(y)] += y[:max(0, n - at)]
        starts.append(sc["voiceAt"]); durs.append(len(y) / SR)
    punches = [e["t"] for e in film["events"] if e["type"] == "pop"]
    for e in film["events"]:
        if e["type"] == "pop": continue     # the score plays the punches
        y = sfx(e["type"], rng, **{k: v for k, v in e.items() if k not in ("t", "type")})
        at = int(max(0, e["t"]) * SR); fx[at:at + len(y)] += y[:max(0, n - at)] * .5
    music = score(dur, seed, punches)[:n]
    music = np.pad(music, (0, n - len(music)))
    # levels by measurement, not by synthesis gain: the voice sits at RMS 0.1
    # while speaking, the score ~10 dB under it and a further ~8 dB lower while
    # anyone talks, effects peaking a little under the voice's peaks
    rms = lambda x: float(np.sqrt(np.mean(x[np.abs(x) > 1e-4] ** 2))) if np.any(np.abs(x) > 1e-4) else 1.0
    music *= .032 / rms(music)
    fx *= .6 * np.max(np.abs(voice)) / (np.max(np.abs(fx)) + 1e-9)
    ve = np.abs(voice); k = int(.3 * SR)
    ve = np.convolve(ve, np.ones(k) / k, mode="same")
    duck = 1 - .6 * np.clip(ve / (np.percentile(ve[ve > 1e-4], 60) + 1e-9), 0, 1) if np.any(ve > 1e-4) else np.ones(n)
    out = voice + fx + music * duck
    print(json.dumps({"rms_voice": round(rms(voice), 4), "rms_music_open": round(rms(music), 4), "rms_fx": round(rms(fx), 4)}), file=sys.stderr)
    out = out / (np.max(np.abs(out)) + 1e-9) * .89
    tmp = args.out + ".wav"
    import soundfile as sf
    sf.write(tmp, out.astype(np.float32), SR)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR), "-ac", "1",
                    "-c:a", "aac", "-b:a", args.bitrate, args.out], check=True)
    os.remove(tmp)
    if args.vtt:
        open(args.vtt, "w").write(captions(film.get("lines", []), starts, durs))
    print(json.dumps({"slug": film["slug"], "audio": os.path.getsize(args.out)}))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("tts"); a.add_argument("--in", dest="inp", required=True); a.add_argument("--out", required=True); a.add_argument("--voice", default="af_heart")
    m = sub.add_parser("mix"); m.add_argument("--film", required=True); m.add_argument("--voice", required=True); m.add_argument("--out", required=True); m.add_argument("--vtt"); m.add_argument("--bitrate", default="48k")
    args = ap.parse_args()
    {"tts": tts, "mix": mix}[args.cmd](args)
