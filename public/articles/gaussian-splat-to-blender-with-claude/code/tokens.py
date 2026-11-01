"""Image token cost, from the formula on Anthropic's vision docs page (read 2026-10-31):

    tokens = ceil(width / 28) * ceil(height / 28)

after the image is scaled down, keeping its aspect ratio, to the largest size that
fits the model tier's limits: standard tier 1,568 px long edge and 1,568 visual
tokens; high-resolution tier (Claude 4.7 and later) 2,576 px and 4,784 tokens.
The docs' own table of six examples is reproduced below as a check on this code.

Run: python3 -I tokens.py > tokens.json
"""
import json
import math

TIERS = {"standard": (1568, 1568), "high": (2576, 4784)}


def tokens(w, h):
    return math.ceil(w / 28) * math.ceil(h / 28)


def fit(w, h, tier):
    long_edge, max_tokens = TIERS[tier]
    if max(w, h) <= long_edge and tokens(w, h) <= max_tokens:
        return w, h
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        nw, nh = max(1, math.floor(w * mid)), max(1, math.floor(h * mid))
        ok = max(nw, nh) <= long_edge and tokens(nw, nh) <= max_tokens
        lo, hi = (mid, hi) if ok else (lo, mid)
    return max(1, math.floor(w * lo)), max(1, math.floor(h * lo))


def cost(w, h, tier):
    nw, nh = fit(w, h, tier)
    return dict(w=w, h=h, tier=tier, resized=[nw, nh], tokens=tokens(nw, nh))


DOC_TABLE = [  # (w, h, standard tokens, high tokens) as printed on the docs page
    (200, 200, 64, 64),
    (1000, 1000, 1296, 1296),
    (1092, 1092, 1521, 1521),
    (1920, 1080, 1560, 2691),
    (2000, 1500, 1564, 3888),
    (3840, 2160, 1560, 4784),
]


def main():
    check = []
    for w, h, std, high in DOC_TABLE:
        a, b = cost(w, h, "standard"), cost(w, h, "high")
        check.append(dict(w=w, h=h, docs_standard=std, ours_standard=a["tokens"], docs_high=high, ours_high=b["tokens"], match=a["tokens"] == std and b["tokens"] == high))
    sizes = [(1280, 720), (1920, 1080), (2560, 1440), (3840, 2160), (3840, 2092), (4032, 3024), (6000, 4000)]
    table = [dict(w=w, h=h, standard=cost(w, h, "standard"), high=cost(w, h, "high")) for w, h in sizes]
    print(json.dumps(dict(formula="ceil(w/28)*ceil(h/28) after fitting the tier limits", tiers=TIERS, docs_check=check, all_match=all(c["match"] for c in check), sizes=table), indent=1))


if __name__ == "__main__":
    main()
