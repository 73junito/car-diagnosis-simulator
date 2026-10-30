'use strict';
// Presentation-only 3D review assets. No diagnostic, engineering, or assessment authority.
const fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
let pos=[],color=[],indices=[];
const palette={yellow:[0.95,0.72,0.12,1],dark:[0.10,0.14,0.18,1],black:[0.03,0.045,0.055,1],lcd:[0.38,0.89,0.69,1],red:[0.82,0.12,0.20,1],steel:[0.59,0.65,0.70,1],gray:[0.39,0.43,0.47,1],blue:[0.24,0.42,0.56,1],copper:[0.71,0.38,0.14,1],cream:[0.90,0.91,0.81,1]};
function mesh(vertices,faces,c){const o=pos.length/3;for(const v of vertices){pos.push(...v);color.push(...c)} for(const f of faces)indices.push(o+f)}
function box(x,y,z,w,h,d,c){const a=x-w/2,b=x+w/2,e=y-h/2,f=y+h/2,g=z-d/2,j=z+d/2;
mesh([[a,e,g],[b,e,g],[b,f,g],[a,f,g],[a,e,j],[b,e,j],[b,f,j],[a,f,j]],[0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,1,5,6,1,6,2,0,3,7,0,7,4],c)}
function cyl(x,y,z,r,length,c,axis='y',segments=24){const verts=[];const faces=[];for(let k=0;k<2;k++)for(let i=0;i<segments;i++){const theta=2*Math.PI*i/segments;let a=r*Math.cos(theta),b=r*Math.sin(theta),long=(k-.5)*length;verts.push(axis==='y'?[x+a,y+long,z+b]:axis==='z'?[x+a,y+b,z+long]:[x+long,y+a,z+b])}for(let i=0;i<segments;i++){const j=(i+1)%segments;faces.push(i,j,i+segments,j,j+segments,i+segments)}for(let i=1;i<segments-1;i++){faces.push(0,i+1,i,segments,segments+i,segments+i+1)}mesh(verts,faces,c)}
function torus(x,y,z,r,t,c,axis='z'){const n=24,m=8,v=[],f=[];for(let i=0;i<n;i++)for(let j=0;j<m;j++){const a=2*Math.PI*i/n,b=2*Math.PI*j/m,R=r+t*Math.cos(b);v.push(axis==='z'?[x+R*Math.cos(a),y+R*Math.sin(a),z+t*Math.sin(b)]:[x+R*Math.cos(a),y+t*Math.sin(b),z+R*Math.sin(a)])}for(let i=0;i<n;i++)for(let j=0;j<m;j++){const a=i*m+j,b=((i+1)%n)*m+j,c=((i+1)%n)*m+(j+1)%m,d=i*m+(j+1)%m;f.push(a,b,c,a,c,d)}mesh(v,f,c)}
// Low-poly insulated probe lead rendered as a continuous round tube.
function lead(points,r,c){for(let k=0;k<points.length-1;k++){const a=points[k],b=points[k+1],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz);if(!len)continue;const ux=dx/len,uy=dy/len,uz=dz/len,ref=Math.abs(uy)>.9?[1,0,0]:[0,1,0];let vx=uy*ref[2]-uz*ref[1],vy=uz*ref[0]-ux*ref[2],vz=ux*ref[1]-uy*ref[0];const vl=Math.hypot(vx,vy,vz);vx/=vl;vy/=vl;vz/=vl;const wx=uy*vz-uz*vy,wy=uz*vx-ux*vz,wz=ux*vy-uy*vx,n=10,vertices=[],faces=[];for(let j=0;j<2;j++)for(let i=0;i<n;i++){const t=2*Math.PI*i/n,center=j?b:a;vertices.push([center[0]+r*(Math.cos(t)*vx+Math.sin(t)*wx),center[1]+r*(Math.cos(t)*vy+Math.sin(t)*wy),center[2]+r*(Math.cos(t)*vz+Math.sin(t)*wz)])}for(let i=0;i<n;i++){const j=(i+1)%n;faces.push(i,j,n+i,j,n+j,n+i)}mesh(vertices,faces,c)}}
function build(kind){
if(kind==='meter'){
 box(0,0,0,1.65,3.2,.54,palette.yellow);box(0,.03,.30,1.46,2.93,.10,palette.dark);
 box(0,.91,.37,1.20,.68,.055,palette.black);box(0,.91,.403,1.03,.43,.018,palette.lcd);
 for(let i=0;i<4;i++)box(-.48+i*.32,.36,.38,.22,.12,.04,i===0?palette.red:palette.gray);
 cyl(0,-.47,.39,.54,.14,palette.black,'z');cyl(0,-.47,.5,.36,.1,palette.gray,'z');
 box(.12,-.30,.56,.11,.40,.07,palette.cream);
 for(let i=0;i<2;i++){let x=i===0?-.50:.5;cyl(x,-1.27,.40,.16,.12,i===0?palette.black:palette.red,'z');cyl(x,-1.27,.48,.080,.025,palette.black,'z')}
 for(let i=0;i<4;i++)box(-.48+i*.32,1.35,.37,.21,.075,.035,palette.cream);
 // Protective bumper ribs, segmented display digits, selector tick marks and molded grip.
 for(let y of [-1.05,-.78,-.52,.18,.52]){box(-.77,y,.28,.075,.11,.07,palette.black);box(.77,y,.28,.075,.11,.07,palette.black)}
 for(let i=0;i<10;i++){const a=2*Math.PI*i/10;box(.66*Math.cos(a),-.47+.66*Math.sin(a),.35,.09,.09,.045,palette.cream)}
 for(let i=0;i<3;i++){box(-.30+i*.25,.96,.425,.07,.20,.025,palette.dark);box(-.30+i*.25,.86,.425,.07,.20,.025,palette.dark)}
 box(-.44,-1.43,.39,.18,.06,.05,palette.cream);box(.47,-1.43,.39,.18,.06,.05,palette.cream);
 // Separate insulated leads and probe handles, with exposed metal probe tips.
 const blackPath=[[-.5,-1.29,.48],[-.58,-1.55,.55],[-1,-2.05,.53],[-1.25,-2.52,.55],[-1.2,-2.95,.60],[-.92,-3.24,.65]];
 const redPath=[[.5,-1.29,.48],[.67,-1.65,.55],[1.05,-2.0,.53],[1.23,-2.54,.57],[1.04,-2.99,.61],[.85,-3.34,.65]];
 lead(blackPath,.045,palette.black);lead(redPath,.045,palette.red);
 box(-.92,-3.44,.65,.13,.43,.13,palette.black);box(.85,-3.54,.65,.13,.43,.13,palette.red);
 cyl(-.92,-3.77,.65,.045,.25,palette.steel);cyl(.85,-3.87,.65,.045,.25,palette.steel);
 // Flexible strain-relief collars and contrasting socket rings help distinguish the probes.
 for(const [x,y,c] of [[-.5,-1.35,palette.black],[.5,-1.35,palette.red]]) {
   cyl(x,y,.49,.125,.18,palette.dark,'y');
   cyl(x,y-.12,.49,.090,.075,c,'y');
 }
 for(const [x,y,c] of [[-.92,-3.35,palette.black],[.85,-3.45,palette.red]]) {
   cyl(x,y,.65,.105,.16,c);
   for(let k=0;k<3;k++)cyl(x,y-.11+k*.06,.65,.108,.018,palette.dark);
 }
 box(0,1.59,.09,1.38,.095,.60,palette.dark);
}else if(kind==='starter'){
 cyl(0,0,0,.76,2.6,palette.gray,'x',32);
 for(let x of [-1.15,-.85,.78,1.12])torus(x,0,0,.76,.06,palette.steel,'y');
 cyl(-1.38,0,0,.49,.25,palette.steel,'x');
 cyl(-1.67,0,0,.24,.42,palette.dark,'x');
 cyl(-2,0,0,.23,.29,palette.steel,'x');
 for(let i=0;i<8;i++){const a=2*Math.PI*i/8;box(0,.77*Math.sin(a),.77*Math.cos(a),1.65,.095,.10,palette.steel)}
 box(0,-.86,-.32,1.5,.20,.70,palette.steel);
 for(let x of [-.65,.65])cyl(x,-1.02,-.32,.13,.18,palette.dark,'y');
 cyl(-.25,.92,.34,.34,1.75,palette.gray,'x');
 for(let x of [-.85,.4]){cyl(x,1.26,.34,.13,.32,palette.copper,'y');cyl(x,1.43,.34,.16,.055,palette.steel,'y')}
 // Cast end-cover contours, through-bolts, nose gear teeth and mounting bolt bosses.
 for(let i=0;i<10;i++){const a=2*Math.PI*i/10;box(-2.09,.28*Math.cos(a),.28*Math.sin(a),.27,.10,.10,palette.steel)}
 for(let i=0;i<4;i++){const a=2*Math.PI*i/4;cyl(.99,.49*Math.cos(a),.49*Math.sin(a),.075,.20,palette.dark,'x')}
 for(let x of [-.75,.72]){box(x,-.89,-.69,.40,.16,.40,palette.steel);cyl(x,-.99,-.70,.11,.24,palette.dark,'y')}
 box(.9,.32,.61,.30,.22,.20,palette.dark);
 // Ribbed cast cover and layered mounting plate (illustrative dimensions).
 for(let x of [-1.03,-.57,-.12,.36,.78])for(let side of [-1,1])box(x,side*.45,-.62,.055,.18,.08,palette.steel);
 box(.88,-.82,-.28,.28,.17,.63,palette.gray);
 // Alternating satin cast-metal panels and corrosion-resistant fastener heads.
 for(let x of [-.90,-.44,.02,.48,.94])box(x,-.19,-.755,.26,.22,.028,palette.steel);
 for(let x of [-1.05,1.06])for(let y of [-.34,.34])cyl(x,y,.60,.055,.12,palette.dark,'z');
 for(let x of [-.85,.40])cyl(x,1.38,.34,.19,.04,palette.cream,'y');
}else if(kind==='solenoid'){
 cyl(0,0,0,.59,2.0,palette.gray,'x',32);
 cyl(-1.13,0,0,.43,.30,palette.steel,'x');
 cyl(1.13,0,0,.43,.30,palette.steel,'x');
 box(0,-.64,0,1.28,.23,.55,palette.dark);
 for(let x of [-.6,.55]){cyl(x,.78,0,.12,.50,palette.copper,'y');cyl(x,1.05,0,.20,.09,palette.steel,'y')}
 cyl(.1,.65,-.37,.075,.25,palette.copper,'y');
 // External metal seams, insulated small signal terminal and connector collar.
 for(let x of [-.88,.86])torus(x,0,0,.58,.048,palette.steel,'y');
 cyl(.12,.71,-.36,.12,.22,palette.black,'y');
 box(.12,.90,-.36,.22,.16,.20,palette.blue);
 for(let x of [-.47,.47]){box(x,-.70,.25,.33,.16,.30,palette.steel);cyl(x,-.83,.25,.085,.17,palette.dark,'y')}
 // Insulating washers and paired locknuts remain visual only.
 for(let x of [-.6,.55]){
   cyl(x,.94,0,.22,.075,palette.black);
   cyl(x,1.09,0,.17,.055,palette.steel);
 }
}
}
function save(file){const pad=x=>x.length%4?Buffer.concat([x,Buffer.alloc(4-x.length%4)]):x;
const p=Buffer.from(new Float32Array(pos).buffer),c=Buffer.from(new Float32Array(color).buffer);
const it=pos.length/3<65536?new Uint16Array(indices):new Uint32Array(indices),idx=Buffer.from(it.buffer);
const bin=Buffer.concat([pad(p),pad(c),pad(idx)]);
const mins=[0,1,2].map(a=>Math.min(...pos.filter((_,i)=>i%3===a))),maxs=[0,1,2].map(a=>Math.max(...pos.filter((_,i)=>i%3===a)));
const gltf={asset:{version:'2.0',generator:'AutoLearnPro presentation-only detailed review asset'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,COLOR_0:1},indices:2,mode:4}]}],buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:p.length,target:34962},{buffer:0,byteOffset:pad(p).length,byteLength:c.length,target:34962},{buffer:0,byteOffset:pad(p).length+pad(c).length,byteLength:idx.length,target:34963}],accessors:[{bufferView:0,componentType:5126,count:pos.length/3,type:'VEC3',min:mins,max:maxs},{bufferView:1,componentType:5126,count:color.length/4,type:'VEC4'},{bufferView:2,componentType:it.BYTES_PER_ELEMENT===2?5123:5125,count:indices.length,type:'SCALAR'}]};
let json=Buffer.from(JSON.stringify(gltf));if(json.length%4)json=Buffer.concat([json,Buffer.alloc(4-json.length%4,32)]);
const h=Buffer.alloc(12);h.write('glTF');h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+bin.length,8);
const jh=Buffer.alloc(8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);
const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.concat([h,jh,json,bh,bin]));console.log(file,indices.length/3,'triangles')}
for(const [kind,file] of [['meter','dashboard/student/circuit-lab/assets/3d/multimeter-detailed-review.glb'],['starter','dashboard/student/starting-system-lab/assets/3d/starter-motor-detailed-review.glb'],['solenoid','dashboard/student/starting-system-lab/assets/3d/starter-solenoid-detailed-review.glb']]){pos=[];color=[];indices=[];build(kind);if(kind==='meter'){for(let i=2;i<pos.length;i+=3)pos[i]=-pos[i]}save(path.join(root,file))}
