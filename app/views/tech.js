/* ============================================================================
   ViCons — 畫面 12 · 技術施工方案                  app/views/tech.js
   ----------------------------------------------------------------------------
   對應 VicBid「技术施工方案」，改寫成深色設計語言並補上分組與完成度。

   職責：八個標準施工方案章節的編寫。分成四組（範圍／方法／保證／臨時），
        理由是評審通常按組打分，分組可讓作者看到「邊一組最弱」。
   ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var el = VC.el;

  var GROUPS = [
    { name: '範圍與方法', keys: ['scope', 'methodology'] },
    { name: '資源配置',   keys: ['equipment', 'manpower'] },
    { name: '保證體系',   keys: ['quality', 'safety', 'environmental'] },
    { name: '臨時工程',   keys: ['temporary'] }
  ];

  var SECTIONS = {
    scope:         { zh: '工程範圍',   en: 'Scope of Works',            hint: '工程範圍、主要工作內容、不包括事項' },
    methodology:   { zh: '施工方法',   en: 'Construction Methodology',  hint: '主要施工方法、工藝流程、分段安排' },
    equipment:     { zh: '設備配置',   en: 'Plant & Equipment',         hint: '主要施工設備、規格、數量、進出場時間' },
    manpower:      { zh: '人員配置',   en: 'Manpower',                  hint: '項目組織架構、各工種人數、關鍵人員資歷' },
    quality:       { zh: '質量保證',   en: 'Quality Assurance',         hint: '質量管理體系、檢驗計劃、隱蔽驗收安排' },
    safety:        { zh: '安全方案',   en: 'Safety Plan',               hint: '安全管理體系、危險源、專項方案、應急預案' },
    environmental: { zh: '環境管理',   en: 'Environmental Management',  hint: '環保措施、廢物管理、揚塵噪音控制' },
    temporary:     { zh: '臨時工程',   en: 'Temporary Works',           hint: '臨時設施、圍擋、支撐、臨時水電' }
  };

  /* 示範內容（已去識別化） */
  var DEMO = {
    scope:         '涵蓋示範項目之結構加固、機電更新及外牆翻新三部分。不包括：業主另行招標之園景工程、電梯更換。',
    methodology:   '採分段流水施工：先結構後機電，最後裝飾收尾。每層分兩區，夜間不做噪音工序，避免影響鄰近安老院舍。',
    equipment:     '汽車吊 1 台（25 t）、挖掘機 2 台、柴油發電機 2 台、焊機 4 台、移動式升降台 3 台。',
    manpower:      '項目經理 1 人、專業工程師 3 人、安全主任 1 人、技術工人 30 人。關鍵人員具同類項目 5 年以上經驗。',
    quality:       '按 ISO 9001 執行，關鍵工序實行三檢制與隱蔽驗收。每批材料進場須附證明文件並抽驗。',
    safety:        '高空及吊裝作業須專項方案，每週安全例會，佩戴個人防護用品。密閉空間作業須許可證制度。',
    environmental: '建築廢物分類存放並記錄運載，現場揚塵噴淋，噪音實時監測，泥水經沉澱後排放。',
    temporary:     '工地圍擋（高 2.4 m）、臨時辦公用房、材料加工棚、臨時水電接駁及消防通道。'
  };

  var content = {};
  var loaded = false;

  function seed(demo) {
    Object.keys(SECTIONS).forEach(function (k) { content[k] = demo ? DEMO[k] : ''; });
    loaded = true;
  }

  function isDone(k) { return (content[k] || '').trim().length > 0; }

  function groupScore(g) {
    var n = g.keys.filter(isDone).length;
    return { n: n, total: g.keys.length, ok: n === g.keys.length };
  }

  /* ---------- 章節 ---------- */
  function sectionField(ctx, key) {
    var s = SECTIONS[key];
    var done = isDone(key);

    var head = el('div', { style: 'display:flex; align-items:center; justify-content:space-between; gap:var(--sp-3); margin-bottom:var(--sp-1)' },
      el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2)' },
        el('span', { class: 'dot ' + (done ? 'dot--ok' : 'dot--warn') }),
        el('span', { class: 'u-strong' }, s.zh),
        el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, s.en)),
      el('span', { class: 'u-mono u-muted', style: 'font-size:var(--fs-2xs)' }, (content[key] || '').length + ' 字'));

    var ta = el('textarea', {
      class: 'textarea', rows: 4, placeholder: s.hint,
      oninput: function (e) { content[key] = e.target.value; }
    });
    ta.value = content[key] || '';

    return el('div', { style: 'margin-bottom:var(--sp-5)' },
      head, el('div', { class: 'field__hint' }, s.hint), ta);
  }

  function editorCard(ctx) {
    var body = el('div', { class: 'card__body' });

    GROUPS.forEach(function (g) {
      var sc = groupScore(g);
      var gt = el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2); margin-bottom:var(--sp-3)' },
        el('span', { class: 'kicker' }, g.name),
        sc.ok ? VC.badge('齊備', 'ok') : VC.badge('缺 ' + (sc.total - sc.n) + ' 章', 'warn'));

      var wrap = el('div', { style: 'margin-bottom:var(--sp-8)' }, gt);
      g.keys.forEach(function (k) { wrap.appendChild(sectionField(ctx, k)); });
      body.appendChild(wrap);
    });

    var head = el('div', { class: 'card__header' },
      el('h3', {}, '技術施工方案 Technical Proposal'),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn btn--sm btn--ghost', onclick: function () { VC.toast('選取檔案以匯入內文…', 'info'); } }, '⇪ 匯入'),
      el('button', { class: 'btn btn--sm btn--ghost', onclick: function () { seed(true); VC.toast('已載入示範方案', 'ok'); ctx.go('tech'); } }, '載入示範'),
      el('button', { class: 'btn btn--sm btn--danger', onclick: function () { seed(false); VC.toast('已清空八章內容', 'warn'); ctx.go('tech'); } }, '清空'),
      el('button', { class: 'btn btn--sm btn--primary', onclick: function () { VC.toast('技術方案已儲存', 'ok'); } }, '儲存'));

    return el('div', { class: 'card' }, head, body);
  }

  function progressCard(ctx) {
    var keys = Object.keys(SECTIONS);
    var n = keys.filter(isDone).length;
    var pct = Math.round((n / keys.length) * 100);

    var bar = el('div', { class: 'bar' },
      el('div', { class: 'bar__fill' + (pct === 100 ? ' bar__fill--ok' : ' bar__fill--warn'), style: 'width:' + pct + '%' }));

    var chips = el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--sp-2); margin-top:var(--sp-3)' });
    GROUPS.forEach(function (g) {
      var sc = groupScore(g);
      chips.appendChild(el('span', { class: 'pill' },
        el('span', { class: 'dot ' + (sc.ok ? 'dot--ok' : 'dot--warn') }),
        g.name + ' ' + sc.n + '/' + sc.total));
    });

    return el('div', { class: 'card' },
      el('div', { class: 'card__body' },
        el('div', { style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--sp-2)' },
          el('span', { class: 'u-strong' }, '方案完成度'),
          el('span', { class: 'u-mono' }, n + ' / ' + keys.length + '（' + pct + '%）')),
        bar, chips));
  }

  /* ---------- 五態 ---------- */
  function renderData(root, ctx) {
    if (!loaded) seed(true);

    root.appendChild(ctx.pagehead({
      title: '技術施工方案',
      sub: '八章 · 四組 · 按評審習慣分組呈現',
      actions: [el('button', { class: 'btn btn--sm', onclick: function () { ctx.go('schedule'); } }, '下一項：進度規劃 →')]
    }));
    root.appendChild(progressCard(ctx));
    root.appendChild(editorCard(ctx));
  }

  function renderEmpty(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '技術施工方案', sub: '尚未建立方案' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'empty', icon: '▤', title: '還沒有技術方案',
        desc: '建立八個標準章節開始撰寫。四組分別對應範圍方法、資源配置、保證體系與臨時工程。',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { seed(false); VC.toast('已建立八個空白章節', 'ok'); ctx.go('tech'); } }, '新增方案'),
          el('button', { class: 'btn', onclick: function () { seed(true); VC.toast('已載入示範方案', 'ok'); ctx.go('tech'); } }, '載入示範')
        ]
      })
    }));
  }

  function renderLoading(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '技術施工方案', sub: '正在讀取方案…' }));
    var body = el('div', { class: 'card__body' });
    for (var i = 0; i < 4; i++) {
      body.appendChild(el('div', { style: 'margin-bottom:var(--sp-6)' },
        el('div', { class: 'skel skel--title' }),
        el('div', { class: 'skel skel--line', style: 'width:92%' }),
        el('div', { class: 'skel skel--line', style: 'width:80%' })));
    }
    root.appendChild(el('div', { class: 'card' }, body));
  }

  function renderError(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '技術施工方案', sub: '儲存失敗' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'error', icon: '✕', title: '方案儲存失敗',
        desc: '寫入本地資料庫時發生衝突。你剛才的編輯仍在畫面上，可先匯出備份再重試，不會丟失。',
        detail: 'DB: vicbid_db v2\nStore: tech_plans\nError: ConstraintError — keyPath "id" 重複（id=sched-01）\n建議：匯出後清空該 store 再重新匯入',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('重試中…', 'info'); } }, '重試'),
          el('button', { class: 'btn', onclick: function () { VC.toast('已下載 tech-plan.json', 'ok'); } }, '先匯出備份')
        ]
      })
    }));
  }

  function renderDegraded(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '技術施工方案', sub: '唯讀模式 · 儲存已停用' }));
    root.appendChild(el('div', { class: 'card card--accent' },
      el('div', { class: 'card__body' },
        ctx.state({
          kind: 'warn', icon: '!', title: '目前為唯讀，編輯不會儲存',
          desc: '偵測到瀏覽器未開放本地儲存。你仍可編輯並匯出內容，但重新載入頁面後改動會遺失。',
          actions: [el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已下載 tech-plan.txt', 'ok'); } }, '匯出目前內容')]
        }))));
    root.appendChild(editorCard(ctx));
  }

  VC.registerView('tech', { nav: 'tech' }, function (root, ctx) {
    VC.dev.screen('tech', root, ctx, {
      data: renderData, empty: renderEmpty, loading: renderLoading,
      error: renderError, degraded: renderDegraded
    });
  });
})();
