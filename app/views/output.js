/* ============================================================================
   ViCons — 畫面 7：提交清單（含阻斷閘門）
   ========================================================================= */
(function () {
  'use strict';
  var el = VC.el, frag = VC.frag;

  var ITEMS = [
    { n: '投標書封面及簽署頁', cat: '標書', req: true, st: 'ok', file: 'Tender_Form_Signed.pdf', pg: 4 },
    { n: '工程量清單 (BQ) — 含單價', cat: '造價', req: true, st: 'block', file: 'BQ_Rev_C.xlsx', pg: 142 },
    { n: '標書須知附表 1–5', cat: '標書', req: true, st: 'block', file: '—', pg: 0 },
    { n: '方法說明書 (Method Statement)', cat: '技術', req: true, st: 'ok', file: 'MS_WO053B_ref.docx', pg: 38 },
    { n: '進度計劃 (P6 基線)', cat: '技術', req: true, st: 'missing', file: '—', pg: 0 },
    { n: '工地安全計劃及風險評估', cat: '安全', req: true, st: 'ok', file: 'Safety_Plan_v2.pdf', pg: 52 },
    { n: '醫院感染控制施工計劃', cat: '安全', req: true, st: 'ok', file: 'IC_Plan.pdf', pg: 21 },
    { n: 'MiC 預製組件供應商證明', cat: '技術', req: true, st: 'missing', file: '—', pg: 0 },
    { n: 'RSI 往來函件集（8 份）', cat: '合約', req: false, st: 'ok', file: 'RSI_Bundle.pdf', pg: 16 },
    { n: 'EOT 申請（5 份，待簽）', cat: '合約', req: false, st: 'pending', file: 'EOT_Draft.docx', pg: 10 }
  ];

  var ST = {
    ok:      ['已備齊', 'ok'],
    block:   ['阻斷', 'danger'],
    missing: ['缺失', 'danger'],
    pending: ['待簽', 'warn']
  };

  VC.registerView('output', { nav: 'output', wide: true }, function (root, ctx) {
    var ready = ITEMS.filter(function (i) { return i.st === 'ok'; }).length;
    var blockers = ITEMS.filter(function (i) { return i.req && (i.st === 'block' || i.st === 'missing'); });
    var canSubmit = blockers.length === 0;

    root.appendChild(ctx.pagehead({
      title: '提交清單',
      sub: '10 項提交物 · ' + ready + ' 項已備齊 · 任何硬性缺漏都會阻斷提交',
      crumb: '<a href="#overview-2">總覽</a> / 提交清單',
      actions: [
        el('button', { class: 'btn' }, '⇩ 匯出清單'),
        el('button', {
          class: 'btn btn--primary',
          disabled: !canSubmit ? 'disabled' : null,
          'aria-disabled': !canSubmit ? 'true' : null,
          onclick: function () { if (canSubmit) ctx.toast('已產生提交包：10 份文件 · 342 頁', 'ok'); }
        }, canSubmit ? '▶ 產生提交包' : '🔒 產生提交包（受阻）')
      ]
    }));

    /* ---------- 阻斷閘門 ---------- */
    if (!canSubmit) {
      root.appendChild(el('div', {
        style: 'display:flex; gap:var(--sp-4); padding:var(--sp-4); background:var(--danger-wash); border:1px solid var(--danger-line); border-left:3px solid var(--danger); border-radius:var(--r-lg); margin-bottom:var(--sp-5)'
      },
        el('div', { style: 'font-size:20px; color:var(--danger); flex-shrink:0' }, '🔒'),
        el('div', { style: 'flex:1' },
          el('div', { style: 'font-size:var(--fs-md); font-weight:var(--fw-semi); color:var(--danger); margin-bottom:var(--sp-1)' },
            '提交受阻 — 有 ' + blockers.length + ' 項硬性缺漏'),
          el('div', { class: 'u-soft', style: 'font-size:var(--fs-xs); line-height:var(--lh-loose); margin-bottom:var(--sp-3)' },
            '以下項目為投標須知強制要求，缺失將導致廢標。系統不會讓你帶著這些缺漏產生提交包。'),
          el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-2)' },
            blockers.map(function (b) {
              return el('div', { style: 'display:flex; align-items:center; gap:var(--sp-3); font-size:var(--fs-sm)' },
                el('span', { style: 'color:var(--danger)' }, '✕'),
                el('span', { style: 'flex:1' }, b.n),
                ctx.badge(b.st === 'missing' ? '缺失' : '阻斷', 'danger'));
            }))),
        el('button', {
          class: 'btn btn--sm', style: 'align-self:flex-start',
          onclick: function () { ctx.go('compliance'); }
        }, '查看合規矩陣 →')));
    }

    /* ---------- 進度 ---------- */
    root.appendChild(el('div', { class: 'grid grid--4', style: 'margin-bottom:var(--sp-5)' },
      ctx.stat({ icon: '✓', value: ready, label: '已備齊', badge: '可提交', badgeKind: 'ok' }),
      ctx.stat({ icon: '🔒', value: blockers.length, label: '硬性阻斷', badge: '必須解決', badgeKind: 'danger' }),
      ctx.stat({ icon: '✎', value: 1, label: '待簽', badge: 'EOT', badgeKind: 'warn' }),
      ctx.stat({ icon: '▤', value: '342', label: '總頁數' })));

    /* ---------- 清單表 ---------- */
    root.appendChild(ctx.secTitle('提交物明細'));
    root.appendChild(ctx.table({
      cols: [
        { key: 's', label: '狀態' },
        { key: 'n', label: '提交物名稱', cls: 'col-desc' },
        { key: 'c', label: '類別' },
        { key: 'r', label: '強制' },
        { key: 'f', label: '檔案' },
        { key: 'p', label: '頁數', cls: 'num' },
        { key: 'a', label: '' }
      ],
      rows: ITEMS.map(function (i) {
        var s = ST[i.st];
        var isBlock = i.st === 'block' || i.st === 'missing';
        return {
          cells: [
            ctx.badge(s[0], s[1]),
            i.n,
            el('span', { class: 'tag' }, i.cat),
            i.req ? el('span', { style: 'color:var(--danger); font-size:11px' }, '●') : el('span', { class: 'u-muted', style: 'font-size:11px' }, '○'),
            i.file === '—'
              ? el('span', { class: 'u-muted' }, '未附')
              : el('span', { class: 'u-mono', style: 'font-size:var(--fs-xs); color:var(--info)' }, i.file),
            i.pg || '—',
            el('button', {
              class: 'btn btn--sm btn--ghost',
              onclick: function () { ctx.toast(isBlock ? '需先補齊文件才可附加' : '開啟：' + i.file, isBlock ? 'warn' : 'info'); }
            }, isBlock ? '補齊' : '檢視')
          ],
          attrs: { class: isBlock ? 'is-flagged' : '' }
        };
      }),
      foot: ['', ITEMS.length + ' 項提交物', '', blockers.length + ' 項阻斷', '', '342', '']
    }));

    /* ---------- 出圖規範核對（本機既有要求） ---------- */
    root.appendChild(el('div', { style: 'margin-top:var(--sp-5)' },
      ctx.card({
        title: '出圖規範核對 · 四要素',
        body: frag(
          el('div', { class: 'grid grid--4', style: 'gap:var(--sp-3)' },
            [
              ['General Notes & Spec', '一般說明與規範', true],
              ['Dimension & Detailing', '尺寸與細節', true],
              ['Description', '圖說', true],
              ['Scale', '比例', false]
            ].map(function (r) {
              return el('div', {
                style: 'padding:var(--sp-3); border:1px solid ' + (r[2] ? 'var(--ok-line)' : 'var(--warn-line)') + '; background:' + (r[2] ? 'var(--ok-wash)' : 'var(--warn-wash)') + '; border-radius:var(--r-md)'
              },
                el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2); margin-bottom:var(--sp-1)' },
                  el('span', { style: 'color:' + (r[2] ? 'var(--ok)' : 'var(--warn)') }, r[2] ? '✓' : '!'),
                  el('span', { style: 'font-size:var(--fs-xs); font-weight:var(--fw-semi)' }, r[0])),
                el('div', { class: 'u-muted', style: 'font-size:var(--fs-2xs)' }, r[1]));
            })),
          el('div', { style: 'display:flex; gap:var(--sp-5); margin-top:var(--sp-4); font-size:var(--fs-xs)' },
            el('div', {},
              el('div', { class: 'u-muted', style: 'margin-bottom:var(--sp-1)' }, '上下方向標註'),
              el('span', { class: 'u-mono' }, '↑UP=LID'), el('span', { class: 'u-muted' }, ' / '), el('span', { class: 'u-mono' }, '↓DOWN=BASE')),
            el('div', {},
              el('div', { class: 'u-muted', style: 'margin-bottom:var(--sp-1)' }, '三視圖'),
              el('span', { style: 'color:var(--ok)' }, '✓ 齊全 28 / 28')),
            el('div', {},
              el('div', { class: 'u-muted', style: 'margin-bottom:var(--sp-1)' }, '標題欄'),
              el('span', { style: 'color:var(--warn)' }, '! 3 張缺圖號'))))
      })));
  });
})();
