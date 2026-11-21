/* CrashNG — vehicles: shared wheels, per-vehicle tuning + procedural bodies, SKINS registry
   Sections: wheels (one set of 4, WHEEL_LAYOUT/setWheels), Chiron (CHIRON_PHYS, chironBits), Volvo FH16 (TRUCK_PHYS,
   truckBody), Ferrari SF15-T (FERRARI_PHYS, f1Body), SKINS (HUD name/paint/slot per vehicle).
   The Lamborghini shell itself lives in cars-lambo.js. Classic script: names are global, load order matters. */

// ======== wheels.js ========
/* CrashNG — shared wheels: one set of 4, repositioned per vehicle
   Owns: wheels[] (tyre/rim/disc/caliper groups), WHEEL_LAYOUT, setWheels(kind).
   Every skin drives the same wheel meshes; only positions/scales change.
   physics.js steers via w.steer and spins via w.spin; damage.js can rip a wheel off (w.dp). */
// wheels: lathe tyre, subtle sidewall branding, 10-spoke rim, drilled disc, fixed caliper
const wheels=[];
const tirePts=[[.232,-.166],[.298,-.168],[.342,-.16],[.366,-.14],[.378,-.112],[.382,-.075],[.382,-.025],[.382,.025],[.382,.075],[.378,.112],[.366,.14],[.342,.16],[.298,.168],[.232,.166]];
const tireGeo=new THREE.LatheGeometry(tirePts.map(p=>new THREE.Vector2(p[0],p[1])),Q.low?20:36);tireGeo.rotateZ(Math.PI/2);
const grooveGeo=new THREE.TorusGeometry(.381,.005,4,Q.low?14:22);
const sideRingGeo=new THREE.RingGeometry(.238,.362,Q.low?20:40);
const barrelGeo=new THREE.CylinderGeometry(.238,.238,.28,24,1,true);
const lipGeo=new THREE.TorusGeometry(.252,.017,6,Q.low?18:30);
const spokeGeo=new THREE.BoxGeometry(.024,.205,.042);
const capGeo=new THREE.CylinderGeometry(.062,.062,.045,12);
const lugGeo=new THREE.CylinderGeometry(.01,.01,.018,6);
const discGeo=new THREE.CylinderGeometry(.255,.255,.03,Q.seg);
const discFaceGeo=new THREE.CircleGeometry(.253,Q.seg);
const caliperGeo=new THREE.BoxGeometry(.07,.17,.12);
[[-1,1.48,true],[1,1.48,true],[-1,-1.52,false],[1,-1.52,false]].forEach(([sx,sz,front])=>{
  const steerG=new THREE.Group();steerG.position.set(sx*.875,.38,sz);
  const spinG=new THREE.Group();steerG.add(spinG);
  spinG.add(cm(tireGeo,tireM));
  for(const gx of [-.11,-.037,.037,.11]){
    const gr=new THREE.Mesh(grooveGeo,grooveM);gr.rotation.y=Math.PI/2;gr.position.x=gx;spinG.add(gr);
  }
  [-1,1].forEach(s=>{
    const sr=new THREE.Mesh(sideRingGeo,tireSideM);
    sr.rotation.y=s*Math.PI/2;sr.position.x=s*.167;spinG.add(sr);
  });
  spinG.add(cm(barrelGeo,darkRim,null,[0,0,Math.PI/2]));
  const spokes=new THREE.InstancedMesh(spokeGeo,rimM,10);
  {const d=new THREE.Object3D();
   for(let i=0;i<5;i++){
     const a=i*Math.PI*2/5;
     [-.10,.10].forEach((o,n)=>{
       const ang=a+o;
       d.position.set(sx*.125,Math.cos(ang)*.115,Math.sin(ang)*.115);
       d.rotation.set(ang,0,0);d.updateMatrix();spokes.setMatrixAt(i*2+n,d.matrix);
     });
   }}
  spokes.castShadow=true;spinG.add(spokes);
  spinG.add(cm(lipGeo,rimM,[sx*.15,0,0],[0,Math.PI/2,0]));
  spinG.add(cm(capGeo,rimM,[sx*.155,0,0],[0,0,Math.PI/2]));
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5;
    const lug=new THREE.Mesh(lugGeo,rimM);
    lug.rotation.z=Math.PI/2;lug.position.set(sx*.175,Math.cos(a)*.08,Math.sin(a)*.08);spinG.add(lug);
  }
  spinG.add(cm(discGeo,discM,[sx*.012,0,0],[0,0,Math.PI/2]));
  const df=new THREE.Mesh(discFaceGeo,discFaceM);
  df.rotation.y=sx*Math.PI/2;df.position.x=sx*.03;spinG.add(df);
  steerG.add(cm(caliperGeo,caliperM,[sx*.065,.175,.01]));
  steerG.add(cm(new THREE.BoxGeometry(.06,.05,.14),caliperM,[sx*.065,.175,.01]));
  carG.add(steerG);wheels.push({steer:steerG,spin:spinG,front,sx,sz,spinA:0});
});
carG.rotation.order='YXZ';
// shared wheel mounts: the truck reuses the same spin/steer groups, moved out and scaled up
const WHEEL_LAYOUT={
  car:{x:.875,y:.38,f:1.48,r:-1.52,s:1},
  truck:{x:1.22,y:.53,f:3.30,r:-1.75,s:1.387},
  ferrari:{x:.80,y:.335,f:1.62,r:-1.72,s:.90,wf:.94,wr:1.24}};
function setWheels(kind){
  const L=WHEEL_LAYOUT[kind]||WHEEL_LAYOUT.car;
  wheels.forEach(w=>{
    w.steer.position.set(w.sx*L.x,L.y,w.front?L.f:L.r);
    w.spin.scale.set(L.s*(w.front?(L.wf||1):(L.wr||1)),L.s,L.s);   // F1 runs wider rears than fronts
    w.steer.rotation.set(0,0,0);w.spin.rotation.x=0;
  });
}

// ======== cars-chiron.js ========
/* CrashNG — Bugatti Chiron Super Sport 300+: tuning + signature trim
   Owns: CHIRON_PHYS (merged over LAMBO_PHYS by applySkin) and chironBits (trim shown only on this skin).
   The shell itself is the shared carBody from cars-lambo.js; this file only adds/overrides styling. */
// Reference: 8.0 L quad-turbo W16, 1600 PS / 1600 Nm, ~1995 kg, 7-speed DCT, AWD, 490 km/h (limited), 0-100 ~2.4 s
const CHIRON_PHYS={mass:1995,izz:3500,a:1.52,b:1.19,enginePeak:1600,idle:900,redline:7100,
  gears:[3.9,2.8,2.1,1.65,1.3,1.0,.70],final:2.95,drag:.4,downforce:.75,muF:1.45,muR:1.62,
  brakeForce:30000,boost:6500,maxSpeed:136,power:1103000};
const chironBits=[];   // Chiron-only trim, shown while the Chiron is the car being driven
{
  const chrome=new THREE.MeshStandardMaterial({color:0xd5dbe3,metalness:1,roughness:.12,envMap:window.ENV,envMapIntensity:.9});
  const red=new THREE.MeshStandardMaterial({color:0xc8102e,roughness:.35,metalness:.3});
  const put=(g,m,p,r)=>{const o=cm(g,m,p,r);o.visible=false;chironBits.push(o);carBody.add(o);return o};     // main.js's applySkin() shows this trim only on the Chiron

  // horseshoe grille (chrome arch + dark mesh + slats) and red badge
  put(new THREE.TorusGeometry(.30,.034,10,36,Math.PI),chrome,[0,.46,2.47],[-.12,0,0]);
  put(new THREE.CircleGeometry(.29,32,0,Math.PI),blk,[0,.46,2.455],[-.12,0,0]);
  for(let i=-3;i<=3;i++)put(new THREE.BoxGeometry(.012,.26-Math.abs(i)*.035,.016),chrome,[i*.075,.56-Math.abs(i)*.018,2.47],[-.12,0,0]);
  put(new THREE.CylinderGeometry(.035,.035,.012,20),red,[0,.80,2.38],[Math.PI/2-.45,0,0]);

  // four-lens headlight clusters either side of the grille
  [-1,1].forEach(sx=>{
    const x0=Math.min(.66,surfX(2.3,.5)-.12);
    [[0,.55],[.075,.55],[0,.48],[.075,.48]].forEach(([dx,y])=>{
      put(new THREE.CylinderGeometry(.028,.028,.02,16),whiteM,[sx*(x0+dx),y,2.31-dx*.4],[Math.PI/2-.12,0,0]);
      put(new THREE.TorusGeometry(.032,.006,6,16),blk,[sx*(x0+dx),y,2.322-dx*.4],[-.12,0,0]);
    });
  });

  // the C-line: chrome arc on each side, open to the rear
  [-1,1].forEach(sx=>{
    const pts=[[-.62,.70],[-.25,.73],[.12,.66],[.30,.54],[.18,.42],[-.20,.36],[-.62,.36]]
      .map(([z,y])=>new THREE.Vector3(sx*(surfX(z,y)+.008),y,z));
    const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.014,6);
    geo.computeBoundingBox();const c=geo.boundingBox.getCenter(new THREE.Vector3());geo.translate(-c.x,-c.y,-c.z);
    const m=new THREE.Mesh(geo,chrome);m.position.copy(c);m.castShadow=true;m.visible=false;chironBits.push(m);carBody.add(m);
  });

  // black carbon centre spine down the hood and engine cover
  put(new THREE.BoxGeometry(.15,.006,.95),carbonM,[0,surfY(1.47,0)+.004,1.47],[.05,0,0]);
  put(new THREE.BoxGeometry(.15,.006,1.18),carbonM,[0,surfY(-1.35,0)+.004,-1.35],[-.05,0,0]);

  // full-width LED tail bar
  put(new THREE.BoxGeometry(1.52,.028,.014),tailM,[0,.755,-2.552]);

}

// ======== cars-truck.js ========
/* CrashNG — Volvo FH16 750: heavy-truck tuning + procedural cab/chassis
   Owns: TRUCK_PHYS (16 t, 12 gears, power-limited drive, big brakes) and truckBody
   (cab, trailer-less tractor, its own mirrors/bumper/exhaust parts). Truck-only gadgets live here.
   applySkin() shows truckBody and hides carBody/f1Body; wheels are re-laid-out by setWheels('truck'). */
// Volvo FH16 750 reference: 16 L I6, 750 hp / 3550 Nm, ~16 t 6x4 tractor, 12-speed, limited to 90 km/h
const TRUCK_PHYS={mass:16000,izz:52000,a:3.30,b:1.75,track:2.45,wheelR:.53,cgY:1.12,g:9.81,
  steerLock:.40,enginePeak:3550,idle:550,redline:2300,
  gears:[11.3,7.8,5.9,4.5,3.45,2.65,2.05,1.6,1.27,1.0,.82,.68],
  final:3.35,eff:.88,drag:6.4,roll:1300,downforce:.02,muF:1.08,muR:1.15,
  brakeForce:160000,boost:0,maxSpeed:25,power:550000,
  driveSplitF:.03,brakeSplitF:.55,hbForce:45000,
  thrUp:2.0,thrDn:4.5,steerIn:2.8,steerOut:5.0,
  shiftUp:1900,downRpm:950,kickdown:1450,shiftTime:.34,
  engBrake:9000,engBrakeK:260,creep:1600,creepSpd:1.6,fill:0,revForce:60000,
  eyeY:2.5,camDist:5,halfW:1.28,halfL:4.1,axleF:3.30,axleR:-1.75,
  cw:1.1,cl:1.5,pitchK:.018,rollK:.022,rollMax:.17,pitchMax:.14,leanRate:8,susK:700,susD:48,
  zoneF:2.6,zoneR:2.6,zoneX:1.1,smokeZ:3.4,
  audioMul:2.35,lpBase:240,contactDmg:true};

// --- Volvo FH16 750: heavy 6x4 tractor, 5.05 m wheelbase, tall cab, big tyres ---
const truckBody=new THREE.Group();truckBody.visible=false;carG.add(truckBody);
const truckChrome=new THREE.MeshStandardMaterial({color:0xc9d0d8,metalness:1,roughness:.16,envMap:ENV,envMapIntensity:.85});
const truckSteel=new THREE.MeshStandardMaterial({color:0x8b939c,metalness:.9,roughness:.34,envMap:ENV,envMapIntensity:.5});
const truckFrame=new THREE.MeshStandardMaterial({color:0x24272c,roughness:.68,metalness:.35});
const truckDark=new THREE.MeshStandardMaterial({color:0x121317,roughness:.62,metalness:.2});
const truckAmber=new THREE.MeshStandardMaterial({color:0x241202,emissive:0xff8a1e,emissiveIntensity:.8,roughness:.4});
const badgeTex=cTex(512,128,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#eef2f7';g.font='bold 78px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('VOLVO',w/2,h/2+4)});
badgeTex.encoding=THREE.sRGBEncoding;
const fhTex=cTex(256,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#e9edf3';g.font='italic bold 34px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('FH16 750',w/2,h/2+2)});
fhTex.encoding=THREE.sRGBEncoding;
const tAdd=(g,m,p,r)=>{const o=cm(g,m,p,r);truckBody.add(o);return o};
const tGrp=()=>{const g=new THREE.Group();truckBody.add(g);return g};
const truckPart=(mesh,name,thresh,zone)=>{detachable(mesh,name,thresh,zone);detachParts[detachParts.length-1].skin='truck';return mesh};

// cab shell, sun visor, roof deflector
tAdd(new THREE.BoxGeometry(2.42,2.45,2.9),paint,[0,2.22,2.44]);
tAdd(new THREE.BoxGeometry(2.32,.14,.52),paint,[0,3.50,3.76],[.12,0,0]);
tAdd(new THREE.BoxGeometry(2.16,.54,1.15),paint,[0,3.60,2.10],[-.10,0,0]);
// windscreen + door glass
tAdd(new THREE.BoxGeometry(2.12,.98,.05),trimM,[0,2.84,3.90]);
tAdd(new THREE.BoxGeometry(1.96,.84,.06),glassM,[0,2.86,3.925],[-.04,0,0]);
[-1,1].forEach(sx=>{
  tAdd(new THREE.BoxGeometry(.04,.66,1.22),glassM,[sx*1.222,2.76,2.82]);
  tAdd(new THREE.BoxGeometry(.05,.025,1.28),trimM,[sx*1.222,3.13,2.82]);
  tAdd(new THREE.BoxGeometry(.03,.92,.012),truckDark,[sx*1.224,2.10,1.30]);
  tAdd(new THREE.BoxGeometry(.05,.09,.22),truckChrome,[sx*1.236,2.30,2.00]);
  tAdd(new THREE.BoxGeometry(.54,.08,.56),truckSteel,[sx*1.08,1.03,2.85]);
  tAdd(new THREE.BoxGeometry(.50,.07,1.10),paint,[sx*1.228,1.05,2.60]);       // lower door skirt
});
// grille, Volvo slash + badge
tAdd(new THREE.BoxGeometry(1.86,.94,.05),truckDark,[0,2.02,3.905]);
tAdd(new THREE.BoxGeometry(1.64,.68,.03),grilleM,[0,2.02,3.93]);
for(let i=-1;i<=1;i++)tAdd(new THREE.BoxGeometry(1.64,.035,.03),truckChrome,[0,2.02+i*.23,3.945]);
tAdd(new THREE.BoxGeometry(1.04,.075,.035),truckChrome,[0,2.04,3.955],[0,0,.52]);
const badgeM=new THREE.MeshBasicMaterial({map:badgeTex,transparent:true});
{
  const b=new THREE.Mesh(new THREE.PlaneGeometry(.90,.22),badgeM);
  b.position.set(0,2.02,3.965);truckBody.add(b);
}
// headlight housings, fog lamps, roof marker lamps (lenses are added by electrics.js)
[-1,1].forEach(sx=>{
  tAdd(new THREE.BoxGeometry(.56,.30,.06),truckDark,[sx*.86,1.34,3.91]);
  tAdd(new THREE.BoxGeometry(.07,.26,.02),truckSteel,[sx*1.10,1.34,3.945]);
  tAdd(new THREE.BoxGeometry(.16,.07,.04),truckAmber,[sx*.78,1.12,3.945]);
  tAdd(new THREE.BoxGeometry(.10,.05,.04),truckAmber,[sx*.62,3.53,3.84]);
  // front fender flare over the big tyre
  tAdd(new THREE.BoxGeometry(.40,.12,1.12),paint,[sx*1.28,1.10,3.30]);
  tAdd(new THREE.BoxGeometry(.06,.34,.94),truckDark,[sx*1.44,.93,3.30]);
});
tAdd(new THREE.BoxGeometry(.10,.05,.04),truckAmber,[0,3.53,3.84]);
// front bumper + step (detachable)
const tBump=tGrp();
tBump.add(cm(new THREE.BoxGeometry(2.50,.36,.32),truckDark,[0,1.06,3.88]));
tBump.add(cm(new THREE.BoxGeometry(2.28,.10,.42),truckDark,[0,.86,3.94]));
tBump.add(cm(new THREE.BoxGeometry(1.10,.07,.36),truckSteel,[0,1.10,4.04]));
[-1,1].forEach(sx=>tBump.add(cm(new THREE.BoxGeometry(.22,.10,.03),truckDark,[sx*.86,.94,4.06])));
truckPart(tBump,'front bumper',32,'front');
// mirrors (detachable)
[-1,1].forEach(sx=>{
  const mg=tGrp();
  mg.add(cm(new THREE.BoxGeometry(.42,.05,.05),truckDark,[sx*1.42,2.92,3.30]));
  mg.add(cm(new THREE.BoxGeometry(.16,.62,.30),paint,[sx*1.62,2.72,3.30]));
  mg.add(cm(new THREE.BoxGeometry(.16,.50,.02),glassM,[sx*1.62,2.72,3.14]));
  mg.add(cm(new THREE.BoxGeometry(.14,.05,.05),truckDark,[sx*1.52,2.56,3.30]));
  truckPart(mg,sx>0?'left mirror':'right mirror',16,sx>0?'left':'right');
});
// chassis rails, cross members, axles and fifth wheel
[-1,1].forEach(sx=>{
  tAdd(new THREE.BoxGeometry(.16,.30,5.70),truckFrame,[sx*.80,.82,-.45]);
  tAdd(new THREE.BoxGeometry(.07,.08,5.40),truckSteel,[sx*.80,.96,-.45]);
  tAdd(new THREE.BoxGeometry(.06,.20,2.30),truckSteel,[sx*1.22,.55,-.55]);   // side underrun bars
});
for(let i=0;i<4;i++)tAdd(new THREE.BoxGeometry(1.62,.12,.12),truckFrame,[0,.80,-2.55+i*1.45]);
tAdd(new THREE.BoxGeometry(1.30,.12,1.10),truckSteel,[0,1.18,-1.20]);
tAdd(new THREE.BoxGeometry(1.16,.10,.55),truckSteel,[0,1.12,-1.82],[.20,0,0]);
tAdd(new THREE.CylinderGeometry(.07,.07,.16,12),truckDark,[0,1.25,-1.08]);
tAdd(new THREE.CylinderGeometry(.16,.16,2.30,12),truckFrame,[0,.53,-1.75],[0,0,Math.PI/2]);
tAdd(new THREE.SphereGeometry(.28,12,10),truckFrame,[0,.53,-1.75]);
tAdd(new THREE.CylinderGeometry(.10,.10,2.20,10),truckFrame,[0,.53,3.30],[0,0,Math.PI/2]);
// fuel tank + battery box + exhaust stack (stack detachable)
const tTank=tGrp();
tTank.add(cm(new THREE.CylinderGeometry(.36,.36,1.80,18),truckChrome,[-1.24,.80,.45],[Math.PI/2,0,0]));
[-.38,.38].forEach(dz=>tTank.add(cm(new THREE.BoxGeometry(.74,.04,.08),truckDark,[-1.24,.80,.45+dz])));
truckPart(tTank,'diesel tank',30,'left');
truckPart(tAdd(new THREE.BoxGeometry(.55,.55,1.00),truckDark,[1.20,.72,.30]),'battery box',26,'right');
const tStack=tGrp();
tStack.add(cm(new THREE.CylinderGeometry(.085,.085,2.50,14),truckChrome,[.98,1.95,.90]));
tStack.add(cm(new THREE.CylinderGeometry(.10,.10,.10,14),truckChrome,[.98,3.23,.90]));
tStack.add(cm(new THREE.BoxGeometry(.24,.06,.24),truckDark,[.98,3.30,.90]));
truckPart(tStack,'exhaust stack',36,'left');
// rear fenders, mudflaps, light bar, rear bumper
[-1,1].forEach(sx=>{
  tAdd(new THREE.BoxGeometry(.64,.12,1.72),paint,[sx*1.22,1.16,-1.75]);
  tAdd(new THREE.BoxGeometry(.58,.62,.04),truckDark,[sx*1.22,.34,-2.68]);
});
tAdd(new THREE.BoxGeometry(2.24,.18,.12),truckDark,[0,.95,-3.36]);
tAdd(new THREE.BoxGeometry(2.36,.14,.30),truckFrame,[0,.72,-3.42]);
tAdd(new THREE.BoxGeometry(1.60,.05,.02),truckSteel,[0,.84,-3.53]);
// FH16 side lettering
const fhM=new THREE.MeshBasicMaterial({map:fhTex,transparent:true});
[-1,1].forEach(sx=>{
  const p=new THREE.Mesh(new THREE.PlaneGeometry(1.0,.25),fhM);
  p.position.set(sx*1.226,2.28,1.74);p.rotation.y=sx*Math.PI/2;truckBody.add(p);
});

// ======== cars-f1.js ========
/* CrashNG — Ferrari SF15-T: F1 tuning + procedural open-wheel body
   Owns: FERRARI_PHYS (750 kg, 15,000 rpm, huge downforce) and f1Body (hull, wings, halo, sidepods).
   Parts register with skin 'ferrari' via f1Part() so other skins never lose them.
   applySkin() shows f1Body, hides the car shells + headlights, and setWheels('ferrari') widens the rears. */
// Reference: 1600 cc turbo V6 + MGU-K/MGU-H ~1000 hp combined, 8-speed semi-auto, 15,000 rpm, ~360 km/h
const FERRARI_PHYS={mass:750,izz:1150,a:1.62,b:1.72,track:1.60,wheelR:.345,cgY:.28,g:9.81,
  steerLock:.34,enginePeak:620,idle:4000,redline:15000,
  gears:[3.2,2.4,1.95,1.65,1.42,1.24,1.08,.94],final:3.45,eff:.93,
  drag:.62,roll:80,downforce:2.75,muF:1.78,muR:1.88,
  brakeForce:44000,boost:9000,maxSpeed:100,power:745000,
  driveSplitF:0,brakeSplitF:.60,hbForce:9000,
  thrUp:14,thrDn:16,steerIn:12,steerOut:14,
  shiftUp:14250,downRpm:6200,kickdown:9500,shiftTime:.055,
  engBrake:1500,engBrakeK:70,creep:0,creepSpd:.5,fill:0,fillTop:5,revForce:3200,
  eyeY:.95,camDist:-.35,halfW:.92,halfL:2.62,axleF:1.62,axleR:-1.72,
  cw:.94,cl:1.02,pitchK:.004,rollK:.005,rollMax:.035,pitchMax:.028,leanRate:19,susK:1500,susD:72,
  zoneF:1.55,zoneR:1.55,zoneX:.78,smokeZ:1.95,
  audioMul:3.7,lpBase:880,contactDmg:true};

const f1Body=new THREE.Group();f1Body.visible=false;carG.add(f1Body);
const f1Part=(mesh,name,thresh,zone)=>{detachable(mesh,name,thresh,zone);detachParts[detachParts.length-1].skin='ferrari';return mesh};
const f1Add=(g,m,p,r)=>{const o=cm(g,m,p,r);f1Body.add(o);return o};
const f1Grp=()=>{const g=new THREE.Group();f1Body.add(g);return g};
const f1White=new THREE.MeshStandardMaterial({color:0xf2f3f4,roughness:.42,metalness:.08});
f1White.envMap=ENV;f1White.envMapIntensity=.4;

const f1Ring=(z,cx,cy,rx,ry,n)=>{
  const p=[];n=n||14;
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;p.push(new THREE.Vector2(cx+Math.cos(a)*rx,cy+Math.sin(a)*ry))}
  return {z,pts:p};
};
// slim monocoque + nose: widest at the cockpit, tapering to the front bulkhead
const f1Hull=loftGeo([
  f1Ring(2.68,0,.30,.050,.034,10),f1Ring(2.42,0,.31,.090,.055,12),
  f1Ring(2.05,0,.33,.150,.090,14),f1Ring(1.65,0,.36,.220,.150,14),
  f1Ring(1.25,0,.39,.290,.210,14),f1Ring(.90,0,.42,.350,.270,14),
  f1Ring(.40,0,.42,.400,.310,14),f1Ring(-.20,0,.40,.390,.330,14),
  f1Ring(-.80,0,.38,.350,.320,14),f1Ring(-1.35,0,.38,.290,.280,14),
  f1Ring(-1.75,0,.40,.200,.200,12),f1Ring(-2.05,0,.42,.120,.120,10)
],{closed:true,capStart:true,capEnd:true});
const f1Shell=new THREE.Mesh(f1Hull,paint);f1Shell.castShadow=true;f1Shell.frustumCulled=false;f1Body.add(f1Shell);
// white livery bands: spine stripe and nose flashes, like the SF15-T
f1Add(new THREE.BoxGeometry(.16,.014,1.55),f1White,[0,.735,-.75],[.02,0,0]);
[-1,1].forEach(sx=>f1Add(new THREE.BoxGeometry(.05,.012,.85),f1White,[sx*.17,.545,1.55],[.12,0,0]));
// sidepods with dark inlets
[-1,1].forEach(sx=>{
  const pod=loftGeo([
    f1Ring(.58,sx*.43,.46,.10,.15,12),f1Ring(.10,sx*.50,.46,.19,.22,12),
    f1Ring(-.55,sx*.52,.46,.22,.24,12),f1Ring(-1.05,sx*.50,.46,.19,.21,12),
    f1Ring(-1.45,sx*.46,.48,.12,.15,12)
  ],{closed:true,capStart:true,capEnd:true});
  const pm=new THREE.Mesh(pod,paint);pm.castShadow=true;f1Body.add(pm);f1Part(pm,sx>0?'F1 left sidepod':'F1 right sidepod',20,sx>0?'left':'right');
  f1Add(new THREE.BoxGeometry(.24,.20,.05),blk,[sx*.40,.47,.60],[0,0,0]);
  f1Add(new THREE.BoxGeometry(.06,.02,.34),f1White,[sx*.64,.55,.20],[0,0,.35]);
  f1Add(new THREE.BoxGeometry(.05,.10,.30),carbonM,[sx*.66,.42,-1.05]);       // bargeboard vane
});
// cockpit opening, driver helmet, halo
f1Add(new THREE.BoxGeometry(.46,.035,.62),blk,[0,.735,.52]);
f1Add(new THREE.BoxGeometry(.34,.05,.20),trimM,[0,.76,.88],[.18,0,0]);
const helmet=f1Add(new THREE.SphereGeometry(.125,16,12),f1White,[0,.88,.40]);
helmet.scale.set(1,.95,1.05);
f1Add(new THREE.BoxGeometry(.19,.05,.09),blk,[0,.875,.49],[.10,0,0]);
f1Add(new THREE.BoxGeometry(.05,.10,.05),paint,[0,.93,.40]);
const f1Halo=f1Grp();
f1Halo.add(cm(new THREE.TorusGeometry(.365,.026,8,26),blk,[0,.90,.56],[Math.PI/2,0,0]));
f1Halo.add(cm(new THREE.BoxGeometry(.055,.20,.055),blk,[0,.80,.26]));
f1Part(f1Halo,'F1 halo',15,'front');
// airbox / roll hoop and engine cover with shark fin
f1Part(f1Add(new THREE.BoxGeometry(.30,.34,.46),paint,[0,.97,-.05]),'F1 airbox',22,'rear');
f1Add(new THREE.BoxGeometry(.20,.16,.03),blk,[0,1.00,.18]);
f1Add(new THREE.BoxGeometry(.06,.30,.05),trimM,[0,1.02,-.28]);
const f1Cover=f1Grp();
f1Cover.add(cm(new THREE.BoxGeometry(.30,.16,1.22),paint,[0,.78,-1.12],[.03,0,0]));
f1Cover.add(cm(new THREE.BoxGeometry(.02,.30,1.05),paint,[0,.94,-1.55]));
f1Cover.add(cm(new THREE.BoxGeometry(.03,.34,.05),f1White,[0,.80,-1.70]));
f1Part(f1Cover,'F1 engine cover',24,'rear');
// front wing: multi-element, endplates, nose pylon
const f1FW=f1Grp();
f1FW.add(cm(new THREE.BoxGeometry(1.72,.022,.44),carbonM,[0,.105,2.40]));
f1FW.add(cm(new THREE.BoxGeometry(1.58,.018,.21),carbonM,[0,.165,2.33],[.14,0,0]));
f1FW.add(cm(new THREE.BoxGeometry(1.40,.014,.16),carbonM,[0,.215,2.26],[.26,0,0]));
[-1,1].forEach(sx=>{
  f1FW.add(cm(new THREE.BoxGeometry(.026,.25,.50),carbonM,[sx*.862,.17,2.38]));
  f1FW.add(cm(new THREE.BoxGeometry(.022,.08,.44),f1White,[sx*.864,.27,2.38]));
  f1FW.add(cm(new THREE.BoxGeometry(.16,.012,.30),carbonM,[sx*.70,.245,2.30],[.18,0,-sx*.10]));
});
f1FW.add(cm(new THREE.BoxGeometry(.10,.12,.34),carbonM,[0,.21,2.56]));
f1Part(f1FW,'F1 front wing',19,'front');
// rear wing with DRS flap + pylon
const f1RW=f1Grp();
f1RW.add(cm(new THREE.BoxGeometry(1.02,.035,.36),carbonM,[0,1.04,-2.26],[.06,0,0]));
f1RW.add(cm(new THREE.BoxGeometry(1.00,.028,.20),carbonM,[0,1.14,-2.34],[.20,0,0]));
[-1,1].forEach(sx=>{
  f1RW.add(cm(new THREE.BoxGeometry(.026,.34,.50),carbonM,[sx*.512,1.10,-2.30]));
  f1RW.add(cm(new THREE.BoxGeometry(.02,.14,.40),f1White,[sx*.514,1.06,-2.30]));
});
f1RW.add(cm(new THREE.BoxGeometry(.06,.44,.12),carbonM,[0,.83,-2.27]));
f1Part(f1RW,'F1 rear wing',25,'rear');
// mirrors on thin stalks
[-1,1].forEach(sx=>{
  const mg=f1Grp();
  mg.add(cm(new THREE.BoxGeometry(.17,.018,.03),carbonM,[sx*.46,.775,.40]));
  mg.add(cm(new THREE.BoxGeometry(.09,.048,.028),blk,[sx*.555,.785,.40]));
  f1Part(mg,sx>0?'F1 left mirror':'F1 right mirror',8,sx>0?'left':'right');
});
// exposed pushrod suspension (thin carbon arms) + floor, diffuser, rain light
[[1,1.62],[-1,1.62],[1,-1.72],[-1,-1.72]].forEach(([sx,z])=>{
  f1Add(new THREE.BoxGeometry(.64,.026,.045),carbonM,[sx*.55,.37,z],[0,0,sx*.10]);
  f1Add(new THREE.BoxGeometry(.62,.024,.04),carbonM,[sx*.55,.47,z],[0,0,-sx*.12]);
  f1Add(new THREE.BoxGeometry(.045,.18,.04),carbonM,[sx*.73,.42,z],[0,0,sx*.06]);
});
f1Add(new THREE.BoxGeometry(1.56,.032,3.20),carbonM,[0,.115,-.25]);
const f1Dif=f1Grp();
f1Dif.add(cm(new THREE.BoxGeometry(1.34,.03,.54),carbonM,[0,.20,-2.20],[.30,0,0]));
[-.48,-.16,.16,.48].forEach(x=>f1Dif.add(cm(new THREE.BoxGeometry(.028,.20,.46),carbonM,[x,.20,-2.20],[.30,0,0])));
f1Part(f1Dif,'F1 diffuser',17,'rear');
f1Add(new THREE.BoxGeometry(.11,.055,.02),tailM,[0,.60,-2.13]);
// sidepod lettering
{
  const f1Tex=cTex(512,96,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#f3f4f6';g.font='bold italic 52px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('FERRARI',w/2,h/2+2)});
  f1Tex.encoding=THREE.sRGBEncoding;
  const m=new THREE.MeshBasicMaterial({map:f1Tex,transparent:true});
  [-1,1].forEach(sx=>{
    const p=new THREE.Mesh(new THREE.PlaneGeometry(.72,.135),m);
    p.position.set(sx*.665,.50,-.42);p.rotation.y=sx*Math.PI/2;f1Body.add(p);
  });
}

// ======== skins.js ========
/* CrashNG — drivable-vehicle registry (add a vehicle = add one entry here)
   Each key must match a *_PHYS constant and a body group handled in main.js applySkin().
   Fields: HTML name shown in the HUD, paint colour/metalness/roughness, brake caliper colour,
   bits = show the Chiron trim, slotX = where the parked copy waits on the runway. */
const SKINS={
  lambo:{name:'Lamborghini <i>Revuelto SV</i>',paint:{color:0xef7a00,metalness:.22,roughness:.34},caliper:0xe23a00,bits:false,slotX:-4.8},
  chiron:{name:'Bugatti <i>Chiron Super Sport 300+</i>',paint:{color:0x0a2d8a,metalness:.45,roughness:.26},caliper:0x1d5cff,bits:true,slotX:1.6},
  truck:{name:'Volvo <i>FH16 750</i>',paint:{color:0xb5121b,metalness:.35,roughness:.3},caliper:0x24262b,bits:false,slotX:-1.6},
  ferrari:{name:'Ferrari <i>SF15-T</i>',paint:{color:0xd40000,metalness:.28,roughness:.24},caliper:0x1a1a1e,bits:false,slotX:4.8}};

// --- neon underglow: a soft additive pool under the car, fades in at dusk/night (see setTime in electrics.js) ---
const underglow=(()=>{
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,6,64,64,62);g.addColorStop(0,'rgba(40,220,255,.95)');g.addColorStop(.5,'rgba(190,60,255,.45)');g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(2.9,5.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
  m.rotation.x=-Math.PI/2;m.position.y=.07;carG.add(m);return m;
})();
