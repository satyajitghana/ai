# Stage 2: Xiaomi-OCR-0 (transformers, CPU, bf16) on (a) whole pages and (b) the layout crops from stage 1.
# Crops follow evaluation_pipeline/cropping.py (bbox normalised to 0..1000, int-truncated, plain rectangle crop).
import json, os, time, resource, sys
import torch; torch.set_num_threads(2)
from PIL import Image
from transformers import AutoModelForImageTextToText, AutoProcessor
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = f"{HERE}/vlm_out.json"
MODEL = "xiaomi-research/Xiaomi-OCR-0"
P = {"document": "Extract all information from the main body of the document image and represent it in markdown format, ignoring headers and footers. Tables should be expressed in OTSL format, formulas in the document should be represented using LATEX format, and the parsing should be organized according to the reading order.",
     "text": "Extract the text in the image.", "table": "Parse the table in the image into OTSL.",
     "formula": "Identify the formula in the image and represent it using LATEX format."}
ID2TASK = {17: "text", 22: "text", 6: "text", 7: "text", 0: "text", 21: "table", 5: "formula", 15: "formula"}  # via the repo's ID2LABEL + LABEL_TASK_MAPPING
lay = json.load(open(f"{HERE}/layout_out_raw.json"))
res = json.load(open(OUT)) if os.path.exists(OUT) else {"model": MODEL, "runs": []}
done = {(r["page"], r["mode"], r.get("region")) for r in res["runs"]}
t0 = time.time(); proc = AutoProcessor.from_pretrained(MODEL); model = AutoModelForImageTextToText.from_pretrained(MODEL, dtype=torch.bfloat16).eval()
print(f"loaded {time.time()-t0:.0f}s rss {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1e6:.2f} GB", flush=True)
def run(im, task, mx):
    msgs = [{"role": "user", "content": [{"type": "image", "image": im}, {"type": "text", "text": P[task]}]}]
    inp = proc.apply_chat_template(msgs, tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors="pt")
    n_in = int(inp["input_ids"].shape[1]); n_img = int((inp["input_ids"] == model.config.image_token_id).sum()); t = time.time()
    with torch.inference_mode(): out = model.generate(**inp, max_new_tokens=mx, do_sample=False)
    new = out[:, n_in:]
    return {"image_tokens": n_img, "new_tokens": int(new.shape[1]), "sec": round(time.time() - t, 1), "hit_limit": int(new.shape[1]) >= mx, "text": proc.batch_decode(new, skip_special_tokens=False)[0]}
def save(r):
    res["runs"].append(r); json.dump(res, open(OUT, "w"), indent=1, ensure_ascii=False)
    print(r["page"], r["mode"], r.get("region"), {k: v for k, v in r.items() if k not in ("text",)}, repr(r["text"][:100]), flush=True)
for page in ["T_tableformula", "M_twocol", "M_degraded"]:
    im = Image.open(f"{HERE}/pages/{page}.{"jpg" if page == "M_degraded" else "png"}").convert("RGB"); w, h = im.size
    if (page, "single", None) not in done: save({"page": page, "mode": "single", "region": None, **run(im, "document", 500)})
    regs = sorted(lay[page]["regions"], key=lambda r: r["order"])
    for i, r in enumerate(regs):
        if (page, "two", i) in done: continue
        task = ID2TASK[r["cls_id"]]; bx = [r["box"][0] / w * 1000, r["box"][1] / h * 1000, r["box"][2] / w * 1000, r["box"][3] / h * 1000]
        bx = [int(v) for v in bx]  # layout stage stores int(coord/size*1000)
        crop = im.crop((int(bx[0] / 1000 * w), int(bx[1] / 1000 * h), int(bx[2] / 1000 * w), int(bx[3] / 1000 * h)))
        save({"page": page, "mode": "two", "region": i, "label": r["label"], "task": task, "crop_size": list(crop.size), **run(crop, task, {"text": 220, "table": 260, "formula": 90}[task])})
print("DONE rss", resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6, flush=True)
