/**
 * ViConst — OpenTakeoff `export_report` JSON → VicBid 造價核心 資料接口
 * =====================================================================
 *
 * `ot-vicbid-bridge.js` 處理 **CSV** 匯出；本模組處理 **JSON** 匯出
 * （MCP `export_report` 工具 / 畫布 Report 的「Export JSON」）。
 *
 * 兩條路徑都落到同一份 VicBid `sor_items` 契約，可互相對帳。
 *
 * ── 上游契約（唯讀，不可改）────────────────────────────────────────────
 * `reportJson()`（web/src/lib/totals.js）輸出 schema `opentakeoff.report.v1`，
 * **additive-only**：新鍵一律追加在尾，且永遠輸出（空陣列，不省略）。
 *
 *   {
 *     schema: "opentakeoff.report.v1",
 *     project_name: string|null,
 *     generated_with: "OpenTakeoff",
 *     sheets:     [{ sheet_id, sheet, scale_source, scale_confirmed }],
 *     conditions: [{ id, finish_tag, multiplier, waste_pct, shape_count,
 *                    floor_sf, wall_sf, border_sf, lf, ea, total_sf,
 *                    floor_sf_net, wall_sf_net, border_sf_net, lf_net,
 *                    total_sf_net, sy_net,
 *                    columns:   [{ id, name, value }],
 *                    materials: [{ name, unit, per, basis, round,
 *                                  basis_qty, qty }] }],
 *     by_sheet:   [{ sheet_id, sheet, rows: [{ id, finish_tag, floor_sf,
 *                    wall_sf, border_sf, lf, ea, total_sf, total_sf_net }] }],
 *     totals:     { total_sf, total_sf_net, lf, lf_net, ea, sy_net },
 *     materials:  [{ name, unit, qty }],
 *     markups:    [{ type, sheet_id, sheet, text, id, rfi_id,
 *                    condition_id, condition }],
 *     rfis:       [{ id, number, subject, ..., linked_markups, linked_sheets }],
 *     condition_columns: [{ id, name, values }],
 *     shape_labels: [string],
 *     by_label:   [{ label, rows: [{ id, finish_tag, floor_sf, wall_sf,
 *                    border_sf, lf, ea, total_sf, total_sf_net }] }],
 *     units:         "imperial (SF/LF — raw internal values)",
 *     display_units: "imperial" | "metric",
 *     roll_goods: [{ condition_id, finish_tag, material, roll_width_ft,
 *                    roll_length_ft, direction, cuts, order_lf, rolls,
 *                    order_qty, order_unit, oversize }]
 *   }
 *
 * ── 四個必須處理的上游細節 ──────────────────────────────────────────────
 *
 *  1. **量值語義（實測自 `conditionTotals()`，與 CSV 完全一致）**
 *       total_sf     = (floor + wall + border) × multiplier     ← 含 ×N，不含損耗
 *       total_sf_net = total_sf × (1 + waste_pct/100)           ← 下單量
 *       lf_net       = lf × (1 + waste_pct/100)
 *       sy_net       = total_sf_net / 9
 *     故取量一律用 `*_net`（含損耗淨量），與 CSV 橋取「Total SF w/Waste」同源。
 *     `ea` 無 waste 變體，直接用。
 *
 *  2. **`by_sheet` 不是可加總量（上游明文警告）**
 *     by_sheet 的行是 **BASE**：條件級 multiplier **未套用**、無損耗、無材料，
 *     且刻意沿用 conditions 的同名鍵（floor_sf…）以便 type-match —— 把它們
 *     當條件量加總會**靜默得到未乘 ×N 的錯數**。故本模組預設**不匯入**
 *     by_sheet（`include.bySheet` 預設 false），需要時須明示並自行承擔口徑。
 *
 *  3. **單位**：JSON 恆為 **raw 內部英尺值**（`units` 鍵自述此事），
 *     `display_units` 只記錄「匯出者當時在看哪個制式」，**不是**數值已被換算。
 *     匯出時預設 `unit:'display'`（metric 時 SF→m²、LF→m、SY 退役），
 *     使 JSON 與 CSV 兩條路徑的數值口徑一致、可互相對帳；
 *     要原始英尺值則傳 `unit:'raw'`。
 *
 *  4. **`scale_confirmed: false`** = 該圖比例由 agent 設定且無人確認 →
 *     其量值建立在未驗證的比例上。本模組會浮出 warning，**不**靜默通過。
 *
 * ── 下游契約（VicBid `sor_items`，與 CSV 橋完全相同）───────────────────
 *  DB `vicbid_db` v2，store `sor_items`，keyPath `id`：
 *      { id, code, description, unit, quantity, rate, importedAt }
 *  附加溯源欄位（VicBid 視圖忽略但保留）：
 *      source / otSchema / otImportId / otProfile / otProject / otRef / otRow
 *  `rate` 一律 0：量測不帶價。
 *
 * 無依賴、無構建。瀏覽器掛 `window.OTReportBridge`，Node 掛 `globalThis`。
 * IndexedDB 落地**委派**給 `window.OTBridge`（見 `writeToVicBid`），
 * 避免兩份重複的資料庫邏輯。
 */
(function (root) {
  'use strict';

  var SCHEMA = 'ot-vicbid-report-bridge/1';
  var REPORT_SCHEMA = 'opentakeoff.report.v1';
  var SOURCE = 'opentakeoff';

  /* 換算常數（國際英尺定義，精確值） */
  var SQFT_TO_SQM = 0.09290304;   // 1 ft² = 0.09290304 m²
  var FT_TO_M = 0.3048;           // 1 ft  = 0.3048 m
  var SQYD_TO_SQM = 0.83612736;   // 1 yd² = 0.83612736 m²

  /* ==================================================================
   * 1. 基礎工具
   * ================================================================== */

  function num(v) {
    var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
  }

  /** BQ 慣例：量保留三位小數，避免浮點尾巴污染 SoR。 */
  function trimNum(n) {
    return Math.round(n * 1000) / 1000;
  }

  function newId() {
    return (root.crypto && root.crypto.randomUUID)
      ? root.crypto.randomUUID()
      : 'otr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /** 給 code 用的穩定縮寫（材料／分類名 → MAT-XXX）。 */
  function slug(s, max) {
    return String(s == null ? '' : s)
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toUpperCase()
      .slice(0, max || 24);
  }

  function newItem(f) {
    return {
      id: newId(),
      code: f.code || '',
      description: f.description || '',
      unit: f.unit || '',
      quantity: trimNum(f.quantity || 0),
      rate: 0,                                 // 量測不帶價，留待 VicBid 報價
      importedAt: new Date().toISOString(),
      source: SOURCE,                          // ↓ 溯源欄位，VicBid 視圖會忽略
      otSchema: SCHEMA,
      otImportId: f.otImportId || '',
      otProfile: f.otProfile || '',
      otProject: f.otProject || '',
      otRef: f.otRef || '',
      otRow: f.otRow || 0
    };
  }

  /* ==================================================================
   * 2. 單位策略
   * ================================================================== */

  /**
   * 依 opts.unit 決定各維度的輸出單位與換算係數。
   *   'display'（預設）— 跟隨 report.display_units，與 CSV 匯出口徑一致
   *   'raw'           — 保留 JSON 原始英尺值
   */
  function unitPlan(displayUnits, mode) {
    if (mode === 'raw') {
      return { system: 'imperial', areaUnit: 'SF', lenUnit: 'LF', countUnit: 'EA', areaK: 1, lenK: 1 };
    }
    if (displayUnits === 'metric') {
      return { system: 'metric', areaUnit: 'm\u00b2', lenUnit: 'm', countUnit: 'EA', areaK: SQFT_TO_SQM, lenK: FT_TO_M };
    }
    return { system: 'imperial', areaUnit: 'SF', lenUnit: 'LF', countUnit: 'EA', areaK: 1, lenK: 1 };
  }

  /* ==================================================================
   * 3. 前置校驗
   * ================================================================== */

  /**
   * @param {object|string} input report.v1 物件或 JSON 字串
   * @returns {{ok:boolean, doc:object|null, errors:string[], warnings:string[]}}
   */
  function validate(input) {
    var doc = input;
    var errors = [];
    var warnings = [];

    if (typeof doc === 'string') {
      try {
        doc = JSON.parse(doc.replace(/^\ufeff/, ''));
      } catch (e) {
        return { ok: false, doc: null, errors: ['JSON 解析失敗：' + e.message], warnings: [] };
      }
    }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      return { ok: false, doc: null, errors: ['不是有效的 report 物件（預期 JSON object）。'], warnings: [] };
    }

    if (doc.schema !== REPORT_SCHEMA) {
      errors.push('schema 不符：預期 "' + REPORT_SCHEMA + '"，收到 ' + JSON.stringify(doc.schema) + '。'
        + '若這是 shapes/CVS 匯出，請改用 CSV 橋。');
    }
    if (!Array.isArray(doc.conditions)) errors.push('缺 `conditions` 陣列 —— 無法取得任何量值。');
    if (doc.units && String(doc.units).indexOf('imperial') === 0) {
      // 陳述事實，不是錯誤：JSON 恆為原始英尺值
      warnings.push('report 內量值為原始英尺（SF/LF）；已依 display_units=' + JSON.stringify(doc.display_units || null) + ' 決定輸出單位。');
    }

    // 比例未確認 → 量值建立在未驗證的比例上
    var unconfirmed = (Array.isArray(doc.sheets) ? doc.sheets : [])
      .filter(function (s) { return s && s.scale_confirmed === false; });
    if (unconfirmed.length) {
      warnings.push('有 ' + unconfirmed.length + ' 張圖的比例由 agent 設定且未經人工確認'
        + '（' + unconfirmed.map(function (s) { return s.sheet; }).join(', ') + '）——'
        + '其量值應在定價前以圖上標註尺寸覆核。');
    }

    return { ok: errors.length === 0, doc: doc, errors: errors, warnings: warnings };
  }

  /* ==================================================================
   * 4. 各段 → sor_items
   * ================================================================== */

  /**
   * 把一筆「可能有面積／長度／件數」的條件攤成最多三條 SoR 項目。
   * 與 CSV 橋的 explodeDims 同構（後綴 -AR / -LN / -EA）。
   */
  function explodeDims(rec, U, ctx) {
    var out = [];
    var dims = [
      { key: 'area', suffix: 'AR', unit: U.areaUnit, cn: '面積' },
      { key: 'len', suffix: 'LN', unit: U.lenUnit, cn: '長度' },
      { key: 'count', suffix: 'EA', unit: U.countUnit, cn: '件數' }
    ];

    for (var i = 0; i < dims.length; i++) {
      var d = dims[i];
      var qty = rec[d.key];
      if (!qty || qty <= 0) continue;           // 負量＝扣減，不進 SoR（會記錄在 notes）
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

  /** 條件列：靜默負量（扣減）會被記下但不產出項目，確保不無聲消失。 */
  function emitConditions(doc, U, ctx, acc) {
    var rows = doc.conditions || [];
    for (var i = 0; i < rows.length; i++) {
      var c = rows[i] || {};
      var finish = String(c.finish_tag == null ? '' : c.finish_tag);
      if (!finish) { acc.dropped++; continue; }

      var area = num(c.total_sf_net) * U.areaK;   // 含損耗淨量（＝CSV 的 w/Waste）
      var len = num(c.lf_net) * U.lenK;
      var count = num(c.ea);

      // 扣減診斷：gross 或 net 為負 → 明示，不靜默吞掉
      if (num(c.total_sf_net) < 0 || num(c.lf_net) < 0) {
        acc.negatives.push(finish + '（' + trimNum(num(c.total_sf_net)) + ' m²/SF 等價，扣減未進 SoR）');
      }

      var made = explodeDims(
        { codeBase: finish, label: finish, ref: c.id || '', row: i + 1,
          area: area, len: len, count: count },
        U,
        { importId: ctx.importId, profile: 'conditions', project: ctx.project,
          suffixText: (num(c.waste_pct) > 0 ? '含損耗 ' + num(c.waste_pct) + '%' : '')
            + (num(c.multiplier) > 1 ? ' ×' + num(c.multiplier) : '') }
      );
      if (made.length) { acc.section.rows++; acc.section.produced += made.length; } else { acc.dropped++; }
      Array.prototype.push.apply(acc.items, made);
    }
  }

  /** by-sheet：BASE 量（×N 未套用、無損耗）—— 非預設，需明示。 */
  function emitBySheet(doc, U, ctx, acc) {
    var groups = doc.by_sheet || [];
    for (var g = 0; g < groups.length; g++) {
      var gp = groups[g] || {};
      var sheet = String(gp.sheet == null ? '' : gp.sheet);
      var rows = Array.isArray(gp.rows) ? gp.rows : [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i] || {};
        var finish = String(r.finish_tag == null ? '' : r.finish_tag);
        if (!finish) { acc.dropped++; continue; }
        // by_sheet 無 Total 欄 → floor + wall + border（BASE，尚未乘 ×N）
        var area = (num(r.floor_sf) + num(r.wall_sf) + num(r.border_sf)) * U.areaK;
        var made = explodeDims(
          { codeBase: finish, label: finish + ' @ ' + (sheet || '?'), ref: gp.sheet_id || '', row: i + 1,
            area: area, len: num(r.lf) * U.lenK, count: num(r.ea) },
          U,
          { importId: ctx.importId, profile: 'by-sheet', project: ctx.project, suffixText: '(BASE 量，未乘 ×N)' }
        );
        if (made.length) { acc.section.rows++; acc.section.produced += made.length; } else { acc.dropped++; }
        Array.prototype.push.apply(acc.items, made);
      }
    }
  }

  /** by-label：ORDERED 量（×N 與損耗已套用），可用 total_sf_net。 */
  function emitByLabel(doc, U, ctx, acc) {
    var groups = doc.by_label || [];
    for (var g = 0; g < groups.length; g++) {
      var gp = groups[g] || {};
      var label = gp.label == null ? 'Unlabeled' : String(gp.label);
      var rows = Array.isArray(gp.rows) ? gp.rows : [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i] || {};
        var finish = String(r.finish_tag == null ? '' : r.finish_tag);
        if (!finish) { acc.dropped++; continue; }
        var made = explodeDims(
          { codeBase: finish, label: finish + ' <' + label + '>', ref: label, row: i + 1,
            area: num(r.total_sf_net) * U.areaK, len: num(r.lf_net) * U.lenK, count: num(r.ea) },
          U,
          { importId: ctx.importId, profile: 'by-label', project: ctx.project, suffixText: '' }
        );
        if (made.length) { acc.section.rows++; acc.section.produced += made.length; } else { acc.dropped++; }
        Array.prototype.push.apply(acc.items, made);
      }
    }
  }

  /** 專案級材料採購匯總（materials[]）。 */
  function emitMaterials(doc, U, ctx, acc) {
    var mats = doc.materials || [];
    for (var i = 0; i < mats.length; i++) {
      var m = mats[i] || {};
      var name = String(m.name == null ? '' : m.name);
      var qty = num(m.qty);
      if (!name || qty <= 0) { acc.dropped++; continue; }
      var it = newItem({
        code: 'BUY-' + slug(name),
        description: name + ' [採購匯總]',
        unit: String(m.unit || 'unit'),
        quantity: qty,
        otImportId: ctx.importId, otProfile: 'buy-list', otProject: ctx.project,
        otRef: '', otRow: i + 1
      });
      acc.section.rows++; acc.section.produced++;
      acc.items.push(it);
    }
  }

  /** 卷材下單量（roll_goods[]，CSV 路徑沒有這個維度）。 */
  function emitRollGoods(doc, U, ctx, acc) {
    var rolls = doc.roll_goods || [];
    for (var i = 0; i < rolls.length; i++) {
      var r = rolls[i] || {};
      var finish = String(r.finish_tag == null ? '' : r.finish_tag);
      var qty = num(r.order_qty);
      if (!finish || qty <= 0) { acc.dropped++; continue; }
      var unit = String(r.order_unit || 'roll');
      // 下單單位是長度時才需要換算；成品單位（roll 等）原樣保留
      if (U.system === 'metric' && /^(lf|ft|foot|feet)$/i.test(unit)) {
        qty = qty * FT_TO_M;
        unit = 'm';
      }
      var it = newItem({
        code: finish + '-ROLL',
        description: finish + ' [卷材下單'
          + (r.material ? ' ' + r.material : '')
          + (num(r.cuts) ? ' ' + num(r.cuts) + ' 刀' : '')
          + (num(r.rolls) ? ' ' + num(r.rolls) + ' 卷' : '')
          + (r.oversize === true ? ' ⚠超長' : '') + ']',
        unit: unit,
        quantity: qty,
        otImportId: ctx.importId, otProfile: 'roll-goods', otProject: ctx.project,
        otRef: r.condition_id || '', otRow: i + 1
      });
      acc.section.rows++; acc.section.produced++;
      acc.items.push(it);
    }
  }

  /* ==================================================================
   * 5. 主流程：report.v1 → 結構化結果
   * ================================================================== */

  var DEFAULT_INCLUDE = {
    conditions: true,
    rollGoods: true,
    materials: false,   // 與 conditions[].materials 同源，預設不重複匯入
    bySheet: false,     // BASE 量，會與 conditions 對不上（見檔頭細節 2）
    byLabel: false      // 與 conditions 是同一批量的另一種切法
  };

  /**
   * @param {object|string} input report.v1 物件或 JSON 字串
   * @param {{unit?:'display'|'raw', include?:object, importId?:string}} [opts]
   * @returns {{schema,reportSchema,project,unitSystem,displayUnits,sections,items,
   *            dropped,negatives,notes,warnings,errors,importId,summary}}
   */
  function convert(input, opts) {
    opts = opts || {};
    var v = validate(input);
    var result = {
      schema: SCHEMA,
      reportSchema: REPORT_SCHEMA,
      project: '',
      unitSystem: 'imperial',
      displayUnits: 'imperial',
      unitMode: opts.unit === 'raw' ? 'raw' : 'display',
      sections: [],
      items: [],
      dropped: 0,
      negatives: [],
      notes: [],
      warnings: v.warnings.slice(),
      // 與 CSV 橋同構的錯誤列 {row, message}，讓下游渲染只需一套邏輯
      errors: v.errors.map(function (m) { return { row: 0, message: m }; }),
      importId: opts.importId || ('otr:' + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
        + '-' + Math.random().toString(36).slice(2, 7)),
      summary: null
    };

    if (!v.ok) { result.summary = summarise(result); return result; }

    var doc = v.doc;
    result.project = doc.project_name ? String(doc.project_name) : '';
    result.displayUnits = doc.display_units === 'metric' ? 'metric' : 'imperial';

    var U = unitPlan(result.displayUnits, result.unitMode);
    result.unitSystem = U.system;

    var inc = {};
    Object.keys(DEFAULT_INCLUDE).forEach(function (k) { inc[k] = (k in (opts.include || {})) ? !!opts.include[k] : DEFAULT_INCLUDE[k]; });

    var ctx = { importId: result.importId, project: result.project };

    var acc = {
      items: result.items,
      dropped: 0,
      negatives: result.negatives,
      section: null
    };

    /** 開一個段落：登記 section 記錄 → 交給 emitter 填。 */
    function run(name, fn) {
      var s = { profile: name, rows: 0, produced: 0 };
      result.sections.push(s);
      acc.section = s;
      fn(s);
    }

    if (inc.conditions) run('conditions', function () { emitConditions(doc, U, ctx, acc); });
    if (inc.rollGoods) run('roll-goods', function () { emitRollGoods(doc, U, ctx, acc); });
    if (inc.materials) run('buy-list', function () { emitMaterials(doc, U, ctx, acc); });
    if (inc.byLabel) run('by-label', function () { emitByLabel(doc, U, ctx, acc); });
    if (inc.bySheet) run('by-sheet', function () { emitBySheet(doc, U, ctx, acc); });

    result.dropped = acc.dropped;
    acc = null;

    // by_sheet 被跳過時要說清楚，否則使用者以為漏了資料
    if (!inc.bySheet && (doc.by_sheet || []).length) {
      result.notes.push('已略過 by_sheet 段（' + doc.by_sheet.length + ' 張圖）：其為 BASE 量（×N 未套用、無損耗），'
        + '與 conditions 加總會得出錯誤數量。如需逐圖 BASE 量，匯入時設 include.bySheet=true。');
    }
    if (!inc.materials && (doc.materials || []).length) {
      result.notes.push('已略過頂層 materials 採購匯總（' + doc.materials.length + ' 項）：與 conditions 的材料用量同源。');
    }
    if (!inc.byLabel && (doc.by_label || []).length) {
      result.notes.push('已略過 by_label 段（' + doc.by_label.length + ' 個標籤）：與 conditions 是同一批量的另一種切法。');
    }
    if (result.negatives.length) {
      result.notes.push('有 ' + result.negatives.length + ' 條條件為負量（扣減），未產出 SoR 項目：'
        + result.negatives.slice(0, 8).join('；') + (result.negatives.length > 8 ? ' …' : ''));
    }
    if ((doc.markups || []).length) {
      result.notes.push('report 另有 ' + doc.markups.length + ' 個標註、' + (doc.rfis || []).length
        + ' 條 RFI —— 屬審查記錄，不進量測 SoR。');
    }

    if (!result.items.length && !result.errors.length) {
      result.errors.push({
        message: (doc.conditions || []).length
          ? '偵測到 ' + doc.conditions.length + ' 條條件，但其量值全為 0 或空白。請確認匯出的是已量測的條件。'
          : 'conditions 為空 —— 這份 report 沒有任何量測結果。'
      });
    }

    result.summary = summarise(result);
    return result;
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
      negatives: res.negatives.length,
      warnings: res.warnings.length,
      errors: res.errors.length,
      importId: res.importId,
      unitSystem: res.unitSystem,
      unitMode: res.unitMode
    };
  }

  /* ==================================================================
   * 6. 落地路徑 A：VicBid 格式 CSV（可離線、file:// 也能用）
   * ================================================================== */

  function toCsv(rows) {
    return rows.map(function (r) {
      return r.map(function (v) {
        var s = v == null ? '' : String(v);
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }

  /** 與 CSV 橋同表頭，加 UTF-8 BOM（Excel 雙擊不亂碼）。 */
  function toVicBidCsv(items) {
    var lines = [['Code', 'Description', 'Unit', 'Quantity', 'Rate']];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      lines.push([it.code, it.description, it.unit, it.quantity, it.rate]);
    }
    return '\ufeff' + toCsv(lines) + '\r\n';
  }

  /* ==================================================================
   * 7. 落地路徑 B：直寫 VicBid IndexedDB
   *    委派給 CSV 橋（window.OTBridge），單一實作、單一資料庫契約。
   * ================================================================== */

  function bridge() {
    var b = root.OTBridge;
    if (!b || typeof b.writeToVicBid !== 'function') {
      throw new Error('找不到 CSV 橋（OTBridge）。請先載入 ot-vicbid-bridge.js 再使用直寫功能。');
    }
    return b;
  }

  function canWriteVicBid() {
    var b = root.OTBridge;
    return !!(b && typeof b.canWriteVicBid === 'function' && b.canWriteVicBid());
  }

  function inspectVicBid() { return bridge().inspectVicBid(); }
  function writeToVicBid(items, mode) { return bridge().writeToVicBid(items, mode); }
  function undoImport(importId) { return bridge().undoImport(importId); }

  /* ==================================================================
   * 8. 對外介面
   * ================================================================== */

  var api = {
    SCHEMA: SCHEMA,
    REPORT_SCHEMA: REPORT_SCHEMA,
    DEFAULT_INCLUDE: DEFAULT_INCLUDE,
    validate: validate,
    convert: convert,
    toVicBidCsv: toVicBidCsv,
    canWriteVicBid: canWriteVicBid,
    inspectVicBid: inspectVicBid,
    writeToVicBid: writeToVicBid,
    undoImport: undoImport
  };

  root.OTReportBridge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
