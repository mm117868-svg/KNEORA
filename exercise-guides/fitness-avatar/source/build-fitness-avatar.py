import sys,os,json
from pathlib import Path
import bpy,bmesh
root=Path(os.environ.get('FITNESS_TOOLS_DIR',str(Path(__file__).resolve().parents[4]/'character-tools'))) 
out=Path(os.environ.get('FITNESS_OUTPUT_DIR',str(Path(__file__).resolve().parents[1])))
sys.path.insert(0,str(root/'mpfb2'/'src'))
original_path=bpy.utils.extension_path_user
bpy.utils.extension_path_user=lambda package,*a,**kw:str(root/'mpfb-user') if package=='mpfb' else original_path(package,*a,**kw)
import mpfb
entry=bpy.context.preferences.addons.new();entry.module='mpfb'
mpfb.register()
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService
from mpfb.services.exportservice import ExportService
from mpfb.services.objectservice import ObjectService
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
macro=TargetService.get_default_macro_info_dict();macro.update(gender=1.0,age=.66,muscle=.57,weight=.43,height=.50,proportions=.5);macro['race']={'caucasian':1.,'asian':0.,'african':0.}
body=HumanService.create_human(macro_detail_dict=macro);body.name='FitnessAvatarBody'
TargetService.load_target(body,str(root/'mpfb2/src/mpfb/data/targets/mouth/mouth-angles-up.target.gz'),weight=.35)
assets=root/'assets'
HumanService.set_character_skin(str(assets/'skins/middleage_caucasian_male/middleage_caucasian_male.mhmat'),body,skin_type='GAMEENGINE')
rig=HumanService.add_builtin_rig(body,'game_engine')
if rig is None:rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
# Build fitted sports shorts directly from the weighted body surface.
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
mesh=bpy.data.meshes.new_from_object(body.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
shorts=bpy.data.objects.new('FitnessSportsShorts',mesh);bpy.context.collection.objects.link(shorts);shorts.parent=rig
shorts.matrix_world=body.matrix_world.copy()
for vg in body.vertex_groups:shorts.vertex_groups.new(name=vg.name)
bm=bmesh.new();bm.from_mesh(mesh)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<.60 or v.co.z>1.10 or abs(v.co.x)>.30],context='VERTS')
# Flatten the open waist and leg hems.
for v in bm.verts:
 if v.is_boundary:
  if v.co.z>.95:v.co.z=1.085
  elif v.co.z<.72:v.co.z=.615
bm.normal_update()
for v in bm.verts:
 v.co+=v.normal*.013
 if v.co.z<.83:
  centre=.13 if v.co.x>0 else -.13
  v.co.x=centre+(v.co.x-centre)*1.09
  v.co.y*=1.10
bm.to_mesh(mesh);bm.free()
shorts.data.materials.clear();m=bpy.data.materials.new('FitnessCharcoalShorts');m.use_nodes=True
m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.04,.052,.06,1)
m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.83;shorts.data.materials.append(m)
a=shorts.modifiers.new('Armature','ARMATURE');a.object=rig
sub=shorts.modifiers.new('Smooth sportswear','SUBSURF');sub.levels=1
loaded={}
for path,kind in [('eyes/high-poly/high-poly.mhclo','Eyes'),('eyebrows/eyebrow001/eyebrow001.mhclo','Eyebrows'),('eyelashes/eyelashes01/eyelashes01.mhclo','Eyelashes'),('teeth/teeth_base/teeth_base.mhclo','Teeth'),('hair/short04/short04.mhclo','Hair'),('clothes/toigo_basic_tucked_t-shirt/toigo_basic_tucked_t-shirt.mhclo','Clothes'),('clothes/shoes06/shoes06.mhclo','Clothes')]:
 print('ASSET',path,flush=True)
 loaded[path]=HumanService.add_mhclo_asset(str(assets/path),body,asset_type=kind,material_type='GAMEENGINE',subdiv_levels=1)
# Use understated solid sportswear colours, with no denim texture or logos.
for path,color in [('clothes/toigo_basic_tucked_t-shirt/toigo_basic_tucked_t-shirt.mhclo',(.11,.22,.23,1))]:
 obj=loaded[path];m=bpy.data.materials.new('Fitness_'+Path(path).stem);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=color;n.inputs['Roughness'].default_value=.78;obj.data.materials.clear();obj.data.materials.append(m)
# Softly subdivide skin while preserving the armature and clothing masks.
sub=body.modifiers.new('Smooth skin','SUBSURF');sub.levels=1;sub.render_levels=1
for obj in bpy.data.objects:
 if obj.type=='MESH':
  for face in obj.data.polygons:face.use_smooth=True
for m in bpy.data.materials:
 if not m.use_nodes:continue
 principled=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if principled and any(k in m.name for k in ['.body','.high-poly','.teeth_base']):
  for link in list(principled.inputs['Alpha'].links):m.node_tree.links.remove(link)
  principled.inputs['Alpha'].default_value=1.0
 if '.short04' in m.name:
  # Use a salt-and-pepper tint while retaining the hair strand alpha.
  if principled:
   base=principled.inputs['Base Color']
   for link in list(base.links):m.node_tree.links.remove(link)
   base.default_value=(.19,.18,.165,1)
rig.name='FitnessAvatarRig'
out.mkdir(exist_ok=True,parents=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'fitness-avatar-editable.blend'))
export_root=ExportService.create_character_copy(body,name_suffix='_export')
export_body=ObjectService.find_object_of_type_amongst_nearest_relatives(export_root,'Basemesh')
ExportService.bake_modifiers_remove_helpers(export_body,bake_masks=True,bake_subdiv=True,remove_helpers=True,also_proxy=True)
bpy.ops.object.select_all(action='DESELECT');export_root.select_set(True)
for obj in ObjectService.get_list_of_children(export_root):obj.select_set(True)
bpy.context.view_layer.objects.active=export_root
bpy.ops.export_scene.gltf(filepath=str(out/'fitness-avatar.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False)
bones=[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local)} for b in rig.data.bones]
(out/'source'/'skeleton.json').write_text(json.dumps(bones,indent=2)+'\n')
print('FITNESS_AVATAR_READY',out/'fitness-avatar.glb',flush=True)
