"""Forest v2: composed groves, three species, bushes, baked shading, distant ridges (shakkei).
Same two meshes and material names as v1 (drop-in): forest_fixed (fixed vertex colours) and
forest_leaf (material 'foliage_forest', tinted per season by the game).
Game frame: origin under the table, Blender +Y = away from the player."""
import math, random, sys
import bpy, bmesh
from mathutils import Vector, noise

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
random.seed(23)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def lin(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def vc_material(name, rough=0.9):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]; b.inputs["Roughness"].default_value = rough
    a = nt.nodes.new("ShaderNodeVertexColor"); a.layer_name = "Col"
    nt.links.new(a.outputs["Color"], b.inputs["Base Color"]); return m


class M:
    """Each part is built and painted in its own bmesh, then appended: no index bookkeeping."""
    def __init__(self):
        self.parts = []

    def add(self, make, colfn):
        bm = bmesh.new()
        make(bm)
        bm.normal_update()
        col = bm.loops.layers.float_color.new("Col")
        for f in bm.faces:
            for l in f.loops:
                l[col] = (*colfn(l.vert.co, f), 1.0)
        me = bpy.data.meshes.new("part")
        bm.to_mesh(me)
        bm.free()
        self.parts.append(me)

    def finish(self, name, mat):
        bm = bmesh.new()
        for me in self.parts:
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        n = len(bm.faces)
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob); me.materials.append(mat)
        for p in me.polygons: p.use_smooth = False
        return ob, n


fixed, leaf = M(), M()
SUN = Vector((-0.45, -0.35, 0.82)).normalized()   # light from the front-left, high


def lit(base, f, lo=0.62, hi=1.06):
    """Bake a simple key light into a face colour (flat shaded, stylised)."""
    d = max(0.0, f.normal.dot(SUN)) if f else 0.6
    k = lo + (hi - lo) * d
    return tuple(min(1.0, c * k) for c in base)


def haze(c, dist):
    """Aerial perspective: far things fade toward the sky colour."""
    t = max(0.0, min(0.55, (dist - 7.0) / 22.0))
    sky = lin("#c9d6dc")
    return tuple(c * (1 - t) + s * t for c, s in zip(c, sky))


def cone(bm, x, y, z0, h, r0, r1, seg):
    res = bmesh.ops.create_cone(bm, cap_ends=False, segments=seg, radius1=r0, radius2=r1, depth=h)
    bmesh.ops.translate(bm, vec=(x, y, z0 + h / 2), verts=res["verts"])
    return res


def blob(bm, c, rx, ry, rz, sub=1, jit=0.12, seed=0.0):
    res = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    for v in res["verts"]:
        n = noise.noise(v.co * 2.3 + Vector((seed, seed * 0.7, 0)))
        j = 1 + jit * n
        v.co = Vector((v.co.x * rx * j, v.co.y * ry * j, v.co.z * rz * j)) + c


def trunk(x, y, h, r, dist):
    bark = lin("#5a3d28")
    def col(co, f):
        t = max(0.0, min(1.0, co.z / max(h, 1e-3)))
        b = tuple(c * (0.45 + 0.55 * t) for c in bark)       # dark at the root: grounded
        return haze(lit(b, f), dist)
    fixed.add(lambda bm: cone(bm, x, y, -0.05, h, r, r * 0.55, 6), col)


def pine(x, y, h, dist):
    trunk(x, y, h * 0.32, h * 0.035, dist)
    g = lin("#24553a"); g = tuple(c * random.uniform(0.9, 1.1) for c in g)
    for i, (zf, rf) in enumerate(((0.20, 0.24), (0.42, 0.19), (0.62, 0.14), (0.80, 0.08))):
        def col(co, f, i=i):
            under = 0.55 if f.normal.z < -0.2 else 1.0
            return haze(lit(tuple(c * (0.78 + 0.07 * i) * under for c in g), f), dist)
        fixed.add(lambda bm, zf=zf, rf=rf: cone(bm, x, y, h * zf, h * 0.36, h * rf, 0.0, 7), col)


def cypress(x, y, h, dist):
    trunk(x, y, h * 0.15, h * 0.03, dist)
    g = lin("#2f5a34")
    def col(co, f):
        t = max(0.0, min(1.0, (co.z - h * 0.1) / h))
        return haze(lit(tuple(c * (0.7 + 0.35 * t) for c in g), f), dist)
    fixed.add(lambda bm: blob(bm, Vector((x, y, h * 0.55)), h * 0.14, h * 0.14, h * 0.48, sub=1, jit=0.08, seed=x), col)


def broadleaf(x, y, h, dist, lobes=3):
    trunk(x, y, h * 0.55, h * 0.045, dist)
    r = h * 0.28
    tone = random.uniform(0.86, 1.0)
    for k in range(lobes):
        a = random.uniform(0, math.tau)
        d = 0 if k == 0 else r * random.uniform(0.45, 0.65)
        cz = h * (0.66 if k == 0 else random.uniform(0.52, 0.72))
        rr = r * (1.0 if k == 0 else random.uniform(0.55, 0.75))
        c = Vector((x + d * math.cos(a), y + d * math.sin(a), cz))
        def col(co, f, c=c, rr=rr):
            t = max(0.0, min(1.0, (co.z - (c.z - rr * 0.8)) / (1.6 * rr)))
            ao = 0.5 + 0.5 * t                                   # dark underside
            v = tone * ao
            return haze(lit((v, v, v), f, 0.7, 1.08), dist)
        leaf.add(lambda bm, c=c, rr=rr: blob(bm, c, rr, rr * random.uniform(0.85, 1.05), rr * 0.78, sub=1, seed=x + k), col)


def bush(x, y, s, dist):
    for k in range(random.randint(2, 3)):
        c = Vector((x + random.uniform(-s, s) * 0.6, y + random.uniform(-s, s) * 0.6, s * 0.35))
        rr = s * random.uniform(0.55, 0.85)
        def col(co, f, c=c, rr=rr):
            t = max(0.0, min(1.0, (co.z) / (rr * 1.2)))
            v = 0.42 + 0.48 * t                                    # roots in shadow
            return haze(lit((v, v, v), f, 0.72, 1.05), dist)
        leaf.add(lambda bm, c=c, rr=rr: blob(bm, c, rr, rr * 0.9, rr * 0.85, sub=1, seed=y + k), col)


# --- composition: groves frame the garden, an opening behind shows the far ridges ---
placed = []
def free(x, y, d):
    return all(math.hypot(x - px, y - py) > d for px, py in placed)

def grove(cx_ang, spread, rmin, rmax, n, kinds, hscale=1.0):
    tries = 0; made = 0
    while made < n and tries < 2000:
        tries += 1
        a = math.radians(cx_ang + random.gauss(0, spread))
        r = random.uniform(rmin, rmax)
        x, y = r * math.cos(a), r * math.sin(a)
        if not free(x, y, 1.25):
            continue
        h = random.uniform(3.0, 4.8) * hscale * (0.9 + (r - 5) * 0.05)
        kind = random.choices(list(kinds), weights=list(kinds.values()))[0]
        {"pine": pine, "cypress": cypress}.get(kind, lambda x, y, h, d: broadleaf(x, y, h, d))(x, y, h, r)
        if random.random() < 0.55:
            bush(x * (1 + random.uniform(0.0, 0.12)), y * (1 + random.uniform(0.0, 0.12)), random.uniform(0.35, 0.55), r)
        placed.append((x, y)); made += 1

# (angles: 90 = straight ahead behind the fence, 0 = right, 180 = left, 270 = behind the player)
grove(150, 14, 6.0, 9.0, 14, {"broadleaf": 5, "pine": 3, "cypress": 2})     # left grove, frames the view
grove(32, 12, 6.0, 9.0, 12, {"pine": 4, "broadleaf": 4, "cypress": 2})      # right grove
grove(92, 16, 9.0, 12.5, 7, {"broadleaf": 6, "pine": 1}, 0.8)               # low, far trees in the opening
grove(270, 40, 6.0, 10.0, 16, {"broadleaf": 4, "pine": 4, "cypress": 1})    # behind the player
grove(215, 18, 6.0, 10.0, 7, {"pine": 3, "broadleaf": 3})
grove(330, 18, 6.0, 10.0, 7, {"pine": 3, "broadleaf": 3})
# bushes behind the fence, peeking over it: kept clear of the poles (fence radius 4.2 m)
def hedge_bush(a, s):
    for k in range(random.randint(2, 3)):
        rr = s * random.uniform(0.55, 0.8)
        r = 4.5 + rr * 1.15 + random.uniform(0.0, 0.25)          # nearest edge >= ~4.5 m
        aa = a + random.uniform(-0.05, 0.05)
        c = Vector((r * math.cos(aa), r * math.sin(aa), rr * 0.55))
        def col(co, f, c=c, rr=rr):
            t = max(0.0, min(1.0, co.z / (rr * 1.3)))
            v = 0.42 + 0.48 * t
            return haze(lit((v, v, v), f, 0.72, 1.05), r)
        leaf.add(lambda bm, c=c, rr=rr: blob(bm, c, rr, rr * 0.9, rr * 0.85, sub=1, jit=0.08, seed=a * 10 + k), col)
for i in range(12):
    hedge_bush(math.radians(90 - 66 + i * 132 / 11 + random.uniform(-3, 3)), random.uniform(0.5, 0.7))

# --- distant ridges (shakkei): two layers, hazier further away; fixed colours ---
def ridge(R, base_h, amp, seed, col_hex, segs=72):
    def make(bm):
        vs = []
        for i in range(segs + 1):
            a = i / segs * math.tau
            hgt = base_h + amp * (0.6 * noise.noise(Vector((math.cos(a) * 1.7 + seed, math.sin(a) * 1.7, seed))) + 0.4 * noise.noise(Vector((math.cos(a) * 4 + seed, math.sin(a) * 4, 1))))
            hgt *= 0.65 + 0.35 * max(0, math.sin(a))          # higher behind the fence: a framed view
            p0 = bm.verts.new((R * math.cos(a), R * math.sin(a), -0.6))
            p1 = bm.verts.new((R * math.cos(a), R * math.sin(a), max(1.0, hgt)))
            vs.append((p0, p1))
        for i in range(segs):
            a0, a1 = vs[i]; b0, b1 = vs[i + 1]
            bm.faces.new((a0, b0, b1, a1))
    base = lin(col_hex)
    def col(co, f):
        t = max(0.0, min(1.0, co.z / 8.0))
        return tuple(c * (0.85 + 0.25 * t) for c in base)
    fixed.add(make, col)

ridge(23.5, 5.5, 4.5, 3.1, "#8fa3a8")
ridge(18.5, 3.0, 2.4, 7.7, "#6f8a7c")

def clearance():
    worst = 99.0
    for M_ in (fixed, leaf):
        for me in M_.parts:
            for v in me.vertices:
                x, y, z = v.co
                ang = math.degrees(math.atan2(y, x))
                if 90 - 72 <= ang <= 90 + 72 and z < 1.75:
                    worst = min(worst, abs(math.hypot(x, y) - 4.2))
    return worst
print("fence clearance (m):", round(clearance(), 3))
mat_fixed = vc_material("forest_fixed"); mat_leaf = vc_material("foliage_forest")
fo, nf = fixed.finish("forest_fixed", mat_fixed); lo, nl = leaf.finish("forest_leaf", mat_leaf)
print(f"trees={len(placed)} tris fixed={nf} leaf={nl} total={nf + nl}")
for o in (fo, lo):
    for p in o.data.polygons: p.use_smooth = False
# ridges are seen from the inside only: make sure their faces point to the centre
bpy.ops.object.select_all(action="DESELECT"); fo.select_set(True); lo.select_set(True)
bpy.ops.export_scene.gltf(filepath=f"{OUT}/forest.glb", export_format="GLB", use_selection=True, export_yup=True, export_texcoords=False)

# ---------------- preview (game-like tint, seated eye) ----------------
w = bpy.data.worlds.new("w"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (*lin("#cfdbe0"), 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
scene.world = w
gm = bpy.data.meshes.new("ground"); gb = bmesh.new()
bmesh.ops.create_circle(gb, cap_ends=True, radius=21.0, segments=64); gb.to_mesh(gm); gb.free()
g = bpy.data.objects.new("ground", gm); scene.collection.objects.link(g)
gmat = bpy.data.materials.new("g"); gmat.use_nodes = True
gmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*lin("#d9b77e"), 1)
g.data.materials.append(gmat)
fb = bmesh.new()
for i in range(44):
    a = math.radians(90 - 70 + i / 43 * 140)
    res = bmesh.ops.create_cone(fb, cap_ends=True, segments=5, radius1=0.04, radius2=0.04, depth=1.55)
    bmesh.ops.translate(fb, vec=(4.2 * math.cos(a), 4.2 * math.sin(a), 0.78), verts=res["verts"])
fm = bpy.data.meshes.new("fence"); fb.to_mesh(fm); fb.free()
fe = bpy.data.objects.new("fence", fm); scene.collection.objects.link(fe)
fmat = bpy.data.materials.new("f"); fmat.use_nodes = True
fmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*lin("#b5a463"), 1)
fe.data.materials.append(fmat)
# emission-based preview so we see the baked colours as the game will (unlit-ish), plus soft sun
for m in (mat_fixed, mat_leaf):
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Emission Strength"].default_value = 0.0
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 2.2
sun.rotation_euler = (math.radians(40), math.radians(-25), math.radians(-35)); scene.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); cam.data.lens = 20
scene.collection.objects.link(cam); scene.camera = cam
scene.render.engine = "CYCLES"; scene.view_settings.view_transform = "Standard"
scene.cycles.device = "CPU"; scene.cycles.samples = 16
scene.render.resolution_x = 900; scene.render.resolution_y = 500
tint = {"summer": "#4f8f3d", "autumn": "#c8622f", "winter": "#eef4f7", "spring": "#e9b6cb"}
nt = mat_leaf.node_tree
mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs[0].default_value = 1.0
vcn = [n for n in nt.nodes if n.bl_idname == "ShaderNodeVertexColor"][0]
nt.links.new(vcn.outputs["Color"], mix.inputs[6]); nt.links.new(mix.outputs[2], nt.nodes["Principled BSDF"].inputs["Base Color"])
for view, rot in (("front", 0), ("back", 180)):
    cam.location = Vector((0, -0.6, 1.25)); cam.rotation_euler = (math.radians(86), 0, math.radians(rot))
    for s in (("summer", "autumn") if view == "front" else ("summer",)):
        mix.inputs[7].default_value = (*lin(tint[s]), 1)
        scene.render.filepath = f"{OUT}/f2_{view}_{s}.png"; bpy.ops.render.render(write_still=True)
print("ok")
