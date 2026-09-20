/* ============================================================================
   ViCons — 畫面 11 · Site Aspect                   app/views/site.js
   ----------------------------------------------------------------------------
   對應 VicBid「Site Aspect 现场条件」，改寫成深色設計語言並補上完成度。

   職責：七個現場條件章節的編寫。這些內容直接餵進投標文件的 Site Aspect 一節，
        缺任何一章都會被評審扣分，所以每一章都要標明填了沒有（缺漏要吵）。

   設計決定：正文用 textarea 直接編輯（跟 VicBid 一致），
            但每章右側常駐完成燈與字數，讓「邊寫邊知道仲差幾章」。
   ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var el = VC.el;

  var SECTIONS = [
    { key: 'location',      zh: '項目位置',     en: 'Project Location',      hint: '地理位置、地址、周邊環境、鄰接建築' },
    { key: 'access',        zh: '現場通道',     en: 'Site Access',           hint: '進場路線、交通限制、卸貨安排、限高限重' },
    { key: 'conditions',    zh: '地面條件',     en: 'Ground Conditions',     hint: '地質、地下水位、土壤類型、既有基礎' },
    { key: 'constraints',   zh: '施工限制',     en: 'Working Constraints',   hint: '工作時段、噪音限值、震動、周邊敏感用途' },
    { key: 'utilities',     zh: '現有管線',     en: 'Existing Utilities',    hint: '水電氣管線、遷改需求、探測結果' },
    { key: 'environmental', zh: '環境影響',     en: 'Environmental',         hint: '環評要求、泥水排放、廢物處置、生態' },
    { key: 'safety',        zh: '安全要求',     en: 'Safety Requirements',   hint: '安全標準、危險源識別、專項方案需求' }
  ];

  /* 示範內容（已去識別化：只描述一般性現場條件，不含任何真實項目資料） */
  var DEMO = {
    location:      '項目位於示範區東翼，臨海，周邊為商業及住宅混合用途，最近敏感用途為東北面約 40 m 的安老院舍。',
    access:        '主入口經示範路進場，貨車限高 4.2 m，夜間卸貨須提前向管理處申請。無現場迴車位，需設臨時調度區。',
    conditions:    '填海地層，地下水位約 -1.2 m，基礎施工需降水處理。局部區域存在既有樁帽，需先行探測。',
    constraints:   '工作日施工時段 07:00–19:00，邊界噪音限值 75 dB(A)。考試期間及公眾假期須停工。',
    utilities:     '現場已有 11 kV 供電及 DN200 給水管，部分管線需臨時改遷。未確認之管線須先做物理探測。',
    environmental: '鄰近海堤，泥水排放須符合排放標準並辦理許可。建築廢物分類存放，須記錄運載記錄。',
    safety:        '涉及高空作業及吊裝，須專項方案並佩戴安全帶、設警戒區。密閉空間作業須另備許可證制度。'
  };

  /* 編輯態（模組層，切換畫面不丟失） */
  var content = {};
  var loaded = false;

  function seed(demo) {
    SECTIONS.forEach(function (s) { content[s.key] = demo ? DEMO[s.key] : ''; });
    loaded = true;
  }

  function filledCount() {
    return SECTIONS.filter(function (s) { return (content[s.key] || '').trim().length > 0; }).length;
  }

  function charCount() {
    return SECTIONS.reduce(function (n, s) { return n + (content[s.key] || '').length; }, 0);
  }

  /* ---------- 章節編輯器 ---------- */
  function sectionEditor(ctx, s, idx) {
    var done = (content[s.key] || '').trim().length > 0;

    var dot = el('span', { class: 'dot ' + (done ? 'dot--ok' : 'dot--warn') });
    var title = el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2)' },
      dot,
      el('span', { class: 'u-strong' }, s.zh),
      el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, s.en));

    var counter = el('span', { class: 'u-mono u-muted', style: 'font-size:var(--fs-2xs)' },
      (content[s.key] || '').length + ' 字');

    var head = el('div', { style: 'display:flex; align-items:center; justify-content:space-between; gap:var(--sp-3); margin-bottom:var(--sp-1)' },
      title, counter);

    var ta = el('textarea', {
      class: 'textarea', rows: 4,
      placeholder: s.hint,
      oninput: function (e) { content[s.key] = e.target.value; }
    });
    ta.value = content[s.key] || '';

    return el('div', { class: 'site-sec' + (done ? '' : ' site-sec--missing') },
      head,
      el('div', { class: 'field__hint' }, s.hint),
      ta);
  }

  function editorCard(ctx) {
    var body = el('div', { class: 'card__body' });
    SECTIONS.forEach(function (s, i) { body.appendChild(sectionEditor(ctx, s, i)); });

    var head = el('div', { class: 'card__header' },
      el('h3', {}, 'Site Aspect 現場條件'),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn btn--sm btn--ghost', onclick: function () { VC.toast('選取檔案以匯入內文…', 'info'); } }, '⇪ 匯入'),
      el('button', { class: 'btn btn--sm btn--ghost', onclick: function () { seed(true); VC.toast('已載入示範內容', 'ok'); ctx.go('site'); } }, '載入示範'),
      el('button', { class: 'btn btn--sm btn--danger', onclick: function () { seed(false); VC.toast('已清空七章內容', 'warn'); ctx.go('site'); } }, '清空'),
      el('button', { class: 'btn btn--sm btn--primary', onclick: function () { VC.toast('現場條件已儲存', 'ok'); } }, '儲存'));

    return el('div', { class: 'card' }, head, body);
  }

  /* ---------- 進度條 ---------- */
  function progressCard(ctx) {
    var n = filledCount();
    var total = SECTIONS.length;
    var pct = Math.round((n / total) * 100);
    var missing = SECTIONS.filter(function (s) { return (content[s.key] || '').trim().length === 0; });

    var bar = el('div', { class: 'bar' },
      el('div', { class: 'bar__fill' + (pct === 100 ? ' bar__fill--ok' : ' bar__fill--warn'), style: 'width:' + pct + '%' }));

    var top = el('div', { style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--sp-2)' },
      el('span', { class: 'u-strong' }, '編寫完成度'),
      el('span', { class: 'u-mono' }, n + ' / ' + total + '（' + pct + '%）· 共 ' + charCount() + ' 字'));

    var children = [top, bar];

    if (missing.length) {
      var chips = el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--sp-1); margin-top:var(--sp-3)' });
      missing.forEach(function (s) { chips.appendChild(VC.badge('缺 ' + s.zh, 'warn')); });
      children.push(el('div', { style: 'font-size:var(--fs-xs); color:var(--warn)' }, '以下章節未有內容，投標前必須補齊：'));
      children.push(chips);
    } else {
      children.push(el('div', { style: 'margin-top:var(--sp-3); font-size:var(--fs-xs); color:var(--ok)' }, '✓ 七章齊備，可產出 Site Aspect 章節。'));
    }

    return el('div', { class: 'card' }, el('div', { class: 'card__body' }, children));
  }

  /* ---------- 五態 ---------- */
  function renderData(root, ctx) {
    if (!loaded) seed(true);
    var n = filledCount();

    root.appendChild(ctx.pagehead({
      title: 'Site Aspect 現場條件',
      sub: '七個標準章節 · 直接餵進投標文件的 Site Aspect 一節',
      actions: [el('button', { class: 'btn btn--sm', onclick: function () { ctx.go('tech'); } }, '下一項：技術施工方案 →')]
    }));

    root.appendChild(progressCard(ctx));
    root.appendChild(editorCard(ctx));
  }

  function renderEmpty(root, ctx) {
    root.appendChild(ctx.pagehead({ title: 'Site Aspect 現場條件', sub: '尚未建立任何章節' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'empty', icon: '☑', title: '還沒有現場條件記錄',
        desc: '建立七個標準章節開始撰寫，或先載入示範內容看看格式。七章分別對應位置、通道、地面、限制、管線、環境、安全。',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { seed(false); loaded = true; VC.toast('已建立七個空白章節', 'ok'); ctx.go('site'); } }, '建立章節'),
          el('button', { class: 'btn', onclick: function () { seed(true); VC.toast('已載入示範內容', 'ok'); ctx.go('site'); } }, '載入示範')
        ]
      })
    }));
  }

  function renderLoading(root, ctx) {
    root.appendChild(ctx.pagehead({ title: 'Site Aspect 現場條件', sub: '正在讀取章節…' }));
    var body = el('div', { class: 'card__body' });
    for (var i = 0; i < 4; i++) {
      body.appendChild(el('div', { style: 'margin-bottom:var(--sp-6)' },
        el('div', { class: 'skel skel--title' }),
        el('div', { class: 'skel skel--line', style: 'width:94%' }),
        el('div', { class: 'skel skel--line', style: 'width:86%' }),
        el('div', { class: 'skel skel--line', style: 'width:70%' })));
    }
    root.appendChild(el('div', { class: 'card' }, body));
  }

  function renderError(root, ctx) {
    root.appendChild(ctx.pagehead({ title: 'Site Aspect 現場條件', sub: '讀取失敗' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'error', icon: '✕', title: '無法讀取現場條件',
        desc: '本地資料庫（IndexedDB）回應失敗，可能是瀏覽器私密模式或儲存空間已滿。你已有的內容沒有被刪除。',
        detail: 'DB: vicbid_db v2\nStore: site_aspects\nError: QuotaExceededError — 儲存配額不足（預估需 2.4 MB，可用 0.3 MB）',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('重試中…', 'info'); } }, '重試'),
          el('button', { class: 'btn', onclick: function () { VC.toast('已開啟資料與備份', 'info'); ctx.go('backup'); } }, '前往釋放空間')
        ]
      })
    }));
  }

  function renderDegraded(root, ctx) {
    root.appendChild(ctx.pagehead({ title: 'Site Aspect 現場條件', sub: '唯讀模式 · 儲存已停用' }));
    root.appendChild(el('div', { class: 'card card--accent' },
      el('div', { class: 'card__body' },
        ctx.state({
          kind: 'warn', icon: '!', title: '目前為唯讀，編輯不會儲存',
          desc: '偵測到瀏覽器未開放本地儲存，本頁只能檢視。你仍可編輯並用「匯入／匯出」把內容帶走，但關閉頁面後改動會遺失。',
          actions: [el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已下載 site-aspect.txt', 'ok'); } }, '匯出目前內容')]
        }))));
    root.appendChild(editorCard(ctx));
  }

  VC.registerView('site', { nav: 'site' }, function (root, ctx) {
    VC.dev.screen('site', root, ctx, {
      data: renderData, empty: renderEmpty, loading: renderLoading,
      error: renderError, degraded: renderDegraded
    });
  });
})();
