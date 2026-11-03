// Local geometric planning; widths are design targets, not certification.
import {layoutOpenings} from './domain.js';
// 三檔數值必須能說出來源：只有輪椅檔有法規可引，其餘兩檔是設計慣例。
// width 是「走道淨寬」，不是迴旋空間；迴旋另由 checkClearances 的 turning 檢查。
export const MOBILITY_PROFILES={standard:{name:'日常步行',width:.7,basis:'經驗值'},senior:{name:'適老步行',width:.9,basis:'經驗值'},wheelchair:{name:'輪椅／行動不便',width:1.05,basis:'《設計手冊》'}};
export function planningSignature(project){return JSON.stringify([project.id,project.activeRoomId,project.homeView,project.mobility,project.style,project.purpose,project.room,project.items.map(i=>[i.id,i.type,i.w,i.d,i.x,i.z,i.rotation,i.locked])]);}
export function pointClearance(point,item){const a=(item.rotation||0)*Math.PI/180,dx=point[0]-item.x,dz=point[1]-item.z,x=dx*Math.cos(a)+dz*Math.sin(a),z=-dx*Math.sin(a)+dz*Math.cos(a);return Math.hypot(Math.max(Math.abs(x)-item.w/2,0),Math.max(Math.abs(z)-item.d/2,0));}
// Exact distance between a line segment and a rotated furniture rectangle.
export function segmentClearance(a,b,item){
 const angle=(item.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),local=p=>[(p[0]-item.x)*c+(p[1]-item.z)*s,-(p[0]-item.x)*s+(p[1]-item.z)*c];
 const p=local(a),q=local(b),hw=item.w/2,hd=item.d/2;
 if([p,q].some(v=>Math.abs(v[0])<=hw&&Math.abs(v[1])<=hd))return 0;
 const corners=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]],cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const pointLine=(a,b,p)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(a[0]+dx*t-p[0],a[1]+dy*t-p[1]);};
 let best=Infinity;for(let i=0;i<4;i++){const r=corners[i],t=corners[(i+1)%4];const overlap=Math.max(Math.min(p[0],q[0]),Math.min(r[0],t[0]))<=Math.min(Math.max(p[0],q[0]),Math.max(r[0],t[0]))&&Math.max(Math.min(p[1],q[1]),Math.min(r[1],t[1]))<=Math.min(Math.max(p[1],q[1]),Math.max(r[1],t[1]));if(overlap&&cross(p,q,r)*cross(p,q,t)<=0&&cross(r,t,p)*cross(r,t,q)<=0)return 0;best=Math.min(best,pointLine(p,q,r),pointLine(p,q,t),pointLine(r,t,p),pointLine(r,t,q));}return best;
}
export function planCirculation(project,{profile='senior',entry='bottom',offset=.5,targetId,step=.15,door=null}={}){
 const room=project.room,items=project.items,target=items.find(i=>i.id===targetId),preset=MOBILITY_PROFILES[profile];
 if(!preset||!target||!['top','bottom','left','right'].includes(entry)||!Number.isFinite(offset)||offset<0||offset>1||!Number.isFinite(step)||step<.1||step>.3)throw new Error('請選擇有效的起點、目的地與使用需求。');
 const radius=preset.width/2,margin=radius+step*.72,obstacles=items.filter(i=>i.type!=='rug'),w=room.width,d=room.depth;
 if(!Number.isFinite(w)||!Number.isFinite(d)||w<=0||d<=0||w>40||d>40)throw new Error('房間尺寸不正確。');
 const cols=Math.floor((w-2*margin)/step)+1,rows=Math.floor((d-2*margin)/step)+1;
 const empty={ok:false,path:[],visited:[],length:0,width:preset.width,profile,reason:'空間不足以容納所選通道寬度。'};if(cols<1||rows<1)return empty;
 if(door){const actual=layoutOpenings(room).find(o=>o.kind==='door'&&o.edge===entry&&o.edge===door.edge&&Math.abs(o.offset-door.offset)<.00001&&Math.abs(o.width-door.width)<.00001);if(!actual||Math.abs(offset-(actual.offset+actual.width/2))>.00001)throw new Error('起點門位與房間資料不一致。');if(actual.width*(['top','bottom'].includes(entry)?w:d)<preset.width)return {...empty,reason:'圖紙門寬小於所選通道目標；家具擺位無法改變門寬，請先現場核對。'};}
 const points=[],free=[];for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const p=[-w/2+margin+col*step,-d/2+margin+row*step];points.push(p);free.push(obstacles.every(i=>pointClearance(p,i)>=margin));}
 const startPoint=entry==='bottom'?[(offset-.5)*w,d/2-margin]:entry==='top'?[(offset-.5)*w,-d/2+margin]:entry==='left'?[-w/2+margin,(offset-.5)*d]:[w/2-margin,(offset-.5)*d];
 const boundary=entry==='bottom'?[startPoint[0],d/2]:entry==='top'?[startPoint[0],-d/2]:entry==='left'?[-w/2,startPoint[1]]:[w/2,startPoint[1]];
 if(obstacles.some(i=>segmentClearance(boundary,startPoint,i)<radius))return {...empty,startPoint,reason:'入口到室內的連接段被家具阻擋，請先移開門邊家具。'};
 const a=(target.rotation||0)*Math.PI/180,front=target.d/2+margin+step;
 const goalPoint=[target.x-Math.sin(a)*front,target.z+Math.cos(a)*front];
 const inside=p=>Math.abs(p[0])+radius<=w/2&&Math.abs(p[1])+radius<=d/2;
 const clearSegment=(a,b)=>inside(a)&&inside(b)&&obstacles.every(i=>segmentClearance(a,b,i)>=radius-1e-9);
 function nearest(p){if(!inside(p)||!obstacles.every(i=>pointClearance(p,i)>=radius))return -1;let found=-1,best=step*1.6;points.forEach((q,i)=>{const distance=Math.hypot(q[0]-p[0],q[1]-p[1]);if(free[i]&&distance<best&&clearSegment(p,q)){best=distance;found=i;}});return found;}
 const start=nearest(startPoint),goal=nearest(goalPoint);
 if(start<0)return {...empty,reason:'起點被家具或牆邊淨空阻擋，請移動入口附近家具或調整起點。',startPoint,goalPoint};
 if(goal<0)return {...empty,reason:'目的家具正面沒有足夠使用淨空，請調整家具位置或朝向。',startPoint,goalPoint};
 const queue=[start],parents=new Int32Array(points.length).fill(-2);parents[start]=-1;let head=0;
 while(head<queue.length){const current=queue[head++];if(current===goal)break;const col=current%cols,row=Math.floor(current/cols);for(const n of [col>0?current-1:-1,col<cols-1?current+1:-1,row>0?current-cols:-1,row<rows-1?current+cols:-1])if(n>=0&&free[n]&&parents[n]===-2){parents[n]=current;queue.push(n);}}
 const visited=queue.slice(0,head).map(i=>points[i]);if(parents[goal]===-2)return {...empty,visited,reason:'目前家具把通道分隔，找不到符合所選淨寬的路徑。請移開阻塞家具後重新規劃。',startPoint,goalPoint};
 const grid=[];for(let n=goal;n>=0;n=parents[n])grid.push(points[n]);grid.reverse();const raw=[startPoint,...grid,goalPoint],path=[raw[0]];
 // Visibility shortcutting removes grid zigzags only when the full corridor is clear.
 for(let i=0;i<raw.length-1;){let next=i+1;for(let j=raw.length-1;j>i;j--)if(clearSegment(raw[i],raw[j])){next=j;break;}if(Math.hypot(raw[next][0]-path.at(-1)[0],raw[next][1]-path.at(-1)[1])>1e-8)path.push(raw[next]);i=next;}
 let length=0,turns=0;for(let i=1;i<path.length;i++){length+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]);if(i>1){const a=path[i-1],b=path[i-2],c=path[i];if(Math.abs((a[0]-b[0])*(c[1]-a[1])-(a[1]-b[1])*(c[0]-a[0]))>.0001)turns++;}}
 const rugs=items.filter(i=>i.type==='rug'&&path.some((p,n)=>n?segmentClearance(path[n-1],p,i)<radius:pointClearance(p,i)<radius));
 return {ok:true,path,visited,length,width:preset.width,turns,profile,startPoint,goalPoint,targetName:target.name,rugs:rugs.map(i=>i.name),reason:'沿家具外側通行，抵達目的家具正面；以保守網格避開旋轉後的家具占地。'};
}
export function agingAdvice(project){const list=[];if(project.items.some(i=>i.type==='rug'))list.push('地毯需固定、防滑並確認邊緣平整，避免絆倒。');if(project.items.some(i=>['sofa','chair','bed'].includes(i.type)))list.push('座高、床高與扶手規格未核實，請按使用者需要實物試坐。');if(project.items.some(i=>['table','desk','dining'].includes(i.type)))list.push('桌角圓角、防撞與桌下膝部空間需另行核對。');list.push('補足入口、床邊與夜間照明；門檻、高差、地面防滑及門扇開啟範圍需現場檢查。');return list;}
export function routePoint(path,progress){if(!path.length)return null;const lengths=path.slice(1).map((p,i)=>Math.hypot(p[0]-path[i][0],p[1]-path[i][1]));let distance=lengths.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(1,progress));for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]){const t=distance/(lengths[i]||1);return [path[i][0]+(path[i+1][0]-path[i][0])*t,path[i][1]+(path[i+1][1]-path[i][1])*t];}distance-=lengths[i];}return path.at(-1);}
