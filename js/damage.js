/* CrashNG — damage: soft-body crush, torn-off parts, debris, impacts
   Owns: panel cut-up, PARTS, SOFT (deformable meshes), dentAt() crush, crashSag(), detachPart(), spawnShards/Sparks(), impactAt(),
   updateDebris(), repairBody()/repairParts().
   Every impact funnels through impactAt(worldPoint, normal, strength, mass). */
/* CrashNG — damage: crumpling shell, panel/part detachment, debris, sparks, impacts
   Owns: bodyOrig/panel cut-up, PARTS registry, wheel rip-off conditions, dentAt(),
   detachPart(), spawnShards(), spawnSparks(), impactAt(), updateDebris(), repairBody()/repairParts().
   Every impact funnels through impactAt(worldPoint, normal, strength, mass).
   Classic scripts: every top-level name here is global; keep load order in index.html. */

const bodyOrig=bodyM.geometry.attributes.position.array.slice();
const debris=[];const shardList=[];
bodyM.frustumCulled=false;
detachParts.forEach(d=>{d.parentObj=d.mesh.parent});
carG.updateMatrixWorld(true);
detachParts.forEach(d=>{   // parts were modelled in car space: move each pivot to its own centre so it tumbles from where it sits
  const m=d.mesh;if(m.position.lengthSq()>1e-6)return;
  const bb=new THREE.Box3().setFromObject(m);if(bb.isEmpty())return;
  const c=bb.getCenter(new THREE.Vector3());
  if(m.isGroup){m.children.forEach(ch=>ch.position.sub(c));m.position.copy(c)}
  else{m.geometry.translate(-c.x/m.scale.x,-c.y/m.scale.y,-c.z/m.scale.z);m.position.copy(c)}
  d.home.p.copy(m.position);
});
// --- cut the body shell into real panels (doors, hood, nose, engine cover, rear bumper) that tear off and leave a hole ---
const bodyGeo=bodyM.geometry,fullIdx=Uint32Array.from(bodyGeo.index.array);
function bodyNormals(){   // normals from the FULL shell, so panels and body stay shaded alike after dents
  const P=bodyGeo.attributes.position.array,N=bodyGeo.attributes.normal.array;N.fill(0);
  for(let i=0;i<fullIdx.length;i+=3){
    const a=fullIdx[i]*3,b=fullIdx[i+1]*3,c=fullIdx[i+2]*3;
    const ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    for(const k of [a,b,c]){N[k]+=nx;N[k+1]+=ny;N[k+2]+=nz}
  }
  for(let i=0;i<N.length;i+=3){const l=Math.hypot(N[i],N[i+1],N[i+2])||1;N[i]/=l;N[i+1]/=l;N[i+2]/=l}
  bodyGeo.attributes.normal.needsUpdate=true;
}
{
  const flat=(x)=>Math.abs(x)<.9;
  const defs=[
    {name:'front nose',thresh:26,zone:'front',test:(x,y,z)=>z>1.95},
    {name:'hood',thresh:20,zone:'front',test:(x,y,z)=>z>1&&y>.6&&flat(x)},
    {name:'left door',thresh:16,zone:'left',test:(x,y,z)=>x>.74&&z>-.75&&z<.9&&y>.33&&!(y>.7&&flat(x))},
    {name:'right door',thresh:16,zone:'right',test:(x,y,z)=>x<-.74&&z>-.75&&z<.9&&y>.33&&!(y>.7&&flat(x))},
    {name:'left fender',thresh:18,zone:'left',test:(x,y,z)=>x>.74&&z>=.9&&z<=1.95&&y>.33},
    {name:'right fender',thresh:18,zone:'right',test:(x,y,z)=>x<-.74&&z>=.9&&z<=1.95&&y>.33},
    {name:'engine cover',thresh:24,zone:'rear',test:(x,y,z)=>z<=-.75&&z>-1.95&&y>.6&&flat(x)},
    {name:'left quarter',thresh:18,zone:'left',test:(x,y,z)=>x>.74&&z<=-.75&&z>-1.95&&y>.33},
    {name:'right quarter',thresh:18,zone:'right',test:(x,y,z)=>x<-.74&&z<=-.75&&z>-1.95&&y>.33},
    {name:'rear bumper',thresh:30,zone:'rear',test:(x,y,z)=>z<=-1.95}];
  const P=bodyOrig,idx=bodyGeo.index.array,rem=[],bk=defs.map(()=>[]);
  for(let i=0;i<idx.length;i+=3){
    const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
    const x=(P[a]+P[b]+P[c])/3,y=(P[a+1]+P[b+1]+P[c+1])/3,z=(P[a+2]+P[b+2]+P[c+2])/3;
    const k=defs.findIndex(p=>p.test(x,y,z));
    (k<0?rem:bk[k]).push(idx[i],idx[i+1],idx[i+2]);
  }
  bodyGeo.setIndex(rem);
  const mkBay=(w,l,x,y,z)=>{const b=cm(new THREE.BoxGeometry(w,.04,l),blk,[x,y,z]);b.visible=false;carBody.add(b);return b};
  const bays={'hood':mkBay(1.3,.95,0,.5,1.47),'engine cover':mkBay(1.2,1.1,0,.5,-1.35)},G={};
  defs.forEach((p,k)=>{
    const ib=bk[k];if(!ib.length)return;
    let cx=0,cy=0,cz=0;for(const v of ib){cx+=P[v*3];cy+=P[v*3+1];cz+=P[v*3+2]}
    cx/=ib.length;cy/=ib.length;cz/=ib.length;
    const pg=new THREE.BufferGeometry(),names=['position','normal','uv'];
    const share=()=>names.forEach(n=>pg.setAttribute(n,bodyGeo.attributes[n]));
    share();pg.setIndex(ib);
    const m=new THREE.Mesh(pg,paint);m.castShadow=m.receiveShadow=true;m.frustumCulled=false;m.position.set(-cx,-cy,-cz);
    const grp=new THREE.Group();grp.position.set(cx,cy,cz);grp.add(m);carBody.add(grp);
    detachable(grp,p.name,p.thresh,p.zone);G[p.name]=grp;
    const e=detachParts[detachParts.length-1],bay=bays[p.name];
    e.parentObj=carBody;
    e.onDetach=()=>{names.forEach(n=>pg.setAttribute(n,pg.attributes[n].clone()));if(bay)bay.visible=true};   // freeze the panel so later dents don't warp it
    e.onRepair=()=>{share();if(bay)bay.visible=false};
  });
  // loose trim sitting on a panel travels with it (hood louvres, door handles, bumper grille, badge...)
  const own=new Set(detachParts.map(d=>d.mesh)),bayArr=Object.values(bays);
  [...carBody.children].forEach(c=>{
    if(own.has(c)||bayArr.includes(c)||flames.includes(c)||c.position.lengthSq()<1e-6)return;
    const x=c.position.x,y=c.position.y,z=c.position.z;let t=null;
    if(z>1&&z<=1.95&&y>.65&&Math.abs(x)<.9)t='hood';
    else if(z>1.95&&y<.62)t='front nose';
    else if(z<=-.75&&z>-1.95&&y>.65&&Math.abs(x)<.9)t='engine cover';
    else if(z<=-1.95&&y<.9)t='rear bumper';
    else if(x>.74&&z>-.75&&z<.9&&y>.33&&y<.8)t='left door';
    else if(x<-.74&&z>-.75&&z<.9&&y>.33&&y<.8)t='right door';
    else if(x>.74&&z>=.9&&z<=1.95&&y>.33&&y<.8)t='left fender';
    else if(x<-.74&&z>=.9&&z<=1.95&&y>.33&&y<.8)t='right fender';
    else if(x>.74&&z<=-.75&&z>-1.95&&y>.33&&y<.8)t='left quarter';
    else if(x<-.74&&z<=-.75&&z>-1.95&&y>.33&&y<.8)t='right quarter';
    if(t&&G[t])G[t].attach(c);
  });
}
// underfloor mechanicals: a hard hit can rip out the driveshaft; losing the fuel cell starts a fire
{
  const ds=cm(new THREE.CylinderGeometry(.045,.045,2.6,10),titanM,[0,.27,.2],[Math.PI/2,0,0]);carBody.add(ds);detachable(ds,'driveshaft',40,null);
  const fc=cm(new THREE.BoxGeometry(1.0,.2,.6),blk,[0,.30,-.55]);carBody.add(fc);detachable(fc,'fuel cell',38,null);
}
{
  const red=new THREE.MeshStandardMaterial({color:0xc4161c,roughness:.5,metalness:.4});
  const add=(m,name,th,zone,needs)=>{carBody.add(m);detachable(m,name,th,zone);if(needs)detachParts[detachParts.length-1].needs=needs;return m};
  add(cm(new THREE.BoxGeometry(1.5,.12,.10),titanM,[0,.40,2.26]),'front crash beam',34,'front','front nose');
  add(cm(new THREE.BoxGeometry(1.5,.12,.10),titanM,[0,.42,-2.26]),'rear crash beam',34,'rear','rear bumper');
  add(cm(new THREE.CylinderGeometry(.018,.018,.5,6),blk,[.62,1.09,-1.15],[0,0,-.12]),'antenna',9,'rear');
  [-1,1].forEach(sx=>add(cm(new THREE.BoxGeometry(.5,.012,.024),blk,[sx*.3,.9,.98],[.05,0,sx*.12]),sx>0?'left wiper':'right wiper',9,'front'));
  add(cm(new THREE.BoxGeometry(.05,.05,.13),red,[0,.31,2.53]),'front tow hook',20,'front');
  add(cm(new THREE.BoxGeometry(.05,.05,.13),red,[0,.31,-2.53]),'rear tow hook',20,'rear');
  [[-1,1.48,0],[1,1.48,1],[-1,-1.52,2],[1,-1.52,3]].forEach(([sx,z,wi])=>{   // control arm snaps once its corner is wrecked
    add(cm(new THREE.CylinderGeometry(.022,.022,.6,6),titanM,[sx*.55,.34,z],[0,0,Math.PI/2]),(z>0?'front ':'rear ')+(sx>0?'left':'right')+' control arm',0,null);
    detachParts[detachParts.length-1].cond=()=>wheelDmg[wi]>.8;
  });
}
const PARTS={};detachParts.forEach(d=>{PARTS[d.name]=d});
PARTS['gearbox'].zone='rear';PARTS['gearbox'].thresh=44;   // it sits under the rear floor: needs a hard rear hit, not any bump
wheels.forEach((w,wi)=>{   // wheels can shear off after repeated hard hits
  const home={p:w.steer.position.clone(),q:w.steer.quaternion.clone(),s:w.steer.scale.clone()};
  w.steer.userData.home=home;w.steer.userData.isWheel=true;
  const d={mesh:w.steer,name:(w.front?'front ':'rear ')+(w.sx>0?'left':'right')+' wheel',thresh:0,zone:null,gone:false,home,parentObj:carG,cond:()=>wheelDmg[wi]>.6};
  detachParts.push(d);w.dp=d;
});

// --- soft body: every deformable mesh keeps its original car-space vertices (c0) and a running offset (off).
// dentAt() pushes vertices along the impact direction with a plastic, noisy crumple; repairBody() restores them.
const SOFT=[];
function addSoft(mesh,skins,attr,c0,inv,pos0){SOFT.push({mesh,skins,attr,c0,off:new Float32Array(c0.length),inv,pos0})}
addSoft(bodyM,['lambo','chiron'],bodyM.geometry.attributes.position,bodyOrig.slice(),null,bodyOrig.slice());
{
  carG.updateMatrixWorld(true);
  const inv0=new THREE.Matrix4().copy(carG.matrixWorld).invert(),own=new Set(detachParts.map(p=>p.mesh)),v=new THREE.Vector3();
  const seg=s=>Math.min(10,Math.max(1,Math.ceil(s/.3)));
  [[truckBody,'truck'],[f1Body,'ferrari']].forEach(([grp,sk])=>grp.children.forEach(m=>{
    if(!m.isMesh||own.has(m))return;
    const g=m.geometry,t=g.type;
    if(t==='PlaneGeometry'||t==='CircleGeometry'||t==='RingGeometry')return;
    if(t==='BoxGeometry'){
      const q=g.parameters;if(Math.max(q.width,q.height,q.depth)<.8)return;   // big panels get a finer mesh so they can crumple
      m.geometry=new THREE.BoxGeometry(q.width,q.height,q.depth,seg(q.width),seg(q.height),seg(q.depth));g.dispose();
    }
    m.updateWorldMatrix(true,false);
    const M=new THREE.Matrix4().multiplyMatrices(inv0,m.matrixWorld),attr=m.geometry.attributes.position,P=attr.array,c0=new Float32Array(P.length);
    for(let i=0;i<P.length;i+=3){v.set(P[i],P[i+1],P[i+2]).applyMatrix4(M);c0[i]=v.x;c0[i+1]=v.y;c0[i+2]=v.z}
    addSoft(m,[sk],attr,c0,M.clone().invert(),P.slice());
  }));
}
function hash(i){const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)}
function softUpdate(e){
  e.attr.needsUpdate=true;
  if(e.mesh===bodyM)bodyNormals();else e.mesh.geometry.computeVertexNormals();
  e.mesh.geometry.computeBoundingSphere();
}
function crashSag(){   // a crushed corner sits lower: body drops, rolls and pitches toward the damaged wheel
  const w=wheelDmg;
  return {r:-(w[1]+w[3]-w[0]-w[2])*.05,p:(w[0]+w[1]-w[2]-w[3])*.04,d:(w[0]+w[1]+w[2]+w[3])*.03+crash.dmg*.0007};
}
function updateDmgHud(){}
function repairBody(){
  for(const e of SOFT){e.off.fill(0);e.attr.array.set(e.pos0);softUpdate(e)}
}
function repairParts(){
  for(const d of detachParts){
    if(d.mesh.parent)d.mesh.parent.remove(d.mesh);
    (d.parentObj||carBody).add(d.mesh);
    d.mesh.visible=true;
    d.mesh.position.copy(d.home.p);d.mesh.quaternion.copy(d.home.q);d.mesh.scale.copy(d.home.s);
    d.gone=false;d.acc=0;d.loose=0;if(d.onRepair)d.onRepair();
  }
  for(const x of debris)if(x.m.userData.shard&&x.m.parent)x.m.parent.remove(x.m);
  debris.length=0;shardList.length=0;puddles.count=0;pudI=0;
}

// BeamNG-style crush: the shell is pushed in along the hit direction (deepest right behind the contact point, fading with
// distance), crinkled by per-vertex noise; frontal/rear hits also fold the hood/roof skin up and pinch the sides in.
function dentAt(wx,wy,wz,nx,ny,nz,power,radius){
  const L=carLocalP(wx,wy,wz),lx=L.x,ly=L.y,lz=L.z;
  const c=Math.cos(car.h),s=Math.sin(car.h);
  let ax=nx*c-nz*s,ay=ny||0,az=nx*s+nz*c;const al=Math.hypot(ax,ay,az)||1;ax/=al;ay/=al;az/=al;
  const D=power*1.25,R=radius*1.6,R2=R*R,longi=Math.abs(az)>.55,v=new THREE.Vector3();
  for(const e of SOFT){
    if(e.skins.indexOf(skin)<0)continue;
    const C=e.c0,O=e.off,P=e.attr.array;let touched=false;
    for(let i=0;i<C.length;i+=3){
      const px=C[i]+O[i]-lx,py=C[i+1]+O[i+1]-ly,pz=C[i+2]+O[i+2]-lz;
      const along=px*ax+py*ay+pz*az;if(along<-.45)continue;
      const pr2=px*px+py*py+pz*pz-along*along;if(pr2>=R2)continue;
      let w=1-Math.sqrt(pr2)/R;w*=w;
      const amt=D*w*(along<0?1:Math.exp(-along/(R*1.4)));if(amt<.004)continue;
      const k=i/3,h1=hash(k),h2=hash(k+7.3),h3=hash(k+13.9);
      let dx=ax*amt+(h1-.5)*amt*.32,dy=ay*amt+(h2-.5)*amt*.32,dz=az*amt+(h3-.5)*amt*.32;
      if(longi){if(C[i+1]+O[i+1]>ly-.05)dy+=amt*.5*(h2+.2);dx-=Math.sign(C[i]+O[i])*amt*.12}
      let ox=O[i]+dx,oy=O[i+1]+dy,oz=O[i+2]+dz;
      const m=Math.hypot(ox,oy,oz);if(m>1.5){const f=1.5/m;ox*=f;oy*=f;oz*=f}
      O[i]=ox;O[i+1]=oy;O[i+2]=oz;touched=true;
      if(e.inv){v.set(C[i]+ox,C[i+1]+oy,C[i+2]+oz).applyMatrix4(e.inv);P[i]=v.x;P[i+1]=v.y;P[i+2]=v.z}
      else{P[i]=C[i]+ox;P[i+1]=C[i+1]+oy;P[i+2]=C[i+2]+oz}
    }
    if(touched)softUpdate(e);
  }
}
function detachPart(d){
  if(d.gone)return;
  if(d.skin&&d.skin!==skin)return;   // another vehicle's parts stay on that vehicle
  carG.updateMatrixWorld(true);
  scene.attach(d.mesh);
  d.gone=true;crash.parts++;if(d.onDetach)d.onDetach();
  if(/window|windshield/.test(d.name))spawnGlass(d.mesh.position);
  if(d.name==='fuel cell'||d.name==='diesel tank')crash.eng=Math.min(1,crash.eng+.55);   // fuel spills: engine bay catches fire
  const dir=new THREE.Vector3(Math.sin(car.h),0,Math.cos(car.h));
  const v=car.vel.clone().multiplyScalar(.5).addScaledVector(dir,2+Math.random()*5).setY(2.5+Math.random()*3.5);
  const av=new THREE.Vector3((Math.random()-.5)*10,(Math.random()-.5)*10,(Math.random()-.5)*10);
  if(REC.on&&!REC.replay)REC.ev.push({t:REC.time,k:'detach',n:d.name,
    p:d.mesh.position.toArray(),q:d.mesh.quaternion.toArray(),s:d.mesh.scale.toArray(),v:v.toArray(),av:av.toArray()});
  debris.push({m:d.mesh,v,av});
  statEl.textContent='Crash: '+d.name+' torn off'+(d.name==='engine'?' — the car is dead':d.name.includes('wheel')?' — that corner is dead':'');
}
const shardMats=[paint,paint,paint,carbonM,blk,glassM];
function spawnShards(wx,wy,wz,s){
  if(s<5)return;
  if(REC.on&&!REC.replay)REC.ev.push({t:REC.time,k:'shards',a:[wx,wy,wz,s]});
  const n=clamp(Math.round(s/3.2),2,11);
  for(let i=0;i<n;i++){
    const big=s>18&&i<2;   // body-panel chunks on hard hits
    const w=big?.35+Math.random()*.25:.06+Math.random()*.16;
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,big?.03:.02+Math.random()*.05,big?.28+Math.random()*.2:.05+Math.random()*.2),
      big?paint:shardMats[Math.floor(Math.random()*(s>16?6:5))]);
    m.castShadow=true;m.userData.shard=true;
    m.position.set(wx+(Math.random()-.5)*.4,wy+Math.random()*.25,wz+(Math.random()-.5)*.4);
    m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);
    scene.add(m);
    const v=new THREE.Vector3((Math.random()-.5)*9,2+Math.random()*5.5,(Math.random()-.5)*9).addScaledVector(car.vel,.35);
    debris.push({m,v,av:new THREE.Vector3((Math.random()-.5)*16,(Math.random()-.5)*16,(Math.random()-.5)*16),ttl:28});
    shardList.push(m);
    if(shardList.length>70){
      const o=shardList.shift(),k=debris.findIndex(x=>x.m===o);
      if(k>=0)debris.splice(k,1);if(o.parent)o.parent.remove(o);
    }
  }
}
// metal-on-metal contact throws short-lived glowing sparks, like a real crash
const sparkGeo=new THREE.BoxGeometry(.03,.03,.13);
const sparkMat=new THREE.MeshBasicMaterial({color:0xffcf7a,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
function spawnSparks(wx,wy,wz,s){
  if(s<7)return;
  const n=clamp(Math.round(s*1.2),5,30);
  for(let i=0;i<n;i++){
    const m=new THREE.Mesh(sparkGeo,sparkMat);
    m.position.set(wx+(Math.random()-.5)*.35,wy+(Math.random()-.5)*.2,wz+(Math.random()-.5)*.35);
    m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);
    scene.add(m);
    const v=new THREE.Vector3((Math.random()-.5)*13,2.5+Math.random()*8,(Math.random()-.5)*13).addScaledVector(car.vel,.45);
    debris.push({m,v,av:new THREE.Vector3((Math.random()-.5)*24,(Math.random()-.5)*24,(Math.random()-.5)*24),ttl:.4+Math.random()*.5});
  }
}
function impactAt(wx,wy,wz,nx,ny,nz,strength,mass){
  const s=Math.min(40,Math.max(0,strength));
  if(s<3)return;
  const heavy=clamp((mass||220)/280,.03,1.7);
  const tough=clamp(1800/PHYS.mass*1.5,.3,1.6);   // light cars crumple, heavy vehicles shrug the hit off
  crash.dmg=Math.min(100,crash.dmg+s*(.05+.85*heavy)*tough);
  crash.shake=Math.min(.6,crash.shake+s*.018);
  crash.flash=Math.min(.55,crash.flash+s*.014);
  if(REC.on&&!REC.replay){audioThud(s);if(s>10)audioClank(s);}
  if(s>16)crash.slow=Math.max(crash.slow,.42);
  const pw=clamp(s/30,.14,.95),rad=clamp(.9+heavy*.5,.9,1.9);
  dentAt(wx,wy,wz,nx,ny,nz,pw,rad);
  if(REC.on&&!REC.replay)REC.ev.push({t:REC.time,k:'dent',a:[wx,wy,wz,nx,ny,nz,pw,rad],s});
  const L=carLocalP(wx,wy,wz);
  if(L.z>.9)crash.eng=Math.min(1,crash.eng+s*.010*clamp(heavy,0,1.4));
  if(Math.abs(L.x)>(PHYS.zoneX||.45)&&Math.abs(L.z)>.7){
    let bi=0,bd=1e9;
    const wx2=PHYS.track/2,wa=PHYS.axleF||1.48,wb=PHYS.axleR||-1.52;
    [[-wx2,wa],[wx2,wa],[-wx2,wb],[wx2,wb]].forEach((q,i)=>{
      const dd=(q[0]-L.x)*(q[0]-L.x)+(q[1]-L.z)*(q[1]-L.z);if(dd<bd){bd=dd;bi=i}});
    if(bd<Math.max(1.7,PHYS.halfW*1.7))wheelDmg[bi]=Math.min(1,wheelDmg[bi]+s*.02*clamp(heavy,.2,1.5));
  }
  for(const d of detachParts){   // hits add up per part: bolts loosen, then the part tears off
    if(d.gone)continue;
    if(d.skin&&d.skin!==skin)continue;   // parts of the parked/different vehicle stay bolted on
    if(!d.skin&&!d.mesh.userData.isWheel&&(skin==='truck'||skin==='ferrari'))continue;   // Lambo/Chiron-body parts are hidden on those vehicles
    if(d.cond){if(d.cond())detachPart(d);continue}
    if(!zoneHit(d.zone,L))continue;
    if(d.needs&&!PARTS[d.needs].gone)continue;   // engine hides under the cover, radiator behind the nose
    if(!d.zone&&s<d.thresh*.6)continue;
    d.acc=(d.acc||0)+s*.6;
    const need=d.thresh*.38*(1-crash.dmg*.004);
    if(d.acc>=need)detachPart(d);
    else if(d.acc>need*.45)d.loose=Math.min(1,(d.acc-need*.45)/(need*.55));   // bolts half gone: the part hangs and rattles
  }
  puff(wx,wy,wz,Math.min(12,3+Math.round(s/3)),.75,2.8,0xffc06a);
  spawnSparks(wx,wy,wz,s);
  car.vel.multiplyScalar(1-clamp(s*.0035,0,.1));   // crumpling soaks up energy: the car loses speed in the hit
  crash.cool=.32;
  updateDmgHud();
}

// --- knockable obstacles: cones, drums, crates, tyre stacks, concrete blocks ---

function updateDebris(dt){
  for(let i=debris.length-1;i>=0;i--){
    const d=debris[i];
    if(d.ttl!==undefined&&(d.ttl-=dt)<0){
      if(d.m.parent)d.m.parent.remove(d.m);
      const k=shardList.indexOf(d.m);if(k>=0)shardList.splice(k,1);
      debris.splice(i,1);continue;
    }
    d.v.y-=PHYS.g*dt;
    d.m.position.addScaledVector(d.v,dt);
    d.m.rotation.x+=d.av.x*dt;d.m.rotation.y+=d.av.y*dt;d.m.rotation.z+=d.av.z*dt;
    const gy=gh(d.m.position.x,d.m.position.z);
    const floor=(gy<-5000?-2e3:gy)+(d.m.userData.isWheel?.38:d.m.userData.shard?.03:.14);
    if(d.m.position.y<floor){
      d.m.position.y=floor;
      if(d.v.y<-1){d.v.y*=-.28;d.av.multiplyScalar(.7)}
      else{d.v.y=0;d.v.x*=1-(d.m.userData.isWheel?.8:4)*dt;d.v.z*=1-(d.m.userData.isWheel?.8:4)*dt;d.av.multiplyScalar(1-3*dt)}
    }
    if(d.m.position.y<-80)d.m.visible=false;
  }
}

// --- realism extras: hanging parts, glass, leaking fluids, steam ---
const _le=new THREE.Euler(),_lq=new THREE.Quaternion();
function updateLoose(dt){   // parts that are about to fall off sag and rattle (more at speed)
  if(RP.on)return;
  const sp=Math.min(1,Math.abs(car.speed)/40),tt=performance.now()/1000;
  for(const d of detachParts){
    if(!d.loose||d.gone||(d.skin&&d.skin!==skin))continue;
    const m=d.mesh,L=d.loose,ph=d.name.length*1.7,side=d.zone==='left'?1:d.zone==='right'?-1:0;
    const sag=L*.28+Math.sin(tt*(14+ph)+ph)*L*sp*.18;
    _le.set(sag*(side?.4:1),0,side*L*.35+Math.sin(tt*11+ph)*L*sp*.1);
    _lq.setFromEuler(_le);m.quaternion.copy(d.home.q).multiply(_lq);
    m.position.copy(d.home.p);m.position.y-=L*.05;
  }
}
const glassBit=new THREE.BoxGeometry(.09,.012,.07);
function spawnGlass(p){   // a window or windscreen lets go: a spray of small glass pieces
  for(let i=0;i<14;i++){
    const m=new THREE.Mesh(glassBit,glassM);m.userData.shard=true;
    m.position.set(p.x+(Math.random()-.5)*.6,p.y+(Math.random()-.5)*.3,p.z+(Math.random()-.5)*.6);
    m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);m.scale.setScalar(.5+Math.random()*1.4);scene.add(m);
    debris.push({m,v:new THREE.Vector3((Math.random()-.5)*7,1.5+Math.random()*4,(Math.random()-.5)*7).addScaledVector(car.vel,.3),
      av:new THREE.Vector3((Math.random()-.5)*20,(Math.random()-.5)*20,(Math.random()-.5)*20),ttl:7+Math.random()*4});
  }
}
const puddles=new THREE.InstancedMesh(new THREE.CircleGeometry(.5,14),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6,depthWrite:false}),28);
puddles.count=0;puddles.frustumCulled=false;scene.add(puddles);
let pudI=0,leakAcc=0,steamT=0;
const _pd=new THREE.Object3D(),_pc=new THREE.Color();
function addPuddle(x,z,col,size){
  _pd.position.set(x,gh(x,z)+.045,z);_pd.rotation.set(-Math.PI/2,0,Math.random()*3);_pd.scale.set(size,size*(.7+Math.random()*.5),1);_pd.updateMatrix();
  const i=pudI++%28;puddles.setMatrixAt(i,_pd.matrix);puddles.setColorAt(i,_pc.set(col));
  puddles.count=Math.min(28,pudI);puddles.instanceMatrix.needsUpdate=true;puddles.instanceColor.needsUpdate=true;
}
function crashFX(dt){   // radiator gone = steam; lost engine / fuel = oil, coolant or fuel trailing behind the car
  if(!inCar||RP.on)return;
  const rad=PARTS['radiator'].gone,eng=PARTS['engine'].gone,fuel=PARTS['fuel cell'].gone||PARTS['diesel tank'].gone;
  if(!(rad||eng||fuel))return;
  if(rad){steamT-=dt;if(steamT<=0){steamT=.09;puff(car.pos.x+Math.sin(car.h)*((PHYS.zoneF||1.1)+.4),car.pos.y+.8,car.pos.z+Math.cos(car.h)*((PHYS.zoneF||1.1)+.4),1,1.0,1.6,0xe8f0f5)}}
  leakAcc+=(Math.abs(car.speed)+.6)*dt;
  if(leakAcc>1.1){leakAcc=0;addPuddle(car.pos.x-Math.sin(car.h)*.6+(Math.random()-.5)*.8,car.pos.z-Math.cos(car.h)*.6+(Math.random()-.5)*.8,fuel?0x6a4a12:rad?0x2fcf6a:0x14120f,.5+Math.random()*.7)}
}
