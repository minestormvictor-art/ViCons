/**
 * ViConst — OpenTakeoff → VicBid 造價核心 資料接口
 * =================================================
 *
 * 把 OpenTakeoff 匯出的 CSV 轉成 VicBid `sor_items` 契約，並可選擇直接寫入
 * VicBid 的 IndexedDB（同源時），或下載成 VicBid 可匯入的 CSV。
 *
 * ── 上游契約（唯讀，不可改）────────────────────────────────────────────
 * OpenTakeoff 的 `totalsToCsv()`（web/src/lib/totals.js）輸出是**多段式**的
 * 單一 CSV，段落以空行分隔，未出現的段直接省略：
 *
 *   1. conditions   Finish,Shapes,Multiplier,Waste %,Floor SF,Wall SF,Border SF,
 *                   Total SF,LF,EA,Total SF w/Waste,LF w/Waste,SY w/Waste
 *                   （metric 時 SF→m2、LF→m，且 SY 欄整個退役）
 *   2. materials    Finish,Material,Qty,Unit,Coverage,Note
 *      3. buy list   Material (combined),Qty,Unit
 *   4. by-sheet     Sheet,Sheet ID,Finish,Floor SF,Wall SF,Border SF,LF,EA
 *   5. by-label     Label,Finish,Floor SF,Wall SF,Border SF,LF,EA
 *
 * 另有 `shapesToCsv()` 的單段格式：
 *      Shape,Sheet,Sheet ID,Finish,Role,Area SF,LF,EA,Height ft,Height override,Origin
 *
 * 三個必須處理的上游細節：
 *   - **標題行**：`# <project> — <brand> report`（有 project name 時才出現）
 *   - **`#` 開頭**：註解／註腳行（例如 by-sheet 的基準量說明），非資料
 *   - **公式注入防護**：csv.js 對**字串**且以 `= + - @ \t` 開頭的儲存格加 `'`
 *     前綴；數字不受影響（負數扣減仍是 -12.5）。讀回時需剝除該前綴。
 *
 * ── 下游契約（VicBid `sor_items`，不可改）───────────────────────────────
 *  DB `vicbid_db` v2，store `sor_items`，keyPath `id`：
 *      { id, code, description, unit, quantity, rate, importedAt }
 *  VicBid 的 renderSoR 只讀以上欄位；額外欄位會被忽略但保留在庫中，
 *  因此本模組用它掛溯源資訊（source / otProject / otImportId …）。
 *
 * ── 設計原則 ────────────────────────────────────────────────────────────
 *  - 一個條件可能同時有面積／長度／件數，BQ 慣例是三條獨立項目，
 *    故每個非零維度各出一條（後綴 -AR / -LN / -EA）。
 *  - rate 一律 0：OpenTakeoff 只給量，不給價；VicBid 會將 rate=0 標為
 *    「缺單價」並列入報價審查，這正是我们希望的行為。
 *  - 寫入一律先預覽後確認，且可整批回滾（依 otImportId）。
 *
 * 無依賴、無構建。瀏覽器掛 `window.OTBridge`，Node 掛 `globalThis.OTBridge`。
 */
(function (root) {
  'use strict';

  var SCHEMA = 'ot-vicbid-bridge/1';
  var SOURCE = 'opentakeoff';

  /* ==================================================================
   * 1. CSV 解析（RFC4180 子集：引號、雙引號轉義、CRLF、嵌入換行）
   * ================================================================== */

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var cell = '';
    var quoted = false;
    var i = 0;
    var src = String(text == null ? '' : text);

    // 去掉 BOM（Excel 另存 CSV 常見）
    if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);

    while (i < src.length) {
      var ch = src[i];

      if (quoted) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cell += '"'; i += 2; continue; }
          quoted = false; i += 1; continue;
        }
        cell += ch; i += 1; continue;
      }

      if (ch === '"') { quoted = true; i += 1; continue; }
      if (ch === ',') { row.push(cell); cell = ''; i += 1; continue; }
      if (ch === '\r') { i += 1; continue; }
      if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i += 1; continue; }

      cell += ch; i += 1;
    }

    // 尾端未收尾的欄位／列
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /**
   * 還原上游的公式注入防護：`'=foo` → `=foo`。
   * 只對字串欄位套用；數字欄位上游本來就不加前綴。
   */
  function unguard(s) {
    var v = String(s == null ? '' : s);
    return /^'[=+\-@\t]/.test(v) ? v.slice(1) : v;
  }

  function normHeader(s) {
    return String(s == null ? '' : s).trim().toLowerCase();
  }

  function num(s) {
    if (s == null) return 0;
    var t = String(s).trim();
    if (t === '') return 0;
    var n = parseFloat(t.replace(/,/g, ''));
    return isFinite(n) ? n : 0;
  }

  /* ==================================================================
   * 2. 段落／欄位辨識
   * ================================================================== */

  /**
   * 用表頭簽名判斷這段是什麼。順序有意義：`shape` 必須先於 `sheet` 檢查，
   * 因為兩者首欄都是 s 開頭。
   */
  function detectProfile(cells) {
    var h = cells.map(normHeader);
    if (!h.length) return null;
    var first = h[0];
    var has = function (name) { return h.indexOf(name) >= 0; };
    var some = function (re) { return h.some(function (x) { return re.test(x); }); };

    if (first === 'shape' && has('sheet id')) return 'shapes';
    if (first === 'material (combined)') return 'buy-list';
    if (first === 'finish' && h[1] === 'material') return 'materials';
    if (first === 'sheet' && h[1] === 'sheet id') return 'by-sheet';
    if (first === 'label') return 'by-label';
    if (first === 'finish' && some(/^total (sf|m2)/)) return 'conditions';
    return null;
  }

  /**
   * 從表頭推斷單位制與各維度欄位索引。
   * metric：SF→m2、LF→m，SY 欄退役（上游 applyUnits 會把 sy_net 濾掉）。
   */
  function readUnits(cells) {
    var h = cells.map(normHeader);
    var metric = h.some(function (x) { return /(^|\s)m2(\s|$)/.test(x); });
    var idx = function () {
      for (var a = 0; a < arguments.length; a++) {
        var i = h.indexOf(arguments[a]);
        if (i >= 0) return i;
      }
      return -1;
    };
    return {
      metric: metric,
      areaUnit: metric ? 'm\u00b2' : 'SF',
      lenUnit: metric ? 'm' : 'LF',
      countUnit: 'EA',
      col: {
        finish: idx('finish'),
        label: idx('label'),
        sheet: idx('sheet'),
        sheetId: idx('sheet id'),
        shape: idx('shape'),
        role: idx('role'),
        material: idx('material'),
        qty: idx('qty'),
        unit: idx('unit'),
        coverage: idx('coverage'),
        note: idx('note'),
        // 優先取「含損耗」淨量：Total SF w/Waste 才是下單量。
        // by-sheet / by-label / shapes 段沒有 Total 欄，只有分量欄，
        // 需靠 areaOf() 把 floor/wall/border 相加（見下）。
        area: idx('total sf w/waste', 'total m2 w/waste', 'total sf', 'total m2'),
        floor: idx('floor sf', 'floor m2'),
        wall: idx('wall sf', 'wall m2'),
        border: idx('border sf', 'border m2'),
        areaGross: idx('total sf', 'total m2'),
        areaRaw: idx('area sf', 'area m2'),
        len: idx('lf w/waste', 'm w/waste', 'lf', 'm'),
        lenGross: idx('lf', 'm'),
        count: idx('ea'),
        height: idx('height ft', 'height m')
      }
    };
  }

  /**
   * 取一列的面積量，三段式依序退讓：
   *   1. Total（conditions 段：已含 wall/border）
   *   2. Floor + Wall + Border（by-sheet / by-label 段只有分量欄）
   *   3. Area（shapes 段）
   * 上游不可能同時給兩種，所以這個順序不會重複計算。
   */
  function areaOf(cells, C) {
    if (C.area >= 0) {
      var total = num(cells[C.area]);
      if (total > 0) return total;
    }
    var sum = 0;
    [C.floor, C.wall, C.border].forEach(function (i) {
      if (i >= 0) sum += num(cells[i]);
    });
    if (sum > 0) return sum;
    return C.areaRaw >= 0 ? num(cells[C.areaRaw]) : 0;
  }

  /* ==================================================================
   * 3. 內容物 → sor_items
   * ================================================================== */

  function trimNum(n) {
    // BQ 慣例：量保留三位小數即可，避免上游浮點尾巴污染 SoR
    return Math.round(n * 1000) / 1000;
  }

  function newItem(fields) {
    return {
      id: (root.crypto && root.crypto.randomUUID)
        ? root.crypto.randomUUID()
        : 'ot-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
      code: fields.code || '',
      description: fields.description || '',
      unit: fields.unit || '',
      quantity: trimNum(fields.quantity || 0),
      rate: 0,                       // 量測不帶價，留待 VicBid 報價
      importedAt: new Date().toISOString(),
      source: SOURCE,                // 以下為溯源欄位，VicBid 視圖會忽略
      otSchema: SCHEMA,
      otImportId: fields.otImportId || '',
      otProfile: fields.otProfile || '',
      otProject: fields.otProject || '',
      otRef: fields.otRef || '',
      otRow: fields.otRow || 0
    };
  }

  /**
   * 把一筆「可能有面積／長度／件數」的紀錄攤成最多三條 SoR 項目。
   * conditions / by-sheet / by-label / shapes 四種 profile 共用此邏輯。
   */
  function explodeDims(rec, units, ctx) {
    var out = [];
    var dims = [
      { key: 'area', suffix: 'AR', unit: units.areaUnit, cn: '面積' },
      { key: 'len', suffix: 'LN', unit: units.lenUnit, cn: '長度' },
      { key: 'count', suffix: 'EA', unit: units.countUnit, cn: '件數' }
    ];

    for (var i = 0; i < dims.length; i++) {
      var d = dims[i];
      var qty = rec[d.key];
      if (!qty || qty <= 0) continue;
      out.push(newItem({
        code: rec.codeBase + '-' + d.suffix,
        description: rec.label + ' [' + d.cn + ']' + (ctx.suffixText ? ' ' + ctx.suffixText : ''),
        unit: d.unit,
        quantity: qty,
        otImportId: ctx.importId,
        otProfile: ctx.profile,
        otProject: ctx.project,
        otRef: rec.ref || '',
        otRow: rec.row
      }));
    }
    return out;
  }

  /* ==================================================================
   * 4. 主流程：文字 → 結構化結果
   * ================================================================== */

  /**
   * @param {string} text  OpenTakeoff CSV 全文
   * @returns {{schema,project,unitSystem,sections,items,dropped,notes,errors}}
   */
  function convert(text) {
    var rows = parseCsv(text);
    var result = {
      schema: SCHEMA,
      project: '',
      unitSystem: 'imperial',
      sections: [],
      items: [],
      dropped: 0,             // 空值／TOTAL／註解等未產生項目的資料列
      notes: [],
      errors: [],
      grandTotalRow: null
    };

    var importId = 'ot:' + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '') +
      '-' + Math.random().toString(36).slice(2, 7);

    var section = null;       // 當前段落
    var units = null;

    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r];
      var first = cells.length ? String(cells[0]).trim() : '';

      // 整列空 → 段落結束
      if (!cells.length || (cells.length === 1 && first === '')) { section = null; continue; }

      // 註解／標題行
      if (first.charAt(0) === '#') {
        var body = first.replace(/^#\s*/, '');
        if (!result.project && /report\s*$/i.test(body)) {
          result.project = body.replace(/\s*[\u2014\u2013-]\s*\w[\w\s]*report\s*$/i, '').trim();
        } else if (body) {
          result.notes.push(body);
        }
        continue;
      }

      // 表頭 → 開新段落
      if (!section) {
        var profile = detectProfile(cells);
        if (profile) {
          units = readUnits(cells);
          // 單位制是整份匯出的設定，但只有帶尺寸欄的段落能證明它。
          // materials / buy-list 的表頭（Finish,Material,Qty,Unit…）沒有 m2，
          // 若讓它們覆寫就會把 metric 誤判成 imperial —— 故只升級、不降級。
          if (units.metric) result.unitSystem = 'metric';
          section = { profile: profile, headerRow: r + 1, rows: 0, produced: 0 };
          result.sections.push(section);
          continue;
        }
      }

      if (!section) { result.dropped++; continue; }

      // TOTAL 列：記下總量但不當作項目
      if (first.toUpperCase() === 'TOTAL') {
        result.grandTotalRow = cells.slice();
        continue;
      }

      try {
        var made = emitRow(section.profile, cells, units, {
          importId: importId,
          project: result.project,
          row: r + 1
        });
        if (made.length) {
          section.rows++;
          section.produced += made.length;
          Array.prototype.push.apply(result.items, made);
        } else {
          result.dropped++;
        }
      } catch (e) {
        result.errors.push({ row: r + 1, message: e.message });
        result.dropped++;
      }
    }

    // 沒有成功產出任何項目 → 給一個可操作的錯誤
    if (!result.items.length && !result.errors.length) {
      result.errors.push({
        row: 0,
        message: result.sections.length
          ? '偵測到 OpenTakeoff 段落，但所有量值皆為 0 或空白。請確認匯出的是已量測的條件。'
          : '找不到任何 OpenTakeoff 表頭。這可能不是 totals/shapes 匯出的 CSV（應含 Finish 或 Shape 首欄）。'
      });
    }

    result.importId = importId;
    result.summary = summarise(result);
    return result;
  }

  /** 依段落類型把一列資料變成 SoR 項目。 */
  function emitRow(profile, cells, units, ctx) {
    var C = units.col;
    var pick = function (i) { return i >= 0 ? unguard(cells[i]) : ''; };
    var n = function (i) { return i >= 0 ? num(cells[i]) : 0; };
    var area = areaOf(cells, C);
    var len = n(C.len);
    var count = n(C.count);

    if (profile === 'conditions') {
      var finish = pick(C.finish);
      if (!finish) return [];
      return explodeDims(
        { codeBase: finish, label: finish, ref: '', row: ctx.row,
          area: area, len: len, count: count },
        units, { importId: ctx.importId, profile: profile, project: ctx.project });
    }

    if (profile === 'by-sheet') {
      var f2 = pick(C.finish);
      var sheet = pick(C.sheet);
      if (!f2) return [];
      return explodeDims(
        { codeBase: f2, label: f2 + ' @ ' + (sheet || '?'), ref: pick(C.sheetId), row: ctx.row,
          area: area, len: len, count: count },
        units, { importId: ctx.importId, profile: profile, project: ctx.project });
    }

    if (profile === 'by-label') {
      var f3 = pick(C.finish);
      var label = pick(C.label);
      if (!f3) return [];
      return explodeDims(
        { codeBase: f3, label: f3 + ' <' + (label || 'Unlabeled') + '>', ref: '', row: ctx.row,
          area: area, len: len, count: count },
        units, { importId: ctx.importId, profile: profile, project: ctx.project });
    }

    if (profile === 'shapes') {
      var f4 = pick(C.finish);
      if (!f4) return [];
      var shape = pick(C.shape);
      var role = pick(C.role);
      return explodeDims(
        { codeBase: f4, label: f4 + ' :: ' + shape + (role ? '/' + role : ''),
          ref: pick(C.sheetId), row: ctx.row,
          area: area, len: len, count: count },
        units, { importId: ctx.importId, profile: profile, project: ctx.project });
    }

    if (profile === 'materials') {
      // 每條條件的材料用量：Finish, Material, Qty, Unit, Coverage, Note
      var mat = pick(C.material);
      var qty = n(C.qty);
      if (!mat || qty <= 0) return [];
      return [newItem({
        code: 'MAT-' + mat.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase().slice(0, 24),
        description: mat + ' @ ' + pick(C.finish) + ' [材料用量' + (pick(C.coverage) ? ' ' + pick(C.coverage) : '') + ']',
        unit: pick(C.unit) || 'unit',
        quantity: qty,
        otImportId: ctx.importId, otProfile: profile, otProject: ctx.project,
        otRef: pick(C.coverage), otRow: ctx.row
      })];
    }

    if (profile === 'buy-list') {
      // Material (combined), Qty, Unit —— 專案級採購匯總
      var name = unguard(cells[0]);
      var q2 = n(1);
      if (!name || name.toLowerCase() === 'material (combined)' || q2 <= 0) return [];
      return [newItem({
        code: 'BUY-' + name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase().slice(0, 24),
        description: name + ' [採購匯總]',
        unit: unguard(cells[2]) || 'unit',
        quantity: q2,
        otImportId: ctx.importId, otProfile: profile, otProject: ctx.project,
        otRef: '', otRow: ctx.row
      })];
    }

    return [];
  }

  function summarise(res) {
    var byUnit = {};
    var byProfile = {};
    for (var i = 0; i < res.items.length; i++) {
      var it = res.items[i];
      byUnit[it.unit] = (byUnit[it.unit] || 0) + 1;
      byProfile[it.otProfile] = (byProfile[it.otProfile] || 0) + 1;
    }
    return {
      items: res.items.length,
      sections: res.sections.length,
      profiles: Object.keys(byProfile),
      byProfile: byProfile,
      byUnit: byUnit,
      dropped: res.dropped,
      errors: res.errors.length,
      importId: res.importId
    };
  }

  /* ==================================================================
   * 5. 落地路徑 A：VicBid 格式 CSV（可離線、file:// 也能用）
   * ================================================================== */

  function toCsv(rows) {
    return rows.map(function (r) {
      return r.map(function (v) {
        var s = v == null ? '' : String(v);
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }

  /**
   * VicBid `sor_items` 匯入器認得的表頭：Code/Description/Unit/Quantity/Rate。
   * 加 UTF-8 BOM，Excel 直接雙擊不亂碼。
   */
  function toVicBidCsv(items) {
    var lines = [['Code', 'Description', 'Unit', 'Quantity', 'Rate']];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      lines.push([it.code, it.description, it.unit, it.quantity, it.rate]);
    }
    return '\ufeff' + toCsv(lines) + '\r\n';
  }

  /* ==================================================================
   * 6. 落地路徑 B：直寫 VicBid IndexedDB（需同源）
   * ================================================================== */

  var VICBID_DB = 'vicbid_db';
  var VICBID_DB_VERSION = 2;
  // 必須與 VicBid app.js 的 STORES 完全一致，否則升級出的庫與 VicBid 不相容
  var VICBID_STORES = ['projects', 'tenders', 'sor_items', 'requirements', 'compliance',
    'site_aspects', 'tech_plans', 'schedules', 'hk_tenders', 'versions', 'notes',
    'settings', 'bid_indicators'];

  /** 本頁是否與 VicBid 同源（file:// 各檔案視為同一 opaque origin，不可直寫）。 */
  function canWriteVicBid() {
    if (typeof indexedDB === 'undefined') return false;
    if (root.location && root.location.protocol === 'file:') return false;
    return true;
  }

  function openVicBid() {
    return new Promise(function (resolve, reject) {
      var created = false;
      var req;
      try {
        req = indexedDB.open(VICBID_DB, VICBID_DB_VERSION);
      } catch (e) { reject(e); return; }

      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        var existed = db.objectStoreNames.length > 0;
        for (var i = 0; i < VICBID_STORES.length; i++) {
          if (!db.objectStoreNames.contains(VICBID_STORES[i])) {
            db.createObjectStore(VICBID_STORES[i], { keyPath: 'id' });
          }
        }
        created = !existed;
      };
      req.onsuccess = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('sor_items')) {
          db.close();
          reject(new Error('VicBid 資料庫結構不完整（缺 sor_items）。'));
          return;
        }
        resolve({ db: db, created: created });
      };
      req.onerror = function (e) {
        var err = e.target.error;
        if (err && err.name === 'VersionError') {
          reject(new Error('本機 VicBid 資料庫版本比介面預期的新（' + VICBID_DB + '）。請更新 ViConst 轉接器後重試。'));
        } else {
          reject(err || new Error('開啟 VicBid 資料庫失敗'));
        }
      };
    });
  }

  function reqDone(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /** 先讀一遍，讓「預覽」與「實際寫入」看到同一份現況。 */
  async function inspectVicBid() {
    var ctx = await openVicBid();
    try {
      var all = await reqDone(ctx.db.transaction('sor_items', 'readonly').objectStore('sor_items').getAll());
      var list = all || [];
      var priorOt = list.filter(function (r) { return r && r.source === SOURCE; });
      var batches = {};
      priorOt.forEach(function (r) { if (r.otImportId) batches[r.otImportId] = (batches[r.otImportId] || 0) + 1; });
      return {
        total: list.length,
        priorOt: priorOt.length,
        manual: list.length - priorOt.length,
        batches: batches,
        dbCreated: ctx.created
      };
    } finally {
      ctx.db.close();
    }
  }

  /**
   * 寫入 VicBid SoR。
   * @param {Array} items  convert() 產出的項目
   * @param {'append'|'replace-ot'} mode  append 直接追加；replace-ot 先清掉本介面
   *        先前寫入的全部項目（只刪 source==='opentakeoff'，手動／Excel 匯入的不動）
   */
  async function writeToVicBid(items, mode) {
    if (!canWriteVicBid()) throw new Error('目前非 http(s) 環境，無法直寫 VicBid。請改用 CSV 下載。');
    if (!items || !items.length) throw new Error('沒有可寫入的項目。');

    var ctx = await openVicBid();
    var deleted = 0;
    var written = 0;

    try {
      if (mode === 'replace-ot') {
        var all = await reqDone(ctx.db.transaction('sor_items', 'readonly').objectStore('sor_items').getAll());
        var victims = (all || []).filter(function (r) { return r && r.source === SOURCE; });
        if (victims.length) {
          await new Promise(function (resolve, reject) {
            var tx = ctx.db.transaction('sor_items', 'readwrite');
            var os = tx.objectStore('sor_items');
            victims.forEach(function (v) { os.delete(v.id); });
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { reject(tx.error); };
            tx.onabort = function () { reject(tx.error || new Error('交易中止')); };
          });
          deleted = victims.length;
        }
      }

      await new Promise(function (resolve, reject) {
        var tx = ctx.db.transaction('sor_items', 'readwrite');
        var os = tx.objectStore('sor_items');
        items.forEach(function (it) {
          os.put(it);
          written++;
        });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('交易中止')); };
      });

      return { written: written, deleted: deleted, dbCreated: ctx.created };
    } finally {
      ctx.db.close();
    }
  }

  /** 依 otImportId 整批回滾（誤匯時的救援）。 */
  async function undoImport(importId) {
    if (!canWriteVicBid()) throw new Error('目前非 http(s) 環境，無法操作 VicBid。');
    var ctx = await openVicBid();
    try {
      var all = await reqDone(ctx.db.transaction('sor_items', 'readonly').objectStore('sor_items').getAll());
      var victims = (all || []).filter(function (r) {
        return r && r.source === SOURCE && (!importId || r.otImportId === importId);
      });
      if (!victims.length) return { deleted: 0 };
      await new Promise(function (resolve, reject) {
        var tx = ctx.db.transaction('sor_items', 'readwrite');
        var os = tx.objectStore('sor_items');
        victims.forEach(function (v) { os.delete(v.id); });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
      return { deleted: victims.length };
    } finally {
      ctx.db.close();
    }
  }

  /* ==================================================================
   * 7. 對外介面
   * ================================================================== */

  var api = {
    SCHEMA: SCHEMA,
    parseCsv: parseCsv,
    detectProfile: detectProfile,
    convert: convert,
    toVicBidCsv: toVicBidCsv,
    canWriteVicBid: canWriteVicBid,
    inspectVicBid: inspectVicBid,
    writeToVicBid: writeToVicBid,
    undoImport: undoImport
  };

  root.OTBridge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
