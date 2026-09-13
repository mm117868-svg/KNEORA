import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {makeAvatar} from './avatar.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion();
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
// Two demonstrations, with time to understand the setup before movement starts.
export function motionTime(t){
 if(t<13)return 0;if(t<19)return 5+(t-13);if(t<25)return 12;
 if(t<31)return 15+(t-25);if(t<37)return 0;
 if(t<42)return 5+(t-37)*6/5;if(t<44)return 12;
 if(t<49)return 15+(t-44)*6/5;return 0;
}
export async function makeFitnessAvatar(canvas){
 const a=makeAvatar(canvas);a.group.visible=false;
 a.renderer.toneMapping=T.ACESFilmicToneMapping;a.renderer.toneMappingExposure=1.0;
 a.scene.background=new T.Color('#eeeae2');a.scene.traverse(o=>{if(o.isLight)o.intensity*=.7;});
 for(const i of [0,1])a.chair.children[i].material=new T.MeshStandardMaterial({color:'#d7cdbb',roughness:.95});
 a.scene.traverse(o=>{if(o.isDirectionalLight&&o.castShadow){o.shadow.radius=4;o.shadow.mapSize.set(2048,2048);}if(o.isMesh&&o.geometry.type==='PlaneGeometry')o.material.color.set('#eeeae2');});
 const gltf=await new GLTFLoader().loadAsync(new URL('./fitness-avatar/fitness-avatar.glb',import.meta.url).href);
 const group=gltf.scene;group.name='FitnessCharacter';group.rotation.y=Math.PI/2;a.scene.add(group);
 group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const m=o.material;
  if(/body|high.poly|teeth/.test(m.name)){m.transparent=false;m.depthWrite=true;m.opacity=1;}
  if(/short04|eyebrow|eyelash/.test(m.name)){m.alphaTest=.4;m.transparent=false;m.depthWrite=true;}
  m.roughness=Math.max(.65,m.roughness);}});
 group.updateMatrixWorld(true);
 const bones={},rest={};group.traverse(o=>{if(o.isBone){bones[o.name]=o;rest[o.name]={q:o.quaternion.clone(),p:o.position.clone(),worldQ:o.getWorldQuaternion(Q()),worldP:o.getWorldPosition(V())};}});
 const wp=n=>bones[n].getWorldPosition(V());
 const length=(n,c)=>rest[n].worldP.distanceTo(rest[c].worldP);
 function setWorld(n,q){bones[n].quaternion.copy(bones[n].parent.getWorldQuaternion(Q()).invert().multiply(q));bones[n].updateWorldMatrix(false,true);}
 function aim(n,c,dir){const from=rest[c].worldP.clone().sub(rest[n].worldP).normalize();setWorld(n,Q().setFromUnitVectors(from,dir.clone().normalize()).multiply(rest[n].worldQ));}
 function joint(h,an,l1,l2,bend){const v=an.clone().sub(h),d=Math.min(l1+l2-.00001,Math.max(.001,v.length())),u=v.normalize(),along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));let side=bend.clone().addScaledVector(u,-bend.dot(u)).normalize();return h.clone().addScaledVector(u,along).addScaledVector(side,height);}
 const axis=V(0,0,1);
 function pose(id,t){
  const r=a.pose(id,motionTime(t),false),lying=['heel_slide','straight_leg_raise','quad_set'].includes(id);
  for(const [n,b]of Object.entries(bones)){b.quaternion.copy(rest[n].q);b.position.copy(rest[n].p);}
  group.position.set(0,0,0);group.updateMatrixWorld(true);
  const tilt=Q().setFromAxisAngle(axis,-r.angle);setWorld('pelvis',tilt.clone().multiply(rest.pelvis.worldQ));
  // Place the pelvis without stretching the skeleton.
  const pelvisOffset=wp('pelvis');group.position.copy(r.hip).add(V(.01,.014,0)).sub(pelvisOffset);if(!lying&&id!=='seated_extension')group.position.y-=.022*(id==='sit_to_stand'?r.q:1);group.updateMatrixWorld(true);
  const legData=[];
  for(const [i,side]of ['r','l'].entries()){
   const n='thigh_'+side,c='calf_'+side,f='foot_'+side,b='ball_'+side,v=r.legs[i],h=wp(n);
   let an=v.an.clone();an.y-=lying?0:.011;an.z=h.z;
   let k;
   if(id==='seated_extension'||(lying&&(id==='straight_leg_raise'&&i===0||id==='quad_set'&&i===0))){
    const td=v.k.clone().sub(v.h).normalize(),sd=v.an.clone().sub(v.k).normalize();k=h.clone().addScaledVector(td,length(n,c));an=k.clone().addScaledVector(sd,length(c,f));
   }else{k=joint(h,an,length(n,c),length(c,f),V(1,lying?1:0,0));}
   aim(n,c,k.clone().sub(h));aim(c,f,an.clone().sub(k));
   let theta=v.footTheta??v.theta;if(lying&&i===1&&id!=='heel_slide')theta=0;if(id==='quad_set'&&i===0)theta=Math.PI/2-.12*(1-r.q);setWorld(f,Q().setFromAxisAngle(axis,theta).multiply(rest[f].worldQ));
   legData.push({hip:wp(n).toArray(),knee:wp(c).toArray(),ankle:wp(f).toArray()});
  }
  for(const [i,side]of ['r','l'].entries()){
   const n='upperarm_'+side,c='lowerarm_'+side,f='hand_'+side,h=wp(n),v=r.arms[i];
   let hand=v.hand.clone();
   if(id==='seated_extension'){hand=r.hip.clone().add(V(.22,.12,i?-.18:.18));}
   if(lying){hand=r.hip.clone().add(V(.05,.015,i?-.25:.25));}
   const elbow=joint(h,hand,length(n,c),length(c,f),lying?V(0,-1,i?-1:1):V(-1,0,i?-.1:.1));
   aim(n,c,elbow.clone().sub(h));aim(c,f,hand.clone().sub(elbow));
   // Hands follow the forearm in a relaxed, neutral position.
   const direction=id==='seated_extension'?V(1,-.2,0):hand.clone().sub(elbow).normalize();aim(f,'middle_01_'+side,direction);
  }
  group.updateMatrixWorld(true);
  if(id==='seated_extension'){
   a.camera.left=-1.14;a.camera.right=1.14;a.camera.top=.729;a.camera.bottom=-.729;
   a.camera.position.set(2.6,1.95,8);a.camera.lookAt(.02,.70,0);a.camera.updateProjectionMatrix();
  }
  a.renderer.render(a.scene,a.camera);
  return {exercise:id,t,q:r.q,joints:legData};
 }
 return {...a,pose,group,bones,rest,kind:'skinned-fitness-avatar'};
}
