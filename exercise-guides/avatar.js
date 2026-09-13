import * as THREE from './vendor/three.module.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z), D=Math.PI/180;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export function movement(t){return t<5?0:t<11?smooth((t-5)/6):t<15?1:t<21?1-smooth((t-15)/6):0;}
export function makeAvatar(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
 renderer.setSize(760,486);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#edf1eb');
 const camera=new THREE.OrthographicCamera(-1.4,1.4,.9,-.9,.01,30);
 scene.add(new THREE.HemisphereLight(0xffffff,0x8e9e8b,2.6));
 const sun=new THREE.DirectionalLight(0xfff5e5,3.2);sun.position.set(-2,5,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-3;sun.shadow.camera.right=3;sun.shadow.camera.top=3;sun.shadow.camera.bottom=-3;sun.shadow.normalBias=.025;scene.add(sun);
 const fill=new THREE.DirectionalLight(0xd4e5ff,1);fill.position.set(3,3,-3);scene.add(fill);
 const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.85});
 const skin=mat('#c79270'),shirt=mat('#567273'),pants=mat('#334744'),teal=mat('#438b78'),shoe=mat('#faf9f4'),sole=mat('#70817a'),hair=mat('#8e9087'),dark=mat('#324541');
 const wood=mat('#c5a888'),pad=mat('#f7f5ed'),metal=mat('#b6c2b7'),floorMat=mat('#edf1eb');
 const group=new THREE.Group();scene.add(group);
 const sphereGeo=new THREE.SphereGeometry(1,24,16),cylGeo=new THREE.CylinderGeometry(1,1,1,20);
 function ell(material,scale,parent=group){const m=new THREE.Mesh(sphereGeo,material);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function box(material,size,xyz,parent){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...xyz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function limb(material,r1,r2){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,1,20),material);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
 function between(m,a,b){m.position.copy(a).add(b).multiplyScalar(.5);m.scale.y=a.distanceTo(b);m.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize());}
 const body=ell(shirt,[.135,.285,.235]),pelvis=ell(pants,[.135,.135,.185]),neck=ell(skin,[.064,.087,.068]),head=ell(skin,[.119,.148,.116]),hairCap=ell(hair,[.12,.104,.119]);
 const nose=ell(skin,[.031,.033,.03]),earA=ell(skin,[.029,.047,.018]),earB=ell(skin,[.029,.047,.018]);
 const eyes=[ell(dark,[.008,.009,.008]),ell(dark,[.008,.009,.008])];
 const legs=[0,1].map(i=>({thigh:limb(i?pants:teal,.092,.072),shin:limb(skin,.068,.045),knee:ell(skin,[.068,.069,.07]),ankle:ell(skin,[.047,.055,.047]),foot:ell(shoe,[.139,.057,.068]),sole:ell(sole,[.142,.018,.071]),band:ell(teal,[.071,.016,.073])}));
 const arms=[0,1].map(()=>({shoulder:ell(shirt,[.073,.073,.073]),upper:limb(shirt,.072,.052),lower:limb(skin,.045,.034),elbow:ell(skin,[.049,.05,.048]),hand:ell(skin,[.039,.063,.035])}));
 const bed=new THREE.Group();scene.add(bed);box(wood,[2.05,.10,.91],[-.06,.28,0],bed);box(pad,[2.05,.13,.91],[-.06,.395,0],bed);box(pad,[.36,.08,.48],[-.82,.50,0],bed);
 for(const x of [-.83,.74])for(const z of [-.32,.32])box(metal,[.055,.25,.055],[x,.125,z],bed);
 const chair=new THREE.Group();scene.add(chair);box(wood,[.51,.065,.55],[-.38,.442,0],chair);box(wood,[.055,.43,.55],[-.61,.69,0],chair);
 for(const x of [-.58,-.17])for(const z of [-.23,.23])box(metal,[.036,.425,.036],[x,.212,z],chair);
 for(const z of [-.30,.30]){box(wood,[.49,.045,.055],[-.34,.70,z],chair);box(metal,[.025,.25,.025],[-.17,.56,z],chair);}
 const support=new THREE.Group();scene.add(support);box(wood,[.46,.06,1.05],[.77,1.025,0],support);for(const z of [-.43,.43])box(metal,[.05,1,.05],[.88,.5,z],support);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),floorMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const highlight=new THREE.Mesh(new THREE.TorusGeometry(.083,.008,12,40),mat('#c98944'));group.add(highlight);
 function ik(a,b,l1,l2,side=1){let dv=b.clone().sub(a),d=Math.max(.01,Math.min(l1+l2-.0001,dv.length()));let u=dv.normalize(),along=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-along*along));return a.clone().addScaledVector(u,along).addScaledVector(V(-u.y,u.x,0).normalize(),h*side);}
 function orientBody(hip,angle){const up=V(Math.sin(angle),Math.cos(angle),0),forward=V(Math.cos(angle),-Math.sin(angle),0);
  const p=(h,f=0,z=0)=>hip.clone().addScaledVector(up,h).addScaledVector(forward,f).add(V(0,0,z));
  body.position.copy(p(.25));body.rotation.z=-angle;pelvis.position.copy(hip);pelvis.rotation.z=-angle;
  neck.position.copy(p(.52));neck.rotation.z=-angle;head.position.copy(p(.674,.006));head.rotation.z=-angle;
  hairCap.position.copy(p(.737,-.023));hairCap.rotation.z=-angle;
  nose.position.copy(p(.675,.119));nose.rotation.z=-angle;
  earA.position.copy(p(.668,-.003,.116));earB.position.copy(p(.668,-.003,-.116));
  eyes[0].position.copy(p(.713,.103,.043));eyes[1].position.copy(p(.713,.103,-.043));
  return {p,up,forward};
 }
 function pose(id,t){const q=movement(t),lying=['heel_slide','straight_leg_raise','quad_set'].includes(id),sitting=id==='seated_extension',rising=id==='sit_to_stand',squatting=['mini_squat','squat'].includes(id),standing=!lying&&!sitting&&!rising;
  bed.visible=lying;chair.visible=sitting||rising;support.visible=['standing_flexion','mini_squat','squat','single_leg_stance'].includes(id);
  let hip=V(0,.97,0),angle=0,ps=[];
  if(lying){hip=V(-.06,.54,0);angle=-Math.PI/2;
   for(let i=0;i<2;i++){const z=i?-.14:.14,h=hip.clone().add(V(0,0,z));let a=0,k,an,theta;
    if(id==='straight_leg_raise'&&i===0){a=20*D*q;k=h.clone().add(V(.44*Math.cos(a),.44*Math.sin(a),0));an=k.clone().add(V(.43*Math.cos(a),.43*Math.sin(a),0));theta=Math.PI/2+a;}
    else if((id==='heel_slide'&&i===0)||(i===1&&id!=='heel_slide')){const bend=(i===1?1:q)*50*D;k=h.clone().add(V(.44*Math.cos(bend),.44*Math.sin(bend),0));an=h.clone().add(V(.44*Math.cos(bend)+Math.sqrt(.43**2-(.44*Math.sin(bend))**2),0,0));theta=Math.atan2(an.x-k.x,k.y-an.y);}
    else{const tiny=id==='quad_set'&&i===0?.006*(1-q):0;k=h.clone().add(V(.44,tiny,0));an=k.clone().add(V(.43,-tiny,0));theta=Math.PI/2;}
    ps.push({h,k,an,theta,footTheta:id==='heel_slide'?Math.PI/2:theta});
   }
  }else if(sitting){hip=V(-.36,.54,0);for(let i=0;i<2;i++){const z=i?-.14:.14,h=hip.clone().add(V(0,0,z)),k=h.clone().add(V(.44,0,0)),theta=i?0:Math.PI/2*q,an=k.clone().add(V(.43*Math.sin(theta),-.43*Math.cos(theta),0));ps.push({h,k,an,theta});}}
  else if(rising){hip=V(-.35*(1-q),.54+.43*q,0);angle=(32*Math.sin(Math.PI*q)+3*(1-q))*D;for(let i=0;i<2;i++){const z=i?-.14:.14,h=hip.clone().add(V(0,0,z)),an=V(.04,.10,z),k=ik(h,an,.44,.43);ps.push({h,k,an,theta:0});}}
  else if(squatting){let a=(id==='mini_squat'?12:21)*D*q,b=(id==='mini_squat'?24:49)*D*q;hip=V(.43*Math.sin(a)-.44*Math.sin(b),.10+.43*Math.cos(a)+.44*Math.cos(b),0);angle=(id==='mini_squat'?15:26)*D*q;for(let i=0;i<2;i++){const z=i?-.15:.15,an=V(0,.1,z),k=an.clone().add(V(.43*Math.sin(a),.43*Math.cos(a),0)),h=hip.clone().add(V(0,0,z));ps.push({h,k,an,theta:0});}}
  else{if(id==='single_leg_stance'){hip.z=.075*q;hip.y-=.006*q;}for(let i=0;i<2;i++){const z=i?-.14:.14,h=hip.clone().add(V(0,0,z));if(id==='single_leg_stance'&&i===0){const an=V(0,.10,.14),k=ik(h,an,.44,.43);ps.push({h,k,an,theta:0});continue;}let a=0,theta=0;if(id==='standing_flexion'&&i===0)theta=-83*D*q;if(id==='single_leg_stance'&&i===1){a=30*D*q;theta=-20*D*q;}const k=h.clone().add(V(.44*Math.sin(a),-.44*Math.cos(a),0)),an=k.clone().add(V(.43*Math.sin(theta),-.43*Math.cos(theta),0));ps.push({h,k,an,theta});}}
  const {p,up,forward}=orientBody(hip,angle);
  ps.forEach((v,i)=>{const l=legs[i];between(l.thigh,v.h,v.k);between(l.shin,v.k,v.an);l.knee.position.copy(v.k);l.ankle.position.copy(v.an);const theta=v.footTheta??v.theta;
   const f=V(Math.cos(theta),Math.sin(theta),0),u=V(-Math.sin(theta),Math.cos(theta),0);l.foot.position.copy(v.an).addScaledVector(f,.063).addScaledVector(u,-.044);l.foot.rotation.z=theta;
   l.sole.position.copy(l.foot.position).addScaledVector(u,-.039);l.sole.rotation.z=theta;l.band.position.copy(v.k).lerp(v.an,.14);l.band.quaternion.setFromUnitVectors(V(0,1,0),v.k.clone().sub(v.an).normalize());l.band.visible=i===0;
  });
  arms.forEach((a,i)=>{const z=i?-.245:.245,s=p(.445,0,z);let hand,elbow;
   if(lying){hand=hip.clone().add(V(.05,.015,z*1.1));elbow=hip.clone().add(V(-.22,.015,z*1.2));}
   else if(sitting){hand=hip.clone().add(V(.24,.02,z));elbow=p(.17,.08,z*1.05);}
   else if(rising){hand=V(-.17,.73,z*1.2).lerp(p(-.015,.13,z*1.1),smooth((q-.25)/.35));elbow=ik(s,hand,.27,.26,-1);}
   else if(support.visible){hand=V(.60,1.075,z*1.1);elbow=ik(s,hand,.29,.28,-1);}
   else{hand=p(-.02,.06,z*1.1);elbow=p(.20,.02,z*1.05);}
   a.shoulder.position.copy(s);between(a.upper,s,elbow);between(a.lower,elbow,hand);a.elbow.position.copy(elbow);a.hand.position.copy(hand);a.hand.quaternion.setFromUnitVectors(V(0,1,0),elbow.clone().sub(hand).normalize());
  });
  highlight.visible=id==='quad_set'&&t>=5&&t<21;highlight.position.copy(ps[0].k).lerp(ps[0].h,.47);highlight.position.z+=.07;highlight.rotation.y=Math.PI/2;highlight.scale.setScalar(.95+.06*Math.sin(t*3));
  if(lying){camera.left=-1.20;camera.right=1.20;camera.top=.768;camera.bottom=-.768;camera.position.set(1.0,2.15,7);camera.lookAt(-.03,.56,0);}
  else{camera.left=-1.45;camera.right=1.45;camera.top=.927;camera.bottom=-.927;camera.position.set(2.5,2.45,8);camera.lookAt(.03,.93,0);}
  camera.updateProjectionMatrix();renderer.render(scene,camera);
  return {exercise:id,t,q,joints:ps.map(({h,k,an})=>({hip:h.toArray(),knee:k.toArray(),ankle:an.toArray()}))};
 }
 return {pose,renderer,scene,camera,group,bed,chair,support};
}
