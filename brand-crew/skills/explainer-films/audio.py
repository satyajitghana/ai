"""Sound for explainer films: narration, sound effects and a score, all made here.

    python3 audio.py tts  --in lines.json --out DIR [--voice af_heart]
        lines.json = {slug: [line, ...]}; writes DIR/<slug>/<i>.wav and
        DIR/durations.json = {slug: [seconds, ...]}. Kokoro-82M (Apache-2.0)
        on CPU; the model loads once per call, so pass every film at once.
    python3 audio.py mix --film film.json --voice DIR/<slug> --out audio.m4a --vtt captions.vtt
        film.json is the renderer's line for one film: duration, beats (when
        each narration line starts), events, lines, and the style's `music`
        and `bpm`. Places each line at its beat, a synthesized effect at every
        event, and the style's score under it all, ducked while anyone talks.

Seven scores, one per visual style: paper (e-piano, pluck, brushes), lofi
(chalkboard: dusty keys, swung drums, crackle), synth (blueprint: pulse arps,
sub bass), wave (neon: detuned pads, gated snare), uke (notebook: strummed
plucks, claps, shaker), marimba (riso), chip (pixel: square lead, triangle
bass, noise drums — and chip versions of the effects).

Nothing is sampled or licensed from anywhere: every effect and every note of
the score is synthesized below from sine waves, noise and a plucked-string
model, seeded by the film's slug, so the same storyboard always sounds the same.
"""
import argparse, hashlib, json, math, os, re, subprocess, sys
import numpy as np

SR = 24000  # Kokoro's rate; everything is mixed at it
SPEED = 1.1  # Kokoro at 1.0 reads at ~2.8 words a second, slow for an explainer


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
# Words the voice gets wrong, in misaki's phoneme alphabet: Kokoro reads
# `[word](/phonemes/)` as an override. A word missing from misaki's dictionary
# is otherwise spelled out letter by letter ("Qwen" came out "Q-wen"), and some
# it knows it spells when people don't (CUDA, LiDAR). `python3 audio.py words`
# lists every narrated word the voice does not know; add those here.
PRONOUNCE = {
    "Qwen": "kwˈɛn", "Kimi": "kˈimi", "Mixtral": "mˈɪkstɹᵊl", "Ollama": "Olˈɑmə", "LLaMA": "lˈɑmə", "Kokoro": "kˈOkəɹO",
    "CUDA": "kˈudə", "ROCm": "ɹˈɑkəm", "Vulkan": "vˈʌlkən", "JAX": "ʤˈæks", "PyTorch": "pˈItˌɔɹʧ", "ONNX": "ˈɑnɪks",
    "LangChain": "lˈæŋʧˌAn", "SGLang": "ˌɛsʤˈi lˈæŋ", "llama.cpp": "lˈɑmə dˈɑt sˌipˌipˈi",
    "LiDAR": "lˈIdɑɹ", "RANSAC": "ɹˈænsæk", "COLMAP": "kˈOlmæp", "NeRF": "nˈɜɹf", "DINOv": "dˈinO vˈi",
    "ViT": "vˈɪt", "RoPE": "ɹˈOp", "SwiGLU": "swˈɪɡlu", "MoE": "ˌɛmˌOˈi", "YAML": "jˈæməl", "JSON": "ʤˈAsᵊn",
    "Gaussian": "ɡˈWsiən", "Gaussians": "ɡˈWsiənz", "softmax": "sˈɔftmˌæks", "Softmax": "sˈɔftmˌæks",
    "logits": "lˈɑʤɪts", "tokenizer": "tˈOkənˌIzəɹ", "tokenizers": "tˈOkənˌIzəɹz", "detokenize": "ditˈOkənˌIz",
    "Laguna": "læɡˈunə", "Lanyon": "lˈænjən", "Leanstral": "lˈinstɹˌɑl", "LeVJEPA": "lə vˈi ʤˈɛpə", "SIGReg": "sˈɪɡ ɹˈɛɡ", "Pareas": "pˈɛɹiəs",
    "simdjson": "sˈɪmdˌi ʤˈAsᵊn",
    "Sinkhorn": "sˈɪŋkhɔɹn", "FoX": "fˈɑks", "Zhang": "ʤˈɑŋ", "Khattab": "kətˈɑb", "HauhauCS": "hˈWhˌW sˌiˈɛs", "Hy": "ˌAʧwˈI", "HY": "ˌAʧwˈI",
    "Detokenize": "ditˈOkənˌIz",
    "Gigatoken": "ɡˈɪɡətˌOkən", "XSTest": "ˌɛksˈɛs tˈɛst", "GLiNER": "ɡlˈɪnəɹ", "GEPA": "ɡˈɛpə", "SIMD": "sˈɪmdˌi",
    "Noul": "nˈul", "Nemotron": "nˈɛmətɹˌɑn", "dMel": "dˈi mˈɛl", "Instella": "ɪnstˈɛlə", "Mobius": "mˈObiəs",
    "HumanEval": "hjˈumən ɪvˈæl", "iLLaDA": "ˈI lˈɑdə", "LLaDA": "lˈɑdə", "SWE": "swˈi",
    "Verified": "vˈɛɹəfˌId", "Unembed": "ˌʌnɛmbˈɛd", "Backpropagate": "bˌækpɹˈɑpəɡˌAt",
    "Flex-π": "flˈɛks pˈI", "π": "pˈI",
    "webctl": "wˈɛb kəntɹˈOl", "fastbrowse": "fˈæst bɹˈWz", "djev": "dˈi ʤˈɛv", "DiT": "dˈɪt", "FiLM": "fˈɪlm", "XGEN": "ˈɛks ʤˈɛn",
    "Cinference": "sˈi ˈɪnfəɹəns", "PhD": "pˌiˌAʧdˈi", "SKILL.md": "skˈɪl dˈɑt ˌɛmdˈi", "Argmax": "ˈɑɹɡmˌæks", "argmax": "ˈɑɹɡmˌæks", "ZeRO": "zˈɪɹO",
    "Limite": "lˈimitˌA", "Violetto": "vˌiOlˈɛtO", "Kev": "kˈɛv", "MoVA": "mˈOvə", "README": "ɹˈidmˌi",
    "AuK": "ˈɔk", "Omni": "ˈɑmni", "Telecom": "tˈɛləkˌɑm", "Girard": "ʒəɹˈɑɹd", "Lucene": "lusˈin", "Elasticsearch": "əlˈæstɪksˌɜɹʧ",
    "Walsh": "wˈɔlʃ", "Hadamard": "ˌhædəmˈɑɹ",
    # hosts: every film's sign-off says the host's name
    "Nacho": "nˈɑʧO", "Bramblewood": "bɹˈæmbᵊlwˌʊd", "Chive": "ʧˈIv", "Cosmo": "kˈɑzmO", "Donut": "dˈOnˌʌt",
    "Jellybean": "ʤˈɛlibˌin", "Yoyo": "jˈOjO", "Ziggy": "zˈɪɡi",
    "Fara": "fˈɑɹə", "Kalman": "kˈælmən", "Vicuna": "vɪkjˈunə", "Robomimic": "ɹˈObOmˌɪmɪk", "Extropic": "ɛkstɹˈɑpɪk", "Extropic's": "ɛkstɹˈɑpɪks",
    "Microsoft": "mˈIkɹəsˌɔft", "Tanh": "tˈænʧ", "tanh": "tˈænʧ", "Livox": "lˈIvˌɑks",
    "cuda": "kˈudə", "MNIST": "ˈɛmnˌɪst", "CIFAR": "sˈIfɑɹ", "Darwin": "dˈɑɹwᵊn", "Markov": "mˈɑɹkɔf", "DCFormer": "dˌisˈi fˈɔɹməɹ",
    "Backprop": "bˈækpɹˌɑp", "backprop": "bˈækpɹˌɑp",
    "Tencent": "tˈɛnsˈɛnt", "Hunyuan": "hwˈʊnjuˈɛn", "Alibaba": "ˌæləbˈɑbə", "Kaggle": "kˈæɡᵊl", "Gödel": "ɡˈɜdᵊl",
    "Goodfire": "ɡˈʊdfˌIəɹ", "Weng": "wˈʌŋ", "Apodex": "ˈæpədˌɛks", "GDPval": "ʤˌidˌipˈi vˈæl", "Antidoom": "ˈæntidˌum",
    "AIRA": "ˈIɹə", "ABot": "ˈAbˌɑt", "DFly": "dˈi flˈI",
    "Colibri": "kˌOlibɹˈi", "Cornell": "kɔɹnˈɛl", "Elo": "ˈilO", "Unsloth": "ʌnslˈɔθ", "Readahead": "ɹˈidəhˌɛd",
    "Jev": "ʤˈɛv", "Jev's": "ʤˈɛvz", "AgentJev": "ˈAʤənt ʤˈɛv", "Laya": "lˈɑjə", "Machina": "mˈækɪnə",
    "Arcee": "ˈɑɹsi", "cua": "sˌijˌuˈA", "Musou": "mˈusO", "Spirula": "spˈɪɹjələ", "Tinfield": "tˈɪnfˌild",
}
_PRON = re.compile(r"(?<![\w.])(" + "|".join(re.escape(k) for k in sorted(PRONOUNCE, key=len, reverse=True)) + r")((?:'|’)s)?(?![\w])")
def _say(m):
    w, poss = m.group(1), m.group(2)
    ph = PRONOUNCE[w]
    if poss and not w.endswith("'s"): ph += "s" if ph[-1] in "ptkfθ" else "z"   # a possessive, voiced or not like the word's end
    return f"[{w}{poss or ''}](/{ph}/)"

def speakable(s):
    s = s.replace("ai.thesatyajit.com", "ai dot the satyajit dot com")
    s = s.replace("~", "about ").replace("≈", "about ").replace("—", ", ").replace("–", " to ")
    s = s.replace("→", " to ").replace("&", " and ")
    for a, b in UNITS:
        s = re.sub(a, b, s)
    s = re.sub(r"\bvs\.?\b", "versus", s)
    s = re.sub(r"[\[\]{}()<>`_*|\\]", " ", s)   # code punctuation reads as noise
    # model names: "Qwen3.8-Flash-Next" is said "Qwen three point eight flash next"
    s = re.sub(r"(?<=[A-Za-z])-?(?=\d)", " ", s)   # "GLM-5.3" too, or it reads "five three"
    s = re.sub(r"(?<=[A-Za-z0-9])-(?=[A-Z])", " ", s)
    s = _PRON.sub(_say, s)
    # an override glued to a hyphen ("CIFAR-10") merges with the next word, and
    # every later override in the sentence then lands one word off
    s = re.sub(r"\)-(?=\w)", ") ", s)
    return re.sub(r"\s+", " ", s).strip()

def guessed_names(texts):
    """Names and acronyms in `texts` the voice would have to guess at."""
    from misaki import en
    g2p = en.G2P(trf=False, british=False, fallback=None)
    out = set()
    for s in texts:
        for t in g2p(speakable(s))[1]:
            if (t.phonemes is None or "❓" in t.phonemes) and re.search(r"[A-Z0-9]", t.text): out.add(t.text)
    return sorted(out)

def tts(args):
    from kokoro import KPipeline
    import soundfile as sf
    todo = json.load(open(args.inp))
    # a name the voice would guess is refused before anything is recorded
    names = guessed_names([l for lines in todo.values() for l in lines])
    if names and not args.allow_guess:
        sys.exit("The voice does not know how to say: " + ", ".join(names) + ". Add them to PRONOUNCE in audio.py (or pass --allow-guess).")
    pipe = KPipeline(lang_code="a")
    os.makedirs(args.out, exist_ok=True)
    dpath = os.path.join(args.out, "durations.json")
    durs = json.load(open(dpath)) if os.path.exists(dpath) else {}
    for slug, lines in todo.items():
        d = os.path.join(args.out, slug)
        # keyed by what is actually said, so a pronunciation fix re-voices the films it touches
        key = hashlib.sha1(json.dumps([args.voice, SPEED, [speakable(l) for l in lines]], ensure_ascii=False).encode()).hexdigest()[:12]
        if durs.get(slug, {}).get("key") == key and all(os.path.exists(os.path.join(d, f"{i}.wav")) for i in range(len(lines))):
            continue
        os.makedirs(d, exist_ok=True)
        out = []
        for i, line in enumerate(lines):
            chunks = [a for _, _, a in pipe(speakable(line), voice=args.voice, speed=SPEED)]
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
    if kind == "punch":
        return sfx("pop", rng)
    if kind == "write":      # a pen or chalk stroke across the board
        return sfx("scratch", rng) * .8
    if kind == "draw":       # an arrow being drawn: a soft rising scratch
        n = int(.45 * SR); y = bandnoise(rng, n, 1500, 5000) * np.linspace(.2, 1, n) * np.sin(np.linspace(0, math.pi, n))
        return .25 * y
    if kind == "flow":       # packets along a wire: a train of soft blips
        span = min(4.0, kw.get("span", 2)); out = np.zeros(int((span + .2) * SR))
        for i, at in enumerate(np.arange(0, span, .42)):
            c = tone(1200 + 180 * (i % 3), .06, (1, .25), .001, .04) * .3; j = int(at * SR); out[j:j + len(c)] += c[:len(out) - j]
        return out
    return np.zeros(1)

def square(freq, dur, duty_harm=9, a=.002, d=.2):
    t = t_(dur); y = sum(np.sin(2 * math.pi * freq * k * t) / k for k in range(1, duty_harm + 1, 2))
    return .8 * y * env(len(t), a, d, 3)
def tri(freq, dur, a=.004, d=.4):
    t = t_(dur); y = sum(((-1) ** ((k - 1) // 2)) * np.sin(2 * math.pi * freq * k * t) / (k * k) for k in range(1, 12, 2))
    return y * env(len(t), a, d, 2)

def chip_sfx(kind, rng, **kw):
    """The pixel style's effects: square blips instead of paper and pens."""
    if kind in ("pop", "punch"):
        return .5 * np.concatenate([square(660, .05, 7, .001, .04), square(990, .06, 7, .001, .05)])
    if kind == "boing":
        t = t_(.25); f = 300 + 900 * t
        return .35 * np.sign(np.sin(2 * math.pi * np.cumsum(f) / SR)) * env(len(t), .001, .15, 3)
    if kind == "ding":
        return .45 * np.concatenate([square(f, .09, 9, .001, .08) for f in (784, 988, 1319)])
    if kind in ("tick", "ticks", "count"):
        n = max(1, min(int(kw.get("n", 6)), 16)); span = kw.get("span", .6); out = np.zeros(int((span + .1) * SR))
        for i in range(n):
            c = square(1500 + 50 * (i % 4), .03, 5, .0005, .02) * .3; j = int(span * i / n * SR); out[j:j + len(c)] += c[:len(out) - j]
        return out
    if kind == "whoosh":
        n = int(.4 * SR); return .25 * rng.uniform(-1, 1, n) * np.linspace(1, 0, n) * (np.arange(n) % 40 < 20)
    if kind == "flow":
        span = min(4.0, kw.get("span", 2)); out = np.zeros(int((span + .2) * SR))
        for i, at in enumerate(np.arange(0, span, .42)):
            c = square(880 + 110 * (i % 4), .04, 5, .001, .03) * .25; j = int(at * SR); out[j:j + len(c)] += c[:len(out) - j]
        return out
    if kind in ("write", "draw", "scratch", "slide"):
        n = int(.2 * SR); return .12 * rng.uniform(-1, 1, n) * (np.arange(n) % 60 < 30) * np.linspace(1, 0, n)
    if kind == "grow":
        t = t_(.5); f = 200 + 600 * t
        return .2 * np.sign(np.sin(2 * math.pi * np.cumsum(f) / SR)) * env(len(t), .001, .4, 2)
    return sfx(kind, rng, **kw)


# ---------------------------------------------------------------- the score
NOTES = {"C": 0, "D": 2, "Eb": 3, "E": 4, "F": 5, "G": 7, "A": 9, "Bb": 10}
def midi(n): return 440 * 2 ** ((n - 69) / 12)
def score_paper(dur, seed, punches, bpm=120):
    """A small paper-soft loop: electric-piano chords, a plucked arpeggio, a
    round bass and brushed drums. Drum hits land on the punch cuts, then
    settle into the beat."""
    rng = np.random.default_rng(seed)
    n = int((dur + 1) * SR); mix = np.zeros(n)
    key = list(NOTES.values())[seed % len(NOTES)] + 48
    prog = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]]   # Imaj7 vi IV V
    if seed % 2: prog = [prog[1], prog[2], prog[0], prog[3]]
    beat = 60 / bpm; bar = 4 * beat
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


def _grid(dur, seed, punches, bpm):
    rng = np.random.default_rng(seed); n = int((dur + 1) * SR); mix = np.zeros(n)
    key = list(NOTES.values())[seed % len(NOTES)] + 48
    prog = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]]
    if seed % 2: prog = [prog[1], prog[2], prog[0], prog[3]]
    if seed % 3 == 0: prog = [[0, 3, 7, 10], [8, 12, 15, 19], [5, 8, 12, 15], [7, 10, 14, 17]]   # minor
    beat = 60 / bpm
    def put(y, at, g):
        i = int(at * SR)
        if 0 <= i < n: mix[i:i + len(y)] += g * y[:n - i]
    for hit in punches: put(sfx("thunk", rng) * .6, hit, .5)
    start = max(punches) + .36 if punches else 0
    return rng, n, mix, key, prog, beat, put, start
def _finish(mix, dur):
    n = len(mix); fade = np.ones(n); f0 = int(max(0, dur - 1.2) * SR); fade[f0:] = np.linspace(1, 0, n - f0)
    fi = int(.08 * SR); fade[:fi] *= np.linspace(0, 1, fi); return mix * fade
def kick(dur=.16, f0=120, f1=45):
    t = t_(dur); return np.sin(2 * math.pi * np.cumsum(np.linspace(f0, f1, len(t))) / SR) * env(len(t), .001, dur * .6, 4)

def score_lofi(dur, seed, punches, bpm=86):
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    while t < dur:
        ch = prog[b % 4]
        for k, iv in enumerate(ch):     # dusty keys, rolled
            y = tone(midi(key + 12 + iv), 2.4, (1, .5, .2, .08), .01, 1.6) * (1 + .02 * np.sin(2 * math.pi * 5 * t_(2.4)))
            put(y, t + k * .02, .05)
        put(tone(midi(key - 12 + ch[0]), 1.6, (1, .2), .02, 1.0), t, .15)
        for q in range(4):
            at = t + q * beat
            if q in (0, 2): put(kick(.18, 90, 40), at, .32)
            if q in (1, 3): m = int(.2 * SR); put(bandnoise(rng, m, 700, 4000) * env(m, .002, .12, 4), at, .1)
            for sw in (0, .62):   # swung hats
                m = int(.04 * SR); put(bandnoise(rng, m, 6000, 11000) * env(m, .0005, .02, 6), at + sw * beat, .025)
        t += 4 * beat; b += 1
    for _ in range(int(dur * 8)): put(bandnoise(rng, 90, 1500, 8000), rng.uniform(0, dur), .02)
    return _finish(mix, dur)

def score_synth(dur, seed, punches, bpm=122):
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    while t < dur:
        ch = prog[b % 4]
        for s_ in range(16):
            iv = ch[[0, 1, 2, 3, 2, 1, 2, 1][s_ % 8]] + (12 if s_ >= 8 else 0)
            put(square(midi(key + 12 + iv), .12, 7, .002, .08), t + s_ * beat / 4, .035)
        put(tone(midi(key - 12 + ch[0]), 4 * beat, (1, .1), .05, 3 * beat), t, .12)
        for q in range(4):
            at = t + q * beat; put(kick(.14, 110, 45), at, .28)
            m = int(.03 * SR); put(bandnoise(rng, m, 7000, 11500) * env(m, .0005, .015, 6), at + beat / 2, .035)
        t += 4 * beat; b += 1
    return _finish(mix, dur)

def score_wave(dur, seed, punches, bpm=104):
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    while t < dur:
        ch = prog[b % 4]; L = 4 * beat
        for iv in ch:
            for det in (-.35, .35):
                f = midi(key + 12 + iv) * 2 ** (det / 12); tt = t_(L)
                y = sum(np.sin(2 * math.pi * f * k * tt) / k for k in range(1, 7)) * np.minimum(1, tt / .4) * np.minimum(1, (L - tt) / .3)
                put(y, t, .018)
        for e in range(8):
            put(tone(midi(key - 12 + ch[0] + (12 if e % 2 else 0)), beat / 2, (1, .5, .3, .2), .003, beat * .4), t + e * beat / 2, .08)
        for q in range(4):
            at = t + q * beat
            if q in (0, 2): put(kick(.2, 100, 40), at, .3)
            if q in (1, 3): m = int(.35 * SR); put(bandnoise(rng, m, 900, 7000) * env(m, .001, .25, 3), at, .09)
        t += L; b += 1
    return _finish(mix, dur)

def score_uke(dur, seed, punches, bpm=104):
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    pattern = [(0, 1), (1, 1), (1.5, -1), (2.5, -1), (3, 1), (3.5, -1)]   # D D U U D U
    while t < dur:
        ch = prog[b % 4]
        for at, d in pattern:
            notes = [key + 12 + iv for iv in ch][::d]
            for k, nn in enumerate(notes): put(pluck(midi(nn), .6, rng, .6), t + at * beat + k * .012, .045)
        put(pluck(midi(key - 12 + ch[0]), .8, rng, .3), t, .12); put(pluck(midi(key - 12 + ch[2]), .6, rng, .3), t + 2 * beat, .09)
        for q in (1, 3):
            for k in range(3): m = int(.03 * SR); put(bandnoise(rng, m, 800, 5000) * env(m, .001, .015, 6), t + q * beat + k * .008, .08)
        for s_ in range(16): m = int(.04 * SR); put(bandnoise(rng, m, 5000, 10000) * env(m, .005, .02, 4), t + s_ * beat / 4, .012 + .01 * (s_ % 2))
        t += 4 * beat; b += 1
    return _finish(mix, dur)

def marimba(freq, dur=.6):
    t = t_(dur); return (np.sin(2 * math.pi * freq * t) * np.exp(-t * 7) + .3 * np.sin(2 * math.pi * freq * 4 * t) * np.exp(-t * 30)) * np.minimum(1, t / .002)
def score_marimba(dur, seed, punches, bpm=116):
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    rhythm = [0, .75, 1.5, 2, 2.75, 3.5]
    while t < dur:
        ch = prog[b % 4]
        for k, at in enumerate(rhythm): put(marimba(midi(key + 12 + ch[(k * 2 + b) % 4] + (12 if k == 3 else 0))), t + at * beat, .09)
        put(marimba(midi(key - 12 + ch[0]), 1.0), t, .14); put(marimba(midi(key - 12 + ch[2]), .8), t + 2 * beat, .1)
        for q in range(4):
            at = t + q * beat
            if q in (0, 2): put(kick(.12, 100, 50), at, .22)
            if q in (1, 3): m = int(.05 * SR); put(bandnoise(rng, m, 1500, 6000) * env(m, .0005, .02, 6), at, .09)
        t += 4 * beat; b += 1
    return _finish(mix, dur)

def score_chip(dur, seed, punches, bpm=132):
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    while t < dur:
        ch = prog[b % 4]
        for s_ in range(8):
            iv = ch[[0, 2, 1, 3, 2, 1, 3, 2][s_]] + 12
            put(square(midi(key + 12 + iv), beat / 2 * .9, 5, .001, beat * .35), t + s_ * beat / 2, .05)
        for q in range(4): put(tri(midi(key - 12 + ch[0] + (7 if q == 2 else 0)), beat * .9, .002, beat * .7), t + q * beat, .22)
        for q in range(4):
            at = t + q * beat
            if q in (0, 2): tt = t_(.1); put(np.sign(np.sin(2 * math.pi * np.cumsum(np.linspace(180, 40, len(tt))) / SR)) * env(len(tt), .001, .06, 4), at, .18)
            if q in (1, 3): m = int(.1 * SR); put(rng.uniform(-1, 1, m) * env(m, .001, .06, 4), at, .1)
            m = int(.02 * SR); put(rng.uniform(-1, 1, m) * env(m, .0005, .01, 6), at + beat / 2, .04)
        t += 4 * beat; b += 1
    return _finish(mix, dur)

# a music-box tine: a bright fundamental with the inharmonic partials of a
# struck metal bar, dying fast
def glock(freq, dur=1.2):
    t = t_(dur)
    return (np.sin(2 * math.pi * freq * t) + .35 * np.sin(2 * math.pi * freq * 2.76 * t) * np.exp(-t * 9)
            + .15 * np.sin(2 * math.pi * freq * 5.4 * t) * np.exp(-t * 20)) * np.exp(-t * 3.2) * np.minimum(1, t / .001)
def score_musicbox(dur, seed, punches, bpm=100):   # crayon
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    pat = [0, 2, 1, 3, 2, 1, 3, 2]
    while t < dur:
        ch = prog[b % 4]
        for s_, j in enumerate(pat): put(glock(midi(key + 24 + ch[j] + (12 if s_ == 3 else 0))), t + s_ * beat / 2 + rng.uniform(0, .008), .05)
        put(glock(midi(key + ch[0]), 2.0), t, .08); put(glock(midi(key + ch[2]), 1.6), t + 2 * beat, .06)
        for q in range(8): m = int(.03 * SR); put(bandnoise(rng, m, 6000, 11000) * env(m, .002, .02, 5), t + q * beat / 2, .012)
        t += 4 * beat; b += 1
    return _finish(mix, dur)

def score_harp(dur, seed, punches, bpm=84):   # pastel: arpeggios up and back over a soft pad
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    while t < dur:
        ch = prog[b % 4]
        notes = [key + iv for iv in ch] + [key + 12 + iv for iv in ch]
        for k, nn in enumerate(notes + notes[-2:0:-1]): put(pluck(midi(nn + 12), 1.8, rng, .35), t + k * beat / 3.5, .045)
        put(tone(midi(key - 12 + ch[0]), 4 * beat, (1, .3, .1), .08, 3 * beat), t, .06)
        t += 4 * beat; b += 1
    return _finish(mix, dur)

def score_pizz(dur, seed, punches, bpm=112):   # ballpoint: plucked strings walking in eighths, finger snaps
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    while t < dur:
        ch = prog[b % 4]
        for q in range(8): put(pluck(midi(key + 12 + ch[[0, 2, 1, 3, 2, 0, 3, 1][q]]), .35, rng, .25), t + q * beat / 2, .07 if q % 2 == 0 else .045)
        for q in range(4): put(pluck(midi(key - 12 + ch[0] + [0, 7, 12, 7][q]), .5, rng, .15), t + q * beat, .14)
        for q in (1, 3): m = int(.08 * SR); put(bandnoise(rng, m, 2000, 7000) * env(m, .004, .05, 4), t + q * beat, .035)
        t += 4 * beat; b += 1
    return _finish(mix, dur)

def score_jazz(dur, seed, punches, bpm=96):   # charcoal: electric-piano comping, walking bass, brushes
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    while t < dur:
        ch = prog[b % 4]
        for at in (0, 1.5):
            for k, iv in enumerate(ch): put(tone(midi(key + 12 + iv), 1.2, (1, .4, .1), .004, .9) * (1 + .15 * np.sin(2 * math.pi * 4.5 * t_(1.2))), t + at * beat + k * .01, .04)
        for q in range(4): put(pluck(midi(key - 24 + ch[q % 4] + (12 if q == 2 else 0)), beat * .95, rng, .12), t + q * beat, .2)
        for q in range(4):
            m = int(beat * .8 * SR); put(bandnoise(rng, m, 1500, 6000) * env(m, .02, beat * .5, 2), t + q * beat, .025)
            for sw in (0, .66): m = int(.06 * SR); put(bandnoise(rng, m, 6000, 12000) * env(m, .001, .04, 5), t + (q + sw) * beat, .02)
        t += 4 * beat; b += 1
    return _finish(mix, dur)

def score_koto(dur, seed, punches, bpm=76):   # sumi: pentatonic plucks, sparse, over a low drone
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    penta = [0, 2, 4, 7, 9, 12, 14, 16]
    while t < dur:
        for k in range(6):
            if rng.random() < .8:
                nn = key + 12 + penta[int(rng.integers(0, len(penta)))]
                put(pluck(midi(nn), 1.6, rng, .55), t + k * beat * 2 / 3 + rng.uniform(0, .03), .06)
                if rng.random() < .3: put(pluck(midi(nn + 12), 1.0, rng, .7), t + k * beat * 2 / 3 + .09, .025)   # a flick above
        put(tone(midi(key - 12), 4 * beat, (1, .5, .25), .3, 3.5 * beat), t, .05)
        t += 4 * beat; b += 1
    return _finish(mix, dur)

def score_baroque(dur, seed, punches, bpm=100):   # engraving, calligraphy: a harpsichord's broken chords and walking bass
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    while t < dur:
        ch = prog[b % 4]
        for s_ in range(16):
            iv = ch[[0, 2, 1, 2, 3, 2, 1, 2][s_ % 8]] + (12 if s_ >= 8 else 0)
            put(pluck(midi(key + 12 + iv), .5, rng, .95), t + s_ * beat / 4, .04)
        for q in range(4): put(pluck(midi(key - 12 + ch[[0, 1, 2, 1][q]]), beat, rng, .8), t + q * beat, .09)
        t += 4 * beat; b += 1
    return _finish(mix, dur)

def score_boombap(dur, seed, punches, bpm=90):   # spray: swung kick and snare, vinyl hiss, a mellow keys loop
    rng, n, mix, key, prog, beat, put, t = _grid(dur, seed, punches, bpm); b = 0
    while t < dur:
        ch = prog[b % 4]
        for k, iv in enumerate(ch): put(tone(midi(key + 12 + iv), 2 * beat, (1, .45, .15), .01, 1.6 * beat), t + k * .015, .035)
        put(tone(midi(key - 24 + ch[0]), 1.2 * beat, (1, .3), .005, beat), t, .22)
        put(tone(midi(key - 24 + ch[0]), .8 * beat, (1, .3), .005, .7 * beat), t + 2.5 * beat, .18)
        for at in (0, 1.75, 2.5):
            put(kick(.22, 110, 42), t + at * beat, .36)
        for q in (1, 3):
            m = int(.22 * SR); put(bandnoise(rng, m, 900, 6000) * env(m, .002, .14, 4), t + q * beat, .13)
        for s_ in range(8):
            sw = .08 if s_ % 2 else 0
            m = int(.04 * SR); put(bandnoise(rng, m, 7000, 12000) * env(m, .0005, .025, 6), t + (s_ / 2 + sw) * beat, .02)
        t += 4 * beat; b += 1
    for _ in range(int(dur * 10)): put(bandnoise(rng, 60, 2000, 9000), rng.uniform(0, dur), .015)
    return _finish(mix, dur)

SCORES = {"paper": score_paper, "lofi": score_lofi, "synth": score_synth, "wave": score_wave, "uke": score_uke, "marimba": score_marimba, "chip": score_chip,
          "musicbox": score_musicbox, "harp": score_harp, "pizz": score_pizz, "jazz": score_jazz, "koto": score_koto, "baroque": score_baroque, "boombap": score_boombap}
def score(dur, seed, punches, music="paper", bpm=None):
    f = SCORES.get(music, score_paper)
    return f(dur, seed, punches, bpm) if bpm else f(dur, seed, punches)


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
    chip = film.get("music") == "chip"
    # One voice never talks over itself. A line starts at its beat or just
    # after the previous line ends, whichever is later. A slip of a few frames
    # is absorbed; a longer one means the picture was timed to some other
    # recording (a render that skipped build.mjs's voice pass), and a film
    # whose narration drifts off its pictures is not shipped.
    GAP, SLIP = .12, .35
    free, worst = 0.0, (0.0, None)
    for b in film["beats"]:
        p = os.path.join(args.voice, f"{b['i']}.wav")
        if not os.path.exists(p): starts.append(0); durs.append(0); continue
        y = load_wav(p); t0 = max(b["t"], free)
        if t0 - b["t"] > worst[0]: worst = (t0 - b["t"], b["i"])
        at = int(t0 * SR)
        y = y / (np.sqrt(np.mean(y ** 2)) + 1e-9) * .1          # level the lines
        voice[at:at + len(y)] += y[:max(0, n - at)]
        starts.append(t0); durs.append(len(y) / SR); free = t0 + len(y) / SR + GAP
    if worst[0] > SLIP and not args.allow_drift:
        sys.exit(f"{film['slug']}: line {worst[1]} would talk over the line before it by {worst[0]:.2f}s. "
                 "The film was not timed to this voice; render it through build.mjs, which voices the lines first.")
    punches = [e["t"] for e in film["events"] if e["type"] == "punch"]
    for e in film["events"]:
        if e["type"] == "punch": continue     # the score plays the punches
        y = (chip_sfx if chip else sfx)(e["type"], rng, **{k: v for k, v in e.items() if k not in ("t", "type")})
        at = int(max(0, e["t"]) * SR); fx[at:at + len(y)] += y[:max(0, n - at)] * .5
    music = score(dur, seed, punches, film.get("music", "paper"), film.get("bpm"))[:n]
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


def words(args):
    """Every word the narration will speak that the voice does not know.

    Reads every storyboard's `say` lines and the host's sign-off, runs them
    through the same text clean-up and the same dictionary Kokoro uses, and
    lists what it would have to guess, with the guess (espeak's, as Kokoro
    makes it) and the films it appears in. An ordinary word ("copied") is
    guessed well; a name or an acronym is where the guess goes wrong ("Qwen"
    came out "Q-wen"), so those fail the check (exit 1) until PRONOUNCE says
    how to read them."""
    import glob
    from misaki import en, espeak
    g2p = en.G2P(trf=False, british=False, fallback=None)
    guess = espeak.EspeakFallback(british=False)
    unknown = {}
    for f in sorted(glob.glob(os.path.join(args.films, "*.json"))):
        sb = json.load(open(f)); slug = os.path.basename(f)[:-5]
        if not any(s.get("type") == "takeaway" for s in sb.get("scenes", [])): continue
        says = re.findall(r'"say":\s*"((?:[^"\\]|\\.)*)"', json.dumps(sb, ensure_ascii=False))
        name = (sb.get("mascot") or {}).get("name")
        if name: says.append(f"I'm {name}. Bye!")
        for line in says:
            _, toks = g2p(speakable(json.loads(f'"{line}"') if "\\" in line else line))
            for t in toks:
                if t.phonemes is None or "❓" in (t.phonemes or ""): unknown.setdefault(t.text, set()).add(slug)
    names = 0
    for w, films in sorted(unknown.items(), key=lambda kv: -len(kv[1])):
        name = bool(re.search(r"[A-Z0-9]", w))
        names += name
        reading = guess(en.MToken(text=w, tag="NN", whitespace=""))[0] or "?"
        print(f"{'NAME ' if name else '     '}{w:22s} → {reading:18s} {len(films):3d}  {', '.join(sorted(films)[:4])}{' …' if len(films) > 4 else ''}")
    print(f"{len(unknown)} word(s) the voice would guess, {names} of them names or acronyms", file=sys.stderr)
    sys.exit(1 if names else 0)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("tts"); a.add_argument("--in", dest="inp", required=True); a.add_argument("--out", required=True); a.add_argument("--voice", default="af_heart"); a.add_argument("--allow-guess", action="store_true")
    m = sub.add_parser("mix"); m.add_argument("--film", required=True); m.add_argument("--voice", required=True); m.add_argument("--out", required=True); m.add_argument("--vtt"); m.add_argument("--bitrate", default="40k"); m.add_argument("--allow-drift", action="store_true")
    w = sub.add_parser("words"); w.add_argument("--films", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "data", "films"))
    args = ap.parse_args()
    {"tts": tts, "mix": mix, "words": words}[args.cmd](args)
