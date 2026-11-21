/* CrashNG — electrics + audio: procedural WebAudio (engine, horn, skid, thud/clank), head/tail lamps, signals, hazards, night mode
   Owns: AUD, audioInit/Update/Thud/Clank, hornBtn, lights state, beams, setNight(), cycleLights(), updateAuto(), the L/K/Z/C/X/N/M keys. */

// ======== audio.js ========
/* CrashNG — audio: procedural WebAudio engine, horn, skid, impact thud, metal clank
   Owns: AUD graph, audioInit(), audioUpdate(), audioThud(), audioClank(), hornBtn. No audio assets;
   everything is synthesised. Truck gets a deeper engine + air-brake hiss; RPM drives pitch.
   Classic scripts: every top-level name here is global; keep load order in index.html. */

// procedural audio (no assets): engine, horn, tyre squeal, crash thuds
const AUD={ctx:null,ready:false,muted:false};
function audioInit(){
  if(AUD.ready)return AUD.ctx;
  AUD.ready=true;
  try{
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
    const ctx=new C();AUD.ctx=ctx;
    const master=ctx.createGain();master.gain.value=AUD.muted?0:.55;master.connect(ctx.destination);AUD.master=master;
    const eg=ctx.createGain();eg.gain.value=0;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=850;
    eg.connect(lp);lp.connect(master);
    const o1=ctx.createOscillator();o1.type='sawtooth';o1.frequency.value=70;
    const o2=ctx.createOscillator();o2.type='square';o2.frequency.value=140;
    const g2=ctx.createGain();g2.gain.value=.32;
    o1.connect(eg);o2.connect(g2);g2.connect(eg);o1.start();o2.start();
    AUD.eng=eg;AUD.lp=lp;AUD.o1=o1;AUD.o2=o2;
    const hg=ctx.createGain();hg.gain.value=0;const hf=ctx.createBiquadFilter();hf.type='lowpass';hf.frequency.value=2400;
    hf.connect(hg);hg.connect(master);
    const h1=ctx.createOscillator(),h2=ctx.createOscillator();h1.type='sawtooth';h2.type='sawtooth';
    const lo=skin==='truck';
    h1.frequency.value=lo?233:392;h2.frequency.value=lo?311:494;
    const h2g=ctx.createGain();h2g.gain.value=.6;
    h1.connect(hf);h2.connect(h2g);h2g.connect(hf);h1.start();h2.start();
    AUD.horn=hg;AUD.h1=h1;AUD.h2=h2;
    const nb=ctx.createBuffer(1,Math.floor(ctx.sampleRate*1.2),ctx.sampleRate),nd=nb.getChannelData(0);
    for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
    const ns=ctx.createBufferSource();ns.buffer=nb;ns.loop=true;
    const nf=ctx.createBiquadFilter();nf.type='bandpass';nf.frequency.value=1550;nf.Q.value=1.1;
    const sg=ctx.createGain();sg.gain.value=0;
    ns.connect(nf);nf.connect(sg);sg.connect(master);ns.start();
    AUD.skid=sg;AUD.noise=nb;
    const ab=ctx.createBufferSource();ab.buffer=nb;ab.loop=true;
    const af=ctx.createBiquadFilter();af.type='highpass';af.frequency.value=2400;
    const ag=ctx.createGain();ag.gain.value=0;
    ab.connect(af);af.connect(ag);ag.connect(master);ab.start();
    AUD.air=ag;
  }catch(e){AUD.ctx=null}
  return AUD.ctx;
}
function audioUpdate(){
  const ctx=AUD.ctx;if(!ctx)return;
  const live=inCar&&!RP.on&&!PARTS['engine'].gone;
  const t=ctx.currentTime;
  const truck=skin==='truck';
  const f=clamp(car.rpm/60*(PHYS.audioMul||3.1),24,640);
  AUD.o1.frequency.setTargetAtTime(f,t,.03);
  AUD.o2.frequency.setTargetAtTime(f*2.01,t,.03);
  AUD.lp.frequency.setTargetAtTime((PHYS.lpBase||420)+car.throttle*2100+Math.abs(car.speed)*16,t,.06);
  AUD.eng.gain.setTargetAtTime(live?((truck?.075:.045)+car.throttle*(truck?.06:.1))*(.55+.45*clamp(car.rpm/PHYS.redline,0,1)):0,t,.08);
  const drift=live&&Math.abs(car.speed)>3&&(Math.abs(car.vLat)>4||car.wheelSlip>.1);
  AUD.skid.gain.setTargetAtTime(drift?.045:0,t,.05);
  AUD.horn.gain.setTargetAtTime(live&&(keys.KeyH||hornBtn)?.05:0,t,.02);
  if(AUD.air)AUD.air.gain.setTargetAtTime(live&&truck&&(car.brake>.55||keys.Space)&&Math.abs(car.speed)>1?.022:0,t,.05);
}
let hornBtn=false;   // set by the HUD Horn button (see main.js); read by the horn gain above
function audioThud(s){
  const ctx=AUD.ctx;if(!ctx)return;
  try{
    const src=ctx.createBufferSource();src.buffer=AUD.noise;
    const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=170+Math.random()*170;
    const g=ctx.createGain(),t=ctx.currentTime,a=clamp(s/40,.08,.55);
    g.gain.setValueAtTime(a,t);g.gain.exponentialRampToValueAtTime(.0008,t+.35+Math.random()*.3);
    src.connect(f);f.connect(g);g.connect(AUD.master);src.start(t);src.stop(t+1);
  }catch(e){}
}
function audioClank(s){   // ringing sheet metal on top of the thud: narrow noise band + short metallic tone
  const ctx=AUD.ctx;if(!ctx)return;
  try{
    const t=ctx.currentTime,a=clamp(s/40,.06,.42);
    const src=ctx.createBufferSource();src.buffer=AUD.noise;
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1200+Math.random()*1800;bp.Q.value=7+Math.random()*9;
    const g=ctx.createGain();g.gain.setValueAtTime(a*.55,t);g.gain.exponentialRampToValueAtTime(.0006,t+.22+Math.random()*.35);
    src.connect(bp);bp.connect(g);g.connect(AUD.master);src.start(t);src.stop(t+.8);
    const osc=ctx.createOscillator();osc.type='triangle';osc.frequency.value=300+Math.random()*320;
    const og=ctx.createGain();og.gain.setValueAtTime(a*.2,t);og.gain.exponentialRampToValueAtTime(.0005,t+.16);
    osc.connect(og);og.connect(AUD.master);osc.start(t);osc.stop(t+.26);
  }catch(e){}
}

// ======== electrics.js ========
/* CrashNG — electrics: head/tail lamps, signals, hazards, night mode
   Owns: lights state, beam SpotLights + emissive lenses, truck lamps, stars, setNight(),
   cycleLights()/flashBeam()/toggleSignal(), updateAuto() (per-frame lamp logic + aux HUD),
   and the L/K/Z/C/X/N/M keys.
   Classic scripts: every top-level name here is global; keep load order in index.html. */

const lights={mode:0,flash:0,haz:false,sig:0,blink:0,night:false,time:0};   // time: 0 day, 1 sunset, 2 night
const sigL=new THREE.MeshStandardMaterial({color:0x2a1704,emissive:0xff8a1e,emissiveIntensity:.12,roughness:.4});
const sigR=sigL.clone();
[[-1,sigL],[1,sigR]].forEach(([sx,mat])=>{
  carBody.add(cm(new THREE.BoxGeometry(.13,.035,.022),mat,[sx*.80,.525,2.43],[.10,0,0]));
  carBody.add(cm(new THREE.BoxGeometry(.11,.032,.016),mat,[sx*.78,.655,-2.548]));
});
const revM=new THREE.MeshStandardMaterial({color:0xe8eef5,emissive:0xdce8ff,emissiveIntensity:.06,roughness:.4});
[-.40,.40].forEach(x=>carBody.add(cm(new THREE.BoxGeometry(.14,.03,.012),revM,[x,.585,-2.552])));
// truck lamps: same materials, so all the existing light/signal/hazard logic drives them
const truckLensM=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xfff2da,emissiveIntensity:.9,roughness:.22});
[-1,1].forEach(sx=>{
  truckBody.add(cm(new THREE.BoxGeometry(.50,.26,.03),truckLensM,[sx*.86,1.34,3.945]));
  truckBody.add(cm(new THREE.BoxGeometry(.13,.06,.03),sx>0?sigL:sigR,[sx*.86,1.16,3.955]));
  truckBody.add(cm(new THREE.BoxGeometry(.15,.05,.03),revM,[sx*.86,1.00,-3.44]));
  truckBody.add(cm(new THREE.BoxGeometry(.40,.10,.03),tailM,[sx*.86,.95,-3.44]));
});
truckBody.add(cm(new THREE.BoxGeometry(.34,.05,.03),revM,[0,.78,-3.46]));
// two spotlights that actually light the road, plus bright lenses and soft beam cones at night
const beams=[];
[-1,1].forEach(sx=>{
  const sp=new THREE.SpotLight(0xfff2da,0,110,.44,.55,1.2);
  sp.position.set(sx*.48,.53,2.34);
  sp.target.position.set(sx*.85,.10,30);
  carG.add(sp);carG.add(sp.target);beams.push(sp);
});
const hlLens=[];
['left headlight','right headlight'].forEach(n=>{
  const d=PARTS[n];if(!d)return;
  const mat=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:.9,roughness:.24});
  d.mesh.traverse(o=>{if(o.isMesh&&(o.material===whiteM||o.material===drl))o.material=mat});
  hlLens.push(mat);
});
hlLens.push(truckLensM);
const beamCones=[-1,1].map(sx=>{
  const c=new THREE.Mesh(new THREE.ConeGeometry(2.9,17,18,1,true),
    new THREE.MeshBasicMaterial({color:0xffedc4,transparent:true,opacity:.045,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
  c.rotation.x=-Math.PI/2;c.position.set(sx*.48,.52,2.34+8.5);c.visible=false;c.userData.beamCone=true;carBody.add(c);return c;
});
[-1,1].forEach(sx=>{
  const c=new THREE.Mesh(new THREE.ConeGeometry(3.4,21,18,1,true),
    new THREE.MeshBasicMaterial({color:0xffedc4,transparent:true,opacity:.045,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
  c.rotation.x=-Math.PI/2;c.position.set(sx*.78,1.34,3.86+10.5);c.visible=false;c.userData.beamCone=true;truckBody.add(c);beamCones.push(c);
});
// night sky: hide the blue dome, drop the light levels and show stars
const stars=(()=>{
  const n=650,p=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,u=Math.random(),s=Math.sqrt(1-u*u),r=900;
    p[i*3]=Math.cos(a)*s*r;p[i*3+1]=u*r*.9+40;p[i*3+2]=Math.sin(a)*s*r;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const m=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:1.7,sizeAttenuation:false,transparent:true,opacity:.9,depthWrite:false,fog:false}));
  m.frustumCulled=false;m.visible=false;scene.add(m);return m;
})();
function setTime(m){
  lights.time=m;const night=m===2,dusk=m===1;lights.night=night;
  if(night&&lights.mode===0)lights.mode=1;     // auto headlights
  sun.intensity=night?.12:dusk?.9:1.35;sun.color.set(dusk?0xff9a55:0xfff2dc);
  hemi.intensity=night?.22:dusk?.42:.55;hemi.color.set(dusk?0xffd2a8:0xdfeeff);
  scene.background.set(night?0x050a12:dusk?0xf0a070:0x9cc9f2);
  scene.fog.color.set(night?0x091322:dusk?0xf3b58c:0xcfe4f7);
  const U=skyDome.material.uniforms;
  U.cHor.value.set(dusk?0xffa763:0xe6f2ff);U.cTop.value.set(dusk?0x3a3f8f:0x1766e0);
  SUNOFF.set(dusk?90:50,dusk?26:80,40);U.sunDir.value.copy(SUNOFF).normalize();
  skyDome.visible=!night;stars.visible=night;
  scene.traverse(o=>{if(o.userData&&o.userData.cloud)o.visible=!night});
  underglow.material.opacity=night?.6:dusk?.25:0;
  renderer.toneMappingExposure=night?.86:dusk?.95:.92;
  statEl.textContent=['Daytime','Sunset','Night — headlights on'][m]+' · N to change';
}
function setNight(v){setTime(v?2:0)}

function cycleLights(){
  lights.mode=(lights.mode+1)%3;
  statEl.textContent=['Lights off','Low beam','High beam'][lights.mode];
}
function flashBeam(){lights.flash=.5}
function toggleSignal(s){lights.sig=lights.sig===s?0:s;lights.blink=0}
const auxDir=document.getElementById('auxDir'),auxBeam=document.getElementById('auxBeam'),
  auxAbs=document.getElementById('auxAbs'),auxTc=document.getElementById('auxTc'),auxHb=document.getElementById('auxHb');
function updateAuto(dt){
  if(lights.flash>0)lights.flash-=dt;
  const night=lights.night,on=lights.mode>0,high=lights.mode===2||lights.flash>0;
  const inten=on?(high?(night?5.5:4.0):(night?3.0:2.0)):0;
  beams.forEach(b=>{b.intensity=inten;b.angle=high?.52:.40;b.distance=high?150:105});
  beamCones.forEach(c=>{c.visible=night&&on;c.material.opacity=high?.10:.055});
  const lens=on?(high?4.6:3.1):1;
  hlLens.forEach(m=>m.emissiveIntensity=lens);
  lights.blink+=dt;
  const phase=(lights.haz||lights.sig)?((lights.blink%.72)<.36):false;
  const L=(lights.haz||lights.sig<0)&&phase,R=(lights.haz||lights.sig>0)&&phase;
  sigL.emissiveIntensity=L?2.6:.12;sigR.emissiveIntensity=R?2.6:.12;
  revM.emissiveIntensity=inCar&&car.gear<0?1.6:.06;
  auxBeam.textContent=lights.flash>0?'flash':on?(high?'high beam':'low beam'):'lights off';
  auxBeam.classList.toggle('on',on||lights.flash>0);
  auxDir.textContent=lights.haz?'◀ ▶':lights.sig<0?'◀':lights.sig>0?'▶':'';
  auxDir.classList.toggle('on',phase);
  auxAbs.classList.toggle('on',car.abs>.5);
  auxTc.classList.toggle('on',car.tc>.5);
  auxHb.classList.toggle('on',!!inCar&&!RP.on&&keys.Space);
}
addEventListener('keydown',e=>{
  audioInit();
  if(e.repeat)return;
  if(e.code==='KeyL')cycleLights();
  else if(e.code==='KeyK')flashBeam();
  else if(e.code==='KeyZ')toggleSignal(-1);
  else if(e.code==='KeyC')toggleSignal(1);
  else if(e.code==='KeyX'){lights.haz=!lights.haz;lights.blink=0;statEl.textContent=lights.haz?'Hazards on':'Hazards off'}
  else if(e.code==='KeyN')setTime((lights.time+1)%3);
  else if(e.code==='KeyM'){AUD.muted=!AUD.muted;if(AUD.master)AUD.master.gain.value=AUD.muted?0:.55;statEl.textContent=AUD.muted?'Audio muted':'Audio on'}
});
