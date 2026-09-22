/* ============================================================================
   ViCons — 畫面 16 · 資料與備份                   app/views/backup.js
   ----------------------------------------------------------------------------
   對應 VicBid「数据与备份」，改寫成深色設計語言。

   職責：本地資料的盤點、備份、還原、重置，以及 AI 助手設定。

   設計決定：
   1. 13 個 store 逐一列出筆數與佔用，因為「資料存咗喺邊」是用戶最常問的。
   2. 重置是破壞性操作，必須列出「將會刪除什麼」才准按 —— 只寫「不可恢復」不夠。
   3. AI Key 只存 localStorage，要明講，避免用戶以為存了在雲端。
   ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var el = VC.el;

  /* 13 個 store（與 vicbid_db v2 契約一致，不可增減改名） */
  var STORES = [
    { name: 'projects',      zh: '專案',         n: 3,   kb: 18.4 },
    { name: 'tenders',       zh: '標書',         n: 2,   kb: 892.1 },
    { name: 'sor_items',     zh: 'SoR 項目',     n: 142, kb: 246.7 },
    { name: 'requirements',  zh: '提交要求',     n: 16,  kb: 31.2 },
    { name: 'compliance',    zh: '合規勾選',     n: 9,   kb: 12.8 },
    { name: 'site_aspects',  zh: '現場條件',     n: 7,   kb: 22.6 },
    { name: 'tech_plans',    zh: '技術方案',     n: 1,   kb: 8.9 },
    { name: 'schedules',     zh: '進度計劃',     n: 1,   kb: 6.4 },
    { name: 'hk_tenders',    zh: '招標記錄',     n: 6,   kb: 9.1 },
    { name: 'versions',      zh: '版本快照',     n: 4,   kb: 118.3 },
    { name: 'notes',         zh: '備註',         n: 12,  kb: 4.7 },
    { name: 'settings',      zh: '設定',         n: 1,   kb: 0.8 },
    { name: 'bid_indicators', zh: '投標指標',    n: 2,   kb: 5.2 }
  ];

  function totalRecords() { return STORES.reduce(function (n, s) { return n + s.n; }, 0); }
  function totalKb() { return STORES.reduce(function (n, s) { return n + s.kb; }, 0); }

  /* ---------- 儲存狀態 ---------- */
  function storageCard() {
    var dot = el('span', { class: 'dot dot--ok' });
    var head = el('div', { style: 'display:flex; align-items:center; gap:var(--sp-3)' },
      el('div', { style: 'width:38px; height:38px; border-radius:var(--r-md); display:grid; place-items:center; background:var(--ok-wash); border:1px solid var(--ok-line); color:var(--ok); font-size:18px' }, '🗄'),
      el('div', {},
        el('div', { class: 'u-strong' }, 'IndexedDB 本機儲存'),
        el('div', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, 'vicbid_db v2 · 13 個 store · 資料不會上傳到任何伺服器')));

    var usage = el('div', { style: 'margin-top:var(--sp-4)' },
      el('div', { style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--sp-2)' },
        el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, '已用空間'),
        el('span', { class: 'u-mono', style: 'font-size:var(--fs-xs)' }, totalKb().toFixed(1) + ' KB / 約 50 MB 配額')),
      el('div', { class: 'bar' },
        el('div', { class: 'bar__fill bar__fill--ok', style: 'width:' + Math.max(1, totalKb() / 51200 * 100) + '%' })));

    return el('div', { class: 'card' },
      el('div', { class: 'card__header' }, el('h3', {}, '儲存狀態'), el('div', { class: 'spacer' }), VC.pill('正常', 'dot--ok')),
      el('div', { class: 'card__body' }, head, usage));
  }

  /* ---------- 13 store 盤點 ---------- */
  function storeTable(ctx) {
    var cols = [
      { key: 's', label: 'Store 名稱', cls: 'col-desc' },
      { key: 'z', label: '內容' },
      { key: 'n', label: '筆數', cls: 'col-num' },
      { key: 'k', label: '佔用 (KB)', cls: 'col-num' }
    ];

    var rows = STORES.map(function (s) {
      return [
        el('span', { class: 'u-mono', style: 'font-size:var(--fs-xs)' }, s.name),
        el('span', { class: 'u-soft' }, s.zh),
        el('span', { class: 'u-mono' }, String(s.n)),
        el('span', { class: 'u-mono' }, s.kb.toFixed(1))
      ];
    });

    var head = el('div', { class: 'card__header' },
      el('h3', {}, '資料盤點'),
      el('div', { class: 'spacer' }),
      el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, '13 個 store · 共 ' + totalRecords() + ' 筆'));

    var foot = el('div', { class: 'card__footer' },
      el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, '合計 ' + totalKb().toFixed(1) + ' KB'));

    return el('div', { class: 'card' }, head,
      el('div', { class: 'card__body card__body--flush' }, ctx.table({ cols: cols, rows: rows, foot: null })),
      foot);
  }

  /* ---------- 備份與還原 ---------- */
  function backupCard(ctx) {
    function act(icon, label, hint, cls, onclick) {
      return el('button', {
        class: 'btn ' + cls,
        style: 'display:flex; flex-direction:column; align-items:flex-start; gap:var(--sp-1); padding:var(--sp-4); height:auto; text-align:left',
        onclick: onclick
      },
        el('span', { style: 'font-size:var(--fs-lg)' }, icon),
        el('span', { class: 'u-strong' }, label),
        el('span', { class: 'u-muted', style: 'font-size:var(--fs-2xs); font-weight:400' }, hint));
    }

    var grid = el('div', { class: 'grid grid--2' },
      act('⇩', '匯出 JSON', '完整資料，可讀格式', '', function () { VC.toast('已匯出 示範備份_2026-09-20.json', 'ok'); }),
      act('⇩', '匯出 ZIP', '含 manifest 版本資訊', '', function () { VC.toast('已匯出 示範備份_2026-09-20.zip', 'ok'); }),
      act('⇪', '匯入備份', '還原 JSON 或 ZIP', '', function () { VC.toast('選擇備份檔…', 'info'); }),
      act('🗑', '重置所有資料', '清空 13 個 store', 'btn--danger', function () { confirmReset(ctx); }));

    return el('div', { class: 'card' },
      el('div', { class: 'card__header' },
        el('h3', {}, '備份與還原'),
        el('div', { class: 'spacer' }),
        el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, '建議每次大量改動前先匯出')),
      el('div', { class: 'card__body' }, grid));
  }

  /* 破壞性操作：必須列出影響範圍才准按 */
  function confirmReset(ctx) {
    var list = el('div', { class: 'tbl-wrap', style: 'max-height:240px; overflow:auto' });
    var t = el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, '將被清空的 store'), el('th', { class: 'col-num' }, '筆數'))),
      el('tbody', {}, STORES.filter(function (s) { return s.n > 0; }).map(function (s) {
        return el('tr', {},
          el('td', {}, el('span', { class: 'u-mono', style: 'font-size:var(--fs-xs)' }, s.name), ' ', el('span', { class: 'u-soft' }, s.zh)),
          el('td', { class: 'col-num' }, el('span', { class: 'u-mono' }, String(s.n))));
      })));
    list.appendChild(t);

    var warn = el('div', {
      style: 'display:flex; gap:var(--sp-2); padding:var(--sp-3); background:var(--danger-wash); border:1px solid var(--danger-line); border-radius:var(--r-md); margin-bottom:var(--sp-4)'
    },
      el('span', { style: 'color:var(--danger)' }, '⚠'),
      el('div', {},
        el('div', { class: 'u-strong', style: 'color:var(--danger)' }, '此操作不可撤銷'),
        el('div', { class: 'u-muted', style: 'font-size:var(--fs-sm)' }, '下列 ' + totalRecords() + ' 筆資料會被永久刪除，無法復原。建議先按「匯出 ZIP」備份。')));

    var body = el('div', {}, warn,
      el('div', { class: 'kicker', style: 'display:block; margin-bottom:var(--sp-2)' }, '受影響範圍'),
      list);

    var overlay = el('div', { class: 'overlay' });
    var modal = el('div', { class: 'modal modal--wide' },
      el('div', { class: 'modal__head' }, el('h3', {}, '確認重置所有資料')),
      el('div', { class: 'modal__body' }, body),
      el('div', { class: 'modal__foot' },
        el('button', { class: 'btn', onclick: function () { overlay.remove(); } }, '取消'),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn', onclick: function () { overlay.remove(); VC.toast('已先匯出備份', 'ok'); } }, '先匯出備份'),
        el('button', { class: 'btn btn--danger', onclick: function () { overlay.remove(); VC.toast('已清空全部 13 個 store', 'warn'); ctx.go('overview-1'); } }, '確認重置')));

    overlay.appendChild(modal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  /* ---------- AI 設定 ---------- */
  function aiCard(ctx) {
    var provSel = el('select', { class: 'select' },
      ['不使用', 'OpenAI', 'DeepSeek', 'Anthropic', '自建端點'].map(function (x, i) {
        var o = el('option', { value: i === 0 ? '' : x }, x);
        if (i === 2) o.setAttribute('selected', 'selected');
        return o;
      }));

    var urlIn = el('input', { class: 'input input--mono', value: 'https://api.deepseek.com/v1', placeholder: 'https://…/v1' });
    var modelIn = el('input', { class: 'input input--mono', value: 'deepseek-chat', placeholder: '模型名稱' });
    var keyIn = el('input', { class: 'input input--mono', type: 'password', placeholder: 'sk-…' });

    var note = el('div', {
      style: 'display:flex; gap:var(--sp-2); padding:var(--sp-3); background:var(--warn-wash); border:1px solid var(--warn-line); border-radius:var(--r-md); margin-top:var(--sp-3)'
    },
      el('span', { style: 'color:var(--warn)' }, '⚠'),
      el('div', { class: 'u-muted', style: 'font-size:var(--fs-xs)' },
        'API Key 只存在瀏覽器的 localStorage，不會寫進資料庫、不會上傳、不會包含在備份檔內。共用電腦請勿填寫。'));

    var form = el('div', {},
      el('div', { class: 'field' }, el('label', { class: 'field__label' }, 'AI 服務商'), provSel),
      el('div', { class: 'grid grid--2' },
        el('div', { class: 'field' }, el('label', { class: 'field__label' }, 'API 位址'), urlIn),
        el('div', { class: 'field' }, el('label', { class: 'field__label' }, '模型名稱'), modelIn)),
      el('div', { class: 'field' }, el('label', { class: 'field__label' }, 'API Key'), keyIn),
      note);

    var testBtn = el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('正在測試連線…', 'info'); } }, '測試連線');
    var saveBtn = el('button', { class: 'btn btn--sm btn--primary', onclick: function () { VC.toast('AI 設定已儲存（未填 Key，暫無法呼叫）', 'warn'); } }, '儲存設定');

    return el('div', { class: 'card' },
      el('div', { class: 'card__header' },
        el('h3', {}, 'AI 助手設定'),
        el('div', { class: 'spacer' }),
        VC.badge('選填', 'neutral')),
      el('div', { class: 'card__body' }, form,
        el('div', { style: 'display:flex; gap:var(--sp-2); margin-top:var(--sp-4)' }, testBtn, saveBtn)));
  }

  /* ---------- 五態 ---------- */
  function renderData(root, ctx) {
    root.appendChild(ctx.pagehead({
      title: '資料與備份',
      sub: '13 個 store · ' + totalRecords() + ' 筆 · ' + totalKb().toFixed(1) + ' KB，全部存放在本機',
      actions: [el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已匯出完整備份', 'ok'); } }, '⇩ 立即備份')]
    }));

    root.appendChild(storageCard());
    root.appendChild(ctx.secTitle('資料盤點'));
    root.appendChild(storeTable(ctx));
    root.appendChild(ctx.secTitle('備份與還原'));
    root.appendChild(backupCard(ctx));
    root.appendChild(ctx.secTitle('AI 助手'));
    root.appendChild(aiCard(ctx));
  }

  function renderEmpty(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '資料與備份', sub: '本機資料庫是空的' }));
    root.appendChild(storageCard());
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'empty', icon: '🗄', title: '13 個 store 都是空的',
        desc: '還沒有任何專案資料。開始匯入標書或建立專案之後，這裡會顯示每個 store 的筆數與佔用空間。也可以直接匯入別人給你的備份檔。',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { ctx.go('intake'); } }, '⇪ 匯入標書開始'),
          el('button', { class: 'btn', onclick: function () { VC.toast('選擇備份檔…', 'info'); } }, '匯入備份')
        ]
      })
    }));
  }

  function renderLoading(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '資料與備份', sub: '正在盤點本機資料…' }));
    var body = el('div', { class: 'card__body' });
    body.appendChild(el('div', { class: 'skel skel--title' }));
    for (var i = 0; i < 6; i++) {
      body.appendChild(el('div', { style: 'display:flex; align-items:center; gap:var(--sp-3); margin-bottom:var(--sp-2)' },
        el('div', { class: 'skel skel--line', style: 'width:180px' }),
        el('div', { class: 'skel skel--line', style: 'flex:1' })));
    }
    root.appendChild(el('div', { class: 'card' }, body));
  }

  function renderError(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '資料與備份', sub: '無法開啟本機資料庫' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'error', icon: '✕', title: '無法開啟本機資料庫',
        desc: '瀏覽器拒絕了 IndexedDB 連線，常見於私密瀏覽模式、或網站資料被設為封鎖。你的資料仍在磁碟上，並未遺失。',
        detail: 'indexedDB.open("vicbid_db", 2)\nError: InvalidStateError — 瀏覽器處於私密模式，IndexedDB 不可用\n建議：改用一般視窗開啟，或檢查「網站資料」是否被封鎖',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('重試中…', 'info'); } }, '重試'),
          el('button', { class: 'btn', onclick: function () { VC.toast('已複製排錯指引', 'ok'); } }, '複製排錯指引')
        ]
      })
    }));
  }

  function renderDegraded(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '資料與備份', sub: '儲存空間不足 · 部分功能停用' }));
    root.appendChild(el('div', { class: 'card card--accent' },
      el('div', { class: 'card__body' },
        ctx.state({
          kind: 'warn', icon: '!', title: '接近儲存配額（已用 96%）',
          desc: '本機儲存只剩少量空間，「匯入備份」會因為空間不足而失敗。建議先匯出並清理大型 store（標書與版本快照佔最多）。',
          actions: [
            el('button', { class: 'btn btn--sm btn--primary', onclick: function () { VC.toast('已匯出完整備份', 'ok'); } }, '先匯出備份'),
            el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已列出可清理項目', 'info'); } }, '清理大型項目')
          ]
        }))));
    root.appendChild(storeTable(ctx));
  }

  VC.registerView('backup', { nav: 'backup' }, function (root, ctx) {
    VC.dev.screen('backup', root, ctx, {
      data: renderData, empty: renderEmpty, loading: renderLoading,
      error: renderError, degraded: renderDegraded
    });
  });
})();
