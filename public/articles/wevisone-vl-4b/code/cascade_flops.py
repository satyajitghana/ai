"""Per-instance FLOPs of the alpha cascade (highres_refine) from the shapes in decoder_shapes.json.

2 x out x in x k^2 x output pixels for each convolution, on the decoder's 1,024 x 1,024 canvas
(S/4 = 256 x 256, S/2 = 512 x 512, S/1 = 1,024 x 1,024; the semantic layer is counted at S/4;
transposed convolutions are counted on their input grid). Reasoned from shapes, not timed.
"""
import json

D = json.load(open("decoder_shapes.json"))
res = {"s4": 256 * 256, "s2": 512 * 512, "s1": 1024 * 1024}
tot = {"s4": 0, "s2": 0, "s1": 0}
other = 0
for k, s in D.items():
    if not k.startswith("highres_refine") or len(s) != 4:
        continue
    o, i, kh, kw = s
    if "up_s4_to_s2" in k:
        tot["s4"] += 2 * o * i * kh * kw * res["s4"]; continue
    if "up_s2_to_s1" in k:
        tot["s2"] += 2 * o * i * kh * kw * res["s2"]; continue
    if k.startswith("highres_refine.semantic"):
        other += 2 * o * i * kh * kw * res["s4"]; continue
    st = next((x for x in ("s4", "s2", "s1") if f"_{x}" in k or f"{x}." in k), None)
    tot[st] += 2 * o * i * kh * kw * res[st]
print({k: round(v / 1e9, 1) for k, v in tot.items()}, "semantic", round(other / 1e9, 2), "total GFLOPs", round((sum(tot.values()) + other) / 1e9, 1))
