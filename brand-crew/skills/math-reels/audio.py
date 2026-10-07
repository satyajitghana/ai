"""Music bed for a math reel: a calm ambient pad plus gentle ticks on events.

    python audio.py events.json out.wav

events.json = {"id": "107", "duration": 19.2, "events": [{"t": 2.6, "kind": "cut"}, ...]}
(render.mjs writes it from REEL.load). Kinds: cut (scene change), tick (a
marker lands), land (the result lands), stamp (the claim stamp), badge
(verification badge).

No narration and nothing sampled: every sound is synthesized here from sine
partials and filtered noise, seeded by the family id, so a spec always sounds
the same. Ideas follow explainer-films/audio.py (pads, one-pole filters,
synthesized effects), but nothing is imported from it: that file is hashed
into every explainer film's freshness check. Needs numpy only.
"""
import json, sys, wave
import numpy as np

SR = 48000


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
    pcm = np.clip(st * gain, -1, 1)
    with wave.open(out_path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((pcm * 32767).astype("<i2").tobytes())
    print(json.dumps({"id": spec.get("id"), "wav": out_path, "seconds": round(n / SR, 3), "events": len(spec.get("events", []))}))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
