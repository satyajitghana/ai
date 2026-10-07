"""Sound for a math reel: a calm ambient pad, gentle ticks on events, and an
optional narration track.

    python audio.py events.json out.wav          the bed (and the voice, if events.json lists it)
    python audio.py tts --in lines.json --out DIR [--voice af_heart] [--allow-guess]
        lines.json = {"107": ["spoken line", ...], ...}. Kokoro-82M on CPU (the
        Windows farm's venv has it); each line is cached as DIR/<hash>.wav, the
        hash taking the voice, the speed and the text as actually said, so an
        unchanged line is never re-voiced. Prints {"107": [{"text", "wav", "sec"}]}.
    python audio.py speak "text"                 what the voice will be given (offline)
    python audio.py words --in lines.json        names the voice would guess at (needs misaki)

events.json may carry "voice": [{"t": 0.3, "wav": "DIR/abcd.wav"}]: each line
is placed at its time and the music is ducked about 10 dB under it.

events.json = {"id": "107", "duration": 19.2, "events": [{"t": 2.6, "kind": "cut"}, ...]}
(render.mjs writes it from REEL.load). Kinds: cut (scene change), tick (a
marker lands), land (the result lands), stamp (the claim stamp), badge
(verification badge).

Nothing sampled: every musical sound is synthesized here from sine
partials and filtered noise, seeded by the family id, so a spec always sounds
the same. Ideas follow explainer-films/audio.py (pads, one-pole filters,
synthesized effects), but nothing is imported from it: that file is hashed
into every explainer film's freshness check. Needs numpy only.
"""
import argparse, hashlib, json, os, re, sys, wave
import numpy as np

SR = 48000
VSR = 24000          # Kokoro's rate
SPEED = 1.1          # as explainer-films: Kokoro at 1.0 is slow for a reel
VOICE = "af_heart"


# ---------------------------------------------------------------- speech
# Copied from explainer-films/audio.py (not imported: that file is hashed into
# every explainer film), with a math table instead of the model-name one.
_P = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "pronounce.json"), encoding="utf-8"))
SAY = {k: v for k, v in _P.get("say", {}).items()}
PHON = {k: v for k, v in _P.get("phonemes", {}).items()}
_SAY = re.compile(r"(?<![\w])(" + "|".join(re.escape(k) for k in sorted(SAY, key=len, reverse=True)) + r")(?![\w])") if SAY else None
_PHON = re.compile(r"(?<![\w.])(" + "|".join(re.escape(k) for k in sorted(PHON, key=len, reverse=True)) + r")((?:'|’)s)?(?![\w])") if PHON else None


def _ph(m):
    w, poss = m.group(1), m.group(2)
    ph = PHON[w]
    if poss:
        ph += "s" if ph[-1] in "ptkfθ" else "z"
    return f"[{w}{poss or ''}](/{ph}/)"


def speakable(s):
    s = s.replace("ai.thesatyajit.com", "ai dot the satyajit dot com")
    s = s.replace("—", ", ").replace("–", " to ").replace("&", " and ").replace("%", " percent")
    if _SAY:
        s = _SAY.sub(lambda m: SAY[m.group(1)], s)
    s = re.sub(r"[\[\]{}()<>`_*|\\$^]", " ", s)
    if _PHON:
        s = _PHON.sub(_ph, s)
    s = re.sub(r"\)-(?=\w)", ") ", s)
    return re.sub(r"\s+", " ", s).strip()


def line_key(voice, text):
    return hashlib.sha1(json.dumps([voice, SPEED, speakable(text)], ensure_ascii=False).encode()).hexdigest()[:16]


def guessed_names(texts):
    from misaki import en
    g2p = en.G2P(trf=False, british=False, fallback=None)
    out = set()
    for s in texts:
        for t in g2p(speakable(s))[1]:
            if (t.phonemes is None or "❓" in t.phonemes) and re.search(r"[A-Z0-9]", t.text):
                out.add(t.text)
    return sorted(out)


def trim(y, sr, thr=0.01):
    idx = np.where(np.abs(y) > thr)[0]
    if not len(idx):
        return y
    a, b = max(0, idx[0] - int(.03 * sr)), min(len(y), idx[-1] + int(.08 * sr))
    return y[a:b]


def tts(args):
    todo = json.load(open(args.inp, encoding="utf-8"))
    names = guessed_names([l for lines in todo.values() for l in lines]) if not args.allow_guess else []
    if names:
        sys.exit("The voice does not know how to say: " + ", ".join(names) + ". Add them to pronounce.json (or pass --allow-guess).")
    os.makedirs(args.out, exist_ok=True)
    pipe, out = None, {}
    for rid, lines in todo.items():
        out[rid] = []
        for line in lines:
            k = line_key(args.voice, line)
            wav = os.path.join(args.out, k + ".wav")
            if not os.path.exists(wav):
                if pipe is None:
                    from kokoro import KPipeline
                    pipe = KPipeline(lang_code="a")
                chunks = [a for _, _, a in pipe(speakable(line), voice=args.voice, speed=SPEED)]
                y = np.concatenate([c.numpy() if hasattr(c, "numpy") else np.asarray(c) for c in chunks]) if chunks else np.zeros(1, np.float32)
                write_mono(wav, trim(y, VSR), VSR)
            y, sr = read_mono(wav)
            out[rid].append({"text": line, "wav": wav, "sec": round(len(y) / sr, 3)})
    print(json.dumps(out, ensure_ascii=False))


def write_mono(path, y, sr):
    pcm = np.clip(np.asarray(y, np.float64), -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((pcm * 32767).astype("<i2").tobytes())


def read_mono(path):
    with wave.open(path, "rb") as w:
        sr, n, ch = w.getframerate(), w.getnframes(), w.getnchannels()
        y = np.frombuffer(w.readframes(n), "<i2").astype(np.float64) / 32767
    if ch > 1:
        y = y.reshape(-1, ch).mean(1)
    return y, sr


def voice_track(lines, n):
    """The narration at SR, placed at its times; and a 0..1 'someone is talking' envelope."""
    v = np.zeros(n)
    for l in lines:
        y, sr = read_mono(l["wav"])
        if sr != SR:
            y = np.interp(np.arange(int(len(y) * SR / sr)) * sr / SR, np.arange(len(y)), y)
        place(v, y, float(l["t"]))
    a = np.abs(v)
    peak = np.max(a) or 1
    v *= 10 ** (-3 / 20) / peak                      # speech peaks at -3 dBFS
    # envelope: 150 ms lookahead/hold, smoothed both ways so the duck breathes
    k = int(.15 * SR)
    talk = (onepole(a, .9995) > .02 * peak).astype(float)
    talk = np.convolve(talk, np.ones(k) / k, "same")
    talk = np.clip(onepole(talk[::-1], .9993)[::-1] * 1.6, 0, 1)
    return v, talk


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def onepole(x, a):
    """Lowpass y[n] = a*y[n-1] + (1-a)*x[n], a in (0, 1): larger is darker.
    Applied as its impulse response, truncated where a^k drops below 1e-7."""
    taps = int(np.ceil(np.log(1e-7) / np.log(a))) + 1
    h = (1 - a) * a ** np.arange(taps)
    return fftconv(x, h)


def pad_note(freq, dur, rng, attack=2.4, release=2.0, bright=0.35):
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(t)
    for h, amp in ((1, 1.0), (2, bright), (3, bright * .45), (4, bright * .2)):
        for det in (-3.5, 0.0, 3.5):  # cents
            f = freq * h * 2 ** (det / 1200)
            ph = rng.uniform(0, 2 * np.pi)
            out += amp / 3 * np.sin(2 * np.pi * f * t + ph)
    lfo = 1 + .18 * np.sin(2 * np.pi * rng.uniform(.05, .11) * t + rng.uniform(0, 6.28))
    env = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, (dur - t) / release))
    return out * lfo * env ** 1.6


def chime(freq, dur=1.6, amp=1.0):
    t = np.arange(int(dur * SR)) / SR
    y = (np.sin(2 * np.pi * freq * t) + .32 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 7)
         + .12 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 12))
    return amp * y * np.exp(-t * 3.2) * np.minimum(1, t / .004)


def thump(dur=.5):
    t = np.arange(int(dur * SR)) / SR
    f = 46 + 50 * np.exp(-t * 18)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * np.minimum(1, t / .003)


def place(buf, sig, t):
    i = int(round(t * SR))
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[:j - i]


def fftconv(x, h):
    n = len(x) + len(h) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(h, m), m)[:len(x)]


def main(ev_path, out_path):
    spec = json.load(open(ev_path, encoding="utf-8"))
    dur = float(spec["duration"])
    seed = int(spec.get("id", "0")) or 1
    rng = np.random.default_rng(seed)
    n = int(round(dur * SR))
    music = np.zeros(n)
    # two chords, D major 9 then B minor 9, crossfading at the middle of the reel
    chords = [[50, 57, 61, 64, 66], [47, 54, 57, 61, 62]]
    half = dur * .55
    for k, ch in enumerate(chords):
        start = 0 if k == 0 else half - 2.5
        length = (half + 1.5) if k == 0 else dur - start
        for m in ch:
            place(music, .085 * pad_note(midi(m), length, rng, attack=2.6 if k == 0 else 3.0, release=2.4), start)
    # low drone on the root, very quiet
    place(music, .06 * pad_note(midi(38), dur, rng, attack=3, release=2.5, bright=.15), 0)
    music = onepole(music, .55)
    # air: filtered noise, barely there
    air = onepole(rng.standard_normal(n), .92) - onepole(rng.standard_normal(n), .995)
    music += .004 * air
    # events: pentatonic notes over D, picked deterministically
    fx = np.zeros(n)
    scale = [74, 76, 78, 81, 83, 86, 88]
    for i, e in enumerate(spec.get("events", [])):
        t, kind = float(e["t"]), e["kind"]
        if kind == "cut":
            place(fx, .10 * chime(midi(86), 1.2), t)
        elif kind == "tick":
            place(fx, .07 * chime(midi(scale[int(rng.integers(0, len(scale)))]), .9), t)
        elif kind == "land":
            place(fx, .11 * chime(midi(81), 1.8), t)
            place(fx, .08 * chime(midi(88), 1.8), t + .09)
        elif kind == "stamp":
            place(fx, .30 * thump(), t)
            place(fx, .09 * chime(midi(74), 1.6), t + .02)
        elif kind == "badge":
            place(fx, .09 * chime(midi(78), 1.6), t)
            place(fx, .07 * chime(midi(83), 1.6), t + .12)
    dry = music + fx
    # stereo reverb from decaying noise impulse responses
    ir_len = int(2.2 * SR)
    ti = np.arange(ir_len) / SR
    irs = [onepole(rng.standard_normal(ir_len), .35) * np.exp(-ti * 2.6) for _ in range(2)]
    irs = [h / np.sqrt(np.sum(h ** 2)) for h in irs]
    wet = [fftconv(dry, h) for h in irs]
    L = .78 * dry + .45 * wet[0]
    R = .78 * dry + .45 * wet[1]
    st = np.stack([L, R], 1)
    tt = np.arange(n) / SR
    fade = np.minimum(1, tt / .8) * np.minimum(1, np.maximum(0, (dur - tt) / 1.2))
    st *= fade[:, None]
    st -= st.mean(0)
    peak = np.max(np.abs(st)) or 1
    rms = np.sqrt(np.mean(st ** 2)) or 1
    gain = min(.6 / peak, 10 ** (-22 / 20) / rms)  # quiet: peak at most -4.4 dBFS, RMS about -22 dBFS
    st = st * gain
    if spec.get("voice"):
        v, talk = voice_track(spec["voice"], n)
        duck = 1 - (1 - 10 ** (-10 / 20)) * talk     # music about 10 dB under speech
        st = st * duck[:, None] + v[:, None]
    pcm = np.clip(st, -.98, .98)
    with wave.open(out_path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((pcm * 32767).astype("<i2").tobytes())
    print(json.dumps({"id": spec.get("id"), "wav": out_path, "seconds": round(n / SR, 3), "events": len(spec.get("events", []))}))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("tts", "words", "speak"):
        ap = argparse.ArgumentParser()
        ap.add_argument("mode"); ap.add_argument("text", nargs="?")
        ap.add_argument("--in", dest="inp"); ap.add_argument("--out"); ap.add_argument("--voice", default=VOICE)
        ap.add_argument("--allow-guess", action="store_true")
        a = ap.parse_args()
        if a.mode == "speak":
            print(speakable(a.text or ""))
        elif a.mode == "words":
            print("\n".join(guessed_names([l for ls in json.load(open(a.inp, encoding="utf-8")).values() for l in ls])))
        else:
            tts(a)
    elif len(sys.argv) == 3:
        main(sys.argv[1], sys.argv[2])
    else:
        sys.exit(__doc__)
