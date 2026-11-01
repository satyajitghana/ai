# Layout detection with transformers' PPDocLayoutV3 only (no repo code executed).
import sys, os, json, time, resource
import torch; torch.set_num_threads(2)
from PIL import Image
from transformers import PPDocLayoutV3ForObjectDetection, PPDocLayoutV3ImageProcessor
MODEL_DIR = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__))
proc = PPDocLayoutV3ImageProcessor.from_pretrained(MODEL_DIR); model = PPDocLayoutV3ForObjectDetection.from_pretrained(MODEL_DIR).eval()
out = {}
for name in ["M_twocol", "T_tableformula", "M_degraded"]:
    im = Image.open(f"{HERE}/pages/{name}.{"jpg" if name == "M_degraded" else "png"}").convert("RGB")
    t = time.time(); inp = proc(images=[im], return_tensors="pt")
    with torch.no_grad(): o = model(**inp)
    res = proc.post_process_object_detection(o, threshold=0.25, target_sizes=torch.tensor([im.size[::-1]]))[0]
    dt = time.time() - t
    regs = [{"cls_id": int(l), "label": model.config.id2label[int(l)], "score": round(float(s), 3), "box": [round(float(v), 1) for v in b], "order": int(od)} for s, l, b, od in zip(res["scores"], res["labels"], res["boxes"], res["order_seq"])]
    out[name] = {"sec": round(dt, 2), "size": im.size, "regions": regs}
    print(name, f"{dt:.1f}s", [(r["label"], r["box"], r["score"]) for r in regs], flush=True)
print("params", sum(p.numel() for p in model.parameters()), "rss GB", resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6)
json.dump(out, open(f"{HERE}/layout_out_raw.json", "w"), indent=1)
