/* ============================================================================
   ViCons — 畫面 5：SoR 造價核心
   沿用 VicBid sorDatabase 的職責，但在新版面下重做：缺單價是主角而非附註。
   ========================================================================= */
(function () {
  'use strict';
  var el = VC.el, frag = VC.frag;

  var ROWS = [
    { code: 'MB-5100', desc: '拆卸現有木門連門框，運離現場', unit: 'NR', qty: 18, rate: 480, src: 'manual' },
    { code: 'MB-5210', desc: '供應及安裝 FD60 單扇防火門連五金', unit: 'NR', qty: 18, rate: 4850, src: 'manual' },
    { code: 'CPT-01-AR', desc: 'Carpet Tile — 面積（含損耗 5%）', unit: 'SF', qty: 3343.725, rate: 0, src: 'opentakeoff' },
    { code: 'VNL-02-AR', desc: 'Vinyl Sheet — 面積（含損耗 8%）', unit: 'SF', qty: 909.63, rate: 0, src: 'opentakeoff' },
    { code: 'VNL-02-LN', desc: 'Vinyl Sheet — 長度', unit: 'LF', qty: 96.4, rate: 0, src: 'opentakeoff' },
    { code: 'PNT-03-AR', desc: 'Emulsion Paint — 面積', unit: 'SF', qty: 6120, rate: 0, src: 'opentakeoff' },
    { code: 'PNT-03-LN', desc: 'Emulsion Paint — 長度', unit: 'LF', qty: 410.2, rate: 0, src: 'opentakeoff' },
    { code: 'SKT-04-LN', desc: 'Skirting 100mm — 長度（含損耗 10%）', unit: 'LF', qty: 752.07, rate: 0, src: 'opentakeoff' },
    { code: 'DR-05-EA', desc: 'FD60 門 — 件數', unit: 'EA', qty: 18, rate: 0, src: 'opentakeoff' },
    { code: 'MB-6030', desc: '牆面批盪及油漆（病房走廊）', unit: 'm2', qty: 568.5, rate: 320, src: 'excel' },
    { code: 'ME-7010', desc: 'MVAC 風管拆除及重裝', unit: 'm', qty: 142.8, rate: 0, src: 'excel' },
    { code: 'ME-7022', desc: '消防灑水頭移位', unit: 'NR', qty: 64, rate: 380, src: 'excel' }
  ];

  function money(n) { return 'HK$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  VC.registerView('sor', { nav: 'sor', wide: true }, function (root, ctx) {
    var missing = ROWS.filter(function (r) { return !r.rate; });
    var priced = ROWS.filter(function (r) { return r.rate; });
    var subtotal = priced.reduce(function (a, r) { return a + r.qty * r.rate; }, 0);
    var otCount = ROWS.filter(function (r) { return r.src === 'opentakeoff'; }).length;

    root.appendChild(ctx.pagehead({
      title: 'SoR 造價核心',
      sub: '標準工程量清單 · 12 條項目 · 資料存於本機 vicbid_db，可整批回滾',
      crumb: '<a href="#overview-2">總覽</a> / SoR 造價核心',
      actions: [
        el('button', { class: 'btn' }, '⇧ 匯入 Excel'),
        el('button', { class: 'btn' }, '⇩ 匯出'),
        el('button', { class: 'btn btn--primary', onclick: function () { ctx.toast('已開啟批次填價精靈：9 項待填', 'info'); } }, '✎ 批次填價')
      ]
    }));

    /* ---------- 統計 ---------- */
    root.appendChild(el('div', { class: 'grid grid--4', style: 'margin-bottom:var(--sp-5)' },
      ctx.stat({ icon: '▥', value: ROWS.length, label: 'SoR 條目' }),
      ctx.stat({ icon: '✦', value: priced.length, label: '已填單價', badge: '50%', badgeKind: 'ok' }),
      ctx.stat({ icon: '!', value: missing.length, label: '缺單價', badge: '阻斷', badgeKind: 'danger' }),
      ctx.stat({ icon: '$', value: money(subtotal), label: '已計小計', badge: '未含缺價項', badgeKind: 'warn' })));

    /* ---------- 篩選列 ---------- */
    root.appendChild(el('div', {
      style: 'display:flex; align-items:center; gap:var(--sp-3); margin-bottom:var(--sp-3); flex-wrap:wrap'
    },
      el('div', { class: 'seg' },
        el('button', { class: 'seg__btn', 'aria-pressed': 'true' }, '全部 12'),
        el('button', { class: 'seg__btn', 'aria-pressed': 'false', onclick: function () { ctx.toast('已篩選：缺單價 9 項', 'info'); } }, '缺單價 9'),
        el('button', { class: 'seg__btn', 'aria-pressed': 'false' }, '來自量測 9'),
        el('button', { class: 'seg__btn', 'aria-pressed': 'false' }, '手動 2'),
        el('button', { class: 'seg__btn', 'aria-pressed': 'false' }, 'Excel 3')),
      el('div', { style: 'margin-left:auto; display:flex; gap:var(--sp-2)' },
        el('input', { class: 'input', style: 'width:220px; height:30px', placeholder: '搜尋代碼或描述…' }),
        el('button', { class: 'btn btn--sm' }, '⚙ 欄位'))));

    /* ---------- 主表 ---------- */
    root.appendChild(ctx.table({
      cols: [
        { key: 'c', label: '代碼', cls: 'col-code', sortable: true },
        { key: 'd', label: '描述', cls: 'col-desc' },
        { key: 'u', label: '單位' },
        { key: 'q', label: '數量', cls: 'num', sortable: true },
        { key: 'r', label: '單價', cls: 'num', sortable: true },
        { key: 'a', label: '金額', cls: 'num' },
        { key: 's', label: '來源' }
      ],
      rows: ROWS.map(function (r) {
        var isMissing = !r.rate;
        return {
          cells: [
            r.code,
            r.desc,
            el('span', { class: 'tag' }, r.unit),
            el('span', { class: 'num' }, r.qty.toLocaleString('en-US', { minimumFractionDigits: r.qty % 1 ? 3 : 0, maximumFractionDigits: 3 })),
            el('input', {
              class: 'cell-input' + (isMissing ? ' cell-input--missing' : ''),
              placeholder: isMissing ? '缺單價' : null,
              value: isMissing ? '' : r.rate.toFixed(2),
              'aria-label': r.code + ' 單價'
            }),
            isMissing
              ? el('span', { class: 'num', style: 'color:var(--ink-ghost)' }, '—')
              : el('span', { class: 'num' }, money(r.qty * r.rate)),
            r.src === 'opentakeoff'
              ? ctx.badge('量測', 'brand')
              : r.src === 'excel'
                ? ctx.badge('Excel', 'info')
                : ctx.badge('手動', 'neutral')
          ],
          attrs: { class: isMissing ? 'is-flagged' : '' }
        };
      }),
      foot: [ROWS.length + ' 條', '缺單價 ' + missing.length + ' 項不計入小計', '', '', '', money(subtotal), '']
    }));

    /* ---------- 底部說明 ---------- */
    root.appendChild(el('div', { class: 'grid grid--2', style: 'margin-top:var(--sp-5)' },
      ctx.card({
        title: '回滾與來源隔離',
        body: frag(
          el('p', { class: 'u-soft', style: 'font-size:var(--fs-xs); margin:0 0 var(--sp-3); line-height:var(--lh-loose)' },
            '手動輸入、Excel 匯入、量測匯入三種來源在庫中各帶 ', el('code', {}, 'source'), ' 標記。回滾只影響指定來源，' +
            '不會誤刪其他資料 —— 這條規則有專門測試守著。'),
          el('div', { style: 'display:flex; gap:var(--sp-2)', flexWrap: 'wrap' },
            el('button', { class: 'btn btn--sm', onclick: function () { ctx.toast('已回滾量測匯入 9 筆（OT-20260919-1642）', 'ok'); } }, '↶ 回滾量測 ' + otCount + ' 筆'),
            el('button', { class: 'btn btn--sm', onclick: function () { ctx.toast('已回滾 Excel 匯入 3 筆', 'ok'); } }, '↶ 回滾 Excel 3 筆'),
            el('button', { class: 'btn btn--sm btn--danger' }, '🗑 全清（需二次確認）')))
      }),
      ctx.card({
        title: '報價審查狀態',
        body: el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-3)' },
          [
            ['缺單價', missing.length + ' 項', 'danger', 25],
            ['單價明顯偏低（低於 SoR 2023 基準 30%）', '3 項', 'warn', 75],
            ['未對應 SoR 標準項目（自訂代碼）', '1 項', 'info', 92]
          ].map(function (r) {
            return el('div', {},
              el('div', { style: 'display:flex; align-items:baseline; gap:var(--sp-2); margin-bottom:var(--sp-1)' },
                el('span', { style: 'font-size:var(--fs-sm); flex:1' }, r[0]),
                ctx.badge(r[1], r[2])),
              el('div', { class: 'bar' },
                el('div', { class: 'bar__fill bar__fill--' + (r[2] === 'danger' ? '' : r[2] === 'warn' ? 'warn' : 'ok'), style: 'width:' + r[3] + '%' })));
          }))
      })));
  });
})();
