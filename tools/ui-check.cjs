#!/usr/bin/env node
/* 在真實 Chrome 裡檢查 Domira Studio（v2.0 合併後）：兩個 tab、活動能力三檔、
 * 動線驗算面板、廚房工作三角、全屋夜間動線。
 *
 * 為什麼要它：
 *   node --check 只看語法；DOM 樁看不到版面、WebGL 與事件鏈。
 *   這一層用本機 Chrome headless 跑真頁面（CDP 走 WebSocket，不裝 npm 依賴），
 *   並把畫面截圖存到 .screenshots/。
 *
 * 用法：
 *   先開 dev server： node scripts/dev.mjs
 *   再跑：            node tools/ui-check.cjs [baseUrl]
 *   需要 danger-full-access：Chrome 要建 Mojo named pipe，沙箱下起不來。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '');
const PORT = Number(process.env.DOMIRA_CDP_PORT || 9335);
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
    '--enable-unsafe-swiftshader',
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
    const out = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    const r = out.result || {};
    if (r.exceptionDetails) throw new Error('頁面執行出錯：' + JSON.stringify(r.exceptionDetails).slice(0, 400));
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

  const careTab = () => evaluate(`(function(){var t=document.querySelector('[data-config-tab="care"]');if(t)t.click();return !!t;})()`);
  const designTab = () => evaluate(`(function(){var t=document.querySelector('[data-config-tab="design"]');if(t)t.click();return !!t;})()`);
  const readPanel = () => evaluate(`JSON.stringify({
    text: (document.getElementById('clearance-list')||{}).innerText || '',
    rows: document.querySelectorAll('#clearance-list li').length,
    mobility: (document.getElementById('mobility-profile')||{}).value || '',
  })`).then(JSON.parse);

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: BASE });
  await sleep(1500);
  await evaluate('localStorage.clear(); true').catch(() => {});
  await send('Page.reload', { ignoreCache: true });
  await sleep(4200);

  try {
    console.log('目標：' + BASE + '\n');
    console.log('[載入]');
    const head = JSON.parse(await evaluate(`JSON.stringify({
      title: document.title,
      hasScene: !!document.querySelector('#scene canvas'),
      tabs: Array.from(document.querySelectorAll('[data-config-tab]')).map(function(e){return e.dataset.configTab;}),
      mobilityOptions: Array.from(document.querySelectorAll('#mobility-profile option')).map(function(o){return o.value;}),
      mobilityText: Array.from(document.querySelectorAll('#mobility-profile option')).map(function(o){return o.textContent.trim();}),
      hasClearance: !!document.getElementById('clearance-list'),
      kitchen: !!document.querySelector('#room-purpose option[value="kitchen"]'),
      nav: !!document.getElementById('circulation-nav'),
      legacyChips: document.querySelectorAll('[data-mobility].chip').length,
    })`));
    check('頁面有標題', !!head.title, head.title);
    check('3D canvas 存在', head.hasScene === true);
    check('兩個 tab（風格與佈局／適老與動線）', head.tabs.join(',') === 'design,care', head.tabs.join(','));
    check('活動能力三檔', head.mobilityOptions.join(',') === 'standard,senior,wheelchair', head.mobilityOptions.join(','));
    check('三檔都標了出處', head.mobilityText.every((t) => /（/.test(t)), head.mobilityText.join(' | ').slice(0, 110));
    check('輪椅檔用 1.05（法規）', head.mobilityText.some((t) => t.includes('1.1') || t.includes('1.05')), head.mobilityText[2] || '');
    check('動線驗算面板存在於 care tab', head.hasClearance === true);
    check('廚房用途選項存在', head.kitchen === true);
    check('側欄有動線入口', head.nav === true);
    check('舊的住戶能力 chips 已移除（統一入口）', head.legacyChips === 0, String(head.legacyChips));

    console.log('\n[適老與動線 · 三檔]');
    await careTab();
    await sleep(500);
    const senior = await readPanel();
    check('預設是適老步行', senior.mobility === 'senior', senior.mobility);
    check('驗算面板有內容', senior.rows > 0, senior.rows + ' 列');
    check('適老步行檢查 0.9 m 走道', /通道淨闊（適老步行）/.test(senior.text) && /0\.9/.test(senior.text));
    check('適老步行不套輪椅迴旋', !/輪椅迴旋/.test(senior.text));
    const shotSenior = await shot('01-care-senior');

    await evaluate(`(function(){var s=document.getElementById('mobility-profile');s.value='wheelchair';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
    await sleep(600);
    const wheelchair = await readPanel();
    check('切到輪椅檔', wheelchair.mobility === 'wheelchair', wheelchair.mobility);
    check('出現通道 1.05', /通道淨闊/.test(wheelchair.text) && /1\.05/.test(wheelchair.text));
    check('出現輪椅迴旋 1.5', /輪椅迴旋/.test(wheelchair.text) && /1\.5/.test(wheelchair.text));
    const shotWheelchair = await shot('02-care-wheelchair');

    await evaluate(`(function(){var s=document.getElementById('mobility-profile');s.value='standard';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
    await sleep(600);
    const standard = await readPanel();
    check('日常步行不假裝做無障礙檢查', standard.mobility === 'standard' && !/輪椅迴旋/.test(standard.text) && !/通道淨闊/.test(standard.text));

    console.log('\n[廚房工作三角]');
    await designTab();
    await evaluate(`(function(){
      var sel=document.getElementById('room-purpose'); sel.value='kitchen';
      sel.dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('generate').click();
      return true;
    })()`);
    await sleep(2600);
    await careTab();
    await sleep(400);
    const kitchen = await readPanel();
    check('面板出現工作三角', /廚房工作三角/.test(kitchen.text), kitchen.text.replace(/\n/g, ' | ').slice(0, 120));
    check('工作三角給出總長', /\d\.\d\d m/.test(kitchen.text) && /慣例/.test(kitchen.text));
    const shotKitchen = await shot('03-kitchen');

    console.log('\n[全屋夜間動線]');
    const room = (id, name, kind, x, z, w, d, openings) => ({
      id, name, kind, purpose: kind === 'bedroom' ? 'bedroom' : 'living',
      x, z, width: w, depth: d, height: 2.7, confidence: 'high', notes: '', openings, items: [],
    });
    const seeded = {
      schemaVersion: 1, id: 'ui-check-home', name: '夜間動線測試',
      room: { width: 4, depth: 3, height: 2.7 }, items: [],
      style: 'warm', purpose: 'living', mobility: 'senior',
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
    await sleep(4000);
    await careTab();
    await sleep(500);
    const night = await readPanel();
    const name = await evaluate(`(document.getElementById('breadcrumb-name')||{}).textContent || ''`);
    check('載入了注入的全屋專案', name === '夜間動線測試', name);
    check('夜間動線出現在驗算面板', /夜間動線/.test(night.text), night.text.replace(/\n/g, ' | ').slice(0, 130));
    check('路線是睡房 → 浴室', /睡房/.test(night.text) && /浴室/.test(night.text));
    check('列出兩道門的門寬', /門寬/.test(night.text) && /0\.90/.test(night.text));
    const shotNight = await shot('04-night-route');

    console.log('\n[console]');
    const real = errors.filter((e) => !/favicon|Failed to load resource.*404/i.test(e));
    check('沒有頁面錯誤', real.length === 0, real.slice(0, 2).join(' | ').slice(0, 240));

    console.log('\n截圖：');
    for (const f of [shotSenior, shotWheelchair, shotKitchen, shotNight]) if (f) console.log('  ' + f);
  } finally {
    try { ws.close(); } catch (e) {}
    try { proc.kill(); } catch (e) {}
  }

  console.log('\n' + '='.repeat(56));
  console.log(`通過 ${passed.length} 項，失敗 ${failed.length} 項`);
  return failed.length ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error('檢查失敗：' + e.message); process.exit(1); });
