/* CrashNG — Lamborghini Revuelto SV: the procedural car shell every car skin shares
   Owns: BODY loft profile, canopy glass panes, front/rear trim, interior + engine bay,
   the carBody group (leans on the suspension) and the exhaust flames.
   applySkin() in main.js hides carBody while the truck/F1 skin is active.
   detachable(...) parts register themselves in detachParts for the damage model. */
// body sections: z, floor, shoulder-y, roof-y, floor-w, shoulder-w, top-w, crown
const BODY=[
  [ 2.52,.34,.46,.44,.46,.58,.40,.006],[ 2.46,.31,.48,.47,.52,.64,.45,.006],
  [ 2.38,.29,.50,.49,.58,.71,.52,.008],[ 2.30,.27,.53,.53,.65,.80,.62,.010],
  [ 2.20,.26,.57,.59,.70,.86,.70,.012],[ 2.10,.25,.61,.64,.74,.91,.76,.014],
  [ 2.00,.25,.65,.69,.76,.94,.80,.016],[ 1.92,.25,.70,.76,.78,.97,.83,.018],
  [ 1.84,.25,.72,.78,.79,.99,.85,.018],[ 1.76,.25,.74,.79,.80,1.00,.86,.018],
  [ 1.68,.25,.76,.80,.81,1.01,.87,.018],[ 1.60,.24,.77,.81,.81,1.02,.88,.018],
  [ 1.52,.24,.78,.82,.82,1.02,.88,.018],[ 1.44,.24,.78,.82,.82,1.02,.88,.018],
  [ 1.36,.24,.77,.815,.81,1.01,.87,.018],[ 1.28,.24,.76,.81,.81,1.00,.87,.018],
  [ 1.18,.24,.75,.80,.80,.99,.86,.018],[ 1.06,.24,.74,.795,.80,.97,.86,.018],
  [ .94,.24,.735,.79,.80,.96,.86,.018],[ .82,.24,.73,.79,.80,.955,.86,.018],
  [ .68,.24,.73,.79,.80,.95,.86,.018],[ .52,.24,.73,.79,.80,.95,.86,.018],
  [ .36,.24,.73,.79,.80,.95,.86,.018],[ .20,.24,.73,.79,.80,.95,.86,.018],
  [ .04,.24,.73,.79,.80,.95,.86,.018],[-.12,.24,.73,.79,.80,.95,.86,.018],
  [-.28,.24,.735,.80,.80,.955,.865,.018],[-.44,.24,.74,.805,.80,.96,.87,.018],
  [-.60,.24,.75,.81,.81,.97,.88,.018],[-.76,.25,.76,.82,.81,.98,.885,.018],
  [-.92,.25,.77,.83,.82,.99,.89,.018],[-1.08,.26,.78,.84,.82,1.00,.90,.018],
  [-1.22,.26,.79,.85,.83,1.01,.91,.018],[-1.36,.27,.80,.855,.83,1.02,.915,.018],
  [-1.48,.27,.81,.86,.84,1.03,.92,.018],[-1.60,.27,.81,.86,.84,1.03,.92,.018],
  [-1.72,.27,.81,.855,.83,1.02,.915,.018],[-1.84,.27,.805,.85,.82,1.01,.90,.018],
  [-1.96,.28,.80,.84,.81,.99,.88,.018],[-2.08,.28,.79,.83,.79,.96,.86,.018],
  [-2.20,.29,.775,.815,.77,.93,.82,.016],[-2.32,.30,.755,.795,.73,.89,.77,.014],
  [-2.42,.32,.735,.775,.69,.85,.72,.012],[-2.50,.34,.71,.75,.65,.80,.68,.010]
];
const WHEELS=[[1.48,1],[-1.52,-1]];
// fenders sweep up over the tyres instead of being punched out, so the arch edge stays clean
const archLift=z=>{
  let l=0;
  for(const a of [1.48,-1.52]){const d=Math.abs(z-a)/.41;if(d<1)l+=.55*Math.sqrt(1-d*d)}
  return l;
};
const bodySt=BODY.map(r=>{
  const z=r[0],yb=r[1]+archLift(z),ys=Math.max(r[2],yb+.055),yt=Math.max(r[3],ys+.018);
  return {z,yb,ys,yt,wb:r[4],ws:r[5],wt:r[6],cr:r[7]};
}).reverse();   // ascending z keeps the loft winding outward
function bodyRing(s){
  const H=s.ys-s.yb;
  // character line: fades out at the arches so the fender stay clean
  const f=Math.max(0,Math.min(1,(s.z+1.25)/.3))*Math.max(0,Math.min(1,(.95-s.z)/.3));
  const ay=s.yb+H*.32, by=s.ys-.06;
  const cy=ay+(by-ay)*.55, lx=s.wb+(s.ws*.97-s.wb)*((cy-ay)/((by-ay)||1));
  const sp=.055*Math.max(f,.03);   // keep the three points distinct even when the line fades out
  const cp=[[0,s.yb],[s.wb*.55,s.yb],[s.wb,ay],
    [lx-.004*f,cy-sp],[lx+.022*f,cy],[lx-.004*f,cy+sp],
    [s.ws*.97,by],[s.ws,s.ys],[s.ws*.985,s.ys+.014],[s.wt,s.yt-.045],[s.wt*.99,s.yt-.01],[s.wt*.6,s.yt+.004],[0,s.yt+s.cr]];
  const h=splinePts(cp,15),r=h.slice(0,-1);
  for(let i=h.length-1;i>0;i--)r.push(new THREE.Vector2(-h[i].x,h[i].y));
  return r;
}
const bodyM=new THREE.Mesh(loftGeo(bodySt.map(s=>({z:s.z,pts:bodyRing(s)})),{closed:true,capStart:true,capEnd:true}),paint);
bodyM.castShadow=true;bodyM.receiveShadow=true;carG.add(bodyM);
// x of the body side at a given height, so bolt-on parts sit on the skin instead of floating
function surfX(z,y){
  let best=bodySt[0];for(const s of bodySt)if(Math.abs(s.z-z)<Math.abs(best.z-z))best=s;
  const p=bodyRing(best),n=p.length;
  for(let i=0;i<n/2;i++){
    const a=p[i],b=p[i+1];
    if(y>=Math.min(a.y,b.y)&&y<=Math.max(a.y,b.y))return a.x+(b.x-a.x)*((y-a.y)/((b.y-a.y)||1));
  }
  return p[Math.floor(n/4)].x;
}
// y of the top skin at a given z/x, so vents sit flush on the hood instead of floating
function surfY(z,x){
  let best=bodySt[0];for(const s of bodySt)if(Math.abs(s.z-z)<Math.abs(best.z-z))best=s;
  const p=bodyRing(best),n=p.length;
  let top=-1e9;
  for(let i=0;i<n/2;i++){
    const a=p[i],b=p[i+1];
    if(x>=Math.min(a.x,b.x)&&x<=Math.max(a.x,b.x)){
      const y=a.y+(b.y-a.y)*((x-a.x)/((b.x-a.x)||1));
      if(y>top)top=y;
    }
  }
  return top>-1e8?top:p[n/2].y;
}

// greenhouse: closed loft, roof painted, black window surround, glass everywhere else
const CAN=[
  [ .82,.775,.78,.55,.82],[ .64,.775,.80,.55,.95],[ .44,.775,.82,.54,1.05],
  [ .20,.78,.83,.54,1.135],[-.10,.78,.84,.54,1.16],[-.40,.78,.835,.545,1.155],
  [-.70,.78,.82,.55,1.12],[-1.00,.785,.78,.56,1.03],[-1.25,.79,.72,.57,.93],
  [-1.45,.79,.62,.57,.86]
];
function canRing(s,n){
  const cp=[[0,s.yb],[s.wb*.7,s.yb],[s.wb,s.yb+.04],[s.wt*1.04,s.yt-.10],[s.wt*.62,s.yt-.015],[0,s.yt]];
  const h=splinePts(cp,n),r=h.slice(0,-1);
  for(let i=h.length-1;i>0;i--)r.push(new THREE.Vector2(-h[i].x,h[i].y));
  return r;
}
const canSt=CAN.map(r=>({z:r[0],yb:r[1],wb:r[2],wt:r[3],yt:r[4]})).reverse();
const canopy=new THREE.Mesh(loftGeo(canSt.map(s=>({z:s.z,pts:canRing(s,11)})),{
  closed:true,capStart:true,capEnd:true,capMat:2,
  grp:(k,i,mid)=>{
    if(i===7||i===12)return 2;                        // window surround / pillars
    if(i>=8&&i<=11)return (mid<.42&&mid>-.78)?1:0;    // painted roof only over the cabin
    return 0;
  }
}),[glassM,paint,trimM]);
canopy.castShadow=true;canopy.receiveShadow=true;carG.add(canopy);
carG.add(cm(new THREE.BoxGeometry(1.34,.012,.15),trimM,[0,.793,.9]));

// glass is a separate skin split into four panes so each can pop out on its own;
// the painted shell keeps real openings so a missing window shows the cabin
const hiddenM=new THREE.MeshBasicMaterial({visible:false});
canopy.material=[hiddenM,paint,trimM];
{
  const cabinG=new THREE.Group();
  const intM=new THREE.MeshStandardMaterial({color:0x191a1f,roughness:.88});
  const intM2=new THREE.MeshStandardMaterial({color:0x2c2f37,roughness:.7});
  cabinG.add(cm(new THREE.BoxGeometry(1.44,.14,.62),intM2,[0,.83,.38]));               // dash
  [-.38,.38].forEach(x=>{
    cabinG.add(cm(new THREE.BoxGeometry(.46,.10,.50),intM,[x,.81,-.28]));              // seat base
    cabinG.add(cm(new THREE.BoxGeometry(.46,.38,.12),intM,[x,.94,-.55],[.16,0,0]));    // seat back
  });
  cabinG.add(cm(new THREE.BoxGeometry(.06,.30,.06),intM,[-.38,.88,.20]));              // steering column
  cabinG.add(cm(new THREE.TorusGeometry(.14,.02,6,16),intM2,[-.38,.96,.18],[1.2,0,0]));// wheel
  carG.add(cabinG);
}
{
  const src=canopy.geometry,srcIdx=src.index.array,srcPos=src.attributes.position.array;
  const g0=[];
  for(const gr of src.groups)if(gr.materialIndex===0)for(let i=gr.start;i<gr.start+gr.count;i++)g0.push(srcIdx[i]);
  const buckets={wind:[],rear:[],left:[],right:[]};
  for(let i=0;i<g0.length;i+=3){
    const a=g0[i],b=g0[i+1],c=g0[i+2];
    const z=(srcPos[a*3+2]+srcPos[b*3+2]+srcPos[c*3+2])/3;
    const x=(srcPos[a*3]+srcPos[b*3]+srcPos[c*3])/3;
    const k=z>.45?'wind':z<-.9?'rear':x>=0?'left':'right';
    buckets[k].push(a,b,c);
  }
  const paneGeo=idx=>{
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(srcPos.slice(),3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(src.attributes.uv.array.slice(),2));
    g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g;
  };
  [['windshield',buckets.wind,20,'front'],['left window',buckets.left,16,'left'],
   ['right window',buckets.right,16,'right'],['rear window',buckets.rear,23,'rear']].forEach(([name,idx,th,zone])=>{
    if(!idx.length)return;
    const m=new THREE.Mesh(paneGeo(idx),glassM);
    m.castShadow=true;m.scale.setScalar(1.004);   // sits just outside the cabin shell, no z-fighting
    carG.add(detachable(m,name,th,zone));
  });
}

// the arch is a raised fender, not a cut hole: no liner geometry, or it pokes through the skin

// front: wide SV splitter, canards, mouth, slim lights, badge
carG.add(detachable(cm(new THREE.BoxGeometry(1.64,.03,.38),carbonM,[0,.255,2.36]),'front splitter',24,'front'));
carG.add(cm(new THREE.BoxGeometry(1.54,.016,.06),carbonM,[0,.238,2.53]));
[-.60,-.30,0,.30,.60].forEach(x=>carG.add(cm(new THREE.BoxGeometry(.018,.07,.12),carbonM,[x,.205,2.44])));   // splitter fences
carG.add(cm(new THREE.BoxGeometry(1.12,.17,.03),carbonM,[0,.39,2.485]));
carG.add(cm(new THREE.BoxGeometry(.74,.13,.05),grilleM,[0,.39,2.505]));
carG.add(cm(new THREE.BoxGeometry(.20,.10,.04),grilleM,[-.44,.365,2.49]));
carG.add(cm(new THREE.BoxGeometry(.20,.10,.04),grilleM,[.44,.365,2.49]));
carG.add(cm(new THREE.BoxGeometry(.92,.02,.03),carbonM,[0,.478,2.475]));
[-1,1].forEach(sx=>{
  const hl=new THREE.Group();
  hl.add(cm(new THREE.BoxGeometry(.40,.03,.20),blk,[sx*.38,.508,2.34],[.14,0,sx*.05]));
  hl.add(cm(new THREE.BoxGeometry(.33,.014,.03),drl,[sx*.38,.523,2.42],[.14,0,sx*.05]));
  hl.add(cm(new THREE.BoxGeometry(.016,.085,.026),drl,[sx*.525,.498,2.35],[.14,0,sx*.5]));
  hl.add(cm(new THREE.BoxGeometry(.016,.085,.026),drl,[sx*.235,.496,2.305],[.14,0,-sx*.5]));
  [.30,.46].forEach(x=>{
    hl.add(cm(new THREE.CylinderGeometry(.04,.04,.03,18),whiteM,[sx*x,.508,2.375],[Math.PI/2-.14,0,0]));
    hl.add(cm(new THREE.TorusGeometry(.043,.007,6,18),blk,[sx*x,.508,2.392],[-.14,0,0]));
  });
  carG.add(detachable(hl,sx>0?'left headlight':'right headlight',14,'front'));
  const cn=new THREE.Group();
  cn.add(cm(new THREE.BoxGeometry(.13,.016,.10),carbonM,[sx*.57,.315,2.36]));
  cn.add(cm(new THREE.BoxGeometry(.26,.016,.11),carbonM,[sx*.68,.335,2.34],[.16,0,-sx*.12]));
  cn.add(cm(new THREE.BoxGeometry(.21,.014,.09),carbonM,[sx*.76,.405,2.31],[.2,0,-sx*.14]));
  carG.add(detachable(cn,sx>0?'left canard':'right canard',12,'front'));
});
const bs=new THREE.Shape();
[[-.055,.06],[.055,.06],[.06,.005],[0,-.075],[-.06,.005]].forEach((p,i)=>i?bs.lineTo(p[0],p[1]):bs.moveTo(p[0],p[1]));
const badge=new THREE.Mesh(new THREE.ExtrudeGeometry(bs,{depth:.012,bevelEnabled:false}),goldM);
badge.position.set(0,.44,2.515);carG.add(badge);
// hood vents + mirrors + angular rear-quarter intake + skirts + handles
const intakeShape=new THREE.Shape();
[[-.13,-.055],[.13,-.048],[.115,.052],[-.12,.056]].forEach((p,i)=>i?intakeShape.lineTo(p[0],p[1]):intakeShape.moveTo(p[0],p[1]));
const intakeHole=new THREE.Path();
[[-.098,-.03],[.098,-.024],[.086,.03],[-.09,.034]].forEach((p,i)=>i?intakeHole.lineTo(p[0],p[1]):intakeHole.moveTo(p[0],p[1]));
intakeShape.holes.push(intakeHole);
const intakeGeo=new THREE.ExtrudeGeometry(intakeShape,{depth:.045,bevelEnabled:false});
[-1,1].forEach(sx=>{
  const mir=new THREE.Group();
  mir.add(cm(new THREE.BoxGeometry(.13,.024,.055),trimM,[sx*.845,.795,.60],[0,0,-sx*.38]));
  const pod=cm(new THREE.SphereGeometry(1,14,10),paint,[sx*.935,.818,.555]);pod.scale.set(.068,.042,.10);mir.add(pod);
  mir.add(cm(new THREE.BoxGeometry(.108,.044,.018),glassM,[sx*.935,.818,.458]));
  carG.add(detachable(mir,sx>0?'left mirror':'right mirror',13,sx>0?'left':'right'));
  const ix=surfX(-1.00,.60);
  const intake=new THREE.Mesh(intakeGeo,carbonM);
  intake.castShadow=true;intake.position.set(sx*ix,.60,-1.00);intake.rotation.y=sx*Math.PI/2;carG.add(intake);
  carG.add(cm(new THREE.BoxGeometry(.012,.075,.20),grilleM,[sx*(ix-.01),.60,-1.00]));
  carG.add(cm(new THREE.BoxGeometry(.016,.014,.22),carbonM,[sx*(ix+.012),.60,-1.00]));      // blade across the scoop
  carG.add(cm(new THREE.BoxGeometry(.014,.03,.20),blk,[sx*(surfX(.05,.66)+.004),.66,.05]));
  const sk=new THREE.Group();
  sk.add(cm(new THREE.BoxGeometry(.05,.09,2.50),carbonM,[sx*.83,.20,-.10]));
  sk.add(cm(new THREE.BoxGeometry(.09,.02,2.46),carbonM,[sx*.865,.148,-.10]));
  carG.add(detachable(sk,sx>0?'left side skirt':'right side skirt',18,sx>0?'left':'right'));
  // SV hood louvres, laid flush on the top skin
  carG.add(cm(new THREE.BoxGeometry(.28,.018,.36),grilleM,[sx*.30,surfY(1.30,.30)+.004,1.30],[.03,0,0]));
  for(let i=0;i<3;i++)carG.add(cm(new THREE.BoxGeometry(.25,.010,.035),carbonM,[sx*.30,surfY(1.30,.30)+.016,1.19+i*.11],[.03,0,0]));
});
// rear: fascia, twin Y light clusters, exhausts, diffuser, plate, wing
carG.add(detachable(cm(new THREE.BoxGeometry(1.48,.21,.04),blk,[0,.635,-2.518]),'rear fascia',34,'rear'));
carG.add(cm(new THREE.BoxGeometry(.28,.012,.32),grilleM,[0,.884,-1.70],[-.10,0,0]));   // engine-cover grille
[-1,1].forEach(sx=>{
  const tl=new THREE.Group();
  tl.add(cm(new THREE.BoxGeometry(.34,.024,.012),tailM,[sx*.36,.675,-2.545]));        // Y stem
  tl.add(cm(new THREE.BoxGeometry(.20,.018,.012),tailM,[sx*.615,.705,-2.545],[0,0,sx*.31]));
  tl.add(cm(new THREE.BoxGeometry(.20,.018,.012),tailM,[sx*.615,.645,-2.545],[0,0,-sx*.31]));
  tl.add(cm(new THREE.BoxGeometry(.05,.032,.012),whiteM,[sx*.40,.585,-2.545]));
  carG.add(detachable(tl,sx>0?'left taillight':'right taillight',16,'rear'));
  for(let i=0;i<4;i++){const z=-1.58-i*.09;carG.add(cm(new THREE.BoxGeometry(.34,.014,.06),grilleM,[sx*.32,surfY(z,.32)+.004,z],[-.12,0,0]))}
});
// central hexagonal exhaust, like the Revuelto
const exG=new THREE.Group();
exG.add(cm(new THREE.CylinderGeometry(.082,.09,.17,6,1,true),titanM,[0,.625,-2.56],[Math.PI/2,0,0]));
exG.add(cm(new THREE.CylinderGeometry(.07,.07,.025,6),blk,[0,.625,-2.60],[Math.PI/2,0,0]));
exG.add(cm(new THREE.CylinderGeometry(.115,.115,.028,6,1,true),carbonM,[0,.625,-2.53],[Math.PI/2,0,0]));
carG.add(detachable(exG,'exhaust',22,'rear'));
const diffG=new THREE.Group();
diffG.add(cm(new THREE.BoxGeometry(1.46,.032,.40),carbonM,[0,.23,-2.30],[.16,0,0]));
[-.54,-.36,-.18,0,.18,.36,.54].forEach(x=>diffG.add(cm(new THREE.BoxGeometry(.03,.17,.36),carbonM,[x,.245,-2.30],[.16,0,0])));
carG.add(detachable(diffG,'rear diffuser',22,'rear'));
// SV fixed wing: deeper chord, taller swan-neck uprights, endplates
const wingShape=new THREE.Shape();
[[0,0],[.045,.032],[.18,.058],[.33,.05],[.46,.008],[.42,-.02],[.16,-.032],[0,-.026]].forEach((p,i)=>i?wingShape.lineTo(p[0],p[1]):wingShape.moveTo(p[0],p[1]));
const wingGeo=new THREE.ExtrudeGeometry(wingShape,{depth:1.74,bevelEnabled:false});wingGeo.translate(0,0,-.87);
const wing=new THREE.Mesh(wingGeo,carbonM);wing.rotation.y=-Math.PI/2;wing.position.set(0,1.13,-2.60);wing.castShadow=true;carG.add(detachable(wing,'rear wing',40,'rear'));
[-1,1].forEach(sx=>{
  carG.add(cm(new THREE.BoxGeometry(.07,.36,.13),carbonM,[sx*.50,.965,-2.36],[.18,0,0]));
  carG.add(cm(new THREE.BoxGeometry(.022,.22,.50),carbonM,[sx*.88,1.10,-2.37]));
});
const svTex=cTex(128,64,(g,w,h)=>{g.fillStyle='#eef0f4';g.font='bold italic 44px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('SV',w/2,h/2+3)});
const svM=new THREE.MeshBasicMaterial({map:svTex,transparent:true});
[-1,1].forEach(sx=>{
  const d=new THREE.Mesh(new THREE.PlaneGeometry(.20,.10),svM);
  d.position.set(sx*.8935,1.10,-2.37);d.rotation.y=sx*Math.PI/2;carG.add(d);
});
const plateG=new THREE.Group();
const plate=new THREE.Mesh(new THREE.PlaneGeometry(.36,.09),plateM);
plate.position.set(0,.47,-2.552);plate.rotation.y=Math.PI;plateG.add(plate);
plateG.add(cm(new THREE.BoxGeometry(.40,.115,.012),blk,[0,.47,-2.545]));
carG.add(detachable(plateG,'license plate',12,'rear'));

// gearbox + driveshaft slung under the rear floor; heavy hits can drop it onto the road
const gearG=new THREE.Group();
gearG.add(cm(new THREE.BoxGeometry(.62,.30,.78),titanM,[0,.17,-1.72]));
gearG.add(cm(new THREE.BoxGeometry(.46,.09,.52),blk,[0,.01,-1.62]));
gearG.add(cm(new THREE.CylinderGeometry(.065,.065,.86,10),titanM,[0,.16,-1.10],[Math.PI/2,0,0]));
gearG.add(cm(new THREE.BoxGeometry(.88,.05,.10),blk,[0,.11,-1.92]));
carG.add(detachable(gearG,'gearbox',32));

// mid-engine V12 under the cover + radiator behind the nose: only reachable once the panel above is gone
const engG=new THREE.Group();
engG.add(cm(new THREE.BoxGeometry(.62,.30,.84),titanM,[0,.58,-1.30]));
engG.add(cm(new THREE.BoxGeometry(.70,.08,.60),blk,[0,.43,-1.30]));
engG.add(cm(new THREE.BoxGeometry(.50,.05,.18),blk,[0,.78,-1.74]));
[-1,1].forEach(sx=>{
  engG.add(cm(new THREE.BoxGeometry(.20,.07,.74),caliperM,[sx*.19,.75,-1.30]));
  for(let i=0;i<6;i++)engG.add(cm(new THREE.CylinderGeometry(.034,.034,.26,8),titanM,[sx*.38,.70,-.98-i*.125],[0,0,Math.PI/2]));
  engG.add(cm(new THREE.CylinderGeometry(.05,.05,.30,10),blk,[sx*.29,.50,-1.62]));
});
carG.add(detachable(engG,'engine',40,'rear'));detachParts[detachParts.length-1].needs='engine cover';
const radG=new THREE.Group();
radG.add(cm(new THREE.BoxGeometry(.98,.26,.04),grilleM,[0,.47,2.10]));
radG.add(cm(new THREE.BoxGeometry(1.04,.30,.03),blk,[0,.47,2.07]));
carG.add(detachable(radG,'radiator',30,'front'));detachParts[detachParts.length-1].needs='front nose';

// ---- extra detail pass: cabin, suspension, panel gaps, underbody, engine bay ----
{
  const dk=new THREE.MeshStandardMaterial({color:0x14151a,roughness:.82});
  const scr=new THREE.MeshStandardMaterial({color:0x0a1830,emissive:0x2a6cff,emissiveIntensity:.9,roughness:.2});
  const belt=new THREE.MeshStandardMaterial({color:0xc4161c,roughness:.55});
  const add=(g,m,p,r)=>carG.add(cm(g,m,p,r));
  // cabin: carpet, console, screens, headrests, bolsters, door cards, belts, pedals, firewall
  add(new THREE.BoxGeometry(1.5,.02,1.8),dk,[0,.38,-.10]);
  add(new THREE.BoxGeometry(.20,.12,.62),dk,[0,.80,-.10]);
  for(let i=0;i<4;i++)add(new THREE.BoxGeometry(.035,.02,.035),whiteM,[-.045+i*.03,.865,-.02]);
  add(new THREE.BoxGeometry(.22,.12,.012),scr,[0,.93,.20],[-.5,0,0]);
  add(new THREE.BoxGeometry(.30,.10,.012),scr,[-.38,.95,.24],[-.35,0,0]);
  [-.38,.38].forEach(x=>{
    add(new THREE.BoxGeometry(.20,.14,.07),dk,[x,1.13,-.60]);
    [-1,1].forEach(k=>add(new THREE.BoxGeometry(.07,.22,.38),dk,[x+k*.24,.88,-.40]));
    add(new THREE.BoxGeometry(.045,.36,.012),belt,[x+.12,1.0,-.57],[0,0,.35]);
    add(new THREE.BoxGeometry(.10,.012,.06),dk,[x,.64,.64]);
  });
  [-1,1].forEach(sx=>add(new THREE.BoxGeometry(.03,.30,1.2),dk,[sx*.72,.70,-.05]));
  add(new THREE.BoxGeometry(1.22,.42,.03),dk,[0,.58,-.85]);
  // suspension: wishbones + red coil-overs behind each wheel
  [[-1,1.48],[1,1.48],[-1,-1.52],[1,-1.52]].forEach(([sx,z])=>{
    add(new THREE.CylinderGeometry(.012,.012,.38,6),titanM,[sx*.62,.56,z],[0,0,Math.PI/2]);
    add(new THREE.CylinderGeometry(.014,.014,.46,6),titanM,[sx*.60,.22,z],[0,0,Math.PI/2]);
    add(new THREE.CylinderGeometry(.032,.032,.28,10),belt,[sx*.62,.42,z+.04],[0,0,sx*.25]);
    add(new THREE.CylinderGeometry(.012,.012,.34,6),titanM,[sx*.62,.42,z+.04],[0,0,sx*.25]);
  });
  // flat carbon floor with rear strakes
  add(new THREE.BoxGeometry(1.5,.02,4.4),carbonM,[0,.19,0]);
  [-.5,-.25,0,.25,.5].forEach(x=>add(new THREE.BoxGeometry(.02,.05,.5),carbonM,[x,.215,-2.0]));
  // door shut lines
  [-1,1].forEach(sx=>{
    [.88,-.72].forEach(z=>add(new THREE.BoxGeometry(.006,.40,.012),blk,[sx*(surfX(z,.56)+.003),.56,z]));
    [.38,.76].forEach(y=>add(new THREE.BoxGeometry(.006,.010,1.60),blk,[sx*(surfX(.08,y)+.003),y,.08]));
  });
  // hood + engine cover panel gaps
  const sy=(z,x)=>surfY(z,x)+.004;
  add(new THREE.BoxGeometry(1.5,.006,.012),blk,[0,sy(1.0,0),1.0],[.06,0,0]);
  [-.62,.62].forEach(x=>add(new THREE.BoxGeometry(.012,.006,.9),blk,[x,sy(1.45,x),1.45],[.04,0,0]));
  add(new THREE.BoxGeometry(1.2,.006,.012),blk,[0,sy(-.78,0),-.78]);
  [-.5,.5].forEach(x=>add(new THREE.BoxGeometry(.012,.006,1.1),blk,[x,sy(-1.35,x),-1.35],[-.05,0,0]));
  // fuel flap
  [-1,1].forEach(sx=>add(new THREE.CylinderGeometry(.07,.07,.012,18),carbonM,[sx*(surfX(-1.2,.72)+.003),.72,-1.2],[0,0,Math.PI/2]));
  // engine bay detail rides with the engine: pulleys, battery, oil filter, hoses
  [-.2,0,.2].forEach((x,i)=>engG.add(cm(new THREE.CylinderGeometry(.075,.075,.05,16),i===1?titanM:blk,[x,.58+(i===1?.04:0),-.86],[Math.PI/2,0,0])));
  engG.add(cm(new THREE.BoxGeometry(.30,.14,.20),blk,[-.3,.42,-.90]));
  engG.add(cm(new THREE.CylinderGeometry(.05,.05,.14,12),caliperM,[.28,.45,-.90]));
  [-1,1].forEach(sx=>engG.add(cm(new THREE.CylinderGeometry(.02,.02,.5,8),belt,[sx*.36,.52,-1.10],[Math.PI/2,0,sx*.3])));
}

// body shell lives on its own group so it can lean on the suspension while the wheels stay planted
const carBody=new THREE.Group();carG.add(carBody);
[...carG.children].forEach(c=>{if(c!==carBody)carBody.add(c)});
const flameM=new THREE.MeshBasicMaterial({color:0x63c8ff,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false});
const flames=[-1,1].map(sx=>{const f=new THREE.Mesh(new THREE.ConeGeometry(.055,.75,10,1,true),flameM);f.position.set(sx*.032,.625,-2.66);f.rotation.x=-Math.PI/2;f.visible=false;carBody.add(f);return f});
