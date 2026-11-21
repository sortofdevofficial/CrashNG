/* CrashNG — core: shared state + utilities, then the replay recorder/player
   Owns: PHYS/LAMBO_PHYS, live car + crash state, wheelDmg, HUD refs, clamp/wrap/torqueAt/tireCurve, smoke + skid pools,
   then REC/RP/REPCAM, recordFrame(), updateReplay(), replayCamera(), startReplay(), endReplay(). */

// ======== core.js ========
/* CrashNG — core: shared state, utility math, smoke/skid pools
   Owns: PHYS/LAMBO_PHYS tuning, live car + crash state, wheelDmg, HUD element refs,
   clamp/wrap/stepSpring/torqueAt/tireCurve, carLocalP/zoneHit, puff()/addSkid().
   Reads from: world.js, cars-*.js. Everything else depends on these names.
   Classic scripts: every top-level name here is global; keep load order in index.html. */

// --- vehicle model (all SI-ish units: m, kg, N, m/s) ---
// Revuelto SV reference: 1015 CV / 747 kW combined, 1800 kg, 8-speed DCT, AWD, 350 km/h, 0-100 ~2.5 s
const PHYS={mass:1800,izz:3200,a:1.57,b:1.21,track:1.75,wheelR:.38,cgY:.47,g:9.81,
  steerLock:.5,enginePeak:800,idle:950,redline:9500,
  gears:[4.6,3.2,2.45,1.95,1.6,1.35,1.15,.95],
  final:3.35,eff:.9,drag:.44,roll:230,downforce:.6,muF:1.42,muR:1.55,
  brakeForce:24000,boost:4200,maxSpeed:97.2,power:747000,
  driveSplitF:.4,brakeSplitF:.58,hbForce:15000,
  thrUp:7,thrDn:11,steerIn:7,steerOut:11,
  shiftUp:9240,downRpm:2700,kickdown:4300,shiftTime:.13,
  engBrake:1100,engBrakeK:110,creep:300,creepSpd:2.2,fill:3000,fillTop:45,revForce:5200,
  eyeY:1.05,camDist:0,halfW:1.02,halfL:2.45,axleF:1.48,axleR:-1.52,
  cw:1,cl:1,pitchK:.011,rollK:.012,rollMax:.11,pitchMax:.075,leanRate:14,susK:900,susD:58,
  zoneF:1.1,zoneR:1.2,zoneX:.45,smokeZ:1.25,
  audioMul:3.1,lpBase:420};
const LAMBO_PHYS=JSON.parse(JSON.stringify(PHYS));   // base tuning; applySkin() swaps in the Chiron's / truck's
let skin='lambo';const parked={lambo:null,chiron:null,truck:null,ferrari:null};   // the vehicle being driven + static copies of the others
const car={pos:new THREE.Vector3(),vel:new THREE.Vector3(),h:Math.PI,yawRate:0,speed:0,vLong:0,vLat:0,
  vy:0,gy:RH,gv:0,gyOk:1,air:false,airT:0,t:0,from:new THREE.Vector3(),steer:0,throttle:0,brake:0,
  gear:1,rpm:PHYS.idle,shiftT:0,reverseT:0,ax:0,ay:0,pitch:0,roll:0,tc:0,abs:0,cut:0,
  bp:0,bpv:0,br:0,brv:0,bh:0,bhv:0,wheelSlip:0,skidAcc:0,smokeT:0};
// --- crash & damage model: crumpling shell, torn-off parts, bent wheels, wounded engine ---
const crash={dmg:0,eng:0,shake:0,flash:0,slow:0,cool:0,smokeT:0,parts:0};
const wheelDmg=[0,0,0,0];

const hitEl=document.getElementById("hit");   // red impact flash overlay
let inCar=false,boostBtn=false;
const speedEl=document.getElementById('speed'),gearEl=document.getElementById('gear');
const statEl=document.getElementById('stat'),bCar=document.getElementById('bCar');
function wrap(a){while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

// --- tire smoke + skid mark pools ---
const smokeTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  const gr=x.createRadialGradient(32,32,2,32,32,30);gr.addColorStop(0,'rgba(255,255,255,.95)');
  gr.addColorStop(.55,'rgba(226,226,226,.42)');gr.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=gr;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
const smoke=[];
for(let i=0;i<Q.smoke;i++){
  const m=new THREE.SpriteMaterial({map:smokeTex,transparent:true,opacity:0,depthWrite:false});
  const s=new THREE.Sprite(m);s.visible=false;scene.add(s);
  smoke.push({s,life:0,max:0,vel:new THREE.Vector3()});
}
function puff(x,y,z,n,size,spread,color){
  for(let i=0;i<n;i++){
    const p=smoke.find(q=>q.life<=0);if(!p)return;
    p.life=p.max=.55+Math.random()*.45;p.s.visible=true;
    p.s.position.set(x+(Math.random()-.5)*.4,y+.25+Math.random()*.2,z+(Math.random()-.5)*.4);
    p.s.scale.setScalar(size*(.7+Math.random()*.7));
    p.vel.set((Math.random()-.5)*spread,.6+Math.random()*1.2,(Math.random()-.5)*spread);
    p.s.material.color.setHex(color||0xffffff);
    p.s.material.opacity=.34;
  }
}
const skidM=new THREE.MeshBasicMaterial({color:0x17171a,transparent:true,opacity:.42,depthWrite:false});
const skidGeo=new THREE.BoxGeometry(.22,.012,1.15);
const skidMesh=new THREE.InstancedMesh(skidGeo,skidM,Q.skids);
skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
skidMesh.frustumCulled=false;skidMesh.count=0;scene.add(skidMesh);
const skidDummy=new THREE.Object3D();skidDummy.rotation.order='YXZ';skidDummy.scale.setScalar(0);skidDummy.updateMatrix();
for(let i=0;i<Q.skids;i++)skidMesh.setMatrixAt(i,skidDummy.matrix);
skidMesh.instanceMatrix.needsUpdate=true;
let skidI=0;
function addSkid(x,z,pitch,roll,yaw){
  skidDummy.position.set(x,gh(x,z)+.035,z);
  skidDummy.rotation.set(-pitch,yaw,roll);skidDummy.scale.set(1,1,1);skidDummy.updateMatrix();
  skidMesh.setMatrixAt(skidI++%Q.skids,skidDummy.matrix);
  skidMesh.count=Math.min(Q.skids,skidI);
  skidMesh.instanceMatrix.needsUpdate=true;
}
function stepSpring(o,k,vk,target,kk,dd,dt){o[vk]+=((target-o[k])*kk-o[vk]*dd)*dt;o[k]+=o[vk]*dt}
function torqueAt(rpm){
  const x=clamp((rpm-900)/(PHYS.redline-900),0,1);
  return PHYS.enginePeak*(.62+1.15*x-.78*x*x);   // NA-style curve: soft low end, peak ~7k, still pulling at the limiter
}
function tireCurve(alpha,load,mu){
  const peak=.115,a=Math.abs(alpha);
  const f=a<peak?Math.sin(a/peak*Math.PI/2):Math.max(.55,1-(a-peak)*.85);
  return -Math.sign(alpha)*mu*load*f;
}

// --- crash response: crumple the shell, score damage, rip parts off ---
const _L={x:0,y:0,z:0};
function carLocalP(wx,wy,wz){
  const c=Math.cos(car.h),s=Math.sin(car.h);
  const dx=wx-car.pos.x,dz=wz-car.pos.z;
  _L.x=dx*c-dz*s;_L.y=wy-car.pos.y;_L.z=dx*s+dz*c;return _L;
}
function zoneHit(z,L){
  if(!z)return true;
  if(z==='front')return L.z>(PHYS.zoneF||1.1);
  if(z==='rear')return L.z<-(PHYS.zoneR||1.2);
  if(z==='left')return L.x>(PHYS.zoneX||.45);
  if(z==='right')return L.x<-(PHYS.zoneX||.45);
  return true;
}

// ======== replay.js ========
/* CrashNG — replay: 20 Hz recorder + directed playback camera
   Owns: REC/RP/REPCAM, recordFrame(), applyReplayEvent(), updateReplay(), replayCamera(),
   startReplay(), endReplay(). Impact/detach events are stored as REC.ev entries.
   Classic scripts: every top-level name here is global; keep load order in index.html. */

const REC={on:true,replay:false,time:0,acc:0,obsAcc:0,limit:100,samples:[],ev:[],obs:[]};
const RP={on:false,t:0,end:0,si:0,ei:0,oi:0,smokeT:0};
const REPCAM={x:0,y:0,z:0,lx:0,ly:0,lz:0,mode:0,modeT:99,impact:0,init:false};


// --- replay: sample the live run, then play it back on a directed camera ---
function recordFrame(raw){
  if(!REC.on||REC.replay)return;
  REC.time+=raw;REC.acc+=raw;REC.obsAcc+=raw;
  if(REC.acc>=.05){
    REC.acc=0;
    REC.samples.push({t:REC.time,p:[car.pos.x,car.pos.y,car.pos.z],h:car.h,pt:car.pitch,ro:car.roll,
      bp:car.bp,br:car.br,bh:car.bh,sp:car.speed,st:car.steer,g:car.gear,r:car.rpm,
      d:crash.dmg,e:crash.eng,w:wheelDmg.slice()});
  }
  if(REC.obsAcc>=.1){
    REC.obsAcc=0;
    const a=[];
    for(let i=0;i<OB.length;i++){
      const o=OB[i];
      if(!o.sleep||o.vel.lengthSq()>.01||Math.abs(o.rx)+Math.abs(o.rz)>.01||o.ry!==o.homeRy)
        a.push(i,o.pos.x,o.pos.y,o.pos.z,o.rx,o.ry,o.rz);
    }
    if(a.length)REC.obs.push({t:REC.time,a});
  }
  const cut=REC.time-REC.limit;
  while(REC.samples.length&&REC.samples[0].t<cut)REC.samples.shift();
  while(REC.ev.length&&REC.ev[0].t<cut)REC.ev.shift();
  while(REC.obs.length&&REC.obs[0].t<cut)REC.obs.shift();
}
function applyReplayEvent(e){
  if(e.k==='dent'){
    dentAt(e.a[0],e.a[1],e.a[2],e.a[3],e.a[4],e.a[5],e.a[6],e.a[7]);
    crash.shake=Math.min(.6,crash.shake+(e.s||0)*.018);
    crash.flash=Math.min(.55,crash.flash+(e.s||0)*.014);
    if((e.s||0)>14){REPCAM.impact=2.4;REPCAM.modeT=99}
  }else if(e.k==='shards'){spawnShards(e.a[0],e.a[1],e.a[2],e.a[3]);
  }else if(e.k==='detach'){
    const d=detachParts.find(p=>p.name===e.n);
    if(!d||d.gone)return;
    scene.attach(d.mesh);
    d.gone=true;crash.parts++;if(d.onDetach)d.onDetach();
    d.mesh.position.fromArray(e.p);d.mesh.quaternion.fromArray(e.q);d.mesh.scale.fromArray(e.s);
    debris.push({m:d.mesh,v:new THREE.Vector3().fromArray(e.v),av:new THREE.Vector3().fromArray(e.av)});
    statEl.textContent='Crash: '+d.name+' torn off'+(d.name==='engine'?' — the car is dead':d.name.includes('wheel')?' — that corner is dead':'');
  }
}
function updateReplay(raw){
  if(!RP.on)return;
  RP.t+=raw;
  const S=REC.samples;
  while(RP.si<S.length-2&&S[RP.si+1].t<=RP.t)RP.si++;
  const a=S[RP.si],b=S[Math.min(RP.si+1,S.length-1)];
  const f=b.t>a.t?clamp((RP.t-a.t)/(b.t-a.t),0,1):0;
  const lp=(u,v)=>u+(v-u)*f;
  car.pos.set(lp(a.p[0],b.p[0]),lp(a.p[1],b.p[1]),lp(a.p[2],b.p[2]));
  car.h=a.h+wrap(b.h-a.h)*f;
  car.pitch=lp(a.pt,b.pt);car.roll=lp(a.ro,b.ro);
  car.bp=lp(a.bp,b.bp);car.br=lp(a.br,b.br);car.bh=lp(a.bh,b.bh);
  car.speed=lp(a.sp,b.sp);car.steer=lp(a.st,b.st);
  car.gear=Math.round(lp(a.g,b.g));car.rpm=lp(a.r,b.r);
  crash.dmg=lp(a.d,b.d);crash.eng=lp(a.e,b.e);
  for(let i=0;i<4;i++)wheelDmg[i]=lp(a.w[i],b.w[i]);
  carG.position.copy(car.pos);carG.rotation.set(-car.pitch,car.h,car.roll);
  const sg=crashSag();carBody.rotation.set(car.bp+sg.p,0,car.br+sg.r);carBody.position.y=car.bh-sg.d;
  while(RP.ei<REC.ev.length&&REC.ev[RP.ei].t<=RP.t)applyReplayEvent(REC.ev[RP.ei++]);
  while(RP.oi<REC.obs.length&&REC.obs[RP.oi].t<=RP.t){
    const A=REC.obs[RP.oi++].a;
    for(let i=0;i<A.length;i+=7){
      const o=OB[A[i]];if(!o)continue;
      o.pos.set(A[i+1],A[i+2],A[i+3]);o.rx=A[i+4];o.ry=A[i+5];o.rz=A[i+6];
      o.g.position.copy(o.pos);o.g.rotation.set(o.rx,o.ry,o.rz);
    }
  }
  updateDebris(raw);
  const gy=gh(car.pos.x,car.pos.z),voidG=gy<-5000;
  const alt=voidG?0:Math.max(0,car.pos.y-gy);
  contact.position.set(car.pos.x,(voidG?car.pos.y:gy)+.04,car.pos.z);
  contact.rotation.set(-car.pitch,car.h,car.roll);
  const rcs=1+Math.min(alt,8)*.07;
  contact.scale.set((PHYS.cw||1)*rcs,1,(PHYS.cl||1)*rcs);
  contact.children[0].material.opacity=clamp(.45-alt*.055,.04,.45);
  contact.visible=!voidG&&alt<7;
  wheels.forEach((w,wi)=>{
    if(w.dp&&w.dp.gone)return;
    if(w.front)w.steer.rotation.y=car.steer;
    w.steer.rotation.z=(wheelDmg[wi]||0)*.3;
    w.spinA-=car.speed/PHYS.wheelR*raw;
    w.spin.rotation.x=w.spinA;
  });
  tailM.emissiveIntensity=lights.night?1.6:.9;discM.emissiveIntensity=0;
  flames.forEach(f=>f.visible=false);
  RP.smokeT-=raw;
  if(crash.eng>.35&&RP.smokeT<=0){
    RP.smokeT=.18-crash.eng*.1;
    const hx=car.pos.x+Math.sin(car.h)*1.25,hz=car.pos.z+Math.cos(car.h)*1.25;
    puff(hx,car.pos.y+.95,hz,1,.85,1.2,crash.eng>.82?0xff7a24:0x6d7078);
  }
  smoke.forEach(p=>{
    if(p.life<=0)return;
    p.life-=raw;
    if(p.life<=0){p.s.visible=false;return}
    p.s.position.addScaledVector(p.vel,raw);
    p.vel.y+=.4*raw;p.vel.multiplyScalar(1-1.2*raw);
    p.s.scale.multiplyScalar(1+1.1*raw);
    p.s.material.opacity=.34*(p.life/p.max);
  });
  speedEl.textContent=Math.round(Math.abs(car.speed)*3.6)+' km/h';
  gearEl.textContent=(car.gear<0?'R':(Math.abs(car.speed)<.4?'N':car.gear))+' · '+Math.round(car.rpm)+' rpm';
  updateDmgHud();
  if(RP.t>=RP.end)endReplay();
}
function replayCamera(dt){
  const spd=Math.abs(car.speed);
  REPCAM.modeT+=dt;
  if(REPCAM.impact>0)REPCAM.impact=Math.max(0,REPCAM.impact-dt);
  if(REPCAM.modeT>4.2){REPCAM.mode=(REPCAM.mode+1+(Math.random()<.45?1:0))%5;REPCAM.modeT=0}
  let ang,dist,hi,lookY=.72;
  if(REPCAM.impact>0){ang=car.h+Math.PI*.62;dist=6.2;hi=1.0;lookY=.6}
  else if(REPCAM.mode===0){ang=car.h+Math.PI;dist=9+Math.min(4,spd*.05);hi=2.3}
  else if(REPCAM.mode===1){ang=car.h+Math.PI*.5;dist=7.4;hi=1.15}
  else if(REPCAM.mode===2){ang=car.h;dist=9.5;hi=1.05;lookY=.95}
  else if(REPCAM.mode===3){ang=car.h+REPCAM.modeT*.55;dist=8.4;hi=2.2+Math.sin(REPCAM.modeT*.9)*1.1}
  else{ang=car.h+Math.PI*.25;dist=16+Math.min(9,spd*.1);hi=8.5;lookY=.35}
  const tall=(PHYS.eyeY||1.05);
  dist*=(1+(tall-1.05)*.35);hi*=(1+(tall-1.05)*.25);lookY*=tall;   // frame the tall truck properly
  const tx=car.pos.x+Math.sin(ang)*dist,tz=car.pos.z+Math.cos(ang)*dist,ty=car.pos.y+hi;
  const ahead=Math.min(6,spd*.12);
  const lx=car.pos.x+Math.sin(car.h)*ahead,lz=car.pos.z+Math.cos(car.h)*ahead,ly=car.pos.y+lookY;
  if(!REPCAM.init){REPCAM.x=tx;REPCAM.y=ty;REPCAM.z=tz;REPCAM.lx=lx;REPCAM.ly=ly;REPCAM.lz=lz;REPCAM.init=true}
  const k=Math.min(1,3.4*dt),kl=Math.min(1,5.2*dt);
  REPCAM.x+=(tx-REPCAM.x)*k;REPCAM.y+=(ty-REPCAM.y)*k;REPCAM.z+=(tz-REPCAM.z)*k;
  REPCAM.lx+=(lx-REPCAM.lx)*kl;REPCAM.ly+=(ly-REPCAM.ly)*kl;REPCAM.lz+=(lz-REPCAM.lz)*kl;
  camera.position.set(REPCAM.x,REPCAM.y,REPCAM.z);
  camera.lookAt(REPCAM.lx,REPCAM.ly,REPCAM.lz);
}
function startReplay(){
  if(RP.on){endReplay();return}
  const S=REC.samples;
  if(S.length<8||S[S.length-1].t-S[0].t<2){statEl.textContent='Replay: drive the car first';return}
  // start a little before the first real driving so the replay opens on the action
  let i0=0;
  for(let i=0;i<S.length;i++){
    if(Math.abs(S[i].sp)>2||S[i].d>.5){i0=Math.max(0,i-30);break}
  }
  while(i0<S.length-2&&S[S.length-1].t-S[i0].t>75)i0++;
  REC.ev.sort((a,b)=>a.t-b.t);REC.obs.sort((a,b)=>a.t-b.t);
  RP.on=true;RP.t=S[i0].t;RP.end=S[S.length-1].t;
  RP.si=i0;RP.ei=0;RP.oi=0;RP.smokeT=0;
  REPCAM.init=false;REPCAM.modeT=99;REPCAM.impact=0;
  REC.on=false;REC.replay=true;
  resetCar();resetObstacles();setCar(true);
  camX=.3;camD=10;
  document.getElementById('bReplay').textContent='■ Stop replay';
  statEl.textContent='Cinematic replay — Replay button stops it';
}
function endReplay(){
  document.getElementById('bReplay').textContent='↺ Replay';
  RP.on=false;REC.replay=false;
  resetCar();resetObstacles();setCar(true);
  camY=car.h+Math.PI;camX=.3;camD=10;
  statEl.textContent='Replay finished — go again!';
}
