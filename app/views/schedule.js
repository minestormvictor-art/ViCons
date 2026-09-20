/* ============================================================================
   ViCons — 畫面 15 · 進度規劃                     app/views/schedule.js
   ----------------------------------------------------------------------------
   對應 VicBid「进度规划」，改寫成深色設計語言並補上關鍵路徑。

   職責：編排施工進度，輸出可附進標書的計劃表。

   設計決定：
   1. 甘特圖加月份刻度與今日線 —— VicBid 版只有光禿禿的長條，看不出時間尺度。
   2. 關鍵路徑用 --danger 標示（延誤直接影響竣工，屬「要吵」的資訊）。
   3. 日期驗證必須擋在寫入前：完工早於開工是最常見的輸入錯誤。
   ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var el = VC.el;

  /* 示範計劃（相對 2026-09-01 起算，屬一般工序，不含任何真實項目資料） */
  var TASKS = [
    { id: 'k1', name: '工地建立及進場',    start: '2026-09-01', end: '2026-09-15', dep: '',             crit: true },
    { id: 'k2', name: '拆卸及清運',        start: '2026-09-10', end: '2026-09-30', dep: '工地建立及進場', crit: true },
    { id: 'k3', name: '基礎工程',          start: '2026-09-25', end: '2026-11-20', dep: '拆卸及清運',     crit: true },
    { id: 'k4', name: '主體結構',          start: '2026-11-10', end: '2027-02-10', dep: '基礎工程',       crit: true },
    { id: 'k5', name: '機電安裝',          start: '2027-01-15', end: '2027-03-20', dep: '主體結構',       crit: false },
    { id: 'k6', name: '裝修收尾',          start: '2027-02-25', end: '2027-04-20', dep: '機電安裝',       crit: false },
    { id: 'k7', name: '測試及調試',        start: '2027-04-10', end: '2027-05-05', dep: '裝修收尾',       crit: false },
    { id: 'k8', name: '竣工移交',          start: '2027-05-05', end: '2027-05-15', dep: '測試及調試',     crit: true }
  ];

  var TODAY = '2026-09-20';
  var DAY = 86400000;

  function d(x) { return new Date(x + 'T00:00:00'); }
  function days(a, b) { return Math.round((d(b) - d(a)) / DAY); }
  function addDays(a, n) { var x = d(a); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
  function fmt(x) { return x; }

  function bounds() {
    var min = TASKS[0].start, max = TASKS[0].end;
    TASKS.forEach(function (t) {
      if (t.start < min) min = t.start;
      if (t.end > max) max = t.end;
    });
    return { min: min, max: max, span: Math.max(1, days(min, max)) };
  }

  /* ---------- 甘特圖 ---------- */
  function gantt() {
    var b = bounds();
    var wrap = el('div', { style: 'overflow-x:auto' });
    var inner = el('div', { style: 'min-width:900px' });

    /* 月份刻度 */
    var months = [];
    var cur = d(b.min);
    cur.setDate(1);
    while (cur <= d(b.max)) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }

    var ticks = el('div', { style: 'display:flex; margin-left:180px; border-bottom:1px solid var(--line); padding-bottom:var(--sp-1)' });
    months.forEach(function (m) {
      var mStart = m.toISOString().slice(0, 10);
      var left = Math.max(0, days(b.min, mStart));
      var w = Math.min(b.span - left, 30);
      ticks.appendChild(el('div', {
        style: 'flex:0 0 ' + (w / b.span * 100) + '%; font-size:var(--fs-2xs); color:var(--ink-ghost); font-family:var(--font-mono)'
      }, (m.getMonth() + 1) + ' 月'));
    });
    inner.appendChild(ticks);

    var todayPct = days(b.min, TODAY) / b.span * 100;

    TASKS.forEach(function (t) {
      var label = el('div', {
        style: 'flex:0 0 180px; font-size:var(--fs-xs); display:flex; align-items:center; gap:var(--sp-2); cursor:pointer',
        title: '點擊編輯',
        onclick: function () { VC.toast('開啟編輯：' + t.name, 'info'); }
      },
        t.crit ? el('span', { style: 'color:var(--danger)' }, '◆') : el('span', { class: 'u-faint' }, '◇'),
        el('span', { class: 'u-trunc' }, t.name));

      var track = el('div', { style: 'flex:1; position:relative; height:20px' });

      /* 今日線 */
      track.appendChild(el('div', {
        style: 'position:absolute; top:-4px; bottom:-4px; left:' + todayPct + '%; width:1px; background:var(--info); opacity:.5'
      }));

      var off = Math.max(0, days(b.min, t.start));
      var len = Math.max(1, days(t.start, t.end));
      var barCls = t.crit ? '' : '';
      var barColor = t.crit ? 'var(--danger)' : 'var(--cobalt)';

      track.appendChild(el('div', {
        style: 'position:absolute; top:5px; height:10px; left:' + (off / b.span * 100) + '%; width:' + (len / b.span * 100) + '%; background:' + barColor + '; border-radius:var(--r-full); opacity:.85',
        title: t.name + '：' + t.start + ' → ' + t.end + '（' + len + ' 日）'
      }));

      inner.appendChild(el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2); margin-bottom:var(--sp-1); min-height:26px' }, label, track));
    });

    var legend = el('div', { style: 'display:flex; align-items:center; gap:var(--sp-4); margin-top:var(--sp-4); font-size:var(--fs-xs); color:var(--ink-faint)' },
      el('span', { style: 'display:flex; align-items:center; gap:var(--sp-1)' },
        el('span', { style: 'width:14px; height:4px; background:var(--danger); border-radius:var(--r-full); display:inline-block' }), '關鍵路徑'),
      el('span', { style: 'display:flex; align-items:center; gap:var(--sp-1)' },
        el('span', { style: 'width:14px; height:4px; background:var(--cobalt); border-radius:var(--r-full); display:inline-block' }), '非關鍵工序'),
      el('span', { style: 'display:flex; align-items:center; gap:var(--sp-1)' },
        el('span', { style: 'width:1px; height:12px; background:var(--info); display:inline-block' }), '今日 ' + TODAY));

    wrap.appendChild(inner);
    return el('div', { class: 'card' },
      el('div', { class: 'card__header' }, el('h3', {}, '施工總進度計劃'), el('div', { class: 'spacer' }), VC.badge('關鍵路徑 ' + TASKS.filter(function (t) { return t.crit; }).length + ' 項', 'danger')),
      el('div', { class: 'card__body' }, wrap, legend));
  }

  /* ---------- 任務表 ---------- */
  function taskTable(ctx) {
    var cols = [
      { key: 'c', label: '', cls: 'col-num' },
      { key: 'n', label: '工序', cls: 'col-desc' },
      { key: 's', label: '開始' },
      { key: 'e', label: '完工' },
      { key: 'd', label: '工期', cls: 'col-num' },
      { key: 'p', label: '前置工序' },
      { key: 'a', label: '' }
    ];

    var rows = TASKS.map(function (t) {
      var len = days(t.start, t.end);
      var act = el('div', { style: 'display:flex; gap:var(--sp-1)' },
        el('button', { class: 'btn btn--sm btn--ghost', title: '編輯', onclick: function () { openEditor(ctx, t); } }, '✎'),
        el('button', { class: 'btn btn--sm btn--ghost', title: '刪除', onclick: function () { VC.toast('已刪除（示範）', 'warn'); } }, '🗑'));

      return [
        t.crit ? el('span', { style: 'color:var(--danger)' }, '◆') : el('span', { class: 'u-faint' }, '◇'),
        t.name,
        el('span', { class: 'u-mono' }, t.start),
        el('span', { class: 'u-mono' }, t.end),
        el('span', { class: 'u-mono' }, len + ' 日'),
        t.dep ? el('span', { class: 'u-soft', style: 'font-size:var(--fs-xs)' }, t.dep) : el('span', { class: 'u-faint' }, '—'),
        act
      ];
    });

    var head = el('div', { class: 'card__header' },
      el('h3', {}, '工序明細'),
      el('div', { class: 'spacer' }),
      el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, TASKS.length + ' 項 · 總工期 ' + days(bounds().min, bounds().max) + ' 日'));

    var foot = el('div', { class: 'card__footer' },
      el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已匯出 Project_Schedule.xlsx', 'ok'); } }, '⇩ 匯出 Excel'),
      el('button', { class: 'btn btn--sm btn--ghost', onclick: function () { VC.toast('已匯出 Project_Schedule.csv', 'ok'); } }, '⇩ 匯出 CSV'),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn btn--sm btn--primary', onclick: function () { openEditor(ctx, null); } }, '+ 新增工序'));

    return el('div', { class: 'card' }, head,
      el('div', { class: 'card__body card__body--flush' }, ctx.table({ cols: cols, rows: rows })),
      foot);
  }

  /* ---------- 新增／編輯（含驗證） ---------- */
  function openEditor(ctx, t) {
    var isNew = !t;
    t = t || { name: '', start: TODAY, end: addDays(TODAY, 14), dep: '' };

    var nameIn = el('input', { class: 'input', value: t.name, placeholder: '工序名稱' });
    var startIn = el('input', { class: 'input input--mono', type: 'date', value: t.start });
    var endIn = el('input', { class: 'input input--mono', type: 'date', value: t.end });
    var depIn = el('input', { class: 'input', value: t.dep, placeholder: '前置工序名稱（可留空）' });

    var errBox = el('div', { class: 'field__hint', style: 'color:var(--danger); min-height:1.2em' });

    function validate() {
      var n = nameIn.value.trim();
      var s = startIn.value, e = endIn.value;
      if (!n) return '工序名稱不可留空。';
      if (!s || !e) return '必須填寫開始與完工日期。';
      if (new Date(e) < new Date(s)) return '完工日期不可早於開始日期。';
      return '';
    }

    var body = el('div', {},
      el('div', { class: 'field' },
        el('label', { class: 'field__label' }, '工序名稱'), nameIn),
      el('div', { class: 'grid grid--2' },
        el('div', { class: 'field' }, el('label', { class: 'field__label' }, '開始日期'), startIn),
        el('div', { class: 'field' }, el('label', { class: 'field__label' }, '完工日期'), endIn)),
      el('div', { class: 'field' },
        el('label', { class: 'field__label' }, '前置工序'), depIn,
        el('div', { class: 'field__hint' }, '前置工序未完工前，本工序不可開始（用於推算關鍵路徑）')),
      errBox);

    function submit() {
      var msg = validate();
      if (msg) { errBox.textContent = msg; VC.toast(msg, 'err'); return; }
      VC.toast(isNew ? '工序已新增' : '工序已更新', 'ok');
      close();
    }

    var overlay = el('div', { class: 'overlay' });
    var modal = el('div', { class: 'modal modal--wide' },
      el('div', { class: 'modal__head' }, el('h3', {}, isNew ? '新增工序' : '編輯工序')),
      el('div', { class: 'modal__body' }, body),
      el('div', { class: 'modal__foot' },
        el('button', { class: 'btn', onclick: function () { close(); } }, '取消'),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn btn--primary', onclick: submit }, isNew ? '新增' : '儲存')));

    overlay.appendChild(modal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    function close() { overlay.remove(); }

    document.body.appendChild(overlay);
    setTimeout(function () { nameIn.focus(); }, 30);
  }

  /* ---------- 五態 ---------- */
  function renderData(root, ctx) {
    var b = bounds();

    root.appendChild(ctx.pagehead({
      title: '進度規劃',
      sub: b.min + ' → ' + b.max + ' · 共 ' + days(b.min, b.max) + ' 日 · 8 項工序',
      actions: [
        el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已重算關鍵路徑', 'ok'); } }, '重算關鍵路徑'),
        el('button', { class: 'btn btn--sm btn--primary', onclick: function () { openEditor(ctx, null); } }, '+ 新增工序')
      ]
    }));

    root.appendChild(el('div', { class: 'grid grid--4' },
      ctx.stat({ icon: '⟳', value: String(days(b.min, b.max)), label: '總工期（日）' }),
      ctx.stat({ icon: '◆', value: String(TASKS.filter(function (t) { return t.crit; }).length), label: '關鍵路徑工序', badge: '不可延', badgeKind: 'danger' }),
      ctx.stat({ icon: '◇', value: String(TASKS.filter(function (t) { return !t.crit; }).length), label: '非關鍵工序', badge: '有浮時', badgeKind: 'ok' }),
      ctx.stat({ icon: '▤', value: '5', label: '本月里程碑' })));

    root.appendChild(ctx.secTitle('甘特圖'));
    root.appendChild(gantt());
    root.appendChild(ctx.secTitle('工序明細'));
    root.appendChild(taskTable(ctx));
  }

  function renderEmpty(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '進度規劃', sub: '尚未建立進度計劃' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'empty', icon: '▦', title: '進度計劃為空',
        desc: '可以逐項新增工序，或先載入一份示範計劃（工地建立 → 拆卸 → 基礎 → 主體 → 機電 → 裝修 → 測試 → 移交）再修改。',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { openEditor(ctx, null); } }, '新增工序'),
          el('button', { class: 'btn', onclick: function () { VC.toast('已載入示範計劃', 'ok'); ctx.go('schedule'); } }, '載入示範計劃')
        ]
      })
    }));
  }

  function renderLoading(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '進度規劃', sub: '正在讀取進度資料…' }));

    /* 直接持有 body 引用 —— 不用 querySelector，因為無瀏覽器環境下沒有選擇器引擎 */
    var body = el('div', { class: 'card__body' });
    body.appendChild(el('div', { class: 'skel skel--title' }));
    for (var i = 0; i < 6; i++) {
      body.appendChild(el('div', { style: 'display:flex; align-items:center; gap:var(--sp-3); margin-bottom:var(--sp-2)' },
        el('div', { class: 'skel skel--line', style: 'width:150px' }),
        el('div', { class: 'skel skel--line', style: 'flex:1' })));
    }
    root.appendChild(el('div', { class: 'card' }, body));
  }

  function renderError(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '進度規劃', sub: '讀取失敗' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'error', icon: '✕', title: '進度資料損毀',
        desc: '儲存的工序中有無法解析的日期（例如空字串或格式錯誤），甘特圖無法計算時間軸。已跳過有問題的 2 項工序。',
        detail: 'Store: schedules\n問題工序：\n  k9  「臨時工程」start="" end="2027-06-01"\n  k10 「外牆髹漆」start="2027-13-01" end="2027-06-20"  ← 月份 13 不合法\n其餘 8 項工序正常，已正常顯示',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('已修正 2 項問題工序', 'ok'); ctx.go('schedule'); } }, '自動修正'),
          el('button', { class: 'btn', onclick: function () { VC.toast('已匯出原始資料供檢查', 'ok'); } }, '匯出原始資料')
        ]
      })
    }));
  }

  function renderDegraded(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '進度規劃', sub: '唯讀 · 匯入的計劃來自外部' }));
    root.appendChild(el('div', { class: 'card card--accent' },
      el('div', { class: 'card__body' },
        ctx.state({
          kind: 'warn', icon: '!', title: '此計劃由外部檔案匯入，不可直接編輯',
          desc: '這份進度來自 Primavera P6 匯出的 XML。為免下次同步時互相覆蓋，本頁只供檢視。若要改動，請在 P6 內修改後重新匯入。',
          actions: [el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已解除鎖定，可本機編輯', 'warn'); } }, '解除鎖定後編輯')]
        }))));
    root.appendChild(gantt());
    root.appendChild(taskTable(ctx));
  }

  VC.registerView('schedule', { nav: 'schedule' }, function (root, ctx) {
    VC.dev.screen('schedule', root, ctx, {
      data: renderData, empty: renderEmpty, loading: renderLoading,
      error: renderError, degraded: renderDegraded
    });
  });
})();
