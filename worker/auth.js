const reply=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const enc=new TextEncoder(),hex=b=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
const bytes=h=>new Uint8Array(h.match(/.{2}/g).map(v=>parseInt(v,16)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async v=>hex(await crypto.subtle.digest('SHA-256',enc.encode(v)));
async function hash(password,salt){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(salt),iterations:100000},key,256));}
function equal(a,b){if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}
const limits=new Map();
async function init(db){await db.batch([db.prepare('CREATE TABLE IF NOT EXISTS care_users (id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,created_at INTEGER NOT NULL)'),db.prepare('CREATE TABLE IF NOT EXISTS care_sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL)')]);}
export async function handleAuth(request,env){
 const db=env.RENDER_DB;if(!db)return reply({error:'帳戶服務尚未連接。可使用訪客模式，專案保留在此裝置。'},503);
 const path=new URL(request.url).pathname,now=Date.now();await init(db);
 const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
 if(path==='/api/auth/me'||path==='/api/auth/logout'){
  if(path.endsWith('/me')&&request.method!=='GET'||path.endsWith('/logout')&&request.method!=='POST')return reply({error:'Method not allowed'},405);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return reply({error:'請重新登入'},401);const key=await digest(token);
  if(path.endsWith('/logout')){await db.prepare('DELETE FROM care_sessions WHERE token_hash=?').bind(key).run();return reply({ok:true});}
  const row=await db.prepare('SELECT u.id,u.email FROM care_sessions s JOIN care_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(key,now).first();return row?reply({user:row}):reply({error:'登入已到期'},401);
 }
 if(!['/api/auth/login','/api/auth/register'].includes(path))return reply({error:'Not found'},404);
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 const ip=request.headers.get('CF-Connecting-IP')||'local';if(limits.size>10000)limits.clear();const attempts=(limits.get(ip)||[]).filter(t=>now-t<60000);if(attempts.length>=8)return reply({error:'請稍候一分鐘再試。'},429);limits.set(ip,[...attempts,now]);
 const raw=await request.text();if(raw.length>10000)return reply({error:'資料過大'},413);let body;try{body=JSON.parse(raw);}catch{return reply({error:'無效JSON'},400);}
 const email=String(body.email||'').trim().toLowerCase(),password=body.password;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<12||password.length>128)return reply({error:'請輸入有效Email及12-128字元密碼。'},400);
 let user=await db.prepare('SELECT * FROM care_users WHERE email=?').bind(email).first();
 if(path.endsWith('/register')){if(user)return reply({error:'此Email已註冊，請改用登入。'},409);const salt=random(),id=crypto.randomUUID();try{await db.prepare('INSERT INTO care_users (id,email,password_hash,salt,created_at) VALUES(?,?,?,?,?)').bind(id,email,await hash(password,salt),salt,now).run();}catch{return reply({error:'無法註冊，請改用登入或稍後再試。'},409);}user={id,email};}
 else {const candidate=await hash(password,user?.salt||'0'.repeat(64));if(!user||!equal(candidate,user.password_hash))return reply({error:'Email或密碼不正確。'},401);}
 const session=random(),expiresAt=now+12*60*60*1000;await db.prepare('DELETE FROM care_sessions WHERE expires_at<?').bind(now).run();await db.prepare('INSERT INTO care_sessions (token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(session),user.id,expiresAt).run();return reply({user:{id:user.id,email:user.email},token:session,expiresAt,emailVerified:false},path.endsWith('/register')?201:200);
}
