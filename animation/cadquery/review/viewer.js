import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const el=id=>document.getElementById(id),canvas=el('model'),status=el('status'),play=el('play'),pause=el('pause'),reset=el('reset');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.01,1000);
let renderer,orbit,motion,frame=0,last=0;
const report=s=>status.textContent=s;
const draw=()=>renderer.render(scene,camera);
const stop=()=>{if(frame)cancelAnimationFrame(frame);frame=0;last=0};
function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(Math.max(r.width,1),Math.max(r.height,1),false);camera.aspect=Math.max(r.width,1)/Math.max(r.height,1);camera.updateProjectionMatrix();draw()}
function animate(now){frame=0;if(!motion.playing)return;if(last)motion.step(Math.min(Math.max((now-last)/1000,0),.1),Number(el('speed').value));last=now;draw();frame=requestAnimationFrame(animate)}
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:!reduced,alpha:true});
 scene.add(new THREE.HemisphereLight(0xffffff,0x334155,2));const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(4,6,5);scene.add(key);
 orbit=new OrbitControls(camera,canvas);orbit.enableDamping=false;orbit.addEventListener('change',draw);
 const gltf=await new GLTFLoader().loadAsync('../output/alternator-prototype/alternator-governed-prototype.glb');scene.add(gltf.scene);
 motion=window.createAlternatorMotion(gltf.scene,{reducedMotion:reduced});
 const sphere=new THREE.Box3().setFromObject(gltf.scene).getBoundingSphere(new THREE.Sphere());orbit.target.copy(sphere.center);camera.position.copy(sphere.center).add(new THREE.Vector3(sphere.radius*2,sphere.radius*1.3,sphere.radius*2.5));camera.far=Math.max(100,sphere.radius*40);camera.updateProjectionMatrix();orbit.update();resize();
 window.addEventListener('resize',resize);play.disabled=reduced;pause.disabled=false;reset.disabled=false;
 report(reduced?'Model loaded. Reduced motion enabled: rotation unavailable.':'Model loaded. Animation paused.');
 play.onclick=()=>{if(motion.start()){stop();report('Illustrative rotation playing.');frame=requestAnimationFrame(animate)}};
 pause.onclick=()=>{motion.pause();stop();report('Animation paused.')};
 reset.onclick=()=>{motion.reset();stop();draw();report('Animation reset.')};
 window.addEventListener('pagehide',()=>{stop();motion.dispose();orbit.dispose();renderer.dispose()},{once:true});
 window.__alternatorViewer={scene:gltf.scene,motion};
}catch(error){stop();el('fallback').hidden=false;canvas.hidden=true;play.disabled=true;pause.disabled=true;reset.disabled=true;report('3D model unavailable. Text description provided.');console.error(error)}
