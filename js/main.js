/* CrashNG — main: vehicle swap, HUD/input/camera, frame loop, boot
   Owns: resetCar(), setCar(), applySkin(), makeParked()/layoutCars()/swapTo()/toggleCar(),
   respawnCar(), all button + keyboard wiring, walker camera, frame(), and the boot sequence.
   Classic scripts: every top-level name here is global; keep load order in index.html. */

function resetCar(){
  car.pos.set(RX+SKINS[skin].slotX,RH,-14);car.h=Math.PI;car.vel.set(0,0,0);car.yawRate=0;car.speed=car.vLong=car.vLat=0;
  car.vy=0;car.gy=RH;car.gv=0;car.gyOk=1;car.air=false;car.airT=0;car.ax=car.ay=0;car.steer=0;car.throttle=0;car.brake=0;
  car.gear=1;car.rpm=PHYS.idle;car.shiftT=0;car.reverseT=0;car.wheelSlip=0;car.skidAcc=0;car.smokeT=0;
  car.tc=car.abs=car.cut=0;
  car.bp=car.bpv=car.br=car.brv=car.bh=car.bhv=0;car.pitch=car.roll=0;
  wheels.forEach(w=>{w.spinA=0;w.spin.rotation.x=0;w.steer.rotation.set(0,0,0)});
  carBody.rotation.set(0,0,0);carBody.position.y=0;
  truckBody.rotation.set(0,0,0);truckBody.position.y=0;
  f1Body.rotation.set(0,0,0);f1Body.position.y=0;
  carG.position.copy(car.pos);carG.rotation.set(0,car.h,0);
  flames.forEach(f=>f.visible=false);
  crash.dmg=crash.eng=crash.shake=crash.flash=crash.slow=crash.cool=crash.smokeT=0;crash.parts=0;
  wheelDmg[0]=wheelDmg[1]=wheelDmg[2]=wheelDmg[3]=0;
  if(!REC.replay){REC.time=0;REC.acc=0;REC.obsAcc=0;REC.samples.length=0;REC.ev.length=0;REC.obs.length=0;REC.on=true}
  repairBody();repairParts();updateDmgHud();
}

function setCar(v){
  inCar=v;root.visible=!v;bCar.firstChild.textContent=v?'Exit car':'Enter car';
  document.getElementById('carName').classList.toggle('on',v);
  document.getElementById('aux').classList.toggle('on',v);
  if(v){audioInit();statEl.textContent='W throttle · S brake/reverse · A/D steer · Space handbrake · Shift boost · H horn · L lights · X hazards · N night'}
}
// --- vehicle fleet: one is live (physics + crash model), the rest sit parked; walking to one swaps them ---
function applySkin(k){
  skin=k;const S=SKINS[k];
  paint.color.set(S.paint.color).convertSRGBToLinear();   // hex is authored in sRGB, like the base paint
  paint.metalness=S.paint.metalness;paint.roughness=S.paint.roughness;
  caliperM.color.set(S.caliper);chironBits.forEach(b=>{b.visible=S.bits});
  carBody.visible=k!=='truck'&&k!=='ferrari';
  truckBody.visible=k==='truck';f1Body.visible=k==='ferrari';
  setWheels(k);
  Object.assign(PHYS,LAMBO_PHYS,k==='chiron'?CHIRON_PHYS:k==='truck'?TRUCK_PHYS:k==='ferrari'?FERRARI_PHYS:{});
  const f1=k==='ferrari';
  [-1,1].forEach((sx,i)=>{   // headlights sit at bonnet height on cars, at cab height on the truck
    const b=beams[i];if(!b)return;
    b.visible=!f1;                                                            // an F1 car has no headlights
    if(k==='truck'){b.position.set(sx*.78,1.34,3.86);b.target.position.set(sx*1.0,-.9,40)}
    else{b.position.set(sx*.48,.53,2.34);b.target.position.set(sx*.85,.10,30)}
  });
  if(AUD.ctx){   // air horn for the truck, electric horn for the cars
    const t=AUD.ctx.currentTime,lo=k==='truck';
    AUD.h1.frequency.setTargetAtTime(lo?233:392,t,.08);
    AUD.h2.frequency.setTargetAtTime(lo?311:494,t,.08);
  }
  document.getElementById('carName').innerHTML=S.name;
}
function makeParked(k,x,z,h){   // static copy of car k (own geometry + colours) so the live car's dents never touch it
  const cur=skin;applySkin(k);
  const g=carG.clone(true),pC=paint.clone(),cC=caliperM.clone(),kill=[];
  const sw=m=>m===paint?pC:m===caliperM?cC:m;
  g.traverse(o=>{
    if(o.isSpotLight){kill.push(o);return}
    if(o.userData&&o.userData.beamCone)o.visible=false;   // the parked copy doesn't project light cones
    if(!o.isMesh)return;
    if(SOFT.some(e=>e.mesh.geometry===o.geometry)||o.geometry.attributes.position===bodyGeo.attributes.position)o.geometry=o.geometry.clone();   // only deformable meshes need their own copy; everything else shares GPU buffers
    o.material=Array.isArray(o.material)?o.material.map(sw):sw(o.material);
  });
  kill.forEach(o=>o.parent&&o.parent.remove(o));
  applySkin(cur);
  g.position.set(x,gh(x,z),z);g.rotation.set(0,h,0);
  g.userData.skin=k;                        // collideParked() needs the parked vehicle's size + mass
  g.userData.pv=new THREE.Vector3();        // shove velocity, so hits slide the parked body a little
  g.userData.pr=0;g.userData.hitCool=0;
  scene.add(g);parked[k]=g;return g;
}
function layoutCars(){   // live vehicle on its own slot, every other one parked beside it
  for(const k in parked)if(parked[k]){scene.remove(parked[k]);parked[k]=null}
  resetCar();
  for(const k in SKINS)if(k!==skin)makeParked(k,RX+SKINS[k].slotX,-14,Math.PI);
}
function swapTo(k){   // leave the current car where it stands (repaired), climb into the parked one
  const p=parked[k],old=skin;if(!p)return;
  repairBody();repairParts();
  const y=car.pos.y,g=makeParked(old,car.pos.x,car.pos.z,car.h);g.position.y=y;
  const px=p.position.x,py=p.position.y,pz=p.position.z,ph=p.rotation.y;
  scene.remove(p);parked[k]=null;
  applySkin(k);resetCar();
  car.pos.set(px,py,pz);car.h=ph;car.gy=py;carG.position.copy(car.pos);carG.rotation.set(0,car.h,0);
}
function toggleCar(){
  if(RP.on)return;
  if(!inCar){
    let best=null,bd=1e9;
    for(const k in SKINS){const p=parked[k];if(!p)continue;
      const d=Math.hypot(pos.x-p.position.x,pos.z-p.position.z);if(d<bd){bd=d;best=k}}
    const dReal=Math.hypot(pos.x-car.pos.x,pos.z-car.pos.z);
    if(Math.min(dReal,bd)>=6)statEl.textContent='Walk closer to a vehicle first';
    else{if(bd<dReal)swapTo(best);setCar(true)}
  }else{
    setCar(false);car.vel.multiplyScalar(.4);car.yawRate*=.4;
    pos.set(car.pos.x+Math.cos(car.h)*3,gh(car.pos.x,car.pos.z),car.pos.z-Math.sin(car.h)*3);vel.set(0,0,0);face=car.h;
  }
}
function respawnCar(){
  if(RP.on){endReplay();return}
  layoutCars();resetObstacles();if(inCar){camY=car.h+Math.PI;camX=.3}statEl.textContent='Cars repaired & back on the runway';
}
addEventListener('keydown',e=>{if(e.code==='KeyE')toggleCar();if(e.code==='KeyR')respawnCar()});
const clickBtn=(id,f)=>{const b=document.getElementById(id);b.addEventListener('click',()=>{f();b.blur()})};
clickBtn('bCar',toggleCar);clickBtn('bRespawn',respawnCar);
clickBtn('bReplay',startReplay);
clickBtn('bView',()=>{if(RP.on)return;camX=.45;camD=10;camY=inCar?car.h+Math.PI:Math.PI});

// --- car electrics: headlights (low/high/flash), signals, hazards, reverse lamps, night mode, horn + engine audio ---

addEventListener('pointerdown',()=>audioInit(),{passive:true});
clickBtn('bLights',cycleLights);
clickBtn('bHaz',()=>{lights.haz=!lights.haz;lights.blink=0;statEl.textContent=lights.haz?'Hazards on':'Hazards off'});
const bHorn=document.getElementById('bHorn');
bHorn.addEventListener('pointerdown',()=>{audioInit();hornBtn=true});
['pointerup','pointerleave','pointercancel'].forEach(n=>bHorn.addEventListener(n,()=>hornBtn=false));
applySkin('lambo');layoutCars();
const bb=document.getElementById('bBoost');
['pointerdown'].forEach(n=>bb.addEventListener(n,()=>boostBtn=true));
['pointerup','pointerleave','pointercancel'].forEach(n=>bb.addEventListener(n,()=>boostBtn=false));
scene.add(sun.target);

// --- Springs ---
class Spring{constructor(k,d){this.k=k;this.d=d;this.x=0;this.v=0;this.t=0}
 step(dt){this.v+=((this.t-this.x)*this.k-this.v*this.d)*dt;this.x+=this.v*dt}}
const sPitch=new Spring(150,7),sRoll=new Spring(150,7),hPitch=new Spring(110,5),hRoll=new Spring(110,5),squash=new Spring(220,9);

// --- Input & camera ---
const keys={};
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space')e.preventDefault()});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;boostBtn=false});
let camX=.45,camY=Math.PI,camD=10,drag=false;
addEventListener('mousedown',()=>drag=true);
addEventListener('mouseup',()=>drag=false);
addEventListener('mousemove',e=>{if(!drag)return;camY-=e.movementX*.005;camX=Math.max(.1,Math.min(1.35,camX+e.movementY*.005))});
addEventListener('wheel',e=>camD=Math.max(4,Math.min(22,camD+e.deltaY*.01)));

const pos=new THREE.Vector3(RX,gh(RX,-24)+.3,-24),vel=new THREE.Vector3();
const tmpDir=new THREE.Vector3(),tmpCam=new THREE.Vector3(),YAXIS=new THREE.Vector3(0,1,0);
let face=0,faceT=0,grounded=true,walk=0,t=0,frameN=0;
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;   // refresh shadows at half rate instead of twice a frame
const clock=new THREE.Clock(),spdEl=document.getElementById('spd');
let perfT=0,perfN=0,perfStep=0;
function frame(){
  requestAnimationFrame(frame);
  const raw=Math.min(clock.getDelta(),.05);
  // big hits drop into a short slow-motion beat, BeamNG-style
  if(crash.slow>0)crash.slow=Math.max(0,crash.slow-raw);
  const dt=raw*(crash.slow>0?.35:1);t+=dt;
  if(RP.on)updateReplay(raw);
  else{updateCar(dt);recordFrame(raw)}
  updateAuto(raw);audioUpdate();updatePads(raw);crashFX(raw);updateLoose(raw);
  spdEl.style.opacity=inCar?(clamp((Math.abs(car.speed)*3.6-140)/260,0,1)*.85).toFixed(2):'0';   // speed streaks at the screen edge
  // dynamic resolution: nudge the pixel ratio to hold ~50 fps on any device; shadows only go if even the floor can't cope
  if(!document.hidden){perfT+=raw;perfN++}
  if(perfT>1.2){
    const fps=perfN/perfT;perfT=0;perfN=0;
    const lo=Q.low?.5:.6,hi=Q.pr;let pr=renderer.getPixelRatio();
    if(fps<46&&pr>lo){pr=Math.max(lo,pr-.15);renderer.setPixelRatio(pr)}
    else if(fps>57&&pr<hi){pr=Math.min(hi,pr+.1);renderer.setPixelRatio(pr)}
    if(fps<28&&pr<=lo&&renderer.shadowMap.enabled){renderer.shadowMap.enabled=false;sun.castShadow=false;scene.traverse(o=>{if(o.material&&!Array.isArray(o.material))o.material.needsUpdate=true})}
  }

  const mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
  const mz=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
  const dir=tmpDir.set(inCar?0:mx,0,inCar?0:mz);
  if(dir.lengthSq()>0)dir.normalize().applyAxisAngle(YAXIS,camY);
  const moving=dir.lengthSq()>0;

  const accel=grounded?170:30,fric=grounded?11:1.5;
  if(moving){vel.x+=dir.x*accel*dt;vel.z+=dir.z*accel*dt;faceT=Math.atan2(dir.x,dir.z)}
  vel.x-=vel.x*fric*dt;vel.z-=vel.z*fric*dt;
  const sp=Math.hypot(vel.x,vel.z),max=18;
  if(sp>max){vel.x*=max/sp;vel.z*=max/sp}

  if(keys.Space&&grounded&&!inCar){vel.y=12;grounded=false;squash.v+=5;sPitch.v-=5;hPitch.v-=9}
  vel.y-=32*dt;pos.addScaledVector(vel,dt);
  if(pos.y<-60){pos.set(RX,gh(RX,-24)+.3,-24);vel.set(0,0,0);grounded=false;statEl.textContent='You fell into the void'}
  const gy=gh(pos.x,pos.z);
  if(grounded&&pos.y>gy+.3)grounded=false;
  if(pos.y<=gy){
    if(!grounded&&vel.y<-4){squash.v-=Math.abs(vel.y)*.9;hPitch.v+=Math.abs(vel.y)*.7}
    pos.y=gy;vel.y=0;grounded=true;
  }

  if(moving){let a=faceT-face;while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;face+=a*14*dt}
  root.position.copy(pos);root.rotation.y=face;

  const fwd=vel.x*Math.sin(face)+vel.z*Math.cos(face),side=vel.x*Math.cos(face)-vel.z*Math.sin(face);
  sPitch.t=fwd*.035;sRoll.t=-side*.04;
  hPitch.t=sPitch.x*1.6;hRoll.t=sRoll.x*1.8;
  sPitch.step(dt);sRoll.step(dt);hPitch.step(dt);hRoll.step(dt);squash.step(dt);
  torsoP.rotation.x=sPitch.x;torsoP.rotation.z=sRoll.x;
  headP.rotation.x=hPitch.x;headP.rotation.z=hRoll.x;
  const sq=squash.x*.04;
  body.scale.set(1+sq,1-sq,1+sq);

  if(grounded&&sp>.5){
    walk+=sp*1.1*dt;const sw=Math.sin(walk)*.9;
    legL.rotation.x=sw;legR.rotation.x=-sw;
    armL.rotation.x=-sw*1.2;armR.rotation.x=sw*1.2;
    armL.rotation.z=-(.65+Math.abs(Math.cos(walk))*.25);armR.rotation.z=-armL.rotation.z;
    hips.position.y=.5+Math.abs(Math.sin(walk))*.14;hips.rotation.z=Math.cos(walk)*.08;
  }else if(!grounded){
    walk+=14*dt;
    legL.rotation.x=Math.sin(walk)*.5;legR.rotation.x=-Math.sin(walk)*.5;
    armL.rotation.z=-(2.3+Math.sin(walk)*.4);armR.rotation.z=-armL.rotation.z;
    armL.rotation.x=armR.rotation.x=0;
  }else{
    const idle=Math.sin(t*2)*.04;
    legL.rotation.x*=.85;legR.rotation.x*=.85;armL.rotation.x*=.85;armR.rotation.x*=.85;
    armL.rotation.z+=(-.65-idle-armL.rotation.z)*10*dt;armR.rotation.z+=(.65+idle-armR.rotation.z)*10*dt;
    hips.position.y+=(.5-hips.position.y)*10*dt;hips.rotation.z*=.85;
  }

  const focus=tmpCam;
  if(RP.on){
    replayCamera(raw);
    const fovT=54+Math.min(14,Math.abs(car.speed)*.14);
    const nf=camera.fov+(fovT-camera.fov)*Math.min(1,2.5*raw);
    if(Math.abs(nf-camera.fov)>.01){camera.fov=nf;camera.updateProjectionMatrix()}
    focus.copy(car.pos);
  }else{
    const cspeed=Math.abs(car.speed);
    const dist=camD+(inCar?(PHYS.camDist||0)+Math.min(4,cspeed*.05):0);
    const c=focus.copy(inCar?car.pos:pos);c.y+=inCar?(PHYS.eyeY||1.05):1.2;
    camera.position.set(c.x+dist*Math.sin(camY)*Math.cos(camX),c.y+dist*Math.sin(camX),c.z+dist*Math.cos(camY)*Math.cos(camX));
    camera.lookAt(c);
    const fovT=60+(inCar?Math.min(16,cspeed*.2):0);
    const nf=camera.fov+(fovT-camera.fov)*Math.min(1,2.5*dt);
    if(Math.abs(nf-camera.fov)>.01){camera.fov=nf;camera.updateProjectionMatrix()}
  }
  if(crash.shake>.002){
    camera.position.x+=(Math.random()-.5)*crash.shake*2;
    camera.position.y+=(Math.random()-.5)*crash.shake*2;
    camera.position.z+=(Math.random()-.5)*crash.shake*2;
    camera.rotation.z+=(Math.random()-.5)*crash.shake*.14;
    crash.shake*=Math.exp(-4.5*raw);
  }else crash.shake=0;
  if(crash.flash>.004){hitEl.style.opacity=crash.flash.toFixed(3);crash.flash*=Math.exp(-7*raw)}
  else if(crash.flash){hitEl.style.opacity='0';crash.flash=0}
  if(skyDome)skyDome.position.copy(camera.position);   // keep the dome around the player on the long track
  stars.position.copy(camera.position);
  sun.target.position.copy(focus);sun.position.set(focus.x+SUNOFF.x,focus.y+SUNOFF.y,focus.z+SUNOFF.z);
  if(renderer.shadowMap.enabled&&(++frameN&1))renderer.shadowMap.needsUpdate=true;
  renderer.render(scene,camera);
}
frame();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

// --- graphics switch: Auto -> Low -> High (saved, reloads so geometry detail / shadows / clouds rebuild at that tier) ---
const bQual=document.getElementById('bQual');bQual.textContent='Graphics: '+Q.mode;
bQual.addEventListener('click',()=>{
  const nx={auto:'low',low:'high',high:'auto'}[Q.mode];
  try{if(nx==='auto')localStorage.removeItem('cng-q');else localStorage.setItem('cng-q',nx)}catch(e){}
  location.reload();
});

// --- touch: on-screen pad + one-finger drag to look, so it plays on phones/tablets without a keyboard ---
if(Q.touch){
  document.body.classList.add('touch');
  statEl.textContent='Use the pad to walk/drive · drag the screen to look · tap Enter car near a vehicle';
  const pad=document.createElement('div');pad.id='tpad';
  pad.innerHTML='<div class="dp"><b data-k="KeyW">▲</b><b data-k="KeyA">◀</b><b data-k="KeyS">▼</b><b data-k="KeyD">▶</b></div><div class="act"><b data-k="Space">Brake / Jump</b></div>';
  document.body.appendChild(pad);
  pad.addEventListener('contextmenu',e=>e.preventDefault());
  const press=(b,on)=>{keys[b.dataset.k]=on;b.classList.toggle('on',on)};
  pad.querySelectorAll('b').forEach(b=>{
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);press(b,true)});
    ['pointerup','pointercancel','lostpointercapture'].forEach(n=>b.addEventListener(n,()=>press(b,false)));
  });
  const cv=renderer.domElement;let tx=0,ty=0,tid=null;
  cv.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;tid=e.pointerId;tx=e.clientX;ty=e.clientY});
  cv.addEventListener('pointermove',e=>{if(e.pointerId!==tid)return;camY-=(e.clientX-tx)*.006;camX=Math.max(.1,Math.min(1.35,camX+(e.clientY-ty)*.006));tx=e.clientX;ty=e.clientY});
  ['pointerup','pointercancel'].forEach(n=>cv.addEventListener(n,e=>{if(e.pointerId===tid)tid=null}));
}
document.getElementById('bTime').addEventListener('click',e=>{setTime((lights.time+1)%3);e.currentTarget.blur()});
