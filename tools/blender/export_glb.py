import sys, bpy
sys.argv=[sys.argv[0], sys.argv[-1]]
sys.path.insert(0, ".")
import gen_variants as g
out=sys.argv[1]
for st,name in enumerate(["seed","sprout","young","mature","blooming"]):
    g.build(st,"summer","healthy",export=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.context.scene.objects:
        if o.name not in g.KEEP: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=f"{out}/bonsai_{st}_{name}.glb",export_format="GLB",use_selection=True,export_yup=True, export_texcoords=False)
    print("exported",name,flush=True)
if True:
    g.build(4,"summer","wrongcut"); g.render(f"{out}/chk_stump.png")
    g.build(0,"summer","healthy"); g.render(f"{out}/chk_seed.png")
