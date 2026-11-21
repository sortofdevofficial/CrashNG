/* CrashNG — world: renderer, quality tier, lights, terrain, ramp/landing strip, walker
   Owns: Q (quality tier), scene/camera/renderer, sun + sky, runway constants RX/RW/RZ/RL/LZ0/SL,
   gh(x,z) terrain height, the walkable character (root) and its contact shadow.
   Every other file builds on these names. Load this file first (see index.html). */
window.addEventListener('contextmenu',e=>e.preventDefault());
// auto quality tier: phones / low-core machines start lean, desktops get the full pass
const Q=(()=>{
  const coarse=(navigator.maxTouchPoints||0)>0&&matchMedia('(pointer:coarse)').matches;
  let ov=null;try{ov=localStorage.getItem('cng-q')}catch(e){}   // Graphics button: 'low' | 'high' | null = auto
  const low=ov==='low'?true:ov==='high'?false:coarse;   // desktops default to HIGH graphics (the resolution scaler still protects weak GPUs)
  return {low,mode:ov||'auto',touch:coarse||(navigator.maxTouchPoints||0)>0,pr:Math.min(devicePixelRatio||1,low?1.1:2),shadow:!low,shadowSize:low?1024:4096,
    clouds:low?14:40,smoke:low?14:48,skids:low?120:500,seg:low?14:48,bump:!low,aa:!low};
})();
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9cc9f2);
scene.fog=new THREE.Fog(0xcfe4f7,500,5200);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.25,7000);
const renderer=new THREE.WebGLRenderer({antialias:Q.aa,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Q.pr);
renderer.shadowMap.enabled=Q.shadow;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
document.body.appendChild(renderer.domElement);

const hemi=new THREE.HemisphereLight(0xdfeeff,0x8fa0b8,.55);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff2dc,1.35);
sun.position.set(50,80,40);sun.castShadow=Q.shadow;
sun.shadow.mapSize.set(Q.shadowSize,Q.shadowSize);
sun.shadow.bias=-.0008;sun.shadow.normalBias=.02;
Object.assign(sun.shadow.camera,{near:10,far:260,left:-28,right:28,top:28,bottom:-28});
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);
scene.add(sun.target);   // target must be in the scene graph or its matrixWorld stays at the origin
scene.add(new THREE.DirectionalLight(0x9fc6ff,.22).translateX(-40).translateY(30).translateZ(-30));

// --- Sky: gradient dome with sun glow, billboard clouds, studio reflection environment ---
let skyDome;
{
  skyDome=new THREE.Mesh(new THREE.SphereGeometry(1000,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{sunDir:{value:new THREE.Vector3(50,80,40).normalize()},cHor:{value:new THREE.Color(.9,.95,1.)},cTop:{value:new THREE.Color(.09,.4,.88)}},
    vertexShader:'varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 v;uniform vec3 sunDir;uniform vec3 cHor;uniform vec3 cTop;void main(){float h=clamp(v.y*1.4+.1,0.,1.);vec3 c=mix(cHor,cTop,pow(h,.62));float sd=max(dot(normalize(v),sunDir),0.);c+=vec3(1.,.86,.66)*pow(sd,420.)*1.8;c+=vec3(1.,.72,.45)*pow(sd,9.)*.16;gl_FragColor=vec4(c,1.);}'}));
  scene.add(skyDome);
  const cc=document.createElement('canvas');cc.width=256;cc.height=128;const cx=cc.getContext('2d');
  for(let i=0;i<22;i++){const px=42+Math.random()*172,py=42+Math.random()*46,r=18+Math.random()*34;
    const g=cx.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,255,255,.92)');
    g.addColorStop(.6,'rgba(255,255,255,.4)');g.addColorStop(1,'rgba(255,255,255,0)');
    cx.fillStyle=g;cx.beginPath();cx.arc(px,py,r,0,7);cx.fill()}
  const cloudTex=new THREE.CanvasTexture(cc);
  const cloudM=new THREE.SpriteMaterial({map:cloudTex,transparent:true,opacity:.82,depthWrite:false});
  for(let i=0;i<Q.clouds;i++){
    const s=new THREE.Sprite(cloudM);const w=260+Math.random()*320;
    s.scale.set(w,w*.42,1);s.position.set((Math.random()-.5)*6000,40+Math.random()*900,(Math.random()-.5)*6000-2600);
    s.userData.cloud=true;scene.add(s);
  }
  const es=new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(60,32,16),new THREE.MeshBasicMaterial({color:0x86b4e2,side:THREE.BackSide})));
  const panel=(w,h,x,y,z,rx,ry,k,c)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(k),side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.set(rx,ry,0);es.add(m)};
  panel(40,14,0,35,0,Math.PI/2,0,7,0xffffff);panel(14,30,-45,10,0,0,Math.PI/2,4,0xffd9a0);panel(14,30,45,10,0,0,Math.PI/2,3,0x9fc4ff);panel(40,8,0,8,-50,0,0,3,0xffffff);
  const pmrem=new THREE.PMREMGenerator(renderer);window.ENV=pmrem.fromScene(es,.03).texture;
}

// procedural asphalt + soft contact shadow (no external assets, cheap on mobile)
function asphaltTexture(){
  const s=256,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d');
  const img=x.createImageData(s,s),d=img.data;
  for(let i=0;i<d.length;i+=4){const v=72+Math.random()*36;d[i]=v;d[i+1]=v+1;d[i+2]=v+3;d[i+3]=255}
  x.putImageData(img,0,0);
  for(let k=0;k<70;k++){x.fillStyle='rgba(24,26,30,'+(Math.random()*.18).toFixed(2)+')';x.beginPath();x.arc(Math.random()*s,Math.random()*s,2+Math.random()*18,0,7);x.fill()}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,36);
  t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;
}
const asphalt=asphaltTexture();
const contact=new THREE.Group();contact.rotation.order='YXZ';scene.add(contact);
{
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,4,64,64,62);g.addColorStop(0,'rgba(0,0,0,.85)');
  g.addColorStop(.55,'rgba(0,0,0,.42)');g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(3.1,6.4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,opacity:.45,depthWrite:false}));
  sh.rotation.x=-Math.PI/2;contact.add(sh);
}

// --- Character ---
const yellow=new THREE.MeshStandardMaterial({color:0xffd21f,roughness:.45});
const dark=new THREE.MeshStandardMaterial({color:0x111118,roughness:.25});
const root=new THREE.Group();root.scale.setScalar(.85);scene.add(root);
const body=new THREE.Group();root.add(body);
const hips=new THREE.Group();hips.position.y=.5;body.add(hips);
function mesh(g,m,p){const o=new THREE.Mesh(g,m);o.castShadow=true;if(p)o.position.set(...p);return o}

const torsoP=new THREE.Group();hips.add(torsoP);
torsoP.add(mesh(new THREE.CapsuleGeometry(.4,.3,10,20),yellow,[0,.3,0]));

const headP=new THREE.Group();headP.position.y=.8;torsoP.add(headP);
const head=mesh(new THREE.SphereGeometry(.58,32,24),yellow,[0,.5,0]);head.scale.set(1.04,.97,1);headP.add(head);
[-.2,.2].forEach(x=>{const e=mesh(new THREE.SphereGeometry(.075,14,12),dark,[x,.42,.535]);e.scale.set(.9,1.3,.5);headP.add(e)});

function arm(s){
  const sh=new THREE.Group();sh.position.set(s*.42,.72,0);torsoP.add(sh);
  sh.add(mesh(new THREE.SphereGeometry(.16,16,14),yellow));
  sh.add(mesh(new THREE.CylinderGeometry(.16,.09,.6,16),yellow,[0,-.3,0]));
  sh.add(mesh(new THREE.SphereGeometry(.09,12,10),yellow,[0,-.6,0]));
  return sh;
}
function leg(s){
  const h=new THREE.Group();h.position.set(s*.17,.05,0);hips.add(h);
  h.add(mesh(new THREE.SphereGeometry(.16,14,12),yellow));
  h.add(mesh(new THREE.CylinderGeometry(.15,.15,.4,16),yellow,[0,-.2,0]));
  h.add(mesh(new THREE.SphereGeometry(.15,14,12),yellow,[0,-.4,0]));
  return h;
}
const armL=arm(-1),armR=arm(1),legL=leg(-1),legR=leg(1);

// --- Ramp, landing strip & height map ---
// RL: ramp run, RH: deck height, SL: landing run. All strip/rail furniture below is derived from these.
const RX=10,RW=26,RL=3600,RH=1100,RE=6,RZ=-40,SL=1500;
const LZ0=RZ-RL-10;                 // landing strip starts here (10 m drop gap after the ramp lip)
let TER=null;                       // terrain heightmap (built below); gh() samples it everywhere off the road
const T_X0=RX-900,T_X1=RX+900,T_Z0=300,T_Z1=LZ0-SL-300,T_NX=60,T_NZ=Math.ceil((T_Z0-T_Z1)/32);
const TXs=(T_X1-T_X0)/T_NX,TZs=(T_Z0-T_Z1)/T_NZ;
function terrainH(x,z){
  if(!TER||x<=T_X0||x>=T_X1||z>=T_Z0||z<=T_Z1)return -1e4;
  const u=(x-T_X0)/TXs,w=(T_Z0-z)/TZs,i=Math.floor(u),j=Math.floor(w),fx=u-i,fz=w-j,N=T_NX+1,H=TER,a=j*N+i;
  return fx+fz<=1?H[a]+(H[a+1]-H[a])*fx+(H[a+N]-H[a])*fz:H[a+N+1]+(H[a+N]-H[a+N+1])*(1-fx)+(H[a+1]-H[a+N+1])*(1-fz);
}
function gh(x,z){const dx=Math.abs(x-RX);
  if(dx<RW/2){if(z<=RZ&&z>=RZ-RL)return RH-(RH-RE)*(RZ-z)/RL;if(z>RZ&&z<=40)return RH}
  if(dx<20&&z<=LZ0&&z>=LZ0-SL)return 0;
  return terrainH(x,z)}
const rs=new THREE.Shape();rs.moveTo(0,0);rs.lineTo(RL,0);rs.lineTo(RL,RE);rs.lineTo(0,RH);rs.closePath();
const roadMat=new THREE.MeshStandardMaterial({color:0x6a7078,roughness:.86,metalness:.06,map:asphalt});
if(Q.bump){roadMat.bumpMap=asphalt;roadMat.bumpScale=.012}
const ramp=new THREE.Mesh(new THREE.ExtrudeGeometry(rs,{depth:RW,bevelEnabled:false}),roadMat);
ramp.rotation.y=Math.PI/2;ramp.position.set(RX-RW/2,0,RZ);ramp.castShadow=ramp.receiveShadow=true;scene.add(ramp);
const slabM=roadMat;
const glow=new THREE.LineBasicMaterial({color:0x1b2433});
function slab(w,l,cx,cz,top){const g=new THREE.BoxGeometry(w,2,l);const m=new THREE.Mesh(g,slabM);m.position.set(cx,top-1,cz);m.receiveShadow=true;scene.add(m);const e=new THREE.LineSegments(new THREE.EdgesGeometry(g),glow);e.position.copy(m.position);scene.add(e)}
slab(RW,80,RX,0,RH);slab(40,SL,RX,LZ0-SL/2,0);
{const e=new THREE.LineSegments(new THREE.EdgesGeometry(ramp.geometry),glow);e.rotation.copy(ramp.rotation);e.position.copy(ramp.position);scene.add(e)}
const stripeM=new THREE.MeshStandardMaterial({color:0xffd21f});
{const stripes=new THREE.InstancedMesh(new THREE.BoxGeometry(.4,.06,2.4),stripeM,Math.ceil(RL/5));
  const d=new THREE.Object3D();
  for(let i=0;i<Math.ceil(RL/5);i++){const z=RZ-3-i*5;d.position.set(RX,gh(RX,z)+.04,z);d.rotation.set(-Math.atan((RH-RE)/RL),0,0);d.updateMatrix();stripes.setMatrixAt(i,d.matrix)}
  scene.add(stripes)}
{const nL=Math.max(1,Math.floor(SL/20)-1);
  const lines=new THREE.InstancedMesh(new THREE.PlaneGeometry(RW+8,.6),new THREE.MeshBasicMaterial({color:0xffffff}),nL);
  const d=new THREE.Object3D();d.rotation.x=-Math.PI/2;
  for(let i=0;i<nL;i++){d.position.set(RX,.03,LZ0-20-i*20);d.updateMatrix();lines.setMatrixAt(i,d.matrix)}
  scene.add(lines)}
// guardrails + edge lines on the landing strip
{
  const steel=new THREE.MeshStandardMaterial({color:0xb8c1ca,roughness:.34,metalness:.85,envMap:ENV});
  const lineM=new THREE.MeshBasicMaterial({color:0xe9edf1});
  [-1,1].forEach(s=>{
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.16,.3,SL-2),steel);
    rail.position.set(RX+s*19.3,.9,LZ0-SL/2);rail.castShadow=Q.shadow;rail.receiveShadow=true;scene.add(rail);
    const line=new THREE.Mesh(new THREE.PlaneGeometry(.28,SL+2),lineM);
    line.rotation.x=-Math.PI/2;line.position.set(RX+s*18.5,.028,LZ0-SL/2);scene.add(line);
  });
  const nP=Math.max(2,Math.floor((SL-16)/21)+1);
  const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.17,1.8,.17),steel,nP*2);
  const d=new THREE.Object3D();let pi=0;
  [-1,1].forEach(s=>{for(let i=0;i<nP;i++){d.position.set(RX+s*19.3,.9,LZ0-8-i*21);d.updateMatrix();posts.setMatrixAt(pi++,d.matrix)}});
  scene.add(posts);
}
// short concrete barriers along the deck and ramp edges
{
  const wallM=new THREE.MeshStandardMaterial({color:0x8d949c,roughness:.78,metalness:.15});
  const capM=new THREE.MeshStandardMaterial({color:0x24282e,roughness:.55,metalness:.35});
  const slope=Math.atan((RH-RE)/RL);
  const addWall=(x,y,z,len,rx)=>{
    const w=new THREE.Mesh(new THREE.BoxGeometry(.14,.5,len),wallM);
    w.position.set(x,y,z);w.rotation.x=rx;w.castShadow=Q.shadow;w.receiveShadow=true;scene.add(w);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(.2,.06,len),capM);
    cap.position.set(x,y+.28,z);cap.rotation.x=rx;scene.add(cap);
  };
  [-1,1].forEach(s=>{
    const x=RX+s*(RW/2+.09);
    addWall(x,RH+.25,0,80,0);
    addWall(x,(RH+RE)/2+.25,RZ-RL/2,Math.hypot(RL,RH-RE),-slope);
  });
}

// --- scenery: neon gates arching over the ramp + glowing boost pads (PADS is read by updatePads() in damage.js) ---
const PADS=[],SUNOFF=new THREE.Vector3(50,80,40);   // SUNOFF: where the sun sits relative to the player (time of day moves it)
{
  const slope=Math.atan((RH-RE)/RL);
  const gateM=new THREE.MeshStandardMaterial({color:0x14171c,roughness:.45,metalness:.7});
  const nG=Math.floor((RL-100)/90),d=new THREE.Object3D(),col=new THREE.Color();
  const pil=new THREE.InstancedMesh(new THREE.BoxGeometry(.55,10,.55),gateM,nG*2);
  const beam=new THREE.InstancedMesh(new THREE.BoxGeometry(RW+3.4,.6,.6),gateM,nG);
  const neon=new THREE.InstancedMesh(new THREE.BoxGeometry(RW+2.6,.2,.2),new THREE.MeshBasicMaterial({color:0xffffff}),nG*2);
  for(let i=0;i<nG;i++){
    const z=RZ-70-i*90,y=gh(RX,z);
    [-1,1].forEach((sd,k)=>{d.position.set(RX+sd*(RW/2+1.3),y+5,z);d.updateMatrix();pil.setMatrixAt(i*2+k,d.matrix)});
    d.position.set(RX,y+10,z);d.updateMatrix();beam.setMatrixAt(i,d.matrix);
    [9.5,10.5].forEach((o,k)=>{d.position.set(RX,y+o,z+.35);d.updateMatrix();neon.setMatrixAt(i*2+k,d.matrix);col.setHSL((i*.11+k*.5)%1,1,.55);neon.setColorAt(i*2+k,col)});
  }
  [pil,beam,neon].forEach(m=>{m.frustumCulled=false;m.castShadow=false;scene.add(m)});
  // boost pads: yellow chevrons every 150 m, alternating lanes
  const tex=(()=>{const c=document.createElement('canvas');c.width=128;c.height=256;const x=c.getContext('2d');
    x.fillStyle='rgba(10,14,20,.78)';x.fillRect(0,0,128,256);
    for(let i=0;i<4;i++){x.strokeStyle=i%2?'#ffd21f':'#19e6ff';x.lineWidth=16;x.beginPath();x.moveTo(18,225-i*58);x.lineTo(64,170-i*58);x.lineTo(110,225-i*58);x.stroke()}
    return new THREE.CanvasTexture(c)})();
  const nP=Math.floor((RL-200)/150);
  const pads=new THREE.InstancedMesh(new THREE.PlaneGeometry(4.4,15),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),nP);
  for(let i=0;i<nP;i++){
    const z0=RZ-120-i*150,zc=z0-7.5,x=RX+(i%2?3.8:-3.8);
    d.position.set(x,gh(x,zc)+.07,zc);d.rotation.set(-Math.PI/2-slope,0,0);d.updateMatrix();pads.setMatrixAt(i,d.matrix);
    PADS.push({x,z0,z1:z0-15});
  }
  pads.frustumCulled=false;scene.add(pads);
}

// --- terrain: rolling hills + biome colours around the whole track. gh() samples this same grid, so wheels sit exactly on the mesh ---
{
  const cl=(v,a,b)=>v<a?a:v>b?b:v;
  const road=z=>z>LZ0?RW/2:20;
  const tb=z=>{const d=RZ-z;return d<0?RH:d<=RL?RH-(RH-RE)*d/RL:0};
  const raw=(x,z)=>{
    const off=Math.max(0,Math.abs(x-RX)-road(z));
    const n=Math.sin(x*.0113+z*.0071)*.5+Math.sin(x*.0271-z*.0193+1.3)*.3+Math.sin(x*.0613+z*.0437+.7)*.2;
    return tb(z)-4-Math.min(off,60)*.35+n*Math.min(1,off/160)*55;   // embankment drops away from the road, then hills
  };
  const NX1=T_NX+1,NZ1=T_NZ+1,H=new Float32Array(NX1*NZ1),pos=new Float32Array(NX1*NZ1*3),col=new Float32Array(NX1*NZ1*3);
  const BIO=[0x4c9a45,0xe6f1fa,0xd8aa5e,0x4a2c26,0x4b5262].map(h=>new THREE.Color(h)),flat=new THREE.Color(0x5a8c4a),c=new THREE.Color();
  for(let j=0;j<NZ1;j++)for(let i=0;i<NX1;i++){
    const x=T_X0+i*TXs,z=T_Z0-j*TZs,h=raw(x,z),k=j*NX1+i,d=RZ-z;
    H[k]=h;pos[k*3]=x;pos[k*3+1]=h;pos[k*3+2]=z;
    if(d<0||d>RL)c.copy(d<0?BIO[0]:flat);
    else{const b=Math.min(4,Math.floor(d/720));c.copy(BIO[Math.max(0,b-1)]).lerp(BIO[b],cl((d-b*720)/80,0,1))}
    const sh=.82+.3*(Math.sin(x*.05)*Math.sin(z*.043)*.5+.5);
    col[k*3]=c.r*sh;col[k*3+1]=c.g*sh;col[k*3+2]=c.b*sh;
  }
  const idx=new Uint32Array(T_NX*T_NZ*6);let q=0;
  for(let j=0;j<T_NZ;j++)for(let i=0;i<T_NX;i++){const a=j*NX1+i,b=a+1,c2=a+NX1,d2=c2+1;idx[q++]=a;idx[q++]=b;idx[q++]=c2;idx[q++]=b;idx[q++]=d2;idx[q++]=c2}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(new THREE.BufferAttribute(idx,1));g.computeVertexNormals();
  const tm=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0}));
  tm.receiveShadow=true;tm.frustumCulled=false;scene.add(tm);
  TER=H;
  // scenery per area: trees, ice spikes, cacti + boulders, lava rocks, neon towers (instanced = a few draw calls)
  let sd=7;const rnd=()=>((sd=(sd*1103515245+12345)&0x7fffffff)/0x7fffffff),dm=new THREE.Object3D(),cc=new THREE.Color();
  const scatter=(area,n,minO,maxO,sc,parts)=>{
    n=Q.low?n>>1:n;
    const ms=parts.map(p=>{const m=new THREE.InstancedMesh(p.geo,p.mat,n);m.frustumCulled=false;m.castShadow=false;scene.add(m);return m});
    for(let i=0;i<n;i++){
      const z=RZ-(area*720+rnd()*720),x=RX+(rnd()<.5?-1:1)*(RW/2+minO+rnd()*(maxO-minO)),s=sc[0]+rnd()*(sc[1]-sc[0]),yaw=rnd()*6.28;
      parts.forEach((p,k)=>{dm.position.set(x,gh(x,z)+(p.y||0)*s,z);dm.rotation.set(0,yaw,0);dm.scale.set(s,s*(p.sy||1),s);dm.updateMatrix();ms[k].setMatrixAt(i,dm.matrix);
        if(p.cols)ms[k].setColorAt(i,cc.set(p.cols[Math.floor(rnd()*p.cols.length)]))});
    }
  };
  const M=(c,r)=>new THREE.MeshStandardMaterial({color:0xffffff,roughness:r||.9}),neonM=new THREE.MeshBasicMaterial({color:0xffffff});
  scatter(0,130,18,220,[1.2,2.4],[{geo:new THREE.CylinderGeometry(.35,.5,3,6),mat:M(),y:1.5,cols:[0x6b4a2a]},{geo:new THREE.ConeGeometry(2.2,7,7),mat:M(),y:6,cols:[0x2f7a3a,0x3b8f45,0x2a6a33]}]);
  scatter(1,110,18,240,[1.4,3],[{geo:new THREE.ConeGeometry(1.5,9,5),mat:M(0,.15),y:4.5,cols:[0xcfeaff,0xa8dcff,0xe8f6ff]}]);
  scatter(2,70,18,240,[1.2,2.2],[{geo:new THREE.CylinderGeometry(.55,.7,6,8),mat:M(),y:3,cols:[0x4f8f4a,0x5aa050]}]);
  scatter(2,55,20,260,[1.5,4],[{geo:new THREE.IcosahedronGeometry(2,0),mat:M(),y:.8,sy:.7,cols:[0xb88a4e,0xc59a5c,0xa57a40]}]);
  scatter(3,110,18,240,[1.5,4.5],[{geo:new THREE.DodecahedronGeometry(2,0),mat:M(),y:1,sy:1.3,cols:[0x2a1814,0x3d211a,0x55261a]}]);
  scatter(3,28,25,200,[1,2.2],[{geo:new THREE.CylinderGeometry(.9,1.4,10,8),mat:neonM,y:5,cols:[0xff5a14,0xff8a1e]}]);
  scatter(4,60,18,200,[1,2.6],[{geo:new THREE.BoxGeometry(7,38,7),mat:M(0,.5),y:19,cols:[0x1a1f2a,0x232a38,0x2c3142]},{geo:new THREE.BoxGeometry(7.2,1.2,7.2),mat:neonM,y:30,cols:[0x19e6ff,0xff2bd6,0xffd21f]}]);
}

// --- ramp sections: 5 big areas. Surface physics live in obstacles.js: updateSurface() ---
const AREA_NAMES=['WET MEADOW','FROZEN LAKE','DESERT','LAVA CANYON','NEON CITY'];
const ZONES=[['grass',0,720],['ice',720,1440],['sand',1440,2160],['lava',2160,2880],['oil',2880,3240],['conveyor',3240,3600]].map(([t,a,b])=>({t,a,b}));
function zoneAt(z){const d=RZ-z;if(d<0||d>RL)return null;for(const q of ZONES)if(d<q.b)return q;return null}
function surfAt(x,z){   // what the tyres are on at (x,z): null = ordinary asphalt
  const q=zoneAt(z);if(!q||Math.abs(x-RX)>RW/2)return null;
  const d=RZ-z;
  if(q.t==='grass'||q.t==='ice'||q.t==='oil')return {t:q.t};
  if(q.t==='sand'){const k=Math.floor((d-q.a)/150),w=(d-q.a)-k*150;return (w<16&&(k%2?x>RX:x<RX))?{t:'bounce'}:{t:'sand'}}
  if(q.t==='lava'){const k=Math.floor((d-q.a)/30);return (k%2?x>RX-5:x<RX+5)?{t:'lava'}:null}
  if(q.t==='conveyor'){const k=Math.floor((d-q.a)/30);return {t:'conveyor',s:k%2?-8:8}}
  return null;
}
const ZANIM=[];
{
  const slope=Math.atan((RH-RE)/RL);
  const mk=draw=>{const c=document.createElement('canvas');c.width=c.height=128;draw(c.getContext('2d'));const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t};
  const speck=(x,n,cols)=>{for(let i=0;i<n;i++){x.fillStyle=cols[i%cols.length];x.fillRect(Math.random()*128,Math.random()*128,2,2)}};
  const grassT=mk(x=>{x.fillStyle='#2f8a3c';x.fillRect(0,0,128,128);speck(x,1400,['#3fa84a','#256f31','#58bd5e','#1f5d2a']);
    for(let i=0;i<8;i++){x.fillStyle='rgba(30,60,40,.35)';x.beginPath();x.ellipse(Math.random()*128,Math.random()*128,10+Math.random()*14,5+Math.random()*7,Math.random()*3,0,7);x.fill()}});
  const iceT=mk(x=>{x.fillStyle='#bfe7ff';x.fillRect(0,0,128,128);x.strokeStyle='rgba(255,255,255,.75)';x.lineWidth=1.5;
    for(let i=0;i<14;i++){x.beginPath();x.moveTo(Math.random()*128,Math.random()*128);x.lineTo(Math.random()*128,Math.random()*128);x.stroke()}speck(x,160,['#ffffff','#9fd4f5'])});
  const lavaT=mk(x=>{x.fillStyle='#ff5a00';x.fillRect(0,0,128,128);
    for(let i=0;i<30;i++){const px=Math.random()*128,py=Math.random()*128,r=6+Math.random()*16,g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'#ffe36a');g.addColorStop(1,'rgba(255,90,0,0)');x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,7);x.fill()}
    for(let i=0;i<16;i++){x.fillStyle='rgba(40,10,0,.85)';x.beginPath();x.arc(Math.random()*128,Math.random()*128,3+Math.random()*7,0,7);x.fill()}});
  const sandT=mk(x=>{x.fillStyle='#d9b46a';x.fillRect(0,0,128,128);speck(x,900,['#b8924a','#ecc982','#c9a255'])});
  const oilT=mk(x=>{x.fillStyle='#15101c';x.fillRect(0,0,128,128);
    for(let i=0;i<10;i++){x.strokeStyle=['rgba(120,60,200,.5)','rgba(40,200,190,.4)'][i%2];x.lineWidth=3+Math.random()*5;x.beginPath();x.arc(Math.random()*128,Math.random()*128,10+Math.random()*30,0,Math.random()*6);x.stroke()}});
  const arrow=(x,flip)=>{x.fillStyle='#262a31';x.fillRect(0,0,128,128);x.strokeStyle='#ffd21f';x.lineWidth=12;
    for(let i=0;i<2;i++){const o=i*64;x.beginPath();x.moveTo(flip?100-o:28+o,24);x.lineTo(flip?60-o:68+o,64);x.lineTo(flip?100-o:28+o,104);x.stroke()}};
  const convP=mk(x=>arrow(x,false)),convN=mk(x=>arrow(x,true));
  const bounceT=mk(x=>{x.fillStyle='#10b84c';x.fillRect(0,0,128,128);x.strokeStyle='rgba(255,255,255,.9)';x.lineWidth=8;
    for(let i=0;i<2;i++){x.beginPath();x.moveTo(24,50+i*50);x.lineTo(64,16+i*50);x.lineTo(104,50+i*50);x.stroke()}});
  const poly={polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2};
  const grassM=new THREE.MeshStandardMaterial(Object.assign({map:grassT,roughness:.18,metalness:.05,envMap:ENV,envMapIntensity:.7},poly));   // wet = glossy
  const iceM=new THREE.MeshStandardMaterial(Object.assign({map:iceT,roughness:.05,metalness:.3,envMap:ENV,envMapIntensity:.9},poly));
  const lavaM=new THREE.MeshBasicMaterial(Object.assign({map:lavaT},poly));
  const sandM=new THREE.MeshStandardMaterial(Object.assign({map:sandT,roughness:1},poly));
  const oilM=new THREE.MeshStandardMaterial(Object.assign({map:oilT,roughness:.08,metalness:.5,envMap:ENV,envMapIntensity:.8},poly));
  const convPM=new THREE.MeshStandardMaterial(Object.assign({map:convP,roughness:.7},poly)),convNM=new THREE.MeshStandardMaterial(Object.assign({map:convN,roughness:.7},poly));
  const bounceM=new THREE.MeshStandardMaterial(Object.assign({map:bounceT,roughness:.5,emissive:0x0a5a24,emissiveIntensity:.6},poly));
  const ov=(mat,x0,x1,d0,d1)=>{   // lane x0..x1, distance d0..d1 down the ramp; texture tiles every 8 m
    const w=x1-x0,l=d1-d0,xc=(x0+x1)/2,zc=RZ-(d0+d1)/2,g=new THREE.PlaneGeometry(w,l),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/8,uv.getY(i)*l/8);
    const m=new THREE.Mesh(g,mat);m.rotation.set(-Math.PI/2-slope,0,0);m.position.set(xc,gh(xc,zc)+.06,zc);m.receiveShadow=true;scene.add(m);return m;
  };
  const H=RW/2;
  for(const q of ZONES){
    const cells=len=>Math.ceil((q.b-q.a)/len);
    if(q.t==='grass')ov(grassM,RX-H,RX+H,q.a,q.b);
    else if(q.t==='ice')ov(iceM,RX-H,RX+H,q.a,q.b);
    else if(q.t==='oil')ov(oilM,RX-H,RX+H,q.a,q.b);
    else if(q.t==='sand'){ov(sandM,RX-H,RX+H,q.a,q.b);for(let k=0;k<cells(150);k++){const d0=q.a+k*150;k%2?ov(bounceM,RX,RX+H,d0,d0+16):ov(bounceM,RX-H,RX,d0,d0+16)}}
    else if(q.t==='lava')for(let k=0;k<cells(30);k++){const d0=q.a+k*30,d1=Math.min(q.b,d0+30);k%2?ov(lavaM,RX-5,RX+H,d0,d1):ov(lavaM,RX-H,RX+5,d0,d1)}
    else if(q.t==='conveyor')for(let k=0;k<cells(30);k++){const d0=q.a+k*30,d1=Math.min(q.b,d0+30);ov(k%2?convNM:convPM,RX-H,RX+H,d0,d1)}
  }
  ZANIM.push(dt=>{lavaT.offset.y-=dt*.12;lavaT.offset.x+=dt*.03;convP.offset.x+=dt*.55;convN.offset.x-=dt*.55;bounceM.emissiveIntensity=.5+Math.sin(performance.now()/180)*.25});
}
function animateZones(dt){for(const f of ZANIM)f(dt)}
