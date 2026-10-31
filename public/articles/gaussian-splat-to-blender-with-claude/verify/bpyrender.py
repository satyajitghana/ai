"""Real-Blender silhouette renderer for the toy loop (bpy 5.0.1, Cycles, CPU, 40x40).
Boxes are unit cubes scaled/rotated/placed exactly as loop.py's slab test sees them."""
import bpy, numpy as np, math
import os
IMG = 40
_PNG = "/dev/shm/blender/r_%d.png" % os.getpid()
def setup(cams):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=1; sc.cycles.use_denoising=False; sc.cycles.filter_width=0.01; sc.render.threads_mode='FIXED'; sc.render.threads=2; sc.cycles.use_adaptive_sampling=False
    sc.render.resolution_x = sc.render.resolution_y = IMG
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.display_settings.display_device = 'sRGB'
    sc.world = bpy.data.worlds.new("w"); sc.world.use_nodes = False; sc.world.color = (0, 0, 0)
    cobjs = []
    for i, (pos, Rm) in enumerate(cams):
        cd = bpy.data.cameras.new(f"c{i}"); cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(40)
        co = bpy.data.objects.new(f"c{i}", cd); sc.collection.objects.link(co)
        r, u, f = Rm
        M = np.eye(4); M[:3, 0] = r; M[:3, 1] = u; M[:3, 2] = -f; M[:3, 3] = pos
        import mathutils; co.matrix_world = mathutils.Matrix([list(map(float, row)) for row in M])
        cobjs.append(co)
    mesh = bpy.data.meshes.new("cube")
    import bmesh
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(mesh); bm.free()
    mat = bpy.data.materials.new('e'); mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear(); em = nt.nodes.new('ShaderNodeEmission'); out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], out.inputs[0])
    mesh.materials.append(mat)
    boxes = []
    for i in range(3):
        o = bpy.data.objects.new(f"b{i}", mesh); sc.collection.objects.link(o); boxes.append(o)
    return sc, cobjs, boxes
def place(boxes, params):
    for o, (cx, cy, w, d, h, yaw) in zip(boxes, params.reshape(3, 6)):
        o.location = (cx, cy, h / 2); o.scale = (w, d, h); o.rotation_euler = (0, 0, yaw)
        # toy: world->box rotation Rb=[[c,s],[-s,c]] so box local x-axis in world = (c,-s)  => rotate by -yaw
def render(sc, cobj):
    sc.camera = cobj
    sc.render.filepath = _PNG
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(_PNG, check_existing=False)
    a = np.empty(IMG * IMG * 4, np.float32); im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return (a.reshape(IMG, IMG, 4)[:, :, 0] > 0.5).ravel()
