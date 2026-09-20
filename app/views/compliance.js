/* ============================================================================
   ViCons — 畫面 6：合規矩陣（HK GC Works 條款 × 提交要求逐項對應）
   ========================================================================= */
(function () {
  'use strict';
  var el = VC.el, frag = VC.frag;

  var MATRIX = [
    { cl: 'Cl. 2', title: '承包商的一般義務', req: '施工計劃書、方法說明書', status: 'ok', ev: 'Method Statement v3' },
    { cl: 'Cl. 12', title: '工程變更與指令', req: 'Site Instruction 記錄、變更估價', status: 'ok', ev: 'RSI ×8 已發' },
    { cl: 'Cl. 13', title: '工期與進度', req: '進度計劃、里程碑報告', status: 'warn', ev: '待補 P6 基線' },
    { cl: 'Cl. 33', title: '延長工期（EOT）', req: 'EOT 申請連延誤事件論證', status: 'warn', ev: '5 份待簽，日數未填' },
    { cl: 'Cl. 34', title: '損失與開支申索', req: '損失證明、單據、Daywork 記錄', status: 'ok', ev: 'Daywork PS 已備' },
    { cl: '—', title: '投標須知附表 3', req: 'MiC 預製組件供應商證明', status: 'danger', ev: '未提交' },
    { cl: '—', title: '投標須知附表 5', req: '工地安全計劃及風險評估', status: 'ok', ev: '已提交 2026-09-10' },
    { cl: '—', title: 'HA 醫院感染控制要求', req: 'IC 施工計劃、塵埃／噪音管制', status: 'ok', ev: '已提交' },
    { cl: '—', title: '出圖規範', req: '四要素齊備（General Notes／Dimension／Description／Scale）', status: 'warn', ev: '28 張圖中 3 張待補圖號' }
  ];

  var KINDS = { ok: ['符合', 'ok'], warn: ['部分', 'warn'], danger: ['缺失', 'danger'] };

  VC.registerView('compliance', { nav: 'compliance', wide: true }, function (root, ctx) {
    var counts = { ok: 0, warn: 0, danger: 0 };
    MATRIX.forEach(function (m) { counts[m.status]++; });
    var pct = Math.round((counts.ok / MATRIX.length) * 100);

    root.appendChild(ctx.pagehead({
      title: '合規矩陣',
      sub: 'HK GC Works 通用合約條款 × 投標要求 × 提交物逐項對應 · 缺失項會阻斷提交',
      crumb: '<a href="#overview-2">總覽</a> / 合規矩陣',
      actions: [
        el('button', { class: 'btn' }, '⇩ 匯出矩陣'),
        el('button', { class: 'btn btn--primary', onclick: function () { ctx.go('output'); } }, '前往提交清單 →')
      ]
    }));

    /* 進度總覽 */
    root.appendChild(el('div', { class: 'grid grid--4', style: 'margin-bottom:var(--sp-5)' },
      ctx.stat({ icon: '✓', value: counts.ok, label: '符合要求', badge: '已備齊', badgeKind: 'ok' }),
      ctx.stat({ icon: '~', value: counts.warn, label: '部分符合', badge: '需跟進', badgeKind: 'warn' }),
      ctx.stat({ icon: '✕', value: counts.danger, label: '缺失', badge: '阻斷提交', badgeKind: 'danger' }),
      ctx.stat({ icon: '%', value: pct + '%', label: '整體就緒度', delta: '較上週 +11%', deltaKind: 'up' })));

    /* 就緒度進度條 */
    root.appendChild(el('div', {
      style: 'background:var(--panel); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--sp-4); margin-bottom:var(--sp-5)'
    },
      el('div', { style: 'display:flex; align-items:baseline; gap:var(--sp-3); margin-bottom:var(--sp-2)' },
        el('span', { style: 'font-size:var(--fs-sm); font-weight:var(--fw-semi); flex:1' }, '提交就緒度'),
        el('span', { class: 'u-mono', style: 'font-size:var(--fs-2xs); color:var(--ink-faint)' }, counts.ok + ' / ' + MATRIX.length + ' 項符合')),
      el('div', { class: 'bar', style: 'height:8px' },
        el('div', { class: 'bar__fill', style: 'width:' + pct + '%' })),
      el('div', { class: 'u-muted', style: 'font-size:var(--fs-2xs); margin-top:var(--sp-2)' },
        '⚠ 有 ' + (counts.warn + counts.danger) + ' 項未完全就緒，提交清單會標記為阻斷')));

    /* 矩陣表 */
    root.appendChild(ctx.secTitle('條款對應'));
    root.appendChild(ctx.table({
      cols: [
        { key: 'c', label: '條款' },
        { key: 't', label: '條款名稱', cls: 'col-desc' },
        { key: 'r', label: '提交要求', cls: 'col-desc' },
        { key: 's', label: '狀態' },
        { key: 'e', label: '證據 / 現況' }
      ],
      rows: MATRIX.map(function (m) {
        var k = KINDS[m.status];
        return {
          cells: [
            el('span', { class: 'tag' }, m.cl),
            m.title,
            m.req,
            ctx.badge(k[0], k[1]),
            el('span', { class: 'u-soft', style: 'font-size:var(--fs-xs)' }, m.ev)
          ],
          attrs: { style: 'cursor:pointer', onclick: '' }
        };
      })
    }));

    /* 缺失項處理建議 */
    root.appendChild(el('div', { style: 'margin-top:var(--sp-5)' },
      ctx.card({
        title: '缺失與待跟進',
        mod: 'card--accent',
        body: el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-3)' },
          [
            { k: 'danger', t: '投標須知附表 3：MiC 預製組件供應商證明', d: '未提交。需向供應商索取，並附上香港 QSP 認證文件。截止 2026-09-26。' },
            { k: 'warn', t: 'Cl. 33 EOT 申請 5 份待簽，日數欄位未填', d: '需確認 HK GC Works 版本（2001 / 2012 / 2017），日數按延誤事件逐一計算後填入。' },
            { k: 'warn', t: 'Cl. 13 進度計劃缺 P6 基線', d: '需匯入 Primavera P6 基線，並與現行 WO 工序對齊。' },
            { k: 'warn', t: '出圖規範：28 張圖中 3 張缺圖號', d: 'AC-2024-045-A-003 圖號疑與顧問編號不一致，經 1000 dpi 目視複核確為 003，需向示範顧問公司確認。' }
          ].map(function (r) {
            var color = r.k === 'danger' ? 'var(--danger)' : 'var(--warn)';
            return el('div', {
              style: 'display:flex; gap:var(--sp-3); padding:var(--sp-3); border:1px solid var(--line); border-left:3px solid ' + color + '; border-radius:var(--r-md); background:var(--panel-2)'
            },
              el('div', { style: 'flex:1' },
                el('div', { style: 'font-size:var(--fs-sm); font-weight:var(--fw-semi); margin-bottom:var(--sp-1)' }, r.t),
                el('div', { class: 'u-muted', style: 'font-size:var(--fs-xs); line-height:var(--lh-base)' }, r.d)),
              el('button', {
                class: 'btn btn--sm', style: 'align-self:flex-start',
                onclick: function () { ctx.toast('已建立事項並指派負責人', 'ok'); }
              }, '建立事項'));
          }))
      })));
  });
})();
