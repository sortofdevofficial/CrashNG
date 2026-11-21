/* CrashNG — obstacles: knockable props (cones, drums, crates, hay, pins, signs...), parked-vehicle collisions, boost pads
   Owns: OB array, resetObstacles(), updateObstacles(), collideParked(), updatePads(). Props are placed from RL/SL so a longer ramp gets more of them. */
/* CrashNG — obstacles + parked-vehicle collisions
   Owns: OB array (cones/drums/crates/tyres/blocks), resetObstacles(), updateObstacles(),
   collideParked() — the parked cars/truck are solid OBBs the live car can crash into.
   Large props and parked vehicles transfer real damage back into the car through impactAt().
   Classic scripts: every top-level name here is global; keep load order in index.html. */

const OB=[];
{
  const coneM=new THREE.MeshStandardMaterial({color:0xff6a13,roughness:.62});
  const bandM=new THREE.MeshStandardMaterial({color:0xf4f6f8,roughness:.5});
  const drumM=new THREE.MeshStandardMaterial({color:0x2f6fb5,roughness:.42,metalness:.35});
  const drumM2=new THREE.MeshStandardMaterial({color:0xd94a2a,roughness:.48,metalness:.3});
  const baseM=new THREE.MeshStandardMaterial({color:0x141418,roughness:.8});
  const crateM=new THREE.MeshStandardMaterial({color:0x9a6a34,roughness:.86});
  const slatM=new THREE.MeshStandardMaterial({color:0x65431e,roughness:.9});
  const oTireM=new THREE.MeshStandardMaterial({color:0x17171a,roughness:.95});
  const blockM=new THREE.MeshStandardMaterial({color:0x9aa1a8,roughness:.82});
  const coneGeo=new THREE.ConeGeometry(.23,.62,12,1,true);
  const bandGeo=new THREE.CylinderGeometry(.152,.175,.08,12,1,true);
  const coneBaseGeo=new THREE.BoxGeometry(.46,.05,.46);
  const drumGeo=new THREE.CylinderGeometry(.30,.30,.88,16);
  const drumBandGeo=new THREE.CylinderGeometry(.31,.31,.055,16,1,true);
  const crateGeo=new THREE.BoxGeometry(.78,.78,.78);
  const slatGeo=new THREE.BoxGeometry(.82,.045,.82);
  const tyreGeo=new THREE.TorusGeometry(.29,.115,6,14);
  const blockGeo=new THREE.BoxGeometry(1.5,.85,.7);
  const haM=new THREE.MeshStandardMaterial({color:0xd8b35a,roughness:.95}),haBand=new THREE.MeshStandardMaterial({color:0x6b4a22,roughness:.9});
  const pinM=new THREE.MeshStandardMaterial({color:0xf4f4f2,roughness:.35}),pinR=new THREE.MeshStandardMaterial({color:0xd8202a,roughness:.4});
  const postM=new THREE.MeshStandardMaterial({color:0x8d949c,roughness:.5,metalness:.6}),signM=new THREE.MeshStandardMaterial({color:0xffcf1a,roughness:.5});
  const bigM=new THREE.MeshStandardMaterial({color:0x4a6a8a,roughness:.7,metalness:.2});
  const hayGeo=new THREE.CylinderGeometry(.46,.46,.95,14),hayBandGeo=new THREE.CylinderGeometry(.465,.465,.06,14);
  const pinBodyGeo=new THREE.CylinderGeometry(.12,.2,.5,10),pinHeadGeo=new THREE.SphereGeometry(.11,10,8),pinStripeGeo=new THREE.CylinderGeometry(.17,.17,.05,10);
  const postGeo=new THREE.CylinderGeometry(.04,.04,2.3,6),plateGeo=new THREE.BoxGeometry(.9,.55,.04),bigGeo=new THREE.BoxGeometry(1.5,1.5,1.5);

  function make(type){
    const g=new THREE.Group();
    let r=.4,h=.8,mass=10;
    if(type==='cone'){
      r=.34;h=.7;mass=4;
      const c=new THREE.Mesh(coneGeo,coneM);c.position.y=.02;g.add(c);
      const b=new THREE.Mesh(bandGeo,bandM);b.position.y=.06;g.add(b);
      const p=new THREE.Mesh(coneBaseGeo,baseM);p.position.y=-.32;g.add(p);
    }else if(type==='drum'||type==='drumR'){
      r=.34;h=.88;mass=30;
      const m=new THREE.Mesh(drumGeo,type==='drum'?drumM:drumM2);g.add(m);
      [-.24,.24].forEach(y=>{const b=new THREE.Mesh(drumBandGeo,bandM);b.position.y=y;g.add(b)});
    }else if(type==='crate'){
      r=.55;h=.78;mass=85;
      g.add(new THREE.Mesh(crateGeo,crateM));
      [-.25,0,.25].forEach(y=>{const s=new THREE.Mesh(slatGeo,slatM);s.position.y=y;g.add(s)});
    }else if(type==='tyre'){
      r=.42;h=.72;mass=45;
      [-.24,0,.24].forEach(y=>{const t=new THREE.Mesh(tyreGeo,oTireM);t.rotation.x=Math.PI/2;t.position.y=y;g.add(t)});
    }else if(type==='hay'){
      r=.62;h=.95;mass=140;                      // lying hay bale
      const m=new THREE.Mesh(hayGeo,haM);m.rotation.z=Math.PI/2;g.add(m);
      [-.3,.3].forEach(x=>{const b=new THREE.Mesh(hayBandGeo,haBand);b.rotation.z=Math.PI/2;b.position.x=x;g.add(b)});
    }else if(type==='pin'){
      r=.24;h=.78;mass=5;                        // bowling pin
      g.add(new THREE.Mesh(pinBodyGeo,pinM));const hd=new THREE.Mesh(pinHeadGeo,pinM);hd.position.y=.31;g.add(hd);
      const st=new THREE.Mesh(pinStripeGeo,pinR);st.position.y=.12;g.add(st);
    }else if(type==='sign'){
      r=.3;h=2.3;mass=20;                        // tall road sign: topples and bends
      g.add(new THREE.Mesh(postGeo,postM));const pl=new THREE.Mesh(plateGeo,signM);pl.position.y=.82;g.add(pl);
    }else if(type==='bigcrate'){
      r=1.05;h=1.5;mass=280;
      g.add(new THREE.Mesh(bigGeo,bigM));
    }else{
      r=.82;h=.85;mass=650;
      g.add(new THREE.Mesh(blockGeo,blockM));
    }
    g.traverse(o=>{if(o.isMesh){o.castShadow=Q.shadow;o.receiveShadow=true}});
    return {g,r,h,mass};
  }
  let seed=20261116;
  const rnd=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
  function add(type,x,z,yaw){
    const gy=gh(x,z);if(gy<-5000)return;
    const spec=make(type);
    spec.g.position.set(x,gy+spec.h/2,z);
    spec.g.rotation.y=yaw||0;
    scene.add(spec.g);
    OB.push({g:spec.g,type,r:spec.r,h:spec.h,mass:spec.mass,pos:spec.g.position.clone(),
      vel:new THREE.Vector3(),av:new THREE.Vector3(),rx:0,ry:yaw||0,rz:0,
      home:spec.g.position.clone(),homeRy:yaw||0,sleep:true});
  }
  // deck: a warm-up slalom before the ramp
  add('tyre',RX-6.2,-30,0);add('tyre',RX+6.2,-31,.4);
  add('cone',RX-3.2,-24,0);add('cone',RX+3.4,-27,0);
  // long descending ramp: cones + drums, alternating sides
  for(let i=0;i<Math.floor((RL-120)/42);i++){
    if(Q.low&&i%2)continue;
    const z=RZ-80-i*42,side=i%2?1:-1;
    add('cone',RX+side*3.4,z,0);
    add('cone',RX-side*2.2,z-7,0);
    if(i%4===0)add('drum',RX,z-13,0);                 // forces a weave down the middle
    if(i%6===2)add('crate',RX+(i%2?1.2:-1.2),z-33,rnd()*3);
    if(i%3===1)add('drum',RX-side*4.4,z-14,0);
    if(i%4===2)add('tyre',RX+side*5.4,z-20,0);
    if(i%5===3)add('crate',RX+side*2.8,z-26,rnd()*3);
  }
  // landing strip: barrel wall, crate stacks, concrete, scattered debris
  const zb=LZ0-30;
  for(let i=0;i<9;i++)if(!Q.low||i%2===0)add(i%2?'drum':'drumR',RX-10+i*2.5,zb,0);
  for(let i=0;i<4;i++)add('crate',RX-6.3+i*4.2,zb-26,rnd()*3);
  add('block',RX-5,zb-56,.2);add('block',RX+5.5,zb-62,-.2);
  for(let i=0;i<34;i++){
    if(Q.low&&i%2)continue;
    const z=zb-84-rnd()*(SL-330);
    add(['cone','cone','drum','tyre','crate','hay','sign','pin','bigcrate'][i%9],RX+(rnd()-.5)*29,z,rnd()*3);
  }
  for(let i=0;i<22;i++)if(!Q.low||i%2===0)add('cone',RX+(rnd()-.5)*24,zb-110-rnd()*(SL-420),0);
  // extra: hay-bale chicanes, signposts, crate stacks and bowling pins down the whole ramp
  for(let i=0;i<Math.floor((RL-160)/36);i++){
    if(Q.low&&i%2)continue;
    const z=RZ-110-i*36,side=i%2?1:-1;
    add('hay',RX+side*4.6,z,0);
    if(i%3===0)add('sign',RX-side*6.9,z-9,0);
    if(i%5===1)add('bigcrate',RX-side*2.6,z-17,rnd()*3);
    if(i%7===3)for(let r=0;r<3;r++)for(let c=0;c<=r;c++)add('pin',RX-1.2+c*.6-r*.3,z-24-r*.55,0);
  }
  // landing strip: bowling lane, crate walls, signs
  for(let r=0;r<4;r++)for(let c=0;c<=r;c++)add('pin',RX-.9+c*.62-r*.31,zb-150-r*.6,0);
  for(let k=0;k<6;k++){if(Q.low&&k%2)continue;const zz=zb-190-k*130,xx=RX+(k%2?-7:7);for(let c=0;c<5;c++)add(c%2?'crate':'bigcrate',xx-4+c*2.2,zz,rnd()*.5)}
  for(let k=0;k<12;k++){if(Q.low&&k%2)continue;add('sign',RX+(rnd()-.5)*30,zb-120-rnd()*(SL-250),0)}
}
function resetObstacles(){
  for(const o of OB){
    o.pos.copy(o.home);o.vel.set(0,0,0);o.av.set(0,0,0);
    o.rx=o.rz=0;o.ry=o.homeRy;o.sleep=true;
    o.g.position.copy(o.pos);o.g.rotation.set(0,o.ry,0);
  }
}
function updateObstacles(dt){
  const c=Math.cos(car.h),s=Math.sin(car.h);
  let touched=false;
  const cxo=camera.position.x,czo=camera.position.z;
  for(const o of OB){
    const dxo=o.pos.x-cxo,dzo=o.pos.z-czo;   // props that are asleep and far away: hidden and skipped (fewer draw calls)
    if(o.sleep&&dxo*dxo+dzo*dzo>160000){o.g.visible=false;continue}
    o.g.visible=true;
    const dx=o.pos.x-car.pos.x,dz=o.pos.z-car.pos.z;
    const lx=dx*c-dz*s,lz=dx*s+dz*c,dy=o.pos.y-car.pos.y;
    const bhW=PHYS.halfW||1.02,bhL=PHYS.halfL||2.45;
    if(dy<1.2+o.h*.5&&dy>-o.h*.5-.15&&Math.abs(lx)<bhW+o.r&&Math.abs(lz)<bhL+o.r){
      const cx=clamp(lx,-bhW,bhW),cz=clamp(lz,-bhL,bhL);
      let nx=lx-cx,nz=lz-cz;let d=Math.hypot(nx,nz);
      if(d<1e-4){
        // prop ended up inside the car box (tunnelled between frames): exit through the nearest face
        const px=bhW-Math.abs(lx),pz=bhL-Math.abs(lz);
        if(pz<=px){nx=0;nz=lz>=0?1:-1}else{nx=lx>=0?1:-1;nz=0}
        d=0;
      }else{nx/=d;nz/=d}
      if(d<o.r){
        const wnx=nx*c+nz*s,wnz=-nx*s+nz*c;
        o.pos.x+=wnx*(o.r-d+.01);o.pos.z+=wnz*(o.r-d+.01);
        const rwx=cx*c+cz*s,rwz=-cx*s+cz*c;
        const vcx=car.vel.x+car.yawRate*rwz,vcz=car.vel.z-car.yawRate*rwx;
        const relN=(vcx-o.vel.x)*wnx+(vcz-o.vel.z)*wnz;
        if(relN>.5){
          const j=1.22*relN/(1/PHYS.mass+1/o.mass);
          o.vel.x+=j/o.mass*wnx;o.vel.z+=j/o.mass*wnz;
          car.vel.x-=j/PHYS.mass*wnx;car.vel.z-=j/PHYS.mass*wnz;
          o.vel.y+=Math.min(7,relN*.22*Math.min(1,80/o.mass));
          o.av.set((Math.random()-.5)*relN*1.2,(Math.random()-.5)*relN*1.2,(Math.random()-.5)*relN*1.2);
          o.sleep=false;touched=true;
          if(relN*o.mass/80>4){
            const eff=Math.min(40,relN*Math.pow(o.mass/300,.55)*1.6);   // light props barely mark the car
            impactAt(car.pos.x+rwx,clamp(o.pos.y,car.pos.y+.25,car.pos.y+1.15),car.pos.z+rwz,-wnx,0,-wnz,eff,o.mass);
          }
        }
      }
    }
    if(o.sleep){
      if(o.vel.lengthSq()>.002)o.sleep=false;else continue;
    }
    o.vel.y-=PHYS.g*dt;
    o.pos.addScaledVector(o.vel,dt);
    o.rx+=o.av.x*dt;o.ry+=o.av.y*dt;o.rz+=o.av.z*dt;
    const gy=gh(o.pos.x,o.pos.z);
    if(gy<-5000||o.pos.y<-60){
      o.pos.copy(o.home);o.vel.set(0,0,0);o.av.set(0,0,0);
      o.rx=o.rz=0;o.ry=o.homeRy;o.sleep=true;
    }else{
      const floor=gy+o.h*.5;
      if(o.pos.y<=floor){
        o.pos.y=floor;
        if(o.vel.y<-1.4){o.vel.y*=-.32;o.av.multiplyScalar(.75)}
        else{
          o.vel.y=0;
          const fr=Math.max(0,1-6*dt);
          o.vel.x*=fr;o.vel.z*=fr;o.av.multiplyScalar(1-4*dt);
          if(o.vel.x*o.vel.x+o.vel.z*o.vel.z<.02&&o.av.lengthSq()<.05)o.sleep=true;
        }
      }
    }
    o.g.position.copy(o.pos);
    o.g.rotation.set(o.rx,o.ry,o.rz);
  }
  if(touched){
    car.speed=car.vLong=car.vel.x*Math.sin(car.h)+car.vel.z*Math.cos(car.h);
    car.vLat=car.vel.x*Math.cos(car.h)-car.vel.z*Math.sin(car.h);
  }
}

// --- parked vehicles are solid: live car (3-disc capsule) vs parked OBB ---
const SKIN_HALF={   // [halfW, halfL] per body, taken straight from each vehicle's tuning
  lambo:[LAMBO_PHYS.halfW,LAMBO_PHYS.halfL],
  chiron:[CHIRON_PHYS.halfW||LAMBO_PHYS.halfW,CHIRON_PHYS.halfL||LAMBO_PHYS.halfL],
  truck:[TRUCK_PHYS.halfW,TRUCK_PHYS.halfL],
  ferrari:[FERRARI_PHYS.halfW,FERRARI_PHYS.halfL]};
const SKIN_MASS={lambo:LAMBO_PHYS.mass,chiron:CHIRON_PHYS.mass,truck:TRUCK_PHYS.mass,ferrari:FERRARI_PHYS.mass};
function collideParked(dt){
  const hw=PHYS.halfW||1.02,off=Math.max(0,(PHYS.halfL||2.45)-hw);
  const sh=Math.sin(car.h),ch=Math.cos(car.h);
  for(const k in parked){
    const g=parked[k];if(!g)continue;
    const u=g.userData;
    if(u.pv){   // a shoved parked car slides and spins a little, then friction stops it
      g.position.x+=u.pv.x*dt;g.position.z+=u.pv.z*dt;
      const damp=Math.exp(-2.2*dt);u.pv.multiplyScalar(damp);
      g.rotation.y+=(u.pr||0)*dt;u.pr=(u.pr||0)*damp;
    }
    if(u.hitCool>0)u.hitCool-=dt;
    if(car.pos.y>g.position.y+1.5)continue;   // jumping clean over it
    const half=SKIN_HALF[k]||[1.02,2.45],pm=SKIN_MASS[k]||1800;
    const ps=Math.sin(g.rotation.y),pc=Math.cos(g.rotation.y);
    let deepest=null;
    for(let i=0;i<3;i++){
      const t=i===0?-off:i===1?0:off;                  // nose / middle / tail sample discs
      const wx=car.pos.x+sh*t,wz=car.pos.z+ch*t;
      const dx=wx-g.position.x,dz=wz-g.position.z;
      const lx=dx*pc-dz*ps,lz=dx*ps+dz*pc;              // parked-local
      const px=clamp(lx,-half[0],half[0]),pz=clamp(lz,-half[1],half[1]);
      let nlx=lx-px,nlz=lz-pz,dist=Math.hypot(nlx,nlz),pen;
      if(dist<1e-4){                                    // disc centre inside the box: exit the nearest face
        const ex=half[0]-Math.abs(lx),ez=half[1]-Math.abs(lz);
        if(ex<ez){nlx=lx>=0?1:-1;nlz=0;pen=hw+ex}else{nlx=0;nlz=lz>=0?1:-1;pen=hw+ez}
        dist=0;
      }else{
        pen=hw-dist;if(pen<=0)continue;
        nlx/=dist;nlz/=dist;
      }
      const nwx=nlx*pc+nlz*ps,nwz=-nlx*ps+nlz*pc;       // parked-local normal -> world (points at the live car)
      car.pos.x+=nwx*pen*.9;car.pos.z+=nwz*pen*.9;      // push the live car out of the body
      if(!deepest||pen>deepest.pen)deepest={wx,wz,nwx,nwz,pen};
    }
    if(!deepest)continue;
    const vn=car.vel.x*deepest.nwx+car.vel.z*deepest.nwz;
    if(vn>=-.25)continue;                               // resting contact / separating
    const mu=PHYS.mass*pm/(PHYS.mass+pm),J=-vn*mu*1.22;  // impulse with a little bounce
    car.vel.x+=deepest.nwx*J/PHYS.mass;car.vel.z+=deepest.nwz*J/PHYS.mass;
    u.pv.x-=deepest.nwx*J/pm;u.pv.z-=deepest.nwz*J/pm;
    const rx=deepest.wx-car.pos.x,rz=deepest.wz-car.pos.z;
    car.yawRate+=(rz*deepest.nwx-rx*deepest.nwz)*J/(PHYS.izz||3200);
    u.pr=(u.pr||0)-(Math.random()-.5)*Math.min(1.2,-vn*.12);   // parked body twists slightly
    if(u.hitCool<=0&&-vn>1.2){
      u.hitCool=.25;
      const eff=-vn*clamp(Math.sqrt(pm/PHYS.mass),.7,2.5);       // a 16 t truck hits far harder than an F1
      impactAt(deepest.wx,car.pos.y+.55,deepest.wz,deepest.nwx,0,deepest.nwz,eff,pm);
      statEl.textContent='Crashed into the '+SKINS[k].name.replace(/<[^>]*>/g,'');
    }
  }
}

// --- boost pads: driving over a glowing chevron pad shoves the car forward (PADS built in world.js) ---
function updatePads(dt){
  if(!inCar||RP.on||car.air)return;
  for(const p of PADS){
    if(Math.abs(car.pos.x-p.x)<2.3&&car.pos.z<=p.z0&&car.pos.z>=p.z1){
      const sx=Math.sin(car.h),cz=Math.cos(car.h);
      car.vel.x+=sx*95*dt;car.vel.z+=cz*95*dt;
      car.speed=car.vLong=car.vel.x*sx+car.vel.z*cz;car.vLat=car.vel.x*cz-car.vel.z*sx;
      statEl.textContent='BOOST!';return;
    }
  }
}
