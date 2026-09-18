#!/usr/bin/env python3
"""Turn a beat script into a timed narration track and a caption file.

    python3 narrate.py script.json --voice <voice.onnx> --piper <piper bin> --out <dir>

`script.json` is a list of beats, one per scene, in film order:

    [
      {"name": "write", "dur": 3.5, "say": "An L L M answers by writing words."},
      {"name": "decide", "dur": 4.0, "say": "Jev never writes.",
       "show": "Jev never writes."}
    ]

`dur` is the scene's length in the film's timeline. `say` is what the synth
reads; `show` is what the caption shows, and defaults to `say`. They differ
whenever the synth needs help — initialisms have to be spelled out ("R L C D")
or it reads them as words, and that spelling must never reach the screen.

Writes voice.wav (mono 48k, the full film length, each beat at its scene
offset) and captions.vtt, and prints a per-beat fit report. A beat whose speech
is longer than its scene is a FAIL, not a warning: fix it by lengthening the
scene in the film, not by speeding up the voice.
"""
import argparse, json, re, subprocess, sys
from pathlib import Path

LEAD = 0.30        # let the cut land before the voice starts
# Piper is stochastic: the same text resynthesised gives a different length.
# Measured drift on a 13-beat script was up to 0.42s on a five-second line, so a
# beat that only just fits today will overrun on the next run. Demand more.
HEADROOM = 0.50


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def synth(piper, voice, text, dest):
    subprocess.run([piper, "-m", str(voice), "-f", str(dest)],
                   input=text, text=True, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return probe(dest)


def ts(t):
    return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{t % 60:06.3f}"


def wrap(s, n=42):
    lines, line = [], ""
    for w in s.split():
        if line and len(line) + len(w) + 1 > n:
            lines.append(line); line = w
        else:
            line = (line + " " + w).strip()
    if line:
        lines.append(line)
    return "\n".join(lines) if len(lines) <= 2 else lines[0] + "\n" + " ".join(lines[1:])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("--voice", required=True)
    ap.add_argument("--piper", default="piper")
    ap.add_argument("--out", default="narration")
    ap.add_argument("--lufs", type=float, default=-17.0)
    args = ap.parse_args()

    out = Path(args.out); (out / "beats").mkdir(parents=True, exist_ok=True)
    beats = json.loads(Path(args.script).read_text())

    offset, placed, bad = 0.0, [], []
    for b in beats:
        wav = out / "beats" / f"{b['name']}.wav"
        spoken = synth(args.piper, args.voice, b["say"], wav)
        start = offset + LEAD
        slack = b["dur"] - LEAD - spoken
        flag = "" if slack >= HEADROOM else ("  TIGHT" if slack >= 0 else "  OVERRUNS")
        if slack < 0:
            bad.append((b["name"], -slack))
        print(f"  {b['name']:12} scene={b['dur']:5.2f}s  speech={spoken:5.2f}s  slack={slack:+5.2f}s{flag}")
        placed.append({**b, "start": start, "spoken": spoken})
        offset += b["dur"]

    if bad:
        print("\nFAIL: these beats do not fit their scene. Lengthen the scene in the\n"
              "film's TIMELINE (the narration sets the pace, not the other way round):",
              file=sys.stderr)
        for name, over in bad:
            print(f"  {name}: needs {over:.2f}s more", file=sys.stderr)
        sys.exit(1)

    # one graph: delay each beat to its offset, sum, pad to length, normalise
    ins, filt = [], []
    for i, b in enumerate(placed):
        ins += ["-i", str(out / "beats" / f"{b['name']}.wav")]
        ms = int(b["start"] * 1000)
        filt.append(f"[{i}:a]aresample=48000,adelay={ms}|{ms}[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(len(placed)))
    filt.append(f"{mix}amix=inputs={len(placed)}:normalize=0:dropout_transition=0,"
                f"apad,atrim=0:{offset},loudnorm=I={args.lufs}:TP=-1.5:LRA=11,"
                f"aresample=48000[v]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(filt),
                    "-map", "[v]", "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le",
                    str(out / "voice.wav")], check=True)

    # captions: one cue per sentence, split in proportion to its length, so a
    # five-second line is not one block sitting on screen
    cues = []
    for b in placed:
        shown = b.get("show", b["say"])
        parts = [p.strip() for p in re.split(r"(?<=[.?!])\s+", shown) if p.strip()]
        total = sum(len(p) for p in parts) or 1
        t = b["start"]
        for p in parts:
            seg = b["spoken"] * len(p) / total
            cues.append((t, t + seg, p)); t += seg

    vtt = ["WEBVTT", ""]
    for i, (a, z, txt) in enumerate(cues, 1):
        vtt += [str(i), f"{ts(a)} --> {ts(z)}", wrap(txt), ""]
    (out / "captions.vtt").write_text("\n".join(vtt))

    leaked = [c for c in cues if re.search(r"\b[A-Z](\s[A-Z]){2,}", c[2])]
    if leaked:
        print(f"\nWARNING: {len(leaked)} caption(s) still show spelled-out letters. "
              f"Add a 'show' field to those beats.", file=sys.stderr)

    print(f"\n  film {offset:.2f}s   voice.wav + captions.vtt ({len(cues)} cues) -> {out}")


if __name__ == "__main__":
    main()
