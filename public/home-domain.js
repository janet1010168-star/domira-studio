import {CATALOG,itemBounds,clampItem,clearanceMetrics} from './domain.js';
export const HOME_KINDS={living:'客廳',bedroom:'睡房',dining:'飯廳',work:'書房',kitchen:'廚房',bathroom:'浴室',hall:'走廊',balcony:'露台',other:'其他空間'};
export const HOME_COLORS={living:'#b7bca3',bedroom:'#a7b7bb',dining:'#c4b494',work:'#a9bba5',kitchen:'#c5baa6',bathroom:'#9dbab8',hall:'#b9b4a7',balcony:'#a4b99a',other:'#b3a8bb'};
const finiteHome=n=>Number.isFinite(n),roundHome=n=>Math.round(n*1000)/1000;
export function validatePlanAnalysis(raw){if(!raw||!Array.isArray(raw.rooms)||raw.rooms.length<1||raw.rooms.length>12)throw new Error('圖紙需辨識出 1–12 個空間；請裁切為單層平面圖。');const ids=new Set();const rooms=raw.rooms.map((r,index)=>{const b=r.rect;if(!b||!['x','y','w','h'].every(k=>finiteHome(b[k]))||b.x<0||b.y<0||b.w<15||b.h<15||b.x+b.w>1002||b.y+b.h>1002)throw new Error('AI 房間位置格式不完整，請換一張清晰圖紙重試。');const id='space-'+index;ids.add(id);const openings=(Array.isArray(r.openings)?r.openings:[]).slice(0,12).filter(o=>['top','right','bottom','left'].includes(o.edge)&&['door','window'].includes(o.kind)&&finiteHome(o.offset)&&finiteHome(o.width)&&o.offset>=0&&o.width>=.03&&o.offset+o.width<=1.001).map(o=>({kind:o.kind,edge:o.edge,offset:roundHome(o.offset),width:roundHome(o.width)}));return {id,name:String(r.name||'空間 '+(index+1)).slice(0,40),kind:HOME_KINDS[r.kind]?r.kind:'other',rect:{x:Math.max(0,b.x),y:Math.max(0,b.y),w:Math.min(b.w,1000-b.x),h:Math.min(b.h,1000-b.y)},confidence:['high','medium','low'].includes(r.confidence)?r.confidence:'low',openings,notes:String(r.notes||'').slice(0,160),area_sqm:finiteHome(r.area_sqm)&&r.area_sqm>=.5&&r.area_sqm<=200?roundHome(r.area_sqm):null,furniture:(Array.isArray(r.furniture)?r.furniture:[]).slice(0,30).filter(f=>f&&['sofa','bed','table','chair','cabinet','wardrobe','stove','sink','fridge','toilet','shower','tv','desk','other'].includes(f.kind)&&f.bbox&&['x','y','w','h'].every(k=>finiteHome(f.bbox[k]))).map(f=>({name:String(f.name||'').slice(0,30),kind:f.kind,bbox:{x:f.bbox.x,y:f.bbox.y,w:f.bbox.w,h:f.bbox.h},confidence:['high','medium','low'].includes(f.confidence)?f.confidence:'low'}))};});const left=Math.min(...rooms.map(r=>r.rect.x)),top=Math.min(...rooms.map(r=>r.rect.y)),right=Math.max(...rooms.map(r=>r.rect.x+r.rect.w)),bottom=Math.max(...rooms.map(r=>r.rect.y+r.rect.h));const span=Math.max(right-left,bottom-top)||1,unit=1000/span,frameW=(right-left)*unit,frameH=(bottom-top)*unit;for(const r of rooms){r.rect={x:(r.rect.x-left)*unit+(1000-frameW)/2,y:(r.rect.y-top)*unit+(1000-frameH)/2,w:r.rect.w*unit,h:r.rect.h*unit};}const dimensioned=raw.scale?.basis==='dimensioned',dim=key=>dimensioned&&finiteHome(raw.scale?.[key])&&raw.scale[key]>=2&&raw.scale[key]<=40?raw.scale[key]:null,sideSum=a=>Array.isArray(a)&&a.length>=1&&a.length<=12&&a.every(v=>finiteHome(v)&&v>=200&&v<=20000)?a.reduce((s,v)=>s+v,0):0,dg=raw.dimensions&&raw.dimensions.unit==='mm'?raw.dimensions:null,mw=dg?Math.max(sideSum(dg.top),sideSum(dg.bottom)):0,md=dg?Math.max(sideSum(dg.left),sideSum(dg.right)):0,measured=mw>=2000&&mw<=40000&&md>=2000&&md<=40000?{width:roundHome(mw/1000),depth:roundHome(md/1000),basis:'dimensioned'}:null;return {format:'domira.floorplan-analysis.v1',rooms,scale:measured||{width:dim('width'),depth:dim('depth'),basis:raw.scale?.basis==='dimensioned'?'dimensioned':'unknown'},dimensions:dg,frame:{w:right-left,h:bottom-top},summary:String(raw.summary||'請逐間核對 AI 辨識結果。').slice(0,500),warnings:(Array.isArray(raw.warnings)?raw.warnings:[]).slice(0,8).map(s=>String(s).slice(0,200)),model:'deepseek-flash',engine:'remote-vision'};}
function resolveOverlaps(home){const rooms=home.rooms,hw=home.width/2,hd=home.depth/2;for(let iter=0;iter<200;iter++){let worst=0;for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){const a=rooms[i],b=rooms[j],ox=(a.width+b.width)/2-Math.abs(a.x-b.x),oz=(a.depth+b.depth)/2-Math.abs(a.z-b.z);if(ox<=.001||oz<=.001)continue;worst=Math.max(worst,Math.min(ox,oz));const push=.6;if(ox<=oz){const s=(ox/2+.005)*push*(a.x>=b.x?1:-1);a.x+=s;b.x-=s;}else{const s=(oz/2+.005)*push*(a.z>=b.z?1:-1);a.z+=s;b.z-=s;}}for(const r of rooms){r.x=Math.min(hw-r.width/2,Math.max(-hw+r.width/2,r.x));r.z=Math.min(hd-r.depth/2,Math.max(-hd+r.depth/2,r.z));}if(worst<.01)break;}for(const r of rooms){r.x=roundHome(r.x);r.z=roundHome(r.z);}return home;}
export function homeFromAnalysis(analysis,width,depth,height=2.7,strict=true,options={}){const a=validatePlanAnalysis(analysis);const fu=1000/Math.max(a.frame?.w||1000,a.frame?.h||1000),FW=(a.frame?.w||1000)*fu,FH=(a.frame?.h||1000)*fu,OX=(1000-FW)/2,OY=(1000-FH)/2;const rooms=a.rooms.map(r=>({id:r.id,name:r.name,kind:r.kind,purpose:['bedroom','dining','work'].includes(r.kind)?r.kind:'living',x:roundHome(((r.rect.x+r.rect.w/2-OX)/FW-.5)*width),z:roundHome(((r.rect.y+r.rect.h/2-OY)/FH-.5)*depth),width:roundHome(r.rect.w/FW*width),depth:roundHome(r.rect.h/FH*depth),height:Number(height),confidence:r.confidence,notes:r.notes,openings:r.openings,items:[]}));const home={format:'domira.home.v1',width:Number(width),depth:Number(depth),height:Number(height),source:'ai-floorplan',model:analysis.model||'deepseek-flash',scaleConfirmed:true,summary:a.summary,warnings:[...(a.warnings||[])],rooms};let corrected=0;if(options.correctArea!==false){resolveOverlaps(home);const byId=new Map(a.rooms.map(r=>[r.id,r]));for(const room of rooms){const target=byId.get(room.id)?.area_sqm;if(!target||target<=0)continue;const rectArea=room.width*room.depth,err=Math.abs(rectArea-target)/target;if(err<=.08)continue;const ratio=Math.min(1.35,Math.max(.55,Math.sqrt(target/rectArea)));room.width=roundHome(room.width*ratio);room.depth=roundHome(room.depth*ratio);corrected++;}if(corrected){resolveOverlaps(home);home.warnings.push('已用圖上標註面積校正 '+corrected+' 間房的尺寸（面積優先於 rect 比例，個別牆線可能偏移）；因標註面積是淨面積、牆體未計入，嚴格重疊檢查已跳過。');}}return strict&&!corrected?validateHome(home):home;}
export function validateHome(home){if(!home||home.format!=='domira.home.v1'||!['width','depth','height'].every(k=>finiteHome(home[k])&&home[k]>=(k==='height'?2:2)&&home[k]<=(k==='height'?6:40))||!Array.isArray(home.rooms)||!home.rooms.length||home.rooms.length>12)throw new Error('全屋長寬需為 2–40m、層高 2–6m，並包含 1–12 個空間。');const ids=new Set(),itemIds=new Set();let count=0;for(const r of home.rooms){if(typeof r.id!=='string'||ids.has(r.id))throw new Error('房間識別碼重複。');ids.add(r.id);if(!['x','z','width','depth','height'].every(k=>finiteHome(r[k]))||r.width<.6||r.depth<.6||r.width>20||r.depth>20||r.height<2||r.height>6||Math.abs(r.x)+r.width/2>home.width/2+.03||Math.abs(r.z)+r.depth/2>home.depth/2+.03)throw new Error((r.name||'房間')+' 的尺寸或位置超出全屋範圍；單間長寬需為 0.6–20m。');r.name=String(r.name||'未命名空間').slice(0,40);r.kind=HOME_KINDS[r.kind]?r.kind:'other';r.purpose=['living','reading','social','bedroom','work','dining'].includes(r.purpose)?r.purpose:'living';r.openings=(r.openings||[]).filter(o=>['top','right','bottom','left'].includes(o.edge)&&['door','window'].includes(o.kind)&&finiteHome(o.offset)&&finiteHome(o.width)&&o.offset>=0&&o.width>=.03&&o.offset+o.width<=1.001).slice(0,12);if(!Array.isArray(r.items)||r.items.length>50)throw new Error('單間家具不得超過 50 件。');for(const i of r.items){if(!CATALOG[i.type]||typeof i.id!=='string'||itemIds.has(i.id)||!['x','z','rotation','w','d','h'].every(k=>finiteHome(i[k]))||!['w','d','h'].every(k=>i[k]>0&&i[k]<15))throw new Error('全屋家具格式不正確或識別碼重複。');const b=itemBounds(i);if(Math.abs(i.x)+b.w/2>r.width/2+.05||Math.abs(i.z)+b.d/2>r.depth/2+.05)throw new Error('家具超出所屬房間。');itemIds.add(i.id);count++;}}if(count>120)throw new Error('全屋最多保留 120 件家具。');for(let i=0;i<home.rooms.length;i++)for(let j=i+1;j<home.rooms.length;j++){const a=home.rooms[i],b=home.rooms[j],x=(a.width+b.width)/2-Math.abs(a.x-b.x),z=(a.depth+b.depth)/2-Math.abs(a.z-b.z);if(x>.04&&z>.04)throw new Error(a.name+' 與 '+b.name+' 重疊，請核對房間座標及尺寸。');}return home;}
export function homeRoomData(room){return {width:room.width,depth:room.depth,height:room.height,source:'floorplan-room',units:'m',coordinateSystem:'right-handed-y-up',planRoom:{name:room.name,kind:room.kind,openings:room.openings}};}
export function syncHomeProject(project){if(!project.home)return;const active=project.home.rooms.find(r=>r.id===project.activeRoomId);if(!active)throw new Error('找不到目前房間。');active.items=project.items;active.style=project.style;active.purpose=project.purpose;active.furnitureAdvice=project.furnitureAdvice||null;active.layoutDescription=project.layoutDescription||null;active.engine=project.engine||'local-rules';}
export function homeItems(project,world=false){if(!project.home)return project.items;return project.home.rooms.flatMap(r=>(r.id===project.activeRoomId?project.items:r.items).map(i=>({...i,...(world?{x:i.x+r.x,z:i.z+r.z}:{}),roomId:r.id,roomName:r.name})));}
export function planWalls(home){const lines=new Map();for(const room of home.rooms){const x=room.x-room.width/2,z=room.z-room.depth/2;for(const edge of ['top','bottom','left','right']){const axis=['top','bottom'].includes(edge)?'x':'z',coordinate=axis==='x'?z+(edge==='bottom'?room.depth:0):x+(edge==='right'?room.width:0),start=axis==='x'?x:z,length=axis==='x'?room.width:room.depth,key=axis+':'+Math.round(coordinate*100),openings=room.openings.filter(o=>o.edge===edge).map(o=>({start:start+o.offset*length,end:start+(o.offset+o.width)*length,kind:o.kind}));if(!lines.has(key))lines.set(key,{axis,coordinate,edges:[]});lines.get(key).edges.push({start,end:start+length,height:room.height,openings});}}
 const segments=[];for(const {axis,coordinate,edges} of lines.values()){const cuts=[...new Set(edges.flatMap(e=>[e.start,e.end,...e.openings.flatMap(o=>[o.start,o.end])]).map(n=>Math.round(n*1000)/1000))].sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){const start=cuts[i-1],end=cuts[i],middle=(start+end)/2,cover=edges.filter(e=>middle>=e.start-.001&&middle<=e.end+.001);if(!cover.length||end-start<.015)continue;const openings=cover.flatMap(e=>e.openings).filter(o=>middle>=o.start&&middle<=o.end),kind=openings.some(o=>o.kind==='door')?'door':openings.length?'window':'wall';segments.push({axis,x:axis==='x'?middle:coordinate,z:axis==='z'?middle:coordinate,length:end-start,height:Math.max(...cover.map(e=>e.height)),kind});}}return segments;}
export function homePlanSVG(home){const width=900,scale=780/Math.max(home.width,home.depth),w=home.width*scale,h=home.depth*scale,ox=(width-w)/2,oy=65;const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${h+140}" viewBox="0 0 900 ${h+140}"><rect width="100%" height="100%" fill="#10171b"/><text x="50" y="32" fill="#d1e4d7" font-size="17" font-family="sans-serif">DOMIRA / ${home.rooms.length} 個空間 · ${home.width.toFixed(2)} × ${home.depth.toFixed(2)} m</text>${home.rooms.map(r=>`<rect x="${ox+(r.x-r.width/2+home.width/2)*scale}" y="${oy+(r.z-r.depth/2+home.depth/2)*scale}" width="${r.width*scale}" height="${r.depth*scale}" fill="${HOME_COLORS[r.kind]||HOME_COLORS.other}" opacity=".24"/>`).join('')}${planWalls(home).map(s=>{const x=ox+(s.x+home.width/2)*scale,y=oy+(s.z+home.depth/2)*scale,half=s.length*scale/2;return `<line x1="${s.axis==='x'?x-half:x}" x2="${s.axis==='x'?x+half:x}" y1="${s.axis==='z'?y-half:y}" y2="${s.axis==='z'?y+half:y}" stroke="${s.kind==='door'?'#d2b77f':s.kind==='window'?'#7eafbf':'#d5ddd4'}" stroke-width="${s.kind==='wall'?3:2}" ${s.kind==='door'?'stroke-dasharray="4 5"':''}/>`;}).join('')}${home.rooms.flatMap(r=>(r.items||[]).map(i=>{const color=/^#[0-9a-f]{6}$/i.test(i.color||'')?i.color:'#8fa68f';return `<g transform="translate(${ox+(r.x+i.x+home.width/2)*scale} ${oy+(r.z+i.z+home.depth/2)*scale}) rotate(${i.rotation})"><rect x="${-i.w*scale/2}" y="${-i.d*scale/2}" width="${i.w*scale}" height="${i.d*scale}" rx="3" fill="${color}" fill-opacity="${i.type==='rug'?.2:.7}" stroke="#d0e1d8" stroke-opacity=".4"/><title>${safe(i.name||i.type)}</title></g>`;})).join('')}${home.rooms.map(r=>`<text x="${ox+(r.x+home.width/2)*scale}" y="${oy+(r.z+home.depth/2)*scale-4}" text-anchor="middle" fill="#e4eee7" font-size="14" font-family="sans-serif">${safe(r.name)}<tspan x="${ox+(r.x+home.width/2)*scale}" dy="19" font-size="10" fill="#a6b9ac">${r.width.toFixed(2)} × ${r.depth.toFixed(2)} m</tspan></text>`).join('')}<text x="50" y="${h+115}" fill="#a7bbae" font-size="11" font-family="sans-serif">AI 矩形近似 · 金色虛線為門洞 / 藍線為窗 · 需實測核對，非施工圖</text></svg>`;}

// ── 房間相鄰圖：方向 3 的前置 ──────────────────────────────────────────
// 為什麼必須先做這個：openings 只記錄「哪面牆有門」，不知道門通往哪一間房。
// 所以「床 → 門 → 走廊 → 廁所」這種跨房路線，之前根本無從檢查，只能檢查單一門寬。
// 判定規則：兩間房共享一段邊界（重疊 > 0.3 m），且門正好落在共享段上，才算相通。
export function buildRoomGraph(home){
 const rooms=(home&&home.rooms)||[],tol=.03;
 const L=r=>r.x-r.width/2,R=r=>r.x+r.width/2,T=r=>r.z-r.depth/2,B=r=>r.z+r.depth/2;
 // 門的世界座標區間：edge 起點 + offset×邊長。寬度換算成公尺（offset/width 都是 0–1 的比例）。
 const doorsOn=(room,edge,lo,hi)=>{
  const horizontal=['top','bottom'].includes(edge),len=horizontal?room.width:room.depth,start=horizontal?L(room):T(room);
  return (room.openings||[]).filter(o=>o.edge===edge&&o.kind==='door').map(o=>{
   const a=start+o.offset*len,b=a+o.width*len;
   return {width:Math.round(o.width*len*100)/100,from:a,to:b};
  }).filter(d=>Math.min(d.to,hi)-Math.max(d.from,lo)>.05);
 };
 const edges=[];
 for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){
  const a=rooms[i],b=rooms[j],pairs=[];
  if(Math.abs(B(a)-T(b))<=tol)pairs.push(['bottom','top']);
  if(Math.abs(T(a)-B(b))<=tol)pairs.push(['top','bottom']);
  if(Math.abs(R(a)-L(b))<=tol)pairs.push(['right','left']);
  if(Math.abs(L(a)-R(b))<=tol)pairs.push(['left','right']);
  for(const [edgeA,edgeB] of pairs){
   const axis=['top','bottom'].includes(edgeA)?'x':'z';
   const lo=axis==='x'?Math.max(L(a),L(b)):Math.max(T(a),T(b));
   const hi=axis==='x'?Math.min(R(a),R(b)):Math.min(B(a),B(b));
   if(hi-lo<=.3)continue;
   const found=[...doorsOn(a,edgeA,lo,hi),...doorsOn(b,edgeB,lo,hi)];
   // 同一道門會在共享牆兩側各記一次；起點相同、寬度相近的視為同一扇。
   const unique=found.filter((d,k)=>found.findIndex(e=>Math.abs(e.from-d.from)<.06&&Math.abs(e.width-d.width)<.06)===k);
   if(!unique.length)continue;
   const door=unique.reduce((m,d)=>d.width<m.width?d:m);
   edges.push({a:a.id,b:b.id,shared:{axis,lo:Math.round(lo*100)/100,hi:Math.round(hi*100)/100,length:Math.round((hi-lo)*100)/100},door:{width:door.width,from:Math.round(door.from*100)/100,to:Math.round(door.to*100)/100},doors:unique.map(d=>({width:d.width,from:Math.round(d.from*100)/100,to:Math.round(d.to*100)/100}))});
  }
 }
 return {nodes:rooms.map(r=>({id:r.id,name:r.name,kind:r.kind})),edges};
}

// 夜間動線：睡房 →（有門相連的房間）→ 浴室。只回答「走得通嗎、門夠寬嗎、每間房淨寬夠不夠」，
// 不假裝知道床邊到門的實際步距——那需要家具與門的連線距離，現在只有房間矩形。
export function nightRoute(home,{mobility='standard'}={}){
 const rooms=(home&&home.rooms)||[],byId=new Map(rooms.map(r=>[r.id,r]));
 const start=rooms.find(r=>r.kind==='bedroom'),goals=rooms.filter(r=>r.kind==='bathroom');
 if(!start)return {ok:false,status:'unavailable',detail:'全屋沒有睡房，夜間路線沒有起點。'};
 if(!goals.length)return {ok:false,status:'unavailable',detail:'全屋沒有浴室，夜間路線沒有終點。'};
 const graph=buildRoomGraph(home),adj=new Map();
 for(const e of graph.edges){if(!adj.has(e.a))adj.set(e.a,[]);if(!adj.has(e.b))adj.set(e.b,[]);adj.get(e.a).push(e);adj.get(e.b).push(e);}
 // BFS：無權圖，房間數最多 12，不需要 Dijkstra。
 const prev=new Map(),queue=[start.id],seen=new Set([start.id]),goalIds=new Set(goals.map(g=>g.id));
 let target=null;
 while(queue.length&&!target){
  const id=queue.shift();
  for(const e of adj.get(id)||[]){
   const next=e.a===id?e.b:e.a;
   if(seen.has(next))continue;
   seen.add(next);prev.set(next,{from:id,edge:e});
   if(goalIds.has(next)){target=next;break;}
   queue.push(next);
  }
 }
 if(!target)return {ok:false,status:'warn',detail:'睡房與浴室之間找不到有門相連的路徑——平面圖上兩間房沒有共享一段帶門的牆，可能中間隔著沒標門的空間。'};
 const path=[];
 for(let cur=target;cur;cur=(prev.get(cur)||{}).from)path.unshift(cur);
 const doorMin=mobility==='wheelchair'?.85:.8,runNeed=mobility==='wheelchair'?1.05:.6;
 const roomInfo=path.map(id=>{
  const r=byId.get(id),m=clearanceMetrics(r.items||[],r);
  return {id,name:r.name,kind:r.kind,run:m.run,square:m.square,need:runNeed,status:m.run>=runNeed?'pass':'warn'};
 });
 const doorInfo=[];
 for(let i=1;i<path.length;i++){
  const e=(prev.get(path[i])||{}).edge,w=e?e.door.width:0;
  doorInfo.push({from:byId.get(path[i-1]).name,to:byId.get(path[i]).name,width:w,min:doorMin,status:w>=doorMin?'pass':'warn'});
 }
 const startRoom=byId.get(path[0]);
 const nightKit={hasWardrobe:!!(startRoom.items||[]).find(i=>i.type==='wardrobe'),detail:startRoom.items&&startRoom.items.find(i=>i.type==='wardrobe')?'睡房有衣櫃，取衣不必離開房間。':'睡房沒有衣櫃，夜間取衣要走到別的房間。'};
 const bad=roomInfo.filter(r=>r.status==='warn').length+doorInfo.filter(d=>d.status==='warn').length;
 return {ok:true,status:bad?'warn':'pass',rooms:roomInfo,doors:doorInfo,path:path.map(id=>byId.get(id).name),mobility,doorMin,runNeed,nightKit,detail:`${path.map(id=>byId.get(id).name).join(' → ')}（${path.length-1} 道門，最窄 ${Math.min(...doorInfo.map(d=>d.width)).toFixed(2)} m）`};
}
