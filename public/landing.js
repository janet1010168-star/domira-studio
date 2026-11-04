import {API_BASE} from './api-config.js';
const frames=[...document.querySelectorAll('.cinema-frame')],buttons=[...document.querySelectorAll('[data-scene-select]')],toggle=document.querySelector('#motion-toggle'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let current=0,paused=reduced.matches,timer;
function schedule(){clearTimeout(timer);if(!paused&&!document.hidden)timer=setTimeout(()=>show((current+1)%frames.length),9000);}
function show(index){current=index;frames.forEach((f,n)=>f.classList.toggle('active',n===index));buttons.forEach((b,n)=>b.setAttribute('aria-pressed',String(n===index)));schedule();}
function motion(){document.documentElement.classList.toggle('motion-paused',paused);toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',paused?'播放場景動畫':'暫停場景動畫');toggle.textContent=paused?'▶':'Ⅱ';schedule();}
buttons.forEach(b=>b.onclick=()=>show(Number(b.dataset.sceneSelect)));toggle.onclick=()=>{paused=!paused;motion();};reduced.addEventListener('change',e=>{paused=e.matches;motion();});document.addEventListener('visibilitychange',schedule);motion();
document.documentElement.classList.add('js-motion');
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');observer.unobserve(e.target);}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
window.addEventListener('pagehide',()=>{clearTimeout(timer);observer.disconnect();});
document.querySelector('#contact-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.target,b=f.querySelector('button'),status=document.querySelector('#contact-status');b.disabled=true;status.textContent='正在傳送…';try{const r=await fetch(API_BASE+'/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});const d=await r.json();if(!r.ok)throw Error(d.error||'傳送失敗');status.textContent=d.message;f.reset();}catch(err){status.textContent=err.message;}finally{b.disabled=false;}});
