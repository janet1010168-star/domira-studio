import * as THREE from './vendor/three.module.js';

// Category illustrations, normalized to the supplied overall envelope. Not SKU models.
export function careFurniture(item){
 const g=new THREE.Group(),kind=item.careKind,body=new THREE.MeshStandardMaterial({color:item.color,roughness:.7}),metal=new THREE.MeshStandardMaterial({color:'#a1aaa6',metalness:.45,roughness:.4}),dark=new THREE.MeshStandardMaterial({color:'#39413e',roughness:.9});
 const box=(w,h,d,x,y,z,m=body)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
 const pole=(x,z,h=1,y=h/2)=>box(.045,h,.045,x,y,z,metal);
 const wheel=(x,y,z,r=.12)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.055,24),dark);o.rotation.z=Math.PI/2;o.position.set(x,y,z);g.add(o);return o;};
 const seat=(arms=true,back=true)=>{box(.78,.09,.7,0,.5,0);for(const x of [-.34,.34])for(const z of [-.28,.28])pole(x,z,.48);if(back)box(.78,.4,.07,0,.77,-.31);if(arms)for(const x of [-.42,.42]){box(.055,.055,.72,x,.72,0,metal);pole(x,.25,.21,.61);}};
 if(kind==='cane'){pole(0,0,.95);box(.4,.055,.075,.12,.98,0,dark);box(.3,.025,.3,0,.015,0,dark);}
 else if(kind==='walker'){for(const x of [-.4,.4]){for(const z of [-.32,.32])pole(x,z,.9);box(.055,.055,.72,x,.9,0,metal);wheel(x,.08,.32,.08);}box(.8,.045,.045,0,.62,-.32,metal);box(.65,.06,.35,0,.51,-.07);}
 else if(kind==='wheelchair'){seat();for(const x of [-.48,.48]){wheel(x,.31,-.15,.3);wheel(x,.09,.39,.09);pole(x,-.37,1);box(.16,.04,.24,x*.62,.13,.48,metal);}}
 else if(kind==='rail'){for(const x of [-.44,.44])pole(x,0,.18,.1);box(.94,.06,.06,0,.2,0,metal);}
 else if(kind==='surface')box(1,.015,1,0,.0075,0);
 else if(kind==='care-bed'){box(.9,.14,1.8,0,.43,0);box(.9,.12,1.8,0,.56,0,new THREE.MeshStandardMaterial({color:'#e8e5d7'}));for(const z of [-.9,.9])box(.96,.75,.055,0,.42,z,metal);for(const x of [-.5,.5]){box(.04,.04,1.5,x,.82,0,metal);for(const z of [-.65,.65])pole(x,z,.28,.68);}for(const x of [-.36,.36])for(const z of [-.72,.72])wheel(x,.08,z,.08);}
 else if(kind==='pillbox'){box(1,.15,.5,0,.08,0);for(let x=-3;x<=3;x++)box(.125,.025,.45,x*.14,.17,0,new THREE.MeshStandardMaterial({color:x%2?'#ddd6a5':'#9cbdad'}));}
 else if(kind==='toilet'){box(.58,.48,.62,0,.25,.08,new THREE.MeshStandardMaterial({color:'#f5f6ef'}));box(.62,.09,.68,0,.52,.07);box(.62,.45,.19,0,.65,-.27);}
 else if(kind==='commode'){seat(true,true);box(.42,.3,.43,0,.32,0,new THREE.MeshStandardMaterial({color:'#e8eae3'}));for(const x of [-.34,.34])for(const z of [-.28,.28])wheel(x,.06,z,.06);}
 else if(kind==='stool')seat(false,false);
 else if(kind==='folding'){seat(false,true);for(const x of [-.39,.39])pole(x,-.35,1);}
 else {seat(kind==='swivel',true);if(kind==='swivel')box(.26,.22,.26,0,.28,0,metal);}
 g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());
 for(const child of g.children){child.position.x-=c.x;child.position.y-=b.min.y;child.position.z-=c.z;}
 g.scale.set(item.w/s.x,item.h/s.y,item.d/s.z);g.position.set(item.x,0,item.z);g.rotation.y=-item.rotation*Math.PI/180;g.userData.id=item.id;g.userData.categoryIllustration=true;return g;
}
