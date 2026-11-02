Verification runs, 31 Oct 2026. Environment: Python 3.11.17 venv, `pip install bpy` -> bpy 5.0.1 (Blender 5.0.1, build a3db93c5b259), CPU only, no GPU, no display, in /dev/shm (the disk had 600 MB free).
- headless_probe.py: plain bpy; prints whether a viewport, window and GPU offscreen exist in background mode.
- bpyrender.py + loop_blender.py: the article's loop.py (copied unchanged as loop_numpy.py) with silhouette() replaced by a real Cycles CPU render (1 sample, emission, 40x40). loop_blender_N.json = one cell each, log_loop_blender_N.txt = per-seed lines.
- NOT run: ahujasid/blender-mcp addon.py and server.py (commit 992233b). The sandbox permission layer refused to execute that downloaded code; everything about it in the article stays "read".
