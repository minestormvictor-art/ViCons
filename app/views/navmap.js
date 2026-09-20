/* ============================================================================
   ViCons — 畫面 17 · 提交導航器                   app/views/navmap.js
   ----------------------------------------------------------------------------
   對應 VicBid「提交导航器」，改寫成深色設計語言。

   職責：這是投標準備的收口畫面。把兩件事對齊 ——
        (1) 所選合約類型要求的條款清單，逐項勾選
        (2) 標書抽出的提交要求，逐項指派負責人與狀態

   設計決定：
   1. 勾選即時反映到頂部進度條，因為「仲差幾多」是這個畫面唯一重要的數字。
   2. 未指派負責人的項目要吵 —— 用 --warn 標示，並且在缺口中優先列出。
   3. 缺口不是訊息，是要建的待辦。所以提供「一鍵建事項並指派」，
      而不是只彈一句「有 5 個缺口」。
   ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var el = VC.el;

  /* ---------- 合約條款清單（NEC 類型，與 contract.js 一致） ---------- */
  var CLAUSES = [
    { section: '商務標',     items: ['費率表', '補償事件程序', '早期警告機制', '風險評估', '項目管理計劃'] },
    { section: '技術標',     items: ['施工進度計劃', '信息分配', '質量計劃', '健康安全計劃', '環境管理'] },
    { section: '風險與承諾', items: ['合作承諾', '風險分擔條款', '早期警告義務', '補償事件通知', '保險條款'] },
    { section: '合約管理',   items: ['項目經理職責', '裁決人機制', '爭議解決', '變更程序'] }
  ];

  /* 已勾選態（模擬已儲存的 compliance 記錄） */
  var checked = {
    '商務標::費率表': true, '商務標::補償事件程序': true, '商務標::早期警告機制': true,
    '商務標::風險評估': false, '商務標::項目管理計劃': false,
    '技術標::施工進度計劃': true, '技術標::信息分配': false, '技術標::質量計劃': true,
    '技術標::健康安全計劃': true, '技術標::環境管理': true,
    '風險與承諾::合作承諾': true, '風險與承諾::風險分擔條款': false, '風險與承諾::早期警告義務': true,
    '風險與承諾::補償事件通知': false, '風險與承諾::保險條款': true,
    '合約管理::項目經理職責': true, '合約管理::裁決人機制': true,
    '合約管理::爭議解決': false, '合約管理::變更程序': true
  };

  /* ---------- 提交要求（模擬從標書抽出的 requirements） ---------- */
  var REQS = [
    { id: 'REQ-001', text: '提交近五年同類工程經驗證明，須附合約金額及完工證明', cat: '資格', status: 'done',     who: '陳工程師' },
    { id: 'REQ-002', text: '提交不少於三名註冊工程師的履歷及註冊證明',           cat: '人員', status: 'done',     who: '陳工程師' },
    { id: 'REQ-003', text: '提交施工總進度計劃（含關鍵路徑分析）',               cat: '技術', status: 'in_progress', who: '李計劃' },
    { id: 'REQ-004', text: '提交安全管理體系文件及最近三年安全紀錄',             cat: '安全', status: 'done',     who: '黃安全' },
    { id: 'REQ-005', text: '提交環境管理計劃及廢物處置安排',                     cat: '環境', status: 'pending',  who: '' },
    { id: 'REQ-006', text: '提交投標保函，金額為投標價之百分之五',               cat: '商務', status: 'pending',  who: '' },
    { id: 'REQ-007', text: '提交 MiC 預製組件供應商證明文件',                   cat: '技術', status: 'non_compliant', who: '李計劃' },
    { id: 'REQ-008', text: '提交分包商名單及主要分包商資質',                     cat: '商務', status: 'in_progress', who: '周商務' },
    { id: 'REQ-009', text: '提交質量保證計劃，須符合 ISO 9001',                  cat: '品質', status: 'done',     who: '吳品質' },
    { id: 'REQ-010', text: '提交工地佈置圖及臨時設施安排',                       cat: '技術', status: 'pending',  who: '' },
    { id: 'REQ-011', text: '提交鄰近建築物沉降監測方案',                         cat: '技術', status: 'pending',  who: '' },
    { id: 'REQ-012', text: '提交夜間施工噪音緩解措施',                           cat: '環境', status: 'non_compliant', who: '' },
    { id: 'REQ-013', text: '提交應急預案及疏散路線圖',                           cat: '安全', status: 'in_progress', who: '黃安全' },
    { id: 'REQ-014', text: '提交保險證明（勞工保險及第三者責任）',               cat: '商務', status: 'done',     who: '周商務' },
    { id: 'REQ-015', text: '提交價格明細表，按章節分項列示',                     cat: '商務', status: 'pending',  who: '' },
    { id: 'REQ-016', text: '提交項目組織架構圖及匯報路線',                       cat: '人員', status: 'pending',  who: '' }
  ];

  var STATUS = {
    pending:       { zh: '待處理', kind: 'warn' },
    in_progress:   { zh: '進行中', kind: 'info' },
    done:          { zh: '已完成', kind: 'ok' },
    compliant:     { zh: '合規',   kind: 'ok' },
    non_compliant: { zh: '不合規', kind: 'danger' }
  };

  var FILTER = { k: 'all' };

  function isDone(r) { return r.status === 'done' || r.status === 'compliant'; }
  function isGap(r) { return r.status === 'pending' || r.status === 'non_compliant'; }

  function clauseStats() {
    var all = [];
    CLAUSES.forEach(function (c) { c.items.forEach(function (i) { all.push(checked[c.section + '::' + i]); }); });
    var n = all.filter(Boolean).length;
    return { n: n, total: all.length };
  }

  /* ---------- 合約條款清單 ---------- */
  function clauseCard(ctx) {
    var body = el('div', { class: 'card__body' });

    CLAUSES.forEach(function (cl) {
      var rows = el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-1)' });

      cl.items.forEach(function (it) {
        var key = cl.section + '::' + it;
        var box = el('input', { type: 'checkbox' });
        box.checked = !!checked[key];
        box.addEventListener('change', function (e) {
          checked[key] = e.target.checked;
          VC.toast(e.target.checked ? '已勾選並儲存：' + it : '已取消勾選：' + it, e.target.checked ? 'ok' : 'warn', 1400);
        });

        rows.appendChild(el('label', {
          style: 'display:flex; align-items:center; gap:var(--sp-3); padding:var(--sp-2) var(--sp-3); border:1px solid var(--line); border-radius:var(--r-sm); background:var(--panel-2); cursor:pointer'
        }, box, el('span', { style: 'font-size:var(--fs-sm)' }, it)));
      });

      var doneN = cl.items.filter(function (i) { return checked[cl.section + '::' + i]; }).length;
      var head = el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2); margin-bottom:var(--sp-2)' },
        el('span', { class: 'kicker' }, cl.section),
        doneN === cl.items.length ? VC.badge('齊備', 'ok') : VC.badge(doneN + '/' + cl.items.length, 'warn'));

      body.appendChild(el('div', { style: 'margin-bottom:var(--sp-5)' }, head, rows));
    });

    var cs = clauseStats();
    var header = el('div', { class: 'card__header' },
      el('h3', {}, 'NEC 合約 — 提交合規清單'),
      el('div', { class: 'spacer' }),
      VC.badge(cs.n + '/' + cs.total + ' 已勾選', cs.n === cs.total ? 'ok' : 'warn'));

    return el('div', { class: 'card' }, header, body);
  }

  /* ---------- 分類導航 + 總進度 ---------- */
  function progressCard(ctx) {
    var doneN = REQS.filter(isDone).length;
    var pct = Math.round(doneN / REQS.length * 100);
    var gapN = REQS.filter(isGap).length;
    var unassigned = REQS.filter(function (r) { return !r.who; }).length;

    var cats = {};
    REQS.forEach(function (r) { (cats[r.cat] = cats[r.cat] || []).push(r); });

    var chips = el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--sp-2)' });
    Object.keys(cats).forEach(function (c) {
      var rs = cats[c];
      var d = rs.filter(isDone).length;
      chips.appendChild(el('button', {
        class: 'btn btn--sm',
        onclick: function () { VC.toast('已跳至「' + c + '」分組', 'info'); }
      }, c + ' ', VC.badge(d + '/' + rs.length, d === rs.length ? 'ok' : 'warn')));
    });

    var bar = el('div', { class: 'bar' },
      el('div', { class: 'bar__fill' + (pct === 100 ? ' bar__fill--ok' : ' bar__fill--warn'), style: 'width:' + pct + '%' }));

    var alerts = el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--sp-3); margin-top:var(--sp-3)' });
    if (gapN) alerts.appendChild(el('span', { style: 'font-size:var(--fs-xs); color:var(--warn)' }, '⚠ ' + gapN + ' 項缺口待處理'));
    if (unassigned) alerts.appendChild(el('span', { style: 'font-size:var(--fs-xs); color:var(--warn)' }, '⚠ ' + unassigned + ' 項未指派負責人'));
    if (!gapN && !unassigned) alerts.appendChild(el('span', { style: 'font-size:var(--fs-xs); color:var(--ok)' }, '✓ 無缺口，全部已指派'));

    return el('div', { class: 'card' },
      el('div', { class: 'card__header' },
        el('h3', {}, '整體合規進度'),
        el('div', { class: 'spacer' }),
        el('span', { class: 'u-mono' }, doneN + ' / ' + REQS.length + '（' + pct + '%）')),
      el('div', { class: 'card__body' },
        bar, alerts,
        el('div', { class: 'kicker', style: 'display:block; margin:var(--sp-4) 0 var(--sp-2)' }, '按分類跳轉'),
        chips));
  }

  /* ---------- 要求逐項 ---------- */
  function reqRow(ctx, r) {
    var st = STATUS[r.status] || STATUS.pending;

    var idBox = el('span', { class: 'u-mono', style: 'font-size:var(--fs-xs); min-width:4.5rem' }, r.id);

    var statusLine = el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2); flex-wrap:wrap' },
      VC.badge(st.zh, st.kind),
      r.who ? VC.tag('負責：' + r.who) : VC.badge('未指派', 'warn'),
      el('button', { class: 'btn btn--sm btn--ghost', onclick: function () { VC.toast('開啟指派視窗：' + r.id, 'info'); } }, r.who ? '改派' : '+ 指派'));

    var bodyBox = el('div', { style: 'flex:1' },
      el('p', { style: 'margin:0 0 var(--sp-2); font-size:var(--fs-sm)' }, r.text),
      statusLine);

    return el('div', {
      style: 'display:flex; align-items:flex-start; gap:var(--sp-3); padding:var(--sp-3); border:1px solid ' + (isGap(r) ? 'var(--warn-line)' : 'var(--line)') + '; background:var(--panel-2); border-radius:var(--r-md); margin-bottom:var(--sp-2)'
    }, idBox, bodyBox);
  }

  function reqSection(ctx) {
    var cats = {};
    REQS.forEach(function (r) { (cats[r.cat] = cats[r.cat] || []).push(r); });

    var wrap = el('div', {});
    Object.keys(cats).forEach(function (c) {
      var rs = cats[c].filter(function (r) {
        if (FILTER.k === 'gap') return isGap(r);
        if (FILTER.k === 'done') return isDone(r);
        return true;
      });
      if (!rs.length) return;

      var head = el('div', { style: 'display:flex; align-items:center; gap:var(--sp-3); margin-bottom:var(--sp-3)' },
        el('h3', { style: 'margin:0; font-size:var(--fs-md); font-weight:var(--fw-semi)' }, c),
        VC.badge(rs.length + ' 條', 'brand'));

      var list = el('div', {});
      rs.forEach(function (r) { list.appendChild(reqRow(ctx, r)); });

      wrap.appendChild(el('div', { class: 'card', style: 'margin-bottom:var(--sp-5)' },
        el('div', { class: 'card__body' }, head, list)));
    });

    if (!wrap.childNodes.length) {
      wrap.appendChild(el('div', { class: 'card' },
        el('div', { class: 'card__body' },
          ctx.state({ kind: 'empty', icon: '✓', title: '此篩選條件下沒有項目', desc: '切換上方篩選即可看到其他要求。' }))));
    }
    return wrap;
  }

  /* ---------- 缺口偵測 ---------- */
  function gapBar(ctx) {
    var gaps = REQS.filter(isGap);
    var unassigned = REQS.filter(function (r) { return !r.who; }).length;

    var seg = el('div', { class: 'seg', role: 'group', 'aria-label': '要求篩選' });
    [['all', '全部 ' + REQS.length], ['gap', '缺口 ' + gaps.length], ['done', '已完成 ' + REQS.filter(isDone).length]].forEach(function (f) {
      seg.appendChild(el('button', {
        class: 'seg__btn', type: 'button',
        'aria-pressed': FILTER.k === f[0] ? 'true' : 'false',
        onclick: function () { FILTER.k = f[0]; ctx.go('nav-map'); }
      }, f[1]));
    });

    return el('div', { style: 'display:flex; align-items:center; gap:var(--sp-3); margin-bottom:var(--sp-4)' },
      seg,
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已匯出合規報告.xlsx', 'ok'); } }, '⇩ 匯出報告'),
      el('button', {
        class: 'btn btn--sm btn--primary',
        onclick: function () { openGapDialog(ctx, gaps, unassigned); }
      }, '⚑ 偵測合規缺口'));
  }

  function openGapDialog(ctx, gaps, unassigned) {
    if (!gaps.length) { VC.toast('未偵測到合規缺口', 'ok'); return; }

    var list = el('div', { style: 'max-height:260px; overflow:auto' });
    gaps.forEach(function (g) {
      var st = STATUS[g.status] || STATUS.pending;
      list.appendChild(el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2); padding:var(--sp-2); border-bottom:1px solid var(--line-soft)' },
        VC.badge('缺口', 'danger'),
        el('span', { class: 'u-mono', style: 'font-size:var(--fs-xs)' }, g.id),
        el('span', { style: 'flex:1; font-size:var(--fs-sm)' }, g.text.slice(0, 42) + '…'),
        el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, g.who || '未指派')));
    });

    var summary = el('p', { class: 'u-soft', style: 'font-size:var(--fs-sm); margin:0 0 var(--sp-3)' },
      '偵測到 ' + gaps.length + ' 個合規缺口，其中 ' + unassigned + ' 項未指派負責人。建立事項後會自動指派並標為「進行中」。');

    var body = el('div', {}, summary,
      el('div', { class: 'kicker', style: 'display:block; margin-bottom:var(--sp-2)' }, '缺口清單'),
      list);

    var overlay = el('div', { class: 'overlay' });
    var modal = el('div', { class: 'modal modal--wide' },
      el('div', { class: 'modal__head' }, el('h3', {}, '合規缺口偵測')),
      el('div', { class: 'modal__body' }, body),
      el('div', { class: 'modal__foot' },
        el('button', { class: 'btn', onclick: function () { overlay.remove(); } }, '關閉'),
        el('div', { class: 'spacer' }),
        el('button', {
          class: 'btn btn--primary',
          onclick: function () { overlay.remove(); VC.toast(gaps.length + ' 個缺口已建立事項並指派', 'ok'); }
        }, '一鍵建事項並指派')));

    overlay.appendChild(modal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  /* ---------- 五態 ---------- */
  function renderData(root, ctx) {
    root.appendChild(ctx.pagehead({
      title: '提交導航器',
      sub: '合約類型 NEC · 條款清單 ' + clauseStats().n + '/' + clauseStats().total + ' · 提交要求 ' + REQS.length + ' 條',
      actions: [VC.pill('合約類型：NEC', 'dot--ok'), el('button', { class: 'btn btn--sm', onclick: function () { ctx.go('contract'); } }, '更改合約類型')]
    }));

    root.appendChild(progressCard(ctx));
    root.appendChild(ctx.secTitle('合約條款遵從清單'));
    root.appendChild(clauseCard(ctx));
    root.appendChild(ctx.secTitle('提交要求逐項跟進'));
    root.appendChild(gapBar(ctx));
    root.appendChild(reqSection(ctx));
  }

  /* 未選合約類型 → 引導（真實的業務狀態，不是空狀態） */
  function renderEmpty(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '提交導航器', sub: '尚未選定合約類型' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'empty', icon: '⚖', title: '請先選定合約類型',
        desc: '合規清單是按所選合約類型的差異化條款生成的。未選類型就不會有條款清單 —— 因為 NEC 與總價合約要交的東西並不相同。',
        actions: [el('button', { class: 'btn btn--primary', onclick: function () { ctx.go('contract'); } }, '前往選擇合約類型 →')]
      })
    }));
  }

  function renderLoading(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '提交導航器', sub: '正在載入合規清單…' }));
    var body = el('div', { class: 'card__body' });
    body.appendChild(el('div', { class: 'skel skel--title' }));
    for (var i = 0; i < 5; i++) {
      body.appendChild(el('div', { class: 'skel skel--line', style: 'width:' + (94 - i * 8) + '%' }));
    }
    root.appendChild(el('div', { class: 'card' }, body));
  }

  function renderError(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '提交導航器', sub: '合規記錄讀取失敗' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'error', icon: '✕', title: '無法讀取合規勾選記錄',
        desc: 'compliance store 讀取失敗，勾選狀態無法還原。你之前勾選過的項目沒有被刪除，只是暫時讀不到。',
        detail: 'DB: vicbid_db v2\nStore: compliance\nError: NotFoundError — object store "compliance" 未找到\n可能原因：資料庫由舊版本建立，尚未升級到 v2',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('正在升級資料庫…', 'info'); } }, '升級資料庫'),
          el('button', { class: 'btn', onclick: function () { ctx.go('backup'); } }, '前往資料與備份')
        ]
      })
    }));
  }

  function renderDegraded(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '提交導航器', sub: '部分內容未能對應' }));
    root.appendChild(el('div', { class: 'card card--accent' },
      el('div', { class: 'card__body' },
        ctx.state({
          kind: 'warn', icon: '!', title: '4 條提交要求未能自動歸類',
          desc: '標書原文的這幾條用語比較模糊，系統無法判斷屬哪個分類，暫列為「未分類」。它們不會被自動略過，仍會計入合規缺口。',
          actions: [el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已開啟手動歸類', 'info'); } }, '手動歸類')]
        }))));
    root.appendChild(progressCard(ctx));
    root.appendChild(clauseCard(ctx));
  }

  VC.registerView('nav-map', { nav: 'nav-map' }, function (root, ctx) {
    VC.dev.screen('nav-map', root, ctx, {
      data: renderData, empty: renderEmpty, loading: renderLoading,
      error: renderError, degraded: renderDegraded
    });
  });
})();
