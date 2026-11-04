import {safeCareLayout,validateCareProject,careReview,SAMPLE_ITEMS} from '../public/care-domain.js';
import {generateAILayout} from './layout.js';
export async function generateCareLayout(body,env={}){
 const project=validateCareProject(body.project);if(!['living','bedroom','dining',undefined].includes(body.purpose))throw Error('不支援的房間用途。');let proposal=[],engine='local-care-rules',notice='本地適老規則規劃';
 if(env.DEEPSEEK_API_KEY||env.RENDER_PROXY_ORIGIN||env.LAYOUT_ENDPOINT){try{
  const input={room:project.room,style:['warm','minimal','modern'].includes(body.style)?body.style:'warm',purpose:body.purpose||'living',mobility:project.profile==='wheelchair'?'wheelchair':'senior',preferences:['flow'],variant:0};let result;
  if(env.DEEPSEEK_API_KEY)result=await generateAILayout(input,env);
  else {const endpoint=env.RENDER_PROXY_ORIGIN?new URL('/api/layout',env.RENDER_PROXY_ORIGIN):new URL(env.LAYOUT_ENDPOINT);if(endpoint.protocol!=='https:')throw Error('Invalid provider');const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(!env.RENDER_PROXY_ORIGIN&&env.LAYOUT_API_KEY?{Authorization:'Bearer '+env.LAYOUT_API_KEY}:{})},body:JSON.stringify(input),signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('Provider unavailable');result=await response.json();}
  if(!Array.isArray(result.items)||result.items.length>50)throw Error('Invalid proposal');proposal=result.items.filter(i=>i&&i.type!=='rug').map(i=>({...i,dimensionSource:'concept'}));const remote=!String(result.engine||'remote-ai').includes('local');engine=remote?'remote-ai-care-validated':'upstream-local-care-validated';notice=remote?'AI提出家具組合，再以適老幾何規則重新擺放':'上游本地規劃提出候選，再以適老幾何規則檢查';
 }catch{notice='AI暫時不可用，已改用本地適老規則；未上傳相片。';}}
 if(!proposal.length)proposal=body.purpose==='bedroom'?[SAMPLE_ITEMS[2],SAMPLE_ITEMS[1],SAMPLE_ITEMS[0]]:body.purpose==='dining'?[{type:'dining',name:'餐桌（示意尺寸）',w:1.2,d:.75,h:.75,color:'#c5b696'},SAMPLE_ITEMS[0],{...SAMPLE_ITEMS[0],name:'第二張扶手椅'}]:[SAMPLE_ITEMS[0],SAMPLE_ITEMS[1],{...SAMPLE_ITEMS[0],name:'第二張扶手椅'}];
 const result=safeCareLayout(project,proposal);return {...result,engine,notice,review:careReview({...project,items:result.items})};
}
