import * as THREE from './vendor/three.module.js';
import {CARE_PRODUCTS} from './care-catalog.js';

const byRecord=new Map(CARE_PRODUCTS.map(product=>[product.productId,product.careModel]));
const legacyModels={cane:'quad-cane',walker:'rollator',wheelchair:'manual-wheelchair',stool:'round-shower-stool',shower:'shower-armchair',folding:'wall-folding-seat',swivel:'swivel-shower-chair',commode:'wheeled-shower-commode',toilet:'toilet-seat-raiser',rail:'wall-grab-rail',surface:'anti-slip-mat','care-bed':'electric-care-bed',pillbox:'reminder-pillbox'};

// Category detail is illustrative. Normalize the complete visible geometry to
// the supplied envelope; none of the internal proportions are SKU measurements.
export function careFurniture(item){
 if(!item||!['w','d','h'].every(key=>Number.isFinite(item[key])&&item[key]>0))throw Error('器具整體寬、深、高必須是正數。');
 for(const key of ['x','z','rotation'])if(item[key]!==undefined&&!Number.isFinite(item[key]))throw Error('器具位置與朝向必須是有效數值。');
 const model=byRecord.get(item.productId)||byRecord.get(item.sourceRecordId)||item.careModel||legacyModels[item.careKind]||'shower-armchair';
 const group=new THREE.Group();
 const material=(color,roughness=.7,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const body=material(item.color||'#a7b6a2'),metal=material('#a4b0ad',.35,.65),dark=material('#394742',.85),white=material('#edf0e7'),rubber=material('#57655e',.95),accent=material('#d5b983'),wood=material('#b8a583');
 const add=(geometry,m=body,x=0,y=0,z=0,part='frame')=>{const mesh=new THREE.Mesh(geometry,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.part=part;group.add(mesh);return mesh;};
 const box=(w,h,d,x,y,z,m=body,part='frame')=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z,part);
 const cylinder=(r,h,x,y,z,m=metal,part='frame')=>add(new THREE.CylinderGeometry(r,r,h,20),m,x,y,z,part);
 const strut=(a,b,r=.018,m=metal,part='frame')=>{const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from),mesh=add(new THREE.CylinderGeometry(r,r,delta.length(),12),m,...from.clone().add(to).multiplyScalar(.5).toArray(),part);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;};
 const tube=(points,r=.018,m=metal,part='frame')=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point))),Math.max(16,points.length*8),r,8,false),m,0,0,0,part);
 const roundedShape=(w,d,r=.05)=>{r=Math.min(r,w/3,d/3);const s=new THREE.Shape(),x=-w/2,z=-d/2;s.moveTo(x+r,z);s.lineTo(x+w-r,z);s.quadraticCurveTo(x+w,z,x+w,z+r);s.lineTo(x+w,z+d-r);s.quadraticCurveTo(x+w,z+d,x+w-r,z+d);s.lineTo(x+r,z+d);s.quadraticCurveTo(x,z+d,x,z+d-r);s.lineTo(x,z+r);s.quadraticCurveTo(x,z,x+r,z);return s;};
 const discShape=(w,d)=>{const s=new THREE.Shape();s.absellipse(0,0,w/2,d/2,0,Math.PI*2,false);return s;};
 const hole=(shape,x,z,rx,rz=rx)=>{const p=new THREE.Path();p.absellipse(x,z,rx,rz,0,Math.PI*2,true);shape.holes.push(p);};
 const panel=(shape,thickness,x,y,z,m=body,part='seat')=>{const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,curveSegments:16});geometry.rotateX(-Math.PI/2);return add(geometry,m,x,y,z,part);};
 const seatPanel=(w,d,y,{round=false,drain=false,m=body,thickness=.055}={})=>{const s=round?discShape(w,d):roundedShape(w,d);if(drain)for(const x of [-.14,0,.14])for(const z of [-.10,.03,.14])hole(s,x,z,.017);return panel(s,thickness,0,y,0,m,'drain-seat');};
 const ringSeat=(w,d,y,thickness=.065,m=white)=>{const s=discShape(w,d);hole(s,0,-.01,w*.27,d*.29);return panel(s,thickness,0,y,0,m,'open-toilet-seat');};
 const foot=(x,z,height=.48)=>{strut([x*.9,height,z*.9],[x,0.035,z],.019);cylinder(.032,.045,x,.0225,z,rubber,'anti-slip-foot');cylinder(.021,.1,x*.96,height*.4,z*.96,white,'height-adjustment');};
 const legs=(width=.55,depth=.48,height=.48)=>{for(const x of [-width/2,width/2])for(const z of [-depth/2,depth/2])foot(x,z,height);};
 const back=(width=.56,y=.78,z=-.25,m=body)=>{const p=panel(roundedShape(width,.25),.055,0,y,z,m,'backrest');p.rotation.x=Math.PI/2;for(const x of [-width*.4,width*.4])strut([x,.45,z],[x,y+.09,z],.018);return p;};
 const arms=(width=.7,y=.68,depth=.48,m=dark)=>{for(const x of [-width/2,width/2]){strut([x,.48,-depth/2],[x,y,-depth/2],.018);strut([x,.48,depth/2],[x,y,depth/2],.018);box(.055,.045,depth+.08,x,y,0,m,'armrest');}};
 const wheel=(x,y,z,r=.09,{pushRim=false,spokes=false,drive=false}={})=>{const tyre=add(new THREE.TorusGeometry(r-.022,.022,8,28),rubber,x,y,z,'wheel-tyre');tyre.rotation.y=Math.PI/2;const hub=cylinder(drive?r*.68:.035,.065,x,y,z,drive?body:metal,drive?'drive-motor':'wheel-hub');hub.rotation.z=Math.PI/2;if(spokes)for(let n=0;n<8;n++){const angle=n*Math.PI/4;strut([x,y,z],[x,y+Math.sin(angle)*(r-.03),z+Math.cos(angle)*(r-.03)],.005,metal,'wheel-spoke');}if(pushRim){const rim=add(new THREE.TorusGeometry(r-.045,.009,8,28),metal,x+Math.sign(x)*.04,y,z,'hand-push-rim');rim.rotation.y=Math.PI/2;}return tyre;};
 const caster=(x,z)=>{wheel(x,.065,z,.065);strut([x,.065,z],[x,.18,z],.014,metal,'caster-fork');box(.05,.025,.035,x,.125,z+.045,dark,'wheel-lock');};
 const wheelchair=(powered=false)=>{seatPanel(.54,.48,.46,{m:dark});back(.54,.80,-.25,dark);arms(.68,.68,.43);for(const x of [-.29,.29]){strut([x,.16,-.3],[x,.49,.25],.024);strut([x,.17,.31],[x,.49,-.2],.024);wheel(x*1.27,powered?.19:.29,-.16,powered?.19:.29,{pushRim:!powered,spokes:!powered,drive:powered});caster(x,.31);strut([x,.44,.21],[x*.8,.15,.48],.018);box(.22,.025,.21,x*.7,.14,.48,metal,'footplate');tube([[x,.72,-.28],[x,.93,-.31],[x,.95,-.42]],.019,metal,'push-handle');box(.035,.035,.11,x,.95,-.41,dark,'push-grip');}if(powered){box(.48,.23,.42,0,.24,-.04,dark,'battery-box');box(.095,.045,.14,.34,.715,.14,body,'controller');cylinder(.012,.055,.34,.76,.16,metal,'joystick-stem');cylinder(.026,.025,.34,.795,.16,dark,'joystick');box(.31,.06,.1,0,.37,-.3,accent,'battery-indicator');}};

 switch(model){
 case 'quad-cane':
  strut([0,.11,0],[0,.92,0],.021);cylinder(.023,.38,0,.3,0,white,'adjustable-shaft');tube([[-.07,.92,0],[-.07,1,0],[.04,1.015,0],[.18,1.015,0]],.027,dark,'cane-handle');
  for(const x of [-.12,.12])for(const z of [-.15,.15]){strut([0,.13,0],[x,.035,z],.015);cylinder(.027,.045,x,.023,z,rubber,'quad-foot');}
  for(let n=0;n<5;n++)box(.014,.012,.007,0,.38+n*.052,.022,dark,'adjustment-hole');break;
 case 'rollator':
  for(const x of [-.30,.30]){tube([[x*.95,.12,.27],[x,.5,.19],[x,.92,-.21],[x,.94,-.32]],.022);strut([x,.57,.17],[x,.14,-.29],.022);wheel(x,.10,.30,.10);wheel(x,.10,-.30,.10);box(.055,.035,.16,x,.96,-.28,dark,'handle-grip');tube([[x,.915,-.32],[x,.89,-.28],[x,.88,-.19]],.011,dark,'brake-lever');strut([x,.86,-.2],[x,.2,.26],.004,dark,'brake-cable');}
  seatPanel(.52,.32,.55);box(.45,.19,.29,0,.375,.08,dark,'shopping-basket');tube([[-.3,.72,.12],[-.18,.79,.14],[.18,.79,.14],[.3,.72,.12]],.027,body,'support-back-bar');strut([-.3,.35,-.2],[.3,.35,-.2]);break;
 case 'manual-wheelchair':wheelchair(false);break;
 case 'power-wheelchair':wheelchair(true);break;
 case 'round-shower-stool':seatPanel(.50,.50,.46,{round:true,drain:true,m:white});legs(.43,.43,.46);break;
 case 'shower-armchair':
  seatPanel(.58,.47,.48,{drain:true,m:white});legs(.57,.51,.48);back(.55,.81,-.25,white);arms(.68,.70,.44,body);for(const x of [-.16,0,.16])box(.025,.12,.057,x,.80,-.25,dark,'back-drain-slot');break;
 case 'wall-folding-seat':
  seatPanel(.58,.49,.47,{drain:true,m:white});box(.62,.30,.055,0,.51,-.29,metal,'wall-mount-plate');
  for(const x of [-.23,.23]){const hinge=cylinder(.04,.09,x,.49,-.24,accent,'fold-hinge');hinge.rotation.z=Math.PI/2;strut([x,.47,-.24],[x,.09,.18],.018);foot(x,.20,.45);for(const y of [.42,.60]){const bolt=cylinder(.019,.012,x,y,-.326,dark,'wall-fixing');bolt.rotation.x=Math.PI/2;}}
  strut([-.24,.21,.18],[.24,.21,.18]);break;
 case 'swivel-shower-chair':
  seatPanel(.56,.56,.51,{round:true,drain:true,m:white});legs(.55,.55,.35);cylinder(.14,.11,0,.425,0,metal,'rotating-bearing');cylinder(.21,.035,0,.49,0,accent,'swivel-turntable');
  tube([[-.27,.59,-.12],[-.27,.84,-.19],[0,.88,-.26],[.27,.84,-.19],[.27,.59,-.12]],.032,body,'curved-backrest');arms(.63,.69,.36);box(.08,.035,.07,.22,.46,.08,accent,'swivel-lock');break;
 case 'wheeled-shower-commode':
  ringSeat(.58,.51,.51,.07,body);back(.55,.86,-.28,body);arms(.69,.73,.46);cylinder(.17,.23,0,.34,0,white,'removable-pan');
  for(const x of [-.29,.29])for(const z of [-.26,.26]){strut([x,.18,z],[x,.54,z],.02);caster(x,z);}
  for(const x of [-.20,.20]){strut([x,.48,.24],[x,.16,.48]);box(.18,.025,.20,x,.15,.48,dark,'footplate');}break;
 case 'toilet-seat-raiser':
  ringSeat(.62,.53,.13,.14,white);for(const x of [-.27,.27]){box(.045,.13,.11,x,.09,0,metal,'toilet-fixing-clamp');cylinder(.038,.055,x,.055,.065,accent,'clamp-knob');}
  for(const x of [-.37,.37]){tube([[x,.13,-.16],[x,.43,-.16],[x,.45,.16],[x,.13,.16]],.021,metal,'raiser-arm-frame');box(.06,.045,.36,x,.45,0,body,'raiser-arm-grip');}box(.19,.045,.065,0,.09,.27,accent,'front-lock');break;
 case 'bedside-commode':{
  ringSeat(.56,.48,.48,.055,white);legs(.59,.52,.48);back(.57,.78,-.25,wood);arms(.67,.67,.43,wood);cylinder(.16,.24,0,.32,0,body,'bedside-pan');
  const lid=panel(discShape(.43,.38),.025,0,.51,-.19,body,'raised-seat-cover');lid.rotation.x=-1.1;strut([-.27,.22,-.24],[.27,.22,-.24]);break;}
 case 'wall-grab-rail':
  tube([[-.27,.055,0],[.24,.055,0],[.27,.08,0],[.27,.62,0]],.024,metal,'L-grab-rail');
  for(const [x,y] of [[-.27,.055],[.27,.055],[.27,.62]]){strut([x,y,0],[x,y,-.07],.018);const flange=cylinder(.05,.018,x,y,-.075,metal,'mounting-flange');flange.rotation.x=Math.PI/2;}
  for(let n=0;n<9;n++){const rib=cylinder(.027,.006,-.20+n*.045,.055,0,body,'grip-rib');rib.rotation.z=Math.PI/2;}break;
 case 'anti-slip-mat':
  panel(roundedShape(1,.70,.08),.015,0,0,0,rubber,'mat-border');panel(roundedShape(.93,.63,.06),.008,0,.015,0,body,'mat-inner');
  for(let x=-.40;x<=.41;x+=.08)for(let z=-.25;z<=.26;z+=.08)cylinder(.014,.006,x,.026,z,body,'grip-nub');for(const z of [-.15,0,.15])box(.75,.002,.008,0,.024,z,dark,'drainage-channel');break;
 case 'anti-slip-tiles':
  box(1,.012,1,0,.006,0,material('#8e978a',.95),'grout-bed');for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){box(.322,.014,.322,x/3,.019,z/3,(x+z)%2?body:white,'rough-tile');for(let n=-2;n<=2;n++)box(.27,.0015,.003,x/3,.027,z/3+n*.045,body,'tile-texture');}break;
 case 'electric-care-bed':{
  box(.87,.12,1.80,0,.37,0,metal,'lifting-platform');box(.82,.10,1.12,0,.51,.24,white,'mattress-base');const raised=box(.82,.11,.65,0,.66,-.60,white,'raised-back-section');raised.rotation.x=-.36;
  box(.82,.09,.31,0,.56,.68,body,'knee-section');for(const z of [-.93,.93])box(.95,.70,.06,0,.43,z,wood,'bed-end-board');
  for(const x of [-.47,.47]){tube([[x,.46,-.66],[x,.88,-.66],[x,.88,.63],[x,.46,.63]],.018,metal,'bed-side-rail');for(let z=-.5;z<=.51;z+=.25)strut([x,.52,z],[x,.86,z],.013,metal,'rail-upright');}
  for(const x of [-.35,.35])for(const z of [-.72,.72]){strut([x,.14,z],[x,.35,z]);caster(x,z);}
  const remote=box(.065,.15,.035,.50,.65,.45,dark,'bed-controller');remote.rotation.z=.1;for(let n=0;n<3;n++)box(.025,.017,.004,.50,.61+n*.035,.471,accent,'bed-control-button');box(.58,.075,.28,0,.805,-.71,body,'bed-pillow');break;}
 case 'reminder-pillbox':
  panel(roundedShape(1,.54,.05),.10,0,0,0,white,'pillbox-body');for(let n=0;n<7;n++){const x=-.42+n*.14;box(.125,.08,.34,x,.14,.05,n%2?body:accent,'daily-compartment');for(let mark=0;mark<=n%3;mark++)box(.013,.004,.035,x+(mark-n%3/2)*.025,.182,.10,dark,'raised-day-mark');}
  box(.35,.025,.10,-.20,.12,-.19,dark,'reminder-display');for(let n=0;n<3;n++)box(.055,.003,.014,-.30+n*.09,.134,-.19,white,'display-digit');cylinder(.037,.02,.33,.13,-.19,body,'reminder-button');break;
 default:throw Error('未知的器具模型：'+model);
 }

 group.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 if(![size.x,size.y,size.z].every(value=>Number.isFinite(value)&&value>0))throw Error('器具模型包絡無效。');
 for(const child of group.children)child.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
 group.scale.set(item.w/size.x,item.h/size.y,item.d/size.z);group.position.set(item.x??0,0,item.z??0);group.rotation.y=-(item.rotation??0)*Math.PI/180;
 Object.assign(group.userData,{id:item.id,productId:item.productId,sourceRecordId:item.sourceRecordId,careModel:model,dimensionSource:item.dimensionSource||'concept',categoryIllustration:true,units:'m',dimensions:{w:item.w,d:item.d,h:item.h}});
 return group;
}
