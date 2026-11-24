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
  return {low,mode:ov||'auto',touch:coarse||(navigator.maxTouchPoints||0)>0,pr:Math.min(devicePixelRatio||1,low?1.1:1.75),shadow:!low,shadowSize:low?1024:2048,
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
renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
document.body.appendChild(renderer.domElement);
if(!Q.low)renderer.domElement.style.filter='contrast(1.05) saturate(1.12)';   // cheap colour grade on high quality

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
  // distant mountain ring: follows the camera like the sky, fogged into haze
  window.MOUNT=new THREE.MeshBasicMaterial({color:0x5f7a9a});
  window.mountains=new THREE.InstancedMesh(new THREE.ConeGeometry(330,1,6),MOUNT,64);
  {const d=new THREE.Object3D();for(let i=0;i<64;i++){const a=i/64*6.283+Math.random()*.08,r=2700+Math.random()*500,h=260+Math.random()*520;
    d.position.set(Math.cos(a)*r,h/2,Math.sin(a)*r);d.scale.set(.8+Math.random()*1.3,h,.8+Math.random()*1.3);d.rotation.y=Math.random()*3;d.updateMatrix();mountains.setMatrixAt(i,d.matrix)}}
  mountains.frustumCulled=false;scene.add(mountains);
  const gc=document.createElement('canvas');gc.width=gc.height=128;const gx=gc.getContext('2d'),gg=gx.createRadialGradient(64,64,0,64,64,64);
  gg.addColorStop(0,'rgba(255,250,230,1)');gg.addColorStop(.25,'rgba(255,230,170,.45)');gg.addColorStop(1,'rgba(255,200,120,0)');gx.fillStyle=gg;gx.fillRect(0,0,128,128);
  window.sunFlare=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(gc),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,opacity:0}));
  sunFlare.scale.set(1100,1100,1);scene.add(sunFlare);
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
const RX=10,RW=26,RL=700,RH=175,RE=0,RZ=-40,SL=150,AL=250;   // ramp: hills (AL) + ice (AL) + a small city (RL-2*AL), then a short flat run-out of SL metres
const LZ0=RZ-RL;                    // the run-out starts exactly where the ramp ends: no gap, no jump
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
const rs=new THREE.Shape();rs.moveTo(0,0);rs.lineTo(RL,0);if(RE>0)rs.lineTo(RL,RE);rs.lineTo(0,RH);rs.closePath();
const roadMat=new THREE.MeshStandardMaterial({color:0x6a7078,roughness:.86,metalness:.06,map:asphalt});
if(Q.bump){roadMat.bumpMap=asphalt;roadMat.bumpScale=.012}
roadMat.envMap=ENV;roadMat.envMapIntensity=.3;   // slight sheen so the asphalt picks up the sky
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
  stripes.count=Math.ceil(2*AL/5);for(let i=0;i<stripes.count;i++){const z=RZ-3-i*5;d.position.set(RX,gh(RX,z)+.04,z);d.rotation.set(-Math.atan((RH-RE)/RL),0,0);d.updateMatrix();stripes.setMatrixAt(i,d.matrix)}
  scene.add(stripes)}
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

const PADS=[],SUNOFF=new THREE.Vector3(50,80,40);   // SUNOFF: where the sun sits relative to the player (time of day moves it)

// --- terrain: rolling hills + biome colours around the whole track. gh() samples this same grid, so wheels sit exactly on the mesh ---
{
  const cl=(v,a,b)=>v<a?a:v>b?b:v;
  const road=z=>z>LZ0?RW/2:20;
  const tb=z=>{const d=RZ-z;return d<0?RH:d<=RL?RH-(RH-RE)*d/RL:0};
  const raw=(x,z)=>{
    const off=Math.max(0,Math.abs(x-RX)-road(z));
    const n=Math.sin(x*.0113+z*.0071)*.5+Math.sin(x*.0271-z*.0193+1.3)*.3+Math.sin(x*.0613+z*.0437+.7)*.2;
    const dd=RZ-z,calm=dd>2*AL&&dd<RL+SL?.22:1;   // flatter ground around the city
    return tb(z)-4-Math.min(off,60)*.35+n*Math.min(1,off/160)*55*calm;   // embankment drops away from the road, then hills
  };
  const NX1=T_NX+1,NZ1=T_NZ+1,H=new Float32Array(NX1*NZ1),pos=new Float32Array(NX1*NZ1*3),col=new Float32Array(NX1*NZ1*3);
  const BIO=[0x4c9a45,0xe6f1fa,0x6b7078].map(h=>new THREE.Color(h)),flat=new THREE.Color(0x5a8c4a),c=new THREE.Color();
  for(let j=0;j<NZ1;j++)for(let i=0;i<NX1;i++){
    const x=T_X0+i*TXs,z=T_Z0-j*TZs,h=raw(x,z),k=j*NX1+i,d=RZ-z;
    H[k]=h;pos[k*3]=x;pos[k*3+1]=h;pos[k*3+2]=z;
    if(d>RL&&d<RL+SL+40)c.setHex(0x7d8289);else if(d<0||d>RL)c.copy(d<0?BIO[0]:flat);
    else{const b=Math.min(2,Math.floor(d/AL));c.copy(BIO[Math.max(0,b-1)]).lerp(BIO[b],cl((d-b*AL)/80,0,1))}
    const sh=.82+.3*(Math.sin(x*.05)*Math.sin(z*.043)*.5+.5);
    col[k*3]=c.r*sh;col[k*3+1]=c.g*sh;col[k*3+2]=c.b*sh;
  }
  const idx=new Uint32Array(T_NX*T_NZ*6);let q=0;
  for(let j=0;j<T_NZ;j++)for(let i=0;i<T_NX;i++){const a=j*NX1+i,b=a+1,c2=a+NX1,d2=c2+1;idx[q++]=a;idx[q++]=b;idx[q++]=c2;idx[q++]=b;idx[q++]=d2;idx[q++]=c2}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(new THREE.BufferAttribute(idx,1));g.computeVertexNormals();
  const uv=new Float32Array(NX1*NZ1*2);for(let k=0;k<NX1*NZ1;k++){uv[k*2]=pos[k*3]/22;uv[k*2+1]=pos[k*3+2]/22}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.computeVertexNormals();
  const dc=document.createElement('canvas');dc.width=dc.height=128;const dx=dc.getContext('2d');dx.fillStyle='#c9c9c9';dx.fillRect(0,0,128,128);
  for(let i=0;i<1800;i++){const v=150+Math.random()*100|0;dx.fillStyle='rgb('+v+','+v+','+v+')';dx.fillRect(Math.random()*128,Math.random()*128,2+Math.random()*3,2+Math.random()*3)}
  const dt=new THREE.CanvasTexture(dc);dt.wrapS=dt.wrapT=THREE.RepeatWrapping;dt.anisotropy=8;
  const tm=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,map:dt,roughness:.96,metalness:0}));
  tm.receiveShadow=true;tm.frustumCulled=false;scene.add(tm);
  TER=H;
  // scenery per area: trees, ice spikes, cacti + boulders, lava rocks, neon towers (instanced = a few draw calls)
  let sd=7;const rnd=()=>((sd=(sd*1103515245+12345)&0x7fffffff)/0x7fffffff),dm=new THREE.Object3D(),cc=new THREE.Color();
  const scatter=(area,n,minO,maxO,sc,parts)=>{
    n=Q.low?n>>1:n;
    const ms=parts.map(p=>{const m=new THREE.InstancedMesh(p.geo,p.mat,n);m.frustumCulled=false;m.castShadow=false;scene.add(m);return m});
    for(let i=0;i<n;i++){
      const z=RZ-(area*AL+rnd()*AL),x=RX+(rnd()<.5?-1:1)*(RW/2+minO+rnd()*(maxO-minO)),s=sc[0]+rnd()*(sc[1]-sc[0]),yaw=rnd()*6.28;
      parts.forEach((p,k)=>{dm.position.set(x,gh(x,z)+(p.y||0)*s,z);dm.rotation.set(0,yaw,0);dm.scale.set(s,s*(p.sy||1),s);dm.updateMatrix();ms[k].setMatrixAt(i,dm.matrix);
        if(p.cols)ms[k].setColorAt(i,cc.set(p.cols[Math.floor(rnd()*p.cols.length)]))});
    }
  };
  const M=(c,r)=>new THREE.MeshStandardMaterial({color:0xffffff,roughness:r||.9}),neonM=new THREE.MeshBasicMaterial({color:0xffffff});
  // hills: pines + round trees; ice: snowy pines + ice spikes; city: towers with lit windows
  scatter(0,110,16,240,[1.2,2.6],[{geo:new THREE.CylinderGeometry(.35,.5,3,6),mat:M(),y:1.5,cols:[0x6b4a2a]},{geo:new THREE.ConeGeometry(2.2,7,7),mat:M(),y:6,cols:[0x2f7a3a,0x3b8f45,0x2a6a33]}]);
  scatter(0,50,20,260,[1.5,3.2],[{geo:new THREE.SphereGeometry(2.6,8,6),mat:M(),y:3.2,cols:[0x4a8f3e,0x5aa04a]}]);
  scatter(1,100,16,240,[1.2,2.6],[{geo:new THREE.CylinderGeometry(.35,.5,3,6),mat:M(),y:1.5,cols:[0x5a4a3a]},{geo:new THREE.ConeGeometry(2.2,7,7),mat:M(),y:6,cols:[0xe8f2fb,0xd2e6f5]}]);
  scatter(1,60,18,240,[1.4,3],[{geo:new THREE.ConeGeometry(1.5,9,5),mat:M(0,.15),y:4.5,cols:[0xcfeaff,0xa8dcff,0xe8f6ff]}]);
}

// --- ramp areas: 1 hills (normal road), 2 frozen road (very slippery), 3 city (asphalt + traffic, see obstacles.js) ---
const AREA_NAMES=['HILLS','FROZEN ROAD','CITY'];
const ZONES=[['hills',0,AL],['ice',AL,2*AL],['city',2*AL,RL+SL]].map(([t,a,b])=>({t,a,b}));
function zoneAt(z){const d=RZ-z;if(d<0||d>RL+SL)return null;for(const q of ZONES)if(d<q.b)return q;return null}
function surfAt(x,z){   // what the tyres are on at (x,z): null = ordinary asphalt
  const q=zoneAt(z);if(!q||Math.abs(x-RX)>RW/2)return null;
  return q.t==='ice'?{t:'ice'}:null;
}
const ZANIM=[],ZOV=[];
{
  const slope=Math.atan((RH-RE)/RL),H=RW/2;
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  x.fillStyle='#c4e8ff';x.fillRect(0,0,128,128);x.strokeStyle='rgba(255,255,255,.8)';x.lineWidth=1.5;
  for(let i=0;i<14;i++){x.beginPath();x.moveTo(Math.random()*128,Math.random()*128);x.lineTo(Math.random()*128,Math.random()*128);x.stroke()}
  for(let i=0;i<160;i++){x.fillStyle=i%2?'#ffffff':'#9fd4f5';x.fillRect(Math.random()*128,Math.random()*128,2,2)}
  const it=new THREE.CanvasTexture(c);it.wrapS=it.wrapT=THREE.RepeatWrapping;it.anisotropy=8;
  const iceM=new THREE.MeshStandardMaterial({map:it,roughness:.04,metalness:.3,envMap:ENV,envMapIntensity:.9,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const ov=(mat,x0,x1,d0,d1)=>{
    const w=x1-x0,l=d1-d0,xc=(x0+x1)/2,zc=RZ-(d0+d1)/2,g=new THREE.PlaneGeometry(w,l),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/8,uv.getY(i)*l/8);
    const m=new THREE.Mesh(g,mat);m.rotation.set(-Math.PI/2-slope,0,0);m.position.set(xc,gh(xc,zc)+.06,zc);m.receiveShadow=true;scene.add(m);ZOV.push({m,zc,half:l/2});return m;
  };
  ov(iceM,RX-H,RX+H,AL,2*AL);
  // dashed lane lines on the whole road except the ice, plus solid edge lines
  const dash=new THREE.InstancedMesh(new THREE.PlaneGeometry(.2,3),new THREE.MeshBasicMaterial({color:0xf2f2f2,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),Math.ceil(RL/8)*3);
  const dm=new THREE.Object3D();let n=0;
  for(let d=10;d<RL-4;d+=8){if(d>AL)continue;const z=RZ-d;[-6.5,0,6.5].forEach(o=>{dm.position.set(RX+o,gh(RX+o,z)+.08,z);dm.rotation.set(-Math.PI/2-slope,0,0);dm.updateMatrix();dash.setMatrixAt(n++,dm.matrix)})}
  dash.count=n;dash.frustumCulled=false;scene.add(dash);
}
{   // speed-limit signs every 150 m on both sides
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  x.fillStyle='#fff';x.beginPath();x.arc(32,32,30,0,7);x.fill();x.strokeStyle='#d01a1a';x.lineWidth=7;x.beginPath();x.arc(32,32,26,0,7);x.stroke();
  x.fillStyle='#111';x.font='bold 24px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('60',32,34);
  const tex=new THREE.CanvasTexture(c),n=Math.floor(RL/150)*2,d=new THREE.Object3D();
  const poles=new THREE.InstancedMesh(new THREE.CylinderGeometry(.05,.05,3,6),new THREE.MeshStandardMaterial({color:0x777f88,metalness:.6,roughness:.5}),n);
  const plates=new THREE.InstancedMesh(new THREE.CircleGeometry(.5,20),new THREE.MeshBasicMaterial({map:tex}),n);
  let k=0;for(let dd=100;dd<RL-50&&k<n;dd+=150)[-1,1].forEach(s=>{if(k>=n)return;const px=RX+s*(RW/2+2.2),z=RZ-dd,y=gh(px,z);
    d.rotation.set(0,0,0);d.position.set(px,y+1.5,z);d.updateMatrix();poles.setMatrixAt(k,d.matrix);
    d.rotation.set(0,Math.PI,0);d.position.set(px,y+3.2,z+.06);d.updateMatrix();plates.setMatrixAt(k,d.matrix);k++});
  poles.count=plates.count=k;[poles,plates].forEach(m=>{m.frustumCulled=false;scene.add(m)});
}
function animateZones(dt){}
function cullZones(){const cz=camera.position.z;for(const o of ZOV)o.m.visible=Math.abs(o.zc-cz)<1400+o.half}


// ======== CITY: the flat street after the ramp ========
// A one-way 4-lane avenue (traffic flows toward -z like the player), side streets with crosswalks + traffic lights,
// sidewalks, trees, street lamps, shop fronts, brick / concrete / glass towers with lit windows, and a dead end.
const CITY={st:16,ics:[],t:0,sig:[],mats:[]};
const cityG=new THREE.Group();scene.add(cityG);   // the city is built flat in here, then the group is tilted onto the ramp
function sigPhase(i){const T=(CITY.t+i*7.3)%26;return T<14?0:T<16.5?1:2}   // 0 green, 1 yellow, 2 red
{
  const H=RW/2,SW=6,ST=CITY.st,BLK=100,z0=0,slopeC=Math.atan((RH-RE)/RL),cs=Math.cos(slopeC),Lc=(RL-2*AL)/cs,z1=-Lc,zw0=RZ-2*AL;
  cityG.position.set(0,gh(RX,zw0),zw0);cityG.rotation.x=-slopeC;
  let sd=23;const rnd=()=>((sd=(sd*1103515245+12345)&0x7fffffff)/0x7fffffff);
  const D=new THREE.Object3D(),col=new THREE.Color();
  const inst=(geo,mat,list)=>{
    const m=new THREE.InstancedMesh(geo,mat,Math.max(1,list.length)),useC=list.length&&list[0].col!==undefined;
    list.forEach((o,i)=>{D.position.set(o.x,o.y,o.z);D.rotation.set(o.rx||0,o.ry||0,0);D.scale.set(o.sx||1,o.sy||1,o.sz||1);D.updateMatrix();m.setMatrixAt(i,D.matrix);if(useC)m.setColorAt(i,col.set(o.col))});
    m.count=list.length;m.frustumCulled=false;cityG.add(m);return m;
  };
  const BOX=new THREE.BoxGeometry(1,1,1),PLN=new THREE.PlaneGeometry(1,1);
  const bGeo=(wx,h,dz,tw,th,top)=>{   // box whose texture repeats every tw x th metres; top/bottom use a plain texel
    const g=new THREE.BoxGeometry(wx,h,dz),uv=g.attributes.uv;
    for(let f=0;f<6;f++)for(let i=0;i<4;i++){const k=f*4+i,u=uv.getX(k),v=uv.getY(k);
      if(f<2)uv.setXY(k,u*dz/tw,v*h/th);else if(f<4){if(top)uv.setXY(k,u*top[0],v*top[1]);else uv.setXY(k,.01,.01)}else uv.setXY(k,u*wx/tw,v*h/th)}
    uv.needsUpdate=true;return g;
  };
  const tex=c=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.encoding=THREE.sRGBEncoding;return t};
  const ics=CITY.ics;for(let z=z0-55;z>z1+40;z-=BLK)ics.push(z);
  const blocks=[];let top=z0-2;ics.forEach(zc=>{blocks.push([top,zc+ST/2]);top=zc-ST/2});blocks.push([top,z1+2]);

  // --- facade textures: 12 m wide x 14.4 m tall = 4 floors, with their own lit-window emissive map ---
  const facade=kind=>{
    const W=256,c=document.createElement('canvas');c.width=c.height=W;const x=c.getContext('2d');
    const e=document.createElement('canvas');e.width=e.height=W;const y=e.getContext('2d');y.fillStyle='#000';y.fillRect(0,0,W,W);
    x.fillStyle={brick:'#8d5b49',conc:'#bdb9b0',glass:'#34556e'}[kind];x.fillRect(0,0,W,W);
    if(kind==='brick'){
      x.strokeStyle='rgba(40,20,15,.35)';x.lineWidth=1;
      for(let j=0;j<W;j+=6){x.beginPath();x.moveTo(0,j);x.lineTo(W,j);x.stroke();for(let i=(j/6%2)*8;i<W;i+=16){x.beginPath();x.moveTo(i,j);x.lineTo(i,j+6);x.stroke()}}
      for(let n=0;n<400;n++){x.fillStyle=Math.random()<.5?'rgba(255,220,200,.07)':'rgba(30,10,5,.08)';x.fillRect(Math.random()*W,Math.random()*W,16,6)}
    }
    if(kind==='conc'){for(let n=0;n<900;n++){x.fillStyle='rgba('+(Math.random()<.5?'255,255,255':'60,60,60')+',.05)';x.fillRect(Math.random()*W,Math.random()*W,3,3)}}
    const lit=(a,b,w,h)=>{if(Math.random()<.42){y.fillStyle=['#ffd98a','#ffe7b0','#ffcf7a','#d8e8ff'][Math.random()*4|0];y.fillRect(a,b,w,h)}};
    for(let f=0;f<4;f++){
      const y0=f*64;
      if(kind==='brick'){
        for(let k=0;k<3;k++){const a=k*85+21,b=y0+16;
          x.fillStyle='#d9d3c8';x.fillRect(a-3,b-3,49,38);x.fillRect(a-5,b+34,53,4);   // frame + sill
          const gr=x.createLinearGradient(a,b,a,b+32);gr.addColorStop(0,'#5b7186');gr.addColorStop(1,'#1f2a35');x.fillStyle=gr;x.fillRect(a,b,43,32);
          x.fillStyle='#d9d3c8';x.fillRect(a+20,b,3,32);lit(a,b,43,32)}
      }else if(kind==='conc'){
        x.fillStyle='#2a3948';x.fillRect(0,y0+14,W,32);
        const gr=x.createLinearGradient(0,y0+14,0,y0+46);gr.addColorStop(0,'rgba(140,170,200,.45)');gr.addColorStop(1,'rgba(0,0,0,.25)');x.fillStyle=gr;x.fillRect(0,y0+14,W,32);
        for(let k=0;k<4;k++){x.fillStyle='#a9a59c';x.fillRect(k*64-3,y0+10,6,40);lit(k*64+4,y0+14,56,32)}
        x.fillStyle='#8f8b83';x.fillRect(0,y0+48,W,3);
      }else{
        const gr=x.createLinearGradient(0,y0,0,y0+48);gr.addColorStop(0,'#6f93ad');gr.addColorStop(1,'#2c465c');x.fillStyle=gr;x.fillRect(0,y0,W,48);
        x.fillStyle='#1f3040';x.fillRect(0,y0+48,W,16);   // spandrel band
        x.fillStyle='rgba(15,25,35,.7)';for(let k=0;k<=12;k++)x.fillRect(k*21.3-1,y0,2,48);
        for(let k=0;k<6;k++)lit(k*42.7+2,y0+2,38,44);
      }
    }
    return [tex(c),tex(e)];
  };
  const bm=(kind,rough,met)=>{const [d,e]=facade(kind);
    const m=new THREE.MeshStandardMaterial({map:d,emissiveMap:e,emissive:0xffffff,emissiveIntensity:0,roughness:rough,metalness:met});
    if(kind==='glass'){m.envMap=ENV;m.envMapIntensity=.55}
    CITY.mats.push(m);return m};
  const MAT={brick:bm('brick',.9,0),conc:bm('conc',.85,.02),glass:bm('glass',.14,.55)};
  MAT.brick.envMap=MAT.conc.envMap=ENV;MAT.brick.envMapIntensity=MAT.conc.envMapIntensity=.25;
  window.BLDM={set emissiveIntensity(v){CITY.mats.forEach(m=>m.emissiveIntensity=v)},get emissiveIntensity(){return CITY.mats[0].emissiveIntensity}};   // electrics.js lights the windows through this

  // --- ground: sidewalks (tiled slabs), kerbs, side streets ---
  const swc=document.createElement('canvas');swc.width=swc.height=64;{const g=swc.getContext('2d');g.fillStyle='#a2a5a9';g.fillRect(0,0,64,64);g.strokeStyle='#7e8186';g.lineWidth=2;g.strokeRect(0,0,64,64);for(let n=0;n<120;n++){g.fillStyle='rgba(0,0,0,.05)';g.fillRect(Math.random()*64,Math.random()*64,2,2)}}
  const swM=new THREE.MeshStandardMaterial({map:tex(swc),roughness:.95});
  const kerbs=[];
  blocks.forEach(([a,b])=>{const len=a-b,zc=(a+b)/2;
    [-1,1].forEach(s=>{
      const m=new THREE.Mesh(bGeo(SW,.16,len,3,.16,[SW/3,len/3]),swM);m.position.set(RX+s*(H+SW/2),.08,zc);m.receiveShadow=true;cityG.add(m);
      kerbs.push({x:RX+s*(H+.12),y:.09,z:zc,sx:.24,sy:.18,sz:len});
    });
  });
  inst(BOX,new THREE.MeshStandardMaterial({color:0xc0c3c7,roughness:.9}),kerbs);
  const stM=roadMat.clone();stM.polygonOffset=true;stM.polygonOffsetFactor=-2;stM.polygonOffsetUnits=-2;
  ics.forEach(zc=>{
    const g=new THREE.PlaneGeometry(168,ST),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*168/8,uv.getY(i)*ST/8);
    const m=new THREE.Mesh(g,stM);m.rotation.x=-Math.PI/2;m.position.set(RX,.012,zc);m.receiveShadow=true;cityG.add(m);
  });

  // --- road markings (one flat instanced plane mesh per colour) ---
  const mk=c=>new THREE.MeshBasicMaterial({color:c,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5});
  const wh=[];const P=(x,z,w,l)=>wh.push({x,y:.04,z,rx:-Math.PI/2,sx:w,sy:l});
  blocks.forEach(([a,b])=>{
    P(RX-H+.7,(a+b)/2,.2,a-b);P(RX+H-.7,(a+b)/2,.2,a-b);   // solid edge lines
    for(let z=a-6;z>b+4;z-=9)[-6,0,6].forEach(o=>P(RX+o,z,.18,3.6));   // dashed lane lines between the 4 lanes
  });
  ics.forEach(zc=>{
    [1,-1].forEach(s=>{const zz=zc+s*(ST/2+1.8);for(let xo=-H+.9;xo<H-.5;xo+=1.15)P(RX+xo,zz,.55,3.2)});   // zebra crossings
    P(RX,zc+ST/2+5,H*2-1.4,.45);   // stop line for the oncoming traffic
    for(let x=RX-80;x<RX+80;x+=9){if(Math.abs(x-RX)<22)continue;P(x,zc,3.6,.18)}   // side street centre dashes
  });
  inst(PLN,mk(0xf2f2ee),wh);

  // --- buildings: facades repeat every 12 m x 14.4 m, so widths / heights are multiples of those ---
  const place=[];
  const row=(a,b,s,r)=>{
    let z=a-(r?4+rnd()*6:1.5);
    for(;;){
      const w=rnd()<.55?12:24;if(z-w<b+(r?3:1))break;
      const q=rnd();let t,h;
      if(!r){if(q<.4){t='brick';h=rnd()<.5?28.8:43.2}else if(q<.75){t='conc';h=rnd()<.5?28.8:43.2}else{t='glass';h=rnd()<.5?43.2:57.6}}
      else{if(q<.25){t='conc';h=57.6}else{t='glass';h=[86.4,115.2,144][rnd()*3|0]}}
      const dx=r?30:26,off=H+SW+.6+(r?34:0)+dx/2;
      place.push({t,w,h,dx,x:RX+s*off,z:z-w/2,s,r});
      z-=w+(rnd()<.3?3+rnd()*4:1.2);
    }
  };
  blocks.forEach(([a,b])=>[-1,1].forEach(s=>{row(a,b,s,0);if(!Q.low)row(a,b,s,1)}));
  const groups={};
  place.forEach(o=>{const k=o.t+o.w+'_'+o.h+'_'+o.dx;(groups[k]=groups[k]||{o,list:[]}).list.push(o)});
  const tints=[0xffffff,0xf0ece6,0xe2e6ec,0xfff4e8,0xd8dde4];
  Object.values(groups).forEach(({o,list})=>{
    const m=inst(bGeo(o.dx,o.h,o.w,12,14.4),MAT[o.t],list.map(p=>({x:p.x,y:o.h/2,z:p.z,col:tints[rnd()*tints.length|0]})));
    m.castShadow=false;m.receiveShadow=false;
  });
  // shop fronts + awnings on the first row, rooftop units
  const shop=[],awn=[],roof=[],awC=[0xb02a2a,0x2a5a9a,0x2f7a4a,0xc9a227,0x6a3a8a,0x1f1f23];
  place.filter(p=>!p.r).forEach(p=>{
    const fx=p.x-p.s*(p.dx/2+.04);
    shop.push({x:fx,y:1.9,z:p.z,ry:p.s>0?-Math.PI/2:Math.PI/2,sx:p.w-1.6,sy:3.2});
    awn.push({x:p.x-p.s*(p.dx/2+.6),y:3.75,z:p.z,sx:1.4,sy:.22,sz:p.w-1.8,col:awC[rnd()*awC.length|0]});
    for(let i=0;i<1+(rnd()*2|0);i++)roof.push({x:p.x+(rnd()-.5)*8,y:p.h+.8,z:p.z+(rnd()-.5)*(p.w-5),sx:3,sy:1.6,sz:2.4});
  });
  const shopM=new THREE.MeshStandardMaterial({color:0x141c26,roughness:.15,metalness:.4,emissive:0xffd9a0,emissiveIntensity:0});CITY.mats.push(shopM);
  inst(PLN,shopM,shop);
  inst(BOX,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8}),awn);
  inst(BOX,new THREE.MeshStandardMaterial({color:0x8a8f96,roughness:.7,metalness:.3}),roof);
  // podium: the city is a flat plateau cut into the slope, so nothing floats
  {const pm=new THREE.Mesh(new THREE.BoxGeometry(180,50,Lc+2),new THREE.MeshStandardMaterial({color:0x7d8289,roughness:.95}));pm.position.set(RX,-25.06,-Lc/2);cityG.add(pm)}
  // --- street furniture: lamps, trees, hydrants, bins, traffic lights ---
  const lampP=[],lampA=[],lampH=[],trT=[],trC=[],hyd=[],bin=[],trCol=[0x3f7d3a,0x4a8f3e,0x2f6b34,0x5a9a46];
  blocks.forEach(([a,b])=>{
    [-1,1].forEach(s=>{
      for(let z=a-12-(s>0?16:0);z>b+6;z-=32){
        const px=RX+s*(H+1);
        lampP.push({x:px,y:4.5,z,sy:9});lampA.push({x:px-s*1.3,y:9,z,sx:2.6,sy:.12,sz:.12});lampH.push({x:px-s*2.5,y:8.9,z,sx:1.2,sy:.2,sz:.45});
      }
      for(let z=a-28+(s>0?0:-16);z>b+8;z-=32){
        const tx=RX+s*(H+3.6),sc=.85+rnd()*.5;
        trT.push({x:tx,y:1.7,z,sx:.2,sy:3.4,sz:.2});trC.push({x:tx,y:5,z,sx:2.7*sc,sy:2.9*sc,sz:2.7*sc,col:trCol[rnd()*4|0]});
      }
      for(let z=a-9;z>b+6;z-=55)hyd.push({x:RX+s*(H+.9),y:.45,z:z-(s>0?7:0)});
      for(let z=a-20;z>b+6;z-=47)bin.push({x:RX+s*(H+2),y:.55,z:z-(s>0?11:0)});
    });
  });
  const steel=new THREE.MeshStandardMaterial({color:0x4a5058,roughness:.6,metalness:.6});
  inst(new THREE.CylinderGeometry(.11,.15,1,6),steel,lampP);inst(BOX,steel,lampA);
  inst(BOX,new THREE.MeshBasicMaterial({color:0xffe2a8}),lampH);
  inst(new THREE.CylinderGeometry(1,1,1,6),new THREE.MeshStandardMaterial({color:0x5a4030,roughness:.9}),trT);
  inst(new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9}),trC);
  inst(new THREE.CylinderGeometry(.16,.2,.9,8),new THREE.MeshStandardMaterial({color:0xc42a1c,roughness:.5}),hyd);
  inst(new THREE.CylinderGeometry(.32,.3,1.1,10),new THREE.MeshStandardMaterial({color:0x2f3a34,roughness:.7,metalness:.3}),bin);
  // traffic lights: a pole + arm over the lanes on both kerbs; red / yellow / green are real lamps that cycle (sigPhase) and the traffic obeys them
  const hd=[],pl=[],arm=[],tl=ics.map(()=>({r:[],y:[],g:[]}));
  ics.forEach((zc,i)=>{const zz=zc+ST/2+6;
    [-1,1].forEach(s=>{
      pl.push({x:RX+s*(H+.8),y:3.2,z:zz,sx:.16,sy:6.4,sz:.16});arm.push({x:RX+s*9.5,y:6,z:zz,sx:8.6,sy:.12,sz:.12});
      [[RX+s*(H+.8),6],[RX+s*5.2,5.6]].forEach(([hx,hy])=>{
        hd.push({x:hx,y:hy,z:zz,sx:.5,sy:1.35,sz:.42});
        tl[i].r.push({x:hx,y:hy+.42,z:zz+.23,sx:.3,sy:.3,sz:.3});tl[i].y.push({x:hx,y:hy,z:zz+.23,sx:.3,sy:.3,sz:.3});tl[i].g.push({x:hx,y:hy-.42,z:zz+.23,sx:.3,sy:.3,sz:.3});
      });
    });
  });
  CITY.zw=ics.map(zc=>zw0+zc*cs);   // intersection centres in world z (traffic uses these)
  inst(BOX,steel,pl);inst(BOX,steel,arm);inst(BOX,new THREE.MeshStandardMaterial({color:0x16181c,roughness:.5}),hd);
  const SPH=new THREE.SphereGeometry(1,8,6);
  tl.forEach((t,i)=>{const ms={r:new THREE.MeshBasicMaterial({color:0x300808}),y:new THREE.MeshBasicMaterial({color:0x332a05}),g:new THREE.MeshBasicMaterial({color:0x0a3a14})};
    inst(SPH,ms.r,t.r);inst(SPH,ms.y,t.y);inst(SPH,ms.g,t.g);CITY.sig.push(ms)});
}
function updateSignals(dt){   // call every frame: advances the clock and switches the lamps on / off
  CITY.t+=dt;
  for(let i=0;i<CITY.sig.length;i++){const p=sigPhase(i),m=CITY.sig[i];
    m.r.color.setHex(p===2?0xff2a1c:0x300808);m.y.color.setHex(p===1?0xffc21c:0x332a05);m.g.color.setHex(p===0?0x2dff6a:0x0a3a14)}
}

// --- short flat run-out after the ramp: kerb walls, centre dashes, a row of barriers and a tower at the dead end ---
{
  const wallM=new THREE.MeshStandardMaterial({color:0x8d949c,roughness:.78,metalness:.15});
  [-1,1].forEach(sd=>{const w=new THREE.Mesh(new THREE.BoxGeometry(.2,.6,SL),wallM);w.position.set(RX+sd*(RW/2+.1),.3,LZ0-SL/2);w.castShadow=Q.shadow;w.receiveShadow=true;scene.add(w)});
  const dm=new THREE.MeshBasicMaterial({color:0xf2f2ee,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5});
  const n=Math.floor(SL/9),dash=new THREE.InstancedMesh(new THREE.PlaneGeometry(.18,3.6),dm,n*3),d=new THREE.Object3D();d.rotation.x=-Math.PI/2;let k=0;
  for(let i=0;i<n;i++)[-6,0,6].forEach(o=>{d.position.set(RX+o,.04,LZ0-6-i*9);d.updateMatrix();dash.setMatrixAt(k++,d.matrix)});
  dash.count=k;dash.frustumCulled=false;scene.add(dash);
  const z1=LZ0-SL,tw=new THREE.Mesh(new THREE.BoxGeometry(150,72,30),new THREE.MeshStandardMaterial({color:0x9a9fa6,roughness:.85}));tw.position.set(RX,36,z1-16);scene.add(tw);
  for(let i=0;i<10;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(2.5,1,.8),new THREE.MeshStandardMaterial({color:i%2?0xdedad2:0xe0701c,roughness:.8}));b.position.set(RX-RW/2+1.3+i*2.6,.5,z1+2.2);scene.add(b)}
}
