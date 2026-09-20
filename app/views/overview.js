/* ============================================================================
   ViCons — 畫面 1 & 2：總覽
   兩個狀態共用同一支渲染器，只切換資料來源，證明「空狀態 → 有資料」是同一版面。
   ========================================================================= */
(function () {
  'use strict';
  var el = VC.el, frag = VC.frag;

  /* 假資料：模擬從 IndexedDB 讀回 */
  var EMPTY = { projects: [], sorItems: [], requirements: [], tenders: [] };
  var FULL = {
    projects: [
      { id: 'p1', name: 'WO 054B · 示範醫院 A 專科翻新', code: 'AC-2024-045', active: true },
      { id: 'p2', name: '示範診所 B 內部裝修', code: 'AC-2024-051' },
      { id: 'p3', name: '示範醫院 C 外牆修葺', code: 'AC-2024-038' }
    ],
    tenders: [{ id: 't1' }],
    sorItems: new Array(142).fill(0).map(function (_, i) {
      return { id: 's' + i, code: 'MB-' + (5100 + i), rate: i % 7 === 0 ? 0 : 1200 + i };
    }),
    requirements: [
      { id: 'r1', status: 'pending' }, { id: 'r2', status: 'pending' },
      { id: 'r3', status: 'pending' }, { id: 'r4', status: 'done' },
      { id: 'r5', status: 'done' }, { id: 'r6', status: 'pending' }
    ]
  };

  function render(root, ctx, data) {
    var projects = data.projects;
    var pending = data.requirements.filter(function (r) { return r.status === 'pending'; });
    var missing = data.sorItems.filter(function (s) { return !s.rate; });
    var isNew = projects.length === 0;

    root.appendChild(ctx.pagehead({
      title: isNew ? '歡迎使用 ViCons' : '投標總覽',
      sub: isNew
        ? '投標與算量協同平台 · 從圖紙量測到提交清單，一條線走完'
        : '當前專案 ' + projects[0].name + ' · 資料全部存於本機 IndexedDB，不上傳',
      actions: isNew
        ? [el('button', { class: 'btn btn--primary', onclick: function () { ctx.go('overview-2'); } }, '載入示範資料'),
           el('button', { class: 'btn', onclick: function () { ctx.toast('開啟投標須知匯入', 'info'); } }, '匯入標書')]
        : [el('button', { class: 'btn', onclick: function () { ctx.toast('已匯出進度摘要 CSV', 'ok'); } }, '⇩ 匯出摘要'),
           el('button', { class: 'btn btn--primary', onclick: function () { ctx.go('takeoff'); } }, '▶ 繼續量測')]
    }));

    /* ---------- 四階段流程條 ---------- */
    var stepIdx = isNew ? 0 : 2;
    var steps = [
      { n: '01', t: '圖紙量測', d: '從 PDF 施工圖／完成圖量取面積、長度、件數', nav: 'takeoff' },
      { n: '02', t: '算量接口', d: 'CSV／JSON 映射到 SoR 造價契約', nav: 'bridge' },
      { n: '03', t: '編製內容', d: 'Site Aspect、技術方案、進度、合規矩陣', nav: 'compliance' },
      { n: '04', t: '提交產出', d: '提交清單、缺漏阻斷、報價審查', nav: 'output' }
    ];
    root.appendChild(el('div', { class: 'flow', style: 'margin-bottom:var(--sp-6)' },
      steps.map(function (s, i) {
        return el('div', {
          class: 'flow__step' + (i === stepIdx ? ' flow__step--active' : i < stepIdx ? ' flow__step--done' : ''),
          style: 'cursor:pointer',
          onclick: function () { if (s.nav === 'bridge' || s.nav === 'takeoff' || s.nav === 'compliance' || s.nav === 'output') ctx.go(s.nav); }
        },
          el('div', { class: 'flow__n' }, s.n + (i === stepIdx ? ' · 當前' : i < stepIdx ? ' · 完成' : '')),
          el('div', { class: 'flow__t' }, s.t),
          el('div', { class: 'flow__d' }, s.d));
      })));

    /* ---------- 空狀態：只給一條明確入口 ---------- */
    if (isNew) {
      var dropZone = el('div', { class: 'drop', onclick: function () { ctx.toast('選擇檔案…', 'info'); } },
        el('div', { class: 'drop__icon' }, '⇪'),
        el('div', { class: 'drop__title' }, '拖曳標書檔案到此處'),
        el('div', { class: 'drop__desc' }, '支援 PDF · DOCX · XLSX · 單檔上限 200 MB · 全程不上傳'));

      var dropActions = el('div', { style: 'display:flex; gap:var(--sp-2); margin-top:var(--sp-4)' },
        el('button', { class: 'btn btn--primary', onclick: function () { ctx.go('overview-2'); } }, '改用示範資料探索'),
        el('button', { class: 'btn', onclick: function () { ctx.go('takeoff'); } }, '直接開量測引擎'));

      var startCard = ctx.card({
        title: '開始第一個專案', mod: 'card--accent',
        body: frag(
          el('p', { class: 'u-soft', style: 'margin:0 0 var(--sp-4)' },
            'ViCons 需要一份標書或一組圖紙作為起點。拖入 PDF 或 Excel，系統會自動建立專案並解析投標指標。'),
          dropZone,
          dropActions)
      });

      var featureRows = [
        ['◫', '量測引擎', 'OpenTakeoff 內核，42 個 MCP 工具可被 agent 直接驅動'],
        ['⇄', '算量接口', '面積／長度／件數各出一條 BQ 項目，帶完整溯源'],
        ['▥', 'SoR 造價核心', '量測只給量不給價，缺單價自動標紅列入審查'],
        ['⚖', '合規矩陣', 'HK GC Works 條款 × 提交要求逐項對應']
      ];

      var featureList = el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-3)' },
        featureRows.map(function (r) {
          return el('div', { style: 'display:flex; gap:var(--sp-3); align-items:flex-start' },
            el('span', { style: 'color:var(--cobalt); font-size:16px; width:20px; flex-shrink:0' }, r[0]),
            el('div', {},
              el('div', { style: 'font-weight:var(--fw-semi); font-size:var(--fs-sm)' }, r[1]),
              el('div', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, r[2])));
        }));

      var whatCard = ctx.card({ title: '這個平台會做什麼', body: featureList });

      root.appendChild(el('div', { class: 'grid grid--2' }, startCard, whatCard));
      return;
    }

    /* ---------- 有資料：統計卡 ---------- */
    root.appendChild(el('div', { class: 'grid grid--4', style: 'margin-bottom:var(--sp-5)' },
      ctx.stat({ icon: '▦', value: projects.length, label: '專案總數', badge: '本機', badgeKind: 'neutral' }),
      ctx.stat({ icon: '!', value: pending.length, label: '待辦要求', badge: '需跟進', badgeKind: 'warn' }),
      ctx.stat({ icon: '▥', value: data.sorItems.length, label: 'SoR 條目', badge: '+18 本週', badgeKind: 'ok' }),
      ctx.stat({ icon: '$', value: missing.length, label: '缺單價', badge: '阻斷提交', badgeKind: 'danger' })));

    /* ---------- 主體分欄 ---------- */
    root.appendChild(el('div', { class: 'split' },
      /* 左：最近專案 + 待辦 */
      frag(
        ctx.secTitle('最近專案'),
        ctx.table({
          cols: [
            { key: 'n', label: '專案名稱', cls: 'col-desc' },
            { key: 'c', label: '合約編號', cls: 'col-code' },
            { key: 's', label: '階段' },
            { key: 'p', label: '完成度', align: 'right', cls: 'num' }
          ],
          rows: [
            ['WO 054B · 示範醫院 A 專科翻新', 'AC-2024-045', ctx.badge('算量中', 'brand'), '62%'],
            ['示範診所 B 內部裝修', 'AC-2024-051', ctx.badge('待提交', 'warn'), '88%'],
            ['示範醫院 C 外牆修葺', 'AC-2024-038', ctx.badge('已完成', 'ok'), '100%']
          ].map(function (r) {
            return { cells: r.slice(0, 3).concat([
              el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2); justify-content:flex-end' },
                el('div', { class: 'bar', style: 'width:64px' },
                  el('div', { class: 'bar__fill' + (r[3] === '100%' ? ' bar__fill--ok' : ''), style: 'width:' + r[3] })),
                el('span', { class: 'num u-muted' }, r[3]))
            ]), attrs: { style: 'cursor:pointer' } };
          }),
          foot: ['合計 3 個專案', '', '', '平均 83%']
        }),

        ctx.secTitle('待辦要求'),
        el('div', { class: 'card' }, el('div', { class: 'card__body--flush' },
          ctx.table({
            cols: [
              { key: 'i', label: '', cls: '' },
              { key: 't', label: '要求內容', cls: 'col-desc' },
              { key: 'd', label: '截止' },
              { key: 'a', label: '' }
            ],
            rows: [
              ['⚠', '投標須知附表 3：須提交 MiC 預製組件供應商證明', '2026-09-26', '跟進'],
              ['⚠', '圖紙 AC-2024-045-A-003 圖號疑與顧問編號不一致，待確認', '2026-09-22', '去信'],
              ['⚠', '142 條 SoR 項目缺單價，需完成報價審查', '2026-09-30', '處理']
            ].map(function (r) {
              return [
                el('span', { style: r[0] === '⚠' ? 'color:var(--warn)' : '' }, r[0]),
                r[1], el('span', { class: 'u-mono u-muted' }, r[2]),
                el('button', { class: 'btn btn--sm', onclick: function () { ctx.toast('已開啟：' + r[1].slice(0, 16) + '…', 'info'); } }, r[3])
              ];
            })
          })))
      ),

      /* 右：項目摘要 */
      frag(
        ctx.secTitle('項目摘要'),
        ctx.card({
          body: el('dl', { class: 'kv', style: 'grid-template-columns:80px 1fr' },
            el('dt', {}, '合約編號'), el('dd', {}, 'AC-2024-045'),
            el('dt', {}, '項目名稱'), el('dd', {}, '示範醫院 A · C5 專科翻新'),
            el('dt', {}, '承建商'), el('dd', {}, 'ABC 建築工程有限公司'),
            el('dt', {}, '合約依據'), el('dd', {}, 'HK GC Works 2001'),
            el('dt', {}, '適用條款'), el('dd', {}, 'Cl. 2 / 12 / 13 / 33 / 34'),
            el('dt', {}, '現行 WO'), el('dd', {}, '009 · 030 · 031 · 033 · FMMS026'),
            el('dt', {}, '建立日期'), el('dd', {}, '2026-09-15'))
        }),
        ctx.secTitle('引擎與服務'),
        ctx.card({
          bodyMod: 'card__body--tight',
          body: el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-2)' },
            [
              ['量測引擎', 'dot--ok', 'dist-portable 已載入'],
              ['算量接口', 'dot--ok', 'CSV / JSON 雙路徑'],
              ['MCP 服務', 'dot--warn', '0.9.66 待信任'],
              ['資料庫', 'dot--ok', 'vicbid_db v2']
            ].map(function (r) {
              return el('div', { style: 'display:flex; align-items:center; gap:var(--sp-3); padding:var(--sp-2) 0' },
                el('span', { class: 'dot ' + r[1] }),
                el('span', { style: 'font-size:var(--fs-sm); flex:1' }, r[0]),
                el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, r[2]));
            }))
        }))
    ));
  }

  VC.registerView('overview-1', { nav: 'overview', wide: false }, function (root, ctx) { render(root, ctx, EMPTY); });
  VC.registerView('overview-2', { nav: 'overview', wide: false }, function (root, ctx) { render(root, ctx, FULL); });
})();
