"""Plain bpy 5.0.1 headless probe (no addon code): what exists without a window/GPU."""
import bpy, json
r = {"background": bpy.app.background, "screen": repr(bpy.context.screen), "window": repr(bpy.context.window),
     "windows": len(bpy.context.window_manager.windows)}
r["areas"] = [a.type for a in bpy.context.screen.areas] if bpy.context.screen else None
try:
    import gpu; o = gpu.types.GPUOffScreen(64, 64); r["offscreen"] = "ok"
except Exception as e: r["offscreen"] = f"{type(e).__name__}: {e}"
print("PROBE", json.dumps(r))
