"""Forest ring for the garden. Run: python3 gen_forest.py <outdir>
Game frame: origin under the table, game -Z (away from player) = Blender +Y.
Two meshes only (2 draw calls): forest_fixed (trunks + pines, fixed vertex colours)
and forest_leaf (broadleaf canopies; the game tints material 'foliage_forest' per season).
"""
import math
import random
import sys

import bpy
import bmesh
from mathutils import Vector

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def vc_material(name, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = rough
    a = nt.nodes.new("ShaderNodeVertexColor")
    a.layer_name = "Col"
    nt.links.new(a.outputs["Color"], b.inputs["Base Color"])
    return m


def paint(bm, color_fn):
    layer = bm.loops.layers.color.get("Col") or bm.loops.layers.color.new("Col")
    for f in bm.faces:
        for l in f.loops:
            l[layer] = color_fn(l.vert.co)


class Mesh:
    def __init__(self):
        self.bm = bmesh.new()
        self.tris = 0

    def add_tree_part(self, make, color_fn):
        """make(bm) -> creates geometry, returns verts; color_fn(co) -> rgba for those verts' faces."""
        before = set(self.bm.verts)
        make(self.bm)
        new = [v for v in self.bm.verts if v not in before]
        layer = self.bm.loops.layers.color.get("Col") or self.bm.loops.layers.color.new("Col")
        for f in self.bm.faces:
            if all(v in new for v in f.verts):
                for l in f.loops:
                    l[layer] = color_fn(l.vert.co)

    def finish(self, name, mat):
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces)
        self.tris = len(self.bm.faces)
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        ob = bpy.data.objects.new(name, me)
        scene.collection.objects.link(ob)
        ob.data.materials.append(mat)
        return ob


def tinted(base, var):
    return lambda co: (*[max(0, min(1, c + random.uniform(-var, var))) for c in base], 1.0)


fixed = Mesh()
leaf = Mesh()


def trunk(x, y, h, r, rot=0.0):
    def make(bm):
        res = bmesh.ops.create_cone(bm, cap_ends=False, segments=5, radius1=r, radius2=r * 0.55, depth=h)
        bmesh.ops.translate(bm, vec=(x, y, h / 2 - 0.05), verts=res["verts"])
    shade = random.uniform(-0.03, 0.03)
    fixed.add_tree_part(make, lambda co: (0.20 + shade, 0.13 + shade, 0.085 + shade, 1.0))


def blob(x, y, z, rx, ry, rz, sub=1):
    def make(bm):
        res = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
        for v in res["verts"]:
            j = 1 + random.uniform(-0.12, 0.12)
            v.co = Vector((v.co.x * rx * j, v.co.y * ry * j, v.co.z * rz * j)) + Vector((x, y, z))
    tone = random.uniform(0.82, 1.0)

    def col(co):
        t = max(0.0, min(1.0, (co.z - (z - rz)) / (2 * rz)))  # darker underneath
        v = tone * (0.62 + 0.38 * t)
        return (v, v, v, 1.0)
    leaf.add_tree_part(make, col)


def pine(x, y, h):
    trunk(x, y, h * 0.30, h * 0.035)
    tone = random.uniform(-0.025, 0.025)
    for i, (zf, rf) in enumerate(((0.22, 0.22), (0.44, 0.17), (0.66, 0.12))):
        def make(bm, zf=zf, rf=rf):
            res = bmesh.ops.create_cone(bm, cap_ends=False, segments=7, radius1=h * rf, radius2=0.0, depth=h * 0.42)
            bmesh.ops.translate(bm, vec=(x, y, h * zf + h * 0.21), verts=res["verts"])
        k = 0.78 + 0.1 * i
        fixed.add_tree_part(make, lambda co, k=k: (0.07 * k + tone, 0.24 * k + tone, 0.15 * k + tone, 1.0))


def broadleaf(x, y, h, near):
    trunk(x, y, h * 0.5, h * 0.045)
    r = h * 0.30
    blob(x, y, h * 0.62, r, r * random.uniform(0.9, 1.1), r * 0.78)
    if near:
        a = random.uniform(0, math.tau)
        blob(x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55, h * 0.50, r * 0.62, r * 0.62, r * 0.5)


placed = []
count_p = count_b = 0
tries = 0
while len(placed) < 64 and tries < 4000:
    tries += 1
    ang = random.uniform(0, math.tau)
    behind = max(0.0, math.sin(ang))  # +Y (away from the player) is 1
    r = random.uniform(5.4, 9.0) + (1 - behind) * random.uniform(1.5, 4.0)
    x, y = r * math.cos(ang), r * math.sin(ang)
    h = random.uniform(2.8, 4.6) * (0.85 + (r - 5) * 0.06)
    if any(math.hypot(x - px, y - py) < 1.5 for px, py, _ in placed):
        continue
    if random.random() < 0.38:
        pine(x, y, h)
        count_p += 1
    else:
        broadleaf(x, y, h, near=(r < 8.0))
        count_b += 1
    placed.append((x, y, h))

# distant low "hills" of canopy so the horizon is never empty
for i in range(16):
    ang = i / 16 * math.tau + random.uniform(-0.1, 0.1)
    r = random.uniform(13, 16)
    blob(r * math.cos(ang), r * math.sin(ang), 1.2, random.uniform(3.5, 5), random.uniform(3.5, 5), random.uniform(2.4, 3.4), sub=1)

mat_fixed = vc_material("forest_fixed")
mat_leaf = vc_material("foliage_forest")
fo = fixed.finish("forest_fixed", mat_fixed)
lo = leaf.finish("forest_leaf", mat_leaf)
for o in (fo, lo):
    for p in o.data.polygons:
        p.use_smooth = False
print(f"pines={count_p} broadleaf={count_b} tris fixed={fixed.tris} leaf={leaf.tris} total={fixed.tris + leaf.tris}")

# ---- export
bpy.ops.object.select_all(action="DESELECT")
fo.select_set(True)
lo.select_set(True)
bpy.ops.export_scene.gltf(filepath=f"{OUT}/forest.glb", export_format="GLB", use_selection=True, export_yup=True)

# ---- preview: seated view, 4 seasons (tint like the game will)
SEASON_TINT = {"spring": "#e9b6cb", "summer": "#4f8f3d", "autumn": "#c8622f", "winter": "#dfe9ee"}
SKY = (0.70, 0.78, 0.82)


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


w = bpy.data.worlds.new("w")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (*SKY, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
scene.world = w
gm = bpy.data.meshes.new("ground")
gb = bmesh.new()
bmesh.ops.create_circle(gb, cap_ends=True, radius=8.0, segments=48)
gb.to_mesh(gm)
gb.free()
g = bpy.data.objects.new("ground", gm)
scene.collection.objects.link(g)
gmat = bpy.data.materials.new("g")
gmat.use_nodes = True
gmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.67, 0.58, 0.40, 1)
g.data.materials.append(gmat)
# fence stand-in (bamboo arc, radius 4.2, +-70 deg behind)
fb = bmesh.new()
for i in range(40):
    a = math.radians(90 - 70 + i / 39 * 140)
    res = bmesh.ops.create_cone(fb, cap_ends=True, segments=5, radius1=0.04, radius2=0.04, depth=1.55)
    bmesh.ops.translate(fb, vec=(4.2 * math.cos(a), 4.2 * math.sin(a), 0.78), verts=res["verts"])
fm = bpy.data.meshes.new("fence")
fb.to_mesh(fm)
fb.free()
fe = bpy.data.objects.new("fence", fm)
scene.collection.objects.link(fe)
fmat = bpy.data.materials.new("f")
fmat.use_nodes = True
fmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.45, 0.38, 0.18, 1)
fe.data.materials.append(fmat)
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.2
sun.rotation_euler = (math.radians(55), math.radians(5), math.radians(-30))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 20
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = Vector((0, -0.6, 1.25))
cam.rotation_euler = (math.radians(84), 0, 0)
scene.render.engine = "CYCLES"
scene.view_settings.view_transform = "Standard"
scene.cycles.device = "CPU"
scene.cycles.samples = 16
scene.render.resolution_x = 760
scene.render.resolution_y = 480
for s, hexv in SEASON_TINT.items():
    mat_leaf.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 1, 1, 1)
    # tint = multiply vertex colour by season colour (what the game does with material.color)
    mix = mat_leaf.node_tree.nodes.get("tint") or mat_leaf.node_tree.nodes.new("ShaderNodeMix")
    mix.name = "tint"
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    vcn = [n for n in mat_leaf.node_tree.nodes if n.bl_idname == "ShaderNodeVertexColor"][0]
    mat_leaf.node_tree.links.new(vcn.outputs["Color"], mix.inputs[6])
    mix.inputs[7].default_value = (*lin(hexv), 1)
    mat_leaf.node_tree.links.new(mix.outputs[2], mat_leaf.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    scene.render.filepath = f"{OUT}/forest_{s}.png"
    bpy.ops.render.render(write_still=True)
    print("rendered", s, flush=True)
