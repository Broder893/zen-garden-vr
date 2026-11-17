"""Stylised bonsai generator (Blender / bpy). Run: python3 gen_bonsai.py <outdir>

Cloud-pad style: tapered S-curve trunk, thin branches, flattened foliage clouds,
shallow clay pot. Separate objects so the game can tint foliage per season.
"""
import math
import random
import sys

import bpy
import bmesh
from mathutils import Vector

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1.0)
    b.inputs["Roughness"].default_value = rough
    return m


MAT_TRUNK = material("trunk", (0.20, 0.115, 0.07))
MAT_FOLIAGE = material("foliage", (0.12, 0.38, 0.15), 0.9)
MAT_POT = material("pot", (0.36, 0.22, 0.17), 0.7)
MAT_SOIL = material("soil", (0.10, 0.07, 0.05), 1.0)
MAT_MOSS = material("moss", (0.20, 0.45, 0.16), 1.0)


def new_object(name, mesh, mat):
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def tube_mesh(name, pts, radii, res=1):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 1.0
    cu.bevel_resolution = res  # 1 -> 8 sides
    cu.use_fill_caps = True
    cu.resolution_u = 4
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for p, r, bp in zip(pts, radii, sp.bezier_points):
        bp.co = p
        bp.radius = r
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    tmp = bpy.data.objects.new(name + "_tmp", cu)
    scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    return mesh


def merge(meshes, name):
    bm = bmesh.new()
    for m in meshes:
        bm.from_mesh(m)
    out = bpy.data.meshes.new(name)
    bm.to_mesh(out)
    bm.free()
    return out


# ---------------------------------------------------------------- pot
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=28,
                      radius1=0.070, radius2=0.085, depth=0.048)
bmesh.ops.translate(bm, vec=(0, 0, 0.024), verts=bm.verts)
# rim
rim = bmesh.new()
bmesh.ops.create_cone(rim, cap_ends=True, cap_tris=False, segments=28,
                      radius1=0.089, radius2=0.089, depth=0.008)
bmesh.ops.translate(rim, vec=(0, 0, 0.046), verts=rim.verts)
rim_mesh = bpy.data.meshes.new("rim")
rim.to_mesh(rim_mesh)
rim.free()
body_mesh = bpy.data.meshes.new("body")
bm.to_mesh(body_mesh)
bm.free()
feet = []
for ang in (45, 135, 225, 315):
    f = bmesh.new()
    bmesh.ops.create_cone(f, cap_ends=True, cap_tris=False, segments=8,
                          radius1=0.012, radius2=0.010, depth=0.008)
    a = math.radians(ang)
    bmesh.ops.translate(f, vec=(0.052 * math.cos(a), 0.052 * math.sin(a), 0.0), verts=f.verts)
    fm = bpy.data.meshes.new("foot")
    f.to_mesh(fm)
    f.free()
    feet.append(fm)
pot = new_object("pot", merge([body_mesh, rim_mesh] + feet, "pot"), MAT_POT)

# soil
sb = bmesh.new()
bmesh.ops.create_cone(sb, cap_ends=True, cap_tris=False, segments=28,
                      radius1=0.080, radius2=0.080, depth=0.006)
bmesh.ops.translate(sb, vec=(0, 0, 0.0505), verts=sb.verts)
sm = bpy.data.meshes.new("soil")
sb.to_mesh(sm)
sb.free()
new_object("soil", sm, MAT_SOIL)

# moss patches on the soil
mb = bmesh.new()
for mx, my, mr in ((0.045, 0.020, 0.018), (-0.040, -0.030, 0.022), (0.010, -0.052, 0.015), (-0.020, 0.048, 0.013)):
    for v in bmesh.ops.create_icosphere(mb, subdivisions=1, radius=1.0)["verts"]:
        v.co = Vector((v.co.x * mr, v.co.y * mr, v.co.z * mr * 0.35)) + Vector((mx, my, 0.0535))
mmesh = bpy.data.meshes.new("moss")
mb.to_mesh(mmesh)
mb.free()
new_object("moss", mmesh, MAT_MOSS)

# ---------------------------------------------------------------- trunk
BASE_Z = 0.048
trunk_pts = [
    Vector((0.000, 0.000, BASE_Z - 0.004)),
    Vector((0.010, 0.004, BASE_Z + 0.040)),
    Vector((-0.012, -0.004, BASE_Z + 0.092)),
    Vector((0.014, 0.006, BASE_Z + 0.140)),
    Vector((-0.004, 0.000, BASE_Z + 0.186)),
]
trunk_r = [0.0270, 0.0185, 0.0125, 0.0080, 0.0038]
trunk_meshes = [tube_mesh("trunk", trunk_pts, trunk_r)]

# surface roots (nebari): flare out from the base and dive into the soil
for ang, ln in ((20, 0.036), (140, 0.032), (255, 0.038)):
    a = math.radians(ang)
    d = Vector((math.cos(a), math.sin(a), 0))
    root_pts = [Vector((0, 0, BASE_Z + 0.014)) + d * 0.006,
                Vector((0, 0, BASE_Z + 0.004)) + d * ln * 0.6,
                Vector((0, 0, BASE_Z - 0.004)) + d * ln]
    trunk_meshes.append(tube_mesh("root", root_pts, [0.0095, 0.0060, 0.0028], res=1))

# branches: (start index on trunk, tip offset, pad radius)
branches = [
    (1, Vector((-0.072, 0.012, 0.046)), 0.042),
    (2, Vector((0.078, -0.012, 0.040)), 0.040),
    (3, Vector((-0.040, -0.054, 0.034)), 0.036),
    (2, Vector((-0.020, 0.062, 0.050)), 0.034),
    (1, Vector((0.060, 0.030, 0.030)), 0.030),
]
pads = []  # (center, radius)
anchors = []
for i, (idx, off, pr) in enumerate(branches, 1):
    start = trunk_pts[idx]
    tip = start + off
    mid = start + off * 0.5 + Vector((0, 0, 0.012))
    meshes_pts = [start, mid, tip]
    trunk_meshes.append(tube_mesh(f"branch{i}", meshes_pts, [0.0060, 0.0042, 0.0022], res=1))
    pads.append((tip + Vector((0, 0, 0.010)), pr))
    anchors.append((f"cut_{i:02d}", tip + Vector((0, 0, 0.030))))
# crown
crown = trunk_pts[-1] + Vector((0.0, 0.0, 0.016))
pads.append((crown, 0.048))
anchors.append((f"cut_{len(branches) + 1:02d}", crown + Vector((0, 0, 0.040))))

new_object("trunk", merge(trunk_meshes, "trunk"), MAT_TRUNK)

# ---------------------------------------------------------------- foliage clouds
fb = bmesh.new()
for centre, radius in pads:
    for k in range(3):
        ang = random.uniform(0, math.tau)
        d = radius * (0.0 if k == 0 else 0.55)
        c = centre + Vector((d * math.cos(ang), d * math.sin(ang), random.uniform(-0.004, 0.006)))
        r = radius * (1.0 if k == 0 else random.uniform(0.62, 0.78))
        geom = bmesh.ops.create_icosphere(fb, subdivisions=2, radius=1.0)["verts"]
        sx, sy, sz = r, r * random.uniform(0.9, 1.05), r * 0.46
        for v in geom:
            j = 1.0 + random.uniform(-0.07, 0.07)
            v.co = Vector((v.co.x * sx * j, v.co.y * sy * j, v.co.z * sz * j)) + c
fm = bpy.data.meshes.new("foliage")
fb.to_mesh(fm)
fb.free()
foliage = new_object("foliage", fm, MAT_FOLIAGE)
for p in fm.polygons:
    p.use_smooth = False

# anchors for gameplay (cut points)
for name, pos in anchors:
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "SPHERE"
    e.empty_display_size = 0.006
    e.location = pos
    scene.collection.objects.link(e)

# ---------------------------------------------------------------- stats
tris = 0
for o in scene.objects:
    if o.type == "MESH":
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        tris += len(bm.faces)
        print(f"{o.name:8s} tris={len(bm.faces)}")
        bm.free()
print("TOTAL triangles:", tris)

# ---------------------------------------------------------------- render preview
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.92, 0.88, 0.80, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
scene.world = world

floor = bpy.data.meshes.new("floor")
fbm = bmesh.new()
bmesh.ops.create_grid(fbm, x_segments=1, y_segments=1, size=0.6)
fbm.to_mesh(floor)
fbm.free()
new_object("floor", floor, material("floor", (0.62, 0.55, 0.45), 1.0))

sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 4.2
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
scene.collection.objects.link(sun)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 70
scene.collection.objects.link(cam)
scene.camera = cam
scene.render.engine = "CYCLES"
scene.view_settings.view_transform = "Standard"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.render.resolution_x = 720
scene.render.resolution_y = 720

views = {
    "three_quarter": (0.52, -0.58, 0.30),
}
target = Vector((0, 0, 0.14))
for name, loc in views.items():
    cam.location = Vector(loc)
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = f"{OUT}/preview_{name}.png"
    bpy.ops.render.render(write_still=True)
print("rendered")
