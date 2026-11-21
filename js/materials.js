/* CrashNG — shared materials + geometry helpers every vehicle builds from
   Owns: cTex(), carbonTex, paint/glass/chrome/rubber/caliperM/tailM/discM/whiteM/blk/belt/etc.,
   the carG root group, the PARTS/detachParts registry + detachable(), cm(), splinePts(), loftGeo().
   Add shared materials here; car-specific colours stay in that car's own file. */
// --- Lamborghini Revuelto-style: lofted shell, detailed wheels, PBR materials ---
function cTex(w,h,draw,rep){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep[0],rep[1])}
  return t;
}
const carbonTex=cTex(128,128,(g,w,h)=>{
  g.fillStyle='#0b0c10';g.fillRect(0,0,w,h);const s=16;
  for(let y=0;y<h;y+=s)for(let x=0;x<w;x+=s){
    const o=((x/s)+(y/s))&1,gr=g.createLinearGradient(x,y,x+s,y+s);
    if(o){gr.addColorStop(0,'#2b2d34');gr.addColorStop(.48,'#16181d');gr.addColorStop(1,'#26282e')}
    else{gr.addColorStop(0,'#181a1f');gr.addColorStop(.48,'#2c2e36');gr.addColorStop(1,'#121317')}
    g.fillStyle=gr;g.fillRect(x+1,y+1,s-2,s-2);
  }
},[5,5]);carbonTex.encoding=THREE.sRGBEncoding;
const meshTex=cTex(64,64,(g,w,h)=>{
  g.fillStyle='#040506';g.fillRect(0,0,w,h);g.strokeStyle='#2a2e35';g.lineWidth=2;
  for(let i=-w;i<w*2;i+=12){g.beginPath();g.moveTo(i,0);g.lineTo(i+h,h);g.stroke();g.beginPath();g.moveTo(i,h);g.lineTo(i+h,0);g.stroke()}
},[5,2]);meshTex.encoding=THREE.sRGBEncoding;
const sideTex=cTex(512,512,(g,w,h)=>{
  g.fillStyle='#0a0a0c';g.fillRect(0,0,w,h);
  g.strokeStyle='#141416';g.lineWidth=3;
  for(let r=140;r<250;r+=26){g.beginPath();g.arc(256,256,r,0,Math.PI*2);g.stroke()}
  g.translate(256,256);g.textAlign='center';g.fillStyle='#2a2b2f';g.font='bold 20px Arial';
  for(let i=0;i<3;i++){g.save();g.rotate(i*Math.PI*2/3);g.fillText('CRASH NG',0,-196);g.restore()}
  g.fillStyle='#26272b';g.font='bold 13px Arial';g.fillText('305 / 30 ZR20',0,6);
});sideTex.encoding=THREE.sRGBEncoding;
const paintRough=cTex(128,128,(g,w,h)=>{
  g.fillStyle='#d8d8d8';g.fillRect(0,0,w,h);
  for(let i=0;i<2600;i++){const v=190+Math.random()*65|0;g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(Math.random()*w,Math.random()*h,1.5,1.5)}
},[6,6]);
const plateTex=cTex(256,64,(g,w,h)=>{
  g.fillStyle='#e9e9e2';g.fillRect(0,0,w,h);g.strokeStyle='#9a9a92';g.lineWidth=3;g.strokeRect(2,2,w-4,h-4);
  g.fillStyle='#111';g.font='bold 34px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('CRASH NG',w/2,h/2+2);
});plateTex.encoding=THREE.sRGBEncoding;
const discTex=cTex(256,256,(g,w,h)=>{
  g.fillStyle='#a7adb4';g.fillRect(0,0,w,h);
  g.strokeStyle='#7c828a';g.lineWidth=5;g.beginPath();g.arc(128,128,108,0,Math.PI*2);g.stroke();
  g.fillStyle='#3c4046';
  for(let r=0;r<3;r++)for(let i=0;i<18;i++){const a=i*Math.PI*2/18+r*.1,rr=66+r*27;g.beginPath();g.arc(128+Math.cos(a)*rr,128+Math.sin(a)*rr,3.4,0,Math.PI*2);g.fill()}
});discTex.encoding=THREE.sRGBEncoding;

const paint=new THREE.MeshPhysicalMaterial({color:0xef7a00,metalness:.22,roughness:.34,roughnessMap:paintRough,clearcoat:1,clearcoatRoughness:.03});
paint.color.convertSRGBToLinear();   // r149 legacy color mode: hex is linear unless converted
const blk=new THREE.MeshStandardMaterial({color:0x0a0a0c,roughness:.5,metalness:.25});
const trimM=new THREE.MeshStandardMaterial({color:0x0b0c0e,roughness:.6,metalness:.2});
const carbonM=new THREE.MeshPhysicalMaterial({map:carbonTex,bumpMap:carbonTex,bumpScale:.0025,color:0x8a8d94,roughness:.48,metalness:.2,clearcoat:.45,clearcoatRoughness:.18});
const glassM=new THREE.MeshPhysicalMaterial({color:0x080d12,roughness:.06,metalness:.12,clearcoat:.5,clearcoatRoughness:.03});
const tireM=new THREE.MeshStandardMaterial({color:0x141416,roughness:.92,metalness:0});
const tireSideM=new THREE.MeshStandardMaterial({map:sideTex,roughness:.93,metalness:0});
const grooveM=new THREE.MeshStandardMaterial({color:0x08080a,roughness:1});
const rimM=new THREE.MeshPhysicalMaterial({color:0x7c838c,roughness:.3,metalness:1,clearcoat:.35,clearcoatRoughness:.15});
const darkRim=new THREE.MeshStandardMaterial({color:0x101114,roughness:.55,metalness:.5});
const caliperM=new THREE.MeshStandardMaterial({color:0xe23a00,roughness:.4,metalness:.3});
const discM=new THREE.MeshStandardMaterial({color:0x9aa0a8,roughness:.32,metalness:.95,emissive:0xff2a00,emissiveIntensity:0});
const discFaceM=new THREE.MeshStandardMaterial({map:discTex,roughness:.34,metalness:.92});
const drl=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:2.4});
const tailM=new THREE.MeshStandardMaterial({color:0xff0a18,emissive:0xff0010,emissiveIntensity:1.2});
const grilleM=new THREE.MeshStandardMaterial({map:meshTex,roughness:.55,metalness:.5});
const whiteM=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:.9});
const goldM=new THREE.MeshStandardMaterial({color:0xd8a900,roughness:.25,metalness:1});
const plateM=new THREE.MeshStandardMaterial({map:plateTex,roughness:.6,metalness:.1});
const titanM=new THREE.MeshStandardMaterial({color:0x4a4e55,roughness:.28,metalness:1});
[paint,blk,trimM,carbonM,glassM,rimM,discM,caliperM,grilleM,whiteM,goldM,plateM,titanM].forEach(m=>{
  m.envMap=ENV;m.envMapIntensity=m===paint?.55:m===glassM?.42:m===rimM?.5:m===carbonM?.5:m===titanM?.4:.45;
});
const carG=new THREE.Group();scene.add(carG);
// parts that the crash model can rip off: keep their home transform for repairs
const detachParts=[];
const detachable=(mesh,name,thresh,zone)=>{
  mesh.userData.home={p:mesh.position.clone(),q:mesh.quaternion.clone(),s:mesh.scale.clone()};
  detachParts.push({mesh,name,thresh,zone:zone||null,gone:false,home:mesh.userData.home});return mesh;
};
function cm(g,m,p,r){const o=new THREE.Mesh(g,m);o.castShadow=true;if(p)o.position.set(...p);if(r)o.rotation.set(...r);return o}
function splinePts(cp,n){return new THREE.SplineCurve(cp.map(p=>new THREE.Vector2(p[0],p[1]))).getPoints(n-1)}
// loft: consecutive cross-sections, optional per-quad material groups and end caps
function loftGeo(rings,opt){
  opt=opt||{};
  const N=rings[0].pts.length,pos=[],uv=[],idx=[],multi=!!opt.grp,idxs=multi?[[],[],[]]:null;
  const lim=opt.closed===false?N-1:N;
  rings.forEach(r=>r.pts.forEach((p,i)=>{pos.push(p.x,p.y,r.z);uv.push((r.z+3)/6,i/Math.max(1,N-1))}));
  for(let k=0;k<rings.length-1;k++){
    const A=rings[k],B=rings[k+1],a=k*N,b=(k+1)*N;
    for(let i=0;i<lim;i++){
      const j=(i+1)%N,m=multi?opt.grp(k,i,(A.z+B.z)*.5):0;
      const t=multi?idxs[m]||idxs[0]:idx;
      t.push(a+i,a+j,b+i, a+j,b+j,b+i);
    }
  }
  const cap=(ri,front,mai)=>{
    const r=rings[ri],base=ri*N;let cx=0,cy=0;
    r.pts.forEach(p=>{cx+=p.x;cy+=p.y});cx/=N;cy/=N;
    const ci=pos.length/3;pos.push(cx,cy,r.z);uv.push(.5,.5);
    const t=multi?idxs[mai]||idxs[0]:idx;
    for(let i=0;i<N;i++){const j=(i+1)%N;if(front)t.push(ci,base+i,base+j);else t.push(ci,base+j,base+i)}
  };
  const last=rings.length-1;
  if(opt.capStart)cap(0,rings[0].z>rings[last].z,opt.capMat||0);
  if(opt.capEnd)cap(last,rings[last].z>rings[0].z,opt.capMat||0);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  if(multi){let off=0;const all=[];idxs.forEach((arr,mi)=>{if(!arr.length)return;for(let i=0;i<arr.length;i++)all.push(arr[i]);g.addGroup(off,arr.length,mi);off+=arr.length});g.setIndex(all)}
  else g.setIndex(idx);
  g.computeVertexNormals();return g;
}
