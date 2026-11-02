#!/usr/bin/env node
/* 在真實 Chrome 裡檢查 Domira Studio 的 UI：3D 場景、平面圖、動線面板、住戶能力 chips。
 *
 * 為什麼要它：
 *   node --check 只看語法，語法正確的 JS 照樣可能在執行時炸掉；
 *   DOM 樁看不到版面、WebGL 與 pointer 事件鏈。這一層用本機 Chrome headless
 *   跑真頁面（CDP 走 WebSocket，不裝 npm 依賴、不下載 Chromium），
 *   並把畫面截圖存到 .screenshots/，讓人可以自己看一眼版面。
 *
 * 用法：
 *   先開 dev server： node scripts/dev.mjs
 *   再跑：            node tools/ui-check.cjs [baseUrl]
 *   預設 baseUrl = http://127.0.0.1:3000
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '');
const PORT = Number(process.env.DOMIRA_CDP_PORT || 9334);
const PROFILE = path.join(os.tmpdir(), 'domira-studio-cdp');
const OUT = path.join(__dirname, '..', '.screenshots');

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const passed = [];
const failed = [];
function check(name, ok, detail = '') {
  (ok ? passed : failed).push(name);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`);
}

async function main() {
  const chrome = CANDIDATES.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error('找不到 Chrome / Edge');
  fs.mkdirSync(OUT, { recursive: true });

  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--enable-unsafe-swiftshader',           // 沒有 GPU 也要畫得出 3D
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + PROFILE,
    '--window-size=1600,1400',
    'about:blank',
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 60; i++) {
    await sleep(200);
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      targets = await res.json();
      if (targets && targets.length) break;
    } catch (e) { /* 還沒起來 */ }
  }
  if (!targets || !targets.length) {
    try { proc.kill(); } catch (e) {}
    throw new Error('DevTools 端點沒有起來（port ' + PORT + ' 被佔用或被防毒攔住）');
  }

  const page = targets.find((t) => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = new Map();
  const errors = [];

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails || {};
      errors.push((d.exception && d.exception.description) || d.text || 'exception');
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const a = msg.params.args || [];
      errors.push(a.map((x) => String(x.value !== undefined ? x.value : x.description || '')).join(' '));
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('WebSocket 連不上 DevTools')));
  });

  const send = (method, params) => new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });

  async function evaluate(expr) {
    const out = await send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true,
    });
    const r = out.result || {};
    if (r.exceptionDetails) {
      throw new Error('頁面執行出錯：' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    }
    return r.result ? r.result.value : undefined;
  }

  async function shot(name) {
    const out = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const b64 = out.result && out.result.data;
    if (!b64) return null;
    const file = path.join(OUT, name + '.png');
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    return file;
  }

  await send('Runtime.enable');
  await send('Page.enable');
  // 先載入一次只為了拿到 origin，清掉 localStorage 再重載：
  // 不然上一輪測過的住戶能力會留在同一個 profile 裡，下一次啟動就不是預設狀態。
  await send('Page.navigate', { url: BASE });
  await sleep(1500);
  await evaluate('localStorage.clear(); true').catch(() => {});
  await send('Page.reload', { ignoreCache: true });
  await sleep(4000);                         // 等 Three.js 與首批渲染

  try {
    console.log('目標：' + BASE + '\n');
    console.log('[載入]');
    const head = JSON.parse(await evaluate(`JSON.stringify({
      title: document.title,
      hasScene: !!document.querySelector('#scene canvas'),
      canvas: (function(){var c=document.querySelector('#scene canvas');return c?[c.width,c.height]:null;})(),
      chips: Array.from(document.querySelectorAll('[data-mobility]')).map(function(e){return e.dataset.mobility;}),
      hasClearance: !!document.getElementById('clearance-list'),
      furniture: document.querySelectorAll('.furniture-card, .fitem, .catalog-card').length,
      viewButtons: Array.from(document.querySelectorAll('[data-view]')).map(function(e){return e.dataset.view;}),
      categories: Array.from(document.querySelectorAll('[data-category]')).map(function(e){return e.dataset.category;}),
    })`));
    check('頁面有標題', !!head.title, head.title);
    check('3D canvas 存在且有尺寸', !!head.canvas && head.canvas[0] > 0, String(head.canvas));
    check('住戶能力 chips 存在', head.chips.length === 2, JSON.stringify(head.chips));
    check('動線面板容器存在', head.hasClearance === true);
    check('檢視切換有 3D／平面圖', head.viewButtons.indexOf('plan') >= 0, JSON.stringify(head.viewButtons));
    check('家具庫有廚房分類', ['stove', 'sink', 'fridge'].every(k => head.categories.indexOf(k) >= 0),
      head.categories.filter(k => ['stove', 'sink', 'fridge', 'wardrobe'].indexOf(k) >= 0).join(','));

    console.log('\n[動線面板 · 一般]');
    const std = JSON.parse(await evaluate(`JSON.stringify({
      text: (document.getElementById('clearance-list')||{}).innerText || '',
      rows: (document.querySelectorAll('#clearance-list li')||[]).length,
      on: (document.querySelector('[data-mobility].on')||{dataset:{}}).dataset.mobility || '',
    })`));
    check('預設是一般住宅', std.on === 'standard', 'on=' + std.on);
    check('動線面板有內容', std.rows > 0, std.rows + ' 列');
    check('顯示收納可及比例', std.text.indexOf('可及') >= 0);
    check('一般模式明說未套用無障礙', std.text.indexOf('未套用') >= 0);
    const shot1 = await shot('01-3d-standard');

    console.log('\n[動線面板 · 輪椅]');
    const click = JSON.parse(await evaluate(`(function(){
      var el=document.querySelector('[data-mobility="wheelchair"]');
      var handler=typeof el.onclick, src=String(el.onclick||'').slice(0,90);
      el.click();
      var viaClick={cls:el.className,on:(document.querySelector('[data-mobility].on')||{dataset:{}}).dataset.mobility||null,text:(document.getElementById('clearance-list')||{}).innerText||''};
      if(handler==='function'&&viaClick.on!=='wheelchair'){el.onclick();}
      var viaDirect={cls:el.className,on:(document.querySelector('[data-mobility].on')||{dataset:{}}).dataset.mobility||null,
        text:(document.getElementById('clearance-list')||{}).innerText||'',
        toast:(document.getElementById('toast')||{}).innerText||''};
      return JSON.stringify({handler,src,viaClick,viaDirect});
    })()`));
    if (click.handler !== 'function') console.log('  ! 診斷：chip 沒有 onclick 綁定');
    const wc = { text: click.viaDirect.text, toast: click.viaDirect.toast, on: click.viaDirect.on };
    check('切到輪椅模式', wc.on === 'wheelchair',
      'click=' + click.viaClick.on + ' direct=' + click.viaDirect.on + ' src=' + click.src.replace(/\s+/g, ' ').slice(0, 60));
    check('出現通道 1.05 檢查', /(通道|走道)/.test(wc.text) && /1\.05/.test(wc.text));
    check('出現迴旋 1.5 檢查', /迴旋/.test(wc.text) && /1\.5/.test(wc.text));
    check('輪椅模式不再說未套用', wc.text.indexOf('未套用') < 0);
    check('切換有提示訊息', /無障礙|輪椅/.test(wc.toast), wc.toast.slice(0, 40));

    console.log('\n[平面圖]');
    await evaluate(`(document.querySelector('[data-view="plan"]')||{click:function(){}}).click(); true`);
    await sleep(1200);
    const plan = JSON.parse(await evaluate(`JSON.stringify({
      svg: !!document.querySelector('#viewport svg, #scene svg'),
      planItems: document.querySelectorAll('#viewport svg *, #scene svg *').length,
    })`));
    check('平面圖有 SVG', plan.svg === true, plan.planItems + ' 個圖形');
    const shot2 = await shot('02-plan-wheelchair');

    // ── 廚房：切到煮食空間並生成，工作三角要自己出現在面板上 ──
    console.log('\n[廚房工作三角]');
    await evaluate(`(function(){
      var sel=document.getElementById('room-purpose'); sel.value='kitchen';
      sel.dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('generate').click();
      return true;
    })()`);
    await sleep(2500);
    const kitchen = JSON.parse(await evaluate(`JSON.stringify({
      purpose: (document.getElementById('room-purpose')||{}).value||'',
      text: (document.getElementById('clearance-list')||{}).innerText||'',
      count: (document.getElementById('object-count')||{}).innerText||'',
      summary: (document.getElementById('room-summary')||{}).innerText||'',
    })`));
    check('用途已切到廚房', kitchen.purpose === 'kitchen', kitchen.summary.slice(0, 40));
    check('面板出現工作三角', /廚房工作三角/.test(kitchen.text), kitchen.text.replace(/\n/g, ' | ').slice(0, 130));
    check('工作三角給出總長', /\d\.\d\d m/.test(kitchen.text) && /慣例/.test(kitchen.text));
    check('三件家具已放進場景', /\d+ 件家具/.test(kitchen.count), kitchen.count);
    const shotKitchen = await shot('03-kitchen');

    // ── 全屋：注入一個三房平面，檢查夜間動線（單間幾何看不到這個）──
    console.log('\n[全屋夜間動線]');
    const room = (id, name, kind, x, z, w, d, openings) => ({
      id, name, kind, purpose: kind === 'bedroom' ? 'bedroom' : 'living',
      x, z, width: w, depth: d, height: 2.7, confidence: 'high', notes: '', openings, items: [],
    });
    const seeded = {
      schemaVersion: 1, id: 'ui-check-home', name: '夜間動線測試',
      room: { width: 4, depth: 3, height: 2.7 }, items: [],
      style: 'warm', purpose: 'living', mobility: 'standard',
      preferences: ['daylight', 'flow', 'green'], engine: 'local-rules',
      updatedAt: new Date().toISOString(), activeRoomId: 'a', homeView: 'overview',
      home: {
        format: 'domira.home.v1', width: 8, depth: 6, height: 2.7,
        source: 'ai-floorplan', scaleConfirmed: true, summary: '', warnings: [],
        rooms: [
          room('a', '睡房', 'bedroom', -2, -1.5, 4, 3, [{ kind: 'door', edge: 'right', offset: .3, width: .3 }]),
          room('b', '走廊', 'hall', 1, -1.5, 2, 3, [{ kind: 'door', edge: 'bottom', offset: .25, width: .5 }]),
          room('c', '浴室', 'bathroom', 1, 1.5, 2, 3, [{ kind: 'door', edge: 'top', offset: .25, width: .5 }]),
        ],
      },
    };
    await evaluate(`localStorage.setItem('domira.projects.v1', ${JSON.stringify(JSON.stringify([seeded]))}); true`);
    await send('Page.navigate', { url: BASE });
    await sleep(3500);
    const night = JSON.parse(await evaluate(`JSON.stringify({
      text: (document.getElementById('clearance-list')||{}).innerText||'',
      rows: document.querySelectorAll('#clearance-list li').length,
      name: (document.getElementById('breadcrumb-name')||{}).textContent||'',
    })`));
    check('載入了注入的全屋專案', night.name === '夜間動線測試', night.name);
    check('夜間動線出現在面板', /夜間動線/.test(night.text), night.text.replace(/\n/g, ' | ').slice(0, 150));
    check('路線是睡房 → 浴室', /睡房/.test(night.text) && /浴室/.test(night.text));
    check('列出兩道門的門寬', /門寬/.test(night.text) && /0\.90/.test(night.text) && /1\.00/.test(night.text));
    const shotNight = await shot('04-night-route');
    console.log('  （全屋共 ' + night.rows + ' 列）');

    console.log('\n[console]');
    const real = errors.filter((e) => !/favicon|Failed to load resource.*404/i.test(e));
    check('沒有頁面錯誤', real.length === 0, real.slice(0, 2).join(' | ').slice(0, 240));

    if (shot1) console.log('\n截圖：' + shot1);
    if (shot2) console.log('截圖：' + shot2);
    console.log('截圖：' + shotKitchen);
    console.log('截圖：' + shotNight);
  } finally {
    try { ws.close(); } catch (e) {}
    try { proc.kill(); } catch (e) {}
  }

  console.log('\n' + '='.repeat(56));
  console.log(`通過 ${passed.length} 項，失敗 ${failed.length} 項`);
  return failed.length ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error('檢查失敗：' + e.message); process.exit(1); });
