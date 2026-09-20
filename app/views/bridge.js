/* ============================================================================
   ViCons — 畫面 4：算量接口（OpenTakeoff → SoR 造價核心）
   這是最關鍵的畫面：兩條輸入路徑（CSV / JSON）→ 同一份契約 → 預覽 → 落地。
   ========================================================================= */
(function () {
  'use strict';
  var el = VC.el, frag = VC.frag;

  /* 假映射結果，對應真實契約：每個非零維度各出一條，後綴 -AR / -LN / -EA */
  var MAPPED = [
    { code: 'CPT-01-AR', desc: 'Carpet Tile — Interface Urban Retreat · 面積（含損耗）', unit: 'SF', qty: 3343.725, rate: 0 },
    { code: 'VNL-02-AR', desc: 'Vinyl Sheet — Altro Aquarius · 面積（含損耗）', unit: 'SF', qty: 909.630, rate: 0 },
    { code: 'VNL-02-LN', desc: 'Vinyl Sheet — Altro Aquarius · 長度', unit: 'LF', qty: 96.400, rate: 0 },
    { code: 'PNT-03-AR', desc: 'Emulsion Paint — Dulux Diamond · 面積', unit: 'SF', qty: 6120.000, rate: 0 },
    { code: 'PNT-03-LN', desc: 'Emulsion Paint — Dulux Diamond · 長度', unit: 'LF', qty: 410.200, rate: 0 },
    { code: 'SKT-04-LN', desc: 'Skirting — Altro Whiterock 100mm · 長度（含損耗）', unit: 'LF', qty: 752.070, rate: 0 },
    { code: 'DR-05-EA', desc: 'Single Leaf Door — FD60 · 件數', unit: 'EA', qty: 18.000, rate: 0 },
    { code: 'MAT-01', desc: '材料：Carpet Tile Interface Urban Retreat — 採購量', unit: 'SY', qty: 371.530, rate: 0 },
    { code: 'BUY-01', desc: '採購匯總：Adhesive — 通用黏合劑', unit: 'GL', qty: 24.000, rate: 0 }
  ];

  function fmt(n) { return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }

  VC.registerView('bridge', { nav: 'bridge', wide: true }, function (root, ctx) {
    root.appendChild(ctx.pagehead({
      title: '算量接口',
      sub: '把量測結果映射成 SoR 造價契約（Code / Description / Unit / Quantity / Rate）· 預覽後才落地',
      crumb: '<a href="#overview-2">總覽</a> / 算量接口',
      actions: [
        el('button', { class: 'btn', onclick: function () { ctx.toast('已下載 VicBid 格式 CSV（UTF-8 BOM）', 'ok'); } }, '⇩ 下載 CSV'),
        el('button', { class: 'btn btn--primary', onclick: function () { ctx.toast('已寫入 vicbid_db · sor_items，9 筆 · 匯入編號 OT-20260919-1642', 'ok'); } }, '▸ 寫入造價核心')
      ]
    }));

    /* ---------- 步驟條 ---------- */
    root.appendChild(el('div', {
      style: 'display:flex; align-items:center; gap:var(--sp-2); margin-bottom:var(--sp-5); padding:var(--sp-3) var(--sp-4); background:var(--panel); border:1px solid var(--line); border-radius:var(--r-lg)'
    },
      [
        ['1', '匯入來源', 'done'], ['2', '解析契約', 'done'],
        ['3', '映射預覽', 'active'], ['4', '落地造價核心', 'todo']
      ].map(function (s, i) {
        var color = s[2] === 'done' ? 'var(--ok)' : s[2] === 'active' ? 'var(--cobalt)' : 'var(--ink-ghost)';
        return frag(
          i > 0 ? el('div', { style: 'flex:1; height:1px; background:var(--line)' }) : null,
          el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2)' },
            el('span', {
              style: 'width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-family:var(--font-mono);font-weight:700;border:1px solid ' + color + ';color:' + color + ';background:' + (s[2] === 'active' ? 'var(--cobalt-wash)' : 'transparent')
            }, s[0]),
            el('span', { style: 'font-size:var(--fs-xs); font-weight:var(--fw-semi); color:' + (s[2] === 'todo' ? 'var(--ink-ghost)' : 'var(--ink)') }, s[1])));
      })));

    /* ---------- 來源與選項 ---------- */
    var modeRows = [
      ['替換先前 OT 匯入', '只刪 source = opentakeoff 的紀錄，手動與 Excel 資料一律不動', true],
      ['追加', '直接追加，重複匯出會累積', false]
    ];
    var modeList = el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-3)' },
      modeRows.map(function (r, i) {
        return el('label', { style: 'display:flex; gap:var(--sp-3); align-items:flex-start; cursor:pointer' },
          el('input', { type: 'radio', name: 'mode', checked: i === 0 ? 'checked' : null, style: 'margin-top:3px' }),
          el('div', {},
            el('div', { style: 'font-size:var(--fs-sm); font-weight:var(--fw-semi)' }, r[0]),
            el('div', { class: 'u-muted', style: 'font-size:var(--fs-2xs)' }, r[1])));
      }));

    var warnBox = el('div', {
      style: 'margin-top:var(--sp-4); padding:var(--sp-3); background:var(--info-wash); border:1px solid var(--info-line); border-radius:var(--r-md); font-size:var(--fs-2xs); line-height:var(--lh-base); color:var(--info)'
    }, '⚑ 安全邊界：替換模式只會刪除 source = opentakeoff 的紀錄。手動輸入與 Excel 匯入的資料有專門測試守著，不會被動到。');

    var modeActions = el('div', { style: 'margin-top:var(--sp-3); display:flex; gap:var(--sp-2)' },
      el('button', { class: 'btn btn--sm', onclick: function () { ctx.toast('已回滾上一批匯入（OT-20260919-1520）· 9 筆', 'ok'); } }, '↶ 回滾上一批'),
      el('button', { class: 'btn btn--sm btn--danger', onclick: function () { ctx.toast('需二次確認才可全清', 'warn'); } }, '🗑 全清 OT 匯入'));

    root.appendChild(el('div', { class: 'grid grid--3', style: 'margin-bottom:var(--sp-5)' },
      ctx.card({
        title: '① 匯入來源',
        bodyMod: 'card__body--tight',
        body: frag(
          el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-2)' },
            [['report.v1 JSON', '來自 MCP export_report 或畫布 Export JSON', true],
             ['totals CSV', '來自畫布 Export CSV（多段式）', false],
             ['shapes CSV', '逐圖形明細（單段式）', false]].map(function (r, i) {
              return el('label', {
                style: 'display:flex; gap:var(--sp-3); align-items:flex-start; padding:var(--sp-3); border:1px solid ' + (i === 0 ? 'var(--cobalt)' : 'var(--line)') + '; background:' + (i === 0 ? 'var(--cobalt-wash)' : 'var(--panel)') + '; border-radius:var(--r-md); cursor:pointer'
              },
                el('input', { type: 'radio', name: 'src', checked: i === 0 ? 'checked' : null, style: 'margin-top:3px' }),
                el('div', {},
                  el('div', { style: 'font-size:var(--fs-sm); font-weight:var(--fw-semi)' }, r[0]),
                  el('div', { class: 'u-muted', style: 'font-size:var(--fs-2xs)' }, r[1])));
            })),
          el('div', { class: 'drop', style: 'margin-top:var(--sp-3); padding:var(--sp-5)' },
            el('div', { class: 'drop__title', style: 'font-size:var(--fs-sm)' }, '拖入或選擇檔案'),
            el('div', { class: 'drop__desc' }, '已載入：report-WO054B-1642.json · 14.2 KB')))
      }),

      ctx.card({
        title: '② 解析結果',
        bodyMod: 'card__body--tight',
        body: el('dl', { class: 'kv', style: 'grid-template-columns:96px 1fr' },
          el('dt', {}, 'Schema'), el('dd', {}, 'opentakeoff.report.v1'),
          el('dt', {}, '專案名'), el('dd', {}, 'WO 054B · 示範醫院 A'),
          el('dt', {}, '圖紙'), el('dd', {}, '14 張'),
          el('dt', {}, '條件'), el('dd', {}, '5 項'),
          el('dt', {}, '圖形'), el('dd', {}, '43 個'),
          el('dt', {}, '單位制'), el('dd', {}, 'imperial'),
          el('dt', {}, '比例'), el('dd', {}, '全部已確認'),
          el('dt', {}, '註腳'), el('dd', { style: 'color:var(--ok)' }, '0 個異常'))
      }),

      ctx.card({
        title: '③ 落地選項',
        bodyMod: 'card__body--tight',
        body: frag(
          modeList,
          warnBox,
          modeActions)
      })));

    /* ---------- 映射預覽表 ---------- */
    root.appendChild(ctx.secTitle('映射預覽 · 9 條 SoR 項目'));

    root.appendChild(ctx.table({
      cols: [
        { key: 'c', label: 'SoR 代碼', cls: 'col-code' },
        { key: 'd', label: '描述', cls: 'col-desc' },
        { key: 'u', label: '單位' },
        { key: 'q', label: '數量', cls: 'num' },
        { key: 'r', label: '單價', cls: 'num' },
        { key: 't', label: '溯源' }
      ],
      rows: MAPPED.map(function (m, i) {
        return {
          cells: [
            m.code,
            m.desc,
            el('span', { class: 'tag' }, m.unit),
            el('span', { class: 'num' }, fmt(m.qty)),
            el('input', {
              class: 'cell-input cell-input--missing', placeholder: '缺單價',
              'aria-label': m.code + ' 單價', value: ''
            }),
            el('button', {
              class: 'btn btn--sm btn--ghost',
              title: '檢視溯源資訊',
              onclick: function () { ctx.toast('溯源：otProject=WO 054B · otRow=' + (i + 12) + ' · otRef=' + m.code, 'info'); }
            }, 'ⓘ')
          ],
          attrs: { class: 'is-flagged' }
        };
      }),
      foot: ['9 條', '面積 3 · 長度 3 · 件數 1 · 材料 2', '', '', '全部缺單價', '']
    }));

    /* ---------- 口徑說明 ---------- */
    root.appendChild(el('div', { class: 'grid grid--2', style: 'margin-top:var(--sp-5)' },
      ctx.card({
        title: '面積取數口徑',
        body: el('div', { style: 'font-size:var(--fs-xs); line-height:var(--lh-loose); color:var(--ink-soft)' },
          frag(
            el('p', { style: 'margin:0 0 var(--sp-3)' },
              '面積優先取 ', el('b', {}, 'Total SF w/Waste'), '（含損耗的下單量），而非毛量。這是採購實際要買的數量，避免下單不足。'),
            el('div', { style: 'display:flex; gap:var(--sp-4); font-family:var(--font-mono); font-size:var(--fs-xs)' },
              el('div', {}, el('div', { class: 'u-muted' }, '毛量'), el('div', {}, '3,184.500 SF')),
              el('div', {}, el('div', { class: 'u-muted' }, '損耗 5%'), el('div', { style: 'color:var(--warn)' }, '+159.225 SF')),
              el('div', {}, el('div', { class: 'u-muted' }, '下單量'), el('div', { style: 'color:var(--ok)' }, '3,343.725 SF')))))
      }),
      ctx.card({
        title: '為何單價全是空白',
        body: el('div', { style: 'font-size:var(--fs-xs); line-height:var(--lh-loose); color:var(--ink-soft)' },
          frag(
            el('p', { style: 'margin:0 0 var(--sp-3)' },
              '量測只給量、不給價。單價一律由 SoR 造價核心決定，接口寫入時 ', el('code', {}, 'rate = 0'),
              '，造價核心會把它標成「缺單價」並納入報價審查 —— 這正是期望流程，不是缺陷。'),
            el('div', { style: 'display:flex; gap:var(--sp-3)' },
              el('button', { class: 'btn btn--sm', onclick: function () { ctx.go('sor'); } }, '前往 SoR 造價核心 →'),
              el('span', { class: 'u-muted', style: 'font-size:var(--fs-2xs); align-self:center' }, '142 項待填單價'))))
      })));
  });
})();
