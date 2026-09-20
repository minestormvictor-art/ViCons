/* ============================================================================
   ViCons — 畫面 14 · 標書匯入                     app/views/intake.js
   ----------------------------------------------------------------------------
   對應 VicBid「导入标书」，改寫成深色設計語言。

   職責：把一份標書變成可用的結構化資料 —— PDF/DOCX 解析 → 抽提交要求
        → 偵測合約類型 → 生成投標指標。這是整條鏈的入口，錯了後面全錯。

   設計決定：
   1. 四步流程條常駐顯示在哪一步，因為解析可能要數十秒，用戶需要知道進度。
   2. 抽出 0 條要求時不當失敗，而是當「降級」明確講清楚（掃描件很常見），
      並提供手動補充的出路 —— 靜默通過是最壞的結果。
   3. 風險提示用 --warn 主動標示，不藏在詳情裡。
   ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var el = VC.el;

  var STEPS = [
    { n: 1, t: '上傳文件', d: 'PDF / DOCX / DOC' },
    { n: 2, t: '解析內容', d: '抽取文字層' },
    { n: 3, t: '提取要求', d: '分類與編號' },
    { n: 4, t: '確認匯入', d: '寫入專案' }
  ];

  /* 示範解析結果（去識別化） */
  var FILE = { name: '示範標書_AC-2024-045.pdf', pages: 48, chars: 96420 };
  var DETECTED = 'nec';

  var INDICATORS = [
    { label: '項目名稱', value: '示範醫院 A · 專科樓層翻新', icon: '▦' },
    { label: '截標日期', value: '2026-10-14 12:00', icon: '⏱' },
    { label: '工期',     value: '18 個月', icon: '⟳' },
    { label: '估算金額', value: 'HK$ 48.2 M', icon: '$' },
    { label: '合約類型', value: 'NEC 合約', icon: '▤' },
    { label: '投標保函', value: 'HK$ 2.4 M（5%）', icon: '⛨' }
  ];

  var DOC_TAGS   = ['公司註冊證明', '商業登記證', '承建商牌照', '同類工程經驗證明', '安全紀錄', '保險證明（勞保＋第三者）'];
  var CRIT_TAGS  = ['技術標 40%', '價格標 45%', '過往表現 15%', '價格上限 HK$ 52 M', '不設最低價中標'];
  var QUAL_TAGS  = ['註冊一般建築承建商', '近 5 年同類項目 ≥ 3 個', '員工人數 ≥ 80', 'ISO 9001 / 14001 / 45001'];

  var RISKS = [
    '標書第 12 頁要求提交 MiC 預製組件供應商證明，但未載明認可名單 —— 需向招標方書面澄清。',
    '第 31 頁工期為 18 個月，但第 44 頁罰則以 15 個月為基準計算，兩處不一致。',
    '估價 HK$ 52 M 上限未說明是否含暫列金額，需澄清後才可定價。'
  ];

  var REQS = [
    { id: 'REQ-001', text: '提交近五年同類工程經驗證明，須附合約金額及完工證明', cat: '資格' },
    { id: 'REQ-002', text: '提交不少於三名註冊工程師的履歷及註冊證明', cat: '人員' },
    { id: 'REQ-003', text: '提交施工總進度計劃（含關鍵路徑分析）', cat: '技術' },
    { id: 'REQ-004', text: '提交安全管理體系文件及最近三年安全紀錄', cat: '安全' },
    { id: 'REQ-005', text: '提交環境管理計劃及廢物處置安排', cat: '環境' },
    { id: 'REQ-006', text: '提交投標保函，金額為投標價之百分之五', cat: '商務' },
    { id: 'REQ-007', text: '提交 MiC 預製組件供應商證明文件', cat: '技術' },
    { id: 'REQ-008', text: '提交分包商名單及主要分包商資質', cat: '商務' },
    { id: 'REQ-009', text: '提交質量保證計劃，須符合 ISO 9001', cat: '品質' },
    { id: 'REQ-010', text: '提交工地佈置圖及臨時設施安排', cat: '技術' },
    { id: 'REQ-011', text: '提交鄰近建築物沉降監測方案', cat: '技術' },
    { id: 'REQ-012', text: '提交夜間施工噪音緩解措施', cat: '環境' },
    { id: 'REQ-013', text: '提交應急預案及疏散路線圖', cat: '安全' },
    { id: 'REQ-014', text: '提交保險證明（勞工保險及第三者責任）', cat: '商務' },
    { id: 'REQ-015', text: '提交價格明細表，按章節分項列示', cat: '商務' },
    { id: 'REQ-016', text: '提交項目組織架構圖及匯報路線', cat: '人員' }
  ];

  /* ---------- 流程條 ---------- */
  function flowBar(step) {
    var flow = el('div', { class: 'flow' });

    STEPS.forEach(function (s, i) {
      var cls = i < step ? 'flow__step flow__step--done' : (i === step ? 'flow__step flow__step--active' : 'flow__step');
      var mark = i < step ? '✓ ' : '';
      flow.appendChild(el('div', { class: cls },
        el('div', { class: 'flow__n' }, mark + s.n),
        el('div', { class: 'flow__t' }, s.t),
        el('div', { class: 'flow__d' }, s.d)));
    });
    return flow;
  }

  /* ---------- 上載區 ---------- */
  function dropZone(ctx) {
    var zone = el('div', { class: 'drop', onclick: function () { VC.toast('選擇檔案…（原型不會真的讀檔）', 'info'); } },
      el('div', { class: 'drop__icon' }, '⇪'),
      el('div', { class: 'drop__title' }, '拖曳標書檔案到此處'),
      el('div', { class: 'drop__desc' }, '支援 PDF · DOCX · DOC · 單檔上限 200 MB · 全程在本機解析，不上傳'));
    return zone;
  }

  /* ---------- 投標指標 ---------- */
  function indicatorCard() {
    var grid = el('div', { class: 'grid grid--3' });

    INDICATORS.forEach(function (k) {
      var head = el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2); margin-bottom:var(--sp-1)' },
        el('span', { style: 'color:var(--cobalt-ink); font-size:var(--fs-sm)' }, k.icon),
        el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, k.label));
      grid.appendChild(el('div', {
        style: 'padding:var(--sp-3); background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md)'
      }, head, el('div', { class: 'u-strong', style: 'font-size:var(--fs-sm)' }, k.value)));
    });

    var head = el('div', { class: 'card__header' },
      el('h3', {}, '投標指標 Bid Indicators'),
      el('div', { class: 'spacer' }),
      VC.badge('自動生成', 'brand'));

    return el('div', { class: 'card' }, head, el('div', { class: 'card__body' }, grid));
  }

  function tagSection(label, items, kind) {
    var chips = el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--sp-1)' });
    items.forEach(function (x) { chips.appendChild(VC.badge(x, kind)); });
    return el('div', { style: 'margin-bottom:var(--sp-4)' },
      el('div', { class: 'kicker', style: 'display:block; margin-bottom:var(--sp-2)' }, label + '（' + items.length + '）'),
      chips);
  }

  function riskSection() {
    var list = el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-1)' });
    RISKS.forEach(function (r) {
      list.appendChild(el('div', {
        style: 'display:flex; gap:var(--sp-2); padding:var(--sp-2) var(--sp-3); background:var(--warn-wash); border:1px solid var(--warn-line); border-radius:var(--r-sm)'
      },
        el('span', { style: 'color:var(--warn)' }, '⚠'),
        el('span', { style: 'font-size:var(--fs-sm)' }, r)));
    });
    return el('div', { style: 'margin-bottom:var(--sp-4)' },
      el('div', { class: 'kicker', style: 'display:block; margin-bottom:var(--sp-2); color:var(--warn)' }, '風險提示（' + RISKS.length + '）'),
      list);
  }

  /* ---------- 要求預覽表 ---------- */
  function reqTable(ctx) {
    var cols = [
      { key: 'i', label: '編號', cls: 'col-num' },
      { key: 't', label: '要求描述', cls: 'col-desc' },
      { key: 'c', label: '分類' },
      { key: 's', label: '狀態' }
    ];

    var rows = REQS.map(function (r) {
      return [
        el('span', { class: 'u-mono', style: 'font-size:var(--fs-xs)' }, r.id),
        r.text,
        VC.badge(r.cat, 'brand'),
        VC.badge('待處理', 'warn')
      ];
    });

    var head = el('div', { class: 'card__header' },
      el('h3', {}, '提交要求預覽'),
      el('div', { class: 'spacer' }),
      el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, '顯示 ' + REQS.length + ' 條（去識別化示範資料）'));

    var body = el('div', { class: 'card__body card__body--flush' },
      ctx.table({ cols: cols, rows: rows }));

    return el('div', { class: 'card' }, head, body);
  }

  /* ---------- 原文預覽 ---------- */
  function rawCard() {
    var prev = 'Section 3 — Submission Requirements\n\n3.1 Tenderers shall submit documentary proof of at least three (3) comparable\n    contracts completed within the past five (5) years, stating contract sum,\n    scope of works and date of completion.\n\n3.2 Tenderers shall submit the curricula vitae and registration certificates\n    of not fewer than three (3) registered engineers.\n\n3.3 A master programme incorporating critical path analysis shall be submitted…\n\n（示範片段，原型只顯示前 3,000 字）';

    var box = el('div', {
      style: 'margin-top:var(--sp-3); padding:var(--sp-3); background:var(--bg); border:1px solid var(--line); border-radius:var(--r-md); font-family:var(--font-mono); font-size:var(--fs-xs); color:var(--ink-faint); white-space:pre-wrap; max-height:260px; overflow:auto'
    }, prev);

    var details = el('details', {},
      el('summary', { style: 'cursor:pointer; font-size:var(--fs-sm); color:var(--ink-faint)' }, '查看原文片段（前 3,000 字）'),
      box);

    return el('div', { class: 'card' },
      el('div', { class: 'card__header' }, el('h3', {}, '原文預覽')),
      el('div', { class: 'card__body' }, details));
  }

  /* ---------- 解析結果表頭 ---------- */
  function resultSummary() {
    function kv(label, value) {
      return el('div', {},
        el('div', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, label),
        el('div', { class: 'u-strong u-mono', style: 'margin-top:2px' }, value));
    }
    return el('div', { class: 'card' },
      el('div', { class: 'card__header' },
        el('h3', {}, '解析結果'),
        el('div', { class: 'spacer' }),
        VC.badge('偵測到：NEC 合約', 'brand')),
      el('div', { class: 'card__body' },
        el('div', { class: 'grid grid--4' },
          kv('檔案名稱', FILE.name),
          kv('頁數', String(FILE.pages)),
          kv('提出要求', REQS.length + ' 條'),
          kv('字數', FILE.chars.toLocaleString()))));
  }

  /* ---------- 五態 ---------- */
  function renderData(root, ctx) {
    root.appendChild(ctx.pagehead({
      title: '標書匯入',
      sub: '把一份標書變成可用的結構化資料',
      actions: [el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已重新解析', 'ok'); } }, '重新解析')]
    }));

    root.appendChild(flowBar(3));
    root.appendChild(resultSummary());
    root.appendChild(ctx.secTitle('自動生成的投標指標'));
    root.appendChild(indicatorCard());

    var indBody = el('div', { class: 'card' },
      el('div', { class: 'card__body' },
        tagSection('所需文件', DOC_TAGS, 'neutral'),
        tagSection('評審標準', CRIT_TAGS, 'ok'),
        tagSection('資質要求', QUAL_TAGS, 'info'),
        riskSection()));
    root.appendChild(indBody);

    root.appendChild(ctx.secTitle('抽取出的提交要求'));
    root.appendChild(reqTable(ctx));
    root.appendChild(rawCard());

    root.appendChild(el('div', { style: 'display:flex; justify-content:flex-end; gap:var(--sp-2); margin-top:var(--sp-6)' },
      el('button', { class: 'btn', onclick: function () { VC.toast('已取消匯入', 'info'); } }, '取消'),
      el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('已匯入 16 條要求、6 項所需文件、3 項風險提示', 'ok'); ctx.go('contract'); } }, '✓ 確認匯入')));
  }

  function renderEmpty(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '標書匯入', sub: '尚未匯入任何標書' }));
    root.appendChild(flowBar(0));

    var card = el('div', { class: 'card card--accent' },
      el('div', { class: 'card__body' },
        dropZone(ctx),
        el('div', { style: 'display:flex; gap:var(--sp-2); margin-top:var(--sp-4); justify-content:center' },
          el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('選擇檔案…', 'info'); } }, '選擇檔案'),
          el('button', { class: 'btn', onclick: function () { VC.toast('已載入示範標書', 'ok'); ctx.go('intake'); } }, '用示範標書試一次'))));

    root.appendChild(card);
    root.appendChild(ctx.secTitle('已匯入的標書'));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'empty', icon: '⇪', title: '還沒有匯入記錄',
        desc: '匯入後，這份標書的提交要求、合約類型與投標指標都會存進本機資料庫，可以隨時回來查看或重新解析。'
      })
    }));
  }

  function renderLoading(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '標書匯入', sub: '正在解析 示範標書_AC-2024-045.pdf…' }));
    root.appendChild(flowBar(1));

    var inner = el('div', { style: 'display:flex; align-items:center; gap:var(--sp-3)' },
      el('span', { class: 'dot dot--pulse dot--ok' }),
      el('span', { class: 'u-strong' }, '正在抽取文字層…'),
      el('span', { class: 'u-mono u-muted' }, '第 31 / 48 頁'));

    var bar = el('div', { class: 'bar', style: 'margin-top:var(--sp-4)' },
      el('div', { class: 'bar__fill', style: 'width:64%' }));

    root.appendChild(el('div', { class: 'card' },
      el('div', { class: 'card__body' },
        inner, bar,
        el('div', { class: 'u-muted', style: 'margin-top:var(--sp-3); font-size:var(--fs-xs)' },
          '解析全程在本機進行，文件不會上傳到任何伺服器。48 頁約需 20–40 秒。'))));
  }

  function renderError(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '標書匯入', sub: '解析失敗' }));
    root.appendChild(flowBar(2));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'error', icon: '✕', title: '無法解析這份文件',
        desc: '檔案可能是加密 PDF、密碼保護的 DOCX，或副檔名與實際格式不符。請確認後再試，或改用另一份副本。',
        detail: '檔案：示範標書_AC-2024-045.pdf（18.4 MB，48 頁）\n偵測格式：PDF 1.7，Encrypt dictionary 存在\nError: PDFDocument 需要密碼才能開啟\n建議：用 PDF 閱讀器另存為無密碼副本後重試',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('重試中…', 'info'); } }, '重試'),
          el('button', { class: 'btn', onclick: function () { ctx.go('intake'); } }, '換一份檔案')
        ]
      })
    }));
  }

  function renderDegraded(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '標書匯入', sub: '已匯入 · 但有部分未能自動處理' }));
    root.appendChild(flowBar(3));

    root.appendChild(el('div', { class: 'card card--accent' },
      el('div', { class: 'card__body' },
        ctx.state({
          kind: 'warn', icon: '!', title: '未抽到提交要求（0 條）',
          desc: '這份文件沒有可提取的文字層，很可能是掃描影像。文件已存進專案，但要求清單是空的 —— 需要你手動補上，或改用 OCR 版本重新匯入。',
          actions: [
            el('button', { class: 'btn btn--sm btn--primary', onclick: function () { VC.toast('已開啟手動新增要求', 'info'); } }, '手動新增要求'),
            el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已下載 OCR 處理指引', 'ok'); } }, '下載 OCR 指引')
          ]
        }))));

    root.appendChild(resultSummary());
    root.appendChild(el('div', { style: 'display:flex; justify-content:flex-end; gap:var(--sp-2); margin-top:var(--sp-6)' },
      el('button', { class: 'btn', onclick: function () { VC.toast('已取消', 'info'); } }, '取消'),
      el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('已匯入（要求清單待補）', 'warn'); ctx.go('overview-2'); } }, '仍然匯入')));
  }

  VC.registerView('intake', { nav: 'intake' }, function (root, ctx) {
    VC.dev.screen('intake', root, ctx, {
      data: renderData, empty: renderEmpty, loading: renderLoading,
      error: renderError, degraded: renderDegraded
    });
  });
})();
