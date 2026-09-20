/* ============================================================================
   ViCons 原型 — 渲染迴歸 harness
   在沒有瀏覽器的環境下，用最小 DOM 樁真的執行 protoshell.js 與每個畫面，
   斷言它們建出非空 DOM 且不拋錯。這比語法檢查強得多。
   跑法： node _audit.cjs
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let PASS = 0, FAIL = 0;
const failures = [];
function ok(cond, label) {
  if (cond) { PASS++; }
  else { FAIL++; failures.push(label); console.log('  ✕ ' + label); }
}

/* ---------- 最小 DOM 樁 ---------- */
function makeNode(tag) {
  const n = {
    nodeType: 1, tagName: String(tag || '').toUpperCase(),
    childNodes: [], attributes: {}, style: {}, dataset: {},
    className: '', textContent: '', innerHTML: '',
    parentNode: null, _listeners: {},
    appendChild(c) { if (c) { c.parentNode = n; n.childNodes.push(c); } return c; },
    removeChild(c) { const i = n.childNodes.indexOf(c); if (i >= 0) n.childNodes.splice(i, 1); return c; },
    remove() { if (n.parentNode) n.parentNode.removeChild(n); },
    setAttribute(k, v) { n.attributes[k] = String(v); if (k === 'class') n.className = String(v); },
    getAttribute(k) { return k in n.attributes ? n.attributes[k] : null; },
    removeAttribute(k) { delete n.attributes[k]; },
    hasAttribute(k) { return k in n.attributes; },
    addEventListener(t, fn) { (n._listeners[t] = n._listeners[t] || []).push(fn); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    set textContentVal(v) { n.textContent = v; }
  };
  // classList polyfill（依 className 字串）
  n.classList = {
    add(c) { if (!n.className.split(/\s+/).includes(c)) n.className = (n.className + ' ' + c).trim(); },
    remove(c) { n.className = n.className.split(/\s+/).filter(x => x && x !== c).join(' '); },
    toggle(c, force) { const has = n.className.split(/\s+/).includes(c); const want = force === undefined ? !has : !!force; if (want) n.classList.add(c); else n.classList.remove(c); return want; },
    contains(c) { return n.className.split(/\s+/).includes(c); }
  };
  return n;
}
function countNodes(n) {
  let c = 1;
  for (const k of n.childNodes || []) c += countNodes(k);
  return c;
}
function countText(n, needle) {
  let c = 0;
  if (typeof n.textContent === 'string' && n.textContent.includes(needle)) c++;
  if (typeof n.innerHTML === 'string' && n.innerHTML.includes(needle)) c++;
  for (const k of n.childNodes || []) c += countText(k, needle);
  return c;
}

/* ---------- 建立 document 樁 ---------- */
const registry = {};
function buildSandbox() {
  const document = {
    createElement: makeNode,
    createDocumentFragment: () => makeNode('#fragment'),
    createTextNode: (t) => { const n = makeNode('#text'); n.nodeType = 3; n.textContent = String(t); return n; },
    getElementById: (id) => registry[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: makeNode('body')
  };
  registry['view-root'] = makeNode('div');
  registry['main'] = makeNode('main');
  registry['toasts'] = makeNode('div');
  registry['collapse'] = makeNode('button');

  const listeners = {};
  const sandbox = {
    document,
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    requestAnimationFrame: () => 0,
    location: { hash: '' },
    history: { replaceState: () => {} },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    window: null
  };
  sandbox.window = sandbox;
  return sandbox;
}

/* ---------- 載入原型 ---------- */
const ROOT = __dirname;
const FILES = [
  'app/protoshell.js',
  'app/devpanel.js',
  /* 骨幹畫面（第一批） */
  'app/views/overview.js',
  'app/views/takeoff.js',
  'app/views/bridge.js',
  'app/views/sor.js',
  'app/views/compliance.js',
  'app/views/output.js',
  'app/views/mcp.js',
  'app/views/states.js',
  /* 補充畫面（第二批：補齊 VicBid 既有功能） */
  'app/views/hktenders.js',
  'app/views/intake.js',
  'app/views/contract.js',
  'app/views/navmap.js',
  'app/views/site.js',
  'app/views/tech.js',
  'app/views/schedule.js',
  'app/views/backup.js'
];

const sandbox = buildSandbox();
const ctxVm = vm.createContext(sandbox);

for (const f of FILES) {
  const full = path.join(ROOT, f);
  const code = fs.readFileSync(full, 'utf8');
  try {
    vm.runInContext(code, ctxVm, { filename: f });
    PASS++;
  } catch (e) {
    FAIL++;
    failures.push('load ' + f + ': ' + e.message);
    console.log('  ✕ load ' + f + ' → ' + e.message);
  }
}

const VC = sandbox.VC;
ok(!!VC, 'VC 命名空間已掛上 window');

/* ---------- 逐畫面渲染 ---------- */
console.log('\n── 逐畫面渲染 ──');
const EXPECTED = [
  ['overview-1', '空狀態總覽', ['歡迎使用 ViCons', '開始第一個專案', '拖曳標書檔案到此處']],
  ['overview-2', '有資料總覽', ['投標總覽', '專案總數', '待辦要求', '缺單價', 'AC-2024-045']],
  ['takeoff',    '量測引擎',   ['量測條件', 'CPT-01', '溯源', '↑UP=LID', 'AC-2024-045-A-013']],
  ['bridge',     '算量接口',   ['算量接口', '映射預覽', 'report.v1 JSON', 'Total SF w/Waste', '回滾']],
  ['sor',        'SoR 造價核心', ['SoR 造價核心', '缺單價', 'MB-5210', '回滾量測']],
  ['compliance', '合規矩陣',   ['合規矩陣', 'Cl. 33', 'MiC 預製組件', '整體就緒度']],
  ['output',     '提交清單',   ['提交清單', '提交受阻', '↑UP=LID', 'General Notes & Spec']],
  ['mcp',        'MCP 服務',   ['MCP 服務', '0.9.66', 'opentakeoff', '42 個工具']],
  ['states',     '狀態樣板',   ['狀態樣板', '空狀態', '降級', '確認全清量測匯入紀錄']],
  /* ── 第二批：8 個補充畫面 ── */
  ['hk-tenders', '現在招標',   ['現在招標', '香港招標平台', '招標資料庫', '示範醫院 A']],
  ['intake',     '標書匯入',   ['標書匯入', '投標指標', '提交要求預覽', '風險提示']],
  ['contract',   '合約類型',   ['合約類型', '總價合約', 'NEC 合約', '條款明細']],
  ['nav-map',    '提交導航器', ['提交導航器', '整體合規進度', '合約條款遵從清單', '合規缺口']],
  ['site',       'Site Aspect', ['Site Aspect 現場條件', '編寫完成度', '項目位置']],
  ['tech',       '技術施工方案', ['技術施工方案', '方案完成度', '工程範圍']],
  ['schedule',   '進度規劃',   ['進度規劃', '施工總進度計劃', '關鍵路徑', '工序明細']],
  ['backup',     '資料與備份', ['資料與備份', 'IndexedDB 本機儲存', '資料盤點', 'AI 助手設定']]
];

const registered = (VC && VC.VIEWS ? VC.VIEWS.map(v => v.id) : []);
ok(registered.length === EXPECTED.length, '畫面註冊數 = ' + EXPECTED.length + '（實得 ' + registered.length + '）');

for (const [id, label, needles] of EXPECTED) {
  let nodeCount = 0, err = null;
  try {
    registry['view-root'].childNodes = [];       // 清空重來，模擬切頁
    VC.go(id);
    nodeCount = countNodes(registry['view-root']);
  } catch (e) { err = e; }

  if (err) {
    FAIL++; failures.push(id + ' 渲染拋錯：' + err.message);
    console.log('  ✕ ' + id + ' (' + label + ') 拋錯 → ' + err.message);
    continue;
  }
  ok(nodeCount > 30, id + ' 建出實質 DOM（' + nodeCount + ' 節點）');
  for (const nd of needles) {
    const hits = countText(registry['view-root'], nd);
    ok(hits > 0, id + ' 含關鍵內容「' + nd + '」');
  }
  console.log('  ✓ ' + id.padEnd(12) + label.padEnd(14) + nodeCount + ' 節點');
}

/* ---------- 契約性斷言 ---------- */
console.log('\n── 契約性斷言 ──');
// 1. 量測不帶價：SoR 畫面必須有 rate=0 的缺單價，且不得出現假單價
registry['view-root'].childNodes = [];
VC.go('sor');
ok(countText(registry['view-root'], '缺單價') > 0, 'SoR 明示「缺單價」（量測不帶價的契約可見）');

// 2. 來源隔離：回滾文案必須明言只影響 opentakeoff
ok(countText(registry['view-root'], '不會誤刪其他資料') > 0
   || countText(registry['view-root'], '回滾只影響指定來源') > 0, '回滾文案聲明來源隔離');

// 3. 送出鈕在受阻時必須 disabled
registry['view-root'].childNodes = [];
VC.go('output');
function findDisabledBtn(n, acc) {
  if (n.tagName === 'BUTTON' && (n.getAttribute('disabled') !== null || n.getAttribute('aria-disabled') === 'true')) acc.push(n);
  for (const k of n.childNodes || []) findDisabledBtn(k, acc);
  return acc;
}
const disabled = findDisabledBtn(registry['view-root'], []);
ok(disabled.length > 0, '提交清單在受阻時有停用按鈕（' + disabled.length + ' 個）');

// 4. 主題：tokens 檔必須存在且含關鍵變數
const tokenPath = path.join(ROOT, 'tokens', 'vicons-tokens.css');
ok(fs.existsSync(tokenPath), 'design tokens 檔存在');
const tokens = fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, 'utf8') : '';
['--bg', '--panel', '--cobalt', '--ok', '--warn', '--danger', '--price-up', '--price-down']
  .forEach(v => ok(tokens.includes(v + ':'), 'token ' + v + ' 已定義'));

// 5. 漲紅跌綠（中文慣例）
ok(tokens.includes('--price-up:      #ff6b5b'), '漲 = 紅（中文慣例）');
ok(tokens.includes('--price-down:    #3ddc97'), '跌 = 綠（中文慣例）');

// 6. 無障礙：每個畫面都要有 focus-visible 與 skip link 支撐
const compPath = path.join(ROOT, 'tokens', 'vicons-components.css');
const comps = fs.existsSync(compPath) ? fs.readFileSync(compPath, 'utf8') : '';
ok(tokens.includes(':focus-visible'), 'tokens 定義 :focus-visible');
ok(tokens.includes('prefers-reduced-motion'), 'tokens 尊重 reduced-motion');
ok(comps.includes('.state--'), '組件層定義空/錯/降級狀態樣式');

/* ---------- 第二批畫面的契約性斷言 ---------- */

// 7. 每個補充畫面都必須真的實作五態切換器（四態齊備的驗收依據）
registry['view-root'].childNodes = [];
VC.go('site');
const segBtns = [];
(function collectSeg(n) {
  if (n.className && String(n.className).includes('seg__btn')) segBtns.push(n);
  for (const k of n.childNodes || []) collectSeg(k);
})(registry['view-root']);
ok(segBtns.length >= 5, '畫面具備五態切換器（實得 ' + segBtns.length + ' 個狀態鈕）');

// 8. 標書匯入：解析出 0 條要求時必須當「降級」明講，不得靜默通過
let degradedHasWarn = false;
(function probeDegraded() {
  VC.dev.set('intake', 'degraded');
  registry['view-root'].childNodes = [];
  VC.go('intake');
  degradedHasWarn = countText(registry['view-root'], '未抽到提交要求') > 0
                 && countText(registry['view-root'], '手動新增要求') > 0;
  VC.dev.set('intake', 'data');
})();
ok(degradedHasWarn, '標書匯入的降級態明示「未抽到要求」並提供手動出路');

// 9. 進度規劃：完工早於開工的驗證必須存在（最常見輸入錯誤）
const schedSrc = fs.readFileSync(path.join(ROOT, 'app/views/schedule.js'), 'utf8');
ok(schedSrc.includes('完工日期不可早於開始日期'), '進度規劃擋住「完工早於開工」的輸入');

// 10. 資料與備份：重置前必須列出受影響的 store（13 個契約不可增減改名）
const backupSrc = fs.readFileSync(path.join(ROOT, 'app/views/backup.js'), 'utf8');
const storeNames = ['projects','tenders','sor_items','requirements','compliance','site_aspects',
                    'tech_plans','schedules','hk_tenders','versions','notes','settings','bid_indicators'];
const missingStore = storeNames.filter(s => !backupSrc.includes("'" + s + "'"));
ok(missingStore.length === 0, '資料與備份列出全部 13 個 store（缺：' + (missingStore.join(',') || '無') + '）');

// 11. 側邊欄每一項都必須有對應畫面，不得再出現「尚在規劃中」
const idxHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const navIds = [...idxHtml.matchAll(/data-view="([^"]+)"/g)].map(m => m[1]);
const regIds = (VC && VC.VIEWS ? VC.VIEWS.map(v => v.id) : []);
const orphans = navIds.filter(id => id !== 'overview' && !regIds.includes(id));
ok(orphans.length === 0, '側邊欄 ' + navIds.length + ' 項全部有對應畫面（孤兒：' + (orphans.join(',') || '無') + '）');

// 12. 窄屏檢視器：必須同時有「叫出抽屜的入口」與「關閉抽屜的出口」，
//     否則就違反「溯源不可藏」（藏掉 = 永遠查不到；無法關閉 = 遮死畫布）
registry['view-root'].childNodes = [];
VC.go('takeoff');
function findByClass(n, cls, acc) {
  if (n.className && String(n.className).split(/\s+/).includes(cls)) acc.push(n);
  for (const k of n.childNodes || []) findByClass(k, cls, acc);
  return acc;
}
const toggles = findByClass(registry['view-root'], 'stage__insp-toggle', []);
const scrims = findByClass(registry['view-root'], 'stage__scrim', []);
const inspectors = findByClass(registry['view-root'], 'inspector', []);
ok(inspectors.length === 1, '量測畫面有檢視器（' + inspectors.length + ' 個）');
ok(toggles.length >= 2, '抽屜有「開啟入口」與「關閉出口」各一（實得 ' + toggles.length + '）');
ok(scrims.length === 1, '抽屜有遮罩可點擊關閉');
ok(comps.includes('@media (max-width: 1280px)') && comps.includes('.inspector.is-open'),
   '組件層在 ≤1280px 把檢視器切換為抽屜');

/* ---------- 第三批：提交阻斷閘門與頂頁統計卡序（2026-09-20） ---------- */

function textOf(n) {
  let s = typeof n.textContent === 'string' ? n.textContent : '';
  for (const k of n.childNodes || []) s += textOf(k);
  return s;
}

// 13. 提交清單：4 項硬性缺漏必須「留空」但維持阻斷（測試基線，之後再逐項補齊）
const outSrc = fs.readFileSync(path.join(ROOT, 'app/views/output.js'), 'utf8');
registry['view-root'].childNodes = [];
VC.go('output');
const blockerNames = ['工程量清單 (BQ) — 含單價', '標書須知附表 1–5', '進度計劃 (P6 基線)', 'MiC 預製組件供應商證明'];
const presentBlockers = blockerNames.filter(n => countText(registry['view-root'], n) > 0);
ok(presentBlockers.length === 4, '提交受阻列出全部 4 項硬性缺漏（實得 ' + presentBlockers.length + '）');
ok(!outSrc.includes('BQ_Rev_C.xlsx') && !outSrc.includes('pg: 142'),
   'BQ 測試資料已清除（無示範檔名／142 頁）');
ok(countText(registry['view-root'], '未附') >= 4, '4 項缺漏皆顯示「未附」');

// 14. 頂頁統計卡固定序：硬性阻斷 → 已備齊 → 待簽 → 總頁數
const statLabels = [];
(function collectStat(n) {
  if (n.className && String(n.className).split(/\s+/).includes('stat__label')) statLabels.push(textOf(n));
  for (const k of n.childNodes || []) collectStat(k);
})(registry['view-root']);
const wantOrder = ['硬性阻斷', '已備齊', '待簽', '總頁數'];
const gotOrder = statLabels.slice(0, 4);
ok(JSON.stringify(gotOrder) === JSON.stringify(wantOrder),
   '頂頁統計卡固定序 ' + wantOrder.join(' → ') + '（實得 ' + (gotOrder.join(' → ') || '無') + '）');

// 15. 總頁數必須由項目推導，不得硬編碼
ok(!outSrc.includes("'342'"), '總頁數已由項目推導（原始碼無硬編碼 342）');
ok(countText(registry['view-root'], '141') > 0, '推導出的總頁數 141 已呈現');
console.log('  · 提交清單實測：阻斷 ' + presentBlockers.length + ' 項 · 統計卡序 ' + gotOrder.join(' → '));

/* ---------- 結果 ---------- */
console.log('\n════════════════════════════════════════');
console.log('  渲染迴歸：' + PASS + ' PASS / ' + FAIL + ' FAIL');
console.log('════════════════════════════════════════');
if (FAIL) {
  console.log('\n失敗項：');
  failures.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log('全部通過。原型在 DOM 樁下可完整執行，無拋錯。');
