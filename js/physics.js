/* CrashNG — physics: longitudinal/lateral tire model and vehicle integration
   Owns: updateCar(dt) — gearbox, drive/brake force, friction circle, weight transfer,
   suspension, chassis pose, wheel visuals, barrier + corner impacts, lights/smoke hooks.
   Calls collideParked() (obstacles.js) and impactAt() (damage.js). Once per frame from main.js.
   Classic scripts: every top-level name here is global; keep load order in index.html. */

function updateCar(dt){
  if(dt<=0)return;
  car.t+=dt;
  let lwF=0,lwR=0,lwSide=0;   // torn-off wheels: those corners have no grip, no drive and drag on the rim
  wheels.forEach(w=>{if(w.dp&&w.dp.gone){if(w.front)lwF++;else lwR++;lwSide+=w.sx>0?1:-1}});
  const lwN=lwF+lwR,engOut=PARTS['engine'].gone||PARTS['gearbox'].gone,limp=PARTS['radiator'].gone;
  if(car.pos.y<-80){resetCar();statEl.textContent='Car fell into the void: respawned'}
  const kd=k=>inCar&&(keys[k]);
  const up=kd('KeyW')||kd('ArrowUp'),dn=kd('KeyS')||kd('ArrowDown');
  const st=((kd('KeyA')||kd('ArrowLeft'))?1:0)-((kd('KeyD')||kd('ArrowRight'))?1:0);
  const spaceB=inCar&&keys.Space;                      // handbrake: locks the rear axle, kills rear grip
  const boost=inCar&&(keys.ShiftLeft||keys.ShiftRight||boostBtn);
  car.throttle+=((up?1:0)-car.throttle)*Math.min(1,(up?PHYS.thrUp:PHYS.thrDn)*dt);
  car.brake+=((dn?1:0)-car.brake)*Math.min(1,PHYS.thrDn*dt);
  if(!inCar){car.throttle=0;car.brake=0}

  // automatic gearbox / reverse
  if(inCar&&car.gear>0&&car.speed<.6&&car.brake>.55&&car.throttle<.15&&dn&&!spaceB){
    car.reverseT+=dt;if(car.reverseT>.4){car.gear=-1;car.shiftT=.25}
  }else if(car.gear<0&&(car.throttle>.35||!inCar)){car.gear=1;car.reverseT=0;car.shiftT=.2}
  else if(!inCar)car.gear=1;
  if(inCar&&car.gear>0&&car.shiftT<=0&&car.throttle>.2){
    if(car.rpm>PHYS.shiftUp&&car.gear<PHYS.gears.length){car.gear++;car.shiftT=PHYS.shiftTime}
    else if((car.rpm<PHYS.downRpm||(car.throttle>.9&&car.rpm<PHYS.kickdown))&&car.gear>1){car.gear--;car.shiftT=PHYS.shiftTime*.85}
  }
  if(car.cut>0)car.cut-=dt;

  // steering: less lock the faster you go, like a real rack — and less again once the front is bent
  const spd=Math.abs(car.speed);
  const lock=PHYS.steerLock/(1+spd*.045)*(1-crash.dmg*.0045)*(1-.4*lwF);
  car.steer+=(st*lock-car.steer)*Math.min(1,(st?PHYS.steerIn:PHYS.steerOut)*dt);
  const svcBrake=car.gear<0?(spaceB?car.brake:0):car.brake;   // reverse uses S as throttle, Space as brake
  const hb=spaceB&&car.gear>0?1:0;                             // handbrake locks the rear axle

  const sinH=Math.sin(car.h),cosH=Math.cos(car.h);
  const hw=PHYS.track/2,fa=PHYS.axleF||1.48,ra=PHYS.axleR||-1.52,WB=fa-ra;
  const wp=[[-hw,fa],[hw,fa],[-hw,ra],[hw,ra]].map(([x,z])=>({x:car.pos.x+x*cosH+z*sinH,z:car.pos.z-x*sinH+z*cosH}));
  const gs=wp.map(p=>gh(p.x,p.z)),gc=gh(car.pos.x,car.pos.z);
  const ok=gs.map(g=>g>-5000);
  const gFL=ok[0]?gs[0]:gc,gFR=ok[1]?gs[1]:gc,gRL=ok[2]?gs[2]:gc,gRR=ok[3]?gs[3]:gc;
  const gAvg=(gFL+gFR+gRL+gRR)/4,frontG=(gFL+gFR)/2,rearG=(gRL+gRR)/2;
  const plusX=(gFR+gRR)/2,minusX=(gFL+gRL)/2;
  const pitchT=clamp(Math.atan2(frontG-rearG,WB),-.75,.75);
  const rollT=clamp(Math.atan2(plusX-minusX,PHYS.track),-.35,.35);
  const centerVoid=gc<-5000;

  // --- vertical: real gravity + spring/damper ground contact (the car is never snapped down) ---
  if(!centerVoid){
    if(car.gyOk===1){
      const raw=clamp((gAvg-car.gy)/dt,-45,45);
      car.gv+=(raw-car.gv)*Math.min(1,22*dt);
    }else car.gv=0;
    car.gy=gAvg;car.gyOk=1;
  }else{car.gyOk=0;car.gv=0}
  const SUB=Math.max(1,Math.ceil(dt/(1/120))),sdt=dt/SUB;

  if(car.air){
    car.airT+=dt;
    const yPrev=car.pos.y;
    car.vy-=PHYS.g*dt;
    car.pos.y+=car.vy*dt;
    if(!centerVoid&&car.vy<=0&&yPrev>=gAvg&&car.pos.y<=gAvg){
      const impact=Math.max(0,car.gv-car.vy);
      if(car.airT>.35)statEl.textContent='Last jump: '+Math.round(Math.hypot(car.pos.x-car.from.x,car.pos.z-car.from.z))+' m · '+car.airT.toFixed(1)+' s in the air';
      car.pos.y=gAvg;car.vy=car.gv;car.air=false;car.airT=0;
      if(impact>1.2){
        car.bh-=Math.min(.16,impact*.011);
        car.bhv-=Math.min(2.8,impact*.19);
        car.bp+=Math.min(.05,impact*.003);
        car.br+=(Math.random()-.5)*Math.min(.05,impact*.0022);
        car.vel.multiplyScalar(1-Math.min(.18,impact*.006));
        puff(car.pos.x,car.pos.y,car.pos.z,4+Math.min(10,impact|0),1.05,2.2);
        if(impact>3)impactAt(car.pos.x,car.pos.y+.2,car.pos.z,0,1,0,impact*.55,420);
      }
    }
  }else{
    // suspension: stiff spring + damper against the ground, integrated at <=1/120 s so it stays stable at low fps
    for(let i=0;i<SUB;i++){
      const gap=car.pos.y-gAvg;
      if(gap>.5||centerVoid)break;
      const relV=car.vy-car.gv;
      car.vy+=(-PHYS.susK*gap-PHYS.susD*relV)*sdt;
      car.pos.y+=car.vy*sdt;
      if(car.pos.y<gAvg-.055){car.pos.y=gAvg-.055;if(car.vy<car.gv)car.vy=car.gv}   // bump stop
    }
    if(centerVoid||car.pos.y-gAvg>.5){car.air=true;car.airT=0;car.from.copy(car.pos)}
  }

  // --- longitudinal & lateral tire model ---
  const W=PHYS.mass*PHYS.g;
  let vx=car.vel.x,vz=car.vel.z;
  let vLong=vx*sinH+vz*cosH,vLat=vx*cosH-vz*sinH;
  if(!car.air){
    const ratio=car.gear>0?PHYS.gears[car.gear-1]*PHYS.final:9;
    car.rpm=clamp(Math.abs(vLong)/(2*Math.PI*PHYS.wheelR)*60*ratio,PHYS.idle,PHYS.redline+300);
    if(car.shiftT>0)car.shiftT-=dt;
    let drive=0;
    const reverseThrottle=(car.gear<0&&dn&&!spaceB)?car.brake:0;
    if(car.gear>0){
      if(car.shiftT<=0)drive=car.throttle*torqueAt(car.rpm)*ratio*PHYS.eff/PHYS.wheelR;
      drive+=car.throttle*(PHYS.fill||0)*clamp(1-Math.abs(vLong)/(PHYS.fillTop||45),0,1);   // e-motor torque fill off the line
      if(boost&&car.throttle>.5)drive+=PHYS.boost*clamp(1-Math.abs(vLong)/80,0,1);
      if(car.throttle<.08&&car.brake<.08&&Math.abs(vLong)<PHYS.creepSpd&&car.shiftT<=0)drive+=PHYS.creep*clamp(1-Math.abs(vLong)/PHYS.creepSpd,0,1); // creep
      if(car.rpm>PHYS.redline-40&&car.gear===PHYS.gears.length)car.cut=Math.max(car.cut,.08);   // limiter
    }else{
      car.rpm=clamp(PHYS.idle+Math.abs(vLong)*130,PHYS.idle,5000);
      if(vLong>-14)drive=-reverseThrottle*(PHYS.revForce||5200);
    }
    if(car.cut>0)drive*=.12;
    if(drive>0)drive=Math.min(drive,PHYS.power/Math.max(Math.abs(vLong),4));   // engines are power-limited, not force-limited
    if(car.gear>0&&car.throttle<.06&&Math.abs(vLong)>.4)drive-=Math.sign(vLong)*Math.min(PHYS.engBrake,Math.abs(vLong)*PHYS.engBrakeK); // engine braking
    drive*=1-crash.eng*.72;   // damaged engine makes less power
    if(engOut){drive=0;car.rpm=0}else{if(limp)drive*=.55;drive*=1-.2*lwN}   // no engine/gearbox = dead; no radiator = limp mode

    let FzF=W*PHYS.b/(PHYS.a+PHYS.b)-PHYS.mass*car.ax*PHYS.cgY/(PHYS.a+PHYS.b);
    let FzR=W-FzF;
    const df=PHYS.downforce*(vLong*vLong+vLat*vLat);
    FzF+=df*.45;FzR+=df*.55;
    FzF=Math.max(FzF,W*.12);FzR=Math.max(FzR,W*.15);

    const den=Math.max(Math.abs(vLong),3);
    const sgn=vLong<0?-1:1;
    const alphaF=clamp(Math.atan2(vLat+car.yawRate*PHYS.a,den)-car.steer*sgn,-1.4,1.4);
    const alphaR=clamp(Math.atan2(vLat-car.yawRate*PHYS.b,den),-1.4,1.4);
    const latScale=clamp(Math.abs(vLong)/5,0,1);
    const gripMul=1-crash.dmg*.0025;   // a bent shell loses grip
    const gripF=lwF?(lwF>1?.1:.5):1,gripR=lwR?(lwR>1?.1:.5):1;
    const latF=tireCurve(alphaF,FzF,PHYS.muF*gripMul*gripF)*Math.cos(car.steer)*latScale;
    const latR=tireCurve(alphaR,FzR,PHYS.muR*gripMul*gripR)*latScale*(1-.5*hb);

    const capF=PHYS.muF*FzF*gripMul*gripF,capR=PHYS.muR*FzR*gripMul*gripR;
    const dirNow=vLong>.25?1:vLong<-.25?-1:0;
    const bf=svcBrake*PHYS.brakeForce,hbf=hb*PHYS.hbForce;
    const fxCapF=Math.sqrt(Math.max(0,capF*capF-latF*latF));
    const fxCapR=Math.sqrt(Math.max(0,capR*capR-latR*latR));
    // drive/brake split per axle (AWD cars, rear-drive truck), each limited by its own friction circle
    const dsF=PHYS.driveSplitF,bsF=PHYS.brakeSplitF;
    let fxF=drive*dsF-dirNow*bf*bsF;
    let fxR=drive*(1-dsF)-dirNow*(bf*(1-bsF)+hbf);
    const rawFxF=fxF,rawFxR=fxR;
    car.wheelSlip=(drive>0&&car.throttle>.5)?Math.max(0,Math.abs(fxR)-fxCapR)/Math.max(250,fxCapR):0;
    if(Math.abs(fxF)>fxCapF)fxF=Math.sign(fxF)*fxCapF;
    if(Math.abs(fxR)>fxCapR)fxR=Math.sign(fxR)*fxCapR;
    const tcOn=drive>0&&(Math.abs(rawFxR)>fxCapR*.99||car.wheelSlip>.55);   // traction control is trimming torque
    const absOn=svcBrake>.35&&(Math.abs(rawFxF)>fxCapF*.97||Math.abs(rawFxR)>fxCapR*.97);   // ABS is releasing pressure
    car.tc+=( (tcOn?1:0)-car.tc)*Math.min(1,12*dt);
    car.abs+=((absOn?1:0)-car.abs)*Math.min(1,16*dt);

    const slopeG=-PHYS.mass*PHYS.g*Math.sin(pitchT);
    const FxBody=fxF+fxR-(PHYS.roll+lwN*2600)*Math.tanh(vLong*3)+slopeG;
    const FyBody=latF+latR;
    const spNow=Math.hypot(vx,vz);
    const axx=(sinH*FxBody+cosH*FyBody-PHYS.drag*spNow*vx)/PHYS.mass;
    const azz=(cosH*FxBody-sinH*FyBody-PHYS.drag*spNow*vz)/PHYS.mass;
    vx+=axx*dt;vz+=azz*dt;
    car.yawRate+=(PHYS.a*latF-PHYS.b*latR)/PHYS.izz*dt;
    car.yawRate*=Math.exp(-.9*dt);
    if(lwN)car.yawRate+=lwSide*clamp(Math.abs(vLong)/22,0,1)*1.1*dt;   // dragging a bare rim pulls the car to that side
    car.ax+=(FxBody/PHYS.mass-car.ax)*Math.min(1,10*dt);
    car.ay+=(FyBody/PHYS.mass-car.ay)*Math.min(1,10*dt);
  }else{
    car.wheelSlip=0;car.tc=0;car.abs=0;
    const spNow=Math.hypot(vx,vz);
    vx-=PHYS.drag*spNow*vx/PHYS.mass*dt;
    vz-=PHYS.drag*spNow*vz/PHYS.mass*dt;
    car.yawRate*=Math.exp(-.25*dt);
    car.ax=car.ay=0;
  }
  const hsp=Math.hypot(vx,vz);
  if(hsp>PHYS.maxSpeed){vx*=PHYS.maxSpeed/hsp;vz*=PHYS.maxSpeed/hsp}
  if(!inCar&&hsp<.6){vx=0;vz=0;car.yawRate*=Math.exp(-6*dt)}
  car.vel.x=vx;car.vel.z=vz;
  car.h+=car.yawRate*dt;
  car.pos.x+=vx*dt;car.pos.z+=vz*dt;
  collideParked(dt);   // the other cars/truck on the runway are solid bodies

  // side barriers: concrete walls along the deck + ramp, steel rails on the landing strip
  const bz=car.pos.z;
  const wallL=bz>=RZ-RL&&bz<=40?RW/2-PHYS.halfW:(bz>=LZ0-SL&&bz<=LZ0?19.3-PHYS.halfW:0);
  if(wallL&&Math.abs(car.pos.x-RX)>wallL){
    const side=car.pos.x>RX?1:-1;
    const strength=Math.abs(vx);
    const cz=car.pos.z+Math.cos(car.h)*clamp((car.vLong>0?1:-1)*(PHYS.halfL||2.45)*.62,-(PHYS.halfL||2.45),PHYS.halfL||2.45);
    car.pos.x=RX+side*wallL;
    if(vx*side>0){
      const hit=Math.min(1,strength/14);
      vx=-vx*.28;vz*=1-.14*hit;
      car.vel.x=vx;car.vel.z=vz;
      car.yawRate=car.yawRate*.55-side*Math.sign(car.vLong||1)*Math.min(1.4,strength*.045);   // glancing hits rotate the car
      if(strength>4){
        impactAt(RX+side*RW/2,car.pos.y+.55,cz,-side,0,0,strength,260);   // contact at the real corner, not the centre
        statEl.textContent=side>0?'Clipped the right barrier':'Clipped the left barrier';
      }else if(hit>.35){puff(car.pos.x,car.pos.y,car.pos.z,3,.8,1.4);statEl.textContent='Scraped the barrier'}
    }
  }
  car.speed=car.vLong=vx*Math.sin(car.h)+vz*Math.cos(car.h);
  car.vLat=vx*Math.cos(car.h)-vz*Math.sin(car.h);

  // wall/step in front of the car (slope-aware, so the long ramp is still climbable).
  // Probe both front corners: an offset hit damages the correct side and spins the car.
  if(!car.air){
    const nose=(PHYS.halfL||2.45)+.25,nw=(PHYS.halfW||1.02)*.82;
    for(const sx of [-1,1]){
      const px=car.pos.x+Math.sin(car.h)*nose+Math.cos(car.h)*sx*nw;
      const pz=car.pos.z+Math.cos(car.h)*nose-Math.sin(car.h)*sx*nw;
      const pg=gh(px,pz);
      if(pg>car.pos.y+2.2&&Math.abs(car.speed)>1){
        const strength=Math.abs(car.speed);
        car.pos.x-=vx*dt*.8;car.pos.z-=vz*dt*.8;
        car.vel.multiplyScalar(-.18);car.speed*=-.18;
        car.yawRate=car.yawRate*.3+sx*Math.sign(car.speed||1)*Math.min(1.2,strength*.04);
        impactAt(px,car.pos.y+.6,pz,-Math.sin(car.h),0,-Math.cos(car.h),strength,900);
        statEl.textContent=sx<0?'Left-front corner impact':'Right-front corner impact';
        break;
      }
    }
  }

  // chassis pose: terrain fit + body lean on top
  if(car.air){
    const airPitch=clamp(Math.atan2(car.vy,Math.max(15,Math.abs(car.speed)))*.5,-.45,.45);
    car.pitch+=(airPitch-car.pitch)*Math.min(1,2.2*dt);
    car.roll*=Math.exp(-.6*dt);
  }else{
    const lr=PHYS.leanRate||14;
    car.pitch+=(pitchT+(lwR-lwF)*.045-car.pitch)*Math.min(1,lr*dt);
    car.roll+=(rollT-lwSide*.05-car.roll)*Math.min(1,lr*dt);
  }
  stepSpring(car,'bp','bpv',clamp(-car.ax*PHYS.pitchK,-PHYS.pitchMax,PHYS.pitchMax),120,10,dt);
  stepSpring(car,'br','brv',clamp(car.ay*PHYS.rollK,-PHYS.rollMax,PHYS.rollMax),110,9.5,dt);
  stepSpring(car,'bh','bhv',car.air?0:-.015,110,13,dt);
  car.bh=clamp(car.bh,-.16,.07);
  const alt=centerVoid?99:Math.max(0,car.pos.y-gAvg);
  carG.position.copy(car.pos);carG.rotation.set(-car.pitch,car.h,car.roll);
  const sg=crashSag();
  carBody.rotation.set(car.bp+sg.p,0,car.br+sg.r);carBody.position.y=car.bh-sg.d;
  truckBody.rotation.set(car.bp+sg.p,0,car.br+sg.r);truckBody.position.y=car.bh-sg.d;   // cab leans with the chassis
  f1Body.rotation.set(car.bp+sg.p,0,car.br+sg.r);f1Body.position.y=car.bh-sg.d;
  contact.position.set(car.pos.x,(centerVoid?car.pos.y:gAvg)+.04,car.pos.z);
  contact.rotation.set(-car.pitch,car.h,car.roll);
  const cs=1+Math.min(alt,8)*.07;
  contact.scale.set((PHYS.cw||1)*cs,1,(PHYS.cl||1)*cs);
  contact.children[0].material.opacity=clamp(.45-alt*.055,.04,.45);
  contact.visible=!centerVoid&&alt<7;

  // wheels: steer, roll, lock, wheelspin + visible bend after a hit
  const c2=Math.cos(car.h),s2=Math.sin(car.h);
  wheels.forEach((w,wi)=>{
    if(w.dp&&w.dp.gone)return;
    if(w.front)w.steer.rotation.y=car.steer;
    w.steer.rotation.z=(wheelDmg[wi]||0)*.3;
    let wv=car.speed/PHYS.wheelR;
    if(!w.front&&car.wheelSlip>.02)wv*=1+Math.min(2.5,car.wheelSlip*7);
    w.spinA-=wv*dt;w.spin.rotation.x=w.spinA;
  });

  if(lwN&&!car.air&&spd>3)wheels.forEach((w,i)=>{if(w.dp&&w.dp.gone&&Math.random()<.5)puff(wp[i].x,(gs[i]>-5000?gs[i]:car.pos.y)+.08,wp[i].z,1,.4,.7,0xffa640)});
  if(engOut&&Math.random()<.12)puff(car.pos.x-sinH*1.3,car.pos.y+.9,car.pos.z-cosH*1.3,1,.8,1.2,0x2c2c30);

  // brake lights, glowing discs + boost flames
  tailM.emissiveIntensity=(svcBrake>.2||hb)?3:(lights.night?1.6:.9);
  discM.emissiveIntensity=(svcBrake>.55&&Math.abs(car.speed)>8)?1.1:0;
  const flamesOn=boost&&car.throttle>.4&&Math.abs(car.speed)>1;
  flames.forEach(f=>{f.visible=flamesOn;if(flamesOn)f.scale.set(.85+Math.random()*.4,1+Math.random()*.9,.85+Math.random()*.4)});

  // skid marks / tire smoke when the tires give up
  const drifting=!car.air&&Math.abs(car.speed)>3&&(Math.abs(car.vLat)>4||car.wheelSlip>.1);
  car.skidAcc+=Math.abs(car.speed)*dt;
  if(drifting&&car.skidAcc>1){
    car.skidAcc=0;
    const rx=car.pos.x-hw*c2+ra*s2,rz=car.pos.z+hw*s2+ra*c2;
    const lx=car.pos.x+hw*c2+ra*s2,lz=car.pos.z-hw*s2+ra*c2;
    addSkid(rx,rz,car.pitch,car.roll,car.h);addSkid(lx,lz,car.pitch,car.roll,car.h);
  }
  car.smokeT-=dt;
  if(drifting&&car.smokeT<=0){
    car.smokeT=.05;
    const rx=car.pos.x-hw*c2+ra*s2,rz=car.pos.z+hw*s2+ra*c2;
    puff(rx,gh(rx,rz),rz,1,.55,1.6);
  }
  smoke.forEach(p=>{
    if(p.life<=0)return;
    p.life-=dt;
    if(p.life<=0){p.s.visible=false;return}
    p.s.position.addScaledVector(p.vel,dt);
    p.vel.y+=.4*dt;p.vel.multiplyScalar(1-1.2*dt);
    p.s.scale.multiplyScalar(1+1.1*dt);
    p.s.material.opacity=.34*(p.life/p.max);
  });

  // damaged engine: smoke, then fire once it is cooked
  crash.smokeT-=dt;crash.cool-=dt;
  if(crash.eng>.35&&crash.smokeT<=0){
    crash.smokeT=.18-crash.eng*.1;
    const hx=car.pos.x+Math.sin(car.h)*1.25,hz=car.pos.z+Math.cos(car.h)*1.25;
    puff(hx,car.pos.y+.95,hz,crash.eng>.82?2:1,crash.eng>.82?1.5:.85,1.2,crash.eng>.82?0xff7a24:0x6d7078);
  }

  // knockable props + torn-off parts
  updateObstacles(dt);
  updateDebris(dt);

  speedEl.textContent=Math.round(Math.abs(car.speed)*3.6)+' km/h';
  gearEl.textContent=!inCar?'P':((car.gear<0?'R':(Math.abs(car.speed)<.4&&car.throttle<.05?'N':car.gear))+' · '+Math.round(car.rpm)+' rpm');
  if(inCar&&!drag){camY+=wrap(car.h+Math.PI-camY)*Math.min(1,3*dt);camX+=(.3-camX)*Math.min(1,2*dt)}
}
