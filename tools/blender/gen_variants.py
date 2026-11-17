"""Bonsai variants: stages x seasons x health. Run: python3 gen_variants.py <outdir>"""
import math
import random
import sys

import bpy
import bmesh
from mathutils import Vector

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
BASE_Z = 0.048


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


SEASONS = {
    "spring": ("#6fae4a", "#f7c1d5"),
    "summer": ("#3f7f34", "#f6b8cf"),
    "autumn": ("#b8532c", "#f2c49b"),
    "winter": ("#47705a", "#e9e6f2"),
}


def material(name, rgb, rough=0.85, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1.0)
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1.0)
        b.inputs["Emission Strength"].default_value = emit
    return m


def new_object(name, mesh, mat):
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def tube_mesh(name, pts, radii, res=1):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 1.0
    cu.bevel_resolution = res
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


def blob(bm, c, sx, sy, sz, sub=2, jit=0.0, rot=0.0):
    geom = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)["verts"]
    ca, sa = math.cos(rot), math.sin(rot)
    for v in geom:
        j = 1.0 + random.uniform(-jit, jit) if jit else 1.0
        x, y, z = v.co.x * sx * j, v.co.y * sy * j, v.co.z * sz * j
        v.co = Vector((x * ca - y * sa, x * sa + y * ca, z)) + c


def mesh_from(bm, name):
    m = bpy.data.meshes.new(name)
    bm.to_mesh(m)
    bm.free()
    return m


# ------------------------------------------------------------ static scene
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.92, 0.88, 0.80, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
scene.world = world
fl = bpy.data.meshes.new("floor")
fb = bmesh.new()
bmesh.ops.create_grid(fb, x_segments=1, y_segments=1, size=0.6)
fb.to_mesh(fl)
fb.free()
new_object("floor", fl, material("floor", (0.62, 0.55, 0.45), 1.0))
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
scene.cycles.samples = 24
scene.render.resolution_x = 420
scene.render.resolution_y = 420
cam.location = Vector((0.52, -0.58, 0.30))
cam.rotation_euler = (Vector((0, 0, 0.14)) - cam.location).to_track_quat("-Z", "Y").to_euler()
KEEP = {"floor", "sun", "cam"}

MAT_TRUNK = material("trunk", (0.20, 0.115, 0.07))
MAT_POT = material("pot", (0.36, 0.22, 0.17), 0.7)
MAT_SOIL = material("soil", (0.10, 0.07, 0.05), 1.0)
MAT_MOSS = material("moss", (0.20, 0.45, 0.16), 1.0)
MAT_CUT = material("cut", (0.80, 0.64, 0.44), 0.8)
MAT_SNOW = material("snow", (0.95, 0.97, 1.0), 0.9)
MAT_PUDDLE = material("puddle", (0.16, 0.24, 0.26), 0.25)


def build_pot():
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=28, radius1=0.070, radius2=0.085, depth=0.048)
    bmesh.ops.translate(bm, vec=(0, 0, 0.024), verts=bm.verts)
    ms = [mesh_from(bm, "body")]
    r = bmesh.new()
    bmesh.ops.create_cone(r, cap_ends=True, cap_tris=False, segments=28, radius1=0.089, radius2=0.089, depth=0.008)
    bmesh.ops.translate(r, vec=(0, 0, 0.046), verts=r.verts)
    ms.append(mesh_from(r, "rim"))
    for ang in (45, 135, 225, 315):
        f = bmesh.new()
        bmesh.ops.create_cone(f, cap_ends=True, cap_tris=False, segments=8, radius1=0.012, radius2=0.010, depth=0.008)
        a = math.radians(ang)
        bmesh.ops.translate(f, vec=(0.052 * math.cos(a), 0.052 * math.sin(a), 0.0), verts=f.verts)
        ms.append(mesh_from(f, "foot"))
    new_object("pot", merge(ms, "pot"), MAT_POT)
    sb = bmesh.new()
    bmesh.ops.create_cone(sb, cap_ends=True, cap_tris=False, segments=28, radius1=0.080, radius2=0.080, depth=0.006)
    bmesh.ops.translate(sb, vec=(0, 0, 0.0505), verts=sb.verts)
    new_object("soil", mesh_from(sb, "soil"), MAT_SOIL)
    mb = bmesh.new()
    for mx, my, mr in ((0.045, 0.020, 0.018), (-0.040, -0.030, 0.022), (0.010, -0.052, 0.015), (-0.020, 0.048, 0.013)):
        blob(mb, Vector((mx, my, 0.0535)), mr, mr, mr * 0.35, sub=1)
    new_object("moss", mesh_from(mb, "moss"), MAT_MOSS)


TRUNK = [Vector((0.000, 0.000, -0.004)), Vector((0.010, 0.004, 0.040)), Vector((-0.012, -0.004, 0.092)),
         Vector((0.014, 0.006, 0.140)), Vector((-0.004, 0.000, 0.186))]
TRUNK_R = [0.0270, 0.0185, 0.0125, 0.0080, 0.0038]
BRANCHES = [(1, Vector((-0.072, 0.012, 0.046)), 0.042), (2, Vector((0.078, -0.012, 0.040)), 0.040),
            (3, Vector((-0.040, -0.054, 0.034)), 0.036), (2, Vector((-0.020, 0.062, 0.050)), 0.034),
            (1, Vector((0.060, 0.030, 0.030)), 0.030)]

STAGES = {  # scale, branches, roots
    2: (0.58, 1, False),
    3: (0.85, 3, True),
    4: (1.00, 5, True),
}


def build(stage, season, health="healthy", export=False, shoots=False):
    random.seed(7)
    for o in list(scene.objects):
        if o.name not in KEEP:
            bpy.data.objects.remove(o)
    build_pot()
    leaf_hex, flower_hex = SEASONS[season]
    leaf = lin(leaf_hex)
    droop, lean, shrink = 0.0, 0.0, 1.0
    puddle = False
    if health == "stressed":
        leaf, droop, lean, shrink = lin("#9a9440"), 0.008, 0.10, 0.94
    elif health == "wilted":
        leaf, droop, lean, shrink = lin("#7a6a45"), 0.020, 0.40, 0.82
    elif health == "overwater":
        leaf, droop, lean, shrink, puddle = lin("#b3ad45"), 0.008, 0.08, 0.95, True
    mat_leaf = material("foliage", leaf, 0.9)
    mat_flower = material("flower", lin("#b9a58f") if health == "wilted" else lin(flower_hex), 0.8)

    def T(p):  # lean the whole tree
        return Vector((p.x + lean * max(p.z - BASE_Z, 0) * 0.5, p.y, p.z))

    if stage == 0:  # seed
        sb = bmesh.new()
        blob(sb, Vector((0, 0, 0.0580)), 0.016, 0.012, 0.010, sub=2)
        new_object("seed", mesh_from(sb, "seed"), material("seed", (0.9, 0.7, 0.25), 0.5, 3.0))
        gb = bmesh.new()
        blob(gb, Vector((0, 0, 0.0535)), 0.034, 0.034, 0.002, sub=2)
        new_object("glow", mesh_from(gb, "glow"), material("glow", lin("#ffd98a"), 0.5, 1.2))
        return
    if stage == 1:  # sprout
        pts = [Vector((0, 0, 0.050)), Vector((0.003, 0.001, 0.070)), Vector((-0.002, 0, 0.098))]
        new_object("stem", tube_mesh("stem", pts, [0.0032, 0.0024, 0.0016]), material("stem", lin("#5c8a3c"), 0.8))
        lb = bmesh.new()
        blob(lb, Vector((0.014, 0.003, 0.100)), 0.018, 0.008, 0.003, sub=2, rot=0.2)
        blob(lb, Vector((-0.016, -0.002, 0.095)), 0.018, 0.008, 0.003, sub=2, rot=0.15)
        blob(lb, Vector((0.0, 0.0, 0.106)), 0.008, 0.006, 0.003, sub=1)
        new_object("leaves", mesh_from(lb, "leaves"), mat_leaf)
        return

    s, nb, roots = STAGES[stage]
    tp = [T(Vector((p.x * s, p.y * s, BASE_Z + p.z * s))) for p in TRUNK]
    radii = [r * s ** 0.8 for r in TRUNK_R]
    meshes = [tube_mesh("trunk", tp, radii)]
    if roots:
        for ang, ln in ((20, 0.036), (140, 0.032), (255, 0.038)):
            a = math.radians(ang)
            d = Vector((math.cos(a), math.sin(a), 0))
            rp = [Vector((0, 0, BASE_Z + 0.014)) + d * 0.006, Vector((0, 0, BASE_Z + 0.004)) + d * ln * 0.6,
                  Vector((0, 0, BASE_Z - 0.004)) + d * ln]
            meshes.append(tube_mesh("root", rp, [0.0095, 0.0060, 0.0028]))
    pads, stumps = [], []
    for i, (idx, off, pr) in enumerate(BRANCHES[:nb]):
        start = tp[idx]
        o = Vector((off.x * s, off.y * s, off.z * s - droop * 1.6))
        if health == "wrongcut" and i == 1:
            tip = start + o * 0.55
            meshes.append(tube_mesh("br", [start, start + o * 0.2 + Vector((0, 0, 0.006)), tip], [0.0070 * s, 0.0062 * s, 0.0058 * s]))
            stumps.append(tip)
            continue
        tip = start + o
        mid = start + o * 0.5 + Vector((0, 0, 0.012 * s))
        meshes.append(tube_mesh("br", [start, mid, tip], [0.0060 * s, 0.0042 * s, 0.0022 * s]))
        pads.append((tip + Vector((0, 0, 0.010 * s)), pr * s * shrink))
    pads.append((tp[-1] + Vector((0, 0, 0.016 * s - droop)), 0.048 * s * shrink))
    new_object("trunk", merge(meshes, "trunk"), MAT_TRUNK)
    if stumps:
        cb = bmesh.new()
        for st in stumps:
            blob(cb, st, 0.0078, 0.0078, 0.0030, sub=2)
        new_object("cutfaces", mesh_from(cb, "cut"), MAT_CUT)

    fz = 0.30 if health == "wilted" else 0.46
    fb = bmesh.new()
    for centre, radius in pads:
        for k in range(3):
            ang = random.uniform(0, math.tau)
            d = radius * (0.0 if k == 0 else 0.55)
            c = centre + Vector((d * math.cos(ang), d * math.sin(ang), random.uniform(-0.004, 0.006)))
            r = radius * (1.0 if k == 0 else random.uniform(0.62, 0.78))
            blob(fb, c, r, r * random.uniform(0.9, 1.05), r * fz, jit=0.07)
    fo = new_object("foliage", mesh_from(fb, "foliage"), mat_leaf)
    for p in fo.data.polygons:
        p.use_smooth = False

    if export or (season == "winter" and health in ("healthy", "stressed")):
        sb = bmesh.new()
        for centre, radius in pads:
            blob(sb, centre + Vector((0.002, 0, radius * fz * 0.70)), radius * 0.92, radius * 0.86, radius * 0.36, sub=2, jit=0.06)
        new_object("snow", mesh_from(sb, "snow"), MAT_SNOW)
    if stage == 4:
        bb = bmesh.new()
        n = 6 if health != "wilted" else 2
        for centre, radius in pads:
            for _ in range(n):
                a, d = random.uniform(0, math.tau), radius * random.uniform(0.1, 0.85)
                z = radius * fz * math.sqrt(max(1 - (d / radius) ** 2, 0)) + 0.002
                p = centre + Vector((d * math.cos(a), d * math.sin(a), z))
                if health == "wilted":
                    p.z -= 0.006
                blob(bb, p, 0.0115, 0.0115, 0.0085, sub=1)
        new_object("flowers", mesh_from(bb, "flowers"), mat_flower)
    if export or season == "autumn":
        lb = bmesh.new()
        for _ in range(7):
            a, d = random.uniform(0, math.tau), random.uniform(0.02, 0.07)
            blob(lb, Vector((d * math.cos(a), d * math.sin(a), 0.0545)), 0.008, 0.005, 0.0012, sub=1, rot=random.uniform(0, 3))
        new_object("fallen", mesh_from(lb, "fallen"), mat_leaf)
    if puddle or export:
        pb = bmesh.new()
        blob(pb, Vector((0.004, 0.002, 0.0535)), 0.060, 0.056, 0.0022, sub=3)
        new_object("puddle", mesh_from(pb, "puddle"), MAT_PUDDLE)
    if export:
        for i, (c, r) in enumerate(pads, 1):
            top = 0.040 * s if i == len(pads) else 0.030 * s
            e = bpy.data.objects.new(f"cut_{i:02d}", None)
            e.empty_display_type = "SPHERE"
            e.empty_display_size = 0.006
            e.location = c + Vector((0, 0, top))
            scene.collection.objects.link(e)

    if export or shoots:
        import shoots_mod
        shoots_mod.add_shoots(scene, tube_mesh, stage, pads, tp, s, only=(None if export else season))


def render(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    jobs = []
    for st in range(5):
        jobs.append((f"stage{st}", st, "summer", "healthy"))
    for se in ("spring", "autumn", "winter"):
        jobs.append((f"season_{se}", 4, se, "healthy"))
    jobs.append(("season_summer", 4, "summer", "healthy"))
    for h in ("healthy", "stressed", "wilted", "overwater", "wrongcut"):
        jobs.append((f"health_{h}", 3, "summer", h))
    for name, st, se, h in jobs:
        build(st, se, h)
        render(f"{OUT}/{name}.png")
        print("done", name, flush=True)
