"""Render the robot GLB to a 1200x630 OG image.
Run: blender --background --python blender/render_og.py
"""
import bpy
import mathutils
import os

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(os.getcwd(), "assets/robot.glb"))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1200
scene.render.resolution_y = 630

world = bpy.data.worlds.new("W")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.012, 0.013, 0.018, 1.0)
bg.inputs[1].default_value = 1.0
scene.world = world

def light(name, kind, loc, energy, color=(1, 1, 1), size=3.0):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == "AREA":
        data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    scene.collection.objects.link(obj)
    direction = mathutils.Vector((0, 0, 1.1)) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj

light("key", "AREA", (2.5, -3.0, 2.8), 900, (1.0, 0.98, 0.95), 4.0)
light("rim", "AREA", (-3.0, 2.5, 2.0), 500, (0.65, 0.72, 1.0), 4.0)
light("fill", "AREA", (-2.0, -2.5, 0.8), 220, (1, 1, 1), 5.0)

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 48
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (1.9, -4.1, 1.75)
direction = mathutils.Vector((0.05, 0, 1.18)) - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

scene.render.filepath = os.path.join(os.getcwd(), "images/og-robot.png")
bpy.ops.render.render(write_still=True)
print("rendered og image")
