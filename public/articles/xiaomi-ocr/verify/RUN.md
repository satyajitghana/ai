# Verification run, 2026-10-31 (CPU, 2 threads, bf16 VLM, fp32 detector)
Versions: python 3.12, torch 2.14.1+cu130 (CPU), transformers 5.20.2, opencv-python-headless 5.0.0.93 (needed by PPDocLayoutV3ImageProcessor.post_process_object_detection).
Code: SeerRay-Lab/Xiaomi-OCR-0 @ b1a9bb4c07060c453785e9151715ccda6b96f0b1 (read, not executed: see below).
Weights: xiaomi-research/Xiaomi-OCR-0 @ bbd8cf8d21f256b3644b44cb860f3a7cecb93c30; PaddlePaddle/PP-DocLayoutV3_safetensors @ e4f489dc536556fc1be02b973ba06756e0d4a2ac (33,175,165 params).
Order: make_pages2.py, make_degraded.py, stage1_layout_hf.py <detector dir> (writes layout_out_raw.json), stage2_vlm.py (writes vlm_out.json), eval2.py (writes eval2.json).
Refused: importing the repo's own evaluation_pipeline/twostage_img2md.py (to call its run_layout_detection / apply_layout_postprocess / merge_page_to_markdown) was denied twice by the permission layer, so the repo's code was NOT executed. stage1 calls the same transformers classes the repo calls; stage2 re-implements the crop (bbox normalised to 0..1000, rectangle crop), the task mapping from the repo's ID2LABEL/LABEL_TASK_MAPPING, and the prompts, and orders regions by the detector's order_seq. NMS/containment merge, the repetition guard and merge_page_to_markdown were not applied.
Peak RSS: detector process 2.09 GB; VLM process 2.81 GB (above the 2.5 GB budget).
